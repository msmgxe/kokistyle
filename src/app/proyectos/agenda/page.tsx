"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell, BellRing, CalendarPlus, Check, ExternalLink, Mic, Plus, RotateCcw, Trash2, X,
} from "lucide-react";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { supabase } from "@/src/lib/supabase";
import { logActivity } from "@/src/lib/activity";
import type { AgendaEvent, AgendaEventType, AgendaRemindFrom, AgendaRepeat } from "@/src/types/agenda";

/* eslint-disable @typescript-eslint/no-explicit-any */
type SpeechRecognitionLike = any;

const TYPE_META: Record<AgendaEventType, { emoji: string; color: string }> = {
  cita:    { emoji: "📅", color: "#395886" },
  task:    { emoji: "✅", color: "#4F8A63" },
  reunion: { emoji: "🤝", color: "#7B1838" },
};

const todayIso = () => new Date().toISOString().split("T")[0];

const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
};

interface ParsedEntry {
  event_type: AgendaEventType;
  title: string;
  event_date: string;
  event_time: string;
  remind_from: AgendaRemindFrom;
  repeat_every: AgendaRepeat;
  project_id: string | null;
}

/** Fallback local cuando /api/voice no responde — extrae tipo, fecha, hora, aviso y repetición */
function localParse(text: string, projects: { id: string; title: string }[]): ParsedEntry {
  const plain = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const event_type: AgendaEventType = /reuni|meeting/.test(plain)
    ? "reunion"
    : /tarea|task|comprar|llamar|recoger|pagar|pedir|buy|call|pick up/.test(plain)
    ? "task"
    : "cita";

  let event_date = plusDays(1);
  const wd = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  const wdEn = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  if (/\bhoy\b|\btoday\b/.test(plain)) event_date = todayIso();
  else if (/pasado manana/.test(plain)) event_date = plusDays(2);
  else if (/manana|tomorrow/.test(plain)) event_date = plusDays(1);
  else {
    for (let i = 0; i < 7; i++) {
      if (plain.includes(wd[i]) || plain.includes(wdEn[i])) {
        let diff = (i - new Date().getDay() + 7) % 7;
        if (diff === 0) diff = 7;
        event_date = plusDays(diff);
        break;
      }
    }
  }

  let event_time = "10:00";
  const tm = plain.match(/a las?\s+(\d{1,2})(?::(\d{2}))?|at\s+(\d{1,2})(?::(\d{2}))?/);
  if (tm) {
    let h = Number(tm[1] ?? tm[3]);
    const min = tm[2] ?? tm[4] ?? "00";
    if (/tarde|noche|pm/.test(plain) && h < 12) h += 12;
    event_time = String(h).padStart(2, "0") + ":" + min;
  }

  let remind_from: AgendaRemindFrom = "1d";
  if (/desde\s+(una|1)\s+semana|from\s+a\s+week/.test(plain)) remind_from = "1w";
  else if (/desde\s+(dos|2)\s+dias?|from\s+(two|2)\s+days/.test(plain)) remind_from = "2d";
  else if (/desde\s+(dos|2)\s+horas|from\s+(two|2)\s+hours/.test(plain)) remind_from = "2h";

  let repeat_every: AgendaRepeat = "once";
  const rp = plain.match(/cada\s+(una|1|dos|2|cuatro|4)\s*h|every\s+(1|2|4)\s*h/);
  if (rp) {
    const v = rp[1] ?? rp[2] ?? "";
    repeat_every = ({ una: "1h", "1": "1h", dos: "2h", "2": "2h", cuatro: "4h", "4": "4h" } as const)[v] ?? "once";
  }

  let project_id: string | null = null;
  for (const p of projects) {
    const words = p.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (words.some(w => plain.includes(w.normalize("NFD").replace(/[̀-ͯ]/g, "")))) {
      project_id = p.id;
      break;
    }
  }

  let title = text;
  const cut = plain.search(/\b(hoy|manana|pasado|today|tomorrow|el\s+\d|lunes|martes|miercoles|jueves|viernes|sabado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday|a las?\s+\d|at\s+\d|desde|cada|avisame|remind|every)/);
  if (cut > 3) title = text.slice(0, cut);
  title = title
    .replace(/^(agrega(r)?|crea(r)?|anota(r)?|agenda(r)?|recuerdame|recuérdame|nueva?|nuevo|add|create|schedule)\s+(una?\s+|a\s+)?(cita|reunion|reunión|tarea|task|meeting|appointment)?\s*(de|con|para|with|for)?\s*/i, "")
    .replace(/[,.]\s*$/, "")
    .trim();
  if (!title) title = text.trim();
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return { event_type, title, event_date, event_time, remind_from, repeat_every, project_id };
}

