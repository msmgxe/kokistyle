/**
 * PDF export utilities using jsPDF.
 * Generates cotización (budget quote) and estado de cuenta (account statement).
 */
import jsPDF from "jspdf";
import type { BudgetItem, Payment, Expense, Project } from "@/src/types/project";
import { money } from "./utils";

const INK  = "#16323D";
const MUTED = "#5C6A6E";
const ACCENT = "#4E7A82";
const LINE = "#E6DDCB";

function fmtDate(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function header(doc: jsPDF, title: string, project: Project) {
  const W = doc.internal.pageSize.getWidth();

  // Brand bar
  doc.setFillColor(22, 50, 61); // #16323D
  doc.rect(0, 0, W, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("KokiStyle", 14, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("kokistyle.com  ·  Florida, USA", W - 14, 14, { align: "right" });

  // Document title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(INK);
  doc.text(title, 14, 36);

  // Project info
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text(`Proyecto: ${project.title}`, 14, 44);
  doc.text(`Cliente: ${project.client}`, 14, 50);
  if (project.address) doc.text(`Dirección: ${project.address}`, 14, 56);
  doc.text(`Fecha: ${fmtDate(new Date().toISOString().split("T")[0])}`, W - 14, 44, { align: "right" });

  // Divider
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.4);
  doc.line(14, 62, W - 14, 62);

  return 70; // y cursor after header
}

function colHeader(doc: jsPDF, y: number, cols: { x: number; label: string; align?: "left"|"right" }[]) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(247, 243, 234); // #F7F3EA
  doc.rect(0, y - 5, W, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  cols.forEach(({ x, label, align }) => {
    doc.text(label, x, y, { align: align ?? "left" });
  });
  return y + 8;
}

function divider(doc: jsPDF, y: number) {
  const W = doc.internal.pageSize.getWidth();
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.2);
  doc.line(14, y, W - 14, y);
  return y + 3;
}

export function exportCotizacion(project: Project, items: BudgetItem[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = header(doc, "Cotización", project);

  y = colHeader(doc, y, [
    { x: 14,      label: "DESCRIPCIÓN" },
    { x: 120,     label: "TIPO" },
    { x: W - 14,  label: "MONTO (USD)", align: "right" },
  ]);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  let mano = 0, mat = 0;
  items.forEach((b) => {
    if (b.type === "mano") mano += b.amount; else mat += b.amount;

    doc.setTextColor(INK);
    doc.text(b.description, 14, y, { maxWidth: 100 });
    doc.setTextColor(b.type === "mano" ? ACCENT : MUTED);
    doc.text(b.type === "mano" ? "Mano de obra" : "Material", 120, y);
    doc.setTextColor(INK);
    doc.text(money(b.amount), W - 14, y, { align: "right" });
    y += 7;
    if (y > 270) { doc.addPage(); y = 20; }
  });

  y = divider(doc, y);

  // Subtotals
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text("Subtotal mano de obra", 120, y + 5);
  doc.text(money(mano), W - 14, y + 5, { align: "right" });
  doc.text("Subtotal materiales", 120, y + 11);
  doc.text(money(mat), W - 14, y + 11, { align: "right" });

  // Total bar
  y += 18;
  doc.setFillColor(22, 50, 61);
  doc.roundedRect(14, y, W - 28, 14, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("Total presupuestado", 20, y + 9);
  doc.text(money(items.reduce((s, b) => s + b.amount, 0)), W - 20, y + 9, { align: "right" });

  // Footer
  y += 24;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text("Este presupuesto tiene validez de 30 días. Precios en USD.", 14, y);

  const filename = `Cotizacion_${project.title.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}

export function exportEstadoCuenta(project: Project, payments: Payment[], expenses: Expense[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = header(doc, "Estado de Cuenta", project);

  const inc = payments.reduce((s, p) => s + p.amount, 0);
  const egr = expenses.reduce((s, e) => s + e.amount, 0);
  const due = Math.max(0, project.budget - inc);

  // KPI row
  const kpis = [
    { label: "Presupuesto", val: money(project.budget) },
    { label: "Ingresos",    val: money(inc) },
    { label: "Egresos",     val: money(egr) },
    { label: "Por cobrar",  val: money(due) },
  ];
  const boxW = (W - 28 - 9) / 4;
  kpis.forEach(({ label, val }, i) => {
    const bx = 14 + i * (boxW + 3);
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, y, boxW, 16, 2, 2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(MUTED);
    doc.text(label.toUpperCase(), bx + 4, y + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(INK);
    doc.text(val, bx + 4, y + 13);
  });
  y += 24;

  // ── Ingresos ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(INK);
  doc.text("Ingresos del cliente", 14, y);
  y += 5;

  y = colHeader(doc, y, [
    { x: 14,       label: "FECHA" },
    { x: 44,       label: "CONCEPTO" },
    { x: 120,      label: "MÉTODO" },
    { x: W - 14,   label: "MONTO", align: "right" },
  ]);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  payments.forEach((p) => {
    doc.setTextColor(MUTED);
    doc.text(fmtDate(p.date), 14, y);
    doc.setTextColor(INK);
    doc.text(p.type, 44, y);
    doc.setTextColor(MUTED);
    doc.text(p.method, 120, y);
    doc.setTextColor("#4F8A63");
    doc.text(money(p.amount), W - 14, y, { align: "right" });
    y += 7;
    if (y > 270) { doc.addPage(); y = 20; }
  });

  if (!payments.length) {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(MUTED);
    doc.text("Sin ingresos registrados.", 14, y);
    y += 7;
  }

  y = divider(doc, y + 2);

  // ── Egresos ──
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(INK);
  doc.text("Egresos a especialistas", 14, y);
  y += 5;

  y = colHeader(doc, y, [
    { x: 14,       label: "FECHA" },
    { x: 44,       label: "PAGADO A" },
    { x: 100,      label: "CONCEPTO" },
    { x: W - 14,   label: "MONTO", align: "right" },
  ]);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  expenses.forEach((e) => {
    doc.setTextColor(MUTED);
    doc.text(fmtDate(e.date), 14, y);
    doc.setTextColor(INK);
    doc.text(e.payee_name, 44, y, { maxWidth: 50 });
    doc.text(e.concept || "—", 100, y, { maxWidth: 50 });
    doc.setTextColor("#B0492F");
    doc.text(money(e.amount), W - 14, y, { align: "right" });
    y += 7;
    if (y > 270) { doc.addPage(); y = 20; }
  });

  if (!expenses.length) {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(MUTED);
    doc.text("Sin egresos registrados.", 14, y);
    y += 7;
  }

  y = divider(doc, y + 2);

  // Resumen final
  y += 4;
  doc.setFillColor(22, 50, 61);
  doc.roundedRect(14, y, W - 28, 14, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(`Caja neta (Ing − Egr): ${money(inc - egr)}`, 20, y + 6);
  doc.text(`Saldo por cobrar: ${money(due)}`, 20, y + 12);

  const filename = `EstadoCuenta_${project.title.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}
