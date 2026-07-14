"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, X, Loader2, CheckCircle, Keyboard, Send } from "lucide-react";
import { useVoice } from "@/src/context/VoiceContext";
import type { VoiceMeta } from "@/src/context/VoiceContext";
import { supabase } from "@/src/lib/supabase";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";

type Phase  = "idle" | "listening" | "thinking" | "speaking" | "confirm" | "saving" | "success" | "error" | "text";
type ApiMsg = { role: "user" | "assistant"; content: string };
interface Msg { role: "user" | "assistant"; text: string; }

const ASSISTANT  = "Katy";
// Hoy en hora local del dispositivo (toISOString() es UTC y desfasa la fecha por la tarde)
const TODAY      = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const IS_ANDROID = () => typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
function fmt(n: number) { return "$" + n.toLocaleString("en-US"); }
function norm(s: string) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }

function localDetect(text: string, context: string): string {
  const t = norm(text);
  if (/\bpas[ao]r?|mover?|cambiar?/.test(t) && /\bproceso|hecho|hacer|estado/.test(t)) return "update_task_status";
  if (/\bpago|ingreso|cobr|recib/.test(t))        return "create_payment";
  if (/\begreso|gasto|gaste|pague|compre/.test(t)) return "create_expense";
  if (context.includes("pagos.ingresos"))  return "create_payment";
  if (context.includes("pagos.egresos"))   return "create_expense";
  if (context.includes("workflow"))        return "create_task";
  if (context.includes("materiales"))      return "create_material";
  if (context.includes("presupuesto"))     return "create_budget_item";
  if (context.includes("contactos"))       return "create_contact";
  if (/\bproyecto|obra|remodelaci/.test(t))    return "create_project";
  if (/\btarea|actividad|labor/.test(t))        return "create_task";
  if (/\bmaterial|suministro/.test(t))          return "create_material";
  if (/\bpresupuesto|cotiza|linea/.test(t))     return "create_budget_item";
  if (/\bcontacto|especiali|proveedor/.test(t)) return "create_contact";
  return "create_project";
}

const ACTION_LABELS: Record<string, string> = {
  create_project: "nuevo proyecto", create_payment: "ingreso",
  create_expense: "egreso",         create_task:    "tarea",
  create_material: "material",      create_budget_item: "línea de presupuesto",
  create_contact: "contacto",       update_task_status: "cambio de estado",
  create_agenda_event: "entrada de agenda",
};

const EDIT_FIELDS: Record<string, Array<{ key: string; label: string; type: "text" | "number" | "date" }>> = {
  create_project:     [{ key:"title", label:"Nombre", type:"text" }, { key:"client", label:"Cliente", type:"text" }, { key:"budget", label:"Presupuesto", type:"number" }, { key:"address", label:"Dirección", type:"text" }],
  create_payment:     [{ key:"amount", label:"Monto", type:"number" }, { key:"method", label:"Método", type:"text" }, { key:"type", label:"Tipo", type:"text" }, { key:"date", label:"Fecha", type:"date" }],
  create_expense:     [{ key:"payee_name", label:"A quién", type:"text" }, { key:"amount", label:"Monto", type:"number" }, { key:"concept", label:"Concepto", type:"text" }, { key:"method", label:"Método", type:"text" }, { key:"date", label:"Fecha", type:"date" }],
  create_task:        [{ key:"name", label:"Actividad", type:"text" }],
  create_material:    [{ key:"name", label:"Material", type:"text" }, { key:"cost", label:"Costo", type:"number" }, { key:"supplier", label:"Proveedor", type:"text" }],
  create_budget_item: [{ key:"description", label:"Descripción", type:"text" }, { key:"type", label:"Tipo", type:"text" }, { key:"amount", label:"Monto", type:"number" }],
  create_contact:     [{ key:"type", label:"Tipo", type:"text" }, { key:"name", label:"Nombre", type:"text" }, { key:"phone", label:"Teléfono", type:"text" }, { key:"specialty", label:"Especialidad", type:"text" }, { key:"rate", label:"Tarifa", type:"text" }, { key:"rate_type", label:"Por (hour/day)", type:"text" }],
  update_task_status: [{ key:"task_name", label:"Actividad", type:"text" }, { key:"status", label:"Estado", type:"text" }],
  create_agenda_event: [{ key:"title", label:"Título", type:"text" }, { key:"event_type", label:"Tipo (cita/task/reunion)", type:"text" }, { key:"event_date", label:"Fecha", type:"date" }, { key:"event_time", label:"Hora", type:"text" }, { key:"remind_from", label:"Avisar desde (2h/1d/2d/1w)", type:"text" }, { key:"repeat_every", label:"Repetir (once/daily)", type:"text" }],
};

