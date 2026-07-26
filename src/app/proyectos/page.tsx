"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, MapPin, User, X, Trash2, Pencil, Camera, ClipboardList } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import {
  money,
  dateFmt,
  totalIncome,
  totalExpense,
  balanceDue,
  cashFlow,
  paymentPct,
  advancePct,
} from "@/src/lib/utils";
import type { Project, Payment, Expense, Task } from "@/src/types/project";

type KpiType = "projects" | "budgeted" | "income" | "expenses" | "outstanding" | "cashflow";
import ProjectFormModal from "@/src/components/ui/ProjectFormModal";
import ReportBuilder from "@/src/components/ui/ReportBuilder";
import ProjectThumb from "@/src/components/ui/ProjectThumb";
import { useVoice } from "@/src/context/VoiceContext";
import { branding } from "@/src/config/branding";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";

interface ProjectWithData extends Project {
  payments: Payment[];
  expenses: Expense[];
  tasks: Task[];
  hasEstimate?: boolean;
}

// Queries estimate totals independently and overwrites project.budget
async function enrichWithEstimateBudgets(projects: Project[]): Promise<ProjectWithData[]> {
  if (projects.length === 0) return projects as ProjectWithData[];

  const projectIds = projects.map(p => p.id);

  const { data: ests } = await supabase
    .from("project_estimates")
    .select("id, project_id, discount_pct")
    .in("project_id", projectIds);

  if (!ests || ests.length === 0) return projects as ProjectWithData[];

  const estIds = ests.map(e => e.id);
  const { data: secs } = await supabase
    .from("estimate_sections")
    .select("estimate_id, section_total, is_material_type, estimate_items(amount)")
    .in("estimate_id", estIds);

  const budgetByProject = new Map<string, number>();
  for (const est of ests) {
    const estSecs = (secs ?? []).filter(s => s.estimate_id === est.id);
    let all = 0, labor = 0;
    for (const s of estSecs) {
      const itemsSum = ((s.estimate_items ?? []) as Array<{ amount: number }>)
        .reduce((a, i) => a + i.amount, 0);
      const st = itemsSum > 0 ? itemsSum : s.section_total;
      all += st;
      if (!s.is_material_type) labor += st;
    }
    const disc = Math.round(labor * ((est.discount_pct ?? 0) / 100) * 100) / 100;
    budgetByProject.set(est.project_id, all - disc);
  }

  return projects.map(p => ({
    ...p,
    budget: budgetByProject.has(p.id) ? budgetByProject.get(p.id)! : p.budget,
    hasEstimate: budgetByProject.has(p.id),
  })) as ProjectWithData[];
}

