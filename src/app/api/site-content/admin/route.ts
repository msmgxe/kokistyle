import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase-admin";
import type { SiteContent } from "@/src/types/site";

export const maxDuration = 15;

async function isSuperadmin(pin?: string, token?: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (pin) {
    const { data } = await admin.from("superadmin_config").select("pin").eq("id", true).maybeSingle();
    if (data && String(pin) === String(data.pin)) return true;
  }
  if (token) {
    const { data } = await admin.from("device_tokens").select("user_id, revoked").eq("token", token).maybeSingle();
    if (data && data.user_id === "superadmin" && !data.revoked) return true;
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const { pin, token, data } = await req.json() as { pin?: string; token?: string; data?: SiteContent };
    if (!(await isSuperadmin(pin, token))) {
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
