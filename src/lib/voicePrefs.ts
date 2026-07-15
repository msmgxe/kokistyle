import { supabase } from "@/src/lib/supabase";

// Memoria ligera de Katy por usuario (Nivel 1 + 2 de "Katy aprende").
// Nivel 1 — personal: saluda por nombre, recuerda último proyecto/método de pago, duración de tareas.
// Nivel 2 — vocabulario: guarda alias ("depot" → "Home Depot") y correcciones que el usuario hace
//           en la tarjeta de confirmación, y se los alimenta al prompt para acertar más cada vez.
// Todo best-effort con anon key — si la tabla no existe (migración sin correr), Katy sigue igual.

export interface VoiceCorrection {
  field?: string;
  heard: string;
  meant: string;
  at: string;
}

export interface VoicePrefs {
  user_label: string;
  last_project_id: string | null;
  last_project_title: string | null;
  last_payment_method: string | null;
  default_task_hours: number | null;
  aliases: Record<string, string>;
  corrections: VoiceCorrection[];
}

// Lo que se envía al prompt de /api/voice
export interface VoiceMemory {
  userName: string | null;
  lastProjectTitle: string | null;
  lastPaymentMethod: string | null;
  defaultTaskHours: number | null;
  aliases: Record<string, string>;
  corrections: { heard: string; meant: string }[];
}

const MAX_CORRECTIONS = 40;
const MAX_ALIASES = 60;
// Campos cuyo cambio de texto vale la pena aprender como alias (nombres propios de obra)
const ALIAS_FIELDS = new Set(["supplier", "payee_name", "client", "name"]);

function emptyPrefs(userLabel: string): VoicePrefs {
  return {
    user_label: userLabel,
    last_project_id: null,
    last_project_title: null,
    last_payment_method: null,
    default_task_hours: null,
    aliases: {},
    corrections: [],
  };
}

export async function loadVoicePrefs(userLabel: string | null | undefined): Promise<VoicePrefs | null> {
  if (!userLabel) return null;
  try {
    const { data, error } = await supabase
      .from("voice_prefs")
      .select("*")
      .eq("user_label", userLabel)
      .maybeSingle();
    if (error || !data) return null;
    return {
      user_label: userLabel,
      last_project_id: data.last_project_id ?? null,
      last_project_title: data.last_project_title ?? null,
      last_payment_method: data.last_payment_method ?? null,
      default_task_hours: data.default_task_hours != null ? Number(data.default_task_hours) : null,
      aliases: (data.aliases as Record<string, string>) ?? {},
      corrections: (data.corrections as VoiceCorrection[]) ?? [],
    };
  } catch {
    return null;
  }
}

export function toMemory(prefs: VoicePrefs | null, userName: string | null): VoiceMemory | null {
  if (!userName && !prefs) return null;
  return {
    userName: userName ?? null,
    lastProjectTitle: prefs?.last_project_title ?? null,
    lastPaymentMethod: prefs?.last_payment_method ?? null,
    defaultTaskHours: prefs?.default_task_hours ?? null,
    aliases: prefs?.aliases ?? {},
    corrections: (prefs?.corrections ?? []).slice(-8).map(c => ({ heard: c.heard, meant: c.meant })),
  };
}

// Deriva alias + correcciones comparando lo que dictó el usuario (original de la IA) con lo que dejó
// en la tarjeta. textKeys = campos de texto editables de la acción.
export function learnCorrections(
  originalData: Record<string, unknown>,
  finalData: Record<string, unknown>,
  textKeys: string[],
): { corrections: VoiceCorrection[]; aliases: Record<string, string> } {
  const corrections: VoiceCorrection[] = [];
  const aliases: Record<string, string> = {};
  const now = new Date().toISOString();
  for (const key of textKeys) {
    const heard = String(originalData[key] ?? "").trim();
    const meant = String(finalData[key] ?? "").trim();
    if (!heard || !meant) continue;
    if (heard.toLowerCase() === meant.toLowerCase()) continue;
    corrections.push({ field: key, heard, meant, at: now });
    // Nombres propios cortos → alias reutilizable ("depot" → "Home Depot")
    if (ALIAS_FIELDS.has(key) && heard.split(/\s+/).length <= 4) {
      aliases[heard.toLowerCase()] = meant;
    }
  }
  return { corrections, aliases };
}

// Aplica el aprendizaje de una confirmación y persiste (upsert por user_label).
export async function saveVoiceLearning(
  base: VoicePrefs | null,
  userLabel: string,
  patch: {
    lastProjectId?: string | null;
    lastProjectTitle?: string | null;
    lastPaymentMethod?: string | null;
    defaultTaskHours?: number | null;
    corrections?: VoiceCorrection[];
    aliases?: Record<string, string>;
  },
): Promise<VoicePrefs> {
  const prefs = base ? { ...base } : emptyPrefs(userLabel);

  if (patch.lastProjectId !== undefined && patch.lastProjectId) {
    prefs.last_project_id = patch.lastProjectId;
    if (patch.lastProjectTitle) prefs.last_project_title = patch.lastProjectTitle;
  }
  if (patch.lastPaymentMethod) prefs.last_payment_method = patch.lastPaymentMethod;
  if (patch.defaultTaskHours != null && patch.defaultTaskHours > 0) prefs.default_task_hours = patch.defaultTaskHours;

  if (patch.aliases && Object.keys(patch.aliases).length) {
    prefs.aliases = { ...prefs.aliases, ...patch.aliases };
    const keys = Object.keys(prefs.aliases);
    if (keys.length > MAX_ALIASES) {
      prefs.aliases = Object.fromEntries(keys.slice(-MAX_ALIASES).map(k => [k, prefs.aliases[k]]));
    }
  }
  if (patch.corrections && patch.corrections.length) {
    prefs.corrections = [...prefs.corrections, ...patch.corrections].slice(-MAX_CORRECTIONS);
  }

  try {
    await supabase.from("voice_prefs").upsert(
      {
        user_label: userLabel,
        last_project_id: prefs.last_project_id,
        last_project_title: prefs.last_project_title,
        last_payment_method: prefs.last_payment_method,
        default_task_hours: prefs.default_task_hours,
        aliases: prefs.aliases,
        corrections: prefs.corrections,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_label" },
    );
  } catch {
    /* tabla ausente o error de red — la memoria es best-effort */
  }
  return prefs;
}
