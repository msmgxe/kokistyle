"use client";

import { useState, useEffect, useRef } from "react";
import { Camera, X } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import { useLanguage } from "@/src/context/LanguageContext";
import type { Project } from "@/src/types/project";

interface Props {
  project?: Project;
  initialValues?: Partial<Project>;
  onClose: () => void;
  onSaved: () => void;
  toast: (msg: string) => void;
}

const STATUS_OPTIONS = [
  { value: "prospecto",   label: "Prospecto" },
  { value: "presupuesto", label: "Estimado" },
  { value: "aprobado",    label: "Aprobado" },
  { value: "en_obra",     label: "En obra" },
  { value: "terminado",   label: "Terminado" },
];

async function uploadPhoto(projectId: string, file: File): Promise<string | null> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `project-photos/${projectId}/cover.${ext}`;
  const { error } = await supabase.storage
    .from("kokistyle-files")
    .upload(path, file, { upsert: true });
  if (error) return null;
  const { data } = supabase.storage.from("kokistyle-files").getPublicUrl(path);
  return data.publicUrl;
}

export default function ProjectFormModal({ project, initialValues, onClose, onSaved, toast }: Props) {
  const { t, language } = useLanguage();
  const EN = language === "en";
  const tp = t.panel;
  const isEdit = !!project;
  const iv = isEdit ? undefined : initialValues;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title:      project?.title      ?? iv?.title      ?? "",
    client:     project?.client     ?? iv?.client     ?? "",
    address:    project?.address    ?? iv?.address    ?? "",
    budget:     project?.budget     ?? iv?.budget     ?? 0,
    start_date: project?.start_date ?? iv?.start_date ?? new Date().toISOString().split("T")[0],
    status:     project?.status     ?? "prospecto",
  });
  const [errors, setErrors]         = useState<Record<string, boolean>>({});
  const [saving, setSaving]         = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  // Photo state
  const [photoPreview,   setPhotoPreview]   = useState<string>(project?.photo_url ?? "");
  const [photoFile,      setPhotoFile]      = useState<File | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

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
      setPhotoPreview(project.photo_url ?? "");
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

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    if (isEdit) {
      let photoUrl = project!.photo_url ?? null;
      if (photoFile) {
        setPhotoUploading(true);
        photoUrl = await uploadPhoto(project!.id, photoFile);
        setPhotoUploading(false);
      } else if (!photoPreview && project!.photo_url) {
        photoUrl = null;
      }
      const { error } = await supabase.from("projects").update({
        title:      form.title.trim(),
        client:     form.client.trim(),
        address:    form.address.trim(),
        budget:     Number(form.budget) || 0,
        start_date: form.start_date,
        status:     form.status,
        photo_url:  photoUrl,
      }).eq("id", project!.id);
      if (error) { toast("Error al guardar: " + error.message); setSaving(false); return; }
      toast(EN ? "Project updated." : "Proyecto actualizado.");
    } else {
      const { data: created, error } = await supabase.from("projects").insert({
        title:      form.title.trim(),
        client:     form.client.trim(),
        address:    form.address.trim(),
        budget:     Number(form.budget) || 0,
        start_date: form.start_date,
        status:     form.status,
      }).select("id").single();
      if (error || !created) { toast("Error al crear: " + (error?.message ?? "")); setSaving(false); return; }
      if (photoFile) {
        setPhotoUploading(true);
        const photoUrl = await uploadPhoto(created.id, photoFile);
        if (photoUrl) await supabase.from("projects").update({ photo_url: photoUrl }).eq("id", created.id);
        setPhotoUploading(false);
      }
      toast(EN ? "Project created." : "Proyecto creado.");
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const handleDelete = async () => {
    if (!isEdit) return;
    await supabase.from("projects").delete().eq("id", project!.id);
    toast(EN ? "Project deleted." : "Proyecto eliminado.");
    onSaved();
    onClose();
  };

  const field = (key: string) =>
    `w-full rounded-xl border px-3 py-3 text-sm text-[#16323D] focus:outline-none transition ${
      errors[key]
        ? "border-[#B0492F] bg-[#FDF0ED] focus:border-[#B0492F]"
        : "border-[#D7CBB3] bg-white focus:border-[#16323D]"
    }`;

  const isBusy = saving || photoUploading;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-end justify-center bg-[#16323D]/55 backdrop-blur-sm sm:items-center"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="w-full max-w-[480px] overflow-y-auto rounded-t-[22px] bg-[#F7F3EA] shadow-2xl sm:rounded-[20px] max-h-[92vh]">

          {/* Photo zone */}
          <div className="relative">
            {photoPreview ? (
              <div className="relative h-40 overflow-hidden rounded-t-[22px] sm:rounded-t-[20px]">
                <img src={photoPreview} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                <div className="absolute bottom-3 right-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg bg-black/40 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm hover:bg-black/60"
                  >
                    <Camera size={12} />
                    {tp.project.photoChange}
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="flex items-center gap-1.5 rounded-lg bg-black/40 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm hover:bg-black/60"
                  >
                    <X size={12} />
                    {tp.project.photoRemove}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-16 w-full items-center justify-center gap-2 rounded-t-[22px] border-b border-[#D7CBB3] bg-[#ECE3D1] text-[12px] font-semibold text-[#5C6A6E] transition hover:bg-[#E0D5BF] sm:rounded-t-[20px]"
              >
                <Camera size={16} className="opacity-60" />
                {tp.project.photoAdd}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />
          </div>

          <div className="p-6 pt-5">
            <h3 className="mb-5 text-xl font-bold text-[#16323D]">
              {isEdit ? tp.project.editTitle : tp.project.name}
            </h3>

            <div className="space-y-3">
              {/* Tipo de proyecto (status) */}
              <div>
                <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
                  {EN ? "Project type" : "Tipo de proyecto"} <span className="text-[#B0492F]">*</span>
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
                  <p className="mt-1 text-[11px] text-[#B0492F]">{EN ? "Select a project type" : "Selecciona el tipo de proyecto"}</p>
                )}
              </div>

              {/* Nombre */}
              <div>
                <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
                  {tp.project.name} <span className="text-[#B0492F]">*</span>
                </label>
                <input
                  type="text"
                  placeholder={EN ? "e.g. Master Bathroom — Brickell" : "ej. Master Bathroom — Brickell"}
                  value={form.title}
                  onChange={e => set("title", e.target.value)}
                  className={field("title")}
                />
                {errors.title && (
                  <p className="mt-1 text-[11px] text-[#B0492F]">{EN ? "Project name is required" : "El nombre del proyecto es obligatorio"}</p>
                )}
              </div>

              {/* Cliente */}
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
                  {tp.project.client}
                </label>
                <input
                  type="text"
                  placeholder={EN ? "e.g. García Family" : "ej. Familia García"}
                  value={form.client}
                  onChange={e => set("client", e.target.value)}
                  className="w-full rounded-xl border border-[#D7CBB3] bg-white px-3 py-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none"
                />
              </div>

              {/* Dirección */}
              <div>
                <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
                  {tp.project.address} <span className="text-[#B0492F]">*</span>
                </label>
                <input
                  type="text"
                  placeholder={EN ? "e.g. 1820 Catalonia Ave, Coral Gables" : "ej. 1820 Catalonia Ave, Coral Gables"}
                  value={form.address}
                  onChange={e => set("address", e.target.value)}
                  className={field("address")}
                />
                {errors.address && (
                  <p className="mt-1 text-[11px] text-[#B0492F]">{EN ? "Address is required" : "La dirección es obligatoria"}</p>
                )}
              </div>

              {/* Fecha inicio + Presupuesto */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
                    {tp.project.startDate} <span className="text-[#B0492F]">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => set("start_date", e.target.value)}
                    className={field("start_date")}
                  />
                  {errors.start_date && (
                    <p className="mt-1 text-[11px] text-[#B0492F]">{EN ? "Required" : "Requerida"}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
                    {tp.project.budget}
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
                {EN ? "Cancel" : "Cancelar"}
              </button>
              <button
                onClick={handleSave}
                disabled={isBusy}
                className="flex-1 rounded-xl bg-[#16323D] py-3 font-bold text-white disabled:opacity-50"
              >
                {isBusy
                  ? (photoUploading ? tp.project.photoUploading : (EN ? "Saving…" : "Guardando…"))
                  : isEdit ? (EN ? "Save" : "Guardar") : (EN ? "Create project" : "Crear proyecto")}
              </button>
            </div>

            {isEdit && (
              <button
                onClick={() => setConfirmDel(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-sm font-bold text-[#B0492F]"
              >
                {EN ? "Delete project" : "Eliminar proyecto"}
              </button>
            )}
          </div>
        </div>
      </div>

      {confirmDel && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#16323D]/55 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[20px] bg-[#F7F3EA] p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-bold text-[#16323D]">{EN ? "Delete project" : "Eliminar proyecto"}</h3>
            <p className="mb-5 text-sm text-[#5C6A6E]">
              {EN
                ? `"${project?.title}" will be deleted along with all its data. This cannot be undone.`
                : `Se eliminarán "${project?.title}" y todos sus datos. Esta acción no se puede deshacer.`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(false)} className="flex-1 rounded-xl bg-[#ECE3D1] py-3 font-bold text-[#5C6A6E]">{EN ? "Cancel" : "Cancelar"}</button>
              <button onClick={handleDelete} className="flex-1 rounded-xl bg-[#B0492F] py-3 font-bold text-white">{EN ? "Delete" : "Eliminar"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
