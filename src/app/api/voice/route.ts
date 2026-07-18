import { NextRequest, NextResponse } from "next/server";
import { generateText, tool, jsonSchema, stepCountIs, type ToolSet, type ModelMessage } from "ai";
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

const normp = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Resuelve un nombre hablado ("Jacuzzi") al id del proyecto, con matching
// determinístico. El modelo pasa el nombre que dijo el usuario; el matching
// título→id lo hace el servidor, que es confiable con títulos que empiezan con
// fecha/código ("2026. 07 - JACUZZI").
function resolveProjectId(hint: string | undefined | null, projects: { id: string; title: string }[]): string | null {
  if (!projects.length) return null;
  if (!hint) return projects.length === 1 ? projects[0].id : null;
  const exact = projects.find(p => p.id === hint);
  if (exact) return exact.id;
  const n = normp(hint).trim();
  const contains = projects.find(p => normp(p.title).includes(n) || n.includes(normp(p.title)));
  if (contains) return contains.id;
  // Palabras distintivas: descarta números/fechas y palabras cortas
  const hintWords = n.split(/[^a-z0-9]+/).filter(w => w.length > 2 && !/^\d+$/.test(w));
  if (hintWords.length) {
    const scored = projects
      .map(p => {
        const tw = normp(p.title).split(/[^a-z0-9]+/);
        return { id: p.id, score: hintWords.filter(w => tw.some(t => t.includes(w) || w.includes(t))).length };
      })
      .sort((a, b) => b.score - a.score);
    if (scored[0]?.score > 0) return scored[0].id;
  }
  return projects.length === 1 ? projects[0].id : null;
}