function KpiCard({
  label,
  value,
  sub,
  variant = "neutral",
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  variant?: "up" | "down" | "neutral";
  onClick?: () => void;
}) {
  const colors = {
    up: "text-[#4F8A63]",
    down: "text-[#B0492F]",
    neutral: "text-[var(--brand)]",
  };
  return (
    <div
      className={`rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-4 transition-all${onClick ? " cursor-pointer hover:border-[var(--accent)]/40 hover:shadow-md active:scale-[0.98]" : ""}`}
      onClick={onClick}
    >
      <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E] dark:text-[#9fb0cc]">
        {label}
      </div>
      <div className={`mt-2 font-mono text-2xl font-semibold tracking-tight ${colors[variant]}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-[#5C6A6E] dark:text-[#9fb0cc]">{sub}</div>}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const { t } = useLanguage();
  const styles: Record<string, string> = {
    prospecto: "bg-[#E3E8EE] dark:bg-[#111a2e] text-[#44586B] dark:text-[#9fb0cc]",
    presupuesto: "bg-[#DCE6E6] dark:bg-[#122a2c] text-[#0E2630] dark:text-[#e8edf7]",
    aprobado: "bg-[#DCE8E9] dark:bg-[#122a2c] text-[#4E7A82]",
    en_obra: "bg-[#EDE3CF] dark:bg-[#17233d] text-[#7A6230]",
    terminado: "bg-[#DCEBDD] dark:bg-[#14261c] text-[#4F8A63]",
  };
  const statusLabels = t.panel.status;
  const label = statusLabels[status as keyof typeof statusLabels] ?? status;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function ProgressBar({
  label,
  pct,
  valueLabel,
  color,
}: {
  label: string;
  pct: number;
  valueLabel: string;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[11px] font-semibold text-[#5C6A6E] dark:text-[#9fb0cc]">
        <span>{label}</span>
        <span className="font-mono text-[var(--brand)]">{valueLabel}</span>
      </div>
      <div className="h-[7px] overflow-hidden rounded-full bg-[#E6DDCB] dark:bg-[#17233d]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  budget,
  canDelete,
  onDelete,
  onEdit,
}: {
  project: ProjectWithData;
  budget: number;
  canDelete: boolean;
  onDelete: (id: string) => void;
  onEdit: (p: ProjectWithData) => void;
}) {
  const { t, language } = useLanguage();
  const EN = language === "en";
  const tp = t.panel;
  const inc = totalIncome(project.payments);
  const adv = advancePct(project.tasks);
  const pp = paymentPct(budget, project.payments);
  const paid = balanceDue(budget, project.payments) <= 0;
  const [showConfirm, setShowConfirm] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);

  return (
    <>
    <div className="relative overflow-hidden rounded-[18px] border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]">

      {/* Cover photo */}
      {project.photo_url && (
        <button
          type="button"
          onClick={() => setPhotoOpen(true)}
          className="relative block h-36 w-full overflow-hidden"
          aria-label={tp.project.photoView}
        >
          <img src={project.photo_url} alt="" className="h-full w-full object-cover transition hover:scale-105 duration-300" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/35 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
            <Camera size={10} /> {tp.project.photoView}
          </div>
        </button>
      )}

      {/* Header row: status · amount · source badge · trash */}
      <div className="flex items-center justify-between gap-2 px-[17px] pb-3 pt-[17px]">
        <StatusChip status={project.status} />
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end">
            <span className="font-mono text-[17px] font-semibold text-[var(--brand)]">
              {money(budget)}
            </span>
            <span className={`text-[9px] font-bold uppercase tracking-wide ${project.hasEstimate ? "text-[var(--accent)]" : "text-[#5C6A6E] dark:text-[#9fb0cc]"}`}>
              {project.hasEstimate
                ? (EN ? "from estimate" : "del estimado")
                : (EN ? "budget" : "presupuesto")}
            </span>
          </div>
          {!showConfirm && (
            <button
              onClick={() => onEdit(project)}
              className="rounded-lg p-1.5 text-[#C4B89A] transition hover:bg-[#EDF3FB] dark:hover:bg-[#111a2e] hover:text-[var(--accent)]"
              aria-label={EN ? "Edit project" : "Editar proyecto"}
            >
              <Pencil size={13} />
            </button>
          )}
          {canDelete && !showConfirm && (
            <button
              onClick={() => setShowConfirm(true)}
              className="rounded-lg p-1.5 text-[#C4B89A] transition hover:bg-[#FDF0ED] dark:hover:bg-[#2a1712] hover:text-[#B0492F]"
              aria-label={EN ? "Delete project" : "Eliminar proyecto"}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Clickable body */}
      <Link
        href={`/proyectos/${project.id}`}
        className="block px-[17px] pb-[17px]"
        aria-label={`Ver detalle de ${project.title}`}
      >
        <h3 className="font-bookman text-[15px] font-semibold leading-tight text-[var(--brand)]">
          {project.title}
        </h3>
        <div className="mt-1 flex items-center gap-1 text-xs text-[#5C6A6E] dark:text-[#9fb0cc]">
          <User size={11} className="opacity-60" />
          {project.client}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-xs text-[#5C6A6E] dark:text-[#9fb0cc]">
          <MapPin size={11} className="opacity-60" />
          {project.address}
        </div>

        <div className="mt-4 flex flex-col gap-2.5">
          <ProgressBar
            label={tp.dashboard.progress}
            pct={adv}
            valueLabel={`${adv}%`}
            color="bg-gradient-to-r from-[#4E7A82] to-[#5e8c94]"
          />
          <ProgressBar
            label={tp.dashboard.collected}
            pct={pp}
            valueLabel={`${money(inc)} / ${money(budget)}`}
            color={paid ? "bg-[#4F8A63]" : "bg-gradient-to-r from-[#4F8A63] to-[#63a079]"}
          />
        </div>
      </Link>

      {/* Delete confirmation overlay */}
      {showConfirm && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/97 p-5">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[#FDF0ED] dark:bg-[#2a1712]">
            <Trash2 size={18} className="text-[#B0492F]" />
          </div>
          <p className="text-center text-[13px] font-bold text-[var(--brand)]">
            {EN ? "Delete this project?" : "¿Eliminar este proyecto?"}
          </p>
          <p className="max-w-[180px] truncate text-center text-[11px] text-[#5C6A6E] dark:text-[#9fb0cc]">
            {project.title}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="rounded-xl border border-[#E6DDCB] dark:border-[#22304d] px-4 py-2 text-[12px] font-semibold text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]"
            >
              {EN ? "Cancel" : "Cancelar"}
            </button>
            <button
              onClick={() => { onDelete(project.id); setShowConfirm(false); }}
              className="rounded-xl bg-[#B0492F] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#963d27]"
            >
              {EN ? "Delete" : "Eliminar"}
            </button>
          </div>
        </div>
      )}
    </div>

    {/* Photo lightbox */}
    {photoOpen && project.photo_url && (
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 backdrop-blur-sm"
        onClick={() => setPhotoOpen(false)}
      >
        <button
          onClick={() => setPhotoOpen(false)}
          className="absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-white/20 text-white backdrop-blur-sm hover:bg-white/35"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>
        <img
          src={project.photo_url}
          alt={project.title}
          className="max-h-[88vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
          onClick={e => e.stopPropagation()}
        />
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-4 py-1.5 text-[12px] font-semibold text-white backdrop-blur-sm">
          {project.title}
        </p>
      </div>
    )}
    </>
  );
}

function ProjectBand({ p, right }: { p: ProjectWithData; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 bg-[#F2EFE7] dark:bg-[#17233d] px-3 py-2">
      <ProjectThumb photoUrl={p.photo_url} title={p.title} size={30} rounded="rounded-lg" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-bold tracking-wide text-[var(--brand)]">
          {p.title.split(" — ")[0]}
        </div>
        <div className="truncate text-[10px] text-[#5C6A6E] dark:text-[#9fb0cc]">{p.client}</div>
      </div>
      {right}
    </div>
  );
}

function KpiDetailModal({
  type,
  projects,
  onClose,
}: {
  type: KpiType;
  projects: ProjectWithData[];
  onClose: () => void;
}) {
  const { t, language } = useLanguage();
  const tp = t.panel;

  const TITLES: Record<KpiType, string> = {
    projects:    tp.dashboard.kpiProjects,
    budgeted:    tp.dashboard.kpiBudgeted,
    income:      tp.dashboard.kpiIncome,
    expenses:    tp.dashboard.kpiExpenses,
    outstanding: tp.dashboard.kpiOutstanding,
    cashflow:    tp.dashboard.kpiCashFlow,
  };

  const EN = language === "en";
  const col = (en: string, es: string) => EN ? en : es;

  // Header oscuro de columnas + filas gris suave por proyecto
  const DTH = "bg-[var(--brand)] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#F5E9DA]/90";
  const GCELL = "bg-[#F2EFE7] dark:bg-[#17233d] px-3 py-2";

  const METHOD: Record<string, string> = EN
    ? { Efectivo: "Cash", Transferencia: "Wire", Zelle: "Zelle", Cheque: "Check", Tarjeta: "Card" }
    : { Efectivo: "Efectivo", Transferencia: "Transferencia", Zelle: "Zelle", Cheque: "Cheque", Tarjeta: "Tarjeta" };

  const PAY_TYPE: Record<string, string> = EN
    ? { anticipo: "Advance", abono: "Payment", final: "Final" }
    : { anticipo: "Anticipo", abono: "Abono", final: "Final" };

  const byBudget = [...projects].sort((a, b) => b.budget - a.budget);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-2xl max-h-[82vh] flex-col overflow-hidden rounded-2xl bg-white dark:bg-[#111a2e] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E6DDCB] dark:border-[#22304d] px-5 py-3.5">
          <span className="text-sm font-bold uppercase tracking-widest text-[var(--brand)]">
            {TITLES[type]}
          </span>
          <button
            onClick={onClose}
            className="grid size-7 place-items-center rounded-lg text-[#5C6A6E] dark:text-[#9fb0cc] transition hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">

          {type === "projects" && (
            <table className="w-full border-separate [border-spacing:0_6px] text-[12px]">
              <thead>
                <tr>
                  <th className={`${DTH} rounded-l-lg text-left`}>{col("Project", "Proyecto")}</th>
                  <th className={`${DTH} text-left`}>{col("Status", "Estado")}</th>
                  <th className={`${DTH} text-right`}>{col("Budget", "Presupuesto")}</th>
                  <th className={`${DTH} rounded-r-lg text-right`}>{col("Progress", "Avance")}</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => {
                  const STATUS_COLORS: Record<string, string> = {
                    prospecto: "bg-[#E3E8EE] dark:bg-[#111a2e] text-[#44586B] dark:text-[#9fb0cc]",
                    presupuesto: "bg-[#DCE6E6] dark:bg-[#122a2c] text-[#0E2630] dark:text-[#e8edf7]",
                    aprobado: "bg-[#DCE8E9] dark:bg-[#122a2c] text-[#4E7A82]",
                    en_obra: "bg-[#EDE3CF] dark:bg-[#17233d] text-[#7A6230]",
                    terminado: "bg-[#DCEBDD] dark:bg-[#14261c] text-[#4F8A63]",
                  };
                  const prog = advancePct(p.tasks);
                  const label = tp.status[p.status as keyof typeof tp.status] ?? p.status;
                  return (
                    <tr key={p.id}>
                      <td className={`${GCELL} rounded-l-lg`}>
                        <div className="flex items-center gap-2.5">
                          <ProjectThumb photoUrl={p.photo_url} title={p.title} size={28} rounded="rounded-md" />
                          <div className="min-w-0">
                            <div className="max-w-[150px] truncate font-bold text-[var(--brand)]">{p.title.split(" — ")[0]}</div>
                            <div className="truncate text-[10px] text-[#5C6A6E] dark:text-[#9fb0cc]">{p.client}</div>
                          </div>
                        </div>
                      </td>
                      <td className={GCELL}>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {label}
                        </span>
                      </td>
                      <td className={`${GCELL} font-mono text-right text-[var(--brand)]`}>{money(p.budget)}</td>
                      <td className={`${GCELL} rounded-r-lg font-mono text-right font-semibold ${prog >= 100 ? "text-[#4F8A63]" : "text-[var(--brand)]"}`}>
                        {prog}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {type === "budgeted" && (() => {
            const total = projects.reduce((s, p) => s + p.budget, 0);
            return (
              <>
                <table className="w-full border-separate [border-spacing:0_6px] text-[12px]">
                  <thead>
                    <tr>
                      <th className={`${DTH} rounded-l-lg text-left`}>{col("Project", "Proyecto")}</th>
                      <th className={`${DTH} text-right`}>{col("Budget", "Presupuesto")}</th>
                      <th className={`${DTH} rounded-r-lg text-right`}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byBudget.map(p => {
                      const pct = total ? Math.round((p.budget / total) * 100) : 0;
                      return (
                        <tr key={p.id}>
                          <td className={`${GCELL} rounded-l-lg`}>
                            <div className="flex items-center gap-2.5">
                              <ProjectThumb photoUrl={p.photo_url} title={p.title} size={28} rounded="rounded-md" />
                              <div className="min-w-0">
                                <div className="max-w-[170px] truncate font-bold text-[var(--brand)]">{p.title.split(" — ")[0]}</div>
                                <div className="truncate text-[10px] text-[#5C6A6E] dark:text-[#9fb0cc]">{p.client}</div>
                              </div>
                            </div>
                          </td>
                          <td className={`${GCELL} font-mono text-right font-semibold text-[var(--brand)]`}>{money(p.budget)}</td>
                          <td className={`${GCELL} rounded-r-lg font-mono text-right text-[#5C6A6E] dark:text-[#9fb0cc]`}>{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-3 flex justify-between border-t border-[#E6DDCB] dark:border-[#22304d] pt-3 text-[12px] font-bold text-[var(--brand)]">
                  <span>Total</span>
                  <span className="font-mono">{money(total)}</span>
                </div>
              </>
            );
          })()}

          {type === "income" && (() => {
            const withInc = projects.filter(p => p.payments.length > 0);
            const grand = totalIncome(projects.flatMap(p => p.payments));
            return (
              <div className="space-y-5">
                {withInc.length === 0 && (
                  <p className="py-8 text-center text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">{col("No payments yet.", "Sin pagos aún.")}</p>
                )}
                {withInc.length > 0 && (
                  <div className="flex items-center rounded-lg bg-[var(--brand)] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#F5E9DA]/90">
                    <span className="w-[84px]">{col("Date", "Fecha")}</span>
                    <span className="flex-1">{col("Method", "Método")}</span>
                    <span className="flex-1">{col("Type", "Tipo")}</span>
                    <span className="w-24 text-right">{col("Amount", "Monto")}</span>
                  </div>
                )}
                {withInc.map(p => {
                  const sub = totalIncome(p.payments);
                  const rows = [...p.payments].sort((a, b) => a.date.localeCompare(b.date));
                  return (
                    <div key={p.id} className="overflow-hidden rounded-xl border border-[#E6DDCB] dark:border-[#22304d]">
                      <ProjectBand p={p} right={
                        <span className="shrink-0 font-mono text-[13px] font-bold text-[#4F8A63]">{money(sub)}</span>
                      } />
                      <table className="w-full bg-white dark:bg-[#111a2e] text-[12px]">
                        <tbody>
                          {rows.map(py => (
                            <tr key={py.id} className="border-b border-[#F7F3EA] dark:border-[#22304d] last:border-0">
                              <td className="w-[84px] py-1.5 pl-3 text-[#5C6A6E] dark:text-[#9fb0cc]">{dateFmt(py.date)}</td>
                              <td className="py-1.5 text-[#5C6A6E] dark:text-[#9fb0cc]">{METHOD[py.method] ?? py.method}</td>
                              <td className="py-1.5 text-[#5C6A6E] dark:text-[#9fb0cc]">{PAY_TYPE[py.type] ?? py.type}</td>
                              <td className="w-24 py-1.5 pr-3 text-right font-mono font-semibold text-[#4F8A63]">{money(py.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
                {withInc.length > 0 && (
                  <div className="flex justify-between border-t-2 border-[#E6DDCB] dark:border-[#22304d] pt-3 text-[13px] font-bold text-[var(--brand)]">
                    <span>Total</span>
                    <span className="font-mono text-[#4F8A63]">{money(grand)}</span>
                  </div>
                )}
              </div>
            );
          })()}

          {type === "expenses" && (() => {
            const withExp = projects.filter(p => p.expenses.length > 0);
            const grand = totalExpense(projects.flatMap(p => p.expenses));
            return (
              <div className="space-y-5">
                {withExp.length === 0 && (
                  <p className="py-8 text-center text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">{col("No expenses yet.", "Sin egresos aún.")}</p>
                )}
                {withExp.length > 0 && (
                  <div className="flex items-center rounded-lg bg-[var(--brand)] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#F5E9DA]/90">
                    <span className="w-[84px]">{col("Date", "Fecha")}</span>
                    <span className="flex-1">{col("Payee", "A quién")}</span>
                    <span className="flex-1">{col("Concept", "Concepto")}</span>
                    <span className="w-24 text-right">{col("Amount", "Monto")}</span>
                  </div>
                )}
                {withExp.map(p => {
                  const sub = totalExpense(p.expenses);
                  const rows = [...p.expenses].sort((a, b) => a.date.localeCompare(b.date));
                  return (
                    <div key={p.id} className="overflow-hidden rounded-xl border border-[#E6DDCB] dark:border-[#22304d]">
                      <ProjectBand p={p} right={
                        <span className="shrink-0 font-mono text-[13px] font-bold text-[#B0492F]">{money(sub)}</span>
                      } />
                      <table className="w-full bg-white dark:bg-[#111a2e] text-[12px]">
                        <tbody>
                          {rows.map(ex => (
                            <tr key={ex.id} className="border-b border-[#F7F3EA] dark:border-[#22304d] last:border-0">
                              <td className="w-[84px] py-1.5 pl-3 text-[#5C6A6E] dark:text-[#9fb0cc]">{dateFmt(ex.date)}</td>
                              <td className="max-w-[100px] truncate py-1.5 text-[#5C6A6E] dark:text-[#9fb0cc]">{ex.payee_name}</td>
                              <td className="max-w-[120px] truncate py-1.5 text-[#5C6A6E] dark:text-[#9fb0cc]">{ex.concept}</td>
                              <td className="w-24 py-1.5 pr-3 text-right font-mono font-semibold text-[#B0492F]">{money(ex.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
                {withExp.length > 0 && (
                  <div className="flex justify-between border-t-2 border-[#E6DDCB] dark:border-[#22304d] pt-3 text-[13px] font-bold text-[var(--brand)]">
                    <span>Total</span>
                    <span className="font-mono text-[#B0492F]">{money(grand)}</span>
                  </div>
                )}
              </div>
            );
          })()}

          {type === "outstanding" && (() => {
            const withBal = projects.filter(p => balanceDue(p.budget, p.payments) > 0);
            const grand = withBal.reduce((s, p) => s + Math.max(0, balanceDue(p.budget, p.payments)), 0);
            return (
              <>
                <table className="w-full border-separate [border-spacing:0_6px] text-[12px]">
                  <thead>
                    <tr>
                      <th className={`${DTH} rounded-l-lg text-left`}>{col("Project", "Proyecto")}</th>
                      <th className={`${DTH} text-right`}>{col("Budget", "Presupuesto")}</th>
                      <th className={`${DTH} text-right`}>{col("Collected", "Cobrado")}</th>
                      <th className={`${DTH} rounded-r-lg text-right`}>{col("Balance", "Saldo")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withBal.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-[#5C6A6E] dark:text-[#9fb0cc]">
                          {col("All projects fully paid.", "Todos los proyectos están saldados.")}
                        </td>
                      </tr>
                    )}
                    {withBal.map(p => {
                      const inc = totalIncome(p.payments);
                      const bal = balanceDue(p.budget, p.payments);
                      const pct = Math.round((inc / p.budget) * 100);
                      return (
                        <tr key={p.id}>
                          <td className={`${GCELL} rounded-l-lg`}>
                            <div className="flex items-center gap-2.5">
                              <ProjectThumb photoUrl={p.photo_url} title={p.title} size={28} rounded="rounded-md" />
                              <div className="min-w-0">
                                <div className="max-w-[150px] truncate font-bold text-[var(--brand)]">{p.title.split(" — ")[0]}</div>
                                <div className="truncate text-[10px] text-[#5C6A6E] dark:text-[#9fb0cc]">{p.client} · {pct}% {col("paid", "cobrado")}</div>
                              </div>
                            </div>
                          </td>
                          <td className={`${GCELL} font-mono text-right text-[var(--brand)]`}>{money(p.budget)}</td>
                          <td className={`${GCELL} font-mono text-right text-[#4F8A63]`}>{money(inc)}</td>
                          <td className={`${GCELL} rounded-r-lg font-mono text-right font-bold text-[#B0492F]`}>{money(bal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {withBal.length > 0 && (
                  <div className="mt-3 flex justify-between border-t border-[#E6DDCB] dark:border-[#22304d] pt-3 text-[12px] font-bold text-[var(--brand)]">
                    <span>{col("Total Outstanding", "Total Pendiente")}</span>
                    <span className="font-mono text-[#B0492F]">{money(grand)}</span>
                  </div>
                )}
              </>
            );
          })()}

          {type === "cashflow" && (() => {
            const allInc = totalIncome(projects.flatMap(p => p.payments));
            const allExp = totalExpense(projects.flatMap(p => p.expenses));
            const net = allInc - allExp;
            return (
              <>
                <div className="mb-5 grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-[#F0FAF3] p-3 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">IN</div>
                    <div className="mt-1 font-mono text-lg font-semibold text-[#4F8A63]">{money(allInc)}</div>
                  </div>
                  <div className="rounded-xl bg-[#FDF0ED] dark:bg-[#2a1712] p-3 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">OUT</div>
                    <div className="mt-1 font-mono text-lg font-semibold text-[#B0492F]">{money(allExp)}</div>
                  </div>
                  <div className="rounded-xl bg-[#EDF3FB] dark:bg-[#111a2e] p-3 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">NET</div>
                    <div className={`mt-1 font-mono text-lg font-semibold ${net >= 0 ? "text-[#4F8A63]" : "text-[#B0492F]"}`}>
                      {money(net)}
                    </div>
                  </div>
                </div>
                <table className="w-full border-separate [border-spacing:0_6px] text-[12px]">
                  <thead>
                    <tr>
                      <th className={`${DTH} rounded-l-lg text-left`}>{col("Project", "Proyecto")}</th>
                      <th className={`${DTH} text-right`}>IN</th>
                      <th className={`${DTH} text-right`}>OUT</th>
                      <th className={`${DTH} rounded-r-lg text-right`}>NET</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map(p => {
                      const inc = totalIncome(p.payments);
                      const exp = totalExpense(p.expenses);
                      const n = inc - exp;
                      return (
                        <tr key={p.id}>
                          <td className={`${GCELL} rounded-l-lg`}>
                            <div className="flex items-center gap-2.5">
                              <ProjectThumb photoUrl={p.photo_url} title={p.title} size={28} rounded="rounded-md" />
                              <div className="min-w-0">
                                <div className="max-w-[150px] truncate font-bold text-[var(--brand)]">{p.title.split(" — ")[0]}</div>
                                <div className="truncate text-[10px] text-[#5C6A6E] dark:text-[#9fb0cc]">{p.client}</div>
                              </div>
                            </div>
                          </td>
                          <td className={`${GCELL} font-mono text-right text-[#4F8A63]`}>{money(inc)}</td>
                          <td className={`${GCELL} font-mono text-right text-[#B0492F]`}>{money(exp)}</td>
                          <td className={`${GCELL} rounded-r-lg font-mono text-right font-bold ${n >= 0 ? "text-[#4F8A63]" : "text-[#B0492F]"}`}>
                            {n >= 0 ? "+" : ""}{money(n)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            );
          })()}

        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithData | null>(null);
  const [voicePrefill, setVoicePrefill] = useState<Partial<Project> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [kpiModal, setKpiModal] = useState<KpiType | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("en_obra");
  const { setMeta } = useVoice();
  const { currentUser, isSuperAdmin, hasPermission } = useAuth();
  const { t, language } = useLanguage();
  const EN = language === "en";
  const tp = t.panel;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);

    if (isSuperAdmin) {
      const { data, error } = await supabase
        .from("projects")
        .select(`*, payments(*), expenses(*), tasks(*)`)
        .order("start_date", { ascending: false });
      if (error) { setError("Error al cargar los proyectos."); }
      else        { setProjects(await enrichWithEstimateBudgets(data ?? [])); }
    } else {
      const { data: access } = await supabase
        .from("user_project_access")
        .select("project_id")
        .eq("user_id", currentUser.id);
      const ids = access?.map(r => r.project_id) ?? [];
      if (ids.length === 0) { setProjects([]); setLoading(false); return; }
      const { data, error } = await supabase
        .from("projects")
        .select(`*, payments(*), expenses(*), tasks(*)`)
        .in("id", ids)
        .order("start_date", { ascending: false });
      if (error) { setError("Error al cargar los proyectos."); }
      else        { setProjects(await enrichWithEstimateBudgets(data ?? [])); }
    }
    setLoading(false);
  }, [currentUser, isSuperAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setMeta({
      context:  "dashboard",
      projects: projects.map(p => ({ id: p.id, title: p.title })),
    });
  }, [setMeta, projects]);

  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("kokivoice_saved", handler);
    return () => window.removeEventListener("kokivoice_saved", handler);
  }, [fetchData]);


  const handleDelete = useCallback(async (id: string) => {
    await supabase.from("projects").delete().eq("id", id);
    fetchData();
  }, [fetchData]);

  const allPayments = projects.flatMap((p) => p.payments);
  const allExpenses = projects.flatMap((p) => p.expenses);
  const totalBudget = projects.reduce((s, p) => s + p.budget, 0);
  const totalInc = totalIncome(allPayments);
  const totalExp = totalExpense(allExpenses);
  const totalDue = projects.reduce(
    (s, p) => s + Math.max(0, balanceDue(p.budget, p.payments)),
    0
  );
  const avgAdv = projects.length
    ? Math.round(
        projects.reduce((s, p) => s + advancePct(p.tasks), 0) / projects.length
      )
    : 0;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-8 text-center text-sm text-[#B0492F]">
        {error}
      </div>
    );
  }

  const canSeePagos   = isSuperAdmin || hasPermission("pagos",   "view");
  const canCreateProj = isSuperAdmin || hasPermission("workflow", "create");

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 rounded-2xl bg-[var(--accent)] px-6 py-5">
        <h1 className="font-bookman text-[28px] font-semibold tracking-tight text-white">
          {tp.dashboard.greeting}, {currentUser?.name ?? ""}
        </h1>
        <p className="mt-1 text-sm text-[#B1C9EF]">
          {isSuperAdmin ? tp.dashboard.adminPanel : tp.dashboard.assignedProjects} · {tp.dashboard.avgProgress} {avgAdv}%
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label={tp.dashboard.kpiProjects}    value={projects.length}   sub={tp.dashboard.kpiActive}          onClick={() => setKpiModal("projects")} />
        <KpiCard label={tp.dashboard.kpiBudgeted}    value={money(totalBudget)} sub={tp.dashboard.kpiTotalContracted} onClick={() => setKpiModal("budgeted")} />
        {canSeePagos && <>
          <KpiCard label={tp.dashboard.kpiIncome}      value={money(totalInc)}  sub={tp.dashboard.kpiCollected}     variant="up"   onClick={() => setKpiModal("income")} />
          <KpiCard label={tp.dashboard.kpiExpenses}    value={money(totalExp)}  sub={tp.dashboard.kpiPaid}          variant="down" onClick={() => setKpiModal("expenses")} />
          <KpiCard label={tp.dashboard.kpiOutstanding} value={money(totalDue)}  sub={tp.dashboard.kpiClientBalance}                onClick={() => setKpiModal("outstanding")} />
          <KpiCard label={tp.dashboard.kpiCashFlow}    value={money(cashFlow(allPayments, allExpenses))} sub={tp.dashboard.kpiNetFlow} variant="up" onClick={() => setKpiModal("cashflow")} />
        </>}
      </div>

      {/* Projects bar — single row: title | filter pills | new project */}
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-[var(--brand)] px-5 py-3">

        {/* Title */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-[9px] font-bold uppercase tracking-widest text-white/35 sm:block">
            {branding.companyName}
          </span>
          <span className="hidden text-white/20 sm:block">·</span>
          <h2 className="font-bookman text-[17px] font-semibold text-white">
            {tp.dashboard.projectsTitle}
          </h2>
          <span className="rounded-full bg-white/15 px-2 py-0.5 font-mono text-[10px] text-white/70">
            {projects.length}
          </span>
        </div>

        {/* Divider */}
        {projects.length > 0 && <div className="h-5 w-px shrink-0 rounded-full bg-white/15" />}

        {/* Filter pills — scrollable on narrow screens */}
        {projects.length > 0 && (() => {
          const STATUSES = ["prospecto", "presupuesto", "aprobado", "en_obra", "terminado"] as const;
          const ACTIVE: Record<string, string> = {
            prospecto:   "bg-[#E3E8EE] dark:bg-[#111a2e] text-[#44586B] dark:text-[#9fb0cc]",
            presupuesto: "bg-[#DCE6E6] dark:bg-[#122a2c] text-[#0E2630] dark:text-[#e8edf7]",
            aprobado:    "bg-[#DCE8E9] dark:bg-[#122a2c] text-[#4E7A82]",
            en_obra:     "bg-[#EDE3CF] dark:bg-[#17233d] text-[#7A6230]",
            terminado:   "bg-[#DCEBDD] dark:bg-[#14261c] text-[#4F8A63]",
          };
          return (
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              <button
                onClick={() => setStatusFilter("all")}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-bold transition ${
                  statusFilter === "all"
                    ? "bg-white dark:bg-[#111a2e] text-[var(--brand)]"
                    : "border border-white/20 text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {EN ? "All" : "Todos"}
                <span className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] ${statusFilter === "all" ? "bg-black/10" : "bg-white/10"}`}>
                  {projects.length}
                </span>
              </button>
              {STATUSES.map(s => {
                const count = projects.filter(p => p.status === s).length;
                if (count === 0) return null;
                const isActive = statusFilter === s;
                const label = tp.status[s as keyof typeof tp.status] ?? s;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-bold transition ${
                      isActive ? ACTIVE[s] : "border border-white/20 text-white/60 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    {label}
                    <span className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] ${isActive ? "bg-black/10" : "bg-white/10"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })()}

        {/* Divider */}
        {(canCreateProj || isSuperAdmin) && <div className="h-5 w-px shrink-0 rounded-full bg-white/15" />}

        {/* Reporte de pendientes */}
        {isSuperAdmin && (
          <button
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-[11px] font-bold text-white transition hover:bg-white/18"
            onClick={() => setReportOpen(true)}
          >
            <ClipboardList size={13} />
            <span className="hidden sm:inline">{tp.report.openReport}</span>
          </button>
        )}

        {/* New project */}
        {canCreateProj && (
          <button
            id="add-project-btn"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-[11px] font-bold text-white transition hover:bg-white/18"
            onClick={() => { setVoicePrefill(null); setShowModal(true); }}
          >
            <Plus size={13} />
            <span className="hidden sm:inline">{tp.dashboard.newProject}</span>
            <span className="sm:hidden">+</span>
          </button>
        )}
      </div>

      {(() => {
        const visibleProjects = statusFilter === "all" ? projects : projects.filter(p => p.status === statusFilter);
        if (projects.length === 0) return (
          <div className="rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-12 text-center text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">
            {isSuperAdmin ? tp.dashboard.noProjectsAdmin : tp.dashboard.noProjectsUser}
          </div>
        );
        if (visibleProjects.length === 0) return (
          <div className="rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-10 text-center text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">
            {EN
              ? `No projects with status "${tp.status[statusFilter as keyof typeof tp.status] ?? statusFilter}"`
              : `Sin proyectos con estado "${tp.status[statusFilter as keyof typeof tp.status] ?? statusFilter}"`}
          </div>
        );
        return (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProjects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                budget={p.budget}
                canDelete={isSuperAdmin}
                onDelete={handleDelete}
                onEdit={setEditingProject}
              />
            ))}
          </div>
        );
      })()}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[200] -translate-x-1/2 rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}

      {showModal && (
        <ProjectFormModal
          initialValues={voicePrefill ?? undefined}
          onClose={() => { setShowModal(false); setVoicePrefill(null); }}
          onSaved={fetchData}
          toast={showToast}
        />
      )}

      {editingProject && (
        <ProjectFormModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSaved={() => { setEditingProject(null); fetchData(); }}
          toast={showToast}
        />
      )}

      {kpiModal && (
        <KpiDetailModal
          type={kpiModal}
          projects={projects}
          onClose={() => setKpiModal(null)}
        />
      )}

      {reportOpen && (
        <div className="fixed inset-0 z-[320] flex items-end justify-center bg-[var(--brand)]/55 p-3 backdrop-blur-sm sm:items-center" onClick={() => setReportOpen(false)}>
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-5 py-3.5">
              <div>
                <h3 className="text-[15px] font-bold text-[var(--brand)] dark:text-[#e8edf7]">{tp.report.title}</h3>
                <p className="text-[11px] text-[#97A1A0] dark:text-[#728098]">{tp.report.subtitle}</p>
              </div>
              <button onClick={() => setReportOpen(false)} className="grid size-9 place-items-center rounded-lg text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#ECE3D1] dark:hover:bg-[#17233d]"><X size={16} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <ReportBuilder projects={projects.map(p => ({ id: p.id, title: p.title, client: p.client }))} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
