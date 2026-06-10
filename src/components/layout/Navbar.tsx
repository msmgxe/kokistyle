"use client";

import Link from "next/link";
import { Menu } from "lucide-react";

import { branding } from "@/src/config/branding";
import { useLanguage } from "@/src/context/LanguageContext";
import type { Language } from "@/src/config/translations";
import Button from "../ui/Button";
import Container from "../ui/Container";

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
        <Link href="/" className="flex items-center gap-3" aria-label="KokiStyle home">
          <span className="grid size-10 place-items-center rounded-lg bg-[#0F3D56] text-sm font-bold text-white">
            KS
          </span>
          <span>
            <span className="block text-lg font-bold leading-none text-[#0F3D56]">
              KokiStyle
            </span>
            <span className="mt-1 block text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Florida
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
          <Button href="/#estimate" className="min-h-11 px-5 py-2.5">
            {t.nav.startEstimate}
          </Button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <MobileLanguageSwitch />
          <button
            className="grid size-11 place-items-center rounded-lg border border-[#0F3D56]/15 text-[#0F3D56]"
            aria-label={t.nav.openNavigation}
          >
            <Menu size={22} />
          </button>
        </div>
      </Container>
    </nav>
  );
}
