"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/src/context/AuthContext";
import Link from "next/link";
import {
  LogOut, Menu, X, ChevronsLeft, Settings,
  LayoutDashboard, CalendarCheck2, Image as ImageIcon, BarChart3, Users,
  Sparkles, Globe, CalendarClock, Activity, CalendarDays, HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { VoiceProvider } from "@/src/context/VoiceContext";
import VoiceFAB from "@/src/components/ui/VoiceFAB";
import { useLanguage } from "@/src/context/LanguageContext";
import { branding } from "@/src/config/branding";

type NavItem = { href: string; label: string; icon: LucideIcon };
const COLLAPSE_KEY = "luxaris-nav-collapsed";
const ACCENT_KEY = "luxaris-accent";
const ACCENTS = [
  { id: "luxaris",  label: "Luxaris",  dab: "#16323D" },
  { id: "navy",     label: "Navy",     dab: "#2A4A7F" },
  { id: "ocean",    label: "Ocean",    dab: "#2563EB" },
  { id: "emerald",  label: "Emerald",  dab: "#0E7C57" },
  { id: "graphite", label: "Graphite", dab: "#3A4859" },
];

function applyAccent(id: string) {
  if (id === "luxaris") document.documentElement.removeAttribute("data-accent");
  else document.documentElement.setAttribute("data-accent", id);
}

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
  const [collapsed, setCollapsed] = useState(false);
  const [accent, setAccent] = useState("luxaris");

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => { try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch { /* noop */ } }, []);
  useEffect(() => {
    try {
      const a = localStorage.getItem(ACCENT_KEY);
      if (a) { setAccent(a); applyAccent(a); }
    } catch { /* noop */ }
  }, []);
  const toggleCollapse = () => setCollapsed(c => {
    const n = !c;
    try { localStorage.setItem(COLLAPSE_KEY, n ? "1" : "0"); } catch { /* noop */ }
    return n;
  });
  const changeAccent = (id: string) => {
    setAccent(id);
    applyAccent(id);
    try { localStorage.setItem(ACCENT_KEY, id); } catch { /* noop */ }
  };

  useEffect(() => { if (!isAdmin) router.replace("/"); }, [isAdmin, router]);
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
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
            onClick={async () => { setUnlockError(false); const ok = await unlockBiometric(); if (!ok) setUnlockError(true); }}
            className="mt-6 w-full rounded-xl bg-[#F5E9DA] py-3 text-sm font-bold text-[#16323D] hover:bg-white"
          >
            {t.panel.lock.unlock}
          </button>
          <button onClick={logout}
            className="mt-3 w-full rounded-xl border border-[#F5E9DA]/30 py-3 text-sm font-semibold text-[#F5E9DA]/80 hover:bg-white/5"
          >
            {t.panel.lock.usePin}
          </button>
        </div>
      </div>
    );
  }

  // Diarios siempre visibles; el resto se agrupa bajo "Más"
  const dailyLinks: NavItem[] = [
    { href: "/proyectos",           icon: LayoutDashboard, label: t.panel.nav.dashboard },
    { href: "/proyectos/hoy",       icon: CalendarCheck2,  label: t.panel.nav.today },
    { href: "/proyectos/fotos",     icon: ImageIcon,       label: t.panel.nav.photos },
    { href: "/proyectos/plan",      icon: BarChart3,       label: t.panel.nav.plan },
    { href: "/proyectos/contactos", icon: Users,           label: t.panel.nav.contacts },
  ];
  const moreLinks: NavItem[] = [
    ...(isSuperAdmin ? [
      { href: "/proyectos/prospectos", icon: Sparkles,      label: t.panel.nav.prospects },
      { href: "/proyectos/sitio",      icon: Globe,         label: t.panel.nav.site },
      { href: "/proyectos/agenda",     icon: CalendarClock, label: t.panel.nav.agenda },
      { href: "/proyectos/activity",   icon: Activity,      label: t.panel.nav.activity },
      { href: "/proyectos/reservas",   icon: CalendarDays,  label: t.panel.nav.bookings },
    ] : []),
    { href: "/proyectos/help", icon: HelpCircle, label: t.panel.nav.help },
  ];

  return (
    <VoiceProvider>
      <div className="min-h-screen bg-[#F7F3EB] lg:flex">

        {/* ── Sidebar (desktop): opción 2 (expandida) ↔ opción 3 (icon rail) ── */}
        <aside
          className={`relative hidden shrink-0 flex-col bg-[var(--brand)] transition-[width] duration-200 lg:sticky lg:top-0 lg:z-20 lg:flex lg:h-screen ${collapsed ? "lg:w-[76px]" : "lg:w-[236px]"}`}
          aria-label="Navegación del panel"
        >
          {/* LD colapsa/expande el menú */}
          <div className="flex items-center gap-2.5 px-3 py-3.5">
            <button
              onClick={toggleCollapse}
              aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
              title={collapsed ? "Expandir" : "Colapsar"}
              className="grid size-11 flex-none place-items-center rounded-xl bg-white/[0.12] text-sm font-bold text-white transition hover:bg-white/20"
            >
              {branding.initials}
            </button>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-[15px] font-bold text-white">{branding.companyShort}</div>
                <div className="text-[9px] uppercase tracking-[0.2em] text-[#8FA6A2]">{t.panel.nav.panelLabel}</div>
              </div>
            )}
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2 [scrollbar-width:none]">
            {dailyLinks.map(l => <SideLink key={l.href} item={l} collapsed={collapsed} />)}
            {moreLinks.length > 0 && (
              <div className="pt-3">
                {collapsed
                  ? <div className="mx-2 my-2 border-t border-white/10" />
                  : <div className="px-3 pb-1 text-[9px] font-bold uppercase tracking-[0.2em] text-[#6E8480]">{t.panel.nav.more}</div>}
                {moreLinks.map(l => <SideLink key={l.href} item={l} collapsed={collapsed} />)}
              </div>
            )}
          </nav>

          <div className="space-y-1 border-t border-white/10 px-3 py-3">
            <ThemeGear collapsed={collapsed} accent={accent} onPick={changeAccent} label={t.panel.nav.appearance} themeLabel={t.panel.nav.theme} />
            <button
              onClick={toggleCollapse}
              title={collapsed ? "Expandir" : "Colapsar"}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[#A9C1BC] transition hover:bg-white/[0.08] hover:text-white ${collapsed ? "justify-center" : ""}`}
            >
              <ChevronsLeft size={18} className={`shrink-0 transition ${collapsed ? "rotate-180" : ""}`} />
              {!collapsed && <span>{t.panel.nav.collapse}</span>}
            </button>
          </div>
        </aside>

        {/* ── Columna principal ── */}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[#D5DEEF] bg-[#F7F3EB]/90 px-4 py-2.5 backdrop-blur lg:px-6">
            {/* Móvil: logo + marca */}
            <Link href="/proyectos" className="flex items-center gap-2.5 lg:hidden" aria-label={`${branding.companyShort} Panel`}>
              <span className="grid size-9 place-items-center rounded-lg bg-[var(--brand)] text-xs font-bold text-white">{branding.initials}</span>
              <span className="text-sm font-bold text-[#16323D]">{branding.companyShort}</span>
            </Link>
            <div className="flex-1" />
            <div className="hidden lg:block"><LangSwitch /></div>
            <button
              id="panel-logout-btn"
              onClick={logout}
              aria-label={t.panel.nav.signOut}
              className="hidden items-center gap-1.5 rounded-lg border border-[#E6DDCB] bg-white px-3 py-2 text-xs font-bold text-[#16323D] transition hover:bg-[#ECE3D1] lg:inline-flex"
            >
              <LogOut size={14} />
              {t.panel.nav.signOut}
            </button>
            {/* Móvil: hamburguesa */}
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Menu"
              className="grid size-10 place-items-center rounded-lg border border-[#E6DDCB] bg-white text-[#16323D] transition hover:bg-[#ECE3D1] lg:hidden"
            >
              <Menu size={18} />
            </button>
          </header>

          <main className="mx-auto w-full max-w-[1400px] px-5 pb-28 pt-6 lg:px-8">{children}</main>
        </div>

        {/* ── Drawer móvil ── */}
        {menuOpen && (
          <div className="fixed inset-0 z-[400] lg:hidden" onClick={() => setMenuOpen(false)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="absolute right-0 top-0 flex h-full w-72 flex-col bg-[#F7F3EB] shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between bg-[var(--brand)] px-4 py-4">
                <span className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-lg bg-[#F5E9DA] text-xs font-bold text-[#16323D]">{branding.initials}</span>
                  <span className="text-sm font-bold text-white">{branding.companyShort}</span>
                </span>
                <button onClick={() => setMenuOpen(false)} className="text-white/60 hover:text-white" aria-label="Close menu">
                  <X size={20} />
                </button>
              </div>

              <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                {dailyLinks.map(l => <MobileTab key={l.href} item={l} />)}
                {moreLinks.length > 0 && (
                  <>
                    <p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#97A1A0]">{t.panel.nav.more}</p>
                    {moreLinks.map(l => <MobileTab key={l.href} item={l} />)}
                  </>
                )}
              </nav>

              <div className="space-y-3 border-t border-[#E6DDCB] p-4">
                <LangSwitch />
                <button onClick={logout}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#E6DDCB] bg-white px-3 py-2.5 text-xs font-bold text-[#16323D] transition hover:bg-[#ECE3D1]">
                  <LogOut size={14} />
                  {t.panel.nav.signOut}
                </button>
              </div>
            </div>
          </div>
        )}

        <VoiceFAB />
      </div>
    </VoiceProvider>
  );
}

function SideLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const active = pathname === item.href;
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition ${collapsed ? "justify-center" : ""} ${
        active ? "bg-white/[0.12] text-white" : "text-[#A9C1BC] hover:bg-white/[0.08] hover:text-white"
      }`}
    >
      {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--brand-accent)]" />}
      <Icon size={18} className="shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function MobileTab({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = pathname === item.href;
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition ${
        active ? "bg-[#395886] text-white shadow-sm" : "text-[#16323D] hover:bg-[#F0F3FA] hover:text-[#395886]"
      }`}
    >
      <Icon size={17} className="shrink-0" />
      {item.label}
    </Link>
  );
}

