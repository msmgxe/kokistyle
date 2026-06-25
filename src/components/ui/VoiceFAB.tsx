"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, X, Loader2 } from "lucide-react";
import { useVoice, dispatchVoiceAction } from "@/src/context/VoiceContext";

// ── Types ──────────────────────────────────────────────────────────────────
type Phase = "idle" | "listening" | "thinking" | "speaking" | "confirm" | "error";
interface Msg { role: "user" | "assistant"; text: string; }
interface ApiResponse {
  type: "question" | "action";
  text?: string;
  action?: string;
  data?: Record<string, unknown>;
  confirmMessage?: string;
}

// ── Web Speech API shim ────────────────────────────────────────────────────
interface SR extends EventTarget {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event { error: string; }
declare global {
  interface Window {
    SpeechRecognition?: new () => SR;
    webkitSpeechRecognition?: new () => SR;
  }
}

const ASSISTANT_NAME = "Katy";

// ── TTS ────────────────────────────────────────────────────────────────────
function getBestVoice(): SpeechSynthesisVoice | null {
  const vs = window.speechSynthesis.getVoices();
  // Female Spanish voices by device priority
  const prefs = [
    "Paulina",           // macOS / iOS
    "Mónica", "Monica",  // macOS / iOS
    "Luciana",           // macOS
    "Penélope", "Penelope",
    "Google español de Estados Unidos",
    "Google español",
  ];
  for (const n of prefs) {
    const v = vs.find(v => v.name.includes(n));
    if (v) return v;
  }
  return vs.find(v => v.lang.startsWith("es")) ?? null;
}

/**
 * Speak text and resolve.
 * IMPORTANT: resolves 700 ms AFTER onend so Android has time
 * to switch audio subsystem from speaker → microphone.
 */
function tts(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) { resolve(); return; }
    window.speechSynthesis.cancel();

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "es-US";
    utt.rate = 0.97;
    utt.pitch = 1.1;

    // Wait for voices (they may not be ready on first call)
    const trySpeak = () => {
      const voice = getBestVoice();
      if (voice) utt.voice = voice;
      utt.onend   = () => setTimeout(resolve, 700); // <-- key fix
      utt.onerror = () => setTimeout(resolve, 200);
      window.speechSynthesis.speak(utt);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      trySpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        trySpeak();
      };
      // Fallback: if onvoiceschanged never fires
      setTimeout(trySpeak, 300);
    }
  });
}

// ── Speech recognition ─────────────────────────────────────────────────────
/**
 * Single recognition session.
 * Uses interimResults so onend can still resolve with partial text
 * in case the final-result event was missed (Android quirk).
 */
function listenOnce(recognitionRef: React.MutableRefObject<SR | null>): Promise<string> {
  return new Promise((resolve, reject) => {
    const SpeechRecognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) { reject(new Error("unsupported")); return; }

    const rec = new SpeechRecognition();
    // es-US has the widest Android Chrome coverage for Spanish
    rec.lang = "es-US";
    rec.continuous = false;
    rec.interimResults = true;   // capture partials in case final is lost
    rec.maxAlternatives = 1;

    recognitionRef.current = rec;
    let settled = false;
    let best = "";              // best transcript seen so far

    rec.onresult = (e) => {
      const results = Array.from(e.results);
      const text = results.map(r => r[0].transcript).join(" ").trim();
      if (text) best = text;

      // Resolve immediately on any final segment
      if (results.some(r => r.isFinal) && text) {
        settled = true;
        recognitionRef.current = null;
        resolve(text);
      }
    };

    rec.onerror = (e) => {
      if (settled) return;
      settled = true;
      recognitionRef.current = null;
      reject(new Error(e.error));
    };

    rec.onend = () => {
      recognitionRef.current = null;
      if (settled) return;
      settled = true;
      // Use whatever partial we heard, or report no-speech
      if (best) resolve(best);
      else reject(new Error("no-speech"));
    };

    try { rec.start(); } catch (e) { reject(e); }
  });
}

