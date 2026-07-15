"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Table2, BarChart3, X } from "lucide-react";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { supabase } from "@/src/lib/supabase";
import { logActivity } from "@/src/lib/activity";
import { money, initials } from "@/src/lib/utils";
import { specialtyDisplay } from "@/src/lib/specialties";
import type { Contact, ProjectAssignment } from "@/src/types/project";

interface ProjRow { id: string; title: string; client: string }
type SubTab = "matrix" | "reports";

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const plusDaysLocal = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const key = (pid: string, cid: string) => `${pid}::${cid}`;

export default function TeamPanel() {
  const { isSuperAdmin, currentUser } = useAuth();
  const { t, language } = useLanguage();
  const tt = t.panel.team;

  const [subTab, setSubTab]         = useState<SubTab>("matrix");
  const [coworkers, setCoworkers]   = useState<Contact[]>([]);
  const [projects, setProjects]     = useState<ProjRow[]>([]);
  const [assigns, setAssigns]       = useState<Map<string, ProjectAssignment>>(new Map());
  const [loading, setLoading]       = useState(true);
  const [toast, setToast]           = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    const [cRes, pRes, aRes] = await Promise.all([
      supabase.from("contacts").select("*").eq("type", "coworker").order("specialty").order("name"),
      supabase.from("projects").select("id, title, client").order("title"),
      supabase.from("project_contacts").select("project_id, contact_id, amount, start_date, end_date"),
    ]);
    setCoworkers((cRes.data as Contact[]) ?? []);
    setProjects((pRes.data as ProjRow[]) ?? []);
    const m = new Map<string, ProjectAssignment>();
    for (const a of (aRes.data as ProjectAssignment[]) ?? []) m.set(key(a.project_id, a.contact_id), a);
    setAssigns(m);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Mutaciones ────────────────────────────────────────────────────────── */
  const assign = useCallback(async (pid: string, cid: string) => {
    const row: ProjectAssignment = {
      project_id: pid, contact_id: cid, amount: 0,
      start_date: todayLocal(), end_date: plusDaysLocal(14),
    };
    const { error } = await supabase.from("project_contacts").insert(row);
    if (error) { showToast(error.message); return; }
    setAssigns(prev => new Map(prev).set(key(pid, cid), row));
    logActivity({
      user_id: currentUser?.id, user_name: currentUser?.name, user_role: "superadmin",
      action: "create", entity_type: "contact", entity_id: cid, entity_name: "assignment",
      project_id: pid,
    });
    showToast(tt.assigned);
  }, [currentUser, showToast, tt.assigned]);

  const unassign = useCallback(async (pid: string, cid: string) => {
    const { error } = await supabase.from("project_contacts").delete()
      .eq("project_id", pid).eq("contact_id", cid);
    if (error) { showToast(error.message); return; }
    setAssigns(prev => { const m = new Map(prev); m.delete(key(pid, cid)); return m; });
    showToast(tt.removed);
  }, [showToast, tt.removed]);

  const patchAssign = useCallback(async (pid: string, cid: string, patch: Partial<ProjectAssignment>) => {
    const k = key(pid, cid);
    setAssigns(prev => {
      const cur = prev.get(k); if (!cur) return prev;
      return new Map(prev).set(k, { ...cur, ...patch });
    });
    await supabase.from("project_contacts").update(patch).eq("project_id", pid).eq("contact_id", cid);
  }, []);

  /* ── Derivados ─────────────────────────────────────────────────────────── */
  const bySpecialty = useMemo(() => {
    const groups = new Map<string, Contact[]>();
    for (const c of coworkers) {
      const s = c.specialty || "";
      if (!groups.has(s)) groups.set(s, []);
      groups.get(s)!.push(c);
    }
    return [...groups.entries()];
  }, [coworkers]);

  const rowTotal = useCallback((cid: string) =>
    projects.reduce((s, p) => s + (assigns.get(key(p.id, cid))?.amount ?? 0), 0), [projects, assigns]);
  const colTotal = useCallback((pid: string) =>
    coworkers.reduce((s, c) => s + (assigns.get(key(pid, c.id))?.amount ?? 0), 0), [coworkers, assigns]);
  const grandTotal = useMemo(() =>
    [...assigns.values()].reduce((s, a) => s + a.amount, 0), [assigns]);

  if (!isSuperAdmin) {
    return (
      <div className="rounded-2xl border border-[#E6DDCB] bg-white p-8 text-center text-sm font-semibold text-[#5C6A6E]">
        {tt.onlyAdmin}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <div className="inline-flex rounded-xl border border-[#D7CBB3] bg-[#F7F3EA] p-0.5">
          {([
            { id: "matrix",  icon: <Table2 size={13} />,   label: tt.tabMatrix },
            { id: "reports", icon: <BarChart3 size={13} />, label: tt.tabReports },
          ] as const).map(x => (
            <button key={x.id} onClick={() => setSubTab(x.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12px] font-bold transition ${
                subTab === x.id ? "bg-[var(--accent)] text-white" : "text-[#5C6A6E] hover:text-[var(--brand)]"
              }`}>
              {x.icon} {x.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-[#F0EAE0]" />
      ) : coworkers.length === 0 ? (
        <div className="rounded-2xl border border-[#E6DDCB] bg-white p-8 text-center text-sm text-[#5C6A6E]">
          {tt.noCoworkers}
        </div>
      ) : subTab === "matrix" ? (
        <MatrixView
          coworkers={coworkers} projects={projects} bySpecialty={bySpecialty}
          assigns={assigns} language={language} tt={tt}
          rowTotal={rowTotal} colTotal={colTotal} grandTotal={grandTotal}
          onAssign={assign} onUnassign={unassign} onPatch={patchAssign}
        />
      ) : (
        <ReportsView
          coworkers={coworkers} projects={projects} assigns={assigns}
          language={language} tt={tt} rowTotal={rowTotal} grandTotal={grandTotal}
          onToast={showToast}
        />
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-[#F5E9DA] shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ═══ Opción B — Matriz de asignación ══════════════════════════════════════ */
type TeamT = ReturnType<typeof useLanguage>["t"]["panel"]["team"];

function MatrixView({
  coworkers, projects, bySpecialty, assigns, language, tt,
  rowTotal, colTotal, grandTotal, onAssign, onUnassign, onPatch,
}: {
  coworkers: Contact[]; projects: ProjRow[]; bySpecialty: [string, Contact[]][];
  assigns: Map<string, ProjectAssignment>; language: string; tt: TeamT;
  rowTotal: (cid: string) => number; colTotal: (pid: string) => number; grandTotal: number;
  onAssign: (pid: string, cid: string) => void;
  onUnassign: (pid: string, cid: string) => void;
  onPatch: (pid: string, cid: string, patch: Partial<ProjectAssignment>) => void;
}) {
  const [editing, setEditing] = useState<{ pid: string; cid: string } | null>(null);

  if (projects.length === 0) {
    return <div className="rounded-2xl border border-[#E6DDCB] bg-white p-8 text-center text-sm text-[#5C6A6E]">{tt.noProjects}</div>;
  }

  const short = (title: string) => title.split(" — ")[0].split("·")[0].trim();

  return (
    <>
      <p className="mb-3 text-[12px] italic text-[#97A1A0]">{tt.matrixHint}</p>
      <div className="overflow-x-auto rounded-2xl border border-[#E6DDCB] bg-white">
        <table className="min-w-[760px] w-full border-collapse text-[11.5px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[var(--brand)] px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-[#F5E9DA]">
                {tt.coworker}
              </th>
              {projects.map(p => (
                <th key={p.id} className="min-w-[92px] bg-[var(--brand)] px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-[#F5E9DA]">
                  {short(p.title)}
                </th>
              ))}
              <th className="bg-[#1E4152] px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-[#F5E9DA]">
                {tt.totalRow}
              </th>
            </tr>
          </thead>
          <tbody>
            {bySpecialty.map(([spec, people]) => (
              <Fragment key={`spec-${spec}`}>
                <tr>
                  <td colSpan={projects.length + 2} className="bg-[#F2EFE7] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#5C6A6E]">
                    {specialtyDisplay(spec, language)}
                  </td>
                </tr>
                {people.map(c => (
                  <tr key={c.id} className="border-t border-[#F0EBE0]">
                    <td className="sticky left-0 z-10 bg-[#FBF8F2] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="grid size-7 flex-none place-items-center rounded-md bg-[var(--brand)] text-[9px] font-bold text-[#F5E9DA]">
                          {initials(c.name)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-bold text-[var(--brand)]">{c.name}</div>
                          {c.rate && <div className="text-[9.5px] text-[#5C6A6E]">{c.rate}{c.rate_type === "hour" ? "/h" : "/d"}</div>}
                        </div>
                      </div>
                    </td>
                    {projects.map(p => {
                      const a = assigns.get(key(p.id, c.id));
                      const isEditing = editing?.pid === p.id && editing?.cid === c.id;
                      return (
                        <td key={p.id} className="px-1.5 py-1.5 text-center align-middle">
                          {a ? (
                            <div className="relative inline-flex flex-col items-center gap-0.5 rounded-lg border border-[#4F8A63] bg-[#EEF6F0] px-1.5 py-1">
                              <button
                                onClick={() => onUnassign(p.id, c.id)}
                                className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-white text-[#B0492F] shadow-sm hover:bg-[#FFF0EE]"
                                aria-label="remove"
                              >
                                <X size={9} />
                              </button>
                              <input
                                type="number" inputMode="decimal"
                                value={a.amount || ""}
                                onChange={e => onPatch(p.id, c.id, { amount: parseFloat(e.target.value) || 0 })}
                                placeholder="0"
                                className="w-16 bg-transparent text-center font-mono text-[11px] font-bold text-[var(--brand)] focus:outline-none"
                              />
                              <button
                                onClick={() => setEditing(isEditing ? null : { pid: p.id, cid: c.id })}
                                className="text-[8.5px] font-semibold text-[var(--accent)] hover:underline"
                              >
                                {a.start_date ? `${a.start_date.slice(5)}→${a.end_date?.slice(5) ?? "?"}` : "+ fechas"}
                              </button>
                              {isEditing && (
                                <div className="absolute top-full z-20 mt-1 flex flex-col gap-1 rounded-xl border border-[#E6DDCB] bg-white p-2 shadow-xl">
                                  <label className="text-[8px] font-bold uppercase text-[#97A1A0]">{tt.startDate}</label>
                                  <input type="date" value={a.start_date ?? ""}
                                    onChange={e => onPatch(p.id, c.id, { start_date: e.target.value })}
                                    className="rounded border border-[#E6DDCB] px-2 py-1 text-[11px]" />
                                  <label className="text-[8px] font-bold uppercase text-[#97A1A0]">{tt.endDate}</label>
                                  <input type="date" value={a.end_date ?? ""}
                                    onChange={e => onPatch(p.id, c.id, { end_date: e.target.value })}
                                    className="rounded border border-[#E6DDCB] px-2 py-1 text-[11px]" />
                                  <button onClick={() => setEditing(null)}
                                    className="mt-1 rounded-lg bg-[var(--brand)] py-1 text-[10px] font-bold text-white">
                                    {tt.save}
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => onAssign(p.id, c.id)}
                              className="grid h-8 w-16 place-items-center rounded-lg border border-dashed border-[#D7CBB3] text-[#B7AB93] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                              aria-label="assign"
                            >
                              +
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="bg-[#FBF8F2] px-3 py-2 text-right font-mono font-bold text-[var(--brand)]">
                      {money(rowTotal(c.id))}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#E6DDCB]">
              <td className="sticky left-0 z-10 bg-[#F2EFE7] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E]">
                {tt.totalCol}
              </td>
              {projects.map(p => (
                <td key={p.id} className="bg-[#F2EFE7] px-2 py-2 text-center font-mono font-bold text-[var(--brand)]">
                  {money(colTotal(p.id))}
                </td>
              ))}
              <td className="bg-[var(--brand)] px-3 py-2 text-right font-mono font-bold text-[#F5E9DA]">
                {money(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

/* ═══ Opción C — Roster + Reportes ═════════════════════════════════════════ */
function ReportsView({
  coworkers, projects, assigns, language, tt, rowTotal, grandTotal, onToast,
}: {
  coworkers: Contact[]; projects: ProjRow[]; assigns: Map<string, ProjectAssignment>;
  language: string; tt: TeamT; rowTotal: (cid: string) => number; grandTotal: number;
  onToast: (m: string) => void;
}) {
  const [selId, setSelId] = useState<string>(coworkers[0]?.id ?? "");
  const [from, setFrom]   = useState(plusDaysLocal(-60));
  const [to, setTo]       = useState(plusDaysLocal(60));

  const projById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const assignsOf = useCallback((cid: string) =>
    [...assigns.values()].filter(a => a.contact_id === cid), [assigns]);

  const inRange = useCallback((a: ProjectAssignment) =>
    (!a.end_date || a.end_date >= from) && (!a.start_date || a.start_date <= to), [from, to]);

  const sel = coworkers.find(c => c.id === selId) ?? coworkers[0];
  const mine = sel ? assignsOf(sel.id).filter(inRange) : [];
  const selTotal = mine.reduce((s, a) => s + a.amount, 0);
  const share = grandTotal ? Math.round(selTotal / grandTotal * 100) : 0;

  const exportCsv = useCallback(() => {
    if (!sel) return;
    const rows: string[] = [tt.csvHeaders];
    for (const a of mine) {
      const p = projById.get(a.project_id);
      const cells = [
        sel.name, specialtyDisplay(sel.specialty, language),
        p?.title ?? "", p?.client ?? "", a.start_date ?? "", a.end_date ?? "", String(a.amount),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`);
      rows.push(cells.join(","));
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `reporte-${sel.name.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
    onToast(tt.csvDownloaded);
  }, [sel, mine, projById, language, tt.csvHeaders, tt.csvDownloaded, onToast]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
      {/* Roster */}
      <div className="space-y-2">
        {coworkers.map(c => {
          const tot = rowTotal(c.id);
          const pct = grandTotal ? Math.round(tot / grandTotal * 100) : 0;
          return (
            <button key={c.id} onClick={() => setSelId(c.id)}
              className={`flex w-full items-center gap-2.5 rounded-xl border bg-white p-2.5 text-left transition ${
                selId === c.id ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-[#E6DDCB] hover:border-[#B7AB93]"
              }`}>
              <span className="grid size-9 flex-none place-items-center rounded-lg bg-[var(--brand)] text-[11px] font-bold text-[#F5E9DA]">
                {initials(c.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-bold text-[var(--brand)]">{c.name}</div>
                <div className="truncate text-[10.5px] text-[#5C6A6E]">{specialtyDisplay(c.specialty, language)}{c.rate ? ` · ${c.rate}` : ""}</div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#F0EBE0]">
                  <div className="h-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[12px] font-bold text-[var(--brand)]">{money(tot)}</div>
                <div className="text-[9.5px] text-[#5C6A6E]">{pct}% {tt.share}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Panel de reporte */}
      {sel && (
        <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] bg-white">
          <div className="flex flex-wrap items-center gap-3 bg-[var(--brand)] px-4 py-3">
            <span className="grid size-10 flex-none place-items-center rounded-lg bg-[#F5E9DA] text-sm font-bold text-[var(--brand)]">
              {initials(sel.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-bookman text-base font-semibold text-white">{sel.name}</div>
              <div className="text-[11px] text-[#F5E9DA]/70">{specialtyDisplay(sel.specialty, language)}{sel.rate ? ` · ${sel.rate}` : ""}</div>
            </div>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="rounded-lg border-0 px-2 py-1 text-[11px]" aria-label={tt.rangeFrom} />
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="rounded-lg border-0 px-2 py-1 text-[11px]" aria-label={tt.rangeTo} />
            <button onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5E9DA] px-3 py-1.5 text-[11px] font-bold text-[var(--brand)] hover:bg-white">
              <Download size={12} /> {tt.exportCsv}
            </button>
          </div>

          <div className="grid grid-cols-3 border-b border-[#E6DDCB] bg-[#F2EFE7]">
            {[
              { v: String(mine.length), l: tt.kpiProjects },
              { v: money(selTotal), l: tt.kpiAmount },
              { v: `${share}%`, l: tt.kpiShare },
            ].map(k => (
              <div key={k.l} className="border-r border-[#E6DDCB] px-4 py-3 last:border-r-0">
                <div className="font-mono text-[17px] font-bold text-[var(--brand)]">{k.v}</div>
                <div className="text-[9px] font-bold uppercase tracking-wide text-[#5C6A6E]">{k.l}</div>
              </div>
            ))}
          </div>

          <div>
            {mine.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12px] italic text-[#97A1A0]">{tt.noAssignments}</p>
            ) : mine.map(a => {
              const p = projById.get(a.project_id);
              const w = selTotal ? Math.round(a.amount / selTotal * 100) : 0;
              return (
                <div key={`${a.project_id}-${a.contact_id}`} className="flex items-center gap-3 border-b border-[#F2EFE7] px-4 py-2.5 text-[12px] last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-[var(--brand)]">{p?.title.split(" — ")[0] ?? "—"}</div>
                    <div className="truncate text-[10.5px] text-[#5C6A6E]">
                      {p?.client}{a.start_date ? ` · ${a.start_date} → ${a.end_date ?? "?"}` : ""}
                    </div>
                  </div>
                  <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-[#F0EBE0] sm:block">
                    <span className="block h-full bg-[#4F8A63]" style={{ width: `${w}%` }} />
                  </span>
                  <span className="w-20 text-right font-mono font-bold text-[var(--brand)]">{money(a.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
