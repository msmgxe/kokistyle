"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Play } from "lucide-react";

import { useLanguage } from "@/src/context/LanguageContext";
import { useSiteContent } from "@/src/context/SiteContentContext";
import { SITE_DEFAULTS } from "@/src/types/site";
import Button from "../ui/Button";
import Container from "../ui/Container";

export default function Hero() {
  const { t, language } = useLanguage();
  const { content } = useSiteContent();
  const h = content.hero ?? {};
  const bi = (f?: { en?: string; es?: string }, fb = "") => (language === "es" ? f?.es : f?.en) || fb;

  const eyebrow      = bi(h.eyebrow, t.hero.eyebrow);
  const title        = bi(h.title, t.hero.title);
  const description  = bi(h.description, t.hero.description);
  const primaryLabel = bi(h.primaryLabel, t.hero.primaryCta);
  const primaryHref  = h.primaryHref || "#ai-design";
  const secondaryLbl = bi(h.secondaryLabel, t.hero.secondaryCta);
  const secondaryHref = h.secondaryHref || "#tours";
  const imgMain      = h.imageMain || SITE_DEFAULTS.heroMain;
  const imgSecondary = h.imageSecondary || SITE_DEFAULTS.heroSecondary;
  const focusLabel   = bi(h.focusLabel, t.hero.currentFocusLabel);
  const focusValue   = bi(h.focusValue, t.hero.currentFocus);

  return (
    <section
      id="home"
      className="relative isolate overflow-hidden bg-[#F5E9DA] dark:bg-[#17233d] pt-28 text-[#0F3D56] dark:text-[#e8edf7] sm:pt-32"
    >
      <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-white/70" />
      <Container className="grid min-h-[calc(100vh-5rem)] items-center gap-12 pb-12 lg:grid-cols-[1.02fr_0.98fr] lg:pb-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="max-w-3xl"
        >
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.32em] text-[#0F3D56]/75 sm:text-sm">
            {eyebrow}
          </p>

          <h1 className="font-display text-5xl font-semibold leading-[0.95] text-[#0F3D56] dark:text-[#e8edf7] sm:text-6xl lg:text-7xl">
            {title}
          </h1>

          <p className="mt-7 max-w-2xl text-base leading-8 text-slate-700 sm:text-lg">
            {description}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button href={primaryHref}>
              {primaryLabel} <ArrowRight size={18} />
            </Button>
            <Button href={secondaryHref} variant="secondary">
              <Play size={18} /> {secondaryLbl}
            </Button>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {t.hero.stats.map((stat) => (
              <div key={stat.label} className="border-l border-[#0F3D56]/20 pl-4">
                <span className="block text-2xl font-bold">{stat.value}</span>
                <span className="mt-1 block text-sm text-slate-600">{stat.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3 text-sm font-medium text-slate-700">
            {t.hero.proof.map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <CheckCircle2 size={17} className="text-[#0F3D56] dark:text-[#e8edf7]" />
                  {item}
                </span>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
          className="relative min-h-[520px]"
        >
          <div className="absolute right-0 top-0 h-[72%] w-[82%] overflow-hidden rounded-lg shadow-[0_32px_90px_rgba(15,61,86,0.22)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgMain} alt={title} className="h-full w-full object-cover object-center" />
          </div>
          <div className="absolute bottom-0 left-0 h-[46%] w-[54%] overflow-hidden rounded-lg border-8 border-[#F5E9DA] dark:border-[#2c3c5e] shadow-[0_24px_70px_rgba(15,61,86,0.2)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgSecondary} alt={focusValue} className="h-full w-full object-cover" />
          </div>
          <div className="absolute bottom-10 right-4 max-w-[260px] rounded-lg bg-white/92 p-5 shadow-[0_18px_55px_rgba(15,61,86,0.18)] backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
              {focusLabel}
            </p>
            <p className="mt-2 text-xl font-bold leading-tight text-[#0F3D56] dark:text-[#e8edf7]">
              {focusValue}
            </p>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
