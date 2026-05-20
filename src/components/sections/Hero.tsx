"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Play } from "lucide-react";

import { useLanguage } from "@/src/context/LanguageContext";
import Button from "../ui/Button";
import Container from "../ui/Container";

const galleryImages = [
  {
    src: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=90",
    alt: "Luxury interior remodel with warm natural light",
  },
  {
    src: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=700&q=85",
    alt: "Premium kitchen remodeling with marble island",
  },
];

export default function Hero() {
  const { t } = useLanguage();

  return (
    <section
      id="home"
      className="relative isolate overflow-hidden bg-[#F5E9DA] pt-28 text-[#0F3D56] sm:pt-32"
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
            {t.hero.eyebrow}
          </p>

          <h1 className="text-5xl font-bold leading-[0.98] text-[#0F3D56] sm:text-6xl lg:text-7xl">
            {t.hero.title}
          </h1>

          <p className="mt-7 max-w-2xl text-base leading-8 text-slate-700 sm:text-lg">
            {t.hero.description}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button href="#estimate">
              {t.hero.primaryCta} <ArrowRight size={18} />
            </Button>
            <Button href="#tours" variant="secondary">
              <Play size={18} /> {t.hero.secondaryCta}
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
                  <CheckCircle2 size={17} className="text-[#0F3D56]" />
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
            <img
              src={galleryImages[0].src}
              alt={galleryImages[0].alt}
              className="h-full w-full object-cover object-center"
            />
          </div>
          <div className="absolute bottom-0 left-0 h-[46%] w-[54%] overflow-hidden rounded-lg border-8 border-[#F5E9DA] shadow-[0_24px_70px_rgba(15,61,86,0.2)]">
            <img
              src={galleryImages[1].src}
              alt={galleryImages[1].alt}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="absolute bottom-10 right-4 max-w-[260px] rounded-lg bg-white/92 p-5 shadow-[0_18px_55px_rgba(15,61,86,0.18)] backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
              {t.hero.currentFocusLabel}
            </p>
            <p className="mt-2 text-xl font-bold leading-tight text-[#0F3D56]">
              {t.hero.currentFocus}
            </p>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
