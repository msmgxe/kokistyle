/**
 * Sesión de servidor firmada (HMAC-SHA256) en cookie httpOnly.
 *
 * El PIN sigue siendo la puerta de entrada, pero se canjea server-side por esta
 * cookie: a partir de ahí las rutas de API no vuelven a confiar en lo que diga
 * el cliente. Sustituye al patrón de mandar `adminPin` en el cuerpo — que se
 * mantiene sólo como respaldo para las sesiones abiertas antes del despliegue.
 *
 * SOLO servidor: no importar desde componentes.
 */
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "./supabase-admin";
import { checkPin, verifyPinHash, upgradePin } from "./pin";

export const SESSION_COOKIE = "lux_session";
const MAX_AGE = 60 * 60 * 24 * 30;   // 30 días

export interface SessionPayload {
  sub: string;                                  // "superadmin" | app_users.id
  role: "superadmin" | "collaborator";
  name: string;
  exp: number;                                  // epoch en segundos
}

/** Clave de firma: `SESSION_SECRET` si existe; si no, material de la service role
 *  (server-only) para no bloquear el despliegue. En desarrollo sin ninguna de las
 *  dos se usa una clave efímera: las sesiones no sobreviven al reinicio, pero el
 *  panel funciona en local. En producción, sin clave no se firma nada. */
const DEV_KEY = process.env.NODE_ENV === "production" ? "" : crypto.randomBytes(32).toString("hex");
let warned = false;

function signingKey(): string {
  const key = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || DEV_KEY;
  if (!key && !warned) {
    warned = true;
    console.error(JSON.stringify({
      scope: "session",
      error: "No hay SESSION_SECRET ni SUPABASE_SERVICE_ROLE_KEY: las sesiones de servidor quedan deshabilitadas.",
    }));
  }
  return key;
}

const sign = (data: string) =>
  crypto.createHmac("sha256", signingKey()).update(data).digest("base64url");

export function issueSession(user: Omit<SessionPayload, "exp">, maxAge = MAX_AGE): string {
  const body = { ...user, exp: Math.floor(Date.now() / 1000) + maxAge };
  const data = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifySession(raw?: string | null): SessionPayload | null {
  if (!raw || !signingKey()) return null;
  const [data, sig] = raw.split(".");
  if (!data || !sig) return null;
  const expected = sign(data);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload;
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch { return null; }
}

const cookieOpts = (maxAge: number) => ({
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

export function setSessionCookie(res: NextResponse, token: string, maxAge = MAX_AGE) {
  res.cookies.set(SESSION_COOKIE, token, cookieOpts(maxAge));
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", cookieOpts(0));
}

/** Token de dispositivo válido: existe, no revocado y **no expirado**. */
export async function sessionFromDeviceToken(token: string): Promise<SessionPayload | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("device_tokens")
    .select("user_id, revoked, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!data || data.revoked) return null;
  if (data.expires_at && new Date(data.expires_at as string).getTime() < Date.now()) return null;

  const userId = String(data.user_id);
  if (userId === "superadmin") {
    const { data: cfg } = await admin
      .from("superadmin_config").select("name").eq("id", true).maybeSingle();
    return {
      sub: "superadmin", role: "superadmin",
      name: String(cfg?.name ?? "Admin"),
      exp: Math.floor(Date.now() / 1000) + MAX_AGE,
    };
  }
  const { data: user } = await admin
    .from("app_users").select("name").eq("id", userId).eq("active", true).maybeSingle();
  if (!user) return null;
  return {
    sub: userId, role: "collaborator",
    name: String(user.name ?? ""),
    exp: Math.floor(Date.now() / 1000) + MAX_AGE,
  };
}

async function sessionFromPin(pin: string): Promise<SessionPayload | null> {
  const cfg = await checkPin("superadmin_config", { id: true }, pin, "name");
  if (cfg) {
    return {
      sub: "superadmin", role: "superadmin",
      name: String(cfg.name ?? "Admin"),
      exp: Math.floor(Date.now() / 1000) + MAX_AGE,
    };
  }
  const user = await findUserByPin(pin);
  if (!user) return null;
  return {
    sub: String(user.id), role: "collaborator",
    name: String(user.name ?? ""),
    exp: Math.floor(Date.now() / 1000) + MAX_AGE,
  };
}

/**
 * Colaborador por PIN. Con los PINes hasheados ya no se puede buscar por
 * igualdad, así que se recorren los activos y se comprueba cada uno; el
 * conjunto es una cuadrilla, no un padrón.
 */
export async function findUserByPin(pin: string): Promise<Record<string, unknown> | null> {
  if (!pin) return null;
  const { data } = await getSupabaseAdmin()
    .from("app_users").select("*").eq("active", true);

  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const hash  = row.pin_hash as string | undefined;
    const plain = row.pin as string | undefined;
    const ok = hash
      ? verifyPinHash(pin, hash)
      : !!plain && String(plain) === String(pin);
    if (!ok) continue;
    if (!hash) await upgradePin("app_users", { id: row.id }, pin);   // migra al vuelo
    const safe = { ...row };
    delete safe.pin;
    delete safe.pin_hash;                       // el PIN nunca vuelve al cliente
    return safe;
  }
  return null;
}

/** Sesión de la petición: cookie firmada o, como respaldo temporal, el
 *  `adminToken`/`adminPin` que aún envían algunas pantallas. */
export async function resolveSession(
  req: NextRequest,
  legacy?: { adminPin?: string; adminToken?: string },
): Promise<SessionPayload | null> {
  const fromCookie = verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (fromCookie) return fromCookie;
  try {
    if (legacy?.adminToken) {
      const s = await sessionFromDeviceToken(legacy.adminToken);
      if (s) return s;
    }
    if (legacy?.adminPin) return await sessionFromPin(legacy.adminPin);
  } catch {
    return null;                       // sin base no hay sesión, nunca un 500
  }
  return null;
}

export const unauthorized = () =>
  NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

export { sessionFromPin };