// Detecta si el texto del usuario menciona un proyecto (por palabra distintiva
// del título). A diferencia de resolveProjectId, NO cae al "único proyecto":
// una pregunta global ("¿qué gasté en total?") no debe fijar proyecto. Alimenta
// el `focus` que usa readTools como red de seguridad si el modelo llama una
// consulta sin proyecto.
function detectProjectMention(text: string, projects: { id: string; title: string }[]): { id: string; title: string } | null {
  const n = normp(text);
  const STOP = new Set(["para", "proyecto", "que", "the", "one", "del", "los", "las", "and", "por", "con", "obra", "unit", "tower", "north", "design", "remodeling"]);
  let best: { id: string; title: string; score: number } | null = null;
  for (const p of projects) {
    const words = normp(p.title).split(/[^a-z0-9]+/).filter(w => w.length > 3 && !/^\d+$/.test(w) && !STOP.has(w));
    const score = words.filter(w => n.includes(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { ...p, score };
  }
  return best ? { id: best.id, title: best.title } : null;
}

// El presupuesto que Katy debe usar es el Grand Total del Estimate, no
// projects.budget: ese solo se sincroniza cuando alguien abre o guarda el tab
// Estimate. Aquí se lee del estimado directo (misma lógica que el dashboard),
// así "¿cuánto presupuesté?" funciona aunque nadie haya abierto el tab.
// Devuelve null si el proyecto no tiene estimado.
async function estimateGrandTotal(projectId: string): Promise<number | null> {
  const { data: est } = await supabase
    .from("project_estimates").select("id, discount_pct").eq("project_id", projectId).maybeSingle();
  if (!est) return null;
  const { data: secs } = await supabase
    .from("estimate_sections")
    .select("section_total, is_material_type, estimate_items(amount)")
    .eq("estimate_id", est.id);
  let all = 0, labor = 0;
  for (const s of secs ?? []) {
    const itemsSum = ((s.estimate_items ?? []) as Array<{ amount: number }>).reduce((a, i) => a + Number(i.amount ?? 0), 0);
    const st = itemsSum > 0 ? itemsSum : Number(s.section_total ?? 0);
    all += st;
    if (!s.is_material_type) labor += st;
  }
  const disc = Math.round(labor * (Number(est.discount_pct ?? 0) / 100) * 100) / 100;
  return all - disc;
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
  focusId: string | null,
): ToolSet {
  const es  = lang === "es";
  const can = (section: keyof Permissions) => isSuperAdmin || perms?.[section]?.view === true;
  // Nivel admin de voz: el superadmin, o un co-worker a quien el superadmin le dio
  // TODOS los permisos de vista en el panel de Equipo. Habilita las herramientas
  // de gestión (tu agenda + la auditoría "¿qué me falta?"). Así el superadmin
  // controla persona por persona: la cuadrilla de campo queda limitada por default.
  const SECTIONS: (keyof Permissions)[] = ["workflow", "materiales", "contactos", "presupuesto", "pagos", "notas"];
  const adminLevel = isSuperAdmin || (!!perms && SECTIONS.every(s => perms[s]?.view === true));
  const tools: ToolSet = {};
  const projectIds = projects.map(p => p.id);
  const titleOf = (id: string | null) => projects.find(p => p.id === id)?.title ?? null;
  // Red de seguridad: si el modelo no pasa proyecto (o pasa algo que no resuelve)
  // pero hay uno en foco, usamos ese. Cierra el caso donde Haiku llama la tool
  // sin argumento de proyecto confiando en el contexto.
  const resolveOrFocus = (hint: string | undefined) => resolveProjectId(hint, projects) ?? focusId;

  // La agenda es global y no depende de tener proyectos cargados
  if (adminLevel) {
    tools.consultar_agenda = tool({
      description: es
        ? "Consultar la agenda de CUALQUIER día o rango — futuro O PASADO. Úsala para \"¿qué tengo hoy?\", \"¿qué tengo mañana?\", \"¿qué tuve ayer?\", \"¿qué hubo la semana pasada?\". Sí puedes ver el historial: pásale el rango de fechas."
        : "Look up the agenda for ANY day or range — future OR PAST. Use for \"what do I have today?\", \"what did I have yesterday?\", \"what was last week?\". You CAN see history: just pass the date range.",
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

  // El modelo pasa el NOMBRE (o parte) que dijo el usuario; resolveProjectId lo
  // convierte al id en el servidor. Haiku pasa texto bien; UUIDs, mal.
  const proyProp = {
    proyecto: { type: "string" as const, description: es ? "Nombre o parte del nombre del proyecto (ej: \"Jacuzzi\", \"el de Brickell\")" : "Project name or part of it (e.g. \"Jacuzzi\", \"the Brickell one\")" },
  };
  const notFound = es ? "No encontré ese proyecto" : "Project not found";

  if (can("notas")) {
    tools.consultar_notas = tool({
      description: es
        ? "Leer las notas de un proyecto, de la más reciente a la más vieja. Úsala para \"¿qué dice la última nota?\" o \"léeme las notas\"."
        : "Read a project's notes, newest first. Use for \"what does the last note say?\" or \"read me the notes\".",
      inputSchema: jsonSchema<{ proyecto?: string; cuantas?: number }>({
        type: "object",
        properties: {
          ...proyProp,
          cuantas: { type: "number", description: es ? "Cuántas notas traer (default 5, máx 15)" : "How many notes (default 5, max 15)" },
        },
        required: [],
        additionalProperties: false,
      }),
      execute: async ({ proyecto, cuantas }) => {
        const project_id = resolveOrFocus(proyecto);
        if (!project_id) return { error: notFound };
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
      inputSchema: jsonSchema<{ proyecto?: string }>({
        type: "object", properties: proyProp, required: [], additionalProperties: false,
      }),
      execute: async ({ proyecto }) => {
        const project_id = resolveOrFocus(proyecto);
        if (!project_id) return { error: notFound };
        const [{ data: pays }, { data: exps }, { data: proj }, estTotal] = await Promise.all([
          supabase.from("payments").select("amount, date, method, type").eq("project_id", project_id),
          supabase.from("expenses").select("amount, date, payee_name, concept").eq("project_id", project_id),
          supabase.from("projects").select("budget").eq("id", project_id).single(),
          estimateGrandTotal(project_id),
        ]);
        const ingresos = (pays ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
        const egresos  = (exps ?? []).reduce((s, e) => s + Number(e.amount ?? 0), 0);
        // El estimado es la fuente de verdad; projects.budget es respaldo por si
        // no hay estimado (o su sincronización quedó como único dato).
        const presupuesto = estTotal ?? Number(proj?.budget ?? 0);
        return {
          presupuesto, tiene_estimado: estTotal !== null,
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
        ? "Consultar actividades y su estado. Con project_id, las de ese proyecto; SIN project_id, las de todos. Úsala para \"¿qué falta en Brickell?\", \"¿qué hay para hoy?\", \"¿qué tengo esta semana?\"."
        : "Look up tasks and their status. With project_id, that project's; WITHOUT it, across all projects. Use for \"what's pending?\", \"what's on for today?\".",
      inputSchema: jsonSchema<{ proyecto?: string; fecha?: string }>({
        type: "object",
        properties: {
          proyecto: { type: "string", description: es ? "Nombre o parte del nombre. OMÍTELO para ver las tareas de todos los proyectos." : "Project name or part of it. OMIT to see tasks across all projects." },
          fecha: { type: "string", description: es ? "YYYY-MM-DD para filtrar por día programado" : "YYYY-MM-DD to filter by scheduled day" },
        },
        required: [],
        additionalProperties: false,
      }),
      execute: async ({ proyecto, fecha }) => {
        const project_id = proyecto ? resolveProjectId(proyecto, projects) : null;
        if (proyecto && !project_id) return { error: notFound };
        let q = supabase.from("tasks").select("name, status, scheduled_date, project_id").limit(80);
        // Sin proyecto → solo los que este usuario ya puede ver (los que vinieron en el contexto)
        q = project_id ? q.eq("project_id", project_id) : q.in("project_id", projectIds);
        if (fecha) q = q.eq("scheduled_date", fecha);
        const { data } = await q;
        const rows = data ?? [];
        return {
          total: rows.length,
          por_hacer:  rows.filter(t => t.status === "pend").length,
          en_proceso: rows.filter(t => t.status === "prog").length,
          hechas:     rows.filter(t => t.status === "done").length,
          tareas: rows.map(t => ({
            nombre: t.name, estado: t.status, fecha: t.scheduled_date,
            ...(project_id ? {} : { proyecto: titleOf(t.project_id) }),
          })),
        };
      },
    });
  }

  // Ficha del proyecto. Sin gate: quien ve el proyecto ve sus datos — pero el
  // dinero solo se incluye si tiene permiso de Cash Flow.
  tools.consultar_proyecto = tool({
    description: es
      ? "Ficha de un proyecto: estado, cliente, dirección, fecha de inicio y un resumen de cómo va. Úsala para \"¿cómo va Brickell?\", \"¿de quién es Cocina Miami?\", \"¿cuándo empezó?\"."
      : "A project's fact sheet: status, client, address, start date and a progress summary. Use for \"how's Brickell going?\", \"whose project is this?\".",
    inputSchema: jsonSchema<{ proyecto?: string }>({
      type: "object", properties: proyProp, required: [], additionalProperties: false,
    }),
    execute: async ({ proyecto }) => {
      const project_id = resolveOrFocus(proyecto);
      if (!project_id) return { error: notFound };
      const [{ data: p }, { data: tasks }, { data: mats }, { data: pays }, estTotal] = await Promise.all([
        supabase.from("projects").select("title, client, address, status, budget, start_date").eq("id", project_id).single(),
        supabase.from("tasks").select("status").eq("project_id", project_id),
        supabase.from("materials").select("bought").eq("project_id", project_id),
        supabase.from("payments").select("amount").eq("project_id", project_id),
        estimateGrandTotal(project_id),
      ]);
      if (!p) return { error: es ? "No encontré ese proyecto" : "Project not found" };
      const ESTADOS: Record<string, string> = es
        ? { prospecto: "Prospecto", presupuesto: "Estimado", aprobado: "Aprobado", en_obra: "En obra", terminado: "Terminado" }
        : { prospecto: "Prospect", presupuesto: "Estimate", aprobado: "Approved", en_obra: "In progress", terminado: "Completed" };
      const t = tasks ?? [];
      const dinero = can("pagos")
        ? {
            presupuesto: estTotal ?? Number(p.budget ?? 0),
            cobrado: (pays ?? []).reduce((s, x) => s + Number(x.amount ?? 0), 0),
          }
        : undefined;
      return {
        titulo: p.title, cliente: p.client, direccion: p.address,
        estado: ESTADOS[p.status] ?? p.status,
        inicio: p.start_date,
        tareas: { total: t.length, hechas: t.filter(x => x.status === "done").length },
        materiales: { total: (mats ?? []).length, pendientes: (mats ?? []).filter(m => !m.bought).length },
        ...(dinero ? { dinero } : {}),
      };
    },
  });

  if (can("contactos")) {
    tools.consultar_contactos = tool({
      description: es
        ? "Buscar en el directorio de contactos: co-workers, clientes y amistades. Úsala para \"¿cuál es el teléfono de Jorge?\", \"¿quién es el plomero?\", \"¿qué electricistas tengo?\"."
        : "Search the contact directory: coworkers, clients, friends. Use for \"what's Jorge's phone?\", \"who's the plumber?\".",
      inputSchema: jsonSchema<{ busqueda?: string; especialidad?: string }>({
        type: "object",
        properties: {
          busqueda:     { type: "string", description: es ? "Parte del nombre a buscar" : "Part of the name to search" },
          especialidad: { type: "string", enum: SPECIALTIES, description: es ? "Filtrar por especialidad (en inglés)" : "Filter by specialty" },
        },
        required: [],
        additionalProperties: false,
      }),
      execute: async ({ busqueda, especialidad }) => {
        let q = supabase.from("contacts").select("name, specialty, phone, rate, rate_type, type").limit(40);
        if (busqueda)     q = q.ilike("name", `%${busqueda}%`);
        if (especialidad) q = q.eq("specialty", especialidad);
        const { data } = await q;
        const rows = data ?? [];
        return {
          total: rows.length,
          contactos: rows.map(c => ({
            nombre: c.name, tipo: c.type, especialidad: c.specialty || null,
            telefono: c.phone || null,
            tarifa: c.rate ? `${c.rate}/${c.rate_type === "day" ? (es ? "día" : "day") : (es ? "hora" : "hour")}` : null,
          })),
        };
      },
    });
  }

  // Auditoría "qué me falta registrar". Nivel admin: mezcla huecos de dinero
  // con huecos de obra, y es una vista de gestión.
  if (adminLevel) {
    tools.consultar_pendientes = tool({
      description: es
        ? "Revisar qué le falta registrar a un proyecto: estimado, tareas, materiales, pagos, fechas. Úsala para \"¿qué me falta en Brickell?\", \"¿qué tengo incompleto?\"."
        : "Audit what a project is missing: estimate, tasks, materials, payments, dates. Use for \"what am I missing on Brickell?\".",
      inputSchema: jsonSchema<{ proyecto?: string }>({
        type: "object", properties: proyProp, required: [], additionalProperties: false,
      }),
      execute: async ({ proyecto }) => {
        const project_id = resolveOrFocus(proyecto);
        if (!project_id) return { error: notFound };
        const [{ data: p }, { data: tasks }, { data: mats }, { data: pays }, { data: pc }, estTotal] = await Promise.all([
          supabase.from("projects").select("title, status, budget").eq("id", project_id).single(),
          supabase.from("tasks").select("status, scheduled_date").eq("project_id", project_id),
          supabase.from("materials").select("bought, cost").eq("project_id", project_id),
          supabase.from("payments").select("amount").eq("project_id", project_id),
          supabase.from("project_contacts").select("contact_id").eq("project_id", project_id),
          estimateGrandTotal(project_id),
        ]);
        if (!p) return { error: es ? "No encontré ese proyecto" : "Project not found" };

        const presupuesto = estTotal ?? Number(p.budget ?? 0);
        const cobrado = (pays ?? []).reduce((s, x) => s + Number(x.amount ?? 0), 0);
        const t = tasks ?? [];
        const faltantes: string[] = [];

        if (estTotal === null && presupuesto <= 0) faltantes.push(es ? "No tiene estimado — arma el Estimate" : "No estimate yet");
        if (!t.length) faltantes.push(es ? "No tiene ninguna actividad registrada" : "No tasks recorded");
        if (!(mats ?? []).length) faltantes.push(es ? "No tiene materiales en la lista de compras" : "No materials in the shopping list");
        if (!(pc ?? []).length) faltantes.push(es ? "No tiene a nadie del equipo asignado" : "Nobody from the team is assigned");
        if (presupuesto > 0 && cobrado <= 0 && ["aprobado", "en_obra"].includes(p.status)) {
          faltantes.push(es ? "Está aprobado pero no hay ni un ingreso registrado" : "Approved but no income recorded");
        }
        const sinProgramar = t.filter(x => !x.scheduled_date && x.status !== "done").length;
        if (sinProgramar) faltantes.push(es ? `${sinProgramar} actividad(es) sin día asignado en el Day Planner` : `${sinProgramar} task(s) with no day assigned`);
        const porComprar = (mats ?? []).filter(m => !m.bought).length;
        if (porComprar) faltantes.push(es ? `${porComprar} material(es) sin comprar` : `${porComprar} material(s) not bought yet`);
        if (presupuesto > 0 && cobrado < presupuesto) {
          faltantes.push(es ? `Faltan $${(presupuesto - cobrado).toLocaleString("en-US")} por cobrar` : `$${(presupuesto - cobrado).toLocaleString("en-US")} still to collect`);
        }

        return {
          proyecto: p.title,
          todo_en_orden: faltantes.length === 0,
          faltantes,
        };
      },
    });
  }

  if (can("materiales")) {
    tools.consultar_materiales = tool({
      description: es
        ? "Consultar materiales de un proyecto: comprados y pendientes. Úsala cuando pregunten qué falta comprar."
        : "Look up a project's materials: bought and pending. Use when asked what's left to buy.",
      inputSchema: jsonSchema<{ proyecto?: string }>({
        type: "object", properties: proyProp, required: [], additionalProperties: false,
      }),
      execute: async ({ proyecto }) => {
        const project_id = resolveOrFocus(proyecto);
        if (!project_id) return { error: notFound };
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
Active projects: ${projectsList}.

${mem}
TOOLS
- Use a write tool the moment you have enough. The user sees an editable confirmation card before anything is saved, so don't over-interrogate — a good guess they can fix beats three questions.
${hasReadTools
  ? `- When the user asks about a project, CALL the lookup tool right away. Pass the exact word they said in "proyecto" (e.g. "Jacuzzi", "Brickell") — do NOT try to match it to a full title yourself, and do NOT ask "which project?". The server resolves the name and tells you if it truly doesn't exist. Titles often start with a date/code ("2026. 07 - JACUZZI") — that is normal; still just pass "Jacuzzi".
- Then answer in plain prose with what they asked for. Don't dump the raw data — they are listening, not reading.
- "outstanding" comes from the Estimate's Grand Total, which syncs when that tab is opened or saved. If it looks stale or the budget is 0, say so instead of stating it as fact.
- Only if the tool result itself says it found nothing, tell them plainly. Never invent a figure, and never refuse to look before calling the tool.`
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
Proyectos activos: ${projectsList}.

${mem}
HERRAMIENTAS
- Usa una herramienta de escritura en cuanto tengas lo suficiente. El usuario ve una tarjeta de confirmación editable antes de que se guarde nada, así que no interrogues de más — una buena suposición que él corrige vale más que tres preguntas.
${hasReadTools
  ? `- Cuando el usuario pregunte por un proyecto, LLAMA la herramienta de consulta de inmediato. Pasa en "proyecto" la palabra exacta que dijo (ej: "Jacuzzi", "Brickell") — NO trates de emparejarla tú con el título completo, y NO preguntes "¿cuál proyecto?". El servidor resuelve el nombre y te dice si de verdad no existe. Los títulos suelen empezar con fecha o código ("2026. 07 - JACUZZI") — es normal; igual pasa solo "Jacuzzi".
- Luego contesta en prosa con lo que te pidieron. No vuelques los datos crudos — te están escuchando, no leyendo.
- El "por cobrar" sale del Grand Total del Estimate, que se sincroniza al abrir o guardar ese tab. Si se ve desactualizado o el presupuesto es 0, dilo en vez de afirmarlo como un hecho.
- Solo si el resultado de la herramienta dice que no encontró nada, dilo tal cual. Nunca inventes una cifra, y nunca te niegues a buscar antes de llamar la herramienta.`
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

    // El proyecto en foco es la red de seguridad de la resolución server-side: el
    // abierto en pantalla, o el que el usuario nombró por apodo en este turno. Si
    // el modelo llama una consulta sin proyecto (o con uno que no resuelve), la
    // herramienta cae a este foco. Así "¿qué me falta en Jacuzzi?" resuelve aunque
    // el título sea "2026. 07 - JACUZZI".
    const lastUser = [...messages].reverse().find(m => m.role === "user")?.content ?? "";
    const focus = (projectTitle && projects.find(p => p.title === projectTitle)) || detectProjectMention(lastUser, projects);

    const reads  = readTools(language, body.permissions ?? null, isSuperAdmin, projects, focus?.id ?? null);
    const tools: ToolSet = { ...writeTools(language, projects.map(p => p.id)), ...reads };

    // Proveedor explícito → usa ANTHROPIC_API_KEY directo (el string "anthropic/..." iba
    // por el AI Gateway de Vercel, nunca configurado — Katy fallaba en cada comando)
    // Prompt caching: el system + las 17 herramientas (~5000 tokens, idénticos
    // entre pasos y entre comandos de la misma sesión) van como mensaje "system"
    // con cacheControl. La 2ª llamada de cada consulta (redactar tras la tool) y
    // los comandos siguientes en manos libres leen ese prefijo a ~10% del costo.
    const chatMessages: ModelMessage[] = [
      {
        role: "system",
        content: SYSTEM(context, contacts, projectTitle, TODAY(), language, projects, memory, Object.keys(reads).length > 0),
        providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
      },
      ...messages,
    ];

    const { text, toolCalls } = await generateText({
      model: anthropic("claude-haiku-4-5"),
      // Las de lectura ejecutan server-side y necesitan un paso extra para redactar
      // la respuesta con el dato ya en mano. Las de escritura no tienen execute:
      // el loop corta ahí y la tool call vuelve sin ejecutar.
      stopWhen: stepCountIs(4),
      // 0 la hacía repetir la MISMA pregunta textual cuando el dictado fallaba.
      temperature: 0.5,
      tools,
      messages: chatMessages,
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
