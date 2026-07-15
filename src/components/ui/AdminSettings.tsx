"use client";

import { useState, useEffect, useCallback } from "react";
import { KeyRound, Mail, Eye, EyeOff, CheckCircle, User, Smartphone, Copy, Ban, Fingerprint } from "lucide-react";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";

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
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">
        {label}
      </label>
      {children}
    </div>
  );
}

function SaveBtn({ loading, disabled, save, saving }: { loading: boolean; disabled?: boolean; save: string; saving: string }) {
  return (
    <button type="submit" disabled={loading || disabled}
      className="w-full rounded-xl bg-[var(--brand)] py-2.5 text-sm font-bold text-white hover:bg-[var(--brand-strong)] disabled:opacity-40">
      {loading ? saving : save}
    </button>
  );
}

type SecurityTab = "name" | "pin" | "email" | "devices";

interface DeviceRow {
  id: string;
  token: string;
  label: string | null;
  revoked: boolean;
  last_used_at: string | null;
  created_at: string;
}

export default function AdminSettings() {
  const { currentUser, changePin, setRecoveryEmail, setDisplayName,
    biometricEnabled, enableBiometric, disableBiometric } = useAuth();
  const { t } = useLanguage();
  const ts = t.panel.settings;
  const [secTab, setSecTab] = useState<SecurityTab>("name");

  // ── Display name ──────────────────────────────────────────────────────────
  const [displayName,    setDisplayNameVal] = useState(currentUser?.name ?? "");
  const [namePin,        setNamePin]        = useState("");
  const [nameMsg,        setNameMsg]        = useState<{ ok: boolean; text: string } | null>(null);
  const [nameLoad,       setNameLoad]       = useState(false);

  const handleSetName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) { setNameMsg({ ok: false, text: ts.enterName }); return; }
    if (namePin.length < 4)  { setNameMsg({ ok: false, text: ts.confirmCurrentPin }); return; }
    setNameLoad(true); setNameMsg(null);
    const res = await setDisplayName(namePin, displayName.trim());
    setNameLoad(false);
    if (res.ok) { setNameMsg({ ok: true, text: ts.nameUpdated }); setNamePin(""); }
    else        { setNameMsg({ ok: false, text: res.error ?? ts.errorSaving }); }
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
    if (np1.length < 4)   { setPinMsg({ ok: false, text: ts.minDigits }); return; }
    if (np1 !== np2)      { setPinMsg({ ok: false, text: ts.pinMismatch }); return; }
    setPinLoad(true); setPinMsg(null);
    const res = await changePin(curPin, np1);
    setPinLoad(false);
    if (res.ok) {
      setPinMsg({ ok: true,  text: ts.pinUpdated });
      setCurPin(""); setNp1(""); setNp2("");
    } else {
      setPinMsg({ ok: false, text: res.error ?? ts.errorPin });
    }
  };

  const handleSetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@"))    { setEmailMsg({ ok: false, text: ts.emailInvalid }); return; }
    if (emailPin.length < 4)     { setEmailMsg({ ok: false, text: ts.confirmCurrentPin }); return; }
    setEmailLoad(true); setEmailMsg(null);
    const res = await setRecoveryEmail(emailPin, email);
    setEmailLoad(false);
    if (res.ok) {
      setEmailMsg({ ok: true,  text: ts.emailSaved });
      setEmailPin("");
    } else {
      setEmailMsg({ ok: false, text: res.error ?? ts.errorSaving });
    }
  };

  // ── Dispositivos (acceso directo sin PIN) ──────────────────────────────────
  const [devices,     setDevices]     = useState<DeviceRow[]>([]);
  const [devLabel,    setDevLabel]    = useState("");
  const [devPin,      setDevPin]      = useState("");
  const [devMsg,      setDevMsg]      = useState<{ ok: boolean; text: string } | null>(null);
  const [devLoad,     setDevLoad]     = useState(false);
  const [devListed,   setDevListed]   = useState(false);
  const [copiedId,    setCopiedId]    = useState<string | null>(null);

  const deviceUrl = (token: string) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/acceso/${token}`;

  const callDevices = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch("/api/auth/device-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }, []);

  const loadDevices = async () => {
    if (devPin.length < 4) { setDevMsg({ ok: false, text: ts.confirmCurrentPin }); return; }
    setDevLoad(true); setDevMsg(null);
    const res = await callDevices({ pin: devPin, op: "list" });
    setDevLoad(false);
    if (res.ok) { setDevices(res.devices); setDevListed(true); }
    else        { setDevMsg({ ok: false, text: res.error ?? ts.errorSaving }); }
  };

  const createDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (devPin.length < 4) { setDevMsg({ ok: false, text: ts.confirmCurrentPin }); return; }
    setDevLoad(true); setDevMsg(null);
    const res = await callDevices({ pin: devPin, op: "create", label: devLabel });
    setDevLoad(false);
    if (res.ok) {
      setDevices(prev => [{ ...res.device, revoked: false, last_used_at: null }, ...prev]);
      setDevListed(true);
      setDevLabel("");
      setDevMsg({ ok: true, text: ts.deviceCreated });
    } else {
      setDevMsg({ ok: false, text: res.error ?? ts.errorSaving });
    }
  };

  const revokeDevice = async (id: string) => {
    const res = await callDevices({ pin: devPin, op: "revoke", id });
    if (res.ok) {
      setDevices(prev => prev.map(d => d.id === id ? { ...d, revoked: true } : d));
      setDevMsg({ ok: true, text: ts.deviceRevoked });
    } else {
      setDevMsg({ ok: false, text: res.error ?? ts.errorSaving });
    }
  };

  const [bioMsg,  setBioMsg]  = useState<string | null>(null);
  const [bioLoad, setBioLoad] = useState(false);

  const handleEnableBio = async () => {
    setBioLoad(true); setBioMsg(null);
    const res = await enableBiometric();
    setBioLoad(false);
    if (!res.ok) setBioMsg(ts.bioError);
  };

  const copyLink = async (d: DeviceRow) => {
    try {
      await navigator.clipboard.writeText(deviceUrl(d.token));
      setCopiedId(d.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* clipboard no disponible */ }
  };

  const TABS: { id: SecurityTab; icon: React.ReactNode; label: string }[] = [
    { id: "name",    icon: <User size={13} />,       label: ts.tabDisplayName },
    { id: "pin",     icon: <KeyRound size={13} />,   label: ts.tabChangePin },
    { id: "email",   icon: <Mail size={13} />,       label: ts.tabRecoveryEmail },
    { id: "devices", icon: <Smartphone size={13} />, label: ts.tabDevices },
  ];

  return (
    <div className="mt-8">

      {/* ── Section header ───────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-2">
        <div className="h-4 w-1 rounded-full bg-[var(--brand)]" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--brand)]">{ts.sectionTitle}</h2>
      </div>

      {/* ── Tab panel ────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e]">

        {/* Tab bar */}
        <div className="flex border-b border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220]">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSecTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-[12px] font-bold transition-colors ${
                secTab === tab.id
                  ? "border-b-2 border-[var(--brand)] bg-white dark:bg-[#111a2e] text-[var(--brand)]"
                  : "text-[#5C6A6E] dark:text-[#9fb0cc] hover:text-[var(--brand)]"
              }`}
            >
              <span className={secTab === tab.id ? "text-[var(--brand)]" : "text-[#97A1A0] dark:text-[#728098]"}>
                {tab.icon}
              </span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">

          {/* ── Display name ── */}
          {secTab === "name" && (
            <form onSubmit={handleSetName} className="space-y-3">
              <p className="mb-1 text-[11px] text-[#97A1A0] dark:text-[#728098]">{ts.displayNameDesc}</p>
              <Field label={ts.yourName}>
                <input type="text" value={displayName}
                  onChange={e => { setDisplayNameVal(e.target.value); setNameMsg(null); }}
                  className="h-10 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none"
                  placeholder={ts.namePlaceholder}
                />
              </Field>
              <Field label={ts.confirmCurrentPin}>
                <input type="password" inputMode="numeric" maxLength={8}
                  value={namePin} onChange={e => setNamePin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="h-10 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 font-mono text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none"
                  placeholder="••••••••"
                />
              </Field>
              {nameMsg && (
                <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold ${
                  nameMsg.ok ? "bg-[#EDF7F0] dark:bg-[#14261c] text-[#4F8A63]" : "bg-[#FFF0EE] dark:bg-[#2a1712] text-[#B0492F]"
                }`}>
                  {nameMsg.ok && <CheckCircle size={12} />}
                  {nameMsg.text}
                </div>
              )}
              <SaveBtn loading={nameLoad} disabled={!displayName.trim() || namePin.length < 4} save={ts.save} saving={ts.saving} />
            </form>
          )}

          {/* ── Change PIN ── */}
          {secTab === "pin" && (
            <form onSubmit={handleChangePin} className="space-y-3">
              <Field label={ts.currentPin}>
                <div className="relative">
                  <input
                    type={showCur ? "text" : "password"} inputMode="numeric" maxLength={8}
                    value={curPin} onChange={e => setCurPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    className="h-10 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 pr-9 font-mono text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowCur(s => !s)}
                    className="absolute right-2.5 top-2.5 text-[#97A1A0] dark:text-[#728098] hover:text-[#5C6A6E] dark:hover:text-[#9fb0cc]">
                    {showCur ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </Field>
              <Field label={ts.newPin}>
                <input type="password" inputMode="numeric" maxLength={8}
                  value={np1} onChange={e => setNp1(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="h-10 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 font-mono text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none"
                  placeholder={ts.minDigits}
                />
              </Field>
              <Field label={ts.confirmNewPin}>
                <input type="password" inputMode="numeric" maxLength={8}
                  value={np2} onChange={e => setNp2(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="h-10 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 font-mono text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none"
                  placeholder="••••••••"
                />
              </Field>
              {pinMsg && (
                <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold ${
                  pinMsg.ok ? "bg-[#EDF7F0] dark:bg-[#14261c] text-[#4F8A63]" : "bg-[#FFF0EE] dark:bg-[#2a1712] text-[#B0492F]"
                }`}>
                  {pinMsg.ok && <CheckCircle size={12} />}
                  {pinMsg.text}
                </div>
              )}
              <SaveBtn loading={pinLoad} disabled={curPin.length < 4 || np1.length < 4} save={ts.save} saving={ts.saving} />
            </form>
          )}

          {/* ── Recovery email ── */}
          {secTab === "email" && (
            <form onSubmit={handleSetEmail} className="space-y-3">
              <p className="mb-1 text-[11px] text-[#97A1A0] dark:text-[#728098]">{ts.recoveryEmailDesc}</p>
              <Field label={ts.emailAddress}>
                {loadingEmail ? (
                  <div className="h-10 animate-pulse rounded-xl bg-[#F0EAE0] dark:bg-[#17233d]" />
                ) : (
                  <input type="email" value={email}
                    onChange={e => { setEmail(e.target.value); setEmailMsg(null); }}
                    className="h-10 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none"
                    placeholder={ts.emailPlaceholder}
                  />
                )}
              </Field>
              <Field label={ts.confirmCurrentPin}>
                <input type="password" inputMode="numeric" maxLength={8}
                  value={emailPin} onChange={e => setEmailPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="h-10 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 font-mono text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none"
                  placeholder="••••••••"
                />
              </Field>
              {emailMsg && (
                <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold ${
                  emailMsg.ok ? "bg-[#EDF7F0] dark:bg-[#14261c] text-[#4F8A63]" : "bg-[#FFF0EE] dark:bg-[#2a1712] text-[#B0492F]"
                }`}>
                  {emailMsg.ok && <CheckCircle size={12} />}
                  {emailMsg.text}
                </div>
              )}
              <SaveBtn loading={emailLoad} disabled={!email || emailPin.length < 4} save={ts.save} saving={ts.saving} />
            </form>
          )}

          {/* ── Dispositivos (acceso directo sin PIN) ── */}
          {secTab === "devices" && (
            <div className="space-y-4">
              <p className="text-[11px] text-[#97A1A0] dark:text-[#728098]">{ts.devicesDesc}</p>

              {/* Bloqueo biométrico de este dispositivo */}
              <div className="rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Fingerprint size={18} className="mt-0.5 flex-none text-[var(--brand)]" />
                    <div>
                      <p className="text-xs font-bold text-[var(--brand)]">{ts.bioTitle}</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-[#5C6A6E] dark:text-[#9fb0cc]">{ts.bioDesc}</p>
                      {biometricEnabled && (
                        <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-[#4F8A63]">
                          <CheckCircle size={10} /> {ts.bioActive}
                        </p>
                      )}
                      {bioMsg && <p className="mt-1 text-[10px] font-semibold text-[#B0492F]">{bioMsg}</p>}
                    </div>
                  </div>
                  {biometricEnabled ? (
                    <button type="button" onClick={disableBiometric}
                      className="flex-none rounded-lg border border-[#B0492F] px-3 py-1.5 text-[10px] font-bold text-[#B0492F] hover:bg-[#FFF0EE] dark:hover:bg-[#2a1712]">
                      {ts.bioDisable}
                    </button>
                  ) : (
                    <button type="button" onClick={handleEnableBio} disabled={bioLoad}
                      className="flex-none rounded-lg bg-[var(--brand)] px-3 py-1.5 text-[10px] font-bold text-white hover:bg-[var(--brand-strong)] disabled:opacity-50">
                      {bioLoad ? ts.saving : ts.bioEnable}
                    </button>
                  )}
                </div>
              </div>

              <form onSubmit={createDevice} className="space-y-3">
                <Field label={ts.deviceLabel}>
                  <input type="text" value={devLabel}
                    onChange={e => { setDevLabel(e.target.value); setDevMsg(null); }}
                    className="h-10 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none"
                    placeholder={ts.deviceLabelPlaceholder}
                  />
                </Field>
                <Field label={ts.confirmCurrentPin}>
                  <input type="password" inputMode="numeric" maxLength={8}
                    value={devPin} onChange={e => { setDevPin(e.target.value.replace(/\D/g, "").slice(0, 8)); setDevMsg(null); }}
                    className="h-10 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 font-mono text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none"
                    placeholder="••••••••"
                  />
                </Field>
                {devMsg && (
                  <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold ${
                    devMsg.ok ? "bg-[#EDF7F0] dark:bg-[#14261c] text-[#4F8A63]" : "bg-[#FFF0EE] dark:bg-[#2a1712] text-[#B0492F]"
                  }`}>
                    {devMsg.ok && <CheckCircle size={12} />}
                    {devMsg.text}
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="submit" disabled={devLoad || devPin.length < 4}
                    className="flex-1 rounded-xl bg-[var(--brand)] py-2.5 text-sm font-bold text-white hover:bg-[var(--brand-strong)] disabled:opacity-40">
                    {devLoad ? ts.saving : ts.deviceCreate}
                  </button>
                  {!devListed && (
                    <button type="button" onClick={loadDevices} disabled={devLoad || devPin.length < 4}
                      className="rounded-xl border border-[#E6DDCB] dark:border-[#22304d] px-4 py-2.5 text-sm font-bold text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220] disabled:opacity-40">
                      {ts.tabDevices}
                    </button>
                  )}
                </div>
              </form>

              {devListed && (
                devices.length === 0 ? (
                  <p className="text-xs italic text-[#97A1A0] dark:text-[#728098]">{ts.deviceNone}</p>
                ) : (
                  <ul className="space-y-2">
                    {devices.map(d => (
                      <li key={d.id}
                        className={`rounded-xl border border-[#E6DDCB] dark:border-[#22304d] p-3 ${d.revoked ? "opacity-50" : "bg-[#F7F3EA] dark:bg-[#0b1220]"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-[var(--brand)]">
                              {d.label || "—"}
                              {d.revoked && (
                                <span className="ml-2 rounded-full bg-[#FDE8E3] dark:bg-[#2a1712] px-2 py-0.5 text-[9px] font-bold text-[#B0492F]">
                                  {ts.deviceRevokedTag}
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-[#97A1A0] dark:text-[#728098]">
                              {ts.deviceLastUsed}: {d.last_used_at
                                ? new Date(d.last_used_at).toLocaleString()
                                : ts.deviceNeverUsed}
                            </p>
                          </div>
                          {!d.revoked && (
                            <div className="flex flex-none gap-1.5">
                              <button type="button" onClick={() => copyLink(d)}
                                className="inline-flex items-center gap-1 rounded-lg border border-[var(--brand)] px-2.5 py-1.5 text-[10px] font-bold text-[var(--brand)] hover:bg-white dark:hover:bg-[#111a2e]">
                                <Copy size={11} /> {copiedId === d.id ? ts.deviceCopied : ts.deviceCopy}
                              </button>
                              <button type="button" onClick={() => revokeDevice(d.id)}
                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-[#B0492F] hover:bg-[#FFF0EE] dark:hover:bg-[#2a1712]">
                                <Ban size={11} /> {ts.deviceRevoke}
                              </button>
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              )}

              <p className="rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 py-2 text-[10px] text-[#5C6A6E] dark:text-[#9fb0cc]">
                💡 {ts.deviceHowTo}
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
