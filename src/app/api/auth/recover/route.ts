import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ ok: true }); // No revelar si existe

    const { data } = await getSupabaseAdmin()
      .from("superadmin_config")
      .select("email")
      .eq("id", true)
      .maybeSingle();

    if (!data?.email || data.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ ok: true }); // Silencioso — no revela si el email existe
    }

    const code    = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await getSupabaseAdmin().from("superadmin_config").update({
      recovery_code: code,
      recovery_expires_at: expires,
      updated_at: new Date().toISOString(),
    }).eq("id", true);

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "KokiStyle Admin <onboarding@resend.dev>",
          to: email,
          subject: "Código de recuperación — KokiStyle",
          html: `
            <div style="font-family:-apple-system,sans-serif;max-width:420px;margin:0 auto;padding:32px 24px;">
              <h2 style="color:#16323D;margin:0 0 8px;">KokiStyle Admin</h2>
              <p style="color:#5C6A6E;margin:0 0 24px;">Solicitaste recuperar tu PIN de administrador.</p>
              <div style="background:#F5E9DA;border-radius:16px;padding:24px;text-align:center;margin-bottom:24px;">
                <p style="margin:0 0 8px;font-size:13px;color:#97A1A0;text-transform:uppercase;letter-spacing:1px;">Código de acceso</p>
                <div style="font-size:40px;font-weight:800;letter-spacing:12px;color:#16323D;font-family:monospace;">${code}</div>
              </div>
              <p style="color:#97A1A0;font-size:13px;margin:0;">Expira en <strong>15 minutos</strong>. Si no lo solicitaste, ignora este mensaje.</p>
            </div>
          `,
        }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
