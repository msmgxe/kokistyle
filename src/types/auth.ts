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

export interface AppUser {
  id:          string;
  name:        string;
  pin:         string;
  role:        "superadmin" | "colaborador";
  permissions: Permissions;
  active:      boolean;
  created_at?: string;
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

export const SECTION_LABELS: Record<PermissionSection, string> = {
  workflow:    "Flujo de trabajo",
  materiales:  "Materiales",
  contactos:   "Contactos",
  presupuesto: "Presupuesto",
  pagos:       "Pagos / Egresos",
  notas:       "Notas",
};
