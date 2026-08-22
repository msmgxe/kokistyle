import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase-admin";
import { resolveSession } from "@/src/lib/session";
import { hashPin, MIN_PIN_LENGTH } from "@/src/lib/pin";
import { limitByIp } from "@/src/lib/rate-limit";

export const maxDuration = 15;

/**
 * Alta y edición de colaboradores. El PIN se hashea aquí: el navegador nunca
 * vuelve a escribir credenciales en `app_users`.
 */
export async function POST(req: NextRequest) {
  const limited = limitByIp(req, "auth-users", 30, 60_000);
  if (limited) return limited;

  try {
    const body = await req.json() as {
      op?: "create" | "update"; id?: string; pin?: string;
      adminPin?: string; adminToken?: string;
      fields?: Record<string, unknown>;
    };

    const session = await resolveSession(req, { adminPin: body.adminPin, adminToken: body.adminToken });
    if (session?.role !== "superadmin") {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
    }

    const admin  = getSupabaseAdmin();
    const fields = { ...(body.fields ?? {}) };
    delete fields.pin;
    delete fields.pin_hash;                      // nunca desde el cliente

    const pin = String(body.pin ?? "").trim();
    if (pin && pin.length < MIN_PIN_LENGTH) {
      return NextResponse.json({ ok: false, error: `PIN needs at least ${MIN_PIN_LENGTH} digits` }, { status: 400 });
    }

    /** Escribe con hash y, si la columna aún no está migrada, en claro. */
    const write = async (withHash: boolean) => {
      const creds = pin
        ? (withHash ? { pin_hash: hashPin(pin), pin: "" } : { pin })
        : {};
      const payload = { ...fields, ...creds };
      return body.op === "create"
        ? admin.from("app_users").insert({ ...payload, role: "colaborador", active: true }).select().single()
        : admin.from("app_users").update(payload).eq("id", body.id ?? "").select().single();
    };

    let res = await write(true);
    if (res.error?.message?.includes("pin_hash")) res = await write(false);
    if (res.error || !res.data) {
      return NextResponse.json({ ok: false, error: res.error?.message ?? "write failed" }, { status: 400 });
    }

    const user = { ...(res.data as Record<string, unknown>) };
    delete user.pin;
    delete user.pin_hash;                        // el PIN no vuelve al cliente
    return NextResponse.json({ ok: true, user });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
