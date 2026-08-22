import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/src/lib/session";
import { mintSupabaseToken, projectsForSession } from "@/src/lib/supabase-jwt";
import { limitByIp } from "@/src/lib/rate-limit";

export const maxDuration = 15;

/**
 * Entrega al navegador el token con el que hablará con Supabase. Sin sesión, o
 * mientras `SUPABASE_JWT_SECRET` no esté configurado, responde `token: null` y
 * el cliente sigue con la anon key (comportamiento actual).
 */
export async function GET(req: NextRequest) {
  const limited = limitByIp(req, "supabase-token", 120, 60_000);
  if (limited) return limited;

  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ token: null }, { status: 200 });

  try {
    const claims = await projectsForSession(session);
    const minted = mintSupabaseToken(session, claims);
    if (!minted) return NextResponse.json({ token: null });
    return NextResponse.json(minted, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ token: null });
  }
}
