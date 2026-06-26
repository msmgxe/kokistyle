/**
 * Dashboard principal de proyectos (/proyectos).
 * Muestra KPIs globales del portafolio y tarjetas de cada proyecto.
 * Al hacer clic en una tarjeta se navega al detalle del proyecto.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, MapPin, User } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import {
  money,
  totalIncome,
  totalExpense,
  balanceDue,
  cashFlow,
  paymentPct,
  advancePct,
  STATUS_LABELS,
} from "@/src/lib/utils";
import type { Project, Payment, Expense, Task } from "@/src/types/project";
import ProjectFormModal from "@/src/components/ui/ProjectFormModal";
import UsersPanel from "@/src/components/ui/UsersPanel";
import AdminSettings from "@/src/components/ui/AdminSettings";
import { useVoice } from "@/src/context/VoiceContext";
import { useAuth } from "@/src/context/AuthContext";

// ─── Tipos auxiliares con relaciones ───────────────────────────────────────
interface ProjectWithData extends Project {
  payments: Payment[];
  expenses: Expense[];
  tasks: Task[];
}

// ─── Componente KPI card ────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  variant = "neutral",
}: {
  label: string;
  value: string | number;
  sub?: string;
  variant?: "up" | "down" | "neutral";
}) {
  const colors = {
    up: "text-[#4F8A63]",
    down: "text-[#B0492F]",
    neutral: "text-[#16323D]",
  };
  return (
    <div className="rounded-2xl border border-[#E6DDCB] bg-white p-4">
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

// ─── Chip de estado del proyecto ────────────────────────────────────────────
function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    presupuesto: "bg-[#DCE6E6] text-[#0E2630]",
    aprobado: "bg-[#DCE8E9] text-[#4E7A82]",
    en_obra: "bg-[#EDE3CF] text-[#7A6230]",
    terminado: "bg-[#DCEBDD] text-[#4F8A63]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Barra de progreso ──────────────────────────────────────────────────────
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

// ─── Tarjeta de proyecto ────────────────────────────────────────────────────
function ProjectCard({ project }: { project: ProjectWithData }) {
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
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <StatusChip status={project.status} />
        <span className="font-mono text-[17px] font-semibold text-[#16323D]">
          {money(project.budget)}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-[Manrope] text-lg font-bold leading-tight text-[#16323D]">
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

      {/* Barras de progreso */}
      <div className="mt-4 flex flex-col gap-2.5">
        <ProgressBar
          label="Avance"
          pct={adv}
          valueLabel={`${adv}%`}
          color="bg-gradient-to-r from-[#4E7A82] to-[#5e8c94]"
        />
        <ProgressBar
          label="Cobrado"
          pct={pp}
          valueLabel={`${money(inc)} / ${money(project.budget)}`}
          color={paid ? "bg-[#4F8A63]" : "bg-gradient-to-r from-[#4F8A63] to-[#63a079]"}
        />
      </div>
    </Link>
  );
}

// ─── Página principal del Dashboard ────────────────────────────────────────
export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [voicePrefill, setVoicePrefill] = useState<Partial<Project> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { setMeta } = useVoice();
  const { currentUser, isSuperAdmin, hasPermission } = useAuth();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);

    if (isSuperAdmin) {
      // Superadmin ve todos los proyectos
      const { data, error } = await supabase
        .from("projects")
        .select(`*, payments(*), expenses(*), tasks(*)`)
        .order("created_at", { ascending: false });
      if (error) { setError("Error al cargar los proyectos."); }
      else        { setProjects(data as ProjectWithData[]); }
    } else {
      // Colaborador ve solo proyectos asignados
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

  // Registrar contexto de voz para que el FAB sepa que estamos en el dashboard
  useEffect(() => {
    setMeta({ context: "dashboard" });
  }, [setMeta]);

  // Refrescar datos cuando el VoiceFAB guarda algo
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("kokivoice_saved", handler);
    return () => window.removeEventListener("kokivoice_saved", handler);
  }, [fetchData]);

  // ── Métricas globales del portafolio ──────────────────────────────────────
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
      {/* Blue header */}
      <div className="-mx-6 -mt-7 mb-6 bg-[#395886] px-6 pt-7 pb-5">
        <h1 className="font-[Manrope] text-[22px] font-extrabold leading-tight tracking-tight text-white">
          Hola, {currentUser?.name ?? ""}
        </h1>
        <p className="mt-1 text-sm text-[#B1C9EF]">
          {isSuperAdmin ? "Panel de administración" : "Tus proyectos asignados"} · avance promedio {avgAdv}%
        </p>
      </div>

      {/* KPIs globales — financieros solo si tiene permiso pagos */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Proyectos" value={projects.length} sub="activos" />
        <KpiCard label="Presupuestado" value={money(totalBudget)} sub="total contratado" />
        {canSeePagos && <>
          <KpiCard label="Ingresos"      value={money(totalInc)}  sub="cobrado a clientes"     variant="up"   />
          <KpiCard label="Egresos"       value={money(totalExp)}  sub="pagado a especialistas"  variant="down" />
          <KpiCard label="Por cobrar"    value={money(totalDue)}  sub="saldo de clientes"                      />
          <KpiCard label="Caja (ing − egr)" value={money(cashFlow(allPayments, allExpenses))} sub="flujo neto" variant="up" />
        </>}
      </div>

      {/* Lista de proyectos */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-[Manrope] text-base font-bold text-[#16323D]">Proyectos</h2>
        {canCreateProj && (
          <button
            id="add-project-btn"
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#D7CBB3] bg-[#ECE3D1] px-4 py-2 text-sm font-bold text-[#16323D] transition hover:border-[#16323D]"
            onClick={() => { setVoicePrefill(null); setShowModal(true); }}
          >
            <Plus size={14} />
            Nuevo proyecto
          </button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-12 text-center text-sm text-[#5C6A6E]">
          {isSuperAdmin ? "No hay proyectos aún. Crea el primero." : "No tienes proyectos asignados aún."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}

      {/* Panel de equipo y configuración — solo superadmin */}
      {isSuperAdmin && (
        <>
          <UsersPanel projects={projects} />
          <div className="mt-8">
            <div className="mb-4">
              <h2 className="font-[Manrope] text-base font-bold text-[#16323D]">Seguridad</h2>
              <p className="text-[11px] text-[#97A1A0]">Cambia tu PIN y configura la recuperación por correo</p>
            </div>
            <AdminSettings />
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[200] -translate-x-1/2 rounded-xl bg-[#16323D] px-5 py-3 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}

      {/* Modal nuevo proyecto */}
      {showModal && (
        <ProjectFormModal
          initialValues={voicePrefill ?? undefined}
          onClose={() => { setShowModal(false); setVoicePrefill(null); }}
          onSaved={fetchData}
          toast={showToast}
        />
      )}
    </div>
  );
}
