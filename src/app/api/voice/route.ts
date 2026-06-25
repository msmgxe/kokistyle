/**
 * POST /api/voice
 * Asistente conversacional "Koki" para KokiStyle.
 * Recibe historial de mensajes + contexto → devuelve pregunta o acción.
 * Usa Vercel AI Gateway + Anthropic Claude Haiku (OIDC, sin API keys en código).
 */
import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";

const TODAY = () => new Date().toISOString().split("T")[0];

const SYSTEM_PROMPT = (context: string, contacts: string[], today: string) => `
Eres "Katy", una asistente virtual femenina, amable y profesional, integrada en el sistema de gestión de proyectos de remodelación KokiStyle (Florida, USA).

Tu trabajo es recopilar datos del usuario mediante conversación natural para registrarlos en el sistema.
Haz UNA sola pregunta a la vez. Sé breve y directa. Hablas en español, tutea al usuario.

━━━ RESPUESTA JSON ━━━
Devuelve SIEMPRE un JSON válido (sin markdown) en UNA de estas dos formas:

1. Si faltan datos → pide el siguiente campo:
{"type": "question", "text": "¿De cuánto es el pago?"}

2. Cuando tienes TODOS los datos O el usuario confirma con sí/ok/dale/adelante:
{"type": "action", "action": "<nombre>", "data": {...}, "confirmMessage": "<resumen en español>"}

━━━ CONTEXTO ACTIVO: ${context} ━━━
━━━ ACCIONES DISPONIBLES ━━━
- create_project    → data: {title, client, address, budget (número), start_date (YYYY-MM-DD)}
- create_task       → data: {name, hours (número), semanas (número), assignee_name (de la lista o "Equipo propio"), status: "pend"}
- create_material   → data: {name, supplier, cost (número)}
- create_budget_item→ data: {description, type ("mano"|"material"), amount (número)}
- create_payment    → data: {amount (número), date (YYYY-MM-DD), method ("Efectivo"|"Transferencia"|"Zelle"|"Cheque"|"Tarjeta"), type ("anticipo"|"abono"|"final")}
- create_expense    → data: {amount (número), date (YYYY-MM-DD), method, payee_name (de la lista o "Equipo propio"), concept}
- create_contact    → data: {name, specialty, phone, rate (número por hora)}

━━━ REGLAS DE INFERENCIA ━━━
- Hoy es ${today}. Sin fecha → usar hoy.
- "15 mil" / "15k" / "quince mil" → 15000
- Sin método → pregunta ("¿En efectivo, Zelle, transferencia, cheque o tarjeta?")
- "mano de obra / instalación / plomería / electricidad" → type "mano"
- "material / gabinetes / azulejo / pintura / grifo" → type "material"
- Sin tipo de ingreso → pregunta ("¿Es anticipo, abono o pago final?")
- Contactos disponibles: ${contacts.length ? contacts.join(", ") : "ninguno aún"}
- Si el usuario dice "no / cancela / para / olvídalo" → {"type": "question", "text": "Entendido. ¿Algo más en lo que te pueda ayudar?"}
- Si el usuario dice "sí / ok / dale / confirma / correcto / adelante / perfecto" Y ya tienes todos los datos → devuelve la acción inmediatamente.

━━━ CONFIRMACIÓN ━━━
El confirmMessage debe ser claro: "Voy a registrar un anticipo de $8,000 por Zelle, hoy ${today}."
Usa formato de moneda con $ y comas: $8,000.

Responde ÚNICAMENTE el JSON. Cero texto adicional.
`.trim();

interface Message { role: "user" | "assistant"; text: string; }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      messages: Message[];
      context: string;
      contacts?: string[];
    };

    const { messages, context, contacts = [] } = body;

    if (!messages?.length) {
      return NextResponse.json({
        type: "question",
        text: "Hola, soy Koki. ¿Qué quieres registrar?",
      });
    }

    // Build prompt from conversation history
    const conversation = messages
      .map(m => `${m.role === "user" ? "Usuario" : "Koki"}: ${m.text}`)
      .join("\n");

    const { text } = await generateText({
      model: "anthropic/claude-haiku-4.5",
      system: SYSTEM_PROMPT(context, contacts, TODAY()),
      prompt: conversation + "\nKaty:",
    });

    // Parse JSON response
    const raw = text.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/i, "");
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);

  } catch (err) {
    console.error("[/api/voice]", err);

    // Distinguish auth/gateway errors
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("auth") || msg.includes("401") || msg.includes("403")) {
      return NextResponse.json({
        type: "question",
        text: "No pude conectarme al asistente de IA. Verifica la configuración del AI Gateway (vercel env pull).",
      });
    }

    return NextResponse.json({
      type: "question",
      text: "Tuve un problema al procesar eso. ¿Puedes repetirlo?",
    });
  }
}
