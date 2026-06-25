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
  created_at?: string;
  projects?: string[]; // Para simplificar la asignación en la UI
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
