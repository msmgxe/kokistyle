import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// Transcripción universal para Katy: el cliente graba con MediaRecorder (funciona en
// cualquier navegador) y aquí Whisper (Replicate) convierte el audio a texto.
// Reemplaza la dependencia de SpeechRecognition, roto en varios Android.
export async function POST(req: NextRequest) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "REPLICATE_API_TOKEN not configured" }, { status: 500 });
  }

  let body: { audio?: string; language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // language ya no se usa: Whisper autodetecta el idioma (español o inglés)
  const { audio } = body;
  if (!audio || !audio.startsWith("data:")) {
    return NextResponse.json({ error: "audio (data URI) required" }, { status: 400 });
  }
  // Notas de voz de ~30s pesan <500KB; un data URI mayor a ~8MB no es una nota
  if (audio.length > 8_000_000) {
    return NextResponse.json({ error: "audio too large" }, { status: 413 });
  }

  const res = await fetch(
    "https://api.replicate.com/v1/models/vaibhavs10/incredibly-fast-whisper/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=55",
      },
      body: JSON.stringify({
        input: {
          audio,
          task: "transcribe",
          // Sin forzar idioma: Whisper autodetecta, así el usuario puede hablar
          // español o inglés sin importar el idioma de la app. (Antes se forzaba
          // al idioma de la UI y transcribía mal el otro idioma.)
          language: "None",
          batch_size: 8,
        },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json({ error: `Replicate ${res.status}: ${detail.slice(0, 300)}` }, { status: 502 });
  }

  let data = (await res.json()) as {
    status?: string;
    output?: { text?: string } | string;
    urls?: { get?: string };
    error?: string;
  };

  // Respaldo si Prefer:wait no alcanzó — poll corto server-side
  for (let i = 0; i < 10 && data.status && !["succeeded", "failed", "canceled"].includes(data.status); i++) {
    if (!data.urls?.get) break;
    await new Promise(r => setTimeout(r, 1500));
    const poll = await fetch(data.urls.get, { headers: { Authorization: `Bearer ${token}` } });
    if (!poll.ok) break;
    data = await poll.json();
  }

  if (data.status === "failed" || data.error) {
    return NextResponse.json({ error: data.error ?? "transcription failed" }, { status: 502 });
  }

  const out = data.output;
  const text = typeof out === "string" ? out : out?.text ?? "";
  return NextResponse.json({ text: String(text ?? "").trim() });
}
