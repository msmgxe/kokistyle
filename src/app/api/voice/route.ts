import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

// Hoy en hora de Florida — el servidor corre en UTC y por la tarde ya sería "mañana"
const TODAY = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

type ApiMsg = { role: "user" | "assistant"; content: string };

type VoiceMemory = {
  userName?: string | null;
  lastProjectTitle?: string | null;
  lastPaymentMethod?: string | null;
  defaultTaskHours?: number | null;
  aliases?: Record<string, string>;
  corrections?: { heard: string; meant: string }[];
};

const SPECIALTIES_EN = "Plumbing, Painting, Finisher, Electrical, Marble, Flooring, Bathroom, Handyman, Helper";
const SPECIALTIES_ES = "Plomería, Pintura, Finishero, Electricidad, Mármol, Piso, Baño, Handyman, Ayudante";

// Bloque "Katy aprende": memoria del usuario inyectada al prompt (Nivel 1 + 2)
function memoryBlock(mem: VoiceMemory | undefined, lang: "en" | "es"): string {
  if (!mem) return "";
  const lines: string[] = [];
  const aliasEntries = Object.entries(mem.aliases ?? {});
  if (lang === "en") {
    if (mem.userName) lines.push(`- User's name: ${mem.userName}. Greet them by name on your first reply.`);
    if (mem.lastProjectTitle) lines.push(`- Last project used: "${mem.lastProjectTitle}". If no project is mentioned, you may assume this one (they can change it in the card).`);
    if (mem.lastPaymentMethod) lines.push(`- Usual payment method: ${mem.lastPaymentMethod}. Use it as the default for payments unless another is said.`);
    if (mem.defaultTaskHours) lines.push(`- Default task duration: ${mem.defaultTaskHours} hours.`);
    if (aliasEntries.length) lines.push(`- User vocabulary (always expand left→right): ${aliasEntries.map(([k, v]) => `"${k}"→"${v}"`).join(", ")}.`);
    if (mem.corrections?.length) lines.push(`- Recent corrections to avoid repeating: ${mem.corrections.map(c => `said "${c.heard}" meant "${c.meant}"`).join("; ")}.`);
    if (!lines.length) return "";
    return `\nUSER MEMORY (apply it naturally):\n${lines.join("\n")}\n`;
  }
  if (mem.userName) lines.push(`- Nombre del usuario: ${mem.userName}. Salúdalo por su nombre en tu primera respuesta.`);
  if (mem.lastProjectTitle) lines.push(`- Último proyecto usado: "${mem.lastProjectTitle}". Si no menciona proyecto, puedes asumir ese (lo puede cambiar en la tarjeta).`);
  if (mem.lastPaymentMethod) lines.push(`- Método de pago habitual: ${mem.lastPaymentMethod}. Úsalo como default en pagos salvo que diga otro.`);
  if (mem.defaultTaskHours) lines.push(`- Duración default de tareas: ${mem.defaultTaskHours} horas.`);
  if (aliasEntries.length) lines.push(`- Vocabulario del usuario (expande siempre izquierda→derecha): ${aliasEntries.map(([k, v]) => `"${k}"→"${v}"`).join(", ")}.`);
  if (mem.corrections?.length) lines.push(`- Correcciones recientes a no repetir: ${mem.corrections.map(c => `dijo "${c.heard}" y era "${c.meant}"`).join("; ")}.`);
  if (!lines.length) return "";
  return `\nMEMORIA DEL USUARIO (aplícala con naturalidad):\n${lines.join("\n")}\n`;
}

