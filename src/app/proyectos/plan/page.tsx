"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { GripVertical, ChevronRight, Trash2, Printer } from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/src/lib/supabase";
import { addDays, dShort } from "@/src/lib/utils";
import ProjectThumb from "@/src/components/ui/ProjectThumb";
import DailyReport from "@/src/components/ui/DailyReport";
import {
  buildGanttScale, ganttX, laneBg, isoOfDate, todayIsoLocal, GanttHeader, TodayLine,
} from "@/src/components/ui/GanttCalendar";
import { branding } from "@/src/config/branding";
import type { Project, Task } from "@/src/types/project";
import { useLanguage } from "@/src/context/LanguageContext";

interface ProjectWithTasks extends Project { tasks: Task[] }

const LEFT = 520; // ancho total de las columnas de la izquierda (px) — alinea header y filas
const LEFT_COLS = "24px 30px 172px 78px 84px 34px 98px";

const totalWeeks = (tasks: Task[]) => Math.max(1, tasks.reduce((s, t) => s + (t.duration_weeks || 0), 0));
const donePct = (tasks: Task[]) => tasks.length ? Math.round(tasks.filter(t => t.status === "done").length / tasks.length * 100) : 0;

// Barra de duración por estado (colores de la app)
const BAR_BASE: Record<string, string> = {
  prospecto:   "bg-[#D9DFE6]", presupuesto: "bg-[#D7CBB3]", aprobado: "bg-[#9DB6BC]",
  en_obra:     "bg-[#7FA0A8]", terminado:   "bg-[#8FBE9F]",
};
const STATUS_PILL: Record<string, string> = {
  prospecto:   "bg-[#E3E8EE] text-[#44586B]", presupuesto: "bg-[#DCE6E6] text-[#0E2630]",
  aprobado:    "bg-[#DCE8E9] text-[#4E7A82]", en_obra:     "bg-[#EDE3CF] text-[#7A6230]",
  terminado:   "bg-[#DCEBDD] text-[#4F8A63]",
};
const TASK_PILL: Record<string, string> = {
  pend: "bg-[#E3E8EE] text-[#44586B]", prog: "bg-[#F5E6C3] text-[#7A6230]", done: "bg-[#DCEBDD] text-[#4F8A63]",
};

function DragHandle({ listeners, attributes }: { listeners?: object; attributes?: object }) {
  return (
    <button type="button" tabIndex={-1} aria-label="Arrastra para reordenar"
      className="flex h-full cursor-grab touch-none items-center justify-center text-[#C4B89A] transition hover:text-[var(--brand)] active:cursor-grabbing"
      {...(listeners ?? {})} {...(attributes ?? {})}>
      <GripVertical size={15} />
    </button>
  );
}

function SortableRow({ id, children }: {
  id: string;
  children: (h: { listeners?: object; attributes?: object }, dragging: boolean) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined, opacity: isDragging ? 0.6 : 1 }}>
      {children({ listeners, attributes }, isDragging)}
    </div>
  );
}

