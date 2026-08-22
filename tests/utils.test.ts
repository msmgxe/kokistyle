import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { depositAmounts, depositPct, money } from "@/src/lib/utils";
import type { DepositEntry } from "@/src/types/project";

const dep = (over: Partial<DepositEntry> = {}): DepositEntry =>
  ({ pct: 0, label_en: "", label_es: "", ...over });

describe("depositAmounts — el calendario de pagos", () => {
  test("reparte por porcentaje", () => {
    const deps = [dep({ pct: 30 }), dep({ pct: 20 }), dep({ pct: 50 })];
    assert.deepEqual(depositAmounts(deps, 26750), [8025, 5350, 13375]);
  });

  test("una cuota en dólares vale su monto, no su pct envejecido", () => {
    // El caso real: se capturó $7,425 y luego cambió el gran total, dejando
    // pct = 26.5 obsoleto. El PDF imprimía 26.5% × total y no cuadraba.
    const deps = [
      dep({ pct: 26.5, mode: "amount", fixed_amount: 7425 }),
      dep({ pct: 22.2, mode: "amount", fixed_amount: 5950 }),
      dep({ pct: 50 }),
    ];
    assert.deepEqual(depositAmounts(deps, 26750), [7425, 5950, 13375]);
  });

  test("la última cuota absorbe la diferencia y el total cuadra", () => {
    const deps = [dep({ pct: 26.5 }), dep({ pct: 22.2 }), dep({ pct: 50 })];
    const amounts = depositAmounts(deps, 26750);
    assert.equal(amounts.reduce((s, n) => s + n, 0), 26750);
  });

  test("si la última es fija, no se toca aunque no cuadre", () => {
    const deps = [dep({ pct: 50 }), dep({ pct: 0, mode: "amount", fixed_amount: 1000 })];
    assert.deepEqual(depositAmounts([...deps], 10000), [5000, 1000]);
  });

  test("balanceLast=false devuelve los importes crudos", () => {
    const deps = [dep({ pct: 30 }), dep({ pct: 20 })];
    assert.deepEqual(depositAmounts(deps, 1000, false), [300, 200]);
  });

  test("sin cuotas no revienta", () => {
    assert.deepEqual(depositAmounts([], 1000), []);
  });
});

describe("depositPct — el % que se muestra", () => {
  test("en modo dólares se deriva del monto, no del pct guardado", () => {
    const d = dep({ pct: 26.5, mode: "amount", fixed_amount: 7425 });
    assert.equal(Math.round(depositPct(d, 7425, 26750)), 28);
  });

  test("en modo porcentaje respeta lo que se capturó", () => {
    assert.equal(depositPct(dep({ pct: 30 }), 8025, 26750), 30);
  });
});

describe("money", () => {
  test("formatea en dólares sin decimales", () => {
    assert.equal(money(26750), "$26,750");
    assert.equal(money(0), "$0");
  });
});
