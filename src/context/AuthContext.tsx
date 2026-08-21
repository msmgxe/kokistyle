"use client";

import {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { AppUser, PermissionSection, PermissionAction } from "@/src/types/auth";
import { FULL_PERMISSIONS } from "@/src/types/auth";
import { logActivity } from "@/src/lib/activity";

const SUPERADMIN_TEMPLATE: Omit<AppUser, "pin"> = {
  id:            "superadmin",
  name:          "Admin",
  role:          "superadmin",
  user_type:     "coworker",
  contact_id:    null,
  tab_access:    null,
  my_tasks_only: false,
  permissions:   FULL_PERMISSIONS,
  active:        true,
};
const SESSION_KEY = "kokistyle-session";      // PIN → sessionStorage · token → localStorage
const TOKEN_KEY   = "kokistyle-device-token"; // token del shortcut, se revalida en cada apertura
const BIO_FLAG    = "kokistyle-bio-enabled";
const BIO_CRED    = "kokistyle-bio-cred";

function bufToB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64ToBuf(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

interface AuthContextType {
  currentUser:   AppUser | null;
  isAdmin:       boolean;
  isSuperAdmin:  boolean;
  login:         (pin: string) => Promise<boolean>;
  loginWithToken: (token: string) => Promise<boolean>;
  logout:        () => void;
  verifyPin:     (pin: string) => Promise<boolean>;
  changePin:     (currentPin: string, newPin: string) => Promise<{ ok: boolean; error?: string }>;
  setRecoveryEmail: (pin: string, email: string) => Promise<{ ok: boolean; error?: string }>;
  setDisplayName:   (pin: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  hasPermission: (section: PermissionSection, action: PermissionAction) => boolean;
  locked:            boolean;
  biometricEnabled:  boolean;
  enableBiometric:   () => Promise<{ ok: boolean; error?: string }>;
  disableBiometric:  () => void;
  unlockBiometric:   () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [locked,      setLocked]      = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") { setIsLoading(false); return; }
    setBiometricEnabled(localStorage.getItem(BIO_FLAG) === "1");

    // 1. Sesión por PIN — vive solo mientras el navegador está abierto
    const tabSession = sessionStorage.getItem(SESSION_KEY);
    if (tabSession) {
      try {
        const user = JSON.parse(tabSession) as AppUser;
        setCurrentUser(user);
        // Renueva la cookie de sesión del servidor por si el navegador la perdió.
        fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: user.pin ?? "" }),
        }).catch(() => { /* sin red: se reintenta en la próxima apertura */ });
      } catch { sessionStorage.removeItem(SESSION_KEY); }
      setIsLoading(false);
      return;
    }

    // 2. Dispositivo con token (shortcut) — entra directo SIEMPRE, sin pedir PIN.
    //    El token se revalida server-side en cada apertura; solo Revocar lo apaga.
    const stored = localStorage.getItem(SESSION_KEY);
    const token  = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      // Sesión persistente legacy sin token — ya no es válida
      if (stored) localStorage.removeItem(SESSION_KEY);
      setIsLoading(false);
      return;
    }

    const bioLock = localStorage.getItem(BIO_FLAG) === "1" && !!localStorage.getItem(BIO_CRED);
    if (stored) {
      try {
        setCurrentUser(JSON.parse(stored));
        if (bioLock) setLocked(true);
        setIsLoading(false);
      } catch { localStorage.removeItem(SESSION_KEY); }
    }

    fetch("/api/auth/device-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          const user: AppUser = data.role === "superadmin"
            ? { ...SUPERADMIN_TEMPLATE, pin: "", name: data.name ?? "Admin" }
            : (data.user as AppUser);
          setCurrentUser(user);
          localStorage.setItem(SESSION_KEY, JSON.stringify(user));
          if (!stored && bioLock) setLocked(true);
        } else {
          localStorage.removeItem(SESSION_KEY);
          localStorage.removeItem(TOKEN_KEY);
          setCurrentUser(null);
          setLocked(false);
        }
      })
      .catch(() => { /* sin red: mantener lo que haya localmente hasta la próxima apertura */ })
      .finally(() => setIsLoading(false));
  }, []);

  const persistSession = useCallback((user: AppUser) => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(TOKEN_KEY) && localStorage.getItem(SESSION_KEY)) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    }
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────
  /** El PIN se verifica siempre en el servidor: superadmin y colaboradores. La
   *  respuesta trae la sesión firmada en cookie httpOnly. */
  const login = useCallback(async (pin: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json() as { isSuperAdmin?: boolean; name?: string; user?: AppUser };

      if (data.isSuperAdmin) {
        const user: AppUser = { ...SUPERADMIN_TEMPLATE, pin, name: data.name ?? "Admin" };
        setCurrentUser(user);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
        logActivity({ user_id: "superadmin", user_name: user.name, user_role: "superadmin", action: "login" });
        return true;
      }
      if (data.user) {
        const user = { ...data.user, pin } as AppUser;
        setCurrentUser(user);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
        logActivity({ user_id: user.id, user_name: user.name, user_role: "collaborator", action: "login" });
        return true;
      }
    } catch { /* sin red o servidor caído: no hay sesión */ }
    return false;
  }, []);

  // ── Login con token de dispositivo (shortcut sin PIN) ──────────────────────
  const loginWithToken = useCallback(async (token: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/device-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!data.ok) return false;

      const user: AppUser = data.role === "superadmin"
        ? { ...SUPERADMIN_TEMPLATE, pin: "", name: data.name ?? "Admin" }
        : (data.user as AppUser);
      setCurrentUser(user);
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      localStorage.setItem(TOKEN_KEY, token);
      logActivity({
        user_id: user.id, user_name: user.name,
        user_role: data.role === "superadmin" ? "superadmin" : "collaborator",
        action: "login", details: { method: "device_token" },
      });
      return true;
    } catch { return false; }
  }, []);

  // ── Logout — cierra la sesión, pero conserva el token del dispositivo:
  //    el shortcut nunca pide PIN; para apagarlo → Seguridad → Dispositivos → Revocar
  const logout = useCallback(() => {
    fetch("/api/auth/logout", { method: "POST" }).catch(() => { /* la cookie caduca sola */ });
    setCurrentUser(null);
    setLocked(false);
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    router.push("/");
  }, [router]);

  // ── Bloqueo biométrico (huella / Face ID) — candado local por dispositivo ──
  const enableBiometric = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      if (typeof window === "undefined" || !window.PublicKeyCredential) {
        return { ok: false, error: "unsupported" };
      }
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: "Luxaris Design", id: window.location.hostname },
          user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: currentUser?.name ?? "Luxaris",
            displayName: currentUser?.name ?? "Luxaris",
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            residentKey: "discouraged",
          },
          timeout: 60000,
        },
      }) as PublicKeyCredential | null;
      if (!cred) return { ok: false, error: "cancelled" };
      localStorage.setItem(BIO_CRED, bufToB64(cred.rawId));
      localStorage.setItem(BIO_FLAG, "1");
      setBiometricEnabled(true);
      return { ok: true };
    } catch {
      return { ok: false, error: "failed" };
    }
  }, [currentUser]);

  const disableBiometric = useCallback(() => {
    localStorage.removeItem(BIO_FLAG);
    localStorage.removeItem(BIO_CRED);
    setBiometricEnabled(false);
    setLocked(false);
  }, []);

  const unlockBiometric = useCallback(async (): Promise<boolean> => {
    try {
      const credId = localStorage.getItem(BIO_CRED);
      if (!credId) { setLocked(false); return true; }
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ type: "public-key", id: b64ToBuf(credId) as BufferSource }],
          userVerification: "required",
          timeout: 60000,
        },
      });
      if (assertion) { setLocked(false); return true; }
      return false;
    } catch {
      return false;
    }
  }, []);

  // ── Verify PIN (async — superadmin checks against DB via API) ──────────────
  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!currentUser) return false;
    if (currentUser.role === "superadmin") {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });
        const { isSuperAdmin } = await res.json();
        return isSuperAdmin;
      } catch { return false; }
    }
    return pin === currentUser.pin;
  }, [currentUser]);

  // ── Change PIN ─────────────────────────────────────────────────────────────
  const changePin = useCallback(async (
    currentPin: string,
    newPin: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await fetch("/api/auth/change-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPin, newPin }),
    });
    const data = await res.json();
    if (data.ok && currentUser?.role === "superadmin") {
      // Update pin in session so verifyPin still works for non-API checks
      const updated = { ...currentUser, pin: newPin };
      setCurrentUser(updated);
      persistSession(updated);
    }
    return data;
  }, [currentUser, persistSession]);

  // ── Set recovery email ─────────────────────────────────────────────────────
  const setRecoveryEmail = useCallback(async (
    pin: string,
    email: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await fetch("/api/auth/set-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, email }),
    });
    return res.json();
  }, []);

  // ── Set display name ───────────────────────────────────────────────────────
  const setDisplayName = useCallback(async (
    pin: string,
    name: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await fetch("/api/auth/set-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, name }),
    });
    const data = await res.json();
    if (data.ok && currentUser?.role === "superadmin") {
      const updated = { ...currentUser, name };
      setCurrentUser(updated);
      persistSession(updated);
    }
    return data;
  }, [currentUser, persistSession]);

  // ── Permission check ───────────────────────────────────────────────────────
  const hasPermission = useCallback(
    (section: PermissionSection, action: PermissionAction): boolean => {
      if (!currentUser) return false;
      if (currentUser.role === "superadmin") return true;
      return currentUser.permissions?.[section]?.[action] ?? false;
    },
    [currentUser]
  );

  return (
    <AuthContext.Provider value={{
      currentUser,
      isAdmin:      !!currentUser,
      isSuperAdmin: currentUser?.role === "superadmin",
      login, loginWithToken, logout, verifyPin, changePin, setRecoveryEmail, setDisplayName, hasPermission,
      locked, biometricEnabled, enableBiometric, disableBiometric, unlockBiometric,
    }}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
