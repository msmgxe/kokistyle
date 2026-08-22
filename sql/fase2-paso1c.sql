-- ══════════════════════════════════════════════════════════════════════════
-- FASE 2 · PASO 1C — Corrección: site_content sólo de lectura
-- ══════════════════════════════════════════════════════════════════════════
-- El espejo del paso 1B dio a `authenticated` permiso FOR ALL sobre el CMS de
-- la landing, cuando anon sólo tenía lectura. El editor escribe por API con la
-- service role, así que el navegador no necesita escribir aquí.

DROP POLICY IF EXISTS lux_auth_all ON site_content;
CREATE POLICY lux_auth_read ON site_content FOR SELECT TO authenticated USING (true);

-- Comprobación: site_content debe quedar con una política SELECT por rol.
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'site_content'
order by policyname;
