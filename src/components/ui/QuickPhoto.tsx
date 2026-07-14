"use client";

import { useState } from "react";
import { Camera, Images } from "lucide-react";
import { logActivity } from "@/src/lib/activity";
import { PHOTO_TAG_ORDER, PHOTO_TAG_COLORS, uploadProjectPhoto } from "@/src/lib/photos";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import type { PhotoTag } from "@/src/types/project";

// Botón 📷 compacto que sube fotos SIEMPRE ancladas al proyecto que lo renderiza
export default function QuickPhoto({
  projectId, projectTitle, toast,
}: {
  projectId: string;
  projectTitle: string;
  toast: (msg: string) => void;
}) {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const tf = t.panel.fotos;

  const TAG_LABELS: Record<PhotoTag, string> = {
    antes: tf.tagAntes, avance: tf.tagAvance, despues: tf.tagDespues,
    problema: tf.tagProblema, material: tf.tagMaterial,
  };

  const [pending, setPending] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [tag, setTag] = useState<PhotoTag>("avance");
  const [uploadStep, setUploadStep] = useState(0);

  const pick = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = [...files].filter(f => f.type.startsWith("image/"));
    previews.forEach(URL.revokeObjectURL);
    setPending(arr);
    setPreviews(arr.map(f => URL.createObjectURL(f)));
    setCaption("");
    setTag("avance");
  };

  const close = () => {
    previews.forEach(URL.revokeObjectURL);
    setPending([]);
    setPreviews([]);
    setUploadStep(0);
  };

  const upload = async () => {
    if (!pending.length || uploadStep > 0) return;
    let ok = 0;
    for (let i = 0; i < pending.length; i++) {
      setUploadStep(i + 1);
      try {
        await uploadProjectPhoto({ projectId, file: pending[i], caption, tag });
        ok++;
      } catch {
        toast(tf.uploadError);
      }
    }
    if (ok > 0) {
      logActivity({
        user_id: currentUser?.id, user_name: currentUser?.name,
        user_role: currentUser?.role ?? "colaborador",
        action: "create", entity_type: "photo",
        entity_name: `${ok} ${tf.photosWord}`, project_id: projectId,
      });
      toast(`✓ ${ok} ${tf.uploaded} — ${projectTitle}`);
    }
    close();
  };

  return (
    <>
      {/* label nativo sin `capture` — el intent directo de cámara falla en silencio en varios Android
          (permiso de cámara del navegador denegado, quirks OEM); el picker nativo siempre abre e incluye "Cámara" */}
      <label
        aria-label={`${tf.takePhoto} — ${projectTitle}`}
        className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-[#E6DDCB] bg-white text-[#B0492F] transition hover:bg-[#FDF0ED] active:scale-95"
      >
        <input type="file" accept="image/*" className="sr-only"
          onChange={e => { pick(e.target.files); e.target.value = ""; }} />
        <Camera size={16} />
      </label>

      {pending.length > 0 && (
        <div className="fixed inset-0 z-[310] flex items-end justify-center bg-[#16323D]/60 backdrop-blur-sm sm:items-center">
          <div className="max-h-[92vh] w-full max-w-[440px] overflow-y-auto rounded-t-[22px] bg-white p-4 sm:rounded-[20px]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-bold text-[#16323D]">📷 {projectTitle}</div>
                <div className="text-[12px] text-[#97A1A0]">{tf.title}</div>
              </div>
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-[#D7CBB3] bg-[#F7F3EA] px-3 py-2 text-[12px] font-bold text-[#16323D]">
                <input type="file" accept="image/*" multiple className="sr-only"
                  onChange={e => { pick(e.target.files); e.target.value = ""; }} />
                <Images size={14} /> {tf.fromGallery}
              </label>
            </div>

            <div className={`grid gap-2 ${previews.length === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
              {previews.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" className={`w-full rounded-xl object-cover ${previews.length === 1 ? "max-h-[240px]" : "aspect-square"}`} />
              ))}
            </div>

            <input
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder={tf.captionPlaceholder}
              className="mt-3 w-full rounded-xl border border-[#E6DDCB] bg-[#F7F3EA] px-3.5 py-3 text-[15px] text-[#16323D] placeholder:text-[#9CABB0] focus:border-[#395886] focus:outline-none"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {PHOTO_TAG_ORDER.map(tg => (
                <button
                  key={tg}
                  onClick={() => setTag(tg)}
                  className="rounded-full border-2 px-3.5 py-1.5 text-[12px] font-bold transition"
                  style={tag === tg
                    ? { background: PHOTO_TAG_COLORS[tg], borderColor: PHOTO_TAG_COLORS[tg], color: "#fff" }
                    : { borderColor: "#E6DDCB", color: "#5C6A6E", background: "#fff" }}
                >
                  {TAG_LABELS[tg]}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2.5">
              <button
                onClick={close}
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
        </div>
      )}
    </>
  );
}
