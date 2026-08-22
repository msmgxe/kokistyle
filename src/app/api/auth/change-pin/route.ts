import { NextRequest, NextResponse } from "next/server";
import { limitByIp } from "@/src/lib/rate-limit";
import { MIN_PIN_LENGTH } from "@/src/lib/pin";
import { checkPin, writePin } from "@/src/lib/pin";

export async function POST(req: NextRequest) {
  const limited = limitByIp(req, "auth-change-pin", 8, 60000);
  if (limited) return limited;

  try {
    const { currentPin, newPin } = await req.json();

    if (!currentPin || !newPin || String(newPin).length < MIN_PIN_LENGTH) {
      return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
    }

    // Sin configuración no hay superadmin: nunca un PIN de respaldo en el código.
    if (!(await checkPin("superadmin_config", { id: true }, String(currentPin)))) {
      return NextResponse.json({ ok: false, error: "PIN actual incorrecto" }, { status: 400 });
    }

    const saved = await writePin("superadmin_config", { id: true }, String(newPin));
    if (!saved.ok) return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
