"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Trash2, Star, MoveLeft, MoveRight } from "lucide-react";
import CameraCapture from "@/src/components/ui/CameraCapture";
import PhotoComposer from "@/src/components/ui/PhotoComposer";
import { useGalleryPicker } from "@/src/components/ui/useGalleryPicker";
import { supabase } from "@/src/lib/supabase";
import { logActivity } from "@/src/lib/activity";
import {
  PHOTOS_BUCKET, PHOTO_TAG_ORDER, photoTagColor, uploadProjectPhoto,
} from "@/src/lib/photos";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import type { ProjectPhoto, PhotoTag } from "@/src/types/project";

const TAG_ORDER = PHOTO_TAG_ORDER;
const BUCKET = PHOTOS_BUCKET;

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ProjectPhotos({
  projectId, projects, toast, coverUrl, onProjectChange,
}: {
  projectId?: string;                                            // fijo → tab del proyecto
  projects?: { id: string; title: string; client?: string }[];   // selector → página global
  toast: (msg: string) => void;
  coverUrl?: string | null;         // url de la portada actual (projects.photo_url) → muestra ★
  onProjectChange?: () => void;      // refresca el proyecto padre (hero) al cambiar la portada
}) {
  const { t, language } = useLanguage();
  const { currentUser } = useAuth();
  const tf = t.panel.fotos;
  const EN = language === "en";

  const KNOWN_LABELS: Record<string, string> = {
    antes: tf.tagAntes, avance: tf.tagAvance, despues: tf.tagDespues,
    problema: tf.tagProblema, material: tf.tagMaterial,
  };
  const tagLabel = (t: string) => KNOWN_LABELS[t] ?? t.toUpperCase();

  const [selProject, setSelProject] = useState<string>(projectId ?? projects?.[0]?.id ?? "");
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
  const [filter, setFilter] = useState<"all" | PhotoTag>("all");
  const [loading, setLoading] = useState(true);

  const [pending, setPending] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [albumFilter, setAlbumFilter] = useState<string>("all");

  const [uploadStep, setUploadStep] = useState(0);

  const [viewIdx, setViewIdx] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ caption: "", tag: "avance", customTag: null as string | null, album: "" });
  const [camOpen, setCamOpen] = useState(false);
  const camFallbackRef = useRef<HTMLInputElement>(null);
  const {
    imgInputRef, anyInputRef, openGallery, openFileManager, fallbackVisible, dismissFallback,
  } = useGalleryPicker(() => toast(tf.pickerBlocked));

  const activeProject = projectId ?? selProject;
  const projTitle = useCallback(
    (id: string) => projects?.find(p => p.id === id)?.title.split(" — ")[0] ?? "",
    [projects]
  );

  const load = useCallback(async () => {
    setLoading(true);
    // Orden manual (sort_order) primero; las que no tienen, por fecha. Si la columna
    // aún no existe (migración pendiente), reintenta solo por fecha.
    const runQuery = (withOrder: boolean) => {
      let q = supabase.from("project_photos").select("*");
      if (withOrder) q = q.order("sort_order", { ascending: true, nullsFirst: false });
      q = q.order("taken_at", { ascending: false }).order("created_at", { ascending: false });
      if (activeProject !== "all") q = q.eq("project_id", activeProject);
      return q;
    };
    let { data, error } = await runQuery(true);
    if (error && /sort_order/.test(error.message)) ({ data, error } = await runQuery(false));
    if (error) {
      setPhotos([]);
      if (error.message.includes("does not exist") || error.code === "42P01") toast(tf.needsMigration);
    } else {
      setPhotos((data as ProjectPhoto[]) ?? []);
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject]);

  useEffect(() => { if (activeProject) load(); }, [activeProject, load]);

  /* ── Selección de archivos ─────────────────────────────────────────────── */
  const pickFiles = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    if (activeProject === "all" || !activeProject) { toast(tf.chooseProject); return; }
    const arr = [...files].filter(f => f.type.startsWith("image/"));
    previews.forEach(URL.revokeObjectURL);
    setPending(arr);
    setPreviews(arr.map(f => URL.createObjectURL(f)));
  };

  const cancelComposer = () => {
    previews.forEach(URL.revokeObjectURL);
    setPending([]);
    setPreviews([]);
    setUploadStep(0);
  };

  const effectiveTag = (base: string, custom: string | null) =>
    custom !== null && custom.trim() ? custom.trim().toLowerCase() : base;

  /* ── Subida (comprime + Storage + fila) ────────────────────────────────── */
  const upload = async ({ caption, tag, album }: { caption: string; tag: string; album: string }) => {
    if (!pending.length || uploadStep > 0) return;
    let okCount = 0;
    for (let i = 0; i < pending.length; i++) {
      setUploadStep(i + 1);
      const file = pending[i];
      try {
        await uploadProjectPhoto({ projectId: activeProject, file, caption, tag, album });
        okCount++;
      } catch {
        toast(tf.uploadError);
      }
    }
    if (okCount > 0) {
      logActivity({
        user_id: currentUser?.id, user_name: currentUser?.name,
        user_role: currentUser?.role ?? "colaborador",
        action: "create", entity_type: "photo",
        entity_name: `${okCount} ${tf.photosWord}`, project_id: activeProject,
      });
      toast(`✓ ${okCount} ${tf.uploaded}`);
    }
    cancelComposer();
    load();
  };

  /* ── Eliminar (fila + archivo en Storage best-effort) ──────────────────── */
  const deletePhoto = async (photo: ProjectPhoto) => {
    const { error } = await supabase.from("project_photos").delete().eq("id", photo.id);
    if (error) { toast(tf.deleteError); return; }
    const path = photo.url.split(`/${BUCKET}/`)[1];
    if (path) supabase.storage.from(BUCKET).remove([decodeURIComponent(path)]).then(() => {});
    setViewIdx(null);
    setConfirmDel(false);
    setPhotos(prev => prev.filter(p => p.id !== photo.id));
    toast(tf.deleted);
  };

  /* ── Portada del proyecto (projects.photo_url) ─────────────────────────── */
  const setCover = async (photo: ProjectPhoto) => {
    if (activeProject === "all" || !activeProject) return;
    const { error } = await supabase.from("projects").update({ photo_url: photo.url }).eq("id", activeProject);
    if (error) { toast(tf.updateError); return; }
    toast(tf.coverSet);
    onProjectChange?.();
  };

  /* ── Reordenar (sort_order) — mover una foto antes/después ─────────────── */
  const movePhoto = async (dir: -1 | 1) => {
    if (viewIdx == null) return;
    const target = viewIdx + dir;
    if (target < 0 || target >= visible.length) return;
    const cur = visible[viewIdx];
    const nb  = visible[target];
    const arr = [...photos];
    const ci = arr.findIndex(p => p.id === cur.id);
    const ni = arr.findIndex(p => p.id === nb.id);
    if (ci < 0 || ni < 0) return;
    [arr[ci], arr[ni]] = [arr[ni], arr[ci]];
    // Renumera todo el set en su nuevo orden y persiste las filas que cambiaron
    const renum = arr.map((p, i) => ({ ...p, sort_order: i }));
    setPhotos(renum);
    setViewIdx(target);
    const changed = renum.filter((p, i) => photos.find(o => o.id === p.id)?.sort_order !== i);
    for (const p of changed) {
      const { error } = await supabase.from("project_photos").update({ sort_order: p.sort_order }).eq("id", p.id);
      if (error) { toast(/sort_order/.test(error.message) ? tf.needsMigration : tf.updateError); load(); return; }
    }
    toast(tf.reorderDone);
    onProjectChange?.();
  };

  /* ── Derivados ─────────────────────────────────────────────────────────── */
  // Grilla continua: más reciente primero, fluye izq→der y arriba→abajo (la query ya ordena desc)
  const visible = useMemo(
    () => photos
      .filter(p => filter === "all" || p.tag === filter)
      .filter(p => albumFilter === "all" || (albumFilter === "__none__" ? !p.album : p.album === albumFilter)),
    [photos, filter, albumFilter]
  );
  const albums = useMemo(
    () => [...new Set(photos.map(p => p.album).filter((a): a is string => !!a))].sort(),
    [photos]
  );
  const customTags = useMemo(
    () => [...new Set(photos.map(p => p.tag).filter(t => !(PHOTO_TAG_ORDER as string[]).includes(t)))],
    [photos]
  );

  /* ── Editar foto (tag / comentario / carpeta) ──────────────────────────── */
  const openEdit = (p: ProjectPhoto) => {
    const isKnown = (PHOTO_TAG_ORDER as string[]).includes(p.tag);
    setEditData({
      caption: p.caption ?? "",
      tag: isKnown ? p.tag : "avance",
      customTag: isKnown ? null : p.tag,
      album: p.album ?? "",
    });
    setEditMode(true);
  };

  const saveEdit = async (p: ProjectPhoto) => {
    const newTag = effectiveTag(editData.tag, editData.customTag);
    const patch = {
      caption: editData.caption.trim() || null,
      tag: newTag,
      album: editData.album.trim() || null,
    };
    const { error } = await supabase.from("project_photos").update(patch).eq("id", p.id);
    if (error) { toast(tf.updateError); return; }
    setPhotos(prev => prev.map(x => x.id === p.id ? { ...x, ...patch } : x));
    setEditMode(false);
    toast(tf.updated);
  };

  const fmtDate = (iso: string) => {
    const today = toIso(new Date());
    const label = new Date(iso + "T00:00:00").toLocaleDateString(EN ? "en-US" : "es-US", {
      weekday: "short", day: "numeric", month: "short",
    });
    return iso === today ? `${EN ? "Today" : "Hoy"} · ${label}` : label;
  };

  const current = viewIdx !== null ? visible[viewIdx] : null;

  return (
    <div>
      {/* ── Barra de captura ── */}
      <div className="rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-4">
        {!projectId && projects && (
          <select
            value={selProject}
            onChange={e => setSelProject(e.target.value)}
            aria-label={tf.selectProject}
            className="mb-3 w-full rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 py-3 text-[15px] font-semibold text-[var(--brand)] focus:border-[var(--accent)] focus:outline-none"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.title.split(" — ")[0]}{p.client ? ` — ${p.client}` : ""}</option>
            ))}
            <option value="all">{tf.allProjects}</option>
          </select>
        )}
        {/* Cámara in-app (getUserMedia) — el picker/intent del sistema está roto en varios Android (MIUI) */}
        <div className="flex gap-2.5">
          <button
            onClick={() => {
              if (activeProject === "all" || !activeProject) { toast(tf.chooseProject); return; }
              if (typeof navigator.mediaDevices?.getUserMedia === "function") setCamOpen(true);
              else camFallbackRef.current?.click();
            }}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#B0492F] px-3 py-3.5 text-[15px] font-bold text-white shadow-md transition hover:bg-[#983C25] active:scale-[0.98]"
          >
            {tf.takePhoto}
          </button>
          <button
            onClick={openGallery}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 py-3.5 text-[15px] font-bold text-[var(--brand)] transition hover:bg-[#ECE3D1] dark:hover:bg-[#17233d] active:scale-[0.98]"
          >
            {tf.fromGallery}
          </button>
        </div>
        {fallbackVisible && (
          <button
            onClick={openFileManager}
            className="mt-2.5 w-full rounded-xl border-2 border-dashed border-[#B98A2F] bg-[#FBF5E6] dark:bg-[#17233d] px-3 py-3 text-[13px] font-bold text-[#7A6230] transition active:scale-[0.98]"
          >
            {tf.pickerRetry}
          </button>
        )}
        <input ref={imgInputRef} type="file" accept="image/*" multiple className="sr-only"
          onChange={e => { pickFiles(e.target.files); e.target.value = ""; dismissFallback(); }} />
        <input ref={anyInputRef} type="file" multiple className="sr-only"
          onChange={e => { pickFiles(e.target.files); e.target.value = ""; dismissFallback(); }} />
        <input ref={camFallbackRef} type="file" accept="image/*" className="sr-only"
          onChange={e => { pickFiles(e.target.files); e.target.value = ""; }} />
        <CameraCapture
          open={camOpen}
          onClose={() => setCamOpen(false)}
          onCapture={file => pickFiles([file])}
          toast={toast}
        />
      </div>

      {/* ── Compositor (modal compartido con QuickPhoto y la vista Hoy) ── */}
      {pending.length > 0 && (
        <PhotoComposer
          title={projTitle(activeProject) || tf.title}
          previews={previews}
          fileCount={pending.length}
          uploadStep={uploadStep}
          albums={albums}
          onCancel={cancelComposer}
          onUpload={upload}
        />
      )}

      {/* ── Filtros por etiqueta (conocidas + custom) ── */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        <button
          onClick={() => setFilter("all")}
          className={`shrink-0 rounded-full border px-4 py-2 text-[13px] font-bold transition ${
            filter === "all" ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] text-[#5C6A6E] dark:text-[#9fb0cc]"
          }`}
        >
          {tf.all} · {photos.length}
        </button>
        {[...TAG_ORDER, ...customTags].map(tg => {
          const n = photos.filter(p => p.tag === tg).length;
          if (n === 0) return null;
          return (
            <button
              key={tg}
              onClick={() => setFilter(tg)}
              className="shrink-0 rounded-full border px-4 py-2 text-[13px] font-bold transition"
              style={filter === tg
                ? { background: photoTagColor(tg), borderColor: photoTagColor(tg), color: "#fff" }
                : { borderColor: "#E6DDCB", background: "#fff", color: "#5C6A6E" }}
            >
              {tagLabel(tg)} · {n}
            </button>
          );
        })}
      </div>

      {/* ── Filtro por carpeta (solo si existen) ── */}
      {albums.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {[
            { id: "all", label: tf.allAlbums },
            ...albums.map(a => ({ id: a, label: `📁 ${a}` })),
            { id: "__none__", label: tf.noAlbum },
          ].map(a => (
            <button
              key={a.id}
              onClick={() => setAlbumFilter(a.id)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition ${
                albumFilter === a.id ? "border-[#B98A2F] bg-[#FBF5E6] dark:bg-[#17233d] text-[#7A6230]" : "border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] text-[#97A1A0] dark:text-[#728098]"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Galería por fecha ── */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
        </div>
      ) : visible.length === 0 ? (
        <p className="py-12 text-center text-[14px] italic text-[#97A1A0] dark:text-[#728098]">{tf.empty}</p>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
          {visible.map((p, idx) => (
            <button
              key={p.id}
              onClick={() => { setViewIdx(idx); setConfirmDel(false); setEditMode(false); }}
              className="relative aspect-square overflow-hidden rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] transition active:scale-[0.97]"
              aria-label={p.caption ?? tagLabel(p.tag)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption ?? ""} loading="lazy" className="h-full w-full object-cover" />
              <span
                className="absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-white"
                style={{ background: photoTagColor(p.tag) }}
              >
                {tagLabel(p.tag)}
              </span>
              {p.album && (
                <span className="absolute right-1.5 top-1.5 rounded-full bg-[#FBF5E6]/95 px-1.5 py-0.5 text-[8.5px] font-bold text-[#7A6230]">
                  📁
                </span>
              )}
              {coverUrl === p.url && (
                <span className="absolute right-1.5 bottom-1.5 grid size-5 place-items-center rounded-full bg-[#4F8A63] text-white shadow" title={tf.isCover}>
                  <Star size={11} className="fill-current" />
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/75 to-transparent px-2 pb-1 pt-4 text-left text-[9.5px] font-bold text-white">
                {fmtDate(p.taken_at)}{activeProject === "all" ? ` · ${projTitle(p.project_id)}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Visor ── */}
      {current && (
        <div className="fixed inset-0 z-[300] flex flex-col bg-[#0A161C]/97">
          <div className="flex items-center gap-2.5 px-4 py-3.5" style={{ paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold text-white">
                {projTitle(current.project_id) || tagLabel(current.tag)}
              </div>
              <div className="truncate text-[12px] text-[#A8C0BC]">
                {fmtDate(current.taken_at)}{current.album ? ` · 📁 ${current.album}` : ""} · {(viewIdx ?? 0) + 1} {tf.of} {visible.length}
              </div>
            </div>
            <button
              onClick={() => (editMode ? setEditMode(false) : openEdit(current))}
              className={`grid h-10 shrink-0 place-items-center rounded-xl px-3 text-[13px] font-bold ${editMode ? "bg-white dark:bg-[#111a2e] text-[var(--brand)]" : "bg-white/12 text-white"}`}
            >
              {tf.edit}
            </button>
            <button
              onClick={() => { setViewIdx(null); setEditMode(false); setConfirmDel(false); }}
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/12 text-white"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center px-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.url} alt={current.caption ?? ""} className="max-h-full max-w-full rounded-xl object-contain" />
          </div>
          {editMode ? (
            /* ── Edición: comentario, etiqueta (con custom) y carpeta ── */
            <div className="space-y-2 px-5 pt-3">
              <input
                value={editData.caption}
                onChange={e => setEditData(d => ({ ...d, caption: e.target.value }))}
                placeholder={tf.captionPlaceholder}
                className="w-full rounded-xl bg-white dark:bg-[#111a2e] px-3.5 py-2.5 text-[14px] text-[var(--brand)] placeholder:text-[#9CABB0] dark:placeholder:text-[#9fb0cc] focus:outline-none"
              />
              <div className="flex flex-wrap gap-1.5">
                {TAG_ORDER.map(tg => (
                  <button
                    key={tg}
                    onClick={() => setEditData(d => ({ ...d, tag: tg, customTag: null }))}
                    className="rounded-full border-2 px-3 py-1 text-[11px] font-bold transition"
                    style={editData.customTag === null && editData.tag === tg
                      ? { background: photoTagColor(tg), borderColor: photoTagColor(tg), color: "#fff" }
                      : { borderColor: "rgba(255,255,255,.3)", color: "rgba(255,255,255,.75)", background: "transparent" }}
                  >
                    {tagLabel(tg)}
                  </button>
                ))}
                <button
                  onClick={() => setEditData(d => ({ ...d, customTag: d.customTag === null ? "" : null }))}
                  className="rounded-full border-2 border-dashed px-3 py-1 text-[11px] font-bold transition"
                  style={editData.customTag !== null
                    ? { borderColor: "#fff", color: "#fff" }
                    : { borderColor: "rgba(255,255,255,.35)", color: "rgba(255,255,255,.6)" }}
                >
                  {tf.tagCustom}
                </button>
              </div>
              {editData.customTag !== null && (
                <input
                  autoFocus
                  value={editData.customTag}
                  onChange={e => setEditData(d => ({ ...d, customTag: e.target.value }))}
                  placeholder={tf.customTagPlaceholder}
                  className="w-full rounded-xl bg-white dark:bg-[#111a2e] px-3.5 py-2.5 text-[14px] uppercase text-[var(--brand)] placeholder:normal-case placeholder:text-[#9CABB0] dark:placeholder:text-[#9fb0cc] focus:outline-none"
                />
              )}
              <input
                value={editData.album}
                onChange={e => setEditData(d => ({ ...d, album: e.target.value }))}
                list="albums-list-edit"
                placeholder={tf.albumPlaceholder}
                className="w-full rounded-xl bg-white dark:bg-[#111a2e] px-3.5 py-2.5 text-[14px] text-[var(--brand)] placeholder:text-[#9CABB0] dark:placeholder:text-[#9fb0cc] focus:outline-none"
              />
              <datalist id="albums-list-edit">
                {albums.map(a => <option key={a} value={a} />)}
              </datalist>
              <button
                onClick={() => saveEdit(current)}
                className="w-full rounded-xl bg-[#4F8A63] py-3 text-[14px] font-bold text-white"
              >
                {tf.saveChanges}
              </button>
            </div>
          ) : (
            <>
              {current.caption && (
                <p className="px-6 pt-3 text-center text-[14px] leading-snug text-[#E8EDEA]">{current.caption}</p>
              )}
              <span
                className="mx-auto mt-2 w-fit rounded-full px-3 py-1 text-[10px] font-extrabold tracking-wide text-white"
                style={{ background: photoTagColor(current.tag) }}
              >
                {tagLabel(current.tag)}
              </span>
              {activeProject !== "all" && (
                <div className="space-y-2 px-5 pt-3">
                  {coverUrl === current.url ? (
                    <div className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#4F8A63]/20 py-2.5 text-[13px] font-bold text-[#8FD3A3]">
                      <Star size={14} className="fill-current" /> {tf.isCover}
                    </div>
                  ) : (
                    <button
                      onClick={() => setCover(current)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/12 py-2.5 text-[13px] font-bold text-white transition hover:bg-white/20"
                    >
                      <Star size={14} /> {tf.setCover}
                    </button>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => movePhoto(-1)}
                      disabled={(viewIdx ?? 0) === 0}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/12 py-2.5 text-[12px] font-bold text-white transition hover:bg-white/20 disabled:opacity-30"
                    >
                      <MoveLeft size={14} /> {tf.moveEarlier}
                    </button>
                    <button
                      onClick={() => movePhoto(1)}
                      disabled={(viewIdx ?? 0) >= visible.length - 1}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/12 py-2.5 text-[12px] font-bold text-white transition hover:bg-white/20 disabled:opacity-30"
                    >
                      {tf.moveLater} <MoveRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          <div className="flex gap-2.5 px-4 py-4" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
            <button
              onClick={() => { setViewIdx(((viewIdx ?? 0) - 1 + visible.length) % visible.length); setConfirmDel(false); setEditMode(false); }}
              className="flex-1 rounded-xl bg-white/12 py-3.5 text-[14px] font-bold text-white"
            >
              {tf.prev}
            </button>
            <button
              onClick={() => setConfirmDel(true)}
              aria-label={tf.deleteQuestion}
              className="rounded-xl bg-[#B0492F]/70 px-4 py-3.5 text-white transition hover:bg-[#B0492F]"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={() => { setViewIdx(((viewIdx ?? 0) + 1) % visible.length); setConfirmDel(false); setEditMode(false); }}
              className="flex-1 rounded-xl bg-white/12 py-3.5 text-[14px] font-bold text-white"
            >
              {tf.next}
            </button>
          </div>

          {/* Pregunta de seguridad antes de eliminar */}
          {confirmDel && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-black/70 px-6">
              <div className="w-full max-w-[340px] rounded-2xl bg-white dark:bg-[#111a2e] p-5 text-center">
                <p className="text-[15px] font-bold leading-snug text-[var(--brand)]">{tf.deleteQuestion}</p>
                <div className="mt-4 flex gap-2.5">
                  <button
                    onClick={() => setConfirmDel(false)}
                    className="flex-1 rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] py-3 text-[13px] font-bold text-[#5C6A6E] dark:text-[#9fb0cc]"
                  >
                    {tf.noKeep}
                  </button>
                  <button
                    onClick={() => deletePhoto(current)}
                    className="flex-1 rounded-xl bg-[#B0492F] py-3 text-[13px] font-bold text-white"
                  >
                    {tf.yesDelete}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
