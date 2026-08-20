"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  useDroppable, closestCorners,
  PointerSensor, TouchSensor,
  useSensors, useSensor,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { X, Zap, CalendarDays, Plus, Save, Pencil } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
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
  days: number;            // duración en días (1 = un día); reparte horas por día
  dayIndex: number | null;
  taskId: string | null;
  isCustom: boolean;
  assignedContactId: string | null;
  done: boolean;
}

interface PlanContact { id: string; name: string; }

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
  "bg-[#EDF3FB] dark:bg-[#111a2e] text-[var(--accent)]",
  "bg-[#DCEBDD] dark:bg-[#14261c] text-[#4F8A63]",
  "bg-[#EDE3CF] dark:bg-[#17233d] text-[#7A6230]",
  "bg-[#F0E8F7] text-[#6D3AAD]",
  "bg-[#DCE8E9] dark:bg-[#122a2c] text-[#4E7A82]",
  "bg-[#FDF0ED] dark:bg-[#2a1712] text-[#B0492F]",
  "bg-[#F7F0E8] dark:bg-[#17233d] text-[#A0582A]",
  "bg-[#E8EEF7] dark:bg-[#111a2e] text-[#3F6AB0]",
  "bg-[#EFEFEF] dark:bg-[#17233d] text-[#5C5C5C] dark:text-[#9fb0cc]",
];

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Los días vacíos no existen en `tasks`; se recuerdan por dispositivo para sobrevivir al reload
function plannerDaysKey(projectId: string): string {
  return `kokistyle-planner-days:${projectId}`;
}

function loadStoredDayDates(projectId: string): string[] {
  try {
    const raw = localStorage.getItem(plannerDaysKey(projectId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === "string") : [];
  } catch {
    return [];
  }
}

function storeDayDates(projectId: string, dates: string[]) {
  try {
    localStorage.setItem(plannerDaysKey(projectId), JSON.stringify(dates));
  } catch { /* storage lleno o bloqueado — no crítico */ }
}

function weekendKind(iso: string): "sat" | "sun" | null {
  if (!iso) return null;
  const day = new Date(iso + "T00:00:00").getDay();
  return day === 6 ? "sat" : day === 0 ? "sun" : null;
}

// Colores elegidos para secciones custom — no hay columna en DB, se recuerdan por dispositivo
function plannerColorsKey(projectId: string): string {
  return `kokistyle-planner-colors:${projectId}`;
}

function loadStoredTagColors(projectId: string): Record<string, number> {
  try {
    const parsed = JSON.parse(localStorage.getItem(plannerColorsKey(projectId)) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function storeTagColor(projectId: string, tag: string, styleIdx: number) {
  try {
    localStorage.setItem(
      plannerColorsKey(projectId),
      JSON.stringify({ ...loadStoredTagColors(projectId), [tag]: styleIdx })
    );
  } catch { /* no crítico */ }
}

// Fallback determinístico: misma sección → mismo color en cualquier dispositivo
function hashTagStyleIdx(tag: string): number {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return h % TAG_STYLES.length;
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
          days: 1,
          dayIndex: null,
          taskId: null,
          isCustom: false,
          assignedContactId: null,
          done: false,
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
        days: 1,
        dayIndex: null,
        taskId: null,
        isCustom: false,
        assignedContactId: null,
        done: false,
      });
    }
  });
  return out;
}

// ─── Draggable card ───────────────────────────────────────────────────────────

