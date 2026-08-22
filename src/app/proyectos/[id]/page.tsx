/**
 * Página de detalle de un proyecto (/proyectos/[id]).
 * Todos los tabs tienen Drag & Drop via @dnd-kit/sortable.
 * Los cambios de orden se persisten en Supabase.
 */
"use client";

import {
  useEffect, useState, useCallback, useMemo, useRef,
} from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ChevronLeft, ChevronRight, GripVertical, Plus, X, Paperclip, Trash2, Pencil, FileText, Image as ImageIcon, Copy, Camera,
  Calculator, Wallet, CalendarRange, BarChart3, ShoppingCart, Users, StickyNote, Wand2, Target, Check,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
  dShort, initials, depositAmounts, depositPct,
} from "@/src/lib/utils";
import { getEstadoCuentaBlob, getGanttPdfBlob, type GanttPdfRow } from "@/src/lib/pdf";
import PdfPreviewModal from "@/src/components/ui/PdfPreviewModal";
import { useFileUrls } from "@/src/components/ui/useFileUrls";
import { PRIVATE_BUCKET, privateRef } from "@/src/lib/files";
import {
  buildGanttScale, ganttBar, laneBg, isoOfDate, todayIsoLocal, ganttX, GanttHeader, TodayLine,
} from "@/src/components/ui/GanttCalendar";
import type {
  Project, Task, Material, Payment, Expense, Contact, ProjectNote, NoteAttachment, DepositEntry, ProjectObjective,
} from "@/src/types/project";
import ObjectivesModal from "@/src/components/ui/ObjectivesModal";
import { addProjectNote, noteDate } from "@/src/lib/notes";
import { computeEstimateTotals, type EstimateTotals } from "@/src/lib/estimateTotals";
import { useVoice } from "@/src/context/VoiceContext";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";
import EstimateTab from "@/src/components/ui/EstimateTab";
import DayPlannerModal from "@/src/components/ui/DayPlannerModal";
import ProjectPhotos from "@/src/components/ui/ProjectPhotos";
import QuickPhoto from "@/src/components/ui/QuickPhoto";
import DesignTab from "@/src/components/ui/DesignTab";
import ConfirmModal from "@/src/components/ui/ConfirmDialog";

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface ProjectFull extends Project {
  tasks: Task[];
  materials: Material[];
  payments: Payment[];
  expenses: Expense[];
  contacts: Contact[];
  project_notes: ProjectNote[];
}

type TabId = "materiales" | "contactos" | "presupuesto" | "planner" | "pagos" | "plan" | "fotos" | "notas" | "design";
type PaySubTab = "ingresos" | "egresos";

