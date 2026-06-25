"use client";

import {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import type { AppUser, PermissionSection, PermissionAction } from "@/src/types/auth";
import { FULL_PERMISSIONS } from "@/src/types/auth";

const SUPERADMIN_TEMPLATE: Omit<AppUser, "pin"> = {
  id:          "superadmin",
  name:        "Marco",
  role:        "superadmin",
  permissions: FULL_PERMISSIONS,
  active:      true,
};
const SESSION_KEY = "kokistyle-session";

interface AuthContextType {
  currentUser:   AppUser | null;
  isAdmin:       boolean;
  isSuperAdmin:  boolean;
  login:         (pin: string) => Promise<boolean>;
  logout:        () => void;
  verifyPin:     (pin: string) => Promise<boolean>;
  changePin:     (currentPin: string, newPin: string) => Promise<{ ok: boolean; error?: string }>;
  setRecoveryEmail: (pin: string, email: string) => Promise<{ ok: boolean; error?: string }>;
  hasPermission: (section: PermissionSection, action: PermissionAction) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") { setIsLoading(false); return; }
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try { setCurrentUser(JSON.parse(stored)); } catch { localStorage.removeItem(SESSION_KEY); }
    }
    setIsLoading(false);
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (pin: string): Promise<boolean> => {
    // 1. Check superadmin via secure API route
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const { isSuperAdmin } = await res.json();
      if (isSuperAdmin) {
        const user: AppUser = { ...SUPERADMIN_TEMPLATE, pin };
        setCurrentUser(user);
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        return true;
      }
    } catch { /* API unavailable — continue to collaborator check */ }

    // 2. Check collaborator in DB
    const { data, error } = await supabase
      .from("app_users")
      .select("*")
      .eq("pin", pin)
      .eq("active", true)
      .maybeSingle();
    if (error || !data) return false;
    const user = data as AppUser;
    setCurrentUser(user);
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return true;
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_KEY);
    router.push("/");
  }, [router]);

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
      localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    }
    return data;
  }, [currentUser]);

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
      login, logout, verifyPin, changePin, setRecoveryEmail, hasPermission,
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
