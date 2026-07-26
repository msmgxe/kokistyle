"use client";

import { useState } from "react";
import { X, Plus, Target, Trash2 } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import { useLanguage } from "@/src/context/LanguageContext";
import type { ProjectObjective } from "@/src/types/project";

// Modal para agregar / editar / eliminar objetivos de un proyecto. Guarda con diff
// (preserva `done` e ids de los existentes; borra los quitados; inserta los nuevos).
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
  const [rows, setRows] = useState<{ id?: string; text: string }[]>(
    initial.length ? initial.map(o => ({ id: o.id, text: o.text })) : [{ text: "" }]
  );
  const [saving, setSaving] = useState(false);

  const setText = (i: number, v: string) => setRows(r => r.map((x, k) => k === i ? { ...x, text: v } : x));
  const addRow = () => setRows(r => [...r, { text: "" }]);
  const removeRow = (i: number) => setRows(r => r.filter((_, k) => k !== i));

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
          {rows.map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2.5 w-5 shrink-0 text-center font-mono text-[12px] font-bold text-[#C6BCA6]">{i + 1}</span>
              <textarea
                value={r.text}
                onChange={e => setText(i, e.target.value)}
                rows={1}
                autoFocus={i === rows.length - 1 && !r.text}
                placeholder={tc.placeholder}
                className="min-w-0 flex-1 resize-y rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 py-2.5 text-[14px] leading-snug text-[var(--brand)] dark:text-[#e8edf7] focus:border-[var(--accent)] focus:outline-none"
              />
              <button onClick={() => removeRow(i)} aria-label={tc.remove} className="mt-1 grid size-9 shrink-0 place-items-center rounded-lg text-[#B0492F] hover:bg-[#FBE9E7] dark:hover:bg-[#2a1712]"><Trash2 size={15} /></button>
            </div>
          ))}
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
