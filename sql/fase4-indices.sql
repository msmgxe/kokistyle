-- ══════════════════════════════════════════════════════════════════════════
-- FASE 4 · Índices por proyecto
-- ══════════════════════════════════════════════════════════════════════════
-- Postgres NO indexa las claves foráneas por sí solo, y ahora cada consulta
-- del panel filtra por proyecto — además, las políticas RLS evalúan
-- `lux_can_see(project_id)` fila a fila. Con pocos datos no se nota; con dos
-- años de obra, sí.
--
-- Todo `IF NOT EXISTS`: repetible y sin bloquear escrituras apreciablemente en
-- tablas de este tamaño.

CREATE INDEX IF NOT EXISTS tasks_project_idx              ON tasks(project_id);
CREATE INDEX IF NOT EXISTS materials_project_idx          ON materials(project_id);
CREATE INDEX IF NOT EXISTS payments_project_idx           ON payments(project_id);
CREATE INDEX IF NOT EXISTS expenses_project_idx           ON expenses(project_id);
CREATE INDEX IF NOT EXISTS project_notes_project_idx      ON project_notes(project_id);
CREATE INDEX IF NOT EXISTS project_objectives_project_idx ON project_objectives(project_id);
CREATE INDEX IF NOT EXISTS budget_items_project_idx       ON budget_items(project_id);
CREATE INDEX IF NOT EXISTS project_contacts_contact_idx   ON project_contacts(contact_id);
CREATE INDEX IF NOT EXISTS user_project_access_user_idx   ON user_project_access(user_id);
CREATE INDEX IF NOT EXISTS activity_log_created_idx       ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS agenda_events_date_idx         ON agenda_events(event_date);

-- El estimado se recorre por la cadena estimate → section → item, tanto al
-- cargar el tab como al evaluar sus políticas.
CREATE INDEX IF NOT EXISTS estimate_sections_estimate_idx ON estimate_sections(estimate_id);
CREATE INDEX IF NOT EXISTS estimate_items_section_idx     ON estimate_items(section_id);

-- ── Comprobación ───────────────────────────────────────────────────────────
select tablename, indexname
from pg_indexes
where schemaname = 'public' and indexname like '%_idx'
order by tablename, indexname;
