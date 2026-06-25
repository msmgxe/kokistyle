"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, X, Loader2 } from "lucide-react";
import { useVoice, dispatchVoiceAction } from "@/src/context/VoiceContext";

// ── Types ──────────────────────────────────────────────────────────────────
type Phase = "idle" | "listening" | "thinking" | "speaking" | "confirm" | "error";

interface Msg  { role: "user" | "assistant"; text: string; }
interface FieldDef { key: string; question: string; parse: (t: string) => unknown; }

const ASSISTANT = "Katy";
const TODAY     = () => new Date().toISOString().split("T")[0];

// ── Client-side parsers ────────────────────────────────────────────────────
function parseMoney(t: string): number | null {
  const s = t.toLowerCase().replace(/[$,]/g, "").trim();
  const km = s.match(/(\d+(?:\.\d+)?)\s*(mil|k\b)/i);
  if (km) return parseFloat(km[1]) * 1000;
  const mm = s.match(/(\d+(?:\.\d+)?)\s*(mill?[oó]n?)/i);
  if (mm) return parseFloat(mm[1]) * 1_000_000;
  const nm = s.match(/\d+(?:\.\d+)?/);
  if (nm) return parseFloat(nm[0]);
  const words: [RegExp, number][] = [
    [/nueve\s*mil/, 9000], [/ocho\s*mil/, 8000], [/siete\s*mil/, 7000],
    [/seis\s*mil/,  6000], [/cinco\s*mil/, 5000], [/cuatro\s*mil/, 4000],
    [/tres\s*mil/,  3000], [/dos\s*mil/,   2000], [/\bmil\b/,      1000],
    [/quinientos/,  500],  [/cuatrocientos/, 400], [/trescientos/, 300],
    [/doscientos/,  200],  [/cien(to)?/,     100],
  ];
  for (const [re, v] of words) if (re.test(s)) return v;
  return null;
}

function parseMethod(t: string): string | null {
  const s = t.toLowerCase();
  if (/zelh?e|zelle/i.test(s))                       return "Zelle";
  if (/efectivo|cash|contado/i.test(s))              return "Efectivo";
  if (/transfer|banco|deposito|depósito/i.test(s))   return "Transferencia";
  if (/cheque|check/i.test(s))                       return "Cheque";
  if (/tarjeta|card|cr[eé]dito|d[eé]bito/i.test(s)) return "Tarjeta";
  return null;
}

function parsePayType(t: string): string | null {
  const s = t.toLowerCase();
  if (/anticipo|adelanto|dep[oó]sito/i.test(s)) return "anticipo";
  if (/final|[uú]ltimo|[uú]ltima/i.test(s))     return "final";
  if (/abono|pago/i.test(s))                    return "abono";
  return null;
}

function parseBudgetType(t: string): string | null {
  const s = t.toLowerCase();
  if (/mano|obra|labor|install|plom|elect|pintur|carpint/i.test(s)) return "mano";
  if (/material|gabinet|azulejo|pintura|grifo|piso/i.test(s))       return "material";
  return null;
}

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US");
}

