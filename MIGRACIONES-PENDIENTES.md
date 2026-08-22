# Migraciones pendientes de Supabase

> Estado al **21 ago 2026**. Todo lo de aquí es **idempotente**: si algo ya existe, no
> pasa nada al volver a ejecutarlo. Se puede correr entero de arriba a abajo.

**Dónde ejecutarlo:** [SQL editor del proyecto](https://supabase.com/dashboard/project/sdbgsastykfrabndiftc/sql/new)
→ pegar → `Run`.

---

## Paso 1 — Ver qué falta de verdad

Antes de tocar nada, estas dos consultas dicen exactamente qué objetos le faltan a la
base. No modifican nada.

### Tablas

```sql
select t as tabla,
       case when to_regclass('public.' || t) is null then 'FALTA' else 'ok' end as estado
from unnest(array[
  'invoices','change_orders','project_objectives','project_photos','agenda_events',
  'push_subscriptions','device_tokens','prospects','site_content','voice_actions',
  'bookings','activity_log','project_estimates','estimate_sections','estimate_items'
]) as t
order by estado desc, tabla;
```

### Columnas

```sql
select x.tabla || '.' || x.columna as columna,
       case when exists (
         select 1 from information_schema.columns c
         where c.table_schema = 'public'
           and c.table_name  = x.tabla
           and c.column_name = x.columna
       ) then 'ok' else 'FALTA' end as estado
from (values
  ('change_orders','total_override'),
  ('estimate_items','cost'),
  ('estimate_items','profit'),
  ('estimate_sections','material_included'),
  ('project_estimates','customer_company'),
  ('project_estimates','customer_address'),
  ('project_estimates','customer_website'),
  ('payments','installment_idx'),
  ('payments','concept'),
  ('tasks','scheduled_date'),
  ('tasks','duration_days'),
  ('tasks','source'),
  ('tasks','source_key'),
  ('tasks','source_section'),
  ('tasks','amount'),
  ('tasks','estimate_item_id'),
  ('tasks','estimate_section_id'),
  ('project_photos','album'),
  ('project_photos','sort_order'),
  ('project_contacts','amount'),
  ('project_contacts','start_date'),
  ('project_contacts','end_date'),
  ('materials','quantity'),
  ('materials','unit'),
  ('materials','notes'),
  ('materials','purchase_date'),
  ('materials','estimate_item_id'),
  ('materials','estimate_section_id'),
  ('app_users','user_type'),
  ('app_users','contact_id'),
  ('app_users','tab_access'),
  ('app_users','my_tasks_only'),
  ('superadmin_config','name')
) as x(tabla, columna)
order by estado desc, columna;
```

Lo que salga **FALTA** es lo que hay que correr. Los pasos 2 a 4 cubren lo urgente;
el paso 5 cubre todo lo demás.

---

## Paso 2 — Histórico de facturas (`invoices`) · **requerido**

Sin esto, el módulo de Factura arma, imprime y envía por correo, pero **no guarda**
nada: no hay histórico, ni editar, ni eliminar, ni marcar cobrada. La app avisa con un
recuadro rojo en la lista de facturas.

```sql
CREATE TABLE IF NOT EXISTS invoices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invoice_no  TEXT NOT NULL DEFAULT '',
  inv_date    TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft',   -- 'draft' | 'sent' | 'paid'
  total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  lines       JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{ description, amount }]
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS invoices_project_idx ON invoices(project_id, created_at DESC);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_all ON invoices;
CREATE POLICY anon_all ON invoices FOR ALL TO anon USING (true) WITH CHECK (true);
```

---

## Paso 3 — Total manual de la orden de cambio · **opcional**

La orden de cambio ya funciona sin esto: cuando la columna no existe, el total manual
viaja como línea centinela dentro del JSONB `lines`. Correr la migración lo deja en su
columna propia (más limpio y consultable); las órdenes viejas se siguen leyendo igual.

> Los demás montos que se fijan a mano en la orden de cambio — **subtotales por grupo**
> y **cuotas actualizadas** — no necesitan ningún script: se guardan siempre como
> centinelas en ese mismo JSONB.

```sql
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS total_override NUMERIC(12,2);
```

Si la tabla `change_orders` saliera como **FALTA** en el paso 1, primero:

```sql
CREATE TABLE IF NOT EXISTS change_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  order_no        TEXT NOT NULL DEFAULT '',
  co_date         TEXT NOT NULL DEFAULT '',
  reason          TEXT NOT NULL DEFAULT '',
  extra_days      INT NOT NULL DEFAULT 0,
  prior_contract  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_override  NUMERIC(12,2),
  add_to_last     BOOLEAN NOT NULL DEFAULT true,
  detail_mode     TEXT NOT NULL DEFAULT 'full',    -- 'full' | 'summary'
  status          TEXT NOT NULL DEFAULT 'draft',   -- 'draft' | 'sent'
  lines           JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS change_orders_project_idx ON change_orders(project_id, created_at DESC);
ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_all ON change_orders;
CREATE POLICY anon_all ON change_orders FOR ALL TO anon USING (true) WITH CHECK (true);
```

---

## Paso 4 — PINes hasheados (Fase 1 de seguridad) · **requerido**

Hoy los PINes están en claro en la base. Estas dos columnas permiten guardarlos
con **scrypt**. La migración es transparente: en el **primer inicio de sesión** de
cada persona con su PIN de siempre, la app guarda el hash y vacía el PIN en claro.
Nadie tiene que cambiar su PIN ni se queda fuera.

```sql
ALTER TABLE superadmin_config ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE app_users         ADD COLUMN IF NOT EXISTS pin_hash TEXT;
```

Después de que cada persona haya entrado una vez, esta consulta muestra quién
falta por migrar:

```sql
select 'superadmin' as quien,
       coalesce(pin, '') <> '' as pin_en_claro,
       pin_hash is not null    as hasheado
from superadmin_config
union all
select name, coalesce(pin, '') <> '', pin_hash is not null
from app_users
order by pin_en_claro desc;
```

Cuando **ninguna fila** tenga `pin_en_claro = true`, la migración terminó. Si
alguien no entra en semanas y quieres cerrar ya, basta con reasignarle el PIN
desde el panel (Equipo → editar): al guardarlo, el servidor lo escribe hasheado.

> **Sube la longitud del PIN a 6 dígitos o más.** El hash encarece cada intento
> (~35 ms), pero un PIN de 4 dígitos son sólo 10.000 combinaciones: unos 6 minutos
> de CPU si alguien se llevara la base. Con 6 dígitos son ~10 horas; con 8, ~44 días.

---

## Paso 5 — Red de seguridad (solo lo que el paso 1 marcó FALTA)

Bloque idempotente con todas las columnas que la app espera. Correrlo completo es
seguro aunque ya existan todas.

```sql
-- Estimate: 3 columnas de monto por item y datos del cliente
ALTER TABLE estimate_items    ADD COLUMN IF NOT EXISTS cost   NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE estimate_items    ADD COLUMN IF NOT EXISTS profit NUMERIC(12,2) NOT NULL DEFAULT 0;
UPDATE estimate_items SET cost = amount WHERE cost = 0 AND profit = 0 AND amount > 0;
ALTER TABLE estimate_sections ADD COLUMN IF NOT EXISTS material_included BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE project_estimates ADD COLUMN IF NOT EXISTS customer_company TEXT;
ALTER TABLE project_estimates ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE project_estimates ADD COLUMN IF NOT EXISTS customer_website TEXT;

-- Pagos por cuota del calendario
ALTER TABLE payments ADD COLUMN IF NOT EXISTS installment_idx INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS concept TEXT NOT NULL DEFAULT '';

-- Day Planner / Gantt
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_key TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_section TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS duration_days INT NOT NULL DEFAULT 1;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimate_item_id    UUID REFERENCES estimate_items(id)    ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimate_section_id UUID REFERENCES estimate_sections(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tasks_project_source_key_idx
  ON tasks(project_id, source_key) WHERE source_key IS NOT NULL;

-- Fotos de obra
ALTER TABLE project_photos ADD COLUMN IF NOT EXISTS album TEXT;
ALTER TABLE project_photos ADD COLUMN IF NOT EXISTS sort_order INT;

-- Materiales importados del Estimate
ALTER TABLE materials ADD COLUMN IF NOT EXISTS quantity       NUMERIC(10,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS unit           TEXT;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS notes          TEXT;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS purchase_date  DATE;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS estimate_item_id    UUID REFERENCES estimate_items(id)    ON DELETE SET NULL;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS estimate_section_id UUID REFERENCES estimate_sections(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS materials_project_estimate_item_idx
  ON materials(project_id, estimate_item_id) WHERE estimate_item_id IS NOT NULL;

-- Equipo: asignación con monto y fechas
ALTER TABLE project_contacts ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE project_contacts ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE project_contacts ADD COLUMN IF NOT EXISTS end_date   DATE;

-- Usuarios y permisos
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS user_type     TEXT NOT NULL DEFAULT 'coworker';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS contact_id    UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS tab_access    JSONB;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS my_tasks_only BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE superadmin_config ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Admin';

-- Estados de proyecto (el CHECK viejo no admite 'prospecto')
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('prospecto','presupuesto','aprobado','en_obra','terminado'));
ALTER TABLE projects ALTER COLUMN status SET DEFAULT 'prospecto';
```

Si el paso 1 marcó **FALTA** alguna de las tablas de la lista (`project_objectives`,
`agenda_events`, `push_subscriptions`, `device_tokens`, `prospects`, `site_content`,
`voice_actions`, `bookings`, `activity_log`), el `CREATE TABLE` de cada una está en
`src/lib/schema.sql`, que es el esquema completo y también es idempotente.

---

## Paso 6 — Comprobar que quedó

1. Volver a correr las dos consultas del **paso 1**: no debe quedar ningún `FALTA`.
2. En la app (recargar con ⇧+Cmd+R primero):
   - **Estimate → Factura** → *Nueva factura* → **Guardar** → debe aparecer en la lista
     con su nº, total y estado *Borrador*. Probar ✓ *marcar cobrada* y 🗑 *eliminar*.
   - **Estimate → Change Order** → *Fijar total* → **Guardar** → cerrar y volver a abrir:
     el total manual tiene que seguir ahí.

---

## Qué pasa mientras tanto (sin correr nada)

| Función | Sin migración |
|---|---|
| Factura: armar, montos editables, vista previa, PDF, correo | ✅ funciona |
| Factura: histórico, editar, eliminar, marcar cobrada | ❌ no guarda (avisa en la lista) |
| Orden de cambio: todo, incluido el total manual | ✅ funciona (el total viaja en el JSONB) |
| Orden de cambio: `total_override` en su columna | ⚠️ usa el respaldo |
| PINes guardados con hash | ❌ siguen en claro hasta correr el paso 4 |
| Estimate, calendario de pagos, PDFs | ✅ sin cambios |
