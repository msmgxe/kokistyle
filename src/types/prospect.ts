export type ProspectStatus = "new" | "contacted" | "converted" | "discarded";

export interface Prospect {
  id: string;
  name: string;
  email: string;
  phone: string;
  room_type: string | null;
  style: string | null;
  renders_used: number;
  last_before_url: string | null;
  last_render_url: string | null;
  status: ProspectStatus;
  notes: string | null;
  source: string;
  created_at: string;
  last_used_at: string | null;
}
