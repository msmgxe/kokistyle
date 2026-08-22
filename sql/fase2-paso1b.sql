-- ══════════════════════════════════════════════════════════════════════════
-- FASE 2 · PASO 1B — Las 12 tablas que faltaban en el espejo
-- ══════════════════════════════════════════════════════════════════════════
-- El paso 1 se generó desde schema.sql, pero estas políticas se crearon en el
-- dashboard y no están versionadas. Sin este bloque, al pasar el navegador a
-- `authenticated` estas tablas dejarían de responder.
--
-- Igual que el paso 1: no quita ningún permiso. Idempotente.

DROP POLICY IF EXISTS lux_auth_all ON app_users;
CREATE POLICY lux_auth_all ON app_users FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON budget_items;
CREATE POLICY lux_auth_all ON budget_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON contacts;
CREATE POLICY lux_auth_all ON contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON expenses;
CREATE POLICY lux_auth_all ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON materials;
CREATE POLICY lux_auth_all ON materials FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON payments;
CREATE POLICY lux_auth_all ON payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON project_contacts;
CREATE POLICY lux_auth_all ON project_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON project_notes;
CREATE POLICY lux_auth_all ON project_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON projects;
CREATE POLICY lux_auth_all ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON site_content;
CREATE POLICY lux_auth_all ON site_content FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON tasks;
CREATE POLICY lux_auth_all ON tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_auth_all ON user_project_access;
CREATE POLICY lux_auth_all ON user_project_access FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Comprobación 1: ninguna tabla debe quedar con authenticated = 0 ─────────
select tablename,
       count(*) filter (where 'anon'          = any(roles)) as anon,
       count(*) filter (where 'authenticated' = any(roles)) as authenticated
from pg_policies
where schemaname = 'public'
group by tablename
order by authenticated, tablename;

-- ── Comprobación 2: ¿en qué tablas se está aplicando RLS de verdad? ─────────
-- Una política sólo se aplica si la tabla tiene RLS activado. Las que salgan
-- con rls_activado = false están abiertas de par en par hoy mismo, incluso
-- para la anon key, y son las primeras que hay que cerrar en el paso 3.
select c.relname as tabla,
       c.relrowsecurity as rls_activado,
       count(p.policyname) as politicas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname
where n.nspname = 'public' and c.relkind = 'r'
group by c.relname, c.relrowsecurity
order by c.relrowsecurity, c.relname;
