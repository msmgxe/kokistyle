"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { branding } from "@/src/config/branding";
import { useLanguage } from "@/src/context/LanguageContext";
import type { Language } from "@/src/config/translations";
import Container from "../ui/Container";
import AdminModal from "../ui/AdminModal";

const navItems = [
  { labelKey: "services", href: "/#services" },
  { labelKey: "beforeAfter", href: "/#before-after" },
  { labelKey: "tours", href: "/#tours" },
  { labelKey: "estimate", href: "/#estimate" },
  { labelKey: "bath360", href: "/proyectos/cliente-01" },
] as const;

const languages: Language[] = ["en", "es"];

function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      className="flex rounded-lg border border-[#0F3D56]/15 bg-white p-1"
      aria-label="Language selector"
    >
      {languages.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setLanguage(item)}
          className={`min-h-9 rounded-md px-3 text-xs font-bold uppercase tracking-[0.14em] transition ${
            language === item
              ? "bg-[#0F3D56] text-white"
              : "text-[#0F3D56] hover:bg-[#F5E9DA]"
          }`}
          aria-pressed={language === item}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function MobileLanguageSwitch() {
  return (
    <div className="md:hidden">
      <LanguageSwitch />
    </div>
  );
}

export default function Navbar() {
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const navLabels = {
    services: t.nav.services,
    beforeAfter: t.nav.beforeAfter,
    tours: t.nav.tours,
    estimate: t.nav.estimate,
    bath360: t.nav.bath360,
  };

  return (
    <nav className="fixed left-0 top-0 z-50 w-full border-b border-white/50 bg-white/85 backdrop-blur-xl">
      <Container className="flex items-center justify-between py-4">
        <Link href="/" className="flex items-center gap-3" aria-label={`${branding.companyShort} home`}>
          <span className="grid size-10 place-items-center rounded-lg bg-[#0F3D56] text-sm font-bold text-white">
            {branding.initials}
          </span>
          <span>
            <span className="block text-lg font-bold leading-none text-[#0F3D56]">
              {branding.companyShort}
            </span>
            <span className="mt-1 block text-[11px] uppercase tracking-[0.24em] text-slate-500">
              South Florida
            </span>
          </span>
        </Link>

        <div className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-slate-700 transition hover:text-[#0F3D56]"
            >
              {navLabels[item.labelKey]}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <LanguageSwitch />
          <a className="text-sm font-semibold text-[#0F3D56]" href={`tel:${branding.phone}`}>
            {branding.phone}
          </a>
          <Link
            href="/reservas"
            className="inline-flex items-center rounded-xl bg-[#16323D] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1E4B5A]"
          >
            {t.nav.book}
          </Link>
          <button
            id="navbar-admin-btn"
            type="button"
            onClick={() => setAdminOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#B1C9EF]/60 bg-[#EDF3FB] px-4 py-2.5 text-sm font-semibold text-[#628ECB] transition hover:bg-[#D5DEEF] hover:text-[#395886]"
            aria-label="Login"
          >
            Login
          </button>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <MobileLanguageSwitch />
          <button
            type="button"
            onClick={() => setAdminOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#B1C9EF]/60 bg-[#EDF3FB] px-3 py-2.5 text-sm font-semibold text-[#628ECB] transition hover:bg-[#D5DEEF]"
            aria-label="Login"
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="grid size-11 place-items-center rounded-lg border border-[#0F3D56]/15 text-[#0F3D56]"
            aria-label={menuOpen ? t.nav.closeNavigation : t.nav.openNavigation}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </Container>

      {menuOpen ? (
        <div
          id="mobile-menu"
          className="border-t border-[#0F3D56]/10 bg-white/95 backdrop-blur-xl lg:hidden"
        >
          <Container className="flex flex-col gap-1 py-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-slate-700 transition hover:bg-[#F5E9DA] hover:text-[#0F3D56]"
              >
                {navLabels[item.labelKey]}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-3 border-t border-[#0F3D56]/10 pt-4 md:hidden">
              <a
                className="px-3 text-base font-semibold text-[#0F3D56]"
                href={`tel:${branding.phone}`}
              >
                {branding.phone}
              </a>
              <Link
                href="/reservas"
                onClick={() => setMenuOpen(false)}
                className="inline-flex items-center justify-center rounded-xl bg-[#16323D] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1E4B5A]"
              >
                {t.nav.book}
              </Link>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); setAdminOpen(true); }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#B1C9EF]/60 bg-[#EDF3FB] px-4 py-2.5 text-sm font-semibold text-[#628ECB] transition hover:bg-[#D5DEEF] hover:text-[#395886]"
              >
                Login
              </button>
            </div>
          </Container>
        </div>
      ) : null}

      <AdminModal isOpen={adminOpen} onClose={() => setAdminOpen(false)} />
    </nav>
  );
}
