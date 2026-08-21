import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/src/lib/session";

/** Cierra la sesión de servidor borrando la cookie firmada. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
