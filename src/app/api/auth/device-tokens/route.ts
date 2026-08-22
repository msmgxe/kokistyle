import { NextRequest, NextResponse } from "next/server";
import { limitByIp } from "@/src/lib/rate-limit";
import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/src/lib/supabase-admin";
import { resolveSession } from "@/src/lib/session";

/** Superadmin: cookie de sesión o el PIN que aún envía el panel. */
async function verifySuperadmin(req: NextRequest, pin?: string): Promise<boolean> {
  const session = await resolveSession(req, { adminPin: pin });
  return session?.role === "superadmin";
}

export async function POST(req: NextRequest) {
  const limited = limitByIp(req, "auth-device-tokens", 20, 60000);
  if (limited) return limited;

  try {
    const { pin, op, label, id } = await req.json() as {
      pin?: string; op?: "create" | "list" | "revoke"; label?: string; id?: string;
    };
    if (!pin || !op) return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    if (!(await verifySuperadmin(req, pin))) {
      return NextResponse.json({ ok: false, error: "PIN incorrecto" }, { status: 403 });
    }

    const admin = getSupabaseAdmin();

    if (op === "create") {
      const token = randomBytes(24).toString("base64url");
      const { data, error } = await admin
        .from("device_tokens")
        .insert({ token, user_id: "superadmin", label: label?.trim() || null })
        .select("id, token, label, created_at")
        .single();
      if (error) throw error;
      return NextResponse.json({ ok: true, device: data });
    }

    if (op === "list") {
      const { data, error } = await admin
        .from("device_tokens")
        .select("id, token, label, revoked, last_used_at, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return NextResponse.json({ ok: true, devices: data ?? [] });
    }

    if (op === "revoke") {
      if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
      const { error } = await admin.from("device_tokens").update({ revoked: true }).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unknown op" }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