// ── Required fields per action ─────────────────────────────────────────────
const ACTION_FIELDS: Record<string, FieldDef[]> = {
  create_project: [
    { key: "title",  question: "¿Cómo se llama el proyecto?",       parse: (t) => t.trim() || null },
    { key: "client", question: "¿Nombre del cliente?",              parse: (t) => t.trim() || null },
    { key: "budget", question: "¿Cuál es el presupuesto?",          parse: parseMoney },
    { key: "address",question: "¿Dirección? (o di 'sin dirección')",parse: (t) => /sin\s*direc/i.test(t) ? "Sin dirección" : t.trim() || null },
  ],
  create_payment: [
    { key: "amount", question: "¿Cuánto recibiste?",                             parse: parseMoney },
    { key: "method", question: "¿Cómo pagó? Zelle, efectivo o transferencia.",   parse: parseMethod },
    { key: "type",   question: "¿Anticipo, abono o pago final?",                 parse: parsePayType },
  ],
  create_expense: [
    { key: "payee_name", question: "¿A quién le pagaste?",                          parse: (t) => t.trim() || null },
    { key: "amount",     question: "¿Cuánto le pagaste?",                           parse: parseMoney },
    { key: "concept",    question: "¿Por qué concepto?",                            parse: (t) => t.trim() || null },
    { key: "method",     question: "¿Cómo pagaste? Zelle, efectivo o transferencia.",parse: parseMethod },
  ],
  create_task: [
    { key: "name",          question: "¿Qué actividad?",    parse: (t) => t.trim() || null },
    { key: "assignee_name", question: "¿Quién la realiza?", parse: (t) => t.trim() || null },
  ],
  create_material: [
    { key: "name",     question: "¿Qué material?",               parse: (t) => t.trim() || null },
    { key: "cost",     question: "¿Cuánto cuesta?",              parse: parseMoney },
    { key: "supplier", question: "¿En qué tienda o proveedor?",  parse: (t) => t.trim() || null },
  ],
  create_budget_item: [
    { key: "description", question: "¿Descripción de la línea?",     parse: (t) => t.trim() || null },
    { key: "type",        question: "¿Mano de obra o material?",     parse: parseBudgetType },
    { key: "amount",      question: "¿Cuánto?",                      parse: parseMoney },
  ],
  create_contact: [
    { key: "name",      question: "¿Nombre completo?",         parse: (t) => t.trim() || null },
    { key: "specialty", question: "¿Cuál es su especialidad?", parse: (t) => t.trim() || null },
    { key: "phone",     question: "¿Número de teléfono?",      parse: (t) => t.trim() || null },
  ],
};

const ACTION_LABELS: Record<string, string> = {
  create_project:     "nuevo proyecto",
  create_payment:     "ingreso",
  create_expense:     "egreso",
  create_task:        "tarea",
  create_material:    "material",
  create_budget_item: "línea de presupuesto",
  create_contact:     "contacto",
};

// ── Web Speech API shim ────────────────────────────────────────────────────
interface SR extends EventTarget {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror:  ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend:    (() => void) | null;
}
interface SpeechRecognitionEvent      extends Event { results: SpeechRecognitionResultList; }
interface SpeechRecognitionErrorEvent extends Event { error: string; }
declare global {
  interface Window {
    SpeechRecognition?:       new () => SR;
    webkitSpeechRecognition?: new () => SR;
  }
}

// ── TTS ────────────────────────────────────────────────────────────────────
let _voicesLoaded = false;
function loadVoices(): Promise<void> {
  if (_voicesLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    if (window.speechSynthesis.getVoices().length) { _voicesLoaded = true; resolve(); return; }
    const h = () => { _voicesLoaded = true; window.speechSynthesis.onvoiceschanged = null; resolve(); };
    window.speechSynthesis.onvoiceschanged = h;
    setTimeout(() => { if (!_voicesLoaded) { _voicesLoaded = true; resolve(); } }, 800);
  });
}

function pickVoice(): SpeechSynthesisVoice | null {
  const vs = window.speechSynthesis.getVoices();
  const prefs = ["Paulina", "Mónica", "Monica", "Luciana", "Penélope", "Penelope",
                 "Google español de Estados Unidos", "Google español"];
  for (const p of prefs) {
    const v = vs.find(v => v.name.includes(p));
    if (v) return v;
  }
  return vs.find(v => v.lang.startsWith("es")) ?? null;
}

/**
 * Speak and resolve 1200ms after TTS ends so Android can switch
 * its audio path from speaker back to microphone before we listen.
 */
async function tts(text: string): Promise<void> {
  if (!("speechSynthesis" in window)) return;
  await loadVoices();
  window.speechSynthesis.cancel();
  await new Promise<void>((resolve) => {
    const utt  = new SpeechSynthesisUtterance(text);
    utt.lang   = "es-US";
    utt.rate   = 0.95;
    utt.pitch  = 1.1;
    const voice = pickVoice();
    if (voice) utt.voice = voice;
    utt.onend   = () => setTimeout(resolve, 1200);
    utt.onerror = () => setTimeout(resolve, 400);
    window.speechSynthesis.speak(utt);
  });
}

