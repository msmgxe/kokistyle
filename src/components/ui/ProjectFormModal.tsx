"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/src/lib/supabase";
import type { Project } from "@/src/types/project";

interface Props {
  project?: Project;
  initialValues?: Partial<Project>;
  onClose: () => void;
  onSaved: () => void;
  toast: (msg: string) => void;
}

const STATUS_OPTIONS = [
  { value: "presupuesto", label: "Presupuesto" },
  { value: "aprobado",    label: "Aprobado" },
  { value: "en_obra",     label: "En obra" },
  { value: "terminado",   label: "Terminado" },
];

export default function ProjectFormModal({ project, initialValues, onClose, onSaved, toast }: Props) {
  const isEdit = !!project;
  const iv = isEdit ? undefined : initialValues;

  const [form, setForm] = useState({
    title:      project?.title      ?? iv?.title      ?? "",
    client:     project?.client     ?? iv?.client     ?? "",
    address:    project?.address    ?? iv?.address    ?? "",
    budget:     project?.budget     ?? iv?.budget     ?? 0,
    start_date: project?.start_date ?? iv?.start_date ?? new Date().toISOString().split("T")[0],
    status:     project?.status     ?? "presupuesto",
  });
  const [errors, setErrors]         = useState<Record<string, boolean>>({});
  const [saving, setSaving]         = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (project) {
      setForm({
        title:      project.title,
        client:     project.client,
        address:    project.address,
        budget:     project.budget,
        start_date: project.start_date,
        status:     project.status,
      });
    }
  }, [project]);

  const set = (k: string, v: string | number) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: false }));
  };

  const validate = () => {
    const e: Record<string, boolean> = {};
    if (!form.title.trim())      e.title      = true;
    if (!form.address.trim())    e.address    = true;
    if (!form.start_date)        e.start_date = true;
    if (!form.status)            e.status     = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    if (isEdit) {
      const { error } = await supabase.from("projects").update({
        title:      form.title.trim(),
        client:     form.client.trim(),
        address:    form.address.trim(),
        budget:     Number(form.budget) || 0,
        start_date: form.start_date,
        status:     form.status,
      }).eq("id", project!.id);
      if (error) { toast("Error al guardar: " + error.message); setSaving(false); return; }
      toast("Proyecto actualizado.");
    } else {
      const { error } = await supabase.from("projects").insert({
        title:      form.title.trim(),
        client:     form.client.trim(),
        address:    form.address.trim(),
        budget:     Number(form.budget) || 0,
        start_date: form.start_date,
        status:     form.status,
      });
      if (error) { toast("Error al crear: " + error.message); setSaving(false); return; }
      toast("Proyecto creado.");
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const handleDelete = async () => {
    if (!isEdit) return;
    await supabase.from("projects").delete().eq("id", project!.id);
    toast("Proyecto eliminado.");
    onSaved();
    onClose();
  };

  const field = (key: string) =>
    `w-full rounded-xl border px-3 py-3 text-sm text-[#16323D] focus:outline-none transition ${
      errors[key]
        ? "border-[#B0492F] bg-[#FDF0ED] focus:border-[#B0492F]"
        : "border-[#D7CBB3] bg-white focus:border-[#16323D]"
    }`;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-end justify-center bg-[#16323D]/55 backdrop-blur-sm sm:items-center"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="w-full max-w-[480px] overflow-y-auto rounded-t-[22px] bg-[#F7F3EA] p-6 shadow-2xl sm:rounded-[20px] max-h-[92vh]">
          <h3 className="mb-5 text-xl font-bold text-[#16323D]">
            {isEdit ? "Editar proyecto" : "Nuevo proyecto"}
          </h3>

          <div className="space-y-3">
            {/* Tipo de proyecto (status) */}
            <div>
              <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
                Tipo de proyecto <span className="text-[#B0492F]">*</span>
              </label>
              <select
                value={form.status}
                onChange={e => set("status", e.target.value)}
                className={field("status")}
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {errors.status && (
                <p className="mt-1 text-[11px] text-[#B0492F]">Selecciona el tipo de proyecto</p>
              )}
            </div>

            {/* Nombre */}
            <div>
              <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
                Nombre del proyecto <span className="text-[#B0492F]">*</span>
              </label>
              <input
                type="text"
                placeholder="ej. Master Bathroom — Brickell"
                value={form.title}
                onChange={e => set("title", e.target.value)}
                className={field("title")}
              />
              {errors.title && (
                <p className="mt-1 text-[11px] text-[#B0492F]">El nombre del proyecto es obligatorio</p>
              )}
            </div>

            {/* Cliente */}
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
                Cliente
              </label>
              <input
                type="text"
                placeholder="ej. Familia García"
                value={form.client}
                onChange={e => set("client", e.target.value)}
                className="w-full rounded-xl border border-[#D7CBB3] bg-white px-3 py-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none"
              />
            </div>

            {/* Dirección */}
            <div>
              <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
                Dirección <span className="text-[#B0492F]">*</span>
              </label>
              <input
                type="text"
                placeholder="ej. 1820 Catalonia Ave, Coral Gables"
                value={form.address}
                onChange={e => set("address", e.target.value)}
                className={field("address")}
              />
              {errors.address && (
                <p className="mt-1 text-[11px] text-[#B0492F]">La dirección es obligatoria</p>
              )}
            </div>

            {/* Fecha inicio + Presupuesto */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
                  Fecha inicio <span className="text-[#B0492F]">*</span>
                </label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={e => set("start_date", e.target.value)}
                  className={field("start_date")}
                />
                {errors.start_date && (
                  <p className="mt-1 text-[11px] text-[#B0492F]">Requerida</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
                  Presupuesto (USD)
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.budget}
                  onChange={e => set("budget", parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-[#D7CBB3] bg-white px-3 py-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="mt-5 flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-xl bg-[#ECE3D1] py-3 font-bold text-[#5C6A6E]">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-xl bg-[#16323D] py-3 font-bold text-white disabled:opacity-50"
            >
              {saving ? "Guardando…" : isEdit ? "Guardar" : "Crear proyecto"}
            </button>
          </div>

          {isEdit && (
            <button
              onClick={() => setConfirmDel(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-sm font-bold text-[#B0492F]"
            >
              Eliminar proyecto
            </button>
          )}
        </div>
      </div>

      {confirmDel && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#16323D]/55 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[20px] bg-[#F7F3EA] p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-bold text-[#16323D]">Eliminar proyecto</h3>
            <p className="mb-5 text-sm text-[#5C6A6E]">
              Se eliminarán &ldquo;{project?.title}&rdquo; y todos sus datos. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(false)} className="flex-1 rounded-xl bg-[#ECE3D1] py-3 font-bold text-[#5C6A6E]">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 rounded-xl bg-[#B0492F] py-3 font-bold text-white">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
