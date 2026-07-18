"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, X, Loader2, CheckCircle, Keyboard, Send, Ear } from "lucide-react";
import { useVoice } from "@/src/context/VoiceContext";
import type { VoiceMeta } from "@/src/context/VoiceContext";
import { supabase } from "@/src/lib/supabase";
import { addProjectNote, noteDate } from "@/src/lib/notes";
import { useLanguage } from "@/src/context/LanguageContext";
import type { translations } from "@/src/config/translations";
import { useAuth } from "@/src/context/AuthContext";
import {
  loadVoicePrefs, toMemory, learnCorrections, saveVoiceLearning,
  type VoicePrefs, type VoiceMemory,
} from "@/src/lib/voicePrefs";

type Phase  = "idle" | "listening" | "thinking" | "speaking" | "confirm" | "saving" | "success" | "error" | "text";
type ApiMsg = { role: "user" | "assistant"; content: string };
interface Msg { role: "user" | "assistant"; text: string; }
type VoiceT = Record<keyof (typeof translations)["es"]["panel"]["voice"], string>;

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

// Frase de activación "hey Katy" y variantes de dictado (español + inglés)
const WAKE_RE = /\b(hey|hei|ey|oye|hola|escucha|okay|ok) ?(katy|caty|katie|cathy|ketty|kati|catty)\b/;
const hasWake = (text: string) => WAKE_RE.test(norm(text));

const YES_RE  = /^(si|sip|dale|ok|okey|okay|confirma|confirmar|confirmado|guarda|guardar|guardalo|correcto|exacto|asi es|yes|yep|yeah|sure|save|confirm|go)\b/;
const NO_RE   = /^(no|nel|cancela|cancelar|borra|borrar|descarta|descartalo|nope|cancel|discard)\b/;
const QUIT_RE = /^(listo|ya|nada mas|eso es todo|gracias|adios|chao|terminamos|done|thats all|nothing else|thanks|bye|stop)\b/;

