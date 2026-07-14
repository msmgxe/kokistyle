"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Trash2 } from "lucide-react";
import CameraCapture from "@/src/components/ui/CameraCapture";
import { useGalleryPicker } from "@/src/components/ui/useGalleryPicker";
import { supabase } from "@/src/lib/supabase";
import { logActivity } from "@/src/lib/activity";
import {
  PHOTOS_BUCKET, PHOTO_TAG_ORDER, PHOTO_TAG_COLORS, uploadProjectPhoto,
} from "@/src/lib/photos";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import type { ProjectPhoto, PhotoTag } from "@/src/types/project";

const TAG_COLORS = PHOTO_TAG_COLORS;
const TAG_ORDER = PHOTO_TAG_ORDER;
const BUCKET = PHOTOS_BUCKET;

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ProjectPhotos({
  projectId, projects, toast,
}: {
  projectId?: string;                                            // fijo → tab del proyecto
  projects?: { id: string; title: string; client?: string }[];   // selector → página global
  toast: (msg: string) => void;
}) {
  const { t, language } = useLanguage();
  const { currentUser } = useAuth();
  const tf = t.panel.fotos;
  const EN = language === "en";

  const TAG_LABELS: Record<PhotoTag, string> = {
    antes: tf.tagAntes, avance: tf.tagAvance, despues: tf.tagDespues,
    problema: tf.tagProblema, material: tf.tagMaterial,
  };

  const [selProject, setSelProject] = useState<string>(projectId ?? projects?.[0]?.id ?? "");
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
  const [filter, setFilter] = useState<"all" | PhotoTag>("all");
  const [loading, setLoading] = useState(true);

  const [pending, setPending] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [tag, setTag] = useState<PhotoTag>("avance");
  const [uploadStep, setUploadStep] = useState(0);

  const [viewIdx, setViewIdx] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
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
    let q = supabase
      .from("project_photos")
      .select("*")
      .order("taken_at", { ascending: false })
      .order("created_at", { ascending: false });
    if (activeProject !== "all") q = q.eq("project_id", activeProject);
    const { data, error } = await q;
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
    setCaption("");
    setTag("avance");
  };

  const cancelComposer = () => {
    previews.forEach(URL.revokeObjectURL);
    setPending([]);
    setPreviews([]);
    setUploadStep(0);
  };

  /* ── Subida (comprime + Storage + fila) ────────────────────────────────── */
  const upload = async () => {
    if (!pending.length || uploadStep > 0) return;
    let okCount = 0;
    for (let i = 0; i < pending.length; i++) {
      setUploadStep(i + 1);
      const file = pending[i];
      try {
        await uploadProjectPhoto({ projectId: activeProject, file, caption, tag });
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

  /* ── Derivados ─────────────────────────────────────────────────────────── */
  const visible = useMemo(
    () => photos.filter(p => filter === "all" || p.tag === filter),
    [photos, filter]
  );
  const byDate = useMemo(() => {
    const m = new Map<string, ProjectPhoto[]>();
    for (const p of visible) {
      if (!m.has(p.taken_at)) m.set(p.taken_at, []);
      m.get(p.taken_at)!.push(p);
    }
    return [...m.entries()];
  }, [visible]);

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
      <div className="rounded-2xl border border-[#E6DDCB] bg-white p-4">
        {!projectId && projects && (
          <select
            value={selProject}
            onChange={e => setSelProject(e.target.value)}
            aria-label={tf.selectProject}
            className="mb-3 w-full rounded-xl border border-[#D7CBB3] bg-[#F7F3EA] px-3 py-3 text-[15px] font-semibold text-[#16323D] focus:border-[#395886] focus:outline-none"
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
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#D7CBB3] bg-[#F7F3EA] px-3 py-3.5 text-[15px] font-bold text-[#16323D] transition hover:bg-[#ECE3D1] active:scale-[0.98]"
          >
            {tf.fromGallery}
          </button>
        </div>
        {fallbackVisible && (
          <button
            onClick={openFileManager}
            className="mt-2.5 w-full rounded-xl border-2 border-dashed border-[#B98A2F] bg-[#FBF5E6] px-3 py-3 text-[13px] font-bold text-[#7A6230] transition active:scale-[0.98]"
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

      {/* ── Compositor ── */}
      {pending.length > 0 && (
        <div className="mt-3 rounded-2xl border-2 border-[#395886] bg-white p-4">
          <div className={`grid gap-2 ${previews.length === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
            {previews.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" className={`w-full rounded-xl object-cover ${previews.length === 1 ? "max-h-[260px]" : "aspect-square"}`} />
            ))}
          </div>
          <input
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder={tf.captionPlaceholder}
            className="mt-3 w-full rounded-xl border border-[#E6DDCB] bg-[#F7F3EA] px-3.5 py-3 text-[15px] text-[#16323D] placeholder:text-[#9CABB0] focus:border-[#395886] focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {TAG_ORDER.map(tg => (
              <button
                key={tg}
                onClick={() => setTag(tg)}
                className="rounded-full border-2 px-3.5 py-1.5 text-[12px] font-bold transition"
                style={tag === tg
                  ? { background: TAG_COLORS[tg], borderColor: TAG_COLORS[tg], color: "#fff" }
                  : { borderColor: "#E6DDCB", color: "#5C6A6E", background: "#fff" }}
              >
                {TAG_LABELS[tg]}
              </button>
            ))}
          </div>
          <div className="mt-4 flex gap-2.5">
            <button
              onClick={cancelComposer}
              disabled={uploadStep > 0}
              className="flex-1 rounded-xl bg-[#ECE3D1] py-3 text-[14px] font-bold text-[#5C6A6E] disabled:opacity-50"
            >
              {tf.cancel}
            </button>
            <button
              onClick={upload}
              disabled={uploadStep > 0}
              className="flex-1 rounded-xl bg-[#4F8A63] py-3 text-[14px] font-bold text-white disabled:opacity-70"
            >
              {uploadStep > 0
                ? `${tf.uploading} ${uploadStep}/${pending.length}…`
                : `${tf.upload}${pending.length > 1 ? ` (${pending.length})` : ""}`}
            </button>
          </div>
        </div>
      )}

      {/* ── Filtros ── */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        <button
          onClick={() => setFilter("all")}
          className={`shrink-0 rounded-full border px-4 py-2 text-[13px] font-bold transition ${
            filter === "all" ? "border-[#395886] bg-[#395886] text-white" : "border-[#E6DDCB] bg-white text-[#5C6A6E]"
          }`}
        >
          {tf.all} · {photos.length}
        </button>
        {TAG_ORDER.map(tg => {
          const n = photos.filter(p => p.tag === tg).length;
          if (n === 0) return null;
          return (
            <button
              key={tg}
              onClick={() => setFilter(tg)}
              className="shrink-0 rounded-full border px-4 py-2 text-[13px] font-bold transition"
              style={filter === tg
                ? { background: TAG_COLORS[tg], borderColor: TAG_COLORS[tg], color: "#fff" }
                : { borderColor: "#E6DDCB", background: "#fff", color: "#5C6A6E" }}
            >
              {TAG_LABELS[tg]} · {n}
            </button>
          );
        })}
      </div>

      {/* ── Galería por fecha ── */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#16323D] border-t-transparent" />
        </div>
      ) : visible.length === 0 ? (
        <p className="py-12 text-center text-[14px] italic text-[#97A1A0]">{tf.empty}</p>
      ) : (
        byDate.map(([iso, phs]) => (
          <div key={iso} className="mt-4">
            <div className="mb-2 flex items-baseline gap-2 px-0.5">
              <span className="text-[14px] font-bold text-[#16323D]">{fmtDate(iso)}</span>
              <span className="text-[12px] text-[#97A1A0]">· {phs.length} {tf.photosWord}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
              {phs.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setViewIdx(visible.indexOf(p)); setConfirmDel(false); }}
                  className="relative aspect-square overflow-hidden rounded-xl bg-[#ECE3D1] transition active:scale-[0.97]"
                  aria-label={p.caption ?? TAG_LABELS[p.tag]}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption ?? ""} loading="lazy" className="h-full w-full object-cover" />
                  <span
                    className="absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-white"
                    style={{ background: TAG_COLORS[p.tag] }}
                  >
                    {TAG_LABELS[p.tag]}
                  </span>
                  {activeProject === "all" && (
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/75 to-transparent px-2 pb-1.5 pt-4 text-left text-[10px] font-bold text-white">
                      {projTitle(p.project_id)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      {/* ── Visor ── */}
      {current && (
        <div className="fixed inset-0 z-[300] flex flex-col bg-[#0A161C]/97">
          <div className="flex items-center gap-3 px-4 py-3.5" style={{ paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold text-white">
                {projTitle(current.project_id) || TAG_LABELS[current.tag]}
              </div>
              <div className="text-[12px] text-[#A8C0BC]">
                {fmtDate(current.taken_at)} · {(viewIdx ?? 0) + 1} {tf.of} {visible.length}
              </div>
            </div>
            <button
              onClick={() => setViewIdx(null)}
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
          {current.caption && (
            <p className="px-6 pt-3 text-center text-[14px] leading-snug text-[#E8EDEA]">{current.caption}</p>
          )}
          <span
            className="mx-auto mt-2 w-fit rounded-full px-3 py-1 text-[10px] font-extrabold tracking-wide text-white"
            style={{ background: TAG_COLORS[current.tag] }}
          >
            {TAG_LABELS[current.tag]}
          </span>
          <div className="flex gap-2.5 px-4 py-4" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
            <button
              onClick={() => { setViewIdx(((viewIdx ?? 0) - 1 + visible.length) % visible.length); setConfirmDel(false); }}
              className="flex-1 rounded-xl bg-white/12 py-3.5 text-[14px] font-bold text-white"
            >
              {tf.prev}
            </button>
            <button
              onClick={() => confirmDel ? deletePhoto(current) : setConfirmDel(true)}
              className={`rounded-xl px-4 py-3.5 text-[13px] font-bold text-white transition ${confirmDel ? "bg-[#B0492F]" : "bg-[#B0492F]/60"}`}
            >
              {confirmDel ? tf.confirmDelete : <Trash2 size={16} />}
            </button>
            <button
              onClick={() => { setViewIdx(((viewIdx ?? 0) + 1) % visible.length); setConfirmDel(false); }}
              className="flex-1 rounded-xl bg-white/12 py-3.5 text-[14px] font-bold text-white"
            >
              {tf.next}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
