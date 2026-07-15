"use client";

import { useRef, useState } from "react";
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
  projectId, projectTitle, toast,
}: {
  projectId: string;
  projectTitle: string;
  toast: (msg: string) => void;
}) {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const tf = t.panel.fotos;

  const [pending, setPending] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploadStep, setUploadStep] = useState(0);
  const [camOpen, setCamOpen] = useState(false);
  const fallbackRef = useRef<HTMLInputElement>(null);
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

  const close = () => {
    previews.forEach(URL.revokeObjectURL);
    setPending([]);
    setPreviews([]);
    setUploadStep(0);
  };

  const upload = async ({ caption, tag, album }: { caption: string; tag: string; album: string }) => {
    if (!pending.length || uploadStep > 0) return;
    let ok = 0;
    for (let i = 0; i < pending.length; i++) {
      setUploadStep(i + 1);
      try {
        await uploadProjectPhoto({ projectId, file: pending[i], caption, tag, album });
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
      {/* Cámara in-app (getUserMedia) — el picker/intent del sistema está roto en varios Android (MIUI) */}
      <button
        onClick={() => {
          if (typeof navigator.mediaDevices?.getUserMedia === "function") setCamOpen(true);
          else fallbackRef.current?.click();
        }}
        aria-label={`${tf.takePhoto} — ${projectTitle}`}
        className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-[#E6DDCB] bg-white text-[#B0492F] transition hover:bg-[#FDF0ED] active:scale-95"
      >
        <Camera size={16} />
      </button>
      <input ref={fallbackRef} type="file" accept="image/*" className="sr-only"
        onChange={e => { pick(e.target.files); e.target.value = ""; }} />
      <CameraCapture
        open={camOpen}
        onClose={() => setCamOpen(false)}
        onCapture={file => pick([file])}
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
            <>
              <button
                onClick={openGallery}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-[#D7CBB3] bg-[#F7F3EA] px-3 py-2 text-[12px] font-bold text-[#16323D]"
              >
                <Images size={14} /> {tf.fromGallery}
              </button>
              <input ref={imgInputRef} type="file" accept="image/*" multiple className="sr-only"
                onChange={e => { pick(e.target.files); e.target.value = ""; dismissFallback(); }} />
              <input ref={anyInputRef} type="file" multiple className="sr-only"
                onChange={e => { pick(e.target.files); e.target.value = ""; dismissFallback(); }} />
            </>
          }
          topSlot={fallbackVisible && (
            <button
              onClick={openFileManager}
              className="mb-2.5 w-full rounded-xl border-2 border-dashed border-[#B98A2F] bg-[#FBF5E6] px-3 py-2.5 text-[12px] font-bold text-[#7A6230] transition active:scale-[0.98]"
            >
              {tf.pickerRetry}
            </button>
          )}
        />
      )}
    </>
  );
}
