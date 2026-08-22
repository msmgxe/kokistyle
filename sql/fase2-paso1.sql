-- ══════════════════════════════════════════════════════════════════════════
-- FASE 2 · PASO 1 — Espejo de las políticas actuales para el rol `authenticated`
-- ══════════════════════════════════════════════════════════════════════════
-- No cambia ningún permiso: sólo prepara el terreno para que el navegador pueda
-- empezar a hablar como `authenticated` sin que se apague nada. Idempotente.

DROP POLICY IF EXISTS lux_auth_all ON activity_log;
CREATE POLICY lux_auth_all ON activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON agenda_events;
CREATE POLICY lux_auth_all ON agenda_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON bookings;
CREATE POLICY lux_auth_all ON bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON change_orders;
CREATE POLICY lux_auth_all ON change_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON estimate_item_catalog;
CREATE POLICY lux_auth_all ON estimate_item_catalog FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON estimate_items;
CREATE POLICY lux_auth_all ON estimate_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON estimate_section_catalog;
CREATE POLICY lux_auth_all ON estimate_section_catalog FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON estimate_sections;
CREATE POLICY lux_auth_all ON estimate_sections FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON invoices;
CREATE POLICY lux_auth_all ON invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON project_estimates;
CREATE POLICY lux_auth_all ON project_estimates FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON project_objectives;
CREATE POLICY lux_auth_all ON project_objectives FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON project_photos;
CREATE POLICY lux_auth_all ON project_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON push_subscriptions;
CREATE POLICY lux_auth_all ON push_subscriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON voice_actions;
CREATE POLICY lux_auth_all ON voice_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON voice_prefs;
CREATE POLICY lux_auth_all ON voice_prefs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Comprobación: cada tabla con RLS debe tener ahora su política `authenticated`.
select tablename, count(*) filter (where 'anon' = any(roles))          as anon,
       count(*) filter (where 'authenticated' = any(roles))            as authenticated
from pg_policies where schemaname = 'public'
group by tablename order by authenticated, tablename;
