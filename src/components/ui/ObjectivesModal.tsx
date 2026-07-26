"use client";

import { useState } from "react";
import { X, Plus, Target, Trash2, GripVertical } from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/src/lib/supabase";
import { useLanguage } from "@/src/context/LanguageContext";
import type { ProjectObjective } from "@/src/types/project";

type Row = { key: string; id?: string; text: string };
let _uid = 0;
const uid = () => `new-${Date.now()}-${_uid++}`;

// Modal para agregar / editar / eliminar / reordenar objetivos de un proyecto. Guarda
// con diff (preserva `done` e ids de los existentes; borra los quitados; inserta nuevos;
// sort_order = índice tras el arrastre).
export default function ObjectivesModal({
  projectId, projectTitle, initial, onSaved, onClose, toast,
}: {
  projectId: string;
  projectTitle: string;
  initial: ProjectObjective[];
  onSaved: () => void;
  onClose: () => void;
  toast: (m: string) => void;
}) {
  const { t } = useLanguage();
  const tc = t.panel.objectives;
  const [rows, setRows] = useState<Row[]>(
    initial.length ? initial.map(o => ({ key: o.id, id: o.id, text: o.text })) : [{ key: uid(), text: "" }]
  );
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const setText = (key: string, v: string) => setRows(r => r.map(x => x.key === key ? { ...x, text: v } : x));
  const addRow = () => setRows(r => [...r, { key: uid(), text: "" }]);
  const removeRow = (key: string) => setRows(r => r.filter(x => x.key !== key));
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setRows(r => {
      const from = r.findIndex(x => x.key === active.id);
      const to = r.findIndex(x => x.key === over.id);
      return from < 0 || to < 0 ? r : arrayMove(r, from, to);
    });
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const clean = rows.map(r => ({ id: r.id, text: r.text.trim() })).filter(r => r.text);
    const keepIds = new Set(clean.filter(r => r.id).map(r => r.id));
    const toDelete = initial.filter(o => !keepIds.has(o.id)).map(o => o.id);
    try {
      if (toDelete.length) {
        const { error } = await supabase.from("project_objectives").delete().in("id", toDelete);
        if (error) throw error;
      }
      for (let i = 0; i < clean.length; i++) {
        const r = clean[i];
        if (r.id) {
          const { error } = await supabase.from("project_objectives").update({ text: r.text, sort_order: i }).eq("id", r.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("project_objectives").insert({ project_id: projectId, text: r.text, done: false, sort_order: i });
          if (error) throw error;
        }
      }
      onSaved();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast(/does not exist|project_objectives/.test(msg) ? tc.needsMigration : tc.saveError);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[330] flex items-end justify-center bg-[var(--brand)]/55 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-[460px] rounded-t-[22px] bg-white dark:bg-[#111a2e] p-5 shadow-2xl sm:rounded-[20px]" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-[#EDF3FB] dark:bg-[#17233d] text-[var(--accent)]"><Target size={16} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold text-[var(--brand)] dark:text-[#e8edf7]">{tc.title}</div>
            <div className="truncate text-[11px] text-[#97A1A0] dark:text-[#728098]">{projectTitle}</div>
          </div>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#ECE3D1] dark:hover:bg-[#17233d]"><X size={16} /></button>
        </div>

        <div className="max-h-[46vh] space-y-2 overflow-y-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={rows.map(r => r.key)} strategy={verticalListSortingStrategy}>
              {rows.map((r) => (
                <SortableRow key={r.key} row={r} placeholder={tc.placeholder} removeLabel={tc.remove}
                  onText={(v) => setText(r.key, v)} onEnter={addRow} onRemove={() => removeRow(r.key)} />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <button onClick={addRow} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#D7CBB3] dark:border-[#2c3c5e] py-2.5 text-[13px] font-bold text-[var(--brand)] dark:text-[#e8edf7] transition hover:border-[var(--brand)]">
          <Plus size={15} /> {tc.add}
        </button>

        <div className="mt-4 flex gap-2.5">
          <button onClick={onClose} disabled={saving} className="flex-1 rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] py-3 text-[14px] font-bold text-[#5C6A6E] dark:text-[#9fb0cc] disabled:opacity-50">{tc.cancel}</button>
          <button onClick={save} disabled={saving} className="flex-1 rounded-xl bg-[var(--brand)] py-3 text-[14px] font-bold text-white disabled:opacity-60">{saving ? "…" : tc.save}</button>
        </div>
      </div>
    </div>
  );
}

function SortableRow({
  row, placeholder, removeLabel, onText, onEnter, onRemove,
}: {
  row: Row; placeholder: string; removeLabel: string;
  onText: (v: string) => void; onEnter: () => void; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.key });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-start gap-1.5 ${isDragging ? "opacity-70" : ""}`}>
      <button {...attributes} {...listeners} aria-label="Reordenar"
        className="mt-2 shrink-0 cursor-grab touch-none text-[#C6BCA6] active:cursor-grabbing">
        <GripVertical size={16} />
      </button>
      <textarea
        value={row.text}
        onChange={e => onText(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEnter(); } }}
        rows={1}
        autoFocus={!row.text}
        placeholder={placeholder}
        className="min-w-0 flex-1 resize-y rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 py-2.5 text-[14px] leading-snug text-[var(--brand)] dark:text-[#e8edf7] focus:border-[var(--accent)] focus:outline-none"
      />
      <button onClick={onRemove} aria-label={removeLabel} className="mt-1 grid size-9 shrink-0 place-items-center rounded-lg text-[#B0492F] hover:bg-[#FBE9E7] dark:hover:bg-[#2a1712]"><Trash2 size={15} /></button>
    </div>
  );
}
