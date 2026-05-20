"use client";

import { motion } from "framer-motion";
import { BadgeCheck, Maximize2, PlayCircle } from "lucide-react";

import { useLanguage } from "@/src/context/LanguageContext";
import Button from "../ui/Button";
import Container from "../ui/Container";

export default function VirtualTour() {
  const { t } = useLanguage();

  return (
    <section id="tours" className="bg-[#0F3D56] py-20 text-white sm:py-24">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-70px" }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#F5E9DA]/80">
              {t.tours.eyebrow}
            </p>
            <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              {t.tours.title}
            </h2>
            <p className="mt-6 max-w-xl leading-8 text-white/75">
              {t.tours.description}
            </p>

            <div className="mt-8 grid gap-4">
              {t.tours.features.map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <BadgeCheck className="text-[#F5E9DA]" size={21} />
                  <span className="font-medium text-white/90">{feature}</span>
                </div>
              ))}
            </div>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button href="#estimate" variant="secondary">
                {t.tours.primaryCta}
              </Button>
              <Button href="#before-after" variant="ghost" className="text-white hover:bg-white/10">
                {t.tours.secondaryCta}
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-70px" }}
            transition={{ duration: 0.65 }}
            className="overflow-hidden rounded-lg border border-white/15 bg-white/8 shadow-[0_28px_90px_rgba(0,0,0,0.28)]"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
                <PlayCircle size={18} />
                {t.tours.preview}
              </div>
              <Maximize2 size={18} className="text-white/60" />
            </div>
            <div className="relative aspect-[16/10] overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85"
                alt={t.tours.imageAlt}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-[#0F3D56]/20" />
              <button className="absolute left-1/2 top-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/92 text-[#0F3D56] shadow-2xl transition hover:scale-105">
                <PlayCircle size={36} />
              </button>
            </div>
            <div className="grid gap-px bg-white/10 sm:grid-cols-3">
              {t.tours.scenes.map((label) => (
                <div key={label} className="bg-[#0F3D56] px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[#F5E9DA]/75">
                    {t.tours.scene}
                  </p>
                  <p className="mt-1 font-semibold">{label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