// ── Speech recognition ─────────────────────────────────────────────────────
// Structural type avoids the deprecated MutableRefObject import
function listenOnce(recRef: { current: SR | null }): Promise<string> {
  return new Promise((outerResolve, outerReject) => {
    (async () => {
      // Request mic permission explicitly — required for Android Chrome
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
      } catch {
        outerReject(new Error("mic-permission")); return;
      }

      const SRClass = window.SpeechRecognition ?? window.webkitSpeechRecognition;
      if (!SRClass) { outerReject(new Error("unsupported")); return; }

      const rec = new SRClass();
      rec.lang            = "es-US";
      rec.continuous      = true;   // Prevents Android from auto-stopping after silence
      rec.interimResults  = true;
      rec.maxAlternatives = 1;

      recRef.current = rec;
      let settled = false;
      let best    = "";
      let timer: ReturnType<typeof setTimeout> | null = null;

      const finish = (text: string | null) => {
        if (settled) return;
        settled = true;
        if (timer) { clearTimeout(timer); timer = null; }
        try { rec.stop(); } catch { /* noop */ }
        recRef.current = null;
        text ? outerResolve(text) : outerReject(new Error("no-speech"));
      };

      rec.onresult = (e) => {
        const all  = Array.from(e.results);
        const text = all.map(r => r[0].transcript).join(" ").trim();
        if (text) best = text;
        if (all.some(r => r.isFinal) && text) finish(text);
      };

      rec.onerror = (e) => {
        if (e.error === "no-speech") { finish(best || null); return; }
        if (!settled) { settled = true; recRef.current = null; outerReject(new Error(e.error)); }
      };

      rec.onend = () => { finish(best || null); };

      // 8-second safety timeout (continuous mode won't self-stop)
      timer = setTimeout(() => finish(best || null), 8000);

      try { rec.start(); } catch (e) { outerReject(e); }
    })();
  });
}

