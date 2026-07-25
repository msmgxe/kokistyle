"use client";

import { useEffect, useMemo } from "react";
import { X, Download } from "lucide-react";
import { useLanguage } from "@/src/context/LanguageContext";

// Modal de vista previa de PDF: muestra el blob en un iframe antes de bajarlo a disco.
// Reutilizable (Cash Flow, Gantt, …). El padre genera el blob y pasa {blob, filename}.
export default function PdfPreviewModal({
  blob, filename, title, onClose,
}: {
  blob: Blob;
  filename: string;
  title?: string;
  onClose: () => void;
}) {
  const { language } = useLanguage();
  const EN = language === "en";
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const download = () => {
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
  };

  return (
    <div className="fixed inset-0 z-[340] flex items-center justify-center bg-[var(--brand)]/60 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div
        className="flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-4 py-3">
          <h3 className="truncate text-[14px] font-bold text-[var(--brand)] dark:text-[#e8edf7]">
            {title ?? (EN ? "PDF preview" : "Vista previa del PDF")}
          </h3>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={download} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3.5 py-2 text-[12px] font-bold text-white transition hover:bg-[#0F2830]">
              <Download size={14} /> {EN ? "Download" : "Descargar"}
            </button>
            <button onClick={onClose} aria-label={EN ? "Close" : "Cerrar"} className="grid size-9 place-items-center rounded-lg border border-[#E6DDCB] dark:border-[#22304d] text-[#5C6A6E] dark:text-[#9fb0cc] transition hover:bg-[#ECE3D1] dark:hover:bg-[#17233d]">
              <X size={16} />
            </button>
          </div>
        </div>
        <iframe src={url} title={filename} className="min-h-0 flex-1 bg-[#525659]" />
      </div>
    </div>
  );
}