function ConfirmModal({ title, body, label, onConfirm, onCancel }: { title: string; body: string; label: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#16323D]/55 backdrop-blur-sm">
      <div className="w-full max-w-[420px] rounded-[20px] bg-[#F7F3EA] p-6 shadow-2xl">
        <h3 className="mb-2 text-lg font-bold text-[var(--brand)]">{title}</h3>
        <p className="mb-5 text-sm text-[#5C6A6E]">{body}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-xl bg-[#ECE3D1] py-3 font-bold text-[#5C6A6E]">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 rounded-xl bg-[#B0492F] py-3 font-bold text-white">{label}</button>
        </div>
      </div>
    </div>
  );
}

const dropAnimation = { sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.5" } } }) };

export default function PlanPage() {
  const [projects, setProjects] = useState<ProjectWithTasks[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [openIds, setOpenIds]   = useState<Set<string>>(new Set());
  const [toast, setToast]       = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "prospecto" | "presupuesto" | "aprobado" | "en_obra" | "terminado">("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [ganttUnit, setGanttUnit] = useState<"week" | "day">("day");
  const [view, setView] = useState<"gantt" | "report">("gantt");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t, language } = useLanguage();
  const tp = t.panel;
  const EN = language === "en";
  const gp = tp.globalPlan;

  const showToast = (msg: string) => { setToast(msg); setToastVisible(true); setTimeout(() => setToastVisible(false), 3000); };

  const fetchProjects = useCallback(async () => {
    const { data } = await supabase.from("projects").select("*, tasks(*)").order("start_date", { ascending: true });
    if (data) {
      const rows = data as ProjectWithTasks[];
      // Orden por prioridad manual (priority_rank) si existe; si no, por fecha de inicio
      rows.sort((a, b) => {
        const ra = a.priority_rank, rb = b.priority_rank;
        if (ra != null && rb != null) return ra - rb;
        if (ra != null) return -1;
        if (rb != null) return 1;
        return (a.start_date ?? "").localeCompare(b.start_date ?? "");
      });
      setProjects(rows);
    }
    setLoading(false);
  }, []);
  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Solo proyectos con tareas aparecen en el Gantt
  const ganttProjects = projects.filter(p => p.tasks.length > 0);

  const visibleProjects = ganttProjects
    .filter(p => filterStatus === "all" || p.status === filterStatus)
    .filter(p => filterProject === "all" || p.id === filterProject);

  // Rango temporal — con tareas fechadas la barra va de la primera a la última fecha real;
  // el fallback por semanas (Σ duration_weeks) queda solo para proyectos sin fechas programadas
  const spans = visibleProjects.map((p) => {
    const dates = p.tasks
      .filter(tk => tk.scheduled_date)
      .map(tk => tk.scheduled_date as string)
      .sort();
    let start: Date;
    let end: Date;
    if (dates.length > 0) {
      const firstIso = p.start_date && p.start_date < dates[0] ? p.start_date : dates[0];
      start = new Date(firstIso + "T00:00:00");
      end = addDays(dates[dates.length - 1], 1);
    } else {
      const baseIso = p.start_date ?? todayIsoLocal();
      start = new Date(baseIso + "T00:00:00");
      end = addDays(baseIso, totalWeeks(p.tasks) * 7);
    }
    if (p.end_date) {
      const e = addDays(p.end_date, 1);
      if (e > end) end = e;
    }
    return { p, start, end };
  });
  let minDate = spans[0]?.start ?? new Date();
  let maxDate = spans[0]?.end   ?? new Date();
  spans.forEach(({ start, end }) => { if (start < minDate) minDate = start; if (end > maxDate) maxDate = end; });
  const scale = buildGanttScale(isoOfDate(minDate), isoOfDate(maxDate), ganttUnit);

  // Al montar o cambiar de escala, enfocar el scroll cerca de hoy
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = Math.max(0, ganttX(scale, todayIsoLocal()) - 260);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ganttUnit, view, loading]);

  const activeProject = activeId ? projects.find((p) => p.id === activeId) : null;
  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = projects.findIndex((p) => p.id === active.id);
    const newIdx = projects.findIndex((p) => p.id === over.id);
    const next = arrayMove(projects, oldIdx, newIdx);
    setProjects(next);
    // Persistir el nuevo ranking (fire-and-forget; requiere columna priority_rank)
    next.forEach((p, i) => { supabase.from("projects").update({ priority_rank: i + 1 }).eq("id", p.id).then(() => {}); });
    showToast(gp.priorityUpdated);
  };

  const deleteProject = async (id: string) => {
    await supabase.from("projects").delete().eq("id", id);
    setConfirmDel(null);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    showToast(gp.deleted);
  };

  const toggleRow = (id: string) => setOpenIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setOpenIds(prev => prev.size ? new Set() : new Set(projects.map(p => p.id)));

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" /></div>;
  }

  const STATUS_PILL_ACTIVE: Record<string, string> = {
    prospecto:   "bg-[#E3E8EE] text-[#44586B]", presupuesto: "bg-[#DCE6E6] text-[#0E2630]",
    aprobado:    "bg-[#DCE8E9] text-[#4E7A82]", en_obra:     "bg-[#EDE3CF] text-[#7A6230]",
    terminado:   "bg-[#DCEBDD] text-[#4F8A63]",
  };

  const DarkBar = ({ withControls }: { withControls: boolean }) => (
    <div className={`mb-4 flex items-center gap-3 rounded-2xl bg-[var(--brand)] px-5 py-3 ${view === "report" ? "print:hidden" : ""}`}>
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden text-[9px] font-bold uppercase tracking-widest text-white/35 sm:block">{branding.companyName}</span>
        <span className="hidden text-white/20 sm:block">·</span>
        <h1 className="font-bookman text-[17px] font-semibold text-white">{gp.title}</h1>
        <span className="rounded-full bg-white/15 px-2 py-0.5 font-mono text-[10px] text-white/70">{projects.length}</span>
      </div>
      {withControls && (
        <>
          <div className="h-5 w-px shrink-0 rounded-full bg-white/15" />
          <div className="flex shrink-0 items-center gap-1">
            {(["gantt", "report"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`rounded-full px-3 py-1 text-[10.5px] font-bold transition ${view === v ? "bg-white text-[var(--brand)]" : "border border-white/20 text-white/60 hover:bg-white/10 hover:text-white"}`}>
                {v === "gantt" ? tp.dailyReport.viewGantt : tp.dailyReport.viewReport}
              </button>
            ))}
          </div>
        </>
      )}
      {withControls && view === "gantt" && (<>
        <div className="h-5 w-px shrink-0 rounded-full bg-white/15" />
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <button onClick={() => { setFilterStatus("all"); setFilterProject("all"); }}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-bold transition ${filterStatus === "all" ? "bg-white text-[var(--brand)]" : "border border-white/20 text-white/60 hover:bg-white/10 hover:text-white"}`}>
            {gp.tabAll}
            <span className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] ${filterStatus === "all" ? "bg-black/10" : "bg-white/10"}`}>{ganttProjects.length}</span>
          </button>
          {(["prospecto", "presupuesto", "aprobado", "en_obra", "terminado"] as const).map(s => {
            const count = ganttProjects.filter(p => p.status === s).length;
            if (count === 0) return null;
            const isActive = filterStatus === s;
            return (
              <button key={s} onClick={() => { setFilterStatus(s); setFilterProject("all"); }}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-bold transition ${isActive ? STATUS_PILL_ACTIVE[s] : "border border-white/20 text-white/60 hover:bg-white/10 hover:text-white"}`}>
                <span className="size-1.5 rounded-full bg-current" />{tp.status[s]}
                <span className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] ${isActive ? "bg-black/10" : "bg-white/10"}`}>{count}</span>
              </button>
            );
          })}
          <select
            value={filterProject}
            onChange={e => setFilterProject(e.target.value)}
            aria-label={gp.colProject}
            className={`max-w-[190px] shrink-0 cursor-pointer rounded-full border px-3 py-1 text-[10.5px] font-bold outline-none transition ${
              filterProject === "all" ? "border-white/20 bg-transparent text-white/60 hover:bg-white/10" : "border-white bg-white text-[var(--brand)]"
            } [&>option]:bg-white [&>option]:text-[var(--brand)]`}
          >
            <option value="all">{EN ? "All projects" : "Todos los proyectos"}</option>
            {ganttProjects
              .filter(p => filterStatus === "all" || p.status === filterStatus)
              .map(p => (
                <option key={p.id} value={p.id}>{p.title.split(" — ")[0]}</option>
              ))}
          </select>
        </div>
        <div className="h-5 w-px shrink-0 rounded-full bg-white/15" />
        <button onClick={toggleAll} title={gp.expandAll} className="shrink-0 rounded-full border border-white/20 px-3 py-1 text-[10.5px] font-bold text-white/70 transition hover:bg-white/10 hover:text-white">⇕</button>
        <div className="flex shrink-0 items-center gap-1">
          {(["week", "day"] as const).map(u => (
            <button key={u} onClick={() => setGanttUnit(u)}
              className={`rounded-full px-3 py-1 text-[10.5px] font-bold transition ${ganttUnit === u ? "bg-white text-[var(--brand)]" : "border border-white/20 text-white/60 hover:bg-white/10 hover:text-white"}`}>
              {u === "week" ? (EN ? "Weeks" : "Semanas") : (EN ? "Days" : "Días")}
            </button>
          ))}
        </div>
        <button onClick={() => window.print()} title={gp.printPdf} className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[10.5px] font-bold text-[var(--brand)]">
          <Printer size={12} /> {gp.printPdf}
        </button>
      </>)}
    </div>
  );

  if (projects.length === 0) {
    return <div><DarkBar withControls={false} /><div className="rounded-2xl border border-[#E6DDCB] bg-white p-10 text-center text-sm text-[#5C6A6E]">{gp.noProjects}</div></div>;
  }

  // Cronológico ascendente dentro de cada estado; sin fecha al final
  const stTasks = (p: ProjectWithTasks, st: "pend"|"prog"|"done") =>
    p.tasks
      .filter(tk => tk.status === st)
      .sort((a, b) => {
        const da = a.scheduled_date ?? "9999-12-31";
        const db = b.scheduled_date ?? "9999-12-31";
        return da !== db ? da.localeCompare(db) : a.sort_order - b.sort_order;
      });

  return (
    <div className="animate-in fade-in duration-300">
      <DarkBar withControls />

      {view === "report" && (
        <DailyReport projects={projects} toast={showToast} onRefresh={fetchProjects} />
      )}

      {view === "gantt" && (<>
      <div className="rpt-only mb-3 hidden">
        <h2 className="text-lg font-bold text-[var(--brand)]">{gp.reportTitle}</h2>
        <p className="text-xs text-[#5C6A6E]">{gp.generatedOn} {new Date().toLocaleDateString(EN ? "en-US" : "es-US", { day: "numeric", month: "long", year: "numeric" })}</p>
      </div>

      {visibleProjects.length === 0 ? (
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-10 text-center text-sm text-[#5C6A6E]">
          {EN ? "No projects with scheduled tasks for this filter." : "No hay proyectos con tareas creadas para este filtro."}
        </div>
      ) : (
      <div ref={scrollRef} className="overflow-x-auto rounded-2xl border border-[#E6DDCB] bg-white [scrollbar-width:thin]">
        <div className="w-max min-w-full">
          <GanttHeader
            scale={scale}
            EN={EN}
            leftWidth={LEFT}
            leftHeader={
              <div className="grid h-full items-center border-r border-white/10 text-[9px] font-bold uppercase tracking-wider text-white/70" style={{ gridTemplateColumns: LEFT_COLS }}>
                <span />
                <span className="px-1 text-center">{gp.colPrio}</span>
                <span className="px-2">{gp.colProject}</span>
                <span className="px-2">{gp.colClient}</span>
                <span className="px-2">{gp.colLocation}</span>
                <span className="px-1 text-center">{gp.colDays}</span>
                <span className="px-2">{gp.colStatus}</span>
              </div>
            }
          />

          {/* Filas */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <SortableContext items={visibleProjects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              {visibleProjects.map((p, idx) => {
                const sp = spans.find((s) => s.p.id === p.id);
                const barLeft  = sp ? ganttX(scale, isoOfDate(sp.start)) : 0;
                const barWidth = sp ? Math.max(ganttX(scale, isoOfDate(sp.end)) - barLeft, 10) : 10;
                const pc = donePct(p.tasks);
                const days = sp ? Math.max(1, Math.round((sp.end.getTime() - sp.start.getTime()) / 86400000)) : 0;
                const rank = p.priority_rank ?? (idx + 1);
                const isOpen = openIds.has(p.id);
                const statusLabel = tp.status[p.status as keyof typeof tp.status] ?? p.status;

                return (
                  <SortableRow key={p.id} id={p.id}>
                    {({ listeners, attributes }, isDragging) => (
                      <div className={`border-b border-[#F0EBE0] ${isDragging ? "bg-white shadow-lg ring-1 ring-[var(--brand)]" : ""}`} style={{ width: LEFT + scale.laneWidth }}>
                        <div className="flex items-stretch">
                          <div className="sticky left-0 z-10 grid shrink-0 items-center border-r border-[#E6DDCB] bg-white" style={{ width: LEFT, gridTemplateColumns: LEFT_COLS }}>
                            <DragHandle listeners={listeners} attributes={attributes} />

                            <div className="flex h-full items-center justify-center bg-[#F2EFE7] font-mono text-[13px] font-bold text-[var(--brand)]">{rank}</div>

                            {/* Proyecto (clic = acordeón) */}
                            <button onClick={() => toggleRow(p.id)} className="group flex h-full items-center gap-2 px-2 py-2 text-left hover:bg-[#F7F3EA]">
                              <ChevronRight size={13} className={`shrink-0 text-[#97A1A0] transition ${isOpen ? "rotate-90" : ""}`} />
                              <ProjectThumb photoUrl={p.photo_url} title={p.title} size={30} rounded="rounded-md" />
                              <span className="truncate text-[12.5px] font-semibold text-[var(--brand)] group-hover:text-[var(--accent)]">{p.title.split(" — ")[0]}</span>
                            </button>

                            <Link href={`/proyectos/${p.id}`} className="truncate px-2 text-[11.5px] text-[#5C6A6E] hover:text-[var(--accent)]">{p.client}</Link>
                            <span className="truncate px-2 text-[11.5px] text-[#5C6A6E]">{p.address || "—"}</span>
                            <span className="px-1 text-center font-mono text-[11.5px] font-bold text-[#5C6A6E]">{days}</span>

                            <div className="flex flex-col gap-1 px-2 py-1.5">
                              <span className={`w-fit rounded-full px-2 py-0.5 text-[9px] font-bold ${STATUS_PILL[p.status] ?? "bg-gray-100 text-gray-600"}`}>{statusLabel}</span>
                              <span className="flex items-center gap-1.5">
                                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F0EBE0]"><span className="block h-full rounded-full bg-[#4F8A63]" style={{ width: `${pc}%` }} /></span>
                                <span className="font-mono text-[9px] font-bold text-[#5C6A6E]">{pc}%</span>
                              </span>
                            </div>
                          </div>

                          {/* Carril calendario — una celda por día, sáb/dom coloreados */}
                          <button
                            onClick={() => toggleRow(p.id)}
                            className="relative min-h-[46px] shrink-0"
                            style={{ width: scale.laneWidth, ...laneBg(scale) }}
                            aria-label={p.title}
                          >
                            <TodayLine scale={scale} />
                            <span className={`absolute top-1/2 flex h-[15px] -translate-y-1/2 items-center overflow-hidden rounded-[5px] shadow-sm ${BAR_BASE[p.status] ?? "bg-[#D7CBB3]"}`}
                              style={{ left: barLeft, width: barWidth }}>
                              <span className="h-full rounded-l-[5px] bg-[#4F8A63]/85" style={{ width: `${pc}%` }} />
                            </span>
                          </button>
                        </div>

                        {/* Acordeón: actividades por estado (sticky para que se lea aunque hagas scroll horizontal) */}
                        {isOpen && (
                          <div className="sticky left-0 max-w-[900px] bg-[#FBF8F2] px-4 py-3" style={{ paddingLeft: 54 }}>
                            <div className="mb-2 flex items-center gap-3 text-[11px] text-[#5C6A6E]">
                              <span className="font-mono">{dShort(sp!.start)}–{dShort(sp!.end)}</span>
                              <span>· {p.tasks.length} {gp.activities}</span>
                              <button onClick={() => setConfirmDel(p.id)} className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-[#B0492F] hover:underline"><Trash2 size={11} /> {gp.delete}</button>
                            </div>
                            {p.tasks.length === 0 ? (
                              <p className="text-[12px] italic text-[#97A1A0]">{gp.noTasks}</p>
                            ) : (["pend", "prog", "done"] as const).map(st => {
                              const list = stTasks(p, st);
                              if (!list.length) return null;
                              const stLabel = st === "pend" ? tp.workflow.colPend : st === "prog" ? tp.workflow.colProg : tp.workflow.colDone;
                              return (
                                <div key={st} className="mt-2">
                                  <h4 className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E]">
                                    <span className={`rounded-full px-2 py-0.5 ${TASK_PILL[st]}`}>{stLabel}</span>
                                    <span className="rounded-full border border-[#E6DDCB] bg-white px-1.5 text-[10px]">{list.length}</span>
                                  </h4>
                                  <div className="space-y-1">
                                    {list.map(tk => (
                                      <div key={tk.id} className="flex items-center gap-2 rounded-lg border border-[#E6DDCB] bg-white px-3 py-1.5 text-[12px]">
                                        <span className="flex-1 truncate font-semibold text-[var(--brand)]">{tk.name}</span>
                                        <span className="hidden truncate text-[10.5px] text-[#5C6A6E] sm:inline">
                                          {tk.source_section ? tk.source_section + " · " : ""}{tk.hours ? tk.hours + "h" : ""}{tk.scheduled_date ? " · " + dShort(new Date(tk.scheduled_date + "T00:00:00")) : ""}
                                        </span>
                                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${TASK_PILL[st]}`}>{stLabel}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </SortableRow>
                );
              })}
            </SortableContext>

            <DragOverlay dropAnimation={dropAnimation}>
              {activeProject && (
                <div className="rounded-xl border border-[var(--brand)] bg-white px-4 py-3 shadow-2xl ring-1 ring-[var(--brand)]">
                  <div className="text-sm font-semibold text-[var(--brand)]">{activeProject.title.split(" — ")[0]}</div>
                  <div className="font-mono text-[11px] text-[#5C6A6E]">{activeProject.client}</div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
      )}

      <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-[#5C6A6E]">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-4 rounded bg-[#7FA0A8]" /> {gp.colDays}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-4 rounded bg-[#4F8A63]" /> {EN ? "Progress" : "Avance"}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-4 rounded border border-[#9DC3E6] bg-[#DCEBF7]" /> {EN ? "Saturday" : "Sábado"}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-4 rounded border border-[#F4B183] bg-[#FBE5D3]" /> {EN ? "Sunday" : "Domingo"}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-[2px] bg-[#B0492F]/70" /> {EN ? "Today" : "Hoy"}</span>
        <span className="inline-flex items-center gap-1.5"><span className="rounded-full bg-[#E3E8EE] px-2 py-0.5 text-[9px] font-bold text-[#44586B]">{tp.workflow.colPend}</span></span>
        <span className="inline-flex items-center gap-1.5"><span className="rounded-full bg-[#F5E6C3] px-2 py-0.5 text-[9px] font-bold text-[#7A6230]">{tp.workflow.colProg}</span></span>
        <span className="inline-flex items-center gap-1.5"><span className="rounded-full bg-[#DCEBDD] px-2 py-0.5 text-[9px] font-bold text-[#4F8A63]">{tp.workflow.colDone}</span></span>
        <span className="text-[#97A1A0]">· {EN ? "Drag rows to set priority" : "Arrastra las filas para fijar la prioridad"}</span>
      </div>
      </>)}

      {confirmDel && (
        <ConfirmModal title={gp.deleteProject}
          body={`"${projects.find((p) => p.id === confirmDel)?.title}" ${gp.deleteBody}`}
          label={gp.delete} onConfirm={() => deleteProject(confirmDel)} onCancel={() => setConfirmDel(null)} />
      )}

      <div className={`fixed bottom-24 left-1/2 z-[200] w-full max-w-sm -translate-x-1/2 rounded-2xl bg-[var(--brand)] px-4 py-3 text-center text-sm font-medium text-white shadow-2xl transition-all duration-300 ${toastVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"}`}>{toast}</div>
    </div>
  );
}
