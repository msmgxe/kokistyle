/**
 * Panel global de Plan (/proyectos/plan).
 * Cronograma Gantt del portafolio completo, con drag & drop para priorizar
 * y opción de eliminar proyectos con confirmación.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/src/lib/supabase";
import { addDays, dShort, STATUS_LABELS } from "@/src/lib/utils";
import type { Project, Task } from "@/src/types/project";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ProjectWithTasks extends Project {
  tasks: Task[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const totalWeeks = (tasks: Task[]) =>
  Math.max(1, tasks.reduce((s, t) => s + t.duration_weeks, 0));

const BAR_COLORS: Record<string, string> = {
  presupuesto: "bg-[#D7CBB3] text-[#5C6A6E]",
  aprobado:    "bg-[#16323D] text-white",
  en_obra:     "bg-gradient-to-r from-[#4E7A82] to-[#5e8c94] text-white",
  terminado:   "bg-gradient-to-r from-[#4F8A63] to-[#69a67e] text-white",
};

// ─── DragHandle ────────────────────────────────────────────────────────────────
function DragHandle({ listeners, attributes }: { listeners?: object; attributes?: object }) {
  return (
    <button
      type="button"
      className="flex h-full cursor-grab touch-none items-center justify-center px-2 text-[#C4B89A] transition hover:text-[#16323D] active:cursor-grabbing"
      {...(listeners ?? {})}
      {...(attributes ?? {})}
      tabIndex={-1}
      aria-label="Arrastra para reordenar"
    >
      <GripVertical size={16} />
    </button>
  );
}

// ─── SortableRow ───────────────────────────────────────────────────────────────
function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (
    handleProps: { listeners?: object; attributes?: object },
    isDragging: boolean
  ) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.6 : 1,
      }}
    >
      {children({ listeners, attributes }, isDragging)}
    </div>
  );
}

// ─── Confirm modal ─────────────────────────────────────────────────────────────
function ConfirmModal({
  title, body, label, onConfirm, onCancel,
}: {
  title: string; body: string; label: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#16323D]/55 backdrop-blur-sm">
      <div className="w-full max-w-[420px] rounded-[20px] bg-[#F7F3EA] p-6 shadow-2xl">
        <h3 className="mb-2 font-[Manrope] text-lg font-bold text-[#16323D]">{title}</h3>
        <p className="mb-5 text-sm text-[#5C6A6E]">{body}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-xl bg-[#ECE3D1] py-3 font-bold text-[#5C6A6E]">
            Cancelar
          </button>
          <button onClick={onConfirm} className="flex-1 rounded-xl bg-[#B0492F] py-3 font-bold text-white">
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────
const dropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.5" } },
  }),
};

export default function PlanPage() {
  const [projects, setProjects] = useState<ProjectWithTasks[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [toast, setToast]       = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  const fetchProjects = useCallback(async () => {
    const { data } = await supabase
      .from("projects")
      .select("*, tasks(*)")
      .order("created_at");
    if (data) setProjects(data as ProjectWithTasks[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Calcular rango temporal del portafolio
  const spans = projects.map((p) => {
    const wks = totalWeeks(p.tasks);
    const start = new Date(p.start_date + "T00:00:00");
    const end   = addDays(p.start_date, wks * 7);
    return { p, start, end };
  });

  let minDate = spans[0]?.start ?? new Date();
  let maxDate = spans[0]?.end   ?? new Date();
  spans.forEach(({ start, end }) => {
    if (start < minDate) minDate = start;
    if (end   > maxDate) maxDate = end;
  });
  // Ajustar al primer día del mes / siguiente mes
  minDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 1);
  const totalMs = Math.max(maxDate.getTime() - minDate.getTime(), 1);

  // Month labels
  const monthLabels: { label: string; left: number }[] = [];
  let cur = new Date(minDate);
  while (cur < maxDate) {
    monthLabels.push({
      label: MONTHS[cur.getMonth()],
      left: ((cur.getTime() - minDate.getTime()) / totalMs) * 100,
    });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }

  const activeProject = activeId ? projects.find((p) => p.id === activeId) : null;

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);
  const handleDragEnd   = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = projects.findIndex((p) => p.id === active.id);
    const newIdx = projects.findIndex((p) => p.id === over.id);
    setProjects((prev) => arrayMove(prev, oldIdx, newIdx));
    showToast("Prioridad de proyectos actualizada.");
  };

  const deleteProject = async (id: string) => {
    await supabase.from("projects").delete().eq("id", id);
    setConfirmDel(null);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    showToast("Proyecto eliminado.");
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#16323D] border-t-transparent" />
      </div>
    );
  }

  const BlueHeader = () => (
    <div className="mb-6 rounded-2xl bg-[#395886] px-6 py-5">
      <h1 className="font-[Manrope] text-[22px] font-extrabold tracking-tight text-white">Plan del portafolio</h1>
      <p className="mt-1 text-sm text-[#B1C9EF]">
        Cronograma de todos los proyectos. Arrastra ⠿ para priorizar.
      </p>
    </div>
  );

  if (projects.length === 0) {
    return (
      <div>
        <BlueHeader />
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-10 text-center text-sm text-[#5C6A6E]">
          Sin proyectos aún. Créalos desde el Dashboard.
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      <BlueHeader />

      {/* Month labels */}
      <div className="relative mb-2 h-4" style={{ paddingLeft: "192px" }}>
        {monthLabels.map(({ label, left }) => (
          <span
            key={label + left}
            className="absolute text-[10px] font-semibold text-[#5C6A6E]"
            style={{ left: `calc(192px + ${left}%)` }}
          >
            {label}
          </span>
        ))}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {projects.map((p) => {
              const sp = spans.find((s) => s.p.id === p.id);
              const left  = sp ? ((sp.start.getTime() - minDate.getTime()) / totalMs) * 100 : 0;
              const width = sp ? ((sp.end.getTime()   - sp.start.getTime()) / totalMs) * 100 : 10;

              return (
                <SortableRow key={p.id} id={p.id}>
                  {({ listeners, attributes }, isDragging) => (
                    <div
                      className={`grid items-center gap-3 overflow-hidden rounded-xl border bg-white transition-shadow ${isDragging ? "border-[#16323D] shadow-lg" : "border-[#E6DDCB]"}`}
                      style={{ gridTemplateColumns: "auto minmax(110px,180px) 1fr 36px" }}
                    >
                      <DragHandle listeners={listeners} attributes={attributes} />

                      {/* Nombre y fechas */}
                      <div className="py-2">
                        <div className="truncate text-[13px] font-semibold text-[#16323D]">
                          {p.title.split(" — ")[0]}
                        </div>
                        <div className="font-mono text-[10.5px] text-[#5C6A6E]">
                          {sp ? `${dShort(sp.start)}–${dShort(sp.end)}` : "—"}
                          {" · "}{p.client}
                        </div>
                      </div>

                      {/* Barra Gantt */}
                      <div className="relative h-5 overflow-hidden rounded-[6px] bg-[#ECE3D1]">
                        <div
                          className={`absolute top-0.5 h-4 rounded-[5px] px-2 text-[9.5px] font-bold leading-4 overflow-hidden whitespace-nowrap ${BAR_COLORS[p.status] ?? "bg-[#D7CBB3] text-[#5C6A6E]"}`}
                          style={{ left: `${left}%`, width: `${Math.max(width, 6)}%` }}
                        >
                          {STATUS_LABELS[p.status]}
                        </div>
                      </div>

                      {/* Eliminar */}
                      <button
                        onClick={() => setConfirmDel(p.id)}
                        className="mr-2 grid size-8 place-items-center rounded-lg border border-[#E6DDCB] bg-white text-[#B0492F] transition hover:bg-[#F0DBD2]"
                        aria-label="Eliminar proyecto"
                      >
                        🗑
                      </button>
                    </div>
                  )}
                </SortableRow>
              );
            })}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeProject && (
            <div className="rounded-xl border border-[#16323D] bg-white px-4 py-3 shadow-2xl ring-1 ring-[#16323D]">
              <div className="text-sm font-semibold text-[#16323D]">
                {activeProject.title.split(" — ")[0]}
              </div>
              <div className="font-mono text-[11px] text-[#5C6A6E]">{activeProject.client}</div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Leyenda */}
      <div className="mt-5 flex flex-wrap gap-4 text-[11px] text-[#5C6A6E]">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-3 rounded bg-[#16323D]" /> Aprobado</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-3 rounded bg-[#4E7A82]" /> En obra</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-3 rounded bg-[#4F8A63]" /> Terminado</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-3 rounded bg-[#D7CBB3]" /> Presupuesto</span>
      </div>

      {/* Confirm eliminar */}
      {confirmDel && (
        <ConfirmModal
          title="Eliminar proyecto"
          body={`Se eliminará "${projects.find((p) => p.id === confirmDel)?.title}" y todos sus datos. Esta acción no se puede deshacer.`}
          label="Eliminar"
          onConfirm={() => deleteProject(confirmDel)}
          onCancel={() => setConfirmDel(null)}
        />
      )}

      {/* Toast */}
      <div
        className={`fixed bottom-24 left-1/2 z-[200] w-full max-w-sm -translate-x-1/2 rounded-2xl bg-[#16323D] px-4 py-3 text-center text-sm font-medium text-white shadow-2xl transition-all duration-300 ${toastVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"}`}
      >
        {toast}
      </div>
    </div>
  );
}
