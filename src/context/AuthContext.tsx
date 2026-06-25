"use client";

import {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import type { AppUser, PermissionSection, PermissionAction } from "@/src/types/auth";
import { FULL_PERMISSIONS } from "@/src/types/auth";

// ── Superadmin hardcoded — nunca en DB ────────────────────────────────────
const SUPERADMIN_PIN = "2260223";
const SUPERADMIN: AppUser = {
  id:          "superadmin",
  name:        "Marco",
  pin:         SUPERADMIN_PIN,
  role:        "superadmin",
  permissions: FULL_PERMISSIONS,
  active:      true,
};

const SESSION_KEY = "kokistyle-session";

// ── Context type ─────────────────────────────────────────────────────────
interface AuthContextType {
  currentUser:   AppUser | null;
  isAdmin:       boolean;
  isSuperAdmin:  boolean;
  login:         (pin: string) => Promise<boolean>;
  logout:        () => void;
  verifyPin:     (pin: string) => boolean;
  hasPermission: (section: PermissionSection, action: PermissionAction) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const router = useRouter();

  // Restore session from localStorage
  useEffect(() => {
    if (typeof window === "undefined") { setIsLoading(false); return; }
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try { setCurrentUser(JSON.parse(stored)); } catch { localStorage.removeItem(SESSION_KEY); }
    }
    setIsLoading(false);
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────
  const login = useCallback(async (pin: string): Promise<boolean> => {
    // 1. Superadmin
    if (pin === SUPERADMIN_PIN) {
      setCurrentUser(SUPERADMIN);
      localStorage.setItem(SESSION_KEY, JSON.stringify(SUPERADMIN));
      return true;
    }
    // 2. DB users
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

  // ── Logout ─────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_KEY);
    router.push("/");
  }, [router]);

  // ── Sync PIN verification (for in-app confirmations, e.g. Notas) ───────
  const verifyPin = useCallback((pin: string): boolean => {
    if (!currentUser) return false;
    return pin === currentUser.pin || pin === SUPERADMIN_PIN;
  }, [currentUser]);

  // ── Permission check ───────────────────────────────────────────────────
  const hasPermission = useCallback(
    (section: PermissionSection, action: PermissionAction): boolean => {
      if (!currentUser) return false;
      if (currentUser.role === "superadmin") return true;
      return currentUser.permissions?.[section]?.[action] ?? false;
    },
    [currentUser]
  );

  const isAdmin    = !!currentUser;
  const isSuperAdmin = currentUser?.role === "superadmin";

  return (
    <AuthContext.Provider value={{
      currentUser, isAdmin, isSuperAdmin,
      login, logout, verifyPin, hasPermission,
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
