"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { supabase } from "@/src/lib/supabase";

interface ActivityRow {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  action: string;
  entity_type: string | null;
  entity_name: string | null;
  project_id: string | null;
  project_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, { emoji: string; en: string; es: string; color: string; bg: string }> = {
  login:       { emoji: "🔑", en: "Login",        es: "Login",         color: "text-[var(--accent)]",  bg: "bg-[#EDF3FB]" },
  create:      { emoji: "✅", en: "Created",      es: "Creó",          color: "text-[#4F8A63]",  bg: "bg-[#EAF5EE]" },
  delete:      { emoji: "🗑", en: "Deleted",      es: "Eliminó",       color: "text-[#B0492F]",  bg: "bg-[#FDF0ED]" },
  update:      { emoji: "✏️", en: "Updated",      es: "Actualizó",     color: "text-[#5C6A6E]",  bg: "bg-[#F7F3EA]" },
  mark_bought: { emoji: "🛒", en: "Marked bought", es: "Marcó comprado", color: "text-[#6B46C1]", bg: "bg-[#F5F0FF]" },
};

const ENTITY_LABELS: Record<string, { en: string; es: string }> = {
  project:      { en: "project",       es: "proyecto" },
  task:         { en: "task",          es: "tarea" },
  payment:      { en: "payment",       es: "pago" },
  expense:      { en: "expense",       es: "egreso" },
  material:     { en: "material",      es: "material" },
  contact:      { en: "contact",       es: "contacto" },
  note:         { en: "note",          es: "nota" },
  estimate_item:{ en: "estimate item", es: "ítem de estimado" },
};

function timeAgo(dateStr: string, EN: boolean): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2)    return EN ? "Just now" : "Ahora mismo";
  if (mins < 60)   return EN ? `${mins} min ago` : `hace ${mins} min`;
  if (hours < 24)  return EN ? `${hours}h ago` : `hace ${hours}h`;
  if (days === 1)  return EN ? "Yesterday" : "Ayer";
  return new Date(dateStr).toLocaleDateString(EN ? "en-US" : "es-MX", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

const USER_COLORS = ["bg-[var(--brand)]", "bg-[#4F8A63]", "bg-[#7B1838]", "bg-[var(--accent)]", "bg-[#B06020]"];
function userColor(userId: string | null) {
  if (!userId) return USER_COLORS[0];
  const n = userId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return USER_COLORS[n % USER_COLORS.length];
}

export default function ActivityPage() {
  const { isSuperAdmin } = useAuth();
  const { language } = useLanguage();
  const EN = language === "en";
  const router = useRouter();

  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [users, setUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!isSuperAdmin) router.replace("/proyectos");
  }, [isSuperAdmin, router]);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (filterUser)   q = q.eq("user_name", filterUser);
    if (filterAction) q = q.eq("action", filterAction);
    if (filterFrom)   q = q.gte("created_at", filterFrom);
    if (filterTo)     q = q.lte("created_at", filterTo + "T23:59:59");
    const { data } = await q;
    const list = (data ?? []) as ActivityRow[];
    setRows(list);
    const uniqueUsers = [...new Set(list.map(r => r.user_name).filter(Boolean))] as string[];
    setUsers(uniqueUsers);
    setLoading(false);
  }, [filterUser, filterAction, filterFrom, filterTo]);

  useEffect(() => { load(); }, [load]);

  const today = rows.filter(r => {
    const d = new Date(r.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const logins   = rows.filter(r => r.action === "login").length;
  const creates  = rows.filter(r => r.action === "create").length;
  const deletes  = rows.filter(r => r.action === "delete").length;

  if (!isSuperAdmin) return null;

  return (
    <div className="animate-in fade-in duration-300">
      {/* Header */}
      <div className="mb-6 rounded-2xl bg-[var(--accent)] px-6 py-5">
        <h1 className="font-bookman text-xl font-semibold text-white">
          {EN ? "Activity Log" : "Registro de Actividad"}
        </h1>
        <p className="mt-1 text-sm text-[#B1C9EF]">
          {EN ? "Team actions · Last 100 entries · Superadmin only" : "Acciones del equipo · Últimas 100 entradas · Solo superadmin"}
        </p>
      </div>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {[
          { label: EN ? "Today" : "Hoy", value: today.length, color: "text-[var(--brand)]" },
          { label: EN ? "Logins" : "Logins", value: logins, color: "text-[var(--accent)]" },
          { label: EN ? "Created" : "Creados", value: creates, color: "text-[#4F8A63]" },
          { label: EN ? "Deleted" : "Eliminados", value: deletes, color: "text-[#B0492F]" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-[#E6DDCB] bg-white px-4 py-3 text-center">
            <div className="text-[10px] uppercase tracking-widest font-bold text-[#5C6A6E]">{s.label}</div>
            <div className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3 rounded-2xl border border-[#E6DDCB] bg-white px-5 py-4">
        <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
          className="rounded-lg border border-[#E6DDCB] bg-[#F7F3EA] px-3 py-2 text-sm text-[var(--brand)] focus:outline-none">
          <option value="">{EN ? "All users" : "Todos los usuarios"}</option>
          {users.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
          className="rounded-lg border border-[#E6DDCB] bg-[#F7F3EA] px-3 py-2 text-sm text-[var(--brand)] focus:outline-none">
          <option value="">{EN ? "All actions" : "Todas las acciones"}</option>
          <option value="login">🔑 Login</option>
          <option value="create">{EN ? "✅ Create" : "✅ Creó"}</option>
          <option value="delete">{EN ? "🗑 Delete" : "🗑 Eliminó"}</option>
          <option value="update">{EN ? "✏️ Update" : "✏️ Actualizó"}</option>
          <option value="mark_bought">{EN ? "🛒 Bought" : "🛒 Comprado"}</option>
        </select>
        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
          className="rounded-lg border border-[#E6DDCB] bg-[#F7F3EA] px-3 py-2 text-sm text-[var(--brand)] focus:outline-none" />
        <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
          className="rounded-lg border border-[#E6DDCB] bg-[#F7F3EA] px-3 py-2 text-sm text-[var(--brand)] focus:outline-none" />
        <button onClick={() => { setFilterUser(""); setFilterAction(""); setFilterFrom(""); setFilterTo(""); }}
          className="rounded-lg border border-[#E6DDCB] px-4 py-2 text-sm text-[#5C6A6E] hover:bg-[#F7F3EA]">
          {EN ? "Clear" : "Limpiar"}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] bg-white">
        {loading ? (
          <div className="py-12 text-center text-sm text-[#5C6A6E]">
            {EN ? "Loading…" : "Cargando…"}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#5C6A6E]">
            {EN ? "No activity yet." : "Sin actividad registrada aún."}
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E6DDCB] bg-[#F7F3EA]">
                {[EN ? "User" : "Usuario", EN ? "Action" : "Acción", EN ? "Project" : "Proyecto", EN ? "Detail" : "Detalle", EN ? "Time" : "Hora"].map(h => (
                  <th key={h} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#5C6A6E] ${h === (EN ? "Time" : "Hora") ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const act = ACTION_LABELS[row.action] ?? ACTION_LABELS.update;
                const ent = row.entity_type ? ENTITY_LABELS[row.entity_type] : null;
                const actionLabel = `${act.emoji} ${EN ? act.en : act.es}${ent ? " " + (EN ? ent.en : ent.es) : ""}`;
                return (
                  <tr key={row.id} className="border-b border-[#F0EBE0] hover:bg-[#FDFAF6] last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${userColor(row.user_id)}`}>
                          {initials(row.user_name)}
                        </div>
                        <div>
                          <div className="font-semibold text-[var(--brand)]">{row.user_name ?? "—"}</div>
                          <div className="text-[10px] text-[#5C6A6E]">{row.user_role === "superadmin" ? "Superadmin" : (EN ? "Collaborator" : "Colaborador")}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${act.bg} ${act.color}`}>
                        {actionLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.project_name
                        ? <><span className="font-medium text-[var(--accent)]">{row.project_name}</span></>
                        : <span className="text-[#C4B89A]">—</span>}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-[#5C6A6E]">
                      {row.entity_name ?? (row.action === "login" ? (EN ? "Web session" : "Sesión web") : "—")}
                    </td>
                    <td className="px-4 py-3 text-right text-[11px] text-[#C4B89A]">
                      {timeAgo(row.created_at, EN)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-4 text-[11px] text-[#97A1A0]">
        {EN
          ? "Only logins, creates, updates, deletes and material purchases are tracked."
          : "Solo se registran logins, creaciones, actualizaciones, eliminaciones y compras de material."}
      </p>
    </div>
  );
}
