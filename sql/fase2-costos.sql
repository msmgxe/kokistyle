-- ══════════════════════════════════════════════════════════════════════════
-- FASE 2 · COSTOS — sacar el margen de la tabla que ve el cliente
-- ══════════════════════════════════════════════════════════════════════════
-- `estimate_items` guarda, en la misma fila: el costo real, la ganancia y el
-- precio del cliente. RLS filtra filas, no columnas, así que quien pueda ver
-- el estimado de su proyecto —un cliente— puede leer tu margen.
--
-- La solución no es otra vista: es mover esas dos columnas a una tabla que sea
-- sólo tuya. `estimate_items` se queda con lo que el cliente sí puede ver.
--
-- Este script es el PRIMER paso (crear y copiar). Las columnas viejas se
-- quedan de momento como respaldo; se retiran con fase2-costos-limpieza.sql
-- cuando el panel esté verificado.

CREATE TABLE IF NOT EXISTS estimate_item_costs (
  item_id    UUID PRIMARY KEY REFERENCES estimate_items(id) ON DELETE CASCADE,
  cost       NUMERIC(12,2) NOT NULL DEFAULT 0,
  profit     NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Copia de lo que ya existe (repetible: no duplica ni pisa lo migrado)
INSERT INTO estimate_item_costs (item_id, cost, profit)
SELECT id, coalesce(cost, 0), coalesce(profit, 0)
FROM estimate_items
ON CONFLICT (item_id) DO NOTHING;

ALTER TABLE estimate_item_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lux_costs_admin ON estimate_item_costs;
CREATE POLICY lux_costs_admin ON estimate_item_costs FOR ALL TO authenticated
  USING (lux_is_admin()) WITH CHECK (lux_is_admin());

-- ── Comprobación: mismo número de filas y mismos importes ──────────────────
select
  (select count(*) from estimate_items)                       as items,
  (select count(*) from estimate_item_costs)                  as costos,
  (select coalesce(sum(coalesce(cost,0)),0) from estimate_items)      as suma_costo_viejo,
  (select coalesce(sum(cost),0) from estimate_item_costs)             as suma_costo_nuevo,
  (select coalesce(sum(coalesce(profit,0)),0) from estimate_items)    as suma_ganancia_vieja,
  (select coalesce(sum(profit),0) from estimate_item_costs)           as suma_ganancia_nueva;
-- ⬆ "items" y "costos" deben coincidir, y las sumas de cada par también.

-- ══════════════════════════════════════════════════════════════════════════
-- MARCHA ATRÁS
-- ══════════════════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS estimate_item_costs;
