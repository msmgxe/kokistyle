-- ══════════════════════════════════════════════════════════════════════════
-- FASE 2 · PASO 4 — La anon key deja de ser llave maestra
-- ══════════════════════════════════════════════════════════════════════════
-- Requisito: paso 3E corrido y la comprobación devolviendo cero filas.
--
-- Hasta ahora las políticas nuevas convivían con las viejas: el navegador
-- identificado pasaba por las nuevas, pero cualquiera con la clave pública
-- —que viaja en el JavaScript de la web— seguía entrando por las viejas.
-- Aquí se retiran.
--
-- Sobreviven exactamente dos permisos públicos, los que necesita un visitante
-- sin sesión:
--   site_content · SELECT  → la landing lee sus textos e imágenes
--   bookings     · INSERT  → el formulario de reservas crea la solicitud
--
-- Sólo se borran las políticas cuyo rol es exactamente `anon`. Si alguna
-- mezclara anon con authenticated, se deja y aparece en la comprobación final
-- para revisarla a mano.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND 'anon' = ANY(roles)
      AND NOT ('authenticated' = ANY(roles))
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    RAISE NOTICE 'retirada: % en %', r.policyname, r.tablename;
  END LOOP;
END $$;

-- ── Los dos permisos públicos que deben seguir vivos ───────────────────────
DROP POLICY IF EXISTS lux_public_site ON site_content;
CREATE POLICY lux_public_site ON site_content FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS lux_public_booking ON bookings;
CREATE POLICY lux_public_booking ON bookings FOR INSERT TO anon WITH CHECK (true);

-- ── Comprobación ───────────────────────────────────────────────────────────
-- Esperado: exactamente DOS filas — site_content/SELECT y bookings/INSERT.
-- Si aparece cualquier otra, o alguna con el rol `public` (que incluye a todo
-- el mundo), hay que revisarla.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and ('anon' = ANY(roles) or 'public' = ANY(roles))
order by tablename, policyname;

-- ══════════════════════════════════════════════════════════════════════════
-- MARCHA ATRÁS — devuelve el acceso público a todas las tablas de negocio
-- ══════════════════════════════════════════════════════════════════════════
-- Sólo si algo se rompe y hay que volver al estado anterior mientras se
-- investiga. Deja la base como estaba antes de este paso.
--
-- DO $$
-- DECLARE t text;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY[
--     'activity_log','agenda_events','app_users','bookings','budget_items','change_orders',
--     'contacts','estimate_item_catalog','estimate_items','estimate_section_catalog',
--     'estimate_sections','expenses','invoices','materials','payments','project_contacts',
--     'project_estimates','project_notes','project_objectives','project_photos','projects',
--     'push_subscriptions','site_content','tasks','user_project_access','voice_actions','voice_prefs'
--   ] LOOP
--     EXECUTE format('DROP POLICY IF EXISTS anon_all ON %I', t);
--     EXECUTE format('CREATE POLICY anon_all ON %I FOR ALL TO anon USING (true) WITH CHECK (true)', t);
--   END LOOP;
-- END $$;
