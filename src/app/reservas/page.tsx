"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/src/components/layout/Navbar";
import Footer from "@/src/components/layout/Footer";
import { useLanguage } from "@/src/context/LanguageContext";
import { supabase } from "@/src/lib/supabase";
import { branding } from "@/src/config/branding";

// ── Calendar helpers ────────────────────────────────────────────────────────

const MONTH_NAMES_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_NAMES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAY_NAMES_EN = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_ABBR = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const DAY_ABBR_ES = ["Do","Lu","Ma","Mi","Ju","Vi","Sá"];

const SLOTS_WEEKDAY = ["9:00 AM","10:00 AM","11:00 AM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM"];
const SLOTS_SATURDAY = ["9:00 AM","10:00 AM","11:00 AM"];

function getSlotsForDow(dow: number): string[] {
  if (dow === 0) return [];
  if (dow === 6) return SLOTS_SATURDAY;
  return SLOTS_WEEKDAY;
}

function isMorning(slot: string) {
  const h = parseInt(slot);
  return h < 12 || slot.includes("11");
}

function formatDateDisplay(date: Date, lang: string): string {
  const dow = date.getDay();
  const d = date.getDate();
  const m = date.getMonth();
  const y = date.getFullYear();
  const months = lang === "es" ? MONTH_NAMES_ES : MONTH_NAMES_EN;
  const days = DAY_NAMES_EN;
  return `${days[dow]}, ${months[m]} ${d}, ${y}`;
}

// ── State types ─────────────────────────────────────────────────────────────

interface CalState { year: number; month: number }
interface SelectedDate { date: Date; dow: number }