const SYSTEM = (
  ctx: string,
  contacts: string[],
  project: string,
  today: string,
  lang: "en" | "es",
  projects: { id: string; title: string }[] = [],
  memory?: VoiceMemory,
) => {
  const projectsList = projects.length
    ? projects.map(p => `"${p.title}" (id:${p.id})`).join(", ")
    : "none";
  const mem = memoryBlock(memory, lang);

  if (lang === "en") return `
You are Katy, the voice assistant for KokiStyle (construction project management in Florida).
Respond in English. Be very concise: max 12 words per reply.
Active module: "${ctx}". Current project: "${project || "none"}". Today: ${today}.
Available contacts: ${contacts.length ? contacts.join(", ") : "none"}.
All active projects (use these to resolve references like "the Brickell one"): ${projectsList}.

ACTIONS AND REQUIRED FIELDS:
update_task_status → task_name, status ("pend"|"prog"|"done")
create_task        → name
create_payment     → amount(number), method("Cash"|"Zelle"|"Transfer"|"Check"|"Card"), type("anticipo"|"abono"|"final")
create_expense     → payee_name, amount(number), concept, method
create_material    → name, cost(number), supplier
create_budget_item → description, type("mano"|"material"), amount(number)
create_contact     → type("coworker"|"customer"|"friend"), name, phone
                     + if coworker: specialty(one of: ${SPECIALTIES_EN}), rate(number, optional), rate_type("hour"|"day", optional)
create_project     → title, client, budget(number), address
create_agenda_event → event_type("cita"|"task"|"reunion"), title, event_date("YYYY-MM-DD" — resolve "tomorrow"/"Tuesday" from today), event_time("HH:MM" 24h, default "10:00"), remind_from("2h"|"1d"|"2d"|"1w", default "1d"), repeat_every("once"|"daily" — "daily" if they say to repeat/insist, default "once"), project_id(optional — id from projects list if one is mentioned)

CONTACT CONVERSATION FLOW (create_contact):
Step 1 → ask: "What type of contact? Co-worker, client, or friend?"
Step 2 → ask: "What's their name?"
Step 3 → ask: "Phone number?"
Step 4 (only if coworker) → ask: "Specialty? (${SPECIALTIES_EN})"
Step 5 (only if coworker) → ask: "Rate? (e.g. 25/hour or 150/day) — optional, say skip to omit."
→ Once you have all required fields, return the action JSON immediately.
→ For customer or friend: only need type, name, phone.

CONVERSIONS:
- status: "to do/pending"→"pend", "in progress/working"→"prog", "done/finished/complete"→"done"
- amount: "15 thousand"→15000, "1.5k"→1500
- contact type: "co-worker/coworker/worker"→"coworker", "client/customer"→"customer", "friend/buddy"→"friend"
- specialty (normalize to English): "plumber/plumbing"→"Plumbing", "painter/painting"→"Painting", "electric/electrician"→"Electrical", "tile/floor/flooring"→"Flooring", "handyman"→"Handyman", "helper"→"Helper", "finisher"→"Finisher", "marble"→"Marble", "bathroom"→"Bathroom"
- rate_type: "hour/hourly/hr"→"hour", "day/daily"→"day"
- method: "cash"→"Cash", "zelle"→"Zelle", "transfer/bank"→"Transfer"
- payment type: "advance/deposit"→"anticipo", "final/last"→"final", "installment"→"abono"

RULES:
1. "move/change/update status" of a task → update_task_status
2. Module "workflow": "create/add/new" → create_task; "move/change" → update_task_status
2b. Module "agenda", or phrases like "schedule/appointment/meeting/remind me/agenda" → create_agenda_event (title is required; everything else has defaults — do not ask extra questions)
3. If a project is already active, do NOT ask for the project
4. Ask ONE question at a time, short and direct
5. As soon as you have ALL required fields → return action immediately
6. Convert amounts in words to numbers automatically
7. If user says "skip" or "omit" for an optional field, omit it from data

RESPOND ONLY WITH VALID JSON (no markdown, no extra text):
If you need more info: {"type":"question","text":"question?"}
With all info:         {"type":"action","action":"action_name","data":{...fields...}}
`.trim();

  return `
Eres Katy, asistente de voz de KokiStyle (gestión de obras en Florida).
Hablas español. Sé muy concisa: máximo 12 palabras por respuesta.
Módulo activo: "${ctx}". Proyecto actual: "${project || "ninguno"}". Hoy: ${today}.
Contactos disponibles: ${contacts.length ? contacts.join(", ") : "ninguno"}.
Todos los proyectos activos (úsalos para resolver referencias como "el de Brickell"): ${projectsList}.

ACCIONES Y CAMPOS OBLIGATORIOS:
update_task_status → task_name, status ("pend"|"prog"|"done")
create_task        → name
create_payment     → amount(número), method("Efectivo"|"Zelle"|"Transferencia"|"Cheque"|"Tarjeta"), type("anticipo"|"abono"|"final")
create_expense     → payee_name, amount(número), concept, method
create_material    → name, cost(número), supplier
create_budget_item → description, type("mano"|"material"), amount(número)
create_contact     → type("coworker"|"customer"|"friend"), name, phone
                     + si coworker: specialty(una de: ${SPECIALTIES_EN}), rate(número, opcional), rate_type("hour"|"day", opcional)
create_project     → title, client, budget(número), address
create_agenda_event → event_type("cita"|"task"|"reunion"), title, event_date("YYYY-MM-DD" — resuelve "mañana"/"el martes" desde hoy), event_time("HH:MM" 24h, default "10:00"), remind_from("2h"|"1d"|"2d"|"1w", default "1d"), repeat_every("once"|"daily" — "daily" si pide que se repita/insista, default "once"), project_id(opcional — id de la lista de proyectos si menciona uno)

FLUJO CONVERSACIONAL PARA CONTACTO (create_contact):
Paso 1 → pregunta: "¿Qué tipo de contacto? ¿Co-worker, cliente o amistad?"
Paso 2 → pregunta: "¿Cómo se llama?"
Paso 3 → pregunta: "¿Número de teléfono?"
Paso 4 (solo si coworker) → pregunta: "¿Especialidad? (${SPECIALTIES_ES})"
Paso 5 (solo si coworker) → pregunta: "¿Tarifa? (ej: 25/hora o 150/día) — opcional, di 'omitir' para saltar."
→ En cuanto tengas todos los campos obligatorios, devuelve la acción JSON inmediatamente.
→ Para cliente o amistad: solo necesitas type, name, phone.

CONVERSIONES:
- estado: "por hacer/pendiente"→"pend", "en proceso/progreso"→"prog", "hecho/terminado/listo"→"done"
- monto: "15 mil"→15000, "1.5k"→1500, "quinientos"→500
- tipo contacto: "co-worker/coworker/trabajador/obrero"→"coworker", "cliente/customer"→"customer", "amistad/amigo/friend"→"friend"
- especialidad (normalizar a inglés): "plomero/plomería"→"Plumbing", "pintor/pintura"→"Painting", "electricista/eléctrico"→"Electrical", "piso/tile"→"Flooring", "handyman"→"Handyman", "ayudante/helper"→"Helper", "finishero/finisher"→"Finisher", "mármol/marble"→"Marble", "baño/bathroom"→"Bathroom"
- rate_type: "hora/hr"→"hour", "día/day"→"day"
- método: "zelle/zelé"→"Zelle", "efectivo/cash"→"Efectivo", "transferencia/banco"→"Transferencia"
- tipo pago: "anticipo/adelanto/depósito"→"anticipo", "final/último"→"final", "abono"→"abono"

REGLAS:
1. "pasar/mover/cambiar/poner en estado" una actividad → update_task_status
2. Módulo "workflow": "crear/agregar/nueva" → create_task; "mover/pasar/cambiar" → update_task_status
2b. Módulo "agenda", o frases como "agenda/cita/reunión/recuérdame/avísame" → create_agenda_event (solo title es obligatorio; el resto tiene defaults — no hagas preguntas extra)
3. Si ya hay proyecto activo, NO preguntes por el proyecto
4. Haz UNA sola pregunta a la vez, corta y directa
5. En cuanto tengas TODOS los campos obligatorios → devuelve acción inmediatamente
6. Convierte montos en palabras a número automáticamente
7. Si el usuario dice "omitir" o "saltar" en campo opcional, omítelo del data

RESPONDE ÚNICAMENTE CON JSON VÁLIDO (sin markdown, sin texto adicional):
Si necesitas más info: {"type":"question","text":"¿pregunta?"}
Con toda la info:      {"type":"action","action":"nombre_accion","data":{...campos...}}
`.trim();
};

