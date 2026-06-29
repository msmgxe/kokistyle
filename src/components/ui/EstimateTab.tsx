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
  ChevronDown, ChevronUp, Plus, X, Trash2, FileText, Zap, Info, GripVertical,
} from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import { money } from "@/src/lib/utils";
import { exportEstimatePdf } from "@/src/lib/pdf";
import type { Project, EstimateSectionCatalog, DepositEntry, ProjectEstimate } from "@/src/types/project";
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
  onUpdateField:     (id: string, field: "section_total"|"note"|"is_material_type", value: number|string|boolean) => void;
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
}

function SortableSection({
  section, isOpen, EN, effectiveTotal, hasItemAmounts,
  onToggle, onUpdateField, onDelete,
  onUpdateItem, onSaveItem, onDeleteItem, onItemsReorder, onAddItem,
  addingItemTo, setAddingItemTo, newItemDesc, setNewItemDesc, newItemAmt, setNewItemAmt,
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
          <div className="min-w-0">
            <div className="truncate text-[12px] font-bold uppercase tracking-wide text-[#16323D]">{name}</div>
            {section.note && <div className="text-[10px] text-[#5C6A6E]">{section.note}</div>}
          </div>
        </div>
        <div className="ml-3 flex shrink-0 items-center gap-3">
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
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0EBE0] bg-[#FAFAF8] px-4 py-2">
            <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[#5C6A6E]">
              <input
                type="checkbox"
                checked={section.is_material_type}
                onChange={e => onUpdateField(section.id, "is_material_type", e.target.checked)}
                className="rounded"
              />
              {EN ? "Materials only (excluded from labor discount)" : "Solo materiales (excluido del descuento)"}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={section.note}
                placeholder={EN ? "Note (e.g. Material included)" : "Nota (ej. Material incluido)"}
                onChange={e => onUpdateField(section.id, "note", e.target.value)}
                className="w-40 rounded-lg border border-[#E6DDCB] bg-white px-2 py-1 text-[11px] text-[#5C6A6E] focus:border-[#395886] focus:outline-none"
              />
              <button
                onClick={() => onDelete(section.id)}
                className="rounded-lg p-1.5 text-[#5C6A6E] transition hover:bg-[#FDF0ED] hover:text-[#B0492F]"
              >
                <Trash2 size={12} />
              </button>
            </div>
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
              type="number"
              value={hasItemAmounts ? effectiveTotal : totalStr}
              disabled={hasItemAmounts}
              onChange={e => { if (!hasItemAmounts) setTotalStr(e.target.value); }}
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
            <div className="px-4 py-2">
              <button
                onClick={() => { setAddingItemTo(section.id); setNewItemDesc(""); setNewItemAmt(""); }}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#395886] hover:underline"
              >
                <Plus size={11} /> {EN ? "Add item" : "Agregar item"}
              </button>
            </div>
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

    setEstimate({
      ...est,
      deposit_schedule: (est.deposit_schedule as DepositEntry[]) ?? defaultDeposits(),
      sections: (sections ?? []).map(s => ({
        ...s,
        items: ((s.items ?? []) as ItemRow[]).sort((a, b) => a.sort_order - b.sort_order),
      })),
    });
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

  // ── Save header ───────────────────────────────────────────────────────────
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
    setSaving(false);
    toast(EN ? "Estimate saved" : "Estimado guardado");
  }, [estimate, EN, toast]);

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
      section_total: 0,
      sort_order: sort,
    }).select().single();
    if (data) {
      setEstimate(p => p ? ({ ...p, sections: [...p.sections, { ...data, items: [] }] }) : p);
      setExpanded(prev => new Set([...prev, data.id]));
    }
    setShowAddSection(false);
  }, [estimate, EN]);

  const deleteSection = useCallback(async (sectionId: string) => {
    await supabase.from("estimate_sections").delete().eq("id", sectionId);
    setEstimate(p => p ? ({ ...p, sections: p.sections.filter(s => s.id !== sectionId) }) : p);
  }, []);

  const updateSectionField = useCallback(async (
    sectionId: string,
    field: "section_total" | "note" | "is_material_type",
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

  // ── PDF export ────────────────────────────────────────────────────────────
  const handleExportPdf = useCallback(() => {
    if (!estimate) return;
    try {
      const { grandTotal, laborTotal, discountAmt } = totals;
      exportEstimatePdf(estimate as unknown as ProjectEstimate, grandTotal, laborTotal, discountAmt, language);
    } catch (err) {
      console.error("[EstimateTab] PDF export error:", err);
      toast(EN ? "Error generating PDF — check console" : "Error al generar PDF — revisa la consola");
    }
  }, [estimate, totals, language, EN, toast]);

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
      <h3 className="mb-2 font-[Manrope] text-base font-bold text-[#16323D]">
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
  const DEPOSIT_COLORS = ["bg-[#395886]", "bg-[#4E7A82]", "bg-[#4F8A63]"];

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
            onClick={handleExportPdf}
            title={EN ? "Download PDF proposal" : "Descargar propuesta en PDF"}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#16323D] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#0F2830]"
          >
            <FileText size={12} /> {EN ? "Download PDF" : "Descargar PDF"}
          </button>
        </div>
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
          {showHeader ? <ChevronUp size={14} className="shrink-0 text-[#5C6A6E]" /> : <ChevronDown size={14} className="shrink-0 text-[#5C6A6E]" />}
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
                  onDelete={deleteSection}
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

          {/* Right: payment schedule — % editable */}
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#5C6A6E]">
              {EN ? "Payment Schedule" : "Calendario de Pagos"}
            </div>
            <div className="space-y-2">
              {(estimate.deposit_schedule ?? defaultDeposits()).map((dep, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  {/* Editable % badge */}
                  <div
                    className={`flex h-9 shrink-0 items-center justify-center gap-0.5 rounded-xl px-2 ${DEPOSIT_COLORS[i] ?? "bg-[#5C6A6E]"}`}
                    title={EN ? "Click to edit %" : "Clic para editar %"}
                  >
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={dep.pct}
                      onChange={e => {
                        const pct = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                        setEstimate(p => p ? {
                          ...p,
                          deposit_schedule: p.deposit_schedule.map((d, j) => j === i ? { ...d, pct } : d),
                        } : p);
                      }}
                      className="w-7 appearance-none bg-transparent text-center text-[11px] font-bold text-white focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="text-[11px] font-bold text-white/80">%</span>
                  </div>
                  <div>
                    <div className="font-mono text-[12px] font-semibold text-[#16323D]">
                      {money(grandTotal * dep.pct / 100)}
                    </div>
                    <div className="text-[10px] text-[#5C6A6E]">
                      {EN ? dep.label_en : dep.label_es}
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
          onClick={handleExportPdf}
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
    </div>
  );
}
