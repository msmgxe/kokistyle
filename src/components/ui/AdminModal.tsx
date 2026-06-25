/**
 * AdminModal — Modal de acceso administrador con PIN.
 * Se muestra al presionar el botón "Admin" en el Navbar de KokiStyle.
 * En producción, el PIN se puede reemplazar por Supabase Auth (email + password).
 */
"use client";

import { useState, useRef, useEffect } from "react";
import { Lock } from "lucide-react";
import { useAuth } from "@/src/context/AuthContext";
import { useRouter } from "next/navigation";

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminModal({ isOpen, onClose }: AdminModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);
  const { login } = useAuth();
  const router = useRouter();

  // Focus the PIN input when the modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => pinRef.current?.focus(), 60);
      setPin("");
      setError("");
    }
  }, [isOpen]);

  const handleSubmit = () => {
    setLoading(true);
    const success = login(pin);
    if (success) {
      onClose();
      router.push("/proyectos");
    } else {
      setError("PIN incorrecto. Intenta de nuevo.");
      setPin("");
      pinRef.current?.focus();
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  if (!isOpen) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-[#16323D]/55 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-modal-title"
    >
      {/* Modal card */}
      <div className="w-full max-w-[460px] rounded-t-[22px] bg-[#F7F3EA] p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 sm:rounded-[20px]">
        {/* Header */}
        <div className="mb-1 flex items-center gap-3">
          <span className="grid size-9 flex-none place-items-center rounded-[10px] bg-[#16323D] text-white">
            <Lock size={18} />
          </span>
          <h2 id="admin-modal-title" className="font-[Manrope] text-xl font-bold text-[#16323D]">
            Acceso de administrador
          </h2>
        </div>
        <p className="mb-5 text-sm text-[#5C6A6E]">
          Esta información no es pública. Ingresa tu PIN para entrar a tu zona de proyectos.
        </p>

        {/* PIN Input */}
        <div className="mb-1 flex justify-center">
          <input
            ref={pinRef}
            id="admin-pin-input"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError("");
            }}
            onKeyDown={handleKeyDown}
            className="h-16 w-36 rounded-[13px] border border-[#E6DDCB] bg-white text-center font-mono text-3xl tracking-[0.8em] text-[#16323D] placeholder:text-[#97A1A0] focus:border-[#16323D] focus:outline-none focus:ring-2 focus:ring-[#16323D]/20"
            placeholder="••••"
            autoComplete="off"
          />
        </div>

        {/* Error */}
        <p className="mb-1 min-h-[18px] text-center text-xs font-semibold text-[#B0492F]">
          {error}
        </p>

        {/* Demo hint */}
        <p className="mb-5 text-center text-xs text-[#5C6A6E]">
          PIN demo: <b className="font-bold text-[#16323D]">1234</b>
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-[#ECE3D1] px-4 py-3 font-bold text-[#5C6A6E] transition hover:bg-[#D7CBB3]"
          >
            Cancelar
          </button>
          <button
            id="admin-login-btn"
            onClick={handleSubmit}
            disabled={loading || pin.length < 4}
            className="flex-1 rounded-xl bg-[#16323D] px-4 py-3 font-bold text-white transition hover:bg-[#0E2630] disabled:opacity-50"
          >
            {loading ? "Verificando…" : "Entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
