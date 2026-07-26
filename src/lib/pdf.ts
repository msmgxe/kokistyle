/**
 * PDF export utilities using jsPDF.
 * Generates cotización (budget quote) and estado de cuenta (account statement).
 */
import jsPDF from "jspdf";
import type { BudgetItem, Payment, Expense, Project, ProjectEstimate } from "@/src/types/project";
import { money } from "./utils";
import { branding } from "@/src/config/branding";
import { CONTRACTOR_SIGNATURE } from "@/src/config/signature";

const INK  = "#16323D";
const MUTED = "#5C6A6E";
const ACCENT = "#4E7A82";
const LINE = "#E6DDCB";

function fmtDate(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

// Modo inglés: "JULY, 2026" (mes en texto, coma, año) — como el letterhead impreso
const MONTHS_EN = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
function fmtDateEN(d: string) {
  if (!d) return "—";
  const [y, m] = d.split("-");
  return `${MONTHS_EN[parseInt(m, 10) - 1] ?? ""}, ${y}`;
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

function buildEstadoCuenta(project: Project, payments: Payment[], expenses: Expense[]): { doc: jsPDF; filename: string } {
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
  return { doc, filename };
}

export function exportEstadoCuenta(project: Project, payments: Payment[], expenses: Expense[]) {
  const { doc, filename } = buildEstadoCuenta(project, payments, expenses);
  doc.save(filename);
}

export function getEstadoCuentaBlob(project: Project, payments: Payment[], expenses: Expense[]): { blob: Blob; filename: string } {
  const { doc, filename } = buildEstadoCuenta(project, payments, expenses);
  return { blob: doc.output("blob") as Blob, filename };
}

function buildEstimatePdf(
  estimate: ProjectEstimate,
  grandTotal: number,
  laborTotal: number,
  discountAmt: number,
  language: "en" | "es" = "en",
  projectTitle?: string,
  mode: "full" | "summary" = "full",
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

  // ── Letterhead header (justificado a la izquierda + badge PROPOSAL a la derecha) ─
  y = 13;
  doc.setFont("times", "bolditalic");
  doc.setFontSize(19);
  doc.setTextColor(22, 50, 61);
  doc.text("LUXARIS DESIGN LLC.", ML, y);

  const ppW = 36, ppH = 10, ppX = MR - ppW, ppY = 7;
  doc.setFillColor(224, 224, 224);
  doc.setDrawColor(110, 110, 110);
  doc.setLineWidth(0.5);
  doc.roundedRect(ppX, ppY, ppW, ppH, 0.6, 0.6, "FD");
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text(EN ? "PROPOSAL" : "PROPUESTA", ppX + ppW / 2, ppY + 6.6, { align: "center" });

  y += 5.5;
  doc.setFont("times", "italic");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text(branding.slogan, ML, y);
  y += 5;
  doc.setFont("times", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(40, 40, 40);
  doc.text(`Phone : ${branding.phone}     Email : ${branding.email}`, ML, y);
  y += 3;
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

  // ── Info block (cliente / contratista) — el rótulo "PROPOSAL" vive en la cabecera ─
  const infoH = 17;
  doc.setFillColor(247, 243, 234);
  doc.setDrawColor(230, 221, 203);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, y, CW, infoH, 2, 2, "FD");

  const iy  = y + 6;
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
    { l: EN ? "Start Date:"  : "Inicio:",      v: estimate.start_date ? (EN ? fmtDateEN(estimate.start_date) : fmtDate(estimate.start_date)) : "—" },
    { l: EN ? "End Date:"    : "Fecha fin:",   v: estimate.end_date   ? (EN ? fmtDateEN(estimate.end_date)   : fmtDate(estimate.end_date))   : "—" },
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
  doc.text(
    mode === "summary"
      ? (EN ? "SCOPE OF WORK" : "ALCANCE DE TRABAJO")
      : (EN ? "SECTION / ITEM" : "SECCIÓN / PARTIDA"),
    ML + 4, y + 4.8,
  );
  if (mode === "full") {
    doc.text(EN ? "AMOUNT (USD)" : "MONTO (USD)", MR - 2, y + 4.8, { align: "right" });
  }
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

    // Section name — 8.5pt
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

    // Section total (full mode only) — 9pt
    if (mode === "full") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(isMat ? 176 : 22, isMat ? 73 : 50, isMat ? 47 : 61);
      doc.text(money(secTotal), MR - 2, nameY, { align: "right" });
    }
    y += secHdrH;

    // Items in 2-column grid — 6.5pt (2pt less than 8.5pt title)
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

        // Left item — 6.5pt
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(58, 58, 58);
        const leftMaxW = mode === "summary" ? halfCW - 6 : halfCW - 22;
        doc.text(`• ${left.description}`, c1x + 2, y + 2.8, { maxWidth: leftMaxW });
        if (mode === "full") {
          doc.setFont("helvetica", "bold");
          if (left.amount > 0) {
            doc.setTextColor(22, 50, 61);
            doc.text(money(left.amount), c2x - 2, y + 2.8, { align: "right" });
          } else {
            doc.setTextColor(200, 200, 200);
            doc.text("—", c2x - 2, y + 2.8, { align: "right" });
          }
        }

        // Right item — 6.5pt
        if (right) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.5);
          doc.setTextColor(58, 58, 58);
          const rightMaxW = mode === "summary" ? halfCW - 6 : halfCW - 22;
          doc.text(`• ${right.description}`, c2x + 2, y + 2.8, { maxWidth: rightMaxW });
          if (mode === "full") {
            doc.setFont("helvetica", "bold");
            if (right.amount > 0) {
              doc.setTextColor(22, 50, 61);
              doc.text(money(right.amount), MR - 2, y + 2.8, { align: "right" });
            } else {
              doc.setTextColor(200, 200, 200);
              doc.text("—", MR - 2, y + 2.8, { align: "right" });
            }
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

  // ── Payment schedule (ancho completo) + totales debajo, a la derecha ───────
  y += 4;
  const schedRowH = 9;
  const schedBoxH = 9 + estimate.deposit_schedule.length * schedRowH + 1;
  const belowH    = (discountAmt > 0 ? 15 : 0) + 14;
  checkPage(schedBoxH + belowH + 8);

  const schedX = ML, schedW = CW, schedY = y;
  doc.setDrawColor(230, 221, 203); doc.setLineWidth(0.3);
  doc.roundedRect(schedX, schedY, schedW, schedBoxH, 2, 2, "D");

  const schedTitle = EN ? "PAYMENT SCHEDULE" : "CALENDARIO DE PAGOS";
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(92, 106, 110);
  doc.text(schedTitle, schedX + schedW / 2, schedY + 5, { align: "center" });
  const stw = doc.getTextWidth(schedTitle);
  doc.setDrawColor(220, 212, 200); doc.setLineWidth(0.15);
  doc.line(schedX + schedW / 2 - stw / 2, schedY + 6, schedX + schedW / 2 + stw / 2, schedY + 6);

  const depRgb: [number, number, number][] = [[57, 88, 134], [78, 122, 130], [79, 138, 99]];
  const amountX = schedX + schedW - 4;
  const labelX  = schedX + 23;
  let py = schedY + 9.5;
  for (let i = 0; i < estimate.deposit_schedule.length; i++) {
    const dep = estimate.deposit_schedule[i];
    const rgb = depRgb[i] ?? ([92, 106, 110] as [number, number, number]);
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.roundedRect(schedX + 3, py, 15, 7, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(255, 255, 255);
    doc.text(`${dep.pct}%`, schedX + 10.5, py + 4.8, { align: "center" });
    // Monto a la derecha
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(22, 50, 61);
    const amtStr = money(grandTotal * dep.pct / 100);
    const amtW   = doc.getTextWidth(amtStr);
    doc.text(amtStr, amountX, py + 4.9, { align: "right" });
    // Glosa con maxWidth para no chocar con el monto
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(92, 106, 110);
    doc.text(EN ? dep.label_en : dep.label_es, labelX, py + 4.9, { maxWidth: amountX - amtW - labelX - 6 });
    py += schedRowH;
  }

  // Totales debajo del schedule, alineados a la derecha
  let ty = schedY + schedBoxH + 5;
  const totW = 84, tX = MR - totW;
  if (discountAmt > 0) {
    const boxH = 13;
    doc.setFillColor(247, 243, 234); doc.setDrawColor(230, 221, 203); doc.setLineWidth(0.2);
    doc.roundedRect(tX, ty, totW, boxH, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(92, 106, 110);
    doc.text(EN ? "Labor subtotal" : "Subtotal mano de obra", tX + 4, ty + 4.5, { maxWidth: totW - 28 });
    doc.setFont("helvetica", "bold"); doc.setTextColor(22, 50, 61);
    doc.text(money(laborTotal), tX + totW - 3, ty + 4.5, { align: "right" });
    doc.setDrawColor(220, 212, 200); doc.setLineWidth(0.15);
    doc.line(tX + 2, ty + 7, tX + totW - 2, ty + 7);
    // Guion normal — Helvetica no renderiza U+2212
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(92, 106, 110);
    doc.text(`${estimate.discount_label || "Discount"} (-${estimate.discount_pct}%)`, tX + 4, ty + 10.5, { maxWidth: totW - 28 });
    doc.setFont("helvetica", "bold"); doc.setTextColor(79, 138, 99);
    doc.text(`-${money(discountAmt)}`, tX + totW - 3, ty + 10.5, { align: "right" });
    ty += boxH + 2;
  }
  const gtBarH = 14;
  doc.setFillColor(22, 50, 61); doc.roundedRect(tX, ty, totW, gtBarH, 2, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(255, 255, 255);
  doc.text(EN ? "GRAND TOTAL" : "TOTAL FINAL", tX + 5, ty + 5.5);
  doc.setFontSize(13);
  doc.text(money(grandTotal), tX + totW - 4, ty + 10.5, { align: "right" });

  y = ty + gtBarH + 2;

  // ── Footer ─────────────────────────────────────────────────────────────────
  y += 5;
  doc.setDrawColor(230, 221, 203);
  doc.setLineWidth(0.3);
  doc.line(ML, y, MR, y);
  y += 4;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(22, 50, 61); // mismo color que los nombres de las firmas (bold)
  doc.text(
    EN
      ? `Contractor: ${branding.contractor}  ·  This estimate is valid for 30 days  ·  Any additional item will be charged with additional change order`
      : `Contratista: ${branding.contractor}  ·  Este estimado tiene validez de 30 días  ·  Cualquier trabajo adicional será cobrado por separado`,
    CX, y,
    { align: "center", maxWidth: CW },
  );

  // ── Firmas: ancladas al pie de la página para intentar caber en la 1ª ────────
  const sigLineY = 262;               // línea de firma cerca del pie (A4 usable ~285)
  const sigImgW = 28, sigImgH = 24;   // firma del constructor (aspecto ~1.17, sin deformar)
  // Si el contenido ya bajó demasiado, el bloque no cabe → pasa a página nueva
  if (y + 6 > sigLineY - sigImgH) { doc.addPage(); }
  y = sigLineY;
  const sigW = 72;
  const slx1 = ML + 8, slx2 = slx1 + sigW;
  const srx2 = MR - 8, srx1 = srx2 - sigW;
  // Firma digital del constructor sobre su línea (si está configurada)
  if (CONTRACTOR_SIGNATURE) {
    const fmt = /^data:image\/jpe?g/i.test(CONTRACTOR_SIGNATURE) ? "JPEG" : "PNG";
    try {
      doc.addImage(CONTRACTOR_SIGNATURE, fmt, (slx1 + slx2) / 2 - sigImgW / 2, y - sigImgH - 0.5, sigImgW, sigImgH);
    } catch { /* firma inválida → se omite */ }
  }
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(slx1, y, slx2, y);
  doc.line(srx1, y, srx2, y);
  y += 5;
  // Fuente del cuerpo del estimado (helvetica), no la serif del letterhead
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(92, 106, 110);
  doc.text(EN ? "CONTRACTOR" : "CONTRATISTA", (slx1 + slx2) / 2, y, { align: "center" });
  doc.text(EN ? "CUSTOMER" : "CLIENTE", (srx1 + srx2) / 2, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(22, 50, 61);
  doc.text(branding.contractor.toUpperCase(), (slx1 + slx2) / 2, y, { align: "center" });
  doc.text((estimate.customer_name || "—").toUpperCase(), (srx1 + srx2) / 2, y, { align: "center" });

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
  mode: "full" | "summary" = "full",
) {
  const { doc, filename } = buildEstimatePdf(estimate, grandTotal, laborTotal, discountAmt, language, projectTitle, mode);
  doc.save(filename);
}

export function openEstimatePdfInBrowser(
  estimate: ProjectEstimate,
  grandTotal: number,
  laborTotal: number,
  discountAmt: number,
  language: "en" | "es" = "en",
  projectTitle?: string,
  mode: "full" | "summary" = "full",
) {
  const { doc } = buildEstimatePdf(estimate, grandTotal, laborTotal, discountAmt, language, projectTitle, mode);
  const blob = doc.output("blob") as Blob;
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function getEstimatePdfBlob(
  estimate: ProjectEstimate,
  grandTotal: number,
  laborTotal: number,
  discountAmt: number,
  language: "en" | "es" = "en",
  projectTitle?: string,
  mode: "full" | "summary" = "full",
): Blob {
  const { doc } = buildEstimatePdf(estimate, grandTotal, laborTotal, discountAmt, language, projectTitle, mode);
  return doc.output("blob") as Blob;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FACTURA (Invoice) — Opción 1 "Clásica", bilingüe. Reusa el letterhead del Estimate.
// ═══════════════════════════════════════════════════════════════════════════════
export interface InvoiceData {
  invoiceNo: string;
  date: string;                 // texto a mostrar (ej. "FEB. 04, 2026")
  language: "en" | "es";
  client: {
    name: string; company?: string; address?: string; city?: string;
    phone?: string; email?: string; website?: string;
  };
  lines: { description: string; amount: number }[];
}

function buildInvoicePdf(inv: InvoiceData): { doc: jsPDF; filename: string } {
  const EN  = inv.language === "en";
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W   = doc.internal.pageSize.getWidth();
  const CX  = W / 2, ML = 10, MR = W - 10, CW = MR - ML;
  let y = 13;

  // ── Letterhead (igual que el Estimate) ──
  doc.setFont("times", "bolditalic"); doc.setFontSize(19); doc.setTextColor(22, 50, 61);
  doc.text("LUXARIS DESIGN LLC.", ML, y);

  const badge = EN ? "INVOICE" : "FACTURA";
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  const bw = doc.getTextWidth(badge) + 12;
  doc.setDrawColor(22, 50, 61); doc.setLineWidth(0.6);
  doc.roundedRect(MR - bw, 7, bw, 9, 1, 1, "S");
  doc.setTextColor(22, 50, 61);
  doc.text(badge, MR - bw / 2, 13.2, { align: "center" });

  y += 5.5;
  doc.setFont("times", "italic"); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
  doc.text(branding.slogan, ML, y);
  y += 5;
  doc.setFont("times", "normal"); doc.setFontSize(9.5);
  doc.text(`Phone : ${branding.phone}     Email : ${branding.email}`, ML, y);

  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(22, 50, 61);
  doc.text(`${EN ? "INVOICE #" : "FACTURA #"} ${inv.invoiceNo}`, MR, 22, { align: "right" });
  doc.text(inv.date, MR, 26.5, { align: "right" });

  y += 4;
  doc.setDrawColor(22, 50, 61); doc.setLineWidth(0.5); doc.line(ML, y, MR, y);
  y += 8;

  // ── FROM / BILL TO ──
  const colX = CX + 4;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(150, 150, 150);
  doc.text(EN ? "FROM" : "DE", ML, y);
  doc.text(EN ? "BILL TO" : "FACTURAR A", colX, y);

  const fromLines = [branding.streetAddress, branding.cityStateZip, branding.phone];
  const c = inv.client;
  const billLines: { t: string; bold?: boolean }[] = [];
  if (c.name)    billLines.push({ t: c.name, bold: true });
  if (c.company) billLines.push({ t: c.company, bold: true });
  if (c.address) billLines.push({ t: c.address });
  if (c.city)    billLines.push({ t: c.city });
  const pe = [c.phone, c.email].filter(Boolean).join("  ·  ");
  if (pe)        billLines.push({ t: pe });
  if (c.website) billLines.push({ t: c.website });

  const fy0 = y + 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(40, 40, 40);
  fromLines.forEach((l, i) => doc.text(l, ML, fy0 + i * 4.4));
  let by = fy0;
  billLines.forEach((l) => {
    doc.setFont("helvetica", l.bold ? "bold" : "normal");
    if (l.bold) doc.setTextColor(22, 50, 61); else doc.setTextColor(40, 40, 40);
    doc.text(l.t, colX, by, { maxWidth: MR - colX });
    by += 4.4;
  });
  y = Math.max(fy0 + fromLines.length * 4.4, by) + 5;

  // ── Tabla ──
  doc.setFillColor(22, 50, 61); doc.rect(ML, y, CW, 8, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
  const cQty = ML + 3, cDesc = ML + 32, cUnit = MR - 42, cTot = MR - 3;
  doc.text(EN ? "QUANTITY" : "CANTIDAD", cQty, y + 5.3);
  doc.text(EN ? "DESCRIPTION" : "DESCRIPCIÓN", cDesc, y + 5.3);
  doc.text(EN ? "UNIT PRICE" : "P. UNIT.", cUnit, y + 5.3, { align: "right" });
  doc.text("TOTAL", cTot, y + 5.3, { align: "right" });
  y += 8;

  const rowH = 8;
  const shownLines = inv.lines.length ? inv.lines : [{ description: EN ? "(no items selected)" : "(sin items seleccionados)", amount: 0 }];
  shownLines.forEach((ln, i) => {
    if (i % 2 === 1) { doc.setFillColor(247, 243, 234); doc.rect(ML, y, CW, rowH, "F"); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(40, 40, 40);
    doc.text("1", cQty + 9, y + 5.3, { align: "center" });
    doc.text(ln.description, cDesc, y + 5.3, { maxWidth: cUnit - cDesc - 4 });
    doc.setTextColor(150, 150, 150); doc.text("—", cUnit, y + 5.3, { align: "right" });
    doc.setFont("helvetica", "bold"); doc.setTextColor(22, 50, 61);
    doc.text(money(ln.amount), cTot, y + 5.3, { align: "right" });
    doc.setDrawColor(230, 221, 203); doc.setLineWidth(0.2); doc.line(ML, y + rowH, MR, y + rowH);
    y += rowH;
  });
  y += 8;

  // ── TOTAL DUE ──
  const total = inv.lines.reduce((s, l) => s + l.amount, 0);
  const boxW = 46, boxH = 11, boxX = MR - boxW, boxY = y;
  doc.setFillColor(22, 50, 61); doc.roundedRect(boxX, boxY, boxW, boxH, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(255, 255, 255);
  doc.text(money(total), boxX + boxW - 4, boxY + 7.6, { align: "right" });
  doc.setTextColor(92, 106, 110); doc.setFontSize(10.5);
  doc.text(EN ? "TOTAL DUE" : "TOTAL A PAGAR", boxX - 4, boxY + 7.6, { align: "right" });
  y += boxH + 13;

  // ── Notas + gracias ──
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(60, 60, 60);
  doc.text(EN ? "Make all checks payable to LUXARIS DESIGN LLC." : "Emitir todos los cheques a nombre de LUXARIS DESIGN LLC.", ML, y);
  y += 4.6;
  doc.text(
    EN ? `If you have any questions concerning this invoice, contact ${branding.contractor} at the number or email above.`
       : `Cualquier pregunta sobre esta factura, contacte a ${branding.contractor} al teléfono o correo de arriba.`,
    ML, y, { maxWidth: CW });
  y += 15;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(22, 50, 61);
  doc.text(EN ? "THANK YOU FOR YOUR BUSINESS!" : "¡GRACIAS POR SU PREFERENCIA!", CX, y, { align: "center" });

  const filename = `Invoice_${(inv.invoiceNo || "Luxaris").replace(/\s+/g, "-")}.pdf`;
  return { doc, filename };
}

export function exportInvoicePdf(inv: InvoiceData) {
  const { doc, filename } = buildInvoicePdf(inv);
  doc.save(filename);
}
export function openInvoicePdfInBrowser(inv: InvoiceData) {
  const { doc } = buildInvoicePdf(inv);
  const url = URL.createObjectURL(doc.output("blob") as Blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export function getInvoicePdfBlob(inv: InvoiceData): Blob {
  const { doc } = buildInvoicePdf(inv);
  return doc.output("blob") as Blob;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GANTT — cronograma en PDF horizontal (landscape). Una columna por día, cabecera
//  mes/día, fin de semana teñido, línea de hoy y barra por estado con avance.
// ═══════════════════════════════════════════════════════════════════════════════

export interface GanttPdfRow {
  name: string;
  start: string;   // ISO yyyy-mm-dd
  end: string;     // ISO yyyy-mm-dd (inclusivo)
  status: string;  // 'done' | 'prog' | 'pend'
  progress: number;
  assignee?: string;
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function gParseIso(s: string): Date { return new Date(s + "T00:00:00"); }
function gIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function gDiff(a: string, b: string): number {
  return Math.round((gParseIso(b).getTime() - gParseIso(a).getTime()) / 86400000);
}
function gSnapMonday(s: string): string {
  const d = gParseIso(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return gIso(d);
}

const GBAR: Record<string, string> = { done: "#4F8A63", prog: "#4E7A82", pend: "#C9BFA8" };
const G_SAT = "#DCEBF7", G_SUN = "#FBE5D3", G_GRID = "#EFE9DD";

function buildGanttPdf(project: Project, rows: GanttPdfRow[], language: "en" | "es"): { doc: jsPDF; filename: string } {
  const EN = language === "en";
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  let yTop = header(doc, EN ? "Project Schedule — Gantt" : "Cronograma del Proyecto — Gantt", project);
  yTop += 2;

  // Rango de fechas (padded a semana completa)
  let minIso = rows.length ? rows[0].start : gIso(new Date());
  let maxIso = rows.length ? rows[0].end : minIso;
  rows.forEach(r => { if (r.start < minIso) minIso = r.start; if (r.end > maxIso) maxIso = r.end; });
  const start = gSnapMonday(minIso);
  const rawDays = Math.max(gDiff(start, maxIso) + 1, 14);
  const totalDays = Math.ceil(rawDays / 7) * 7;

  const ML = 12, LW = 62;              // margen izq + ancho columna de tareas
  const x0 = ML + LW;                  // inicio del timeline
  const TW = W - ML - x0;              // ancho del timeline
  const colW = TW / totalDays;
  const RH = 7.2;                      // alto de fila
  const todayIso = gIso(new Date());

  const MO = EN
    ? ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"]
    : ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];

  const dayX = (iso: string) => x0 + Math.min(Math.max(gDiff(start, iso), 0), totalDays) * colW;

  // Dibuja la cabecera del calendario (mes + nº día + fin de semana) y devuelve la Y de inicio de filas
  const drawAxis = (y: number): number => {
    const days: Date[] = [];
    for (let i = 0; i < totalDays; i++) { const d = gParseIso(start); d.setDate(d.getDate() + i); days.push(d); }
    // Banda de meses
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
    let segStart = 0;
    for (let i = 1; i <= days.length; i++) {
      const changed = i === days.length || days[i].getMonth() !== days[segStart].getMonth();
      if (changed) {
        const sx = x0 + segStart * colW, wpx = (i - segStart) * colW;
        doc.setFillColor(...hexRgb(ACCENT));
        doc.rect(sx, y, wpx, 5, "F");
        const lbl = `${MO[days[segStart].getMonth()]} ${days[segStart].getFullYear()}`;
        if (wpx > 12) doc.text(lbl, sx + wpx / 2, y + 3.4, { align: "center" });
        segStart = i;
      }
    }
    // Etiqueta columna izquierda
    doc.setFillColor(...hexRgb(INK)); doc.rect(ML, y, LW, 5, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(7);
    doc.text(EN ? "TASK" : "TAREA", ML + 3, y + 3.4);
    // Números de día + fin de semana
    const dy = y + 5;
    doc.setFontSize(5.6);
    days.forEach((d, i) => {
      const cx = x0 + i * colW; const wd = d.getDay();
      if (wd === 6) { doc.setFillColor(...hexRgb(G_SAT)); doc.rect(cx, dy, colW, 4, "F"); }
      else if (wd === 0) { doc.setFillColor(...hexRgb(G_SUN)); doc.rect(cx, dy, colW, 4, "F"); }
      doc.setTextColor(...hexRgb(MUTED));
      if (colW > 2.4) doc.text(String(d.getDate()), cx + colW / 2, dy + 2.8, { align: "center" });
    });
    doc.setDrawColor(...hexRgb(LINE)); doc.setLineWidth(0.2);
    doc.line(ML, dy + 4, W - ML, dy + 4);
    return dy + 4;
  };

  const paint = (rowsToDraw: GanttPdfRow[], y0: number) => {
    const areaBottom = y0 + rowsToDraw.length * RH;
    // Fin de semana a lo alto del área + grilla semanal
    for (let i = 0; i < totalDays; i++) {
      const d = gParseIso(start); d.setDate(d.getDate() + i);
      const cx = x0 + i * colW; const wd = d.getDay();
      if (wd === 6) { doc.setFillColor(...hexRgb(G_SAT)); doc.rect(cx, y0, colW, areaBottom - y0, "F"); }
      else if (wd === 0) { doc.setFillColor(...hexRgb(G_SUN)); doc.rect(cx, y0, colW, areaBottom - y0, "F"); }
      if (wd === 1) { doc.setDrawColor(...hexRgb(G_GRID)); doc.setLineWidth(0.15); doc.line(cx, y0, cx, areaBottom); }
    }
    // Línea de hoy
    if (gDiff(start, todayIso) >= 0 && gDiff(start, todayIso) < totalDays) {
      doc.setDrawColor(176, 73, 47); doc.setLineWidth(0.5);
      doc.line(dayX(todayIso), y0, dayX(todayIso), areaBottom);
    }
    // Filas
    rowsToDraw.forEach((r, i) => {
      const ry = y0 + i * RH;
      if (i % 2 === 0) { doc.setFillColor(250, 249, 246); doc.rect(ML, ry, W - 2 * ML, RH, "F"); }
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...hexRgb(INK));
      doc.text(r.name.length > 42 ? r.name.slice(0, 41) + "…" : r.name, ML + 2, ry + RH / 2 + 1.4);
      // Barra
      const bx = dayX(r.start);
      const bw = Math.max((gDiff(r.start, r.end) + 1) * colW, 1.5);
      const bh = 3.4, by = ry + (RH - bh) / 2;
      doc.setFillColor(...hexRgb(GBAR[r.status] ?? GBAR.pend));
      doc.roundedRect(bx, by, bw, bh, 0.8, 0.8, "F");
      const pw = Math.max(0, Math.min(1, (r.progress ?? 0) / 100)) * bw;
      if (pw > 0.5) { doc.setFillColor(...hexRgb("#3C7350")); doc.roundedRect(bx, by, pw, bh, 0.8, 0.8, "F"); }
    });
    doc.setDrawColor(...hexRgb(LINE)); doc.setLineWidth(0.2);
    doc.line(ML, areaBottom, W - ML, areaBottom);
    return areaBottom;
  };

  // Paginación simple
  const usable = H - 16;
  let idx = 0;
  let firstPage = true;
  while (idx < rows.length || firstPage) {
    const y = firstPage ? yTop : 12;
    const axisBottom = drawAxis(y);
    const perPage = Math.max(1, Math.floor((usable - axisBottom) / RH));
    const slice = rows.slice(idx, idx + perPage);
    paint(slice, axisBottom + 1);
    idx += perPage;
    firstPage = false;
    if (idx < rows.length) doc.addPage();
    else break;
  }

  // Leyenda
  const ly = H - 6;
  doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
  const legend: [string, string][] = [
    [EN ? "Done" : "Terminado", GBAR.done],
    [EN ? "In progress" : "En obra", GBAR.prog],
    [EN ? "Pending" : "Pendiente", GBAR.pend],
    [EN ? "Saturday" : "Sábado", "#9DC3E6"],
    [EN ? "Sunday" : "Domingo", G_SUN],
  ];
  let lx = ML;
  legend.forEach(([lbl, col]) => {
    doc.setFillColor(...hexRgb(col)); doc.rect(lx, ly - 2.4, 3, 3, "F");
    doc.setTextColor(...hexRgb(MUTED)); doc.text(lbl, lx + 4, ly);
    lx += 6 + doc.getTextWidth(lbl) + 4;
  });

  const filename = `Gantt_${project.title.replace(/\s+/g, "_")}.pdf`;
  return { doc, filename };
}

export function getGanttPdfBlob(project: Project, rows: GanttPdfRow[], language: "en" | "es"): { blob: Blob; filename: string } {
  const { doc, filename } = buildGanttPdf(project, rows, language);
  return { blob: doc.output("blob") as Blob, filename };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  REPORTE DE PENDIENTES — objetivos (checklist) + notas de varios proyectos
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReportGroup {
  title: string;
  client?: string;
  objectives: { text: string; done: boolean }[];
  tasks: { name: string; date?: string }[];
  notes: { content: string; date: string }[];
}
export interface ReportOpts {
  includeObjectives: boolean;
  includeTasks: boolean;
  includeNotes: boolean;
  pendingOnly: boolean;
  groupByProject: boolean;   // true = por proyecto; false = una lista única global
}

function buildPendientesReport(groups: ReportGroup[], opts: ReportOpts, language: "en" | "es"): { doc: jsPDF; filename: string } {
  const EN = language === "en";
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const ML = 14, MR = W - 14;

  doc.setFillColor(22, 50, 61); doc.rect(0, 0, W, 20, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(255, 255, 255);
  doc.text(branding.companyName, ML, 13);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(fmtDate(new Date().toISOString().split("T")[0]), MR, 13, { align: "right" });

  let y = 30;
  doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.setTextColor(INK);
  doc.text(EN ? "Pending items report" : "Reporte de pendientes", ML, y);
  y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(MUTED);
  doc.text(EN ? `${groups.length} project(s)` : `${groups.length} proyecto(s)`, ML, y);
  y += 6;
  doc.setDrawColor(LINE); doc.setLineWidth(0.4); doc.line(ML, y, MR, y);
  y += 8;

  const ensure = (need: number) => { if (y + need > H - 14) { doc.addPage(); y = 20; } };
  const sectionHead = (label: string) => { doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(ACCENT); doc.text(label, ML + 2, y); y += 5; };
  const emptyLine = (txt: string) => { doc.setTextColor(MUTED); doc.setFont("helvetica", "italic"); doc.setFontSize(9.5); doc.text(txt, ML + 5, y); y += 6; };

  const drawObjective = (o: { text: string; done: boolean }, suffix?: string) => {
    const txt = suffix ? `${o.text}  · ${suffix}` : o.text;
    const lines = doc.splitTextToSize(txt, MR - ML - 12) as string[];
    ensure(lines.length * 5 + 2);
    doc.setDrawColor(o.done ? "#4F8A63" : "#B0492F"); doc.setLineWidth(0.4);
    doc.roundedRect(ML + 4, y - 3.4, 3.6, 3.6, 0.6, 0.6);
    if (o.done) { doc.setFontSize(7); doc.setTextColor("#4F8A63"); doc.setFont("helvetica", "bold"); doc.text("X", ML + 4.9, y - 0.7); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(o.done ? MUTED : INK);
    doc.text(lines, ML + 10, y);
    y += lines.length * 5 + 1;
  };
  const drawTask = (tk: { name: string; date?: string }, suffix?: string) => {
    const txt = suffix ? `${tk.name}  · ${suffix}` : tk.name;
    const lines = doc.splitTextToSize(txt, MR - ML - 14) as string[];
    ensure(lines.length * 5 + 2);
    doc.setFillColor(224, 138, 42); doc.circle(ML + 5.6, y - 1.4, 0.9, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(INK);
    doc.text(lines, ML + 10, y);
    if (tk.date) { doc.setTextColor(MUTED); doc.setFontSize(8); doc.text(fmtDate(tk.date), MR - 3, y, { align: "right" }); }
    y += lines.length * 5 + 1;
  };
  const drawNote = (n: { content: string; date: string }, suffix?: string) => {
    const txt = suffix ? `${n.content}  · ${suffix}` : n.content;
    const lines = doc.splitTextToSize(txt, MR - ML - 26) as string[];
    ensure(Math.max(lines.length * 5, 5) + 4);
    doc.setTextColor("#B98A2F"); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.text(fmtDate(n.date), ML + 4, y);
    doc.setTextColor(INK); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    doc.text(lines, ML + 22, y);
    y += Math.max(lines.length * 5, 5) + 1;
  };

  if (opts.groupByProject) {
    for (const g of groups) {
      ensure(16);
      doc.setFillColor(237, 227, 207); doc.roundedRect(ML, y - 5, MR - ML, 9, 1.5, 1.5, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(INK);
      doc.text(g.title, ML + 3, y + 1.2);
      if (g.client) { doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(MUTED); doc.text(g.client, MR - 3, y + 1.2, { align: "right" }); }
      y += 10;

      if (opts.includeObjectives) {
        const objs = opts.pendingOnly ? g.objectives.filter(o => !o.done) : g.objectives;
        sectionHead(EN ? "OBJECTIVES" : "OBJETIVOS");
        if (objs.length === 0) emptyLine(EN ? "— none" : "— ninguno"); else objs.forEach(o => drawObjective(o));
        y += 2;
      }
      if (opts.includeTasks) {
        sectionHead(EN ? "PENDING TASKS" : "TAREAS PENDIENTES");
        if (g.tasks.length === 0) emptyLine(EN ? "— none" : "— ninguna"); else g.tasks.forEach(tk => drawTask(tk));
        y += 2;
      }
      if (opts.includeNotes) {
        sectionHead(EN ? "NOTES" : "NOTAS");
        if (g.notes.length === 0) emptyLine(EN ? "— none" : "— ninguna"); else g.notes.forEach(n => drawNote(n));
      }
      y += 5;
    }
  } else {
    // Lista única global: cada sección junta ítems de todos los proyectos con su nombre
    if (opts.includeObjectives) {
      sectionHead(EN ? "PENDING OBJECTIVES" : "OBJETIVOS PENDIENTES");
      const all = groups.flatMap(g => (opts.pendingOnly ? g.objectives.filter(o => !o.done) : g.objectives).map(o => ({ o, p: g.title })));
      if (!all.length) emptyLine(EN ? "— none" : "— ninguno"); else all.forEach(({ o, p }) => drawObjective(o, p));
      y += 4;
    }
    if (opts.includeTasks) {
      sectionHead(EN ? "PENDING TASKS" : "TAREAS PENDIENTES");
      const all = groups.flatMap(g => g.tasks.map(tk => ({ tk, p: g.title })));
      if (!all.length) emptyLine(EN ? "— none" : "— ninguna"); else all.forEach(({ tk, p }) => drawTask(tk, p));
      y += 4;
    }
    if (opts.includeNotes) {
      sectionHead(EN ? "NOTES" : "NOTAS");
      const all = groups.flatMap(g => g.notes.map(n => ({ n, p: g.title })));
      if (!all.length) emptyLine(EN ? "— none" : "— ninguna"); else all.forEach(({ n, p }) => drawNote(n, p));
    }
  }

  const filename = `Pendientes_${new Date().toISOString().split("T")[0]}.pdf`;
  return { doc, filename };
}

export function getPendientesReportBlob(groups: ReportGroup[], opts: ReportOpts, language: "en" | "es"): { blob: Blob; filename: string } {
  const { doc, filename } = buildPendientesReport(groups, opts, language);
  return { blob: doc.output("blob") as Blob, filename };
}
