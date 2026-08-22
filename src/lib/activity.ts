export interface ActivityEntry {
  user_id?: string;
  user_name?: string;
  user_role?: string;
  action: "login" | "create" | "update" | "delete" | "mark_bought";
  entity_type?: "project" | "task" | "payment" | "expense" | "material" | "contact" | "note" | "photo" | "estimate_item" | "change_order" | "invoice" | "agenda_event" | "device_token";
  entity_id?: string;
  entity_name?: string;
  project_id?: string;
  project_name?: string;
  details?: Record<string, unknown>;
}

/**
 * Anota una acción en el registro. Va por API a propósito: el servidor pone
 * quién la hizo a partir de la sesión, así que `user_id`, `user_name` y
 * `user_role` que se pasen aquí se ignoran — se conservan en el tipo sólo para
 * no tocar las diez llamadas que ya existen.
 *
 * Sin esperar respuesta: registrar no debe frenar la interfaz.
 */
export function logActivity(entry: ActivityEntry): void {
  if (typeof window === "undefined") return;
  fetch("/api/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
    keepalive: true,          // sobrevive a un cierre de pestaña tras el logout
  }).catch(() => { /* el registro nunca rompe la acción del usuario */ });
}
