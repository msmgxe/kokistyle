"use client";

import { useState, useEffect } from "react";
import { KeyRound, Mail, Eye, EyeOff, CheckCircle, User } from "lucide-react";
import { useAuth } from "@/src/context/AuthContext";

async function fetchRecoveryEmail(pin: string): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const { email } = await res.json();
    return email ?? null;
  } catch { return null; }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E]">
        {label}
      </label>
      {children}
    </div>
  );
}

function SaveBtn({ loading, disabled }: { loading: boolean; disabled?: boolean }) {
  return (
    <button type="submit" disabled={loading || disabled}
      className="w-full rounded-xl bg-[#16323D] py-2.5 text-sm font-bold text-white hover:bg-[#0e2630] disabled:opacity-40">
      {loading ? "Guardando…" : "Guardar"}
    </button>
  );
}

type SecurityTab = "name" | "pin" | "email";

export default function AdminSettings() {
  const { currentUser, changePin, setRecoveryEmail, setDisplayName } = useAuth();
  const [secTab, setSecTab] = useState<SecurityTab>("name");

  // ── Display name ──────────────────────────────────────────────────────────
  const [displayName,    setDisplayNameVal] = useState(currentUser?.name ?? "");
  const [namePin,        setNamePin]        = useState("");
  const [nameMsg,        setNameMsg]        = useState<{ ok: boolean; text: string } | null>(null);
  const [nameLoad,       setNameLoad]       = useState(false);

  const handleSetName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) { setNameMsg({ ok: false, text: "Ingresa un nombre" }); return; }
    if (namePin.length < 4)  { setNameMsg({ ok: false, text: "Confirma tu PIN actual" }); return; }
    setNameLoad(true); setNameMsg(null);
    const res = await setDisplayName(namePin, displayName.trim());
    setNameLoad(false);
    if (res.ok) { setNameMsg({ ok: true, text: "Nombre actualizado" }); setNamePin(""); }
    else        { setNameMsg({ ok: false, text: res.error ?? "Error al guardar" }); }
  };

  // ── Change PIN ─────────────────────────────────────────────────────────────
  const [curPin,  setCurPin]  = useState("");
  const [np1,     setNp1]     = useState("");
  const [np2,     setNp2]     = useState("");
  const [showCur, setShowCur] = useState(false);
  const [pinMsg,  setPinMsg]  = useState<{ ok: boolean; text: string } | null>(null);
  const [pinLoad, setPinLoad] = useState(false);

  // ── Recovery email ─────────────────────────────────────────────────────────
  const [email,     setEmail]     = useState("");
  const [emailPin,  setEmailPin]  = useState("");
  const [emailMsg,  setEmailMsg]  = useState<{ ok: boolean; text: string } | null>(null);
  const [emailLoad, setEmailLoad] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(true);

  // Load current recovery email on mount (requires current pin from session)
  useEffect(() => {
    if (!currentUser?.pin) { setLoadingEmail(false); return; }
    fetchRecoveryEmail(currentUser.pin).then(e => {
      if (e) setEmail(e);
      setLoadingEmail(false);
    });
  }, [currentUser?.pin]);

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (np1.length < 4)   { setPinMsg({ ok: false, text: "Mínimo 4 dígitos" }); return; }
    if (np1 !== np2)      { setPinMsg({ ok: false, text: "Los PIN no coinciden" }); return; }
    setPinLoad(true); setPinMsg(null);
    const res = await changePin(curPin, np1);
    setPinLoad(false);
    if (res.ok) {
      setPinMsg({ ok: true,  text: "PIN actualizado correctamente" });
      setCurPin(""); setNp1(""); setNp2("");
    } else {
      setPinMsg({ ok: false, text: res.error ?? "Error al cambiar PIN" });
    }
  };

  const handleSetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@"))    { setEmailMsg({ ok: false, text: "Email inválido" }); return; }
    if (emailPin.length < 4)     { setEmailMsg({ ok: false, text: "Confirma tu PIN actual" }); return; }
    setEmailLoad(true); setEmailMsg(null);
    const res = await setRecoveryEmail(emailPin, email);
    setEmailLoad(false);
    if (res.ok) {
      setEmailMsg({ ok: true,  text: "Correo de recuperación guardado" });
      setEmailPin("");
    } else {
      setEmailMsg({ ok: false, text: res.error ?? "Error al guardar" });
    }
  };

  const TABS: { id: SecurityTab; icon: React.ReactNode; label: string }[] = [
    { id: "name",  icon: <User size={13} />,     label: "Nombre de display" },
    { id: "pin",   icon: <KeyRound size={13} />, label: "Cambiar PIN" },
    { id: "email", icon: <Mail size={13} />,     label: "Correo de recuperación" },
  ];

  return (
    <div className="mt-8">

      {/* ── Section header ───────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-2">
        <div className="h-4 w-1 rounded-full bg-[#16323D]" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#16323D]">Seguridad</h2>
      </div>

      {/* ── Tab panel ────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] bg-white">

        {/* Tab bar */}
        <div className="flex border-b border-[#E6DDCB] bg-[#F7F3EA]">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSecTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-[12px] font-bold transition-colors ${
                secTab === tab.id
                  ? "border-b-2 border-[#16323D] bg-white text-[#16323D]"
                  : "text-[#5C6A6E] hover:text-[#16323D]"
              }`}
            >
              <span className={secTab === tab.id ? "text-[#16323D]" : "text-[#97A1A0]"}>
                {tab.icon}
              </span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">

          {/* ── Nombre de display ── */}
          {secTab === "name" && (
            <form onSubmit={handleSetName} className="space-y-3">
              <p className="mb-1 text-[11px] text-[#97A1A0]">
                Este nombre aparece en el saludo del panel y en el registro de actividad.
              </p>
              <Field label="Tu nombre">
                <input type="text" value={displayName}
                  onChange={e => { setDisplayNameVal(e.target.value); setNameMsg(null); }}
                  className="h-10 w-full rounded-xl border border-[#E6DDCB] bg-[#F7F3EA] px-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none"
                  placeholder="Ej. Marco, Koky, Lidette"
                />
              </Field>
              <Field label="Confirma tu PIN actual">
                <input type="password" inputMode="numeric" maxLength={8}
                  value={namePin} onChange={e => setNamePin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="h-10 w-full rounded-xl border border-[#E6DDCB] bg-[#F7F3EA] px-3 font-mono text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none"
                  placeholder="••••••••"
                />
              </Field>
              {nameMsg && (
                <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold ${
                  nameMsg.ok ? "bg-[#EDF7F0] text-[#4F8A63]" : "bg-[#FFF0EE] text-[#B0492F]"
                }`}>
                  {nameMsg.ok && <CheckCircle size={12} />}
                  {nameMsg.text}
                </div>
              )}
              <SaveBtn loading={nameLoad} disabled={!displayName.trim() || namePin.length < 4} />
            </form>
          )}

          {/* ── Cambiar PIN ── */}
          {secTab === "pin" && (
            <form onSubmit={handleChangePin} className="space-y-3">
              <Field label="PIN actual">
                <div className="relative">
                  <input
                    type={showCur ? "text" : "password"} inputMode="numeric" maxLength={8}
                    value={curPin} onChange={e => setCurPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    className="h-10 w-full rounded-xl border border-[#E6DDCB] bg-[#F7F3EA] px-3 pr-9 font-mono text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowCur(s => !s)}
                    className="absolute right-2.5 top-2.5 text-[#97A1A0] hover:text-[#5C6A6E]">
                    {showCur ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </Field>
              <Field label="Nuevo PIN">
                <input type="password" inputMode="numeric" maxLength={8}
                  value={np1} onChange={e => setNp1(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="h-10 w-full rounded-xl border border-[#E6DDCB] bg-[#F7F3EA] px-3 font-mono text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none"
                  placeholder="Mín. 4 dígitos"
                />
              </Field>
              <Field label="Confirmar nuevo PIN">
                <input type="password" inputMode="numeric" maxLength={8}
                  value={np2} onChange={e => setNp2(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="h-10 w-full rounded-xl border border-[#E6DDCB] bg-[#F7F3EA] px-3 font-mono text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none"
                  placeholder="Repite el nuevo PIN"
                />
              </Field>
              {pinMsg && (
                <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold ${
                  pinMsg.ok ? "bg-[#EDF7F0] text-[#4F8A63]" : "bg-[#FFF0EE] text-[#B0492F]"
                }`}>
                  {pinMsg.ok && <CheckCircle size={12} />}
                  {pinMsg.text}
                </div>
              )}
              <SaveBtn loading={pinLoad} disabled={curPin.length < 4 || np1.length < 4} />
            </form>
          )}

          {/* ── Correo de recuperación ── */}
          {secTab === "email" && (
            <form onSubmit={handleSetEmail} className="space-y-3">
              <p className="mb-1 text-[11px] text-[#97A1A0]">
                Si olvidas tu PIN, te enviaremos un código de recuperación a este correo.
              </p>
              <Field label="Correo electrónico">
                {loadingEmail ? (
                  <div className="h-10 animate-pulse rounded-xl bg-[#F0EAE0]" />
                ) : (
                  <input type="email" value={email}
                    onChange={e => { setEmail(e.target.value); setEmailMsg(null); }}
                    className="h-10 w-full rounded-xl border border-[#E6DDCB] bg-[#F7F3EA] px-3 text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none"
                    placeholder="tu@correo.com"
                  />
                )}
              </Field>
              <Field label="Confirma tu PIN actual">
                <input type="password" inputMode="numeric" maxLength={8}
                  value={emailPin} onChange={e => setEmailPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="h-10 w-full rounded-xl border border-[#E6DDCB] bg-[#F7F3EA] px-3 font-mono text-sm text-[#16323D] focus:border-[#16323D] focus:outline-none"
                  placeholder="••••••••"
                />
              </Field>
              {emailMsg && (
                <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold ${
                  emailMsg.ok ? "bg-[#EDF7F0] text-[#4F8A63]" : "bg-[#FFF0EE] text-[#B0492F]"
                }`}>
                  {emailMsg.ok && <CheckCircle size={12} />}
                  {emailMsg.text}
                </div>
              )}
              <SaveBtn loading={emailLoad} disabled={!email || emailPin.length < 4} />
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
