"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/src/context/LanguageContext";
import { supabase } from "@/src/lib/supabase";
import type { Booking, BookingStatus } from "@/src/types/booking";

const MONTH_NAMES_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_NAMES_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

type Filter = "all" | "pending" | "confirmed" | "done";

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending:   "bg-[#FEF6ED] text-[#B8921A]",
  confirmed: "bg-[#DCEBDD] text-[#4F8A63]",
  done:      "bg-[#F5E9DA] text-[#5C6A6E]",
  cancelled: "bg-[#FDE8E3] text-[#B0492F]",
};

function avatarInitials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function avatarColor(name: string): string {
  const colors = ["#16323D","#395886","#4F8A63","#B8921A","#7B6A45","#5C6A6E"];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) % colors.length;
  return colors[Math.abs(hash)];
}

export default function ReservasAdminPage() {
  const { t, language } = useLanguage();
  const tb = t.panel.bookings;

  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<Filter>("all");
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [updating, setUpdating]   = useState<string | null>(null);

  const months = language === "es" ? MONTH_NAMES_ES : MONTH_NAMES_EN;

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .order("booking_date", { ascending: true })
      .order("booking_time", { ascending: true });
    setBookings((data as Booking[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: BookingStatus) => {
    setUpdating(id);
    await supabase.from("bookings").update({ status }).eq("id", id);
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    setUpdating(null);
  };

  const formatDate = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return `${months[m - 1]} ${d}, ${y}`;
  };

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const isThisWeek = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return d >= weekStart && d <= weekEnd;
  };

  const kpiPending   = bookings.filter(b => b.status === "pending").length;
  const kpiConfirmed = bookings.filter(b => b.status === "confirmed").length;
  const kpiThisWeek  = bookings.filter(b => isThisWeek(b.booking_date) && b.status !== "cancelled").length;
  const kpiTotal     = bookings.filter(b => b.status !== "cancelled").length;

  const filtered = filter === "all"
    ? bookings.filter(b => b.status !== "cancelled")
    : bookings.filter(b => b.status === filter);

  const statusLabel = (s: BookingStatus): string => {
    const map: Record<BookingStatus, string> = {
      pending:   tb.statusPending,
      confirmed: tb.statusConfirmed,
      done:      tb.statusDone,
      cancelled: tb.statusCancelled,
    };
    return map[s];
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-bookman text-2xl font-semibold text-[var(--brand)]">{tb.title}</h1>
          <p className="mt-0.5 text-xs text-[#5C6A6E]">{tb.subtitle}</p>
        </div>
        <a
          href="/reservas"
          target="_blank"
          className="flex-none rounded-xl bg-[var(--brand)] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#1E4B5A]">
          View booking page ↗
        </a>
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { val: kpiThisWeek,  lab: tb.kpiThisWeek,  color: "text-[var(--brand)]"  },
          { val: kpiPending,   lab: tb.kpiPending,   color: "text-[#B8921A]"  },
          { val: kpiConfirmed, lab: tb.kpiConfirmed, color: "text-[#4F8A63]"  },
          { val: kpiTotal,     lab: tb.kpiTotal,     color: "text-[var(--accent)]"  },
        ].map((k, i) => (
          <div key={i} className="rounded-2xl border border-[#E6DDCB] bg-white p-4">
            <p className={`text-2xl font-extrabold ${k.color}`}>{k.val}</p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[#97A1A0]">{k.lab}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-1">
        {(["all","pending","confirmed","done"] as Filter[]).map(f => {
          const labels: Record<Filter, string> = {
            all: tb.filterAll, pending: tb.filterPending, confirmed: tb.filterConfirmed, done: tb.filterDone
          };
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                filter === f
                  ? "bg-[var(--accent)] text-white"
                  : "bg-white text-[#628ECB] hover:bg-[#EDF3FB]"
              }`}>
              {labels[f]}
            </button>
          );
        })}
      </div>

      {/* Booking list */}
      <div className="overflow-hidden rounded-2xl border border-[#E6DDCB] bg-white">
        {loading ? (
          <p className="px-6 py-10 text-center text-sm text-[#97A1A0]">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-[#97A1A0]">{tb.noBookings}</p>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden grid-cols-[2fr_1.4fr_1fr_1.2fr] gap-4 border-b border-[#E6DDCB] bg-[#F7F3EA] px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#97A1A0] sm:grid">
              <div>{tb.colClient}</div>
              <div>{tb.colDateTime}</div>
              <div>{tb.colStatus}</div>
              <div>{tb.colActions}</div>
            </div>

            {filtered.map(b => {
              const isOpen = expanded === b.id;
              const initials = avatarInitials(b.first_name, b.last_name);
              const color = avatarColor(b.first_name + b.last_name);

              return (
                <div key={b.id} className="border-b border-[#E6DDCB] last:border-0">
                  {/* Main row */}
                  <div
                    className="grid cursor-pointer grid-cols-1 gap-3 px-5 py-4 transition hover:bg-[#FDFAF6] sm:grid-cols-[2fr_1.4fr_1fr_1.2fr] sm:items-center"
                    onClick={() => setExpanded(isOpen ? null : b.id)}>

                    {/* Client + service */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: color }}>{initials}</div>
                      <div>
                        <p className="text-sm font-bold text-[var(--brand)]">{b.first_name} {b.last_name}</p>
                        <p className="text-xs text-[#5C6A6E]">{b.service_icon} {b.service}</p>
                      </div>
                    </div>

                    {/* Date & time */}
                    <div className="sm:pl-0 pl-12">
                      <p className="text-sm font-semibold text-[var(--brand)]">{formatDate(b.booking_date)}</p>
                      <p className="text-xs text-[#5C6A6E]">{b.booking_time} · {b.duration_min} {tb.durationLabel}{b.duration_min === 45 && b.service.toLowerCase().includes("virtual") ? ` · ${tb.onlineLabel}` : ""}</p>
                    </div>

                    {/* Status */}
                    <div className="pl-12 sm:pl-0">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_COLORS[b.status]}`}>
                        {statusLabel(b.status)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pl-12 sm:pl-0" onClick={e => e.stopPropagation()}>
                      {b.status === "pending" && (
                        <button
                          disabled={updating === b.id}
                          onClick={() => updateStatus(b.id, "confirmed")}
                          className="rounded-lg bg-[#4F8A63] px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-[#3A6B4A] disabled:opacity-50">
                          ✓ {tb.actionConfirm}
                        </button>
                      )}
                      {b.status === "confirmed" && (
                        <button
                          disabled={updating === b.id}
                          onClick={() => updateStatus(b.id, "done")}
                          className="rounded-lg border border-[#E6DDCB] px-3 py-1.5 text-[10px] font-bold text-[#5C6A6E] transition hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-50">
                          {tb.actionDone}
                        </button>
                      )}
                      {(b.status === "pending" || b.status === "confirmed") && (
                        <button
                          disabled={updating === b.id}
                          onClick={() => updateStatus(b.id, "cancelled")}
                          className="rounded-lg border border-[#E6DDCB] px-3 py-1.5 text-[10px] font-bold text-[#B0492F] transition hover:border-[#B0492F] disabled:opacity-50">
                          ✕
                        </button>
                      )}
                      <span className="flex items-center text-[#C5BEB4] text-xs">{isOpen ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isOpen && (
                    <div className="border-t border-[#E6DDCB] bg-[#FDFAF6] px-5 py-4">
                      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs sm:grid-cols-4">
                        <div>
                          <p className="font-bold uppercase tracking-wider text-[#97A1A0]">{tb.phoneLabel}</p>
                          <a href={`tel:${b.phone}`} className="text-[var(--accent)] underline">{b.phone}</a>
                        </div>
                        <div>
                          <p className="font-bold uppercase tracking-wider text-[#97A1A0]">{tb.emailLabel}</p>
                          <a href={`mailto:${b.email}`} className="text-[var(--accent)] underline">{b.email}</a>
                        </div>
                        <div className="col-span-2">
                          <p className="font-bold uppercase tracking-wider text-[#97A1A0]">{tb.addressLabel}</p>
                          <p className="text-[var(--brand)]">{b.address}</p>
                        </div>
                        {b.notes && (
                          <div className="col-span-full mt-1">
                            <p className="font-bold uppercase tracking-wider text-[#97A1A0]">{tb.notesLabel}</p>
                            <p className="text-[#5C6A6E]">{b.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
