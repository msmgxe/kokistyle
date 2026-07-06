"use client";

import {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
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
const SESSION_KEY = "kokistyle-session";

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
      const { isSuperAdmin, name } = await res.json();
      if (isSuperAdmin) {
        const user: AppUser = { ...SUPERADMIN_TEMPLATE, pin, name: name ?? "Admin" };
        setCurrentUser(user);
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        logActivity({ user_id: "superadmin", user_name: user.name, user_role: "superadmin", action: "login" });
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
    logActivity({ user_id: user.id, user_name: user.name, user_role: "collaborator", action: "login" });
    return true;
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
      logActivity({
        user_id: user.id, user_name: user.name,
        user_role: data.role === "superadmin" ? "superadmin" : "collaborator",
        action: "login", details: { method: "device_token" },
      });
      return true;
    } catch { return false; }
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
      localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    }
    return data;
  }, [currentUser]);

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
