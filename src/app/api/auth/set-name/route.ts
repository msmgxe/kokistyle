import { NextRequest, NextResponse } from "next/server";
import { limitByIp } from "@/src/lib/rate-limit";
import { getSupabaseAdmin } from "@/src/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const limited = limitByIp(req, "auth-set-name", 8, 60000);
  if (limited) return limited;

  try {
    const { pin, name } = await req.json();
    if (!pin || !name?.trim()) return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });

    const { data } = await getSupabaseAdmin()
      .from("superadmin_config")
      .select("pin")
      .eq("id", true)
      .maybeSingle();

    if (!data || String(pin) !== String(data.pin)) {
      return NextResponse.json({ ok: false, error: "PIN incorrecto" }, { status: 403 });
    }

    await getSupabaseAdmin()
      .from("superadmin_config")
      .update({ name: name.trim() })
      .eq("id", true);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
