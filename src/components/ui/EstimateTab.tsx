"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown, ChevronUp, Plus, X, Trash2, FileText, Zap, Info, GripVertical, Send, Save, Pencil,
} from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import { money } from "@/src/lib/utils";
import { openEstimatePdfInBrowser, getEstimatePdfBlob } from "@/src/lib/pdf";

const WA_CODES = [
  { code: "+1",   flag: "🇺🇸", label: "US/CA" },
  { code: "+52",  flag: "🇲🇽", label: "MX" },
  { code: "+57",  flag: "🇨🇴", label: "CO" },
  { code: "+58",  flag: "🇻🇪", label: "VE" },
  { code: "+54",  flag: "🇦🇷", label: "AR" },
  { code: "+34",  flag: "🇪🇸", label: "ES" },
  { code: "+51",  flag: "🇵🇪", label: "PE" },
];

function fmtPhone(v: string, code: string): string {
  const raw = v.replace(/\D/g, "");
  if (code === "+1") {
    const d = raw.slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (code === "+51") {
    // Peru: 9 digits — XXX XXX-XXX
    const d = raw.slice(0, 9);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
    return `${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  // Other countries: digits only, max 12
  return raw.slice(0, 12);
}

function phonePlaceholder(code: string): string {
  if (code === "+1")  return "(786) 563-2531";
  if (code === "+51") return "984 368-710";
  return "123 456 7890";
}
import type { Project, EstimateSectionCatalog, DepositEntry, ProjectEstimate, Payment } from "@/src/types/project";
import { useLanguage } from "@/src/context/LanguageContext";
import { branding } from "@/src/config/branding";
import DayPlannerModal from "./DayPlannerModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ItemRow {
  id: string;
  section_id: string;
  description: string;
  amount: number;
  sort_order: number;
}

interface SectionRow {
  id: string;
  estimate_id: string;
  name_en: string;
  name_es: string;
  note: string;
  is_material_type: boolean;
  material_included: boolean;
  section_total: number;
  sort_order: number;
  items: ItemRow[];
}

interface EstimateRow {
  id: string;
  project_id: string;
  status: "draft" | "sent" | "approved" | "rejected";
  customer_name: string;
  city: string;
  email: string;
  phone: string;
  project_title: string;
  start_date: string;
  end_date: string;
  discount_label: string;
  discount_pct: number;
  deposit_schedule: DepositEntry[];
  notes: string;
  sections: SectionRow[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  draft:    "bg-[#EDE3CF] text-[#7A6230]",
  sent:     "bg-[#DCE8E9] text-[#4E7A82]",
  approved: "bg-[#DCEBDD] text-[#4F8A63]",
  rejected: "bg-[#F0DBD2] text-[#B0492F]",
};

const FALLBACK_CATALOG: EstimateSectionCatalog[] = [
  { id:"f-1", name_en:"DEMOLITION",                name_es:"DEMOLICIÓN",                note_en:"Dumping included",   note_es:"Acarreo incluido",  is_material_type:false, sort_order:1 },
  { id:"f-2", name_en:"PLUMBING",                   name_es:"PLOMERÍA",                  note_en:"Material included",  note_es:"Material incluido", is_material_type:false, sort_order:2 },
  { id:"f-3", name_en:"STRUCTURE",                  name_es:"ESTRUCTURA",                note_en:"Material included",  note_es:"Material incluido", is_material_type:false, sort_order:3 },
  { id:"f-4", name_en:"ELECTRICAL",                 name_es:"ELÉCTRICO",                 note_en:"Material included",  note_es:"Material incluido", is_material_type:false, sort_order:4 },
  { id:"f-5", name_en:"TILE INSTALLATION",          name_es:"INSTALACIÓN DE TILE",       note_en:"",                   note_es:"",                  is_material_type:false, sort_order:5 },
  { id:"f-6", name_en:"HANDY WORK",                 name_es:"TRABAJO MANUAL",            note_en:"",                   note_es:"",                  is_material_type:false, sort_order:6 },
  { id:"f-7", name_en:"PAINTING",                   name_es:"PINTURA",                   note_en:"",                   note_es:"",                  is_material_type:false, sort_order:7 },
  { id:"f-8", name_en:"PERMIT AND ADMINISTRATIVES", name_es:"PERMISOS Y ADMINISTRATIVOS",note_en:"",                   note_es:"",                  is_material_type:false, sort_order:8 },
  { id:"f-9", name_en:"MATERIALS",                  name_es:"MATERIALES",                note_en:"Pure materials",     note_es:"Solo materiales",   is_material_type:true,  sort_order:9 },
];

function defaultDeposits(): DepositEntry[] {
  return [
    { pct: 50, label_en: "AT SIGN CONTRACT",        label_es: "AL FIRMAR CONTRATO" },
    { pct: 25, label_en: "WHEN TILE IS COMPLETE",   label_es: "CUANDO EL TILE ESTÉ COMPLETO" },
    { pct: 25, label_en: "WHEN CUSTOMER SATISFIED", label_es: "CUANDO EL CLIENTE ESTÉ SATISFECHO" },
  ];
}

// ─── SortableItem ─────────────────────────────────────────────────────────────

interface SortableItemProps {
  item: ItemRow;
  sectionId: string;
  onUpdateLocal: (sectionId: string, itemId: string, field: "description" | "amount", value: string) => void;
  onSaveField:   (itemId: string, field: "description" | "amount", value: string) => void;
  onDelete:      (sectionId: string, itemId: string) => void;
}

function SortableItem({ item, sectionId, onUpdateLocal, onSaveField, onDelete }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="group flex items-center gap-2 border-b border-[#F0EBE0] bg-white px-4 py-2 hover:bg-[#FDFAF6]"
    >
      <button
        {...attributes} {...listeners}
        tabIndex={-1}
        aria-label="Drag to reorder"
        className="shrink-0 cursor-grab touch-none p-0.5 text-[#D7CBB3] hover:text-[#5C6A6E] active:cursor-grabbing"
      >
        <GripVertical size={12} />
      </button>
      <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C4B89A]" />
      <input
        type="text"
        value={item.description}
        onChange={e => onUpdateLocal(sectionId, item.id, "description", e.target.value)}
        onBlur={e  => onSaveField(item.id, "description", e.target.value)}
        className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-[12px] text-[#16323D] hover:bg-[#F7F3EA] focus:border-b focus:border-[#395886] focus:bg-white focus:outline-none"
      />
      <input
        type="number"
        value={item.amount || ""}
        onChange={e => onUpdateLocal(sectionId, item.id, "amount", e.target.value)}
        onBlur={e  => onSaveField(item.id, "amount", e.target.value)}
        placeholder="0"
        className="w-20 rounded bg-transparent px-1 py-0.5 text-right font-mono text-[12px] text-[#16323D] hover:bg-[#F7F3EA] focus:border-b focus:border-[#395886] focus:bg-white focus:outline-none"
      />
      <button
        onClick={() => onDelete(sectionId, item.id)}
        className="shrink-0 rounded p-1 text-[#E6DDCB] opacity-0 transition hover:text-[#B0492F] group-hover:opacity-100"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ─── SortableSection ──────────────────────────────────────────────────────────

interface SortableSectionProps {
  section:        SectionRow;
  isOpen:         boolean;
  EN:             boolean;
  effectiveTotal: number;
  hasItemAmounts: boolean;
  onToggle:          () => void;
  onUpdateField:     (id: string, field: "section_total"|"note"|"is_material_type"|"material_included", value: number|string|boolean) => void;
  onDelete:          (id: string) => void;
  onUpdateItem:      (sectionId: string, itemId: string, field: "description"|"amount", value: string) => void;
  onSaveItem:        (itemId: string, field: "description"|"amount", value: string) => void;
  onDeleteItem:      (sectionId: string, itemId: string) => void;
  onItemsReorder:    (sectionId: string, reordered: ItemRow[]) => void;
  onAddItem:         (sectionId: string) => void;
  addingItemTo:      string | null;
  setAddingItemTo:   (id: string | null) => void;
  newItemDesc:       string;
  setNewItemDesc:    (v: string) => void;
  newItemAmt:        string;
  setNewItemAmt:     (v: string) => void;
  editingNameId:     string | null;
  setEditingNameId:  (id: string | null) => void;
  onSaveName:        (sectionId: string, name: string) => void;
}

function SortableSection({
  section, isOpen, EN, effectiveTotal, hasItemAmounts,
  onToggle, onUpdateField, onDelete,
  onUpdateItem, onSaveItem, onDeleteItem, onItemsReorder, onAddItem,
  addingItemTo, setAddingItemTo, newItemDesc, setNewItemDesc, newItemAmt, setNewItemAmt,
  editingNameId, setEditingNameId, onSaveName,
}: SortableSectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  // Local string so the number input doesn't freeze at "0"
  const [totalStr, setTotalStr] = useState(section.section_total > 0 ? String(section.section_total) : "");

  useEffect(() => {
    if (!hasItemAmounts) {
      setTotalStr(section.section_total > 0 ? String(section.section_total) : "");
    }
  }, [section.section_total, hasItemAmounts]);

  const itemSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  function handleItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = section.items.findIndex(i => i.id === active.id);
    const newIdx = section.items.findIndex(i => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    onItemsReorder(section.id, arrayMove(section.items, oldIdx, newIdx));
  }

  const name = EN ? section.name_en : section.name_es;
  const [localName, setLocalName] = useState(name);
  useEffect(() => { setLocalName(name); }, [name]);

  const isEditingName = editingNameId === section.id;

  const commitName = () => {
    onSaveName(section.id, localName);
    setEditingNameId(null);
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="overflow-hidden rounded-2xl border border-[#E6DDCB] bg-white"
    >
      {/* ── Card header ── */}
      <div
        className="flex cursor-pointer items-center justify-between px-4 py-3.5 transition hover:bg-[#FDFAF6]"
        onClick={onToggle}
      >
        <div className="flex min-w-0 items-center gap-2">
          <button
            {...attributes} {...listeners}
            tabIndex={-1}
            aria-label="Drag to reorder section"
            onClick={e => e.stopPropagation()}
            className="shrink-0 cursor-grab touch-none p-1 text-[#D7CBB3] hover:text-[#5C6A6E] active:cursor-grabbing"
          >
            <GripVertical size={14} />
          </button>
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm ${section.is_material_type ? "bg-[#FDF0ED]" : "bg-[#EDF3FB]"}`}>
            {section.is_material_type ? "📦" : "🔨"}
          </div>
          <div className="min-w-0 flex-1">
            {isEditingName ? (
              <input
                autoFocus
                value={localName}
                onChange={e => setLocalName(e.target.value)}
                onBlur={commitName}
                onKeyDown={e => {
                  if (e.key === "Enter")  commitName();
                  if (e.key === "Escape") { setLocalName(name); setEditingNameId(null); }
                }}
                onClick={e => e.stopPropagation()}
                placeholder={EN ? "Section name" : "Nombre de sección"}
                className="w-full max-w-[220px] rounded-md border border-[#395886] bg-white px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide text-[#16323D] focus:outline-none"
              />
            ) : (
              <div
                className="truncate text-[12px] font-bold uppercase tracking-wide text-[#16323D] cursor-pointer hover:text-[#395886]"
                title={EN ? "Click to rename" : "Clic para renombrar"}
                onClick={e => {
                  e.stopPropagation();
                  setLocalName(name);
                  setEditingNameId(section.id);
                }}
              >
                {name}
              </div>
            )}
            {section.note && <div className="text-[10px] text-[#5C6A6E]">{section.note}</div>}
          </div>
        </div>
        <div className="ml-3 flex shrink-0 items-center gap-3">
          {/* Checkbox 1 — Material included (informational) */}
          <label
            className="flex cursor-pointer items-center gap-1.5"
            onClick={e => e.stopPropagation()}
            title={EN ? "Material cost included in section price" : "Costo de material incluido en el precio"}
          >
            <input
              type="checkbox"
              checked={section.material_included}
              onChange={e => onUpdateField(section.id, "material_included", e.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer accent-[#4F8A63]"
            />
            <span className={`text-[10px] font-bold uppercase tracking-wide ${section.material_included ? "text-[#4F8A63]" : "text-[#5C6A6E]"}`}>
              {EN ? "Mat. incl." : "Mat. incl."}
            </span>
          </label>
          {/* Checkbox 2 — Include in labor discount */}
          <label
            className="flex cursor-pointer items-center gap-1.5"
            onClick={e => e.stopPropagation()}
            title={EN ? "Include in labor subtotal & discount" : "Incluir en subtotal de mano de obra y descuento"}
          >
            <input
              type="checkbox"
              checked={!section.is_material_type}
              onChange={e => onUpdateField(section.id, "is_material_type", !e.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer accent-[#395886]"
            />
            <span className={`text-[10px] font-bold uppercase tracking-wide ${!section.is_material_type ? "text-[#395886]" : "text-[#5C6A6E]"}`}>
              {EN ? "Labor %" : "M. obra %"}
            </span>
          </label>
          <div className="text-right">
            <div className={`font-mono text-[13px] font-bold ${section.is_material_type ? "text-[#B0492F]" : "text-[#16323D]"}`}>
              {money(effectiveTotal)}
            </div>
            {section.items.length > 0 && (
              <div className="text-[10px] text-[#5C6A6E]">{section.items.length} items</div>
            )}
          </div>
          {isOpen ? <ChevronUp size={14} className="text-[#5C6A6E]" /> : <ChevronDown size={14} className="text-[#5C6A6E]" />}
        </div>
      </div>

      {/* ── Card body ── */}
      {isOpen && (
        <div className="border-t border-[#F0EBE0]">

          {/* Settings row */}
          <div className="flex flex-wrap items-center justify-end gap-2 border-b border-[#F0EBE0] bg-[#FAFAF8] px-4 py-2">
            <input
              type="text"
              value={section.note}
              placeholder={EN ? "Note (e.g. Material included)" : "Nota (ej. Material incluido)"}
              onChange={e => onUpdateField(section.id, "note", e.target.value)}
              className="w-44 rounded-lg border border-[#E6DDCB] bg-white px-2 py-1 text-[11px] text-[#5C6A6E] focus:border-[#395886] focus:outline-none"
            />
            <button
              onClick={() => onDelete(section.id)}
              className="rounded-lg p-1.5 text-[#5C6A6E] transition hover:bg-[#FDF0ED] hover:text-[#B0492F]"
            >
              <Trash2 size={12} />
            </button>
          </div>

          {/* Items — sortable */}
          <DndContext sensors={itemSensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
            <SortableContext items={section.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
              {section.items.map(item => (
                <SortableItem
                  key={item.id}
                  item={item}
                  sectionId={section.id}
                  onUpdateLocal={onUpdateItem}
                  onSaveField={onSaveItem}
                  onDelete={onDeleteItem}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* Section total — editable when no items have amounts */}
          <div className="flex items-center gap-3 border-b border-[#F0EBE0] px-4 py-2.5">
            <span className="flex-1 text-[11px] text-[#5C6A6E]">
              {hasItemAmounts
                ? (EN ? "Section total (sum of items):" : "Total de sección (suma de items):")
                : (EN ? "Section total:" : "Total de sección:")}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={hasItemAmounts ? String(effectiveTotal) : totalStr}
              disabled={hasItemAmounts}
              onFocus={e => { if (!hasItemAmounts) e.target.select(); }}
              onChange={e => {
                if (!hasItemAmounts) setTotalStr(e.target.value.replace(/[^0-9.]/g, ""));
              }}
              onBlur={() => {
                if (!hasItemAmounts) onUpdateField(section.id, "section_total", parseFloat(totalStr) || 0);
              }}
              placeholder="0"
              className={`w-28 rounded-lg border px-3 py-1.5 text-right font-mono text-[13px] font-bold focus:outline-none ${
                hasItemAmounts
                  ? "cursor-default border-transparent bg-transparent text-[#5C6A6E]"
                  : "border-[#E6DDCB] bg-[#FDFAF6] text-[#16323D] focus:border-[#395886]"
              }`}
            />
          </div>

          {/* Add item form */}
          {addingItemTo === section.id ? (
            <div className="flex items-center gap-2 border-b border-[#E6DDCB] bg-[#F7F3EA] px-4 py-2">
              <input
                autoFocus
                type="text"
                value={newItemDesc}
                onChange={e => setNewItemDesc(e.target.value)}
                placeholder={EN ? "Item description" : "Descripción del item"}
                onKeyDown={e => {
                  if (e.key === "Enter")  onAddItem(section.id);
                  if (e.key === "Escape") { setAddingItemTo(null); setNewItemDesc(""); setNewItemAmt(""); }
                }}
                className="flex-1 rounded-lg border border-[#E6DDCB] bg-white px-3 py-1.5 text-[12px] focus:border-[#395886] focus:outline-none"
              />
              <input
                type="number"
                value={newItemAmt}
                onChange={e => setNewItemAmt(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") onAddItem(section.id); }}
                placeholder="$0"
                className="w-24 rounded-lg border border-[#E6DDCB] bg-white px-3 py-1.5 text-right font-mono text-[12px] focus:border-[#395886] focus:outline-none"
              />
              <button
                onClick={() => onAddItem(section.id)}
                className="shrink-0 rounded-lg bg-[#16323D] px-3 py-1.5 text-[11px] font-bold text-white"
              >
                {EN ? "Add" : "Agregar"}
              </button>
              <button
                onClick={() => { setAddingItemTo(null); setNewItemDesc(""); setNewItemAmt(""); }}
                className="shrink-0 p-1.5 text-[#5C6A6E] hover:text-[#B0492F]"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setAddingItemTo(section.id); setNewItemDesc(""); setNewItemAmt(""); }}
              className="flex w-full items-center gap-1.5 px-4 py-2.5 text-[11px] font-semibold text-[#395886] transition hover:bg-[#F7F3EA] hover:text-[#16323D]"
            >
              <Plus size={11} /> {EN ? "Add item" : "Agregar item"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function computeGrandTotal(
  sections: Array<{ items: Array<{ amount: number }>; section_total: number; is_material_type: boolean }>,
  discountPct: number,
): number {
  let all = 0, labor = 0;
  for (const s of sections) {
    const itemsSum = s.items.reduce((a, i) => a + i.amount, 0);
    const st = itemsSum > 0 ? itemsSum : s.section_total;
    all += st;
    if (!s.is_material_type) labor += st;
  }
  const disc = Math.round(labor * (discountPct / 100) * 100) / 100;
  return all - disc;
}

// ─── EstimateTab ──────────────────────────────────────────────────────────────

export default function EstimateTab({
  project,
  onRefresh,
  toast,
}: {
  project: Project;
  onRefresh: () => void;
  toast: (msg: string) => void;
}) {
  const { language } = useLanguage();
  const EN = language === "en";

  const [estimate,       setEstimate]       = useState<EstimateRow | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [expanded,       setExpanded]       = useState<Set<string>>(new Set());
  const [showHeader,     setShowHeader]     = useState(false);
  const [catalog,        setCatalog]        = useState<EstimateSectionCatalog[]>([]);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showGenTasks,   setShowGenTasks]   = useState(false);
  const [addingItemTo,   setAddingItemTo]   = useState<string | null>(null);
  const [newItemDesc,    setNewItemDesc]    = useState("");
  const [newItemAmt,     setNewItemAmt]     = useState("");
  const [editingNameId,  setEditingNameId]  = useState<string | null>(null);
  const [showPdfModal,   setShowPdfModal]   = useState(false);
  const [waCode,         setWaCode]         = useState("+1");
  const [waPhone,        setWaPhone]        = useState("");
  const [waLoading,      setWaLoading]      = useState(false);
  const [confirmDeleteSection, setConfirmDeleteSection] = useState<{ id: string; name: string } | null>(null);

  // ── Deposit payment detail modal ──────────────────────────────────────────
  const [projectPayments,  setProjectPayments]  = useState<Payment[]>([]);
  const [depositModal,            setDepositModal]            = useState<number | null>(null);
  const [depAmt,                  setDepAmt]                  = useState("");
  const [depDate,                 setDepDate]                 = useState(new Date().toISOString().split("T")[0]);
  const [confirmDeleteDepositIdx, setConfirmDeleteDepositIdx] = useState<number | null>(null);
  // Edit-installment modal
  const [editDepositIdx,   setEditDepositIdx]   = useState<number | null>(null);
  const [editDepositLabel, setEditDepositLabel] = useState("");
  const [editDepositPct,   setEditDepositPct]   = useState("");
  const [editDepositAmt,   setEditDepositAmt]   = useState("");
  const [depMethod,        setDepMethod]        = useState<Payment["method"]>("Transferencia");
  const [depConcept,       setDepConcept]       = useState("");
  const [depSaving,        setDepSaving]        = useState(false);
  const [editingPayId,     setEditingPayId]     = useState<string | null>(null);
  const [editForm,         setEditForm]         = useState<{ amount: string; date: string; method: Payment["method"]; concept: string }>({ amount: "", date: "", method: "Transferencia", concept: "" });
  const [confirmDeletePayId, setConfirmDeletePayId] = useState<string | null>(null);

  // ── Copy-to-project modal ─────────────────────────────────────────────────
  const [showCopyModal,   setShowCopyModal]   = useState(false);
  const [copyProjects,    setCopyProjects]    = useState<{ id: string; title: string; client: string }[]>([]);
  const [copyTargetId,    setCopyTargetId]    = useState("");
  const [copyHasEstimate, setCopyHasEstimate] = useState(false);
  const [copying,         setCopying]         = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("estimate_section_catalog").select("*").order("sort_order");
      if (data && data.length > 0) setCatalog(data);
    } catch { /* tables may not exist yet */ }

    const { data: est, error: estErr } = await supabase
      .from("project_estimates").select("*").eq("project_id", project.id).maybeSingle();

    if (estErr) { console.error("[EstimateTab] load:", estErr); setEstimate(null); setLoading(false); return; }
    if (!est)   { setEstimate(null); setLoading(false); return; }

    const { data: sections } = await supabase
      .from("estimate_sections")
      .select("*, items:estimate_items(*)")
      .eq("estimate_id", est.id)
      .order("sort_order");

    const mappedSections = (sections ?? []).map(s => ({
      ...s,
      material_included: (s as { material_included?: boolean }).material_included ?? false,
      items: ((s.items ?? []) as ItemRow[]).sort((a, b) => a.sort_order - b.sort_order),
    }));

    setEstimate({
      ...est,
      deposit_schedule: (est.deposit_schedule as DepositEntry[]) ?? defaultDeposits(),
      sections: mappedSections,
    });

    // Sync grand total → project.budget so the dashboard is always up to date
    if (mappedSections.length > 0) {
      const grandTotal = computeGrandTotal(mappedSections, est.discount_pct ?? 0);
      supabase.from("projects").update({ budget: grandTotal }).eq("id", project.id);
    }

    // Load project payments for deposit detail modal
    const { data: pmts } = await supabase
      .from("payments")
      .select("*")
      .eq("project_id", project.id)
      .order("date", { ascending: false });
    setProjectPayments(pmts ?? []);

    setLoading(false);
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  // ── Totals ────────────────────────────────────────────────────────────────
  const sectionEffectiveTotal = (s: SectionRow) => {
    const itemsSum = s.items.reduce((a, i) => a + i.amount, 0);
    return itemsSum > 0 ? itemsSum : s.section_total;
  };

  const totals = useMemo(() => {
    if (!estimate) return { allTotal: 0, laborTotal: 0, discountAmt: 0, grandTotal: 0 };
    let all = 0, labor = 0;
    for (const s of estimate.sections) {
      const st = sectionEffectiveTotal(s);
      all += st;
      if (!s.is_material_type) labor += st;
    }
    const disc = Math.round(labor * ((estimate.discount_pct ?? 0) / 100) * 100) / 100;
    return { allTotal: all, laborTotal: labor, discountAmt: disc, grandTotal: all - disc };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimate]);

  const effectiveCatalog = catalog.length > 0 ? catalog : FALLBACK_CATALOG;

  // ── Create estimate ───────────────────────────────────────────────────────
  const createEstimate = useCallback(async () => {
    setSaving(true);
    const { data, error } = await supabase.from("project_estimates").insert({
      project_id:      project.id,
      customer_name:   project.client ?? "",
      city:            (project.address ?? "").split(",")[0].trim(),
      project_title:   project.title ?? "",
      status:          "draft",
      discount_label:  "DISCOUNT",
      discount_pct:    0,
      deposit_schedule: defaultDeposits(),
      email: "", phone: "", start_date: null, end_date: null, notes: "",
    }).select().single();
    setSaving(false);
    if (error) {
      const msg = error.message?.includes("does not exist")
        ? (EN ? "Run the SQL migration for estimate tables in Supabase first" : "Ejecuta la migración SQL de estimate en Supabase primero")
        : `Error: ${error.message}`;
      toast(msg);
      return;
    }
    if (data) setEstimate({ ...data, deposit_schedule: defaultDeposits(), sections: [] });
  }, [project, EN, toast]);

  // ── Save header + auto-create client contact ──────────────────────────────
  const saveHeader = useCallback(async () => {
    if (!estimate) return;
    setSaving(true);

    await supabase.from("project_estimates").update({
      customer_name:    estimate.customer_name,
      city:             estimate.city,
      email:            estimate.email,
      phone:            estimate.phone,
      project_title:    estimate.project_title,
      start_date:       estimate.start_date  || null,
      end_date:         estimate.end_date    || null,
      status:           estimate.status,
      discount_label:   estimate.discount_label,
      discount_pct:     estimate.discount_pct,
      deposit_schedule: estimate.deposit_schedule,
      notes:            estimate.notes,
      updated_at:       new Date().toISOString(),
    }).eq("id", estimate.id);

    // Auto-create/update client contact when name + phone are present
    if (estimate.customer_name.trim() && estimate.phone.trim()) {
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("name", estimate.customer_name.trim())
        .eq("type", "customer")
        .maybeSingle();

      let contactId: string;
      if (existing) {
        contactId = existing.id;
        await supabase.from("contacts")
          .update({ phone: estimate.phone.trim() })
          .eq("id", contactId);
      } else {
        const { data: created } = await supabase.from("contacts").insert({
          name:      estimate.customer_name.trim(),
          phone:     estimate.phone.trim(),
          specialty: EN ? "Client" : "Cliente",
          type:      "customer",
          rate:      "",
          rate_type: "hour",
        }).select().single();
        if (!created) { setSaving(false); return; }
        contactId = created.id;
      }

      // Link contact to project (ignore if already linked)
      await supabase.from("project_contacts")
        .upsert({ project_id: project.id, contact_id: contactId }, { onConflict: "project_id,contact_id" });

      onRefresh();
    }

    // Sync grand total → project.budget
    const grandTotal = computeGrandTotal(estimate.sections, estimate.discount_pct ?? 0);
    await supabase.from("projects").update({ budget: grandTotal }).eq("id", project.id);

    setSaving(false);
    toast(EN ? "Estimate saved" : "Estimado guardado");
  }, [estimate, EN, toast, project.id, onRefresh]);

  // ── Sections ──────────────────────────────────────────────────────────────
  const addSection = useCallback(async (cat?: EstimateSectionCatalog & { id: string }) => {
    if (!estimate) return;
    const sort = estimate.sections.length * 10;
    const { data } = await supabase.from("estimate_sections").insert({
      estimate_id:        estimate.id,
      section_catalog_id: cat?.id?.startsWith("f-") ? null : (cat?.id ?? null),
      name_en:    cat?.name_en ?? "NEW SECTION",
      name_es:    cat?.name_es ?? "NUEVA SECCIÓN",
      note:       EN ? (cat?.note_en ?? "") : (cat?.note_es ?? ""),
      is_material_type: cat?.is_material_type ?? false,
      material_included: false,
      section_total: 0,
      sort_order: sort,
    }).select().single();
    if (data) {
      setEstimate(p => p ? ({ ...p, sections: [...p.sections, { ...data, items: [] }] }) : p);
      setExpanded(prev => new Set([...prev, data.id]));
      if (!cat) setEditingNameId(data.id);
    }
    setShowAddSection(false);
  }, [estimate, EN]);

  const deleteSection = useCallback(async (sectionId: string) => {
    await supabase.from("estimate_sections").delete().eq("id", sectionId);
    setEstimate(p => p ? ({ ...p, sections: p.sections.filter(s => s.id !== sectionId) }) : p);
  }, []);

  const saveSectionName = useCallback(async (sectionId: string, name: string) => {
    const clean = name.trim() || (EN ? "NEW SECTION" : "NUEVA SECCIÓN");
    setEstimate(p => p ? ({
      ...p,
      sections: p.sections.map(s => s.id === sectionId ? { ...s, name_en: clean, name_es: clean } : s),
    }) : p);
    await supabase.from("estimate_sections").update({ name_en: clean, name_es: clean }).eq("id", sectionId);
  }, [EN]);

  const updateSectionField = useCallback(async (
    sectionId: string,
    field: "section_total" | "note" | "is_material_type" | "material_included",
    value: number | string | boolean,
  ) => {
    setEstimate(p => p ? ({
      ...p,
      sections: p.sections.map(s => s.id === sectionId ? { ...s, [field]: value } : s),
    }) : p);
    await supabase.from("estimate_sections").update({ [field]: value }).eq("id", sectionId);
  }, []);

  // ── Items ─────────────────────────────────────────────────────────────────
  const addItem = useCallback(async (sectionId: string) => {
    if (!newItemDesc.trim()) return;
    const section = estimate?.sections.find(s => s.id === sectionId);
    if (!section) return;
    const { data } = await supabase.from("estimate_items").insert({
      section_id:  sectionId,
      description: newItemDesc.trim(),
      amount:      parseFloat(newItemAmt) || 0,
      sort_order:  section.items.length * 10,
    }).select().single();
    if (data) {
      setEstimate(p => p ? ({
        ...p,
        sections: p.sections.map(s =>
          s.id === sectionId ? { ...s, items: [...s.items, data as ItemRow] } : s
        ),
      }) : p);
    }
    setNewItemDesc(""); setNewItemAmt(""); setAddingItemTo(null);
  }, [estimate, newItemDesc, newItemAmt]);

  const updateItemLocal = (
    sectionId: string, itemId: string, field: "description" | "amount", value: string,
  ) => {
    setEstimate(p => p ? ({
      ...p,
      sections: p.sections.map(s => s.id !== sectionId ? s : {
        ...s,
        items: s.items.map(i => i.id !== itemId ? i : {
          ...i, [field]: field === "amount" ? (parseFloat(value) || 0) : value,
        }),
      }),
    }) : p);
  };

  const saveItemField = useCallback(async (
    itemId: string, field: "description" | "amount", value: string,
  ) => {
    const payload = field === "amount" ? { amount: parseFloat(value) || 0 } : { description: value };
    await supabase.from("estimate_items").update(payload).eq("id", itemId);
  }, []);

  const deleteItem = useCallback(async (sectionId: string, itemId: string) => {
    await supabase.from("estimate_items").delete().eq("id", itemId);
    setEstimate(p => p ? ({
      ...p,
      sections: p.sections.map(s => s.id !== sectionId ? s : {
        ...s, items: s.items.filter(i => i.id !== itemId),
      }),
    }) : p);
  }, []);

  // ── Drag & drop reordering ────────────────────────────────────────────────
  const handleItemsReorder = useCallback(async (sectionId: string, reordered: ItemRow[]) => {
    setEstimate(p => p ? ({
      ...p,
      sections: p.sections.map(s => s.id === sectionId ? { ...s, items: reordered } : s),
    }) : p);
    await Promise.all(
      reordered.map((item, i) =>
        supabase.from("estimate_items").update({ sort_order: i * 10 }).eq("id", item.id)
      )
    );
  }, []);

  const handleSectionDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !estimate) return;
    const oldIdx = estimate.sections.findIndex(s => s.id === active.id);
    const newIdx = estimate.sections.findIndex(s => s.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(estimate.sections, oldIdx, newIdx);
    setEstimate(p => p ? { ...p, sections: reordered } : p);
    await Promise.all(
      reordered.map((s, i) =>
        supabase.from("estimate_sections").update({ sort_order: i * 10 }).eq("id", s.id)
      )
    );
  }, [estimate]);

  const sectionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  // ── Deposit payment helpers ───────────────────────────────────────────────
  const LEGACY_DEPOSIT_TYPES: Array<"anticipo" | "abono" | "final"> = ["anticipo", "abono", "final"];
  const DEPOSIT_PALETTE = ["#395886", "#4E7A82", "#4F8A63", "#7B6A45", "#7B1838", "#5C6A6E", "#16323D", "#628ECB"];

  const depositsForIdx = useCallback((idx: number) => {
    return projectPayments.filter(p => {
      if (p.installment_idx != null) return p.installment_idx === idx;
      return p.type === (LEGACY_DEPOSIT_TYPES[idx] ?? "final");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPayments]);

  const addDepositPayment = useCallback(async (idx: number) => {
    const amount = parseFloat(depAmt);
    if (!amount || amount <= 0 || !depDate) return;
    setDepSaving(true);
    const { data, error } = await supabase.from("payments").insert({
      project_id: project.id,
      amount,
      date:            depDate,
      method:          depMethod,
      concept:         depConcept.trim() || (EN ? "Partial payment" : "Pago parcial"),
      type:            LEGACY_DEPOSIT_TYPES[Math.min(idx, 2)],
      installment_idx: idx,
    }).select().single();
    setDepSaving(false);
    if (error || !data) { toast(EN ? "Error recording payment" : "Error al registrar el pago"); return; }
    setProjectPayments(p => [data as Payment, ...p]);
    setDepAmt(""); setDepConcept("");
    toast(`${EN ? "Payment added" : "Pago registrado"} · ${money(amount)}`);
    onRefresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depAmt, depDate, depMethod, depConcept, project.id, EN, toast, onRefresh]);

  const removeDepositPayment = useCallback(async (paymentId: string) => {
    await supabase.from("payments").delete().eq("id", paymentId);
    setProjectPayments(p => p.filter(x => x.id !== paymentId));
    if (editingPayId === paymentId) setEditingPayId(null);
    toast(EN ? "Payment removed" : "Pago eliminado");
    onRefresh();
  }, [EN, toast, onRefresh, editingPayId]);

  const updateDepositPayment = useCallback(async () => {
    if (!editingPayId) return;
    const amount = parseFloat(editForm.amount);
    if (!amount || amount <= 0) return;
    setDepSaving(true);
    const { error } = await supabase.from("payments").update({
      amount,
      date:    editForm.date,
      method:  editForm.method,
      concept: editForm.concept.trim(),
    }).eq("id", editingPayId);
    setDepSaving(false);
    if (error) { toast(EN ? "Error updating" : "Error al actualizar"); return; }
    setProjectPayments(p => p.map(x => x.id !== editingPayId ? x : { ...x, amount, date: editForm.date, method: editForm.method, concept: editForm.concept.trim() }));
    setEditingPayId(null);
    toast(EN ? "Payment updated" : "Pago actualizado");
    onRefresh();
  }, [editingPayId, editForm, EN, toast, onRefresh]);

  // ── Deposit schedule helpers ───────────────────────────────────────────────
  const depositTarget = useCallback((dep: import("@/src/types/project").DepositEntry, gt: number) =>
    dep.mode === "amount" && dep.fixed_amount != null
      ? dep.fixed_amount
      : Math.round(gt * dep.pct / 100 * 100) / 100,
  []);

  const openDepositEdit = useCallback((idx: number) => {
    if (!estimate) return;
    const dep = estimate.deposit_schedule[idx];
    if (!dep) return;
    const gt  = totals.grandTotal;
    const pct = dep.pct;
    const amt = dep.mode === "amount" && dep.fixed_amount != null
      ? dep.fixed_amount
      : Math.round(gt * pct / 100 * 100) / 100;
    setEditDepositIdx(idx);
    setEditDepositLabel(EN ? dep.label_en : dep.label_es);
    setEditDepositPct(String(Math.round(pct * 10) / 10));
    setEditDepositAmt(String(amt));
  }, [estimate, EN, totals.grandTotal]);

  const onEditDepositPctChange = useCallback((raw: string) => {
    setEditDepositPct(raw);
    const pct = parseFloat(raw) || 0;
    const gt  = totals.grandTotal;
    setEditDepositAmt(String(Math.round(gt * pct / 100 * 100) / 100));
  }, [totals.grandTotal]);

  const onEditDepositAmtChange = useCallback((raw: string) => {
    setEditDepositAmt(raw);
    const amt = parseFloat(raw) || 0;
    const gt  = totals.grandTotal;
    const pct = gt > 0 ? Math.round(amt / gt * 1000) / 10 : 0;
    setEditDepositPct(String(pct));
  }, [totals.grandTotal]);

  const saveDepositEdit = useCallback(() => {
    if (editDepositIdx === null || !estimate) return;
    const pct   = Math.max(0, parseFloat(editDepositPct) || 0);
    const label = editDepositLabel.trim() || (EN ? "PAYMENT" : "PAGO");
    setEstimate(prev => prev ? {
      ...prev,
      deposit_schedule: prev.deposit_schedule.map((d, j) => j === editDepositIdx ? {
        ...d, label_en: label, label_es: label, mode: "pct", pct, fixed_amount: undefined,
      } : d),
    } : prev);
    setEditDepositIdx(null);
  }, [editDepositIdx, editDepositLabel, editDepositPct, estimate, EN]);

  const addInstallment = useCallback(() => {
    setEstimate(prev => prev ? {
      ...prev,
      deposit_schedule: [...prev.deposit_schedule, { pct: 0, label_en: EN ? "NEW PAYMENT" : "NUEVO PAGO", label_es: EN ? "NEW PAYMENT" : "NUEVO PAGO", mode: "pct" as const }],
    } : prev);
  }, [EN]);

  const removeInstallment = useCallback((idx: number) => {
    setEstimate(prev => prev ? {
      ...prev,
      deposit_schedule: prev.deposit_schedule.filter((_, j) => j !== idx),
    } : prev);
    setConfirmDeleteDepositIdx(null);
    setDepositModal(dm => dm === idx ? null : dm);
  }, []);

  // ── PDF export ────────────────────────────────────────────────────────────
  const handleOpenPdf = useCallback((mode: "full" | "summary") => {
    if (!estimate) return;
    try {
      const { grandTotal, laborTotal, discountAmt } = totals;
      openEstimatePdfInBrowser(estimate as unknown as ProjectEstimate, grandTotal, laborTotal, discountAmt, language, project.title, mode);
    } catch (err) {
      console.error("[EstimateTab] PDF error:", err);
      toast(EN ? "Error generating PDF — check console" : "Error al generar PDF — revisa la consola");
    }
    setShowPdfModal(false);
  }, [estimate, totals, language, EN, toast]);

  // ── Copy estimate to another project ─────────────────────────────────────
  const openCopyModal = useCallback(async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, title, client")
      .neq("id", project.id)
      .order("title");
    const list = (data ?? []) as { id: string; title: string; client: string }[];
    setCopyProjects(list);
    const firstId = list[0]?.id ?? "";
    setCopyTargetId(firstId);
    if (firstId) {
      const { data: ex } = await supabase.from("project_estimates").select("id").eq("project_id", firstId).maybeSingle();
      setCopyHasEstimate(!!ex);
    } else {
      setCopyHasEstimate(false);
    }
    setShowCopyModal(true);
  }, [project.id]);

  const onCopyTargetChange = useCallback(async (targetId: string) => {
    setCopyTargetId(targetId);
    if (!targetId) { setCopyHasEstimate(false); return; }
    const { data } = await supabase.from("project_estimates").select("id").eq("project_id", targetId).maybeSingle();
    setCopyHasEstimate(!!data);
  }, []);

  const doCopyEstimate = useCallback(async () => {
    if (!estimate || !copyTargetId) return;
    setCopying(true);
    // Delete existing estimate in target (CASCADE removes sections + items)
    await supabase.from("project_estimates").delete().eq("project_id", copyTargetId);
    const targetProject = copyProjects.find(p => p.id === copyTargetId);
    const { data: newEst, error } = await supabase.from("project_estimates").insert({
      project_id:       copyTargetId,
      customer_name:    targetProject?.client ?? estimate.customer_name,
      city:             estimate.city,
      project_title:    targetProject?.title ?? estimate.project_title,
      email:            estimate.email,
      phone:            estimate.phone,
      status:           "draft",
      start_date:       estimate.start_date || null,
      end_date:         estimate.end_date   || null,
      discount_label:   estimate.discount_label,
      discount_pct:     estimate.discount_pct,
      deposit_schedule: estimate.deposit_schedule,
      notes:            estimate.notes,
    }).select().single();
    if (error || !newEst) {
      toast(EN ? "Error copying estimate" : "Error al copiar el estimado");
      setCopying(false);
      return;
    }
    for (const sec of estimate.sections) {
      const { data: newSec } = await supabase.from("estimate_sections").insert({
        estimate_id:       newEst.id,
        section_catalog_id: null,
        name_en:            sec.name_en,
        name_es:            sec.name_es,
        note:               sec.note,
        is_material_type:   sec.is_material_type,
        material_included:  sec.material_included,
        section_total:      sec.section_total,
        sort_order:         sec.sort_order,
      }).select().single();
      if (newSec && sec.items.length > 0) {
        await supabase.from("estimate_items").insert(
          sec.items.map(item => ({
            section_id:      newSec.id,
            item_catalog_id: null,
            description:     item.description,
            amount:          item.amount,
            sort_order:      item.sort_order,
          }))
        );
      }
    }
    setCopying(false);
    setShowCopyModal(false);
    toast(EN ? "Estimate copied successfully!" : "¡Estimado copiado correctamente!");
  }, [estimate, copyTargetId, copyProjects, EN, toast]);

  // ── WhatsApp send ─────────────────────────────────────────────────────────
  const handleWhatsApp = useCallback(async () => {
    if (!estimate || !waPhone.trim()) return;
    setWaLoading(true);
    try {
      const { grandTotal, laborTotal, discountAmt } = totals;
      const blob = getEstimatePdfBlob(estimate as unknown as ProjectEstimate, grandTotal, laborTotal, discountAmt, language, project.title);
      const safeName = (estimate.project_title || "project").replace(/\s+/g, "_");
      const filename = `Estimate_${safeName}.pdf`;
      const cleanPhone = (waCode + waPhone).replace(/\D/g, "");

      // Try native file share (mobile iOS/Android) — canShare can itself throw on desktop
      let shared = false;
      try {
        const file = new File([blob], filename, { type: "application/pdf" });
        if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
          shared = true;
        }
      } catch {
        // canShare or share not supported — fall through to desktop flow
      }

      if (!shared) {
        // Desktop: open WhatsApp Web first, then trigger PDF download
        window.open(`https://wa.me/${cleanPhone}`, "_blank");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast(EN
          ? "PDF downloaded — attach it in WhatsApp Web"
          : "PDF descargado — adjúntalo en WhatsApp Web");
      }
    } catch (err) {
      console.error("[EstimateTab] WhatsApp error:", err);
      toast(EN ? "Error generating PDF — check console" : "Error al generar PDF — revisa la consola");
    } finally {
      setWaLoading(false);
    }
  }, [estimate, totals, language, waCode, waPhone, EN, toast]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#16323D] border-t-transparent" />
    </div>
  );

  if (!estimate) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F7F3EA]">
        <FileText size={28} className="text-[#5C6A6E]" />
      </div>
      <h3 className="mb-2 text-base font-bold text-[#16323D]">
        {EN ? "No estimate yet" : "Sin estimado todavía"}
      </h3>
      <p className="mb-6 max-w-xs text-sm text-[#5C6A6E]">
        {EN
          ? "Create a professional proposal for this project to share with your client."
          : "Crea una propuesta profesional para este proyecto y compártela con tu cliente."}
      </p>
      <button
        onClick={createEstimate}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl bg-[#16323D] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#0F2830] disabled:opacity-50"
      >
        <Plus size={14} />
        {EN ? "Create Estimate" : "Crear Estimado"}
      </button>
    </div>
  );

  const { laborTotal, discountAmt, grandTotal } = totals;
  // DEPOSIT_PALETTE defined inside component for closures (also available above)

  return (
    <div className="space-y-3">

      {/* ── Status bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <select
            value={estimate.status}
            onChange={e => setEstimate(p => p ? ({ ...p, status: e.target.value as EstimateRow["status"] }) : p)}
            className={`cursor-pointer appearance-none rounded-full border-0 px-3 py-1 text-[11px] font-bold ${STATUS_STYLE[estimate.status]}`}
          >
            <option value="draft">{EN ? "Draft" : "Borrador"}</option>
            <option value="sent">{EN ? "Sent" : "Enviado"}</option>
            <option value="approved">{EN ? "Approved" : "Aprobado"}</option>
            <option value="rejected">{EN ? "Rejected" : "Rechazado"}</option>
          </select>
          <span className="text-[11px] text-[#5C6A6E]">{branding.companyName}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={saveHeader}
            disabled={saving}
            title={EN ? "Save changes to database" : "Guardar cambios en la base de datos"}
            className="rounded-xl border border-[#E6DDCB] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#16323D] transition hover:shadow-sm disabled:opacity-50"
          >
            {saving ? "…" : (EN ? "Save" : "Guardar")}
          </button>
          <button
            onClick={openCopyModal}
            title={EN ? "Copy estimate to another project" : "Copiar estimado a otro proyecto"}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6DDCB] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#395886] transition hover:bg-[#EDF3FB]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            {EN ? "Copy to…" : "Copiar a…"}
          </button>
          <button
            onClick={() => setShowPdfModal(true)}
            title={EN ? "Download PDF proposal" : "Descargar propuesta en PDF"}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#16323D] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#0F2830]"
          >
            <FileText size={12} /> {EN ? "Download PDF" : "Descargar PDF"}
          </button>
        </div>
      </div>

      {/* ── WhatsApp send ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E6DDCB] bg-white px-3 py-2">
        <span className="text-[11px] font-bold text-[#25D366]">WhatsApp</span>
        <select
          value={waCode}
          onChange={e => { setWaCode(e.target.value); setWaPhone(""); }}
          className="rounded-lg border border-[#E6DDCB] bg-[#FDFAF6] px-2 py-1 text-[11px] text-[#16323D] focus:outline-none"
        >
          {WA_CODES.map(c => (
            <option key={c.code} value={c.code}>{c.flag} {c.code} {c.label}</option>
          ))}
        </select>
        <input
          type="tel"
          value={waPhone}
          onChange={e => setWaPhone(fmtPhone(e.target.value, waCode))}
          placeholder={phonePlaceholder(waCode)}
          className="flex-1 min-w-[140px] rounded-lg border border-[#E6DDCB] bg-[#FDFAF6] px-3 py-1 text-[12px] text-[#16323D] focus:border-[#25D366] focus:outline-none"
        />
        <button
          onClick={handleWhatsApp}
          disabled={waLoading || !waPhone.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#1ebe5a] disabled:opacity-40"
        >
          <Send size={12} />
          {waLoading ? "…" : (EN ? "Send" : "Enviar")}
        </button>
        <span className="text-[10px] text-[#5C6A6E]">
          {EN ? "Mobile: shares PDF · Desktop: opens WhatsApp Web" : "Móvil: adjunta PDF · Desktop: abre WhatsApp Web"}
        </span>
      </div>

      {/* ── Customer info (collapsible) ────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] bg-white">
        <button
          className="flex w-full items-center justify-between px-4 py-3 transition hover:bg-[#FDFAF6]"
          onClick={() => setShowHeader(h => !h)}
        >
          <div className="flex items-center gap-3">
            <Info size={14} className="shrink-0 text-[#5C6A6E]" />
            <span className="text-[12px] font-bold text-[#16323D]">
              {estimate.customer_name || (EN ? "Customer info" : "Info del cliente")}
            </span>
            {estimate.city && <span className="text-[11px] text-[#5C6A6E]">· {estimate.city}</span>}
          </div>
          <div className="flex items-center gap-3">
            {totals.grandTotal > 0 && (
              <span className="font-mono text-[13px] font-bold text-[#16323D]">
                {money(totals.grandTotal)}
              </span>
            )}
            {showHeader ? <ChevronUp size={14} className="shrink-0 text-[#5C6A6E]" /> : <ChevronDown size={14} className="shrink-0 text-[#5C6A6E]" />}
          </div>
        </button>
        {showHeader && (
          <div className="grid grid-cols-2 gap-3 border-t border-[#F0EBE0] px-4 pb-4 pt-3 sm:grid-cols-3">
            {([
              { key: "customer_name", label: EN ? "Customer" : "Cliente",  type: "text"  },
              { key: "city",          label: EN ? "City" : "Ciudad",        type: "text"  },
              { key: "phone",         label: EN ? "Phone" : "Teléfono",     type: "tel"   },
              { key: "email",         label: "Email",                        type: "email" },
              { key: "start_date",    label: EN ? "Start" : "Inicio",       type: "date"  },
              { key: "end_date",      label: EN ? "End" : "Fin",            type: "date"  },
            ] as const).map(({ key, label, type }) => (
              <label key={key} className="grid gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E]">{label}</span>
                <input
                  type={type}
                  value={(estimate as unknown as Record<string, string>)[key] ?? ""}
                  onChange={e => setEstimate(p => p ? ({ ...p, [key]: e.target.value }) : p)}
                  className="rounded-lg border border-[#E6DDCB] bg-[#FDFAF6] px-3 py-1.5 text-[12px] text-[#16323D] focus:border-[#395886] focus:outline-none"
                />
              </label>
            ))}
          </div>
        )}
      </div>

      {/* ── Section cards — drag & drop ─────────────────────────────────────── */}
      <DndContext sensors={sectionSensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
        <SortableContext items={estimate.sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {estimate.sections.map(section => {
              const hasItemAmounts = section.items.some(i => i.amount > 0);
              const effectiveTotal = sectionEffectiveTotal(section);
              return (
                <SortableSection
                  key={section.id}
                  section={section}
                  isOpen={expanded.has(section.id)}
                  EN={EN}
                  effectiveTotal={effectiveTotal}
                  hasItemAmounts={hasItemAmounts}
                  onToggle={() => setExpanded(prev => {
                    const n = new Set(prev);
                    n.has(section.id) ? n.delete(section.id) : n.add(section.id);
                    return n;
                  })}
                  onUpdateField={updateSectionField}
                  onDelete={(id) => {
                    const sec = estimate.sections.find(s => s.id === id);
                    setConfirmDeleteSection({ id, name: EN ? (sec?.name_en ?? "") : (sec?.name_es ?? "") });
                  }}
                  onUpdateItem={updateItemLocal}
                  onSaveItem={saveItemField}
                  onDeleteItem={deleteItem}
                  onItemsReorder={handleItemsReorder}
                  onAddItem={addItem}
                  addingItemTo={addingItemTo}
                  setAddingItemTo={setAddingItemTo}
                  newItemDesc={newItemDesc}
                  setNewItemDesc={setNewItemDesc}
                  newItemAmt={newItemAmt}
                  setNewItemAmt={setNewItemAmt}
                  editingNameId={editingNameId}
                  setEditingNameId={setEditingNameId}
                  onSaveName={saveSectionName}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* ── Add section ───────────────────────────────────────────────────── */}
      <button
        onClick={() => setShowAddSection(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#D7CBB3] py-3 text-[12px] font-semibold text-[#5C6A6E] transition hover:border-[#395886] hover:text-[#395886]"
      >
        <Plus size={14} /> {EN ? "Add section" : "Agregar sección"}
      </button>

      {/* ── Totals card ───────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] bg-white">
        <div className="border-b border-[#E6DDCB] bg-[#F7F3EA] px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#5C6A6E]">
            {EN ? "Totals" : "Totales"}
          </div>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">

          {/* Left: amounts */}
          <div className="space-y-2.5">
            {discountAmt > 0 && (
              <div className="flex justify-between text-[12px]">
                <span className="text-[#5C6A6E]">{EN ? "Labor subtotal" : "Subtotal mano de obra"}</span>
                <span className="font-mono text-[#16323D]">{money(laborTotal)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={estimate.discount_label}
                  onChange={e => setEstimate(p => p ? ({ ...p, discount_label: e.target.value }) : p)}
                  className="w-28 rounded border border-transparent bg-transparent px-1.5 py-0.5 text-[11px] text-[#5C6A6E] hover:border-[#E6DDCB] focus:border-[#395886] focus:outline-none"
                />
                <span className="text-[11px] text-[#5C6A6E]">(−</span>
                <input
                  type="number"
                  value={estimate.discount_pct}
                  onChange={e => setEstimate(p => p ? ({ ...p, discount_pct: parseFloat(e.target.value) || 0 }) : p)}
                  className="w-12 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-[11px] text-[#5C6A6E] hover:border-[#E6DDCB] focus:border-[#395886] focus:outline-none"
                />
                <span className="text-[11px] text-[#5C6A6E]">%)</span>
              </div>
              <span className={`font-mono text-[12px] ${discountAmt > 0 ? "text-[#4F8A63]" : "text-[#5C6A6E]"}`}>
                {discountAmt > 0 ? `−${money(discountAmt)}` : "—"}
              </span>
            </div>
            <div className="flex justify-between border-t border-[#E6DDCB] pt-2 text-[14px] font-bold text-[#16323D]">
              <span>{EN ? "Grand Total" : "Total Final"}</span>
              <span className="font-mono">{money(grandTotal)}</span>
            </div>
          </div>

          {/* Right: payment schedule */}
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#5C6A6E]">
              {EN ? "Payment Schedule" : "Calendario de Pagos"}
            </div>
            <div className="space-y-2">
              {(estimate.deposit_schedule ?? defaultDeposits()).map((dep, i) => {
                const color    = DEPOSIT_PALETTE[i % DEPOSIT_PALETTE.length];
                const target   = depositTarget(dep, grandTotal);
                const received = depositsForIdx(i).reduce((s, p) => s + p.amount, 0);
                const receivedPct = target > 0 ? Math.min(100, Math.round(received / target * 100)) : 0;
                const paid     = target > 0 && received >= target;
                const isConfirmDelete = confirmDeleteDepositIdx === i;

                return (
                  <div key={i} className="rounded-xl border border-[#E6DDCB] overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2">
                      {/* Value badge — click to open edit modal */}
                      <button
                        onClick={() => openDepositEdit(i)}
                        title={EN ? "Edit installment" : "Editar cuota"}
                        className="flex shrink-0 flex-col items-center rounded-xl px-4 py-2.5 transition hover:opacity-80 active:scale-95"
                        style={{ background: color }}
                      >
                        <span className="text-[15px] font-extrabold leading-tight text-white">
                          {Math.round(dep.pct)}%
                        </span>
                        <span className="text-[10px] font-semibold text-white/75 leading-snug">
                          {money(target)}
                        </span>
                      </button>

                      {/* Label + received / target */}
                      <div className="flex-1 min-w-0">
                        <button
                          className="group mb-0.5 flex items-center gap-1 text-left"
                          onClick={() => openDepositEdit(i)}
                          title={EN ? "Click to edit" : "Clic para editar"}
                        >
                          <span className="text-[10px] font-semibold uppercase text-[#5C6A6E] group-hover:text-[#395886] truncate max-w-[150px]">
                            {EN ? dep.label_en : dep.label_es}
                          </span>
                          <Pencil size={8} className="shrink-0 text-[#C4B89A] group-hover:text-[#395886]" />
                        </button>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono text-[11px] font-semibold ${paid ? "text-[#4F8A63]" : "text-[#16323D]"}`}>
                            {money(received)}
                          </span>
                          <span className="text-[10px] text-[#5C6A6E]">/ {money(target)}</span>
                          {paid && <span className="text-[9px] font-bold text-[#4F8A63]">✓ {EN ? "PAID" : "COBRADO"}</span>}
                        </div>
                      </div>

                      {/* Actions: delete confirm + detail */}
                      <div className="flex shrink-0 items-center gap-1">
                        {isConfirmDelete ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-semibold text-[#B0492F] whitespace-nowrap">{EN ? "Delete?" : "¿Eliminar?"}</span>
                            <button onClick={() => removeInstallment(i)}
                              className="rounded bg-[#B0492F] px-1.5 py-0.5 text-[9px] font-bold text-white hover:bg-[#9a3d27]">
                              {EN ? "Yes" : "Sí"}
                            </button>
                            <button onClick={() => setConfirmDeleteDepositIdx(null)}
                              className="rounded border border-[#E6DDCB] px-1.5 py-0.5 text-[9px] text-[#5C6A6E] hover:bg-[#F7F3EA]">
                              {EN ? "No" : "No"}
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteDepositIdx(i)}
                            className="rounded p-1 text-[#C4B89A] hover:bg-[#FDE8E3] hover:text-[#B0492F] transition"
                            title={EN ? "Remove installment" : "Eliminar cuota"}>
                            <Trash2 size={11} />
                          </button>
                        )}
                        <button
                          onClick={() => { setDepositModal(i); setDepAmt(""); setDepConcept(""); setDepDate(new Date().toISOString().split("T")[0]); }}
                          className="shrink-0 rounded-lg border border-[#E6DDCB] bg-white px-2.5 py-1.5 text-[10px] font-bold text-[#395886] hover:bg-[#EDF3FB] transition"
                        >
                          {EN ? "Detail" : "Detalle"}
                        </button>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-[4px] bg-[#F0EBE0]">
                      <div className="h-full transition-all duration-500" style={{ width: `${receivedPct}%`, background: paid ? "#4F8A63" : color }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Add installment */}
            <button
              onClick={addInstallment}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#D5CBBA] py-2 text-[11px] font-semibold text-[#97A1A0] transition hover:border-[#395886] hover:text-[#395886]"
            >
              <Plus size={11} /> {EN ? "Add payment" : "Agregar cuota"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Action bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setShowGenTasks(true)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#395886] bg-[#EDF3FB] px-4 py-2.5 text-sm font-bold text-[#395886] transition hover:bg-[#D5DEEF]"
        >
          <Zap size={14} />
          {EN ? "Generate Workflow Tasks" : "Generar Tareas en Workflow"}
        </button>
        <button
          onClick={() => setShowPdfModal(true)}
          title={EN ? "Download PDF proposal" : "Descargar propuesta en PDF"}
          className="inline-flex items-center gap-2 rounded-xl bg-[#16323D] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0F2830]"
        >
          <FileText size={14} />
          {EN ? "Download PDF" : "Descargar PDF"}
        </button>
      </div>

      {/* ── Add Section modal ──────────────────────────────────────────────── */}
      {showAddSection && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setShowAddSection(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E6DDCB] px-5 py-3.5">
              <span className="text-sm font-bold text-[#16323D]">
                {EN ? "Add Section" : "Agregar Sección"}
              </span>
              <button onClick={() => setShowAddSection(false)} className="text-[#5C6A6E] hover:text-[#B0492F]">
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto p-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#5C6A6E]">
                {EN ? "From catalog" : "Del catálogo"}
              </div>
              {effectiveCatalog.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => addSection(cat as EstimateSectionCatalog & { id: string })}
                  className="w-full rounded-xl border border-[#E6DDCB] px-4 py-3 text-left transition hover:border-[#395886] hover:bg-[#EDF3FB]"
                >
                  <div className="flex items-center gap-2">
                    <span>{cat.is_material_type ? "📦" : "🔨"}</span>
                    <span className="text-[12px] font-semibold text-[#16323D]">{EN ? cat.name_en : cat.name_es}</span>
                  </div>
                  {(EN ? cat.note_en : cat.note_es) && (
                    <div className="mt-0.5 pl-6 text-[10px] text-[#5C6A6E]">{EN ? cat.note_en : cat.note_es}</div>
                  )}
                </button>
              ))}
              <div className="border-t border-[#E6DDCB] pt-2">
                <button
                  onClick={() => addSection()}
                  className="w-full rounded-xl border-2 border-dashed border-[#D7CBB3] px-4 py-3 text-left text-[12px] font-semibold text-[#5C6A6E] transition hover:border-[#395886] hover:bg-[#EDF3FB] hover:text-[#395886]"
                >
                  {EN ? "+ Custom section" : "+ Sección personalizada"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Deposit detail modal ──────────────────────────────────────────── */}
      {depositModal !== null && estimate && (() => {
        const idx     = depositModal;
        const dep     = estimate.deposit_schedule[idx] ?? defaultDeposits()[idx];
        const target  = depositTarget(dep, totals.grandTotal);
        const pmts    = depositsForIdx(idx);
        const received = pmts.reduce((s, p) => s + p.amount, 0);
        const remaining = Math.max(0, target - received);
        const pct     = target > 0 ? Math.min(100, Math.round(received / target * 100)) : 0;
        const label   = EN ? dep.label_en : dep.label_es;
        return (
          <div
            className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => { setDepositModal(null); setConfirmDeletePayId(null); setEditingPayId(null); }}
          >
            <div
              className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#E6DDCB] bg-[#16323D] px-5 py-4">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                    {EN ? "Payment Detail" : "Detalle de Pago"} · {money(target)}
                    {dep.mode === "amount"
                      ? ` (${Math.round((dep.fixed_amount ?? 0) / (totals.grandTotal || 1) * 100)}%)`
                      : ` (${Math.round(dep.pct)}%)`}
                  </p>
                  <h3 className="mt-0.5 text-base font-bold text-white">{label}</h3>
                </div>
                <button onClick={() => { setDepositModal(null); setConfirmDeletePayId(null); setEditingPayId(null); }} className="shrink-0 text-white/60 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-px bg-[#E6DDCB] border-b border-[#E6DDCB]">
                {[
                  { label: EN ? "Target" : "Total a cobrar", value: money(target), color: "text-[#16323D]" },
                  { label: EN ? "Received" : "Recibido",     value: money(received), color: "text-[#4F8A63]" },
                  { label: EN ? "Remaining" : "Pendiente",   value: money(remaining), color: remaining > 0 ? "text-[#B0492F]" : "text-[#4F8A63]" },
                ].map(c => (
                  <div key={c.label} className="bg-[#F7F3EA] px-4 py-3 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#5C6A6E]">{c.label}</p>
                    <p className={`mt-1 font-mono text-[15px] font-bold ${c.color}`}>{c.value}</p>
                  </div>
                ))}
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-[#E6DDCB]">
                <div className={`h-full transition-all ${pct >= 100 ? "bg-[#4F8A63]" : "bg-[#395886]"}`} style={{ width: `${pct}%` }} />
              </div>

              {/* Payments grid */}
              <div className="max-h-48 overflow-y-auto">
                {pmts.length === 0 ? (
                  <p className="py-6 text-center text-[12px] text-[#5C6A6E]">
                    {EN ? "No payments yet" : "Sin pagos registrados"}
                  </p>
                ) : (
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-[#FAFAF8] text-[9px] font-bold uppercase tracking-wider text-[#5C6A6E]">
                        <th className="px-4 py-2 text-left">{EN ? "Date" : "Fecha"}</th>
                        <th className="px-4 py-2 text-left">{EN ? "Concept" : "Concepto"}</th>
                        <th className="px-4 py-2 text-left">{EN ? "Method" : "Método"}</th>
                        <th className="px-4 py-2 text-right">{EN ? "Amount" : "Monto"}</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {pmts.map(p => {
                        const isEditing = editingPayId === p.id;
                        const otherTotal = pmts.filter(x => x.id !== p.id).reduce((s, x) => s + x.amount, 0);
                        const editAmt = parseFloat(editForm.amount) || 0;
                        const editWouldExceed = isEditing && editAmt > 0 && otherTotal + editAmt > target + 0.005;
                        return (
                          <tr key={p.id} className={`border-t border-[#F0EBE0] ${isEditing ? "bg-[#EDF3FB]" : "hover:bg-[#FDFAF6]"}`}>
                            {isEditing ? (
                              <>
                                <td className="px-2 py-1.5">
                                  <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                                    className="w-full rounded border border-[#D7CBB3] bg-white px-1.5 py-1 text-[11px] focus:outline-none" />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input type="text" value={editForm.concept} onChange={e => setEditForm(f => ({ ...f, concept: e.target.value }))}
                                    placeholder={EN ? "Concept" : "Concepto"}
                                    className="w-full rounded border border-[#D7CBB3] bg-white px-1.5 py-1 text-[11px] focus:outline-none" />
                                </td>
                                <td className="px-2 py-1.5">
                                  <select value={editForm.method} onChange={e => setEditForm(f => ({ ...f, method: e.target.value as Payment["method"] }))}
                                    className="rounded border border-[#D7CBB3] bg-white px-1 py-1 text-[11px] focus:outline-none">
                                    {["Transferencia","Efectivo","Zelle","Cheque","Tarjeta"].map(m => <option key={m}>{m}</option>)}
                                  </select>
                                </td>
                                <td className="px-2 py-1.5">
                                  <input type="number" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                                    className={`w-20 rounded border px-1.5 py-1 text-right text-[11px] font-mono focus:outline-none ${editWouldExceed ? "border-[#B0492F] bg-[#FDF0ED]" : "border-[#D7CBB3] bg-white"}`} />
                                  {editWouldExceed && (
                                    <p className="mt-0.5 text-[9px] text-[#B0492F]">Máx: {money(Math.max(0, target - otherTotal))}</p>
                                  )}
                                </td>
                                <td className="px-2 py-1.5">
                                  <div className="flex gap-1">
                                    <button onClick={updateDepositPayment} disabled={depSaving || editWouldExceed}
                                      className="rounded bg-[#4F8A63] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#3f7051] disabled:opacity-40">
                                      {depSaving ? "…" : "✓"}
                                    </button>
                                    <button onClick={() => setEditingPayId(null)}
                                      className="rounded border border-[#E6DDCB] px-2 py-1 text-[10px] text-[#5C6A6E] hover:bg-[#F7F3EA]">
                                      ✕
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-2 text-[#5C6A6E]">{p.date}</td>
                                <td className="px-4 py-2 text-[#16323D] max-w-[130px] truncate">{p.concept || "—"}</td>
                                <td className="px-4 py-2 text-[#5C6A6E]">{p.method}</td>
                                <td className="px-4 py-2 text-right font-mono font-semibold text-[#16323D]">{money(p.amount)}</td>
                                <td className="px-2 py-2">
                                  {confirmDeletePayId === p.id ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[9px] text-[#B0492F] font-semibold whitespace-nowrap">{EN ? "Delete?" : "¿Eliminar?"}</span>
                                      <button
                                        onClick={() => { removeDepositPayment(p.id); setConfirmDeletePayId(null); }}
                                        className="rounded bg-[#B0492F] px-2 py-0.5 text-[10px] font-bold text-white hover:bg-[#9a3d27]"
                                      >{EN ? "Yes" : "Sí"}</button>
                                      <button
                                        onClick={() => setConfirmDeletePayId(null)}
                                        className="rounded border border-[#E6DDCB] px-2 py-0.5 text-[10px] text-[#5C6A6E] hover:bg-[#F7F3EA]"
                                      >{EN ? "No" : "No"}</button>
                                    </div>
                                  ) : (
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => { setEditingPayId(p.id); setEditForm({ amount: String(p.amount), date: p.date, method: p.method, concept: p.concept ?? "" }); }}
                                        className="rounded p-1 text-[#C4B89A] hover:bg-[#EDF3FB] hover:text-[#395886] transition"
                                      ><Pencil size={10} /></button>
                                      <button
                                        onClick={() => setConfirmDeletePayId(p.id)}
                                        className="rounded p-1 text-[#C4B89A] hover:bg-[#FDF0ED] hover:text-[#B0492F] transition"
                                      ><X size={11} /></button>
                                    </div>
                                  )}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Add payment form */}
              <div className="border-t border-[#E6DDCB] bg-[#F7F3EA] p-4">
                {/* Overage warning when already exceeded */}
                {received > target + 0.005 && (
                  <div className="mb-3 rounded-lg border border-[#F5C6B5] bg-[#FDF0ED] px-3 py-2 text-[11px] text-[#B0492F]">
                    ⚠️ {EN
                      ? `Total received (${money(received)}) exceeds target (${money(target)}) by ${money(received - target)}. Remove a payment to correct this.`
                      : `El total recibido (${money(received)}) supera el objetivo (${money(target)}) por ${money(received - target)}. Elimina un pago para corregirlo.`}
                  </div>
                )}
                {(() => {
                  const newAmt = parseFloat(depAmt) || 0;
                  const remaining = Math.max(0, target - received);
                  const wouldExceed = newAmt > 0 && received + newAmt > target + 0.005;
                  return (
                    <>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#5C6A6E]">
                        {EN ? "Add partial payment" : "Agregar pago a cuenta"}
                        {remaining > 0 && <span className="ml-2 font-normal normal-case text-[#395886]">({EN ? "pending" : "pendiente"}: {money(remaining)})</span>}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <input
                            type="number" placeholder={EN ? "Amount" : "Monto"} value={depAmt}
                            onChange={e => setDepAmt(e.target.value)}
                            className={`w-full rounded-lg border px-3 py-2 text-[12px] focus:outline-none ${wouldExceed ? "border-[#B0492F] bg-[#FDF0ED] focus:border-[#B0492F]" : "border-[#E6DDCB] bg-white focus:border-[#395886]"}`}
                          />
                          {wouldExceed && (
                            <p className="mt-1 text-[10px] text-[#B0492F]">
                              {EN ? `Max: ${money(remaining)}` : `Máx: ${money(remaining)}`}
                            </p>
                          )}
                        </div>
                        <input
                          type="date" value={depDate}
                          onChange={e => setDepDate(e.target.value)}
                          className="rounded-lg border border-[#E6DDCB] bg-white px-3 py-2 text-[12px] focus:border-[#395886] focus:outline-none"
                        />
                        <select
                          value={depMethod}
                          onChange={e => setDepMethod(e.target.value as Payment["method"])}
                          className="rounded-lg border border-[#E6DDCB] bg-white px-3 py-2 text-[12px] focus:border-[#395886] focus:outline-none"
                        >
                          {["Transferencia","Efectivo","Zelle","Cheque","Tarjeta"].map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <input
                          type="text" placeholder={EN ? "Comment (e.g. first deposit)" : "Comentario (ej. primer depósito)"}
                          value={depConcept} onChange={e => setDepConcept(e.target.value)}
                          className="rounded-lg border border-[#E6DDCB] bg-white px-3 py-2 text-[12px] focus:border-[#395886] focus:outline-none"
                        />
                      </div>
                      {wouldExceed && (
                        <p className="mt-2 rounded-lg border border-[#F5C6B5] bg-[#FDF0ED] px-3 py-2 text-[11px] text-[#B0492F]">
                          ⚠️ {EN
                            ? `This amount would exceed the target. You can only add up to ${money(remaining)}.`
                            : `Este monto supera el objetivo. Solo puedes agregar hasta ${money(remaining)}.`}
                        </p>
                      )}
                      <button
                        onClick={() => addDepositPayment(idx)}
                        disabled={depSaving || !depAmt || parseFloat(depAmt) <= 0 || wouldExceed}
                        className="mt-2 w-full rounded-xl bg-[#16323D] py-2.5 text-[12px] font-bold text-white transition hover:bg-[#0F2830] disabled:opacity-40"
                      >
                        {depSaving ? "…" : (EN ? "+ Register payment" : "+ Registrar pago")}
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Floating Save FAB ─────────────────────────────────────────────── */}
      <button
        onClick={saveHeader}
        disabled={saving}
        title={EN ? "Save estimate" : "Guardar estimado"}
        className="fixed bottom-[5.5rem] right-6 z-[200] flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-full bg-[#7B1838] text-white shadow-[0_4px_20px_rgba(123,24,56,0.45)] transition hover:bg-[#6a1530] hover:shadow-[0_6px_24px_rgba(123,24,56,0.55)] disabled:opacity-60 active:scale-95"
      >
        {saving
          ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          : <Save size={19} strokeWidth={2.2} />}
        <span className="text-[9px] font-bold tracking-wide">
          {saving ? "…" : (EN ? "SAVE" : "GUARDAR")}
        </span>
      </button>

      {/* ── Confirm delete section ────────────────────────────────────────── */}
      {confirmDeleteSection && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setConfirmDeleteSection(null)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-[#E6DDCB] px-5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FDF0ED] text-lg">
                🗑
              </div>
              <h3 className="font-bold text-[#16323D]">
                {EN ? "Delete section?" : "¿Eliminar sección?"}
              </h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-[#5C6A6E]">
                {EN
                  ? <>The section <strong className="text-[#16323D]">{confirmDeleteSection.name}</strong> and all its items will be permanently deleted. This cannot be undone.</>
                  : <>La sección <strong className="text-[#16323D]">{confirmDeleteSection.name}</strong> y todos sus ítems serán eliminados permanentemente. Esta acción no se puede deshacer.</>}
              </p>
            </div>
            <div className="flex gap-2 border-t border-[#E6DDCB] px-5 py-4">
              <button
                onClick={() => setConfirmDeleteSection(null)}
                className="flex-1 rounded-xl border border-[#E6DDCB] py-2.5 text-sm font-semibold text-[#5C6A6E] transition hover:bg-[#F7F3EA]"
              >
                {EN ? "Cancel" : "Cancelar"}
              </button>
              <button
                onClick={() => {
                  deleteSection(confirmDeleteSection.id);
                  setConfirmDeleteSection(null);
                }}
                className="flex-1 rounded-xl bg-[#B0492F] py-2.5 text-sm font-bold text-white transition hover:bg-[#963d27]"
              >
                {EN ? "Delete" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit installment modal ────────────────────────────────────────── */}
      {editDepositIdx !== null && estimate && (() => {
        const dep   = estimate.deposit_schedule[editDepositIdx];
        const color = DEPOSIT_PALETTE[editDepositIdx % DEPOSIT_PALETTE.length];
        return (
          <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => setEditDepositIdx(null)}>
            <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3" style={{ background: color }}>
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">
                  {EN ? "Edit installment" : "Editar cuota"} #{editDepositIdx + 1}
                </p>
                <button onClick={() => setEditDepositIdx(null)} className="text-white/60 hover:text-white"><X size={16} /></button>
              </div>

              {/* Two-box value editor */}
              <div className="grid grid-cols-2 divide-x divide-[#E6DDCB] border-b border-[#E6DDCB]">
                {/* % box */}
                <div className="flex flex-col items-center px-5 py-5" style={{ background: color }}>
                  <label className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/60">
                    {EN ? "Percentage" : "Porcentaje"}
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min={0} max={9999}
                      value={editDepositPct}
                      onChange={e => onEditDepositPctChange(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveDepositEdit(); if (e.key === "Escape") setEditDepositIdx(null); }}
                      className="w-16 appearance-none bg-transparent text-center text-[28px] font-extrabold text-white focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="text-[20px] font-bold text-white/70">%</span>
                  </div>
                </div>
                {/* $ box */}
                <div className="flex flex-col items-center px-5 py-5 bg-[#F7F3EA]">
                  <label className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#97A1A0]">
                    {EN ? "Amount" : "Monto"}
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-[20px] font-bold text-[#97A1A0]">$</span>
                    <input
                      type="number" min={0}
                      value={editDepositAmt}
                      onChange={e => onEditDepositAmtChange(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveDepositEdit(); }}
                      className="w-24 appearance-none bg-transparent text-center text-[22px] font-extrabold text-[#16323D] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                </div>
              </div>

              {/* Concept */}
              <div className="px-5 py-4">
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#5C6A6E]">
                  {EN ? "Concept" : "Concepto"}
                </label>
                <input
                  value={editDepositLabel}
                  onChange={e => setEditDepositLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveDepositEdit(); if (e.key === "Escape") setEditDepositIdx(null); }}
                  className="w-full rounded-xl border border-[#E6DDCB] px-3 py-2.5 text-sm font-semibold text-[#16323D] focus:border-[#395886] focus:outline-none"
                  placeholder={EN ? "e.g. At sign contract" : "Ej. Al firmar contrato"}
                />
              </div>

              {/* Footer */}
              <div className="flex gap-2 border-t border-[#E6DDCB] px-5 py-4">
                <button onClick={() => setEditDepositIdx(null)}
                  className="flex-1 rounded-xl border border-[#E6DDCB] py-2.5 text-sm font-bold text-[#5C6A6E] transition hover:bg-[#F7F3EA]">
                  {EN ? "Cancel" : "Cancelar"}
                </button>
                <button onClick={saveDepositEdit}
                  className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                  style={{ background: color }}>
                  {EN ? "Save" : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── PDF mode modal ─────────────────────────────────────────────────── */}
      {showPdfModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#E6DDCB] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E6DDCB] bg-[#16323D] px-5 py-4 rounded-t-2xl">
              <p className="text-sm font-bold text-white">{EN ? "Choose PDF format" : "Elige el formato PDF"}</p>
              <button onClick={() => setShowPdfModal(false)} className="text-white/60 hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-3 p-5">
              <button
                onClick={() => handleOpenPdf("full")}
                className="flex items-start gap-4 rounded-xl border-2 border-[#16323D] bg-[#F7F3EA] p-4 text-left transition hover:bg-[#EDE8E0]"
              >
                <FileText size={28} className="mt-0.5 flex-none text-[#16323D]" />
                <div>
                  <p className="font-bold text-[#16323D]">{EN ? "Estimate with detail" : "Estimado con detalle"}</p>
                  <p className="mt-0.5 text-xs text-[#5C6A6E]">{EN ? "Shows all section totals and item amounts" : "Muestra totales de secciones y montos de items"}</p>
                </div>
              </button>
              <button
                onClick={() => handleOpenPdf("summary")}
                className="flex items-start gap-4 rounded-xl border-2 border-[#E6DDCB] bg-white p-4 text-left transition hover:border-[#395886] hover:bg-[#F0F3FA]"
              >
                <FileText size={28} className="mt-0.5 flex-none text-[#395886]" />
                <div>
                  <p className="font-bold text-[#16323D]">{EN ? "Estimate without detail" : "Estimado sin detalle"}</p>
                  <p className="mt-0.5 text-xs text-[#5C6A6E]">{EN ? "Scope of work only — no amounts shown, payment schedule included" : "Solo alcance de trabajo — sin montos, incluye plan de pagos"}</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Day Planner modal ──────────────────────────────────────────────── */}
      {showGenTasks && estimate && (
        <DayPlannerModal
          estimate={estimate}
          projectId={project.id}
          onClose={() => setShowGenTasks(false)}
          onGenerated={() => { setShowGenTasks(false); onRefresh(); }}
          toast={toast}
        />
      )}

      {/* ── Copy-to-project modal ─────────────────────────────────────────── */}
      {showCopyModal && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setShowCopyModal(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-[#395886] px-5 py-4">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <p className="text-sm font-bold text-white">
                  {EN ? "Copy estimate to project" : "Copiar estimado a proyecto"}
                </p>
              </div>
              <button onClick={() => setShowCopyModal(false)} className="text-white/60 hover:text-white">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5">
              <p className="mb-3 text-[12px] text-[#5C6A6E]">
                {EN
                  ? "All sections and items will be copied. Customer name and project title will be updated to match the target project."
                  : "Se copiarán todas las secciones e ítems. El nombre del cliente y el título del proyecto se actualizarán al proyecto destino."}
              </p>
              {copyProjects.length === 0 ? (
                <p className="rounded-xl bg-[#F7F3EA] px-4 py-3 text-sm text-[#5C6A6E]">
                  {EN ? "No other projects found." : "No hay otros proyectos disponibles."}
                </p>
              ) : (
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#5C6A6E]">
                    {EN ? "Destination project" : "Proyecto destino"}
                  </label>
                  <select
                    value={copyTargetId}
                    onChange={e => onCopyTargetChange(e.target.value)}
                    className="w-full rounded-xl border border-[#E6DDCB] bg-[#FDFAF6] px-3 py-2.5 text-sm font-semibold text-[#16323D] focus:border-[#395886] focus:outline-none"
                  >
                    {copyProjects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.title}{p.client ? ` — ${p.client}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {copyHasEstimate && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#F0DBD2] bg-[#FDF0ED] px-3 py-2.5">
                  <span className="mt-0.5 shrink-0 text-[#B0492F]">⚠</span>
                  <p className="text-[11px] font-semibold text-[#B0492F]">
                    {EN
                      ? "This project already has an estimate. It will be replaced."
                      : "Este proyecto ya tiene un estimado. Será reemplazado."}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 border-t border-[#E6DDCB] px-5 py-4">
              <button
                onClick={() => setShowCopyModal(false)}
                className="flex-1 rounded-xl border border-[#E6DDCB] py-2.5 text-sm font-semibold text-[#5C6A6E] transition hover:bg-[#F7F3EA]"
              >
                {EN ? "Cancel" : "Cancelar"}
              </button>
              <button
                onClick={doCopyEstimate}
                disabled={copying || !copyTargetId}
                className="flex-1 rounded-xl bg-[#395886] py-2.5 text-sm font-bold text-white transition hover:bg-[#2d4a75] disabled:opacity-50"
              >
                {copying ? "…" : (EN ? "Copy estimate" : "Copiar estimado")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
