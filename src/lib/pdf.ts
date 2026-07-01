/**
 * PDF export utilities using jsPDF.
 * Generates cotización (budget quote) and estado de cuenta (account statement).
 */
import jsPDF from "jspdf";
import type { BudgetItem, Payment, Expense, Project, ProjectEstimate } from "@/src/types/project";
import { money } from "./utils";
import { branding } from "@/src/config/branding";

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
  doc.text(branding.companyName, 14, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${branding.phone}  ·  ${branding.email}`, W - 14, 14, { align: "right" });

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

function buildEstimatePdf(
  estimate: ProjectEstimate,
  grandTotal: number,
  laborTotal: number,
  discountAmt: number,
  language: "en" | "es" = "en",
  projectTitle?: string,
): { doc: jsPDF; filename: string } {
  const EN  = language === "en";
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W   = doc.internal.pageSize.getWidth(); // 210
  const CX  = W / 2;
  const ML  = 10;
  const MR  = W - 10;
  const CW  = MR - ML; // 190
  let y     = 0;

  function checkPage(needed = 8) {
    if (y + needed > 278) { doc.addPage(); y = 12; }
  }

  // ── Centered header ────────────────────────────────────────────────────────
  y = 7;
  const badgeLabel = EN ? "ESTIMATE" : "ESTIMADO";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  const badgeW = doc.getTextWidth(badgeLabel) + 6;
  doc.setFillColor(22, 50, 61);
  doc.roundedRect(CX - badgeW / 2, y - 3.5, badgeW, 5, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(badgeLabel, CX, y, { align: "center" });
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(22, 50, 61);
  doc.text(branding.companyName.toUpperCase(), CX, y, { align: "center" });
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(92, 106, 110);
  doc.text(branding.slogan, CX, y, { align: "center" });
  y += 4;
  doc.text(`${branding.phone}  ·  ${branding.email}`, CX, y, { align: "center" });
  y += 4;

  doc.setDrawColor(22, 50, 61);
  doc.setLineWidth(0.5);
  doc.line(ML, y, MR, y);
  y += 3;

  // ── Project title bar ──────────────────────────────────────────────────────
  doc.setFillColor(22, 50, 61);
  doc.rect(ML, y, CW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text((projectTitle || estimate.project_title || (EN ? "PROJECT" : "PROYECTO")).toUpperCase(), CX, y + 5.5, { align: "center", maxWidth: CW - 4 });
  y += 11;

  // ── PROPOSAL info block ────────────────────────────────────────────────────
  const infoH = 22;
  doc.setFillColor(247, 243, 234);
  doc.setDrawColor(230, 221, 203);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, y, CW, infoH, 2, 2, "FD");

  const propLabel = EN ? "PROPOSAL" : "PROPUESTA";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(22, 50, 61);
  doc.text(propLabel, CX, y + 5, { align: "center" });
  doc.setDrawColor(210, 200, 188);
  doc.setLineWidth(0.2);
  const pw = doc.getTextWidth(propLabel);
  doc.line(CX - pw / 2, y + 6, CX + pw / 2, y + 6);

  const iy  = y + 10;
  const lhh = 4.2;
  const c1v = ML + 4;
  const c2v = CX + 4;
  const valOff = 22;

  const leftRows = [
    { l: EN ? "Customer:" : "Cliente:",   v: estimate.customer_name || "—" },
    { l: EN ? "City:"     : "Ciudad:",    v: estimate.city          || "—" },
    { l: EN ? "Phone:"    : "Teléfono:",  v: estimate.phone         || "—" },
  ];
  const rightRows = [
    { l: EN ? "Contractor:" : "Contratista:", v: branding.contractor },
    { l: EN ? "Start Date:"  : "Inicio:",      v: estimate.start_date ? fmtDate(estimate.start_date) : "—" },
    { l: EN ? "End Date:"    : "Fecha fin:",   v: estimate.end_date   ? fmtDate(estimate.end_date)   : "—" },
  ];

  doc.setFontSize(7.5);
  leftRows.forEach((row, i) => {
    const ry = iy + i * lhh;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(92, 106, 110);
    doc.text(row.l, c1v, ry);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(22, 50, 61);
    doc.text(row.v, c1v + valOff, ry);
  });
  rightRows.forEach((row, i) => {
    const ry = iy + i * lhh;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(92, 106, 110);
    doc.text(row.l, c2v, ry);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(22, 50, 61);
    doc.text(row.v, c2v + valOff, ry);
  });
  y += infoH + 3;

  // ── Table header bar ───────────────────────────────────────────────────────
  doc.setFillColor(22, 50, 61);
  doc.rect(ML, y, CW, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(EN ? "SECTION / ITEM" : "SECCIÓN / PARTIDA", ML + 4, y + 4.8);
  doc.text(EN ? "AMOUNT (USD)" : "MONTO (USD)", MR - 2, y + 4.8, { align: "right" });
  y += 9;

  // ── Sections ───────────────────────────────────────────────────────────────
  for (const section of estimate.sections) {
    const items    = section.items ?? [];
    const itemsSum = items.reduce((a, i) => a + i.amount, 0);
    const secTotal = itemsSum > 0 ? itemsSum : section.section_total;
    const name     = (EN ? section.name_en : section.name_es) || section.name_en || section.name_es || "";
    const isMat    = section.is_material_type;
    const secHdrH  = section.note ? 7.5 : 6;

    checkPage(secHdrH + 4);

    // Section header: colored left border + tinted background
    if (isMat) {
      doc.setFillColor(253, 240, 237);
    } else {
      doc.setFillColor(232, 240, 242);
    }
    doc.rect(ML + 3, y, CW - 3, secHdrH, "F");

    if (isMat) {
      doc.setFillColor(176, 73, 47);
    } else {
      doc.setFillColor(22, 50, 61);
    }
    doc.rect(ML, y, 3, secHdrH, "F");

    // Section name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    if (isMat) {
      doc.setTextColor(176, 73, 47);
    } else {
      doc.setTextColor(22, 50, 61);
    }
    const nameY = y + (section.note ? 4 : 4.2);
    doc.text(name.toUpperCase(), ML + 5, nameY);

    // Note
    if (section.note) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(92, 106, 110);
      doc.text(section.note, ML + 5, y + 6.5);
    }

    // Section total
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    if (isMat) {
      doc.setTextColor(176, 73, 47);
    } else {
      doc.setTextColor(22, 50, 61);
    }
    doc.text(money(secTotal), MR - 2, nameY, { align: "right" });
    y += secHdrH;

    // Items in 2-column grid
    if (items.length > 0) {
      const itemRowH = 4;
      const halfCW   = (CW - 3) / 2;
      const c1x      = ML + 3;
      const c2x      = ML + 3 + halfCW;

      for (let i = 0; i < items.length; i += 2) {
        const left  = items[i];
        const right = items[i + 1] ?? null;

        checkPage(itemRowH + 2);

        // Row background + left border
        doc.setFillColor(250, 250, 248);
        doc.rect(c1x, y, CW - 3, itemRowH, "F");
        doc.setFillColor(200, 195, 188);
        doc.rect(ML, y, 3, itemRowH, "F");

        // Row bottom separator + center divider
        doc.setDrawColor(240, 235, 224);
        doc.setLineWidth(0.15);
        doc.line(c1x, y + itemRowH, MR, y + itemRowH);
        doc.line(c2x, y, c2x, y + itemRowH);

        // Left item
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(58, 58, 58);
        doc.text(`• ${left.description}`, c1x + 2, y + 2.8, { maxWidth: halfCW - 22 });
        doc.setFont("helvetica", "bold");
        if (left.amount > 0) {
          doc.setTextColor(22, 50, 61);
          doc.text(money(left.amount), c2x - 2, y + 2.8, { align: "right" });
        } else {
          doc.setTextColor(200, 200, 200);
          doc.text("—", c2x - 2, y + 2.8, { align: "right" });
        }

        // Right item
        if (right) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(58, 58, 58);
          doc.text(`• ${right.description}`, c2x + 2, y + 2.8, { maxWidth: halfCW - 22 });
          doc.setFont("helvetica", "bold");
          if (right.amount > 0) {
            doc.setTextColor(22, 50, 61);
            doc.text(money(right.amount), MR - 2, y + 2.8, { align: "right" });
          } else {
            doc.setTextColor(200, 200, 200);
            doc.text("—", MR - 2, y + 2.8, { align: "right" });
          }
        }
        y += itemRowH;
      }
    }

    // Section divider
    doc.setDrawColor(230, 221, 203);
    doc.setLineWidth(0.15);
    doc.line(ML, y, MR, y);
    y += 1.5;
  }

  // ── Totals + payment schedule (2-column) ───────────────────────────────────
  y += 4;
  checkPage(48);

  const totalsStartY = y;
  const schedW       = 90;
  const schedX       = ML;
  const rightX       = ML + schedW + 5;
  const rightBlockW  = CW - schedW - 5;

  // Payment schedule (left column)
  const schedBoxH = 7 + estimate.deposit_schedule.length * 11 + 2;
  doc.setDrawColor(230, 221, 203);
  doc.setLineWidth(0.3);
  doc.roundedRect(schedX, totalsStartY, schedW, schedBoxH, 2, 2, "D");

  const schedTitle = EN ? "PAYMENT SCHEDULE" : "CALENDARIO DE PAGOS";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(92, 106, 110);
  doc.text(schedTitle, schedX + schedW / 2, totalsStartY + 4.5, { align: "center" });
  const stw = doc.getTextWidth(schedTitle);
  doc.setDrawColor(220, 212, 200);
  doc.setLineWidth(0.15);
  doc.line(schedX + schedW / 2 - stw / 2, totalsStartY + 5.5, schedX + schedW / 2 + stw / 2, totalsStartY + 5.5);

  const depRgb: [number, number, number][] = [
    [57, 88, 134],
    [78, 122, 130],
    [79, 138, 99],
  ];
  let py = totalsStartY + 8;
  for (let i = 0; i < estimate.deposit_schedule.length; i++) {
    const dep = estimate.deposit_schedule[i];
    const rgb = depRgb[i] ?? ([92, 106, 110] as [number, number, number]);
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.roundedRect(schedX + 3, py, 14, 7, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`${dep.pct}%`, schedX + 10, py + 4.8, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(22, 50, 61);
    doc.text(money(grandTotal * dep.pct / 100), schedX + schedW - 3, py + 5.5, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(92, 106, 110);
    doc.text(EN ? dep.label_en : dep.label_es, schedX + 19, py + 5.5);
    py += 11;
  }

  // Grand total bar height — anchored to bottom of payment schedule box
  const gtBarH = 14;
  const gtY    = totalsStartY + schedBoxH - gtBarH;

  // Discount rows (right column, top-aligned)
  if (discountAmt > 0) {
    const discBoxH   = 13;
    const labelMaxW  = rightBlockW - 28;
    doc.setFillColor(247, 243, 234);
    doc.setDrawColor(230, 221, 203);
    doc.setLineWidth(0.2);
    doc.roundedRect(rightX, totalsStartY, rightBlockW, discBoxH, 1.5, 1.5, "FD");

    // Labor subtotal row
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(92, 106, 110);
    doc.text(
      EN ? "Labor subtotal" : "Subtotal mano de obra",
      rightX + 4, totalsStartY + 4.5,
      { maxWidth: labelMaxW },
    );
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 50, 61);
    doc.text(money(laborTotal), rightX + rightBlockW - 3, totalsStartY + 4.5, { align: "right" });

    // Internal divider
    doc.setDrawColor(220, 212, 200);
    doc.setLineWidth(0.15);
    doc.line(rightX + 2, totalsStartY + 7, rightX + rightBlockW - 2, totalsStartY + 7);

    // Discount row — use plain hyphen, Helvetica doesn't render U+2212
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(92, 106, 110);
    doc.text(
      `${estimate.discount_label || "Discount"} (-${estimate.discount_pct}%)`,
      rightX + 4, totalsStartY + 10.5,
      { maxWidth: labelMaxW },
    );
    doc.setFont("helvetica", "bold");
    doc.setTextColor(79, 138, 99);
    doc.text(`-${money(discountAmt)}`, rightX + rightBlockW - 3, totalsStartY + 10.5, { align: "right" });
  }

  // Grand total bar — bottom-aligned with payment schedule rectangle
  doc.setFillColor(22, 50, 61);
  doc.roundedRect(rightX, gtY, rightBlockW, gtBarH, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(EN ? "GRAND TOTAL" : "TOTAL FINAL", rightX + 5, gtY + 5);
  doc.setFontSize(13);
  doc.text(money(grandTotal), rightX + rightBlockW - 4, gtY + 10.5, { align: "right" });

  y = totalsStartY + schedBoxH + 2;

  // ── Footer ─────────────────────────────────────────────────────────────────
  y += 5;
  doc.setDrawColor(230, 221, 203);
  doc.setLineWidth(0.3);
  doc.line(ML, y, MR, y);
  y += 4;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(170, 170, 170);
  doc.text(
    EN
      ? `Contractor: ${branding.contractor}  ·  This estimate is valid for 30 days  ·  Any additional item will be charged with additional change order`
      : `Contratista: ${branding.contractor}  ·  Este estimado tiene validez de 30 días  ·  Cualquier trabajo adicional será cobrado por separado`,
    CX, y,
    { align: "center", maxWidth: CW },
  );

  const filename = `Estimate_${(estimate.project_title || "project").replace(/\s+/g, "_")}.pdf`;
  return { doc, filename };
}

export function exportEstimatePdf(
  estimate: ProjectEstimate,
  grandTotal: number,
  laborTotal: number,
  discountAmt: number,
  language: "en" | "es" = "en",
  projectTitle?: string,
) {
  const { doc, filename } = buildEstimatePdf(estimate, grandTotal, laborTotal, discountAmt, language, projectTitle);
  doc.save(filename);
}

export function getEstimatePdfBlob(
  estimate: ProjectEstimate,
  grandTotal: number,
  laborTotal: number,
  discountAmt: number,
  language: "en" | "es" = "en",
  projectTitle?: string,
): Blob {
  const { doc } = buildEstimatePdf(estimate, grandTotal, laborTotal, discountAmt, language, projectTitle);
  return doc.output("blob") as Blob;
}
