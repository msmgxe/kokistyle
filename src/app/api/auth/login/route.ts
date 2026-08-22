import { NextRequest, NextResponse } from "next/server";
import { issueSession, setSessionCookie, findUserByPin } from "@/src/lib/session";
import { checkPin } from "@/src/lib/pin";
import { limitByIp } from "@/src/lib/rate-limit";

/**
 * Canjea el PIN por una sesión de servidor (cookie firmada httpOnly).
 * El PIN del colaborador se verifica aquí con la service role: el navegador ya
 * no consulta `app_users` ni recibe PINes de nadie.
 */
export async function POST(req: NextRequest) {
  const limited = limitByIp(req, "auth-login", 10, 60_000);
  if (limited) return limited;

  try {
    const { pin } = await req.json() as { pin?: string };
    if (!pin) return NextResponse.json({ isSuperAdmin: false, ok: false });

    // Sin configuración no hay superadmin: nunca un PIN de respaldo en el código.
    const cfg = await checkPin("superadmin_config", { id: true }, pin, "email, name");
    if (cfg) {
      const name = String(cfg.name ?? "Admin");
      const res = NextResponse.json({
        ok: true, isSuperAdmin: true, email: cfg.email ?? null, name,
      });
      setSessionCookie(res, issueSession({ sub: "superadmin", role: "superadmin", name }));
      return res;
    }

    const user = await findUserByPin(pin);      // el PIN nunca vuelve al cliente
    if (!user) return NextResponse.json({ ok: false, isSuperAdmin: false });

    const res = NextResponse.json({ ok: true, isSuperAdmin: false, user });
    setSessionCookie(res, issueSession({
      sub:  String(user.id),
      role: "collaborator",
      name: String(user.name ?? ""),
    }));
    return res;
  } catch {
    return NextResponse.json({ ok: false, isSuperAdmin: false }, { status: 500 });
  }
}
