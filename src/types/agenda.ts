export type AgendaEventType = "cita" | "task" | "reunion";
export type AgendaRemindFrom = "2h" | "1d" | "2d" | "1w";
export type AgendaRepeat = "once" | "daily";

export interface AgendaEvent {
  id: string;
  event_type: AgendaEventType;
  title: string;
  project_id: string | null;
  event_date: string;
  event_time: string;
  remind_from: AgendaRemindFrom;
  repeat_every: AgendaRepeat;
  notes: string | null;
  done: boolean;
  last_notified_at: string | null;
  created_at: string;
}

export interface DeviceToken {
  id: string;
  token: string;
  user_id: string;
  label: string | null;
  expires_at: string | null;
  revoked: boolean;
  last_used_at: string | null;
  created_at: string;
}
