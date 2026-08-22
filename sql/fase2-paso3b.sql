-- ══════════════════════════════════════════════════════════════════════════
-- FASE 2 · PASO 3B — Pagos del cliente y asignaciones del equipo
-- ══════════════════════════════════════════════════════════════════════════
-- Requisito: paso 3A corrido y verificado.
--
--   payments          → tú escribes; el cliente sólo LEE los de su obra
--   project_contacts  → sólo tú (guarda cuánto cobra cada especialista)
--   + vista sin montos para que el Day Planner de la cuadrilla siga funcionando

-- ── payments: una política por comando ─────────────────────────────────────
-- Importante: una sola política FOR ALL con USING permisivo también autoriza
-- DELETE. El cliente debe poder ver sus pagos, nunca borrarlos.
DROP POLICY IF EXISTS lux_auth_all ON payments;

DROP POLICY IF EXISTS lux_payments_read ON payments;
CREATE POLICY lux_payments_read ON payments FOR SELECT TO authenticated
  USING (lux_is_admin() OR (lux_role() = 'client' AND lux_can_see(project_id)));

DROP POLICY IF EXISTS lux_payments_insert ON payments;
CREATE POLICY lux_payments_insert ON payments FOR INSERT TO authenticated
  WITH CHECK (lux_is_admin());

DROP POLICY IF EXISTS lux_payments_update ON payments;
CREATE POLICY lux_payments_update ON payments FOR UPDATE TO authenticated
  USING (lux_is_admin()) WITH CHECK (lux_is_admin());

DROP POLICY IF EXISTS lux_payments_delete ON payments;
CREATE POLICY lux_payments_delete ON payments FOR DELETE TO authenticated
  USING (lux_is_admin());

-- ── project_contacts: lleva el monto asignado a cada especialista ──────────
DROP POLICY IF EXISTS lux_auth_all ON project_contacts;
DROP POLICY IF EXISTS lux_admin_only ON project_contacts;
CREATE POLICY lux_admin_only ON project_contacts FOR ALL TO authenticated
  USING (lux_is_admin()) WITH CHECK (lux_is_admin());

-- ── Vista para el Day Planner: quién está asignado, sin cuánto cobra ───────
-- La vista se ejecuta con los permisos de su dueño (no aplica el RLS de la
-- tabla base), así que la autorización va explícita en el WHERE: sólo filas de
-- proyectos que el token permite ver. Trae el nombre ya resuelto porque los
-- embeds de PostgREST no funcionan sobre vistas.
DROP VIEW IF EXISTS project_contacts_public;
CREATE VIEW project_contacts_public AS
  SELECT pc.project_id,
         pc.contact_id,
         c.name,
         c.specialty
  FROM project_contacts pc
  JOIN contacts c ON c.id = pc.contact_id
  WHERE lux_can_see(pc.project_id);

REVOKE ALL ON project_contacts_public FROM anon;
GRANT SELECT ON project_contacts_public TO authenticated;

-- ── Comprobación ───────────────────────────────────────────────────────────
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename in ('payments','project_contacts')
order by tablename, policyname;

-- La vista existe y sólo `authenticated` puede leerla.
select table_name, privilege_type, grantee
from information_schema.role_table_grants
where table_name = 'project_contacts_public'
order by grantee;

-- ══════════════════════════════════════════════════════════════════════════
-- MARCHA ATRÁS
-- ══════════════════════════════════════════════════════════════════════════
-- DROP POLICY IF EXISTS lux_payments_read   ON payments;
-- DROP POLICY IF EXISTS lux_payments_insert ON payments;
-- DROP POLICY IF EXISTS lux_payments_update ON payments;
-- DROP POLICY IF EXISTS lux_payments_delete ON payments;
-- CREATE POLICY lux_auth_all ON payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- DROP POLICY IF EXISTS lux_admin_only ON project_contacts;
-- CREATE POLICY lux_auth_all ON project_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
