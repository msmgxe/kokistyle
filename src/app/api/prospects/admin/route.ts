import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase-admin";

export const maxDuration = 15;

/** Valida que quien llama sea el superadmin: por PIN (sesión clásica) o por token de
 *  dispositivo superadmin no revocado (sesión de shortcut). Los datos de contacto de
 *  los prospectos son privados — nunca se exponen con la anon key. */
async function isSuperadmin(pin?: string, token?: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (pin) {
    const { data } = await admin.from("superadmin_config").select("pin").eq("id", true).maybeSingle();
    if (data && String(pin) === String(data.pin)) return true;
  }
  if (token) {
    const { data } = await admin.from("device_tokens")
      .select("user_id, revoked").eq("token", token).maybeSingle();
    if (data && data.user_id === "superadmin" && !data.revoked) return true;
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const { pin, token, op, id, status, notes } = await req.json() as {
      pin?: string; token?: string; op?: "list" | "update" | "delete";
      id?: string; status?: string; notes?: string;
    };
    if (!(await isSuperadmin(pin, token))) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
    }
    const admin = getSupabaseAdmin();

    if (op === "list") {
      const { data, error } = await admin.from("prospects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return NextResponse.json({ ok: true, prospects: data ?? [] });
    }
    if (op === "update") {
      if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
      const patch: Record<string, unknown> = {};
      if (status !== undefined) patch.status = status;
      if (notes  !== undefined) patch.notes  = notes;
      const { error } = await admin.from("prospects").update(patch).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (op === "delete") {
      if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
      const { error } = await admin.from("prospects").delete().eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: "unknown_op" }, { status: 400 });
  } catch (err) {
    console.error(JSON.stringify({ route: "/api/prospects/admin", error: err instanceof Error ? err.message : String(err) }));
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