// ── Component ──────────────────────────────────────────────────────────────
export default function VoiceFAB() {
  const { meta } = useVoice();
  const metaRef = useRef(meta);
  useEffect(() => { metaRef.current = meta; }, [meta]);

  const [phase, setPhase]                 = useState<Phase>("idle");
  const [messages, setMessages]           = useState<Msg[]>([]);
  const [pendingAction, setPendingAction] = useState<ApiResponse | null>(null);
  const [errorMsg, setErrorMsg]           = useState("");

  const activeRef      = useRef(false);
  const recognitionRef = useRef<SR | null>(null);
  const msgEndRef      = useRef<HTMLDivElement>(null);
  const noSpeechCount  = useRef(0);

  const supported =
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── helpers ───────────────────────────────────────────────────────────────
  const addMsg = useCallback(
    (role: Msg["role"], text: string, list: Msg[]): Msg[] => {
      const next = [...list, { role, text }];
      setMessages(next);
      return next;
    },
    []
  );

  const speak = useCallback(async (text: string) => {
    if (!activeRef.current) return;
    setPhase("speaking");
    await tts(text);
  }, []);

  const cancelAll = useCallback(() => {
    activeRef.current = false;
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    noSpeechCount.current = 0;
    setPhase("idle");
    setMessages([]);
    setPendingAction(null);
    setErrorMsg("");
  }, []);

  const callApi = useCallback(async (history: Msg[]): Promise<ApiResponse> => {
    const res = await fetch("/api/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: history,
        context:  metaRef.current.context,
        contacts: metaRef.current.contacts ?? [],
      }),
    });
    if (!res.ok) throw new Error(`http-${res.status}`);
    return res.json();
  }, []);

  // ── Conversation loop ─────────────────────────────────────────────────────
  const startConversation = useCallback(() => {
    if (phase !== "idle") return;

    activeRef.current   = true;
    noSpeechCount.current = 0;
    setMessages([]);
    setPendingAction(null);
    setErrorMsg("");

    const loop = async () => {
      let history: Msg[] = [];

      // Greeting
      const greeting = `Hola, soy ${ASSISTANT_NAME}. ¿Qué quieres registrar?`;
      history = addMsg("assistant", greeting, history);
      await speak(greeting);

      while (activeRef.current) {
        setPhase("listening");

        let userText: string;
        try {
          userText = await listenOnce(recognitionRef);
          noSpeechCount.current = 0;
        } catch (e) {
          if (!activeRef.current) return;
          const err = e instanceof Error ? e.message : "";

          if (err === "no-speech") {
            noSpeechCount.current += 1;
            if (noSpeechCount.current >= 3) {
              const bye = "No te estoy escuchando. Toca el micrófono cuando quieras continuar.";
              history = addMsg("assistant", bye, history);
              await tts(bye);   // speak without checking activeRef (final msg)
              cancelAll();
              return;
            }
            if (noSpeechCount.current === 2) {
              const retry = "Estoy aquí. Habla cuando estés lista.";
              history = addMsg("assistant", retry, history);
              await speak(retry);
            }
            continue;
          }

          // Real error
          const msgs: Record<string, string> = {
            "not-allowed":         "Permiso de micrófono denegado. Actívalo en la configuración del navegador.",
            "service-not-allowed": "Permiso de micrófono denegado.",
            "network":             "Error de red con el reconocimiento de voz.",
            "unsupported":         "Tu navegador no soporta reconocimiento de voz.",
          };
          setErrorMsg(msgs[err] ?? `Error al escuchar (${err}). Intenta de nuevo.`);
          setPhase("error");
          return;
        }

        if (!userText || !activeRef.current) continue;
        history = addMsg("user", userText, history);
        setPhase("thinking");

        let response: ApiResponse;
        try {
          response = await callApi(history);
        } catch {
          if (!activeRef.current) return;
          setErrorMsg("Error de conexión. Verifica tu red e intenta de nuevo.");
          setPhase("error");
          return;
        }
        if (!activeRef.current) return;

        if (response.type === "question" && response.text) {
          history = addMsg("assistant", response.text, history);
          await speak(response.text);
        } else if (response.type === "action") {
          const confirmText = response.confirmMessage ?? "¿Confirmo este registro?";
          history = addMsg("assistant", confirmText, history);
          setPendingAction(response);
          await speak(confirmText);
          if (!activeRef.current) return;
          setPhase("confirm");
          return;
        }
      }
    };

    loop().catch((err) => {
      console.error("[VoiceFAB]", err);
      if (activeRef.current) {
        setErrorMsg("Error inesperado. Toca para reintentar.");
        setPhase("error");
      }
    });
  }, [phase, addMsg, speak, cancelAll, callApi]);

  const handleConfirm = useCallback(() => {
    if (!pendingAction) return;
    dispatchVoiceAction({
      action:         pendingAction.action ?? "",
      data:           pendingAction.data ?? {},
      confirmMessage: pendingAction.confirmMessage ?? "",
    });
    cancelAll();
  }, [pendingAction, cancelAll]);

  // ── UI labels / styles ────────────────────────────────────────────────────
  const phaseLabel: Record<Phase, string> = {
    idle:     "Listo",
    listening:"Escuchando…",
    thinking: "Pensando…",
    speaking: `${ASSISTANT_NAME} habla…`,
    confirm:  "¿Confirmas?",
    error:    "Error",
  };

  const dotClass: Record<Phase, string> = {
    idle:     "bg-[#D7CBB3]",
    listening:"animate-ping bg-[#B0492F]",
    thinking: "animate-pulse bg-[#4E7A82]",
    speaking: "animate-pulse bg-[#4F8A63]",
    confirm:  "bg-[#16323D]",
    error:    "bg-[#B0492F]",
  };

  const fabBg =
    phase === "listening" ? "animate-pulse bg-[#B0492F]" :
    phase === "thinking" || phase === "speaking" ? "bg-[#4E7A82]" :
    "bg-[#16323D] hover:bg-[#0e2630]";

  if (!supported) return null;

  return (
    <>
      {/* ── Chat panel ── */}
      {phase !== "idle" && (
        <div className="fixed bottom-24 right-4 z-[150] flex w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[#E6DDCB] bg-white shadow-2xl">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E6DDCB] bg-[#F7F3EA] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass[phase]}`} />
              <span className="text-xs font-bold text-[#16323D]">
                {ASSISTANT_NAME} — {phaseLabel[phase]}
              </span>
            </div>
            <button
              onClick={cancelAll}
              className="rounded-lg p-1 text-[#5C6A6E] hover:bg-[#ECE3D1]"
              aria-label="Cerrar asistente"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex max-h-[260px] flex-col gap-2 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <span className="mr-1.5 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#16323D] text-[9px] font-bold text-white">
                    {ASSISTANT_NAME[0]}
                  </span>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-snug ${
                    m.role === "user"
                      ? "rounded-br-sm bg-[#16323D] text-white"
                      : "rounded-bl-sm border border-[#E6DDCB] bg-[#F7F3EA] text-[#16323D]"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {phase === "thinking" && (
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#16323D] text-[9px] font-bold text-white">
                  {ASSISTANT_NAME[0]}
                </span>
                <div className="flex gap-1 rounded-2xl rounded-bl-sm border border-[#E6DDCB] bg-[#F7F3EA] px-3 py-2">
                  {[0, 150, 300].map((d) => (
                    <span
                      key={d}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5C6A6E]"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={msgEndRef} />
          </div>

          {/* Listening indicator */}
          {phase === "listening" && (
            <div className="flex items-center justify-center gap-1.5 border-t border-[#E6DDCB] bg-[#FFF5F5] px-4 py-2.5">
              {[120, 200, 160, 220, 140].map((h, i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-[#B0492F]"
                  style={{
                    height: `${h / 10}px`,
                    animation: `pulse 0.6s ${i * 80}ms infinite alternate ease-in-out`,
                  }}
                />
              ))}
              <span className="ml-2 text-[11px] font-semibold text-[#B0492F]">
                Habla ahora — para automáticamente
              </span>
            </div>
          )}

          {/* Speaking indicator */}
          {phase === "speaking" && (
            <div className="flex items-center justify-center gap-2 border-t border-[#E6DDCB] bg-[#F0F7F5] px-4 py-2.5">
              <Loader2 size={13} className="animate-spin text-[#4F8A63]" />
              <span className="text-[11px] font-semibold text-[#4F8A63]">
                {ASSISTANT_NAME} está hablando…
              </span>
            </div>
          )}

          {/* Confirm */}
          {phase === "confirm" && pendingAction && (
            <div className="flex gap-2 border-t border-[#E6DDCB] p-3">
              <button
                onClick={cancelAll}
                className="flex-1 rounded-xl bg-[#ECE3D1] py-3 text-sm font-bold text-[#5C6A6E] transition hover:bg-[#DDD3BB]"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 rounded-xl bg-[#16323D] py-3 text-sm font-bold text-white transition hover:bg-[#0e2630]"
              >
                ✓ Confirmar
              </button>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="flex flex-col gap-2 border-t border-[#E6DDCB] p-3">
              <p className="text-sm text-[#B0492F]">{errorMsg}</p>
              <button
                onClick={() => { setPhase("idle"); startConversation(); }}
                className="w-full rounded-xl bg-[#16323D] py-2.5 text-sm font-bold text-white"
              >
                Reintentar
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── FAB ── */}
      <button
        type="button"
        onClick={phase === "idle" ? startConversation : undefined}
        aria-label={phase === "idle" ? `Iniciar asistente ${ASSISTANT_NAME}` : phaseLabel[phase]}
        className={`fixed bottom-6 right-6 z-[150] grid size-14 place-items-center rounded-full text-white shadow-2xl transition-all duration-200 active:scale-95 ${fabBg}`}
      >
        {phase === "thinking" || phase === "speaking" ? (
          <Loader2 size={22} className="animate-spin" />
        ) : (
          <Mic size={22} className={phase === "listening" ? "animate-pulse" : ""} />
        )}
      </button>
    </>
  );
}