async function saveAction(action: string, data: Record<string, unknown>, meta: VoiceMeta): Promise<string> {
  const pid  = meta.projectId;
  const date = String(data.date ?? TODAY());

  switch (action) {
    case "create_project": {
      const { data: row, error } = await supabase.from("projects").insert({
        title: String(data.title ?? "Nuevo proyecto"), client: String(data.client ?? ""),
        address: String(data.address ?? "Sin dirección"), budget: Number(data.budget ?? 0),
        status: "prospecto", start_date: String(data.start_date ?? TODAY()),
      }).select("title").single();
      if (error) throw error;
      return `Proyecto "${row.title}" creado`;
    }
    case "create_payment": {
      if (!pid) throw new Error("Abre un proyecto primero");
      const { error } = await supabase.from("payments").insert({
        project_id: pid, amount: Number(data.amount ?? 0), date,
        method: String(data.method ?? "Efectivo"), type: String(data.type ?? "abono"),
      });
      if (error) throw error;
      return `Ingreso de ${fmt(Number(data.amount ?? 0))} guardado`;
    }
    case "create_expense": {
      if (!pid) throw new Error("Abre un proyecto primero");
      const { error } = await supabase.from("expenses").insert({
        project_id: pid, amount: Number(data.amount ?? 0), date,
        method: String(data.method ?? "Efectivo"),
        payee_name: String(data.payee_name ?? ""), concept: String(data.concept ?? ""),
      });
      if (error) throw error;
      return `Egreso de ${fmt(Number(data.amount ?? 0))} guardado`;
    }
    case "create_task": {
      if (!pid) throw new Error("Abre un proyecto primero");
      const { error } = await supabase.from("tasks").insert({
        project_id: pid, name: String(data.name ?? "Nueva tarea"),
        hours: Number(data.hours ?? 8), duration_weeks: Number(data.duration_weeks ?? 1),
        status: "pend", sort_order: 9999, assigned_contact_id: null,
      });
      if (error) throw error;
      return `Tarea "${data.name ?? "Nueva tarea"}" creada`;
    }
    case "create_material": {
      if (!pid) throw new Error("Abre un proyecto primero");
      const { error } = await supabase.from("materials").insert({
        project_id: pid, name: String(data.name ?? ""), supplier: String(data.supplier ?? ""),
        cost: Number(data.cost ?? 0), bought: false,
      });
      if (error) throw error;
      return `Material "${data.name}" agregado`;
    }
    case "create_budget_item": {
      if (!pid) throw new Error("Abre un proyecto primero");
      const { error } = await supabase.from("budget_items").insert({
        project_id: pid, type: String(data.type ?? "material"),
        description: String(data.description ?? ""), amount: Number(data.amount ?? 0),
      });
      if (error) throw error;
      return `Línea "${data.description}" agregada`;
    }
    case "create_contact": {
      const rawType = String(data.type ?? "coworker").toLowerCase();
      const contactType: "coworker" | "customer" | "friend" =
        rawType.includes("client") || rawType.includes("cliente") || rawType.includes("customer") ? "customer"
        : rawType.includes("friend") || rawType.includes("amig") || rawType.includes("amistad") ? "friend"
        : "coworker";
      const isCoworker = contactType === "coworker";
      const rawRateType = String(data.rate_type ?? "hour").toLowerCase();
      const rateType: "hour" | "day" = rawRateType.includes("day") || rawRateType.includes("día") ? "day" : "hour";
      const { error } = await supabase.from("contacts").insert({
        name:      String(data.name ?? ""),
        phone:     String(data.phone ?? ""),
        type:      contactType,
        specialty: isCoworker ? String(data.specialty ?? "") : "",
        rate:      isCoworker && data.rate ? String(data.rate) : "",
        rate_type: isCoworker ? rateType : "hour",
      });
      if (error) throw error;
      return `Contacto "${data.name}" (${contactType}) creado`;
    }
    case "create_agenda_event": {
      const validType = ["cita", "task", "reunion"].includes(String(data.event_type))
        ? String(data.event_type) : "cita";
      const { error } = await supabase.from("agenda_events").insert({
        event_type:   validType,
        title:        String(data.title ?? "Sin título"),
        project_id:   data.project_id ? String(data.project_id) : null,
        event_date:   /^\d{4}-\d{2}-\d{2}$/.test(String(data.event_date ?? "")) ? String(data.event_date) : TODAY(),
        event_time:   /^\d{2}:\d{2}$/.test(String(data.event_time ?? "")) ? String(data.event_time) : "10:00",
        remind_from:  ["2h", "1d", "2d", "1w"].includes(String(data.remind_from)) ? String(data.remind_from) : "1d",
        repeat_every: data.repeat_every && data.repeat_every !== "once" ? "daily" : "once",
      });
      if (error) throw error;
      return `Agendado "${data.title}" para ${data.event_date ?? TODAY()} ${data.event_time ?? "10:00"}`;
    }
    case "update_task_status": {
      if (!pid) throw new Error("Abre un proyecto primero");
      const { data: taskList } = await supabase.from("tasks").select("id, name").eq("project_id", pid);
      if (!taskList?.length) throw new Error("No hay actividades en este proyecto");
      const search = String(data.task_name ?? "").toLowerCase().trim();
      const words  = search.split(/\s+/).filter((w) => w.length > 2);
      const scored = taskList.map((t) => {
        const name = t.name.toLowerCase();
        const score = words.filter((w) => name.includes(w)).length;
        return { t, score };
      }).sort((a, b) => b.score - a.score);
      if (!scored[0] || scored[0].score === 0) throw new Error(`No encontré la actividad "${data.task_name}"`);
      const match     = scored[0].t;
      const newStatus = String(data.status ?? "pend");
      const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", match.id);
      if (error) throw error;
      const sl: Record<string, string> = { pend: "Por hacer", prog: "En proceso", done: "Hecho" };
      return `"${match.name}" movida a ${sl[newStatus] ?? newStatus}`;
    }
    default:
      throw new Error(`Acción desconocida: ${action}`);
  }
}

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

