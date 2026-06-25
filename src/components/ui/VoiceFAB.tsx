"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, X, Loader2 } from "lucide-react";
import { useVoice, dispatchVoiceAction } from "@/src/context/VoiceContext";

type State = "idle" | "listening" | "processing" | "confirm" | "error";

// Web Speech API type shim
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onnomatch: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export default function VoiceFAB() {
  const { meta } = useVoice();
  const [state, setState] = useState<State>("idle");
  const [transcript, setTranscript] = useState("");
  const [pendingAction, setPendingAction] = useState<{
    action: string;
    confirmMessage: string;
    data: Record<string, unknown>;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  // Tracks whether onresult fired before onend — avoids state getting stuck
  const gotResultRef = useRef(false);
  // Keep latest meta in a ref so callbacks always read current value
  const metaRef = useRef(meta);
  useEffect(() => { metaRef.current = meta; }, [meta]);

  const supported =
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const reset = useCallback(() => {
    setState("idle");
    setTranscript("");
    setPendingAction(null);
    setErrorMsg("");
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const callApi = useCallback(async (text: string) => {
    setState("processing");
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: text,
          context: metaRef.current.context,
          contacts: metaRef.current.contacts ?? [],
        }),
      });
      const va = await res.json();
      if (va.action === "unknown") {
        setErrorMsg(va.confirmMessage || "No entendí el comando. Intenta de nuevo.");
        setState("error");
      } else {
        setPendingAction(va);
        setTranscript(text);
        setState("confirm");
      }
    } catch {
      setErrorMsg("Error de conexión con el servidor. Intenta de nuevo.");
      setState("error");
    }
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    // es-419 = Spanish Latin America — mejor cobertura en Chrome Android
    rec.lang = "es-419";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    gotResultRef.current = false;

    rec.onresult = (e) => {
      gotResultRef.current = true;
      const text = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(" ")
        .trim();
      if (text) {
        // Call API directly — no state intermediary needed
        callApi(text);
      }
    };

    rec.onnomatch = () => {
      gotResultRef.current = false;
    };

    rec.onerror = (e) => {
      gotResultRef.current = true; // avoid double-handling in onend
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setErrorMsg("Permiso de micrófono denegado. Actívalo en la configuración del navegador.");
      } else if (e.error === "no-speech") {
        setErrorMsg("No se detectó voz. Habla más cerca del micrófono.");
      } else if (e.error === "network") {
        setErrorMsg("Error de red con el reconocimiento de voz.");
      } else {
        setErrorMsg(`Error al escuchar (${e.error}). Intenta de nuevo.`);
      }
      setState("error");
    };

    rec.onend = () => {
      // If no result and no error were captured, go back to idle gracefully
      if (!gotResultRef.current) {
        setState("idle");
      }
      recognitionRef.current = null;
    };

    recognitionRef.current = rec;
    setState("listening");

    try {
      rec.start();
    } catch {
      setErrorMsg("No se pudo iniciar el micrófono. Recarga la página.");
      setState("error");
    }
  }, [callApi]);

  const handleConfirm = () => {
    if (!pendingAction) return;
    dispatchVoiceAction(pendingAction);
    reset();
  };

  if (!supported) return null;

  return (
    <>
      {/* FAB */}
      <button
        type="button"
        onClick={
          state === "idle"
            ? startListening
            : state === "listening"
            ? stopListening
            : undefined
        }
        aria-label={
          state === "listening" ? "Detener grabación" : "Comando de voz"
        }
        className={`fixed bottom-6 right-6 z-[150] grid size-14 place-items-center rounded-full shadow-2xl transition-all duration-200 active:scale-95 ${
          state === "listening"
            ? "animate-pulse bg-[#B0492F] text-white"
            : state === "processing"
            ? "cursor-wait bg-[#4E7A82] text-white"
            : "bg-[#16323D] text-white hover:bg-[#0e2630]"
        }`}
      >
        {state === "processing" ? (
          <Loader2 size={22} className="animate-spin" />
        ) : state === "listening" ? (
          <MicOff size={22} />
        ) : (
          <Mic size={22} />
        )}
      </button>

      {/* Indicator while listening */}
      {state === "listening" && (
        <div className="fixed bottom-24 right-6 z-[150] max-w-[230px] rounded-2xl bg-[#16323D] px-4 py-2.5 text-sm text-white shadow-xl">
          <span className="mr-2 inline-block h-2 w-2 animate-ping rounded-full bg-[#B0492F]" />
          Habla ahora… toca para detener
        </div>
      )}

      {/* Processing indicator */}
      {state === "processing" && (
        <div className="fixed bottom-24 right-6 z-[150] max-w-[230px] rounded-2xl bg-[#4E7A82] px-4 py-2.5 text-sm text-white shadow-xl">
          <Loader2 size={13} className="mr-2 inline animate-spin" />
          Procesando…
        </div>
      )}

      {/* Confirm panel */}
      {state === "confirm" && pendingAction && (
        <div className="fixed inset-0 z-[160] flex items-end justify-center bg-[#16323D]/40 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-[400px] rounded-t-[22px] bg-[#F7F3EA] p-6 shadow-2xl sm:rounded-[20px]">
            <div className="mb-1 flex items-start justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#5C6A6E]">
                Comando detectado
              </p>
              <button onClick={reset} className="text-[#5C6A6E] hover:text-[#16323D]">
                <X size={16} />
              </button>
            </div>
            <p className="mt-1 text-sm font-semibold text-[#16323D]">
              {pendingAction.confirmMessage}
            </p>
            {transcript && (
              <p className="mt-1.5 text-[11px] italic text-[#5C6A6E]">
                &ldquo;{transcript}&rdquo;
              </p>
            )}
            <div className="mt-5 flex gap-3">
              <button
                onClick={reset}
                className="flex-1 rounded-xl bg-[#ECE3D1] py-3 text-sm font-bold text-[#5C6A6E]"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 rounded-xl bg-[#16323D] py-3 text-sm font-bold text-white"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error panel */}
      {state === "error" && (
        <div className="fixed bottom-24 right-6 z-[150] flex max-w-[270px] items-start gap-3 rounded-2xl border border-[#E6DDCB] bg-[#F7F3EA] p-4 shadow-2xl">
          <p className="flex-1 text-sm text-[#B0492F]">{errorMsg}</p>
          <button
            onClick={reset}
            className="mt-0.5 shrink-0 text-[#5C6A6E] hover:text-[#16323D]"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
