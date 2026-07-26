"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Target, StickyNote, Check, ListChecks, LayoutGrid, List } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import { useLanguage } from "@/src/context/LanguageContext";
import { getPendientesReportBlob, type ReportGroup } from "@/src/lib/pdf";
import PdfPreviewModal from "@/src/components/ui/PdfPreviewModal";

type Proj = { id: string; title: string; client?: string | null; status?: string };
const STATUSES = ["prospecto", "presupuesto", "aprobado", "en_obra", "terminado"] as const;

// Constructor del reporte de pendientes: elige proyectos (checkbox o por estado) + qué
// incluir (objetivos/tareas/notas), preview en vivo y vista previa de PDF imprimible.
export default function ReportBuilder({ projects }: { projects: Proj[] }) {
  const { t, language } = useLanguage();
  const tr = t.panel.report;
  const st = t.panel.status;

  const [selected, setSelected] = useState<Set<string>>(() => new Set(projects.map(p => p.id)));
  const [incObjectives, setIncObjectives] = useState(true);
  const [incTasks, setIncTasks] = useState(true);
  const [incNotes, setIncNotes] = useState(true);
  const [pendingOnly, setPendingOnly] = useState(true);
  const [groupByProject, setGroupByProject] = useState(true);
  const [notesRange, setNotesRange] = useState<"all" | "30" | "90">("all");
  const [loading, setLoading] = useState(false);
  const [objByProj, setObjByProj] = useState<Record<string, { text: string; done: boolean }[]>>({});
  const [tasksByProj, setTasksByProj] = useState<Record<string, { name: string; date?: string }[]>>({});
  const [notesByProj, setNotesByProj] = useState<Record<string, { content: string; date: string }[]>>({});
  const [pdf, setPdf] = useState<{ blob: Blob; filename: string } | null>(null);

  const selIds = useMemo(() => [...selected], [selected]);

  useEffect(() => {
    if (!selIds.length) { setObjByProj({}); setTasksByProj({}); setNotesByProj({}); return; }
    let alive = true;
    setLoading(true);
    (async () => {
      const [{ data: objs }, { data: tasks }, { data: notes }] = await Promise.all([
        supabase.from("project_objectives").select("project_id, text, done").in("project_id", selIds).order("sort_order", { ascending: true }),
        supabase.from("tasks").select("project_id, name, scheduled_date, status").in("project_id", selIds).neq("status", "done").order("scheduled_date", { ascending: true }),
        supabase.from("project_notes").select("project_id, content, created_at").in("project_id", selIds).order("created_at", { ascending: false }),
      ]);
      if (!alive) return;
      const om: Record<string, { text: string; done: boolean }[]> = {};
      (objs ?? []).forEach((o) => { (om[o.project_id as string] ||= []).push({ text: o.text as string, done: !!o.done }); });
      const tm: Record<string, { name: string; date?: string }[]> = {};
      (tasks ?? []).forEach((t) => { (tm[t.project_id as string] ||= []).push({ name: (t.name as string) || "", date: (t.scheduled_date as string) ?? undefined }); });
      const nm: Record<string, { content: string; date: string }[]> = {};
      (notes ?? []).forEach((n) => { (nm[n.project_id as string] ||= []).push({ content: (n.content as string) || "", date: (n.created_at as string)?.slice(0, 10) ?? "" }); });
      setObjByProj(om); setTasksByProj(tm); setNotesByProj(nm); setLoading(false);
    })();
    return () => { alive = false; };
  }, [selIds]);

  const toggle = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOn = selected.size === projects.length;
  const selectByStatus = (status: string) => setSelected(new Set(projects.filter(p => p.status === status).map(p => p.id)));

  const cutoff = useMemo(() => {
    if (notesRange === "all") return "";
    const d = new Date(); d.setDate(d.getDate() - (notesRange === "30" ? 30 : 90));
    return d.toISOString().slice(0, 10);
  }, [notesRange]);

  const groups: ReportGroup[] = useMemo(() =>
    projects.filter(p => selected.has(p.id)).map(p => ({
      title: p.title,
      client: p.client ?? undefined,
      objectives: objByProj[p.id] ?? [],
      tasks: tasksByProj[p.id] ?? [],
      notes: (notesByProj[p.id] ?? []).filter(n => !cutoff || n.date >= cutoff),
    })), [projects, selected, objByProj, tasksByProj, notesByProj, cutoff]);

  const opts = { includeObjectives: incObjectives, includeTasks: incTasks, includeNotes: incNotes, pendingOnly, groupByProject };
  const openPdf = () => setPdf(getPendientesReportBlob(groups, opts, language));

  const chip = (on: boolean, onClick: () => void, icon: React.ReactNode, label: string) => (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-bold transition ${on ? "border-[var(--accent)] bg-[#EDF3FB] dark:bg-[#17233d] text-[var(--accent)]" : "border-[#E6DDCB] dark:border-[#22304d] text-[#97A1A0] dark:text-[#728098]"}`}>
      {icon} {label}
    </button>
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Selección */}
      <div className="lg:col-span-4 space-y-3">
        {/* Chips de estado (selección rápida) */}
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#97A1A0] dark:text-[#728098]">{tr.byStatus}</div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setSelected(new Set(projects.map(p => p.id)))} className="rounded-full border border-[#E6DDCB] dark:border-[#22304d] px-2.5 py-1 text-[11px] font-bold text-[var(--brand)] dark:text-[#e8edf7] hover:border-[var(--accent)]">{tr.all}</button>
            {STATUSES.map(s => {
              const count = projects.filter(p => p.status === s).length;
              if (!count) return null;
              return (
                <button key={s} onClick={() => selectByStatus(s)} className="rounded-full border border-[#E6DDCB] dark:border-[#22304d] px-2.5 py-1 text-[11px] font-bold text-[#5C6A6E] dark:text-[#9fb0cc] hover:border-[var(--accent)] hover:text-[var(--accent)]">
                  {st[s as keyof typeof st] ?? s} <span className="text-[9px] opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista de proyectos */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#97A1A0] dark:text-[#728098]">{tr.selectProjects} · {selected.size}</span>
            <button onClick={() => setSelected(allOn ? new Set() : new Set(projects.map(p => p.id)))} className="text-[11px] font-bold text-[var(--accent)]">{allOn ? tr.none : tr.all}</button>
          </div>
          <div className="max-h-[34vh] space-y-1 overflow-y-auto rounded-xl border border-[#E6DDCB] dark:border-[#22304d] p-1.5">
            {projects.map(p => {
              const on = selected.has(p.id);
              return (
                <button key={p.id} onClick={() => toggle(p.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]">
                  <span className={`grid size-[18px] shrink-0 place-items-center rounded-md border-2 ${on ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[#C6BCA6]"}`}>{on && <Check size={11} className="text-white" strokeWidth={3.5} />}</span>
                  <span className="truncate text-[13px] font-semibold text-[var(--brand)] dark:text-[#e8edf7]">{p.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Qué incluir */}
        <div className="flex flex-wrap gap-2">
          {chip(incObjectives, () => setIncObjectives(v => !v), <Target size={13} />, tr.objectives)}
          {chip(incTasks, () => setIncTasks(v => !v), <ListChecks size={13} />, tr.tasks)}
          {chip(incNotes, () => setIncNotes(v => !v), <StickyNote size={13} />, tr.notes)}
          {incObjectives && chip(pendingOnly, () => setPendingOnly(v => !v), <Check size={13} />, tr.pendingOnly)}
        </div>

        {/* Rango de notas + modo de vista */}
        <div className="flex flex-wrap items-center gap-2">
          {incNotes && (
            <div className="inline-flex rounded-lg border border-[#E6DDCB] dark:border-[#22304d] p-0.5 text-[11px] font-bold">
              {(["all", "30", "90"] as const).map(r => (
                <button key={r} onClick={() => setNotesRange(r)} className={`rounded-md px-2 py-1 ${notesRange === r ? "bg-[var(--accent)] text-white" : "text-[#5C6A6E] dark:text-[#9fb0cc]"}`}>
                  {r === "all" ? tr.notesAll : r === "30" ? tr.notes30 : tr.notes90}
                </button>
              ))}
            </div>
          )}
          <div className="inline-flex rounded-lg border border-[#E6DDCB] dark:border-[#22304d] p-0.5 text-[11px] font-bold">
            <button onClick={() => setGroupByProject(true)} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${groupByProject ? "bg-[var(--accent)] text-white" : "text-[#5C6A6E] dark:text-[#9fb0cc]"}`}><LayoutGrid size={12} /> {tr.byProject}</button>
            <button onClick={() => setGroupByProject(false)} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${!groupByProject ? "bg-[var(--accent)] text-white" : "text-[#5C6A6E] dark:text-[#9fb0cc]"}`}><List size={12} /> {tr.singleList}</button>
          </div>
        </div>

        <button onClick={openPdf} disabled={!selected.size || (!incObjectives && !incTasks && !incNotes)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] py-3 text-[14px] font-bold text-white transition hover:bg-[#0F2830] disabled:opacity-40">
          <FileText size={16} /> {tr.viewPdf}
        </button>
      </div>

      {/* Preview */}
      <div className="lg:col-span-8">
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#97A1A0] dark:text-[#728098]">{tr.preview}</div>
        <div className="max-h-[62vh] space-y-4 overflow-y-auto rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#FDFAF6] dark:bg-[#0b1220] p-4">
          {loading && <p className="py-8 text-center text-[13px] text-[#97A1A0] dark:text-[#728098]">…</p>}
          {!loading && !groups.length && <p className="py-8 text-center text-[13px] italic text-[#97A1A0] dark:text-[#728098]">{tr.nothingSelected}</p>}
          {!loading && groups.map((g, gi) => {
            const objs = pendingOnly ? g.objectives.filter(o => !o.done) : g.objectives;
            return (
              <div key={gi} className="rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-3">
                <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-[#F0EBE0] dark:border-[#22304d] pb-1.5">
                  <span className="font-heading text-[14px] font-bold text-[var(--brand)] dark:text-[#e8edf7]">{g.title}</span>
                  {g.client && <span className="shrink-0 text-[11px] text-[#97A1A0] dark:text-[#728098]">{g.client}</span>}
                </div>
                {incObjectives && (
                  <div className="mb-2">
                    <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-[var(--accent)]">{tr.objectives}</div>
                    {objs.length === 0 ? <p className="text-[12px] italic text-[#97A1A0] dark:text-[#728098]">—</p> : (
                      <div className="space-y-1">{objs.map((o, i) => (
                        <div key={i} className="flex items-start gap-2 text-[13px]">
                          <span className={`mt-0.5 grid size-[15px] shrink-0 place-items-center rounded border-2 ${o.done ? "border-[#4F8A63] bg-[#4F8A63]" : "border-[#B0492F]"}`}>{o.done && <Check size={9} className="text-white" strokeWidth={4} />}</span>
                          <span className={o.done ? "text-[#97A1A0] line-through dark:text-[#728098]" : "text-[var(--brand)] dark:text-[#e8edf7]"}>{o.text}</span>
                        </div>
                      ))}</div>
                    )}
                  </div>
                )}
                {incTasks && (
                  <div className="mb-2">
                    <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-[var(--accent)]">{tr.tasks}</div>
                    {g.tasks.length === 0 ? <p className="text-[12px] italic text-[#97A1A0] dark:text-[#728098]">—</p> : (
                      <div className="space-y-1">{g.tasks.map((tk, i) => (
                        <div key={i} className="flex items-start gap-2 text-[13px]">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#E08A2A]" />
                          <span className="flex-1 text-[var(--brand)] dark:text-[#e8edf7]">{tk.name}</span>
                          {tk.date && <span className="shrink-0 font-mono text-[10px] text-[#97A1A0] dark:text-[#728098]">{tk.date}</span>}
                        </div>
                      ))}</div>
                    )}
                  </div>
                )}
                {incNotes && (
                  <div>
                    <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-[var(--accent)]">{tr.notes}</div>
                    {g.notes.length === 0 ? <p className="text-[12px] italic text-[#97A1A0] dark:text-[#728098]">—</p> : (
                      <div className="space-y-1">{g.notes.map((n, i) => (
                        <div key={i} className="flex items-start gap-2 text-[13px]">
                          <span className="mt-0.5 shrink-0 font-mono text-[10px] font-bold text-[#B98A2F]">{n.date}</span>
                          <span className="text-[var(--brand)] dark:text-[#e8edf7]">{n.content}</span>
                        </div>
                      ))}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {pdf && <PdfPreviewModal blob={pdf.blob} filename={pdf.filename} title={tr.title} onClose={() => setPdf(null)} />}
    </div>
  );
}
