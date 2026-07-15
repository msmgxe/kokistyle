"use client";

import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

import { useLanguage } from "@/src/context/LanguageContext";
import { initials } from "@/src/lib/utils";
import Container from "../ui/Container";

export default function Testimonials() {
  const { t } = useLanguage();
  const tt = t.testimonials;

  return (
    <section id="reviews" className="bg-[#F5E9DA] dark:bg-[#17233d] py-20 sm:py-24">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#0F3D56]/70">{tt.eyebrow}</p>
            <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#0F3D56] dark:text-[#e8edf7] sm:text-5xl">{tt.title}</h2>
          </div>
          <p className="max-w-2xl text-base leading-8 text-slate-700 lg:justify-self-end">{tt.description}</p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {tt.items.map((item, i) => (
            <motion.figure
              key={item.name}
              initial={{ opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="flex flex-col rounded-2xl bg-white dark:bg-[#111a2e] p-6 shadow-[0_18px_50px_rgba(15,61,86,0.1)]"
            >
              <Quote size={22} className="text-[#C9A227]" />
              <div className="mt-3 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} size={14} className="fill-[#C9A227] text-[#C9A227]" />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-sm leading-6 text-slate-700">
                “{item.quote}”
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-[#F0EBE0] dark:border-[#22304d] pt-4">
                <span className="grid size-9 flex-none place-items-center rounded-full bg-[#16323D] text-[11px] font-bold text-[#F5E9DA]">
                  {initials(item.name)}
                </span>
                <span>
                  <span className="block text-sm font-bold text-[#0F3D56] dark:text-[#e8edf7]">{item.name}</span>
                  <span className="block text-[11px] uppercase tracking-wide text-slate-500">{item.city}</span>
                </span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </Container>
    </section>
  );
}