// Confirmación por voz. Solo una frase CORTA cuenta como sí/no: "sí, pero cambia el
// monto a 500" no puede disparar un guardado — eso es una corrección y va al modelo.
function confirmIntent(text: string): "yes" | "no" | "quit" | "other" {
  const t = norm(text).trim();
  if (!t) return "other";
  if (t.split(/\s+/).length > 3) return "other";
  if (QUIT_RE.test(t)) return "quit";
  if (YES_RE.test(t))  return "yes";
  if (NO_RE.test(t))   return "no";
  return "other";
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

// Acciones que exigen proyecto — si no hay uno abierto, la tarjeta de confirmación ofrece elegirlo
const PROJECT_ACTIONS = new Set([
  "create_payment", "create_expense", "create_task",
  "create_material", "create_budget_item", "update_task_status",
]);

const fill = (tpl: string, x: string | number = "", y: string | number = "") =>
  tpl.replace("{x}", String(x)).replace("{y}", String(y));

// Proyecto destino de una acción: el elegido en la tarjeta gana sobre el abierto en pantalla
function destProjectId(data: Record<string, unknown>, meta: VoiceMeta): string | null {
  return data.__project_id ? String(data.__project_id) : (meta.projectId ?? null);
}

// El mensaje de éxito debe decir SIEMPRE en qué proyecto quedó — no saberlo era el
// reclamo #1: "cuando graba no sabemos dónde lo registra"
function destProjectTitle(data: Record<string, unknown>, meta: VoiceMeta): string | null {
  const pid = destProjectId(data, meta);
  if (!pid) return null;
  if (pid === meta.projectId) return meta.projectTitle ?? null;
  return meta.projects?.find(p => p.id === pid)?.title ?? null;
}

async function saveAction(action: string, data: Record<string, unknown>, meta: VoiceMeta, tv: VoiceT): Promise<string> {
  const pid    = destProjectId(data, meta);
  const date   = String(data.date ?? TODAY());
  const proj   = destProjectTitle(data, meta);
  const inProj = proj ? fill(tv.inProject, proj) : "";

  switch (action) {
    case "create_project": {
      const { data: row, error } = await supabase.from("projects").insert({
        title: String(data.title ?? "Nuevo proyecto"), client: String(data.client ?? ""),
        address: String(data.address ?? "Sin dirección"), budget: Number(data.budget ?? 0),
        status: "prospecto", start_date: String(data.start_date ?? TODAY()),
      }).select("title").single();
      if (error) throw error;
      return fill(tv.okProject, row.title);
    }
    case "create_payment": {
      if (!pid) throw new Error(tv.needProject);
      const { error } = await supabase.from("payments").insert({
        project_id: pid, amount: Number(data.amount ?? 0), date,
        method: String(data.method ?? "Efectivo"), type: String(data.type ?? "abono"),
      });
      if (error) throw error;
      return fill(tv.okPayment, fmt(Number(data.amount ?? 0))) + inProj;
    }
    case "create_expense": {
      if (!pid) throw new Error(tv.needProject);
      const { error } = await supabase.from("expenses").insert({
        project_id: pid, amount: Number(data.amount ?? 0), date,
        method: String(data.method ?? "Efectivo"),
        payee_name: String(data.payee_name ?? ""), concept: String(data.concept ?? ""),
      });
      if (error) throw error;
      return fill(tv.okExpense, fmt(Number(data.amount ?? 0))) + inProj;
    }
    case "create_task": {
      if (!pid) throw new Error(tv.needProject);
      const { error } = await supabase.from("tasks").insert({
        project_id: pid, name: String(data.name ?? "Nueva tarea"),
        hours: Number(data.hours ?? 8), duration_weeks: Number(data.duration_weeks ?? 1),
        status: "pend", sort_order: 9999, assigned_contact_id: null,
      });
      if (error) throw error;
      return fill(tv.okTask, String(data.name ?? "")) + inProj;
    }
    case "create_material": {
      if (!pid) throw new Error("Abre un proyecto primero");
      const { error } = await supabase.from("materials").insert({
        project_id: pid, name: String(data.name ?? ""), supplier: String(data.supplier ?? ""),
        cost: Number(data.cost ?? 0), bought: false,
      });
      if (error) throw error;
      return fill(tv.okMaterial, String(data.name ?? "")) + inProj;
    }
    case "create_budget_item": {
      if (!pid) throw new Error(tv.needProject);
      const { error } = await supabase.from("budget_items").insert({
        project_id: pid, type: String(data.type ?? "material"),
        description: String(data.description ?? ""), amount: Number(data.amount ?? 0),
      });
      if (error) throw error;
      return fill(tv.okBudgetItem, String(data.description ?? "")) + inProj;
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
      return fill(tv.okContact, String(data.name ?? ""), contactType);
    }
    case "create_agenda_event": {
      const validType = ["cita", "task", "reunion"].includes(String(data.event_type))
        ? String(data.event_type) : "cita";
      const { error } = await supabase.from("agenda_events").insert({
        event_type:   validType,
        title:        String(data.title ?? "Sin título"),
        project_id:   data.project_id ? String(data.project_id) : (pid ?? null),
        event_date:   /^\d{4}-\d{2}-\d{2}$/.test(String(data.event_date ?? "")) ? String(data.event_date) : TODAY(),
        event_time:   /^\d{2}:\d{2}$/.test(String(data.event_time ?? "")) ? String(data.event_time) : "10:00",
        remind_from:  ["2h", "1d", "2d", "1w"].includes(String(data.remind_from)) ? String(data.remind_from) : "1d",
        repeat_every: data.repeat_every && data.repeat_every !== "once" ? "daily" : "once",
      });
      if (error) throw error;
      return fill(tv.okAgenda, String(data.title ?? ""), `${data.event_date ?? TODAY()} ${data.event_time ?? "10:00"}`) + inProj;
    }
    case "update_task_status": {
      if (!pid) throw new Error(tv.needProject);
      const { data: taskList } = await supabase.from("tasks").select("id, name").eq("project_id", pid);
      if (!taskList?.length) throw new Error(tv.noTasks);
      const search = String(data.task_name ?? "").toLowerCase().trim();
      const words  = search.split(/\s+/).filter((w) => w.length > 2);
      const scored = taskList.map((t) => {
        const name = t.name.toLowerCase();
        const score = words.filter((w) => name.includes(w)).length;
        return { t, score };
      }).sort((a, b) => b.score - a.score);
      if (!scored[0] || scored[0].score === 0) throw new Error(fill(tv.taskNotFound, String(data.task_name ?? "")));
      const match     = scored[0].t;
      const newStatus = String(data.status ?? "pend");
      const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", match.id);
      if (error) throw error;
      const sl: Record<string, string> = { pend: tv.statusPend, prog: tv.statusProg, done: tv.statusDone };
      return fill(tv.okStatus, match.name, sl[newStatus] ?? newStatus) + inProj;
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
    // Continuar de inmediato al terminar de hablar: solo una pausa mínima para que
    // el sintetizador suelte el audio (el reintento de recordOnce cubre el "ocupado").
    utt.onend   = () => setTimeout(resolve, IS_ANDROID() ? 180 : 40);
    utt.onerror = () => setTimeout(resolve, 120);
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
  // Un reintento corto: en Android el dispositivo queda "ocupado" un instante
  // tras un uso reciente (cerrar y reabrir la sesión), y el 2º intento entra.
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    .catch(async () => {
      await new Promise<void>(r => setTimeout(r, 400));
      return navigator.mediaDevices.getUserMedia({ audio: true });
    })
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
  // Espejo de textModeRef para el render (el ref lo lee el loop async, que no re-renderiza)
  const [textMode,      setTextMode]      = useState(false);

  const activeRef     = useRef(false);
  const recRef        = useRef<SR | null>(null);
  const startedRef    = useRef(false);
  const msgEndRef     = useRef<HTMLDivElement>(null);
  const textModeRef   = useRef(false);
  const transcriptRef = useRef("");
  const apiHistRef    = useRef<ApiMsg[]>([]);
  const converseRef   = useRef<(() => Promise<void>) | null>(null);
  // Memoria de Katy ("Katy aprende"): prefs del usuario cargadas al iniciar la sesión
  const prefsRef      = useRef<VoicePrefs | null>(null);
  const memoryRef     = useRef<VoiceMemory | undefined>(undefined);
  // El loop de voz corre dentro de una IIFE: lee la tarjeta y guarda por refs,
  // porque su closure no ve los re-renders de React
  const editableDataRef = useRef<Record<string, unknown>>({});
  const commitRef = useRef<
    ((a: string, d: Record<string, unknown>, o: Record<string, unknown>, k: boolean) => Promise<string | null>) | null
  >(null);
  useEffect(() => { editableDataRef.current = editableData; }, [editableData]);
  // La tarjeta se puede resolver por voz o por botón, y el micrófono sigue abierto
  // mientras tanto: sin este candado un "sí" suelto guardaría dos veces
  const settledRef = useRef(false);

  const supported =
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  // Con el fallback MediaRecorder+Whisper, la voz está disponible aunque no exista SpeechRecognition
  const voiceCapable =
    supported ||
    (typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function");
  const preferRecRef    = useRef(false);
  const recorderStopRef = useRef<(() => void) | null>(null);
  const [projectOptions, setProjectOptions] = useState<{ id: string; title: string }[]>([]);

  // Modo "hey Katy": escucha continua del navegador (Web Speech) que abre Katy al
  // oír la frase. Opt-in por dispositivo (consume batería, necesita la app abierta)
  // y depende del motor de voz del equipo — puede no dispararse en MIUI.
  const [wakeOn, setWakeOn]  = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("kokistyle-wake") === "1");
  const wakeOnRef      = useRef(false);
  const wakeRecRef     = useRef<SR | null>(null);
  const startRef       = useRef<() => void>(() => {});
  const startWakeRef   = useRef<() => void>(() => {});

  // Si la acción necesita proyecto y no hay uno abierto, cargar la lista para el selector
  useEffect(() => {
    if (!pendingAction) return;
    const needsPick =
      (PROJECT_ACTIONS.has(pendingAction.action) || pendingAction.action === "create_agenda_event") &&
      !metaRef.current.projectId;
    if (!needsPick || projectOptions.length > 0) return;
    const metaProjects = metaRef.current.projects;
    if (metaProjects?.length) {
      setProjectOptions(metaProjects.map(p => ({ id: p.id, title: p.title })));
      return;
    }
    supabase
      .from("projects")
      .select("id, title")
      .neq("status", "terminado")
      .order("priority_rank", { ascending: true, nullsFirst: false })
      .then(({ data }) => { if (data) setProjectOptions(data as { id: string; title: string }[]); });
  }, [pendingAction, projectOptions.length]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const push = useCallback((role: Msg["role"], text: string) => {
    setMessages(prev => [...prev, { role, text }]);
  }, []);

  // Carga la memoria de Katy del usuario (una vez por usuario) y arma el bloque para el prompt
  const prefsUserRef = useRef<string | null>(null);
  const ensurePrefs = useCallback(async () => {
    const name = currentUser?.name ?? null;
    if (prefsUserRef.current !== name) {
      prefsRef.current = await loadVoicePrefs(name);
      prefsUserRef.current = name;
    }
    memoryRef.current = toMemory(prefsRef.current, name) ?? undefined;
  }, [currentUser]);

  // Nivel 1: pre-rellena la tarjeta con lo aprendido (proyecto, método de pago, duración de tarea)
  const applyPrefsDefaults = useCallback((action: string, data: Record<string, unknown>) => {
    const p = prefsRef.current;
    if (!p) return data;
    if (action === "create_task" && !data.hours && p.default_task_hours) data.hours = p.default_task_hours;
    if (action === "create_payment" && !data.method && p.last_payment_method) data.method = p.last_payment_method;
    if (PROJECT_ACTIONS.has(action) && !metaRef.current.projectId && !data.__project_id && p.last_project_id) {
      data.__project_id = p.last_project_id;
    }
    return data;
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
    setTextMode(false);
    settledRef.current = false;
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

  // Nivel 1 + 2: al confirmar, Katy "aprende" — guarda correcciones/alias del vocabulario y
  // recuerda el último proyecto, método de pago y duración de tarea usados.
  const learnFromConfirm = useCallback(async (
    action: string,
    originalData: Record<string, unknown>,
    finalData: Record<string, unknown>,
  ) => {
    const userLabel = currentUser?.name;
    if (!userLabel) return;

    const textKeys = (EDIT_FIELDS[action] ?? []).filter(f => f.type === "text").map(f => f.key);
    const { corrections, aliases } = learnCorrections(originalData, finalData, textKeys);

    const pidUsed = finalData.__project_id ? String(finalData.__project_id) : metaRef.current.projectId;
    let projTitle: string | null = null;
    if (pidUsed && action !== "create_project") {
      projTitle = pidUsed === metaRef.current.projectId
        ? (metaRef.current.projectTitle ?? null)
        : (projectOptions.find(p => p.id === pidUsed)?.title
          ?? metaRef.current.projects?.find(p => p.id === pidUsed)?.title
          ?? null);
    }

    const patch = {
      lastProjectId:    action !== "create_project" ? (pidUsed ?? undefined) : undefined,
      lastProjectTitle: projTitle ?? undefined,
      lastPaymentMethod: action === "create_payment" ? String(finalData.method ?? "") || undefined : undefined,
      defaultTaskHours: action === "create_task" ? Number(finalData.hours) || undefined : undefined,
      corrections,
      aliases,
    };

    const updated = await saveVoiceLearning(prefsRef.current, userLabel, patch);
    prefsRef.current = updated;
    memoryRef.current = toMemory(updated, userLabel) ?? undefined;
  }, [currentUser, projectOptions]);

  // Guardado real. Recibe action/data explícitos (no del estado) para que la
  // confirmación por voz pueda llamarlo sin esperar a que React re-renderice.
  // keepAlive = la sesión de voz sigue viva para el próximo comando.
  const commit = useCallback(async (
    action:   string,
    data:     Record<string, unknown>,
    original: Record<string, unknown>,
    keepAlive: boolean,
  ): Promise<string | null> => {
    setPhase("saving");
    try {
      const msg = await saveAction(action, data, metaRef.current, t.panel.voice);
      await auditLog("confirmed", action, data);
      void learnFromConfirm(action, original, data);
      if (action === "create_payment") {
        const pid = destProjectId(data, metaRef.current);
        const amt = Number(data.amount ?? 0);
        if (pid && amt > 0) {
          const method = data.method ? ` (${data.method})` : "";
          void addProjectNote(pid, language === "en"
            ? `💵 Payment received: ${fmt(amt)}${method} — ${noteDate("en")}`
            : `💵 Ingreso recibido: ${fmt(amt)}${method} — ${noteDate("es")}`);
        }
      }
      setStatusMsg(msg);
      setPhase("success");
      window.dispatchEvent(new CustomEvent("kokivoice_saved", {
        detail: { action, projectId: destProjectId(data, metaRef.current) }
      }));
      if (!keepAlive) setTimeout(closeClean, 5000);
      return msg;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : t.panel.voice.errorSaving;
      await auditLog("error", action, data, errMsg);
      showError(errMsg);
      return null;
    }
  }, [closeClean, showError, t, language, auditLog, learnFromConfirm]);
  useEffect(() => { commitRef.current = commit; }, [commit]);

  const handleConfirm = useCallback(async () => {
    if (!pendingAction || settledRef.current) return;
    settledRef.current = true;
    await commit(pendingAction.action, editableData, pendingAction.data, false);
  }, [pendingAction, editableData, commit]);

  const handleCancel = useCallback(async () => {
    if (settledRef.current) { closeClean(); return; }
    settledRef.current = true;
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
    setTextMode(true);
    transcriptRef.current = "";
    apiHistRef.current  = [];
    setMessages([]); setPendingAction(null); setEditableData({}); setStatusMsg(""); setTextInput("");
    void ensurePrefs();

    const ctx = metaRef.current.context;

    const converse = async (): Promise<void> => {
      setPhase("thinking");
      let result: { type: string; text?: string; say?: string; action?: string; data?: Record<string, unknown> };
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
            memory:       memoryRef.current,
            // Gatea qué herramientas de consulta se le ofrecen al modelo (guardarraíl
            // de UX: la anon key ya permite leer estas tablas desde el navegador)
            permissions:  currentUser?.permissions ?? null,
            role:         currentUser?.role ?? "",
          }),
          signal: ctrl.signal,
        });
        clearTimeout(tid);
        result = await res.json();
      } catch {
        const lastUser = [...apiHistRef.current].reverse().find(m => m.role === "user")?.content ?? "";
        result = { type: "action", action: localDetect(lastUser, ctx), data: {} };
      }

      if (result.type === "error") {
        // La IA no respondió — el dictado no se pierde: pendiente editable en la agenda
        const lastUser = [...apiHistRef.current].reverse().find(m => m.role === "user")?.content ?? "";
        const data: Record<string, unknown> = { event_type: "task", title: lastUser, event_date: TODAY(), event_time: "09:00" };
        setPendingAction({ action: "create_agenda_event", data });
        setEditableData({ ...data });
        editableDataRef.current = { ...data };
        settledRef.current = false;
        push("assistant", language === "en"
          ? "AI is unreachable — review and save your dictation as an editable to-do:"
          : "No pude conectar con la IA — revisa y guarda tu dictado como pendiente editable:");
        setPhase("confirm");
        return;
      }

      if (result.type === "action" && result.action && EDIT_FIELDS[result.action]) {
        const action = result.action;
        const data: Record<string, unknown> = { ...result.data };
        // El modelo nombra el proyecto ("el de Brickell") → la tarjeta lo lee de __project_id
        if (data.project_id) { data.__project_id = String(data.project_id); delete data.project_id; }
        applyPrefsDefaults(action, data);
        if (!data.date) data.date = TODAY();
        if (action === "create_task" && !data.hours) data.hours = 8;
        setPendingAction({ action, data });
        setEditableData({ ...data });
        editableDataRef.current = { ...data };
        settledRef.current = false;
        if (result.say?.trim()) {
          apiHistRef.current.push({ role: "assistant", content: result.say });
          push("assistant", result.say);
        }
        setPhase("confirm");
      } else {
        const question = result.text ?? t.panel.voice.anythingElse;
        apiHistRef.current.push({ role: "assistant", content: question });
        push("assistant", question);
        setPhase("text");
      }
    };

    converseRef.current = converse;
    setPhase("text");
  }, [language, push, ensurePrefs, applyPrefsDefaults, t, currentUser]);

  const start = useCallback(() => {
    if (phase !== "idle" || startedRef.current) return;
    startedRef.current = true;
    activeRef.current  = true;
    setMessages([]); setPendingAction(null); setEditableData({}); setStatusMsg("");

    const tpVoice = t.panel.voice;

    (async () => {
      try {
        // Prueba de permiso + warm-up al ABRIR la sesión: en Android el dispositivo
        // no se libera al instante, y sin la pausa la grabación que viene justo
        // después falla ("micrófono ocupado") al reactivar. (Mid-conversación la
        // continuación es inmediata — ver tts.)
        const android = IS_ANDROID();
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        await new Promise<void>(r => setTimeout(r, android ? 500 : 200));
        s.getTracks().forEach(track => track.stop());
        await new Promise<void>(r => setTimeout(r, android ? 350 : 120));
      } catch {
        showError(tpVoice.noMic);
        return;
      }

      await ensurePrefs();
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

      // Nivel 1: saludo por nombre (personal y cercano)
      const firstName = currentUser?.name?.trim().split(/\s+/)[0] ?? "";
      const baseOpener = OPENERS[ctx] ?? tpVoice.openerDefault;
      const opener = firstName
        ? `${language === "en" ? "Hi" : "Hola"} ${firstName}. ${baseOpener}`
        : baseOpener;
      apiHist.push({ role: "assistant", content: opener });
      // Sin TTS de apertura: el saludo se muestra como texto y se escucha DE INMEDIATO
      push("assistant", opener);

      let userInput = await listen();
      if (userInput === null) { showError(tpVoice.noMicAccess); return; }
      if (!userInput) {
        push("assistant", tpVoice.didntHear);
        userInput = await listen();
        if (!userInput) { push("assistant", tpVoice.whenReady); closeClean(); return; }
      }
      transcriptRef.current = userInput;
      push("user", userInput);
      apiHist.push({ role: "user", content: userInput });
      if (!activeRef.current) return;

      const converse = async (): Promise<void> => {
        if (!activeRef.current) return;
        setPhase("thinking");

        let result: { type: string; text?: string; say?: string; action?: string; data?: Record<string, unknown> };
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
              memory:       memoryRef.current,
              // Gatea qué herramientas de consulta se le ofrecen al modelo (guardarraíl
              // de UX: la anon key ya permite leer estas tablas desde el navegador)
              permissions:  currentUser?.permissions ?? null,
              role:         currentUser?.role ?? "",
            }),
            signal: ctrl.signal,
          });
          clearTimeout(tid);
          result = await res.json();
        } catch {
          const lastUser = [...apiHist].reverse().find(m => m.role === "user")?.content ?? "";
          result = { type: "action", action: localDetect(lastUser, ctx), data: {} };
        }

        if (result.type === "error") {
          // La IA no respondió — el dictado no se pierde: pendiente editable en la agenda
          const lastUser = [...apiHist].reverse().find(m => m.role === "user")?.content ?? "";
          const data: Record<string, unknown> = { event_type: "task", title: lastUser, event_date: TODAY(), event_time: "09:00" };
          setPendingAction({ action: "create_agenda_event", data });
          setEditableData({ ...data });
          push("assistant", language === "en"
            ? "AI is unreachable. Review and save your dictation:"
            : "No pude conectar con la IA. Revisa y guarda tu dictado:");
          setPhase("confirm");
          return;
        }

        if (result.type === "action" && result.action && EDIT_FIELDS[result.action]) {
          const action = result.action;
          const data: Record<string, unknown> = { ...result.data };
          // El modelo nombra el proyecto ("el de Brickell") → la tarjeta lo lee de __project_id
          if (data.project_id) { data.__project_id = String(data.project_id); delete data.project_id; }
          applyPrefsDefaults(action, data);
          if (!data.date) data.date = TODAY();
          if (action === "create_task" && !data.hours) data.hours = 8;

          setPendingAction({ action, data });
          setEditableData({ ...data });
          editableDataRef.current = { ...data };
          settledRef.current = false;

          // El acuse de recibo de Katy; si por lo que sea vino vacío, cae al resumen viejo
          const said = result.say?.trim()
            || `Voy a guardar ${ACTION_LABELS[action] ?? "registro"}: ${buildSummary(action, data)}.`;
          apiHist.push({ role: "assistant", content: said });
          push("assistant", said);
          setPhase("confirm");
          await awaitConfirm(action, data);

        } else {
          const question = result.text ?? tpVoice.anythingElse;
          apiHist.push({ role: "assistant", content: question });
          const stillAlive = await say(question);
          if (!stillAlive) return;

          let answer = await listen();
          if (!activeRef.current) return;
          if (answer === null) { showError(tpVoice.noMicAccess); return; }
          if (!answer) {
            await say(tpVoice.didntHear);
            answer = await listen();
            if (!answer || !activeRef.current) { closeClean(); return; }
          }
          if (confirmIntent(answer) === "quit") { closeClean(); return; }
          push("user", answer);
          apiHist.push({ role: "user", content: answer });
          await converse();
        }
      };

      // Manos libres: con la tarjeta en pantalla Katy sigue escuchando un sí/no, para
      // no obligar a tocar el teléfono con las manos ocupadas. Los botones siguen ahí.
      const awaitConfirm = async (action: string, original: Record<string, unknown>): Promise<void> => {
        for (let attempt = 0; attempt < 3; attempt++) {
          if (!activeRef.current || settledRef.current) return;
          const reply = await listen();
          // Pudo resolverse con los botones mientras escuchábamos: no guardes dos veces
          if (!activeRef.current || settledRef.current) return;
          if (reply === null) return;           // sin micrófono: quedan los botones
          if (!reply) continue;                 // silencio: reintenta

          const intent = confirmIntent(reply);
          push("user", reply);

          if (intent === "quit") { closeClean(); return; }

          if (intent === "yes") {
            settledRef.current = true;
            const msg = await commitRef.current?.(action, editableDataRef.current, original, true);
            if (msg) await keepGoing(msg);
            return;
          }

          if (intent === "no") {
            settledRef.current = true;
            await auditLog("cancelled", action, editableDataRef.current);
            setPendingAction(null); setEditableData({});
            await keepGoing(null);
            return;
          }

          // Ni sí ni no: es una corrección hablada → que la resuelva el modelo,
          // que emitirá una tarjeta nueva (y ahí settledRef vuelve a abrirse)
          settledRef.current = true;
          apiHist.push({ role: "user", content: reply });
          setPendingAction(null);
          await converse();
          return;
        }
        // Tres silencios seguidos: no dejamos el micrófono abierto para siempre
        closeClean();
      };

      // Tras guardar, la sesión NO muere: vuelve a escuchar para el siguiente comando
      const keepGoing = async (savedMsg: string | null): Promise<void> => {
        if (!activeRef.current) return;
        const cue = savedMsg ? `${savedMsg}. ${tpVoice.anythingElse}` : tpVoice.anythingElse;
        apiHist.push({ role: "assistant", content: cue });
        const stillAlive = await say(cue);
        if (!stillAlive) return;

        setPendingAction(null); setEditableData({}); setStatusMsg("");
        const next = await listen();
        if (!next || !activeRef.current) { closeClean(); return; }
        if (confirmIntent(next) === "quit") { closeClean(); return; }
        push("user", next);
        apiHist.push({ role: "user", content: next });
        await converse();
      };

      await converse();

    })().catch(err => {
      console.error("[VoiceFAB]", err);
      if (activeRef.current) showError("Error inesperado. Toca para reintentar.");
      else startedRef.current = false;
    });
  }, [phase, say, listen, push, closeClean, showError, language, t, currentUser, ensurePrefs, applyPrefsDefaults, auditLog]);

  // ── Modo "hey Katy" (wake word) ────────────────────────────────────────────
  useEffect(() => { startRef.current = start; }, [start]);
  useEffect(() => { wakeOnRef.current = wakeOn; }, [wakeOn]);

  const stopWake = useCallback(() => {
    try { wakeRecRef.current?.abort(); } catch { /* noop */ }
    wakeRecRef.current = null;
  }, []);

  // Arranca la escucha continua. Se reinicia sola (el motor se corta cada tanto).
  const startWake = useCallback(() => {
    if (!supported || wakeRecRef.current) return;
    const SRClass = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SRClass) return;
    const rec = new SRClass();
    rec.lang           = IS_ANDROID() ? language : `${language}-US`;
    rec.continuous     = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    wakeRecRef.current = rec;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const txt = Array.from(e.results).map(r => r[0]?.transcript ?? "").join(" ");
      if (hasWake(txt)) {
        stopWake();
        // Abre Katy en modo voz; el efecto de fase pausa el wake mientras dura
        startRef.current();
      }
    };
    // El reconocedor se detiene solo periódicamente o por error de red: relanzar
    // mientras siga activado y Katy esté cerrada (vía ref para no auto-referenciarse).
    rec.onend   = () => { wakeRecRef.current = null; if (wakeOnRef.current && !activeRef.current) setTimeout(() => startWakeRef.current(), 400); };
    rec.onerror = () => { try { rec.stop(); } catch { /* noop */ } };
    try { rec.start(); } catch { wakeRecRef.current = null; }
  }, [supported, language, stopWake]);
  useEffect(() => { startWakeRef.current = startWake; }, [startWake]);

  // Enciende/apaga y persiste; libera el micrófono mientras Katy está activa
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("kokistyle-wake", wakeOn ? "1" : "0");
    if (wakeOn && phase === "idle") startWake();
    else stopWake();
    return () => stopWake();
  }, [wakeOn, phase, startWake, stopWake]);

  // Pausa el wake si la pestaña se oculta (ahorra batería y evita que el motor
  // quede colgado en segundo plano); lo reanuda al volver.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) stopWake();
      else if (wakeOnRef.current && phase === "idle") startWake();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [phase, startWake, stopWake]);

  // Proyecto al que va a parar la acción pendiente. Puede venir autocompletado desde
  // la memoria de Katy, así que la tarjeta lo muestra siempre — no en silencio.
  const destTitle = (() => {
    if (!pendingAction) return null;
    const id = destProjectId(editableData, meta);
    if (!id) return null;
    const title = id === meta.projectId
      ? meta.projectTitle
      : (projectOptions.find(p => p.id === id)?.title ?? meta.projects?.find(p => p.id === id)?.title);
    return title ? title.split(" — ")[0] : null;
  })();

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
    confirm:   "bg-[var(--brand)]",
    saving:    "animate-pulse bg-[#4E7A82]",
    success:   "bg-[#4F8A63]",
    error:     "bg-[#B0492F]",
    text:      "bg-[var(--accent)]",
  };
  const fabBg =
    phase === "listening"                                            ? "animate-pulse bg-[#B0492F]" :
    phase === "success"                                             ? "bg-[#4F8A63]"               :
    phase === "thinking" || phase === "speaking" || phase === "saving" ? "bg-[#4E7A82]"            :
    phase === "text"                                                ? "bg-[var(--accent)]"               :
                                                                      "bg-[var(--brand)] hover:bg-[var(--brand-strong)]";

  const panelOpen = phase !== "idle";

  return (
    <>
      {panelOpen && (
        <div className="fixed bottom-24 right-4 z-[150] flex w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] shadow-2xl">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotCls[phase]}`} />
              <span className="text-xs font-bold text-[var(--brand)]">
                {ASSISTANT} — {headerLabel[phase]}
              </span>
            </div>
            {phase !== "saving" && phase !== "success" && (
              <button onClick={closeClean} className="rounded-lg p-1 text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#ECE3D1] dark:hover:bg-[#17233d]">
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
                    <span className="mr-1.5 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[9px] font-bold text-white">
                      {ASSISTANT[0]}
                    </span>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-snug ${
                    m.role === "user"
                      ? "rounded-br-sm bg-[var(--brand)] text-white"
                      : "rounded-bl-sm border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] text-[var(--brand)]"
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {(phase === "thinking" || phase === "saving") && (
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[9px] font-bold text-white">
                    {ASSISTANT[0]}
                  </span>
                  <div className="flex gap-1 rounded-2xl rounded-bl-sm border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 py-2">
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
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[9px] font-bold text-white">
                {ASSISTANT[0]}
              </span>
              <div className="flex gap-1 rounded-2xl rounded-bl-sm border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 py-2">
                {[0, 150, 300].map(d => (
                  <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5C6A6E]"
                        style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          )}

          {/* Voice: listening waveform */}
          {phase === "listening" && (
            <div className="flex items-center justify-center gap-1.5 border-t border-[#E6DDCB] dark:border-[#22304d] bg-[#FFF5F5] py-3 px-4">
              {[10,16,13,18,11].map((h,i) => (
                <span key={i} className="w-[3px] rounded-full bg-[#B0492F]"
                  style={{ height: `${h}px`, animation: `pulse 0.7s ${i*80}ms infinite alternate ease-in-out` }} />
              ))}
              <span className="ml-2 text-[11px] font-semibold text-[#B0492F]">Habla ahora</span>
            </div>
          )}

          {/* Voice: speaking indicator */}
          {phase === "speaking" && (
            <div className="flex items-center justify-center gap-2 border-t border-[#E6DDCB] dark:border-[#22304d] bg-[#F0F7F5] py-2.5">
              <Loader2 size={13} className="animate-spin text-[#4F8A63]" />
              <span className="text-[11px] font-semibold text-[#4F8A63]">{ASSISTANT} está hablando…</span>
            </div>
          )}

          {/* Text mode: input area */}
          {phase === "text" && (
            <div className="border-t border-[#E6DDCB] dark:border-[#22304d] p-3">
              {messages.length === 0 && (
                <p className="mb-2 text-xs text-[#5C6A6E] dark:text-[#9fb0cc]">
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
                  className="flex-1 rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-3 py-3 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none"
                />
                <button
                  onClick={handleTextSubmit}
                  disabled={!textInput.trim()}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] text-white disabled:opacity-40 active:scale-95 transition"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          )}

          {/* Confirm form */}
          {phase === "confirm" && pendingAction && (
            <div className="max-h-[300px] overflow-y-auto border-t border-[#E6DDCB] dark:border-[#22304d] p-3">
              {/* Destino SIEMPRE visible antes de confirmar: el proyecto puede venir
                  autocompletado de la memoria, y en silencio era imposible notarlo */}
              {PROJECT_ACTIONS.has(pendingAction.action) && (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-[#D7CBB3] dark:border-[#2c3c5e] bg-[#F7F3EA] dark:bg-[#16233d] px-2.5 py-1.5">
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">
                    {t.panel.voice.saveTo}
                  </span>
                  <span className={`truncate text-sm font-bold ${destTitle ? "text-[var(--brand)] dark:text-[#cfe0ff]" : "text-[#B0492F]"}`}>
                    {destTitle ?? t.panel.voice.pickProject}
                  </span>
                </div>
              )}
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#97A1A0] dark:text-[#728098]">
                Revisa y corrige si es necesario
              </p>
              <div className="space-y-2">
                {(PROJECT_ACTIONS.has(pendingAction.action) || pendingAction.action === "create_agenda_event") &&
                  !metaRef.current.projectId && (
                  <div className="flex items-center gap-2">
                    <label className="w-[72px] shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">
                      Proyecto
                    </label>
                    <select
                      value={String(editableData.__project_id ?? "")}
                      onChange={e => setEditableData(prev => ({ ...prev, __project_id: e.target.value }))}
                      className="min-w-0 flex-1 rounded-lg border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-2 py-2 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none"
                    >
                      <option value="">
                        {pendingAction.action === "create_agenda_event" ? "Sin proyecto (agenda general)" : "Elige el proyecto…"}
                      </option>
                      {projectOptions.map(p => (
                        <option key={p.id} value={p.id}>{p.title.split(" — ")[0]}</option>
                      ))}
                    </select>
                  </div>
                )}
                {(EDIT_FIELDS[pendingAction.action] ?? []).map(f => (
                  <div key={f.key} className="flex items-center gap-2">
                    <label className="w-[72px] shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">
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
                      className="flex-1 min-w-0 rounded-lg border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-2 py-2 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={handleCancel}
                  className="flex-1 rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] py-3 text-sm font-bold text-[#5C6A6E] dark:text-[#9fb0cc] transition hover:bg-[#DDD3BB]">
                  Cancelar
                </button>
                <button onClick={handleConfirm}
                  disabled={PROJECT_ACTIONS.has(pendingAction.action) && !metaRef.current.projectId && !editableData.__project_id}
                  className="flex-1 rounded-xl bg-[var(--brand)] py-3 text-sm font-bold text-white transition hover:bg-[var(--brand-strong)] disabled:opacity-40">
                  ✓ Confirmar
                </button>
              </div>
              {/* En voz los botones son opcionales: Katy sigue escuchando el sí/no */}
              {!textMode && (
                <p className="mt-2 text-center text-[10px] text-[#97A1A0] dark:text-[#728098]">
                  🎙 {t.panel.voice.handsFreeHint}
                </p>
              )}
            </div>
          )}

          {/* Success */}
          {phase === "success" && (
            <div className="flex items-center gap-2 border-t border-[#E6DDCB] dark:border-[#22304d] bg-[#F0F9F3] px-4 py-3">
              <CheckCircle size={16} className="shrink-0 text-[#4F8A63]" />
              <span className="text-sm font-semibold text-[#4F8A63]">{statusMsg}</span>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="flex flex-col gap-2 border-t border-[#E6DDCB] dark:border-[#22304d] p-3">
              <p className="rounded-lg bg-[#FFF0EE] dark:bg-[#2a1712] px-3 py-2 text-sm text-[#B0492F]">{statusMsg}</p>
              <div className="flex gap-2">
                {voiceCapable && (
                  <button onClick={() => { setPhase("idle"); startedRef.current = false; start(); }}
                    className="flex-1 rounded-xl bg-[var(--brand)] py-3 text-sm font-bold text-white">
                    🎤 Voz
                  </button>
                )}
                <button onClick={() => { setPhase("idle"); startedRef.current = false; startTextMode(); }}
                  className="flex-1 rounded-xl bg-[var(--accent)] py-3 text-sm font-bold text-white">
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
          className="fixed bottom-6 right-[5.5rem] z-[150] grid size-10 place-items-center rounded-full bg-[var(--accent)] text-white shadow-xl transition-all duration-200 active:scale-95 hover:bg-[var(--accent-strong)]"
        >
          <Keyboard size={18} />
        </button>
      )}

      {/* Toggle "hey Katy": escucha continua opt-in. Solo si el navegador lo soporta. */}
      {phase === "idle" && supported && (
        <button
          type="button"
          onClick={() => setWakeOn(v => !v)}
          aria-label={wakeOn ? 'Desactivar "hey Katy"' : 'Activar "hey Katy"'}
          aria-pressed={wakeOn}
          title={wakeOn ? 'Escuchando "hey Katy" — toca para apagar' : 'Activar "hey Katy" (manos libres)'}
          className={`fixed bottom-[4.75rem] right-6 z-[150] flex h-8 items-center gap-1.5 rounded-full pl-2 pr-3 text-[11px] font-bold shadow-xl transition-all duration-200 active:scale-95 ${
            wakeOn ? "bg-[#4F8A63] text-white" : "bg-white/95 dark:bg-[#17233d] text-[#5C6A6E] dark:text-[#9fb0cc] ring-1 ring-[#E6DDCB] dark:ring-[#2c3c5e]"
          }`}
        >
          {wakeOn
            ? <span className="grid size-4 place-items-center"><span className="size-2 animate-ping rounded-full bg-white" /></span>
            : <Ear size={14} />}
          hey Katy
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
