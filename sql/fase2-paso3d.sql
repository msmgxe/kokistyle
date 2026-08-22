-- ══════════════════════════════════════════════════════════════════════════
-- FASE 2 · PASO 3D — Materiales, contactos y el estimado
-- ══════════════════════════════════════════════════════════════════════════
-- Requisito: paso 3C corrido y verificado.
--
--   materials        → sólo tú (el tab Materials no está en el acceso de nadie más)
--   contacts         → todos leen (la vista Hoy los necesita), sólo tú escribes
--   estimate_*       → los del proyecto LEEN, sólo tú escribes
--
-- Lo que cierra este paso: hoy un cliente con el tab Estimate puede EDITAR tu
-- estimado (añadir secciones, cambiar montos). A partir de aquí, no.

-- ── materials ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS lux_auth_all ON materials;
DROP POLICY IF EXISTS lux_admin_only ON materials;
CREATE POLICY lux_admin_only ON materials FOR ALL TO authenticated
  USING (lux_is_admin()) WITH CHECK (lux_is_admin());

-- ── contacts: la cuadrilla necesita los nombres en la vista Hoy ────────────
DROP POLICY IF EXISTS lux_auth_all ON contacts;
DROP POLICY IF EXISTS lux_contacts_read ON contacts;
CREATE POLICY lux_contacts_read ON contacts FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS lux_contacts_write ON contacts;
CREATE POLICY lux_contacts_write ON contacts FOR INSERT TO authenticated
  WITH CHECK (lux_is_admin());
DROP POLICY IF EXISTS lux_contacts_update ON contacts;
CREATE POLICY lux_contacts_update ON contacts FOR UPDATE TO authenticated
  USING (lux_is_admin()) WITH CHECK (lux_is_admin());
DROP POLICY IF EXISTS lux_contacts_delete ON contacts;
CREATE POLICY lux_contacts_delete ON contacts FOR DELETE TO authenticated
  USING (lux_is_admin());

-- ── El estimado: se lee, no se toca ────────────────────────────────────────
DROP POLICY IF EXISTS lux_auth_all ON project_estimates;
DROP POLICY IF EXISTS lux_est_read ON project_estimates;
CREATE POLICY lux_est_read ON project_estimates FOR SELECT TO authenticated
  USING (lux_can_see(project_id));
DROP POLICY IF EXISTS lux_est_insert ON project_estimates;
CREATE POLICY lux_est_insert ON project_estimates FOR INSERT TO authenticated
  WITH CHECK (lux_is_admin());
DROP POLICY IF EXISTS lux_est_update ON project_estimates;
CREATE POLICY lux_est_update ON project_estimates FOR UPDATE TO authenticated
  USING (lux_is_admin()) WITH CHECK (lux_is_admin());
DROP POLICY IF EXISTS lux_est_delete ON project_estimates;
CREATE POLICY lux_est_delete ON project_estimates FOR DELETE TO authenticated
  USING (lux_is_admin());

-- secciones e items cuelgan del estimado: se resuelve el proyecto por la cadena
DROP POLICY IF EXISTS lux_auth_all ON estimate_sections;
DROP POLICY IF EXISTS lux_sec_read ON estimate_sections;
CREATE POLICY lux_sec_read ON estimate_sections FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM project_estimates e
    WHERE e.id = estimate_sections.estimate_id AND lux_can_see(e.project_id)
  ));
DROP POLICY IF EXISTS lux_sec_insert ON estimate_sections;
CREATE POLICY lux_sec_insert ON estimate_sections FOR INSERT TO authenticated
  WITH CHECK (lux_is_admin());
DROP POLICY IF EXISTS lux_sec_update ON estimate_sections;
CREATE POLICY lux_sec_update ON estimate_sections FOR UPDATE TO authenticated
  USING (lux_is_admin()) WITH CHECK (lux_is_admin());
DROP POLICY IF EXISTS lux_sec_delete ON estimate_sections;
CREATE POLICY lux_sec_delete ON estimate_sections FOR DELETE TO authenticated
  USING (lux_is_admin());

DROP POLICY IF EXISTS lux_auth_all ON estimate_items;
DROP POLICY IF EXISTS lux_item_read ON estimate_items;
CREATE POLICY lux_item_read ON estimate_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM estimate_sections s
    JOIN project_estimates e ON e.id = s.estimate_id
    WHERE s.id = estimate_items.section_id AND lux_can_see(e.project_id)
  ));
DROP POLICY IF EXISTS lux_item_insert ON estimate_items;
CREATE POLICY lux_item_insert ON estimate_items FOR INSERT TO authenticated
  WITH CHECK (lux_is_admin());
DROP POLICY IF EXISTS lux_item_update ON estimate_items;
CREATE POLICY lux_item_update ON estimate_items FOR UPDATE TO authenticated
  USING (lux_is_admin()) WITH CHECK (lux_is_admin());
DROP POLICY IF EXISTS lux_item_delete ON estimate_items;
CREATE POLICY lux_item_delete ON estimate_items FOR DELETE TO authenticated
  USING (lux_is_admin());

-- ── Los catálogos son plantillas compartidas: se leen, sólo tú los amplías ──
DROP POLICY IF EXISTS lux_auth_all ON estimate_section_catalog;
DROP POLICY IF EXISTS lux_cat_sec_read ON estimate_section_catalog;
CREATE POLICY lux_cat_sec_read ON estimate_section_catalog FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS lux_cat_sec_write ON estimate_section_catalog;
CREATE POLICY lux_cat_sec_write ON estimate_section_catalog FOR ALL TO authenticated
  USING (lux_is_admin()) WITH CHECK (lux_is_admin());

DROP POLICY IF EXISTS lux_auth_all ON estimate_item_catalog;
DROP POLICY IF EXISTS lux_cat_item_read ON estimate_item_catalog;
CREATE POLICY lux_cat_item_read ON estimate_item_catalog FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS lux_cat_item_write ON estimate_item_catalog;
CREATE POLICY lux_cat_item_write ON estimate_item_catalog FOR ALL TO authenticated
  USING (lux_is_admin()) WITH CHECK (lux_is_admin());

-- ── Comprobación ───────────────────────────────────────────────────────────
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('materials','contacts','project_estimates','estimate_sections',
                    'estimate_items','estimate_section_catalog','estimate_item_catalog')
order by tablename, cmd, policyname;

-- ══════════════════════════════════════════════════════════════════════════
-- MARCHA ATRÁS
-- ══════════════════════════════════════════════════════════════════════════
-- DO $$
-- DECLARE t text; p text;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY['materials','contacts','project_estimates','estimate_sections',
--                            'estimate_items','estimate_section_catalog','estimate_item_catalog'] LOOP
--     FOR p IN SELECT policyname FROM pg_policies
--              WHERE schemaname='public' AND tablename=t AND 'authenticated' = ANY(roles) LOOP
--       EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p, t);
--     END LOOP;
--     EXECUTE format('CREATE POLICY lux_auth_all ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
--   END LOOP;
-- END $$;
