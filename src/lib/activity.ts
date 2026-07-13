import { supabase } from "./supabase";

export interface ActivityEntry {
  user_id?: string;
  user_name?: string;
  user_role?: string;
  action: "login" | "create" | "update" | "delete" | "mark_bought";
  entity_type?: "project" | "task" | "payment" | "expense" | "material" | "contact" | "note" | "photo" | "estimate_item" | "agenda_event" | "device_token";
  entity_id?: string;
  entity_name?: string;
  project_id?: string;
  project_name?: string;
  details?: Record<string, unknown>;
}

export function logActivity(entry: ActivityEntry): void {
  supabase.from("activity_log").insert(entry).then(() => {});
}
