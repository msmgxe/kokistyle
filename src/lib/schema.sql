-- 1. Tabla de Usuarios / Administradores
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  nombre TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member'))
);

-- 2. Tabla de Proyectos
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  client TEXT NOT NULL,
  address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'presupuesto' CHECK (status IN ('presupuesto', 'aprobado', 'en_obra', 'terminado')),
  budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- Migration: run if upgrading from older schema
-- ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_date DATE;
-- ALTER TABLE projects ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 3. Tabla de Contactos (Especialistas / Proveedores)
CREATE TABLE IF NOT EXISTS contacts (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name      TEXT NOT NULL,
  specialty TEXT NOT NULL DEFAULT '',
  phone     TEXT NOT NULL DEFAULT '',
  rate      TEXT NOT NULL DEFAULT '',
  type      TEXT NOT NULL DEFAULT 'coworker',
  rate_type TEXT NOT NULL DEFAULT 'hour',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- MIGRATION: Add type and rate_type to contacts
-- Run this in Supabase SQL Editor if contacts table already exists:
-- ALTER TABLE contacts ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'coworker';
-- ALTER TABLE contacts ADD COLUMN IF NOT EXISTS rate_type TEXT NOT NULL DEFAULT 'hour';

-- 4. Tabla de Relación Proyectos-Contactos (Muchos a Muchos)
CREATE TABLE IF NOT EXISTS project_contacts (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, contact_id)
);

-- 5. Tabla de Actividades (Tareas del Gantt / Kanban)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  hours INTEGER NOT NULL DEFAULT 0,
  duration_weeks INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pend' CHECK (status IN ('pend', 'prog', 'done')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  assigned_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  scheduled_date DATE,
  source TEXT NOT NULL DEFAULT 'manual',
  source_key TEXT,
  source_section TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_key TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_section TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- 6. Tabla de Líneas de Presupuesto
CREATE TABLE IF NOT EXISTS budget_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('mano', 'material')),
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Tabla de Materiales
CREATE TABLE IF NOT EXISTS materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  supplier TEXT NOT NULL DEFAULT '',
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  bought BOOLEAN NOT NULL DEFAULT FALSE,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  purchase_date DATE,
  estimate_item_id UUID REFERENCES estimate_items(id) ON DELETE SET NULL,
  estimate_section_id UUID REFERENCES estimate_sections(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- Unique: one material per estimate item per project
CREATE UNIQUE INDEX IF NOT EXISTS materials_project_estimate_item_idx
  ON materials(project_id, estimate_item_id)
  WHERE estimate_item_id IS NOT NULL;
-- Migration: run if upgrading from older schema
-- ALTER TABLE materials ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2) NOT NULL DEFAULT 1;
-- ALTER TABLE materials ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT '';
-- ALTER TABLE materials ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
-- ALTER TABLE materials ADD COLUMN IF NOT EXISTS purchase_date DATE;
-- ALTER TABLE materials ADD COLUMN IF NOT EXISTS estimate_item_id UUID REFERENCES estimate_items(id) ON DELETE SET NULL;
-- ALTER TABLE materials ADD COLUMN IF NOT EXISTS estimate_section_id UUID REFERENCES estimate_sections(id) ON DELETE SET NULL;

-- 8. Tabla de Ingresos (Pagos recibidos del cliente)
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT NOT NULL CHECK (method IN ('Efectivo', 'Transferencia', 'Zelle', 'Cheque', 'Tarjeta')),
  type TEXT NOT NULL CHECK (type IN ('abono', 'anticipo', 'final')),
  concept TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- Migration: run if upgrading from older schema
-- ALTER TABLE payments ADD COLUMN IF NOT EXISTS concept TEXT NOT NULL DEFAULT '';

