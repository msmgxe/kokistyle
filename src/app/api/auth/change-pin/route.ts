import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const { currentPin, newPin } = await req.json();

    if (!currentPin || !newPin || String(newPin).length < 4) {
      return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
    }

    const { data } = await getSupabaseAdmin()
      .from("superadmin_config")
      .select("pin")
      .eq("id", true)
      .maybeSingle();

    const storedPin = data?.pin ?? "2260223";
    if (String(currentPin) !== String(storedPin)) {
      return NextResponse.json({ ok: false, error: "PIN actual incorrecto" }, { status: 400 });
    }

    await getSupabaseAdmin()
      .from("superadmin_config")
      .upsert({ id: true, pin: String(newPin), updated_at: new Date().toISOString() });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