// Tuerca de configuración: cambia el tema de color del chrome (sidebar/drawer) vía tokens CSS.
function ThemeGear({
  collapsed, accent, onPick, label, themeLabel,
}: {
  collapsed: boolean; accent: string; onPick: (id: string) => void; label: string; themeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
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
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[#A9C1BC] transition hover:bg-white/[0.08] hover:text-white ${collapsed ? "justify-center" : ""}`}
      >
        <Settings size={18} className="shrink-0" />
        {!collapsed && <span>{label}</span>}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-xl border border-[#E6DDCB] bg-white p-3 shadow-xl">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#97A1A0]">{themeLabel}</div>
          <div className="grid grid-cols-5 gap-2">
            {ACCENTS.map(a => (
              <button
                key={a.id}
                onClick={() => onPick(a.id)}
                title={a.label}
                aria-label={a.label}
                aria-pressed={accent === a.id}
                className={`h-9 rounded-lg border-2 transition ${accent === a.id ? "border-[#16323D]" : "border-transparent hover:border-[#D5DEEF]"}`}
                style={{ background: a.dab }}
              />
            ))}
          </div>
          <p className="mt-2.5 text-[10.5px] leading-snug text-[#97A1A0]">
            Cambia el color del menú. El resto de la app se irá migrando a estos colores.
          </p>
        </div>
      )}
    </div>
  );
}
