import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { to, subject, message, fileName, pdfBase64 } = await req.json() as {
      to?: string; subject?: string; message?: string; fileName?: string; pdfBase64?: string;
    };

    if (!to?.includes("@") || !pdfBase64) {
      return NextResponse.json({ ok: false, error: "Missing recipient or PDF" }, { status: 400 });
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
      subject: subject?.trim() || "Estimate — Luxaris Design",
      text: message ?? "",
      attachments: [{
        filename: fileName || "estimate.pdf",
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
