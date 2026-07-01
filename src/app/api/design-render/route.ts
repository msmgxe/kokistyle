import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "REPLICATE_API_TOKEN not configured" }, { status: 500 });
  }

  const { imageUrl, prompt, roomType, style, strength = 0.75 } = await req.json();

  if (!imageUrl || !prompt) {
    return NextResponse.json({ error: "imageUrl and prompt required" }, { status: 400 });
  }

  const negativePrompt =
    "ugly, blurry, low quality, watermark, text, logo, people, person, face, hands, nsfw, distorted, deformed, bad anatomy";

  const fullPrompt = `A photo of a ${roomType}, ${style} interior design style. ${prompt}. Photorealistic, luxury, 8k resolution, professionally staged, beautiful lighting, high-end residential Miami Florida, architectural photography quality.`;

  const res = await fetch(
    "https://api.replicate.com/v1/models/adirik/interior-design/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=55",
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
    const err = await res.text();
    console.error("[/api/design-render POST]", res.status, err);
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const prediction = await res.json();
  return NextResponse.json(prediction);
}

export async function GET(req: NextRequest) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "REPLICATE_API_TOKEN not configured" }, { status: 500 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
    headers: { Authorization: `Token ${token}` },
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data);
}
