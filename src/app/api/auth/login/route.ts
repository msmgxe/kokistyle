import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase-admin";
import { issueSession, setSessionCookie } from "@/src/lib/session";
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

    const admin = getSupabaseAdmin();
    const { data: cfg } = await admin
      .from("superadmin_config")
      .select("pin, email, name")
      .eq("id", true)
      .maybeSingle();

    // Sin configuración no hay superadmin: nunca un PIN de respaldo en el código.
    if (cfg?.pin && String(pin) === String(cfg.pin)) {
      const name = String(cfg.name ?? "Admin");
      const res = NextResponse.json({
        ok: true, isSuperAdmin: true, email: cfg.email ?? null, name,
      });
      setSessionCookie(res, issueSession({ sub: "superadmin", role: "superadmin", name }));
      return res;
    }

    const { data: user } = await admin
      .from("app_users")
      .select("*")
      .eq("pin", pin)
      .eq("active", true)
      .maybeSingle();

    if (!user) return NextResponse.json({ ok: false, isSuperAdmin: false });

    const { pin: _pin, ...safeUser } = user as Record<string, unknown>;
    void _pin;                                   // el PIN no vuelve al cliente
    const res = NextResponse.json({ ok: true, isSuperAdmin: false, user: safeUser });
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