// ── Component ──────────────────────────────────────────────────────────────
export default function VoiceFAB() {
  const { meta } = useVoice();
  const metaRef  = useRef(meta);
  useEffect(() => { metaRef.current = meta; }, [meta]);

  const [phase,         setPhase]         = useState<Phase>("idle");
  const [messages,      setMessages]      = useState<Msg[]>([]);
  const [pendingAction, setPendingAction] = useState<{ action: string; data: Record<string, unknown> } | null>(null);
  const [confirmText,   setConfirmText]   = useState("");
  const [errorMsg,      setErrorMsg]      = useState("");

  const activeRef = useRef(false);
  const recRef    = useRef<SR | null>(null);
  const startedRef= useRef(false);   // prevents double-start
  const msgEndRef = useRef<HTMLDivElement>(null);

  const supported =
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── helpers ───────────────────────────────────────────────────────────────
  const push = useCallback((role: Msg["role"], text: string) => {
    setMessages(prev => [...prev, { role, text }]);
  }, []);

  const say = useCallback(async (text: string) => {
    if (!activeRef.current) return;
    setPhase("speaking");
    push("assistant", text);
    await tts(text);
  }, [push]);

  const listen = useCallback(async (): Promise<string | null> => {
    if (!activeRef.current) return null;
    setPhase("listening");
    try {
      return await listenOnce(recRef);
    } catch (e) {
      return e instanceof Error && e.message === "no-speech" ? "" : null;
    }
  }, []);

  const stop = useCallback(() => {
    activeRef.current  = false;
    startedRef.current = false;
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    recRef.current?.abort();
    recRef.current = null;
    setPhase("idle");
    setMessages([]);
    setPendingAction(null);
    setConfirmText("");
    setErrorMsg("");
  }, []);

  const handleConfirm = useCallback(() => {
    if (!pendingAction) return;
    dispatchVoiceAction({ ...pendingAction, confirmMessage: confirmText });
    stop();
  }, [pendingAction, confirmText, stop]);

  // ── Main flow ─────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (phase !== "idle" || startedRef.current) return;
    startedRef.current = true;
    activeRef.current  = true;
    setMessages([]); setPendingAction(null); setConfirmText(""); setErrorMsg("");

    (async () => {
      // ① Greet
      await say(`Hola, soy ${ASSISTANT}. ¿Qué necesitas?`);

      // ② Listen for intent
      let rawIntent = await listen();
      if (rawIntent === null) { setErrorMsg("Error al escuchar. Intenta de nuevo."); setPhase("error"); return; }

      // Retry once if no-speech
      if (!rawIntent) {
        await say("No te escuché. ¿Qué quieres registrar?");
        rawIntent = await listen();
        if (!rawIntent) { stop(); return; }
      }

      push("user", rawIntent);
      if (!activeRef.current) return;
      setPhase("thinking");

      // ③ API call — intent + data extraction
      let action = "unknown";
      let data: Record<string, unknown> = {};

      try {
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: rawIntent,
            context:    metaRef.current.context,
            contacts:   metaRef.current.contacts ?? [],
          }),
        });
        const j = await res.json();
        action = j.action ?? "unknown";
        data   = j.data   ?? {};
      } catch {
        // If API fails, try simple context-based routing
        action = contextDefault(metaRef.current.context);
      }

      if (!activeRef.current) return;

      if (action === "unknown" || !ACTION_FIELDS[action]) {
        await say("No entendí qué quieres registrar. Intenta ser más específico.");
        stop(); return;
      }

      // ④ Ask only for missing required fields
      const fields = ACTION_FIELDS[action];
      for (const field of fields) {
        if (data[field.key] != null) continue;  // already extracted

        await say(field.question);
        const answer = await listen();
        if (!activeRef.current) return;
        if (!answer) continue;  // skip optional if no answer

        push("user", answer);
        const parsed = field.parse(answer);
        if (parsed != null) {
          data[field.key] = parsed;
        } else if (field.key === "amount" || field.key === "cost" || field.key === "budget" || field.key === "rate") {
          // retry once for money fields
          await say("No entendí el monto. ¿Cuánto en números?");
          const r2 = await listen();
          if (r2) { push("user", r2); const p2 = parseMoney(r2); if (p2 != null) data[field.key] = p2; }
        }
      }

      // Fill defaults
      if (!data.date) data.date = TODAY();
      if (action === "create_task" && !data.assignee_name) data.assignee_name = "Equipo propio";
      if (action === "create_task" && !data.hours)         data.hours = 8;

      // ⑤ Confirm
      const label  = ACTION_LABELS[action] ?? "registro";
      const summary = buildSummary(action, data);
      const conf = `Voy a registrar ${label}: ${summary}. ¿Confirmamos?`;

      if (!activeRef.current) return;
      setPendingAction({ action, data });
      setConfirmText(conf);
      await say(conf);
      if (!activeRef.current) return;
      setPhase("confirm");
    })().catch(err => {
      console.error("[VoiceFAB]", err);
      if (activeRef.current) { setErrorMsg("Error inesperado. Intenta de nuevo."); setPhase("error"); }
      startedRef.current = false;
    });
  }, [phase, say, listen, push, stop]);

  if (!supported) return null;

  // ── UI ────────────────────────────────────────────────────────────────────
  const headerLabel: Record<Phase, string> = {
    idle: "", listening: "Escuchando…", thinking: "Pensando…",
    speaking: `${ASSISTANT} habla…`, confirm: "¿Confirmas?", error: "Error",
  };
  const dotCls: Record<Phase, string> = {
    idle: "", listening: "animate-ping bg-[#B0492F]", thinking: "animate-pulse bg-[#4E7A82]",
    speaking: "animate-pulse bg-[#4F8A63]", confirm: "bg-[#16323D]", error: "bg-[#B0492F]",
  };
  const fabBg =
    phase === "listening" ? "animate-pulse bg-[#B0492F]" :
    phase === "thinking" || phase === "speaking" ? "bg-[#4E7A82]" :
    "bg-[#16323D] hover:bg-[#0e2630]";

  return (
    <>
      {phase !== "idle" && (
        <div className="fixed bottom-24 right-4 z-[150] flex w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[#E6DDCB] bg-white shadow-2xl">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E6DDCB] bg-[#F7F3EA] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotCls[phase]}`} />
              <span className="text-xs font-bold text-[#16323D]">
                {ASSISTANT} — {headerLabel[phase]}
              </span>
            </div>
            <button onClick={stop} className="rounded-lg p-1 text-[#5C6A6E] hover:bg-[#ECE3D1]">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex max-h-[240px] flex-col gap-2 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <span className="mr-1.5 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#16323D] text-[9px] font-bold text-white">
                    {ASSISTANT[0]}
                  </span>
                )}
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-snug ${
                  m.role === "user"
                    ? "rounded-br-sm bg-[#16323D] text-white"
                    : "rounded-bl-sm border border-[#E6DDCB] bg-[#F7F3EA] text-[#16323D]"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {phase === "thinking" && (
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#16323D] text-[9px] font-bold text-white">
                  {ASSISTANT[0]}
                </span>
                <div className="flex gap-1 rounded-2xl rounded-bl-sm border border-[#E6DDCB] bg-[#F7F3EA] px-3 py-2">
                  {[0, 150, 300].map(d => (
                    <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5C6A6E]" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={msgEndRef} />
          </div>

          {/* Status bar */}
          {phase === "listening" && (
            <div className="flex items-center justify-center gap-1.5 border-t border-[#E6DDCB] bg-[#FFF5F5] py-2.5 px-4">
              {[10,16,13,18,11].map((h,i) => (
                <span key={i} className="w-[3px] rounded-full bg-[#B0492F]"
                  style={{ height: `${h}px`, animation: `pulse 0.7s ${i*80}ms infinite alternate ease-in-out` }} />
              ))}
              <span className="ml-2 text-[11px] font-semibold text-[#B0492F]">Habla ahora</span>
            </div>
          )}
          {phase === "speaking" && (
            <div className="flex items-center justify-center gap-2 border-t border-[#E6DDCB] bg-[#F0F7F5] py-2.5">
              <Loader2 size={13} className="animate-spin text-[#4F8A63]" />
              <span className="text-[11px] font-semibold text-[#4F8A63]">{ASSISTANT} está hablando…</span>
            </div>
          )}

          {/* Confirm */}
          {phase === "confirm" && (
            <div className="flex gap-2 border-t border-[#E6DDCB] p-3">
              <button onClick={stop} className="flex-1 rounded-xl bg-[#ECE3D1] py-3 text-sm font-bold text-[#5C6A6E] transition hover:bg-[#DDD3BB]">
                Cancelar
              </button>
              <button onClick={handleConfirm} className="flex-1 rounded-xl bg-[#16323D] py-3 text-sm font-bold text-white transition hover:bg-[#0e2630]">
                ✓ Confirmar
              </button>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="flex flex-col gap-2 border-t border-[#E6DDCB] p-3">
              <p className="text-sm text-[#B0492F]">{errorMsg}</p>
              <button onClick={() => { setPhase("idle"); startedRef.current = false; start(); }}
                className="w-full rounded-xl bg-[#16323D] py-2.5 text-sm font-bold text-white">
                Reintentar
              </button>
            </div>
          )}
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={phase === "idle" ? start : undefined}
        aria-label={phase === "idle" ? `Iniciar asistente ${ASSISTANT}` : headerLabel[phase]}
        className={`fixed bottom-6 right-6 z-[150] grid size-14 place-items-center rounded-full text-white shadow-2xl transition-all duration-200 active:scale-95 ${fabBg}`}
      >
        {phase === "thinking" || phase === "speaking"
          ? <Loader2 size={22} className="animate-spin" />
          : <Mic size={22} className={phase === "listening" ? "animate-pulse" : ""} />
        }
      </button>
    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function contextDefault(ctx: string): string {
  if (ctx.includes("pagos.ingresos"))  return "create_payment";
  if (ctx.includes("pagos.egresos"))   return "create_expense";
  if (ctx.includes("workflow"))        return "create_task";
  if (ctx.includes("materiales"))      return "create_material";
  if (ctx.includes("presupuesto"))     return "create_budget_item";
  if (ctx.includes("contactos"))       return "create_contact";
  return "create_project";
}

function buildSummary(action: string, data: Record<string, unknown>): string {
  switch (action) {
    case "create_payment":
      return `${data.type ?? ""} de ${fmt(Number(data.amount ?? 0))} por ${data.method ?? ""}`;
    case "create_expense":
      return `${fmt(Number(data.amount ?? 0))} a ${data.payee_name ?? ""} (${data.concept ?? ""})`;
    case "create_project":
      return `"${data.title ?? ""}" para ${data.client ?? ""}, ${fmt(Number(data.budget ?? 0))}`;
    case "create_task":
      return `"${data.name ?? ""}" — ${data.assignee_name ?? "Equipo propio"}`;
    case "create_material":
      return `${data.name ?? ""}, ${fmt(Number(data.cost ?? 0))} en ${data.supplier ?? ""}`;
    case "create_budget_item":
      return `${data.description ?? ""}, ${fmt(Number(data.amount ?? 0))}`;
    case "create_contact":
      return `${data.name ?? ""}, ${data.specialty ?? ""}`;
    default: return JSON.stringify(data);
  }
}