// Barra única de tabs (fondo del tema, el activo iluminado) — un ícono por tab
const TAB_ICONS: Record<TabId, LucideIcon> = {
  presupuesto: Calculator,
  pagos:       Wallet,
  planner:     CalendarRange,
  plan:        BarChart3,
  materiales:  ShoppingCart,
  contactos:   Users,
  fotos:       ImageIcon,
  notas:       StickyNote,
  design:      Wand2,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
// ─── Editor modal genérico ───────────────────────────────────────────────────
type FieldType = "text" | "number" | "date" | "select" | "textarea";
interface Field { key: string; label: string; type: FieldType; value: string | number; options?: string[]; optionLabels?: Record<string, string> }
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
        className="fixed inset-0 z-[100] flex items-end justify-center bg-[var(--brand)]/55 backdrop-blur-sm sm:items-center"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="w-full max-w-[460px] rounded-t-[22px] bg-[#F7F3EA] dark:bg-[#0b1220] p-6 shadow-2xl sm:rounded-[20px] max-h-[92vh] overflow-y-auto">
          <h3 className="mb-1 text-xl font-bold text-[var(--brand)]">{opts.title}</h3>
          {opts.sub && <p className="mb-4 text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">{opts.sub}</p>}
          <div className="space-y-3">
            {opts.fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E] dark:text-[#9fb0cc]">{f.label}</label>
                {f.type === "select" ? (
                  <select value={vals[f.key] as string} onChange={(e) => set(f.key, e.target.value)}
                    className="w-full rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-3 py-3 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none">
                    {f.options?.map((o) => <option key={o} value={o}>{f.optionLabels?.[o] ?? o}</option>)}
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
                    className="w-full rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-3 py-3 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none"
                  />
                ) : f.type === "textarea" ? (
                  <textarea
                    rows={3}
                    value={vals[f.key] as string}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="w-full resize-none rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-3 py-3 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none"
                  />
                ) : (
                  <input type={f.type} value={vals[f.key] as string}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="w-full rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-3 py-3 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none" />
                )}
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] py-3 font-bold text-[#5C6A6E] dark:text-[#9fb0cc]">Cancelar</button>
            <button onClick={() => setConfirmSave(true)} className="flex-1 rounded-xl bg-[var(--brand)] py-3 font-bold text-white">Guardar</button>
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
// TAB: MATERIALES con DnD
// ═══════════════════════════════════════════════════════════════════════════════
function MaterialesTab({
  project, materials, onRefresh, toast,
}: {
  project: Project; materials: Material[]; onRefresh: () => void; toast: (m: string) => void;
}) {
  const { t, language } = useLanguage();
  const EN = language === "en";
  const tp = t.panel;
  const [items, setItems] = useState<Material[]>(materials);
  const [editor, setEditor]         = useState<EditorOpts | null>(null);
  const [activeId, setActiveId]     = useState<string | null>(null);
  const [confirmDup, setConfirmDup] = useState<Material | null>(null);
  const [importing, setImporting]   = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting]     = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };

  const bulkDelete = async () => {
    const ids = [...selectedIds];
    setDeleting(true);
    const { error } = await supabase.from("materials").delete().in("id", ids);
    setDeleting(false);
    if (error) { toast("Error: " + error.message); return; }
    exitSelectMode();
    onRefresh();
    toast(EN
      ? `${ids.length} item${ids.length !== 1 ? "s" : ""} deleted`
      : `${ids.length} item${ids.length !== 1 ? "s" : ""} eliminados`
    );
  };

  const [origenMats, setOrigenMats] = useState(materials);
  if (origenMats !== materials) { setOrigenMats(materials); setItems(materials); }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const por = items.filter((m) => !m.bought).reduce((s, m) => s + m.cost, 0);
  const com = items.filter((m) => m.bought).reduce((s, m) => s + m.cost, 0);

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);
  const handleDragEnd   = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const next = arrayMove(items, items.findIndex((m) => m.id === active.id), items.findIndex((m) => m.id === over.id));
    setItems(next);
  };

  const openEdit = (m: Material) => {
    const yesLabel = tp.materials.yes;
    const noLabel  = tp.materials.no;
    setEditor({
      title: tp.materials.editMaterial,
      fields: [
        { key: "name",          label: tp.materials.material,      type: "text",     value: m.name },
        { key: "quantity",      label: EN ? "Quantity" : "Cantidad", type: "number", value: m.quantity ?? 1 },
        { key: "unit",          label: EN ? "Unit / Size" : "Unidad / Medida", type: "text", value: m.unit ?? "" },
        { key: "supplier",      label: tp.materials.supplier,      type: "text",     value: m.supplier },
        { key: "cost",          label: tp.materials.cost,          type: "number",   value: m.cost },
        { key: "purchase_date", label: EN ? "Purchase date" : "Fecha de compra", type: "date", value: m.purchase_date ?? "" },
        { key: "notes",         label: EN ? "Notes" : "Notas",    type: "textarea",  value: m.notes ?? "" },
        { key: "bought",        label: tp.materials.boughtQ,       type: "select",   options: [noLabel, yesLabel], value: m.bought ? yesLabel : noLabel },
      ],
      onSave: async (vals) => {
        const { error } = await supabase.from("materials").update({
          name: vals.name, supplier: vals.supplier, cost: vals.cost,
          quantity: vals.quantity || 1, unit: vals.unit, notes: vals.notes,
          purchase_date: vals.purchase_date || null,
          bought: vals.bought === yesLabel,
        }).eq("id", m.id);
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

  const handleToggleBought = async (m: Material) => {
    const newBought = !m.bought;
    if (newBought) {
      const today = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("expenses").insert({
        project_id: m.project_id,
        amount: m.cost,
        date: today,
        method: "Efectivo",
        payee_name: m.supplier || (EN ? "Material Purchase" : "Compra"),
        concept: m.name,
        material_id: m.id,
      });
      if (error) { toast("Error: " + error.message); return; }
      await supabase.from("materials").update({ bought: true }).eq("id", m.id);
      onRefresh();
      toast(EN ? "Purchased ✓ — expense recorded" : "Comprado ✓ — egreso registrado");
    } else {
      await supabase.from("expenses").delete().eq("material_id", m.id);
      await supabase.from("materials").update({ bought: false }).eq("id", m.id);
      onRefresh();
      toast(EN ? "Unmarked — expense removed" : "Desmarcado — egreso eliminado");
    }
  };

  const duplicateMaterial = async (m: Material) => {
    const { error } = await supabase.from("materials").insert({
      project_id: m.project_id, name: m.name, supplier: m.supplier, cost: m.cost,
      quantity: m.quantity ?? 1, unit: m.unit ?? "", notes: m.notes ?? "", bought: false,
    });
    if (error) { toast(tp.common.errorSaving + error.message); return; }
    onRefresh(); toast(tp.materials.materialAdded);
  };

  // ── Import items from Estimate ───────────────────────────────────────────────
  const importFromEstimate = async () => {
    setImporting(true);
    try {
      // Load estimate
      const { data: estimateRow } = await supabase
        .from("project_estimates")
        .select("id")
        .eq("project_id", project.id)
        .maybeSingle();

      if (!estimateRow) {
        toast(EN ? "No estimate found for this project." : "No hay estimado para este proyecto.");
        setImporting(false);
        return;
      }

      // Load only material-type sections + items
      const { data: sections } = await supabase
        .from("estimate_sections")
        .select("id, name_en, name_es, section_total, estimate_items(id, description, amount)")
        .eq("estimate_id", estimateRow.id)
        .eq("is_material_type", true);

      if (!sections || sections.length === 0) {
        toast(EN ? "Estimate has no items." : "El estimado no tiene items.");
        setImporting(false);
        return;
      }

      // Existing imported estimate_item_ids to avoid duplicates
      const existingIds = new Set(
        items.filter(m => m.estimate_item_id).map(m => m.estimate_item_id!)
      );

      type EstimateItem = { id: string; description: string; amount: number };
      type EstimateSection = {
        id: string; name_en: string; name_es: string; section_total: number;
        estimate_items: EstimateItem[];
      };

      const toInsert: object[] = [];
      (sections as EstimateSection[]).forEach((sec) => {
        const secName = EN ? sec.name_en : sec.name_es;
        const estItems = sec.estimate_items ?? [];
        if (estItems.length > 0) {
          estItems.forEach(item => {
            if (existingIds.has(item.id)) return;
            toInsert.push({
              project_id:          project.id,
              name:                `${EN ? "Purchase of" : "Compra de"} ${item.description}`,
              supplier:            "",
              cost:                item.amount,
              quantity:            1,
              unit:                "",
              notes:               `${EN ? "Section" : "Sección"}: ${secName}`,
              bought:              false,
              estimate_item_id:    item.id,
              estimate_section_id: sec.id,
            });
          });
        } else if (sec.section_total > 0 && !existingIds.has(sec.id)) {
          toInsert.push({
            project_id:          project.id,
            name:                `${EN ? "Purchase of" : "Compra de"} ${secName}`,
            supplier:            "",
            cost:                sec.section_total,
            quantity:            1,
            unit:                "",
            notes:               "",
            bought:              false,
            estimate_section_id: sec.id,
          });
        }
      });

      if (toInsert.length === 0) {
        toast(EN ? "All estimate items already imported." : "Todos los items ya fueron importados.");
        setImporting(false);
        return;
      }

      const { error } = await supabase.from("materials").insert(toInsert);
      if (error) { toast("Error: " + error.message); setImporting(false); return; }
      onRefresh();
      toast(EN
        ? `${toInsert.length} item${toInsert.length !== 1 ? "s" : ""} imported from Estimate`
        : `${toInsert.length} item${toInsert.length !== 1 ? "s" : ""} importados del Estimado`
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="w-full">
      {/* Resumen */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-[400px]">
        <div className="rounded-[13px] border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-3">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E] dark:text-[#9fb0cc]">{tp.materials.toBuy}</div>
          <div className="mt-1 font-mono text-lg font-semibold text-[var(--brand)]">{money(por)}</div>
        </div>
        <div className="rounded-[13px] border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-3">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E] dark:text-[#9fb0cc]">{tp.materials.bought}</div>
          <div className="mt-1 font-mono text-lg font-semibold text-[#4F8A63]">{money(com)}</div>
        </div>
      </div>

      {/* Import from Estimate */}
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#D5DEEF] dark:border-[#22304d] bg-[#EDF3FB] dark:bg-[#111a2e] px-4 py-3">
        <div className="flex-1">
          <div className="text-[12px] font-bold text-[var(--accent)]">
            {EN ? "Import from Estimate" : "Importar del Estimado"}
          </div>
          <div className="text-[10.5px] text-[#5C6A6E] dark:text-[#9fb0cc]">
            {EN
              ? "Adds estimate items as purchase orders (\"Purchase of …\"). Skips already-imported items."
              : "Agrega los items del estimado como órdenes de compra (\"Compra de …\"). Omite los ya importados."}
          </div>
        </div>
        <button
          onClick={importFromEstimate}
          disabled={importing}
          className="flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[var(--brand)] disabled:opacity-50"
        >
          {importing ? "…" : (EN ? "⬇ Import" : "⬇ Importar")}
        </button>
      </div>

      {/* Toolbar: select mode toggle + select-all */}
      <div className="mb-2 flex items-center gap-2">
        {!selectMode ? (
          <button
            onClick={() => setSelectMode(true)}
            className="flex items-center gap-1.5 rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-3 py-1.5 text-[11px] font-bold text-[#5C6A6E] dark:text-[#9fb0cc] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
          >
            ☑ {EN ? "Select" : "Seleccionar"}
          </button>
        ) : (
          <>
            <button
              onClick={() => setSelectedIds(selectedIds.size === items.length ? new Set() : new Set(items.map(m => m.id)))}
              className="rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-3 py-1.5 text-[11px] font-bold text-[#5C6A6E] dark:text-[#9fb0cc] transition hover:border-[var(--brand)]"
            >
              {selectedIds.size === items.length ? (EN ? "Deselect all" : "Quitar todo") : (EN ? "Select all" : "Seleccionar todo")}
            </button>
            <button onClick={exitSelectMode} className="rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-3 py-1.5 text-[11px] font-bold text-[#5C6A6E] dark:text-[#9fb0cc]">
              {EN ? "Cancel" : "Cancelar"}
            </button>
          </>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {items.map((m) => {
              const isSelected = selectedIds.has(m.id);
              return (
              <SortableRow key={m.id} id={m.id}>
                {({ listeners, attributes }, isDragging) => (
                  <div
                    onClick={() => selectMode ? toggleSelect(m.id) : openEdit(m)}
                    className={`flex cursor-pointer select-none items-start overflow-hidden rounded-[13px] border transition ${
                      isSelected ? "border-[#B0492F] bg-[#FDF3F1] ring-1 ring-[#B0492F]"
                        : isDragging ? "border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] shadow-lg ring-1 ring-[var(--brand)]"
                        : "border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e]"
                    } ${m.bought && !isSelected ? "opacity-65" : ""}`}
                  >
                    {/* Left: select checkbox (select mode) or drag handle */}
                    {selectMode ? (
                      <div className="flex items-center justify-center px-2 pt-3.5">
                        <span className={`grid size-6 flex-none place-items-center rounded-lg border-2 ${isSelected ? "border-[#B0492F] bg-[#B0492F]" : "border-[#D7CBB3] dark:border-[#2c3c5e]"}`}>
                          {isSelected && <span className="text-[10px] font-bold text-white">✓</span>}
                        </span>
                      </div>
                    ) : (
                      <div
                        {...listeners} {...attributes}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center justify-center px-2 pt-3.5 text-[#C4B89A] touch-none cursor-grab active:cursor-grabbing select-none"
                      >
                        <GripVertical size={15} />
                      </div>
                    )}
                    <div className="flex flex-1 items-start gap-3 py-3 pr-3">
                      <span
                        onClick={(e) => { e.stopPropagation(); handleToggleBought(m); }}
                        className={`mt-0.5 grid size-6 flex-none cursor-pointer place-items-center rounded-lg border-2 transition ${m.bought ? "border-[#4F8A63] bg-[#4F8A63]" : "border-[#D7CBB3] dark:border-[#2c3c5e] hover:border-[#4F8A63]"}`}
                      >
                        {m.bought && <span className="text-[10px] font-bold text-white">✓</span>}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5 flex-wrap">
                          {m.estimate_item_id && (
                            <span className="rounded-full bg-[#EDF3FB] dark:bg-[#111a2e] px-1.5 py-0.5 text-[8px] font-bold text-[var(--accent)]">
                              {EN ? "FROM EST" : "DEL EST"}
                            </span>
                          )}
                          <span className={`text-sm font-semibold ${m.bought ? "text-[#5C6A6E] dark:text-[#9fb0cc] line-through" : "text-[var(--brand)]"}`}>{m.name}</span>
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-2">
                          {((m.quantity && m.quantity !== 1) || m.unit) && (
                            <span className="text-[11px] font-semibold text-[#4E7A82]">
                              {m.quantity ?? 1}{m.unit ? ` × ${m.unit}` : ""}
                            </span>
                          )}
                          {m.supplier && <span className="text-[11px] text-[#97A1A0] dark:text-[#728098]">{m.supplier}</span>}
                          {m.purchase_date && (
                            <span className="rounded bg-[#F0EBE0] px-1.5 py-0.5 font-mono text-[10px] text-[#5C6A6E] dark:text-[#9fb0cc]">
                              📅 {m.purchase_date}
                            </span>
                          )}
                        </span>
                        {m.notes && (
                          <span className="mt-0.5 block truncate text-[10.5px] text-[#97A1A0] dark:text-[#728098]">{m.notes}</span>
                        )}
                      </span>
                      <span className="mt-0.5 font-mono text-sm font-semibold text-[var(--brand)] whitespace-nowrap">{money(m.cost)}</span>
                      {!selectMode && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDup(m); }}
                          className="mt-0.5 grid size-7 flex-none place-items-center rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] text-[#5C6A6E] dark:text-[#9fb0cc] transition hover:bg-[#ECE3D1] dark:hover:bg-[#17233d]"
                          aria-label="Duplicate"
                        >
                          <Copy size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </SortableRow>
            );
            })}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeMat && (
            <div className="flex items-center gap-3 rounded-[13px] border border-[var(--brand)] bg-white dark:bg-[#111a2e] px-3 py-3 shadow-2xl ring-1 ring-[var(--brand)]">
              <span className="text-sm font-semibold text-[var(--brand)]">{activeMat.name}</span>
              <span className="ml-auto font-mono text-sm font-semibold text-[var(--brand)]">{money(activeMat.cost)}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Bulk delete action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="sticky bottom-4 mt-4 flex items-center justify-between rounded-xl border border-[#F0C9C2] bg-[#FDF3F1] px-4 py-3 shadow-lg">
          <span className="text-sm font-semibold text-[#B0492F]">
            {selectedIds.size} {EN ? `item${selectedIds.size !== 1 ? "s" : ""} selected` : `item${selectedIds.size !== 1 ? "s" : ""} seleccionado${selectedIds.size !== 1 ? "s" : ""}`}
          </span>
          <div className="flex gap-2">
            <button onClick={exitSelectMode} className="rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] px-4 py-2 text-sm font-bold text-[#5C6A6E] dark:text-[#9fb0cc]">
              {EN ? "Cancel" : "Cancelar"}
            </button>
            <button
              onClick={() => setConfirmBulk(true)}
              disabled={deleting}
              className="rounded-xl bg-[#B0492F] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#8C3523] disabled:opacity-50"
            >
              {deleting ? "…" : (EN ? `Delete ${selectedIds.size}` : `Eliminar ${selectedIds.size}`)}
            </button>
          </div>
        </div>
      )}

      {confirmBulk && (
        <ConfirmModal
          title={EN ? "Delete materials" : "Eliminar materiales"}
          body={EN ? `${selectedIds.size} item(s) will be deleted. ${tp.common.cannotUndo}` : `Se eliminarán ${selectedIds.size} ítem(s). ${tp.common.cannotUndo}`}
          label={EN ? `Delete ${selectedIds.size}` : `Eliminar ${selectedIds.size}`}
          onConfirm={() => { setConfirmBulk(false); bulkDelete(); }}
          onCancel={() => setConfirmBulk(false)}
        />
      )}

      <button
        onClick={() => setEditor({
          title: tp.materials.newMaterial,
          fields: [
            { key: "name",          label: tp.materials.material,                     type: "text",     value: "" },
            { key: "quantity",      label: EN ? "Quantity" : "Cantidad",              type: "number",   value: 1 },
            { key: "unit",          label: EN ? "Unit / Size" : "Unidad / Medida",    type: "text",     value: "" },
            { key: "supplier",      label: tp.materials.supplier,                     type: "text",     value: "" },
            { key: "cost",          label: tp.materials.cost,                         type: "number",   value: 0 },
            { key: "purchase_date", label: EN ? "Purchase date" : "Fecha de compra",  type: "date",     value: "" },
            { key: "notes",         label: EN ? "Notes" : "Notas",                   type: "textarea", value: "" },
          ],
          onSave: async (vals) => {
            const { error } = await supabase.from("materials").insert({
              project_id: project.id,
              name: vals.name || tp.materials.material,
              supplier: vals.supplier || "",
              cost: vals.cost || 0,
              quantity: vals.quantity || 1,
              unit: vals.unit || "",
              notes: vals.notes || "",
              purchase_date: vals.purchase_date || null,
              bought: false,
            });
            if (error) { toast(tp.common.errorSaving + error.message); return; }
            onRefresh(); toast(tp.materials.materialAdded);
          },
        })}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-[#D7CBB3] dark:border-[#2c3c5e] bg-[#ECE3D1] dark:bg-[#17233d] px-4 py-3 text-sm font-bold text-[var(--brand)] transition hover:border-[var(--brand)]"
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
  const { t, language } = useLanguage();
  const tp = t.panel;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);

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
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-[#5C6A6E] dark:text-[#9fb0cc]">{tp.contacts.assigned}</span>
        <button
          onClick={() => setPickerOpen(true)}
          className="rounded-xl bg-[var(--brand)] px-4 py-2 text-xs font-bold text-white hover:bg-[#1e4455]"
        >
          {tp.contacts.addSpecialist}
        </button>
      </div>

      {contacts.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] p-10 text-center">
          <p className="text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">{tp.contacts.noAssigned}</p>
          <button
            onClick={() => setPickerOpen(true)}
            className="rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1e4455]"
          >
            {tp.contacts.addSpecialist}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-4 py-3 shadow-sm"
            >
              <span className="grid size-11 flex-none place-items-center rounded-[13px] bg-[var(--brand)] text-sm font-bold text-white">
                {initials(c.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-[var(--brand)]">{c.name}</div>
                {c.specialty && (
                  <div className="text-xs text-[#5C6A6E] dark:text-[#9fb0cc]">
                    {c.specialty}{c.rate ? ` · ${c.rate} ${c.rate_type === "day" ? t.panel.globalContacts.rateDay : t.panel.globalContacts.rateHour}` : ""}
                  </div>
                )}
              </div>
              <a
                href={`tel:${c.phone}`}
                className="inline-flex flex-none items-center gap-1.5 rounded-xl bg-[#DCEBDD] dark:bg-[#14261c] px-3 py-2 text-xs font-bold text-[#4F8A63]"
              >
                📞 {tp.contacts.call}
              </a>
              <button
                onClick={() => setConfirmRemove({ id: c.id, name: c.name })}
                disabled={busy === c.id}
                aria-label={tp.contacts.removeSpecialist}
                className="grid size-8 flex-none place-items-center rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] text-[#B0492F] transition hover:bg-[#FBE9E7] disabled:opacity-50"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {confirmRemove && (
        <ConfirmModal
          title={tp.contacts.removeSpecialist}
          body={`${language === "en" ? "Remove" : "Quitar"} "${confirmRemove.name}"? ${tp.common.cannotUndo}`}
          label={language === "en" ? "Remove" : "Quitar"}
          onConfirm={() => { const id = confirmRemove.id; setConfirmRemove(null); remove(id); }}
          onCancel={() => setConfirmRemove(null)}
        />
      )}

      {pickerOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[var(--brand)]/55 backdrop-blur-sm sm:items-center">
          <div className="flex max-h-[80vh] w-full max-w-[460px] flex-col rounded-t-[22px] bg-[#F7F3EA] dark:bg-[#0b1220] p-6 shadow-2xl sm:rounded-[20px]">
            <h3 className="mb-4 text-xl font-bold text-[var(--brand)]">
              {tp.contacts.pickerTitle}
            </h3>
            <input
              type="text"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder={tp.contacts.pickerSearch}
              className="mb-3 w-full rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-3 py-2.5 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none"
            />
            <div className="flex-1 space-y-2 overflow-y-auto">
              {available.length === 0 ? (
                <div className="py-8 text-center text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">
                  {tp.contacts.pickerEmpty}
                </div>
              ) : (
                available.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => assign(c.id)}
                    disabled={busy === c.id}
                    className="flex w-full items-center gap-3 rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-3 text-left transition hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220] disabled:opacity-50"
                  >
                    <span className="grid size-10 flex-none place-items-center rounded-[12px] bg-[var(--brand)] text-sm font-bold text-white">
                      {initials(c.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-[var(--brand)]">{c.name}</div>
                      {c.specialty && (
                        <div className="text-xs text-[#5C6A6E] dark:text-[#9fb0cc]">{c.specialty}</div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => { setPickerOpen(false); setPickerSearch(""); }}
              className="mt-4 w-full rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] py-3 font-bold text-[#5C6A6E] dark:text-[#9fb0cc]"
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
// TAB: PAGOS con DnD en cada sub-lista
// ═══════════════════════════════════════════════════════════════════════════════
function PagosTab({
  project, payments, expenses, contacts, onRefresh, toast, onSubTabChange,
}: {
  project: Project; payments: Payment[]; expenses: Expense[]; contacts: Contact[];
  onRefresh: () => void; toast: (m: string) => void;
  onSubTabChange?: (sub: PaySubTab) => void;
}) {
  const { t, language } = useLanguage();
  const EN = language === "en";
  const tp = t.panel;
  const [subTab, setSubTab] = useState<PaySubTab>("ingresos");
  const [pdfPreview, setPdfPreview] = useState<{ blob: Blob; filename: string } | null>(null);
  const changeSubTab = (t: PaySubTab) => { setSubTab(t); onSubTabChange?.(t); };

  const unmarkMaterial = async (x: Expense) => {
    if (!x.material_id) return;
    await supabase.from("materials").update({ bought: false }).eq("id", x.material_id);
    const { error } = await supabase.from("expenses").delete().eq("id", x.id);
    if (error) { toast("Error: " + error.message); return; }
    onRefresh();
    toast(EN ? "Material unmarked — expense removed" : "Material desmarcado — egreso eliminado");
  };
  const [payItems, setPayItems]     = useState<Payment[]>([...payments].reverse());
  const [expItems, setExpItems]     = useState<Expense[]>([...expenses].reverse());
  const [editor, setEditor]         = useState<EditorOpts | null>(null);
  const [activePayId, setActivePayId] = useState<string | null>(null);
  const [activeExpId, setActiveExpId] = useState<string | null>(null);

  const [origenPagos, setOrigenPagos] = useState(payments);
  if (origenPagos !== payments) { setOrigenPagos(payments); setPayItems([...payments].reverse()); }
  const [origenEgresos, setOrigenEgresos] = useState(expenses);
  if (origenEgresos !== expenses) { setOrigenEgresos(expenses); setExpItems([...expenses].reverse()); }

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
      if (x.material_id) {
        await supabase.from("materials").update({ bought: false }).eq("id", x.material_id);
      }
      const { error } = await supabase.from("expenses").delete().eq("id", x.id);
      if (error) { toast(tp.common.errorDeleting + error.message); return; }
      onRefresh(); toast(tp.payments.expenseDeleted);
    },
  });

  const activePay = activePayId ? payItems.find((p) => p.id === activePayId) : null;
  const activeExp = activeExpId ? expItems.find((x) => x.id === activeExpId) : null;

  const openAddIncome = () => setEditor({
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
      addProjectNote(project.id, language === "en"
        ? `💵 Payment received: ${money(Number(vals.amount))} (${vals.method}) — ${noteDate("en")}`
        : `💵 Ingreso recibido: ${money(Number(vals.amount))} (${vals.method}) — ${noteDate("es")}`);
      onRefresh(); toast(tp.payments.incomeRecorded);
    },
  });

  const openAddExpense = () => setEditor({
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
  });

  return (
    <div className="w-full">
      {/* Header: título + accesos directos +Ingreso / +Egreso */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-heading text-base font-bold text-[var(--brand)] dark:text-[#e8edf7]">{tp.payments.headerTitle}</h3>
        <div className="flex gap-2">
          <button onClick={openAddIncome} className="inline-flex items-center gap-1.5 rounded-xl bg-[#4F8A63] px-3.5 py-2 text-[13px] font-bold text-white transition hover:bg-[#437654]">
            <Plus size={15} /> {tp.payments.quickIncome}
          </button>
          <button onClick={openAddExpense} className="inline-flex items-center gap-1.5 rounded-xl bg-[#B0492F] px-3.5 py-2 text-[13px] font-bold text-white transition hover:bg-[#8C3523]">
            <Plus size={15} /> {tp.payments.quickExpense}
          </button>
        </div>
      </div>

      {/* KPIs — verde ingresos · rojo egresos · gris para el resto */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#CDE7D3] dark:border-[#1f3a2c] bg-[#EAF4EC] dark:bg-[#14261c] p-4"><div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#4F8A63]">{tp.payments.income}</div><div className="mt-1.5 font-mono text-xl font-semibold text-[#4F8A63]">{money(inc)}</div></div>
        <div className="rounded-2xl border border-[#F0C9C2] dark:border-[#3a1d17] bg-[#FBEDEA] dark:bg-[#2a1712] p-4"><div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#B0492F]">{tp.payments.expenses}</div><div className="mt-1.5 font-mono text-xl font-semibold text-[#B0492F]">{money(egr)}</div></div>
        <div className="rounded-2xl border border-[#E1E4E9] dark:border-[#22304d] bg-[#F2F4F7] dark:bg-[#111a2e] p-4"><div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E] dark:text-[#9fb0cc]">{tp.payments.outstanding}</div><div className="mt-1.5 font-mono text-xl font-semibold text-[var(--brand)] dark:text-[#e8edf7]">{money(due)}</div></div>
        <div className="rounded-2xl border border-[#E1E4E9] dark:border-[#22304d] bg-[#F2F4F7] dark:bg-[#111a2e] p-4"><div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E] dark:text-[#9fb0cc]">{tp.payments.balance}</div><div className="mt-1.5 font-mono text-xl font-semibold text-[var(--brand)] dark:text-[#e8edf7]">{money(caja)}</div></div>
      </div>
      {paid && <div className="mb-4 flex items-center gap-2 rounded-2xl border border-[#DCEBDD] dark:border-[#1f3a2c] bg-[#E7F1E6] px-4 py-3 text-sm font-semibold text-[#4F8A63]">🎉 {tp.payments.paidFull}</div>}

      {/* Sub-tabs + export */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#ECE3D1] dark:bg-[#17233d] p-1">
          {(["ingresos", "egresos"] as PaySubTab[]).map((sub) => (
            <button key={sub} onClick={() => changeSubTab(sub)} className={`rounded-lg px-5 py-2 text-sm font-bold transition ${subTab === sub ? "bg-white dark:bg-[#111a2e] text-[var(--brand)] shadow-sm" : "text-[#5C6A6E] dark:text-[#9fb0cc]"}`}>
              {sub === "ingresos" ? tp.payments.incomeTab : tp.payments.expensesTab}
            </button>
          ))}
        </div>
        <button
          onClick={() => setPdfPreview(getEstadoCuentaBlob(project, payments, expenses))}
          className="inline-flex items-center gap-2 rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-4 py-2 text-sm font-bold text-[var(--brand)] transition hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]"
        >
          ↓ {tp.payments.exportStatement}
        </button>
      </div>

      {/* Lista de ingresos */}
      {subTab === "ingresos" && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handlePayDragStart} onDragEnd={handlePayDragEnd}>
          <SortableContext items={payItems.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {payItems.length === 0 && <p className="py-4 text-center text-sm text-[#97A1A0] dark:text-[#728098]">{tp.payments.noIncome}</p>}
              {payItems.map((x) => (
                <SortableRow key={x.id} id={x.id}>
                  {({ listeners, attributes }, isDragging) => (
                    <div
                      {...listeners} {...attributes}
                      onClick={() => openPayEdit(x)}
                      className={`flex cursor-pointer select-none items-center overflow-hidden rounded-[13px] border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] transition ${isDragging ? "shadow-lg ring-1 ring-[var(--brand)]" : "hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]"}`}
                    >
                      <DragHandle />
                      <div className="flex flex-1 items-center justify-between gap-2 py-3 pr-4">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--brand)]">
                            {x.method}
                            <span className="rounded bg-[#ECE3D1] dark:bg-[#17233d] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#5C6A6E] dark:text-[#9fb0cc]">{tp.paymentType[x.type as keyof typeof tp.paymentType] ?? x.type}</span>
                          </div>
                          <div className="text-[11px] text-[#5C6A6E] dark:text-[#9fb0cc]">{dateFmt(x.date)}</div>
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
              <div className="flex items-center justify-between gap-2 rounded-[13px] border border-[var(--brand)] bg-white dark:bg-[#111a2e] px-4 py-3 shadow-2xl">
                <span className="text-sm font-semibold text-[var(--brand)]">{activePay.method}</span>
                <span className="font-mono text-base font-semibold text-[#4F8A63]">+{money(activePay.amount)}</span>
              </div>
            )}
          </DragOverlay>
          <button
            onClick={openAddIncome}
            className="mt-3 w-full rounded-[13px] border border-dashed border-[#D7CBB3] dark:border-[#2c3c5e] bg-[#ECE3D1] dark:bg-[#17233d] py-3 text-sm font-bold text-[var(--brand)] transition hover:border-[var(--brand)]"
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
              {expItems.length === 0 && <p className="py-4 text-center text-sm text-[#97A1A0] dark:text-[#728098]">{tp.payments.noExpenses}</p>}
              {expItems.map((x) => (
                <SortableRow key={x.id} id={x.id}>
                  {({ listeners, attributes }, isDragging) => (
                    <div
                      {...listeners} {...attributes}
                      onClick={() => openExpEdit(x)}
                      className={`flex cursor-pointer select-none items-center overflow-hidden rounded-[13px] border transition ${x.material_id ? "border-[#D5DEEF] dark:border-[#22304d] bg-[#F4F8FE]" : "border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e]"} ${isDragging ? "shadow-lg ring-1 ring-[var(--brand)]" : "hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]"}`}
                    >
                      <DragHandle />
                      <div className="flex flex-1 items-center justify-between gap-2 py-3 pr-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-[var(--brand)]">
                            {x.material_id && (
                              <span className="rounded-full bg-[#EDF3FB] dark:bg-[#111a2e] px-1.5 py-0.5 text-[8px] font-bold text-[var(--accent)]">
                                {EN ? "FROM MAT" : "DEL MAT"}
                              </span>
                            )}
                            {x.payee_name}
                            <span className="rounded bg-[#ECE3D1] dark:bg-[#17233d] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#5C6A6E] dark:text-[#9fb0cc]">{x.method}</span>
                          </div>
                          <div className="text-[11px] text-[#5C6A6E] dark:text-[#9fb0cc]">{x.concept} · {dateFmt(x.date)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {x.material_id && (
                            <button
                              onClick={(e) => { e.stopPropagation(); unmarkMaterial(x); }}
                              className="rounded-lg border border-[#D5DEEF] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-2 py-1 text-[10px] font-bold text-[var(--accent)] transition hover:bg-[#EDF3FB] dark:hover:bg-[#111a2e]"
                            >
                              ↩ {EN ? "Unmark" : "Desmarcar"}
                            </button>
                          )}
                          <span className="font-mono text-base font-semibold text-[#B0492F]">−{money(x.amount)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </SortableRow>
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={dropAnimation}>
            {activeExp && (
              <div className="flex items-center justify-between gap-2 rounded-[13px] border border-[var(--brand)] bg-white dark:bg-[#111a2e] px-4 py-3 shadow-2xl">
                <span className="text-sm font-semibold text-[var(--brand)]">{activeExp.payee_name}</span>
                <span className="font-mono text-base font-semibold text-[#B0492F]">−{money(activeExp.amount)}</span>
              </div>
            )}
          </DragOverlay>
          <button
            onClick={openAddExpense}
            className="mt-3 w-full rounded-[13px] border border-dashed border-[#D7CBB3] dark:border-[#2c3c5e] bg-[#ECE3D1] dark:bg-[#17233d] py-3 text-sm font-bold text-[var(--brand)] transition hover:border-[var(--brand)]"
          >
            + {tp.payments.registerExpense}
          </button>
        </DndContext>
      )}

      {editor && <EditorModal opts={editor} onClose={() => setEditor(null)} />}
      {pdfPreview && <PdfPreviewModal blob={pdfPreview.blob} filename={pdfPreview.filename} title={tp.payments.headerTitle} onClose={() => setPdfPreview(null)} />}
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
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E] dark:text-[#9fb0cc]">Activity</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-3 py-3 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E] dark:text-[#9fb0cc]">Start date</label>
          <input type="date" value={sDate} onChange={(e) => setSDate(e.target.value)}
            className="w-full rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-3 py-3 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none" />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E] dark:text-[#9fb0cc]">End date</label>
          <input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)}
            className="w-full rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-3 py-3 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none" />
        </div>
      </div>
      <div className="text-xs text-[#5C6A6E] dark:text-[#9fb0cc]">Duration: ~{Math.round(durationDays / 7)} weeks ({durationDays} days)</div>
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E] dark:text-[#9fb0cc]">Estimated hours</label>
        <input type="number" min={0} value={hours} onChange={(e) => setHours(Number(e.target.value))}
          className="w-full rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-3 py-3 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none" />
      </div>
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E] dark:text-[#9fb0cc]">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as "pend" | "prog" | "done")}
          className="w-full rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-3 py-3 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none">
          <option value="pend">To do</option>
          <option value="prog">In progress</option>
          <option value="done">Done</option>
        </select>
      </div>
      <div className="mt-5 flex gap-3">
        <button onClick={onClose} className="flex-1 rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] py-3 font-bold text-[#5C6A6E] dark:text-[#9fb0cc]">Cancel</button>
        <button onClick={() => onSave({ name, hours, durationDays, status, startDate: sDate, endDate: eDate })} className="flex-1 rounded-xl bg-[var(--accent)] py-3 font-bold text-white">Save</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PLAN GANTT con DnD (@dnd-kit)
// ═══════════════════════════════════════════════════════════════════════════════
function PlanTab({
  project, tasks, contacts, onRefresh, toast,
}: {
  project: Project; tasks: Task[]; contacts: Contact[]; onRefresh: () => void; toast: (m: string) => void;
}) {
  const { t, language } = useLanguage();
  const tp = t.panel;
  const [items, setItems] = useState<Task[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [ganttUnit, setGanttUnit] = useState<"week" | "day">("day");
  const [filterStatus, setFilterStatus] = useState<"all" | "pend" | "prog" | "done">("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [editTask, setEditTask] = useState<{ task: { task: Task; start: Date; end: Date; weekStart: number }; startDate: Date; endDate: Date } | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ blob: Blob; filename: string } | null>(null);
  const persist = usePersistOrder("tasks");
  const scrollRef = useRef<HTMLDivElement>(null);

  const [origenTareas, setOrigenTareas] = useState(tasks);
  if (origenTareas !== tasks) {
    setOrigenTareas(tasks);
    setItems([...tasks].sort((a, b) => a.sort_order - b.sort_order));
  }

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
      // Day Planner tasks (source estimate/planner) abarcan su duración en días (multi-día);
      // por defecto 1. El resto usa duration_weeks × 7.
      const isFromPlanner = t.source === "estimate" || t.source === "planner";
      const effectiveDays = isFromPlanner && hasScheduledDate ? Math.max(1, t.duration_days ?? 1) : t.duration_weeks * 7;
      const end = new Date(start.getTime() + (effectiveDays - 1) * 86400000);
      const dayStart = Math.max(0, Math.round((start.getTime() - projectStart.getTime()) / 86400000));
      if (!hasScheduledDate) cumDays = dayStart + effectiveDays;
      return { task: t, start, end, dayStart, durationDays: effectiveDays };
    });
  };

  const rows  = schedule();
  const ownTeamLabel = tp.workflow.ownTeam ?? "Own team";
  const assigneeOptions = [
    { value: "all", label: "All assignees" },
    { value: "own", label: ownTeamLabel },
    ...contacts.map((c) => ({ value: c.id, label: c.name })),
  ];
  const filteredRows = rows
    .filter((r) => filterStatus === "all" || r.task.status === filterStatus)
    .filter((r) => {
      if (filterAssignee === "all") return true;
      if (filterAssignee === "own") return !r.task.assigned_contact_id;
      return r.task.assigned_contact_id === filterAssignee;
    });
  const activeTask = activeId ? items.find((t) => t.id === activeId) : null;

  const openGanttPdf = () => {
    if (!filteredRows.length) { toast(language === "en" ? "No tasks to export" : "No hay tareas para exportar"); return; }
    const pct: Record<string, number> = { done: 100, prog: 50, pend: 0 };
    const pdfRows: GanttPdfRow[] = filteredRows.map((r) => ({
      name: r.task.name,
      start: isoOfDate(r.start),
      end: isoOfDate(r.end),
      status: r.task.status,
      progress: pct[r.task.status] ?? 0,
    }));
    setPdfPreview(getGanttPdfBlob(project, pdfRows, language));
  };

  // Escala calendario (columna real por día/semana) — rango desde todas las tareas
  let minIso = isoOfDate(projectStart);
  let maxIso = minIso;
  rows.forEach(r => {
    const s = isoOfDate(r.start), e = isoOfDate(r.end);
    if (s < minIso) minIso = s;
    if (e > maxIso) maxIso = e;
  });
  const scale = buildGanttScale(minIso, maxIso, ganttUnit);

  // Al montar o cambiar de escala, enfocar el scroll cerca de hoy
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = Math.max(0, ganttX(scale, todayIsoLocal()) - 200);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ganttUnit, items.length]);

  const COLORS: Record<string, string> = {
    done: "bg-gradient-to-r from-[#4F8A63] to-[#69a67e] text-white",
    prog: "bg-gradient-to-r from-[#4E7A82] to-[#5e8c94] text-white",
    pend: "bg-[#D7CBB3] dark:bg-[#17233d] text-[#5C6A6E] dark:text-[#9fb0cc]",
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
    <div className="w-full">
      {/* Gantt header claro: título a la izquierda, controles a la derecha (mismo patrón que Estimate) */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-5 py-3">
        <div>
          <h2 className="font-bookman text-base font-semibold text-[var(--brand)] dark:text-[#e8edf7]">{tp.tabs.plan}</h2>
          <p className="text-[11px] text-[#97A1A0] dark:text-[#728098]">{tp.plan.hint}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <div className="inline-flex rounded-lg border border-[#E6DDCB] dark:border-[#2c3c5e] bg-[#F7F3EA] dark:bg-[#0b1220] p-0.5">
            {([
              { key: "all",  label: "All" },
              { key: "pend", label: tp.workflow.colPend },
              { key: "prog", label: tp.workflow.colProg },
              { key: "done", label: tp.workflow.colDone },
            ] as const).map(({ key, label }) => (
              <button key={key} onClick={() => setFilterStatus(key)}
                className={`rounded-md px-3 py-1 text-[11px] font-bold transition ${filterStatus === key ? "bg-[var(--accent)] text-white" : "text-[#5C6A6E] dark:text-[#9fb0cc] hover:text-[var(--brand)]"}`}>
                {label}
              </button>
            ))}
          </div>
          {/* Assignee filter */}
          {contacts.length > 0 && (
            <select
              value={filterAssignee}
              onChange={e => setFilterAssignee(e.target.value)}
              className="rounded-lg border border-[#E6DDCB] dark:border-[#2c3c5e] bg-[#F7F3EA] dark:bg-[#0b1220] px-2 py-1.5 text-[11px] font-semibold text-[#5C6A6E] dark:text-[#9fb0cc] focus:border-[var(--accent)] focus:outline-none"
            >
              {assigneeOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          {/* Weeks / Days toggle */}
          <div className="inline-flex rounded-lg border border-[#E6DDCB] dark:border-[#2c3c5e] bg-[#F7F3EA] dark:bg-[#0b1220] p-0.5">
            {(["week", "day"] as const).map((u) => (
              <button key={u} onClick={() => setGanttUnit(u)}
                className={`rounded-md px-3 py-1 text-[11px] font-bold capitalize transition ${ganttUnit === u ? "bg-[var(--accent)] text-white" : "text-[#5C6A6E] dark:text-[#9fb0cc] hover:text-[var(--brand)]"}`}>
                {u === "week" ? "Weeks" : "Days"}
              </button>
            ))}
          </div>
          {/* PDF (landscape, con vista previa) */}
          <button onClick={openGanttPdf}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6DDCB] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-3 py-1.5 text-[11px] font-bold text-[var(--brand)] dark:text-[#e8edf7] transition hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]">
            <FileText size={13} /> PDF
          </button>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-10 text-center text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">
          {tp.globalPlan.noTasks}
        </div>
      ) : (
      <div ref={scrollRef} className="overflow-x-auto rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] [scrollbar-width:thin]">
        <div className="w-max min-w-full">
          <GanttHeader
            scale={scale}
            EN={language === "en"}
            leftWidth={300}
            leftHeader={
              <div className="flex h-full items-center border-r border-white/10 px-3 text-[9px] font-bold uppercase tracking-wider text-white/70">
                {tp.workflow.activity}
              </div>
            }
          />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={filteredRows.map((r) => r.task.id)} strategy={verticalListSortingStrategy}>
            {filteredRows.map(({ task: t, start, end, dayStart }) => {
              const bar = ganttBar(scale, isoOfDate(start), isoOfDate(end));

              return (
                <SortableRow key={t.id} id={t.id}>
                  {({ listeners, attributes }, isDragging) => (
                    <div
                      className={`flex items-stretch border-b border-[#F0EBE0] dark:border-[#22304d] ${isDragging ? "bg-white dark:bg-[#111a2e] shadow-lg ring-1 ring-[var(--brand)]" : ""}`}
                      style={{ width: 300 + scale.laneWidth }}
                    >
                      <div
                        {...listeners} {...attributes}
                        className="sticky left-0 z-10 flex shrink-0 select-none items-center border-r border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e]"
                        style={{ width: 300 }}
                      >
                        <DragHandle />
                        <div className="min-w-0 flex-1 py-1.5">
                          <div className="truncate text-[12px] font-semibold uppercase tracking-wide text-[var(--brand)]">{t.name}</div>
                          <div className="truncate font-mono text-[10px] text-[#5C6A6E] dark:text-[#9fb0cc]">
                            {dShort(start)}–{dShort(end)} · {t.hours}h
                            {t.assigned_contact_id && (
                              <span className="ml-1 font-sans not-italic">· {contacts.find(c => c.id === t.assigned_contact_id)?.name ?? ""}</span>
                            )}
                          </div>
                        </div>
                        <div className="mr-1.5 flex gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditTask({ task: { task: t, start, end, weekStart: dayStart }, startDate: start, endDate: end }); }}
                            className="grid size-7 place-items-center rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] text-[#5C6A6E] dark:text-[#9fb0cc] transition hover:bg-[#ECE3D1] dark:hover:bg-[#17233d]"
                            aria-label="Edit"
                          >
                            <Pencil size={12} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDel(t.id); }} className="grid size-7 place-items-center rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] text-[#B0492F] transition hover:bg-[#F0DBD2] dark:hover:bg-[#2a1712]" aria-label="Delete">🗑</button>
                        </div>
                      </div>

                      {/* Carril calendario — sáb/dom coloreados, línea de hoy */}
                      <div className="relative min-h-[44px] shrink-0" style={{ width: scale.laneWidth, ...laneBg(scale) }}>
                        <TodayLine scale={scale} />
                        <div
                          className={`absolute top-1/2 h-[14px] -translate-y-1/2 overflow-hidden rounded-[5px] px-1 text-[8.5px] font-bold leading-[14px] shadow-sm ${COLORS[t.status]}`}
                          style={{ left: bar.left, width: bar.width }}
                        >
                          {bar.width > 56 ? dShort(start) : ""}
                        </div>
                      </div>
                    </div>
                  )}
                </SortableRow>
              );
            })}
        </SortableContext>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeTask && (
            <div className="rounded-xl border border-[var(--brand)] bg-white dark:bg-[#111a2e] px-4 py-3 shadow-2xl ring-1 ring-[var(--brand)]">
              <div className="text-sm font-semibold text-[var(--brand)]">{activeTask.name}</div>
              <div className="font-mono text-[11px] text-[#5C6A6E] dark:text-[#9fb0cc]">{activeTask.hours}h · {activeTask.duration_weeks}w</div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
        </div>
      </div>
      )}

      {/* Leyenda */}
      <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-[#5C6A6E] dark:text-[#9fb0cc]">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-3 rounded bg-[#4F8A63]" /> {tp.plan.done}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-3 rounded bg-[#4E7A82]" /> {tp.plan.inProgress}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-3 rounded bg-[#D7CBB3] dark:bg-[#17233d]" /> {tp.plan.pending}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-4 rounded border border-[#9DC3E6] bg-[#DCEBF7]" /> {language === "en" ? "Saturday" : "Sábado"}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-4 rounded border border-[#F4B183] bg-[#FBE5D3]" /> {language === "en" ? "Sunday" : "Domingo"}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-[2px] bg-[#B0492F]/70" /> {language === "en" ? "Today" : "Hoy"}</span>
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
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[var(--brand)]/55 backdrop-blur-sm sm:items-center"
          onClick={(e) => { if (e.target === e.currentTarget) setEditTask(null); }}>
          <div className="w-full max-w-[460px] overflow-y-auto rounded-t-[22px] bg-[#F7F3EA] dark:bg-[#0b1220] p-6 shadow-2xl sm:rounded-[20px] max-h-[90vh]">
            <h3 className="mb-4 text-xl font-bold text-[var(--brand)]">Edit task</h3>
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

      {pdfPreview && <PdfPreviewModal blob={pdfPreview.blob} filename={pdfPreview.filename} title={tp.tabs.plan} onClose={() => setPdfPreview(null)} />}
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
  // Los adjuntos privados se muestran con enlace firmado
  const fileUrl = useFileUrls(notes.flatMap(n => (n.attachments ?? []).map(a => a.url)));
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
      // Los adjuntos de notas son documentos del cliente: bucket privado.
      const path = `notes/${noteId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from(PRIVATE_BUCKET).upload(path, file, { upsert: true });
      if (error) { toast(`No se pudo subir "${file.name}": ${error.message}`); continue; }
      const type = file.type.startsWith("image/") ? "image" : file.type === "application/pdf" ? "pdf" : "other";
      out.push({ name: file.name, url: privateRef(path), type, size: file.size });
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
    <div className="w-full space-y-4">
      {/* Add note button */}
      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-xl border border-dashed border-[#D7CBB3] dark:border-[#2c3c5e] bg-[#ECE3D1] dark:bg-[#17233d] px-4 py-3 text-sm font-bold text-[var(--brand)] transition hover:border-[var(--brand)]"
        >
          <Plus size={14} /> {tp.notes.addNote}
        </button>
      )}

      {/* New note form */}
      {adding && (
        <div className="rounded-2xl border border-[#4E7A82] bg-white dark:bg-[#111a2e] p-4 shadow-sm">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder={tp.notes.placeholder}
            rows={3}
            className="mb-3 w-full resize-none rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 py-2.5 text-sm text-[var(--brand)] placeholder:text-[#97A1A0] dark:placeholder:text-[#728098] focus:border-[var(--brand)] focus:outline-none"
          />
          {/* File preview */}
          {newFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {newFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-2 py-1 text-[11px] text-[#5C6A6E] dark:text-[#9fb0cc]">
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
              className="flex items-center gap-1.5 rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 py-2 text-xs font-semibold text-[#5C6A6E] dark:text-[#9fb0cc] transition hover:bg-[#ECE3D1] dark:hover:bg-[#17233d]"
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
                className="rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] px-4 py-2 text-sm font-bold text-[#5C6A6E] dark:text-[#9fb0cc]">
                {tp.common.cancel}
              </button>
              <button
                onClick={handleAdd}
                disabled={uploading || (!newContent.trim() && newFiles.length === 0)}
                className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {uploading ? tp.notes.saving : tp.common.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes list */}
      {sorted.length === 0 && !adding && (
        <div className="rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-10 text-center text-sm text-[#97A1A0] dark:text-[#728098]">
          {tp.notes.empty}
        </div>
      )}

      {sorted.map((note) => (
        <div key={note.id} className="rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-4 shadow-sm">
          {/* Editing inline */}
          {editingNote?.id === note.id ? (
            <>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
                className="mb-3 w-full resize-none rounded-xl border border-[#4E7A82] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 py-2.5 text-sm text-[var(--brand)] focus:outline-none"
              />
              {/* Existing attachments */}
              {note.attachments?.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {note.attachments.map((a, i) => (
                    <div key={i} className="group relative">
                      {a.type === "image"
                        ? <img src={fileUrl(a.url)} alt={a.name} className="h-14 w-14 rounded-lg object-cover border border-[#E6DDCB] dark:border-[#22304d]" />
                        : <a href={fileUrl(a.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-2 py-1 text-[11px] text-[#4E7A82]"><FileText size={11}/>{a.name}</a>
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
                    <div key={i} className="flex items-center gap-1 rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-2 py-1 text-[11px] text-[#5C6A6E] dark:text-[#9fb0cc]">
                      {f.type.startsWith("image/") ? <ImageIcon size={10}/> : <FileText size={10}/>}
                      <span className="max-w-[100px] truncate">{f.name}</span>
                      <button onClick={() => setEditFiles(p => p.filter((_, j) => j !== i))}><X size={9} className="text-[#B0492F]"/></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button onClick={() => editFileRef.current?.click()} className="flex items-center gap-1 rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] px-3 py-2 text-xs font-semibold text-[#5C6A6E] dark:text-[#9fb0cc]">
                  <Paperclip size={11}/> {tp.notes.attachMore}
                </button>
                <input ref={editFileRef} type="file" accept="image/*,application/pdf" capture="environment" multiple className="hidden"
                  onChange={(e) => { if (e.target.files) setEditFiles(p => [...p, ...Array.from(e.target.files!)]); }} />
                <div className="ml-auto flex gap-2">
                  <button onClick={() => setEditingNote(null)} className="rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] px-3 py-2 text-sm font-bold text-[#5C6A6E] dark:text-[#9fb0cc]">{tp.common.cancel}</button>
                  <button onClick={handleSaveEdit} disabled={uploading} className="rounded-xl bg-[var(--brand)] px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
                    {uploading ? "…" : tp.common.save}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Note content */}
              {note.content && <p className="mb-3 whitespace-pre-wrap text-sm text-[var(--brand)]">{note.content}</p>}
              {/* Attachments */}
              {note.attachments?.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {note.attachments.map((a, i) => (
                    a.type === "image"
                      ? <a key={i} href={fileUrl(a.url)} target="_blank" rel="noopener noreferrer">
                          <img src={fileUrl(a.url)} alt={a.name} className="h-16 w-16 rounded-xl object-cover border border-[#E6DDCB] dark:border-[#22304d] transition hover:opacity-90" />
                        </a>
                      : <a key={i} href={fileUrl(a.url)} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 py-2 text-[12px] font-medium text-[#4E7A82] transition hover:bg-[#DCE8E9] dark:hover:bg-[#122a2c]">
                          <FileText size={13}/>{a.name}
                        </a>
                  ))}
                </div>
              )}
              {/* Footer */}
              <div className="flex items-center justify-between border-t border-[#F0EBE0] dark:border-[#22304d] pt-2">
                <span className="text-[11px] text-[#97A1A0] dark:text-[#728098]">{dateFmt(note.created_at ?? "")}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setPinPrompt({ action: "edit", note }); setPinValue(""); setPinError(""); }}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[#4E7A82] transition hover:bg-[#DCE8E9] dark:hover:bg-[#122a2c]"
                  >
                    <Pencil size={11}/> {tp.common.edit}
                  </button>
                  <button
                    onClick={() => { setPinPrompt({ action: "delete", note }); setPinValue(""); setPinError(""); }}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[#B0492F] transition hover:bg-[#F0DBD2] dark:hover:bg-[#2a1712]"
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
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-[var(--brand)]/55 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-[360px] rounded-t-[22px] bg-[#F7F3EA] dark:bg-[#0b1220] p-6 shadow-2xl sm:rounded-[20px]">
            <h3 className="mb-1 text-base font-bold text-[var(--brand)]">
              {pinPrompt.action === "delete" ? tp.notes.deleteNote : tp.notes.confirmEdit}
            </h3>
            <p className="mb-4 text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">{tp.notes.pinPrompt}</p>
            <div className="mb-1 flex justify-center gap-3">
              {Array.from({ length: Math.max(4, pinValue.length) }, (_, i) => (
                <div key={i} className={`size-3 rounded-full transition ${pinValue.length > i ? "bg-[var(--brand)]" : "bg-[#D7CBB3] dark:bg-[#17233d]"}`} />
              ))}
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              autoFocus
              value={pinValue}
              onChange={(e) => { setPinValue(e.target.value.replace(/\D/g,"").slice(0,8)); setPinError(""); }}
              onKeyDown={(e) => e.key === "Enter" && pinValue.length >= 4 && verifyPin()}
              className="mb-2 h-11 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] text-center font-mono text-xl tracking-[.6em] text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none"
              placeholder="••••••"
            />
            {pinError && <p className="mb-2 text-center text-xs font-semibold text-[#B0492F]">{pinError}</p>}
            <div className="flex gap-3 mt-2">
              <button onClick={() => { setPinPrompt(null); setPinValue(""); setPinError(""); }}
                className="flex-1 rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] py-3 font-bold text-[#5C6A6E] dark:text-[#9fb0cc]">{tp.common.cancel}</button>
              <button onClick={verifyPin} disabled={pinValue.length < 4}
                className={`flex-1 rounded-xl py-3 font-bold text-white disabled:opacity-40 ${pinPrompt.action === "delete" ? "bg-[#B0492F]" : "bg-[var(--brand)]"}`}>
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
// TAB: PLANNER — Day Planner embebido (desde Estimate)
// ═══════════════════════════════════════════════════════════════════════════════
function PlannerTab({
  project, onRefresh, toast,
}: {
  project: Project; onRefresh: () => void; toast: (m: string) => void;
}) {
  const { language } = useLanguage();
  const EN = language === "en";
  interface EstSection {
    id: string; name_en: string; name_es: string;
    is_material_type: boolean; section_total: number;
    items: { id: string; description: string; amount: number }[];
  }
  const [estimate, setEstimate] = useState<{ sections: EstSection[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: estRow } = await supabase
        .from("project_estimates").select("id").eq("project_id", project.id).maybeSingle();
      if (!estRow) { setLoading(false); return; }
      const { data: sections } = await supabase
        .from("estimate_sections")
        .select("id, name_en, name_es, is_material_type, section_total, estimate_items(id, description, amount)")
        .eq("estimate_id", estRow.id)
        .order("sort_order", { ascending: true });
      const mapped: EstSection[] = (sections ?? []).map((s) => {
        const raw = s as unknown as { id: string; name_en: string; name_es: string; is_material_type: boolean; section_total: number; estimate_items: { id: string; description: string; amount: number }[] };
        return { id: raw.id, name_en: raw.name_en, name_es: raw.name_es, is_material_type: raw.is_material_type, section_total: raw.section_total, items: raw.estimate_items ?? [] };
      });
      setEstimate({ sections: mapped });
      setLoading(false);
    };
    load();
  }, [project.id]);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
    </div>
  );
  if (!estimate) return (
    <div className="flex h-64 items-center justify-center">
      <p className="text-[#5C6A6E] dark:text-[#9fb0cc]">{EN ? "No estimate found. Create one in the Estimate tab first." : "No hay estimado. Crea uno en el tab Estimate primero."}</p>
    </div>
  );

  return (
    <DayPlannerModal
      embedded
      estimate={estimate}
      projectId={project.id}
      projectStart={project.start_date}
      onClose={() => {}}
      onGenerated={onRefresh}
      toast={toast}
    />
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
  const [activeTab, setActiveTab] = useState<TabId>("presupuesto");
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const swipeX = useRef<number | null>(null);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  // Datos del hero (resumen): totales del estimate + schedule + últimas fotos
  const [estTotals, setEstTotals] = useState<EstimateTotals | null>(null);
  const [estDeposits, setEstDeposits] = useState<DepositEntry[]>([]);
  const [heroPhotos, setHeroPhotos] = useState<{ url: string; tag: string; caption: string | null }[]>([]);
  const [objectives, setObjectives] = useState<ProjectObjective[]>([]);
  const [objModalOpen, setObjModalOpen] = useState(false);
  const { msg: toastMsg, visible: toastVisible, show: showToast } = useToast();
  const { setMeta } = useVoice();
  const { currentUser, isSuperAdmin, hasPermission } = useAuth();
  const { t, language } = useLanguage();
  const tp = t.panel;

  const TABS: { id: TabId; label: string }[] = [
    { id: "presupuesto", label: tp.tabs.budget },
    { id: "pagos",       label: tp.tabs.payments },
    { id: "planner",     label: tp.tabs.planner },
    { id: "plan",        label: tp.tabs.plan },
    { id: "materiales",  label: tp.tabs.materials },
    { id: "contactos",   label: tp.tabs.contacts },
    { id: "fotos",       label: tp.nav.photos },
    { id: "notas",       label: tp.tabs.notes },
    { id: "design",      label: tp.tabs.design },
  ];

  // Filter tabs the user is allowed to view
  const visibleTabs = TABS.filter(t => {
    if (isSuperAdmin) return true;
    // Explicit tab_access list takes precedence (new granular system)
    if (currentUser?.tab_access) return currentUser.tab_access.includes(t.id);
    // Legacy: derive from permissions
    const sec = t.id === "pagos" ? "pagos" : t.id === "plan" || t.id === "planner" || t.id === "design" || t.id === "fotos" ? "workflow" : t.id as import("@/src/types/auth").PermissionSection;
    return hasPermission(sec, "view");
  });

  // Si el tab activo no es visible para el usuario (p.ej. tab_access legado con "workflow"), saltar al primero
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some(tab => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  });

  // Agrupa los tabs visibles en las 3 secciones (Finanzas · Obra · Info); oculta secciones vacías
  const visibleTabIds = new Set(visibleTabs.map(tab => tab.id));

  // For co-workers with "my tasks only", filter tasks to their assigned ones
  const myContactId = currentUser?.my_tasks_only ? (currentUser.contact_id ?? null) : null;
  const filteredTasks = myContactId
    ? (project?.tasks ?? []).filter(task => task.assigned_contact_id === myContactId)
    : (project?.tasks ?? []);

  // Resumen del hero: estimate (totales + schedule) y últimas fotos. Queries explícitas
  // con .in() — evita los nested selects de 3 niveles que PostgREST devuelve null.
  const loadHero = useCallback(async () => {
    const { data: est } = await supabase
      .from("project_estimates").select("id, discount_pct, deposit_schedule").eq("project_id", id).maybeSingle();
    if (est) {
      const { data: secs } = await supabase
        .from("estimate_sections").select("id, section_total, is_material_type").eq("estimate_id", est.id);
      const secIds = (secs ?? []).map((s) => s.id as string);
      let items: { section_id: string; amount: number; cost: number; profit: number }[] = [];
      if (secIds.length) {
        const { data: its } = await supabase
          .from("estimate_items").select("section_id, amount, cost, profit").in("section_id", secIds);
        items = (its ?? []) as typeof items;
      }
      const sections = (secs ?? []).map((s) => ({
        section_total: Number(s.section_total) || 0,
        is_material_type: !!s.is_material_type,
        items: items.filter((i) => i.section_id === s.id).map((i) => ({ amount: Number(i.amount) || 0, cost: Number(i.cost) || 0, profit: Number(i.profit) || 0 })),
      }));
      setEstTotals(computeEstimateTotals(sections, Number(est.discount_pct) || 0));
      setEstDeposits((est.deposit_schedule as DepositEntry[]) ?? []);
    } else {
      setEstTotals(null); setEstDeposits([]);
    }
    // Respeta el orden manual (sort_order) si existe; si la columna no está, cae a fecha
    const photoCols = "url, tag, caption";
    let ph = (await supabase.from("project_photos").select(photoCols).eq("project_id", id)
      .order("sort_order", { ascending: true, nullsFirst: false }).order("taken_at", { ascending: false }).limit(8)).data;
    if (!ph) ph = (await supabase.from("project_photos").select(photoCols).eq("project_id", id)
      .order("taken_at", { ascending: false }).limit(8)).data;
    setHeroPhotos((ph as { url: string; tag: string; caption: string | null }[]) ?? []);

    const { data: obj } = await supabase
      .from("project_objectives").select("*").eq("project_id", id)
      .order("sort_order", { ascending: true }).order("created_at", { ascending: true });
    setObjectives((obj as ProjectObjective[]) ?? []);
  }, [id]);

  const fetchProject = useCallback(async () => {
    const { data, error } = await supabase
      .from("projects")
      .select(`*, tasks(*), materials(*), payments(*), expenses(*), project_contacts(contact_id, contacts(*)), project_notes(*)`)
      .eq("id", id)
      .single();

    if (error || !data) { router.replace("/proyectos"); return; }
    const contacts = (data.project_contacts as { contacts: Contact }[]).map((pc) => pc.contacts);
    setProject({ ...data, contacts } as ProjectFull);
    setLoading(false);
    loadHero();
  }, [id, router, loadHero]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  useEffect(() => {
    supabase.from("contacts").select("*").then(({ data }) => { if (data) setAllContacts(data as Contact[]); });
  }, []);

  // Wire voice context — FAB sabe qué tab/proyecto está activo
  useEffect(() => {
    if (!project) return;
    const ctxMap: Record<TabId, string> = {
      materiales:  "project.materiales",
      contactos:   "project.contactos",
      presupuesto: "project.presupuesto",
      planner:     "project.planner",
      pagos:       "project.pagos.ingresos",
      plan:        "project.plan",
      fotos:       "project.fotos",
      notas:       "project.notas",
      design:      "project.design",
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

  // Fotos recorribles en el lightbox del hero: la portada primero aunque no esté
  // entre las últimas cargadas, luego el resto en el orden de la galería
  const galleryPhotos = useMemo(() => {
    const cover = project?.photo_url ?? null;
    if (!cover || heroPhotos.some((p) => p.url === cover)) return heroPhotos;
    return [{ url: cover, tag: "", caption: null }, ...heroPhotos];
  }, [project?.photo_url, heroPhotos]);

  // Las fotos privadas se muestran con enlace firmado. Va aquí arriba a
  // propósito: después del `return` de carga sería un hook condicional.
  const fileUrl = useFileUrls([project?.photo_url, ...heroPhotos.map((p) => p.url)]);

  const stepLightbox = useCallback((dir: 1 | -1) => {
    setLightboxIdx((i) => (i === null || galleryPhotos.length === 0
      ? i
      : (i + dir + galleryPhotos.length) % galleryPhotos.length));
  }, [galleryPhotos.length]);

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIdx(null);
      else if (e.key === "ArrowRight") stepLightbox(1);
      else if (e.key === "ArrowLeft") stepLightbox(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, stepLightbox]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
      </div>
    );
  }
  if (!project) return null;

  // ── Hero: valores derivados ──
  const grandTotal  = estTotals?.client ?? project.budget ?? 0;
  const depAmts     = depositAmounts(estDeposits, grandTotal);
  const cobrado     = totalIncome(project.payments ?? []);
  const cobradoPct  = grandTotal > 0 ? Math.min(Math.round((cobrado / grandTotal) * 100), 100) : 0;
  const totalTasks  = (project.tasks ?? []).length;
  const doneTasks   = (project.tasks ?? []).filter((t) => t.status === "done").length;
  const avancePct   = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  // La foto principal es la portada elegida (projects.photo_url); si no hay, la primera
  const featuredUrl = project.photo_url ?? heroPhotos[0]?.url ?? null;
  const thumbs      = heroPhotos.filter((p) => p.url !== featuredUrl).slice(0, 4);
  const openLightbox = (url: string) => setLightboxIdx(Math.max(0, galleryPhotos.findIndex((p) => p.url === url)));
  const lightboxPhoto = lightboxIdx !== null ? galleryPhotos[lightboxIdx] ?? null : null;
  // Lleva a la barra de tabs (no al tope): en móvil el hero es alto y el contenido
  // del tab queda fuera de pantalla, lo que hacía parecer que el botón no hacía nada.
  const goToTab = (tab: TabId) => {
    setActiveTab(tab);
    requestAnimationFrame(() => tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const hp = tp.project;   // etiquetas del hero (project.*)
  // Permisos del hero: el resumen financiero solo si el usuario ya ve Estimate o Cash Flow.
  // Costo y ganancia son datos internos → solo superadmin (nunca en vistas de cliente).
  const canSeeMoney = isSuperAdmin || visibleTabIds.has("presupuesto") || visibleTabIds.has("pagos");
  const canSeeCost  = isSuperAdmin;

  // Objetivos: contador + toggle instantáneo del check. Editar: superadmin y co-workers
  // (los clientes solo ven y marcan). Marcar el check lo puede cualquiera con acceso.
  const canEditObjectives = isSuperAdmin || currentUser?.user_type === "coworker";
  const objDone = objectives.filter((o) => o.done).length;
  const toggleObjective = async (o: ProjectObjective) => {
    setObjectives((prev) => prev.map((x) => x.id === o.id ? { ...x, done: !x.done } : x));
    const { error } = await supabase.from("project_objectives").update({ done: !o.done }).eq("id", o.id);
    if (error) setObjectives((prev) => prev.map((x) => x.id === o.id ? { ...x, done: o.done } : x));
  };
  const to = tp.objectives;

  return (
    <div className="animate-in fade-in duration-300">
      {/* Back button */}
      <button onClick={() => router.push("/proyectos")} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#5C6A6E] dark:text-[#9fb0cc] transition hover:text-[var(--brand)]">
        <ArrowLeft size={15} /> {tp.nav.dashboard}
      </button>

      {/* ── Encabezado + hero split-screen (galería · finanzas en vivo) ── */}
      <div className="mb-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-bookman text-2xl font-semibold text-[var(--brand)]">{project.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-[#5C6A6E] dark:text-[#9fb0cc]">
              <span className="rounded-full bg-[#EDE3CF] dark:bg-[#17233d] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#7A6230] dark:text-[#e8edf7]">
                {tp.status[project.status as keyof typeof tp.status] ?? project.status}
              </span>
              <span>· {project.client}</span>
            </div>
          </div>
          {isSuperAdmin && (
            <button onClick={() => setEditProjectOpen(true)}
              className="shrink-0 grid size-9 place-items-center rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] text-[var(--brand)] transition hover:bg-[#ECE3D1] dark:hover:bg-[#17233d]"
              aria-label={hp.editProject}>
              <Pencil size={15} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Izquierda — galería */}
          <div className={`${canSeeMoney ? "lg:col-span-4" : "lg:col-span-8"} rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-4`}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--brand)]">{hp.galleryTitle}</h3>
                <p className="text-[11px] text-[#97A1A0] dark:text-[#728098]">{heroPhotos.length} {hp.photosCount}</p>
              </div>
              <QuickPhoto
                projectId={project.id}
                projectTitle={project.title}
                toast={showToast}
                onUploaded={loadHero}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-[var(--accent-strong)] active:scale-95"
              >
                <Camera size={13} /> {hp.uploadPhoto}
              </QuickPhoto>
            </div>
            {featuredUrl ? (
              <>
                <button onClick={() => openLightbox(fileUrl(featuredUrl))} className="relative block h-52 w-full overflow-hidden rounded-xl bg-slate-900">
                  <img src={fileUrl(featuredUrl)} alt="" className="h-full w-full object-cover" />
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/40 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                    <ImageIcon size={11} /> {tp.project.photoView}
                  </div>
                </button>
                {thumbs.length > 0 && (
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {thumbs.map((p, i) => (
                      <button key={i} onClick={() => openLightbox(fileUrl(p.url))} className="h-16 w-full overflow-hidden rounded-lg border border-[#E6DDCB] dark:border-[#22304d]">
                        <img src={fileUrl(p.url)} alt="" className="h-full w-full object-cover transition hover:opacity-90" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <QuickPhoto
                projectId={project.id}
                projectTitle={project.title}
                toast={showToast}
                onUploaded={loadHero}
                className="flex h-52 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#E6DDCB] dark:border-[#22304d] text-[#97A1A0] dark:text-[#728098] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <Camera size={26} />
                <span className="text-xs font-semibold">{hp.noPhotos}</span>
              </QuickPhoto>
            )}
          </div>

          {/* Derecha — resumen financiero (solo lectura). Gateado: solo quien ya ve
              Estimate/Cash Flow; costo y ganancia son internos → solo superadmin. */}
          {canSeeMoney && (
          <div className="lg:col-span-5 rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="rounded-full bg-[#EDF3FB] dark:bg-[#17233d] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--accent)]">{hp.financeSummary}</span>
              <div className="flex gap-1.5">
                {visibleTabIds.has("presupuesto") && (
                  <button onClick={() => goToTab("presupuesto")} className="inline-flex items-center gap-1 rounded-lg bg-[#F0F3FA] dark:bg-[#17233d] px-2.5 py-1.5 text-[11px] font-bold text-[var(--brand)] transition hover:bg-[#E4EAF5]"><FileText size={13} /> {hp.openEstimate}</button>
                )}
                {visibleTabIds.has("pagos") && (
                  <button onClick={() => goToTab("pagos")} className="inline-flex items-center gap-1 rounded-lg bg-[#DCEBDD] dark:bg-[#14261c] px-2.5 py-1.5 text-[11px] font-bold text-[#4F8A63] transition hover:brightness-95"><Plus size={13} /> {hp.addIncome}</button>
                )}
              </div>
            </div>

            {estTotals ? (
              canSeeCost ? (
                <div className="mb-4 grid grid-cols-3 gap-2.5">
                  <div className="rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] p-3">
                    <div className="text-[9.5px] font-bold uppercase text-[#97A1A0] dark:text-[#728098]">{hp.costReal}</div>
                    <div className="mt-1 font-mono text-[15px] font-bold text-[var(--brand)]">{money(estTotals.cost)}</div>
                  </div>
                  <div className="rounded-xl border border-[#EAD9AC] bg-[#FBF5E6] dark:bg-[#17233d] p-3">
                    <div className="text-[9.5px] font-bold uppercase text-[#B98A2F]">{hp.profit30}</div>
                    <div className="mt-1 font-mono text-[15px] font-bold text-[#B98A2F]">+{money(estTotals.profit)}</div>
                  </div>
                  <div className="rounded-xl border border-[var(--accent)] bg-[#EDF3FB] dark:bg-[#122a2c] p-3">
                    <div className="text-[9.5px] font-bold uppercase text-[var(--accent)]">{hp.clientPrice}</div>
                    <div className="mt-1 font-mono text-[15px] font-extrabold text-[var(--brand)]">{money(estTotals.client)}</div>
                  </div>
                </div>
              ) : (
                <div className="mb-4 rounded-xl border border-[var(--accent)] bg-[#EDF3FB] dark:bg-[#122a2c] p-3">
                  <div className="text-[9.5px] font-bold uppercase text-[var(--accent)]">{hp.clientPrice}</div>
                  <div className="mt-1 font-mono text-[17px] font-extrabold text-[var(--brand)]">{money(estTotals.client)}</div>
                </div>
              )
            ) : (
              <button onClick={() => goToTab("presupuesto")} className="mb-4 flex w-full items-center justify-between rounded-xl border border-dashed border-[#E6DDCB] dark:border-[#22304d] px-4 py-3 text-left">
                <span className="text-[12.5px] font-semibold text-[#5C6A6E] dark:text-[#9fb0cc]">{hp.noEstimate}</span>
                <span className="text-[11px] font-bold text-[var(--accent)]">{hp.openEstimate} →</span>
              </button>
            )}

            <div className="mb-4 grid grid-cols-2 gap-4">
              <div>
                <div className="mb-1 flex justify-between text-[11px] font-semibold"><span className="text-[#5C6A6E] dark:text-[#9fb0cc]">{hp.workProgress}</span><span className="font-mono font-bold text-[var(--accent)]">{avancePct}%</span></div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F0EBE0] dark:bg-[#22304d]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${avancePct}%` }} /></div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[11px] font-semibold"><span className="text-[#5C6A6E] dark:text-[#9fb0cc]">{hp.collected}</span><span className="font-mono font-bold text-[#4F8A63]">{money(cobrado)} · {cobradoPct}%</span></div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F0EBE0] dark:bg-[#22304d]"><div className="h-full rounded-full bg-[#4F8A63]" style={{ width: `${cobradoPct}%` }} /></div>
              </div>
            </div>

            {estDeposits.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase text-[#97A1A0] dark:text-[#728098]">{hp.paymentSchedule}</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {estDeposits.slice(0, 6).map((d, i) => {
                    const amt = depAmts[i] ?? 0;
                    const paid = !!d.received;
                    const label = language === "en" ? d.label_en : d.label_es;
                    return (
                      <div key={i} className={`rounded-xl border p-2.5 text-[11px] ${paid ? "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20" : "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20"}`}>
                        <div className={`flex justify-between font-bold ${paid ? "text-[#4F8A63]" : "text-[#B98A2F]"}`}><span className="truncate">{label}</span><span>{Math.round(depositPct(d, amt, grandTotal))}%</span></div>
                        <div className="mt-0.5 font-mono font-bold text-[var(--brand)]">{money(amt)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          )}

          {/* Objetivos del proyecto (checklist editable) */}
          <div className={`${canSeeMoney ? "lg:col-span-3" : "lg:col-span-4"} rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-4`}>
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-bold text-[var(--brand)] dark:text-[#e8edf7]">
                <Target size={15} className="text-[var(--accent)]" /> {to.colTitle}
                {objectives.length > 0 && (
                  <span className="rounded-full bg-[#EDE3CF] dark:bg-[#17233d] px-1.5 py-0.5 text-[10px] font-bold text-[#7A6230] dark:text-[#e8edf7]">{objDone}/{objectives.length}</span>
                )}
              </div>
              {canEditObjectives && (
                <button onClick={() => setObjModalOpen(true)} className="shrink-0 text-[11px] font-bold text-[var(--accent)] hover:underline">{to.edit}</button>
              )}
            </div>
            {objectives.length === 0 ? (
              canEditObjectives ? (
                <button onClick={() => setObjModalOpen(true)} className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#E6DDCB] dark:border-[#22304d] py-6 text-[#97A1A0] dark:text-[#728098] transition hover:border-[var(--accent)]">
                  <Target size={22} /><span className="text-[11px] font-semibold">{to.empty}</span>
                </button>
              ) : (
                <p className="py-6 text-center text-[12px] italic text-[#97A1A0] dark:text-[#728098]">—</p>
              )
            ) : (
              <div className="space-y-2">
                {objectives.map((o) => (
                  <div key={o.id} className="flex items-start gap-2.5">
                    <button onClick={() => toggleObjective(o)} aria-pressed={o.done}
                      className={`mt-0.5 grid size-[19px] shrink-0 place-items-center rounded-md border-2 transition ${o.done ? "border-[#4F8A63] bg-[#4F8A63]" : "border-[#C6BCA6] hover:border-[#4F8A63]"}`}>
                      {o.done && <Check size={12} className="text-white" strokeWidth={3.5} />}
                    </button>
                    <button onClick={() => toggleObjective(o)} className={`flex-1 text-left text-[13px] leading-snug ${o.done ? "text-[#97A1A0] dark:text-[#728098] line-through" : "text-[var(--brand)] dark:text-[#e8edf7]"}`}>
                      {o.text}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox del hero — recorre las fotos con flechas, teclado o swipe */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setLightboxIdx(null)}
          onTouchStart={e => { swipeX.current = e.touches[0]?.clientX ?? null; }}
          onTouchEnd={e => {
            const dx = (e.changedTouches[0]?.clientX ?? 0) - (swipeX.current ?? 0);
            if (swipeX.current !== null && Math.abs(dx) > 50) stepLightbox(dx < 0 ? 1 : -1);
            swipeX.current = null;
          }}
        >
          <button
            onClick={() => setLightboxIdx(null)}
            className="absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-white/20 text-white backdrop-blur-sm hover:bg-white/35"
            aria-label={hp.photoClose}
          >
            <X size={18} />
          </button>
          <img
            src={lightboxPhoto.url}
            alt={lightboxPhoto.caption ?? project.title}
            className="max-h-[88vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          {galleryPhotos.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); stepLightbox(-1); }}
                aria-label={hp.photoPrev}
                className="absolute left-3 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/30 active:scale-95 sm:left-6"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); stepLightbox(1); }}
                aria-label={hp.photoNext}
                className="absolute right-3 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/30 active:scale-95 sm:right-6"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
          <div className="absolute bottom-6 left-1/2 flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-full bg-black/45 px-4 py-1.5 text-[12px] font-semibold text-white backdrop-blur-sm">
            <span className="truncate">{lightboxPhoto.caption || project.title}</span>
            {galleryPhotos.length > 1 && (
              <span className="shrink-0 text-white/60">{(lightboxIdx ?? 0) + 1}/{galleryPhotos.length}</span>
            )}
          </div>
        </div>
      )}

      {/* Barra única de tabs: fondo del tema, el activo iluminado (scroll horizontal en móvil) */}
      {visibleTabs.length > 0 && (
        <div ref={tabsRef} className="mb-4 flex gap-1.5 overflow-x-auto rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-2 py-2 scroll-mt-4 [scrollbar-width:none]">
          {visibleTabs.map((tab) => {
            const Icon = TAB_ICONS[tab.id];
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                aria-current={active ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-bold transition ${
                  active
                    ? "bg-[var(--brand)] text-white shadow-sm"
                    : "text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#F0F3FA] dark:hover:bg-[#17233d] hover:text-[var(--brand)] dark:hover:text-[#e8edf7]"
                }`}>
                <Icon size={15} className="shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Contenido */}
      {activeTab === "materiales"  && <MaterialesTab  project={project} materials={project.materials} onRefresh={fetchProject} toast={showToast} />}
      {activeTab === "contactos"   && <ContactosTab   project={project} contacts={project.contacts} allContacts={allContacts} onRefresh={fetchProject} toast={showToast} />}
      {activeTab === "presupuesto" && <EstimateTab project={project} onRefresh={fetchProject} toast={showToast} />}
      {activeTab === "planner"     && <PlannerTab  project={project} onRefresh={fetchProject} toast={showToast} />}
      {activeTab === "pagos"       && <PagosTab
        project={project} payments={project.payments} expenses={project.expenses}
        contacts={project.contacts} onRefresh={fetchProject} toast={showToast}
        onSubTabChange={(sub) => setMeta({ context: `project.pagos.${sub}`, projectId: project.id, projectTitle: project.title, contacts: project.contacts?.map((c) => c.name) ?? [] })}
      />}
      {activeTab === "fotos"       && <ProjectPhotos projectId={project.id} projects={[{ id: project.id, title: project.title }]} toast={showToast} coverUrl={project.photo_url ?? null} onProjectChange={fetchProject} />}
      {activeTab === "plan"        && <PlanTab        project={project} tasks={filteredTasks} contacts={project.contacts} onRefresh={fetchProject} toast={showToast} />}
      {activeTab === "notas"       && <NotasTab       project={project} notes={project.project_notes ?? []} onRefresh={fetchProject} toast={showToast} />}
      {activeTab === "design"      && <DesignTab      project={project} toast={showToast} />}

      {/* Editar proyecto */}
      {objModalOpen && (
        <ObjectivesModal
          projectId={project.id}
          projectTitle={project.title}
          initial={objectives}
          onSaved={loadHero}
          onClose={() => setObjModalOpen(false)}
          toast={showToast}
        />
      )}

      {editProjectOpen && (
        <EditorModal
          opts={{
            title: tp.project.editProject,
            fields: [
              { key: "title",      label: tp.project.name,       type: "text",   value: project.title },
              { key: "client",     label: tp.project.client,      type: "text",   value: project.client },
              { key: "address",    label: tp.project.address,     type: "text",   value: project.address },
              { key: "budget",     label: tp.project.budget,      type: "number", value: project.budget },
              { key: "status",     label: tp.project.status,      type: "select", options: ["prospecto", "presupuesto", "aprobado", "en_obra", "terminado"], optionLabels: tp.status, value: project.status },
              { key: "start_date", label: tp.project.startDate,   type: "date",   value: project.start_date },
              { key: "end_date",   label: tp.project.endDate,     type: "date",   value: project.end_date ?? "" },
            ],
            onSave: async (vals) => {
              // end_date only exists in project_estimates, not in projects table
              const { end_date, ...projectVals } = vals;
              const { error } = await supabase.from("projects").update(projectVals).eq("id", project.id);
              if (error) { showToast(tp.common.errorSaving + error.message); return; }
              // Sync dates to estimate
              if (projectVals.start_date || end_date) {
                const { data: est } = await supabase.from("project_estimates").select("id").eq("project_id", project.id).maybeSingle();
                if (est) {
                  const sync: Record<string, string> = {};
                  if (projectVals.start_date) sync.start_date = projectVals.start_date as string;
                  if (end_date)               sync.end_date   = end_date as string;
                  await supabase.from("project_estimates").update(sync).eq("id", est.id);
                }
              }
              fetchProject(); showToast(tp.project.projectUpdated);
            },
          }}
          onClose={() => setEditProjectOpen(false)}
        />
      )}

      {/* Toast */}
      <div className={`fixed bottom-24 left-1/2 z-[200] -translate-x-1/2 max-w-sm w-full rounded-2xl bg-[var(--brand)] px-4 py-3 text-center text-sm font-medium text-white shadow-2xl transition-all duration-300 ${toastVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"}`}>
        {toastMsg}
      </div>
    </div>
  );
}
