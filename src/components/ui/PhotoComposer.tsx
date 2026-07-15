"use client";

import { useState } from "react";
import { PHOTO_TAG_ORDER, photoTagColor } from "@/src/lib/photos";
import { useLanguage } from "@/src/context/LanguageContext";
import type { PhotoTag } from "@/src/types/project";

// Modal compositor de fotos — bottom-sheet compartido por los 3 accesos:
// página /proyectos/fotos, tab Fotos del proyecto (ProjectPhotos) y QuickPhoto (📷 en Hoy).
// Solo maneja el paso de composición (comentario, etiqueta, carpeta); el padre dueño de los
// archivos hace la subida real vía onUpload.
export default function PhotoComposer({
  title, subtitle, previews, fileCount, uploadStep,
  albums = [], headerAction, topSlot, onCancel, onUpload,
}: {
  title: string;
  subtitle?: string;
  previews: string[];
  fileCount: number;
  uploadStep: number;                                     // 0 = idle, >0 = subiendo i/n
  albums?: string[];
  headerAction?: React.ReactNode;                         // p.ej. botón "Desde galería" + inputs ocultos
  topSlot?: React.ReactNode;                              // p.ej. botón de respaldo MIUI
  onCancel: () => void;
  onUpload: (data: { caption: string; tag: string; album: string }) => void;
}) {
  const { t } = useLanguage();
  const tf = t.panel.fotos;

  const KNOWN_LABELS: Record<string, string> = {
    antes: tf.tagAntes, avance: tf.tagAvance, despues: tf.tagDespues,
    problema: tf.tagProblema, material: tf.tagMaterial,
  };
  const tagLabel = (tg: string) => KNOWN_LABELS[tg] ?? tg.toUpperCase();

  const [caption, setCaption] = useState("");
  const [tag, setTag] = useState<PhotoTag>("avance");
  const [customTag, setCustomTag] = useState<string | null>(null);  // null = chip conocido activo
  const [album, setAlbum] = useState("");

  const effectiveTag = customTag !== null && customTag.trim() ? customTag.trim().toLowerCase() : tag;

  return (
    <div className="fixed inset-0 z-[310] flex items-end justify-center bg-[var(--brand)]/60 backdrop-blur-sm sm:items-center">
      <div className="max-h-[92vh] w-full max-w-[440px] overflow-y-auto rounded-t-[22px] bg-white p-4 sm:rounded-[20px]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold text-[var(--brand)]">📷 {title}</div>
            <div className="text-[12px] text-[#97A1A0]">{subtitle ?? tf.title}</div>
          </div>
          {headerAction}
        </div>

        {topSlot}

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
          className="mt-3 w-full rounded-xl border border-[#E6DDCB] bg-[#F7F3EA] px-3.5 py-3 text-[15px] text-[var(--brand)] placeholder:text-[#9CABB0] focus:border-[var(--accent)] focus:outline-none"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {PHOTO_TAG_ORDER.map(tg => (
            <button
              key={tg}
              onClick={() => { setTag(tg); setCustomTag(null); }}
              className="rounded-full border-2 px-3.5 py-1.5 text-[12px] font-bold transition"
              style={customTag === null && tag === tg
                ? { background: photoTagColor(tg), borderColor: photoTagColor(tg), color: "#fff" }
                : { borderColor: "#E6DDCB", color: "#5C6A6E", background: "#fff" }}
            >
              {tagLabel(tg)}
            </button>
          ))}
          <button
            onClick={() => setCustomTag(prev => prev === null ? "" : null)}
            className="rounded-full border-2 border-dashed px-3.5 py-1.5 text-[12px] font-bold transition"
            style={customTag !== null
              ? { borderColor: "var(--brand)", color: "var(--brand)", background: "#F7F3EA" }
              : { borderColor: "#D7CBB3", color: "#97A1A0", background: "#fff" }}
          >
            {tf.tagCustom}
          </button>
        </div>
        {customTag !== null && (
          <input
            autoFocus
            value={customTag}
            onChange={e => setCustomTag(e.target.value)}
            placeholder={tf.customTagPlaceholder}
            className="mt-2 w-full rounded-xl border border-[#E6DDCB] bg-[#F7F3EA] px-3.5 py-2.5 text-[14px] uppercase text-[var(--brand)] placeholder:normal-case placeholder:text-[#9CABB0] focus:border-[var(--accent)] focus:outline-none"
          />
        )}

        <input
          value={album}
          onChange={e => setAlbum(e.target.value)}
          list="photo-composer-albums"
          placeholder={tf.albumPlaceholder}
          className="mt-2 w-full rounded-xl border border-[#E6DDCB] bg-[#F7F3EA] px-3.5 py-2.5 text-[14px] text-[var(--brand)] placeholder:text-[#9CABB0] focus:border-[var(--accent)] focus:outline-none"
        />
        <datalist id="photo-composer-albums">
          {albums.map(a => <option key={a} value={a} />)}
        </datalist>

        <div className="mt-4 flex gap-2.5">
          <button
            onClick={onCancel}
            disabled={uploadStep > 0}
            className="flex-1 rounded-xl bg-[#ECE3D1] py-3 text-[14px] font-bold text-[#5C6A6E] disabled:opacity-50"
          >
            {tf.cancel}
          </button>
          <button
            onClick={() => onUpload({ caption, tag: effectiveTag, album })}
            disabled={uploadStep > 0}
            className="flex-1 rounded-xl bg-[#4F8A63] py-3 text-[14px] font-bold text-white disabled:opacity-70"
          >
            {uploadStep > 0
              ? `${tf.uploading} ${uploadStep}/${fileCount}…`
              : `${tf.upload}${fileCount > 1 ? ` (${fileCount})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
