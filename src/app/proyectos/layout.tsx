"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/src/context/AuthContext";
import Link from "next/link";
import { LogOut, Menu, X, MoreHorizontal, ChevronDown } from "lucide-react";
import { VoiceProvider } from "@/src/context/VoiceContext";
import VoiceFAB from "@/src/components/ui/VoiceFAB";
import { useLanguage } from "@/src/context/LanguageContext";
import { branding } from "@/src/config/branding";

function LangSwitch() {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="flex rounded-lg border border-[#D5DEEF] bg-[#F0F3FA] p-0.5">
      {(["en", "es"] as const).map((l) => (
        <button key={l} onClick={() => setLanguage(l)}
          className={`rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide transition ${language === l ? "bg-[#395886] text-white" : "text-[#628ECB] hover:text-[#395886]"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

export default function ProyectosLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, isSuperAdmin, logout, locked, unlockBiometric } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [unlockError, setUnlockError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (!isAdmin) router.replace("/");
  }, [isAdmin, router]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F3EB]">
        <p className="text-sm font-semibold text-[#5C6A6E]">Verificando acceso…</p>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#16323D] px-6">
        <div className="w-full max-w-sm text-center">
          <span className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-[#F5E9DA] text-xl font-bold text-[#16323D]">
            {branding.initials}
          </span>
          <h1 className="text-lg font-bold text-white">{t.panel.lock.title}</h1>
          <p className="mt-1 text-sm text-[#F5E9DA]/70">{t.panel.lock.subtitle}</p>
          {unlockError && (
            <p className="mt-3 rounded-xl bg-[#B0492F]/20 px-3 py-2 text-xs font-semibold text-[#F0A090]">
              {t.panel.lock.failed}
            </p>
          )}
          <button
            onClick={async () => {
              setUnlockError(false);
              const ok = await unlockBiometric();
              if (!ok) setUnlockError(true);
            }}
            className="mt-6 w-full rounded-xl bg-[#F5E9DA] py-3 text-sm font-bold text-[#16323D] hover:bg-white"
          >
            {t.panel.lock.unlock}
          </button>
          <button
            onClick={logout}
            className="mt-3 w-full rounded-xl border border-[#F5E9DA]/30 py-3 text-sm font-semibold text-[#F5E9DA]/80 hover:bg-white/5"
          >
            {t.panel.lock.usePin}
          </button>
        </div>
      </div>
    );
  }

  // Deja visibles solo los links "diarios"; el resto va al menú "Más" (top nav más limpio)
  const dailyLinks = [
    { href: "/proyectos",           label: t.panel.nav.dashboard },
    { href: "/proyectos/hoy",       label: t.panel.nav.today },
    { href: "/proyectos/fotos",     label: t.panel.nav.photos },
    { href: "/proyectos/plan",      label: t.panel.nav.plan },
    { href: "/proyectos/contactos", label: t.panel.nav.contacts },
  ];
  const moreLinks = [
    ...(isSuperAdmin ? [
      { href: "/proyectos/prospectos", label: t.panel.nav.prospects },
      { href: "/proyectos/sitio",      label: t.panel.nav.site },
      { href: "/proyectos/agenda",     label: t.panel.nav.agenda },
      { href: "/proyectos/activity",   label: t.panel.nav.activity },
      { href: "/proyectos/reservas",   label: t.panel.nav.bookings },
    ] : []),
    { href: "/proyectos/help", label: t.panel.nav.help },
  ];

  return (
    <VoiceProvider>
      <div className="min-h-screen bg-[#F7F3EB]">
        <nav
          className="sticky top-0 z-30 border-b border-[#D5DEEF] bg-[#F7F3EB]"
          aria-label="Panel de administración"
        >
          <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-5 py-3">
            <Link href="/proyectos" className="flex items-center gap-3" aria-label={`${branding.companyShort} Panel`}>
              <span className="grid size-10 flex-none place-items-center rounded-lg bg-[#16323D] text-sm font-bold text-white">
                {branding.initials}
              </span>
              <span>
                <span className="block text-base font-bold leading-none text-[#16323D]">{branding.companyShort}</span>
                <span className="mt-0.5 block text-[10px] uppercase tracking-[0.22em] text-[#5C6A6E]">{t.panel.nav.panelLabel}</span>
              </span>
            </Link>

            <nav className="hidden flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] lg:flex">
              {dailyLinks.map(l => <PanelTab key={l.href} href={l.href} label={l.label} />)}
              {moreLinks.length > 0 && <NavMore links={moreLinks} label={t.panel.nav.more} />}
            </nav>

            <div className="hidden lg:block">
              <LangSwitch />
            </div>

            <button
              id="panel-logout-btn"
              onClick={logout}
              className="hidden flex-none items-center gap-1.5 rounded-lg border border-[#E6DDCB] bg-white px-3 py-2 text-xs font-bold text-[#16323D] transition hover:bg-[#ECE3D1] lg:inline-flex"
              aria-label={t.panel.nav.signOut}
            >
              <LogOut size={14} />
              {t.panel.nav.signOut}
            </button>

            {/* Hamburguesa — solo móvil */}
            <button
              onClick={() => setMenuOpen(true)}
              className="ml-auto grid size-10 flex-none place-items-center rounded-lg border border-[#E6DDCB] bg-white text-[#16323D] transition hover:bg-[#ECE3D1] lg:hidden"
              aria-label="Menu"
            >
              <Menu size={18} />
            </button>
          </div>
        </nav>

        {/* ── Drawer móvil ─────────────────────────────────────────────────── */}
        {menuOpen && (
          <div className="fixed inset-0 z-[400] lg:hidden" onClick={() => setMenuOpen(false)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
              className="absolute right-0 top-0 flex h-full w-72 flex-col bg-[#F7F3EB] shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between bg-[#16323D] px-4 py-4">
                <span className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-lg bg-[#F5E9DA] text-xs font-bold text-[#16323D]">
                    {branding.initials}
                  </span>
                  <span className="text-sm font-bold text-white">{branding.companyShort}</span>
                </span>
                <button onClick={() => setMenuOpen(false)} className="text-white/60 hover:text-white" aria-label="Close menu">
                  <X size={20} />
                </button>
              </div>

              <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                {dailyLinks.map(l => <MobileTab key={l.href} href={l.href} label={l.label} />)}
                {moreLinks.length > 0 && (
                  <>
                    <p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#97A1A0]">
                      {t.panel.nav.more}
                    </p>
                    {moreLinks.map(l => <MobileTab key={l.href} href={l.href} label={l.label} />)}
                  </>
                )}
              </nav>

              <div className="space-y-3 border-t border-[#E6DDCB] p-4">
                <LangSwitch />
                <button
                  onClick={logout}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#E6DDCB] bg-white px-3 py-2.5 text-xs font-bold text-[#16323D] transition hover:bg-[#ECE3D1]"
                >
                  <LogOut size={14} />
                  {t.panel.nav.signOut}
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="mx-auto max-w-[1400px] px-6 pb-28 pt-7">{children}</main>

        <VoiceFAB />
      </div>
    </VoiceProvider>
  );
}

function MobileTab({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`block rounded-xl px-4 py-3 text-sm font-bold transition ${
        isActive
          ? "bg-[#395886] text-white shadow-sm"
          : "text-[#16323D] hover:bg-[#F0F3FA] hover:text-[#395886]"
      }`}
    >
      {label}
    </Link>
  );
}

function PanelTab({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-bold transition ${
        isActive
          ? "bg-[#395886] text-white shadow-sm"
          : "text-[#628ECB] hover:bg-[#F0F3FA] hover:text-[#395886]"
      }`}
    >
      {label}
    </Link>
  );
}

// Menú "Más" del top nav: agrupa los links secundarios (Prospects/Site/Agenda/Activity/Bookings/Help)
function NavMore({ links, label }: { links: { href: string; label: string }[]; label: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = links.some(l => l.href === pathname);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-bold transition ${
          open || isActive
            ? "bg-[#395886] text-white shadow-sm"
            : "text-[#628ECB] hover:bg-[#F0F3FA] hover:text-[#395886]"
        }`}
      >
        <MoreHorizontal size={15} />
        {label}
        <ChevronDown size={13} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1.5 w-52 overflow-hidden rounded-xl border border-[#D5DEEF] bg-white py-1 shadow-xl"
        >
          {links.map(l => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                role="menuitem"
                className={`block px-4 py-2.5 text-[13px] font-bold transition ${
                  active ? "bg-[#F0F3FA] text-[#395886]" : "text-[#16323D] hover:bg-[#F0F3FA] hover:text-[#395886]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