function ItemCard({
  item, overlay, EN, contacts, onAssign, days, onJumpToDay, onEdit, onToggleDone,
}: {
  item: PlanItem;
  overlay?: boolean;
  EN?: boolean;
  contacts?: PlanContact[];
  onAssign?: (itemId: string, contactId: string | null) => void;
  days?: { index: number; label: string; date: string }[];
  onJumpToDay?: (itemId: string, dayIndex: number | null) => void;
  onEdit?: (itemId: string, patch: Partial<Pick<PlanItem, "description" | "hours" | "amount" | "days">>) => void;
  onToggleDone?: (itemId: string, done: boolean) => void;
}) {
  // El overlay usa un id propio para no colisionar con el sortable real durante el arrastre
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: overlay ? `${item.id}__ov` : item.id });
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const style = !overlay && transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)`, transition }
    : undefined;

  const assignedName    = contacts?.find(c => c.id === item.assignedContactId)?.name;
  const currentDay      = days?.find(d => d.index === item.dayIndex);
  const currentDayLabel = currentDay?.label ?? "";
  const canExpand       = !overlay;

  const handleDateChange = useCallback((selectedDate: string) => {
    if (!selectedDate || !days || !onJumpToDay) return;
    const exact = days.find(d => d.date === selectedDate);
    if (exact) { onJumpToDay(item.id, exact.index); return; }
    // Snap to nearest configured day
    const selMs = new Date(selectedDate + "T00:00:00").getTime();
    let best = days[0]; let minDiff = Infinity;
    for (const d of days) {
      if (!d.date) continue;
      const diff = Math.abs(new Date(d.date + "T00:00:00").getTime() - selMs);
      if (diff < minDiff) { minDiff = diff; best = d; }
    }
    if (best) onJumpToDay(item.id, best.index);
  }, [days, item.id, onJumpToDay]);

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      className={`touch-none select-none rounded-lg border bg-white dark:bg-[#111a2e] transition
        ${overlay ? "shadow-xl border-[var(--accent)]" : "border-[#E6DDCB] dark:border-[#22304d] hover:border-[var(--accent)]/50 hover:shadow-sm"}
        ${isDragging && !overlay ? "opacity-25" : ""}`}
    >
      {/* ── Fila compacta (una línea): grip arrastra · resto expande ── */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <span
          {...(overlay ? {} : attributes)}
          {...(overlay ? {} : listeners)}
          className={`shrink-0 leading-none text-[#C6BCA6] ${overlay ? "cursor-grabbing" : "cursor-grab active:cursor-grabbing hover:text-[var(--accent)]"}`}
          aria-label={EN ? "Drag to reorder" : "Arrastrar para reordenar"}
        >
          ⋮⋮
        </span>

        <input
          type="checkbox"
          checked={item.done}
          disabled={overlay || !onToggleDone}
          onChange={e => onToggleDone?.(item.id, e.target.checked)}
          onPointerDown={e => e.stopPropagation()}
          className="size-3.5 shrink-0 cursor-pointer accent-[#4F8A63]"
          aria-label={EN ? "Mark completed" : "Marcar completada"}
        />

        <button
          type="button"
          onClick={() => canExpand && setOpen(o => !o)}
          disabled={!canExpand}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${item.done ? "opacity-50" : ""} ${item.tagStyle}`}>
            {item.sectionTag}
          </span>
          <span className={`min-w-0 flex-1 truncate text-[11px] font-medium leading-tight ${item.done ? "text-[#8A9B8E] line-through" : "text-[var(--brand)]"}`}>
            {item.description}
          </span>
          <span className="shrink-0 font-mono text-[9px] text-[#5C6A6E] dark:text-[#9fb0cc]">{item.hours}h</span>
          {item.days > 1 && (
            <span className="shrink-0 rounded-full bg-[var(--accent)]/12 px-1.5 text-[8.5px] font-bold text-[var(--accent)]">{item.days}d</span>
          )}
          {item.taskId && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#4F8A63]" aria-label="saved" />
          )}
          {canExpand && (
            <span className={`shrink-0 text-[9px] text-[#9A907C] transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
          )}
        </button>
      </div>

      {/* ── Acordeón: detalle editable ── */}
      {canExpand && open && (
        <div
          className="space-y-2 border-t border-[#F0EBE0] dark:border-[#22304d] px-2 pb-2 pt-2"
          onPointerDown={e => e.stopPropagation()}
        >
          {item.isCustom && (
            <span className="inline-block rounded-full bg-[#EDE3CF] dark:bg-[#17233d] px-1.5 py-0.5 text-[8px] font-bold text-[#7A6230]">
              custom
            </span>
          )}

          {/* Descripción editable */}
          {onEdit && (
            <label className="block">
              <span className="mb-0.5 block text-[8px] font-bold uppercase tracking-wide text-[#9A907C]">
                {EN ? "Description" : "Descripción"}
              </span>
              <textarea
                value={item.description}
                onChange={e => onEdit(item.id, { description: e.target.value })}
                rows={2}
                className="w-full resize-none rounded-md border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-1.5 py-1 text-[11px] leading-tight text-[var(--brand)] outline-none focus:border-[var(--accent)]"
              />
            </label>
          )}

          {/* Horas + Días + Monto */}
          {onEdit && (
            <div className="flex gap-2">
              <label className="flex-1">
                <span className="mb-0.5 block text-[8px] font-bold uppercase tracking-wide text-[#9A907C]">
                  {EN ? "Hours" : "Horas"}
                </span>
                <input
                  type="number" min={0} step={0.5}
                  value={item.hours}
                  onChange={e => onEdit(item.id, { hours: Number(e.target.value) || 0 })}
                  className="w-full rounded-md border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-1.5 py-1 text-[11px] text-[var(--brand)] outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="w-14 shrink-0">
                <span className="mb-0.5 block text-[8px] font-bold uppercase tracking-wide text-[#9A907C]">
                  {EN ? "Days" : "Días"}
                </span>
                <input
                  type="number" min={1} step={1}
                  value={item.days}
                  onChange={e => onEdit(item.id, { days: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                  className="w-full rounded-md border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-1.5 py-1 text-[11px] text-[var(--brand)] outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="flex-1">
                <span className="mb-0.5 block text-[8px] font-bold uppercase tracking-wide text-[#9A907C]">
                  {EN ? "Amount" : "Monto"}
                </span>
                <input
                  type="number" min={0} step={1}
                  value={item.amount}
                  onChange={e => onEdit(item.id, { amount: Number(e.target.value) || 0 })}
                  className="w-full rounded-md border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-1.5 py-1 text-[11px] text-[var(--brand)] outline-none focus:border-[var(--accent)]"
                />
              </label>
            </div>
          )}
          {onEdit && item.days > 1 && (
            <p className="text-[9px] font-semibold text-[var(--accent)]">
              {EN ? `Spans ${item.days} days · ${(item.hours / item.days).toFixed(1)}h/day` : `Ocupa ${item.days} días · ${(item.hours / item.days).toFixed(1)}h/día`}
            </p>
          )}

          {/* Día programado */}
          {days && days.length > 0 && onJumpToDay && (
            <div>
              <span className="mb-0.5 block text-[8px] font-bold uppercase tracking-wide text-[#9A907C]">
                {EN ? "Day" : "Día"}
              </span>
              <button
                type="button"
                onClick={() => {
                  try { dateInputRef.current?.showPicker(); }
                  catch { dateInputRef.current?.click(); }
                }}
                className={`flex w-full items-center gap-1 rounded-md border px-1.5 py-1 text-left text-[10px] font-semibold transition
                  ${item.dayIndex !== null ? "border-[#CFE3D2] bg-[#F2F8F3] dark:bg-[#14261c] text-[#4F8A63]" : "border-[#F0D9D2] bg-[#FDF5F3] dark:bg-[#2a1712] text-[#B0492F] hover:text-[var(--brand)]"}`}
              >
                <span>{item.dayIndex !== null ? "✓" : "📅"}</span>
                <span className="truncate">
                  {item.dayIndex !== null ? currentDayLabel : (EN ? "Add to day..." : "Agregar a día...")}
                </span>
              </button>
              <input
                ref={dateInputRef}
                type="date"
                value={currentDay?.date ?? ""}
                min={days[0]?.date ?? ""}
                max={days[days.length - 1]?.date ?? ""}
                onChange={e => handleDateChange(e.target.value)}
                className="pointer-events-none h-0 w-0 opacity-0"
              />
            </div>
          )}

          {/* Asignación de co-worker */}
          {contacts && contacts.length > 0 && onAssign && (
            <div>
              <span className="mb-0.5 block text-[8px] font-bold uppercase tracking-wide text-[#9A907C]">
                {EN ? "Assignee" : "Asignado"}
              </span>
              <select
                value={item.assignedContactId ?? ""}
                onChange={e => onAssign(item.id, e.target.value || null)}
                className="w-full rounded-md border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-1.5 py-1 text-[11px] font-semibold text-[var(--accent)] outline-none focus:border-[var(--accent)]"
              >
                <option value="">{EN ? "Own team" : "Equipo propio"}</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {assignedName && (
                <span className="mt-0.5 block truncate text-[9px] text-[#5C6A6E] dark:text-[#9fb0cc]">{assignedName}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Pool ─────────────────────────────────────────────────────────────────────

function ItemPool({
  items, EN, onAddCustom, contacts, onAssign, days, onJumpToDay, onEdit, onToggleDone,
}: {
  items: PlanItem[];
  EN: boolean;
  onAddCustom: () => void;
  contacts: PlanContact[];
  onAssign: (itemId: string, contactId: string | null) => void;
  days: { index: number; label: string; date: string }[];
  onJumpToDay: (itemId: string, dayIndex: number | null) => void;
  onEdit: (itemId: string, patch: Partial<Pick<PlanItem, "description" | "hours" | "amount" | "days">>) => void;
  onToggleDone: (itemId: string, done: boolean) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "pool" });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[100px] flex-col gap-2 rounded-xl border-2 border-dashed p-2 transition
        ${isOver ? "border-[var(--accent)] bg-[#EDF3FB] dark:bg-[#111a2e]" : "border-[#D7CBB3] dark:border-[#2c3c5e] bg-[#FDFAF6] dark:bg-[#111a2e]"}`}
    >
      <button
        onClick={onAddCustom}
        className="flex items-center justify-center gap-1 rounded-xl border border-dashed border-[#D7CBB3] dark:border-[#2c3c5e] py-1.5 text-[10px] font-semibold text-[#5C6A6E] dark:text-[#9fb0cc] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        <Plus size={10} /> {EN ? "Add custom item" : "Agregar item"}
      </button>
      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-4 text-[11px] text-[#5C6A6E] dark:text-[#9fb0cc]">
          ✓ {EN ? "All items scheduled" : "Todos los items asignados"}
        </div>
      ) : (
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map(i => (
            <ItemCard
              key={i.id}
              item={i}
              EN={EN}
              contacts={contacts}
              onAssign={onAssign}
              days={days}
              onJumpToDay={onJumpToDay}
              onEdit={onEdit}
              onToggleDone={onToggleDone}
            />
          ))}
        </SortableContext>
      )}
    </div>
  );
}

// ─── Day column ───────────────────────────────────────────────────────────────

function DayColumn({
  day, items, ghosts, used, capacity, date, EN, onDateChange, contacts, onAssign, days, onJumpToDay, onEdit, onToggleDone,
}: {
  day: number;
  items: PlanItem[];
  ghosts: PlanItem[];          // tareas multi-día que continúan en este día (no arrancan aquí)
  used: number;                // horas usadas ya repartidas por día (span)
  capacity: number;
  date: string;
  EN: boolean;
  onDateChange: (iso: string) => void;
  contacts: PlanContact[];
  onAssign: (itemId: string, contactId: string | null) => void;
  days: { index: number; label: string; date: string }[];
  onJumpToDay: (itemId: string, dayIndex: number | null) => void;
  onEdit: (itemId: string, patch: Partial<Pick<PlanItem, "description" | "hours" | "amount" | "days">>) => void;
  onToggleDone: (itemId: string, done: boolean) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` });
  const dateRef = useRef<HTMLInputElement>(null);
  const pct = capacity > 0 ? Math.min((used / capacity) * 100, 100) : 0;
  const over = used > capacity;

  // Sáb/dom con color diferenciador (azul/naranja); con tareas el fondo baja a gris suave pero el acento persiste
  const wk = weekendKind(date);
  const headerCls = wk === "sat"
    ? "border-[#9DC3E6] bg-[#EAF3FA] dark:bg-[#111a2e]"
    : wk === "sun"
    ? "border-[#F4B183] bg-[#FDF1E7]"
    : "border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e]";
  const dropCls = isOver
    ? "border-[var(--accent)] bg-[#EDF3FB] dark:bg-[#111a2e]"
    : items.length
    ? wk === "sat"
      ? "border-[#9DC3E6]/70 bg-[#F0F2F4]"
      : wk === "sun"
      ? "border-[#F4B183]/70 bg-[#F4F1EE]"
      : "border-transparent bg-[#F7F3EA] dark:bg-[#0b1220]"
    : wk === "sat"
    ? "border-[#9DC3E6] bg-[#D9EAF7]"
    : wk === "sun"
    ? "border-[#F4B183] bg-[#FBE3D2]"
    : "border-[#D7CBB3] dark:border-[#2c3c5e]";

  return (
    <div className="flex w-[240px] shrink-0 flex-col gap-2">
      {/* Header */}
      <div className={`rounded-xl border px-3 py-2.5 ${headerCls}`}>
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-bold text-[var(--brand)]">
            {EN ? `Day ${day + 1}` : `Día ${day + 1}`}
            {wk && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase ${wk === "sat" ? "bg-[#9DC3E6]/40 text-[#2E5E8C]" : "bg-[#F4B183]/40 text-[#9C5221]"}`}>
                {wk === "sat" ? (EN ? "Sat" : "Sáb") : (EN ? "Sun" : "Dom")}
              </span>
            )}
          </span>
          <span className={`text-[10px] font-semibold ${over ? "text-[#B0492F]" : "text-[#5C6A6E] dark:text-[#9fb0cc]"}`}>
            {Number.isInteger(used) ? used : used.toFixed(1)}h / {capacity}h
          </span>
        </div>

        {/* Date picker row — toca para poner el día real (cualquier fecha) */}
        <div className="mt-1.5 flex items-center gap-1.5">
          <CalendarDays size={11} className="shrink-0 text-[#5C6A6E] dark:text-[#9fb0cc]" />
          <button
            type="button"
            onClick={() => { try { dateRef.current?.showPicker(); } catch { dateRef.current?.click(); } }}
            title={EN ? "Set the real work date" : "Poner la fecha real de trabajo"}
            className="flex flex-1 items-center gap-1 text-left text-[10px] font-semibold text-[var(--accent)] underline decoration-dotted underline-offset-2"
          >
            {date ? formatDate(date, EN) : (EN ? "Pick date" : "Seleccionar fecha")}
            <Pencil size={9} className="opacity-70" />
          </button>
          <input
            ref={dateRef}
            type="date"
            value={date}
            onChange={e => onDateChange(e.target.value)}
            className="pointer-events-none absolute h-0 w-0 opacity-0"
            tabIndex={-1}
            aria-hidden
          />
        </div>

        {/* Capacity bar */}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E6DDCB] dark:bg-[#17233d]">
          <div
            className={`h-full rounded-full transition-all ${over ? "bg-[#B0492F]" : pct > 79 ? "bg-[#E8A44A]" : "bg-[#4F8A63]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex min-h-[150px] flex-col gap-2 rounded-xl border-2 border-dashed p-2 transition ${dropCls}`}
      >
        {/* Continuación de tareas multi-día (no draggable, solo referencia) */}
        {ghosts.map(g => {
          const partOf = g.dayIndex !== null ? day - g.dayIndex + 1 : 0;
          return (
            <div key={`ghost-${g.id}`} className="flex items-center gap-2 rounded-lg border border-dashed border-[#D7CBB3] dark:border-[#2c3c5e] bg-[#F7F3EA]/60 dark:bg-[#0b1220]/60 px-2 py-1.5 text-[10px] text-[#97A1A0] dark:text-[#728098]">
              <span className="shrink-0">↳</span>
              <span className="truncate font-semibold">{g.description}</span>
              <span className="ml-auto shrink-0 font-mono">{(g.hours / g.days).toFixed(1)}h · {partOf}/{g.days}</span>
            </div>
          );
        })}
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map(i => (
            <ItemCard
              key={i.id}
              item={i}
              EN={EN}
              contacts={contacts}
              onAssign={onAssign}
              days={days}
              onJumpToDay={onJumpToDay}
              onEdit={onEdit}
              onToggleDone={onToggleDone}
            />
          ))}
        </SortableContext>
        {items.length === 0 && ghosts.length === 0 && (
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
      <span className="text-[9px] uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-5 w-5 items-center justify-center rounded text-sm text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]"
        >−</button>
        <span className="w-6 text-center text-[12px] font-bold text-[var(--brand)]">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-5 w-5 items-center justify-center rounded text-sm text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]"
        >+</button>
      </div>
    </div>
  );
}

// ─── Custom item form ─────────────────────────────────────────────────────────

const NEW_SECTION = "__new__";

function CustomItemForm({
  EN, onAdd, onCancel, sections, contacts, days,
}: {
  EN: boolean;
  onAdd: (item: {
    description: string; sectionTag: string; tagStyle: string; isNewSection: boolean;
    hours: number; amount: number; dayIndex: number | null; assignedContactId: string | null;
  }) => void;
  onCancel: () => void;
  sections: { tag: string; style: string }[];
  contacts: PlanContact[];
  days: { index: number; label: string; date: string }[];
}) {
  const usedStyles    = useMemo(() => new Set(sections.map(s => s.style)), [sections]);
  const freeStyles    = useMemo(() => TAG_STYLES.filter(s => !usedStyles.has(s)), [usedStyles]);
  const [desc, setDesc]         = useState("");
  const [section, setSection]   = useState(sections[0]?.tag ?? NEW_SECTION);
  const [newTag, setNewTag]     = useState("");
  const [newStyle, setNewStyle] = useState(freeStyles[0] ?? TAG_STYLES[0]);
  const [hours, setHours]       = useState(2);
  const [amount, setAmount]     = useState(0);
  const [dayIndex, setDayIndex] = useState<number | null>(null);
  const [assignee, setAssignee] = useState<string | null>(null);

  const isNew        = section === NEW_SECTION;
  const resolvedTag  = isNew ? newTag.trim() : section;
  const resolvedStyle = isNew
    ? newStyle
    : sections.find(s => s.tag === section)?.style ?? TAG_STYLES[0];
  const canAdd = desc.trim().length > 0 && resolvedTag.length > 0;

  const inputCls = "w-full rounded-lg border border-[#D7CBB3] dark:border-[#2c3c5e] bg-[#F7F3EA] dark:bg-[#0b1220] px-2 py-1.5 text-[11px] text-[var(--brand)] focus:border-[var(--accent)] focus:outline-none";
  const labelCls = "mb-1 block text-[9px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]";

  return (
    <div className="rounded-xl border border-[var(--accent)] bg-white dark:bg-[#111a2e] p-3 shadow-md">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--accent)]">
        {EN ? "New custom item" : "Nuevo item personalizado"}
      </div>

      <label className="mb-2 block">
        <span className={labelCls}>{EN ? "Description" : "Descripción"}</span>
        <textarea
          autoFocus
          rows={2}
          placeholder={EN ? "e.g. Install fan extractor" : "ej. Instalar extractor"}
          value={desc}
          onChange={e => setDesc(e.target.value)}
          className={`${inputCls} resize-none`}
        />
      </label>

      <label className="mb-2 block">
        <span className={labelCls}>{EN ? "Section" : "Sección"}</span>
        <select value={section} onChange={e => setSection(e.target.value)} className={inputCls}>
          {sections.map(s => (
            <option key={s.tag} value={s.tag}>{s.tag}</option>
          ))}
          <option value={NEW_SECTION}>＋ {EN ? "New section…" : "Nueva sección…"}</option>
        </select>
      </label>

      {isNew ? (
        <div className="mb-2 rounded-lg border border-dashed border-[#D7CBB3] dark:border-[#2c3c5e] p-2">
          <input
            placeholder={EN ? "Section name (e.g. Permits)" : "Nombre de sección (ej. Permisos)"}
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            className={`${inputCls} mb-2`}
          />
          <span className={labelCls}>{EN ? "Color" : "Color"}</span>
          <div className="flex flex-wrap gap-1.5">
            {(freeStyles.length > 0 ? freeStyles : TAG_STYLES).map(style => (
              <button
                key={style}
                type="button"
                onClick={() => setNewStyle(style)}
                className={`rounded-full px-2 py-0.5 text-[9px] font-bold transition ${style}
                  ${newStyle === style ? "ring-2 ring-[var(--accent)] ring-offset-1" : "opacity-70 hover:opacity-100"}`}
              >
                {newTag.trim() || "Aa"}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-2">
          <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ${resolvedStyle}`}>
            {resolvedTag}
          </span>
        </div>
      )}

      <div className="mb-2 flex gap-2">
        <label className="flex-1">
          <span className={labelCls}>{EN ? "Hours" : "Horas"}</span>
          <input
            type="number" min={1} max={24}
            value={hours}
            onChange={e => setHours(Math.max(1, Number(e.target.value)))}
            className={inputCls}
          />
        </label>
        <label className="flex-1">
          <span className={labelCls}>{EN ? "Amount ($)" : "Monto ($)"}</span>
          <input
            type="number" min={0}
            value={amount}
            onChange={e => setAmount(Math.max(0, Number(e.target.value)))}
            className={inputCls}
          />
        </label>
      </div>

      <label className="mb-2 block">
        <span className={labelCls}>{EN ? "Day" : "Día"}</span>
        <select
          value={dayIndex === null ? "" : String(dayIndex)}
          onChange={e => setDayIndex(e.target.value === "" ? null : Number(e.target.value))}
          className={inputCls}
        >
          <option value="">{EN ? "Pool (no day yet)" : "Pool (sin día aún)"}</option>
          {days.map(d => (
            <option key={d.index} value={d.index}>{d.label}</option>
          ))}
        </select>
      </label>

      {contacts.length > 0 && (
        <label className="mb-2 block">
          <span className={labelCls}>{EN ? "Assignee" : "Asignado"}</span>
          <select
            value={assignee ?? ""}
            onChange={e => setAssignee(e.target.value || null)}
            className={inputCls}
          >
            <option value="">{EN ? "Own team" : "Equipo propio"}</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      )}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg bg-[#ECE3D1] dark:bg-[#17233d] py-1.5 text-[10px] font-bold text-[#5C6A6E] dark:text-[#9fb0cc]"
        >
          {EN ? "Cancel" : "Cancelar"}
        </button>
        <button
          onClick={() => {
            if (!canAdd) return;
            onAdd({
              description: desc.trim(),
              sectionTag: resolvedTag,
              tagStyle: resolvedStyle,
              isNewSection: isNew,
              hours,
              amount,
              dayIndex,
              assignedContactId: assignee,
            });
          }}
          disabled={!canAdd}
          className="flex-1 rounded-lg bg-[var(--accent)] py-1.5 text-[10px] font-bold text-white disabled:opacity-40"
        >
          {EN ? "Add item" : "Agregar item"}
        </button>
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function DayPlannerModal({
  estimate,
  projectId,
  projectStart,
  onClose,
  onGenerated,
  toast,
  embedded = false,
}: {
  estimate: EstimateForPlanner;
  projectId: string;
  projectStart?: string | null;   // fecha real de inicio del proyecto (base de los días)
  onClose: () => void;
  onGenerated: () => void;
  toast: (msg: string) => void;
  embedded?: boolean;
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
  const [contacts, setContacts] = useState<PlanContact[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const COL_STEP = 208; // column width (196) + gap (12)
  const scrollCols = (dir: 1 | -1) =>
    scrollRef.current?.scrollBy({ left: dir * COL_STEP * 2, behavior: "smooth" });

  const estimateRef = useRef(estimate);
  const ENRef       = useRef(EN);
  estimateRef.current = estimate;
  ENRef.current       = EN;

  // ── Load existing tasks on mount ────────────────────────────────────────────
  useEffect(() => {
    let alive = true;

    const init = async () => {
      const [{ data: existingTasks }, { data: projectContacts }] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, source_key, scheduled_date, name, hours, amount, duration_days, source, source_section, estimate_item_id, estimate_section_id, assigned_contact_id, sort_order, status")
          .eq("project_id", projectId)
          .or("source.eq.estimate,source.eq.planner")
          .order("sort_order", { ascending: true }),
        supabase
          .from("project_contacts")
          .select("contacts(id, name)")
          .eq("project_id", projectId),
      ]);

      if (!alive) return;

      const tasks = existingTasks ?? [];
      const loadedContacts: PlanContact[] = (projectContacts ?? [])
        .map(pc => (pc as unknown as { contacts: PlanContact }).contacts)
        .filter(Boolean);
      setContacts(loadedContacts);

      // Días = fechas con tareas ∪ fechas configuradas en este dispositivo (días vacíos incluidos)
      const scheduledDates = tasks
        .filter(t => t.scheduled_date)
        .map(t => t.scheduled_date as string);
      const allDates = [...new Set([...scheduledDates, ...loadStoredDayDates(projectId)])].sort();

      const newNumDays = Math.max(4, allDates.length);

      // Build dayDates: primero las fechas existentes; el resto se rellena.
      const newDayDates: Record<number, string> = {};
      allDates.forEach((d, i) => { newDayDates[i] = d; });
      if (allDates.length > 0) {
        // Continúa consecutivo tras la última fecha existente
        const fillBase = allDates[allDates.length - 1];
        for (let i = allDates.length; i < newNumDays; i++) {
          newDayDates[i] = addDaysStr(fillBase, i - allDates.length + 1);
        }
      } else {
        // Planner nuevo: arranca en la fecha REAL de inicio del proyecto (día 1 = inicio),
        // no en el futuro. Cada día es editable a cualquier fecha (fines de semana, no consecutivos).
        const base = projectStart || todayIso();
        for (let i = 0; i < newNumDays; i++) {
          newDayDates[i] = addDaysStr(base, i);
        }
      }

      // date → day index
      const dateToIdx = new Map(allDates.map((d, i) => [d, i]));

      // Build map: source_key → task row
      const taskByKey = new Map(tasks.map(t => [t.source_key as string, t]));

      // Estimate items with pre-assignment
      const estimateItems = buildEstimateItems(estimateRef.current, ENRef.current).map(item => {
        const task = taskByKey.get(item.sourceKey);
        if (!task) return item;
        return {
          ...item,
          taskId: task.id as string,
          days: (task.duration_days as number) ?? item.days,
          dayIndex: task.scheduled_date ? (dateToIdx.get(task.scheduled_date as string) ?? null) : null,
          assignedContactId: (task.assigned_contact_id as string | null) ?? null,
          done: task.status === "done",
        };
      });

      // Custom planner items (source = 'planner') — color: sección del estimate > color elegido > hash
      const storedColors = loadStoredTagColors(projectId);
      const tagStyleOf = (tag: string): string => {
        const fromEstimate = estimateItems.find(i => i.sectionTag === tag)?.tagStyle;
        if (fromEstimate) return fromEstimate;
        const idx = storedColors[tag];
        return TAG_STYLES[typeof idx === "number" ? Math.abs(idx) % TAG_STYLES.length : hashTagStyleIdx(tag)];
      };
      const customItems: PlanItem[] = tasks
        .filter(t => t.source === "planner")
        .map(t => ({
          id: `planner-${t.id}`,
          estimateSectionId: (t.estimate_section_id as string | null) ?? null,
          estimateItemId: (t.estimate_item_id as string | null) ?? null,
          sourceKey: (t.source_key as string) ?? `planner-custom:${t.id}`,
          sectionTag: (t.source_section as string) ?? "Custom",
          tagStyle: tagStyleOf((t.source_section as string) ?? "Custom"),
          description: t.name as string,
          amount: (t.amount as number) ?? 0,
          hours: (t.hours as number) ?? 2,
          days: (t.duration_days as number) ?? 1,
          dayIndex: t.scheduled_date ? (dateToIdx.get(t.scheduled_date as string) ?? null) : null,
          taskId: t.id as string,
          isCustom: true,
          assignedContactId: (t.assigned_contact_id as string | null) ?? null,
          done: t.status === "done",
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
    if (n < numDays) {
      // Items de días recortados vuelven al pool — si conservaran el dayIndex huérfano se grabarían sin fecha
      setItems(prev => prev.map(i => (i.dayIndex !== null && i.dayIndex >= n) ? { ...i, dayIndex: null } : i));
    }
    setDayDates(prev => {
      const next: Record<number, string> = {};
      const used = new Set<string>();
      for (let i = 0; i < n; i++) {
        if (prev[i]) { next[i] = prev[i]; used.add(prev[i]); }
      }
      // Días nuevos: continuar después de la última fecha, saltando duplicados —
      // el reload reconstruye los días desde fechas ÚNICAS, así que dos días con la misma fecha se fusionan
      let cursor = [...used].sort().pop() ?? todayIso();
      for (let i = 0; i < n; i++) {
        if (next[i]) continue;
        do { cursor = addDaysStr(cursor, 1); } while (used.has(cursor));
        next[i] = cursor;
        used.add(cursor);
      }
      return next;
    });
  };

  const setDayDate = useCallback((day: number, iso: string) => {
    const taken = Object.entries(dayDates).some(([k, v]) => Number(k) !== day && v === iso);
    if (taken) {
      toast(EN ? "Another day already has that date" : "Otro día ya tiene esa fecha");
      return;
    }
    setDayDates(prev => ({ ...prev, [day]: iso }));
  }, [dayDates, EN, toast]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const poolItems  = useMemo(() => items.filter(i => i.dayIndex === null), [items]);
  const getDay     = useCallback((d: number) => items.filter(i => i.dayIndex === d), [items]);
  // Multi-día: una tarea de N días ocupa N columnas desde su día; reparte horas/N por día
  const coversDay  = (i: PlanItem, d: number) => i.dayIndex !== null && i.dayIndex <= d && d <= i.dayIndex + Math.max(1, i.days) - 1;
  const ghostsFor  = useCallback((d: number) => items.filter(i => coversDay(i, d) && i.dayIndex !== d), [items]);
  const usedFor    = useCallback((d: number) => items.reduce((s, i) => s + (coversDay(i, d) ? i.hours / Math.max(1, i.days) : 0), 0), [items]);
  const activeItem = useMemo(() => items.find(i => i.id === activeId), [items, activeId]);

  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(active.id as string);
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over) return;
    const activeId = active.id as string;
    const overId   = over.id as string;
    if (activeId === overId) return;

    setItems(prev => {
      const activeIdx = prev.findIndex(i => i.id === activeId);
      if (activeIdx === -1) return prev;

      // Contenedor destino: un día vacío/pool (id = "pool"/"day-N") o el día del item sobre el que se soltó
      let newDay: number | null;
      let overIdx: number;
      if (overId === "pool") { newDay = null; overIdx = prev.length; }
      else if (overId.startsWith("day-")) { newDay = parseInt(overId.replace("day-", ""), 10); overIdx = prev.length; }
      else {
        const overItem = prev.find(i => i.id === overId);
        if (!overItem) return prev;
        newDay = overItem.dayIndex;
        overIdx = prev.findIndex(i => i.id === overId);
      }

      // Aplica el día destino y reordena la lista global (el orden relativo dentro del día = orden de la lista)
      const updated = prev.map(i => i.id === activeId ? { ...i, dayIndex: newDay } : i);
      return arrayMove(updated, activeIdx, overIdx);
    });
  };

  // ── Phase-ordered + even-spread auto-assign ─────────────────────────────────
  const autoAssign = () => {
    setItems(prev => {
      const phaseOf = (item: PlanItem): number => {
        const tag = (item.sectionTag || "").toUpperCase();
        const desc = (item.description || "").toUpperCase();
        if (tag.includes("MATERIAL") || desc.startsWith("COMPRA") || desc.startsWith("BUY") || desc.startsWith("PURCHASE")) return 0;
        if (tag.includes("DEMOLIT") || tag.includes("DEMOLICI")) return 1;
        if (tag.includes("STRUCT") || tag.includes("ESTRUCTURA")) return 2;
        if (tag.includes("PLUMB") || tag.includes("PLOMER")) return 3;
        if (tag.includes("ELECTR")) return 4;
        if (tag.includes("TILE") || tag.includes("INSTALACI") || tag.includes("FLOOR") || tag.includes("PISO")) return 5;
        if (tag.includes("HANDY") || tag.includes("TRABAJO")) return 6;
        if (tag.includes("PAINT") || tag.includes("PINTURA")) return 7;
        return 8;
      };
      const sorted = [...prev].sort((a, b) => {
        const pa = phaseOf(a), pb = phaseOf(b);
        return pa !== pb ? pa - pb : b.hours - a.hours;
      });
      const targetPerDay = Math.max(1, Math.ceil(sorted.length / numDays));
      const counts = Array<number>(numDays).fill(0);
      const usage = Array<number>(numDays).fill(0);
      let currentDay = 0;
      let lastPhase = -1;
      return sorted.map(item => {
        const phase = phaseOf(item);
        if (phase !== lastPhase && lastPhase !== -1 && counts[currentDay] > 0) {
          if (currentDay < numDays - 1) currentDay++;
        }
        lastPhase = phase;
        while (
          currentDay < numDays - 1 &&
          (counts[currentDay] >= targetPerDay || usage[currentDay] + item.hours > dayCapacity)
        ) {
          currentDay++;
        }
        counts[currentDay]++;
        usage[currentDay] += item.hours;
        return { ...item, dayIndex: currentDay };
      });
    });
  };

  // ── Add custom item ──────────────────────────────────────────────────────────
  const addCustomItem = useCallback((fields: {
    description: string; sectionTag: string; tagStyle: string; isNewSection: boolean;
    hours: number; amount: number; dayIndex: number | null; assignedContactId: string | null;
  }) => {
    const uuid = crypto.randomUUID();
    const tag = fields.sectionTag || "Custom";
    if (fields.isNewSection) {
      storeTagColor(projectId, tag, Math.max(0, TAG_STYLES.indexOf(fields.tagStyle)));
    }
    const newItem: PlanItem = {
      id: `custom-new-${uuid}`,
      estimateSectionId: null,
      estimateItemId: null,
      sourceKey: `planner-custom:${uuid}`,
      sectionTag: tag,
      tagStyle: fields.tagStyle,
      description: fields.description,
      amount: fields.amount,
      hours: fields.hours,
      days: 1,
      dayIndex: fields.dayIndex,
      taskId: null,
      isCustom: true,
      assignedContactId: fields.assignedContactId,
      done: false,
    };
    setItems(prev => [newItem, ...prev]);
    setShowCustomForm(false);
  }, [projectId]);

  // ── Assign contact to item ───────────────────────────────────────────────────
  const handleAssign = useCallback((itemId: string, contactId: string | null) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, assignedContactId: contactId } : i));
  }, []);

  // ── Completado: reemplaza al Kanban del Workflow — persiste al instante si ya es task ──
  const handleToggleDone = useCallback((itemId: string, done: boolean) => {
    const target = items.find(i => i.id === itemId);
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, done } : i));
    if (target?.taskId) {
      supabase.from("tasks")
        .update({ status: done ? "done" : "pend" })
        .eq("id", target.taskId)
        .then(({ error }) => {
          if (error) toast(EN ? "Error updating status" : "Error al actualizar estado");
        });
    }
  }, [items, toast, EN]);

  // Secciones existentes (tag + color) para el combo del formulario custom
  const sectionOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const i of items) if (!seen.has(i.sectionTag)) seen.set(i.sectionTag, i.tagStyle);
    return [...seen.entries()].map(([tag, style]) => ({ tag, style }));
  }, [items]);

  // ── Jump item to specific day (or back to pool) from the card selector ────────
  const handleJumpToDay = useCallback((itemId: string, dayIndex: number | null) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, dayIndex } : i));
  }, []);

  // ── Inline edit of existing card fields (description / hours / amount) ────────
  const handleEdit = useCallback((itemId: string, patch: Partial<Pick<PlanItem, "description" | "hours" | "amount" | "days">>) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...patch } : i));
  }, []);

  // ── Day labels for the card selector ─────────────────────────────────────────
  const dayLabels = useMemo(() =>
    Array.from({ length: numDays }, (_, d) => ({
      index: d,
      date:  dayDates[d] ?? "",
      label: `Día ${d + 1}${dayDates[d] ? " · " + formatDate(dayDates[d], EN) : ""}`,
    })),
  [numDays, dayDates, EN]);

  // ── Save / Update ────────────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true);

    storeDayDates(projectId, Array.from({ length: numDays }, (_, i) => dayDates[i]).filter(Boolean));

    const assigned    = items.filter(i => i.dayIndex !== null);
    const unscheduled = items.filter(i => i.dayIndex === null && i.taskId !== null);

    // Posición de cada item DENTRO de su día (el orden de `items` ya refleja el drag & drop)
    const posInDay = new Map<string, number>();
    const dayCounters: Record<number, number> = {};
    for (const it of assigned) {
      const d = it.dayIndex ?? 0;
      const c = dayCounters[d] ?? 0;
      posInDay.set(it.id, c);
      dayCounters[d] = c + 1;
    }
    const orderOf = (it: PlanItem) => (it.dayIndex ?? 0) * 1000 + (posInDay.get(it.id) ?? 0);

    // New tasks to INSERT
    const toInsert = assigned
      .filter(i => !i.taskId)
      .map((item) => ({
        project_id:          projectId,
        name:                item.description,
        hours:               item.hours,
        duration_weeks:      1,
        duration_days:       Math.max(1, item.days),
        status:              item.done ? "done" : "pend",
        sort_order:          orderOf(item),
        assigned_contact_id: item.assignedContactId,
        scheduled_date:      dayDates[item.dayIndex ?? 0] ?? null,
        estimate_item_id:    item.estimateItemId,
        estimate_section_id: item.estimateSectionId,
        source:              item.isCustom ? "planner" : "estimate",
        source_key:          item.sourceKey,
        source_section:      item.sectionTag,
        amount:              item.amount,
      }));

    // Existing tasks to UPDATE (scheduled_date / assignee / order may have changed)
    const toUpdate = assigned
      .filter(i => i.taskId !== null)
      .map(item => ({
        id:                  item.taskId!,
        name:                item.description,
        hours:               item.hours,
        amount:              item.amount,
        duration_days:       Math.max(1, item.days),
        scheduled_date:      dayDates[item.dayIndex ?? 0] ?? null,
        sort_order:          orderOf(item),
        assigned_contact_id: item.assignedContactId,
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

    // UPDATE existing (scheduled_date, assignee, or sort_order changed)
    await Promise.all(
      toUpdate.map(u =>
        supabase.from("tasks").update({
          name:                u.name,
          hours:               u.hours,
          amount:              u.amount,
          scheduled_date:      u.scheduled_date,
          sort_order:          u.sort_order,
          assigned_contact_id: u.assigned_contact_id,
        }).eq("id", u.id)
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
  const doneCount      = items.filter(i => i.done).length;

  return (
    <div className={embedded
      ? "flex flex-col overflow-hidden rounded-[20px] border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EB] dark:bg-[#0b1220]"
      : "fixed inset-0 z-[300] flex flex-col bg-[#F7F3EB] dark:bg-[#0b1220]"
    }>

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#D5DEEF] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-4 py-3">
        {!embedded && (
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#5C6A6E] dark:text-[#9fb0cc] transition hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220] hover:text-[#B0492F]"
          >
            <X size={18} />
          </button>
        )}
        <div className="min-w-0">
          <div className="text-sm font-bold text-[var(--brand)]">
            {EN ? "Day Planner" : "Planificador por Día"}
          </div>
          <div className="text-[10px] text-[#5C6A6E] dark:text-[#9fb0cc]">
            {loading
              ? (EN ? "Loading…" : "Cargando…")
              : `${scheduledCount}/${items.length} ${EN ? "scheduled" : "asignados"} · ${savedCount} ${EN ? "saved" : "guardados"} · ${doneCount} ${EN ? "completed" : "completados"}`
            }
          </div>
        </div>

        <div className="flex-1" />

        {/* Config steppers */}
        <div className="flex items-center gap-4">
          <Stepper label={EN ? "Workers" : "Trabajadores"} value={workersPerDay} min={1} max={10} onChange={setWorkersPerDay} />
          <Stepper label={EN ? "Hrs/worker" : "Hrs/trab."}  value={hoursPerWorker} min={2} max={16} onChange={setHoursPerWorker} />
          <Stepper label={EN ? "Days" : "Días"}              value={numDays}        min={1} max={30} onChange={handleNumDaysChange} />
        </div>

        <div className="h-7 border-l border-[#E6DDCB] dark:border-[#22304d]" />

        <button
          onClick={autoAssign}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl bg-[#EDF3FB] dark:bg-[#111a2e] px-3 py-2 text-[12px] font-semibold text-[var(--accent)] transition hover:bg-[#D5DEEF] dark:hover:bg-[#111a2e] disabled:opacity-40"
        >
          <Zap size={12} /> {EN ? "Auto-assign" : "Auto-asignar"}
        </button>
      </div>

      {/* ── Main canvas ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center" style={{ minHeight: embedded ? "520px" : undefined }}>
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {/* En móvil se apila (pool arriba, días abajo) y la página hace el scroll; en lg vuelve al layout lado a lado */}
          <div className="flex flex-col gap-4 p-3 lg:min-h-0 lg:flex-1 lg:flex-row lg:overflow-y-hidden lg:p-4" style={{ minHeight: embedded ? "520px" : undefined }}>

            {/* Left: Pool */}
            <div className="flex w-full shrink-0 flex-col gap-2 lg:w-[280px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#5C6A6E] dark:text-[#9fb0cc]">
                  {EN ? "Item Pool" : "Pool de Items"}
                </span>
                {poolItems.length > 0 && (
                  <span className="rounded-full bg-[#EDE3CF] dark:bg-[#17233d] px-2 py-0.5 text-[10px] font-bold text-[#7A6230]">
                    {poolItems.length}
                  </span>
                )}
              </div>

              {showCustomForm ? (
                <CustomItemForm
                  EN={EN}
                  onAdd={addCustomItem}
                  onCancel={() => setShowCustomForm(false)}
                  sections={sectionOptions}
                  contacts={contacts}
                  days={dayLabels}
                />
              ) : null}

              <div className="max-h-[300px] overflow-y-auto pr-0.5 lg:max-h-none lg:min-h-0 lg:flex-1">
                <ItemPool
                  items={poolItems}
                  EN={EN}
                  onAddCustom={() => setShowCustomForm(true)}
                  contacts={contacts}
                  onAssign={handleAssign}
                  days={dayLabels}
                  onJumpToDay={handleJumpToDay}
                  onEdit={handleEdit}
                  onToggleDone={handleToggleDone}
                />
              </div>
            </div>

            {/* Right: Day columns */}
            <div className="flex min-h-0 flex-col gap-2 lg:flex-1 lg:overflow-y-hidden">
              <div className="flex shrink-0 items-center justify-between">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#5C6A6E] dark:text-[#9fb0cc]">
                    {EN ? "Schedule" : "Cronograma"} — {dayCapacity}h/{EN ? "day" : "día"} capacity
                  </span>
                  <p className="text-[10px] text-[#97A1A0] dark:text-[#728098]">
                    {EN
                      ? "Tap each date to set the real work day — any date works (past, weekends, non-consecutive)."
                      : "Toca la fecha de cada día para poner el día real de trabajo — vale cualquier fecha (pasadas, fines de semana, no consecutivas)."}
                  </p>
                </div>
                {numDays > 3 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => scrollCols(-1)}
                      className="grid size-6 place-items-center rounded-lg border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] text-[#5C6A6E] dark:text-[#9fb0cc] transition hover:bg-[#ECE3D1] dark:hover:bg-[#17233d] text-sm font-bold"
                    >‹</button>
                    <span className="px-1 text-[10px] font-semibold text-[#5C6A6E] dark:text-[#9fb0cc]">{numDays} {EN ? "days" : "días"}</span>
                    <button
                      onClick={() => scrollCols(1)}
                      className="grid size-6 place-items-center rounded-lg border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] text-[#5C6A6E] dark:text-[#9fb0cc] transition hover:bg-[#ECE3D1] dark:hover:bg-[#17233d] text-sm font-bold"
                    >›</button>
                  </div>
                )}
              </div>
              <div ref={scrollRef} className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
                {Array.from({ length: numDays }, (_, d) => (
                  <DayColumn
                    key={d}
                    day={d}
                    items={getDay(d)}
                    ghosts={ghostsFor(d)}
                    used={usedFor(d)}
                    capacity={dayCapacity}
                    date={dayDates[d] ?? ""}
                    EN={EN}
                    onDateChange={iso => setDayDate(d, iso)}
                    contacts={contacts}
                    onAssign={handleAssign}
                    days={dayLabels}
                    onJumpToDay={handleJumpToDay}
                    onEdit={handleEdit}
                    onToggleDone={handleToggleDone}
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
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border-t border-[#D5DEEF] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-4 py-2 text-[10px] text-[#5C6A6E] dark:text-[#9fb0cc]">
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
          {EN ? "green dot = saved · checkbox = completed" : "punto verde = guardada · checkbox = completada"}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-[#9DC3E6]" />
          {EN ? "Saturday" : "Sábado"}
          <span className="ml-1 inline-block h-2 w-2 rounded-sm bg-[#F4B183]" />
          {EN ? "Sunday" : "Domingo"}
        </span>
        <span className="ml-auto">
          {EN
            ? `Capacity: ${dayCapacity}h/day (${workersPerDay} workers × ${hoursPerWorker}h)`
            : `Capacidad: ${dayCapacity}h/día (${workersPerDay} trab. × ${hoursPerWorker}h)`}
        </span>
      </div>

      {/* Save flotante — accesible en cualquier momento */}
      {!loading && (
        <button
          onClick={save}
          disabled={saving}
          className="fixed bottom-24 right-6 z-[140] inline-flex items-center gap-2 rounded-full bg-[#B0492F] px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_rgba(176,73,47,0.45)] transition hover:bg-[#983c25] disabled:opacity-60"
          aria-label={EN ? "Save" : "Guardar"}
        >
          <Save size={16} />
          {saving ? "…" : EN ? `Save (${scheduledCount})` : `Guardar (${scheduledCount})`}
        </button>
      )}
    </div>
  );
}
