"use client";

import { useState, useRef, useEffect } from "react";
import { Lock, X } from "lucide-react";
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
      setError("PIN incorrecto");
      setPin("");
      pinRef.current?.focus();
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && pin.length === 4) handleSubmit();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[99]" onClick={onClose} />

      {/* Floating card — top-right, below navbar */}
      <div className="fixed right-3 top-[66px] z-[100] w-[272px] animate-in slide-in-from-top-2 duration-200 sm:right-5">
        <div className="overflow-hidden rounded-[18px] border border-[#E6DDCB] bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E6DDCB] bg-[#F7F3EA] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-md bg-[#7B1838] text-white">
                <Lock size={11} />
              </span>
              <span className="text-[13px] font-bold text-[#16323D]">Acceso admin</span>
            </div>
            <button
              onClick={onClose}
              className="grid size-6 place-items-center rounded-md text-[#5C6A6E] transition hover:bg-[#ECE3D1]"
            >
              <X size={14} />
            </button>
          </div>

          <div className="p-4">
            {/* PIN dots */}
            <div className="mb-3 flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`size-3 rounded-full transition-all duration-100 ${
                    pin.length > i ? "scale-110 bg-[#16323D]" : "bg-[#E6DDCB]"
                  }`}
                />
              ))}
            </div>

            {/* PIN input */}
            <input
              ref={pinRef}
              id="admin-pin-input"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                setError("");
              }}
              onKeyDown={handleKeyDown}
              className="mb-2 h-11 w-full rounded-xl border border-[#E6DDCB] bg-[#F7F3EA] text-center font-mono text-xl tracking-[1.5em] text-[#16323D] placeholder:tracking-normal placeholder:text-[#C4B89A] focus:border-[#16323D] focus:outline-none focus:ring-2 focus:ring-[#16323D]/15"
              placeholder="••••"
              autoComplete="off"
            />

            {/* Error / hint */}
            {error ? (
              <p className="mb-2 text-center text-[11px] font-semibold text-[#B0492F]">{error}</p>
            ) : (
              <p className="mb-2 text-center text-[11px] text-[#97A1A0]">
                Demo: <b className="text-[#5C6A6E]">1234</b>
              </p>
            )}

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl bg-[#ECE3D1] py-2.5 text-sm font-bold text-[#5C6A6E] transition hover:bg-[#D7CBB3]"
              >
                Cancelar
              </button>
              <button
                id="admin-login-btn"
                onClick={handleSubmit}
                disabled={loading || pin.length < 4}
                className="flex-1 rounded-xl bg-[#7B1838] py-2.5 text-sm font-bold text-white transition hover:bg-[#641430] disabled:opacity-40"
              >
                {loading ? "…" : "Entrar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
