import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase-admin";

export const maxDuration = 15;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (s: unknown, max = 200) => String(s ?? "").trim().slice(0, max);

/** POST — captura de lead público (gate del AI Design gratuito). Server-side, admin client. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Actualización ligera del último render (tras un render exitoso en el cliente)
    if (body.id && body.renderUrl) {
      await getSupabaseAdmin().from("prospects")
        .update({ last_render_url: clean(body.renderUrl, 600) })
        .eq("id", clean(body.id, 60));
      return NextResponse.json({ ok: true });
    }

    const name  = clean(body.name, 120);
    const email = clean(body.email, 160).toLowerCase();
    const phoneDigits = clean(body.phone, 40).replace(/[^\d+]/g, "");
    const room_type = body.room_type ? clean(body.room_type, 60) : null;
    const style     = body.style ? clean(body.style, 60) : null;

    if (name.length < 2)                return NextResponse.json({ ok: false, error: "invalid_name" },  { status: 400 });
    if (!EMAIL_RE.test(email))          return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    if (phoneDigits.replace(/\D/g, "").length < 7)
                                        return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 });

    const admin = getSupabaseAdmin();
    // Dedupe por email: reutiliza el prospecto existente (no crea duplicados)
    const { data: existing } = await admin
      .from("prospects").select("id, renders_used").eq("email", email).maybeSingle();

    if (existing) {
      await admin.from("prospects")
        .update({ name, phone: phoneDigits, room_type, style, last_used_at: new Date().toISOString() })
        .eq("id", existing.id);
      return NextResponse.json({ ok: true, id: existing.id, rendersUsed: existing.renders_used });
    }

    const { data, error } = await admin.from("prospects")
      .insert({ name, email, phone: phoneDigits, room_type, style })
      .select("id, renders_used").single();
    if (error || !data) throw error ?? new Error("insert failed");

    return NextResponse.json({ ok: true, id: data.id, rendersUsed: 0 });
  } catch (err) {
    console.error(JSON.stringify({ route: "/api/prospects", error: err instanceof Error ? err.message : String(err) }));
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