function pickVoice(lang: "en" | "es"): SpeechSynthesisVoice | null {
  const vs = window.speechSynthesis.getVoices();
  if (lang === "en") {
    const enPrefs = ["Samantha", "Google US English", "Karen", "Victoria"];
    for (const p of enPrefs) { const v = vs.find(v => v.name.includes(p)); if (v) return v; }
    return vs.find(v => v.lang.startsWith("en")) ?? null;
  }
  const esPrefs = ["Paulina","Mónica","Monica","Luciana","Penélope","Penelope",
                   "Google español de Estados Unidos","Google español"];
  for (const p of esPrefs) { const v = vs.find(v => v.name.includes(p)); if (v) return v; }
  return vs.find(v => v.lang.startsWith("es")) ?? null;
}

async function primeMic(): Promise<void> {
  const android = IS_ANDROID();
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    await new Promise<void>(r => setTimeout(r, android ? 500 : 200));
    s.getTracks().forEach(t => t.stop());
    await new Promise<void>(r => setTimeout(r, android ? 300 : 100));
  } catch { /* permission denied or already active */ }
}

async function tts(text: string, lang: "en" | "es"): Promise<void> {
  if (!("speechSynthesis" in window)) return;
  await loadVoices();
  window.speechSynthesis.cancel();
  await new Promise<void>((resolve) => {
    const utt  = new SpeechSynthesisUtterance(text);
    utt.lang   = lang === "en" ? "en-US" : "es-US";
    utt.rate   = 1.0;
    utt.pitch  = 1.1;
    const voice = pickVoice(lang);
    if (voice) utt.voice = voice;
    utt.onend   = () => { primeMic().then(() => setTimeout(resolve, IS_ANDROID() ? 1200 : 600)); };
    utt.onerror = () => setTimeout(resolve, 300);
    window.speechSynthesis.speak(utt);
  });
}

function listenOnce(recRef: { current: SR | null }, lang: "en" | "es"): Promise<string> {
  return new Promise((resolve, reject) => {
    const SRClass = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SRClass) { reject(new Error("unsupported")); return; }

    const rec = new SRClass();
    const android = IS_ANDROID();
    rec.lang            = android ? lang : `${lang}-US`;
    rec.continuous      = !android;
    rec.interimResults  = true;
    rec.maxAlternatives = 1;

    recRef.current = rec;
    let settled  = false;
    let best     = "";
    let silenceT: ReturnType<typeof setTimeout> | null = null;
    let hardT:    ReturnType<typeof setTimeout> | null = null;

    const finish = (text: string | null) => {
      if (settled) return;
      settled = true;
      if (silenceT) clearTimeout(silenceT);
      if (hardT)    clearTimeout(hardT);
      try { rec.stop(); } catch { /* noop */ }
      recRef.current = null;
      text ? resolve(text) : reject(new Error("no-speech"));
    };

    rec.onresult = (e) => {
      const all  = Array.from(e.results);
      const text = all.map(r => r[0].transcript).join(" ").trim();
      if (text) best = text;
      if (silenceT) clearTimeout(silenceT);
      if (all.some(r => r.isFinal) && text) {
        finish(text);
      } else if (text) {
        silenceT = setTimeout(() => finish(best || null), 1200);
      }
    };

    rec.onerror = (e) => {
      if (e.error === "no-speech") { finish(best || null); return; }
      if (!settled) { settled = true; recRef.current = null; reject(new Error(e.error)); }
    };

    rec.onend = () => { finish(best || null); };
    hardT = setTimeout(() => finish(best || null), 10000);

    try { rec.start(); } catch (e) { reject(e); }
  });
}

