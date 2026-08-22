/**
 * PINes guardados con scrypt (node:crypto — sin dependencias nuevas).
 *
 * Un PIN corto no da mucha entropía, así que la defensa es doble: scrypt hace
 * caro cada intento offline (16 MB de memoria por hash, hostil para GPU) y el
 * rate limit por IP corta el ataque online. Aun así, cuanto más largo el PIN,
 * mejor: seis dígitos o más.
 *
 * Migración sin cortes: mientras exista `pin` en claro se acepta, y en ese mismo
 * inicio de sesión se guarda su hash y se borra el texto. No hace falta obligar
 * a nadie a cambiar de PIN.
 *
 * SOLO servidor: no importar desde componentes.
 */
import crypto from "node:crypto";
import { getSupabaseAdmin } from "./supabase-admin";

const N = 16384, r = 8, p = 1, KEYLEN = 32, MAXMEM = 64 * 1024 * 1024;

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(pin), salt, KEYLEN, { N, r, p, maxmem: MAXMEM });
  return ["scrypt", N, r, p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export function verifyPinHash(pin: string, stored: string): boolean {
  const parts = String(stored).split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, rr, pp, salt, hash] = parts;
  try {
    const expected = Buffer.from(hash, "base64url");
    const key = crypto.scryptSync(String(pin), Buffer.from(salt, "base64url"), expected.length,
      { N: Number(n), r: Number(rr), p: Number(pp), maxmem: MAXMEM });
    return key.length === expected.length && crypto.timingSafeEqual(key, expected);
  } catch { return false; }
}

/** Fila con PIN: la columna `pin_hash` puede no existir todavía. */
type PinRow = { pin?: string | null; pin_hash?: string | null };

/** Lee pin/pin_hash tolerando que la migración aún no se haya corrido. */
async function selectPin(table: string, match: Record<string, unknown>, extra = "") {
  const admin = getSupabaseAdmin();
  const cols = (withHash: boolean) => ["pin", withHash ? "pin_hash" : "", extra]
    .filter(Boolean).join(", ");
  let res = await admin.from(table).select(cols(true)).match(match).maybeSingle();
  if (res.error) res = await admin.from(table).select(cols(false)).match(match).maybeSingle();
  return res.data as (PinRow & Record<string, unknown>) | null;
}

/** Guarda el hash y borra el PIN en claro (best-effort: si falta la columna, no rompe). */
async function upgradeStoredPin(table: string, match: Record<string, unknown>, pin: string) {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from(table).update({ pin_hash: hashPin(pin), pin: "" }).match(match);
  if (error) {
    console.error(JSON.stringify({ scope: "pin", table, error: error.message }));
  }
}

/**
 * Comprueba un PIN contra la fila indicada. Si todavía estaba en claro y es
 * correcto, lo migra a hash en el acto. Devuelve la fila cuando el PIN es válido.
 */
export async function checkPin(
  table: "superadmin_config" | "app_users",
  match: Record<string, unknown>,
  pin: string,
  extraCols = "",
): Promise<(PinRow & Record<string, unknown>) | null> {
  if (!pin) return null;
  const row = await selectPin(table, match, extraCols);
  if (!row) return null;

  if (row.pin_hash) return verifyPinHash(pin, row.pin_hash) ? row : null;

  // Todavía en claro: se acepta una única vez y se migra.
  if (row.pin && String(row.pin) === String(pin)) {
    await upgradeStoredPin(table, match, pin);
    return row;
  }
  return null;
}

/** Escribe un PIN nuevo ya hasheado. */
export async function writePin(
  table: "superadmin_config" | "app_users",
  match: Record<string, unknown>,
  pin: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from(table).update({ pin_hash: hashPin(pin), pin: "" }).match(match);
  if (!error) return { ok: true };
  // Sin la columna migrada todavía: se guarda en claro para no bloquear al usuario.
  const legacy = await admin.from(table).update({ pin }).match(match);
  return legacy.error ? { ok: false, error: legacy.error.message } : { ok: true };
}
