/**
 * Página de detalle de un proyecto (/proyectos/[id]).
 * Todos los tabs tienen Drag & Drop via @dnd-kit/sortable.
 * Los cambios de orden se persisten en Supabase.
 */
"use client";

import {
  useEffect, useState, useCallback, useRef,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, GripVertical, Plus, X, Paperclip, Trash2, Pencil, FileText, Image as ImageIcon, Copy, CalendarDays } from "lucide-react";
import {
  DndContext,
  closestCenter,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDroppable,
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
import {
  money, dateFmt, totalIncome, totalExpense, balanceDue, cashFlow,
  addDays, dShort, initials,
} from "@/src/lib/utils";
import { exportCotizacion, exportEstadoCuenta } from "@/src/lib/pdf";
import type {
  Project, Task, Material, BudgetItem, Payment, Expense, Contact, ProjectNote, NoteAttachment,
} from "@/src/types/project";
import { useVoice } from "@/src/context/VoiceContext";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";
import EstimateTab from "@/src/components/ui/EstimateTab";

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface ProjectFull extends Project {
  tasks: Task[];
  materials: Material[];
  budget_items: BudgetItem[];
  payments: Payment[];
  expenses: Expense[];
  contacts: Contact[];
  project_notes: ProjectNote[];
}

type TabId = "workflow" | "materiales" | "contactos" | "presupuesto" | "pagos" | "plan" | "notas";
type PaySubTab = "ingresos" | "egresos";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function StatusChipOnBlue({ status }: { status: string }) {
  const { t } = useLanguage();
  const statusLabels = t.panel.status;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold text-white">
      <span className="size-1.5 rounded-full bg-white/70" />
      {statusLabels[status as keyof typeof statusLabels] ?? status}
    </span>
  );
}

function useToast() {
  const [msg, setMsg] = useState("");
  const [visible, setVisible] = useState(false);
  const show = (message: string) => {
    setMsg(message);
    setVisible(true);
    setTimeout(() => setVisible(false), 3200);
  };
  return { msg, visible, show };
}

// ─── Confirm modal ───────────────────────────────────────────────────────────
function ConfirmModal({
  title, body, label, onConfirm, onCancel, danger = true,
}: {
  title: string; body: string; label: string;
  onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-[#16323D]/55 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-[440px] rounded-t-[22px] bg-[#F7F3EA] p-6 shadow-2xl sm:rounded-[20px]">
        <h3 className="mb-1 font-[Manrope] text-lg font-bold text-[#16323D]">{title}</h3>
        <p className="mb-5 text-sm text-[#5C6A6E]">{body}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-xl bg-[#ECE3D1] py-3 font-bold text-[#5C6A6E]">Cancelar</button>
          <button onClick={onConfirm} className={`flex-1 rounded-xl py-3 font-bold text-white ${danger ? "bg-[#B0492F]" : "bg-[#16323D]"}`}>{label}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Editor modal genérico ───────────────────────────────────────────────────
type FieldType = "text" | "number" | "date" | "select";
interface Field { key: string; label: string; type: FieldType; value: string | number; options?: string[] }
interface EditorOpts {
  title: string; sub?: string; fields: Field[];
  onSave: (vals: Record<string, string | number>) => void;
  onDelete?: () => void;
}

function EditorModal({ opts, onClose }: { opts: EditorOpts; onClose: () => void }) {
  const [vals, setVals] = useState<Record<string, string | number>>(
    Object.fromEntries(opts.fields.map((f) => [f.key, f.value]))
  );
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDel,  setConfirmDel]  = useState(false);
  const set = (key: string, v: string | number) => setVals((prev) => ({ ...prev, [key]: v }));

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-end justify-center bg-[#16323D]/55 backdrop-blur-sm sm:items-center"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="w-full max-w-[460px] rounded-t-[22px] bg-[#F7F3EA] p-6 shadow-2xl sm:rounded-[20px] max-h-[92vh] overflow-y-auto">
          <h3 className="mb-1 font-[Manrope] text-xl font-bold text-[#16323D]">{opts.title}</h3>
          {opts.sub && <p className="mb-4 text-sm text-[#5C6A6E]">{opts.sub}</p>}
          <div className="space-y-3">
            {opts.fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">{f.label}</label>
                {f.type === "select" ? (
                  <select value={vals[f.key] as string} onChange={(e) => set(f.key, e.target.value)}
                    className="w-full rounded-xl border border-[#D7CBB3] bg-white px-3 py-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none">
                    {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === "number" ? (
                  <input
                    type="text"
                    inputMode="decimal"
                    value={vals[f.key] === 0 ? "" : String(vals[f.key])}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9.]/g, "");
                      set(f.key, raw === "" ? 0 : parseFloat(raw) || 0);
                    }}
                    placeholder="0"
                    className="w-full rounded-xl border border-[#D7CBB3] bg-white px-3 py-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none"
                  />
                ) : (
                  <input type={f.type} value={vals[f.key] as string}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="w-full rounded-xl border border-[#D7CBB3] bg-white px-3 py-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none" />
                )}
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-xl bg-[#ECE3D1] py-3 font-bold text-[#5C6A6E]">Cancelar</button>
            <button onClick={() => setConfirmSave(true)} className="flex-1 rounded-xl bg-[#16323D] py-3 font-bold text-white">Guardar</button>
          </div>
          {opts.onDelete && (
            <button onClick={() => setConfirmDel(true)} className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-sm font-bold text-[#B0492F]">
              Eliminar
            </button>
          )}
        </div>
      </div>
      {confirmSave && (
        <ConfirmModal title="Confirmar cambios" body="¿Guardar los cambios?" label="Guardar" danger={false}
          onConfirm={() => { setConfirmSave(false); opts.onSave(vals); onClose(); }}
          onCancel={() => setConfirmSave(false)} />
      )}
      {confirmDel && opts.onDelete && (
        <ConfirmModal title="Eliminar" body="Esta acción no se puede deshacer." label="Eliminar"
          onConfirm={() => { setConfirmDel(false); opts.onDelete!(); onClose(); }}
          onCancel={() => setConfirmDel(false)} />
      )}
    </>
  );
}

// ─── DragHandle ──────────────────────────────────────────────────────────────
function DragHandle() {
  return (
    <div className="flex items-center justify-center px-1.5 text-[#C4B89A] select-none" aria-hidden>
      <GripVertical size={15} />
    </div>
  );
}

// ─── Hook para persistir orden en Supabase ────────────────────────────────────
function usePersistOrder(table: string, field: string = "sort_order") {
  return useCallback(
    async (items: { id: string }[]) => {
      await Promise.all(
        items.map((item, i) =>
          supabase.from(table).update({ [field]: i }).eq("id", item.id)
        )
      );
    },
    [table, field]
  );
}

// ─── SortableRow wrapper ─────────────────────────────────────────────────────
function SortableRow({
  id, children,
}: {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children: (handleProps: { listeners?: any; attributes?: any }, isDragging: boolean) => React.ReactNode;
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ listeners, attributes }, isDragging)}
    </div>
  );
}

// Drop animation config
const dropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.5" } },
  }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: WORKFLOW (Kanban con DnD en cada columna y entre columnas)
// ═══════════════════════════════════════════════════════════════════════════════
const KANBAN_COLS_BASE = [
  { key: "pend", color: "#D7CBB3" },
  { key: "prog", color: "#4E7A82" },
  { key: "done", color: "#4F8A63" },
] as const;

type KanbanStatus = "pend" | "prog" | "done";

