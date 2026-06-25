/**
 * POST /api/voice
 * Una sola llamada: detecta intención y extrae todos los datos posibles.
 * Las preguntas de seguimiento se manejan client-side (sin más API calls).
 */
import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";

const TODAY = () => new Date().toISOString().split("T")[0];

const SYSTEM = (context: string, contacts: string[], today: string) => `
Eres un extractor de datos para el sistema KokiStyle (gestión de obras en Florida).
Contexto activo: "${context}". Hoy: ${today}.
Contactos conocidos: ${contacts.length ? contacts.join(", ") : "ninguno"}.

Devuelve SOLO un JSON válido. Sin markdown. Sin explicaciones.

Estructura:
{
  "action": "<acción>",
  "data": { <solo los campos que el usuario mencionó explícitamente> }
}

Acciones según contexto:
- dashboard             → "create_project"
- project.workflow      → "create_task"
- project.materiales    → "create_material"
- project.presupuesto   → "create_budget_item"
- project.pagos.ingresos→ "create_payment"
- project.pagos.egresos → "create_expense"
- contactos             → "create_contact"
- Si el usuario lo dice explícitamente, úsalo aunque no coincida con el contexto.
- Si no se entiende → "unknown"

Campos por acción (incluye SOLO los mencionados, omite el resto):
create_project:     title, client, address, budget(número), start_date(YYYY-MM-DD)
create_task:        name, assignee_name, hours(número), semanas(número)
create_material:    name, supplier, cost(número)
create_budget_item: description, type("mano"|"material"), amount(número)
create_payment:     amount(número), method("Efectivo"|"Zelle"|"Transferencia"|"Cheque"|"Tarjeta"), type("anticipo"|"abono"|"final"), date(YYYY-MM-DD)
create_expense:     payee_name, concept, amount(número), method, date(YYYY-MM-DD)
create_contact:     name, specialty, phone, rate(número)

Conversión numérica: "15 mil"→15000, "8k"→8000, "1,500"→1500.
Método de pago: "transferencia"→"Transferencia", "zelé/zelle"→"Zelle", "efectivo/cash"→"Efectivo".
Tipo ingreso: "anticipo/adelanto/depósito"→"anticipo", "final/último"→"final", "abono/pago"→"abono".
Tipo presupuesto: "mano de obra/instalación/plomería/electricidad"→"mano", "material/gabinetes/pintura"→"material".
`.trim();

function contextDefault(ctx: string): string {
  if (ctx.includes("pagos.ingresos"))  return "create_payment";
  if (ctx.includes("pagos.egresos"))   return "create_expense";
  if (ctx.includes("workflow"))        return "create_task";
  if (ctx.includes("materiales"))      return "create_material";
  if (ctx.includes("presupuesto"))     return "create_budget_item";
  if (ctx.includes("contactos"))       return "create_contact";
  return "create_project";
}

export async function POST(req: NextRequest) {
  let context = "dashboard";
  try {
    const body = await req.json() as {
      transcript: string;
      context?: string;
      contacts?: string[];
    };
    context                   = body.context  ?? "dashboard";
    const transcript          = body.transcript;
    const contacts            = body.contacts ?? [];

    if (!transcript?.trim()) {
      return NextResponse.json({ action: contextDefault(context), data: {} });
    }

    const { text } = await generateText({
      model: "anthropic/claude-haiku-4.5",
      system: SYSTEM(context, contacts, TODAY()),
      prompt: `Usuario dijo: "${transcript}"`,
    });

    // Strip markdown fences if present
    const raw = text.trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    // Extract first JSON object found (tolerant parsing)
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no-json: " + raw.slice(0, 100));

    const parsed = JSON.parse(match[0]);

    // If AI returned "unknown", fall back to context — the user clearly said something
    if (parsed.action === "unknown") {
      parsed.action = contextDefault(context);
      parsed._fallback = true;
    }

    return NextResponse.json(parsed);

  } catch (err) {
    console.error("[/api/voice] error:", err instanceof Error ? err.message : err);
    // Use context as fallback so the client can always proceed to field questions
    return NextResponse.json({ action: contextDefault(context), data: {}, _fallback: true });
  }
}
