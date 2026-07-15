"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Phone, Mail, MessageCircle, Trash2, ExternalLink, Search } from "lucide-react";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { initials } from "@/src/lib/utils";
import type { Prospect, ProspectStatus } from "@/src/types/prospect";

const STATUSES: ProspectStatus[] = ["new", "contacted", "converted", "discarded"];
const STATUS_STYLE: Record<ProspectStatus, string> = {
  new:       "bg-[#DCE8E9] dark:bg-[#122a2c] text-[#4E7A82]",
  contacted: "bg-[#EDE3CF] dark:bg-[#17233d] text-[#7A6230]",
  converted: "bg-[#DCEBDD] dark:bg-[#14261c] text-[#4F8A63]",
  discarded: "bg-[#F0E0DC] text-[#B0492F]",
};

export default function ProspectosPage() {
  const { isSuperAdmin, currentUser } = useAuth();
  const { t } = useLanguage();
  const tp = t.panel.prospects;

  const [rows, setRows]       = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState<"all" | ProspectStatus>("all");
  const [toast, setToast]     = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const creds = useCallback(() => ({
    pin: currentUser?.pin || undefined,
    token: typeof window !== "undefined" ? (localStorage.getItem("kokistyle-device-token") || undefined) : undefined,
  }), [currentUser]);

  const call = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch("/api/prospects/admin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...creds(), ...body }),
    });
    return res.json();
  }, [creds]);

  const load = useCallback(async () => {
    const res = await call({ op: "list" });
    if (res.ok) setRows(res.prospects);
    setLoading(false);
  }, [call]);

  useEffect(() => { if (isSuperAdmin) load(); }, [isSuperAdmin, load]);

  const setStatus = useCallback(async (id: string, status: ProspectStatus) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    await call({ op: "update", id, status });
  }, [call]);

  const saveNote = useCallback(async (id: string) => {
    const notes = noteDraft[id] ?? "";
    setRows(prev => prev.map(r => r.id === id ? { ...r, notes } : r));
    await call({ op: "update", id, notes });
    showToast(tp.saved);
  }, [call, noteDraft, showToast, tp.saved]);

  const remove = useCallback(async (id: string) => {
    if (!window.confirm(tp.confirmDelete)) return;
    setRows(prev => prev.filter(r => r.id !== id));
    await call({ op: "delete", id });
    showToast(tp.deleted);
  }, [call, showToast, tp.confirmDelete, tp.deleted]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r =>
      (filter === "all" || r.status === filter) &&
      (!q || `${r.name} ${r.email} ${r.phone}`.toLowerCase().includes(q)));
  }, [rows, search, filter]);

  const kpi = useMemo(() => ({
    total: rows.length,
    nw: rows.filter(r => r.status === "new").length,
    conv: rows.filter(r => r.status === "converted").length,
  }), [rows]);

  if (!isSuperAdmin) {
    return <div className="rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-8 text-center text-sm font-semibold text-[#5C6A6E] dark:text-[#9fb0cc]">{tp.onlyAdmin}</div>;
  }

  const statusLabel = (s: ProspectStatus) =>
    s === "new" ? tp.statusNew : s === "contacted" ? tp.statusContacted : s === "converted" ? tp.statusConverted : tp.statusDiscarded;
  const waLink = (phone: string) => `https://wa.me/${phone.replace(/[^\d]/g, "")}`;

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-bookman text-2xl text-[var(--brand)]">🎯 {tp.title}</h1>
        <p className="text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">{tp.subtitle}</p>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        {[{ v: kpi.total, l: tp.kpiTotal }, { v: kpi.nw, l: tp.kpiNew }, { v: kpi.conv, l: tp.kpiConverted }].map(k => (
          <div key={k.l} className="rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-4 py-3">
            <p className="text-2xl font-bold tabular-nums text-[var(--brand)]">{k.v}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">{k.l}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#97A1A0] dark:text-[#728098]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tp.search}
            className="h-10 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] pl-9 pr-3 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none" />
        </div>
        <div className="inline-flex rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-[#F7F3EA] dark:bg-[#0b1220] p-0.5">
          {(["all", ...STATUSES] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${filter === s ? "bg-[var(--accent)] text-white" : "text-[#5C6A6E] dark:text-[#9fb0cc] hover:text-[var(--brand)]"}`}>
              {s === "all" ? tp.filterAll : statusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-[#F0EAE0] dark:bg-[#17233d]" />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-8 text-center text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">{tp.empty}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <div key={p.id} className="overflow-hidden rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e]">
              <div className="flex flex-wrap items-center gap-3 bg-[#F2EFE7] dark:bg-[#17233d] px-4 py-3">
                <span className="grid size-10 flex-none place-items-center rounded-lg bg-[var(--brand)] text-[12px] font-bold text-[#F5E9DA]">{initials(p.name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-bold text-[var(--brand)]">{p.name}</div>
                  <div className="truncate text-[11px] text-[#5C6A6E] dark:text-[#9fb0cc]">
                    {p.email} · {p.phone}
                    {(p.room_type || p.style) && <> · {tp.interestedIn}: {[p.style, p.room_type].filter(Boolean).join(" ")}</>}
                    {" · "}{p.renders_used} {tp.renders}
                  </div>
                </div>
                <select value={p.status} onChange={e => setStatus(p.id, e.target.value as ProspectStatus)}
                  className={`shrink-0 cursor-pointer rounded-full border-0 px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLE[p.status]}`}>
                  {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand)] px-3 py-1.5 text-[11px] font-bold text-[var(--brand)] hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]"><Phone size={12} /> {tp.call}</a>
                <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6DDCB] dark:border-[#22304d] px-3 py-1.5 text-[11px] font-bold text-[#5C6A6E] dark:text-[#9fb0cc] hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]"><Mail size={12} /> {tp.email}</a>
                <a href={waLink(p.phone)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[#4F8A63] px-3 py-1.5 text-[11px] font-bold text-[#4F8A63] hover:bg-[#EEF6F0] dark:hover:bg-[#14261c]"><MessageCircle size={12} /> {tp.whatsapp}</a>
                <button onClick={() => remove(p.id)} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-[#B0492F] hover:bg-[#FFF0EE] dark:hover:bg-[#2a1712]"><Trash2 size={12} /> {tp.delete}</button>
              </div>

              {(p.last_before_url || p.last_render_url) && (
                <div className="border-t border-[#F2EFE7] dark:border-[#22304d] px-4 py-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]">{tp.theyTried}</p>
                  <div className="flex flex-wrap gap-3">
                    {p.last_before_url && (
                      <a href={p.last_before_url} target="_blank" rel="noopener noreferrer" className="group relative block" title={tp.openFull}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.last_before_url} alt={tp.beforeLbl} className="h-28 w-40 rounded-lg object-cover ring-1 ring-[#E6DDCB]" />
                        <span className="absolute left-1.5 top-1.5 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600">{tp.beforeLbl}</span>
                      </a>
                    )}
                    {p.last_render_url && (
                      <a href={p.last_render_url} target="_blank" rel="noopener noreferrer" className="group relative block" title={tp.openFull}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.last_render_url} alt={tp.afterLbl} className="h-28 w-40 rounded-lg object-cover ring-1 ring-[#C9A227]" />
                        <span className="absolute left-1.5 top-1.5 rounded bg-[#C9A227] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--brand)]">{tp.afterLbl}</span>
                        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/45 p-1 text-white opacity-0 transition group-hover:opacity-100"><ExternalLink size={11} /></span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 border-t border-[#F2EFE7] dark:border-[#22304d] px-4 py-2.5">
                <input
                  value={noteDraft[p.id] ?? p.notes ?? ""}
                  onChange={e => setNoteDraft(d => ({ ...d, [p.id]: e.target.value }))}
                  placeholder={tp.notesPh}
                  className="h-9 flex-1 rounded-lg border border-[#E6DDCB] dark:border-[#22304d] bg-[#FBF8F2] dark:bg-[#17233d] px-3 text-[12px] text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none" />
                <button onClick={() => saveNote(p.id)} className="rounded-lg bg-[var(--brand)] px-3 py-2 text-[11px] font-bold text-white hover:bg-[var(--brand-strong)]">{tp.saveNote}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-[#F5E9DA] shadow-xl">{toast}</div>
      )}
    </div>
  );
}
