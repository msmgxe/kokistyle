-- ══════════════════════════════════════════════════════════════════════════
-- FASE 2 · PASO 3C — Cada quien, sólo sus proyectos
-- ══════════════════════════════════════════════════════════════════════════
-- Requisito: pasos 3A y 3B corridos y verificados.
--
-- Este es el apretón que cumple la definición de "seguro" de la auditoría:
-- un cliente no puede leer ni modificar otro proyecto, ni aunque llame a
-- Supabase directamente saltándose la aplicación.
--
-- Regla general: `lux_can_see(project_id)` — superadmin ve todo, los demás
-- sólo los proyectos de su `user_project_access` (van dentro del token).
-- El cliente entra en modo lectura; la cuadrilla trabaja.

-- ── projects: la raíz. Sólo el superadmin crea, edita o borra ──────────────
DROP POLICY IF EXISTS lux_auth_all ON projects;

DROP POLICY IF EXISTS lux_projects_read ON projects;
CREATE POLICY lux_projects_read ON projects FOR SELECT TO authenticated
  USING (lux_can_see(id));
DROP POLICY IF EXISTS lux_projects_insert ON projects;
CREATE POLICY lux_projects_insert ON projects FOR INSERT TO authenticated
  WITH CHECK (lux_is_admin());
DROP POLICY IF EXISTS lux_projects_update ON projects;
CREATE POLICY lux_projects_update ON projects FOR UPDATE TO authenticated
  USING (lux_is_admin()) WITH CHECK (lux_is_admin());
DROP POLICY IF EXISTS lux_projects_delete ON projects;
CREATE POLICY lux_projects_delete ON projects FOR DELETE TO authenticated
  USING (lux_is_admin());

-- ── tasks: la cuadrilla trabaja aquí; el cliente sólo mira el Gantt ────────
DROP POLICY IF EXISTS lux_auth_all ON tasks;

DROP POLICY IF EXISTS lux_tasks_read ON tasks;
CREATE POLICY lux_tasks_read ON tasks FOR SELECT TO authenticated
  USING (lux_can_see(project_id));
DROP POLICY IF EXISTS lux_tasks_insert ON tasks;
CREATE POLICY lux_tasks_insert ON tasks FOR INSERT TO authenticated
  WITH CHECK (lux_can_see(project_id) AND lux_role() <> 'client');
DROP POLICY IF EXISTS lux_tasks_update ON tasks;
CREATE POLICY lux_tasks_update ON tasks FOR UPDATE TO authenticated
  USING (lux_can_see(project_id) AND lux_role() <> 'client')
  WITH CHECK (lux_can_see(project_id) AND lux_role() <> 'client');
DROP POLICY IF EXISTS lux_tasks_delete ON tasks;
CREATE POLICY lux_tasks_delete ON tasks FOR DELETE TO authenticated
  USING (lux_can_see(project_id) AND lux_role() <> 'client');

-- ── project_notes: todos los del proyecto pueden escribir una nota ─────────
DROP POLICY IF EXISTS lux_auth_all ON project_notes;

DROP POLICY IF EXISTS lux_notes_read ON project_notes;
CREATE POLICY lux_notes_read ON project_notes FOR SELECT TO authenticated
  USING (lux_can_see(project_id));
DROP POLICY IF EXISTS lux_notes_insert ON project_notes;
CREATE POLICY lux_notes_insert ON project_notes FOR INSERT TO authenticated
  WITH CHECK (lux_can_see(project_id));
DROP POLICY IF EXISTS lux_notes_update ON project_notes;
CREATE POLICY lux_notes_update ON project_notes FOR UPDATE TO authenticated
  USING (lux_can_see(project_id) AND lux_role() <> 'client')
  WITH CHECK (lux_can_see(project_id) AND lux_role() <> 'client');
DROP POLICY IF EXISTS lux_notes_delete ON project_notes;
CREATE POLICY lux_notes_delete ON project_notes FOR DELETE TO authenticated
  USING (lux_can_see(project_id) AND lux_role() <> 'client');

-- ── project_photos: la obra la fotografía quien la trabaja ─────────────────
DROP POLICY IF EXISTS lux_auth_all ON project_photos;

DROP POLICY IF EXISTS lux_photos_read ON project_photos;
CREATE POLICY lux_photos_read ON project_photos FOR SELECT TO authenticated
  USING (lux_can_see(project_id));
DROP POLICY IF EXISTS lux_photos_insert ON project_photos;
CREATE POLICY lux_photos_insert ON project_photos FOR INSERT TO authenticated
  WITH CHECK (lux_can_see(project_id) AND lux_role() <> 'client');
DROP POLICY IF EXISTS lux_photos_update ON project_photos;
CREATE POLICY lux_photos_update ON project_photos FOR UPDATE TO authenticated
  USING (lux_can_see(project_id) AND lux_role() <> 'client')
  WITH CHECK (lux_can_see(project_id) AND lux_role() <> 'client');
DROP POLICY IF EXISTS lux_photos_delete ON project_photos;
CREATE POLICY lux_photos_delete ON project_photos FOR DELETE TO authenticated
  USING (lux_can_see(project_id) AND lux_role() <> 'client');

-- ── project_objectives: marcar hecho sí; editar la lista, sólo tú ──────────
DROP POLICY IF EXISTS lux_auth_all ON project_objectives;

DROP POLICY IF EXISTS lux_obj_read ON project_objectives;
CREATE POLICY lux_obj_read ON project_objectives FOR SELECT TO authenticated
  USING (lux_can_see(project_id));
DROP POLICY IF EXISTS lux_obj_update ON project_objectives;
CREATE POLICY lux_obj_update ON project_objectives FOR UPDATE TO authenticated
  USING (lux_can_see(project_id) AND lux_role() <> 'client')
  WITH CHECK (lux_can_see(project_id) AND lux_role() <> 'client');
DROP POLICY IF EXISTS lux_obj_insert ON project_objectives;
CREATE POLICY lux_obj_insert ON project_objectives FOR INSERT TO authenticated
  WITH CHECK (lux_is_admin());
DROP POLICY IF EXISTS lux_obj_delete ON project_objectives;
CREATE POLICY lux_obj_delete ON project_objectives FOR DELETE TO authenticated
  USING (lux_is_admin());

-- ── Comprobación ───────────────────────────────────────────────────────────
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('projects','tasks','project_notes','project_photos','project_objectives')
order by tablename, cmd, policyname;

-- ══════════════════════════════════════════════════════════════════════════
-- MARCHA ATRÁS — devuelve el permiso amplio a las cinco tablas
-- ══════════════════════════════════════════════════════════════════════════
-- DO $$
-- DECLARE t text; p text;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY['projects','tasks','project_notes','project_photos','project_objectives'] LOOP
--     FOR p IN SELECT policyname FROM pg_policies
--              WHERE schemaname='public' AND tablename=t AND 'authenticated' = ANY(roles) LOOP
--       EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p, t);
--     END LOOP;
--     EXECUTE format('CREATE POLICY lux_auth_all ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
--   END LOOP;
-- END $$;
