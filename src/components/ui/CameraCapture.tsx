"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, RefreshCcw } from "lucide-react";
import { useLanguage } from "@/src/context/LanguageContext";

// Cámara in-app via getUserMedia — no depende del picker/intent del sistema,
// roto en varios Android (MIUI/OEM). El permiso se pide como prompt web del sitio.
export default function CameraCapture({
  open, onClose, onCapture, toast,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  toast: (msg: string) => void;
}) {
  const { t } = useLanguage();
  const tf = t.panel.fotos;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(tr => tr.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setReady(false);
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(tr => tr.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) { v.srcObject = stream; await v.play(); }
        setReady(true);
      } catch (e) {
        const name = (e as DOMException)?.name;
        toast(
          name === "NotAllowedError" || name === "SecurityError" ? tf.camDenied
          : name === "NotFoundError" || name === "OverconstrainedError" ? tf.camUnavailable
          : `${tf.camError}${name ? ` (${name})` : ""}`
        );
        onClose();
      }
    })();
    return () => { cancelled = true; stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facing]);

  const shutter = async () => {
    const v = videoRef.current;
    if (!v || !ready) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 1280;
    canvas.height = v.videoHeight || 960;
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/jpeg", 0.9));
    if (!blob) { toast(tf.camError); return; }
    stop();
    onCapture(new File([blob], `captura-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() }));
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[320] flex flex-col bg-black">
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}
      >
        <span className="text-[14px] font-bold text-white/85">{tf.takePhoto}</span>
        <button
          onClick={() => { stop(); onClose(); }}
          aria-label={tf.cancel}
          className="grid size-10 place-items-center rounded-xl bg-white/15 text-white"
        >
          <X size={18} />
        </button>
      </div>

      <video ref={videoRef} muted playsInline className="min-h-0 w-full flex-1 bg-black object-cover" />

      <div
        className="flex items-center justify-center gap-10 py-5"
        style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={() => setFacing(f => (f === "environment" ? "user" : "environment"))}
          aria-label={tf.flipCam}
          className="grid size-12 place-items-center rounded-full bg-white/15 text-white active:scale-90"
        >
          <RefreshCcw size={19} />
        </button>
        <button
          onClick={shutter}
          aria-label={tf.shutter}
          disabled={!ready}
          className="grid size-[74px] place-items-center rounded-full border-4 border-white bg-white/20 transition active:scale-90 disabled:opacity-40"
        >
          <span className="block size-[54px] rounded-full bg-white dark:bg-[#111a2e]" />
        </button>
        <span className="size-12" aria-hidden />
      </div>
    </div>
  );
}
