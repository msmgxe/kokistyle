export interface SectionPermissions {
  view:   boolean;
  create: boolean;
  edit:   boolean;
  delete: boolean;
}

export interface Permissions {
  workflow:    SectionPermissions;
  materiales:  SectionPermissions;
  contactos:   SectionPermissions;
  presupuesto: SectionPermissions;
  pagos:       SectionPermissions;
  notas:       SectionPermissions;
}

export type PermissionSection = keyof Permissions;
export type PermissionAction  = keyof SectionPermissions;
export type UserType          = "coworker" | "client";

export interface AppUser {
  id:             string;
  name:           string;
  pin:            string;
  role:           "superadmin" | "colaborador";
  user_type:      UserType;
  contact_id:     string | null;
  tab_access:     string[] | null;
  my_tasks_only:  boolean;
  permissions:    Permissions;
  active:         boolean;
  created_at?:    string;
}

export const DEFAULT_PERMISSIONS: Permissions = {
  workflow:    { view: true,  create: false, edit: false, delete: false },
  materiales:  { view: true,  create: false, edit: false, delete: false },
  contactos:   { view: true,  create: false, edit: false, delete: false },
  presupuesto: { view: false, create: false, edit: false, delete: false },
  pagos:       { view: false, create: false, edit: false, delete: false },
  notas:       { view: true,  create: true,  edit: false, delete: false },
};

export const FULL_PERMISSIONS: Permissions = {
  workflow:    { view: true, create: true, edit: true, delete: true },
  materiales:  { view: true, create: true, edit: true, delete: true },
  contactos:   { view: true, create: true, edit: true, delete: true },
  presupuesto: { view: true, create: true, edit: true, delete: true },
  pagos:       { view: true, create: true, edit: true, delete: true },
  notas:       { view: true, create: true, edit: true, delete: true },
};

export const DEFAULT_CLIENT_PERMISSIONS: Permissions = {
  workflow:    { view: true,  create: false, edit: false, delete: false },
  materiales:  { view: false, create: false, edit: false, delete: false },
  contactos:   { view: false, create: false, edit: false, delete: false },
  presupuesto: { view: true,  create: false, edit: false, delete: false },
  pagos:       { view: false, create: false, edit: false, delete: false },
  notas:       { view: true,  create: false, edit: false, delete: false },
};

export const DEFAULT_COWORKER_TAB_ACCESS: string[] = ["planner", "notas"];
export const DEFAULT_CLIENT_TAB_ACCESS:   string[] = ["presupuesto", "plan", "notas", "design"];

export const TAB_ACCESS_OPTIONS: { id: string; label: string; coworker: boolean; client: boolean }[] = [
  { id: "presupuesto", label: "Estimate",    coworker: false, client: true  },
  { id: "pagos",       label: "Cash Flow",   coworker: false, client: false },
  { id: "planner",     label: "Day Planner", coworker: true,  client: false },
  { id: "plan",        label: "Gantt",        coworker: true,  client: true  },
  { id: "materiales",  label: "Materials",    coworker: false, client: false },
  { id: "contactos",   label: "Contacts",     coworker: false, client: false },
  { id: "fotos",       label: "Photos",       coworker: true,  client: true  },
  { id: "notas",       label: "Notes",        coworker: true,  client: true  },
  { id: "design",      label: "Design",       coworker: false, client: true  },
];

// "workflow" sigue como sección de permisos: gatea Day Planner, Gantt y Design (el tab Workflow ya no existe)
export const SECTION_LABELS: Record<PermissionSection, string> = {
  workflow:    "Tasks (Planner/Gantt)",
  materiales:  "Materials",
  contactos:   "Contacts",
  presupuesto: "Estimate",
  pagos:       "Cash Flow",
  notas:       "Notes",
};
