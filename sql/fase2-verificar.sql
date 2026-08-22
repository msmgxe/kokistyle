-- ══════════════════════════════════════════════════════════════════════════
-- FASE 2 · VERIFICACIÓN — probar el aislamiento sin crear usuarios
-- ══════════════════════════════════════════════════════════════════════════
-- Impersona el token de cada rol y cuenta lo que vería cada uno. Devuelve TODO
-- en una sola tabla, porque el editor de Supabase sólo muestra el resultado de
-- la última consulta. No modifica nada: termina en ROLLBACK.
--
-- ANTES DE CORRERLO: pon abajo el id de UNO de tus proyectos.
--   select id, title from projects limit 5;

begin;

-- ⬇⬇⬇  PEGA AQUÍ EL UUID DE UN PROYECTO TUYO  ⬇⬇⬇
create temp table lux_param on commit drop as
  select '00000000-0000-0000-0000-000000000000'::text as proyecto;

create temp table lux_check (
  orden int, escenario text,
  proyectos int, tareas int, pagos int, egresos int, facturas int, materiales int
) on commit drop;
grant all on lux_check, lux_param to authenticated;

-- ── Referencia: el total real, sin RLS ─────────────────────────────────────
insert into lux_check
select 0, 'TOTAL en la base',
       (select count(*) from projects), (select count(*) from tasks),
       (select count(*) from payments), (select count(*) from expenses),
       (select count(*) from invoices), (select count(*) from materials);

set local role authenticated;

-- ── Colaborador con un proyecto asignado ───────────────────────────────────
select set_config('request.jwt.claims',
  json_build_object('role','authenticated','lux_role','coworker',
                    'lux_projects', json_build_array((select proyecto from lux_param)))::text, true);
insert into lux_check
select 1, 'COLABORADOR · 1 proyecto',
       (select count(*) from projects), (select count(*) from tasks),
       (select count(*) from payments), (select count(*) from expenses),
       (select count(*) from invoices), (select count(*) from materials);

-- ── Cliente del mismo proyecto ─────────────────────────────────────────────
select set_config('request.jwt.claims',
  json_build_object('role','authenticated','lux_role','client',
                    'lux_projects', json_build_array((select proyecto from lux_param)))::text, true);
insert into lux_check
select 2, 'CLIENTE · 1 proyecto',
       (select count(*) from projects), (select count(*) from tasks),
       (select count(*) from payments), (select count(*) from expenses),
       (select count(*) from invoices), (select count(*) from materials);

-- ── Sesión sin proyectos (o token inventado) ───────────────────────────────
select set_config('request.jwt.claims',
  '{"role":"authenticated","lux_role":"coworker","lux_projects":[]}', true);
insert into lux_check
select 3, 'SIN PROYECTOS',
       (select count(*) from projects), (select count(*) from tasks),
       (select count(*) from payments), (select count(*) from expenses),
       (select count(*) from invoices), (select count(*) from materials);

-- ── Superadmin ─────────────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"role":"authenticated","lux_role":"superadmin","lux_projects":[]}', true);
insert into lux_check
select 4, 'SUPERADMIN',
       (select count(*) from projects), (select count(*) from tasks),
       (select count(*) from payments), (select count(*) from expenses),
       (select count(*) from invoices), (select count(*) from materials);

-- ── ¿Y las escrituras? Se intentan de verdad, dentro de la transacción ─────
-- Nunca probar esto contra la base en vivo: aquí es seguro porque todo el
-- script termina en ROLLBACK.
do $$
declare borradas int; insertadas int;
begin
  -- Como cliente: no debe poder borrar sus pagos
  perform set_config('request.jwt.claims',
    json_build_object('role','authenticated','lux_role','client',
                      'lux_projects', json_build_array((select proyecto from lux_param)))::text, true);
  delete from payments;
  get diagnostics borradas = row_count;
  insert into lux_check values (5, 'CLIENTE intenta borrar pagos', null, null, borradas, null, null, null);

  -- Como colaborador: no debe poder crear proyectos
  perform set_config('request.jwt.claims',
    '{"role":"authenticated","lux_role":"coworker","lux_projects":[]}', true);
  begin
    insert into projects (title, client, address) values ('prueba-rls','x','y');
    get diagnostics insertadas = row_count;
  exception when others then
    insertadas = -1;   -- -1 = rechazado por la política, que es lo correcto
  end;
  insert into lux_check values (6, 'COLABORADOR intenta crear proyecto', insertadas, null, null, null, null, null);
end $$;

reset role;

-- ── Resultado ──────────────────────────────────────────────────────────────
-- En las dos últimas filas: "pagos" = filas que el cliente logró borrar (debe
-- ser 0) y "proyectos" = filas que el colaborador logró crear (debe ser -1,
-- o sea rechazado).
-- Esperado: el colaborador y el cliente ven 1 proyecto y sólo sus tareas;
-- egresos y facturas siempre 0 salvo para ti; el cliente sí ve sus pagos;
-- "SIN PROYECTOS" todo a cero; el superadmin, los totales de la primera fila.
select escenario, proyectos, tareas, pagos, egresos, facturas, materiales
from lux_check order by orden;

rollback;
