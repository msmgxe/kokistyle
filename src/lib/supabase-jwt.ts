/**
 * Token de Supabase firmado por nosotros (Fase 2).
 *
 * El navegador deja de hablar con la anon key —igual para todo el mundo— y pasa
 * a llevar un JWT que dice quién es y qué proyectos le tocan. Con eso las
 * políticas RLS pueden decidir fila por fila.
 *
 * Mientras `SUPABASE_JWT_SECRET` no esté configurado, `mintSupabaseToken`
 * devuelve null y el cliente sigue usando la anon key: se puede desplegar sin
 * cambiar nada de comportamiento.
 *
 * SOLO servidor: no importar desde componentes.
 */
import crypto from "node:crypto";
import { getSupabaseAdmin } from "./supabase-admin";
import type { SessionPayload } from "./session";

/** Minutos de vida del token: corto, porque el cliente lo renueva solo. */
const TTL_SECONDS = 30 * 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

export interface LuxClaims {
  lux_role: "superadmin" | "coworker" | "client";
  lux_projects: string[];
}

/** Proyectos que puede ver la sesión. El superadmin no necesita lista. */
export async function projectsForSession(session: SessionPayload): Promise<LuxClaims> {
  if (session.role === "superadmin") return { lux_role: "superadmin", lux_projects: [] };

  const admin = getSupabaseAdmin();
  const [{ data: access }, { data: user }] = await Promise.all([
    admin.from("user_project_access").select("project_id").eq("user_id", session.sub),
    admin.from("app_users").select("user_type").eq("id", session.sub).maybeSingle(),
  ]);

  return {
    lux_role: user?.user_type === "client" ? "client" : "coworker",
    lux_projects: (access ?? []).map(r => String(r.project_id)),
  };
}

/**
 * Firma el JWT que entiende PostgREST. `role` tiene que ser un rol real de
 * Postgres (`authenticated`); el resto son claims propios que leen las políticas.
 */
export function mintSupabaseToken(session: SessionPayload, claims: LuxClaims): { token: string; expiresAt: number } | null {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) return null;

  const now = Math.floor(Date.now() / 1000);
  const exp = now + TTL_SECONDS;
  const payload: Record<string, unknown> = {
    role: "authenticated",
    aud:  "authenticated",
    iat:  now,
    exp,
    ...claims,
  };
  // `sub` sólo si es un UUID: Supabase lo interpreta como id de usuario.
  if (UUID_RE.test(session.sub)) payload.sub = session.sub;

  const data = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}`;
  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return { token: `${data}.${signature}`, expiresAt: exp };
}