// Fallback universal: graba con MediaRecorder (funciona en cualquier navegador) y
// transcribe con Whisper server-side — para los Android donde SpeechRecognition no existe o falla.
// Auto-stop por silencio (RMS) para conservar el flujo conversacional de Katy.
async function recordOnce(
  lang: "en" | "es",
  activeRef: { current: boolean },
  stopRef: { current: (() => void) | null },
): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    .catch(() => { throw new Error("mic-denied"); });
  return new Promise<string>((resolve, reject) => {
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach(tr => tr.stop());
      reject(new Error("recorder-unsupported"));
      return;
    }
    const chunks: BlobPart[] = [];
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    let spoke = false;
    let lastVoice = Date.now();
    const t0 = Date.now();
    let rafId = 0;

    const cleanup = () => {
      cancelAnimationFrame(rafId);
      stopRef.current = null;
      stream.getTracks().forEach(tr => tr.stop());
      ctx.close().catch(() => {});
    };
    const finish = () => { if (recorder.state === "recording") recorder.stop(); };
    stopRef.current = finish;

    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / buf.length);
      const now = Date.now();
      if (rms > 0.02) { spoke = true; lastVoice = now; }
      if (!activeRef.current) { finish(); return; }
      if (spoke && now - lastVoice > 1600) { finish(); return; }
      if (!spoke && now - t0 > 6000) { finish(); return; }
      if (now - t0 > 20000) { finish(); return; }
      rafId = requestAnimationFrame(tick);
    };

    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = async () => {
      cleanup();
      if (!spoke || !activeRef.current) { resolve(""); return; }
      try {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const dataUrl = await new Promise<string>((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(String(fr.result));
          fr.onerror = () => rej(new Error("read-failed"));
          fr.readAsDataURL(blob);
        });
        const resp = await fetch("/api/voice/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: dataUrl, language: lang }),
        });
        if (!resp.ok) { reject(new Error("transcribe-failed")); return; }
        const { text } = await resp.json();
        resolve(String(text ?? ""));
      } catch (e) {
        reject(e as Error);
      }
    };
    recorder.start();
    tick();
  });
}

function buildSummary(action: string, data: Record<string, unknown>): string {
  switch (action) {
    case "create_payment":     return `${data.type ?? ""} de ${fmt(Number(data.amount ?? 0))} por ${data.method ?? ""}`;
    case "create_expense":     return `${fmt(Number(data.amount ?? 0))} a ${data.payee_name ?? ""} (${data.concept ?? ""})`;
    case "create_project":     return `"${data.title ?? ""}" para ${data.client ?? ""}, ${fmt(Number(data.budget ?? 0))}`;
    case "create_task":        return `"${data.name ?? ""}"`;
    case "create_material":    return `${data.name ?? ""}, ${fmt(Number(data.cost ?? 0))} en ${data.supplier ?? ""}`;
    case "create_budget_item": return `${data.description ?? ""}, ${fmt(Number(data.amount ?? 0))}`;
    case "create_contact":     return `${data.name ?? ""} · ${data.type ?? "coworker"} · ${data.phone ?? ""}${data.specialty ? " · " + data.specialty : ""}`;
    case "update_task_status": { const sl: Record<string,string> = { pend:"Por hacer", prog:"En proceso", done:"Hecho" }; return `"${data.task_name ?? ""}" → ${sl[String(data.status ?? "")] ?? data.status}`; }
    case "create_agenda_event": { const te: Record<string,string> = { cita:"📅 Cita", task:"✅ Task", reunion:"🤝 Reunión" }; return `${te[String(data.event_type ?? "cita")] ?? "📅"} "${data.title ?? ""}" · ${data.event_date ?? ""} ${data.event_time ?? ""}`; }
    default:                   return JSON.stringify(data);
  }
}

