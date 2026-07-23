"use client";

import { useState } from "react";
import { Pin } from "lucide-react";
import { useLanguage } from "@/src/context/LanguageContext";

// Modal compartido para crear/editar una "nota del día" (agenda_events) — mismo patrón visual
// en el Reporte diario (Gantt G) y en la vista Hoy. Solo maneja el formulario; el padre persiste.
export default function DayNoteModal({
  mode, initialTitle = "", initialProjectId = "", initialDate, initialTime, contextLabel,
  projects, saving = false, onCancel, onSave,
}: {
  mode: "create" | "edit";
  initialTitle?: string;
  initialProjectId?: string;
  initialDate?: string;                                   // YYYY-MM-DD — solo se edita en modo "edit"
  initialTime?: string;                                   // HH:MM — hora de la actividad
  contextLabel?: string;                                  // p.ej. fecha "Hoy · 14 jul"
  projects: { id: string; title: string }[];
  saving?: boolean;
  onCancel: () => void;
  onSave: (data: { title: string; projectId: string | null; date?: string; time: string }) => void;
}) {
  const { t } = useLanguage();
  const tr = t.panel.dailyReport;

  const [title, setTitle] = useState(initialTitle);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [date, setDate] = useState(initialDate ?? "");
  const [time, setTime] = useState((initialTime ?? "10:00").slice(0, 5));

  const submit = () => {
    const clean = title.trim();
    if (!clean || saving) return;
    // La fecha solo viaja en modo edición (crear siempre usa el día abierto); la hora en ambos
    onSave({ title: clean, projectId: projectId || null, date: mode === "edit" && date ? date : undefined, time });
  };

  return (
    <div className="fixed inset-0 z-[310] flex items-end justify-center bg-[var(--brand)]/60 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-[440px] rounded-t-[22px] bg-white dark:bg-[#111a2e] p-4 sm:rounded-[20px]">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-[#FBF5E6] dark:bg-[#17233d] text-[#B98A2F]">
            <Pin size={15} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold text-[var(--brand)]">
              {mode === "edit" ? tr.noteEdit : tr.noteNew}
            </div>
            {contextLabel && <div className="text-[12px] text-[#97A1A0] dark:text-[#728098]">{contextLabel}</div>}
          </div>
        </div>

        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel(); }}
          placeholder={tr.notePlaceholder}
          className="w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3.5 py-3 text-[15px] text-[var(--brand)] placeholder:text-[#9CABB0] dark:placeholder:text-[#9fb0cc] focus:border-[#B98A2F] focus:outline-none"
        />

        {mode === "edit" ? (
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-[#97A1A0] dark:text-[#728098]">
                {tr.noteDate}
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3.5 py-3 text-[15px] text-[var(--brand)] focus:border-[#B98A2F] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-[#97A1A0] dark:text-[#728098]">
                {tr.noteTime}
              </label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3.5 py-3 text-[15px] text-[var(--brand)] focus:border-[#B98A2F] focus:outline-none"
              />
            </div>
          </div>
        ) : (
          <>
            <label className="mt-3 block text-[11px] font-bold uppercase tracking-wide text-[#97A1A0] dark:text-[#728098]">
              {tr.noteTime}
            </label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3.5 py-3 text-[15px] text-[var(--brand)] focus:border-[#B98A2F] focus:outline-none"
            />
          </>
        )}

        <label className="mt-3 block text-[11px] font-bold uppercase tracking-wide text-[#97A1A0] dark:text-[#728098]">
          {tr.noteProject}
        </label>
        <select
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3.5 py-3 text-[15px] text-[var(--brand)] focus:border-[#B98A2F] focus:outline-none"
        >
          <option value="">{tr.noteNoProject}</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.title.split(" — ")[0]}</option>
          ))}
        </select>

        <div className="mt-4 flex gap-2.5">
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] py-3 text-[14px] font-bold text-[#5C6A6E] dark:text-[#9fb0cc] disabled:opacity-50"
          >
            {tr.noteCancel}
          </button>
          <button
            onClick={submit}
            disabled={!title.trim() || saving}
            className="flex-1 rounded-xl bg-[#B98A2F] py-3 text-[14px] font-bold text-white disabled:opacity-40"
          >
            {tr.noteSaveEdit}
          </button>
        </div>
      </div>
    </div>
  );
}
