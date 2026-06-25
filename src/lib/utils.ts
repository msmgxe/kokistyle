/**
 * Utility functions for the Obra admin panel.
 * These helpers compute financial metrics from project data.
 */

import type { Payment, Expense, Task } from "@/src/types/project";

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

/** Status labels in Spanish */
export const STATUS_LABELS: Record<string, string> = {
  presupuesto: "Presupuesto",
  aprobado: "Aprobado",
  en_obra: "En obra",
  terminado: "Terminado",
};

/** Payment type labels */
export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  anticipo: "Anticipo",
  abono: "Abono",
  final: "Final",
};
