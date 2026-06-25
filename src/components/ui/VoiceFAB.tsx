"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, X, Loader2 } from "lucide-react";
import { useVoice, dispatchVoiceAction } from "@/src/context/VoiceContext";

type State = "idle" | "listening" | "processing" | "confirm" | "error";

// Web Speech API type shim (not in TS lib by default)
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
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
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
  const [pendingAction, setPendingAction] = useState<{ action: string; confirmMessage: string; data: Record<string, unknown> } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const supported = typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.lang = "es-US";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setTranscript(text);
    };

    rec.onerror = (e) => {
      setErrorMsg(e.error === "not-allowed" ? "Permiso de micrófono denegado." : "Error al escuchar. Intenta de nuevo.");
      setState("error");
    };

    rec.onend = () => {
      // transcript onresult fires before onend — process in useEffect
    };

    recognitionRef.current = rec;
    setTranscript("");
    setState("listening");
    rec.start();
  }, []);

  // When transcript is ready, call the API
  useEffect(() => {
    if (!transcript) return;
    setState("processing");

    (async () => {
      try {
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript,
            context: meta.context,
            contacts: meta.contacts ?? [],
          }),
        });
        const va = await res.json();
        if (va.action === "unknown") {
          setErrorMsg(va.confirmMessage || "No entendí el comando. Intenta de nuevo.");
          setState("error");
        } else {
          setPendingAction(va);
          setState("confirm");
        }
      } catch {
        setErrorMsg("Error de conexión. Verifica que la API esté activa.");
        setState("error");
      }
    })();
  }, [transcript, meta]);

  const handleConfirm = () => {
    if (!pendingAction) return;
    dispatchVoiceAction(pendingAction);
    reset();
  };

  const reset = () => {
    setState("idle");
    setTranscript("");
    setPendingAction(null);
    setErrorMsg("");
  };

  if (!supported) return null;

  return (
    <>
      {/* Floating Action Button */}
      <button
        type="button"
        onClick={state === "listening" ? stopListening : state === "idle" ? startListening : undefined}
        aria-label={state === "listening" ? "Detener grabación" : "Comando de voz"}
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

      {/* Transcript indicator while listening */}
      {state === "listening" && (
        <div className="fixed bottom-24 right-6 z-[150] max-w-[220px] rounded-2xl bg-[#16323D] px-4 py-2.5 text-sm text-white shadow-xl">
          <span className="inline-block h-2 w-2 animate-ping rounded-full bg-[#B0492F] mr-2" />
          Escuchando…
        </div>
      )}

      {/* Confirm panel */}
      {state === "confirm" && pendingAction && (
        <div className="fixed inset-0 z-[160] flex items-end justify-center bg-[#16323D]/40 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-[400px] rounded-t-[22px] bg-[#F7F3EA] p-6 shadow-2xl sm:rounded-[20px]">
            <div className="mb-1 flex items-start justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#5C6A6E]">Comando detectado</p>
              <button onClick={reset} className="text-[#5C6A6E] hover:text-[#16323D]"><X size={16} /></button>
            </div>
            <p className="mt-1 text-sm font-semibold text-[#16323D]">{pendingAction.confirmMessage}</p>
            {transcript && (
              <p className="mt-1.5 text-[11px] italic text-[#5C6A6E]">&ldquo;{transcript}&rdquo;</p>
            )}
            <div className="mt-5 flex gap-3">
              <button onClick={reset} className="flex-1 rounded-xl bg-[#ECE3D1] py-3 text-sm font-bold text-[#5C6A6E]">
                Cancelar
              </button>
              <button onClick={handleConfirm} className="flex-1 rounded-xl bg-[#16323D] py-3 text-sm font-bold text-white">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error panel */}
      {state === "error" && (
        <div className="fixed bottom-24 right-6 z-[150] flex max-w-[260px] items-start gap-3 rounded-2xl bg-[#F7F3EA] p-4 shadow-2xl border border-[#E6DDCB]">
          <p className="flex-1 text-sm text-[#B0492F]">{errorMsg}</p>
          <button onClick={reset} className="mt-0.5 text-[#5C6A6E] hover:text-[#16323D]"><X size={16} /></button>
        </div>
      )}
    </>
  );
}
