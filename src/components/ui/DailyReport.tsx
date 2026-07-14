"use client";

import { useEffect, useMemo, useState } from "react";
import { Printer, Pin, X, Pencil } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import { initials } from "@/src/lib/utils";
import { logActivity } from "@/src/lib/activity";
import { branding } from "@/src/config/branding";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import type { Project, Task } from "@/src/types/project";
import type { AgendaEvent } from "@/src/types/agenda";

type DayNote = Pick<AgendaEvent, "id" | "title" | "event_date" | "event_time" | "done" | "event_type" | "project_id">;

interface ProjectWithTasks extends Project { tasks: Task[] }

const STATUS_IDS = ["en_obra", "aprobado", "presupuesto", "prospecto", "terminado"] as const;

const STATUS_PILL: Record<string, string> = {
  prospecto:   "bg-[#EFEFEF] text-[#5C5C5C]",
  presupuesto: "bg-[#F5E6C3] text-[#7A6230]",
  aprobado:    "bg-[#EDF3FB] text-[#395886]",
  en_obra:     "bg-[#DCEBDD] text-[#35664A]",
  terminado:   "bg-[#16323D] text-white",
};

// Mismos pares bg/texto que TAG_STYLES del Day Planner — misma sección, mismo color
const SECTION_STYLES = [
  "bg-[#EDF3FB] text-[#395886]",
  "bg-[#DCEBDD] text-[#4F8A63]",
  "bg-[#EDE3CF] text-[#7A6230]",
  "bg-[#F0E8F7] text-[#6D3AAD]",
  "bg-[#DCE8E9] text-[#4E7A82]",
  "bg-[#FDF0ED] text-[#B0492F]",
  "bg-[#F7F0E8] text-[#A0582A]",
  "bg-[#E8EEF7] text-[#3F6AB0]",
  "bg-[#EFEFEF] text-[#5C5C5C]",
];

function sectionStyle(tag: string): string {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return SECTION_STYLES[h % SECTION_STYLES.length];
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isoAddDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toIso(d);
}
function weekday(iso: string): number {
  return new Date(iso + "T00:00:00").getDay();
}