/** Genera y descarga el archivo .ics con dos alarmas (2h y 1 día antes) */
function downloadIcs(ev: AgendaEvent, projectTitle: string | null) {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,");
  const dt = ev.event_date.replace(/-/g, "") + "T" + ev.event_time.replace(":", "") + "00";
  const meta = TYPE_META[ev.event_type];
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Luxaris Design//Agenda//ES",
    "BEGIN:VEVENT",
    `UID:luxaris-agenda-${ev.id}@kokistyle.vercel.app`,
    `DTSTART:${dt}`,
    `SUMMARY:${meta.emoji} ${esc(ev.title)}`,
    `DESCRIPTION:${esc(projectTitle ? `Proyecto: ${projectTitle}` : "Agenda Luxaris Design")}`,
    "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Recordatorio", "END:VALARM",
    "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:Recordatorio", "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines], { type: "text/calendar" }));
  a.download = `luxaris-agenda-${ev.event_date}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function googleCalendarUrl(ev: AgendaEvent, projectTitle: string | null) {
  const start = ev.event_date.replace(/-/g, "") + "T" + ev.event_time.replace(":", "") + "00";
  const [h, m] = ev.event_time.split(":").map(Number);
  const endH = String(Math.min(h + 1, 23)).padStart(2, "0");
  const end = ev.event_date.replace(/-/g, "") + "T" + endH + String(m).padStart(2, "0") + "00";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${TYPE_META[ev.event_type].emoji} ${ev.title}`,
    dates: `${start}/${end}`,
    details: projectTitle ? `Proyecto: ${projectTitle}` : "Agenda Luxaris Design",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

const inputCls =
  "h-10 w-full rounded-xl border border-[#E6DDCB] bg-[#F7F3EA] px-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none";
const labelCls = "mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E]";

export default function AgendaPage() {
  const { isSuperAdmin, currentUser } = useAuth();
  const { t, language } = useLanguage();
  const ta = t.panel.agenda;

  const [events, setEvents]     = useState<AgendaEvent[]>([]);
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const load = useCallback(async () => {
    const [evRes, prRes] = await Promise.all([
      supabase.from("agenda_events").select("*").order("event_date").order("event_time"),
      supabase.from("projects").select("id, title").order("title"),
    ]);
    setEvents((evRes.data as AgendaEvent[]) ?? []);
    setProjects((prRes.data as { id: string; title: string }[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Push nativo (PWA) ─────────────────────────────────────────────────── */
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setPushOn(!!sub))
      .catch(() => {});
  }, []);

  const enablePush = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      showToast(ta.pushUnsupported);
      return;
    }
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) { showToast(ta.pushError); return; }
    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { showToast(ta.pushDenied); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
      const { error } = await supabase.from("push_subscriptions").upsert(
        { endpoint: sub.endpoint, subscription: sub.toJSON(), user_label: currentUser?.name ?? null },
        { onConflict: "endpoint" },
      );
      if (error) { showToast(ta.pushError); return; }
      setPushOn(true);
      showToast(ta.pushSaved);
    } catch {
      showToast(ta.pushError);
    } finally {
      setPushBusy(false);
    }
  }, [currentUser, showToast, ta.pushDenied, ta.pushError, ta.pushSaved, ta.pushUnsupported]);

  /* ── Formulario manual ─────────────────────────────────────────────────── */
  const emptyForm: ParsedEntry = {
    event_type: "cita", title: "", event_date: plusDays(1), event_time: "10:00",
    remind_from: "1d", repeat_every: "once", project_id: null,
  };
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<ParsedEntry>(emptyForm);
  const [saving, setSaving]     = useState(false);

  /* ── Captura por voz / texto ───────────────────────────────────────────── */
  const [capText, setCapText]       = useState("");
  const [listening, setListening]   = useState(false);
  const [parsing, setParsing]       = useState(false);
  const [confirmData, setConfirmData] = useState<ParsedEntry | null>(null);
  const recogRef = useRef<SpeechRecognitionLike>(null);

  const runParse = useCallback(async (raw?: string) => {
    const text = (raw ?? capText).trim();
    if (!text) { showToast(ta.captureEmpty); return; }
    setParsing(true);
    let parsed: ParsedEntry | null = null;
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: text }],
          context: "agenda",
          language,
          projects,
        }),
      });
      const data = await res.json();
      if (data?.type === "action" && data.action === "create_agenda_event" && data.data?.title) {
        const d = data.data as Record<string, string>;
        parsed = {
          event_type: (["cita", "task", "reunion"].includes(d.event_type) ? d.event_type : "cita") as AgendaEventType,
          title: d.title,
          event_date: /^\d{4}-\d{2}-\d{2}$/.test(d.event_date ?? "") ? d.event_date : plusDays(1),
          event_time: /^\d{2}:\d{2}$/.test(d.event_time ?? "") ? d.event_time : "10:00",
          remind_from: (["2h", "1d", "2d", "1w"].includes(d.remind_from) ? d.remind_from : "1d") as AgendaRemindFrom,
          repeat_every: (["once", "1h", "2h", "4h"].includes(d.repeat_every) ? d.repeat_every : "once") as AgendaRepeat,
          project_id: projects.some(p => p.id === d.project_id) ? d.project_id : null,
        };
      }
    } catch { /* fallback local */ }
    if (!parsed) parsed = localParse(text, projects);
    setConfirmData(parsed);
    setParsing(false);
  }, [capText, language, projects, showToast, ta.captureEmpty]);

  const micTap = useCallback(() => {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) { showToast(ta.captureNoSpeech); return; }
    if (listening) { try { recogRef.current?.stop(); } catch { /* noop */ } return; }
    const rec = new SR();
    recogRef.current = rec;
    rec.lang = language === "es" ? "es-US" : "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart  = () => setListening(true);
    rec.onend    = () => setListening(false);
    rec.onerror  = () => { setListening(false); showToast(ta.captureMicError); };
    rec.onresult = (e: any) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      setCapText(transcript);
      runParse(transcript);
    };
    try { rec.start(); } catch { showToast(ta.captureMicError); }
  }, [language, listening, runParse, showToast, ta.captureMicError, ta.captureNoSpeech]);

  /* ── Guardar / eliminar ────────────────────────────────────────────────── */
  const saveEntry = useCallback(async (entry: ParsedEntry, viaVoice: boolean) => {
    if (!entry.title.trim()) { showToast(ta.captureEmpty); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from("agenda_events")
      .insert({
        event_type: entry.event_type,
        title: entry.title.trim(),
        project_id: entry.project_id,
        event_date: entry.event_date,
        event_time: entry.event_time,
        remind_from: entry.remind_from,
        repeat_every: entry.repeat_every,
      })
      .select()
      .single();
    setSaving(false);
    if (error || !data) { showToast(ta.errorSaving); return; }
    logActivity({
      user_id: currentUser?.id, user_name: currentUser?.name, user_role: "superadmin",
      action: "create", entity_type: "agenda_event", entity_id: data.id, entity_name: entry.title.trim(),
    });
    setEvents(prev => [...prev, data as AgendaEvent].sort((a, b) =>
      (a.event_date + a.event_time).localeCompare(b.event_date + b.event_time)));
    if (viaVoice) { setConfirmData(null); setCapText(""); showToast(ta.savedByVoice); }
    else          { setShowForm(false); setForm(emptyForm); showToast(ta.saved); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, showToast, ta]);

  const removeEntry = useCallback(async (ev: AgendaEvent) => {
    if (!window.confirm(ta.confirmDelete)) return;
    await supabase.from("agenda_events").delete().eq("id", ev.id);
    logActivity({
      user_id: currentUser?.id, user_name: currentUser?.name, user_role: "superadmin",
      action: "delete", entity_type: "agenda_event", entity_id: ev.id, entity_name: ev.title,
    });
    setEvents(prev => prev.filter(e => e.id !== ev.id));
    showToast(ta.deleted);
  }, [currentUser, showToast, ta.confirmDelete, ta.deleted]);

  const toggleDone = useCallback(async (ev: AgendaEvent) => {
    await supabase.from("agenda_events").update({ done: !ev.done }).eq("id", ev.id);
    setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, done: !e.done } : e));
  }, []);

  /* ── Derivados ─────────────────────────────────────────────────────────── */
  const today = todayIso();
  const week  = plusDays(7);
  const listToday    = events.filter(e => e.event_date === today);
  const listUpcoming = events.filter(e => e.event_date > today);
  const listPast     = events.filter(e => e.event_date < today);
  const kpiReminders = events.filter(e => !e.done && e.repeat_every !== "once").length;
  const kpiWeek      = events.filter(e => e.event_date >= today && e.event_date <= week).length;

  const projectTitle = (id: string | null) => projects.find(p => p.id === id)?.title ?? null;

  const fmtDate = (iso: string) =>
    new Date(iso + "T12:00:00").toLocaleDateString(language === "es" ? "es-US" : "en-US",
      { weekday: "short", day: "numeric", month: "short" });

  const FROM_LABELS: Record<AgendaRemindFrom, string> = {
    "2h": ta.from2h, "1d": ta.from1d, "2d": ta.from2d, "1w": ta.from1w,
  };
  const REP_LABELS: Record<AgendaRepeat, string> = {
    once: ta.repOnce, "1h": ta.rep1h, "2h": ta.rep2h, "4h": ta.rep4h,
  };
  const TYPE_LABELS: Record<AgendaEventType, string> = {
    cita: ta.typeCita, task: ta.typeTask, reunion: ta.typeReunion,
  };

  if (!isSuperAdmin) {
    return (
      <div className="rounded-2xl border border-[#E6DDCB] bg-white p-8 text-center text-sm font-semibold text-[#5C6A6E]">
        {ta.onlyAdmin}
      </div>
    );
  }

  /* ── Sub-render: campos compartidos entre form y tarjeta de confirmación ── */
  const entryFields = (entry: ParsedEntry, set: (e: ParsedEntry) => void) => (
    <>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(TYPE_META) as AgendaEventType[]).map(tp => (
          <button key={tp} type="button" onClick={() => set({ ...entry, event_type: tp })}
            className={`rounded-xl border-2 px-2 py-2.5 text-center transition ${
              entry.event_type === tp ? "bg-white" : "border-[#E6DDCB] bg-[#F7F3EA] hover:bg-white"
            }`}
            style={entry.event_type === tp ? { borderColor: TYPE_META[tp].color } : undefined}>
            <span className="block text-lg">{TYPE_META[tp].emoji}</span>
            <span className="block text-[11px] font-bold text-[#16323D]">{TYPE_LABELS[tp]}</span>
            <span className="block text-[9px] text-[#97A1A0]">
              {tp === "cita" ? ta.typeCitaDesc : tp === "task" ? ta.typeTaskDesc : ta.typeReunionDesc}
            </span>
          </button>
        ))}
      </div>
      <div>
        <label className={labelCls}>{ta.fieldTitle}</label>
        <input value={entry.title} onChange={e => set({ ...entry, title: e.target.value })}
          className={inputCls} placeholder={ta.titlePlaceholder} />
      </div>
      <div>
        <label className={labelCls}>{ta.fieldProject}</label>
        <select value={entry.project_id ?? ""} onChange={e => set({ ...entry, project_id: e.target.value || null })}
          className={inputCls}>
          <option value="">{ta.noProject}</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{ta.fieldDate}</label>
          <input type="date" value={entry.event_date}
            onChange={e => set({ ...entry, event_date: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{ta.fieldTime}</label>
          <input type="time" value={entry.event_time}
            onChange={e => set({ ...entry, event_time: e.target.value })} className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{ta.remindFrom}</label>
          <select value={entry.remind_from}
            onChange={e => set({ ...entry, remind_from: e.target.value as AgendaRemindFrom })} className={inputCls}>
            {(Object.keys(FROM_LABELS) as AgendaRemindFrom[]).map(k =>
              <option key={k} value={k}>{FROM_LABELS[k]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>{ta.repeatEvery}</label>
          <select value={entry.repeat_every}
            onChange={e => set({ ...entry, repeat_every: e.target.value as AgendaRepeat })} className={inputCls}>
            {(Object.keys(REP_LABELS) as AgendaRepeat[]).map(k =>
              <option key={k} value={k}>{REP_LABELS[k]}</option>)}
          </select>
        </div>
      </div>
    </>
  );

  const eventCard = (ev: AgendaEvent) => {
    const meta = TYPE_META[ev.event_type];
    const pt = projectTitle(ev.project_id);
    return (
      <div key={ev.id}
        className={`flex items-start gap-3 rounded-2xl border border-[#E6DDCB] bg-white p-4 ${ev.done ? "opacity-55" : ""}`}
        style={{ borderLeftWidth: 4, borderLeftColor: meta.color }}>
        <span className="mt-0.5 text-xl">{meta.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold text-[#16323D] ${ev.done ? "line-through" : ""}`}>{ev.title}</p>
          <p className="mt-0.5 text-xs text-[#5C6A6E]">
            {fmtDate(ev.event_date)} · {ev.event_time} ·{" "}
            <span className="font-bold" style={{ color: meta.color }}>{TYPE_LABELS[ev.event_type]}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pt && (
              <span className="rounded-full bg-[#395886] px-2.5 py-0.5 text-[10px] font-bold text-white">{pt}</span>
            )}
            <span className="rounded-full border border-[#E6DDCB] bg-[#F7F3EA] px-2.5 py-0.5 text-[10px] font-semibold text-[#5C6A6E]">
              ⏰ {ta.chipFrom} {FROM_LABELS[ev.remind_from]}
            </span>
            <span className="rounded-full border border-[#E6DDCB] bg-[#F7F3EA] px-2.5 py-0.5 text-[10px] font-semibold text-[#5C6A6E]">
              🔁 {REP_LABELS[ev.repeat_every]}
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button onClick={() => { downloadIcs(ev, pt); showToast(ta.icsDownloaded); }}
              className="inline-flex items-center gap-1 rounded-lg border border-[#16323D] px-2.5 py-1 text-[11px] font-bold text-[#16323D] hover:bg-[#F7F3EA]">
              <CalendarPlus size={12} /> {ta.addToCalendar}
            </button>
            <a href={googleCalendarUrl(ev, pt)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-[#E6DDCB] px-2.5 py-1 text-[11px] font-bold text-[#5C6A6E] hover:bg-[#F7F3EA]">
              <ExternalLink size={12} /> {ta.googleCalendar}
            </a>
          </div>
        </div>
        <div className="flex flex-none flex-col items-end gap-1.5">
          <button onClick={() => toggleDone(ev)}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
              ev.done
                ? "border border-[#E6DDCB] text-[#5C6A6E] hover:bg-[#F7F3EA]"
                : "bg-[#4F8A63] text-white hover:bg-[#3F7452]"
            }`}>
            {ev.done ? <><RotateCcw size={11} /> {ta.reopen}</> : <><Check size={11} /> {ta.markDone}</>}
          </button>
          <button onClick={() => removeEntry(ev)}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[#B0492F] hover:bg-[#FFF0EE]">
            <Trash2 size={11} /> {ta.remove}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* ── Encabezado ─────────────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-bookman text-2xl text-[#16323D]">🗓️ {ta.title}</h1>
          <p className="text-sm text-[#5C6A6E]">{ta.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={enablePush} disabled={pushBusy || pushOn}
            title={pushOn ? ta.pushEnabled : ta.pushEnable}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              pushOn
                ? "border border-[#4F8A63] bg-[#EDF7F0] text-[#4F8A63]"
                : "border border-[#16323D] text-[#16323D] hover:bg-[#F7F3EA]"
            } disabled:opacity-60`}>
            {pushOn ? <BellRing size={15} /> : <Bell size={15} />}
            <span className="hidden sm:inline">{pushOn ? ta.pushEnabled : ta.pushEnable}</span>
          </button>
          <button onClick={() => setShowForm(s => !s)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#16323D] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0e2630]">
            <Plus size={15} /> {ta.newEntry}
          </button>
        </div>
      </div>

      {/* ── Captura por voz / texto ────────────────────────────────────────── */}
      <div className="mb-5 rounded-2xl border border-[#E6DDCB] bg-white p-4">
        <div className="flex items-center gap-3">
          <button onClick={micTap} title={ta.captureHint} aria-label={ta.captureHint}
            className={`grid size-11 flex-none place-items-center rounded-full text-white transition ${
              listening ? "animate-pulse bg-[#B0492F]" : "bg-[#7B1838] hover:bg-[#631230]"
            }`}>
            <Mic size={18} />
          </button>
          <input value={capText} onChange={e => setCapText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") runParse(); }}
            className="h-11 min-w-0 flex-1 rounded-xl border border-[#E6DDCB] bg-[#F7F3EA] px-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none"
            placeholder={ta.captureVoicePlaceholder} />
          <button onClick={() => runParse()} disabled={parsing}
            className="flex-none rounded-xl bg-[#16323D] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0e2630] disabled:opacity-50">
            {parsing ? "…" : ta.captureCreate}
          </button>
        </div>
        <p className="mt-2 text-[11px] italic text-[#97A1A0]">
          {listening ? ta.captureListening : ta.captureHint}
        </p>

        {confirmData && (
          <div className="mt-3 space-y-3 rounded-2xl border-2 border-[#C9A227] bg-[#F7F3EA] p-4">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#5C6A6E]">
              🎙️ {ta.confirmTitle}
            </h4>
            {entryFields(confirmData, setConfirmData)}
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmData(null)}
                className="inline-flex items-center gap-1 rounded-xl border border-[#E6DDCB] bg-white px-4 py-2 text-sm font-bold text-[#5C6A6E]">
                <X size={13} /> {ta.cancel}
              </button>
              <button onClick={() => saveEntry(confirmData, true)} disabled={saving}
                className="inline-flex items-center gap-1 rounded-xl bg-[#16323D] px-4 py-2 text-sm font-bold text-white hover:bg-[#0e2630] disabled:opacity-50">
                <Check size={13} /> {ta.confirmSave}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          { v: listToday.length, l: ta.kpiToday },
          { v: kpiWeek, l: ta.kpiWeek },
          { v: kpiReminders, l: ta.kpiReminders },
        ].map(k => (
          <div key={k.l} className="rounded-2xl border border-[#E6DDCB] bg-white px-4 py-3">
            <p className="text-2xl font-bold tabular-nums text-[#16323D]">{k.v}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E]">{k.l}</p>
          </div>
        ))}
      </div>

      {/* ── Formulario manual ──────────────────────────────────────────────── */}
      {showForm && (
        <div className="mb-5 space-y-3 rounded-2xl border border-[#E6DDCB] bg-white p-4">
          {entryFields(form, setForm)}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setForm(emptyForm); }}
              className="rounded-xl border border-[#E6DDCB] px-4 py-2 text-sm font-bold text-[#5C6A6E]">
              {ta.cancel}
            </button>
            <button onClick={() => saveEntry(form, false)} disabled={saving}
              className="rounded-xl bg-[#16323D] px-4 py-2 text-sm font-bold text-white hover:bg-[#0e2630] disabled:opacity-50">
              {ta.save}
            </button>
          </div>
        </div>
      )}

      {/* ── Listas ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#F0EAE0]" />)}
        </div>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#5C6A6E]">{ta.groupToday}</h2>
            {listToday.length
              ? <div className="space-y-2.5">{listToday.map(eventCard)}</div>
              : <p className="text-sm italic text-[#97A1A0]">{ta.emptyToday}</p>}
          </section>
          <section>
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#5C6A6E]">{ta.groupUpcoming}</h2>
            {listUpcoming.length
              ? <div className="space-y-2.5">{listUpcoming.map(eventCard)}</div>
              : <p className="text-sm italic text-[#97A1A0]">{ta.emptyUpcoming}</p>}
          </section>
          {listPast.length > 0 && (
            <section>
              <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#5C6A6E]">{ta.groupPast}</h2>
              <div className="space-y-2.5 opacity-70">{listPast.map(eventCard)}</div>
            </section>
          )}
        </div>
      )}

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[#16323D] px-5 py-3 text-sm font-semibold text-[#F5E9DA] shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
