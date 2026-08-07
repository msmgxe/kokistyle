"use client";

import { useEffect, useState } from "react";
import { RotateCcw, RotateCw } from "lucide-react";
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
  // `rotations` va alineado a previews: grados horarios a hornear en cada archivo
  onUpload: (data: { caption: string; tag: string; album: string; rotations: number[] }) => void;
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
  // Rotación por foto: se elige aquí y se hornea al subir (uploadProjectPhoto → rotate)
  const [rotations, setRotations] = useState<Record<number, number>>({});
  const [sel, setSel] = useState<number | null>(null);

  // Al cambiar la selección de archivos (p.ej. "Del carrete" dentro del modal) se reinicia
  useEffect(() => {
    setRotations({});
    setSel(previews.length === 1 ? 0 : null);
  }, [previews]);

  const rotateSel = (deg: number) => {
    if (sel === null) return;
    setRotations(r => ({ ...r, [sel]: (((r[sel] ?? 0) + deg) % 360 + 360) % 360 }));
  };

  const effectiveTag = customTag !== null && customTag.trim() ? customTag.trim().toLowerCase() : tag;

  return (
    <div className="fixed inset-0 z-[310] flex items-end justify-center bg-[var(--brand)]/60 backdrop-blur-sm sm:items-center">
      <div className="max-h-[92vh] w-full max-w-[440px] overflow-y-auto rounded-t-[22px] bg-white dark:bg-[#111a2e] p-4 sm:rounded-[20px]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold text-[var(--brand)]">📷 {title}</div>
            <div className="text-[12px] text-[#97A1A0] dark:text-[#728098]">{subtitle ?? tf.title}</div>
          </div>
          {headerAction}
        </div>

        {topSlot}

        {/* Cuadros cuadrados + object-contain: al girar 90° la foto sigue entrando entera */}
        <div className={`grid justify-items-center gap-2 ${previews.length === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
          {previews.map((src, i) => {
            const deg = rotations[i] ?? 0;
            return (
              <button
                key={i}
                onClick={() => setSel(s => (s === i ? null : i))}
                aria-pressed={sel === i}
                aria-label={`${tf.rotateSelected} ${i + 1}`}
                className={`relative aspect-square w-full overflow-hidden rounded-xl bg-[#F7F3EA] dark:bg-[#0b1220] transition ${
                  previews.length === 1 ? "max-w-[280px]" : ""
                } ${sel === i ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-white dark:ring-offset-[#111a2e]" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  style={{ transform: `rotate(${deg}deg)` }}
                  className="h-full w-full object-contain transition-transform duration-200"
                />
                {deg !== 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-[var(--brand)]/85 px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                    {deg}°
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Rotar de a una: se toca la foto y aparecen los giros */}
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 py-2">
          <span className="min-w-0 truncate text-[12px] font-semibold text-[#5C6A6E] dark:text-[#9fb0cc]">
            {sel === null ? tf.rotateHint : `${tf.rotateSelected} ${sel + 1}/${previews.length}`}
          </span>
          <div className="flex shrink-0 gap-1.5">
            <button
              onClick={() => rotateSel(-90)}
              disabled={sel === null}
              aria-label={tf.rotateLeft}
              className="grid size-9 place-items-center rounded-lg border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] text-[var(--brand)] transition hover:bg-[#ECE3D1] dark:hover:bg-[#17233d] active:scale-95 disabled:opacity-40"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={() => rotateSel(90)}
              disabled={sel === null}
              aria-label={tf.rotateRight}
              className="grid size-9 place-items-center rounded-lg border border-[#D7CBB3] dark:border-[#2c3c5e] bg-white dark:bg-[#111a2e] text-[var(--brand)] transition hover:bg-[#ECE3D1] dark:hover:bg-[#17233d] active:scale-95 disabled:opacity-40"
            >
              <RotateCw size={16} />
            </button>
          </div>
        </div>

        <input
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder={tf.captionPlaceholder}
          className="mt-3 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3.5 py-3 text-[15px] text-[var(--brand)] placeholder:text-[#9CABB0] dark:placeholder:text-[#9fb0cc] focus:border-[var(--accent)] focus:outline-none"
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
            className="mt-2 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3.5 py-2.5 text-[14px] uppercase text-[var(--brand)] placeholder:normal-case placeholder:text-[#9CABB0] dark:placeholder:text-[#9fb0cc] focus:border-[var(--accent)] focus:outline-none"
          />
        )}

        <input
          value={album}
          onChange={e => setAlbum(e.target.value)}
          list="photo-composer-albums"
          placeholder={tf.albumPlaceholder}
          className="mt-2 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3.5 py-2.5 text-[14px] text-[var(--brand)] placeholder:text-[#9CABB0] dark:placeholder:text-[#9fb0cc] focus:border-[var(--accent)] focus:outline-none"
        />
        <datalist id="photo-composer-albums">
          {albums.map(a => <option key={a} value={a} />)}
        </datalist>

        <div className="mt-4 flex gap-2.5">
          <button
            onClick={onCancel}
            disabled={uploadStep > 0}
            className="flex-1 rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] py-3 text-[14px] font-bold text-[#5C6A6E] dark:text-[#9fb0cc] disabled:opacity-50"
          >
            {tf.cancel}
          </button>
          <button
            onClick={() => onUpload({ caption, tag: effectiveTag, album, rotations: previews.map((_, i) => rotations[i] ?? 0) })}
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
