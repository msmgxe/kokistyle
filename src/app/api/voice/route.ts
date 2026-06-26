import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";

const TODAY = () => new Date().toISOString().split("T")[0];

type ApiMsg = { role: "user" | "assistant"; content: string };

const SYSTEM = (ctx: string, contacts: string[], project: string, today: string) => `
Eres Katy, asistente de voz de KokiStyle (gestión de obras en Florida).
Hablas español. Sé muy concisa: máximo 10 palabras por respuesta.
Módulo activo: "${ctx}". Proyecto: "${project || "ninguno"}". Hoy: ${today}.
Contactos disponibles: ${contacts.length ? contacts.join(", ") : "ninguno"}.

ACCIONES Y CAMPOS OBLIGATORIOS:
update_task_status → task_name, status ("pend"|"prog"|"done")
create_task        → name
create_payment     → amount(número), method("Efectivo"|"Zelle"|"Transferencia"|"Cheque"|"Tarjeta"), type("anticipo"|"abono"|"final")
create_expense     → payee_name, amount(número), concept, method
create_material    → name, cost(número), supplier
create_budget_item → description, type("mano"|"material"), amount(número)
create_contact     → name, specialty, phone
create_project     → title, client, budget(número), address

CONVERSIONES:
- estado: "por hacer/pendiente"→"pend", "en proceso/progreso/proceso"→"prog", "hecho/terminado/listo/done"→"done"
- monto: "15 mil"→15000, "1.5k"→1500, "quinientos"→500
- método: "zelle/zelé"→"Zelle", "efectivo/cash"→"Efectivo", "transferencia/banco"→"Transferencia"
- tipo pago: "anticipo/adelanto/depósito"→"anticipo", "final/último"→"final", "abono"→"abono"

REGLAS:
1. "pasar/mover/cambiar/poner en estado" una actividad → update_task_status
2. Módulo "workflow": "crear/agregar/nueva" → create_task; "mover/pasar/cambiar" → update_task_status
3. Si ya hay proyecto activo, NO preguntes por el proyecto
4. Haz UNA sola pregunta a la vez, corta y directa
5. En cuanto tengas TODOS los campos obligatorios → devuelve acción inmediatamente
6. Convierte montos en palabras a número automáticamente

RESPONDE ÚNICAMENTE CON JSON VÁLIDO (sin markdown, sin texto adicional):
Si necesitas más info: {"type":"question","text":"¿pregunta?"}
Con toda la info:      {"type":"action","action":"nombre_accion","data":{...campos...}}
`.trim();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      messages: ApiMsg[];
      context?: string;
      contacts?: string[];
      projectTitle?: string;
    };
    const messages     = body.messages     ?? [];
    const context      = body.context      ?? "dashboard";
    const contacts     = body.contacts     ?? [];
    const projectTitle = body.projectTitle ?? "";

    if (!messages.length) {
      return NextResponse.json({ type: "question", text: "¿En qué te ayudo?" });
    }

    const { text } = await generateText({
      model: "anthropic/claude-haiku-4.5",
      system: SYSTEM(context, contacts, projectTitle, TODAY()),
      messages: messages.map(m => ({
        role:    m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const raw   = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ type: "question", text: "¿Puedes repetirlo?" });

    const parsed = JSON.parse(match[0]);
    return NextResponse.json(parsed);

  } catch (err) {
    console.error("[/api/voice]", err instanceof Error ? err.message : err);
    return NextResponse.json({ type: "question", text: "No pude procesar. ¿Repites?" });
  }
}
