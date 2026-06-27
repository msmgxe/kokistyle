"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, MapPin, User, X } from "lucide-react";
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
import UsersPanel from "@/src/components/ui/UsersPanel";
import AdminSettings from "@/src/components/ui/AdminSettings";
import { useVoice } from "@/src/context/VoiceContext";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";

interface ProjectWithData extends Project {
  payments: Payment[];
  expenses: Expense[];
  tasks: Task[];
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
    neutral: "text-[#16323D]",
  };
  return (
    <div
      className={`rounded-2xl border border-[#E6DDCB] bg-white p-4 transition-all${onClick ? " cursor-pointer hover:border-[#395886]/40 hover:shadow-md active:scale-[0.98]" : ""}`}
      onClick={onClick}
    >
      <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#5C6A6E]">
        {label}
      </div>
      <div className={`mt-2 font-mono text-2xl font-semibold tracking-tight ${colors[variant]}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-[#5C6A6E]">{sub}</div>}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const { t } = useLanguage();
  const styles: Record<string, string> = {
    presupuesto: "bg-[#DCE6E6] text-[#0E2630]",
    aprobado: "bg-[#DCE8E9] text-[#4E7A82]",
    en_obra: "bg-[#EDE3CF] text-[#7A6230]",
    terminado: "bg-[#DCEBDD] text-[#4F8A63]",
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
      <div className="flex justify-between text-[11px] font-semibold text-[#5C6A6E]">
        <span>{label}</span>
        <span className="font-mono text-[#16323D]">{valueLabel}</span>
      </div>
      <div className="h-[7px] overflow-hidden rounded-full bg-[#E6DDCB]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectWithData }) {
  const { t } = useLanguage();
  const tp = t.panel;
  const inc = totalIncome(project.payments);
  const adv = advancePct(project.tasks);
  const pp = paymentPct(project.budget, project.payments);
  const paid = balanceDue(project.budget, project.payments) <= 0;

  return (
    <Link
      href={`/proyectos/${project.id}`}
      className="block rounded-[18px] border border-[#E6DDCB] bg-white p-[17px] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
      aria-label={`Ver detalle de ${project.title}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <StatusChip status={project.status} />
        <span className="font-mono text-[17px] font-semibold text-[#16323D]">
          {money(project.budget)}
        </span>
      </div>

      <h3 className="font-[Manrope] text-sm font-bold uppercase tracking-widest leading-tight text-[#16323D]">
        {project.title}
      </h3>
      <div className="mt-1 flex items-center gap-1 text-xs text-[#5C6A6E]">
        <User size={11} className="opacity-60" />
        {project.client}
      </div>
      <div className="mt-0.5 flex items-center gap-1 text-xs text-[#5C6A6E]">
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
          valueLabel={`${money(inc)} / ${money(project.budget)}`}
          color={paid ? "bg-[#4F8A63]" : "bg-gradient-to-r from-[#4F8A63] to-[#63a079]"}
        />
      </div>
    </Link>
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

  const METHOD: Record<string, string> = EN
    ? { Efectivo: "Cash", Transferencia: "Wire", Zelle: "Zelle", Cheque: "Check", Tarjeta: "Card" }
    : { Efectivo: "Efectivo", Transferencia: "Transferencia", Zelle: "Zelle", Cheque: "Cheque", Tarjeta: "Tarjeta" };

  const PAY_TYPE: Record<string, string> = EN
    ? { anticipo: "Advance", abono: "Payment", final: "Final" }
    : { anticipo: "Anticipo", abono: "Abono", final: "Final" };

  const byBudget = [...projects].sort((a, b) => b.budget - a.budget);

  const TH = "pb-2 text-[11px] font-semibold uppercase tracking-wide text-[#5C6A6E]";
  const ROW = "border-b border-[#F7F3EA] hover:bg-[#FDFAF6]";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-2xl max-h-[82vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E6DDCB] px-5 py-3.5">
          <span className="font-[Manrope] text-sm font-bold uppercase tracking-widest text-[#16323D]">
            {TITLES[type]}
          </span>
          <button
            onClick={onClose}
            className="grid size-7 place-items-center rounded-lg text-[#5C6A6E] transition hover:bg-[#F7F3EA]"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">

          {type === "projects" && (
            <table className="w-full text-[12px]">
              <thead>
                <tr className={`border-b border-[#E6DDCB]`}>
                  <th className={`${TH} text-left`}>{col("Project", "Proyecto")}</th>
                  <th className={`${TH} text-left`}>{col("Client", "Cliente")}</th>
                  <th className={`${TH} text-right`}>{col("Budget", "Presupuesto")}</th>
                  <th className={`${TH} text-right`}>{col("Progress", "Avance")}</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => {
                  const STATUS_COLORS: Record<string, string> = {
                    presupuesto: "bg-[#DCE6E6] text-[#0E2630]",
                    aprobado: "bg-[#DCE8E9] text-[#4E7A82]",
                    en_obra: "bg-[#EDE3CF] text-[#7A6230]",
                    terminado: "bg-[#DCEBDD] text-[#4F8A63]",
                  };
                  const prog = advancePct(p.tasks);
                  const label = tp.status[p.status as keyof typeof tp.status] ?? p.status;
                  return (
                    <tr key={p.id} className={ROW}>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {label}
                          </span>
                          <span className="truncate max-w-[130px] font-semibold text-[#16323D]">
                            {p.title.split(" — ")[0]}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 text-[#5C6A6E]">{p.client}</td>
                      <td className="py-2 font-mono text-right text-[#16323D]">{money(p.budget)}</td>
                      <td className={`py-2 font-mono text-right font-semibold ${prog >= 100 ? "text-[#4F8A63]" : "text-[#16323D]"}`}>
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
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[#E6DDCB]">
                      <th className={`${TH} text-left`}>{col("Project", "Proyecto")}</th>
                      <th className={`${TH} text-left`}>{col("Client", "Cliente")}</th>
                      <th className={`${TH} text-right`}>{col("Budget", "Presupuesto")}</th>
                      <th className={`${TH} text-right`}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byBudget.map(p => (
                      <tr key={p.id} className={ROW}>
                        <td className="max-w-[160px] truncate py-2 font-semibold text-[#16323D]">{p.title.split(" — ")[0]}</td>
                        <td className="py-2 text-[#5C6A6E]">{p.client}</td>
                        <td className="py-2 font-mono text-right text-[#16323D]">{money(p.budget)}</td>
                        <td className="py-2 font-mono text-right text-[#5C6A6E]">
                          {total ? Math.round((p.budget / total) * 100) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 flex justify-between border-t border-[#E6DDCB] pt-3 text-[12px] font-bold text-[#16323D]">
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
                  <p className="py-8 text-center text-sm text-[#5C6A6E]">{col("No payments yet.", "Sin pagos aún.")}</p>
                )}
                {withInc.map(p => {
                  const sub = totalIncome(p.payments);
                  const rows = [...p.payments].sort((a, b) => a.date.localeCompare(b.date));
                  return (
                    <div key={p.id}>
                      <div className="mb-1.5 flex items-baseline justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-[#395886]">
                          {p.title.split(" — ")[0]}
                        </span>
                        <span className="font-mono text-[11px] text-[#5C6A6E]">{p.client}</span>
                      </div>
                      <table className="w-full text-[12px]">
                        <tbody>
                          {rows.map(py => (
                            <tr key={py.id} className="border-b border-[#F7F3EA]">
                              <td className="py-1.5 text-[#5C6A6E]">{dateFmt(py.date)}</td>
                              <td className="py-1.5 text-[#5C6A6E]">{METHOD[py.method] ?? py.method}</td>
                              <td className="py-1.5 text-[#5C6A6E]">{PAY_TYPE[py.type] ?? py.type}</td>
                              <td className="py-1.5 text-right font-mono font-semibold text-[#4F8A63]">{money(py.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-1 flex justify-between text-[11px] text-[#5C6A6E]">
                        <span>Subtotal</span>
                        <span className="font-mono font-semibold text-[#16323D]">{money(sub)}</span>
                      </div>
                    </div>
                  );
                })}
                {withInc.length > 0 && (
                  <div className="flex justify-between border-t-2 border-[#E6DDCB] pt-3 text-[13px] font-bold text-[#16323D]">
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
                  <p className="py-8 text-center text-sm text-[#5C6A6E]">{col("No expenses yet.", "Sin egresos aún.")}</p>
                )}
                {withExp.map(p => {
                  const sub = totalExpense(p.expenses);
                  const rows = [...p.expenses].sort((a, b) => a.date.localeCompare(b.date));
                  return (
                    <div key={p.id}>
                      <div className="mb-1.5 flex items-baseline justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-[#395886]">
                          {p.title.split(" — ")[0]}
                        </span>
                        <span className="font-mono text-[11px] text-[#5C6A6E]">{p.client}</span>
                      </div>
                      <table className="w-full text-[12px]">
                        <tbody>
                          {rows.map(ex => (
                            <tr key={ex.id} className="border-b border-[#F7F3EA]">
                              <td className="py-1.5 text-[#5C6A6E]">{dateFmt(ex.date)}</td>
                              <td className="max-w-[100px] truncate py-1.5 text-[#5C6A6E]">{ex.payee_name}</td>
                              <td className="max-w-[120px] truncate py-1.5 text-[#5C6A6E]">{ex.concept}</td>
                              <td className="py-1.5 text-right font-mono font-semibold text-[#B0492F]">{money(ex.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-1 flex justify-between text-[11px] text-[#5C6A6E]">
                        <span>Subtotal</span>
                        <span className="font-mono font-semibold text-[#16323D]">{money(sub)}</span>
                      </div>
                    </div>
                  );
                })}
                {withExp.length > 0 && (
                  <div className="flex justify-between border-t-2 border-[#E6DDCB] pt-3 text-[13px] font-bold text-[#16323D]">
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
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[#E6DDCB]">
                      <th className={`${TH} text-left`}>{col("Project", "Proyecto")}</th>
                      <th className={`${TH} text-right`}>{col("Budget", "Presupuesto")}</th>
                      <th className={`${TH} text-right`}>{col("Collected", "Cobrado")}</th>
                      <th className={`${TH} text-right`}>{col("Balance", "Saldo")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withBal.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-[#5C6A6E]">
                          {col("All projects fully paid.", "Todos los proyectos están saldados.")}
                        </td>
                      </tr>
                    )}
                    {withBal.map(p => {
                      const inc = totalIncome(p.payments);
                      const bal = balanceDue(p.budget, p.payments);
                      const pct = Math.round((inc / p.budget) * 100);
                      return (
                        <tr key={p.id} className={ROW}>
                          <td className="py-2">
                            <div className="max-w-[160px] truncate font-semibold text-[#16323D]">{p.title.split(" — ")[0]}</div>
                            <div className="text-[10px] text-[#5C6A6E]">{p.client} · {pct}% {col("paid", "cobrado")}</div>
                          </td>
                          <td className="py-2 font-mono text-right text-[#16323D]">{money(p.budget)}</td>
                          <td className="py-2 font-mono text-right text-[#4F8A63]">{money(inc)}</td>
                          <td className="py-2 font-mono text-right font-bold text-[#B0492F]">{money(bal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {withBal.length > 0 && (
                  <div className="mt-3 flex justify-between border-t border-[#E6DDCB] pt-3 text-[12px] font-bold text-[#16323D]">
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
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E]">IN</div>
                    <div className="mt-1 font-mono text-lg font-semibold text-[#4F8A63]">{money(allInc)}</div>
                  </div>
                  <div className="rounded-xl bg-[#FDF0ED] p-3 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E]">OUT</div>
                    <div className="mt-1 font-mono text-lg font-semibold text-[#B0492F]">{money(allExp)}</div>
                  </div>
                  <div className="rounded-xl bg-[#EDF3FB] p-3 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E]">NET</div>
                    <div className={`mt-1 font-mono text-lg font-semibold ${net >= 0 ? "text-[#4F8A63]" : "text-[#B0492F]"}`}>
                      {money(net)}
                    </div>
                  </div>
                </div>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[#E6DDCB]">
                      <th className={`${TH} text-left`}>{col("Project", "Proyecto")}</th>
                      <th className={`${TH} text-right text-[#4F8A63]`}>IN</th>
                      <th className={`${TH} text-right text-[#B0492F]`}>OUT</th>
                      <th className={`${TH} text-right`}>NET</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map(p => {
                      const inc = totalIncome(p.payments);
                      const exp = totalExpense(p.expenses);
                      const n = inc - exp;
                      return (
                        <tr key={p.id} className={ROW}>
                          <td className="py-2">
                            <div className="max-w-[160px] truncate font-semibold text-[#16323D]">{p.title.split(" — ")[0]}</div>
                            <div className="text-[10px] text-[#5C6A6E]">{p.client}</div>
                          </td>
                          <td className="py-2 font-mono text-right text-[#4F8A63]">{money(inc)}</td>
                          <td className="py-2 font-mono text-right text-[#B0492F]">{money(exp)}</td>
                          <td className={`py-2 font-mono text-right font-bold ${n >= 0 ? "text-[#4F8A63]" : "text-[#B0492F]"}`}>
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
  const [voicePrefill, setVoicePrefill] = useState<Partial<Project> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [kpiModal, setKpiModal] = useState<KpiType | null>(null);
  const { setMeta } = useVoice();
  const { currentUser, isSuperAdmin, hasPermission } = useAuth();
  const { t } = useLanguage();
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
        .order("created_at", { ascending: false });
      if (error) { setError("Error al cargar los proyectos."); }
      else        { setProjects(data as ProjectWithData[]); }
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
        .order("created_at", { ascending: false });
      if (error) { setError("Error al cargar los proyectos."); }
      else        { setProjects(data as ProjectWithData[]); }
    }
    setLoading(false);
  }, [currentUser, isSuperAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setMeta({ context: "dashboard" });
  }, [setMeta]);

  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("kokivoice_saved", handler);
    return () => window.removeEventListener("kokivoice_saved", handler);
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#16323D] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[#E6DDCB] bg-white p-8 text-center text-sm text-[#B0492F]">
        {error}
      </div>
    );
  }

  const canSeePagos   = isSuperAdmin || hasPermission("pagos",   "view");
  const canCreateProj = isSuperAdmin || hasPermission("workflow", "create");

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 rounded-2xl bg-[#395886] px-6 py-5">
        <h1 className="font-[Manrope] text-[22px] font-extrabold leading-tight tracking-tight text-white">
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

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-[Manrope] text-base font-bold text-[#16323D]">{tp.dashboard.projectsTitle}</h2>
        {canCreateProj && (
          <button
            id="add-project-btn"
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#D7CBB3] bg-[#ECE3D1] px-4 py-2 text-sm font-bold text-[#16323D] transition hover:border-[#16323D]"
            onClick={() => { setVoicePrefill(null); setShowModal(true); }}
          >
            <Plus size={14} />
            {tp.dashboard.newProject}
          </button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-12 text-center text-sm text-[#5C6A6E]">
          {isSuperAdmin ? tp.dashboard.noProjectsAdmin : tp.dashboard.noProjectsUser}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}

      {isSuperAdmin && (
        <>
          <UsersPanel projects={projects} />
          <div className="mt-8">
            <div className="mb-4">
              <h2 className="font-[Manrope] text-base font-bold text-[#16323D]">{tp.dashboard.security}</h2>
              <p className="text-[11px] text-[#97A1A0]">{tp.dashboard.securityDesc}</p>
            </div>
            <AdminSettings />
          </div>
        </>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[200] -translate-x-1/2 rounded-xl bg-[#16323D] px-5 py-3 text-sm font-semibold text-white shadow-xl">
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

      {kpiModal && (
        <KpiDetailModal
          type={kpiModal}
          projects={projects}
          onClose={() => setKpiModal(null)}
        />
      )}
    </div>
  );
}
