import { NextRequest, NextResponse } from "next/server";
import { limitByIp } from "@/src/lib/rate-limit";
import { getSupabaseAdmin } from "@/src/lib/supabase-admin";
import { checkPin } from "@/src/lib/pin";

export async function POST(req: NextRequest) {
  const limited = limitByIp(req, "auth-set-email", 8, 60000);
  if (limited) return limited;

  try {
    const { pin, email } = await req.json();

    // Sin configuración no hay superadmin: nunca un PIN de respaldo en el código.
    if (!(await checkPin("superadmin_config", { id: true }, String(pin)))) {
      return NextResponse.json({ ok: false, error: "PIN incorrecto" }, { status: 400 });
    }

    await getSupabaseAdmin().from("superadmin_config").upsert({
      id: true, email: String(email).toLowerCase(), updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
