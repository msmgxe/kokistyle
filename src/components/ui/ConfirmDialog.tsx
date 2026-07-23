"use client";

import { AlertTriangle } from "lucide-react";
import { useLanguage } from "@/src/context/LanguageContext";

// Diálogo de seguridad compartido para acciones destructivas en toda la app.
// Los textos (title/body/label) los pasa el llamador ya localizados; el botón
// Cancelar sale de translations para mantenerlo bilingüe.
export default function ConfirmDialog({
  title, body, label, onConfirm, onCancel, danger = true, busy = false,
}: {
  title: string;
  body: string;
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  busy?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div
      className="fixed inset-0 z-[360] flex items-end justify-center bg-[var(--brand)]/55 backdrop-blur-sm sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[440px] rounded-t-[22px] bg-[#F7F3EA] dark:bg-[#0b1220] p-6 shadow-2xl sm:rounded-[20px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start gap-3">
          <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${danger ? "bg-[#F7E4DE] dark:bg-[#3a1d17] text-[#B0492F]" : "bg-[#EDF3FB] dark:bg-[#17233d] text-[var(--brand)]"}`}>
            <AlertTriangle size={18} />
          </span>
          <h3 className="mt-1.5 text-lg font-bold text-[var(--brand)]">{title}</h3>
        </div>
        <p className="mb-5 text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">{body}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] py-3 font-bold text-[#5C6A6E] dark:text-[#9fb0cc] disabled:opacity-50"
          >
            {t.panel.common.cancel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 rounded-xl py-3 font-bold text-white disabled:opacity-60 ${danger ? "bg-[#B0492F]" : "bg-[var(--brand)]"}`}
          >
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}