-- 9b. Notas de proyecto con adjuntos (imágenes, PDFs)
-- SETUP REQUERIDO en Supabase:
--   1. Ejecuta este SQL en el editor de Supabase
--   2. Ve a Storage → Crear bucket "kokistyle-files" → marcar como PUBLIC
--   3. En bucket settings activa "Public bucket" para acceso sin auth
CREATE TABLE IF NOT EXISTS project_notes (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  content      TEXT NOT NULL DEFAULT '',
  attachments  JSONB DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 9. Tabla de Egresos (Pagos a especialistas o proveedores)
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT NOT NULL CHECK (method IN ('Efectivo', 'Transferencia', 'Zelle', 'Cheque', 'Tarjeta')),
  payee_name TEXT NOT NULL,
  concept TEXT NOT NULL,
  material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- Migration: run if upgrading from older schema
-- ALTER TABLE expenses ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES materials(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Estimate module (Luxaris Design — Card Accordion)
-- ─────────────────────────────────────────────────────────────────────────────

-- Catálogo de secciones (mantenido por superadmin)
CREATE TABLE IF NOT EXISTS estimate_section_catalog (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name_en         TEXT NOT NULL,
  name_es         TEXT NOT NULL,
  note_en         TEXT NOT NULL DEFAULT '',
  note_es         TEXT NOT NULL DEFAULT '',
  is_material_type BOOLEAN NOT NULL DEFAULT false,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Catálogo de items por sección (mantenido por superadmin)
CREATE TABLE IF NOT EXISTS estimate_item_catalog (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_catalog_id   UUID REFERENCES estimate_section_catalog(id) ON DELETE CASCADE NOT NULL,
  description_en       TEXT NOT NULL,
  description_es       TEXT NOT NULL,
  default_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Estimado por proyecto (uno por proyecto)
CREATE TABLE IF NOT EXISTS project_estimates (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id       UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL UNIQUE,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','approved','rejected')),
  customer_name    TEXT NOT NULL DEFAULT '',
  city             TEXT NOT NULL DEFAULT '',
  email            TEXT NOT NULL DEFAULT '',
  phone            TEXT NOT NULL DEFAULT '',
  project_title    TEXT NOT NULL DEFAULT '',
  start_date       DATE,
  end_date         DATE,
  discount_label   TEXT NOT NULL DEFAULT 'DISCOUNT',
  discount_pct     NUMERIC(5,2) NOT NULL DEFAULT 0,
  deposit_schedule JSONB NOT NULL DEFAULT '[{"pct":50,"label_en":"AT SIGN CONTRACT","label_es":"AL FIRMAR CONTRATO"},{"pct":25,"label_en":"WHEN TILE IS COMPLETE","label_es":"CUANDO EL TILE ESTÉ COMPLETO"},{"pct":25,"label_en":"WHEN CUSTOMER SATISFIED","label_es":"CUANDO EL CLIENTE ESTÉ SATISFECHO"}]',
  notes            TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Secciones del estimado (DEMOLITION, PLUMBING, etc.)
CREATE TABLE IF NOT EXISTS estimate_sections (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id         UUID REFERENCES project_estimates(id) ON DELETE CASCADE NOT NULL,
  section_catalog_id  UUID REFERENCES estimate_section_catalog(id) ON DELETE SET NULL,
  name_en             TEXT NOT NULL,
  name_es             TEXT NOT NULL,
  note                TEXT NOT NULL DEFAULT '',
  is_material_type    BOOLEAN NOT NULL DEFAULT false,
  material_included   BOOLEAN NOT NULL DEFAULT false,
  section_total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Items de cada sección
CREATE TABLE IF NOT EXISTS estimate_items (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id       UUID REFERENCES estimate_sections(id) ON DELETE CASCADE NOT NULL,
  item_catalog_id  UUID REFERENCES estimate_item_catalog(id) ON DELETE SET NULL,
  description      TEXT NOT NULL,
  amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Estimate → Workflow traceability. These ALTERs live after the Estimate tables
-- so the schema can run cleanly on a fresh Supabase project.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimate_item_id UUID REFERENCES estimate_items(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimate_section_id UUID REFERENCES estimate_sections(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tasks_project_source_key_idx
  ON tasks(project_id, source_key)
  WHERE source_key IS NOT NULL;

-- RLS: acceso anon igual que resto de tablas
ALTER TABLE estimate_section_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_item_catalog    ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_estimates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_sections        ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items           ENABLE ROW LEVEL SECURITY;

CREATE POLICY anon_all ON estimate_section_catalog FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_all ON estimate_item_catalog    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_all ON project_estimates        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_all ON estimate_sections        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_all ON estimate_items           FOR ALL TO anon USING (true) WITH CHECK (true);

-- Datos iniciales del catálogo (secciones típicas de Luxaris Design)
INSERT INTO estimate_section_catalog (name_en, name_es, note_en, note_es, is_material_type, sort_order) VALUES
  ('DEMOLITION',               'DEMOLICIÓN',               'Dumping included',   'Acarreo incluido',   false, 10),
  ('PLUMBING',                 'PLOMERÍA',                 'Material included',  'Material incluido',  false, 20),
  ('STRUCTURE',                'ESTRUCTURA',               'Material included',  'Material incluido',  false, 30),
  ('ELECTRICAL',               'ELÉCTRICO',                'Material included',  'Material incluido',  false, 40),
  ('TILE INSTALLATION',        'INSTALACIÓN DE TILE',      '',                   '',                   false, 50),
  ('HANDY WORK',               'TRABAJO MANUAL',           '',                   '',                   false, 60),
  ('PAINTING',                 'PINTURA',                  '',                   '',                   false, 70),
  ('PERMIT AND ADMINISTRATIVES','PERMISOS Y ADMINISTRATIVOS','',                 '',                   false, 80),
  ('MATERIALS',                'MATERIALES',               'Pure materials',     'Solo materiales',    true,  90)
ON CONFLICT DO NOTHING;

-- ── Superadmin display name ──────────────────────────────────────────────────
-- Migration: run once if upgrading (superadmin_config must already exist)
-- ALTER TABLE superadmin_config ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Admin';

-- ── Activity Log ─────────────────────────────────────────────────────────────
-- Migration: run once
CREATE TABLE IF NOT EXISTS activity_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT,
  user_name    TEXT,
  user_role    TEXT,
  action       TEXT NOT NULL,
  entity_type  TEXT,
  entity_id    TEXT,
  entity_name  TEXT,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  project_name TEXT,
  details      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_all ON activity_log FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Voice Actions Audit Log ──────────────────────────────────────────────────
-- Migration: run once if upgrading
CREATE TABLE IF NOT EXISTS voice_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_label  TEXT,
  transcript  TEXT NOT NULL,
  action      TEXT,
  action_data JSONB,
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  outcome     TEXT NOT NULL DEFAULT 'pending',
  error_msg   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE voice_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_all ON voice_actions FOR ALL TO anon USING (true) WITH CHECK (true);
