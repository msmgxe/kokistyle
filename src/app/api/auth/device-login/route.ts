import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase-admin";
import { issueSession, setSessionCookie } from "@/src/lib/session";
import { limitByIp } from "@/src/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limited = limitByIp(req, "device-login", 20, 60_000);
  if (limited) return limited;

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
      const name = String(cfg?.name ?? "Admin");
      const res = NextResponse.json({ ok: true, role: "superadmin", name });
      setSessionCookie(res, issueSession({ sub: "superadmin", role: "superadmin", name }));
      return res;
    }

    const { data: user } = await admin
      .from("app_users")
      .select("*")
      .eq("id", device.user_id)
      .eq("active", true)
      .maybeSingle();
    if (!user) return NextResponse.json({ ok: false, error: "Usuario inactivo" }, { status: 403 });
    const res = NextResponse.json({ ok: true, role: "colaborador", user });
    setSessionCookie(res, issueSession({
      sub: String(user.id), role: "collaborator", name: String(user.name ?? ""),
    }));
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
