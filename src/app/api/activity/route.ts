import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase-admin";
import { resolveSession } from "@/src/lib/session";
import { limitByIp } from "@/src/lib/rate-limit";

export const maxDuration = 10;

/**
 * Registro de actividad. **El actor lo pone el servidor**, derivado de la
 * sesión: el cliente no puede atribuirle una acción a otra persona. Antes el
 * navegador insertaba la fila entera, incluido quién la hacía, así que la
 * auditoría no servía como auditoría.
 */
export async function POST(req: NextRequest) {
  const limited = limitByIp(req, "activity", 240, 60_000);
  if (limited) return limited;

  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const cuerpo = await req.json() as Record<string, unknown>;

    // Sólo se acepta lo que describe la acción; el actor lo decide el servidor.
    const fila = {
      action:       String(cuerpo.action ?? "").slice(0, 40),
      entity_type:  cuerpo.entity_type  ? String(cuerpo.entity_type).slice(0, 40)  : null,
      entity_id:    cuerpo.entity_id    ? String(cuerpo.entity_id).slice(0, 80)    : null,
      entity_name:  cuerpo.entity_name  ? String(cuerpo.entity_name).slice(0, 200) : null,
      project_id:   cuerpo.project_id   ? String(cuerpo.project_id)                : null,
      project_name: cuerpo.project_name ? String(cuerpo.project_name).slice(0, 200): null,
      details:      typeof cuerpo.details === "object" ? cuerpo.details : null,
      user_id:      session.sub,
      user_name:    session.name,
      user_role:    session.role === "superadmin" ? "superadmin" : "colaborador",
    };
    if (!fila.action) return NextResponse.json({ ok: false, error: "action required" }, { status: 400 });

    const { error } = await getSupabaseAdmin().from("activity_log").insert(fila);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(JSON.stringify({ route: "/api/activity", error: err instanceof Error ? err.message : String(err) }));
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
