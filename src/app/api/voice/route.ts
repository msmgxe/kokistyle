import { NextRequest, NextResponse } from "next/server";
import { generateText, tool, jsonSchema, stepCountIs, type ToolSet } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { supabase } from "@/src/lib/supabase";
import type { Permissions } from "@/src/types/auth";

export const maxDuration = 30;

// Hoy en hora de Florida — el servidor corre en UTC y por la tarde ya sería "mañana"
const TODAY = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

type ApiMsg = { role: "user" | "assistant"; content: string };
type Lang   = "en" | "es";

type VoiceMemory = {
  userName?: string | null;
  lastProjectTitle?: string | null;
  lastPaymentMethod?: string | null;
  defaultTaskHours?: number | null;
  aliases?: Record<string, string>;
  corrections?: { heard: string; meant: string }[];
};

// La DB indexa especialidades por su valor en inglés (specialtyDisplay() traduce a la UI)
const SPECIALTIES = ["Plumbing", "Painting", "Finisher", "Electrical", "Marble", "Flooring", "Bathroom", "Handyman", "Helper"];
const METHODS: Record<Lang, string[]> = {
  en: ["Cash", "Zelle", "Transfer", "Check", "Card"],
  es: ["Efectivo", "Zelle", "Transferencia", "Cheque", "Tarjeta"],
};

const WRITE_ACTIONS = new Set([
  "create_project", "create_payment", "create_expense", "create_task", "create_material",
  "create_budget_item", "create_contact", "update_task_status", "create_agenda_event",
]);

// ── Herramientas de escritura ────────────────────────────────────────────────
// Sin `execute` a propósito: el AI SDK devuelve la tool call sin ejecutar y la
// reenviamos al cliente, que conserva su tarjeta de confirmación y su saveAction.
// Solo va como `required` lo que hace el registro inútil si falta — el resto se
// completa en la tarjeta. Marcar todo obligatorio es lo que convertía a Katy en
// un interrogatorio.
// El enum solo se agrega si hay proyectos: `enum: []` es un esquema inválido
function pidProp(projectIds: string[], description: string) {
  const p: { type: "string"; description: string; enum?: string[] } = { type: "string", description };
  if (projectIds.length) p.enum = projectIds;
  return p;
}

