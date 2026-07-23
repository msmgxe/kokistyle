"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  ChevronDown, ChevronUp, Plus, X, Trash2, FileText, Zap, Info, GripVertical, Save, Pencil,
} from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import { money } from "@/src/lib/utils";
import { openEstimatePdfInBrowser, getEstimatePdfBlob, exportInvoicePdf, openInvoicePdfInBrowser, getInvoicePdfBlob, type InvoiceData } from "@/src/lib/pdf";
import { addProjectNote, noteDate } from "@/src/lib/notes";
import { computeGrandTotal } from "@/src/lib/estimateTotals";

import type { Project, EstimateSectionCatalog, DepositEntry, ProjectEstimate, Payment } from "@/src/types/project";
import { useLanguage } from "@/src/context/LanguageContext";
import { branding } from "@/src/config/branding";
import DayPlannerModal from "./DayPlannerModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ItemRow {
  id: string;
  section_id: string;
  description: string;
  cost: number;    // monto real (interno, nunca va al PDF)
  profit: number;  // ganancia — default 30% del costo, editable
  amount: number;  // monto cliente = cost + profit (columna que ve el cliente)
  sort_order: number;
}

const DEFAULT_PROFIT_PCT = 0.30;
const round2 = (n: number) => Math.round(n * 100) / 100;

interface SectionRow {
  id: string;
  estimate_id: string;
  section_catalog_id?: string | null;
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
  customer_company?: string;
  customer_address?: string;
  customer_website?: string;
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
  draft:    "bg-[#EDE3CF] dark:bg-[#17233d] text-[#7A6230]",
  sent:     "bg-[#DCE8E9] dark:bg-[#122a2c] text-[#4E7A82]",
  approved: "bg-[#DCEBDD] dark:bg-[#14261c] text-[#4F8A63]",
  rejected: "bg-[#F0DBD2] dark:bg-[#2a1712] text-[#B0492F]",
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
  onUpdateLocal: (sectionId: string, itemId: string, field: "description" | "cost" | "profit", value: string) => void;
  onSaveField:   (itemId: string) => void;
  onDelete:      (sectionId: string, itemId: string) => void;
}

