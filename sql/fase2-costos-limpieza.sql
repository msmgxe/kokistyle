-- ══════════════════════════════════════════════════════════════════════════
-- FASE 2 · COSTOS · LIMPIEZA — retirar las columnas del estimado
-- ══════════════════════════════════════════════════════════════════════════
-- CORRER SÓLO cuando el panel lleve unos días funcionando con la tabla nueva:
-- editar un item, cambiar costo y ganancia, crear items, y ver que los montos
-- del PDF y del dashboard siguen bien.
--
-- Hasta aquí, el margen seguía legible en estimate_items para quien pudiera
-- ver el estimado. Esto lo cierra de verdad.

-- Último rescate por si algo quedó sin migrar
INSERT INTO estimate_item_costs (item_id, cost, profit)
SELECT id, coalesce(cost, 0), coalesce(profit, 0)
FROM estimate_items
ON CONFLICT (item_id) DO NOTHING;

ALTER TABLE estimate_items DROP COLUMN IF EXISTS cost;
ALTER TABLE estimate_items DROP COLUMN IF EXISTS profit;

-- ── Comprobación: en estimate_items ya no debe haber costo ni ganancia ─────
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'estimate_items'
order by ordinal_position;
