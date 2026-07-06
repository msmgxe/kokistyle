import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/src/lib/supabase-admin";

async function verifySuperadminPin(pin: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin()
    .from("superadmin_config")
    .select("pin")
    .eq("id", true)
    .maybeSingle();
  return !!data && String(pin) === String(data.pin);
}

export async function POST(req: NextRequest) {
  try {
    const { pin, op, label, id } = await req.json() as {
      pin?: string; op?: "create" | "list" | "revoke"; label?: string; id?: string;
    };
    if (!pin || !op) return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    if (!(await verifySuperadminPin(pin))) {
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
