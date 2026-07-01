import { NextRequest, NextResponse } from "next/server";

// POST — creates prediction and returns immediately (works on all Vercel plans)
// Client polls GET until status === "succeeded"
export async function POST(req: NextRequest) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "REPLICATE_API_TOKEN not configured" },
      { status: 500 }
    );
  }

  let body: { imageUrl?: string; prompt?: string; roomType?: string; style?: string; strength?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { imageUrl, prompt, roomType = "Living Room", style = "Modern", strength = 0.75 } = body;

  if (!imageUrl || !prompt) {
    return NextResponse.json({ error: "imageUrl and prompt required" }, { status: 400 });
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
          // No "Prefer: wait" — return prediction ID immediately, client polls
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
      console.error("[/api/design-render POST]", res.status, errDetail);
      return NextResponse.json(
        { error: errDetail || `HTTP ${res.status}`, httpStatus: res.status },
        { status: res.status }
      );
    }

    const prediction = await res.json();
    return NextResponse.json(prediction);
  } catch (err) {
    console.error("[/api/design-render POST] fetch error", err);
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
