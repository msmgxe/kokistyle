import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing. Check your environment variables.");
}

/**
 * Token de sesión para Supabase (Fase 2). Se pide al servidor y se guarda en
 * memoria hasta poco antes de expirar. Si no hay sesión —o el proyecto aún no
 * tiene configurado el secreto— devuelve null y supabase-js usa la anon key,
 * que es exactamente el comportamiento anterior.
 */
let cached: { token: string; expiresAt: number } | null = null;
let inFlight: Promise<string | null> | null = null;

async function luxAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;          // en servidor manda la anon key
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt - 60 > now) return cached.token;
  if (inFlight) return inFlight;                            // la opción puede llamarse en paralelo

  inFlight = (async () => {
    try {
      const res = await fetch("/api/auth/supabase-token", { credentials: "same-origin" });
      const data = await res.json() as { token?: string | null; expiresAt?: number };
      cached = data.token && data.expiresAt ? { token: data.token, expiresAt: data.expiresAt } : null;
      return cached?.token ?? null;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Olvida el token en memoria (al cerrar sesión o cambiar de usuario). */
export function resetSupabaseToken() { cached = null; }

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: luxAccessToken,
});
