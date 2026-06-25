/**
 * POST /api/voice
 * Recibe transcripción de voz + contexto de la página activa.
 * Usa Vercel AI Gateway + Anthropic para parsear la intención
 * y devuelve una acción estructurada en JSON.
 *
 * Auth: OIDC via `vercel env pull` (local) o automático en Vercel (prod).
 * Gateway BYOK: configura tu API key directamente en el dashboard de AI Gateway.
 */
import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";

const TODAY = () => new Date().toISOString().split("T")[0];

const SYSTEM_PROMPT = `Eres un analizador de comandos de voz para "Obra", un sistema de gestión de proyectos de remodelación en Florida (KokiStyle).

Devuelve SOLO un objeto JSON válido con esta estructura (sin markdown ni bloques de código):
{
  "action": "<acción>",
  "data": { <campos relevantes> },
  "confirmMessage": "<mensaje corto en español de qué se creará o actualizará>"
}

Acciones disponibles según el contexto activo:
- "create_project"     → data: {title, client, address, budget (número), start_date (YYYY-MM-DD)}
- "create_task"        → data: {name, hours (número), semanas (número, default 1), assignee_name (nombre o "Equipo propio"), status: "pend"}
- "create_material"    → data: {name, supplier, cost (número)}
- "create_budget_item" → data: {description, type ("mano"|"material"), amount (número)}
- "create_payment"     → data: {amount (número), date (YYYY-MM-DD), method ("Efectivo"|"Transferencia"|"Zelle"|"Cheque"|"Tarjeta"), type ("anticipo"|"abono"|"final")}
- "create_expense"     → data: {amount (número), date (YYYY-MM-DD), method, payee_name, concept}
- "create_contact"     → data: {name, specialty, phone, rate}
- "unknown"            → cuando no se entiende el comando

Reglas de inferencia:
- "15 mil" / "15K" → 15000; "20 k" → 20000
- Sin fecha → usar hoy
- Sin método de pago → "Transferencia"
- Sin tipo de ingreso → "abono"
- "mano de obra", "instalación", "plomería" → type "mano"
- "material", "gabinetes", "azulejo", "pintura" → type "material"
- Responde ÚNICAMENTE el JSON, sin texto adicional`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      transcript: string;
      context: string;
      contacts?: string[];
    };

    const { transcript, context, contacts } = body;

    if (!transcript?.trim()) {
      return NextResponse.json({ action: "unknown", data: {}, confirmMessage: "No se detectó voz." });
    }

    const contactsHint = contacts?.length
      ? `\nContactos disponibles: ${contacts.join(", ")}`
      : "";

    const { text } = await generateText({
      model: "anthropic/claude-haiku-4.5",   // gateway string — dots para versión
      system: SYSTEM_PROMPT,
      prompt: `Contexto: ${context}${contactsHint}\nFecha de hoy: ${TODAY()}\n\nComando de voz: "${transcript}"`,
    });

    const parsed = JSON.parse(text.trim());
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[/api/voice]", err);
    const msg = err instanceof Error && err.message.includes("auth")
      ? "Configura VERCEL_OIDC_TOKEN (vercel env pull) o AI Gateway BYOK para usar voz con IA."
      : "No se pudo interpretar el comando. Intenta de nuevo.";
    return NextResponse.json({ action: "unknown", data: {}, confirmMessage: msg });
  }
}
