"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  useDraggable, useDroppable,
  PointerSensor, TouchSensor,
  useSensors, useSensor,
} from "@dnd-kit/core";
import { X, Zap, CalendarDays, Plus, Save } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import { money } from "@/src/lib/utils";
import { useLanguage } from "@/src/context/LanguageContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanItem {
  id: string;
  estimateSectionId: string | null;
  estimateItemId: string | null;
  sourceKey: string;
  sectionTag: string;
  tagStyle: string;
  description: string;
  amount: number;
  hours: number;
  dayIndex: number | null;
  taskId: string | null;
  isCustom: boolean;
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

function addDaysStr(iso: string, n: number): string {
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


// ─── Item helpers ─────────────────────────────────────────────────────────────

function buildEstimateItems(estimate: EstimateForPlanner, EN: boolean): PlanItem[] {
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
          taskId: null,
          isCustom: false,
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
        taskId: null,
        isCustom: false,
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
      {item.isCustom && (
        <span className="mb-1 ml-1 inline-block rounded-full bg-[#EDE3CF] px-1.5 py-0.5 text-[9px] font-bold text-[#7A6230]">
          custom
        </span>
      )}
      <div className="text-[11px] leading-tight text-[#16323D]">{item.description}</div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[9px] text-[#5C6A6E]">
        <span className="font-mono">{money(item.amount)}</span>
        <span>·</span>
        <span>{item.hours}h</span>
        {item.taskId && (
          <>
            <span>·</span>
            <span className="rounded-full bg-[#DCEBDD] px-1 py-0.5 text-[8px] font-bold text-[#4F8A63]">saved</span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Pool ─────────────────────────────────────────────────────────────────────

function ItemPool({
  items, EN, onAddCustom,
}: {
  items: PlanItem[];
  EN: boolean;
  onAddCustom: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "pool" });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[100px] flex-col gap-2 rounded-xl border-2 border-dashed p-2 transition
        ${isOver ? "border-[#395886] bg-[#EDF3FB]" : "border-[#D7CBB3] bg-[#FDFAF6]"}`}
    >
      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-4 text-[11px] text-[#5C6A6E]">
          ✓ {EN ? "All items scheduled" : "Todos los items asignados"}
        </div>
      ) : (
        items.map(i => <ItemCard key={i.id} item={i} />)
      )}
      <button
        onClick={onAddCustom}
        className="mt-1 flex items-center justify-center gap-1 rounded-xl border border-dashed border-[#D7CBB3] py-1.5 text-[10px] font-semibold text-[#5C6A6E] transition hover:border-[#395886] hover:text-[#395886]"
      >
        <Plus size={10} /> {EN ? "Add custom item" : "Agregar item"}
      </button>
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

// ─── Custom item form ─────────────────────────────────────────────────────────

function CustomItemForm({
  EN, onAdd, onCancel,
}: {
  EN: boolean;
  onAdd: (item: { description: string; sectionTag: string; hours: number; amount: number }) => void;
  onCancel: () => void;
}) {
  const [desc, setDesc]     = useState("");
  const [tag, setTag]       = useState("");
  const [hours, setHours]   = useState(2);
  const [amount, setAmount] = useState(0);

  return (
    <div className="rounded-xl border border-[#395886] bg-white p-3 shadow-md">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#395886]">
        {EN ? "New custom item" : "Nuevo item personalizado"}
      </div>
      <input
        autoFocus
        placeholder={EN ? "Description" : "Descripción"}
        value={desc}
        onChange={e => setDesc(e.target.value)}
        className="mb-2 w-full rounded-lg border border-[#D7CBB3] bg-[#F7F3EA] px-2 py-1.5 text-[11px] text-[#16323D] focus:border-[#395886] focus:outline-none"
      />
      <input
        placeholder={EN ? "Section tag (e.g. Plumbing)" : "Sección (ej. Plomería)"}
        value={tag}
        onChange={e => setTag(e.target.value)}
        className="mb-2 w-full rounded-lg border border-[#D7CBB3] bg-[#F7F3EA] px-2 py-1.5 text-[11px] text-[#16323D] focus:border-[#395886] focus:outline-none"
      />
      <div className="mb-2 flex gap-2">
        <div className="flex-1">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-[#5C6A6E]">{EN ? "Hours" : "Horas"}</div>
          <input
            type="number"
            min={1}
            max={24}
            value={hours}
            onChange={e => setHours(Math.max(1, Number(e.target.value)))}
            className="w-full rounded-lg border border-[#D7CBB3] bg-[#F7F3EA] px-2 py-1.5 text-[11px] text-[#16323D] focus:border-[#395886] focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-[#5C6A6E]">{EN ? "Amount ($)" : "Monto ($)"}</div>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={e => setAmount(Math.max(0, Number(e.target.value)))}
            className="w-full rounded-lg border border-[#D7CBB3] bg-[#F7F3EA] px-2 py-1.5 text-[11px] text-[#16323D] focus:border-[#395886] focus:outline-none"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg bg-[#ECE3D1] py-1.5 text-[10px] font-bold text-[#5C6A6E]"
        >
          {EN ? "Cancel" : "Cancelar"}
        </button>
        <button
          onClick={() => { if (desc.trim()) onAdd({ description: desc.trim(), sectionTag: tag.trim() || "Custom", hours, amount }); }}
          disabled={!desc.trim()}
          className="flex-1 rounded-lg bg-[#395886] py-1.5 text-[10px] font-bold text-white disabled:opacity-40"
        >
          {EN ? "Add to pool" : "Agregar al pool"}
        </button>
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
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCustomForm, setShowCustomForm] = useState(false);

  const [dayDates, setDayDates] = useState<Record<number, string>>({});
  const [items, setItems] = useState<PlanItem[]>([]);

  const estimateRef = useRef(estimate);
  const ENRef       = useRef(EN);
  estimateRef.current = estimate;
  ENRef.current       = EN;

  // ── Load existing tasks on mount ────────────────────────────────────────────
  useEffect(() => {
    let alive = true;

    const init = async () => {
      const { data: existingTasks } = await supabase
        .from("tasks")
        .select("id, source_key, scheduled_date, name, hours, amount, source, source_section, estimate_item_id, estimate_section_id")
        .eq("project_id", projectId)
        .or("source.eq.estimate,source.eq.planner");

      if (!alive) return;

      const tasks = existingTasks ?? [];

      // Collect unique scheduled dates (sorted)
      const scheduledDates = [
        ...new Set(
          tasks
            .filter(t => t.scheduled_date)
            .map(t => t.scheduled_date as string)
        ),
      ].sort();

      const newNumDays = Math.max(4, scheduledDates.length);

      // Build dayDates: first from existing, fill remainder consecutively
      const newDayDates: Record<number, string> = {};
      scheduledDates.forEach((d, i) => { newDayDates[i] = d; });
      const fillBase = scheduledDates.length > 0
        ? scheduledDates[scheduledDates.length - 1]
        : todayIso();
      for (let i = scheduledDates.length; i < newNumDays; i++) {
        newDayDates[i] = addDaysStr(fillBase, i - scheduledDates.length + 1);
      }

      // date → day index
      const dateToIdx = new Map(scheduledDates.map((d, i) => [d, i]));

      // Build map: source_key → task row
      const taskByKey = new Map(tasks.map(t => [t.source_key as string, t]));

      // Estimate items with pre-assignment
      const estimateItems = buildEstimateItems(estimateRef.current, ENRef.current).map(item => {
        const task = taskByKey.get(item.sourceKey);
        if (!task) return item;
        return {
          ...item,
          taskId: task.id as string,
          dayIndex: task.scheduled_date ? (dateToIdx.get(task.scheduled_date as string) ?? null) : null,
        };
      });

      // Custom planner items (source = 'planner')
      const customItems: PlanItem[] = tasks
        .filter(t => t.source === "planner")
        .map((t, ci) => ({
          id: `planner-${t.id}`,
          estimateSectionId: (t.estimate_section_id as string | null) ?? null,
          estimateItemId: (t.estimate_item_id as string | null) ?? null,
          sourceKey: (t.source_key as string) ?? `planner-custom:${t.id}`,
          sectionTag: (t.source_section as string) ?? "Custom",
          tagStyle: TAG_STYLES[(estimateItems.length + ci) % TAG_STYLES.length],
          description: t.name as string,
          amount: (t.amount as number) ?? 0,
          hours: (t.hours as number) ?? 2,
          dayIndex: t.scheduled_date ? (dateToIdx.get(t.scheduled_date as string) ?? null) : null,
          taskId: t.id as string,
          isCustom: true,
        }));

      setNumDays(newNumDays);
      setDayDates(newDayDates);
      setItems([...estimateItems, ...customItems]);
      setLoading(false);
    };

    init();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const dayCapacity = workersPerDay * hoursPerWorker;

  // ── numDays stepper: extend/trim dayDates ───────────────────────────────────
  const handleNumDaysChange = (n: number) => {
    setNumDays(n);
    setDayDates(prev => {
      const next: Record<number, string> = {};
      const base = prev[0] ?? todayIso();
      for (let i = 0; i < n; i++) {
        next[i] = prev[i] ?? addDaysStr(base, i);
      }
      return next;
    });
  };

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

  // ── Greedy bin-packing auto-assign ──────────────────────────────────────────
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

  // ── Add custom item ──────────────────────────────────────────────────────────
  const addCustomItem = useCallback((fields: {
    description: string; sectionTag: string; hours: number; amount: number;
  }) => {
    const uuid = crypto.randomUUID();
    const newItem: PlanItem = {
      id: `custom-new-${uuid}`,
      estimateSectionId: null,
      estimateItemId: null,
      sourceKey: `planner-custom:${uuid}`,
      sectionTag: fields.sectionTag || "Custom",
      tagStyle: TAG_STYLES[items.length % TAG_STYLES.length],
      description: fields.description,
      amount: fields.amount,
      hours: fields.hours,
      dayIndex: null,
      taskId: null,
      isCustom: true,
    };
    setItems(prev => [newItem, ...prev]);
    setShowCustomForm(false);
  }, [items.length]);

  // ── Save / Update ────────────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true);

    const assigned    = items.filter(i => i.dayIndex !== null);
    const unscheduled = items.filter(i => i.dayIndex === null && i.taskId !== null);

    // New tasks to INSERT
    const toInsert = assigned
      .filter(i => !i.taskId)
      .map((item, index) => ({
        project_id:         projectId,
        name:               item.description,
        hours:              item.hours,
        duration_weeks:     1,
        status:             "pend",
        sort_order:         (item.dayIndex ?? 0) * 100 + index,
        assigned_contact_id: null,
        scheduled_date:     dayDates[item.dayIndex ?? 0] ?? null,
        estimate_item_id:   item.estimateItemId,
        estimate_section_id: item.estimateSectionId,
        source:             item.isCustom ? "planner" : "estimate",
        source_key:         item.sourceKey,
        source_section:     item.sectionTag,
        amount:             item.amount,
      }));

    // Existing tasks to UPDATE (scheduled_date may have changed)
    const toUpdate = assigned
      .filter(i => i.taskId !== null)
      .map(item => ({
        id:             item.taskId!,
        scheduled_date: dayDates[item.dayIndex ?? 0] ?? null,
        sort_order:     (item.dayIndex ?? 0) * 100,
      }));

    // Tasks dragged back to pool: clear scheduled_date
    const toUnschedule = unscheduled.map(i => i.taskId!);

    // INSERT new rows and capture returned IDs
    if (toInsert.length > 0) {
      const { data, error } = await supabase
        .from("tasks")
        .insert(toInsert)
        .select("id, source_key");
      if (error) {
        toast(EN ? "Error saving new tasks" : "Error al guardar tareas");
        setSaving(false);
        return;
      }
      if (data) {
        const keyToId = new Map((data as { id: string; source_key: string }[]).map(r => [r.source_key, r.id]));
        setItems(prev => prev.map(item => ({
          ...item,
          taskId: keyToId.get(item.sourceKey) ?? item.taskId,
        })));
      }
    }

    // UPDATE existing (scheduled_date or sort_order changed)
    await Promise.all(
      toUpdate.map(u =>
        supabase.from("tasks").update({ scheduled_date: u.scheduled_date, sort_order: u.sort_order }).eq("id", u.id)
      )
    );

    // UNSCHEDULE items moved back to pool
    if (toUnschedule.length > 0) {
      await supabase.from("tasks").update({ scheduled_date: null }).in("id", toUnschedule);
    }
    setSaving(false);

    const saved    = toInsert.length + toUpdate.length;
    const unsched  = toUnschedule.length;
    toast(
      EN
        ? `${saved} saved${unsched ? ` · ${unsched} unscheduled` : ""}`
        : `${saved} guardadas${unsched ? ` · ${unsched} sin fecha` : ""}`
    );
    onGenerated(); // refresh parent (Plan + Workflow tabs)
  };

  const scheduledCount = items.filter(i => i.dayIndex !== null).length;
  const savedCount     = items.filter(i => i.taskId !== null).length;

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
            {loading
              ? (EN ? "Loading…" : "Cargando…")
              : `${scheduledCount}/${items.length} ${EN ? "scheduled" : "asignados"} · ${savedCount} ${EN ? "saved in Workflow" : "guardados en Workflow"}`
            }
          </div>
        </div>

        <div className="flex-1" />

        {/* Config steppers */}
        <div className="flex items-center gap-4">
          <Stepper label={EN ? "Workers" : "Trabajadores"} value={workersPerDay} min={1} max={10} onChange={setWorkersPerDay} />
          <Stepper label={EN ? "Hrs/worker" : "Hrs/trab."}  value={hoursPerWorker} min={2} max={16} onChange={setHoursPerWorker} />
          <Stepper label={EN ? "Days" : "Días"}              value={numDays}        min={1} max={14} onChange={handleNumDaysChange} />
        </div>

        <div className="h-7 border-l border-[#E6DDCB]" />

        <button
          onClick={autoAssign}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl bg-[#EDF3FB] px-3 py-2 text-[12px] font-semibold text-[#395886] transition hover:bg-[#D5DEEF] disabled:opacity-40"
        >
          <Zap size={12} /> {EN ? "Auto-assign" : "Auto-asignar"}
        </button>
        <button
          onClick={save}
          disabled={saving || loading}
          className="flex items-center gap-1.5 rounded-xl bg-[#16323D] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#0F2830] disabled:opacity-50"
        >
          <Save size={12} />
          {saving
            ? "…"
            : EN
              ? `Save (${scheduledCount})`
              : `Guardar (${scheduledCount})`
          }
        </button>
      </div>

      {/* ── Main canvas ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#16323D] border-t-transparent" />
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4">

            {/* Left: Pool */}
            <div className="flex w-[224px] shrink-0 flex-col gap-2">
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

              {showCustomForm ? (
                <CustomItemForm EN={EN} onAdd={addCustomItem} onCancel={() => setShowCustomForm(false)} />
              ) : null}

              <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
                <ItemPool
                  items={showCustomForm ? poolItems : poolItems}
                  EN={EN}
                  onAddCustom={() => setShowCustomForm(true)}
                />
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
      )}

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
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[#4F8A63] opacity-60 outline outline-1 outline-[#4F8A63]" />
          {EN ? "\"saved\" badge = already in Workflow" : "badge \"saved\" = ya está en Workflow"}
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