function DroppableKanbanCol({
  col, tasks, contacts, onEdit,
}: {
  col: { key: KanbanStatus; name: string; color: string };
  tasks: Task[];
  contacts: Contact[];
  onEdit: (t: Task) => void;
}) {
  const { t: trans } = useLanguage();
  const ownTeamLabel = trans.panel.workflow.ownTeam;
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div
      ref={setNodeRef}
      className={`min-w-[268px] flex-none rounded-2xl border p-3 transition-colors ${
        isOver ? "border-[#4E7A82] bg-[#D5E5E8]" : "border-[#E6DDCB] bg-[#ECE3D1]"
      }`}
    >
      <h4 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[#5C6A6E]">
        <span className="size-2 rounded-full" style={{ background: col.color }} />
        {col.name}
        <span className="ml-auto rounded-full border border-[#E6DDCB] bg-[#F7F3EA] px-2 py-0.5 font-mono text-[11px]">
          {tasks.length}
        </span>
      </h4>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.length === 0 && (
          <p className="py-5 text-center text-xs text-[#97A1A0]">—</p>
        )}
        {tasks.map((t) => (
          <SortableRow key={t.id} id={t.id}>
            {({ listeners, attributes }, isDragging) => (
              <div
                {...listeners} {...attributes}
                onClick={() => onEdit(t)}
                className={`mb-2 flex cursor-pointer select-none items-stretch overflow-hidden rounded-xl border border-[#E6DDCB] bg-white shadow-sm transition ${isDragging ? "shadow-lg ring-1 ring-[#16323D]" : ""}`}
              >
                <DragHandle />
                <div className="flex-1 py-3 pr-3">
                  <div className="text-sm font-semibold leading-snug text-[#16323D]">{t.name}</div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#5C6A6E]">
                      <span className="grid size-5 place-items-center rounded-full bg-[#16323D] text-[8px] font-bold text-white">
                        {initials(t.assigned_contact_id ? contacts.find((c) => c.id === t.assigned_contact_id)?.name ?? "EP" : "EP")}
                      </span>
                      <span className="max-w-[100px] truncate text-[10.5px]">
                        {t.assigned_contact_id ? contacts.find((c) => c.id === t.assigned_contact_id)?.name ?? ownTeamLabel : ownTeamLabel}
                      </span>
                    </span>
                    <span className="font-mono text-[11px] text-[#5C6A6E]">{t.hours}h</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10.5px] font-semibold text-[#5C6A6E]">
                    {t.scheduled_date && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#EDF3FB] px-2 py-0.5 text-[#395886]">
                        <CalendarDays size={11} /> {dateFmt(t.scheduled_date)}
                      </span>
                    )}
                    {t.source === "estimate" && (
                      <span className="rounded-full bg-[#EDE3CF] px-2 py-0.5 text-[#7A6230]">
                        {t.source_section ?? "Estimate"}
                      </span>
                    )}
                    {typeof t.amount === "number" && t.amount > 0 && (
                      <span className="rounded-full bg-[#F7F3EA] px-2 py-0.5 font-mono">
                        {money(t.amount)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </SortableRow>
        ))}
      </SortableContext>
    </div>
  );
}

function WorkflowTab({
  project, tasks, contacts, onRefresh, toast,
}: {
  project: Project; tasks: Task[]; contacts: Contact[];
  onRefresh: () => void; toast: (m: string) => void;
}) {
  const { t } = useLanguage();
  const tp = t.panel;
  const [items, setItems]   = useState<Task[]>(tasks);
  const [editor, setEditor] = useState<EditorOpts | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const persist = usePersistOrder("tasks");

  const KANBAN_COLS = [
    { key: "pend" as const, name: tp.workflow.todo,       color: "#D7CBB3" },
    { key: "prog" as const, name: tp.workflow.inProgress, color: "#4E7A82" },
    { key: "done" as const, name: tp.workflow.done,       color: "#4F8A63" },
  ];

  useEffect(() => { setItems(tasks); }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeTask = activeId ? items.find((t) => t.id === activeId) : null;
  const ownTeamLabel = tp.workflow.ownTeam;
  const whoOptions = [ownTeamLabel, ...contacts.map((c) => c.name)];
  const assigneeOptions = [
    { value: "all", label: tp.workflow.allAssignees },
    { value: "own", label: ownTeamLabel },
    ...contacts.map((c) => ({ value: c.id, label: c.name })),
  ];
  const dateOptions = [
    { value: "all", label: tp.workflow.allDates },
    { value: "unscheduled", label: tp.workflow.unscheduled },
    ...Array.from(new Set(items.map((task) => task.scheduled_date).filter(Boolean) as string[]))
      .sort()
      .map((iso) => ({ value: iso, label: dateFmt(iso) })),
  ];
  const matchesAssignee = (task: Task) => {
    if (assigneeFilter === "all") return true;
    if (assigneeFilter === "own") return !task.assigned_contact_id;
    return task.assigned_contact_id === assigneeFilter;
  };
  const matchesDate = (task: Task) => {
    if (dateFilter === "all") return true;
    if (dateFilter === "unscheduled") return !task.scheduled_date;
    return task.scheduled_date === dateFilter;
  };
  const filteredItems = items.filter((task) => matchesAssignee(task) && matchesDate(task));
  const byStatus = (s: KanbanStatus) =>
    filteredItems.filter((task) => task.status === s).sort((a, b) => a.sort_order - b.sort_order);

  const openEdit = (t: Task) => {
    setEditor({
      title: tp.workflow.editTask,
      fields: [
        { key: "name",           label: tp.workflow.activity,       type: "text",   value: t.name },
        { key: "hours",          label: tp.workflow.estHours,        type: "number", value: t.hours },
        { key: "duration_weeks", label: tp.workflow.durationWeeks,   type: "number", value: t.duration_weeks },
        { key: "scheduled_date", label: tp.workflow.scheduledDate,    type: "date",   value: t.scheduled_date ?? "" },
        { key: "status",         label: tp.workflow.status,          type: "select", options: ["pend", "prog", "done"], value: t.status },
        {
          key: "assignee_name", label: tp.workflow.responsible, type: "select", options: whoOptions,
          value: t.assigned_contact_id ? contacts.find((c) => c.id === t.assigned_contact_id)?.name ?? ownTeamLabel : ownTeamLabel,
        },
      ],
      onSave: async (vals) => {
        const assignee = contacts.find((c) => c.name === vals.assignee_name);
        const { error } = await supabase.from("tasks").update({
          name: vals.name, hours: vals.hours, duration_weeks: Math.max(1, Number(vals.duration_weeks)),
          scheduled_date: vals.scheduled_date ? String(vals.scheduled_date) : null,
          status: vals.status, assigned_contact_id: assignee?.id ?? null,
        }).eq("id", t.id);
        if (error) { toast(tp.common.errorSaving + error.message); return; }
        onRefresh(); toast(tp.workflow.taskUpdated);
      },
      onDelete: async () => {
        const { error } = await supabase.from("tasks").delete().eq("id", t.id);
        if (error) { toast(tp.common.errorDeleting + error.message); return; }
        onRefresh(); toast(tp.workflow.taskDeleted);
      },
    });
  };

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const draggedId = String(active.id);
    const overId    = String(over.id);
    if (draggedId === overId) return;

    const overIsCol    = KANBAN_COLS.some((c) => c.key === overId);
    const overTask     = overIsCol ? null : items.find((t) => t.id === overId);
    const targetStatus = (overIsCol ? overId : (overTask?.status ?? null)) as KanbanStatus | null;
    if (!targetStatus) return;

    setItems((prev) =>
      prev.map((t) => (t.id === draggedId ? { ...t, status: targetStatus } : t))
    );
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) {
      setItems(tasks); // reset visuals if dropped outside
      return;
    }

    const draggedId = String(active.id);
    const overId    = String(over.id);

    const draggedTask = items.find((t) => t.id === draggedId);
    if (!draggedTask) return;

    const originalStatus = (tasks.find((t) => t.id === draggedId)?.status ?? draggedTask.status) as KanbanStatus;

    // Derive target status from the drop target directly — avoids stale closure
    // on `items` state that handleDragOver may not have flushed yet.
    const overIsCol    = KANBAN_COLS.some((c) => c.key === overId);
    const overTask     = overIsCol ? null : items.find((t) => t.id === overId);
    const targetStatus = (overIsCol ? overId : (overTask?.status ?? originalStatus)) as KanbanStatus;

    if (targetStatus !== originalStatus) {
      // Cross-column move: apply optimistic update then persist
      setItems((prev) => prev.map((t) => t.id === draggedId ? { ...t, status: targetStatus } : t));
      const { error } = await supabase.from("tasks").update({ status: targetStatus }).eq("id", draggedId);
      if (error) {
        setItems(tasks);
        toast(tp.common.errorSaving + error.message);
        return;
      }
      const colName = KANBAN_COLS.find((c) => c.key === targetStatus)?.name ?? targetStatus;
      toast(`${tp.workflow.taskMoved} "${colName}"`);
    } else if (draggedId !== overId && !overIsCol) {
      // Same-column reorder
      const colItems = items
        .filter((t) => t.status === originalStatus)
        .sort((a, b) => a.sort_order - b.sort_order);
      const oldIdx = colItems.findIndex((t) => t.id === draggedId);
      const newIdx = colItems.findIndex((t) => t.id === overId);
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;
      const reordered = arrayMove(colItems, oldIdx, newIdx);
      const next = items.map((t) => {
        const idx = reordered.findIndex((r) => r.id === t.id);
        return idx !== -1 ? { ...t, sort_order: idx } : t;
      });
      setItems(next);
      await persist(reordered);
      toast(tp.common.orderUpdated);
    }
  };

  const addTask = () => {
    setEditor({
      title: tp.workflow.newTask,
      fields: [
        { key: "name",           label: tp.workflow.activity,       type: "text",   value: "" },
        { key: "hours",          label: tp.workflow.estHours,        type: "number", value: 8 },
        { key: "duration_weeks", label: tp.workflow.durationWeeks,   type: "number", value: 1 },
        { key: "scheduled_date", label: tp.workflow.scheduledDate,    type: "date",   value: project.start_date },
        { key: "assignee_name",  label: tp.workflow.responsible,     type: "select", options: whoOptions, value: ownTeamLabel },
      ],
      onSave: async (vals) => {
        const assignee = contacts.find((c) => c.name === vals.assignee_name);
        const { error } = await supabase.from("tasks").insert({
          project_id: project.id, name: vals.name || tp.workflow.activity,
          hours: vals.hours || 0, duration_weeks: Math.max(1, Number(vals.duration_weeks)),
          scheduled_date: vals.scheduled_date ? String(vals.scheduled_date) : null,
          status: "pend", sort_order: items.length, assigned_contact_id: assignee?.id ?? null,
          source: "manual",
        });
        if (error) { toast(tp.common.errorSaving + error.message); return; }
        onRefresh(); toast(tp.workflow.taskAdded);
      },
    });
  };

  const kanbanCollision = useCallback((args: Parameters<typeof pointerWithin>[0]) => {
    const pw = pointerWithin(args);
    return pw.length ? pw : rectIntersection(args);
  }, []);

  const totalTasks       = items.length;
  const fromEstimate     = items.filter((t) => t.source === "estimate").length;
  const doneTasks        = items.filter((t) => t.status === "done").length;
  const progressPct      = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollision}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* Summary metrics */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">{tp.workflow.metricTotal}</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-[#16323D]">{totalTasks}</div>
        </div>
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">{tp.workflow.metricFromEstimate}</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-[#395886]">{fromEstimate}</div>
        </div>
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">{tp.workflow.metricDone}</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-[#4F8A63]">{doneTasks}</div>
        </div>
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">{tp.workflow.metricProgress}</div>
          <div className="mt-1.5 flex items-end gap-2">
            <span className="font-mono text-2xl font-semibold text-[#16323D]">{progressPct}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E6DDCB]">
            <div
              className="h-full rounded-full bg-[#4F8A63] transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      <p className="mb-4 text-[11.5px] text-[#5C6A6E]">
        {tp.workflow.hint}
      </p>
      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl border border-[#E6DDCB] bg-[#F7F3EA] p-3">
        <label className="min-w-[180px] flex-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
          {tp.workflow.filterAssignee}
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#D7CBB3] bg-white px-3 py-2.5 text-sm normal-case tracking-normal text-[#16323D] focus:border-[#16323D] focus:outline-none"
          >
            {assigneeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="min-w-[160px] flex-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
          {tp.workflow.filterDate}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#D7CBB3] bg-white px-3 py-2.5 text-sm normal-case tracking-normal text-[#16323D] focus:border-[#16323D] focus:outline-none"
          >
            {dateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <button
          onClick={() => { setAssigneeFilter("all"); setDateFilter("all"); }}
          className="rounded-xl border border-[#D7CBB3] bg-white px-4 py-2.5 text-sm font-bold text-[#5C6A6E] transition hover:bg-[#ECE3D1] hover:text-[#16323D]"
        >
          {tp.workflow.clearFilters}
        </button>
        <span className="ml-auto rounded-full bg-[#EDF3FB] px-3 py-2 text-[11px] font-bold text-[#395886]">
          {filteredItems.length}/{items.length}
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {KANBAN_COLS.map((col) => (
          <DroppableKanbanCol
            key={col.key}
            col={col}
            tasks={byStatus(col.key)}
            contacts={contacts}
            onEdit={openEdit}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeTask && (
          <div className="rounded-xl border border-[#395886] bg-white px-4 py-3 shadow-2xl ring-1 ring-[#395886] opacity-90">
            <div className="text-sm font-semibold text-[#16323D]">{activeTask.name}</div>
            <div className="font-mono text-[11px] text-[#5C6A6E]">{activeTask.hours}h</div>
          </div>
        )}
      </DragOverlay>

      <button onClick={addTask} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-[#D7CBB3] bg-[#ECE3D1] px-4 py-3 text-sm font-bold text-[#16323D] transition hover:border-[#16323D]">
        + {tp.workflow.addTask}
      </button>

      {editor && <EditorModal opts={editor} onClose={() => setEditor(null)} />}
    </DndContext>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: MATERIALES con DnD
// ═══════════════════════════════════════════════════════════════════════════════
function MaterialesTab({
  project, materials, onRefresh, toast,
}: {
  project: Project; materials: Material[]; onRefresh: () => void; toast: (m: string) => void;
}) {
  const { t } = useLanguage();
  const tp = t.panel;
  const [items, setItems] = useState<Material[]>(materials);
  const [editor, setEditor]     = useState<EditorOpts | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [confirmDup, setConfirmDup] = useState<Material | null>(null);

  useEffect(() => { setItems(materials); }, [materials]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const por = items.filter((m) => !m.bought).reduce((s, m) => s + m.cost, 0);
  const com = items.filter((m) => m.bought).reduce((s, m) => s + m.cost, 0);

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((m) => m.id === active.id);
    const newIdx = items.findIndex((m) => m.id === over.id);
    const next = arrayMove(items, oldIdx, newIdx);
    setItems(next);
  };

  const openEdit = (m: Material) => {
    const yesLabel = tp.materials.yes;
    const noLabel  = tp.materials.no;
    setEditor({
      title: tp.materials.editMaterial,
      fields: [
        { key: "name",     label: tp.materials.material,  type: "text",   value: m.name },
        { key: "supplier", label: tp.materials.supplier,   type: "text",   value: m.supplier },
        { key: "cost",     label: tp.materials.cost,       type: "number", value: m.cost },
        { key: "bought",   label: tp.materials.boughtQ,    type: "select", options: [noLabel, yesLabel], value: m.bought ? yesLabel : noLabel },
      ],
      onSave: async (vals) => {
        const { error } = await supabase.from("materials").update({ name: vals.name, supplier: vals.supplier, cost: vals.cost, bought: vals.bought === yesLabel }).eq("id", m.id);
        if (error) { toast(tp.common.errorSaving + error.message); return; }
        onRefresh(); toast(tp.materials.materialUpdated);
      },
      onDelete: async () => {
        const { error } = await supabase.from("materials").delete().eq("id", m.id);
        if (error) { toast(tp.common.errorDeleting + error.message); return; }
        onRefresh(); toast(tp.materials.materialDeleted);
      },
    });
  };

  const activeMat = activeId ? items.find((m) => m.id === activeId) : null;

  const duplicateMaterial = async (m: Material) => {
    const { error } = await supabase.from("materials").insert({
      project_id: m.project_id,
      name: m.name,
      supplier: m.supplier,
      cost: m.cost,
      bought: false,
    });
    if (error) { toast(tp.common.errorSaving + error.message); return; }
    onRefresh(); toast(tp.materials.materialAdded);
  };

  return (
    <div className="max-w-[760px]">
      {/* Resumen */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-[400px]">
        <div className="rounded-[13px] border border-[#E6DDCB] bg-white p-3">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">{tp.materials.toBuy}</div>
          <div className="mt-1 font-mono text-lg font-semibold text-[#16323D]">{money(por)}</div>
        </div>
        <div className="rounded-[13px] border border-[#E6DDCB] bg-white p-3">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">{tp.materials.bought}</div>
          <div className="mt-1 font-mono text-lg font-semibold text-[#4F8A63]">{money(com)}</div>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {items.map((m) => (
              <SortableRow key={m.id} id={m.id}>
                {({ listeners, attributes }, isDragging) => (
                  <div
                    onClick={() => openEdit(m)}
                    className={`flex cursor-pointer select-none items-center overflow-hidden rounded-[13px] border border-[#E6DDCB] bg-white transition ${isDragging ? "shadow-lg ring-1 ring-[#16323D]" : ""} ${m.bought ? "opacity-70" : ""}`}
                  >
                    {/* Drag handle — only area that activates DnD */}
                    <div
                      {...listeners} {...attributes}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-center px-2 text-[#C4B89A] touch-none cursor-grab active:cursor-grabbing select-none"
                    >
                      <GripVertical size={15} />
                    </div>
                    <div className="flex flex-1 items-center gap-3 py-3 pr-3">
                      <span className={`grid size-6 flex-none place-items-center rounded-lg border-2 ${m.bought ? "border-[#4F8A63] bg-[#4F8A63]" : "border-[#D7CBB3]"}`}>
                        {m.bought && <span className="text-[10px] font-bold text-white">✓</span>}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={`block text-sm font-semibold ${m.bought ? "text-[#5C6A6E] line-through" : "text-[#16323D]"}`}>{m.name}</span>
                        <span className="block text-[11px] text-[#97A1A0]">{m.supplier}</span>
                      </span>
                      <span className="font-mono text-sm font-semibold text-[#16323D]">{money(m.cost)}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDup(m); }}
                        className="grid size-7 flex-none place-items-center rounded-lg border border-[#E6DDCB] bg-white text-[#5C6A6E] transition hover:bg-[#ECE3D1]"
                        aria-label="Duplicate"
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </SortableRow>
            ))}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeMat && (
            <div className="flex items-center gap-3 rounded-[13px] border border-[#16323D] bg-white px-3 py-3 shadow-2xl ring-1 ring-[#16323D]">
              <span className="text-sm font-semibold text-[#16323D]">{activeMat.name}</span>
              <span className="ml-auto font-mono text-sm font-semibold text-[#16323D]">{money(activeMat.cost)}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <button
        onClick={() => setEditor({
          title: tp.materials.newMaterial,
          fields: [
            { key: "name",     label: tp.materials.material,  type: "text",   value: "" },
            { key: "supplier", label: tp.materials.supplier,   type: "text",   value: "" },
            { key: "cost",     label: tp.materials.cost,       type: "number", value: 0 },
          ],
          onSave: async (vals) => {
            const { error } = await supabase.from("materials").insert({ project_id: project.id, name: vals.name || tp.materials.material, supplier: vals.supplier || "", cost: vals.cost || 0, bought: false });
            if (error) { toast(tp.common.errorSaving + error.message); return; }
            onRefresh(); toast(tp.materials.materialAdded);
          },
        })}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-[#D7CBB3] bg-[#ECE3D1] px-4 py-3 text-sm font-bold text-[#16323D] transition hover:border-[#16323D]"
      >
        + {tp.materials.addMaterial}
      </button>

      {editor && <EditorModal opts={editor} onClose={() => setEditor(null)} />}

      {confirmDup && (
        <ConfirmModal
          title={tp.materials.duplicateTitle}
          body={`${tp.materials.duplicateBody} "${confirmDup.name}"?`}
          label={tp.materials.duplicateBtn}
          onConfirm={() => { duplicateMaterial(confirmDup); setConfirmDup(null); }}
          onCancel={() => setConfirmDup(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: CONTACTOS — lista completa con checkbox en el lado izquierdo
// ═══════════════════════════════════════════════════════════════════════════════
function ContactosTab({
  project, contacts, allContacts, onRefresh, toast,
}: {
  project: Project; contacts: Contact[]; allContacts: Contact[];
  onRefresh: () => void; toast: (m: string) => void;
}) {
  const { t } = useLanguage();
  const tp = t.panel;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const assignedIds = new Set(contacts.map((c) => c.id));
  const available = allContacts.filter(
    (c) =>
      !assignedIds.has(c.id) &&
      c.name.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  const remove = async (cid: string) => {
    if (busy) return;
    setBusy(cid);
    const { error } = await supabase.from("project_contacts").delete()
      .eq("project_id", project.id).eq("contact_id", cid);
    if (error) { toast("Error: " + error.message); setBusy(null); return; }
    toast(tp.contacts.removed);
    setBusy(null);
    onRefresh();
  };

  const assign = async (cid: string) => {
    if (busy) return;
    setBusy(cid);
    const { error } = await supabase.from("project_contacts").insert({ project_id: project.id, contact_id: cid });
    if (error) { toast("Error: " + error.message); setBusy(null); return; }
    toast(tp.contacts.assigned);
    setBusy(null);
    setPickerOpen(false);
    setPickerSearch("");
    onRefresh();
  };

  return (
    <div className="max-w-[760px]">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-[#5C6A6E]">{tp.contacts.assigned}</span>
        <button
          onClick={() => setPickerOpen(true)}
          className="rounded-xl bg-[#16323D] px-4 py-2 text-xs font-bold text-white hover:bg-[#1e4455]"
        >
          {tp.contacts.addSpecialist}
        </button>
      </div>

      {contacts.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[#D7CBB3] bg-white p-10 text-center">
          <p className="text-sm text-[#5C6A6E]">{tp.contacts.noAssigned}</p>
          <button
            onClick={() => setPickerOpen(true)}
            className="rounded-xl bg-[#16323D] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1e4455]"
          >
            {tp.contacts.addSpecialist}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-2xl border border-[#E6DDCB] bg-white px-4 py-3 shadow-sm"
            >
              <span className="grid size-11 flex-none place-items-center rounded-[13px] bg-[#16323D] font-[Manrope] text-sm font-bold text-white">
                {initials(c.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-[#16323D]">{c.name}</div>
                {c.specialty && (
                  <div className="text-xs text-[#5C6A6E]">
                    {c.specialty}{c.rate ? ` · ${c.rate} ${c.rate_type === "day" ? t.panel.globalContacts.rateDay : t.panel.globalContacts.rateHour}` : ""}
                  </div>
                )}
              </div>
              <a
                href={`tel:${c.phone}`}
                className="inline-flex flex-none items-center gap-1.5 rounded-xl bg-[#DCEBDD] px-3 py-2 text-xs font-bold text-[#4F8A63]"
              >
                📞 {tp.contacts.call}
              </a>
              <button
                onClick={() => remove(c.id)}
                disabled={busy === c.id}
                aria-label={tp.contacts.removeSpecialist}
                className="grid size-8 flex-none place-items-center rounded-lg border border-[#E6DDCB] bg-white text-[#B0492F] transition hover:bg-[#FBE9E7] disabled:opacity-50"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {pickerOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#16323D]/55 backdrop-blur-sm sm:items-center">
          <div className="flex max-h-[80vh] w-full max-w-[460px] flex-col rounded-t-[22px] bg-[#F7F3EA] p-6 shadow-2xl sm:rounded-[20px]">
            <h3 className="mb-4 font-[Manrope] text-xl font-bold text-[#16323D]">
              {tp.contacts.pickerTitle}
            </h3>
            <input
              type="text"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder={tp.contacts.pickerSearch}
              className="mb-3 w-full rounded-xl border border-[#D7CBB3] bg-white px-3 py-2.5 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none"
            />
            <div className="flex-1 space-y-2 overflow-y-auto">
              {available.length === 0 ? (
                <div className="py-8 text-center text-sm text-[#5C6A6E]">
                  {tp.contacts.pickerEmpty}
                </div>
              ) : (
                available.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => assign(c.id)}
                    disabled={busy === c.id}
                    className="flex w-full items-center gap-3 rounded-xl border border-[#E6DDCB] bg-white p-3 text-left transition hover:bg-[#F7F3EA] disabled:opacity-50"
                  >
                    <span className="grid size-10 flex-none place-items-center rounded-[12px] bg-[#16323D] font-[Manrope] text-sm font-bold text-white">
                      {initials(c.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-[#16323D]">{c.name}</div>
                      {c.specialty && (
                        <div className="text-xs text-[#5C6A6E]">{c.specialty}</div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => { setPickerOpen(false); setPickerSearch(""); }}
              className="mt-4 w-full rounded-xl bg-[#ECE3D1] py-3 font-bold text-[#5C6A6E]"
            >
              {tp.common.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PRESUPUESTO con DnD
// ═══════════════════════════════════════════════════════════════════════════════
function PresupuestoTab({
  project, budgetItems, onRefresh, toast,
}: {
  project: Project; budgetItems: BudgetItem[];
  onRefresh: () => void; toast: (m: string) => void;
}) {
  const { t } = useLanguage();
  const tp = t.panel;
  const [items, setItems]   = useState<BudgetItem[]>(budgetItems);
  const [editor, setEditor] = useState<EditorOpts | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [activeId, setActiveId]     = useState<string | null>(null);

  useEffect(() => { setItems(budgetItems); }, [budgetItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);
  const handleDragEnd   = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const next = arrayMove(items, items.findIndex((b) => b.id === active.id), items.findIndex((b) => b.id === over.id));
    setItems(next);
  };

  const sum = items.reduce((s, b) => s + b.amount, 0);
  const approved = project.status !== "presupuesto";
  const activeBudget = activeId ? items.find((b) => b.id === activeId) : null;

  const openEdit = (b: BudgetItem) => {
    setEditor({
      title: tp.budget.editLine,
      fields: [
        { key: "description", label: tp.budget.description, type: "text",   value: b.description },
        { key: "type",        label: tp.budget.type,         type: "select", options: ["mano", "material"], value: b.type },
        { key: "amount",      label: tp.budget.amount,       type: "number", value: b.amount },
      ],
      onSave: async (vals) => {
        const { error } = await supabase.from("budget_items").update({ description: vals.description, type: vals.type, amount: vals.amount }).eq("id", b.id);
        if (error) { toast(tp.common.errorSaving + error.message); return; }
        onRefresh(); toast(tp.budget.lineUpdated);
      },
      onDelete: async () => {
        const { error } = await supabase.from("budget_items").delete().eq("id", b.id);
        if (error) { toast(tp.common.errorDeleting + error.message); return; }
        onRefresh(); toast(tp.budget.lineDeleted);
      },
    });
  };

  const approveProject = async () => {
    await supabase.from("projects").update({ status: "en_obra" }).eq("id", project.id);
    setConfirming(false); onRefresh(); toast(tp.budget.approved);
  };

  return (
    <div className="max-w-[760px]">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] bg-white">
            {items.map((b) => (
              <SortableRow key={b.id} id={b.id}>
                {({ listeners, attributes }, isDragging) => (
                  <div
                    {...listeners} {...attributes}
                    onClick={() => openEdit(b)}
                    className={`flex cursor-pointer select-none items-center border-b border-[#E6DDCB] last:border-0 transition ${isDragging ? "bg-[#F7F3EA] shadow-md" : "hover:bg-[#F7F3EA]"}`}
                  >
                    <DragHandle />
                    <div className="flex flex-1 items-center justify-between gap-2 py-3 pr-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.05em] ${b.type === "mano" ? "bg-[#DCE8E9] text-[#4E7A82]" : "bg-[#DCE6E6] text-[#0E2630]"}`}>
                          {b.type === "mano" ? tp.budget.labor : tp.budget.material}
                        </span>
                        <span className="truncate text-sm font-medium text-[#16323D]">{b.description}</span>
                      </div>
                      <span className="font-mono text-sm font-semibold text-[#16323D]">{money(b.amount)}</span>
                    </div>
                  </div>
                )}
              </SortableRow>
            ))}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeBudget && (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#16323D] bg-white px-4 py-3 shadow-2xl">
              <span className="text-sm font-medium text-[#16323D]">{activeBudget.description}</span>
              <span className="font-mono text-sm font-semibold text-[#16323D]">{money(activeBudget.amount)}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#16323D] px-5 py-4">
        <span className="text-sm font-semibold text-white/80">{tp.budget.total}</span>
        <span className="font-mono text-xl font-semibold text-white">{money(sum)}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {approved ? (
          <div className="inline-flex items-center gap-2 rounded-xl bg-[#DCEBDD] px-4 py-3 text-sm font-semibold text-[#4F8A63]">✓ {tp.budget.approvedByClient}</div>
        ) : (
          <button onClick={() => setConfirming(true)} className="inline-flex items-center gap-2 rounded-xl border border-[#4E7A82] bg-[#DCE8E9] px-4 py-3 text-sm font-bold text-[#4E7A82] transition hover:bg-[#c8dfe0]">
            {tp.budget.markApproved}
          </button>
        )}
        <button
          onClick={() => setEditor({
            title: tp.budget.newLine,
            fields: [
              { key: "description", label: tp.budget.description, type: "text",   value: "" },
              { key: "type",        label: tp.budget.type,         type: "select", options: ["mano", "material"], value: "material" },
              { key: "amount",      label: tp.budget.amount,       type: "number", value: 0 },
            ],
            onSave: async (vals) => {
              const { error } = await supabase.from("budget_items").insert({ project_id: project.id, description: vals.description || tp.budget.description, type: vals.type, amount: vals.amount || 0 });
              if (error) { toast(tp.common.errorSaving + error.message); return; }
              onRefresh(); toast(tp.budget.lineAdded);
            },
          })}
          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-[#D7CBB3] bg-[#ECE3D1] px-4 py-3 text-sm font-bold text-[#16323D] transition hover:border-[#16323D]"
        >
          + {tp.budget.addLine}
        </button>
        <button
          onClick={() => exportCotizacion(project, items)}
          className="inline-flex items-center gap-2 rounded-xl border border-[#D7CBB3] bg-white px-4 py-3 text-sm font-bold text-[#16323D] transition hover:bg-[#F7F3EA]"
        >
          ↓ {tp.budget.export}
        </button>
      </div>

      {confirming && <ConfirmModal title={tp.budget.approveTitle} body={tp.budget.approveBody} label={tp.budget.approve} danger={false} onConfirm={approveProject} onCancel={() => setConfirming(false)} />}
      {editor && <EditorModal opts={editor} onClose={() => setEditor(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PAGOS con DnD en cada sub-lista
// ═══════════════════════════════════════════════════════════════════════════════
function PagosTab({
  project, payments, expenses, contacts, onRefresh, toast, onSubTabChange,
}: {
  project: Project; payments: Payment[]; expenses: Expense[]; contacts: Contact[];
  onRefresh: () => void; toast: (m: string) => void;
  onSubTabChange?: (sub: PaySubTab) => void;
}) {
  const { t } = useLanguage();
  const tp = t.panel;
  const [subTab, setSubTab] = useState<PaySubTab>("ingresos");
  const changeSubTab = (t: PaySubTab) => { setSubTab(t); onSubTabChange?.(t); };
  const [payItems, setPayItems]     = useState<Payment[]>([...payments].reverse());
  const [expItems, setExpItems]     = useState<Expense[]>([...expenses].reverse());
  const [editor, setEditor]         = useState<EditorOpts | null>(null);
  const [activePayId, setActivePayId] = useState<string | null>(null);
  const [activeExpId, setActiveExpId] = useState<string | null>(null);

  useEffect(() => { setPayItems([...payments].reverse()); }, [payments]);
  useEffect(() => { setExpItems([...expenses].reverse()); }, [expenses]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const inc = totalIncome(payments);
  const egr = totalExpense(expenses);
  const due = Math.max(0, balanceDue(project.budget, payments));
  const caja = cashFlow(payments, expenses);
  const paid = due <= 0;

  const methodOptions  = ["Efectivo", "Transferencia", "Zelle", "Cheque", "Tarjeta"];
  const payeeOptions   = ["Equipo propio", ...contacts.map((c) => c.name)];

  // Drag handlers para pagos
  const handlePayDragStart = (e: DragStartEvent) => setActivePayId(e.active.id as string);
  const handlePayDragEnd   = async (e: DragEndEvent) => {
    setActivePayId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setPayItems((prev) => arrayMove(prev, prev.findIndex((p) => p.id === active.id), prev.findIndex((p) => p.id === over.id)));
    toast(tp.common.orderUpdated);
  };

  // Drag handlers para egresos
  const handleExpDragStart = (e: DragStartEvent) => setActiveExpId(e.active.id as string);
  const handleExpDragEnd   = async (e: DragEndEvent) => {
    setActiveExpId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setExpItems((prev) => arrayMove(prev, prev.findIndex((x) => x.id === active.id), prev.findIndex((x) => x.id === over.id)));
    toast(tp.common.orderUpdated);
  };

  const openPayEdit = (x: Payment) => setEditor({
    title: tp.payments.editIncome,
    fields: [
      { key: "amount", label: tp.payments.amount,  type: "number", value: x.amount },
      { key: "date",   label: tp.payments.date,    type: "date",   value: x.date },
      { key: "method", label: tp.payments.method,  type: "select", options: methodOptions, value: x.method },
      { key: "type",   label: tp.payments.concept, type: "select", options: ["anticipo", "abono", "final"], value: x.type },
    ],
    onSave: async (vals) => {
      const { error } = await supabase.from("payments").update(vals).eq("id", x.id);
      if (error) { toast(tp.common.errorSaving + error.message); return; }
      onRefresh(); toast(tp.payments.incomeUpdated);
    },
    onDelete: async () => {
      const { error } = await supabase.from("payments").delete().eq("id", x.id);
      if (error) { toast(tp.common.errorDeleting + error.message); return; }
      onRefresh(); toast(tp.payments.incomeDeleted);
    },
  });

  const openExpEdit = (x: Expense) => setEditor({
    title: tp.payments.editExpense,
    fields: [
      { key: "payee_name", label: tp.payments.paidTo,  type: "select", options: payeeOptions, value: x.payee_name },
      { key: "concept",    label: tp.payments.concept,  type: "text",   value: x.concept },
      { key: "amount",     label: tp.payments.amount,   type: "number", value: x.amount },
      { key: "date",       label: tp.payments.date,     type: "date",   value: x.date },
      { key: "method",     label: tp.payments.method,   type: "select", options: methodOptions, value: x.method },
    ],
    onSave: async (vals) => {
      const { error } = await supabase.from("expenses").update(vals).eq("id", x.id);
      if (error) { toast(tp.common.errorSaving + error.message); return; }
      onRefresh(); toast(tp.payments.expenseUpdated);
    },
    onDelete: async () => {
      const { error } = await supabase.from("expenses").delete().eq("id", x.id);
      if (error) { toast(tp.common.errorDeleting + error.message); return; }
      onRefresh(); toast(tp.payments.expenseDeleted);
    },
  });

  const activePay = activePayId ? payItems.find((p) => p.id === activePayId) : null;
  const activeExp = activeExpId ? expItems.find((x) => x.id === activeExpId) : null;

  return (
    <div className="max-w-[760px]">
      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-4"><div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">{tp.payments.income}</div><div className="mt-1.5 font-mono text-xl font-semibold text-[#4F8A63]">{money(inc)}</div></div>
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-4"><div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">{tp.payments.expenses}</div><div className="mt-1.5 font-mono text-xl font-semibold text-[#B0492F]">{money(egr)}</div></div>
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-4"><div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">{tp.payments.outstanding}</div><div className="mt-1.5 font-mono text-xl font-semibold text-[#16323D]">{money(due)}</div></div>
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-4"><div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">{tp.payments.cashFlow}</div><div className="mt-1.5 font-mono text-xl font-semibold text-[#16323D]">{money(caja)}</div></div>
      </div>
      {paid && <div className="mb-4 flex items-center gap-2 rounded-2xl border border-[#DCEBDD] bg-[#E7F1E6] px-4 py-3 text-sm font-semibold text-[#4F8A63]">🎉 {tp.payments.paidFull}</div>}

      {/* Sub-tabs + export */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-[#E6DDCB] bg-[#ECE3D1] p-1">
          {(["ingresos", "egresos"] as PaySubTab[]).map((sub) => (
            <button key={sub} onClick={() => changeSubTab(sub)} className={`rounded-lg px-5 py-2 text-sm font-bold transition ${subTab === sub ? "bg-white text-[#16323D] shadow-sm" : "text-[#5C6A6E]"}`}>
              {sub === "ingresos" ? tp.payments.incomeTab : tp.payments.expensesTab}
            </button>
          ))}
        </div>
        <button
          onClick={() => exportEstadoCuenta(project, payments, expenses)}
          className="inline-flex items-center gap-2 rounded-xl border border-[#D7CBB3] bg-white px-4 py-2 text-sm font-bold text-[#16323D] transition hover:bg-[#F7F3EA]"
        >
          ↓ {tp.payments.exportStatement}
        </button>
      </div>

      {/* Lista de ingresos */}
      {subTab === "ingresos" && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handlePayDragStart} onDragEnd={handlePayDragEnd}>
          <SortableContext items={payItems.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {payItems.length === 0 && <p className="py-4 text-center text-sm text-[#97A1A0]">{tp.payments.noIncome}</p>}
              {payItems.map((x) => (
                <SortableRow key={x.id} id={x.id}>
                  {({ listeners, attributes }, isDragging) => (
                    <div
                      {...listeners} {...attributes}
                      onClick={() => openPayEdit(x)}
                      className={`flex cursor-pointer select-none items-center overflow-hidden rounded-[13px] border border-[#E6DDCB] bg-white transition ${isDragging ? "shadow-lg ring-1 ring-[#16323D]" : "hover:bg-[#F7F3EA]"}`}
                    >
                      <DragHandle />
                      <div className="flex flex-1 items-center justify-between gap-2 py-3 pr-4">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-[#16323D]">
                            {x.method}
                            <span className="rounded bg-[#ECE3D1] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#5C6A6E]">{tp.paymentType[x.type as keyof typeof tp.paymentType] ?? x.type}</span>
                          </div>
                          <div className="text-[11px] text-[#5C6A6E]">{dateFmt(x.date)}</div>
                        </div>
                        <span className="font-mono text-base font-semibold text-[#4F8A63]">+{money(x.amount)}</span>
                      </div>
                    </div>
                  )}
                </SortableRow>
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={dropAnimation}>
            {activePay && (
              <div className="flex items-center justify-between gap-2 rounded-[13px] border border-[#16323D] bg-white px-4 py-3 shadow-2xl">
                <span className="text-sm font-semibold text-[#16323D]">{activePay.method}</span>
                <span className="font-mono text-base font-semibold text-[#4F8A63]">+{money(activePay.amount)}</span>
              </div>
            )}
          </DragOverlay>
          <button
            onClick={() => setEditor({
              title: tp.payments.newIncome, sub: tp.payments.newIncomeSub,
              fields: [
                { key: "amount", label: tp.payments.amount,  type: "number", value: 0 },
                { key: "date",   label: tp.payments.date,    type: "date",   value: new Date().toISOString().split("T")[0] },
                { key: "method", label: tp.payments.method,  type: "select", options: methodOptions, value: "Transferencia" },
                { key: "type",   label: tp.payments.concept, type: "select", options: ["anticipo", "abono", "final"], value: "abono" },
              ],
              onSave: async (vals) => {
                if (Number(vals.amount) <= 0) { toast(tp.payments.amountRequired); return; }
                const { error } = await supabase.from("payments").insert({ project_id: project.id, ...vals });
                if (error) { toast(tp.common.errorSaving + error.message); return; }
                onRefresh(); toast(tp.payments.incomeRecorded);
              },
            })}
            className="mt-3 w-full rounded-[13px] border border-dashed border-[#D7CBB3] bg-[#ECE3D1] py-3 text-sm font-bold text-[#16323D] transition hover:border-[#16323D]"
          >
            + {tp.payments.registerIncome}
          </button>
        </DndContext>
      )}

      {/* Lista de egresos */}
      {subTab === "egresos" && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleExpDragStart} onDragEnd={handleExpDragEnd}>
          <SortableContext items={expItems.map((x) => x.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {expItems.length === 0 && <p className="py-4 text-center text-sm text-[#97A1A0]">{tp.payments.noExpenses}</p>}
              {expItems.map((x) => (
                <SortableRow key={x.id} id={x.id}>
                  {({ listeners, attributes }, isDragging) => (
                    <div
                      {...listeners} {...attributes}
                      onClick={() => openExpEdit(x)}
                      className={`flex cursor-pointer select-none items-center overflow-hidden rounded-[13px] border border-[#E6DDCB] bg-white transition ${isDragging ? "shadow-lg ring-1 ring-[#16323D]" : "hover:bg-[#F7F3EA]"}`}
                    >
                      <DragHandle />
                      <div className="flex flex-1 items-center justify-between gap-2 py-3 pr-4">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-[#16323D]">
                            {x.payee_name}
                            <span className="rounded bg-[#ECE3D1] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#5C6A6E]">{x.method}</span>
                          </div>
                          <div className="text-[11px] text-[#5C6A6E]">{x.concept} · {dateFmt(x.date)}</div>
                        </div>
                        <span className="font-mono text-base font-semibold text-[#B0492F]">−{money(x.amount)}</span>
                      </div>
                    </div>
                  )}
                </SortableRow>
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={dropAnimation}>
            {activeExp && (
              <div className="flex items-center justify-between gap-2 rounded-[13px] border border-[#16323D] bg-white px-4 py-3 shadow-2xl">
                <span className="text-sm font-semibold text-[#16323D]">{activeExp.payee_name}</span>
                <span className="font-mono text-base font-semibold text-[#B0492F]">−{money(activeExp.amount)}</span>
              </div>
            )}
          </DragOverlay>
          <button
            onClick={() => setEditor({
              title: tp.payments.newExpense, sub: tp.payments.newExpenseSub,
              fields: [
                { key: "payee_name", label: tp.payments.paidTo,  type: "select", options: payeeOptions, value: payeeOptions[1] ?? tp.workflow.ownTeam },
                { key: "concept",    label: tp.payments.concept,  type: "text",   value: "" },
                { key: "amount",     label: tp.payments.amount,   type: "number", value: 0 },
                { key: "date",       label: tp.payments.date,     type: "date",   value: new Date().toISOString().split("T")[0] },
                { key: "method",     label: tp.payments.method,   type: "select", options: methodOptions, value: "Transferencia" },
              ],
              onSave: async (vals) => {
                if (Number(vals.amount) <= 0) { toast(tp.payments.amountRequired); return; }
                const { error } = await supabase.from("expenses").insert({ project_id: project.id, ...vals });
                if (error) { toast(tp.common.errorSaving + error.message); return; }
                onRefresh(); toast(tp.payments.expenseRecorded);
              },
            })}
            className="mt-3 w-full rounded-[13px] border border-dashed border-[#D7CBB3] bg-[#ECE3D1] py-3 text-sm font-bold text-[#16323D] transition hover:border-[#16323D]"
          >
            + {tp.payments.registerExpense}
          </button>
        </DndContext>
      )}

      {editor && <EditorModal opts={editor} onClose={() => setEditor(null)} />}
    </div>
  );
}

// ─── PlanTaskForm ────────────────────────────────────────────────────────────
function PlanTaskForm({
  task, startDate, endDate, onSave, onClose,
}: {
  task: Task;
  startDate: Date;
  endDate: Date;
  onSave: (vals: { name: string; hours: number; durationDays: number; status: string; startDate: string; endDate: string }) => void;
  onClose: () => void;
}) {
  const toDateInput = (d: Date) => d.toISOString().split("T")[0];
  const [name,   setName]   = useState(task.name);
  const [hours,  setHours]  = useState(task.hours);
  const [status, setStatus] = useState<"pend" | "prog" | "done">(task.status);
  const [sDate,  setSDate]  = useState(toDateInput(startDate));
  const [eDate,  setEDate]  = useState(toDateInput(endDate));

  const durationDays = Math.max(7, Math.round((new Date(eDate).getTime() - new Date(sDate).getTime()) / 86400000));

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">Activity</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-[#D7CBB3] bg-white px-3 py-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">Start date</label>
          <input type="date" value={sDate} onChange={(e) => setSDate(e.target.value)}
            className="w-full rounded-xl border border-[#D7CBB3] bg-white px-3 py-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none" />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">End date</label>
          <input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)}
            className="w-full rounded-xl border border-[#D7CBB3] bg-white px-3 py-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none" />
        </div>
      </div>
      <div className="text-xs text-[#5C6A6E]">Duration: ~{Math.round(durationDays / 7)} weeks ({durationDays} days)</div>
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">Estimated hours</label>
        <input type="number" min={0} value={hours} onChange={(e) => setHours(Number(e.target.value))}
          className="w-full rounded-xl border border-[#D7CBB3] bg-white px-3 py-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none" />
      </div>
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as "pend" | "prog" | "done")}
          className="w-full rounded-xl border border-[#D7CBB3] bg-white px-3 py-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none">
          <option value="pend">To do</option>
          <option value="prog">In progress</option>
          <option value="done">Done</option>
        </select>
      </div>
      <div className="mt-5 flex gap-3">
        <button onClick={onClose} className="flex-1 rounded-xl bg-[#ECE3D1] py-3 font-bold text-[#5C6A6E]">Cancel</button>
        <button onClick={() => onSave({ name, hours, durationDays, status, startDate: sDate, endDate: eDate })} className="flex-1 rounded-xl bg-[#395886] py-3 font-bold text-white">Save</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PLAN GANTT con DnD (@dnd-kit)
// ═══════════════════════════════════════════════════════════════════════════════
function PlanTab({
  project, tasks, onRefresh, toast,
}: {
  project: Project; tasks: Task[]; onRefresh: () => void; toast: (m: string) => void;
}) {
  const { t } = useLanguage();
  const tp = t.panel;
  const [items, setItems] = useState<Task[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [ganttUnit, setGanttUnit] = useState<"week" | "day">("week");
  const [filterStatus, setFilterStatus] = useState<"all" | "pend" | "prog" | "done">("all");
  const [editTask, setEditTask] = useState<{ task: { task: Task; start: Date; end: Date; weekStart: number }; startDate: Date; endDate: Date } | null>(null);
  const persist = usePersistOrder("tasks");

  useEffect(() => {
    setItems([...tasks].sort((a, b) => a.sort_order - b.sort_order));
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const projectStart = new Date(project.start_date + "T00:00:00");

  // Calendario secuencial — coordenadas en días para precisión diaria
  const schedule = () => {
    let cumDays = 0;
    return items.map((t) => {
      const hasScheduledDate = Boolean(t.scheduled_date);
      const start = hasScheduledDate
        ? new Date(`${t.scheduled_date}T00:00:00`)
        : new Date(projectStart.getTime() + cumDays * 86400000);
      // Day Planner tasks (source estimate/planner) represent a single scheduled day
      const isFromPlanner = t.source === "estimate" || t.source === "planner";
      const effectiveDays = isFromPlanner && hasScheduledDate ? 1 : t.duration_weeks * 7;
      const end = new Date(start.getTime() + (effectiveDays - 1) * 86400000);
      const dayStart = Math.max(0, Math.round((start.getTime() - projectStart.getTime()) / 86400000));
      if (!hasScheduledDate) cumDays = dayStart + effectiveDays;
      return { task: t, start, end, dayStart, durationDays: effectiveDays };
    });
  };

  const rows  = schedule();
  const totalDays = Math.max(14, rows.reduce((max, row) => Math.max(max, row.dayStart + row.durationDays), 0));
  const filteredRows = filterStatus === "all" ? rows : rows.filter((r) => r.task.status === filterStatus);
  const activeTask = activeId ? items.find((t) => t.id === activeId) : null;

  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthLabels: { label: string; pct: number }[] = [];
  {
    const d = new Date(projectStart);
    d.setDate(1);
    while (d < new Date(projectStart.getTime() + totalDays * 86400000)) {
      const pct = ((d.getTime() - projectStart.getTime()) / (totalDays * 86400000)) * 100;
      monthLabels.push({ label: monthNames[d.getMonth()], pct: Math.max(0, pct) });
      d.setMonth(d.getMonth() + 1);
      d.setDate(1);
    }
  }

  const unitLabels: { label: string; pct: number }[] = [];
  if (ganttUnit === "week") {
    const totalWeeks = Math.ceil(totalDays / 7);
    for (let w = 0; w < totalWeeks; w++) {
      unitLabels.push({ label: `W${w + 1}`, pct: ((w * 7) / totalDays) * 100 });
    }
  } else {
    const step = totalDays > 30 ? 3 : totalDays > 14 ? 2 : 1;
    for (let d = 0; d < totalDays; d += step) {
      const date = new Date(projectStart.getTime() + d * 86400000);
      unitLabels.push({ label: `${date.getDate()}`, pct: (d / totalDays) * 100 });
    }
  }

  const COLORS: Record<string, string> = {
    done: "bg-gradient-to-r from-[#4F8A63] to-[#69a67e] text-white",
    prog: "bg-gradient-to-r from-[#4E7A82] to-[#5e8c94] text-white",
    pend: "bg-[#D7CBB3] text-[#5C6A6E]",
  };

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);
  const handleDragEnd   = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const next = arrayMove(items, items.findIndex((t) => t.id === active.id), items.findIndex((t) => t.id === over.id));
    setItems(next);
    await persist(next);
    onRefresh();
    toast(tp.plan.reordered);
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) { toast(tp.common.errorDeleting + error.message); setConfirmDel(null); return; }
    setConfirmDel(null); onRefresh(); toast(tp.workflow.taskDeleted);
  };

  return (
    <div className="max-w-[900px]">
      <p className="mb-4 text-xs text-[#5C6A6E]">
        {tp.plan.hint}
      </p>

      {/* Controls: filter + gantt unit toggle */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {/* Status filter */}
        <div className="inline-flex rounded-lg border border-[#D7CBB3] bg-[#F7F3EA] p-0.5">
          {([
            { key: "all",  label: "All" },
            { key: "pend", label: tp.workflow.colPend },
            { key: "prog", label: tp.workflow.colProg },
            { key: "done", label: tp.workflow.colDone },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setFilterStatus(key)}
              className={`rounded-md px-3 py-1 text-[11px] font-bold transition ${filterStatus === key ? "bg-[#395886] text-white" : "text-[#5C6A6E] hover:text-[#16323D]"}`}>
              {label}
            </button>
          ))}
        </div>
        {/* Weeks / Days toggle */}
        <div className="inline-flex rounded-lg border border-[#D7CBB3] bg-[#F7F3EA] p-0.5">
          {(["week", "day"] as const).map((u) => (
            <button key={u} onClick={() => setGanttUnit(u)}
              className={`rounded-md px-3 py-1 text-[11px] font-bold capitalize transition ${ganttUnit === u ? "bg-[#395886] text-white" : "text-[#5C6A6E] hover:text-[#16323D]"}`}>
              {u === "week" ? "Weeks" : "Days"}
            </button>
          ))}
        </div>
      </div>

      {/* Month header */}
      <div className="mb-0 overflow-hidden rounded-t-xl border border-b-0 border-[#E6DDCB] bg-[#395886]"
        style={{ paddingLeft: "196px" }}>
        <div className="relative h-6">
          {monthLabels.map(({ label, pct }) => (
            <span key={label + pct}
              className="absolute top-1 text-[10px] font-bold text-white/80"
              style={{ left: `${pct}%` }}>
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Week/Day header */}
      <div className="mb-2 overflow-hidden rounded-b-xl border border-[#E6DDCB] bg-[#ECE3D1]"
        style={{ paddingLeft: "196px" }}>
        <div className="relative h-5">
          {unitLabels.map(({ label, pct }) => (
            <span key={label + pct}
              className="absolute top-1 text-[9px] font-semibold text-[#5C6A6E]"
              style={{ left: `${pct}%` }}>
              {label}
            </span>
          ))}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {filteredRows.map(({ task: t, start, end, dayStart, durationDays }) => {
              const left  = (dayStart / totalDays) * 100;
              const width = Math.max((durationDays / totalDays) * 100, 2);

              return (
                <SortableRow key={t.id} id={t.id}>
                  {({ listeners, attributes }, isDragging) => (
                    <div
                      {...listeners} {...attributes}
                      className={`grid select-none items-center gap-3 overflow-hidden rounded-xl border bg-white transition-shadow ${isDragging ? "border-[#16323D] shadow-lg" : "border-[#E6DDCB]"}`}
                      style={{ gridTemplateColumns: "auto minmax(110px,170px) 1fr auto" }}
                    >
                      <DragHandle />
                      <div className="py-2">
                        <div className="truncate text-[13px] font-semibold uppercase tracking-wide text-[#16323D]">{t.name}</div>
                        <div className="font-mono text-[10.5px] text-[#5C6A6E]">{dShort(start)}–{dShort(end)} · {t.hours}h</div>
                      </div>
                      <div className="relative h-5 overflow-hidden rounded-[6px] bg-[#ECE3D1]">
                        <div
                          className={`absolute top-0.5 h-4 overflow-hidden rounded-[5px] px-1 text-[9px] font-bold leading-4 ${COLORS[t.status]}`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        >
                          {durationDays >= 3 ? dShort(start) : ""}
                        </div>
                      </div>
                      <div className="mr-2 flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditTask({ task: { task: t, start, end, weekStart: dayStart }, startDate: start, endDate: end }); }}
                          className="grid size-8 place-items-center rounded-lg border border-[#E6DDCB] bg-white text-[#5C6A6E] transition hover:bg-[#ECE3D1]"
                          aria-label="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDel(t.id); }} className="grid size-8 place-items-center rounded-lg border border-[#E6DDCB] bg-white text-[#B0492F] transition hover:bg-[#F0DBD2]" aria-label="Delete">🗑</button>
                      </div>
                    </div>
                  )}
                </SortableRow>
              );
            })}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeTask && (
            <div className="rounded-xl border border-[#16323D] bg-white px-4 py-3 shadow-2xl ring-1 ring-[#16323D]">
              <div className="text-sm font-semibold text-[#16323D]">{activeTask.name}</div>
              <div className="font-mono text-[11px] text-[#5C6A6E]">{activeTask.hours}h · {activeTask.duration_weeks}w</div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Leyenda */}
      <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-[#5C6A6E]">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-3 rounded bg-[#4F8A63]" /> {tp.plan.done}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-3 rounded bg-[#4E7A82]" /> {tp.plan.inProgress}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-3 rounded bg-[#D7CBB3]" /> {tp.plan.pending}</span>
      </div>

      {confirmDel && (
        <ConfirmModal
          title={tp.plan.deleteTask}
          body={`${tp.plan.deleteTaskQ} "${items.find((t) => t.id === confirmDel)?.name}"?`}
          label={tp.common.delete}
          onConfirm={() => deleteTask(confirmDel)}
          onCancel={() => setConfirmDel(null)}
        />
      )}

      {editTask && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#16323D]/55 backdrop-blur-sm sm:items-center"
          onClick={(e) => { if (e.target === e.currentTarget) setEditTask(null); }}>
          <div className="w-full max-w-[460px] overflow-y-auto rounded-t-[22px] bg-[#F7F3EA] p-6 shadow-2xl sm:rounded-[20px] max-h-[90vh]">
            <h3 className="mb-4 font-[Manrope] text-xl font-bold text-[#16323D]">Edit task</h3>
            <PlanTaskForm
              task={editTask.task.task}
              startDate={editTask.startDate}
              endDate={editTask.endDate}
              onSave={async (vals) => {
                const { error } = await supabase.from("tasks").update({
                  name: vals.name,
                  hours: Number(vals.hours),
                  duration_weeks: Math.max(1, Math.round(vals.durationDays / 7)),
                  scheduled_date: vals.startDate || null,
                  status: vals.status,
                }).eq("id", editTask.task.task.id);
                if (error) { toast("Error: " + error.message); return; }
                setEditTask(null); onRefresh(); toast("Task updated.");
              }}
              onClose={() => setEditTask(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: NOTAS — comentarios + adjuntos (imágenes, PDFs)
// ═══════════════════════════════════════════════════════════════════════════════
function NotasTab({
  project, notes, onRefresh, toast,
}: {
  project: Project; notes: ProjectNote[];
  onRefresh: () => void; toast: (m: string) => void;
}) {
  const { t } = useLanguage();
  const tp = t.panel;
  const { verifyPin: checkPin } = useAuth();
  const fileRef   = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);

  const [adding,     setAdding]     = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newFiles,   setNewFiles]   = useState<File[]>([]);
  const [uploading,  setUploading]  = useState(false);

  const [editingNote,    setEditingNote]    = useState<ProjectNote | null>(null);
  const [editContent,    setEditContent]    = useState("");
  const [editFiles,      setEditFiles]      = useState<File[]>([]);

  const [pinPrompt, setPinPrompt] = useState<{ action: "delete" | "edit"; note: ProjectNote } | null>(null);
  const [pinValue,  setPinValue]  = useState("");
  const [pinError,  setPinError]  = useState("");

  // ── upload files → Supabase Storage bucket "kokistyle-files" ────────────────
  const uploadFiles = async (noteId: string, files: File[]): Promise<NoteAttachment[]> => {
    const out: NoteAttachment[] = [];
    for (const file of files) {
      const path = `notes/${noteId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("kokistyle-files").upload(path, file, { upsert: true });
      if (error) { toast(`Sin bucket de almacenamiento — crea "kokistyle-files" en Supabase Storage`); continue; }
      const { data: { publicUrl } } = supabase.storage.from("kokistyle-files").getPublicUrl(path);
      const type = file.type.startsWith("image/") ? "image" : file.type === "application/pdf" ? "pdf" : "other";
      out.push({ name: file.name, url: publicUrl, type, size: file.size });
    }
    return out;
  };

  // ── Add note ─────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!newContent.trim() && newFiles.length === 0) return;
    setUploading(true);
    const { data: row, error } = await supabase
      .from("project_notes")
      .insert({ project_id: project.id, content: newContent.trim(), attachments: [] })
      .select("id").single();
    if (error || !row) { toast(tp.notes.errorSavingNote + (error?.message ?? "")); setUploading(false); return; }
    const attachments = await uploadFiles(row.id, newFiles);
    if (attachments.length > 0) {
      await supabase.from("project_notes").update({ attachments }).eq("id", row.id);
    }
    setAdding(false); setNewContent(""); setNewFiles([]);
    setUploading(false); onRefresh(); toast(tp.notes.noteSaved);
  };

  // ── PIN verification before edit/delete ──────────────────────────────────────
  const verifyPin = async () => {
    const ok = await checkPin(pinValue);
    if (!ok) { setPinError(tp.notes.wrongPin); setPinValue(""); return; }
    const p = pinPrompt!;
    setPinPrompt(null); setPinValue(""); setPinError("");
    if (p.action === "delete") execDelete(p.note.id);
    else execEdit(p.note);
  };

  const execDelete = async (id: string) => {
    const { error } = await supabase.from("project_notes").delete().eq("id", id);
    if (error) { toast(tp.common.errorDeleting + error.message); return; }
    onRefresh(); toast(tp.notes.noteDeleted);
  };

  const execEdit = (note: ProjectNote) => {
    setEditingNote(note);
    setEditContent(note.content);
    setEditFiles([]);
  };

  const handleSaveEdit = async () => {
    if (!editingNote) return;
    setUploading(true);
    const newAttachments = await uploadFiles(editingNote.id, editFiles);
    const merged = [...(editingNote.attachments ?? []), ...newAttachments];
    const { error } = await supabase.from("project_notes")
      .update({ content: editContent.trim(), attachments: merged, updated_at: new Date().toISOString() })
      .eq("id", editingNote.id);
    if (error) { toast(tp.common.errorSaving + error.message); setUploading(false); return; }
    setEditingNote(null); setEditContent(""); setEditFiles([]);
    setUploading(false); onRefresh(); toast(tp.notes.noteUpdated);
  };

  const removeAttachment = async (note: ProjectNote, idx: number) => {
    const updated = note.attachments.filter((_, i) => i !== idx);
    await supabase.from("project_notes").update({ attachments: updated }).eq("id", note.id);
    onRefresh();
  };

  const sorted = [...notes].sort((a, b) =>
    new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  );

  return (
    <div className="max-w-[760px] space-y-4">
      {/* Add note button */}
      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-xl border border-dashed border-[#D7CBB3] bg-[#ECE3D1] px-4 py-3 text-sm font-bold text-[#16323D] transition hover:border-[#16323D]"
        >
          <Plus size={14} /> {tp.notes.addNote}
        </button>
      )}

      {/* New note form */}
      {adding && (
        <div className="rounded-2xl border border-[#4E7A82] bg-white p-4 shadow-sm">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder={tp.notes.placeholder}
            rows={3}
            className="mb-3 w-full resize-none rounded-xl border border-[#E6DDCB] bg-[#F7F3EA] px-3 py-2.5 text-sm text-[#16323D] placeholder:text-[#97A1A0] focus:border-[#16323D] focus:outline-none"
          />
          {/* File preview */}
          {newFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {newFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-lg border border-[#E6DDCB] bg-[#F7F3EA] px-2 py-1 text-[11px] text-[#5C6A6E]">
                  {f.type.startsWith("image/") ? <ImageIcon size={11} /> : <FileText size={11} />}
                  <span className="max-w-[120px] truncate">{f.name}</span>
                  <button onClick={() => setNewFiles(prev => prev.filter((_, j) => j !== i))} className="ml-0.5 text-[#B0492F]"><X size={10} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-xl border border-[#D7CBB3] bg-[#F7F3EA] px-3 py-2 text-xs font-semibold text-[#5C6A6E] transition hover:bg-[#ECE3D1]"
            >
              <Paperclip size={12} /> {tp.notes.attach}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files) setNewFiles(prev => [...prev, ...Array.from(e.target.files!)]); }}
            />
            <div className="ml-auto flex gap-2">
              <button onClick={() => { setAdding(false); setNewContent(""); setNewFiles([]); }}
                className="rounded-xl bg-[#ECE3D1] px-4 py-2 text-sm font-bold text-[#5C6A6E]">
                {tp.common.cancel}
              </button>
              <button
                onClick={handleAdd}
                disabled={uploading || (!newContent.trim() && newFiles.length === 0)}
                className="rounded-xl bg-[#16323D] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {uploading ? tp.notes.saving : tp.common.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes list */}
      {sorted.length === 0 && !adding && (
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-10 text-center text-sm text-[#97A1A0]">
          {tp.notes.empty}
        </div>
      )}

      {sorted.map((note) => (
        <div key={note.id} className="rounded-2xl border border-[#E6DDCB] bg-white p-4 shadow-sm">
          {/* Editing inline */}
          {editingNote?.id === note.id ? (
            <>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
                className="mb-3 w-full resize-none rounded-xl border border-[#4E7A82] bg-[#F7F3EA] px-3 py-2.5 text-sm text-[#16323D] focus:outline-none"
              />
              {/* Existing attachments */}
              {note.attachments?.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {note.attachments.map((a, i) => (
                    <div key={i} className="group relative">
                      {a.type === "image"
                        ? <img src={a.url} alt={a.name} className="h-14 w-14 rounded-lg object-cover border border-[#E6DDCB]" />
                        : <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg border border-[#E6DDCB] bg-[#F7F3EA] px-2 py-1 text-[11px] text-[#4E7A82]"><FileText size={11}/>{a.name}</a>
                      }
                      <button
                        onClick={() => removeAttachment(note, i)}
                        className="absolute -right-1.5 -top-1.5 hidden size-4 place-items-center rounded-full bg-[#B0492F] text-white group-hover:grid"
                      ><X size={9}/></button>
                    </div>
                  ))}
                </div>
              )}
              {/* New files to add */}
              {editFiles.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {editFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-1 rounded-lg border border-[#E6DDCB] bg-[#F7F3EA] px-2 py-1 text-[11px] text-[#5C6A6E]">
                      {f.type.startsWith("image/") ? <ImageIcon size={10}/> : <FileText size={10}/>}
                      <span className="max-w-[100px] truncate">{f.name}</span>
                      <button onClick={() => setEditFiles(p => p.filter((_, j) => j !== i))}><X size={9} className="text-[#B0492F]"/></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button onClick={() => editFileRef.current?.click()} className="flex items-center gap-1 rounded-xl border border-[#D7CBB3] px-3 py-2 text-xs font-semibold text-[#5C6A6E]">
                  <Paperclip size={11}/> {tp.notes.attachMore}
                </button>
                <input ref={editFileRef} type="file" accept="image/*,application/pdf" capture="environment" multiple className="hidden"
                  onChange={(e) => { if (e.target.files) setEditFiles(p => [...p, ...Array.from(e.target.files!)]); }} />
                <div className="ml-auto flex gap-2">
                  <button onClick={() => setEditingNote(null)} className="rounded-xl bg-[#ECE3D1] px-3 py-2 text-sm font-bold text-[#5C6A6E]">{tp.common.cancel}</button>
                  <button onClick={handleSaveEdit} disabled={uploading} className="rounded-xl bg-[#16323D] px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
                    {uploading ? "…" : tp.common.save}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Note content */}
              {note.content && <p className="mb-3 whitespace-pre-wrap text-sm text-[#16323D]">{note.content}</p>}
              {/* Attachments */}
              {note.attachments?.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {note.attachments.map((a, i) => (
                    a.type === "image"
                      ? <a key={i} href={a.url} target="_blank" rel="noopener noreferrer">
                          <img src={a.url} alt={a.name} className="h-16 w-16 rounded-xl object-cover border border-[#E6DDCB] transition hover:opacity-90" />
                        </a>
                      : <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-xl border border-[#E6DDCB] bg-[#F7F3EA] px-3 py-2 text-[12px] font-medium text-[#4E7A82] transition hover:bg-[#DCE8E9]">
                          <FileText size={13}/>{a.name}
                        </a>
                  ))}
                </div>
              )}
              {/* Footer */}
              <div className="flex items-center justify-between border-t border-[#F0EBE0] pt-2">
                <span className="text-[11px] text-[#97A1A0]">{dateFmt(note.created_at ?? "")}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setPinPrompt({ action: "edit", note }); setPinValue(""); setPinError(""); }}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[#4E7A82] transition hover:bg-[#DCE8E9]"
                  >
                    <Pencil size={11}/> {tp.common.edit}
                  </button>
                  <button
                    onClick={() => { setPinPrompt({ action: "delete", note }); setPinValue(""); setPinError(""); }}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[#B0492F] transition hover:bg-[#F0DBD2]"
                  >
                    <Trash2 size={11}/> {tp.common.delete}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      ))}

      {/* PIN confirmation modal */}
      {pinPrompt && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-[#16323D]/55 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-[360px] rounded-t-[22px] bg-[#F7F3EA] p-6 shadow-2xl sm:rounded-[20px]">
            <h3 className="mb-1 font-[Manrope] text-base font-bold text-[#16323D]">
              {pinPrompt.action === "delete" ? tp.notes.deleteNote : tp.notes.confirmEdit}
            </h3>
            <p className="mb-4 text-sm text-[#5C6A6E]">{tp.notes.pinPrompt}</p>
            <div className="mb-1 flex justify-center gap-3">
              {[0,1,2,3].map(i => (
                <div key={i} className={`size-3 rounded-full transition ${pinValue.length > i ? "bg-[#16323D]" : "bg-[#D7CBB3]"}`} />
              ))}
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              autoFocus
              value={pinValue}
              onChange={(e) => { setPinValue(e.target.value.replace(/\D/g,"").slice(0,4)); setPinError(""); }}
              onKeyDown={(e) => e.key === "Enter" && pinValue.length === 4 && verifyPin()}
              className="mb-2 h-11 w-full rounded-xl border border-[#E6DDCB] bg-white text-center font-mono text-xl tracking-[1.5em] text-[#16323D] focus:border-[#16323D] focus:outline-none"
              placeholder="••••"
            />
            {pinError && <p className="mb-2 text-center text-xs font-semibold text-[#B0492F]">{pinError}</p>}
            <div className="flex gap-3 mt-2">
              <button onClick={() => { setPinPrompt(null); setPinValue(""); setPinError(""); }}
                className="flex-1 rounded-xl bg-[#ECE3D1] py-3 font-bold text-[#5C6A6E]">{tp.common.cancel}</button>
              <button onClick={verifyPin} disabled={pinValue.length < 4}
                className={`flex-1 rounded-xl py-3 font-bold text-white disabled:opacity-40 ${pinPrompt.action === "delete" ? "bg-[#B0492F]" : "bg-[#16323D]"}`}>
                {pinPrompt.action === "delete" ? tp.common.delete : tp.notes.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL: Detalle del Proyecto
// ═══════════════════════════════════════════════════════════════════════════════
export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [project, setProject] = useState<ProjectFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("plan");
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const { msg: toastMsg, visible: toastVisible, show: showToast } = useToast();
  const { setMeta } = useVoice();
  const { isSuperAdmin, hasPermission } = useAuth();
  const { t } = useLanguage();
  const tp = t.panel;

  const TABS: { id: TabId; label: string }[] = [
    { id: "plan",        label: tp.tabs.plan },
    { id: "workflow",    label: tp.tabs.workflow },
    { id: "presupuesto", label: tp.tabs.budget },
    { id: "pagos",       label: tp.tabs.payments },
    { id: "materiales",  label: tp.tabs.materials },
    { id: "contactos",   label: tp.tabs.contacts },
    { id: "notas",       label: tp.tabs.notes },
  ];

  // Filter tabs the user is allowed to view
  const visibleTabs = TABS.filter(t => {
    if (isSuperAdmin) return true;
    const sec = t.id === "pagos" ? "pagos" : t.id === "plan" ? "workflow" : t.id as import("@/src/types/auth").PermissionSection;
    return hasPermission(sec, "view");
  });

  const fetchProject = useCallback(async () => {
    const { data, error } = await supabase
      .from("projects")
      .select(`*, tasks(*), materials(*), budget_items(*), payments(*), expenses(*), project_contacts(contact_id, contacts(*)), project_notes(*)`)
      .eq("id", id)
      .single();

    if (error || !data) { router.replace("/proyectos"); return; }
    const contacts = (data.project_contacts as { contacts: Contact }[]).map((pc) => pc.contacts);
    setProject({ ...data, contacts } as ProjectFull);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  useEffect(() => {
    supabase.from("contacts").select("*").then(({ data }) => { if (data) setAllContacts(data as Contact[]); });
  }, []);

  // Wire voice context — FAB sabe qué tab/proyecto está activo
  useEffect(() => {
    if (!project) return;
    const ctxMap: Record<TabId, string> = {
      workflow:    "project.workflow",
      materiales:  "project.materiales",
      contactos:   "project.contactos",
      presupuesto: "project.presupuesto",
      pagos:       "project.pagos.ingresos",
      plan:        "project.plan",
      notas:       "project.notas",
    };
    setMeta({
      context:      ctxMap[activeTab],
      projectId:    project.id,
      projectTitle: project.title,
      contacts:     project.contacts?.map((c) => c.name) ?? [],
    });
  }, [project, activeTab, setMeta]);

  // Refresh cuando VoiceFAB guarda algo
  useEffect(() => {
    const h = () => fetchProject();
    window.addEventListener("kokivoice_saved", h);
    return () => window.removeEventListener("kokivoice_saved", h);
  }, [fetchProject]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#16323D] border-t-transparent" />
      </div>
    );
  }
  if (!project) return null;

  const tasks = [...(project.tasks ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="animate-in fade-in duration-300">
      {/* Back button */}
      <button onClick={() => router.push("/proyectos")} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#5C6A6E] transition hover:text-[#16323D]">
        <ArrowLeft size={15} /> {tp.nav.dashboard}
      </button>

      {/* Blue header */}
      <div className="relative mb-2 rounded-2xl bg-[#395886] px-6 py-5">
        <h1 className="font-[Manrope] text-lg font-bold uppercase tracking-widest text-white pr-10">{project.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-[#B1C9EF]">
          <StatusChipOnBlue status={project.status} />
          <span>· {project.client}</span>
          <span>· {money(project.budget)}</span>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => setEditProjectOpen(true)}
            className="absolute right-4 top-4 grid size-8 place-items-center rounded-lg bg-white/15 text-white transition hover:bg-white/25"
            aria-label="Editar proyecto"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>

      {/* Pill tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto rounded-2xl bg-[#F0F3FA] px-4 py-2.5 [scrollbar-width:none]">
        {visibleTabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
              activeTab === t.id
                ? "bg-[#395886] text-white shadow-sm"
                : "text-[#628ECB] hover:text-[#395886]"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {activeTab === "workflow"    && <WorkflowTab    project={project} tasks={tasks} contacts={project.contacts} onRefresh={fetchProject} toast={showToast} />}
      {activeTab === "materiales"  && <MaterialesTab  project={project} materials={project.materials} onRefresh={fetchProject} toast={showToast} />}
      {activeTab === "contactos"   && <ContactosTab   project={project} contacts={project.contacts} allContacts={allContacts} onRefresh={fetchProject} toast={showToast} />}
      {activeTab === "presupuesto" && <EstimateTab project={project} onRefresh={fetchProject} toast={showToast} />}
      {activeTab === "pagos"       && <PagosTab
        project={project} payments={project.payments} expenses={project.expenses}
        contacts={project.contacts} onRefresh={fetchProject} toast={showToast}
        onSubTabChange={(sub) => setMeta({ context: `project.pagos.${sub}`, projectId: project.id, projectTitle: project.title, contacts: project.contacts?.map((c) => c.name) ?? [] })}
      />}
      {activeTab === "plan"        && <PlanTab        project={project} tasks={tasks} onRefresh={fetchProject} toast={showToast} />}
      {activeTab === "notas"       && <NotasTab       project={project} notes={project.project_notes ?? []} onRefresh={fetchProject} toast={showToast} />}

      {/* Editar proyecto */}
      {editProjectOpen && (
        <EditorModal
          opts={{
            title: tp.project.editProject,
            fields: [
              { key: "title",      label: tp.project.name,       type: "text",   value: project.title },
              { key: "client",     label: tp.project.client,      type: "text",   value: project.client },
              { key: "address",    label: tp.project.address,     type: "text",   value: project.address },
              { key: "budget",     label: tp.project.budget,      type: "number", value: project.budget },
              { key: "status",     label: tp.project.status,      type: "select", options: ["presupuesto", "aprobado", "en_obra", "terminado"], value: project.status },
              { key: "start_date", label: tp.project.startDate,   type: "date",   value: project.start_date },
            ],
            onSave: async (vals) => {
              const { error } = await supabase.from("projects").update(vals).eq("id", project.id);
              if (error) { showToast(tp.common.errorSaving + error.message); return; }
              fetchProject(); showToast(tp.project.projectUpdated);
            },
          }}
          onClose={() => setEditProjectOpen(false)}
        />
      )}

      {/* Toast */}
      <div className={`fixed bottom-24 left-1/2 z-[200] -translate-x-1/2 max-w-sm w-full rounded-2xl bg-[#16323D] px-4 py-3 text-center text-sm font-medium text-white shadow-2xl transition-all duration-300 ${toastVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"}`}>
        {toastMsg}
      </div>
    </div>
  );
}
