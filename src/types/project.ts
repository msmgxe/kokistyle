export interface Project {
  id: string;
  title: string;
  client: string;
  address: string;
  status: "presupuesto" | "aprobado" | "en_obra" | "terminado";
  budget: number;
  start_date: string;
  created_at?: string;
}

export interface Contact {
  id: string;
  name: string;
  specialty: string;
  phone: string;
  rate: string;
  type: "friend" | "coworker" | "customer";
  rate_type: "hour" | "day";
  created_at?: string;
  projects?: string[];
}

export interface Task {
  id: string;
  project_id: string;
  name: string;
  hours: number;
  duration_weeks: number;
  status: "pend" | "prog" | "done";
  sort_order: number;
  assigned_contact_id: string | null;
  created_at?: string;
  // Join fields
  assigned_contact_name?: string; 
}

export interface BudgetItem {
  id: string;
  project_id: string;
  type: "mano" | "material";
  description: string;
  amount: number;
  created_at?: string;
}

export interface Material {
  id: string;
  project_id: string;
  name: string;
  supplier: string;
  cost: number;
  bought: boolean;
  created_at?: string;
}

export interface Payment {
  id: string;
  project_id: string;
  amount: number;
  date: string;
  method: "Efectivo" | "Transferencia" | "Zelle" | "Cheque" | "Tarjeta";
  type: "abono" | "anticipo" | "final";
  created_at?: string;
}

export interface Expense {
  id: string;
  project_id: string;
  amount: number;
  date: string;
  method: "Efectivo" | "Transferencia" | "Zelle" | "Cheque" | "Tarjeta";
  payee_name: string; // "Equipo propio" o el nombre del especialista
  concept: string;
  created_at?: string;
}

export interface NoteAttachment {
  name: string;
  url: string;
  type: "image" | "pdf" | "other";
  size?: number;
}

export interface ProjectNote {
  id: string;
  project_id: string;
  content: string;
  attachments: NoteAttachment[];
  created_at?: string;
  updated_at?: string;
}

// ─── Estimate ─────────────────────────────────────────────────────────────────

export interface DepositEntry {
  pct: number;
  label_en: string;
  label_es: string;
}

export interface EstimateSectionCatalog {
  id: string;
  name_en: string;
  name_es: string;
  note_en: string;
  note_es: string;
  is_material_type: boolean;
  sort_order: number;
}

export interface ProjectEstimateItem {
  id: string;
  section_id: string;
  item_catalog_id: string | null;
  description: string;
  amount: number;
  sort_order: number;
}

export interface ProjectEstimateSection {
  id: string;
  estimate_id: string;
  section_catalog_id: string | null;
  name_en: string;
  name_es: string;
  note: string;
  is_material_type: boolean;
  section_total: number;
  sort_order: number;
  items: ProjectEstimateItem[];
}

export interface ProjectEstimate {
  id: string;
  project_id: string;
  status: "draft" | "sent" | "approved" | "rejected";
  customer_name: string;
  city: string;
  email: string;
  phone: string;
  project_title: string;
  start_date: string;
  end_date: string;
  discount_label: string;
  discount_pct: number;
  deposit_schedule: DepositEntry[];
  notes: string;
  sections: ProjectEstimateSection[];
}
