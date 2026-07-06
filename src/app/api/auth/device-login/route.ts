import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json() as { token?: string };
    if (!token) return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: device } = await admin
      .from("device_tokens")
      .select("id, user_id, revoked, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!device || device.revoked) {
      return NextResponse.json({ ok: false, error: "Token inválido o revocado" }, { status: 403 });
    }
    if (device.expires_at && new Date(device.expires_at) < new Date()) {
      return NextResponse.json({ ok: false, error: "Token expirado" }, { status: 403 });
    }

    await admin.from("device_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", device.id);

    if (device.user_id === "superadmin") {
      const { data: cfg } = await admin
        .from("superadmin_config")
        .select("name")
        .eq("id", true)
        .maybeSingle();
      return NextResponse.json({ ok: true, role: "superadmin", name: cfg?.name ?? "Admin" });
    }

    const { data: user } = await admin
      .from("app_users")
      .select("*")
      .eq("id", device.user_id)
      .eq("active", true)
      .maybeSingle();
    if (!user) return NextResponse.json({ ok: false, error: "Usuario inactivo" }, { status: 403 });
    return NextResponse.json({ ok: true, role: "colaborador", user });
  } catch {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
