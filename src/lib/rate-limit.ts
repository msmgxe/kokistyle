/**
 * Límite de peticiones por ventana fija, en memoria del proceso.
 *
 * En serverless cada instancia lleva su propio contador, así que no es una
 * cuota exacta: es fricción suficiente para que una ruta de costo (correo, IA)
 * no se pueda abusar en bucle desde una IP. Para cuotas duras hace falta un
 * almacén compartido (Postgres o Redis) — ver Fase 4 del plan.
 *
 * SOLO servidor: no importar desde componentes.
 */
import { NextRequest, NextResponse } from "next/server";

type Bucket = { count: number; reset: number };

const buckets = new Map<string, Bucket>();
let lastPrune = 0;

function prune(now: number) {
  if (now - lastPrune < 60_000) return;
  lastPrune = now;
  for (const [key, b] of buckets) if (b.reset <= now) buckets.delete(key);
}

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  prune(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.reset - now) / 1000)) };
  }
  return { ok: true, retryAfter: 0 };
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
}

export const tooManyRequests = (retryAfter: number) =>
  NextResponse.json(
    { ok: false, error: "rate_limited", retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );

/** Atajo: aplica el límite por IP y devuelve la respuesta 429 si toca. */
export function limitByIp(req: NextRequest, name: string, limit: number, windowMs: number): NextResponse | null {
  const { ok, retryAfter } = rateLimit(`${name}:${clientIp(req)}`, limit, windowMs);
  return ok ? null : tooManyRequests(retryAfter);
}
