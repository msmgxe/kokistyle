-- ══════════════════════════════════════════════════════════════════════════
-- FASE 2 · VERIFICACIÓN — probar el aislamiento sin crear usuarios
-- ══════════════════════════════════════════════════════════════════════════
-- Simula el token de cada rol dentro de una transacción y cuenta lo que vería.
-- No modifica nada: termina en ROLLBACK.
--
-- ANTES DE CORRERLO: sustituye el UUID de abajo por el id de UNO de tus
-- proyectos (cópialo de: select id, title from projects limit 5;).

begin;

-- ── Referencia: cuántas filas hay en total (como service role) ─────────────
select 'TOTAL (sin RLS)' as escenario,
       (select count(*) from projects)  as proyectos,
       (select count(*) from tasks)     as tareas,
       (select count(*) from payments)  as pagos,
       (select count(*) from expenses)  as egresos,
       (select count(*) from invoices)  as facturas;

-- ── Como COLABORADOR con un solo proyecto asignado ─────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","lux_role":"coworker","lux_projects":["00000000-0000-0000-0000-000000000000"]}';

select 'COLABORADOR (1 proyecto)' as escenario,
       (select count(*) from projects)  as proyectos,   -- esperado: 1
       (select count(*) from tasks)     as tareas,      -- sólo las de ese proyecto
       (select count(*) from payments)  as pagos,       -- esperado: 0
       (select count(*) from expenses)  as egresos,     -- esperado: 0
       (select count(*) from invoices)  as facturas;    -- esperado: 0

-- ── Como CLIENTE del mismo proyecto ────────────────────────────────────────
set local request.jwt.claims = '{"role":"authenticated","lux_role":"client","lux_projects":["00000000-0000-0000-0000-000000000000"]}';

select 'CLIENTE (1 proyecto)' as escenario,
       (select count(*) from projects)  as proyectos,   -- esperado: 1
       (select count(*) from tasks)     as tareas,      -- sólo las de ese proyecto
       (select count(*) from payments)  as pagos,       -- sus pagos: > 0 si los hay
       (select count(*) from expenses)  as egresos,     -- esperado: 0
       (select count(*) from invoices)  as facturas;    -- esperado: 0

-- ── Como alguien SIN proyectos (o con un token inventado) ──────────────────
set local request.jwt.claims = '{"role":"authenticated","lux_role":"coworker","lux_projects":[]}';

select 'SIN PROYECTOS' as escenario,
       (select count(*) from projects)  as proyectos,   -- esperado: 0
       (select count(*) from tasks)     as tareas,      -- esperado: 0
       (select count(*) from payments)  as pagos,       -- esperado: 0
       (select count(*) from expenses)  as egresos,     -- esperado: 0
       (select count(*) from invoices)  as facturas;    -- esperado: 0

-- ── Como SUPERADMIN ────────────────────────────────────────────────────────
set local request.jwt.claims = '{"role":"authenticated","lux_role":"superadmin","lux_projects":[]}';

select 'SUPERADMIN' as escenario,
       (select count(*) from projects)  as proyectos,   -- todos
       (select count(*) from tasks)     as tareas,
       (select count(*) from payments)  as pagos,
       (select count(*) from expenses)  as egresos,
       (select count(*) from invoices)  as facturas;

-- ── ¿Y si intenta escribir donde no debe? ──────────────────────────────────
-- Descomenta para comprobar que revienta (es la prueba de que WITH CHECK actúa):
-- set local request.jwt.claims = '{"role":"authenticated","lux_role":"client","lux_projects":["00000000-0000-0000-0000-000000000000"]}';
-- delete from payments;            -- borra 0 filas: el cliente no tiene DELETE
-- insert into projects (title, client, address) values ('hackeado','x','y');  -- debe fallar

rollback;
