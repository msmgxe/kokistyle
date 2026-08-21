import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { resolveSession, unauthorized } from "@/src/lib/session";
import { limitByIp } from "@/src/lib/rate-limit";

export const maxDuration = 60;

// Claude mira la foto del espacio actual + el objetivo del cliente y propone
// el alcance de obra como secciones listas para el Estimate (con montos de referencia).
export async function POST(req: NextRequest) {
  // Ruta facturable (Claude vision) y con fetch de imagen: sólo con sesión.
  const limited = limitByIp(req, "design-scope", 20, 60_000);
  if (limited) return limited;
  if (!(await resolveSession(req))) return unauthorized();

  let body: { imageUrl?: string; objective?: string; language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { imageUrl, objective = "", language = "es" } = body;
  if (!imageUrl) {
    return NextResponse.json({ error: "imageUrl required" }, { status: 400 });
  }

  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return NextResponse.json({ error: `source image HTTP ${imgRes.status}` }, { status: 400 });
    }
    const mime = imgRes.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    const bytes = new Uint8Array(await imgRes.arrayBuffer());

    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-5"),
      messages: [
        {
          role: "user",
          content: [
            { type: "image", image: bytes, mediaType: mime as "image/jpeg" },
            {
              type: "text",
              text: `You are a construction estimator for a remodeling company in South Florida.
Look at this photo of the CURRENT space and the client's goal: "${objective || "full renovation of this space"}".

Propose the work scope as estimate sections. Reply with ONLY a JSON array (no markdown, no prose), 3 to 7 items, each:
{"name_en": "...", "name_es": "...", "description_en": "...", "description_es": "...", "amount": <integer USD, realistic South Florida labor price for that section>}

Order by construction phase (demolition first, finishes last). Descriptions max 12 words each.`,
            },
          ],
        },
      ],
    });

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ error: "no scope in response" }, { status: 502 });
    }
    const scope = JSON.parse(match[0]) as {
      name_en: string; name_es: string; description_en: string; description_es: string; amount: number;
    }[];

    return NextResponse.json({ scope, language });
  } catch (err) {
    console.error(JSON.stringify({ route: "/api/design-scope", error: err instanceof Error ? err.message : String(err) }));
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "scope failed" },
      { status: 500 }
    );
  }
}
