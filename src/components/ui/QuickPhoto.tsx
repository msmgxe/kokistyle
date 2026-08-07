"use client";

import { useState, type ReactNode } from "react";
import { Camera, Images } from "lucide-react";
import { logActivity } from "@/src/lib/activity";
import { uploadProjectPhoto } from "@/src/lib/photos";
import CameraCapture from "@/src/components/ui/CameraCapture";
import PhotoComposer from "@/src/components/ui/PhotoComposer";
import { useGalleryPicker } from "@/src/components/ui/useGalleryPicker";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";

// Botón 📷 compacto que sube fotos SIEMPRE ancladas al proyecto que lo renderiza
export default function QuickPhoto({
  projectId, projectTitle, toast, className, children, onUploaded,
}: {
  projectId: string;
  projectTitle: string;
  toast: (msg: string) => void;
  className?: string;        // estilo del disparador cuando el host lo necesita distinto
  children?: ReactNode;      // contenido del disparador (default: ícono 📷)
  onUploaded?: () => void;    // refresca la vista que lo renderiza tras subir
}) {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const tf = t.panel.fotos;

  const [pending, setPending] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploadStep, setUploadStep] = useState(0);
  const [camOpen, setCamOpen] = useState(false);
  const {
    imgInputRef, anyInputRef, openGallery, openFileManager, fallbackVisible, dismissFallback,
  } = useGalleryPicker(() => toast(tf.pickerBlocked));

  const pick = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const arr = [...files].filter(f => f.type.startsWith("image/"));
    previews.forEach(URL.revokeObjectURL);
    setPending(arr);
    setPreviews(arr.map(f => URL.createObjectURL(f)));
  };

  // En escritorio "subir" es elegir un archivo: la cámara in-app existe por los Android
  // (MIUI) donde el intent del sistema está roto, y en una laptop pide la webcam o
  // se cierra sin más. Puntero grueso = teléfono/tableta → cámara; si no, archivos.
  const openCapture = () => {
    const handheld = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    if (handheld && typeof navigator.mediaDevices?.getUserMedia === "function") { setCamOpen(true); return; }
    openGallery();
  };

  const close = () => {
    previews.forEach(URL.revokeObjectURL);
    setPending([]);
    setPreviews([]);
    setUploadStep(0);
  };

  const upload = async ({ caption, tag, album, rotations }: { caption: string; tag: string; album: string; rotations: number[] }) => {
    if (!pending.length || uploadStep > 0) return;
    let ok = 0;
    for (let i = 0; i < pending.length; i++) {
      setUploadStep(i + 1);
      try {
        await uploadProjectPhoto({ projectId, file: pending[i], caption, tag, album, rotate: rotations[i] ?? 0 });
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
      onUploaded?.();
    }
    close();
  };

  return (
    <>
      {/* Cámara in-app (getUserMedia) — el picker/intent del sistema está roto en varios Android (MIUI) */}
      <button
        onClick={openCapture}
        aria-label={`${tf.takePhoto} — ${projectTitle}`}
        className={className ?? "grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] text-[#B0492F] transition hover:bg-[#FDF0ED] dark:hover:bg-[#2a1712] active:scale-95"}
      >
        {children ?? <Camera size={16} />}
      </button>
      {/* Los inputs viven fuera del compositor: openGallery() se usa también como
          disparador inicial (escritorio) y necesita el input montado desde el inicio. */}
      <input ref={imgInputRef} type="file" accept="image/*" multiple className="sr-only"
        onChange={e => { pick(e.target.files); e.target.value = ""; dismissFallback(); }} />
      <input ref={anyInputRef} type="file" multiple className="sr-only"
        onChange={e => { pick(e.target.files); e.target.value = ""; dismissFallback(); }} />
      <CameraCapture
        open={camOpen}
        onClose={() => setCamOpen(false)}
        onCapture={file => pick([file])}
        onUnavailable={openGallery}
        toast={toast}
      />

      {pending.length > 0 && (
        <PhotoComposer
          title={projectTitle}
          previews={previews}
          fileCount={pending.length}
          uploadStep={uploadStep}
          onCancel={close}
          onUpload={upload}
          headerAction={
            <button
              onClick={openGallery}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 py-2 text-[12px] font-bold text-[var(--brand)]"
            >
              <Images size={14} /> {tf.fromGallery}
            </button>
          }
          topSlot={fallbackVisible && (
            <button
              onClick={openFileManager}
              className="mb-2.5 w-full rounded-xl border-2 border-dashed border-[#B98A2F] bg-[#FBF5E6] dark:bg-[#17233d] px-3 py-2.5 text-[12px] font-bold text-[#7A6230] transition active:scale-[0.98]"
            >
              {tf.pickerRetry}
            </button>
          )}
        />
      )}
    </>
  );
}