export default function DailyReport({
  projects, toast, onRefresh,
}: {
  projects: ProjectWithTasks[];
  toast: (msg: string) => void;
  onRefresh: () => void;
}) {
  const { t, language } = useLanguage();
  const { currentUser, isSuperAdmin } = useAuth();
  const tr = t.panel.dailyReport;
  const tp = t.panel;
  const EN = language === "en";

  const [from, setFrom] = useState(() => toIso(new Date()));
  const [to, setTo] = useState(() => isoAddDays(toIso(new Date()), 6));
  const [selected, setSelected] = useState<Set<string>>(() => new Set(["en_obra"]));
  const [onlyPending, setOnlyPending] = useState(false);
  const [contactNames, setContactNames] = useState<Map<string, string>>(new Map());
  // Overrides locales de checkbox — el padre refresca en segundo plano
  const [doneOverride, setDoneOverride] = useState<Map<string, boolean>>(new Map());

  // Notas del día = agenda_events (globales, sin proyecto obligatorio) — solo superadmin
  const [dayNotes, setDayNotes] = useState<DayNote[]>([]);
  const [addingNoteFor, setAddingNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [editNoteTitle, setEditNoteTitle] = useState("");
  const [editNoteProject, setEditNoteProject] = useState("");

  const projById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  useEffect(() => {
    supabase.from("contacts").select("id, name").then(({ data }) => {
      if (data) setContactNames(new Map(data.map(c => [c.id as string, c.name as string])));
    });
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    supabase
      .from("agenda_events")
      .select("id, title, event_date, event_time, done, event_type, project_id")
      .gte("event_date", from)
      .lte("event_date", to)
      .order("event_time", { ascending: true })
      .then(({ data }) => { if (data) setDayNotes(data as DayNote[]); });
  }, [isSuperAdmin, from, to]);

  const addNote = async (iso: string) => {
    const title = noteText.trim();
    if (!title) return;
    const { data, error } = await supabase
      .from("agenda_events")
      .insert({ event_type: "task", title, event_date: iso })
      .select("id, title, event_date, event_time, done, event_type, project_id")
      .single();
    if (error || !data) { toast(tr.noteError); return; }
    setDayNotes(prev => [...prev, data as DayNote]);
    setNoteText("");
    setAddingNoteFor(null);
    logActivity({
      user_id: currentUser?.id, user_name: currentUser?.name, user_role: "superadmin",
      action: "create", entity_type: "agenda_event", entity_id: (data as DayNote).id, entity_name: title,
    });
    toast(tr.noteSaved);
  };

  const toggleNoteDone = async (id: string, done: boolean) => {
    setDayNotes(prev => prev.map(n => n.id === id ? { ...n, done } : n));
    const { error } = await supabase.from("agenda_events").update({ done }).eq("id", id);
    if (error) {
      setDayNotes(prev => prev.map(n => n.id === id ? { ...n, done: !done } : n));
      toast(tr.statusError);
    }
  };

  const startEditNote = (note: DayNote) => {
    setEditNoteId(note.id);
    setEditNoteTitle(note.title);
    setEditNoteProject(note.project_id ?? "");
    setAddingNoteFor(null);
  };

  const saveEditNote = async () => {
    const id = editNoteId;
    if (!id) return;
    const title = editNoteTitle.trim();
    if (!title) return;
    const project_id = editNoteProject || null;
    const { error } = await supabase.from("agenda_events").update({ title, project_id }).eq("id", id);
    if (error) { toast(tr.noteError); return; }
    setDayNotes(prev => prev.map(n => n.id === id ? { ...n, title, project_id } : n));
    setEditNoteId(null);
    toast(tr.noteUpdated);
  };

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from("agenda_events").delete().eq("id", id);
    if (error) { toast(tr.noteError); return; }
    setDayNotes(prev => prev.filter(n => n.id !== id));
    toast(tr.noteDeleted);
  };

  const WD = EN
    ? ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
    : ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
  const MO = EN
    ? ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
    : ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const fmt = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}`;
  };

  const toggleStatus = (s: string) =>
    setSelected(prev => {
      const n = new Set(prev);
      n.has(s) ? n.delete(s) : n.add(s);
      return n;
    });

  const isDone = (task: Task) => doneOverride.get(task.id) ?? (task.status === "done");

  const toggleDone = async (task: Task, done: boolean) => {
    setDoneOverride(prev => new Map(prev).set(task.id, done));
    const { error } = await supabase.from("tasks")
      .update({ status: done ? "done" : "pend" }).eq("id", task.id);
    if (error) {
      setDoneOverride(prev => new Map(prev).set(task.id, !done));
      toast(tr.statusError);
      return;
    }
    onRefresh();
  };

  const rows = useMemo(() => {
    const out: { task: Task; project: ProjectWithTasks }[] = [];
    for (const p of projects) {
      if (!selected.has(p.status)) continue;
      for (const task of p.tasks) {
        if (!task.scheduled_date || task.scheduled_date < from || task.scheduled_date > to) continue;
        out.push({ task, project: p });
      }
    }
    return out;
  }, [projects, selected, from, to]);

  const visibleRows = onlyPending ? rows.filter(r => !isDone(r.task)) : rows;

  const days = useMemo(() => {
    const list: string[] = [];
    for (let iso = from; iso && iso <= to && list.length < 62; iso = isoAddDays(iso, 1)) list.push(iso);
    return list;
  }, [from, to]);

  const doneCount = visibleRows.filter(r => isDone(r.task)).length;
  const totalHours = visibleRows.reduce((s, r) => s + (r.task.hours || 0), 0);
  const projCount = new Set(visibleRows.map(r => r.project.id)).size;
  const pct = visibleRows.length ? Math.round((doneCount / visibleRows.length) * 100) : 0;

  const selectedLabels = STATUS_IDS.filter(s => selected.has(s))
    .map(s => tp.status[s as keyof typeof tp.status]).join(" + ") || "—";
  const assigneeName = (id: string | null) =>
    (id && contactNames.get(id)) || tp.workflow.ownTeam;

  return (
    <div>
      {/* @page no se puede expresar en Tailwind — anula el landscape global del Gantt solo mientras este view está montado */}
      <style>{"@media print { @page { size: portrait; margin: 12mm; } }"}</style>

      {/* ── Controles (solo pantalla) ── */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-[#E6DDCB] bg-white px-4 py-3 print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#5C6A6E]">{tr.from}</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="rounded-lg border border-[#E6DDCB] bg-[#F7F3EA] px-2 py-1.5 text-[12px] text-[#16323D] focus:border-[#395886] focus:outline-none" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#5C6A6E]">{tr.to}</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="rounded-lg border border-[#E6DDCB] bg-[#F7F3EA] px-2 py-1.5 text-[12px] text-[#16323D] focus:border-[#395886] focus:outline-none" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#5C6A6E]">{tr.statuses}</span>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_IDS.map(s => {
              const count = projects.filter(p => p.status === s).length;
              const on = selected.has(s);
              return (
                <button key={s} onClick={() => toggleStatus(s)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold transition ${
                    on ? "border-[#395886] bg-[#395886] text-white" : "border-[#E6DDCB] bg-[#F7F3EA] text-[#5C6A6E] hover:border-[#395886]"
                  }`}>
                  {tp.status[s as keyof typeof tp.status]}
                  <span className={`rounded-full px-1.5 font-mono text-[9px] ${on ? "bg-white/20" : "bg-[#E6DDCB]"}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-[12px] font-semibold text-[#16323D]">
          <input type="checkbox" checked={onlyPending} onChange={e => setOnlyPending(e.target.checked)}
            className="size-3.5 accent-[#4F8A63]" />
          {tr.onlyPending}
        </label>
        <button onClick={() => window.print()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#B0492F] px-4 py-2 text-[12px] font-bold text-white shadow-md transition hover:bg-[#983C25]">
          <Printer size={13} /> {tr.print}
        </button>
      </div>

      {/* ── Hoja del reporte ── */}
      <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
        <div className="flex items-end justify-between gap-5 bg-[#16323D] px-7 py-5">
          <div>
            <div className="text-[10px] font-bold tracking-[0.28em] text-[#A8C0BC]">{branding.companyName.toUpperCase()}</div>
            <h2 className="font-bookman mt-1 text-[22px] font-semibold text-white">{tr.title}</h2>
            <div className="mt-0.5 text-[11px] text-[#A8C0BC]">
              {tr.range}: <b className="font-semibold text-white">{fmt(from)} — {fmt(to)}</b>
              {" · "}{tr.statuses}: <b className="font-semibold text-white">{selectedLabels}</b>
              {onlyPending && <> · <b className="font-semibold text-white">{tr.onlyPending.toLowerCase()}</b></>}
            </div>
          </div>
          <div className="hidden text-right text-[10px] leading-relaxed text-[#A8C0BC] sm:block">
            <div>{tr.generated}</div>
            <div className="text-[13px] font-semibold text-white">{fmt(toIso(new Date()))} {new Date().getFullYear()}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 border-b border-[#E6DDCB] bg-[#F7F3EA] sm:grid-cols-4">
          {[
            { v: String(projCount), l: tr.kpiProjects },
            { v: `${visibleRows.length}`, l: tr.kpiActivities },
            { v: `${totalHours}h`, l: tr.kpiHours },
            { v: `${pct}%`, l: tr.kpiDone, bar: true },
          ].map(k => (
            <div key={k.l} className="border-r border-[#E6DDCB] px-5 py-3 last:border-r-0">
              <div className="font-mono text-[19px] font-bold text-[#16323D]">{k.v}</div>
              <div className="text-[9px] font-bold uppercase tracking-wide text-[#5C6A6E]">{k.l}</div>
              {k.bar && (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#E6DDCB]">
                  <div className="h-full rounded-full bg-[#4F8A63]" style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-7 py-2">
          {visibleRows.length === 0 && !(isSuperAdmin && dayNotes.length > 0) && (
            <p className="py-10 text-center text-[13px] italic text-[#97A1A0]">{tr.noResults}</p>
          )}
          {(visibleRows.length > 0 || (isSuperAdmin && dayNotes.length > 0)) && days.map(iso => {
            const dayRows = visibleRows.filter(r => r.task.scheduled_date === iso);
            const notesOfDay = dayNotes.filter(n => n.event_date === iso);
            const wd = weekday(iso);
            const wk = wd === 6 ? "sat" : wd === 0 ? "sun" : null;
            const d = new Date(iso + "T00:00:00");
            const dayHours = dayRows.reduce((s, r) => s + (r.task.hours || 0), 0);
            const dayDone = dayRows.filter(r => isDone(r.task)).length;
            const dayProjects = projects.filter(p => dayRows.some(r => r.project.id === p.id));

            return (
              <div key={iso} className="flex gap-4 border-b border-[#F0EBE0] py-4 last:border-b-0 print:break-inside-avoid">
                {/* Riel de fecha */}
                <div className={`w-[72px] shrink-0 rounded-xl pt-1 text-center ${
                  wk === "sat" ? "bg-[#EAF3FA] pb-2" : wk === "sun" ? "bg-[#FDF1E7] pb-2" : ""
                }`}>
                  <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#5C6A6E]">{WD[wd]}</div>
                  <div className="font-bookman text-[26px] font-light leading-tight text-[#16323D]">{d.getDate()}</div>
                  <div className="text-[9px] uppercase tracking-widest text-[#97A1A0]">{MO[d.getMonth()]}</div>
                  {wk && (
                    <span className={`mx-auto mt-1.5 block w-fit rounded-full px-2 py-0.5 text-[7.5px] font-extrabold tracking-wide ${
                      wk === "sat" ? "bg-[#9DC3E6] text-[#1E4A70]" : "bg-[#F4B183] text-[#7A3C12]"
                    }`}>
                      {wk === "sat" ? tr.saturday : tr.sunday}
                    </span>
                  )}
                </div>

                {/* Actividades del día */}
                <div className="min-w-0 flex-1">
                  {/* Notas del día (agenda_events) — recordatorios sueltos a nivel de todos los proyectos */}
                  {isSuperAdmin && (notesOfDay.length > 0 || addingNoteFor === iso) && (
                    <div className="mb-2.5 space-y-1.5">
                      {notesOfDay.map(n => (
                        editNoteId === n.id ? (
                          <div key={n.id} className="space-y-1.5 rounded-lg border border-[#B98A2F] bg-[#FBF5E6] px-3 py-2 print:hidden">
                            <input
                              autoFocus
                              value={editNoteTitle}
                              onChange={e => setEditNoteTitle(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") saveEditNote(); if (e.key === "Escape") setEditNoteId(null); }}
                              className="w-full rounded border border-[#EAD9AC] bg-white px-2 py-1.5 text-[12px] font-medium text-[#16323D] focus:border-[#B98A2F] focus:outline-none"
                            />
                            <select
                              value={editNoteProject}
                              onChange={e => setEditNoteProject(e.target.value)}
                              className="w-full rounded border border-[#EAD9AC] bg-white px-2 py-1.5 text-[12px] text-[#16323D] focus:border-[#B98A2F] focus:outline-none"
                            >
                              <option value="">{tr.noteNoProject}</option>
                              {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.title.split(" — ")[0]}</option>
                              ))}
                            </select>
                            <div className="flex gap-1.5">
                              <button onClick={() => setEditNoteId(null)} className="flex-1 rounded bg-[#ECE3D1] py-1.5 text-[11px] font-bold text-[#5C6A6E]">
                                {EN ? "Cancel" : "Cancelar"}
                              </button>
                              <button onClick={saveEditNote} disabled={!editNoteTitle.trim()} className="flex-1 rounded bg-[#B98A2F] py-1.5 text-[11px] font-bold text-white disabled:opacity-40">
                                {tr.noteSaveEdit}
                              </button>
                            </div>
                          </div>
                        ) : (
                        <div key={n.id} className="flex items-center gap-2 rounded-lg border border-[#EAD9AC] bg-[#FBF5E6] px-3 py-1.5">
                          <Pin size={11} className="shrink-0 text-[#B98A2F]" />
                          <input
                            type="checkbox"
                            checked={n.done}
                            onChange={e => toggleNoteDone(n.id, e.target.checked)}
                            className="size-3.5 shrink-0 cursor-pointer accent-[#4F8A63]"
                            aria-label={n.title}
                          />
                          <span className={`min-w-0 flex-1 truncate text-[12px] ${n.done ? "text-[#97A1A0] line-through" : "font-medium text-[#7A6230]"}`}>
                            {n.title}
                            {n.project_id && projById.get(n.project_id) && (
                              <span className="ml-1.5 rounded-full bg-[#EAD9AC] px-1.5 py-0.5 text-[9px] font-bold text-[#7A6230]">
                                {projById.get(n.project_id)!.title.split(" — ")[0]}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-[#B98A2F]">{n.event_time?.slice(0, 5)}</span>
                          <button
                            onClick={() => startEditNote(n)}
                            className="shrink-0 text-[#B98A2F]/60 transition hover:text-[#B98A2F] print:hidden"
                            aria-label={tr.noteEdit}
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => deleteNote(n.id)}
                            className="shrink-0 text-[#B0492F]/50 transition hover:text-[#B0492F] print:hidden"
                            aria-label={tr.noteDeleted}
                          >
                            <X size={12} />
                          </button>
                        </div>
                        )
                      ))}
                      {addingNoteFor === iso && (
                        <div className="flex items-center gap-2 rounded-lg border border-[#B98A2F] bg-[#FBF5E6] px-3 py-1.5">
                          <Pin size={11} className="shrink-0 text-[#B98A2F]" />
                          <input
                            autoFocus
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") addNote(iso);
                              if (e.key === "Escape") { setAddingNoteFor(null); setNoteText(""); }
                            }}
                            placeholder={tr.notePlaceholder}
                            className="min-w-0 flex-1 bg-transparent text-[12px] text-[#16323D] placeholder:text-[#C4B27E] focus:outline-none"
                          />
                          <button
                            onClick={() => addNote(iso)}
                            disabled={!noteText.trim()}
                            className="shrink-0 rounded-md bg-[#B98A2F] px-2.5 py-0.5 text-[10px] font-bold text-white disabled:opacity-40"
                          >
                            OK
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {dayRows.length === 0 ? (
                    (notesOfDay.length === 0 && addingNoteFor !== iso) && (
                      <p className="pt-2 text-[12px] italic text-[#C4B89A]">{tr.emptyDay}</p>
                    )
                  ) : (
                    <>
                      <div className="mb-2 flex items-baseline gap-3 text-[11px] text-[#5C6A6E]">
                        <span>{dayRows.length} {tr.activitiesWord} · {dayHours}h</span>
                        <span className="ml-auto font-mono font-bold text-[#4F8A63]">{dayDone}/{dayRows.length} ✓</span>
                      </div>
                      <div className="space-y-2.5">
                        {dayProjects.map(p => {
                          const pt = dayRows.filter(r => r.project.id === p.id);
                          const stLabel = tp.status[p.status as keyof typeof tp.status] ?? p.status;
                          return (
                            <div key={p.id} className="overflow-hidden rounded-xl border border-[#E6DDCB]">
                              <div className="flex flex-wrap items-center gap-2.5 border-b border-[#E6DDCB] bg-[#F7F3EA] px-3.5 py-2">
                                <span className="font-bookman text-[13.5px] font-semibold text-[#16323D]">{p.title.split(" — ")[0]}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wide ${STATUS_PILL[p.status] ?? "bg-gray-100 text-gray-600"}`}>{stLabel}</span>
                                <span className="text-[10.5px] text-[#5C6A6E]">{p.client}{p.address ? ` · ${p.address}` : ""}</span>
                                <span className="ml-auto font-mono text-[10.5px] text-[#5C6A6E]">
                                  {pt.filter(r => isDone(r.task)).length}/{pt.length} ✓ · {pt.reduce((s, r) => s + (r.task.hours || 0), 0)}h
                                </span>
                              </div>
                              {pt.map(({ task }) => {
                                const done = isDone(task);
                                return (
                                  <div key={task.id} className="flex items-center gap-2.5 border-t border-[#F7F3EA] px-3.5 py-1.5 first:border-t-0">
                                    <input
                                      type="checkbox"
                                      checked={done}
                                      onChange={e => toggleDone(task, e.target.checked)}
                                      className="size-3.5 shrink-0 cursor-pointer accent-[#4F8A63] print:accent-[#4F8A63]"
                                      aria-label={task.name}
                                    />
                                    {task.source_section && (
                                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[8.5px] font-extrabold ${sectionStyle(task.source_section)}`}>
                                        {task.source_section}
                                      </span>
                                    )}
                                    <span className={`min-w-0 flex-1 truncate text-[12px] ${done ? "text-[#97A1A0] line-through" : "font-medium text-[#16323D]"}`}>
                                      {task.name}
                                    </span>
                                    <span className="hidden shrink-0 items-center gap-1.5 text-[10.5px] text-[#5C6A6E] sm:flex">
                                      <span className="grid size-[18px] place-items-center rounded-full bg-[#16323D] text-[7px] font-extrabold text-white">
                                        {initials(assigneeName(task.assigned_contact_id ?? null))}
                                      </span>
                                      {assigneeName(task.assigned_contact_id ?? null)}
                                    </span>
                                    <span className="w-9 shrink-0 text-right font-mono text-[10.5px] text-[#5C6A6E]">{task.hours || 0}h</span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {isSuperAdmin && addingNoteFor !== iso && (
                    <button
                      onClick={() => { setAddingNoteFor(iso); setNoteText(""); }}
                      className="mt-1.5 text-[10.5px] font-bold text-[#B98A2F] transition hover:underline print:hidden"
                    >
                      {tr.addNote}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-7 border-t-2 border-[#16323D] px-7 py-5">
          <div className="text-[9.5px] leading-relaxed text-[#5C6A6E]">
            <span className="text-[10px] font-bold tracking-[0.18em] text-[#16323D]">{branding.companyName.toUpperCase()}</span><br />
            Remodeling & Construction Management · South Florida
          </div>
          <div className="flex gap-8">
            {[tr.preparedBy, tr.supervisor].map(l => (
              <div key={l} className="w-[160px] text-center">
                <div className="mb-1 border-t border-[#5C6A6E]" />
                <span className="text-[9px] uppercase tracking-widest text-[#5C6A6E]">{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
