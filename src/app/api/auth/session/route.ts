import { NextRequest, NextResponse } from "next/server";
import {
  issueSession, setSessionCookie, resolveSession, sessionFromDeviceToken, sessionFromPin,
} from "@/src/lib/session";
import { limitByIp } from "@/src/lib/rate-limit";

/**
 * Renueva (o crea) la cookie de sesión a partir de la sesión que el dispositivo
 * ya tenía: el token guardado o el PIN de la sesión en curso. Lo llama el panel
 * al arrancar para que las sesiones abiertas antes del despliegue no se queden
 * sin cookie y sigan pudiendo usar las rutas protegidas.
 */
export async function POST(req: NextRequest) {
  const limited = limitByIp(req, "auth-session", 30, 60_000);
  if (limited) return limited;

  try {
    const body = await req.json().catch(() => ({})) as { token?: string; pin?: string };
    const existing = await resolveSession(req);
    const session = existing
      ?? (body.token ? await sessionFromDeviceToken(body.token) : null)
      ?? (body.pin ? await sessionFromPin(body.pin) : null);

    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const res = NextResponse.json({ ok: true, role: session.role, name: session.name });
    setSessionCookie(res, issueSession({ sub: session.sub, role: session.role, name: session.name }));
    return res;
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
