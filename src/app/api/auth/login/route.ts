import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json();
    if (!pin) return NextResponse.json({ isSuperAdmin: false });

    const { data } = await getSupabaseAdmin()
      .from("superadmin_config")
      .select("pin, email")
      .eq("id", true)
      .maybeSingle();

    const storedPin = data?.pin ?? "2260223";
    const isSuperAdmin = String(pin) === String(storedPin);

    return NextResponse.json({
      isSuperAdmin,
      email: isSuperAdmin ? (data?.email ?? null) : null,
    });
  } catch {
    return NextResponse.json({ isSuperAdmin: false }, { status: 500 });
  }
}
