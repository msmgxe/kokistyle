import { NextRequest, NextResponse } from "next/server";
import { limitByIp } from "@/src/lib/rate-limit";
import { MIN_PIN_LENGTH } from "@/src/lib/pin";
import { getSupabaseAdmin } from "@/src/lib/supabase-admin";
import { writePin } from "@/src/lib/pin";

export async function POST(req: NextRequest) {
  const limited = limitByIp(req, "auth-reset-pin", 8, 60000);
  if (limited) return limited;

  try {
    const { code, newPin } = await req.json();

    if (!code || !newPin || String(newPin).length < MIN_PIN_LENGTH) {
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

    const saved = await writePin("superadmin_config", { id: true }, String(newPin));
    if (!saved.ok) return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    await getSupabaseAdmin().from("superadmin_config").update({
      recovery_code: null,
      recovery_expires_at: null,
      updated_at: new Date().toISOString(),
    }).eq("id", true);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