export default function ReservasPage() {
  const { t, language } = useLanguage();
  const tb = t.booking;

  const [step, setStep] = useState(1);
  const [serviceIdx, setServiceIdx] = useState<number | null>(null);
  const [cal, setCal] = useState<CalState>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<SelectedDate | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Form fields
  const [firstName, setFirstName]   = useState("");
  const [lastName,  setLastName]    = useState("");
  const [email,     setEmail]       = useState("");
  const [phone,     setPhone]       = useState("");
  const [address,   setAddress]     = useState("");
  const [notes,     setNotes]       = useState("");
  const [consent,   setConsent]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // ── Calendar ──────────────────────────────────────────────────────────────

  const changeMonth = useCallback((delta: number) => {
    setCal(prev => {
      let m = prev.month + delta;
      let y = prev.year;
      if (m > 11) { m = 0; y++; }
      if (m < 0)  { m = 11; y--; }
      return { year: y, month: m };
    });
    setSelectedDate(null);
    setSelectedTime(null);
  }, []);

  const renderCalendar = () => {
    const { year: y, month: m } = cal;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDow = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const months = language === "es" ? MONTH_NAMES_ES : MONTH_NAMES_EN;
    const dayAbbr = language === "es" ? DAY_ABBR_ES : DAY_ABBR;

    const days: React.ReactNode[] = [];

    // Empty cells
    for (let i = 0; i < firstDow; i++) {
      days.push(<div key={`e${i}`} />);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d);
      date.setHours(0, 0, 0, 0);
      const dow = date.getDay();
      const isPast = date < today;
      const isSun = dow === 0;
      const isSelected = selectedDate?.date.getTime() === date.getTime();
      const isToday = date.getTime() === today.getTime();

      let cls = "flex items-center justify-center rounded-xl text-sm font-semibold cursor-default transition-all aspect-square ";
      if (isSelected) {
        cls += "bg-[#16323D] text-white";
      } else if (isPast || isSun) {
        cls += "text-[#BFC5C6] opacity-50";
      } else {
        cls += "text-[#16323D] dark:text-[#e8edf7] hover:bg-[#EDF3FB] dark:hover:bg-[#111a2e] hover:text-[#395886] cursor-pointer" + (isToday ? " ring-2 ring-[#16323D]/20" : "");
      }

      days.push(
        <div
          key={d}
          className={cls}
          onClick={(!isPast && !isSun) ? () => {
            setSelectedDate({ date, dow });
            setSelectedTime(null);
          } : undefined}
        >
          {d}
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-5">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => changeMonth(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E6DDCB] dark:border-[#22304d] text-sm hover:border-[#16323D] transition">‹</button>
          <span className="text-sm font-bold text-[#16323D] dark:text-[#e8edf7]">{months[m]} {y}</span>
          <button onClick={() => changeMonth(1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E6DDCB] dark:border-[#22304d] text-sm hover:border-[#16323D] transition">›</button>
        </div>
        <div className="mb-1 grid grid-cols-7">
          {dayAbbr.map(d => (
            <div key={d} className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-[#97A1A0] dark:text-[#728098]">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days}
        </div>
      </div>
    );
  };

  const renderSlots = () => {
    if (!selectedDate) {
      return (
        <div className="flex items-center justify-center rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-8 text-center text-sm text-[#97A1A0] dark:text-[#728098]">
          ← {tb.noDateMsg}
        </div>
      );
    }
    const slots = getSlotsForDow(selectedDate.dow);
    if (slots.length === 0) {
      return (
        <div className="flex items-center justify-center rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-8 text-center text-sm text-[#97A1A0] dark:text-[#728098]">
          {tb.sundayClosed}
        </div>
      );
    }
    const morning = slots.filter(s => isMorning(s));
    const afternoon = slots.filter(s => !isMorning(s));

    const renderSlotGroup = (label: string, group: string[]) => (
      <div className="mb-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#97A1A0] dark:text-[#728098]">{label}</p>
        <div className="grid grid-cols-2 gap-2">
          {group.map(s => (
            <button key={s} onClick={() => setSelectedTime(s)}
              className={`rounded-xl border py-2.5 text-sm font-bold transition ${
                selectedTime === s
                  ? "border-[#16323D] bg-[#16323D] text-white"
                  : "border-[#E6DDCB] dark:border-[#22304d] text-[#16323D] dark:text-[#e8edf7] hover:border-[#395886] hover:bg-[#EDF3FB] dark:hover:bg-[#111a2e] hover:text-[#395886]"
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>
    );

    return (
      <div className="rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-5">
        {morning.length > 0 && renderSlotGroup(tb.morningLabel, morning)}
        {afternoon.length > 0 && renderSlotGroup(tb.afternoonLabel, afternoon)}
      </div>
    );
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim() || !address.trim()) {
      setSubmitError(tb.requiredFields);
      return;
    }
    if (!consent) {
      setSubmitError(tb.consentRequired);
      return;
    }
    const svc = tb.services[serviceIdx!];
    setSubmitting(true);
    setSubmitError("");
    const { error } = await supabase.from("bookings").insert({
      service: svc.title,
      service_icon: svc.icon,
      duration_min: svc.duration,
      booking_date: selectedDate!.date.toISOString().split("T")[0],
      booking_time: selectedTime!,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      notes: notes.trim() || null,
      status: "pending",
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(tb.submitError);
      return;
    }
    setStep(4);
  };

  // ── Progress step dots ────────────────────────────────────────────────────

  const STEP_LABELS = [tb.step1, tb.step2, tb.step3, tb.step4];

  const renderProgress = () => (
    <div className="mb-10 flex items-center">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const done   = n < step;
        const active = n === step;
        return (
          <div key={n} className="flex flex-1 flex-col items-center">
            <div className="relative flex w-full items-center">
              {i > 0 && (
                <div className={`absolute left-0 right-1/2 top-4 h-0.5 -translate-y-1/2 ${done || active ? "bg-[#16323D]" : "bg-[#E6DDCB] dark:bg-[#17233d]"}`} />
              )}
              {i < 3 && (
                <div className={`absolute left-1/2 right-0 top-4 h-0.5 -translate-y-1/2 ${done ? "bg-[#16323D]" : "bg-[#E6DDCB] dark:bg-[#17233d]"}`} />
              )}
              <div className={`relative z-10 mx-auto flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${
                done   ? "border-[#16323D] bg-[#16323D] text-white"
                : active ? "border-[#395886] bg-[#395886] text-white"
                : "border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] text-[#97A1A0] dark:text-[#728098]"
              }`}>
                {done ? "✓" : n}
              </div>
            </div>
            <span className={`mt-1.5 text-[10px] font-bold uppercase tracking-wider ${active ? "text-[#395886]" : done ? "text-[#16323D] dark:text-[#e8edf7]" : "text-[#97A1A0] dark:text-[#728098]"}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );

  const svc = serviceIdx !== null ? tb.services[serviceIdx] : null;

  // ── Render steps ──────────────────────────────────────────────────────────

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#F5E9DA] dark:bg-[#17233d] pb-20 pt-24">
        <div className="mx-auto max-w-3xl px-4">

          {/* Header */}
          <div className="mb-8 text-center">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-[#5C6A6E] dark:text-[#9fb0cc]">{branding.companyShort}</p>
            <h1 className="font-bookman text-3xl font-semibold tracking-tight text-[#16323D] dark:text-[#e8edf7]">{tb.pageTitle}</h1>
            <p className="mt-2 text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">{tb.pageSubtitle}</p>
          </div>

          {/* Progress */}
          {step < 4 && renderProgress()}

          {/* ── Step 1: Services ── */}
          {step === 1 && (
            <div>
              <div className="mb-6 text-center">
                <h2 className="font-bookman text-xl font-semibold text-[#16323D] dark:text-[#e8edf7]">{tb.step1Title}</h2>
                <p className="mt-1 text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">{tb.step1Subtitle}</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                {tb.services.map((s, i) => (
                  <button key={i} onClick={() => setServiceIdx(i)}
                    className={`relative rounded-2xl border-2 p-5 text-left transition-all hover:-translate-y-0.5 ${
                      serviceIdx === i
                        ? "border-[#16323D] bg-[#EDF6F8] shadow-md"
                        : "border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] hover:border-[#395886] hover:shadow-sm"
                    }`}>
                    {serviceIdx === i && (
                      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#16323D] text-[10px] text-white">✓</span>
                    )}
                    <span className="mb-3 block text-2xl">{s.icon}</span>
                    <h3 className="mb-1.5 text-sm font-extrabold text-[#16323D] dark:text-[#e8edf7]">{s.title}</h3>
                    <p className="mb-3 text-xs leading-relaxed text-[#5C6A6E] dark:text-[#9fb0cc]">{s.desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-[#F5E9DA] dark:bg-[#17233d] px-2.5 py-1 text-[10px] font-bold text-[#5C6A6E] dark:text-[#9fb0cc]">⏱ {s.duration} {tb.minLabel}</span>
                      <span className="rounded-full bg-[#DCEBDD] dark:bg-[#14261c] px-2.5 py-1 text-[10px] font-bold text-[#4F8A63]">{tb.freeLabel}</span>
                      {s.type === "virtual" && (
                        <span className="rounded-full bg-[#EDF3FB] dark:bg-[#111a2e] px-2.5 py-1 text-[10px] font-bold text-[#395886]">{tb.onlineLabel}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  disabled={serviceIdx === null}
                  onClick={() => setStep(2)}
                  className="rounded-xl bg-[#16323D] px-8 py-3.5 text-sm font-bold text-white transition hover:bg-[#1E4B5A] disabled:opacity-40 disabled:hover:bg-[#16323D]">
                  {tb.nextBtn} →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Date & Time ── */}
          {step === 2 && (
            <div>
              <div className="mb-6 text-center">
                <h2 className="font-bookman text-xl font-semibold text-[#16323D] dark:text-[#e8edf7]">{tb.step2Title}</h2>
                <p className="mt-1 text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">{tb.step2Subtitle}</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {renderCalendar()}
                {renderSlots()}
              </div>

              {selectedDate && selectedTime && (
                <div className="mt-4 rounded-xl bg-white dark:bg-[#111a2e] px-4 py-3 text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">
                  📅 <strong className="text-[#16323D] dark:text-[#e8edf7]">{formatDateDisplay(selectedDate.date, language)}</strong>
                  &nbsp;·&nbsp; ⏰ <strong className="text-[#16323D] dark:text-[#e8edf7]">{selectedTime}</strong>
                  &nbsp;·&nbsp; {svc?.title}
                </div>
              )}

              <div className="mt-8 flex justify-between gap-3">
                <button onClick={() => setStep(1)}
                  className="rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-6 py-3 text-sm font-bold text-[#5C6A6E] dark:text-[#9fb0cc] transition hover:border-[#16323D] hover:text-[#16323D] dark:hover:text-[#e8edf7]">
                  ← {tb.backBtn}
                </button>
                <button
                  disabled={!selectedDate || !selectedTime}
                  onClick={() => setStep(3)}
                  className="flex-1 max-w-[220px] rounded-xl bg-[#16323D] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#1E4B5A] disabled:opacity-40">
                  {tb.nextBtn} →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Contact form ── */}
          {step === 3 && (
            <div>
              <div className="mb-6 text-center">
                <h2 className="font-bookman text-xl font-semibold text-[#16323D] dark:text-[#e8edf7]">{tb.step3Title}</h2>
                <p className="mt-1 text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">{tb.step3Subtitle}</p>
              </div>

              {/* Booking summary */}
              {svc && selectedDate && selectedTime && (
                <div className="mb-5 flex items-center gap-4 rounded-2xl bg-white dark:bg-[#111a2e] px-5 py-4">
                  <span className="text-2xl">{svc.icon}</span>
                  <div>
                    <p className="font-bold text-[#16323D] dark:text-[#e8edf7]">{svc.title}</p>
                    <p className="text-xs text-[#5C6A6E] dark:text-[#9fb0cc]">
                      {formatDateDisplay(selectedDate.date, language)} · {selectedTime}
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#5C6A6E] dark:text-[#9fb0cc]">{tb.firstName} *</label>
                    <input value={firstName} onChange={e => setFirstName(e.target.value)}
                      placeholder={tb.firstNamePh}
                      className="rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#FDFAF6] dark:bg-[#111a2e] px-3.5 py-3 text-sm text-[#16323D] dark:text-[#e8edf7] outline-none focus:border-[#16323D]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#5C6A6E] dark:text-[#9fb0cc]">{tb.lastName} *</label>
                    <input value={lastName} onChange={e => setLastName(e.target.value)}
                      placeholder={tb.lastNamePh}
                      className="rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#FDFAF6] dark:bg-[#111a2e] px-3.5 py-3 text-sm text-[#16323D] dark:text-[#e8edf7] outline-none focus:border-[#16323D]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#5C6A6E] dark:text-[#9fb0cc]">{tb.emailLabel} *</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder={tb.emailPh}
                      className="rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#FDFAF6] dark:bg-[#111a2e] px-3.5 py-3 text-sm text-[#16323D] dark:text-[#e8edf7] outline-none focus:border-[#16323D]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#5C6A6E] dark:text-[#9fb0cc]">{tb.phoneLabel} *</label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder={tb.phonePh}
                      className="rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#FDFAF6] dark:bg-[#111a2e] px-3.5 py-3 text-sm text-[#16323D] dark:text-[#e8edf7] outline-none focus:border-[#16323D]" />
                  </div>
                  <div className="col-span-full flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#5C6A6E] dark:text-[#9fb0cc]">{tb.addressLabel} *</label>
                    <input value={address} onChange={e => setAddress(e.target.value)}
                      placeholder={tb.addressPh}
                      className="rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#FDFAF6] dark:bg-[#111a2e] px-3.5 py-3 text-sm text-[#16323D] dark:text-[#e8edf7] outline-none focus:border-[#16323D]" />
                  </div>
                  <div className="col-span-full flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#5C6A6E] dark:text-[#9fb0cc]">
                      {tb.notesLabel} <span className="normal-case font-normal text-[#97A1A0] dark:text-[#728098]">({tb.notesOptional})</span>
                    </label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder={tb.notesPh} rows={3}
                      className="resize-none rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#FDFAF6] dark:bg-[#111a2e] px-3.5 py-3 text-sm text-[#16323D] dark:text-[#e8edf7] outline-none focus:border-[#16323D]" />
                  </div>
                  <div className="col-span-full">
                    <label className="flex cursor-pointer items-start gap-2.5 text-xs text-[#5C6A6E] dark:text-[#9fb0cc]">
                      <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                        className="mt-0.5 accent-[#16323D]" />
                      {tb.consentText}
                    </label>
                  </div>
                </div>

                {submitError && (
                  <p className="mt-3 text-xs font-semibold text-[#B0492F]">{submitError}</p>
                )}
              </div>

              <div className="mt-8 flex justify-between gap-3">
                <button onClick={() => setStep(2)}
                  className="rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-6 py-3 text-sm font-bold text-[#5C6A6E] dark:text-[#9fb0cc] transition hover:border-[#16323D] hover:text-[#16323D] dark:hover:text-[#e8edf7]">
                  ← {tb.backBtn}
                </button>
                <button
                  disabled={submitting}
                  onClick={handleSubmit}
                  className="flex-1 max-w-[240px] rounded-xl bg-[#4F8A63] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#3A6B4A] disabled:opacity-60">
                  {submitting ? tb.submitting : tb.confirmBtn + " ✓"}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Confirmation ── */}
          {step === 4 && svc && selectedDate && selectedTime && (
            <div className="text-center">
              <div className="mb-4 text-5xl" style={{ animation: "bounceIn .5s ease" }}>🎉</div>
              <h2 className="font-bookman text-2xl font-semibold text-[#16323D] dark:text-[#e8edf7]">{tb.step4Title}</h2>
              <p className="mt-2 text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">{tb.step4Subtitle}</p>

              <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-6 text-left">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[#97A1A0] dark:text-[#728098]">Booking Summary</p>
                {[
                  { icon: "📋", strong: svc.title, sub: tb.confirmServiceLabel },
                  { icon: "📅", strong: formatDateDisplay(selectedDate.date, language), sub: selectedTime },
                  { icon: "📍", strong: address, sub: tb.confirmAddressLabel },
                  { icon: "👤", strong: `${firstName} ${lastName}`, sub: email },
                ].map((row, i) => (
                  <div key={i} className={`flex gap-3 py-3 ${i < 3 ? "border-b border-[#E6DDCB] dark:border-[#22304d]" : ""}`}>
                    <span className="mt-0.5 text-base">{row.icon}</span>
                    <div>
                      <strong className="block text-sm text-[#16323D] dark:text-[#e8edf7]">{row.strong}</strong>
                      <span className="text-xs text-[#5C6A6E] dark:text-[#9fb0cc]">{row.sub}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mx-auto mt-4 max-w-sm rounded-xl bg-[#F5E9DA] dark:bg-[#17233d] p-4 text-left text-xs leading-7 text-[#5C6A6E] dark:text-[#9fb0cc]">
                <strong className="block mb-1 text-[#16323D] dark:text-[#e8edf7]">{tb.nextStepsTitle}</strong>
                {tb.nextStep1}<br />{tb.nextStep2}<br />{tb.nextStep3}
              </div>

              <button onClick={() => {
                setStep(1); setServiceIdx(null); setSelectedDate(null); setSelectedTime(null);
                setFirstName(""); setLastName(""); setEmail(""); setPhone(""); setAddress(""); setNotes(""); setConsent(false);
              }}
                className="mt-6 rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-5 py-2.5 text-sm font-bold text-[#5C6A6E] dark:text-[#9fb0cc] transition hover:border-[#16323D] hover:text-[#16323D] dark:hover:text-[#e8edf7]">
                {tb.bookAnother}
              </button>
            </div>
          )}
        </div>

        <style>{`
          @keyframes bounceIn {
            0%   { transform: scale(0); }
            60%  { transform: scale(1.2); }
            100% { transform: scale(1); }
          }
        `}</style>
      </main>
      <Footer />
    </>
  );
}
