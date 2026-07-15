"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pin, X, Pencil } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import { initials } from "@/src/lib/utils";
import { logActivity } from "@/src/lib/activity";
import { branding } from "@/src/config/branding";
import QuickPhoto from "@/src/components/ui/QuickPhoto";
import DayNoteModal from "@/src/components/ui/DayNoteModal";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import type { Task } from "@/src/types/project";
import type { AgendaEvent } from "@/src/types/agenda";

type DayNote = Pick<AgendaEvent, "id" | "title" | "event_date" | "event_time" | "done" | "event_type" | "project_id">;
interface ProjLite { id: string; title: string; client: string; address: string | null; status: string }
type Filter = "all" | "pend" | "done";

const STATUS_PILL: Record<string, string> = {
  prospecto:   "bg-[#EFEFEF] text-[#5C5C5C]",
  presupuesto: "bg-[#F5E6C3] text-[#7A6230]",
  aprobado:    "bg-[#EDF3FB] text-[#395886]",
  en_obra:     "bg-[#DCEBDD] text-[#35664A]",
  terminado:   "bg-[#16323D] text-white",
};

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

export default function HoyPage() {
  const { t, language } = useLanguage();
  const { currentUser, isSuperAdmin } = useAuth();
  const th = t.panel.hoy;
  const tr = t.panel.dailyReport;
  const tp = t.panel;
  const EN = language === "en";

  const [date, setDate] = useState(() => toIso(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Map<string, ProjLite>>(new Map());
  const [contactNames, setContactNames] = useState<Map<string, string>>(new Map());
  const [notes, setNotes] = useState<DayNote[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [noteModal, setNoteModal] = useState<
    { mode: "create" | "edit"; id?: string; title?: string; projectId?: string } | null
  >(null);
  const [savingNote, setSavingNote] = useState(false);
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  };

  useEffect(() => {
    supabase.from("contacts").select("id, name").then(({ data }) => {
      if (data) setContactNames(new Map(data.map(c => [c.id as string, c.name as string])));
    });
    supabase.from("projects").select("id, title, client, address, status").then(({ data }) => {
      if (data) setProjects(new Map((data as ProjLite[]).map(p => [p.id, p])));
    });
  }, []);

  const loadDay = useCallback(async (iso: string) => {
    setLoading(true);
    const [taskRes, noteRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, name, hours, status, scheduled_date, source_section, assigned_contact_id, project_id, sort_order")
        .eq("scheduled_date", iso)
        .order("sort_order", { ascending: true }),
      isSuperAdmin
        ? supabase
            .from("agenda_events")
            .select("id, title, event_date, event_time, done, event_type, project_id")
            .eq("event_date", iso)
            .order("event_time", { ascending: true })
        : Promise.resolve({ data: [] as DayNote[] }),
    ]);
    setTasks((taskRes.data as Task[]) ?? []);
    setNotes((noteRes.data as DayNote[]) ?? []);
    setLoading(false);
  }, [isSuperAdmin]);

  useEffect(() => { loadDay(date); }, [date, loadDay]);

  // Co-workers con "solo mis tareas" ven únicamente lo asignado a su contacto
  const myContactId = currentUser?.my_tasks_only ? (currentUser.contact_id ?? null) : null;
  const dayTasks = useMemo(
    () => (myContactId ? tasks.filter(tk => tk.assigned_contact_id === myContactId) : tasks),
    [tasks, myContactId]
  );

  const doneCount = dayTasks.filter(tk => tk.status === "done").length;
  const totalHrs = dayTasks.reduce((s, tk) => s + (tk.hours || 0), 0);
  const doneHrs = dayTasks.filter(tk => tk.status === "done").reduce((s, tk) => s + (tk.hours || 0), 0);
  const pct = dayTasks.length ? Math.round((doneCount / dayTasks.length) * 100) : 0;
  const RING = 2 * Math.PI * 26;

  const d = new Date(date + "T00:00:00");
  const wdLabel = d.toLocaleDateString(EN ? "en-US" : "es-US", { weekday: "long" }).toUpperCase();
  const dLabel = d.toLocaleDateString(EN ? "en-US" : "es-US", { day: "numeric", month: "long" });
  const isToday = date === toIso(new Date());

  const shown = dayTasks.filter(tk =>
    filter === "all" ? true : filter === "done" ? tk.status === "done" : tk.status !== "done"
  );
  const projIds = [...new Set(shown.map(tk => tk.project_id))];

  const toggleTask = async (task: Task) => {
    const done = task.status !== "done";
    setTasks(prev => prev.map(tk => tk.id === task.id ? { ...tk, status: done ? "done" : "pend" } : tk));
    const { error } = await supabase.from("tasks").update({ status: done ? "done" : "pend" }).eq("id", task.id);
    if (error) {
      setTasks(prev => prev.map(tk => tk.id === task.id ? { ...tk, status: task.status } : tk));
      showToast(tr.statusError);
      return;
    }
    if (done) showToast(th.savedToast);
  };

  const toggleNote = async (note: DayNote) => {
    const done = !note.done;
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, done } : n));
    const { error } = await supabase.from("agenda_events").update({ done }).eq("id", note.id);
    if (error) {
      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, done: note.done } : n));
      showToast(tr.statusError);
    }
  };

  const createNote = async (title: string, projectId: string | null) => {
    setSavingNote(true);
    const { data, error } = await supabase
      .from("agenda_events")
      .insert({ event_type: "task", title, event_date: date, project_id: projectId })
      .select("id, title, event_date, event_time, done, event_type, project_id")
      .single();
    setSavingNote(false);
    if (error || !data) { showToast(tr.noteError); return; }
    setNotes(prev => [...prev, data as DayNote]);
    setNoteModal(null);
    logActivity({
      user_id: currentUser?.id, user_name: currentUser?.name, user_role: "superadmin",
      action: "create", entity_type: "agenda_event", entity_id: (data as DayNote).id, entity_name: title,
    });
    showToast(tr.noteSaved);
  };

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from("agenda_events").delete().eq("id", id);
    if (error) { showToast(tr.noteError); return; }
    setNotes(prev => prev.filter(n => n.id !== id));
    showToast(tr.noteDeleted);
  };

  const updateNote = async (id: string, title: string, projectId: string | null) => {
    setSavingNote(true);
    const { error } = await supabase.from("agenda_events").update({ title, project_id: projectId }).eq("id", id);
    setSavingNote(false);
    if (error) { showToast(tr.noteError); return; }
    setNotes(prev => prev.map(n => n.id === id ? { ...n, title, project_id: projectId } : n));
    setNoteModal(null);
    showToast(tr.noteUpdated);
  };

  // Proyectos disponibles para el selector (los activos que ya cargamos)
  const projectSelectOptions = useMemo(
    () => [...projects.values()].map(p => ({ id: p.id, name: p.title.split(" — ")[0] })),
    [projects]
  );

  const filterCounts: Record<Filter, number> = {
    all: dayTasks.length,
    pend: dayTasks.length - doneCount,
    done: doneCount,
  };

  return (
    <div className="mx-auto max-w-[640px] animate-in fade-in duration-300">
      {/* ── Cabecera del día ── */}
      <div className="rounded-3xl bg-[#16323D] px-5 py-5 text-white">
        <div className="text-[9px] font-extrabold tracking-[0.3em] text-[#A8C0BC]">
          {branding.companyName.toUpperCase()}
        </div>
        <div className="mt-2 flex items-center gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold tracking-[0.12em] text-[#A8C0BC]">
              {wdLabel}{isToday ? ` · ${th.todayTag}` : ""}
            </div>
            <div className="font-bookman text-[24px] leading-tight">{dLabel}</div>
          </div>
          <button
            onClick={() => setDate(isoAddDays(date, -1))}
            aria-label={th.prevDay}
            className="grid size-10 place-items-center rounded-xl border border-white/25 text-lg transition active:bg-white/10"
          >‹</button>
          <button
            onClick={() => setDate(toIso(new Date()))}
            className={`h-10 rounded-xl px-3.5 text-[12px] font-bold transition ${isToday ? "bg-white text-[#16323D]" : "bg-white/15 text-white"}`}
          >{th.todayBtn}</button>
          <button
            onClick={() => setDate(isoAddDays(date, 1))}
            aria-label={th.nextDay}
            className="grid size-10 place-items-center rounded-xl border border-white/25 text-lg transition active:bg-white/10"
          >›</button>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div className="relative size-[62px] shrink-0">
            <svg width="62" height="62" viewBox="0 0 62 62" className="-rotate-90">
              <circle cx="31" cy="31" r="26" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="6" />
              <circle
                cx="31" cy="31" r="26" fill="none" stroke="#4F8A63" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={RING} strokeDashoffset={RING * (1 - pct / 100)}
                className="transition-all duration-300"
              />
            </svg>
            <span className="absolute inset-0 grid place-items-center text-[14px] font-extrabold">{pct}%</span>
          </div>
          <div className="text-[12px] leading-relaxed text-[#C4D2CF]">
            <b className="text-[14px] text-white">{doneCount} / {dayTasks.length}</b> {th.completed}
            <br />{doneHrs}h / {totalHrs}h {th.ofDay}
          </div>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="mt-3 flex gap-1.5">
        {([["all", th.filterAll], ["pend", th.filterPend], ["done", th.filterDone]] as [Filter, string][]).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full border px-3.5 py-1.5 text-[11.5px] font-bold transition ${
              filter === k ? "border-[#395886] bg-[#395886] text-white" : "border-[#E6DDCB] bg-white text-[#5C6A6E]"
            }`}
          >
            {l} · {filterCounts[k]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#16323D] border-t-transparent" />
        </div>
      ) : (
        <div className="mt-3 pb-6">
          {/* ── Notas del día (superadmin) ── */}
          {isSuperAdmin && (
            <div className="mb-3 space-y-1.5">
              {notes.map(n => (
                <div key={n.id} className="flex items-center gap-2.5 rounded-2xl border border-[#EAD9AC] bg-[#FBF5E6] px-3.5 py-2.5">
                  <Pin size={13} className="shrink-0 text-[#B98A2F]" />
                  <button
                    onClick={() => toggleNote(n)}
                    aria-label={n.title}
                    className={`grid size-[22px] shrink-0 place-items-center rounded-lg border-2 transition ${
                      n.done ? "border-[#4F8A63] bg-[#4F8A63]" : "border-[#C6BCA6]"
                    }`}
                  >
                    {n.done && <span className="text-[11px] font-bold leading-none text-white">✓</span>}
                  </button>
                  <button
                    onClick={() => setNoteModal({ mode: "edit", id: n.id, title: n.title, projectId: n.project_id ?? "" })}
                    className={`min-w-0 flex-1 text-left text-[13px] ${n.done ? "text-[#97A1A0] line-through" : "font-semibold text-[#7A6230]"}`}
                  >
                    {n.title}
                    {n.project_id && projects.get(n.project_id) && (
                      <span className="ml-1.5 rounded-full bg-[#EAD9AC] px-1.5 py-0.5 text-[9px] font-bold text-[#7A6230]">
                        {projects.get(n.project_id)!.title.split(" — ")[0]}
                      </span>
                    )}
                  </button>
                  <button onClick={() => setNoteModal({ mode: "edit", id: n.id, title: n.title, projectId: n.project_id ?? "" })} aria-label={tr.noteEdit} className="shrink-0 text-[#B98A2F]/60 hover:text-[#B98A2F]">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => deleteNote(n.id)} aria-label={tr.noteDeleted} className="shrink-0 text-[#B0492F]/50 hover:text-[#B0492F]">
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setNoteModal({ mode: "create" })}
                className="w-full rounded-2xl border-2 border-dashed border-[#EAD9AC] px-3.5 py-2.5 text-left text-[12px] font-bold text-[#B98A2F] transition hover:border-[#B98A2F]"
              >
                {tr.addNote}…
              </button>
            </div>
          )}

          {/* ── Tareas por proyecto ── */}
          {shown.length === 0 && (
            <p className="py-10 text-center text-[13px] italic text-[#97A1A0]">
              {dayTasks.length === 0 ? th.emptyDay : filter === "done" ? th.emptyDone : th.emptyPend}
            </p>
          )}
          {projIds.map(pid => {
            const p = projects.get(pid);
            const pt = shown.filter(tk => tk.project_id === pid);
            const pAll = dayTasks.filter(tk => tk.project_id === pid);
            const stLabel = p ? (tp.status[p.status as keyof typeof tp.status] ?? p.status) : "";
            return (
              <div key={pid} className="mb-1">
                <div className="mb-2 mt-4 flex flex-wrap items-center gap-2 px-0.5">
                  <span className="font-bookman text-[15.5px] font-semibold text-[#16323D]">
                    {p?.title.split(" — ")[0] ?? "—"}
                  </span>
                  {p && (
                    <span className={`rounded-full px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wide ${STATUS_PILL[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {stLabel}
                    </span>
                  )}
                  <span className="text-[11px] text-[#97A1A0]">{p?.client}{p?.address ? ` · ${p.address}` : ""}</span>
                  <span className="ml-auto font-mono text-[11px] font-bold text-[#4F8A63]">
                    {pAll.filter(tk => tk.status === "done").length}/{pAll.length} ✓
                  </span>
                  <QuickPhoto
                    projectId={pid}
                    projectTitle={p?.title.split(" — ")[0] ?? ""}
                    toast={showToast}
                  />
                </div>
                <div className="space-y-2">
                  {pt.map(task => {
                    const done = task.status === "done";
                    const who = (task.assigned_contact_id && contactNames.get(task.assigned_contact_id)) || tp.workflow.ownTeam;
                    return (
                      <button
                        key={task.id}
                        onClick={() => toggleTask(task)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-[#E6DDCB] bg-white px-4 py-3 text-left transition active:scale-[0.98]"
                      >
                        <span className={`grid size-[26px] shrink-0 place-items-center rounded-[9px] border-2 transition ${
                          done ? "border-[#4F8A63] bg-[#4F8A63]" : "border-[#C6BCA6]"
                        }`}>
                          {done && <span className="text-[13px] font-bold leading-none text-white">✓</span>}
                        </span>
                        <span className="min-w-0 flex-1">
                          {task.source_section && (
                            <span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[8.5px] font-extrabold ${sectionStyle(task.source_section)}`}>
                              {task.source_section}
                            </span>
                          )}
                          <span className={`block text-[14px] leading-snug ${done ? "text-[#97A1A0] line-through" : "font-semibold text-[#16323D]"}`}>
                            {task.name}
                          </span>
                          <span className="mt-1 flex items-center gap-1.5 text-[11px] text-[#5C6A6E]">
                            <span className="grid size-[17px] place-items-center rounded-full bg-[#16323D] text-[7px] font-extrabold text-white">
                              {initials(who)}
                            </span>
                            {who}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[12px] font-bold text-[#5C6A6E]">{task.hours || 0}h</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {noteModal && (
        <DayNoteModal
          mode={noteModal.mode}
          initialTitle={noteModal.title}
          initialProjectId={noteModal.projectId}
          contextLabel={date === toIso(new Date()) ? th.todayBtn : date}
          projects={projectSelectOptions.map(p => ({ id: p.id, title: p.name }))}
          saving={savingNote}
          onCancel={() => setNoteModal(null)}
          onSave={({ title, projectId }) =>
            noteModal.mode === "edit" && noteModal.id
              ? updateNote(noteModal.id, title, projectId)
              : createNote(title, projectId)
          }
        />
      )}

      <div className={`fixed bottom-24 left-1/2 z-[200] w-full max-w-xs -translate-x-1/2 rounded-2xl bg-[#16323D] px-4 py-3 text-center text-sm font-medium text-white shadow-2xl transition-all duration-300 ${toastVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}>
        {toast}
      </div>
    </div>
  );
}
