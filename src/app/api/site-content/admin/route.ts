import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase-admin";
import type { SiteContent } from "@/src/types/site";
import { resolveSession } from "@/src/lib/session";

export const maxDuration = 15;

/** Superadmin: cookie de sesión o, como respaldo, PIN/token de dispositivo.
 *  `resolveSession` es el único punto que valida revocación **y** expiración. */
async function isSuperadmin(req: NextRequest, pin?: string, token?: string): Promise<boolean> {
  const session = await resolveSession(req, { adminPin: pin, adminToken: token });
  return session?.role === "superadmin";
}

export async function POST(req: NextRequest) {
  try {
    const { pin, token, data } = await req.json() as { pin?: string; token?: string; data?: SiteContent };
    if (!(await isSuperadmin(req, pin, token))) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
    }
    if (!data || typeof data !== "object") {
      return NextResponse.json({ ok: false, error: "invalid_data" }, { status: 400 });
    }
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("site_content")
      .upsert({ id: true, data, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(JSON.stringify({ route: "/api/site-content/admin", error: err instanceof Error ? err.message : String(err) }));
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
