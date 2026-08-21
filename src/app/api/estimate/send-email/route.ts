import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { resolveSession, unauthorized } from "@/src/lib/session";
import { limitByIp } from "@/src/lib/rate-limit";

export const maxDuration = 30;

const MAX_PDF_BYTES = 8 * 1024 * 1024;                     // 8 MB de adjunto
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

export async function POST(req: NextRequest) {
  // Relay de correo: sale desde la cuenta de la empresa, así que exige sesión.
  const limited = limitByIp(req, "send-email", 12, 60 * 60_000);
  if (limited) return limited;

  try {
    const { to, subject, message, fileName, pdfBase64, adminPin, adminToken } = await req.json() as {
      to?: string; subject?: string; message?: string; fileName?: string; pdfBase64?: string;
      adminPin?: string; adminToken?: string;
    };

    const session = await resolveSession(req, { adminPin, adminToken });
    if (!session) return unauthorized();

    if (!to || !EMAIL_RE.test(to.trim()) || !pdfBase64) {
      return NextResponse.json({ ok: false, error: "Missing recipient or PDF" }, { status: 400 });
    }
    if (pdfBase64.length > MAX_PDF_BYTES * 1.4) {
      return NextResponse.json({ ok: false, error: "Attachment too large (max 8 MB)" }, { status: 413 });
    }

    const user = process.env.YAHOO_EMAIL;
    const pass = process.env.YAHOO_APP_PASSWORD;
    if (!user || !pass) {
      return NextResponse.json(
        { ok: false, error: "Email not configured (YAHOO_EMAIL / YAHOO_APP_PASSWORD)" },
        { status: 500 },
      );
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.mail.yahoo.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"Luxaris Design" <${user}>`,
      to: to.trim(),
      subject: (subject?.trim() || "Estimate — Luxaris Design").slice(0, 200),
      text: (message ?? "").slice(0, 20_000),
      attachments: [{
        filename: (fileName || "estimate.pdf").replace(/[\r\n"]/g, "").slice(0, 120),
        content: Buffer.from(pdfBase64, "base64"),
        contentType: "application/pdf",
      }],
    });

    console.log(JSON.stringify({ route: "/api/estimate/send-email", ok: true, to: to.trim() }));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ route: "/api/estimate/send-email", error: msg }));
    const friendly = /auth|535|credentials/i.test(msg)
      ? "Yahoo rechazó las credenciales — verifica la App Password"
      : msg;
    return NextResponse.json({ ok: false, error: friendly }, { status: 500 });
  }
}
