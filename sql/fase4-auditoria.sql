-- ══════════════════════════════════════════════════════════════════════════
-- FASE 4 · La auditoría deja de escribirla el navegador
-- ══════════════════════════════════════════════════════════════════════════
-- `activity_log` ya era append-only, pero el actor lo ponía el cliente: con una
-- sesión cualquiera se podía atribuir una acción a otra persona. Un registro
-- que se puede falsificar no sirve de registro.
--
-- Desde el despliegue de hoy la app escribe por `/api/activity`, que deriva
-- quién actúa de la sesión firmada. Aquí se le quita al navegador el permiso
-- de escribir directo (la service role no pasa por RLS, así que la API sigue).
--
-- CORRER SÓLO DESPUÉS de que el despliegue esté arriba, o se perderán unos
-- pocos registros mientras tanto.

DROP POLICY IF EXISTS lux_log_insert ON activity_log;

-- Lo mismo para el registro de Katy: lo escribe el navegador y, aunque no
-- decide permisos, conviene que nadie pueda inventar entradas.
-- (Pendiente: mover VoiceFAB a una ruta de servidor. Hasta entonces se deja.)

-- ── Comprobación ───────────────────────────────────────────────────────────
-- activity_log debe quedar sólo con la política de lectura del superadmin.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename in ('activity_log', 'voice_actions')
order by tablename, policyname;

-- ══════════════════════════════════════════════════════════════════════════
-- MARCHA ATRÁS
-- ══════════════════════════════════════════════════════════════════════════
-- CREATE POLICY lux_log_insert ON activity_log FOR INSERT TO authenticated WITH CHECK (true);
