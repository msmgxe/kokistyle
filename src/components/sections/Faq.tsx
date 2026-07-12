"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Minus } from "lucide-react";

import { useLanguage } from "@/src/context/LanguageContext";
import Container from "../ui/Container";

export default function Faq() {
  const { t } = useLanguage();
  const tf = t.faq;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-white py-20 sm:py-24">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          {/* Left — heading */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#0F3D56]/70">{tf.eyebrow}</p>
            <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#0F3D56] sm:text-5xl">{tf.title}</h2>
            <p className="mt-5 text-base leading-8 text-slate-600">{tf.description}</p>
            <Link
              href="/reservas"
              className="mt-7 inline-flex items-center justify-center rounded-xl bg-[#16323D] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#1E4B5A]"
            >
              {tf.cta}
            </Link>
          </div>

          {/* Right — accordion */}
          <div className="divide-y divide-[#E6DDCB] border-y border-[#E6DDCB]">
            {tf.items.map((item, i) => {
              const isOpen = open === i;
              return (
                <div key={item.q}>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="text-base font-bold text-[#0F3D56]">{item.q}</span>
                    <span className={`grid size-7 flex-none place-items-center rounded-full transition ${isOpen ? "bg-[#16323D] text-white" : "bg-[#F5E9DA] text-[#0F3D56]"}`}>
                      {isOpen ? <Minus size={15} /> : <Plus size={15} />}
                    </span>
                  </button>
                  <div className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr] pb-5" : "grid-rows-[0fr]"}`}>
                    <div className="overflow-hidden">
                      <p className="max-w-xl text-sm leading-7 text-slate-600">{item.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}