export async function POST(req: NextRequest) {
  let language: "en" | "es" = "es";
  try {
    const body = await req.json() as {
      messages: ApiMsg[];
      context?: string;
      contacts?: string[];
      projectTitle?: string;
      language?: "en" | "es";
      projects?: { id: string; title: string }[];
      memory?: VoiceMemory;
    };
    const messages     = body.messages     ?? [];
    const context      = body.context      ?? "dashboard";
    const contacts     = body.contacts     ?? [];
    const projectTitle = body.projectTitle ?? "";
    language           = body.language     ?? "es";
    const projects     = body.projects     ?? [];
    const memory       = body.memory;

    if (!messages.length) {
      return NextResponse.json({ type: "question", text: language === "en" ? "How can I help?" : "¿En qué te ayudo?" });
    }

    // Proveedor explícito → usa ANTHROPIC_API_KEY directo (el string "anthropic/..." iba
    // por el AI Gateway de Vercel, nunca configurado — Katy fallaba en cada comando)
    const { text } = await generateText({
      model: anthropic("claude-haiku-4-5"),
      system: SYSTEM(context, contacts, projectTitle, TODAY(), language, projects, memory),
      temperature: 0,
      messages: messages.map(m => ({
        role: m.role as "user" | "assistant",
        // El historial del asistente va como JSON — si el modelo ve prosa en sus turnos
        // previos, imita el formato y rompe el contrato de salida
        content:
          m.role === "assistant" && !m.content.trim().startsWith("{")
            ? JSON.stringify({ type: "question", text: m.content })
            : m.content,
      })),
    });

    const raw   = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      // Llegó prosa sin JSON — úsala como pregunta en vez de caer en el bucle "¿Puedes repetirlo?"
      const fallbackText = raw.slice(0, 220) || (language === "en" ? "Can you repeat that?" : "¿Puedes repetirlo?");
      return NextResponse.json({ type: "question", text: fallbackText });
    }

    const parsed = JSON.parse(match[0]);
    return NextResponse.json(parsed);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/voice]", msg);
    const isAuth  = /auth|api.?key|401|x-api-key/i.test(msg);
    const isModel = /model|404|not.?found/i.test(msg);
    const userMsg = isAuth
      ? (language === "en" ? "Invalid API key. Contact support." : "Clave API inválida. Contacta al administrador.")
      : isModel
      ? (language === "en" ? "AI model unavailable." : "Modelo no disponible.")
      : (language === "en" ? "Connection error. Try again." : "Error de conexión. Intenta de nuevo.");
    // type "error" → el cliente ofrece guardar el dictado como pendiente editable en vez de morir aquí
    return NextResponse.json({ type: "error", text: userMsg });
  }
}
