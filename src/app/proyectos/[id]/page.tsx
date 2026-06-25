/**
 * Página de detalle de un proyecto (/proyectos/[id]).
 * Todos los tabs tienen Drag & Drop via @dnd-kit/sortable.
 * Los cambios de orden se persisten en Supabase.
 */
"use client";

import {
  useEffect, useState, useCallback,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Lock, GripVertical } from "lucide-react";
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
import {
  money, dateFmt, totalIncome, totalExpense, balanceDue, cashFlow,
  addDays, dShort, initials, STATUS_LABELS, PAYMENT_TYPE_LABELS,
} from "@/src/lib/utils";
import type {
  Project, Task, Material, BudgetItem, Payment, Expense, Contact,
} from "@/src/types/project";

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface ProjectFull extends Project {
  tasks: Task[];
  materials: Material[];
  budget_items: BudgetItem[];
  payments: Payment[];
  expenses: Expense[];
  contacts: Contact[];
}

type TabId = "workflow" | "materiales" | "contactos" | "presupuesto" | "pagos" | "plan";
type PaySubTab = "ingresos" | "egresos";

const TABS: { id: TabId; label: string }[] = [
  { id: "workflow",    label: "Workflow" },
  { id: "materiales",  label: "Materiales" },
  { id: "contactos",   label: "Contactos" },
  { id: "presupuesto", label: "Presupuesto" },
  { id: "pagos",       label: "Pagos" },
  { id: "plan",        label: "Plan" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    presupuesto: "bg-[#DCE6E6] text-[#0E2630]",
    aprobado:    "bg-[#DCE8E9] text-[#4E7A82]",
    en_obra:     "bg-[#EDE3CF] text-[#7A6230]",
    terminado:   "bg-[#DCEBDD] text-[#4F8A63]",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[status] ?? "bg-gray-100 text-gray-600"}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status] ?? status}
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
                ) : (
                  <input type={f.type} value={vals[f.key] as string | number}
                    onChange={(e) => set(f.key, f.type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
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
function DragHandle({ listeners, attributes }: { listeners?: object; attributes?: object }) {
  return (
    <button
      type="button"
      className="flex h-full cursor-grab touch-none items-center justify-center px-1 text-[#C4B89A] transition hover:text-[#16323D] active:cursor-grabbing"
      {...(listeners ?? {})}
      {...(attributes ?? {})}
      tabIndex={-1}
      aria-label="Arrastrar para reordenar"
    >
      <GripVertical size={16} />
    </button>
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
  children: (
    handleProps: { listeners?: object; attributes?: object },
    isDragging: boolean
  ) => React.ReactNode;
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
// TAB: WORKFLOW (Kanban con DnD en cada columna)
// ═══════════════════════════════════════════════════════════════════════════════
const KANBAN_COLS = [
  { key: "pend", name: "Por hacer",  color: "#D7CBB3" },
  { key: "prog", name: "En proceso", color: "#4E7A82" },
  { key: "done", name: "Hecho",      color: "#4F8A63" },
] as const;

type KanbanStatus = "pend" | "prog" | "done";

function WorkflowTab({
  project, tasks, contacts, onRefresh, toast,
}: {
  project: Project; tasks: Task[]; contacts: Contact[];
  onRefresh: () => void; toast: (m: string) => void;
}) {
  const [items, setItems]   = useState<Task[]>(tasks);
  const [editor, setEditor] = useState<EditorOpts | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const persist = usePersistOrder("tasks");

  useEffect(() => { setItems(tasks); }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (project.status === "presupuesto") {
    return (
      <div className="rounded-2xl border border-[#E6DDCB] bg-white p-10 text-center text-[#5C6A6E]">
        <Lock size={32} className="mx-auto mb-3 opacity-30" />
        <b className="mb-1 block font-bold text-[#16323D]">Workflow bloqueado</b>
        <p className="text-sm">Se activa al aprobar el presupuesto.</p>
      </div>
    );
  }

  const byStatus = (s: KanbanStatus) =>
    items.filter((t) => t.status === s).sort((a, b) => a.sort_order - b.sort_order);

  const activeTask = activeId ? items.find((t) => t.id === activeId) : null;
  const whoOptions = ["Equipo propio", ...contacts.map((c) => c.name)];

  const openEdit = (t: Task) => {
    setEditor({
      title: "Editar actividad",
      fields: [
        { key: "name",           label: "Actividad",           type: "text",   value: t.name },
        { key: "hours",          label: "Horas estimadas",      type: "number", value: t.hours },
        { key: "duration_weeks", label: "Duración (semanas)",   type: "number", value: t.duration_weeks },
        { key: "status",         label: "Estado",               type: "select", options: ["pend", "prog", "done"], value: t.status },
        {
          key: "assignee_name", label: "Responsable", type: "select", options: whoOptions,
          value: t.assigned_contact_id ? contacts.find((c) => c.id === t.assigned_contact_id)?.name ?? "Equipo propio" : "Equipo propio",
        },
      ],
      onSave: async (vals) => {
        const assignee = contacts.find((c) => c.name === vals.assignee_name);
        await supabase.from("tasks").update({
          name: vals.name, hours: vals.hours, duration_weeks: Math.max(1, Number(vals.duration_weeks)),
          status: vals.status, assigned_contact_id: assignee?.id ?? null,
        }).eq("id", t.id);
        onRefresh(); toast("Actividad actualizada.");
      },
      onDelete: async () => {
        await supabase.from("tasks").delete().eq("id", t.id);
        onRefresh(); toast("Actividad eliminada.");
      },
    });
  };

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    // Determine which column both items belong to
    const draggedTask = items.find((t) => t.id === active.id);
    if (!draggedTask) return;
    const col = draggedTask.status as KanbanStatus;
    const colItems = byStatus(col);
    const oldIdx = colItems.findIndex((t) => t.id === active.id);
    const newIdx = colItems.findIndex((t) => t.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;

    const reordered = arrayMove(colItems, oldIdx, newIdx);
    const next = items.map((t) => {
      const idx = reordered.findIndex((r) => r.id === t.id);
      return idx !== -1 ? { ...t, sort_order: idx } : t;
    });
    setItems(next);
    await persist(reordered);
    toast("Orden actualizado.");
  };

  const addTask = () => {
    setEditor({
      title: "Nueva actividad",
      fields: [
        { key: "name",           label: "Actividad",         type: "text",   value: "" },
        { key: "hours",          label: "Horas estimadas",    type: "number", value: 8 },
        { key: "duration_weeks", label: "Duración (semanas)", type: "number", value: 1 },
        { key: "assignee_name",  label: "Responsable",        type: "select", options: whoOptions, value: "Equipo propio" },
      ],
      onSave: async (vals) => {
        const assignee = contacts.find((c) => c.name === vals.assignee_name);
        await supabase.from("tasks").insert({
          project_id: project.id, name: vals.name || "Actividad",
          hours: vals.hours || 0, duration_weeks: Math.max(1, Number(vals.duration_weeks)),
          status: "pend", sort_order: items.length, assigned_contact_id: assignee?.id ?? null,
        });
        onRefresh(); toast("Actividad agregada.");
      },
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <p className="mb-4 text-[11.5px] text-[#5C6A6E]">
        Arrastra ⠿ para reordenar dentro de cada columna. Toca una tarjeta para editar.
      </p>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {KANBAN_COLS.map((col) => {
          const colTasks = byStatus(col.key);
          return (
            <div key={col.key} className="min-w-[268px] flex-none rounded-2xl border border-[#E6DDCB] bg-[#ECE3D1] p-3">
              <h4 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[#5C6A6E]">
                <span className="size-2 rounded-full" style={{ background: col.color }} />
                {col.name}
                <span className="ml-auto rounded-full border border-[#E6DDCB] bg-[#F7F3EA] px-2 py-0.5 font-mono text-[11px]">
                  {colTasks.length}
                </span>
              </h4>

              <SortableContext items={colTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {colTasks.length === 0 && (
                  <p className="py-5 text-center text-xs text-[#97A1A0]">—</p>
                )}
                {colTasks.map((t) => (
                  <SortableRow key={t.id} id={t.id}>
                    {({ listeners, attributes }, isDragging) => (
                      <div className={`mb-2 flex items-stretch overflow-hidden rounded-xl border border-[#E6DDCB] bg-white shadow-sm transition ${isDragging ? "shadow-lg ring-1 ring-[#16323D]" : ""}`}>
                        <DragHandle listeners={listeners} attributes={attributes} />
                        <button onClick={() => openEdit(t)} className="flex-1 py-3 pr-3 text-left">
                          <div className="text-sm font-semibold leading-snug text-[#16323D]">{t.name}</div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#5C6A6E]">
                              <span className="grid size-5 place-items-center rounded-full bg-[#16323D] text-[8px] font-bold text-white">
                                {initials(t.assigned_contact_id ? contacts.find((c) => c.id === t.assigned_contact_id)?.name ?? "EP" : "EP")}
                              </span>
                              <span className="max-w-[100px] truncate text-[10.5px]">
                                {t.assigned_contact_id ? contacts.find((c) => c.id === t.assigned_contact_id)?.name ?? "Equipo propio" : "Equipo propio"}
                              </span>
                            </span>
                            <span className="font-mono text-[11px] text-[#5C6A6E]">{t.hours}h</span>
                          </div>
                        </button>
                      </div>
                    )}
                  </SortableRow>
                ))}
              </SortableContext>
            </div>
          );
        })}
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeTask && (
          <div className="rounded-xl border border-[#16323D] bg-white px-3 py-3 shadow-2xl ring-1 ring-[#16323D]">
            <div className="text-sm font-semibold text-[#16323D]">{activeTask.name}</div>
            <div className="mt-1 font-mono text-[11px] text-[#5C6A6E]">{activeTask.hours}h</div>
          </div>
        )}
      </DragOverlay>

      <button onClick={addTask} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-[#D7CBB3] bg-[#ECE3D1] px-4 py-3 text-sm font-bold text-[#16323D] transition hover:border-[#16323D]">
        + Agregar actividad
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
  const [items, setItems] = useState<Material[]>(materials);
  const [editor, setEditor] = useState<EditorOpts | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const persist = usePersistOrder("materials");

  useEffect(() => { setItems(materials); }, [materials]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (project.status === "presupuesto") {
    return (
      <div className="rounded-2xl border border-[#E6DDCB] bg-white p-10 text-center text-[#5C6A6E]">
        <Lock size={32} className="mx-auto mb-3 opacity-30" />
        <b className="mb-1 block font-bold text-[#16323D]">Módulo bloqueado</b>
        <p className="text-sm">Se activa al aprobar el presupuesto.</p>
      </div>
    );
  }

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
    await persist(next);
    toast("Orden actualizado.");
  };

  const openEdit = (m: Material) => {
    setEditor({
      title: "Editar material",
      fields: [
        { key: "name",     label: "Material",         type: "text",   value: m.name },
        { key: "supplier", label: "Proveedor",         type: "text",   value: m.supplier },
        { key: "cost",     label: "Costo (USD)",        type: "number", value: m.cost },
        { key: "bought",   label: "¿Comprado?",         type: "select", options: ["No", "Sí"], value: m.bought ? "Sí" : "No" },
      ],
      onSave: async (vals) => {
        await supabase.from("materials").update({ name: vals.name, supplier: vals.supplier, cost: vals.cost, bought: vals.bought === "Sí" }).eq("id", m.id);
        onRefresh(); toast("Material actualizado.");
      },
      onDelete: async () => {
        await supabase.from("materials").delete().eq("id", m.id);
        onRefresh(); toast("Material eliminado.");
      },
    });
  };

  const activeMat = activeId ? items.find((m) => m.id === activeId) : null;

  return (
    <div className="max-w-[760px]">
      {/* Resumen */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-[400px]">
        <div className="rounded-[13px] border border-[#E6DDCB] bg-white p-3">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">Por comprar</div>
          <div className="mt-1 font-mono text-lg font-semibold text-[#16323D]">{money(por)}</div>
        </div>
        <div className="rounded-[13px] border border-[#E6DDCB] bg-white p-3">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">Comprado</div>
          <div className="mt-1 font-mono text-lg font-semibold text-[#4F8A63]">{money(com)}</div>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {items.map((m) => (
              <SortableRow key={m.id} id={m.id}>
                {({ listeners, attributes }, isDragging) => (
                  <div className={`flex items-center overflow-hidden rounded-[13px] border border-[#E6DDCB] bg-white transition ${isDragging ? "shadow-lg ring-1 ring-[#16323D]" : ""} ${m.bought ? "opacity-70" : ""}`}>
                    <DragHandle listeners={listeners} attributes={attributes} />
                    <button onClick={() => openEdit(m)} className="flex flex-1 items-center gap-3 py-3 pr-3 text-left">
                      <span className={`grid size-6 flex-none place-items-center rounded-lg border-2 ${m.bought ? "border-[#4F8A63] bg-[#4F8A63]" : "border-[#D7CBB3]"}`}>
                        {m.bought && <span className="text-[10px] font-bold text-white">✓</span>}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={`block text-sm font-semibold ${m.bought ? "text-[#5C6A6E] line-through" : "text-[#16323D]"}`}>{m.name}</span>
                        <span className="block text-[11px] text-[#97A1A0]">{m.supplier}</span>
                      </span>
                      <span className="font-mono text-sm font-semibold text-[#16323D]">{money(m.cost)}</span>
                    </button>
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
          title: "Nuevo material",
          fields: [
            { key: "name", label: "Material", type: "text", value: "" },
            { key: "supplier", label: "Proveedor", type: "text", value: "" },
            { key: "cost", label: "Costo (USD)", type: "number", value: 0 },
          ],
          onSave: async (vals) => {
            await supabase.from("materials").insert({ project_id: project.id, name: vals.name || "Material", supplier: vals.supplier || "", cost: vals.cost || 0, bought: false, sort_order: items.length });
            onRefresh(); toast("Material agregado.");
          },
        })}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-[#D7CBB3] bg-[#ECE3D1] px-4 py-3 text-sm font-bold text-[#16323D] transition hover:border-[#16323D]"
      >
        + Agregar material
      </button>

      {editor && <EditorModal opts={editor} onClose={() => setEditor(null)} />}
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
  const [busy, setBusy] = useState<string | null>(null);
  const assignedIds = new Set(contacts.map((c) => c.id));

  const toggle = async (cid: string) => {
    if (busy) return;
    setBusy(cid);
    const isOn = assignedIds.has(cid);
    if (isOn) {
      await supabase.from("project_contacts").delete()
        .eq("project_id", project.id).eq("contact_id", cid);
      toast("Especialista quitado del proyecto.");
    } else {
      await supabase.from("project_contacts").insert({ project_id: project.id, contact_id: cid });
      toast("Especialista asignado al proyecto.");
    }
    setBusy(null);
    onRefresh();
  };

  if (allContacts.length === 0) {
    return (
      <div className="max-w-[760px] rounded-2xl border border-[#E6DDCB] bg-white p-8 text-center text-sm text-[#5C6A6E]">
        Sin contactos en el directorio aún. Ve a <strong>Panel → Contactos</strong> para agregar.
      </div>
    );
  }

  return (
    <div className="max-w-[760px]">
      <p className="mb-4 text-xs text-[#5C6A6E]">
        Marca ✓ para asignar o quitar un especialista de este proyecto.
      </p>
      <div className="flex flex-col gap-3">
        {allContacts.map((c) => {
          const on = assignedIds.has(c.id);
          return (
            <div
              key={c.id}
              className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm transition ${on ? "border-[#16323D]" : "border-[#E6DDCB]"}`}
            >
              {/* Checkbox izquierdo */}
              <button
                onClick={() => toggle(c.id)}
                disabled={busy === c.id}
                aria-label={on ? "Quitar del proyecto" : "Agregar al proyecto"}
                className={`grid size-6 flex-none place-items-center rounded-md border-2 transition disabled:opacity-50 ${on ? "border-[#16323D] bg-[#16323D]" : "border-[#D7CBB3] bg-white hover:border-[#16323D]"}`}
              >
                {on && <span className="text-[10px] font-bold leading-none text-white">✓</span>}
              </button>

              {/* Avatar */}
              <span className="grid size-11 flex-none place-items-center rounded-[13px] bg-[#16323D] font-[Manrope] text-sm font-bold text-white">
                {initials(c.name)}
              </span>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-[#16323D]">{c.name}</div>
                <div className="text-xs text-[#5C6A6E]">{c.specialty} · {c.rate}</div>
              </div>

              {/* Llamar */}
              <a
                href={`tel:${c.phone}`}
                className="inline-flex flex-none items-center gap-1.5 rounded-xl bg-[#DCEBDD] px-3 py-2 text-xs font-bold text-[#4F8A63]"
              >
                📞 Llamar
              </a>
            </div>
          );
        })}
      </div>
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
  const [items, setItems]   = useState<BudgetItem[]>(budgetItems);
  const [editor, setEditor] = useState<EditorOpts | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [activeId, setActiveId]     = useState<string | null>(null);
  const persist = usePersistOrder("budget_items");

  useEffect(() => { setItems(budgetItems); }, [budgetItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);
  const handleDragEnd   = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const next = arrayMove(items, items.findIndex((b) => b.id === active.id), items.findIndex((b) => b.id === over.id));
    setItems(next);
    await persist(next);
    toast("Orden actualizado.");
  };

  const sum = items.reduce((s, b) => s + b.amount, 0);
  const approved = project.status !== "presupuesto";
  const activeBudget = activeId ? items.find((b) => b.id === activeId) : null;

  const openEdit = (b: BudgetItem) => {
    setEditor({
      title: "Editar línea",
      fields: [
        { key: "description", label: "Descripción", type: "text",   value: b.description },
        { key: "type",        label: "Tipo",         type: "select", options: ["mano", "material"], value: b.type },
        { key: "amount",      label: "Monto (USD)",   type: "number", value: b.amount },
      ],
      onSave: async (vals) => {
        await supabase.from("budget_items").update({ description: vals.description, type: vals.type, amount: vals.amount }).eq("id", b.id);
        onRefresh(); toast("Línea actualizada.");
      },
      onDelete: async () => {
        await supabase.from("budget_items").delete().eq("id", b.id);
        onRefresh(); toast("Línea eliminada.");
      },
    });
  };

  const approveProject = async () => {
    await supabase.from("projects").update({ status: "en_obra" }).eq("id", project.id);
    setConfirming(false); onRefresh(); toast("Presupuesto aprobado — ¡Proyecto en obra!");
  };

  return (
    <div className="max-w-[760px]">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] bg-white">
            {items.map((b) => (
              <SortableRow key={b.id} id={b.id}>
                {({ listeners, attributes }, isDragging) => (
                  <div className={`flex items-center border-b border-[#E6DDCB] last:border-0 transition ${isDragging ? "bg-[#F7F3EA] shadow-md" : "hover:bg-[#F7F3EA]"}`}>
                    <DragHandle listeners={listeners} attributes={attributes} />
                    <button onClick={() => openEdit(b)} className="flex flex-1 items-center justify-between gap-2 py-3 pr-4 text-left">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.05em] ${b.type === "mano" ? "bg-[#DCE8E9] text-[#4E7A82]" : "bg-[#DCE6E6] text-[#0E2630]"}`}>
                          {b.type === "mano" ? "Mano obra" : "Material"}
                        </span>
                        <span className="truncate text-sm font-medium text-[#16323D]">{b.description}</span>
                      </div>
                      <span className="font-mono text-sm font-semibold text-[#16323D]">{money(b.amount)}</span>
                    </button>
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
        <span className="text-sm font-semibold text-white/80">Total presupuestado</span>
        <span className="font-mono text-xl font-semibold text-white">{money(sum)}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {approved ? (
          <div className="inline-flex items-center gap-2 rounded-xl bg-[#DCEBDD] px-4 py-3 text-sm font-semibold text-[#4F8A63]">✓ Aprobado por el cliente</div>
        ) : (
          <button onClick={() => setConfirming(true)} className="inline-flex items-center gap-2 rounded-xl border border-[#4E7A82] bg-[#DCE8E9] px-4 py-3 text-sm font-bold text-[#4E7A82] transition hover:bg-[#c8dfe0]">
            Marcar como aprobado
          </button>
        )}
        <button
          onClick={() => setEditor({
            title: "Nueva línea de presupuesto",
            fields: [
              { key: "description", label: "Descripción", type: "text",   value: "" },
              { key: "type",        label: "Tipo",         type: "select", options: ["mano", "material"], value: "material" },
              { key: "amount",      label: "Monto (USD)",   type: "number", value: 0 },
            ],
            onSave: async (vals) => {
              await supabase.from("budget_items").insert({ project_id: project.id, description: vals.description || "Línea", type: vals.type, amount: vals.amount || 0, sort_order: items.length });
              onRefresh(); toast("Línea agregada.");
            },
          })}
          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-[#D7CBB3] bg-[#ECE3D1] px-4 py-3 text-sm font-bold text-[#16323D] transition hover:border-[#16323D]"
        >
          + Agregar línea
        </button>
      </div>

      {confirming && <ConfirmModal title="Aprobar presupuesto" body="Pasa el proyecto a En obra y activa el workflow y materiales." label="Aprobar" danger={false} onConfirm={approveProject} onCancel={() => setConfirming(false)} />}
      {editor && <EditorModal opts={editor} onClose={() => setEditor(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PAGOS con DnD en cada sub-lista
// ═══════════════════════════════════════════════════════════════════════════════
function PagosTab({
  project, payments, expenses, contacts, onRefresh, toast,
}: {
  project: Project; payments: Payment[]; expenses: Expense[]; contacts: Contact[];
  onRefresh: () => void; toast: (m: string) => void;
}) {
  const [subTab, setSubTab]         = useState<PaySubTab>("ingresos");
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
    toast("Orden de ingresos actualizado.");
  };

  // Drag handlers para egresos
  const handleExpDragStart = (e: DragStartEvent) => setActiveExpId(e.active.id as string);
  const handleExpDragEnd   = async (e: DragEndEvent) => {
    setActiveExpId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setExpItems((prev) => arrayMove(prev, prev.findIndex((x) => x.id === active.id), prev.findIndex((x) => x.id === over.id)));
    toast("Orden de egresos actualizado.");
  };

  const openPayEdit = (x: Payment) => setEditor({
    title: "Editar ingreso",
    fields: [
      { key: "amount", label: "Monto (USD)", type: "number", value: x.amount },
      { key: "date",   label: "Fecha",       type: "date",   value: x.date },
      { key: "method", label: "Método",      type: "select", options: methodOptions, value: x.method },
      { key: "type",   label: "Concepto",    type: "select", options: ["anticipo", "abono", "final"],  value: x.type },
    ],
    onSave: async (vals) => { await supabase.from("payments").update(vals).eq("id", x.id); onRefresh(); toast("Ingreso actualizado."); },
    onDelete: async () => { await supabase.from("payments").delete().eq("id", x.id); onRefresh(); toast("Ingreso eliminado."); },
  });

  const openExpEdit = (x: Expense) => setEditor({
    title: "Editar egreso",
    fields: [
      { key: "payee_name", label: "Pagado a", type: "select", options: payeeOptions, value: x.payee_name },
      { key: "concept",    label: "Concepto", type: "text",   value: x.concept },
      { key: "amount",     label: "Monto (USD)", type: "number", value: x.amount },
      { key: "date",       label: "Fecha",    type: "date",   value: x.date },
      { key: "method",     label: "Método",   type: "select", options: methodOptions, value: x.method },
    ],
    onSave: async (vals) => { await supabase.from("expenses").update(vals).eq("id", x.id); onRefresh(); toast("Egreso actualizado."); },
    onDelete: async () => { await supabase.from("expenses").delete().eq("id", x.id); onRefresh(); toast("Egreso eliminado."); },
  });

  const activePay = activePayId ? payItems.find((p) => p.id === activePayId) : null;
  const activeExp = activeExpId ? expItems.find((x) => x.id === activeExpId) : null;

  return (
    <div className="max-w-[760px]">
      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-4"><div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">Ingresos</div><div className="mt-1.5 font-mono text-xl font-semibold text-[#4F8A63]">{money(inc)}</div></div>
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-4"><div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">Egresos</div><div className="mt-1.5 font-mono text-xl font-semibold text-[#B0492F]">{money(egr)}</div></div>
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-4"><div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">Por cobrar</div><div className="mt-1.5 font-mono text-xl font-semibold text-[#16323D]">{money(due)}</div></div>
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-4"><div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">Caja</div><div className="mt-1.5 font-mono text-xl font-semibold text-[#16323D]">{money(caja)}</div></div>
      </div>
      {paid && <div className="mb-4 flex items-center gap-2 rounded-2xl border border-[#DCEBDD] bg-[#E7F1E6] px-4 py-3 text-sm font-semibold text-[#4F8A63]">🎉 Cliente pagó por completo.</div>}

      {/* Sub-tabs */}
      <div className="mb-4 inline-flex rounded-xl border border-[#E6DDCB] bg-[#ECE3D1] p-1">
        {(["ingresos", "egresos"] as PaySubTab[]).map((t) => (
          <button key={t} onClick={() => setSubTab(t)} className={`rounded-lg px-5 py-2 text-sm font-bold transition capitalize ${subTab === t ? "bg-white text-[#16323D] shadow-sm" : "text-[#5C6A6E]"}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Lista de ingresos */}
      {subTab === "ingresos" && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handlePayDragStart} onDragEnd={handlePayDragEnd}>
          <SortableContext items={payItems.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {payItems.length === 0 && <p className="py-4 text-center text-sm text-[#97A1A0]">Sin ingresos registrados.</p>}
              {payItems.map((x) => (
                <SortableRow key={x.id} id={x.id}>
                  {({ listeners, attributes }, isDragging) => (
                    <div className={`flex items-center overflow-hidden rounded-[13px] border border-[#E6DDCB] bg-white transition ${isDragging ? "shadow-lg ring-1 ring-[#16323D]" : "hover:bg-[#F7F3EA]"}`}>
                      <DragHandle listeners={listeners} attributes={attributes} />
                      <button onClick={() => openPayEdit(x)} className="flex flex-1 items-center justify-between gap-2 py-3 pr-4 text-left">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-[#16323D]">
                            {x.method}
                            <span className="rounded bg-[#ECE3D1] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#5C6A6E]">{PAYMENT_TYPE_LABELS[x.type] ?? x.type}</span>
                          </div>
                          <div className="text-[11px] text-[#5C6A6E]">{dateFmt(x.date)}</div>
                        </div>
                        <span className="font-mono text-base font-semibold text-[#4F8A63]">+{money(x.amount)}</span>
                      </button>
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
              title: "Nuevo ingreso", sub: "Pago recibido del cliente.",
              fields: [
                { key: "amount", label: "Monto (USD)", type: "number", value: 0 },
                { key: "date",   label: "Fecha",       type: "date",   value: new Date().toISOString().split("T")[0] },
                { key: "method", label: "Método",      type: "select", options: methodOptions, value: "Transferencia" },
                { key: "type",   label: "Concepto",    type: "select", options: ["anticipo", "abono", "final"], value: "abono" },
              ],
              onSave: async (vals) => {
                if (Number(vals.amount) > 0) { await supabase.from("payments").insert({ project_id: project.id, ...vals }); onRefresh(); toast("Ingreso registrado."); }
              },
            })}
            className="mt-3 w-full rounded-[13px] border border-dashed border-[#D7CBB3] bg-[#ECE3D1] py-3 text-sm font-bold text-[#16323D] transition hover:border-[#16323D]"
          >
            + Registrar ingreso
          </button>
        </DndContext>
      )}

      {/* Lista de egresos */}
      {subTab === "egresos" && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleExpDragStart} onDragEnd={handleExpDragEnd}>
          <SortableContext items={expItems.map((x) => x.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {expItems.length === 0 && <p className="py-4 text-center text-sm text-[#97A1A0]">Sin egresos. Aquí van los pagos a especialistas y proveedores.</p>}
              {expItems.map((x) => (
                <SortableRow key={x.id} id={x.id}>
                  {({ listeners, attributes }, isDragging) => (
                    <div className={`flex items-center overflow-hidden rounded-[13px] border border-[#E6DDCB] bg-white transition ${isDragging ? "shadow-lg ring-1 ring-[#16323D]" : "hover:bg-[#F7F3EA]"}`}>
                      <DragHandle listeners={listeners} attributes={attributes} />
                      <button onClick={() => openExpEdit(x)} className="flex flex-1 items-center justify-between gap-2 py-3 pr-4 text-left">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-[#16323D]">
                            {x.payee_name}
                            <span className="rounded bg-[#ECE3D1] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#5C6A6E]">{x.method}</span>
                          </div>
                          <div className="text-[11px] text-[#5C6A6E]">{x.concept} · {dateFmt(x.date)}</div>
                        </div>
                        <span className="font-mono text-base font-semibold text-[#B0492F]">−{money(x.amount)}</span>
                      </button>
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
              title: "Nuevo egreso", sub: "Pago a un especialista o proveedor.",
              fields: [
                { key: "payee_name", label: "Pagado a", type: "select", options: payeeOptions, value: payeeOptions[1] ?? "Equipo propio" },
                { key: "concept",    label: "Concepto", type: "text",   value: "" },
                { key: "amount",     label: "Monto (USD)", type: "number", value: 0 },
                { key: "date",       label: "Fecha",    type: "date",   value: new Date().toISOString().split("T")[0] },
                { key: "method",     label: "Método",   type: "select", options: methodOptions, value: "Transferencia" },
              ],
              onSave: async (vals) => {
                if (Number(vals.amount) > 0) { await supabase.from("expenses").insert({ project_id: project.id, ...vals }); onRefresh(); toast("Egreso registrado."); }
              },
            })}
            className="mt-3 w-full rounded-[13px] border border-dashed border-[#D7CBB3] bg-[#ECE3D1] py-3 text-sm font-bold text-[#16323D] transition hover:border-[#16323D]"
          >
            + Registrar egreso
          </button>
        </DndContext>
      )}

      {editor && <EditorModal opts={editor} onClose={() => setEditor(null)} />}
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
  const [items, setItems] = useState<Task[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const persist = usePersistOrder("tasks");

  useEffect(() => {
    setItems([...tasks].sort((a, b) => a.sort_order - b.sort_order));
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Calendario secuencial
  const schedule = () => {
    let cum = 0;
    return items.map((t) => {
      const start = addDays(project.start_date, cum * 7);
      const end   = addDays(project.start_date, (cum + t.duration_weeks) * 7 - 1);
      const ws = cum;
      cum += t.duration_weeks;
      return { task: t, start, end, weekStart: ws };
    });
  };

  const total = Math.max(6, items.reduce((s, t) => s + t.duration_weeks, 0));
  const rows  = schedule();
  const activeTask = activeId ? items.find((t) => t.id === activeId) : null;

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
    toast("Plan reordenado — fechas recalculadas.");
  };

  const deleteTask = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    setConfirmDel(null); onRefresh(); toast("Actividad eliminada.");
  };

  return (
    <div className="max-w-[900px]">
      <p className="mb-4 text-xs text-[#5C6A6E]">
        Arrastra ⠿ para reordenar. Las fechas se recalculan automáticamente.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {rows.map(({ task: t, start, end, weekStart }) => {
              const left  = (weekStart / total) * 100;
              const width = (t.duration_weeks / total) * 100;

              return (
                <SortableRow key={t.id} id={t.id}>
                  {({ listeners, attributes }, isDragging) => (
                    <div
                      className={`grid items-center gap-3 overflow-hidden rounded-xl border bg-white transition-shadow ${isDragging ? "border-[#16323D] shadow-lg" : "border-[#E6DDCB]"}`}
                      style={{ gridTemplateColumns: "auto minmax(110px,170px) 1fr 34px" }}
                    >
                      <DragHandle listeners={listeners} attributes={attributes} />
                      <div className="py-2">
                        <div className="truncate text-[13px] font-semibold text-[#16323D]">{t.name}</div>
                        <div className="font-mono text-[10.5px] text-[#5C6A6E]">{dShort(start)}–{dShort(end)} · {t.hours}h</div>
                      </div>
                      {/* Gantt bar */}
                      <div className="relative h-5 overflow-hidden rounded-[6px] bg-[#ECE3D1]">
                        <div
                          className={`absolute top-0.5 h-4 rounded-[5px] px-1.5 text-[9.5px] font-bold ${COLORS[t.status]}`}
                          style={{ left: `${left}%`, width: `${Math.max(width, 5)}%` }}
                        >
                          S{weekStart + 1}
                        </div>
                      </div>
                      <button onClick={() => setConfirmDel(t.id)} className="mr-2 grid size-8 place-items-center rounded-lg border border-[#E6DDCB] bg-white text-[#B0492F] transition hover:bg-[#F0DBD2]" aria-label="Eliminar">🗑</button>
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
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-3 rounded bg-[#4F8A63]" /> Terminada</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-3 rounded bg-[#4E7A82]" /> En curso</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-3 rounded bg-[#D7CBB3]" /> Pendiente</span>
      </div>

      {confirmDel && (
        <ConfirmModal
          title="Eliminar actividad"
          body={`¿Eliminar "${items.find((t) => t.id === confirmDel)?.name}"?`}
          label="Eliminar"
          onConfirm={() => deleteTask(confirmDel)}
          onCancel={() => setConfirmDel(null)}
        />
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
  const [activeTab, setActiveTab] = useState<TabId>("workflow");
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const { msg: toastMsg, visible: toastVisible, show: showToast } = useToast();

  const fetchProject = useCallback(async () => {
    const { data, error } = await supabase
      .from("projects")
      .select(`*, tasks(*), materials(*), budget_items(*), payments(*), expenses(*), project_contacts(contact_id, contacts(*))`)
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
      {/* Cabecera */}
      <div className="mb-4">
        <button onClick={() => router.push("/proyectos")} className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#5C6A6E] transition hover:text-[#16323D]">
          <ArrowLeft size={15} /> Dashboard
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-[Manrope] text-2xl font-extrabold tracking-tight text-[#16323D]">{project.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-[#5C6A6E]">
              <StatusChip status={project.status} />
              <span>· {project.client}</span>
              <span>· {money(project.budget)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-0.5 overflow-x-auto border-b border-[#E6DDCB] [scrollbar-width:none]">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`relative whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition ${activeTab === t.id ? "text-[#16323D] after:absolute after:inset-x-2 after:-bottom-px after:h-[2.5px] after:rounded-full after:bg-[#16323D]" : "text-[#5C6A6E] hover:text-[#16323D]"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {activeTab === "workflow"    && <WorkflowTab    project={project} tasks={tasks} contacts={project.contacts} onRefresh={fetchProject} toast={showToast} />}
      {activeTab === "materiales"  && <MaterialesTab  project={project} materials={project.materials} onRefresh={fetchProject} toast={showToast} />}
      {activeTab === "contactos"   && <ContactosTab   project={project} contacts={project.contacts} allContacts={allContacts} onRefresh={fetchProject} toast={showToast} />}
      {activeTab === "presupuesto" && <PresupuestoTab project={project} budgetItems={project.budget_items} onRefresh={fetchProject} toast={showToast} />}
      {activeTab === "pagos"       && <PagosTab       project={project} payments={project.payments} expenses={project.expenses} contacts={project.contacts} onRefresh={fetchProject} toast={showToast} />}
      {activeTab === "plan"        && <PlanTab        project={project} tasks={tasks} onRefresh={fetchProject} toast={showToast} />}

      {/* Toast */}
      <div className={`fixed bottom-24 left-1/2 z-[200] -translate-x-1/2 max-w-sm w-full rounded-2xl bg-[#16323D] px-4 py-3 text-center text-sm font-medium text-white shadow-2xl transition-all duration-300 ${toastVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"}`}>
        {toastMsg}
      </div>
    </div>
  );
}
