"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/src/context/AuthContext";
import Link from "next/link";
import { LogOut } from "lucide-react";
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
  const { isAdmin, isSuperAdmin, logout } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

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

  return (
    <VoiceProvider>
      <div className="min-h-screen bg-[#F7F3EB]">
        <nav
          className="sticky top-0 z-30 border-b border-[#D5DEEF] bg-[#F7F3EB]"
          aria-label="Panel de administración"
        >
          <div className="mx-auto flex max-w-[1180px] items-center gap-4 px-6 py-3">
            <Link href="/proyectos" className="flex items-center gap-3" aria-label={`${branding.companyShort} Panel`}>
              <span className="grid size-10 flex-none place-items-center rounded-lg bg-[#16323D] text-sm font-bold text-white">
                {branding.initials}
              </span>
              <span>
                <span className="block text-base font-bold leading-none text-[#16323D]">{branding.companyShort}</span>
                <span className="mt-0.5 block text-[10px] uppercase tracking-[0.22em] text-[#5C6A6E]">{t.panel.nav.panelLabel}</span>
              </span>
            </Link>

            <nav className="flex flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
              <PanelTab href="/proyectos" label={t.panel.nav.dashboard} />
              <PanelTab href="/proyectos/plan" label={t.panel.nav.plan} />
              <PanelTab href="/proyectos/contactos" label={t.panel.nav.contacts} />
              {isSuperAdmin && <PanelTab href="/proyectos/agenda" label={t.panel.nav.agenda} />}
              {isSuperAdmin && <PanelTab href="/proyectos/activity" label={t.panel.nav.activity} />}
              {isSuperAdmin && <PanelTab href="/proyectos/reservas" label={t.panel.nav.bookings} />}
              <PanelTab href="/proyectos/help" label={t.panel.nav.help} />
            </nav>

            <LangSwitch />

            <button
              id="panel-logout-btn"
              onClick={logout}
              className="inline-flex flex-none items-center gap-1.5 rounded-lg border border-[#E6DDCB] bg-white px-3 py-2 text-xs font-bold text-[#16323D] transition hover:bg-[#ECE3D1]"
              aria-label={t.panel.nav.signOut}
            >
              <LogOut size={14} />
              {t.panel.nav.signOut}
            </button>
          </div>
        </nav>

        <main className="mx-auto max-w-[1180px] px-6 pb-28 pt-7">{children}</main>

        <VoiceFAB />
      </div>
    </VoiceProvider>
  );
}

function PanelTab({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
        isActive
          ? "bg-[#395886] text-white shadow-sm"
          : "text-[#628ECB] hover:bg-[#F0F3FA] hover:text-[#395886]"
      }`}
    >
      {label}
    </Link>
  );
}