function writeTools(lang: Lang, projectIds: string[]): ToolSet {
  const methods = METHODS[lang];
  const es      = lang === "es";
  const pid     = pidProp(projectIds, es
    ? "Id del proyecto SOLO si el usuario nombra uno distinto al activo. Si no, omítelo."
    : "Project id ONLY if the user names one other than the active project. Otherwise omit.");

  return {
    create_project: tool({
      description: es ? "Crear un proyecto de obra nuevo." : "Create a new construction project.",
      inputSchema: jsonSchema<{ title: string; client?: string; budget?: number; address?: string }>({
        type: "object",
        properties: {
          title:   { type: "string",  description: es ? "Nombre del proyecto" : "Project name" },
          client:  { type: "string",  description: es ? "Nombre del cliente" : "Client name" },
          budget:  { type: "number",  description: es ? "Presupuesto en dólares" : "Budget in dollars" },
          address: { type: "string",  description: es ? "Dirección de la obra" : "Job address" },
        },
        required: ["title"],
        additionalProperties: false,
      }),
    }),

    create_payment: tool({
      description: es
        ? "Registrar un ingreso recibido del cliente (dinero que entra)."
        : "Record income received from the client (money coming in).",
      inputSchema: jsonSchema<{ amount: number; method?: string; type?: string; project_id?: string }>({
        type: "object",
        properties: {
          amount: { type: "number", description: es ? "Monto en dólares" : "Amount in dollars" },
          method: { type: "string", enum: methods, description: es ? "Método de pago" : "Payment method" },
          type:   { type: "string", enum: ["anticipo", "abono", "final"], description: es ? "Tipo de pago" : "Payment type" },
          project_id: pid,
        },
        required: ["amount"],
        additionalProperties: false,
      }),
    }),

    create_expense: tool({
      description: es
        ? "Registrar un egreso pagado a un proveedor o trabajador (dinero que sale)."
        : "Record an expense paid to a supplier or worker (money going out).",
      inputSchema: jsonSchema<{ amount: number; payee_name: string; concept?: string; method?: string; project_id?: string }>({
        type: "object",
        properties: {
          amount:     { type: "number", description: es ? "Monto en dólares" : "Amount in dollars" },
          payee_name: { type: "string", description: es ? "A quién se le pagó" : "Who was paid" },
          concept:    { type: "string", description: es ? "Concepto del pago" : "What it was for" },
          method:     { type: "string", enum: methods, description: es ? "Método de pago" : "Payment method" },
          project_id: pid,
        },
        required: ["amount", "payee_name"],
        additionalProperties: false,
      }),
    }),

    create_task: tool({
      description: es ? "Crear una actividad/tarea en el proyecto." : "Create a task/activity in the project.",
      inputSchema: jsonSchema<{ name: string; hours?: number; project_id?: string }>({
        type: "object",
        properties: {
          name:  { type: "string", description: es ? "Qué hay que hacer" : "What needs doing" },
          hours: { type: "number", description: es ? "Horas estimadas" : "Estimated hours" },
          project_id: pid,
        },
        required: ["name"],
        additionalProperties: false,
      }),
    }),

    create_material: tool({
      description: es ? "Agregar un material a la lista de compras del proyecto." : "Add a material to the project's shopping list.",
      inputSchema: jsonSchema<{ name: string; cost?: number; supplier?: string; project_id?: string }>({
        type: "object",
        properties: {
          name:     { type: "string", description: es ? "Nombre del material" : "Material name" },
          cost:     { type: "number", description: es ? "Costo en dólares" : "Cost in dollars" },
          supplier: { type: "string", description: es ? "Proveedor" : "Supplier" },
          project_id: pid,
        },
        required: ["name"],
        additionalProperties: false,
      }),
    }),

    create_budget_item: tool({
      description: es ? "Agregar una línea al presupuesto del proyecto." : "Add a line item to the project budget.",
      inputSchema: jsonSchema<{ description: string; amount: number; type?: string; project_id?: string }>({
        type: "object",
        properties: {
          description: { type: "string", description: es ? "Descripción de la línea" : "Line description" },
          amount:      { type: "number", description: es ? "Monto en dólares" : "Amount in dollars" },
          type:        { type: "string", enum: ["mano", "material"], description: es ? "Mano de obra o material" : "Labor or material" },
          project_id: pid,
        },
        required: ["description", "amount"],
        additionalProperties: false,
      }),
    }),

    create_contact: tool({
      description: es
        ? "Crear un contacto: co-worker (trabajador), customer (cliente) o friend (amistad)."
        : "Create a contact: coworker, customer, or friend.",
      inputSchema: jsonSchema<{ type: string; name: string; phone?: string; specialty?: string; rate?: string; rate_type?: string }>({
        type: "object",
        properties: {
          type:      { type: "string", enum: ["coworker", "customer", "friend"], description: es ? "Tipo de contacto" : "Contact type" },
          name:      { type: "string", description: es ? "Nombre completo" : "Full name" },
          phone:     { type: "string", description: es ? "Teléfono" : "Phone number" },
          specialty: { type: "string", enum: SPECIALTIES, description: es ? "Solo para coworker. Normaliza al inglés: plomero→Plumbing, pintor→Painting, ayudante→Helper." : "Coworker only." },
          rate:      { type: "string", description: es ? "Tarifa, solo el número (ej: 25)" : "Rate, number only (e.g. 25)" },
          rate_type: { type: "string", enum: ["hour", "day"], description: es ? "Tarifa por hora o por día" : "Rate per hour or per day" },
        },
        required: ["type", "name"],
        additionalProperties: false,
      }),
    }),

    update_task_status: tool({
      description: es ? "Cambiar el estado de una actividad existente." : "Change the status of an existing task.",
      inputSchema: jsonSchema<{ task_name: string; status: string; project_id?: string }>({
        type: "object",
        properties: {
          task_name: { type: "string", description: es ? "Nombre (o parte) de la actividad" : "Task name (or part of it)" },
          status:    { type: "string", enum: ["pend", "prog", "done"], description: es ? "pend=por hacer, prog=en proceso, done=terminado" : "pend=to do, prog=in progress, done=finished" },
          project_id: pid,
        },
        required: ["task_name", "status"],
        additionalProperties: false,
      }),
    }),

    create_agenda_event: tool({
      description: es
        ? "Agendar una cita, tarea o reunión con recordatorio. Solo el título es obligatorio."
        : "Schedule an appointment, task, or meeting with a reminder. Only the title is required.",
      inputSchema: jsonSchema<{
        title: string; event_type?: string; event_date?: string; event_time?: string;
        remind_from?: string; repeat_every?: string; project_id?: string;
      }>({
        type: "object",
        properties: {
          title:        { type: "string", description: es ? "De qué se trata" : "What it is about" },
          event_type:   { type: "string", enum: ["cita", "task", "reunion"], description: es ? "cita, task o reunion" : "appointment, task, or meeting" },
          event_date:   { type: "string", description: es ? "YYYY-MM-DD. Resuelve 'mañana'/'el martes' desde la fecha de hoy." : "YYYY-MM-DD. Resolve 'tomorrow'/'Tuesday' from today's date." },
          event_time:   { type: "string", description: es ? "HH:MM en 24h" : "HH:MM in 24h" },
          remind_from:  { type: "string", enum: ["2h", "1d", "2d", "1w"], description: es ? "Desde cuándo avisar antes" : "How far ahead to start reminding" },
          repeat_every: { type: "string", enum: ["once", "daily"], description: es ? "daily si pide que insista" : "daily if they ask it to insist" },
          project_id: pid,
        },
        required: ["title"],
        additionalProperties: false,
      }),
    }),
  };
}

