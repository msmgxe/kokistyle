"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  useDraggable, useDroppable,
  PointerSensor, TouchSensor,
  useSensors, useSensor,
} from "@dnd-kit/core";
import { X, Zap, CalendarDays } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import { money } from "@/src/lib/utils";
import { useLanguage } from "@/src/context/LanguageContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanItem {
  id: string;
  estimateSectionId: string;
  estimateItemId: string | null;
  sourceKey: string;
  sectionTag: string;
  tagStyle: string;
  description: string;
  amount: number;
  hours: number;
  dayIndex: number | null;
}

interface EstimateSection {
  id: string;
  name_en: string;
  name_es: string;
  is_material_type: boolean;
  items: { id: string; description: string; amount: number }[];
  section_total: number;
}

interface EstimateForPlanner {
  sections: EstimateSection[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TAG_STYLES = [
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

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatDate(iso: string, EN: boolean): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(EN ? "en-US" : "es-US", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

function initDates(n: number, base = todayIso()): Record<number, string> {
  const out: Record<number, string> = {};
  for (let i = 0; i < n; i++) out[i] = addDays(base, i);
  return out;
}

// ─── Item helpers ─────────────────────────────────────────────────────────────

function buildItems(estimate: EstimateForPlanner, EN: boolean): PlanItem[] {
  const out: PlanItem[] = [];
  estimate.sections.forEach((sec, si) => {
    const words = (EN ? sec.name_en : sec.name_es).split(" ");
    const tag = words.length > 2 ? words.slice(0, 2).join(" ") : words.join(" ");
    const tagStyle = TAG_STYLES[si % TAG_STYLES.length];
    if (sec.items && sec.items.length > 0) {
      sec.items.forEach((item, ii) => {
        out.push({
          id: `${sec.id}·${item.id}·${ii}`,
          estimateSectionId: sec.id,
          estimateItemId: item.id,
          sourceKey: `estimate-item:${item.id}`,
          sectionTag: tag,
          tagStyle,
          description: item.description,
          amount: item.amount,
          hours: 2,
          dayIndex: null,
        });
      });
    } else if (sec.section_total > 0) {
      out.push({
        id: `${sec.id}·flat`,
        estimateSectionId: sec.id,
        estimateItemId: null,
        sourceKey: `estimate-section:${sec.id}:flat`,
        sectionTag: tag,
        tagStyle,
        description: EN ? sec.name_en : sec.name_es,
        amount: sec.section_total,
        hours: 4,
        dayIndex: null,
      });
    }
  });
  return out;
}

// ─── Draggable card ───────────────────────────────────────────────────────────

function ItemCard({ item, overlay }: { item: PlanItem; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  const style = !overlay && transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`touch-none select-none rounded-xl border bg-white px-2.5 py-2 transition
        ${overlay ? "cursor-grabbing shadow-xl border-[#395886]" : "cursor-grab active:cursor-grabbing border-[#E6DDCB] hover:border-[#395886]/50 hover:shadow-sm"}
        ${isDragging && !overlay ? "opacity-25" : ""}`}
    >
      <span className={`mb-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold ${item.tagStyle}`}>
        {item.sectionTag}
      </span>
      <div className="text-[11px] leading-tight text-[#16323D]">{item.description}</div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[9px] text-[#5C6A6E]">
        <span className="font-mono">{money(item.amount)}</span>
        <span>·</span>
        <span>{item.hours}h</span>
      </div>
    </div>
  );
}

// ─── Pool ─────────────────────────────────────────────────────────────────────

function ItemPool({ items, EN }: { items: PlanItem[]; EN: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "pool" });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[100px] flex-col gap-2 rounded-xl border-2 border-dashed p-2 transition
        ${isOver ? "border-[#395886] bg-[#EDF3FB]" : "border-[#D7CBB3] bg-[#FDFAF6]"}`}
    >
      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-6 text-[11px] text-[#5C6A6E]">
          ✓ {EN ? "All items scheduled" : "Todos los items asignados"}
        </div>
      ) : (
        items.map(i => <ItemCard key={i.id} item={i} />)
      )}
    </div>
  );
}

// ─── Day column ───────────────────────────────────────────────────────────────

function DayColumn({
  day, items, capacity, date, EN, onDateChange,
}: {
  day: number;
  items: PlanItem[];
  capacity: number;
  date: string;
  EN: boolean;
  onDateChange: (iso: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` });
  const used = items.reduce((s, i) => s + i.hours, 0);
  const pct = capacity > 0 ? Math.min((used / capacity) * 100, 100) : 0;
  const over = used > capacity;

  return (
    <div className="flex w-[196px] shrink-0 flex-col gap-2">
      {/* Header */}
      <div className="rounded-xl border border-[#E6DDCB] bg-white px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-bold text-[#16323D]">
            {EN ? `Day ${day + 1}` : `Día ${day + 1}`}
          </span>
          <span className={`text-[10px] font-semibold ${over ? "text-[#B0492F]" : "text-[#5C6A6E]"}`}>
            {used}h / {capacity}h
          </span>
        </div>

        {/* Date picker row */}
        <div className="mt-1.5 flex items-center gap-1.5">
          <CalendarDays size={11} className="shrink-0 text-[#5C6A6E]" />
          <div className="relative flex-1">
            <span className="pointer-events-none text-[10px] font-semibold text-[#395886]">
              {date ? formatDate(date, EN) : (EN ? "Pick date" : "Seleccionar fecha")}
            </span>
            <input
              type="date"
              value={date}
              onChange={e => onDateChange(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </div>
        </div>

        {/* Capacity bar */}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E6DDCB]">
          <div
            className={`h-full rounded-full transition-all ${over ? "bg-[#B0492F]" : pct > 79 ? "bg-[#E8A44A]" : "bg-[#4F8A63]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex min-h-[150px] flex-col gap-2 rounded-xl border-2 border-dashed p-2 transition
          ${isOver ? "border-[#395886] bg-[#EDF3FB]" : items.length ? "border-transparent bg-[#F7F3EA]" : "border-[#D7CBB3]"}`}
      >
        {items.map(i => <ItemCard key={i.id} item={i} />)}
        {items.length === 0 && (
          <div className="flex flex-1 items-center justify-center text-[10px] text-[#C4B89A]">
            {EN ? "Drop items here" : "Arrastra aquí"}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Config stepper ───────────────────────────────────────────────────────────

function Stepper({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] uppercase tracking-wide text-[#5C6A6E]">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-5 w-5 items-center justify-center rounded text-sm text-[#5C6A6E] hover:bg-[#F7F3EA]"
        >−</button>
        <span className="w-6 text-center text-[12px] font-bold text-[#16323D]">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-5 w-5 items-center justify-center rounded text-sm text-[#5C6A6E] hover:bg-[#F7F3EA]"
        >+</button>
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function DayPlannerModal({
  estimate,
  projectId,
  onClose,
  onGenerated,
  toast,
}: {
  estimate: EstimateForPlanner;
  projectId: string;
  onClose: () => void;
  onGenerated: () => void;
  toast: (msg: string) => void;
}) {
  const { language } = useLanguage();
  const EN = language === "en";

  const [workersPerDay, setWorkersPerDay] = useState(2);
  const [hoursPerWorker, setHoursPerWorker] = useState(8);
  const [numDays, setNumDays] = useState(4);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Per-day dates (ISO "YYYY-MM-DD") — default: today + consecutive days
  const [dayDates, setDayDates] = useState<Record<number, string>>(() => initDates(4));

  const dayCapacity = workersPerDay * hoursPerWorker;

  const initItems = useCallback(() => buildItems(estimate, EN), [estimate, EN]);
  const [items, setItems] = useState<PlanItem[]>(initItems);

  // Extend / trim dates when numDays changes
  useEffect(() => {
    setDayDates(prev => {
      const next: Record<number, string> = {};
      // Anchor: date of day 0 (or today if missing)
      const base = prev[0] ?? todayIso();
      for (let i = 0; i < numDays; i++) {
        // Keep existing date if user already set it, else compute from base
        next[i] = prev[i] ?? addDays(base, i);
      }
      return next;
    });
  }, [numDays]);

  const setDayDate = useCallback((day: number, iso: string) => {
    setDayDates(prev => ({ ...prev, [day]: iso }));
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const poolItems  = useMemo(() => items.filter(i => i.dayIndex === null), [items]);
  const getDay     = useCallback((d: number) => items.filter(i => i.dayIndex === d), [items]);
  const activeItem = useMemo(() => items.find(i => i.id === activeId), [items, activeId]);

  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(active.id as string);
  const handleDragEnd   = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over) return;
    const overId = over.id as string;
    const newDay = overId === "pool" ? null : parseInt(overId.replace("day-", ""), 10);
    setItems(prev => prev.map(i => i.id === (active.id as string) ? { ...i, dayIndex: newDay } : i));
  };

  // Greedy bin-packing auto-assign
  const autoAssign = () => {
    setItems(prev => {
      const sorted = [...prev].sort((a, b) => b.hours - a.hours);
      const usage = Array<number>(numDays).fill(0);
      return sorted.map(item => {
        let assigned: number | null = null;
        for (let d = 0; d < numDays; d++) {
          if (usage[d] + item.hours <= dayCapacity) {
            usage[d] += item.hours;
            assigned = d;
            break;
          }
        }
        if (assigned === null) {
          assigned = numDays - 1;
          usage[assigned] += item.hours;
        }
        return { ...item, dayIndex: assigned };
      });
    });
  };

  // Generate workflow tasks
  const generate = async () => {
    setGenerating(true);
    const scheduledItems = items.filter(i => i.dayIndex !== null);
    if (scheduledItems.length === 0) {
      toast(EN ? "No items assigned to days" : "Sin items asignados a días");
      setGenerating(false);
      return;
    }

    const sourceKeys = scheduledItems.map(i => i.sourceKey);
    const { data: existing, error: existingError } = await supabase
      .from("tasks")
      .select("source_key")
      .eq("project_id", projectId)
      .eq("source", "estimate")
      .in("source_key", sourceKeys);

    if (existingError) {
      setGenerating(false);
      toast(EN ? "Error checking existing tasks" : "Error verificando tareas existentes");
      return;
    }

    const existingKeys = new Set((existing ?? []).map(row => row.source_key as string));
    const rows = scheduledItems
      .filter(item => !existingKeys.has(item.sourceKey))
      .map((item, index) => {
        const dayIndex = item.dayIndex ?? 0;
        return {
          project_id: projectId,
          name: item.description,
          hours: item.hours,
          duration_weeks: 1,
          status: "pend",
          sort_order: dayIndex * 100 + index,
          assigned_contact_id: null,
          scheduled_date: dayDates[dayIndex] ?? null,
          estimate_item_id: item.estimateItemId,
          estimate_section_id: item.estimateSectionId,
          source: "estimate",
          source_key: item.sourceKey,
          source_section: item.sectionTag,
          amount: item.amount,
        };
      });

    if (rows.length === 0) {
      setGenerating(false);
      toast(EN ? "These estimate items already exist in Workflow" : "Estos items ya existen en Workflow");
      return;
    }

    const { error } = await supabase.from("tasks").insert(rows);
    setGenerating(false);
    if (error) { toast(EN ? "Error creating tasks" : "Error al crear tareas"); return; }
    const skipped = scheduledItems.length - rows.length;
    toast(EN
      ? `${rows.length} item tasks created${skipped ? ` · ${skipped} skipped` : ""}`
      : `${rows.length} tareas por item creadas${skipped ? ` · ${skipped} omitidas` : ""}`);
    onGenerated();
    onClose();
  };

  const scheduledCount = items.filter(i => i.dayIndex !== null).length;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-[#F7F3EB]">

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-4 border-b border-[#D5DEEF] bg-white px-5 py-3">
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-[#5C6A6E] transition hover:bg-[#F7F3EA] hover:text-[#B0492F]"
        >
          <X size={18} />
        </button>
        <div className="min-w-0">
          <div className="text-sm font-bold text-[#16323D]">
            {EN ? "Day Planner" : "Planificador por Día"}
          </div>
          <div className="text-[10px] text-[#5C6A6E]">
            {scheduledCount}/{items.length} {EN ? "scheduled" : "asignados"} · {EN ? "drag items · click date to set" : "arrastra items · clic en fecha para cambiar"}
          </div>
        </div>

        <div className="flex-1" />

        {/* Config steppers */}
        <div className="flex items-center gap-4">
          <Stepper label={EN ? "Workers" : "Trabajadores"} value={workersPerDay} min={1} max={10} onChange={setWorkersPerDay} />
          <Stepper label={EN ? "Hrs/worker" : "Hrs/trab."}  value={hoursPerWorker} min={2} max={16} onChange={setHoursPerWorker} />
          <Stepper label={EN ? "Days" : "Días"}              value={numDays}        min={1} max={14} onChange={setNumDays} />
        </div>

        <div className="h-7 border-l border-[#E6DDCB]" />

        <button
          onClick={autoAssign}
          className="flex items-center gap-1.5 rounded-xl bg-[#EDF3FB] px-3 py-2 text-[12px] font-semibold text-[#395886] transition hover:bg-[#D5DEEF]"
        >
          <Zap size={12} /> {EN ? "Auto-assign" : "Auto-asignar"}
        </button>
        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-1.5 rounded-xl bg-[#16323D] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#0F2830] disabled:opacity-50"
        >
          {generating
            ? "…"
            : EN
              ? `Generate ${scheduledCount} tasks`
              : `Generar tareas`}
        </button>
      </div>

      {/* ── Main canvas ────────────────────────────────────────────────────── */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4">

          {/* Left: Pool */}
          <div className="flex w-[210px] shrink-0 flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#5C6A6E]">
                {EN ? "Item Pool" : "Pool de Items"}
              </span>
              {poolItems.length > 0 && (
                <span className="rounded-full bg-[#EDE3CF] px-2 py-0.5 text-[10px] font-bold text-[#7A6230]">
                  {poolItems.length}
                </span>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
              <ItemPool items={poolItems} EN={EN} />
            </div>
          </div>

          {/* Right: Day columns */}
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-[#5C6A6E]">
              {EN ? "Schedule" : "Cronograma"} — {dayCapacity}h/{EN ? "day" : "día"} capacity
            </span>
            <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-1">
              {Array.from({ length: numDays }, (_, d) => (
                <DayColumn
                  key={d}
                  day={d}
                  items={getDay(d)}
                  capacity={dayCapacity}
                  date={dayDates[d] ?? ""}
                  EN={EN}
                  onDateChange={iso => setDayDate(d, iso)}
                />
              ))}
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeItem && <ItemCard item={activeItem} overlay />}
        </DragOverlay>
      </DndContext>

      {/* ── Footer legend ───────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-5 border-t border-[#D5DEEF] bg-white px-5 py-2 text-[10px] text-[#5C6A6E]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[#4F8A63]" />
          {EN ? "On track" : "Capacidad OK"}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[#E8A44A]" />
          {EN ? "Near limit (>80%)" : "Cerca del límite"}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[#B0492F]" />
          {EN ? "Overloaded" : "Sobrecargado"}
        </span>
        <span className="ml-auto">
          {EN
            ? `Capacity: ${dayCapacity}h/day (${workersPerDay} workers × ${hoursPerWorker}h)`
            : `Capacidad: ${dayCapacity}h/día (${workersPerDay} trab. × ${hoursPerWorker}h)`}
        </span>
      </div>
    </div>
  );
}
