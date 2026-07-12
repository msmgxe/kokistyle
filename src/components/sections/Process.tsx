"use client";

import { motion } from "framer-motion";
import { ClipboardList, PencilRuler, FileText, Hammer, KeyRound } from "lucide-react";

import { useLanguage } from "@/src/context/LanguageContext";
import Container from "../ui/Container";

const ICONS = [ClipboardList, PencilRuler, FileText, Hammer, KeyRound];

export default function Process() {
  const { t } = useLanguage();
  const tp = t.process;

  return (
    <section id="process" className="bg-white py-20 sm:py-24">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#0F3D56]/70">{tp.eyebrow}</p>
          <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#0F3D56] sm:text-5xl">{tp.title}</h2>
          <p className="mt-5 text-base leading-8 text-slate-600">{tp.description}</p>
        </div>

        <ol className="relative mt-14 grid gap-8 md:grid-cols-5">
          {/* connecting line (desktop) */}
          <div className="absolute left-0 right-0 top-7 hidden h-px bg-[#E6DDCB] md:block" aria-hidden />
          {tp.steps.map((step, i) => {
            const Icon = ICONS[i] ?? ClipboardList;
            return (
              <motion.li
                key={step.t}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="relative flex flex-col items-center text-center md:items-start md:text-left"
              >
                <div className="relative z-10 grid size-14 place-items-center rounded-2xl bg-[#16323D] text-[#F5E9DA] shadow-[0_10px_30px_rgba(15,61,86,0.2)]">
                  <Icon size={22} />
                  <span className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-[#C9A227] text-[11px] font-black text-[#16323D]">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-bold text-[#0F3D56]">{step.t}</h3>
                <p className="mt-2 max-w-[15rem] text-sm leading-6 text-slate-600">{step.d}</p>
              </motion.li>
            );
          })}
        </ol>
      </Container>
    </section>
  );
}