// ── Herramientas de lectura ──────────────────────────────────────────────────
// Estas SÍ ejecutan en el servidor (anon key, mismo alcance que ya tiene el
// navegador) y su resultado vuelve al modelo para que redacte en prosa.
// El gate por permisos es un guardarraíl de UX, no una frontera de seguridad:
// `permissions` viaja desde el cliente. El endurecimiento real es Fase 2 de
// SECURITY_PLAN.md.
function readTools(
  lang: Lang,
  perms: Permissions | null,
  isSuperAdmin: boolean,
  projects: { id: string; title: string }[],
): ToolSet {
  const es  = lang === "es";
  const can = (section: keyof Permissions) => isSuperAdmin || perms?.[section]?.view === true;
  const tools: ToolSet = {};
  const projectIds = projects.map(p => p.id);
  const titleOf = (id: string | null) => projects.find(p => p.id === id)?.title ?? null;

  // La agenda es global y no depende de tener proyectos cargados
  if (isSuperAdmin) {
    tools.consultar_agenda = tool({
      description: es
        ? "Consultar la agenda: citas, tareas y reuniones de un día. Úsala para \"¿qué tengo hoy?\", \"¿qué tengo mañana?\", \"¿qué hay esta semana?\"."
        : "Look up the agenda: appointments, tasks and meetings for a day. Use for \"what do I have today?\", \"what's tomorrow?\".",
      inputSchema: jsonSchema<{ desde?: string; hasta?: string }>({
        type: "object",
        properties: {
          desde: { type: "string", description: es ? "YYYY-MM-DD. Default: hoy." : "YYYY-MM-DD. Defaults to today." },
          hasta: { type: "string", description: es ? "YYYY-MM-DD. Omítelo para un solo día." : "YYYY-MM-DD. Omit for a single day." },
        },
        required: [],
        additionalProperties: false,
      }),
      execute: async ({ desde, hasta }) => {
        const from = desde || TODAY();
        const to   = hasta || from;
        const { data } = await supabase
          .from("agenda_events")
          .select("title, event_type, event_date, event_time, done, project_id, notes")
          .gte("event_date", from).lte("event_date", to)
          .order("event_date").order("event_time").limit(50);
        const rows = data ?? [];
        return {
          desde: from, hasta: to, total: rows.length,
          pendientes: rows.filter(e => !e.done).length,
          eventos: rows.map(e => ({
            titulo: e.title, tipo: e.event_type, fecha: e.event_date, hora: e.event_time,
            hecho: e.done, proyecto: titleOf(e.project_id), notas: e.notes,
          })),
        };
      },
    });
  }

  if (!projectIds.length) return tools;

  const pidProp = {
    project_id: { type: "string" as const, enum: projectIds, description: es ? "Id del proyecto a consultar" : "Project id to look up" },
  };

  if (can("notas")) {
    tools.consultar_notas = tool({
      description: es
        ? "Leer las notas de un proyecto, de la más reciente a la más vieja. Úsala para \"¿qué dice la última nota?\" o \"léeme las notas\"."
        : "Read a project's notes, newest first. Use for \"what does the last note say?\" or \"read me the notes\".",
      inputSchema: jsonSchema<{ project_id: string; cuantas?: number }>({
        type: "object",
        properties: {
          ...pidProp,
          cuantas: { type: "number", description: es ? "Cuántas notas traer (default 5, máx 15)" : "How many notes (default 5, max 15)" },
        },
        required: ["project_id"],
        additionalProperties: false,
      }),
      execute: async ({ project_id, cuantas }) => {
        const limit = Math.min(Math.max(Number(cuantas ?? 5), 1), 15);
        const { data } = await supabase
          .from("project_notes")
          .select("content, attachments, created_at")
          .eq("project_id", project_id)
          .order("created_at", { ascending: false })
          .limit(limit);
        const rows = data ?? [];
        return {
          total: rows.length,
          notas: rows.map(n => ({
            texto: n.content,
            fecha: String(n.created_at).slice(0, 10),
            adjuntos: Array.isArray(n.attachments) ? n.attachments.length : 0,
          })),
        };
      },
    });
  }

  if (can("pagos")) {
    tools.consultar_finanzas = tool({
      description: es
        ? "Consultar dinero de un proyecto: presupuesto, cobrado, por cobrar, gastado y balance. Úsala para \"¿cuánto llevo cobrado?\", \"¿cuánto falta por cobrar?\", \"¿cuánto he gastado?\"."
        : "Look up a project's money: budget, collected, outstanding, spent, balance. Use for \"how much have I collected?\", \"how much is still owed?\".",
      inputSchema: jsonSchema<{ project_id: string }>({
        type: "object", properties: pidProp, required: ["project_id"], additionalProperties: false,
      }),
      execute: async ({ project_id }) => {
        const [{ data: pays }, { data: exps }, { data: proj }] = await Promise.all([
          supabase.from("payments").select("amount, date, method, type").eq("project_id", project_id),
          supabase.from("expenses").select("amount, date, payee_name, concept").eq("project_id", project_id),
          supabase.from("projects").select("budget").eq("id", project_id).single(),
        ]);
        const ingresos = (pays ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
        const egresos  = (exps ?? []).reduce((s, e) => s + Number(e.amount ?? 0), 0);
        // projects.budget lo sincroniza EstimateTab con el Grand Total al cargar o guardar
        // ese tab. Si el estimado cambió sin abrirlo, este número puede ir atrasado.
        const presupuesto = Number(proj?.budget ?? 0);
        return {
          presupuesto,
          ingresos, egresos, balance: ingresos - egresos,
          por_cobrar: presupuesto > 0 ? Math.max(0, presupuesto - ingresos) : null,
          n_ingresos: pays?.length ?? 0, n_egresos: exps?.length ?? 0,
          ultimos_egresos: (exps ?? []).slice(-5).map(e => ({ a: e.payee_name, monto: e.amount, concepto: e.concept })),
        };
      },
    });
  }

  if (can("workflow")) {
    tools.consultar_tareas = tool({
      description: es
        ? "Consultar actividades de un proyecto y su estado. Úsala cuando pregunten qué falta, qué hay para hoy o cómo van las tareas."
        : "Look up a project's tasks and their status. Use when asked what's pending or what's on for today.",
      inputSchema: jsonSchema<{ project_id: string; fecha?: string }>({
        type: "object",
        properties: {
          ...pidProp,
          fecha: { type: "string", description: es ? "YYYY-MM-DD para filtrar por día programado" : "YYYY-MM-DD to filter by scheduled day" },
        },
        required: ["project_id"],
        additionalProperties: false,
      }),
      execute: async ({ project_id, fecha }) => {
        let q = supabase.from("tasks").select("name, status, scheduled_date").eq("project_id", project_id).limit(60);
        if (fecha) q = q.eq("scheduled_date", fecha);
        const { data } = await q;
        const rows = data ?? [];
        return {
          total: rows.length,
          por_hacer:  rows.filter(t => t.status === "pend").length,
          en_proceso: rows.filter(t => t.status === "prog").length,
          hechas:     rows.filter(t => t.status === "done").length,
          tareas: rows.map(t => ({ nombre: t.name, estado: t.status, fecha: t.scheduled_date })),
        };
      },
    });
  }

  if (can("materiales")) {
    tools.consultar_materiales = tool({
      description: es
        ? "Consultar materiales de un proyecto: comprados y pendientes. Úsala cuando pregunten qué falta comprar."
        : "Look up a project's materials: bought and pending. Use when asked what's left to buy.",
      inputSchema: jsonSchema<{ project_id: string }>({
        type: "object", properties: pidProp, required: ["project_id"], additionalProperties: false,
      }),
      execute: async ({ project_id }) => {
        const { data } = await supabase.from("materials").select("name, cost, supplier, bought").eq("project_id", project_id).limit(80);
        const rows = data ?? [];
        return {
          total: rows.length,
          pendientes: rows.filter(m => !m.bought).map(m => ({ nombre: m.name, costo: m.cost, proveedor: m.supplier })),
          comprados:  rows.filter(m => m.bought).length,
          costo_pendiente: rows.filter(m => !m.bought).reduce((s, m) => s + Number(m.cost ?? 0), 0),
        };
      },
    });
  }

  return tools;
}

// Bloque "Katy aprende": memoria del usuario inyectada al prompt
function memoryBlock(mem: VoiceMemory | undefined, lang: Lang): string {
  if (!mem) return "";
  const lines: string[] = [];
  const aliasEntries = Object.entries(mem.aliases ?? {});
  const es = lang === "es";

  if (mem.userName)          lines.push(es ? `- Se llama ${mem.userName}.` : `- Their name is ${mem.userName}.`);
  if (mem.lastProjectTitle)  lines.push(es ? `- Último proyecto que usó: "${mem.lastProjectTitle}".` : `- Last project used: "${mem.lastProjectTitle}".`);
  if (mem.lastPaymentMethod) lines.push(es ? `- Método de pago habitual: ${mem.lastPaymentMethod}.` : `- Usual payment method: ${mem.lastPaymentMethod}.`);
  if (mem.defaultTaskHours)  lines.push(es ? `- Duración default de tareas: ${mem.defaultTaskHours} horas.` : `- Default task duration: ${mem.defaultTaskHours} hours.`);
  if (aliasEntries.length)   lines.push((es ? "- Su vocabulario (expande izquierda→derecha): " : "- Their vocabulary (expand left→right): ") + aliasEntries.map(([k, v]) => `"${k}"→"${v}"`).join(", "));
  if (mem.corrections?.length) lines.push((es ? "- Correcciones que ya te hizo, no las repitas: " : "- Corrections already made, don't repeat them: ") + mem.corrections.map(c => es ? `dijo "${c.heard}" y era "${c.meant}"` : `said "${c.heard}" meant "${c.meant}"`).join("; "));

  if (!lines.length) return "";
  return es ? `\nLO QUE SABES DE ÉL/ELLA:\n${lines.join("\n")}\n` : `\nWHAT YOU KNOW ABOUT THEM:\n${lines.join("\n")}\n`;
}

const SYSTEM = (
  ctx: string,
  contacts: string[],
  project: string,
  today: string,
  lang: Lang,
  projects: { id: string; title: string }[],
  memory: VoiceMemory | undefined,
  hasReadTools: boolean,
) => {
  const projectsList = projects.length ? projects.map(p => `"${p.title}" (id:${p.id})`).join(", ") : (lang === "en" ? "none" : "ninguno");
  const mem = memoryBlock(memory, lang);

  if (lang === "en") return `
You are Katy, the voice assistant for Luxaris Design, a remodeling contractor in South Florida. You talk with Marco and his crew while they are on job sites — often one-handed, with noise around them.

HOW YOU TALK
- Warm, natural, and brief: one or two sentences. You are a person, not a form.
- Always acknowledge what you understood before asking for anything: "Got it, $4,000 income — which method?"
- Ask ONLY for what is genuinely missing. If they said everything in one breath, act immediately and ask nothing.
- Never repeat a question word-for-word. If you didn't get it, rephrase or offer options: "Was that Zelle or cash?"
- Speech-to-text makes mistakes. If something sounds off, say what you think you heard instead of asking them to repeat.
- Plain conversation is welcome — greetings, "what can you do?", small clarifications. Just answer. Don't force an action.
- If they ask for something outside this app, say so kindly in one line.

WHERE THINGS GET SAVED — THIS MATTERS
- Current project: "${project || "none"}". ${project ? "Use it. Don't ask which project." : "There is NO project open."}
- Say out loud which project you are saving to BEFORE you act, whenever the record belongs to a project: "Adding it to Miami Kitchen."
- If no project is open and you cannot tell which one they mean, ask — do not guess silently.
- Never invent data. Only fill what they actually said.

CONTEXT
Active module: "${ctx}". Today: ${today}.
Known contacts: ${contacts.length ? contacts.join(", ") : "none"}.
Active projects (use these to resolve "the Brickell one"): ${projectsList}.
${mem}
TOOLS
- Use a write tool the moment you have enough. The user sees an editable confirmation card before anything is saved, so don't over-interrogate — a good guess they can fix beats three questions.
${hasReadTools
  ? `- Use the lookup tools to answer questions about their data, then reply in plain prose with the number they asked for. Don't dump the raw data — they are listening, not reading.
- "outstanding" comes from the Estimate's Grand Total, which syncs when that tab is opened or saved. If it looks stale or the budget is 0, say so instead of stating it as fact.
- If a lookup returns nothing, say so plainly. Never invent a figure.`
  : "- You cannot look up figures. If they ask, tell them which tab to open."}
`.trim();

  return `
Eres Katy, la asistente de voz de Luxaris Design, una contratista de remodelación en el sur de Florida. Hablas con Marco y su cuadrilla mientras están en obra — muchas veces con una sola mano y con ruido alrededor.

CÓMO HABLAS
- Cálida, natural y breve: una o dos frases. Eres una persona, no un formulario.
- Siempre acusa recibo de lo que entendiste antes de pedir nada: "Ok, ingreso de $4,000 — ¿por qué método?"
- Pregunta SOLO lo que genuinamente falta. Si te lo dijeron todo de un tirón, actúa de inmediato y no preguntes nada.
- Nunca repitas una pregunta textual. Si no entendiste, reformula u ofrece opciones: "¿Fue Zelle o efectivo?"
- El dictado se equivoca. Si algo suena raro, di lo que creíste escuchar en vez de pedir que repitan.
- La conversación normal es bienvenida — saludos, "¿qué puedes hacer?", aclaraciones. Responde y ya. No fuerces una acción.
- Si te piden algo fuera de esta app, dilo con amabilidad en una línea.

DÓNDE SE GUARDAN LAS COSAS — ESTO IMPORTA
- Proyecto actual: "${project || "ninguno"}". ${project ? "Úsalo. No preguntes por el proyecto." : "NO hay proyecto abierto."}
- Di en voz alta a qué proyecto vas a guardar ANTES de actuar, siempre que el registro pertenezca a un proyecto: "Lo agrego a Cocina Miami."
- Si no hay proyecto abierto y no puedes deducir cuál es, pregunta — no adivines en silencio.
- Nunca inventes datos. Llena solo lo que de verdad te dijeron.

CONTEXTO
Módulo activo: "${ctx}". Hoy: ${today}.
Contactos conocidos: ${contacts.length ? contacts.join(", ") : "ninguno"}.
Proyectos activos (úsalos para resolver "el de Brickell"): ${projectsList}.
${mem}
HERRAMIENTAS
- Usa una herramienta de escritura en cuanto tengas lo suficiente. El usuario ve una tarjeta de confirmación editable antes de que se guarde nada, así que no interrogues de más — una buena suposición que él corrige vale más que tres preguntas.
${hasReadTools
  ? `- Usa las herramientas de consulta para responder sobre sus datos, y contesta en prosa con el número que te pidieron. No vuelques los datos crudos — te están escuchando, no leyendo.
- El "por cobrar" sale del Grand Total del Estimate, que se sincroniza al abrir o guardar ese tab. Si se ve desactualizado o el presupuesto es 0, dilo en vez de afirmarlo como un hecho.
- Si una consulta no devuelve nada, dilo tal cual. Nunca inventes una cifra.`
  : "- No puedes consultar cifras. Si te preguntan, dile qué tab abrir."}
`.trim();
};

export async function POST(req: NextRequest) {
  let language: Lang = "es";
  try {
    const body = await req.json() as {
      messages: ApiMsg[];
      context?: string;
      contacts?: string[];
      projectTitle?: string;
      language?: Lang;
      projects?: { id: string; title: string }[];
      memory?: VoiceMemory;
      permissions?: Permissions | null;
      role?: string;
    };
    const messages     = body.messages     ?? [];
    const context      = body.context      ?? "dashboard";
    const contacts     = body.contacts     ?? [];
    const projectTitle = body.projectTitle ?? "";
    language           = body.language     ?? "es";
    const projects     = body.projects     ?? [];
    const memory       = body.memory;
    const isSuperAdmin = body.role === "superadmin";

    if (!messages.length) {
      return NextResponse.json({ type: "question", text: language === "en" ? "How can I help?" : "¿En qué te ayudo?" });
    }

    const reads  = readTools(language, body.permissions ?? null, isSuperAdmin, projects);
    const tools: ToolSet = { ...writeTools(language, projects.map(p => p.id)), ...reads };

    // Proveedor explícito → usa ANTHROPIC_API_KEY directo (el string "anthropic/..." iba
    // por el AI Gateway de Vercel, nunca configurado — Katy fallaba en cada comando)
    const { text, toolCalls } = await generateText({
      model: anthropic("claude-haiku-4-5"),
      system: SYSTEM(context, contacts, projectTitle, TODAY(), language, projects, memory, Object.keys(reads).length > 0),
      // Las de lectura ejecutan server-side y necesitan un paso extra para redactar
      // la respuesta con el dato ya en mano. Las de escritura no tienen execute:
      // el loop corta ahí y la tool call vuelve sin ejecutar.
      stopWhen: stepCountIs(4),
      // 0 la hacía repetir la MISMA pregunta textual cuando el dictado fallaba.
      // Los inputSchema protegen la extracción, así que el margen es seguro.
      temperature: 0.5,
      tools,
      messages,
    });

    const write = toolCalls.find(c => WRITE_ACTIONS.has(c.toolName));
    if (write) {
      return NextResponse.json({
        type:   "action",
        action: write.toolName,
        data:   write.input,
        say:    text.trim(),
      });
    }

    const reply = text.trim();
    if (!reply) {
      return NextResponse.json({ type: "question", text: language === "en" ? "Sorry, I didn't catch that." : "Perdona, no te entendí." });
    }
    return NextResponse.json({ type: "question", text: reply });

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
