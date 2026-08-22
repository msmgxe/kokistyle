"use client";

import { useState, useRef, useEffect } from "react";
import { Lock, X, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { useAuth } from "@/src/context/AuthContext";
import { useRouter } from "next/navigation";

type Step = "pin" | "forgot_email" | "forgot_code" | "forgot_newpin" | "forgot_done";

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminModal({ isOpen, onClose }: AdminModalProps) {
  const [step,     setStep]     = useState<Step>("pin");
  const [pin,      setPin]      = useState("");
  const [email,    setEmail]    = useState("");
  const [code,     setCode]     = useState("");
  const [newPin,   setNewPin]   = useState("");
  const [newPin2,  setNewPin2]  = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const pinRef   = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef  = useRef<HTMLInputElement>(null);
  const newRef   = useRef<HTMLInputElement>(null);

  const { login } = useAuth();
  const router    = useRouter();

  useEffect(() => {
    if (!isOpen) { setStep("pin"); setPin(""); setEmail(""); setCode(""); setNewPin(""); setNewPin2(""); setError(""); return; }
    setTimeout(() => {
      if (step === "pin")          pinRef.current?.focus();
      if (step === "forgot_email") emailRef.current?.focus();
      if (step === "forgot_code")  codeRef.current?.focus();
      if (step === "forgot_newpin") newRef.current?.focus();
    }, 60);
  }, [isOpen, step]);

  // ── Step: PIN login ────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setLoading(true); setError("");
    const ok = await login(pin);
    setLoading(false);
    if (ok) { onClose(); router.push("/proyectos"); }
    else    { setError("PIN incorrecto"); setPin(""); pinRef.current?.focus(); }
  };

  // ── Step: send recovery email ──────────────────────────────────────────────
  const handleSendCode = async () => {
    if (!email.includes("@")) { setError("Ingresa un email válido"); return; }
    setLoading(true); setError("");
    await fetch("/api/auth/recover", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setStep("forgot_code"); // Always advance (don't reveal if email exists)
  };

  // ── Step: verify code ──────────────────────────────────────────────────────
  const handleVerifyCode = async () => {
    if (code.length !== 6) { setError("El código tiene 6 dígitos"); return; }
    setLoading(true); setError("");
    // Just advance — actual verification happens on reset
    setLoading(false);
    setStep("forgot_newpin");
  };

  // ── Step: reset PIN ────────────────────────────────────────────────────────
  const handleResetPin = async () => {
    if (newPin.length < 6)     { setError("Mínimo 6 dígitos"); return; }
    if (newPin !== newPin2)    { setError("Los PIN no coinciden"); return; }
    setLoading(true); setError("");
    const res  = await fetch("/api/auth/reset-pin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, newPin }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.ok) { setStep("forgot_done"); }
    else         { setError(data.error ?? "Error. Intenta de nuevo."); }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[99]" onClick={onClose} />
      <div className="fixed right-3 top-[66px] z-[100] w-[288px] animate-in slide-in-from-top-2 duration-200 sm:right-5">
        <div className="overflow-hidden rounded-[18px] border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] shadow-2xl">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-4 py-2.5">
            <div className="flex items-center gap-2">
              {step !== "pin" && step !== "forgot_done" && (
                <button onClick={() => { setStep("pin"); setError(""); }}
                  className="mr-1 grid h-6 w-6 place-items-center rounded-md text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#ECE3D1] dark:hover:bg-[#17233d]">
                  <ArrowLeft size={13} />
                </button>
              )}
              <span className="grid size-6 place-items-center rounded-md bg-[#7B1838] text-white">
                {step === "forgot_email" || step === "forgot_code" ? <Mail size={11} /> : <Lock size={11} />}
              </span>
              <span className="text-[13px] font-bold text-[var(--brand)]">
                {step === "pin"          && "Acceso admin"}
                {step === "forgot_email" && "Recuperar PIN"}
                {step === "forgot_code"  && "Código de verificación"}
                {step === "forgot_newpin"&& "Nuevo PIN"}
                {step === "forgot_done"  && "¡Listo!"}
              </span>
            </div>
            <button onClick={onClose}
              className="grid size-6 place-items-center rounded-md text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#ECE3D1] dark:hover:bg-[#17233d]">
              <X size={14} />
            </button>
          </div>

          <div className="p-4">

            {/* ── STEP: PIN ─────────────────────────────────────────── */}
            {step === "pin" && (<>
              <div className="mb-3 flex justify-center gap-3">
                {[0,1,2,3,4,5,6].map(i => (
                  <div key={i} className={`size-2.5 rounded-full transition-all duration-100 ${pin.length > i ? "scale-110 bg-[var(--brand)]" : "bg-[#E6DDCB] dark:bg-[#17233d]"}`} />
                ))}
              </div>
              <input
                ref={pinRef}
                type="password" inputMode="numeric" maxLength={8}
                value={pin}
                onChange={e => { setPin(e.target.value.replace(/\D/g, "").slice(0, 8)); setError(""); }}
                onKeyDown={e => e.key === "Enter" && pin.length >= 4 && handleLogin()}
                className="mb-2 h-11 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] text-center font-mono text-xl tracking-[1em] text-[var(--brand)] placeholder:tracking-normal placeholder:text-[#C4B89A] focus:border-[var(--brand)] focus:outline-none"
                placeholder="••••••••"
                autoComplete="off"
              />
              {error
                ? <p className="mb-2 text-center text-[11px] font-semibold text-[#B0492F]">{error}</p>
                : <p className="mb-2 text-center text-[11px] text-[#97A1A0] dark:text-[#728098]">Ingresa tu PIN de administrador</p>
              }
              <div className="flex gap-2">
                <button onClick={onClose}
                  className="flex-1 rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] py-2.5 text-sm font-bold text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#D7CBB3] dark:hover:bg-[#17233d]">
                  Cancelar
                </button>
                <button onClick={handleLogin} disabled={loading || pin.length < 4}
                  className="flex-1 rounded-xl bg-[#7B1838] py-2.5 text-sm font-bold text-white hover:bg-[#641430] disabled:opacity-40">
                  {loading ? "…" : "Entrar"}
                </button>
              </div>
              <button onClick={() => { setStep("forgot_email"); setError(""); }}
                className="mt-3 w-full text-center text-[11px] text-[#97A1A0] dark:text-[#728098] underline underline-offset-2 hover:text-[#5C6A6E] dark:hover:text-[#9fb0cc]">
                ¿Olvidaste tu PIN?
              </button>
            </>)}

            {/* ── STEP: EMAIL ───────────────────────────────────────── */}
            {step === "forgot_email" && (<>
              <p className="mb-3 text-[12px] text-[#5C6A6E] dark:text-[#9fb0cc]">
                Ingresa tu correo de recuperación y te enviaremos un código de 6 dígitos.
              </p>
              <input
                ref={emailRef}
                type="email" value={email}
                onChange={e => { setEmail(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleSendCode()}
                placeholder="tu@correo.com"
                className="mb-2 h-11 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 text-sm text-[var(--brand)] placeholder:text-[#C4B89A] focus:border-[var(--brand)] focus:outline-none"
              />
              {error && <p className="mb-2 text-[11px] font-semibold text-[#B0492F]">{error}</p>}
              <button onClick={handleSendCode} disabled={loading}
                className="w-full rounded-xl bg-[var(--brand)] py-2.5 text-sm font-bold text-white hover:bg-[var(--brand-strong)] disabled:opacity-40">
                {loading ? "Enviando…" : "Enviar código"}
              </button>
            </>)}

            {/* ── STEP: CODE ────────────────────────────────────────── */}
            {step === "forgot_code" && (<>
              <p className="mb-3 text-[12px] text-[#5C6A6E] dark:text-[#9fb0cc]">
                Revisa tu correo. Ingresa el código de 6 dígitos que te enviamos.
              </p>
              <input
                ref={codeRef}
                type="text" inputMode="numeric" maxLength={6}
                value={code}
                onChange={e => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                onKeyDown={e => e.key === "Enter" && code.length === 6 && handleVerifyCode()}
                placeholder="123456"
                className="mb-2 h-11 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] text-center font-mono text-2xl tracking-[0.3em] text-[var(--brand)] placeholder:tracking-normal placeholder:text-[#C4B89A] focus:border-[var(--brand)] focus:outline-none"
              />
              {error && <p className="mb-2 text-[11px] font-semibold text-[#B0492F]">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setStep("forgot_email"); setCode(""); setError(""); }}
                  className="flex-1 rounded-xl bg-[#ECE3D1] dark:bg-[#17233d] py-2.5 text-sm font-bold text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#D7CBB3] dark:hover:bg-[#17233d]">
                  Reenviar
                </button>
                <button onClick={handleVerifyCode} disabled={loading || code.length !== 6}
                  className="flex-1 rounded-xl bg-[var(--brand)] py-2.5 text-sm font-bold text-white disabled:opacity-40">
                  {loading ? "…" : "Continuar"}
                </button>
              </div>
            </>)}

            {/* ── STEP: NEW PIN ─────────────────────────────────────── */}
            {step === "forgot_newpin" && (<>
              <p className="mb-3 text-[12px] text-[#5C6A6E] dark:text-[#9fb0cc]">Elige tu nuevo PIN. Mínimo 4 dígitos.</p>
              <input
                ref={newRef}
                type="password" inputMode="numeric" maxLength={8}
                value={newPin}
                onChange={e => { setNewPin(e.target.value.replace(/\D/g, "").slice(0, 8)); setError(""); }}
                placeholder="Nuevo PIN"
                className="mb-2 h-10 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 text-center font-mono text-lg tracking-[1em] text-[var(--brand)] placeholder:tracking-normal placeholder:text-[#C4B89A] focus:border-[var(--brand)] focus:outline-none"
              />
              <input
                type="password" inputMode="numeric" maxLength={8}
                value={newPin2}
                onChange={e => { setNewPin2(e.target.value.replace(/\D/g, "").slice(0, 8)); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleResetPin()}
                placeholder="Confirmar PIN"
                className="mb-2 h-10 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 text-center font-mono text-lg tracking-[1em] text-[var(--brand)] placeholder:tracking-normal placeholder:text-[#C4B89A] focus:border-[var(--brand)] focus:outline-none"
              />
              {error && <p className="mb-2 text-[11px] font-semibold text-[#B0492F]">{error}</p>}
              <button onClick={handleResetPin} disabled={loading || newPin.length < 6}
                className="w-full rounded-xl bg-[#7B1838] py-2.5 text-sm font-bold text-white hover:bg-[#641430] disabled:opacity-40">
                {loading ? "Guardando…" : "Guardar nuevo PIN"}
              </button>
            </>)}

            {/* ── STEP: DONE ────────────────────────────────────────── */}
            {step === "forgot_done" && (
              <div className="flex flex-col items-center gap-3 py-2">
                <CheckCircle size={36} className="text-[#4F8A63]" />
                <p className="text-center text-sm font-semibold text-[var(--brand)]">
                  PIN actualizado correctamente
                </p>
                <p className="text-center text-[11px] text-[#97A1A0] dark:text-[#728098]">
                  Ya puedes ingresar con tu nuevo PIN.
                </p>
                <button onClick={() => { setStep("pin"); setCode(""); setNewPin(""); setNewPin2(""); }}
                  className="w-full rounded-xl bg-[var(--brand)] py-2.5 text-sm font-bold text-white">
                  Ir al login
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
