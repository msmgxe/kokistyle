import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const { pin, email } = await req.json();

    const { data } = await getSupabaseAdmin()
      .from("superadmin_config")
      .select("pin")
      .eq("id", true)
      .maybeSingle();

    const storedPin = data?.pin ?? "2260223";
    if (String(pin) !== String(storedPin)) {
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
