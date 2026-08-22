-- ══════════════════════════════════════════════════════════════════════════
-- FASE 2 · PASO 3A — Primer apretón: el dinero y los documentos internos
-- ══════════════════════════════════════════════════════════════════════════
-- Requisitos: pasos 1, 1B y 1C corridos, y el panel funcionando con el token
-- (SUPABASE_JWT_SECRET puesto en Vercel).
--
-- Estas cinco tablas sólo las usan pantallas del superadmin, así que son las
-- primeras que se pueden cerrar sin afectar a nadie más:
--   expenses, budget_items   → sólo Cash Flow (no está en el acceso de nadie más)
--   invoices, change_orders  → sólo el Estimate, y sus botones ya están ocultos
--                              para quien no sea superadmin
--   agenda_events            → la vista Hoy ya los pide sólo si eres superadmin
--
-- Al terminar, un colaborador o un cliente que consulte estas tablas desde el
-- navegador recibe cero filas, aunque llame a Supabase directamente.

-- ── Helpers: la identidad sale del token, no de lo que diga el cliente ──────
CREATE OR REPLACE FUNCTION lux_role() RETURNS text
  LANGUAGE sql STABLE AS $$
  SELECT coalesce(auth.jwt() ->> 'lux_role', 'none')
$$;

CREATE OR REPLACE FUNCTION lux_is_admin() RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT lux_role() = 'superadmin'
$$;

-- Para los siguientes lotes: ¿este proyecto está en mi lista?
CREATE OR REPLACE FUNCTION lux_can_see(p uuid) RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT lux_is_admin()
      OR p::text IN (
           SELECT jsonb_array_elements_text(coalesce(auth.jwt() -> 'lux_projects', '[]'::jsonb))
         )
$$;

-- ── El apretón ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS lux_auth_all ON expenses;
CREATE POLICY lux_admin_only ON expenses FOR ALL TO authenticated
  USING (lux_is_admin()) WITH CHECK (lux_is_admin());

DROP POLICY IF EXISTS lux_auth_all ON budget_items;
CREATE POLICY lux_admin_only ON budget_items FOR ALL TO authenticated
  USING (lux_is_admin()) WITH CHECK (lux_is_admin());

DROP POLICY IF EXISTS lux_auth_all ON invoices;
CREATE POLICY lux_admin_only ON invoices FOR ALL TO authenticated
  USING (lux_is_admin()) WITH CHECK (lux_is_admin());

DROP POLICY IF EXISTS lux_auth_all ON change_orders;
CREATE POLICY lux_admin_only ON change_orders FOR ALL TO authenticated
  USING (lux_is_admin()) WITH CHECK (lux_is_admin());

DROP POLICY IF EXISTS lux_auth_all ON agenda_events;
CREATE POLICY lux_admin_only ON agenda_events FOR ALL TO authenticated
  USING (lux_is_admin()) WITH CHECK (lux_is_admin());

-- ── Comprobación ───────────────────────────────────────────────────────────
-- Las cinco deben aparecer con la política lux_admin_only para authenticated.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('expenses','budget_items','invoices','change_orders','agenda_events')
order by tablename, policyname;

-- Y esto debe devolver 'superadmin' cuando lo corres tú desde el panel; en el
-- editor SQL (que usa la service role) devuelve 'none', y es lo esperado.
select lux_role() as rol_del_token;

-- ══════════════════════════════════════════════════════════════════════════
-- MARCHA ATRÁS — si algo se rompe, esto devuelve el permiso amplio al instante
-- ══════════════════════════════════════════════════════════════════════════
-- DROP POLICY IF EXISTS lux_admin_only ON expenses;
-- CREATE POLICY lux_auth_all ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- DROP POLICY IF EXISTS lux_admin_only ON budget_items;
-- CREATE POLICY lux_auth_all ON budget_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- DROP POLICY IF EXISTS lux_admin_only ON invoices;
-- CREATE POLICY lux_auth_all ON invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- DROP POLICY IF EXISTS lux_admin_only ON change_orders;
-- CREATE POLICY lux_auth_all ON change_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- DROP POLICY IF EXISTS lux_admin_only ON agenda_events;
-- CREATE POLICY lux_auth_all ON agenda_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
