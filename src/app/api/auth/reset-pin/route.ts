import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const { code, newPin } = await req.json();

    if (!code || !newPin || String(newPin).length < 4) {
      return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
    }

    const { data } = await getSupabaseAdmin()
      .from("superadmin_config")
      .select("recovery_code, recovery_expires_at")
      .eq("id", true)
      .maybeSingle();

    if (!data?.recovery_code || data.recovery_code !== String(code)) {
      return NextResponse.json({ ok: false, error: "Código incorrecto" }, { status: 400 });
    }

    if (new Date(data.recovery_expires_at) < new Date()) {
      return NextResponse.json({ ok: false, error: "Código expirado. Solicita uno nuevo." }, { status: 400 });
    }

    await getSupabaseAdmin().from("superadmin_config").update({
      pin: String(newPin),
      recovery_code: null,
      recovery_expires_at: null,
      updated_at: new Date().toISOString(),
    }).eq("id", true);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