export default function VoiceFAB() {
  const { meta } = useVoice();
  const metaRef  = useRef(meta);
  useEffect(() => { metaRef.current = meta; }, [meta]);

  const { language, t } = useLanguage();
  const { currentUser }  = useAuth();

  const [phase,         setPhase]         = useState<Phase>("idle");
  const [messages,      setMessages]      = useState<Msg[]>([]);
  const [pendingAction, setPendingAction] = useState<{ action: string; data: Record<string, unknown> } | null>(null);
  const [editableData,  setEditableData]  = useState<Record<string, unknown>>({});
  const [statusMsg,     setStatusMsg]     = useState("");
  const [textInput,     setTextInput]     = useState("");

  const activeRef     = useRef(false);
  const recRef        = useRef<SR | null>(null);
  const startedRef    = useRef(false);
  const msgEndRef     = useRef<HTMLDivElement>(null);
  const textModeRef   = useRef(false);
  const transcriptRef = useRef("");
  const apiHistRef    = useRef<ApiMsg[]>([]);
  const converseRef   = useRef<(() => Promise<void>) | null>(null);

  const supported =
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  // Con el fallback MediaRecorder+Whisper, la voz está disponible aunque no exista SpeechRecognition
  const voiceCapable =
    supported ||
    (typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function");
  const preferRecRef    = useRef(false);
  const recorderStopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const push = useCallback((role: Msg["role"], text: string) => {
    setMessages(prev => [...prev, { role, text }]);
  }, []);

  const say = useCallback(async (text: string): Promise<boolean> => {
    if (!activeRef.current) return false;
    setPhase("speaking");
    push("assistant", text);
    await tts(text, language);
    return activeRef.current;
  }, [push, language]);

  const listen = useCallback(async (): Promise<string | null> => {
    if (!activeRef.current) return null;
    setPhase("listening");
    if (!activeRef.current) return null;
    const useSR = supported && !preferRecRef.current;
    try {
      if (useSR) return await listenOnce(recRef, language);
      return await recordOnce(language, activeRef, recorderStopRef);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "no-speech") return "";
      // SpeechRecognition falló (red/servicio/permiso) — cambiar a grabación+Whisper y reintentar
      if (useSR && msg !== "mic-denied") {
        preferRecRef.current = true;
        try {
          return await recordOnce(language, activeRef, recorderStopRef);
        } catch (e2) {
          console.error("[Katy]", e2);
          return null;
        }
      }
      console.error("[Katy]", msg);
      return null;
    }
  }, [language, supported]);

  const closeClean = useCallback(() => {
    activeRef.current   = false;
    startedRef.current  = false;
    textModeRef.current = false;
    transcriptRef.current = "";
    recorderStopRef.current?.();
    apiHistRef.current  = [];
    converseRef.current = null;
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    recRef.current?.abort();
    recRef.current = null;
    setPhase("idle");
    setMessages([]);
    setPendingAction(null);
    setEditableData({});
    setStatusMsg("");
    setTextInput("");
  }, []);

  const showError = useCallback((msg: string) => {
    activeRef.current  = false;
    startedRef.current = false;
    recRef.current?.abort();
    recRef.current = null;
    setStatusMsg(msg);
    setPhase("error");
  }, []);

  const auditLog = useCallback(async (
    outcome: "confirmed" | "cancelled" | "error",
    action?: string,
    data?: Record<string, unknown>,
    errorMsg?: string,
  ) => {
    await supabase.from("voice_actions").insert({
      user_label:  currentUser?.name ?? null,
      transcript:  transcriptRef.current || "(sin texto)",
      action:      action  ?? null,
      action_data: data    ?? null,
      project_id:  metaRef.current.projectId ?? null,
      outcome,
      error_msg:   errorMsg ?? null,
    });
  }, [currentUser]);

  const handleConfirm = useCallback(async () => {
    if (!pendingAction) return;
    setPhase("saving");
    try {
      const msg = await saveAction(pendingAction.action, editableData, metaRef.current);
      await auditLog("confirmed", pendingAction.action, editableData);
      setStatusMsg(msg);
      setPhase("success");
      window.dispatchEvent(new CustomEvent("kokivoice_saved", {
        detail: { action: pendingAction.action, projectId: metaRef.current.projectId }
      }));
      setTimeout(closeClean, 2500);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : t.panel.voice.errorSaving;
      await auditLog("error", pendingAction.action, editableData, errMsg);
      showError(errMsg);
    }
  }, [pendingAction, editableData, closeClean, showError, t, auditLog]);

  const handleCancel = useCallback(async () => {
    if (pendingAction) {
      await auditLog("cancelled", pendingAction.action, editableData);
    }
    closeClean();
  }, [pendingAction, editableData, auditLog, closeClean]);

  const handleTextSubmit = useCallback(async () => {
    const text = textInput.trim();
    if (!text || !converseRef.current) return;
    if (!transcriptRef.current) transcriptRef.current = text;
    setTextInput("");
    push("user", text);
    apiHistRef.current.push({ role: "user", content: text });
    await converseRef.current();
  }, [textInput, push]);

  const startTextMode = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current  = true;
    activeRef.current   = true;
    textModeRef.current = true;
    transcriptRef.current = "";
    apiHistRef.current  = [];
    setMessages([]); setPendingAction(null); setEditableData({}); setStatusMsg(""); setTextInput("");

    const ctx = metaRef.current.context;

    const converse = async (): Promise<void> => {
      setPhase("thinking");
      let result: { type: string; text?: string; action?: string; data?: Record<string, unknown> };
      try {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 12_000);
        const res  = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages:     apiHistRef.current,
            context:      ctx,
            contacts:     metaRef.current.contacts     ?? [],
            projects:     metaRef.current.projects     ?? [],
            projectTitle: metaRef.current.projectTitle ?? "",
            language,
          }),
          signal: ctrl.signal,
        });
        clearTimeout(tid);
        result = await res.json();
      } catch {
        const lastUser = [...apiHistRef.current].reverse().find(m => m.role === "user")?.content ?? "";
        result = { type: "action", action: localDetect(lastUser, ctx), data: {} };
      }

      if (result.type === "action" && result.action && EDIT_FIELDS[result.action]) {
        const action = result.action;
        const data: Record<string, unknown> = { ...result.data };
        if (!data.date) data.date = TODAY();
        if (action === "create_task" && !data.hours) data.hours = 8;
        setPendingAction({ action, data });
        setEditableData({ ...data });
        setPhase("confirm");
      } else {
        const question = result.text ?? "¿Algo más?";
        apiHistRef.current.push({ role: "assistant", content: question });
        push("assistant", question);
        setPhase("text");
      }
    };

    converseRef.current = converse;
    setPhase("text");
  }, [language, push]);

  const start = useCallback(() => {
    if (phase !== "idle" || startedRef.current) return;
    startedRef.current = true;
    activeRef.current  = true;
    setMessages([]); setPendingAction(null); setEditableData({}); setStatusMsg("");

    const tpVoice = t.panel.voice;

    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach(track => track.stop());
      } catch {
        showError(tpVoice.noMic);
        return;
      }

      const ctx      = metaRef.current.context;
      const apiHist: ApiMsg[] = [];

      const OPENERS: Record<string, string> = {
        "project.workflow":       tpVoice.openerWorkflow,
        "project.materiales":     tpVoice.openerMaterials,
        "project.pagos.ingresos": tpVoice.openerIncome,
        "project.pagos.egresos":  tpVoice.openerExpenses,
        "project.presupuesto":    tpVoice.openerBudget,
        "project.contactos":      tpVoice.openerContacts,
      };

      const opener = OPENERS[ctx] ?? tpVoice.openerDefault;
      apiHist.push({ role: "assistant", content: opener });
      const alive = await say(opener);
      if (!alive) return;

      let userInput = await listen();
      if (userInput === null) { showError(tpVoice.noMicAccess); return; }
      if (!userInput) {
        const a2 = await say(tpVoice.didntHear);
        if (!a2) return;
        userInput = await listen();
        if (!userInput) { await say(tpVoice.whenReady); closeClean(); return; }
      }
      transcriptRef.current = userInput;
      push("user", userInput);
      apiHist.push({ role: "user", content: userInput });
      if (!activeRef.current) return;

      const converse = async (): Promise<void> => {
        if (!activeRef.current) return;
        setPhase("thinking");

        let result: { type: string; text?: string; action?: string; data?: Record<string, unknown> };
        try {
          const ctrl = new AbortController();
          const tid  = setTimeout(() => ctrl.abort(), 12_000);
          const res  = await fetch("/api/voice", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages:     apiHist,
              context:      ctx,
              contacts:     metaRef.current.contacts     ?? [],
              projects:     metaRef.current.projects     ?? [],
              projectTitle: metaRef.current.projectTitle ?? "",
              language,
            }),
            signal: ctrl.signal,
          });
          clearTimeout(tid);
          result = await res.json();
        } catch {
          const lastUser = [...apiHist].reverse().find(m => m.role === "user")?.content ?? "";
          result = { type: "action", action: localDetect(lastUser, ctx), data: {} };
        }

        if (result.type === "action" && result.action && EDIT_FIELDS[result.action]) {
          const action = result.action;
          const data: Record<string, unknown> = { ...result.data };
          if (!data.date) data.date = TODAY();
          if (action === "create_task" && !data.hours) data.hours = 8;

          setPendingAction({ action, data });
          setEditableData({ ...data });

          const summary = buildSummary(action, data);
          const label   = ACTION_LABELS[action] ?? "registro";
          await say(`Voy a guardar ${label}: ${summary}. ¿Confirmamos?`);
          if (!activeRef.current) return;
          setPhase("confirm");

        } else {
          const question = result.text ?? "¿Algo más?";
          apiHist.push({ role: "assistant", content: question });
          const stillAlive = await say(question);
          if (!stillAlive) return;

          let answer = await listen();
          if (!activeRef.current) return;
          if (answer === null) { showError("Perdí el micrófono. Intenta de nuevo."); return; }
          if (!answer) {
            await say("No te escuché. ¿Repites?");
            answer = await listen();
            if (!answer || !activeRef.current) { closeClean(); return; }
          }
          push("user", answer);
          apiHist.push({ role: "user", content: answer });
          await converse();
        }
      };

      await converse();

    })().catch(err => {
      console.error("[VoiceFAB]", err);
      if (activeRef.current) showError("Error inesperado. Toca para reintentar.");
      else startedRef.current = false;
    });
  }, [phase, say, listen, push, closeClean, showError, language, t]);

  const headerLabel: Record<Phase, string> = {
    idle: "", listening: "Escuchando…", thinking: "Procesando…",
    speaking: `${ASSISTANT} habla…`, confirm: "Revisa y confirma",
    saving: "Guardando…", success: "¡Guardado!", error: "Error",
    text: "Escribe tu instrucción",
  };
  const dotCls: Record<Phase, string> = {
    idle:      "",
    listening: "animate-ping bg-[#B0492F]",
    thinking:  "animate-pulse bg-[#4E7A82]",
    speaking:  "animate-pulse bg-[#4F8A63]",
    confirm:   "bg-[#16323D]",
    saving:    "animate-pulse bg-[#4E7A82]",
    success:   "bg-[#4F8A63]",
    error:     "bg-[#B0492F]",
    text:      "bg-[#395886]",
  };
  const fabBg =
    phase === "listening"                                            ? "animate-pulse bg-[#B0492F]" :
    phase === "success"                                             ? "bg-[#4F8A63]"               :
    phase === "thinking" || phase === "speaking" || phase === "saving" ? "bg-[#4E7A82]"            :
    phase === "text"                                                ? "bg-[#395886]"               :
                                                                      "bg-[#16323D] hover:bg-[#0e2630]";

  const panelOpen = phase !== "idle";

  return (
    <>
      {panelOpen && (
        <div className="fixed bottom-24 right-4 z-[150] flex w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[#E6DDCB] bg-white shadow-2xl">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E6DDCB] bg-[#F7F3EA] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotCls[phase]}`} />
              <span className="text-xs font-bold text-[#16323D]">
                {ASSISTANT} — {headerLabel[phase]}
              </span>
            </div>
            {phase !== "saving" && phase !== "success" && (
              <button onClick={closeClean} className="rounded-lg p-1 text-[#5C6A6E] hover:bg-[#ECE3D1]">
                <X size={16} />
              </button>
            )}
          </div>

          {/* Chat transcript */}
          {messages.length > 0 && (
            <div className="flex max-h-[200px] flex-col gap-2 overflow-y-auto p-3">
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
              {(phase === "thinking" || phase === "saving") && (
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#16323D] text-[9px] font-bold text-white">
                    {ASSISTANT[0]}
                  </span>
                  <div className="flex gap-1 rounded-2xl rounded-bl-sm border border-[#E6DDCB] bg-[#F7F3EA] px-3 py-2">
                    {[0, 150, 300].map(d => (
                      <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5C6A6E]"
                            style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={msgEndRef} />
            </div>
          )}
          {messages.length === 0 && (phase === "thinking" || phase === "saving") && (
            <div className="flex items-center gap-2 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#16323D] text-[9px] font-bold text-white">
                {ASSISTANT[0]}
              </span>
              <div className="flex gap-1 rounded-2xl rounded-bl-sm border border-[#E6DDCB] bg-[#F7F3EA] px-3 py-2">
                {[0, 150, 300].map(d => (
                  <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5C6A6E]"
                        style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          )}

          {/* Voice: listening waveform */}
          {phase === "listening" && (
            <div className="flex items-center justify-center gap-1.5 border-t border-[#E6DDCB] bg-[#FFF5F5] py-3 px-4">
              {[10,16,13,18,11].map((h,i) => (
                <span key={i} className="w-[3px] rounded-full bg-[#B0492F]"
                  style={{ height: `${h}px`, animation: `pulse 0.7s ${i*80}ms infinite alternate ease-in-out` }} />
              ))}
              <span className="ml-2 text-[11px] font-semibold text-[#B0492F]">Habla ahora</span>
            </div>
          )}

          {/* Voice: speaking indicator */}
          {phase === "speaking" && (
            <div className="flex items-center justify-center gap-2 border-t border-[#E6DDCB] bg-[#F0F7F5] py-2.5">
              <Loader2 size={13} className="animate-spin text-[#4F8A63]" />
              <span className="text-[11px] font-semibold text-[#4F8A63]">{ASSISTANT} está hablando…</span>
            </div>
          )}

          {/* Text mode: input area */}
          {phase === "text" && (
            <div className="border-t border-[#E6DDCB] p-3">
              {messages.length === 0 && (
                <p className="mb-2 text-xs text-[#5C6A6E]">
                  Escribe tu instrucción — p.ej. "Agregar egreso $500 a Jorge"
                </p>
              )}
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleTextSubmit(); }}
                  placeholder="Tu instrucción…"
                  className="flex-1 rounded-xl border border-[#D7CBB3] bg-white px-3 py-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none"
                />
                <button
                  onClick={handleTextSubmit}
                  disabled={!textInput.trim()}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#16323D] text-white disabled:opacity-40 active:scale-95 transition"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          )}

          {/* Confirm form */}
          {phase === "confirm" && pendingAction && (
            <div className="max-h-[300px] overflow-y-auto border-t border-[#E6DDCB] p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#97A1A0]">
                Revisa y corrige si es necesario
              </p>
              <div className="space-y-2">
                {(EDIT_FIELDS[pendingAction.action] ?? []).map(f => (
                  <div key={f.key} className="flex items-center gap-2">
                    <label className="w-[72px] shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[#5C6A6E]">
                      {f.label}
                    </label>
                    <input
                      type={f.type === "number" ? "text" : f.type}
                      inputMode={f.type === "number" ? "decimal" : undefined}
                      value={
                        f.type === "number"
                          ? (editableData[f.key] === 0 || editableData[f.key] == null ? "" : String(editableData[f.key]))
                          : String(editableData[f.key] ?? "")
                      }
                      onChange={e => {
                        const v = e.target.value;
                        setEditableData(prev => ({
                          ...prev,
                          [f.key]: f.type === "number"
                            ? (v === "" ? 0 : parseFloat(v.replace(/[^0-9.]/g, "")) || 0)
                            : v,
                        }));
                      }}
                      placeholder={f.type === "number" ? "0" : ""}
                      className="flex-1 min-w-0 rounded-lg border border-[#D7CBB3] bg-white px-2 py-2 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={handleCancel}
                  className="flex-1 rounded-xl bg-[#ECE3D1] py-3 text-sm font-bold text-[#5C6A6E] transition hover:bg-[#DDD3BB]">
                  Cancelar
                </button>
                <button onClick={handleConfirm}
                  className="flex-1 rounded-xl bg-[#16323D] py-3 text-sm font-bold text-white transition hover:bg-[#0e2630]">
                  ✓ Confirmar
                </button>
              </div>
            </div>
          )}

          {/* Success */}
          {phase === "success" && (
            <div className="flex items-center gap-2 border-t border-[#E6DDCB] bg-[#F0F9F3] px-4 py-3">
              <CheckCircle size={16} className="shrink-0 text-[#4F8A63]" />
              <span className="text-sm font-semibold text-[#4F8A63]">{statusMsg}</span>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="flex flex-col gap-2 border-t border-[#E6DDCB] p-3">
              <p className="rounded-lg bg-[#FFF0EE] px-3 py-2 text-sm text-[#B0492F]">{statusMsg}</p>
              <div className="flex gap-2">
                {voiceCapable && (
                  <button onClick={() => { setPhase("idle"); startedRef.current = false; start(); }}
                    className="flex-1 rounded-xl bg-[#16323D] py-3 text-sm font-bold text-white">
                    🎤 Voz
                  </button>
                )}
                <button onClick={() => { setPhase("idle"); startedRef.current = false; startTextMode(); }}
                  className="flex-1 rounded-xl bg-[#395886] py-3 text-sm font-bold text-white">
                  ⌨ Texto
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Text mode FAB — always shown as secondary button */}
      {phase === "idle" && (
        <button
          type="button"
          onClick={startTextMode}
          aria-label="Escribir instrucción a Katy"
          className="fixed bottom-6 right-[5.5rem] z-[150] grid size-10 place-items-center rounded-full bg-[#395886] text-white shadow-xl transition-all duration-200 active:scale-95 hover:bg-[#2c4570]"
        >
          <Keyboard size={18} />
        </button>
      )}

      {/* Main FAB: mic (or keyboard when voice not supported) */}
      {voiceCapable ? (
        <button
          type="button"
          onClick={phase === "idle" ? start : undefined}
          aria-label={phase === "idle" ? `Iniciar asistente ${ASSISTANT}` : headerLabel[phase]}
          className={`fixed bottom-6 right-6 z-[150] grid size-14 place-items-center rounded-full text-white shadow-2xl transition-all duration-200 active:scale-95 ${fabBg}`}
        >
          {phase === "success"
            ? <CheckCircle size={22} />
            : phase === "thinking" || phase === "speaking" || phase === "saving"
            ? <Loader2 size={22} className="animate-spin" />
            : <Mic size={22} className={phase === "listening" ? "animate-pulse" : ""} />
          }
        </button>
      ) : (
        <button
          type="button"
          onClick={phase === "idle" ? startTextMode : undefined}
          aria-label={phase === "idle" ? `Escribir instrucción a ${ASSISTANT}` : headerLabel[phase]}
          className={`fixed bottom-6 right-6 z-[150] grid size-14 place-items-center rounded-full text-white shadow-2xl transition-all duration-200 active:scale-95 ${fabBg}`}
        >
          {phase === "success"
            ? <CheckCircle size={22} />
            : phase === "thinking" || phase === "saving"
            ? <Loader2 size={22} className="animate-spin" />
            : <Keyboard size={22} />
          }
        </button>
      )}
    </>
  );
}
