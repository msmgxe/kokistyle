// Totales del estimado compartidos por EstimateTab (cálculo canónico), el hero del
// detalle de proyecto y el dashboard. Regla: el total efectivo de una sección es la
// suma de sus items (por `amount`) si hay alguno con monto; si no, su `section_total`.
// El descuento aplica solo al subtotal de mano de obra (secciones no material).

export interface EstItemLite { amount: number; cost?: number; profit?: number }
export interface EstSectionLite {
  items: EstItemLite[];
  section_total: number;
  is_material_type: boolean;
}

function effectiveSectionTotal(s: EstSectionLite): number {
  const itemsSum = s.items.reduce((a, i) => a + i.amount, 0);
  return itemsSum > 0 ? itemsSum : s.section_total;
}

export function computeGrandTotal(sections: EstSectionLite[], discountPct: number): number {
  let all = 0, labor = 0;
  for (const s of sections) {
    const st = effectiveSectionTotal(s);
    all += st;
    if (!s.is_material_type) labor += st;
  }
  const disc = Math.round(labor * (discountPct / 100) * 100) / 100;
  return all - disc;
}

export interface EstimateTotals {
  client: number;   // precio final al cliente (grand total, tras descuento)
  cost: number;     // costo real interno
  profit: number;   // ganancia (client - cost, nunca negativa en el resumen)
  laborSubtotal: number;
  discount: number;
}

// Desglose para el hero (3 pilares). El costo por sección sale de la suma de
// `item.cost`; una sección plana (sin items) trata su total como costo (coherente
// con el legacy donde cost = amount). La ganancia reconcilia: cost + profit = client.
export function computeEstimateTotals(sections: EstSectionLite[], discountPct: number): EstimateTotals {
  let all = 0, labor = 0, cost = 0;
  for (const s of sections) {
    const st = effectiveSectionTotal(s);
    all += st;
    if (!s.is_material_type) labor += st;
    cost += s.items.length ? s.items.reduce((a, i) => a + (i.cost ?? 0), 0) : st;
  }
  const discount = Math.round(labor * (discountPct / 100) * 100) / 100;
  const client = all - discount;
  const profit = Math.max(Math.round((client - cost) * 100) / 100, 0);
  return { client, cost, profit, laborSubtotal: labor, discount };
}
