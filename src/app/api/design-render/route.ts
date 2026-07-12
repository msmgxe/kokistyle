import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase-admin";

export const maxDuration = 60; // permite el resultado síncrono (Prefer: wait)

// Renders gratuitos por prospecto (control de abuso del endpoint de pago)
const FREE_RENDER_LIMIT = Number(process.env.FREE_RENDER_LIMIT ?? 3);

// POST — pide el resultado síncrono a Replicate (Prefer: wait). El render tarda ~7s,
// así que casi siempre devuelve el output directo; el cliente usa GET como respaldo.
export async function POST(req: NextRequest) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "REPLICATE_API_TOKEN not configured" },
      { status: 500 }
    );
  }

  let body: { imageUrl?: string; prompt?: string; roomType?: string; style?: string; strength?: number; prospectId?: string; adminPin?: string; adminToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { imageUrl, prompt, roomType = "Living Room", style = "Modern", strength = 0.75, prospectId, adminPin, adminToken } = body;

  if (!imageUrl || !prompt) {
    return NextResponse.json({ error: "imageUrl and prompt required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // ── Gate anti-abuso (endurece C3) ──────────────────────────────────────────
  // Dos vías: (a) superadmin interno (Design tab del panel) — sin límite;
  //           (b) prospecto público válido bajo su FREE_RENDER_LIMIT.
  let internal = false;
  if (adminPin) {
    const { data } = await admin.from("superadmin_config").select("pin").eq("id", true).maybeSingle();
    if (data && String(adminPin) === String(data.pin)) internal = true;
  }
  if (!internal && adminToken) {
    const { data } = await admin.from("device_tokens").select("user_id, revoked").eq("token", adminToken).maybeSingle();
    if (data && data.user_id === "superadmin" && !data.revoked) internal = true;
  }

  // El prospecto se valida ANTES de gastar; el conteo se incrementa solo si Replicate
  // acepta el job (no se "gasta" un render en un fallo).
  let prospectRow: { id: string; renders_used: number } | null = null;
  if (!internal) {
    if (!prospectId) {
      return NextResponse.json({ error: "prospectId required" }, { status: 401 });
    }
    const { data: prospect } = await admin
      .from("prospects").select("id, renders_used").eq("id", prospectId).maybeSingle();
    if (!prospect) {
      return NextResponse.json({ error: "invalid_prospect" }, { status: 403 });
    }
    if (prospect.renders_used >= FREE_RENDER_LIMIT) {
      return NextResponse.json({ error: "limit_reached", limit: FREE_RENDER_LIMIT }, { status: 429 });
    }
    prospectRow = prospect;
  }

  const negativePrompt =
    "ugly, blurry, low quality, watermark, text, logo, people, person, face, hands, nsfw, distorted, deformed, bad anatomy";

  const fullPrompt = `A photo of a ${roomType}, ${style} interior design style. ${prompt}. Photorealistic, luxury, 8k resolution, professionally staged, beautiful lighting, high-end residential Miami Florida, architectural photography quality.`;

  try {
    const res = await fetch(
      "https://api.replicate.com/v1/models/adirik/interior-design/predictions",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
          Prefer: "wait=55", // espera el resultado (render ~7s) → output directo, sin depender del polling
        },
        body: JSON.stringify({
          input: {
            image: imageUrl,
            prompt: fullPrompt,
            negative_prompt: negativePrompt,
            guidance_scale: 15,
            num_inference_steps: 50,
            prompt_strength: strength,
            seed: Math.floor(Math.random() * 99999),
          },
        }),
      }
    );

    if (!res.ok) {
      let errDetail: string;
      try {
        const errJson = await res.json();
        errDetail = errJson.detail ?? errJson.error ?? JSON.stringify(errJson);
      } catch {
        errDetail = await res.text().catch(() => "");
      }
      console.error(JSON.stringify({ route: "/api/design-render", stage: "post", status: res.status, error: errDetail }));
      return NextResponse.json(
        { error: errDetail || `HTTP ${res.status}`, httpStatus: res.status },
        { status: res.status }
      );
    }

    const prediction = await res.json();

    // Replicate aceptó (o completó) el job → cobra el render al prospecto
    if (prospectRow && prediction?.status !== "failed") {
      await admin.from("prospects")
        .update({ renders_used: prospectRow.renders_used + 1, last_used_at: new Date().toISOString() })
        .eq("id", prospectRow.id);
    }
    if (prediction?.status === "failed") {
      console.error(JSON.stringify({ route: "/api/design-render", stage: "predict", error: prediction?.error ?? "failed" }));
      return NextResponse.json({ error: prediction?.error ?? "render_failed" }, { status: 502 });
    }

    return NextResponse.json(prediction);
  } catch (err) {
    console.error(JSON.stringify({ route: "/api/design-render", stage: "fetch", error: err instanceof Error ? err.message : String(err) }));
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Replicate request failed" },
      { status: 500 }
    );
  }
}

// GET — poll prediction status
export async function GET(req: NextRequest) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "REPLICATE_API_TOKEN not configured" },
      { status: 500 }
    );
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Token ${token}` },
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Poll failed" },
      { status: 500 }
    );
  }
}
