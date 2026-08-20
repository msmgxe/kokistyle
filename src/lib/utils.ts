/**
 * Utility functions for the Obra admin panel.
 * These helpers compute financial metrics from project data.
 */

import type { Payment, Expense, Task, DepositEntry } from "@/src/types/project";

/** Format number as USD currency string */
export const money = (n: number): string =>
  "$" + Math.round(n).toLocaleString("en-US");

/** Format date ISO string to dd/mm/yy */
export const dateFmt = (d: string): string => {
  const [y, m, da] = d.split("-");
  return `${da}/${m}/${y.slice(2)}`;
};

/** Sum of all income payments received from client */
export const totalIncome = (payments: Payment[]): number =>
  payments.reduce((s, x) => s + x.amount, 0);

/** Sum of all expenses paid to specialists/suppliers */
export const totalExpense = (expenses: Expense[]): number =>
  expenses.reduce((s, x) => s + x.amount, 0);

/** Remaining balance to collect from client (budget - income) */
export const balanceDue = (budget: number, payments: Payment[]): number =>
  budget - totalIncome(payments);

/** Net cash flow (income - expenses) */
export const cashFlow = (payments: Payment[], expenses: Expense[]): number =>
  totalIncome(payments) - totalExpense(expenses);

/** Percentage of budget paid by client (capped at 100%) */
export const paymentPct = (budget: number, payments: Payment[]): number =>
  Math.min(100, Math.round((totalIncome(payments) / budget) * 100));

/** Percentage of tasks completed */
export const advancePct = (tasks: Task[]): number =>
  tasks.length
    ? Math.round(tasks.filter((t) => t.status === "done").length / tasks.length * 100)
    : 0;

/** Get initials from a full name (up to 2 words) */
export const initials = (name: string): string =>
  name
    .replace(/\(.*\)/, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();

/** Add days to an ISO date string */
export const addDays = (iso: string, n: number): Date => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d;
};

/** Format date to dd/mm */
export const dShort = (d: Date): string =>
  ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2);

/** Montos efectivos del calendario de pagos — única regla para UI, factura,
 *  orden de cambio y PDF. Una cuota capturada en dólares vale su monto fijo (su
 *  `pct` guardado envejece cuando cambia el estimado); el resto vale su % del
 *  total. Con `balanceLast`, la última cuota no fija absorbe la diferencia para
 *  que el calendario sume exactamente el gran total. */
export function depositAmounts(
  deps: DepositEntry[],
  grandTotal: number,
  balanceLast = true,
): number[] {
  const isFixed = (d: DepositEntry) => d.mode === "amount" && d.fixed_amount != null;
  const amounts = deps.map(d =>
    isFixed(d) ? (d.fixed_amount ?? 0) : Math.round(grandTotal * d.pct / 100 * 100) / 100);
  const last = deps.length - 1;
  if (balanceLast && deps.length > 1 && !isFixed(deps[last])) {
    const others = amounts.slice(0, last).reduce((s, n) => s + n, 0);
    amounts[last] = Math.max(0, Math.round((grandTotal - others) * 100) / 100);
  }
  return amounts;
}

/** % que se muestra en una cuota: el capturado cuando se definió en %, el
 *  derivado del monto cuando se definió en dólares. */
export const depositPct = (dep: DepositEntry, amount: number, grandTotal: number): number =>
  dep.mode === "amount" && grandTotal > 0 ? amount / grandTotal * 100 : dep.pct;
