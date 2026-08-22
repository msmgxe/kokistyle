-- ══════════════════════════════════════════════════════════════════════════
-- FASE 2 · PASO 3E — Identidad, auditoría y lo que queda suelto
-- ══════════════════════════════════════════════════════════════════════════
-- Requisito: paso 3D corrido y verificado. Con este lote termina el apretón:
-- después ya sólo queda retirar las políticas `anon` (paso 4).
--
--   app_users            → sólo tú (guarda permisos y el hash del PIN)
--   user_project_access  → tú, y cada quien su propia lista (el panel la usa)
--   activity_log         → se escribe, no se corrige: sin UPDATE ni DELETE
--   voice_actions        → igual: registro de lo que se le dictó a Katy
--   voice_prefs          → memoria del asistente, cualquiera de la casa
--   push_subscriptions   → cada dispositivo registra el suyo; sólo tú los lees
--   bookings             → las crea la web pública (política anon); tú las lees

-- ── app_users: credenciales y permisos ─────────────────────────────────────
DROP POLICY IF EXISTS lux_auth_all ON app_users;
DROP POLICY IF EXISTS lux_admin_only ON app_users;
CREATE POLICY lux_admin_only ON app_users FOR ALL TO authenticated
  USING (lux_is_admin()) WITH CHECK (lux_is_admin());

-- ── user_project_access: el dashboard consulta la propia ───────────────────
-- `sub` del token es el id de app_users; el superadmin no lo lleva y no lo
-- necesita, porque lux_is_admin() ya le abre la puerta.
DROP POLICY IF EXISTS lux_auth_all ON user_project_access;
DROP POLICY IF EXISTS lux_upa_read ON user_project_access;
CREATE POLICY lux_upa_read ON user_project_access FOR SELECT TO authenticated
  USING (lux_is_admin() OR user_id::text = (auth.jwt() ->> 'sub'));
DROP POLICY IF EXISTS lux_upa_write ON user_project_access;
CREATE POLICY lux_upa_write ON user_project_access FOR INSERT TO authenticated
  WITH CHECK (lux_is_admin());
DROP POLICY IF EXISTS lux_upa_update ON user_project_access;
CREATE POLICY lux_upa_update ON user_project_access FOR UPDATE TO authenticated
  USING (lux_is_admin()) WITH CHECK (lux_is_admin());
DROP POLICY IF EXISTS lux_upa_delete ON user_project_access;
CREATE POLICY lux_upa_delete ON user_project_access FOR DELETE TO authenticated
  USING (lux_is_admin());

-- ── activity_log y voice_actions: append-only ──────────────────────────────
-- Sin UPDATE ni DELETE para nadie: una auditoría que se puede editar no sirve
-- de auditoría. (Que la escriba el servidor y no el cliente es la Fase 4.)
DROP POLICY IF EXISTS lux_auth_all ON activity_log;
DROP POLICY IF EXISTS lux_log_read ON activity_log;
CREATE POLICY lux_log_read ON activity_log FOR SELECT TO authenticated
  USING (lux_is_admin());
DROP POLICY IF EXISTS lux_log_insert ON activity_log;
CREATE POLICY lux_log_insert ON activity_log FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS lux_auth_all ON voice_actions;
DROP POLICY IF EXISTS lux_voice_read ON voice_actions;
CREATE POLICY lux_voice_read ON voice_actions FOR SELECT TO authenticated
  USING (lux_is_admin());
DROP POLICY IF EXISTS lux_voice_insert ON voice_actions;
CREATE POLICY lux_voice_insert ON voice_actions FOR INSERT TO authenticated
  WITH CHECK (true);

-- ── voice_prefs: memoria de Katy, sin datos sensibles ──────────────────────
DROP POLICY IF EXISTS lux_auth_all ON voice_prefs;
DROP POLICY IF EXISTS lux_prefs_all ON voice_prefs;
CREATE POLICY lux_prefs_all ON voice_prefs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── push_subscriptions: cada aparato registra el suyo ──────────────────────
DROP POLICY IF EXISTS lux_auth_all ON push_subscriptions;
DROP POLICY IF EXISTS lux_push_read ON push_subscriptions;
CREATE POLICY lux_push_read ON push_subscriptions FOR SELECT TO authenticated
  USING (lux_is_admin());
DROP POLICY IF EXISTS lux_push_insert ON push_subscriptions;
CREATE POLICY lux_push_insert ON push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (true);
DROP POLICY IF EXISTS lux_push_update ON push_subscriptions;
CREATE POLICY lux_push_update ON push_subscriptions FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lux_push_delete ON push_subscriptions;
CREATE POLICY lux_push_delete ON push_subscriptions FOR DELETE TO authenticated
  USING (lux_is_admin());

-- ── bookings: las crea la web pública, las lees tú ─────────────────────────
DROP POLICY IF EXISTS lux_auth_all ON bookings;
DROP POLICY IF EXISTS lux_book_admin ON bookings;
CREATE POLICY lux_book_admin ON bookings FOR ALL TO authenticated
  USING (lux_is_admin()) WITH CHECK (lux_is_admin());

-- ── Comprobación: ninguna tabla debe quedar con la política amplia ─────────
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and policyname = 'lux_auth_all'
order by tablename;
-- ⬆ Esta consulta debe devolver CERO filas: ya no queda ningún permiso
--   amplio para `authenticated` en toda la base.

-- ══════════════════════════════════════════════════════════════════════════
-- MARCHA ATRÁS
-- ══════════════════════════════════════════════════════════════════════════
-- DO $$
-- DECLARE t text; p text;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY['app_users','user_project_access','activity_log','voice_actions',
--                            'voice_prefs','push_subscriptions','bookings'] LOOP
--     FOR p IN SELECT policyname FROM pg_policies
--              WHERE schemaname='public' AND tablename=t AND 'authenticated' = ANY(roles) LOOP
--       EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p, t);
--     END LOOP;
--     EXECUTE format('CREATE POLICY lux_auth_all ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
--   END LOOP;
-- END $$;