function SortableItem({ item, sectionId, onUpdateLocal, onSaveField, onDelete }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const numCls = "w-16 sm:w-20 rounded bg-transparent px-1 py-0.5 text-right font-mono text-[10px] hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220] focus:border-b focus:border-[var(--accent)] focus:bg-white dark:focus:bg-[#111a2e] focus:outline-none";
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="group flex items-center gap-2 border-b border-[#F0EBE0] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-4 py-2 hover:bg-[#FDFAF6] dark:hover:bg-[#111a2e]"
    >
      <button
        {...attributes} {...listeners}
        tabIndex={-1}
        aria-label="Drag to reorder"
        className="shrink-0 cursor-grab touch-none p-0.5 text-[#D7CBB3] hover:text-[#5C6A6E] dark:hover:text-[#9fb0cc] active:cursor-grabbing"
      >
        <GripVertical size={12} />
      </button>
      <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C4B89A]" />
      <input
        type="text"
        value={item.description}
        onChange={e => onUpdateLocal(sectionId, item.id, "description", e.target.value)}
        onBlur={()  => onSaveField(item.id)}
        className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-[10px] text-[var(--brand)] hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220] focus:border-b focus:border-[var(--accent)] focus:bg-white dark:focus:bg-[#111a2e] focus:outline-none"
      />
      <input
        type="number"
        value={item.cost || ""}
        onChange={e => onUpdateLocal(sectionId, item.id, "cost", e.target.value)}
        onBlur={()  => onSaveField(item.id)}
        placeholder="0"
        title="Costo real (interno)"
        className={`${numCls} text-[var(--brand)]`}
      />
      <input
        type="number"
        value={item.profit || ""}
        onChange={e => onUpdateLocal(sectionId, item.id, "profit", e.target.value)}
        onBlur={()  => onSaveField(item.id)}
        placeholder="0"
        title="Ganancia — se recalcula al 30% cuando cambias el costo"
        className={`${numCls} text-[#4F8A63]`}
      />
      <span className="w-16 sm:w-20 shrink-0 px-1 py-0.5 text-right font-mono text-[10px] font-bold text-[var(--accent)]">
        {item.amount ? item.amount.toLocaleString("en-US") : "0"}
      </span>
      <button
        onClick={() => onDelete(sectionId, item.id)}
        className="shrink-0 rounded p-1 text-[#E6DDCB] opacity-0 transition hover:text-[#B0492F] group-hover:opacity-100"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ─── Section emoji lookup ──────────────────────────────────────────────────────
function sectionEmoji(nameEn: string): string {
  const n = nameEn.toUpperCase();
  if (n.includes("DEMOLIT"))                    return "🔨";
  if (n.includes("PLUMB"))                      return "💧";
  if (n.includes("STRUCT"))                     return "🏗️";
  if (n.includes("ELECTR"))                     return "⚡";
  if (n.includes("TILE") || n.includes("FLOOR")) return "🧱";
  if (n.includes("HANDY") || n.includes("HAND")) return "🔧";
  if (n.includes("PAINT"))                      return "🎨";
  if (n.includes("PERMIT") || n.includes("ADMIN")) return "📋";
  if (n.includes("MATERIAL"))                   return "📦";
  if (n.includes("BATHROOM") || n.includes("BATH")) return "🚿";
  if (n.includes("KITCHEN"))                    return "🍳";
  if (n.includes("ROOF"))                       return "🏠";
  if (n.includes("WINDOW") || n.includes("DOOR")) return "🚪";
  return "🏗️";
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
  onUpdateItem:      (sectionId: string, itemId: string, field: "description"|"cost"|"profit", value: string) => void;
  onSaveItem:        (itemId: string) => void;
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
      className="overflow-hidden rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e]"
    >
      {/* ── Card header ── */}
      <div
        className="flex cursor-pointer items-center justify-between px-4 py-3.5 transition hover:bg-[#FDFAF6] dark:hover:bg-[#111a2e]"
        onClick={onToggle}
      >
        <div className="flex min-w-0 items-center gap-2">
          <button
            {...attributes} {...listeners}
            tabIndex={-1}
            aria-label="Drag to reorder section"
            onClick={e => e.stopPropagation()}
            className="shrink-0 cursor-grab touch-none p-1 text-[#D7CBB3] hover:text-[#5C6A6E] dark:hover:text-[#9fb0cc] active:cursor-grabbing"
          >
            <GripVertical size={14} />
          </button>
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm ${section.is_material_type ? "bg-[#FDF0ED] dark:bg-[#2a1712]" : "bg-[#EDF3FB] dark:bg-[#111a2e]"}`}>
            {sectionEmoji(section.name_en)}
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
                className="w-full max-w-[220px] rounded-md border border-[var(--accent)] bg-white dark:bg-[#111a2e] px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide text-[var(--brand)] focus:outline-none"
              />
            ) : (
              <div
                className="truncate text-[12px] font-bold uppercase tracking-wide text-[var(--brand)] cursor-pointer hover:text-[var(--accent)]"
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
            {section.note && <div className="text-[10px] text-[#5C6A6E] dark:text-[#9fb0cc]">{section.note}</div>}
            {section.items.length > 0 && (
              <div className="text-[10px] text-[#5C6A6E] dark:text-[#9fb0cc]">{section.items.length} items</div>
            )}
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
            <span className={`text-[10px] font-bold uppercase tracking-wide ${section.material_included ? "text-[#4F8A63]" : "text-[#5C6A6E] dark:text-[#9fb0cc]"}`}>
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
              className="h-3.5 w-3.5 cursor-pointer accent-[var(--accent)]"
            />
            <span className={`text-[10px] font-bold uppercase tracking-wide ${!section.is_material_type ? "text-[var(--accent)]" : "text-[#5C6A6E] dark:text-[#9fb0cc]"}`}>
              {EN ? "Labor %" : "M. obra %"}
            </span>
          </label>
          <div className={`font-mono text-[13px] font-bold ${section.is_material_type ? "text-[#B0492F]" : "text-[var(--brand)]"}`}>
            {money(effectiveTotal)}
          </div>
          {isOpen ? <ChevronUp size={14} className="text-[#5C6A6E] dark:text-[#9fb0cc]" /> : <ChevronDown size={14} className="text-[#5C6A6E] dark:text-[#9fb0cc]" />}
        </div>
      </div>

      {/* ── Card body ── */}
      {isOpen && (
        <div className="border-t border-[#F0EBE0] dark:border-[#22304d]">

          {/* Settings row */}
          <div className="flex flex-wrap items-center justify-end gap-2 border-b border-[#F0EBE0] dark:border-[#22304d] bg-[#FAFAF8] dark:bg-[#17233d] px-4 py-2">
            <input
              type="text"
              value={section.note}
              placeholder={EN ? "Note (e.g. Material included)" : "Nota (ej. Material incluido)"}
              onChange={e => onUpdateField(section.id, "note", e.target.value)}
              className="w-44 rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-2 py-1 text-[11px] text-[#5C6A6E] dark:text-[#9fb0cc] focus:border-[var(--accent)] focus:outline-none"
            />
            <button
              onClick={() => onDelete(section.id)}
              className="rounded-lg p-1.5 text-[#5C6A6E] dark:text-[#9fb0cc] transition hover:bg-[#FDF0ED] dark:hover:bg-[#2a1712] hover:text-[#B0492F]"
            >
              <Trash2 size={12} />
            </button>
          </div>

          {/* Column headers: costo | ganancia | cliente */}
          {section.items.length > 0 && (
            <div className="flex items-center gap-2 border-b border-[#E6DDCB] dark:border-[#22304d] bg-[#FDFAF6] dark:bg-[#111a2e] px-4 py-1">
              <span className="w-[17px] shrink-0" />
              <span className="h-1.5 w-1.5 shrink-0" />
              <span className="min-w-0 flex-1" />
              <span className="w-16 sm:w-20 shrink-0 px-1 text-right text-[8px] font-bold uppercase tracking-wider text-[#5C6A6E] dark:text-[#9fb0cc]">
                {EN ? "Cost" : "Costo"}
              </span>
              <span className="w-16 sm:w-20 shrink-0 px-1 text-right text-[8px] font-bold uppercase tracking-wider text-[#4F8A63]">
                {EN ? "Profit 30%" : "Ganancia 30%"}
              </span>
              <span className="w-16 sm:w-20 shrink-0 px-1 text-right text-[8px] font-bold uppercase tracking-wider text-[var(--accent)]">
                {EN ? "Client" : "Cliente"}
              </span>
              <span className="w-[22px] shrink-0" />
            </div>
          )}

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
          <div className="flex items-center gap-3 border-b border-[#F0EBE0] dark:border-[#22304d] px-4 py-2.5">
            <span className="flex-1 text-[11px] text-[#5C6A6E] dark:text-[#9fb0cc]">
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
                  ? "cursor-default border-transparent bg-transparent text-[#5C6A6E] dark:text-[#9fb0cc]"
                  : "border-[#E6DDCB] dark:border-[#22304d] bg-[#FDFAF6] dark:bg-[#111a2e] text-[var(--brand)] focus:border-[var(--accent)]"
              }`}
            />
          </div>

          {/* Add item form */}
          {addingItemTo === section.id ? (
            <div className="flex items-center gap-2 border-b border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-4 py-2">
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
                className="flex-1 rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-3 py-1.5 text-[12px] focus:border-[var(--accent)] focus:outline-none"
              />
              <input
                type="number"
                value={newItemAmt}
                onChange={e => setNewItemAmt(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") onAddItem(section.id); }}
                placeholder={EN ? "$0 cost" : "$0 costo"}
                title={EN ? "Real cost — profit (30%) and client amount are computed" : "Costo real — la ganancia (30%) y el monto cliente se calculan"}
                className="w-24 rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-3 py-1.5 text-right font-mono text-[12px] focus:border-[var(--accent)] focus:outline-none"
              />
              {(parseFloat(newItemAmt) || 0) > 0 && (
                <span className="shrink-0 whitespace-nowrap font-mono text-[10px] font-bold text-[var(--accent)]">
                  → ${round2((parseFloat(newItemAmt) || 0) * (1 + DEFAULT_PROFIT_PCT)).toLocaleString("en-US")}
                </span>
              )}
              <button
                onClick={() => onAddItem(section.id)}
                className="shrink-0 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-[11px] font-bold text-white"
              >
                {EN ? "Add" : "Agregar"}
              </button>
              <button
                onClick={() => { setAddingItemTo(null); setNewItemDesc(""); setNewItemAmt(""); }}
                className="shrink-0 p-1.5 text-[#5C6A6E] dark:text-[#9fb0cc] hover:text-[#B0492F]"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setAddingItemTo(section.id); setNewItemDesc(""); setNewItemAmt(""); }}
              className="flex w-full items-center gap-1.5 px-4 py-2.5 text-[11px] font-semibold text-[var(--accent)] transition hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220] hover:text-[var(--brand)]"
            >
              <Plus size={11} /> {EN ? "Add item" : "Agregar item"}
            </button>
          )}
        </div>
      )}
    </div>
  );
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
  const [confirmDeleteSection, setConfirmDeleteSection] = useState<{ id: string; name: string } | null>(null);

  // ── Deposit payment detail modal ──────────────────────────────────────────
  const [projectPayments,  setProjectPayments]  = useState<Payment[]>([]);
  const [depositModal,            setDepositModal]            = useState<number | null>(null);
  const [depAmt,                  setDepAmt]                  = useState("");
  const [depDate,                 setDepDate]                 = useState(new Date().toISOString().split("T")[0]);
  const [confirmDeleteDepositIdx, setConfirmDeleteDepositIdx] = useState<number | null>(null);
  // Edit-installment modal
  const [editDepositIdx,          setEditDepositIdx]          = useState<number | null>(null);
  const [editDepositLabel,        setEditDepositLabel]        = useState("");
  const [editDepositPct,          setEditDepositPct]          = useState("");
  const [editDepositAmt,          setEditDepositAmt]          = useState("");
  const [editDepositLastChanged,  setEditDepositLastChanged]  = useState<"pct" | "amount">("pct");
  // Ref mirrors editDepositLastChanged synchronously — avoids stale closure on rapid Save
  const editDepositLastChangedRef = useRef<"pct" | "amount">("pct");
  const [depMethod,        setDepMethod]        = useState<Payment["method"]>("Transferencia");
  const [depConcept,       setDepConcept]       = useState("");
  const [depSaving,        setDepSaving]        = useState(false);
  const [editingPayId,     setEditingPayId]     = useState<string | null>(null);
  const [editForm,         setEditForm]         = useState<{ amount: string; date: string; method: Payment["method"]; concept: string }>({ amount: "", date: "", method: "Transferencia", concept: "" });
  const [confirmDeletePayId, setConfirmDeletePayId] = useState<string | null>(null);

  // ── Email modal (envío del PDF por SMTP Yahoo) ───────────────────────────
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo,        setEmailTo]        = useState("");
  const [emailSubject,   setEmailSubject]   = useState("");
  const [emailMsg,       setEmailMsg]       = useState("");
  const [emailMode,      setEmailMode]      = useState<"full" | "summary">("full");
  const [emailPreview,   setEmailPreview]   = useState<string | null>(null);
  const [sendingEmail,   setSendingEmail]   = useState(false);

  // ── Copy-to-project modal ─────────────────────────────────────────────────
  const [showCopyModal,   setShowCopyModal]   = useState(false);
  const [copyProjects,    setCopyProjects]    = useState<{ id: string; title: string; client: string }[]>([]);
  const [copyTargetId,    setCopyTargetId]    = useState("");
  const [copyHasEstimate, setCopyHasEstimate] = useState(false);
  const [copying,         setCopying]         = useState(false);

  // ── Invoice modal (factura desde el payment schedule) ─────────────────────
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invView,      setInvView]      = useState<"build" | "email">("build");
  const [invNo,        setInvNo]        = useState("");
  const [invDate,      setInvDate]      = useState("");
  const [invLines,     setInvLines]     = useState<{ on: boolean; glosa: string }[]>([]);
  const [invEmailTo,   setInvEmailTo]   = useState("");
  const [invEmailSub,  setInvEmailSub]  = useState("");
  const [invEmailMsg,  setInvEmailMsg]  = useState("");
  const [invPreview,   setInvPreview]   = useState<string | null>(null);
  const [invSending,   setInvSending]   = useState(false);

  // ── Estimate sub-tabs ─────────────────────────────────────────────────────
  const [estimateSubTab,   setEstimateSubTab]   = useState<"sections" | "schedule">("sections");

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

    const headerPayload = {
      customer_name:    estimate.customer_name,
      city:             estimate.city,
      email:            estimate.email,
      phone:            estimate.phone,
      customer_company: estimate.customer_company ?? null,
      customer_address: estimate.customer_address ?? null,
      customer_website: estimate.customer_website ?? null,
      project_title:    estimate.project_title,
      start_date:       estimate.start_date  || null,
      end_date:         estimate.end_date    || null,
      status:           estimate.status,
      discount_label:   estimate.discount_label,
      discount_pct:     estimate.discount_pct,
      deposit_schedule: estimate.deposit_schedule,
      notes:            estimate.notes,
      updated_at:       new Date().toISOString(),
    };
    const { error: hdrErr } = await supabase.from("project_estimates").update(headerPayload).eq("id", estimate.id);
    // Si aún no corrió la migración de los campos de factura, guarda sin ellos (no rompe el Save)
    if (hdrErr && /customer_(company|address|website)|column|schema cache/i.test(hdrErr.message)) {
      const { customer_company: _c, customer_address: _a, customer_website: _w, ...rest } = headerPayload;
      void _c; void _a; void _w;
      await supabase.from("project_estimates").update(rest).eq("id", estimate.id);
    }

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
    const section = estimate?.sections.find(s => s.id === sectionId);
    setEstimate(p => p ? ({
      ...p,
      sections: p.sections.map(s => s.id === sectionId ? { ...s, name_en: clean, name_es: clean } : s),
    }) : p);
    await supabase.from("estimate_sections").update({ name_en: clean, name_es: clean }).eq("id", sectionId);

    // Sección personalizada → se graba en el catálogo para reutilizarla desde el combo
    const upper = clean.toUpperCase();
    const isPlaceholder = upper === "NEW SECTION" || upper === "NUEVA SECCIÓN";
    const alreadyInCatalog = effectiveCatalog.some(c =>
      c.name_en.trim().toUpperCase() === upper || c.name_es.trim().toUpperCase() === upper);
    if (!section || section.section_catalog_id || isPlaceholder || alreadyInCatalog) return;

    const { data: catRow } = await supabase.from("estimate_section_catalog").insert({
      name_en: clean, name_es: clean, note_en: "", note_es: "",
      is_material_type: section.is_material_type ?? false,
      sort_order: 1000 + effectiveCatalog.length * 10,
    }).select().single();
    if (catRow) {
      setCatalog(prev => prev.length
        ? [...prev, catRow as EstimateSectionCatalog]
        : [...FALLBACK_CATALOG, catRow as EstimateSectionCatalog]);
      await supabase.from("estimate_sections").update({ section_catalog_id: catRow.id }).eq("id", sectionId);
      setEstimate(p => p ? ({
        ...p,
        sections: p.sections.map(s => s.id === sectionId ? { ...s, section_catalog_id: catRow.id } : s),
      }) : p);
    }
  }, [EN, estimate, effectiveCatalog]);

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
    const cost   = parseFloat(newItemAmt) || 0;
    const profit = round2(cost * DEFAULT_PROFIT_PCT);
    const { data } = await supabase.from("estimate_items").insert({
      section_id:  sectionId,
      description: newItemDesc.trim(),
      cost,
      profit,
      amount:      round2(cost + profit),
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
    sectionId: string, itemId: string, field: "description" | "cost" | "profit", value: string,
  ) => {
    setEstimate(p => p ? ({
      ...p,
      sections: p.sections.map(s => s.id !== sectionId ? s : {
        ...s,
        items: s.items.map(i => {
          if (i.id !== itemId) return i;
          if (field === "description") return { ...i, description: value };
          const v = parseFloat(value) || 0;
          if (field === "cost") {
            // Cambiar el costo recalcula la ganancia al 30% y el monto cliente
            const profit = round2(v * DEFAULT_PROFIT_PCT);
            return { ...i, cost: v, profit, amount: round2(v + profit) };
          }
          return { ...i, profit: v, amount: round2((i.cost ?? 0) + v) };
        }),
      }),
    }) : p);
  };

  const saveItemField = useCallback(async (itemId: string) => {
    const item = estimate?.sections.flatMap(s => s.items).find(i => i.id === itemId);
    if (!item) return;
    await supabase.from("estimate_items").update({
      description: item.description,
      cost:        item.cost ?? 0,
      profit:      item.profit ?? 0,
      amount:      item.amount ?? 0,
    }).eq("id", itemId);
  }, [estimate]);

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
    addProjectNote(project.id, EN
      ? `💵 Payment received: ${money(amount)} (${depMethod})${depConcept.trim() ? " — " + depConcept.trim() : ""} — ${noteDate("en")}`
      : `💵 Ingreso recibido: ${money(amount)} (${depMethod})${depConcept.trim() ? " — " + depConcept.trim() : ""} — ${noteDate("es")}`);
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
    const initMode = dep.mode === "amount" ? "amount" : "pct";
    editDepositLastChangedRef.current = initMode;
    setEditDepositLastChanged(initMode);
  }, [estimate, EN, totals.grandTotal]);

  const onEditDepositPctChange = useCallback((raw: string) => {
    editDepositLastChangedRef.current = "pct";
    setEditDepositLastChanged("pct");
    setEditDepositPct(raw);
    const pct = parseFloat(raw) || 0;
    const gt  = totals.grandTotal;
    setEditDepositAmt(String(Math.round(gt * pct / 100 * 100) / 100));
  }, [totals.grandTotal]);

  const onEditDepositAmtChange = useCallback((raw: string) => {
    editDepositLastChangedRef.current = "amount";
    setEditDepositLastChanged("amount");
    setEditDepositAmt(raw);
    const amt = parseFloat(raw) || 0;
    const gt  = totals.grandTotal;
    const pct = gt > 0 ? Math.round(amt / gt * 1000) / 10 : 0;
    setEditDepositPct(String(pct));
  }, [totals.grandTotal]);

  const saveDepositEdit = useCallback(() => {
    if (editDepositIdx === null || !estimate) return;
    const label  = editDepositLabel.trim() || (EN ? "PAYMENT" : "PAGO");
    const gt     = totals.grandTotal;
    const pctVal = Math.max(0, parseFloat(editDepositPct) || 0);
    const amtVal = Math.max(0, parseFloat(editDepositAmt) || 0);

    // If the entered $ amount diverges from what % would compute by more than $0.50,
    // or the user explicitly switched to amount mode → save as fixed amount.
    const computedFromPct    = Math.round(gt * pctVal / 100 * 100) / 100;
    const amtDiffersFromPct  = Math.abs(amtVal - computedFromPct) > 0.5;
    const useAmountMode      = amtDiffersFromPct || editDepositLastChangedRef.current === "amount";

    let newMode:        "pct" | "amount";
    let newPct:         number;
    let newFixedAmount: number | undefined;

    if (useAmountMode) {
      newMode        = "amount";
      newFixedAmount = amtVal;
      newPct         = gt > 0 ? Math.round(amtVal / gt * 1000) / 10 : 0;
    } else {
      newMode        = "pct";
      newPct         = pctVal;
      newFixedAmount = undefined;
    }

    const updated = estimate.deposit_schedule.map((d, j) =>
      j === editDepositIdx
        ? { ...d, label_en: label, label_es: label, mode: newMode, pct: newPct, fixed_amount: newFixedAmount }
        : d
    );

    // Auto-balance: when editing a non-last deposit, set last deposit to the exact remainder
    const lastIdx = updated.length - 1;
    if (editDepositIdx !== lastIdx && lastIdx > 0) {
      const sumOthers = updated.slice(0, lastIdx).reduce((s, d) => {
        const tgt = d.mode === "amount" && d.fixed_amount != null ? d.fixed_amount : Math.round(gt * d.pct / 100 * 100) / 100;
        return s + tgt;
      }, 0);
      const lastAmt = Math.max(0, Math.round((gt - sumOthers) * 100) / 100);
      const lastPct = gt > 0 ? Math.round(lastAmt / gt * 1000) / 10 : 0;
      updated[lastIdx] = { ...updated[lastIdx], mode: "amount", fixed_amount: lastAmt, pct: lastPct };
    }

    setEstimate(prev => prev ? { ...prev, deposit_schedule: updated } : prev);
    setEditDepositIdx(null);
  }, [editDepositIdx, editDepositLabel, editDepositPct, editDepositAmt, estimate, EN, totals.grandTotal]);

  const addInstallment = useCallback(() => {
    setEstimate(prev => {
      if (!prev) return prev;
      const currentSum = prev.deposit_schedule.reduce((s, d) => s + d.pct, 0);
      const suggested  = Math.max(0, Math.round((100 - currentSum) * 100) / 100);
      return {
        ...prev,
        deposit_schedule: [...prev.deposit_schedule, {
          pct: suggested, label_en: EN ? "NEW PAYMENT" : "NUEVO PAGO",
          label_es: EN ? "NEW PAYMENT" : "NUEVO PAGO", mode: "pct" as const,
        }],
      };
    });
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

  // ── Email PDF (SMTP Yahoo) ────────────────────────────────────────────────
  const buildEmailPdfBlob = useCallback((mode: "full" | "summary"): Blob | null => {
    if (!estimate) return null;
    const { grandTotal, laborTotal, discountAmt } = totals;
    return getEstimatePdfBlob(estimate as unknown as ProjectEstimate, grandTotal, laborTotal, discountAmt, language, project.title, mode);
  }, [estimate, totals, language, project.title]);

  const refreshEmailPreview = useCallback((mode: "full" | "summary") => {
    const blob = buildEmailPdfBlob(mode);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setEmailPreview(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
  }, [buildEmailPdfBlob]);

  const openEmailModal = useCallback(() => {
    if (!estimate) return;
    setEmailTo(estimate.email?.trim() ?? "");
    setEmailSubject(`${EN ? "Estimate" : "Estimado"} — ${project.title}`);
    setEmailMsg(EN
      ? `Hello${estimate.customer_name ? " " + estimate.customer_name : ""},\n\nPlease find attached the estimate for "${project.title}".\nFeel free to reply to this email with any questions.\n\nBest regards,\n${branding.contractor}\n${branding.companyName} · ${branding.phone}`
      : `Hola${estimate.customer_name ? " " + estimate.customer_name : ""},\n\nAdjunto encontrará el estimado de "${project.title}".\nCualquier duda, puede responder directamente a este correo.\n\nSaludos cordiales,\n${branding.contractor}\n${branding.companyName} · ${branding.phone}`);
    refreshEmailPreview(emailMode);
    setShowEmailModal(true);
  }, [estimate, EN, project.title, emailMode, refreshEmailPreview]);

  const closeEmailModal = useCallback(() => {
    setShowEmailModal(false);
    setEmailPreview(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
  }, []);

  const sendEmail = useCallback(async () => {
    const blob = buildEmailPdfBlob(emailMode);
    if (!blob || !emailTo.includes("@")) return;
    setSendingEmail(true);
    try {
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const res = await fetch("/api/estimate/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo.trim(),
          subject: emailSubject.trim(),
          message: emailMsg,
          fileName: `Estimate - ${project.title}.pdf`,
          pdfBase64,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast(EN ? `Estimate sent to ${emailTo.trim()} ✓` : `Estimado enviado a ${emailTo.trim()} ✓`);
        addProjectNote(project.id, EN
          ? `📤 Estimate emailed to ${emailTo.trim()} — ${noteDate("en")}`
          : `📤 Estimado enviado por correo a ${emailTo.trim()} — ${noteDate("es")}`);
        closeEmailModal();
      } else {
        toast((EN ? "Send failed: " : "Error al enviar: ") + (data.error ?? ""));
      }
    } catch {
      toast(EN ? "Send failed — check your connection" : "Error al enviar — revisa tu conexión");
    } finally {
      setSendingEmail(false);
    }
  }, [buildEmailPdfBlob, emailMode, emailTo, emailSubject, emailMsg, project.title, EN, toast, closeEmailModal]);

  // ── Invoice (factura) — se arma desde el payment schedule ─────────────────
  const setHdr = useCallback((patch: Partial<EstimateRow>) =>
    setEstimate(p => p ? { ...p, ...patch } : p), []);

  const buildInvoiceData = useCallback((): InvoiceData => {
    const gt = totals.grandTotal;
    const lines = (estimate?.deposit_schedule ?? []).map((dep, i) => {
      const st = invLines[i];
      if (!st?.on) return null;
      return { description: st.glosa.trim() || (EN ? dep.label_en : dep.label_es), amount: depositTarget(dep, gt) };
    }).filter(Boolean) as { description: string; amount: number }[];
    return {
      invoiceNo: invNo.trim(), date: invDate.trim(), language,
      client: {
        name:    estimate?.customer_name ?? "",
        company: estimate?.customer_company ?? "",
        address: estimate?.customer_address ?? "",
        city:    estimate?.city ?? "",
        phone:   estimate?.phone ?? "",
        email:   estimate?.email ?? "",
        website: estimate?.customer_website ?? "",
      },
      lines,
    };
  }, [estimate, invLines, invNo, invDate, language, totals, depositTarget, EN]);

  const openInvoiceModal = useCallback(() => {
    if (!estimate) return;
    const now = new Date();
    const mEN = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    const mES = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
    const mm  = (EN ? mEN : mES)[now.getMonth()];
    setInvDate(EN ? `${mm}. ${String(now.getDate()).padStart(2,"0")}, ${now.getFullYear()}`
                  : `${String(now.getDate()).padStart(2,"0")} ${mm}. ${now.getFullYear()}`);
    setInvNo("");
    setInvLines(estimate.deposit_schedule.map(d => ({ on: true, glosa: EN ? d.label_en : d.label_es })));
    setInvView("build");
    setInvEmailTo(estimate.email?.trim() ?? "");
    setInvEmailSub(`${EN ? "Invoice" : "Factura"} — ${project.title}`);
    setInvEmailMsg(EN
      ? `Hello${estimate.customer_name ? " " + estimate.customer_name : ""},\n\nPlease find attached your invoice for "${project.title}".\nFeel free to reply to this email with any questions.\n\nBest regards,\n${branding.contractor}\n${branding.companyName} · ${branding.phone}`
      : `Hola${estimate.customer_name ? " " + estimate.customer_name : ""},\n\nAdjunto encontrará su factura de "${project.title}".\nCualquier duda, puede responder directamente a este correo.\n\nSaludos cordiales,\n${branding.contractor}\n${branding.companyName} · ${branding.phone}`);
    setShowInvoiceModal(true);
  }, [estimate, EN, project.title]);

  const closeInvoiceModal = useCallback(() => {
    setShowInvoiceModal(false);
    setInvPreview(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
  }, []);

  const goInvoiceEmail = useCallback(() => {
    const url = URL.createObjectURL(getInvoicePdfBlob(buildInvoiceData()));
    setInvPreview(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
    setInvView("email");
  }, [buildInvoiceData]);

  const sendInvoiceEmail = useCallback(async () => {
    if (!invEmailTo.includes("@")) return;
    setInvSending(true);
    try {
      const blob = getInvoicePdfBlob(buildInvoiceData());
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const res = await fetch("/api/estimate/send-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: invEmailTo.trim(), subject: invEmailSub.trim(), message: invEmailMsg, fileName: `Invoice - ${project.title}.pdf`, pdfBase64 }),
      });
      const data = await res.json();
      if (data.ok) {
        toast(EN ? `Invoice sent to ${invEmailTo.trim()} ✓` : `Factura enviada a ${invEmailTo.trim()} ✓`);
        addProjectNote(project.id, EN
          ? `📤 Invoice${invNo.trim() ? " #" + invNo.trim() : ""} emailed to ${invEmailTo.trim()} — ${noteDate("en")}`
          : `📤 Factura${invNo.trim() ? " #" + invNo.trim() : ""} enviada por correo a ${invEmailTo.trim()} — ${noteDate("es")}`);
        closeInvoiceModal();
      }
      else toast((EN ? "Send failed: " : "Error al enviar: ") + (data.error ?? ""));
    } catch {
      toast(EN ? "Send failed — check your connection" : "Error al enviar — revisa tu conexión");
    } finally { setInvSending(false); }
  }, [invEmailTo, invEmailSub, invEmailMsg, buildInvoiceData, project.title, EN, toast, closeInvoiceModal]);

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
            cost:            item.cost ?? 0,
            profit:          item.profit ?? 0,
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

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
    </div>
  );

  if (!estimate) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F7F3EA] dark:bg-[#0b1220]">
        <FileText size={28} className="text-[#5C6A6E] dark:text-[#9fb0cc]" />
      </div>
      <h3 className="mb-2 text-base font-bold text-[var(--brand)]">
        {EN ? "No estimate yet" : "Sin estimado todavía"}
      </h3>
      <p className="mb-6 max-w-xs text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">
        {EN
          ? "Create a professional proposal for this project to share with your client."
          : "Crea una propuesta profesional para este proyecto y compártela con tu cliente."}
      </p>
      <button
        onClick={createEstimate}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#0F2830] disabled:opacity-50"
      >
        <Plus size={14} />
        {EN ? "Create Estimate" : "Crear Estimado"}
      </button>
    </div>
  );

  const { laborTotal, discountAmt, grandTotal } = totals;

  // ── Deposit schedule helpers (used in both tabs) ──────────────────────────
  const deps      = estimate.deposit_schedule ?? defaultDeposits();
  const totalRec  = deps.reduce((sum, _, i) => sum + depositsForIdx(i).reduce((s, p) => s + p.amount, 0), 0);
  const pctSum    = deps.reduce((s, d) => s + d.pct, 0);
  const amtSum    = deps.reduce((s, d) => s + depositTarget(d, grandTotal), 0);
  const pctOk     = Math.abs(amtSum - grandTotal) < 0.02 || Math.abs(pctSum - 100) < 0.11;
  const pending   = Math.max(0, grandTotal - totalRec);
  const recvPct   = grandTotal > 0 ? Math.min(100, Math.round(totalRec / grandTotal * 100)) : 0;

  // Shared deposit timeline rows (used in Payment Schedule tab)
  const depositRows = (estimate.deposit_schedule ?? defaultDeposits()).map((dep, i, arr) => {
    const color    = DEPOSIT_PALETTE[i % DEPOSIT_PALETTE.length];
    const isLast   = i === arr.length - 1;
    const target = (() => {
      if (dep.mode === "amount" && dep.fixed_amount) return dep.fixed_amount;
      if (isLast && arr.length > 1) {
        const sumOthers = arr.slice(0, -1).reduce((s, d) => {
          if (d.mode === "amount" && d.fixed_amount) return s + d.fixed_amount;
          return s + Math.round(grandTotal * d.pct / 100 * 100) / 100;
        }, 0);
        return Math.max(0, Math.round((grandTotal - sumOthers) * 100) / 100);
      }
      return Math.round(grandTotal * dep.pct / 100 * 100) / 100;
    })();
    const received    = depositsForIdx(i).reduce((s, p) => s + p.amount, 0);
    const receivedPct = target > 0 ? Math.min(100, Math.round(received / target * 100)) : 0;
    const paid        = target > 0 && received >= target;
    const isConfirmDelete = confirmDeleteDepositIdx === i;
    const depNum = String(i + 1).padStart(2, "0");

    return (
      <div key={i}>
        <div className="flex gap-2.5">
          {/* Node column */}
          <div className="flex w-5 flex-shrink-0 flex-col items-center">
            <div className="w-0.5 bg-[#DDD6CC]" style={{ height: 46 }} />
            <div className="relative z-10 h-3 w-3 flex-shrink-0 rounded-full border-2 bg-white dark:bg-[#111a2e]" style={{ borderColor: color }} />
            {!isLast && <div className="w-0.5 flex-1 bg-[#DDD6CC]" />}
          </div>
          {/* Card */}
          <div className="mb-0 flex-1 overflow-hidden rounded-xl border border-[#E6DDCB] dark:border-[#22304d]">
            <div className="flex h-[26px] items-center bg-[#EEE9E0] px-3">
              <span className="text-[9px] font-black uppercase tracking-[.14em] text-[#7A8278]">
                {EN ? `Deposit ${depNum}` : `Cuota ${depNum}`}
              </span>
            </div>
            <div className="flex min-h-[52px] items-center">
              <button onClick={() => openDepositEdit(i)} title={EN ? "Edit installment" : "Editar cuota"}
                className="flex w-[62px] flex-shrink-0 items-center justify-center self-stretch text-[17px] font-black text-white transition hover:opacity-80"
                style={{ background: color }}>
                {Math.round(dep.pct)}%
              </button>
              <span className="flex-shrink-0 px-3.5 font-mono text-[15px] font-black text-[var(--brand)]">
                {money(target)}
              </span>
              <div className="w-px flex-shrink-0 self-stretch bg-[#EDE8DF]" />
              <button onClick={() => openDepositEdit(i)} title={EN ? "Click to edit" : "Clic para editar"}
                className="group flex flex-1 items-center gap-1 overflow-hidden px-3 text-left">
                <span className="truncate text-[11px] font-semibold text-[#5C6A6E] dark:text-[#9fb0cc] group-hover:text-[var(--accent)]">
                  {EN ? dep.label_en : dep.label_es}
                </span>
                <Pencil size={8} className="flex-shrink-0 text-[#C4B89A] group-hover:text-[var(--accent)]" />
              </button>
              <div className="flex flex-shrink-0 items-center gap-1.5 self-stretch border-l border-[#EDE8DF] dark:border-[#22304d] px-2.5">
                {isConfirmDelete ? (
                  <div className="flex items-center gap-1">
                    <span className="whitespace-nowrap text-[9px] font-semibold text-[#B0492F]">
                      {EN ? "Delete?" : "¿Eliminar?"}
                    </span>
                    <button onClick={() => removeInstallment(i)}
                      className="rounded bg-[#B0492F] px-1.5 py-0.5 text-[9px] font-bold text-white hover:bg-[#9a3d27]">
                      {EN ? "Yes" : "Sí"}
                    </button>
                    <button onClick={() => setConfirmDeleteDepositIdx(null)}
                      className="rounded border border-[#E6DDCB] dark:border-[#22304d] px-1.5 py-0.5 text-[9px] text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]">
                      No
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteDepositIdx(i)}
                    className="rounded p-1 text-[#C4B89A] transition hover:bg-[#FDE8E3] dark:hover:bg-[#2a1712] hover:text-[#B0492F]"
                    title={EN ? "Remove installment" : "Eliminar cuota"}>
                    <Trash2 size={11} />
                  </button>
                )}
                <button
                  onClick={() => { setDepositModal(i); setDepAmt(""); setDepConcept(""); setDepDate(new Date().toISOString().split("T")[0]); }}
                  className="flex-shrink-0 rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-2.5 py-1.5 text-[10px] font-bold text-[var(--accent)] transition hover:bg-[#EDF3FB] dark:hover:bg-[#111a2e]">
                  {EN ? "Detail" : "Detalle"}
                </button>
              </div>
            </div>
            <div className="border-t border-[#EDE8DF] dark:border-[#22304d] bg-[#FDFAF6] dark:bg-[#111a2e] px-3 pb-2 pt-1.5">
              <div className="mb-1.5 h-1 overflow-hidden rounded-full bg-[#EDE8DF]">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${receivedPct}%`, background: paid ? "#4F8A63" : color }} />
              </div>
              <div className="flex justify-end gap-2.5">
                <span className={`text-[9px] font-bold ${paid ? "text-[#4F8A63]" : received > 0 ? "text-[#D4893A]" : "text-[#C5BDB2]"}`}>
                  {money(received)} {EN ? "received" : "recibido"}{paid ? " ✓" : ""}
                </span>
                <span className="text-[9px] font-semibold text-[#BBADA0]">of {money(target)}</span>
              </div>
            </div>
          </div>
        </div>
        {!isLast && (
          <div className="flex h-1.5 gap-2.5">
            <div className="flex w-5 flex-shrink-0 justify-center">
              <div className="w-0.5 h-full bg-[#DDD6CC]" />
            </div>
            <div className="flex-1" />
          </div>
        )}
      </div>
    );
  });

  return (
    <>
    {/* ════════════════════════════════════════════════════════════════════════
        MAIN ESTIMATE CARD
    ════════════════════════════════════════════════════════════════════════ */}
    <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] shadow-md">

      {/* ── HEADER BAND ─────────────────────────────────────────────────────── */}
      <div className="bg-[var(--brand)] px-5 pb-0 pt-4">
        {/* Top row: identity + actions */}
        <div className="flex items-center gap-3 pb-3">
          {/* Left: company · status · project title */}
          <div className="flex-1 min-w-0">
            <div className="mb-1.5 text-[8.5px] font-bold uppercase tracking-[.15em] text-white/35">
              {branding.companyName}
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <select
                value={estimate.status}
                onChange={e => setEstimate(p => p ? ({ ...p, status: e.target.value as EstimateRow["status"] }) : p)}
                className={`shrink-0 cursor-pointer appearance-none rounded-md border-0 px-2.5 py-1 text-[10px] font-bold ${STATUS_STYLE[estimate.status]}`}
              >
                <option value="draft">{EN ? "Draft" : "Borrador"}</option>
                <option value="sent">{EN ? "Sent" : "Enviado"}</option>
                <option value="approved">{EN ? "Approved" : "Aprobado"}</option>
                <option value="rejected">{EN ? "Rejected" : "Rechazado"}</option>
              </select>
              <span className="font-bookman truncate text-[17px] font-bold leading-tight text-white">
                {project.title}
              </span>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex shrink-0 items-center gap-2">
            {/* Copy */}
            <button
              onClick={openCopyModal}
              title={EN ? "Copy estimate to another project" : "Copiar estimado a otro proyecto"}
              className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-[10px] font-bold text-white/80 transition hover:bg-white/18 hover:text-white"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span className="hidden sm:inline">{EN ? "Copy" : "Copiar"}</span>
            </button>

            {/* Email */}
            <button
              onClick={openEmailModal}
              title={EN ? "Send PDF by email" : "Enviar PDF por correo"}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-2 text-[10px] font-bold text-white transition hover:bg-[#2e4a70]"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>
              <span className="hidden sm:inline">Email</span>
            </button>

            {/* Invoice / Factura */}
            <button
              onClick={openInvoiceModal}
              title={EN ? "Generate invoice from the payment schedule" : "Generar factura desde el payment schedule"}
              className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-[10px] font-bold text-white/90 transition hover:bg-white/18 hover:text-white"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 3h16v18l-3-2-2 2-2-2-2 2-2-2-3 2Z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
              <span className="hidden sm:inline">{EN ? "Invoice" : "Factura"}</span>
            </button>

            {/* PDF */}
            <button
              onClick={() => setShowPdfModal(true)}
              title={EN ? "Download PDF proposal" : "Descargar propuesta en PDF"}
              className="inline-flex items-center gap-1 rounded-lg bg-[#7B1838] px-3 py-2 text-[10px] font-bold text-white transition hover:bg-[#6a1530]"
            >
              <FileText size={12} />
              <span className="hidden sm:inline">PDF</span>
            </button>

            {/* Save — context-aware color + label */}
            <button
              onClick={saveHeader}
              disabled={saving}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold transition disabled:opacity-50 ${
                estimateSubTab === "sections"
                  ? "bg-white dark:bg-[#111a2e] text-[var(--brand)] hover:bg-[#F5E9DA] dark:hover:bg-[#17233d]"
                  : "bg-[#F0A090] text-[#7B1838] hover:bg-[#FFB8A8]"
              }`}
            >
              {saving
                ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                : <Save size={12} strokeWidth={2.5} />
              }
              {saving
                ? "…"
                : estimateSubTab === "sections"
                  ? (EN ? "Save" : "Guardar")
                  : (EN ? "Save schedule" : "Guardar calendario")
              }
            </button>
          </div>
        </div>

        {/* Tab row */}
        <div className="flex items-end gap-1">
          <button
            onClick={() => setEstimateSubTab("sections")}
            className={`inline-flex items-center gap-2 rounded-t-xl px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider transition ${
              estimateSubTab === "sections"
                ? "bg-white dark:bg-[#111a2e] text-[var(--brand)]"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            📐 {EN ? "Sections" : "Secciones"}
          </button>
          <button
            onClick={() => setEstimateSubTab("schedule")}
            className={`inline-flex items-center gap-2 rounded-t-xl px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider transition ${
              estimateSubTab === "schedule"
                ? "bg-white dark:bg-[#111a2e] text-[var(--brand)]"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            💰 {EN ? "Payment Schedule" : "Calendario de Pagos"}
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════
          SECTIONS TAB
      ════════════════════════════════════════════════ */}
      {estimateSubTab === "sections" && (
        <>
          {/* Sub-band: totals summary */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-5 py-2.5">
            <div>
              <div className="text-[8px] font-bold uppercase tracking-[.12em] text-[#97A1A0] dark:text-[#728098]">
                {EN ? "Labor subtotal" : "Subtotal mano de obra"}
              </div>
              <div className="text-[13px] font-black text-[var(--brand)]">{money(laborTotal)}</div>
            </div>
            {discountAmt > 0 && (
              <>
                <div className="text-[#C4B89A]">·</div>
                <div>
                  <div className="text-[8px] font-bold uppercase tracking-[.12em] text-[#97A1A0] dark:text-[#728098]">
                    {EN ? "Grand Total" : "Total Final"}
                  </div>
                  <div className="text-[13px] font-black text-[var(--brand)]">{money(grandTotal)}</div>
                </div>
              </>
            )}
            {/* Discount badge — right */}
            <div className="ml-auto flex items-center gap-2 rounded-lg border border-[#F0C8BC] bg-[#FDF5F3] dark:bg-[#2a1712] px-3 py-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wide text-[#B0492F]">
                {EN ? "Discount" : "Descuento"}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={estimate.discount_pct === 0 ? "" : String(estimate.discount_pct)}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9.]/g, "");
                  setEstimate(p => p ? ({ ...p, discount_pct: parseFloat(raw) || 0 }) : p);
                }}
                placeholder="0"
                className="w-10 border-none bg-transparent text-center text-[12px] font-black text-[#B0492F] focus:outline-none"
              />
              <span className="text-[9px] font-bold text-[#B0492F]">%</span>
              {discountAmt > 0 && (
                <span className="font-mono text-[11px] font-black text-[#B0492F]">–{money(discountAmt)}</span>
              )}
            </div>
          </div>

          <div className="space-y-3 p-4">
            {/* Customer info (collapsible) */}
            <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e]">
              <button
                className="flex w-full items-center justify-between px-4 py-3 transition hover:bg-[#FDFAF6] dark:hover:bg-[#111a2e]"
                onClick={() => setShowHeader(h => !h)}
              >
                <div className="flex items-center gap-3">
                  <Info size={14} className="shrink-0 text-[#5C6A6E] dark:text-[#9fb0cc]" />
                  <span className="text-[12px] font-bold text-[var(--brand)]">
                    {estimate.customer_name || (EN ? "Customer info" : "Info del cliente")}
                  </span>
                  {estimate.city && <span className="text-[11px] text-[#5C6A6E] dark:text-[#9fb0cc]">· {estimate.city}</span>}
                </div>
                <div className="flex items-center gap-3">
                  {showHeader
                    ? <ChevronUp size={14} className="shrink-0 text-[#5C6A6E] dark:text-[#9fb0cc]" />
                    : <ChevronDown size={14} className="shrink-0 text-[#5C6A6E] dark:text-[#9fb0cc]" />}
                </div>
              </button>
              {showHeader && (
                <div className="grid grid-cols-2 gap-3 border-t border-[#F0EBE0] dark:border-[#22304d] px-4 pb-4 pt-3 sm:grid-cols-3">
                  {([
                    { key: "customer_name", label: EN ? "Customer" : "Cliente",  type: "text"  },
                    { key: "city",          label: EN ? "City" : "Ciudad",        type: "text"  },
                    { key: "phone",         label: EN ? "Phone" : "Teléfono",     type: "tel"   },
                    { key: "email",         label: "Email",                        type: "email" },
                    { key: "start_date",    label: EN ? "Start" : "Inicio",       type: "date"  },
                    { key: "end_date",      label: EN ? "End" : "Fin",            type: "date"  },
                  ] as const).map(({ key, label, type }) => (
                    <label key={key} className="grid gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">{label}</span>
                      <input
                        type={type}
                        value={(estimate as unknown as Record<string, string>)[key] ?? ""}
                        onChange={e => setEstimate(p => p ? ({ ...p, [key]: e.target.value }) : p)}
                        className="rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-[#FDFAF6] dark:bg-[#111a2e] px-3 py-1.5 text-[12px] text-[var(--brand)] focus:border-[var(--accent)] focus:outline-none"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Section cards — drag & drop */}
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

            {/* Add section */}
            <button
              onClick={() => setShowAddSection(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#D7CBB3] dark:border-[#2c3c5e] py-3 text-[12px] font-semibold text-[#5C6A6E] dark:text-[#9fb0cc] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <Plus size={14} /> {EN ? "Add section" : "Agregar sección"}
            </button>

            {/* Totals footer row */}
            {estimate.sections.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-4 py-3">
                <div className="flex items-center gap-6">
                  {discountAmt > 0 && (
                    <div>
                      <div className="text-[8px] font-bold uppercase tracking-[.12em] text-[#97A1A0] dark:text-[#728098]">
                        {EN ? "Labor subtotal" : "Subtotal M.O."}
                      </div>
                      <div className="font-mono text-[12px] font-bold text-[var(--brand)]">{money(laborTotal)}</div>
                    </div>
                  )}
                  {discountAmt > 0 && (
                    <div>
                      <div className="text-[8px] font-bold uppercase tracking-[.12em] text-[#97A1A0] dark:text-[#728098]">
                        {EN ? "Discount" : "Descuento"} {estimate.discount_pct}%
                      </div>
                      <div className="font-mono text-[12px] font-bold text-[#B0492F]">–{money(discountAmt)}</div>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[8px] font-bold uppercase tracking-[.12em] text-[#97A1A0] dark:text-[#728098]">
                    {EN ? "Grand Total" : "Total Final"}
                  </div>
                  <div className="font-mono text-[17px] font-black text-[var(--brand)]">{money(grandTotal)}</div>
                </div>
              </div>
            )}

            {/* Generate Workflow Tasks */}
            <button
              onClick={() => setShowGenTasks(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--accent)] bg-[#EDF3FB] dark:bg-[#111a2e] py-2.5 text-[12px] font-bold text-[var(--accent)] transition hover:bg-[#D5DEEF] dark:hover:bg-[#111a2e]"
            >
              <Zap size={13} />
              {EN ? "Generate Workflow Tasks" : "Generar Tareas en Workflow"}
            </button>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════
          PAYMENT SCHEDULE TAB
      ════════════════════════════════════════════════ */}
      {estimateSubTab === "schedule" && (
        <>
          {/* Sub-band: quick stats */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-5 py-2.5">
            <div>
              <div className="text-[8px] font-bold uppercase tracking-[.12em] text-[#97A1A0] dark:text-[#728098]">
                {EN ? "Installments" : "Cuotas"}
              </div>
              <div className="text-[13px] font-black text-[var(--brand)]">{deps.length}</div>
            </div>
            <div>
              <div className="text-[8px] font-bold uppercase tracking-[.12em] text-[#97A1A0] dark:text-[#728098]">
                {EN ? "Received" : "Recibido"}
              </div>
              <div className="font-mono text-[13px] font-black text-[#4F8A63]">{money(totalRec)}</div>
            </div>
            <div>
              <div className="text-[8px] font-bold uppercase tracking-[.12em] text-[#97A1A0] dark:text-[#728098]">
                {EN ? "Pending" : "Pendiente"}
              </div>
              <div className="font-mono text-[13px] font-black text-[#B0492F]">{money(pending)}</div>
            </div>
            <span className={`ml-auto rounded-full px-2.5 py-1 text-[9px] font-black ${pctOk ? "bg-[#DCEBDD] dark:bg-[#14261c] text-[#4F8A63]" : "bg-[#FDE8E3] dark:bg-[#2a1712] text-[#B0492F]"}`}>
              {Math.round(pctSum * 10) / 10}% {pctOk ? "✓" : `— ${EN ? "must be 100%" : "debe ser 100%"}`}
            </span>
          </div>

          <div className="space-y-4 p-4">
            {/* Totals card: Labor → Discount (red) → Grand Total → Progress */}
            <div className="overflow-hidden rounded-xl border border-[#E6DDCB] dark:border-[#22304d] shadow-sm">
              <div className="flex items-center justify-between border-b border-[#F0EAE0] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-4 py-2.5">
                <span className="flex items-center gap-2 text-[11px] text-[#5C6A6E] dark:text-[#9fb0cc]">
                  {EN ? "Labor subtotal" : "Subtotal mano de obra"}
                  <span className="rounded bg-[#F0EAE0] dark:bg-[#17233d] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-[#97A1A0] dark:text-[#728098]">
                    {estimate.sections.length} {EN ? "sections" : "secciones"}
                  </span>
                </span>
                <span className="font-mono text-[13px] font-bold text-[var(--brand)]">{money(laborTotal)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#F0EAE0] dark:border-[#22304d] bg-[#FDF5F3] dark:bg-[#2a1712] px-4 py-2.5">
                <span className="flex items-center gap-2 text-[11px] font-bold text-[#B0492F]">
                  <span className="text-[10px]">▼</span>
                  {EN ? "Discount" : "Descuento"}
                  <span className="rounded bg-[#F5D5CC] px-1.5 py-0.5 text-[8px] font-black uppercase text-[#B0492F]">
                    {estimate.discount_pct}%
                  </span>
                </span>
                <span className="font-mono text-[13px] font-bold text-[#B0492F]">–{money(discountAmt)}</span>
              </div>
              <div className="flex items-center justify-between bg-[var(--brand)] px-4 py-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/65">
                  {EN ? "Grand Total" : "Total Final"}
                </span>
                <span className="font-mono text-[18px] font-black text-white">{money(grandTotal)}</span>
              </div>
              {/* Received vs pending progress */}
              <div className="border-t border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-4 py-2.5">
                <div className="mb-1.5 flex justify-between text-[9px] font-bold">
                  <span className="text-[#4F8A63]">{EN ? "Received" : "Recibido"} · {money(totalRec)} ({recvPct}%)</span>
                  <span className="text-[#B0492F]">{EN ? "Pending" : "Pendiente"} · {money(pending)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#E6DDCB] dark:bg-[#17233d]">
                  <div className="h-full rounded-full bg-[#4F8A63] transition-all duration-500" style={{ width: `${recvPct}%` }} />
                </div>
              </div>
            </div>

            {/* Deposit rows */}
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#5C6A6E] dark:text-[#9fb0cc]">
                {EN ? "Payment Schedule" : "Cuotas de Pago"}
              </div>
              <div className="flex flex-col">{depositRows}</div>
              {/* Add installment */}
              <div className="mt-2 flex gap-2.5">
                <div className="w-5 flex-shrink-0" />
                <button
                  onClick={addInstallment}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#D5CBBA] py-2 text-[11px] font-semibold text-[#97A1A0] dark:text-[#728098] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  <Plus size={11} /> {EN ? "Add payment" : "Agregar cuota"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

    </div>{/* /main card */}

      {/* ── Invoice modal (factura desde el payment schedule) ──────────────── */}
      {showInvoiceModal && estimate && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" onClick={closeInvoiceModal}>
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white dark:bg-[#111a2e] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-[var(--brand)] px-5 py-3.5">
              <span className="text-sm font-bold text-white">
                🧾 {invView === "email" ? (EN ? "Send invoice by email" : "Enviar factura por correo") : (EN ? "Invoice" : "Factura")}
              </span>
              <button onClick={closeInvoiceModal} className="text-white/60 hover:text-white"><X size={16} /></button>
            </div>

            {invView === "build" ? (
              <>
                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">{EN ? "Invoice #" : "Factura #"}</label>
                      <input value={invNo} onChange={e => setInvNo(e.target.value)} placeholder="001"
                        className="h-10 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 text-sm text-[var(--brand)] dark:text-[#e8edf7] focus:border-[var(--brand)] focus:outline-none" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">{EN ? "Date" : "Fecha"}</label>
                      <input value={invDate} onChange={e => setInvDate(e.target.value)}
                        className="h-10 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 text-sm text-[var(--brand)] dark:text-[#e8edf7] focus:border-[var(--brand)] focus:outline-none" />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">
                      {EN ? "Description — from payment schedule" : "Descripción — del payment schedule"}
                    </label>
                    <div className="space-y-2">
                      {estimate.deposit_schedule.map((dep, i) => {
                        const st  = invLines[i] ?? { on: false, glosa: "" };
                        const amt = depositTarget(dep, totals.grandTotal);
                        return (
                          <div key={i} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${st.on ? "border-[var(--accent)] bg-[#EDF3FB] dark:bg-[#17233d]" : "border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220]"}`}>
                            <input type="checkbox" checked={st.on}
                              onChange={e => setInvLines(ls => ls.map((x, j) => j === i ? { ...x, on: e.target.checked } : x))}
                              className="mt-1 h-4 w-4 accent-[var(--accent)]" />
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex items-center gap-2">
                                <span className="rounded bg-[var(--brand)] px-1.5 py-0.5 text-[9px] font-bold text-white">{dep.pct}%</span>
                                <span className="text-[11px] font-bold text-[var(--brand)] dark:text-[#e8edf7]">{money(amt)}</span>
                              </div>
                              <input value={st.glosa}
                                onChange={e => setInvLines(ls => ls.map((x, j) => j === i ? { ...x, glosa: e.target.value } : x))}
                                placeholder={EN ? "Description…" : "Descripción…"}
                                className="w-full border-0 border-b border-dashed border-[#D7CBB3] dark:border-[#2c3c5e] bg-transparent pb-0.5 text-[13px] text-[var(--brand)] dark:text-[#e8edf7] focus:border-[var(--accent)] focus:outline-none" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-2 text-[12px] font-bold text-[var(--brand)] dark:text-[#e8edf7]">
                      {EN ? "Total due" : "Total a pagar"}: <span>{money(buildInvoiceData().lines.reduce((s, l) => s + l.amount, 0))}</span>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">
                      {EN ? "Bill to (from project)" : "Facturar a (del proyecto)"}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={estimate.customer_name} onChange={e => setHdr({ customer_name: e.target.value })} placeholder={EN ? "Name" : "Nombre"} className="h-9 w-full rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-2.5 text-[13px] text-[var(--brand)] dark:text-[#e8edf7] focus:border-[var(--brand)] focus:outline-none" />
                      <input value={estimate.customer_company ?? ""} onChange={e => setHdr({ customer_company: e.target.value })} placeholder={EN ? "Company" : "Empresa"} className="h-9 w-full rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-2.5 text-[13px] text-[var(--brand)] dark:text-[#e8edf7] focus:border-[var(--brand)] focus:outline-none" />
                    </div>
                    <input value={estimate.customer_address ?? ""} onChange={e => setHdr({ customer_address: e.target.value })} placeholder={EN ? "Address" : "Dirección"} className="mt-2 h-9 w-full rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-2.5 text-[13px] text-[var(--brand)] dark:text-[#e8edf7] focus:border-[var(--brand)] focus:outline-none" />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input value={estimate.city} onChange={e => setHdr({ city: e.target.value })} placeholder={EN ? "City / State" : "Ciudad / Estado"} className="h-9 w-full rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-2.5 text-[13px] text-[var(--brand)] dark:text-[#e8edf7] focus:border-[var(--brand)] focus:outline-none" />
                      <input value={estimate.phone} onChange={e => setHdr({ phone: e.target.value })} placeholder={EN ? "Phone" : "Teléfono"} className="h-9 w-full rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-2.5 text-[13px] text-[var(--brand)] dark:text-[#e8edf7] focus:border-[var(--brand)] focus:outline-none" />
                      <input value={estimate.email} onChange={e => setHdr({ email: e.target.value })} placeholder="Email" className="h-9 w-full rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-2.5 text-[13px] text-[var(--brand)] dark:text-[#e8edf7] focus:border-[var(--brand)] focus:outline-none" />
                      <input value={estimate.customer_website ?? ""} onChange={e => setHdr({ customer_website: e.target.value })} placeholder="Website" className="h-9 w-full rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-2.5 text-[13px] text-[var(--brand)] dark:text-[#e8edf7] focus:border-[var(--brand)] focus:outline-none" />
                    </div>
                    <p className="mt-1.5 text-[10px] text-[#97A1A0] dark:text-[#728098]">{EN ? "Saved with the estimate (Save)." : "Se guardan con el estimado (Guardar)."}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-[#E6DDCB] dark:border-[#22304d] p-4">
                  <button onClick={closeInvoiceModal} className="flex-1 rounded-xl border border-[#E6DDCB] dark:border-[#22304d] py-2.5 text-sm font-bold text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]">{EN ? "Cancel" : "Cancelar"}</button>
                  <button onClick={() => openInvoicePdfInBrowser(buildInvoiceData())} className="rounded-xl border border-[#E6DDCB] dark:border-[#22304d] px-4 py-2.5 text-sm font-bold text-[var(--brand)] dark:text-[#e8edf7] hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]">{EN ? "Open" : "Abrir"}</button>
                  <button onClick={() => exportInvoicePdf(buildInvoiceData())} className="inline-flex items-center gap-1.5 rounded-xl bg-[#7B1838] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#6a1530]"><FileText size={13} />PDF</button>
                  <button onClick={goInvoiceEmail} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--accent-strong)]">✉️ Email</button>
                </div>
              </>
            ) : (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto p-5">
                  <p className="text-[11px] text-[#97A1A0] dark:text-[#728098]">{EN ? "From" : "Desde"}: <span className="font-bold text-[var(--brand)] dark:text-[#e8edf7]">Luxaris Design &lt;luxaris25@yahoo.com&gt;</span></p>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">{EN ? "To" : "Para"} *</label>
                    <input type="email" value={invEmailTo} onChange={e => setInvEmailTo(e.target.value)} placeholder="cliente@email.com" className="h-10 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 text-sm text-[var(--brand)] dark:text-[#e8edf7] focus:border-[var(--brand)] focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">{EN ? "Subject" : "Asunto"}</label>
                    <input value={invEmailSub} onChange={e => setInvEmailSub(e.target.value)} className="h-10 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 text-sm text-[var(--brand)] dark:text-[#e8edf7] focus:border-[var(--brand)] focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">{EN ? "Message" : "Mensaje"}</label>
                    <textarea rows={5} value={invEmailMsg} onChange={e => setInvEmailMsg(e.target.value)} className="w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 py-2 text-sm leading-relaxed text-[var(--brand)] dark:text-[#e8edf7] focus:border-[var(--brand)] focus:outline-none" />
                  </div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">{EN ? "PDF preview" : "Vista previa del PDF"}</label>
                  {invPreview && <iframe src={invPreview} title="Invoice preview" className="h-64 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220]" />}
                </div>
                <div className="flex gap-2 border-t border-[#E6DDCB] dark:border-[#22304d] p-4">
                  <button onClick={() => setInvView("build")} className="flex-1 rounded-xl border border-[#E6DDCB] dark:border-[#22304d] py-2.5 text-sm font-bold text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]">← {EN ? "Back" : "Atrás"}</button>
                  <button onClick={sendInvoiceEmail} disabled={invSending || !invEmailTo.includes("@")} className="flex-1 rounded-xl bg-[var(--brand)] py-2.5 text-sm font-bold text-white hover:bg-[var(--brand-strong)] disabled:opacity-40">{invSending ? (EN ? "Sending…" : "Enviando…") : (EN ? "Send invoice" : "Enviar factura")}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Email modal ────────────────────────────────────────────────────── */}
      {showEmailModal && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
          onClick={closeEmailModal}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white dark:bg-[#111a2e] shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-[var(--brand)] px-5 py-3.5">
              <span className="text-sm font-bold text-white">
                ✉️ {EN ? "Send estimate by email" : "Enviar estimado por correo"}
              </span>
              <button onClick={closeEmailModal} className="text-white/60 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              <p className="text-[11px] text-[#97A1A0] dark:text-[#728098]">
                {EN ? "From" : "Desde"}: <span className="font-bold text-[var(--brand)]">Luxaris Design &lt;luxaris25@yahoo.com&gt;</span>
              </p>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">
                  {EN ? "To" : "Para"} *
                </label>
                <input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)}
                  placeholder="cliente@email.com"
                  className="h-10 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none" />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">
                  {EN ? "Subject" : "Asunto"}
                </label>
                <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none" />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">
                  {EN ? "Message" : "Mensaje"}
                </label>
                <textarea rows={5} value={emailMsg} onChange={e => setEmailMsg(e.target.value)}
                  className="w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 py-2 text-sm leading-relaxed text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none" />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">
                  {EN ? "PDF preview" : "Vista previa del PDF"}
                </label>
                <div className="inline-flex rounded-lg border border-[#D7CBB3] dark:border-[#2c3c5e] bg-[#F7F3EA] dark:bg-[#0b1220] p-0.5">
                  {(["full", "summary"] as const).map(m => (
                    <button key={m} type="button"
                      onClick={() => { setEmailMode(m); refreshEmailPreview(m); }}
                      className={`rounded-md px-2.5 py-1 text-[10px] font-bold transition ${
                        emailMode === m ? "bg-[var(--accent)] text-white" : "text-[#5C6A6E] dark:text-[#9fb0cc] hover:text-[var(--brand)]"
                      }`}>
                      {m === "full" ? (EN ? "With detail" : "Con detalle") : (EN ? "Summary" : "Resumen")}
                    </button>
                  ))}
                </div>
              </div>
              {emailPreview && (
                <iframe
                  src={emailPreview}
                  title="PDF preview"
                  className="h-64 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220]"
                />
              )}
            </div>

            <div className="flex gap-2 border-t border-[#E6DDCB] dark:border-[#22304d] p-4">
              <button onClick={closeEmailModal}
                className="flex-1 rounded-xl border border-[#E6DDCB] dark:border-[#22304d] py-2.5 text-sm font-bold text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]">
                {EN ? "Cancel" : "Cancelar"}
              </button>
              <button onClick={sendEmail} disabled={sendingEmail || !emailTo.includes("@")}
                className="flex-1 rounded-xl bg-[var(--brand)] py-2.5 text-sm font-bold text-white hover:bg-[var(--brand-strong)] disabled:opacity-40">
                {sendingEmail
                  ? (EN ? "Sending…" : "Enviando…")
                  : (EN ? "Send estimate" : "Enviar estimado")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Section modal ──────────────────────────────────────────────── */}
      {showAddSection && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setShowAddSection(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-[#111a2e] shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E6DDCB] dark:border-[#22304d] px-5 py-3.5">
              <span className="text-sm font-bold text-[var(--brand)]">
                {EN ? "Add Section" : "Agregar Sección"}
              </span>
              <button onClick={() => setShowAddSection(false)} className="text-[#5C6A6E] dark:text-[#9fb0cc] hover:text-[#B0492F]">
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto p-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#5C6A6E] dark:text-[#9fb0cc]">
                {EN ? "From catalog" : "Del catálogo"}
              </div>
              {effectiveCatalog.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => addSection(cat as EstimateSectionCatalog & { id: string })}
                  className="w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] px-4 py-3 text-left transition hover:border-[var(--accent)] hover:bg-[#EDF3FB] dark:hover:bg-[#111a2e]"
                >
                  <div className="flex items-center gap-2">
                    <span>{cat.is_material_type ? "📦" : sectionEmoji(cat.name_en)}</span>
                    <span className="text-[12px] font-semibold text-[var(--brand)]">{EN ? cat.name_en : cat.name_es}</span>
                  </div>
                  {(EN ? cat.note_en : cat.note_es) && (
                    <div className="mt-0.5 pl-6 text-[10px] text-[#5C6A6E] dark:text-[#9fb0cc]">{EN ? cat.note_en : cat.note_es}</div>
                  )}
                </button>
              ))}
              <div className="border-t border-[#E6DDCB] dark:border-[#22304d] pt-2">
                <button
                  onClick={() => addSection()}
                  className="w-full rounded-xl border-2 border-dashed border-[#D7CBB3] dark:border-[#2c3c5e] px-4 py-3 text-left text-[12px] font-semibold text-[#5C6A6E] dark:text-[#9fb0cc] transition hover:border-[var(--accent)] hover:bg-[#EDF3FB] dark:hover:bg-[#111a2e] hover:text-[var(--accent)]"
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
              className="w-full max-w-lg overflow-hidden rounded-2xl bg-white dark:bg-[#111a2e] shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#E6DDCB] dark:border-[#22304d] bg-[var(--brand)] px-5 py-4">
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
              <div className="grid grid-cols-3 gap-px bg-[#E6DDCB] dark:bg-[#17233d] border-b border-[#E6DDCB] dark:border-[#22304d]">
                {[
                  { label: EN ? "Target" : "Total a cobrar", value: money(target), color: "text-[var(--brand)]" },
                  { label: EN ? "Received" : "Recibido",     value: money(received), color: "text-[#4F8A63]" },
                  { label: EN ? "Remaining" : "Pendiente",   value: money(remaining), color: remaining > 0 ? "text-[#B0492F]" : "text-[#4F8A63]" },
                ].map(c => (
                  <div key={c.label} className="bg-[#F7F3EA] dark:bg-[#0b1220] px-4 py-3 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#5C6A6E] dark:text-[#9fb0cc]">{c.label}</p>
                    <p className={`mt-1 font-mono text-[15px] font-bold ${c.color}`}>{c.value}</p>
                  </div>
                ))}
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-[#E6DDCB] dark:bg-[#17233d]">
                <div className={`h-full transition-all ${pct >= 100 ? "bg-[#4F8A63]" : "bg-[var(--accent)]"}`} style={{ width: `${pct}%` }} />
              </div>

              {/* Payments grid */}
              <div className="max-h-48 overflow-y-auto">
                {pmts.length === 0 ? (
                  <p className="py-6 text-center text-[12px] text-[#5C6A6E] dark:text-[#9fb0cc]">
                    {EN ? "No payments yet" : "Sin pagos registrados"}
                  </p>
                ) : (
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-[#FAFAF8] dark:bg-[#17233d] text-[9px] font-bold uppercase tracking-wider text-[#5C6A6E] dark:text-[#9fb0cc]">
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
                          <tr key={p.id} className={`border-t border-[#F0EBE0] dark:border-[#22304d] ${isEditing ? "bg-[#EDF3FB] dark:bg-[#111a2e]" : "hover:bg-[#FDFAF6] dark:hover:bg-[#111a2e]"}`}>
                            {isEditing ? (
                              <>
                                <td className="px-2 py-1.5">
                                  <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                                    className="w-full rounded border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-1.5 py-1 text-[11px] focus:outline-none" />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input type="text" value={editForm.concept} onChange={e => setEditForm(f => ({ ...f, concept: e.target.value }))}
                                    placeholder={EN ? "Concept" : "Concepto"}
                                    className="w-full rounded border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-1.5 py-1 text-[11px] focus:outline-none" />
                                </td>
                                <td className="px-2 py-1.5">
                                  <select value={editForm.method} onChange={e => setEditForm(f => ({ ...f, method: e.target.value as Payment["method"] }))}
                                    className="rounded border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] px-1 py-1 text-[11px] focus:outline-none">
                                    {["Transferencia","Efectivo","Zelle","Cheque","Tarjeta"].map(m => <option key={m}>{m}</option>)}
                                  </select>
                                </td>
                                <td className="px-2 py-1.5">
                                  <input type="number" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                                    className={`w-20 rounded border px-1.5 py-1 text-right text-[11px] font-mono focus:outline-none ${editWouldExceed ? "border-[#B0492F] bg-[#FDF0ED] dark:bg-[#2a1712]" : "border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e]"}`} />
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
                                      className="rounded border border-[#E6DDCB] dark:border-[#22304d] px-2 py-1 text-[10px] text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]">
                                      ✕
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-2 text-[#5C6A6E] dark:text-[#9fb0cc]">{p.date}</td>
                                <td className="px-4 py-2 text-[var(--brand)] max-w-[130px] truncate">{p.concept || "—"}</td>
                                <td className="px-4 py-2 text-[#5C6A6E] dark:text-[#9fb0cc]">{p.method}</td>
                                <td className="px-4 py-2 text-right font-mono font-semibold text-[var(--brand)]">{money(p.amount)}</td>
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
                                        className="rounded border border-[#E6DDCB] dark:border-[#22304d] px-2 py-0.5 text-[10px] text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]"
                                      >{EN ? "No" : "No"}</button>
                                    </div>
                                  ) : (
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => { setEditingPayId(p.id); setEditForm({ amount: String(p.amount), date: p.date, method: p.method, concept: p.concept ?? "" }); }}
                                        className="rounded p-1 text-[#C4B89A] hover:bg-[#EDF3FB] dark:hover:bg-[#111a2e] hover:text-[var(--accent)] transition"
                                      ><Pencil size={10} /></button>
                                      <button
                                        onClick={() => setConfirmDeletePayId(p.id)}
                                        className="rounded p-1 text-[#C4B89A] hover:bg-[#FDF0ED] dark:hover:bg-[#2a1712] hover:text-[#B0492F] transition"
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
              <div className="border-t border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] p-4">
                {/* Overage warning when already exceeded */}
                {received > target + 0.005 && (
                  <div className="mb-3 rounded-lg border border-[#F5C6B5] bg-[#FDF0ED] dark:bg-[#2a1712] px-3 py-2 text-[11px] text-[#B0492F]">
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
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#5C6A6E] dark:text-[#9fb0cc]">
                        {EN ? "Add partial payment" : "Agregar pago a cuenta"}
                        {remaining > 0 && <span className="ml-2 font-normal normal-case text-[var(--accent)]">({EN ? "pending" : "pendiente"}: {money(remaining)})</span>}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <input
                            type="number" placeholder={EN ? "Amount" : "Monto"} value={depAmt}
                            onChange={e => setDepAmt(e.target.value)}
                            className={`w-full rounded-lg border px-3 py-2 text-[12px] focus:outline-none ${wouldExceed ? "border-[#B0492F] bg-[#FDF0ED] dark:bg-[#2a1712] focus:border-[#B0492F]" : "border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] focus:border-[var(--accent)]"}`}
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
                          className="rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-3 py-2 text-[12px] focus:border-[var(--accent)] focus:outline-none"
                        />
                        <select
                          value={depMethod}
                          onChange={e => setDepMethod(e.target.value as Payment["method"])}
                          className="rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-3 py-2 text-[12px] focus:border-[var(--accent)] focus:outline-none"
                        >
                          {["Transferencia","Efectivo","Zelle","Cheque","Tarjeta"].map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <input
                          type="text" placeholder={EN ? "Comment (e.g. first deposit)" : "Comentario (ej. primer depósito)"}
                          value={depConcept} onChange={e => setDepConcept(e.target.value)}
                          className="rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-3 py-2 text-[12px] focus:border-[var(--accent)] focus:outline-none"
                        />
                      </div>
                      {wouldExceed && (
                        <p className="mt-2 rounded-lg border border-[#F5C6B5] bg-[#FDF0ED] dark:bg-[#2a1712] px-3 py-2 text-[11px] text-[#B0492F]">
                          ⚠️ {EN
                            ? `This amount would exceed the target. You can only add up to ${money(remaining)}.`
                            : `Este monto supera el objetivo. Solo puedes agregar hasta ${money(remaining)}.`}
                        </p>
                      )}
                      <button
                        onClick={() => addDepositPayment(idx)}
                        disabled={depSaving || !depAmt || parseFloat(depAmt) <= 0 || wouldExceed}
                        className="mt-2 w-full rounded-xl bg-[var(--brand)] py-2.5 text-[12px] font-bold text-white transition hover:bg-[#0F2830] disabled:opacity-40"
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

      {/* ── Confirm delete section ────────────────────────────────────────── */}
      {confirmDeleteSection && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setConfirmDeleteSection(null)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-[#111a2e] shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-[#E6DDCB] dark:border-[#22304d] px-5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FDF0ED] dark:bg-[#2a1712] text-lg">
                🗑
              </div>
              <h3 className="font-bold text-[var(--brand)]">
                {EN ? "Delete section?" : "¿Eliminar sección?"}
              </h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">
                {EN
                  ? <>The section <strong className="text-[var(--brand)]">{confirmDeleteSection.name}</strong> and all its items will be permanently deleted. This cannot be undone.</>
                  : <>La sección <strong className="text-[var(--brand)]">{confirmDeleteSection.name}</strong> y todos sus ítems serán eliminados permanentemente. Esta acción no se puede deshacer.</>}
              </p>
            </div>
            <div className="flex gap-2 border-t border-[#E6DDCB] dark:border-[#22304d] px-5 py-4">
              <button
                onClick={() => setConfirmDeleteSection(null)}
                className="flex-1 rounded-xl border border-[#E6DDCB] dark:border-[#22304d] py-2.5 text-sm font-semibold text-[#5C6A6E] dark:text-[#9fb0cc] transition hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]"
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
        const dep         = estimate.deposit_schedule[editDepositIdx];
        const color       = DEPOSIT_PALETTE[editDepositIdx % DEPOSIT_PALETTE.length];
        const gt          = totals.grandTotal;
        const sumOthersAmt = estimate.deposit_schedule.filter((_, j) => j !== editDepositIdx).reduce((s, d) => s + depositTarget(d, gt), 0);
        const remainAmt   = Math.max(0, Math.round((gt - sumOthersAmt) * 100) / 100);
        const remainPct   = gt > 0 ? Math.round(remainAmt / gt * 1000) / 10 : 0;
        const currentAmt  = editDepositLastChanged === "amount" ? (parseFloat(editDepositAmt) || 0) : Math.round(gt * (parseFloat(editDepositPct) || 0) / 100 * 100) / 100;
        const currentPct  = gt > 0 ? Math.round(currentAmt / gt * 1000) / 10 : 0;
        const isLast      = editDepositIdx === estimate.deposit_schedule.length - 1;
        return (
          <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => setEditDepositIdx(null)}>
            <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-[#111a2e] shadow-2xl"
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3" style={{ background: color }}>
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">
                  {EN ? "Edit installment" : "Editar cuota"} #{editDepositIdx + 1}
                </p>
                <button onClick={() => setEditDepositIdx(null)} className="text-white/60 hover:text-white"><X size={16} /></button>
              </div>

              {/* Two-box value editor — active box gets color, secondary gets cream */}
              <div className="grid grid-cols-2 divide-x divide-[#E6DDCB] border-b border-[#E6DDCB] dark:border-[#22304d]">
                {/* % box */}
                <div className={`flex flex-col items-center px-5 py-5 transition-colors ${editDepositLastChanged === "pct" ? "" : "bg-[#F7F3EA] dark:bg-[#0b1220]"}`}
                  style={editDepositLastChanged === "pct" ? { background: color } : {}}>
                  <label className={`mb-1 text-[10px] font-bold uppercase tracking-widest ${editDepositLastChanged === "pct" ? "text-white/60" : "text-[#97A1A0] dark:text-[#728098]"}`}>
                    {EN ? "Percentage" : "Porcentaje"}
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min={0} max={9999}
                      value={editDepositPct}
                      onChange={e => onEditDepositPctChange(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveDepositEdit(); if (e.key === "Escape") setEditDepositIdx(null); }}
                      className={`w-16 appearance-none bg-transparent text-center font-extrabold focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${editDepositLastChanged === "pct" ? "text-[28px] text-white" : "text-[22px] text-[var(--brand)]"}`}
                    />
                    <span className={`font-bold ${editDepositLastChanged === "pct" ? "text-[20px] text-white/70" : "text-[16px] text-[#97A1A0] dark:text-[#728098]"}`}>%</span>
                  </div>
                  {editDepositLastChanged === "pct" && (
                    <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-white/40">{EN ? "primary" : "principal"}</span>
                  )}
                </div>
                {/* $ box */}
                <div className={`flex flex-col items-center px-5 py-5 transition-colors ${editDepositLastChanged === "amount" ? "" : "bg-[#F7F3EA] dark:bg-[#0b1220]"}`}
                  style={editDepositLastChanged === "amount" ? { background: color } : {}}>
                  <label className={`mb-1 text-[10px] font-bold uppercase tracking-widest ${editDepositLastChanged === "amount" ? "text-white/60" : "text-[#97A1A0] dark:text-[#728098]"}`}>
                    {EN ? "Amount" : "Monto"}
                  </label>
                  <div className="flex items-center gap-1">
                    <span className={`font-bold ${editDepositLastChanged === "amount" ? "text-[20px] text-white/70" : "text-[16px] text-[#97A1A0] dark:text-[#728098]"}`}>$</span>
                    <input
                      type="number" min={0}
                      value={editDepositAmt}
                      onChange={e => onEditDepositAmtChange(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveDepositEdit(); }}
                      className={`w-24 appearance-none bg-transparent text-center font-extrabold focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${editDepositLastChanged === "amount" ? "text-[28px] text-white" : "text-[22px] text-[var(--brand)]"}`}
                    />
                  </div>
                  {editDepositLastChanged === "amount" && (
                    <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-white/40">{EN ? "fixed · primary" : "fijo · principal"}</span>
                  )}
                </div>
              </div>

              {/* Remaining hint */}
              <div className={`flex items-center justify-between px-5 py-2.5 text-[10px] font-bold ${Math.abs(currentAmt - remainAmt) < 0.02 ? "bg-[#DCEBDD] dark:bg-[#14261c]" : currentAmt > remainAmt ? "bg-[#FDE8E3] dark:bg-[#2a1712]" : "bg-[#F7F3EA] dark:bg-[#0b1220]"}`}>
                <span className="text-[#5C6A6E] dark:text-[#9fb0cc]">
                  {EN ? "Available for this deposit:" : "Disponible para esta cuota:"}
                </span>
                <span className={currentAmt > remainAmt ? "text-[#B0492F]" : "text-[#4F8A63]"}>
                  {remainPct}% · {money(remainAmt)}
                  {isLast && <span className="ml-1.5 opacity-60">{EN ? "(auto-balanced)" : "(auto-balanceado)"}</span>}
                </span>
              </div>

              {/* Concept */}
              <div className="px-5 py-4">
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#5C6A6E] dark:text-[#9fb0cc]">
                  {EN ? "Concept" : "Concepto"}
                </label>
                <input
                  value={editDepositLabel}
                  onChange={e => setEditDepositLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveDepositEdit(); if (e.key === "Escape") setEditDepositIdx(null); }}
                  className="w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] px-3 py-2.5 text-sm font-semibold text-[var(--brand)] focus:border-[var(--accent)] focus:outline-none"
                  placeholder={EN ? "e.g. At sign contract" : "Ej. Al firmar contrato"}
                />
              </div>

              {/* Footer */}
              <div className="flex gap-2 border-t border-[#E6DDCB] dark:border-[#22304d] px-5 py-4">
                <button onClick={() => setEditDepositIdx(null)}
                  className="flex-1 rounded-xl border border-[#E6DDCB] dark:border-[#22304d] py-2.5 text-sm font-bold text-[#5C6A6E] dark:text-[#9fb0cc] transition hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]">
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
          <div className="w-full max-w-md rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E6DDCB] dark:border-[#22304d] bg-[var(--brand)] px-5 py-4 rounded-t-2xl">
              <p className="text-sm font-bold text-white">{EN ? "Choose PDF format" : "Elige el formato PDF"}</p>
              <button onClick={() => setShowPdfModal(false)} className="text-white/60 hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-3 p-5">
              <button
                onClick={() => handleOpenPdf("full")}
                className="flex items-start gap-4 rounded-xl border-2 border-[var(--brand)] bg-[#F7F3EA] dark:bg-[#0b1220] p-4 text-left transition hover:bg-[#EDE8E0]"
              >
                <FileText size={28} className="mt-0.5 flex-none text-[var(--brand)]" />
                <div>
                  <p className="font-bold text-[var(--brand)]">{EN ? "Estimate with detail" : "Estimado con detalle"}</p>
                  <p className="mt-0.5 text-xs text-[#5C6A6E] dark:text-[#9fb0cc]">{EN ? "Shows all section totals and item amounts" : "Muestra totales de secciones y montos de items"}</p>
                </div>
              </button>
              <button
                onClick={() => handleOpenPdf("summary")}
                className="flex items-start gap-4 rounded-xl border-2 border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-4 text-left transition hover:border-[var(--accent)] hover:bg-[#F0F3FA] dark:hover:bg-[#111a2e]"
              >
                <FileText size={28} className="mt-0.5 flex-none text-[var(--accent)]" />
                <div>
                  <p className="font-bold text-[var(--brand)]">{EN ? "Estimate without detail" : "Estimado sin detalle"}</p>
                  <p className="mt-0.5 text-xs text-[#5C6A6E] dark:text-[#9fb0cc]">{EN ? "Scope of work only — no amounts shown, payment schedule included" : "Solo alcance de trabajo — sin montos, incluye plan de pagos"}</p>
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
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-[#111a2e] shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-[var(--accent)] px-5 py-4">
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
              <p className="mb-3 text-[12px] text-[#5C6A6E] dark:text-[#9fb0cc]">
                {EN
                  ? "All sections and items will be copied. Customer name and project title will be updated to match the target project."
                  : "Se copiarán todas las secciones e ítems. El nombre del cliente y el título del proyecto se actualizarán al proyecto destino."}
              </p>
              {copyProjects.length === 0 ? (
                <p className="rounded-xl bg-[#F7F3EA] dark:bg-[#0b1220] px-4 py-3 text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">
                  {EN ? "No other projects found." : "No hay otros proyectos disponibles."}
                </p>
              ) : (
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#5C6A6E] dark:text-[#9fb0cc]">
                    {EN ? "Destination project" : "Proyecto destino"}
                  </label>
                  <select
                    value={copyTargetId}
                    onChange={e => onCopyTargetChange(e.target.value)}
                    className="w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#FDFAF6] dark:bg-[#111a2e] px-3 py-2.5 text-sm font-semibold text-[var(--brand)] focus:border-[var(--accent)] focus:outline-none"
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
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#F0DBD2] bg-[#FDF0ED] dark:bg-[#2a1712] px-3 py-2.5">
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
            <div className="flex gap-2 border-t border-[#E6DDCB] dark:border-[#22304d] px-5 py-4">
              <button
                onClick={() => setShowCopyModal(false)}
                className="flex-1 rounded-xl border border-[#E6DDCB] dark:border-[#22304d] py-2.5 text-sm font-semibold text-[#5C6A6E] dark:text-[#9fb0cc] transition hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]"
              >
                {EN ? "Cancel" : "Cancelar"}
              </button>
              <button
                onClick={doCopyEstimate}
                disabled={copying || !copyTargetId}
                className="flex-1 rounded-xl bg-[var(--accent)] py-2.5 text-sm font-bold text-white transition hover:bg-[#2d4a75] disabled:opacity-50"
              >
                {copying ? "…" : (EN ? "Copy estimate" : "Copiar estimado")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Save FAB — context-aware per sub-tab ──────────────────────────── */}
      <button
        onClick={saveHeader}
        disabled={saving}
        title={EN ? "Save estimate" : "Guardar estimado"}
        className={`fixed bottom-24 right-6 z-[140] flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.30)] transition hover:shadow-[0_6px_24px_rgba(0,0,0,0.40)] disabled:opacity-60 active:scale-95 ${
          estimateSubTab === "sections"
            ? "bg-[#7B1838] text-white hover:bg-[#6a1530]"
            : "bg-[#F0A090] text-[#7B1838] hover:bg-[#FFB8A8]"
        }`}
      >
        {saving
          ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          : <Save size={19} strokeWidth={2.2} />}
        <span className="text-[8px] font-black tracking-wide">
          {saving
            ? "…"
            : estimateSubTab === "sections"
              ? (EN ? "SAVE" : "GUARDAR")
              : (EN ? "SCHED" : "PAGAR")}
        </span>
      </button>
    </>
  );
}
