"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";

import { useLanguage } from "@/src/context/LanguageContext";
import Container from "../ui/Container";

const SAMPLES = [
  {
    before: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1000&q=80",
    after:  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=85",
  },
  {
    before: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1000&q=80",
    after:  "https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=1000&q=85",
  },
  {
    before: "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=1000&q=80",
    after:  "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1000&q=85",
  },
];

export default function AiDesignPreview() {
  const { t } = useLanguage();
  const ta = t.aiDesign;
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(55);
  const containerRef = useRef<HTMLDivElement>(null);

  const move = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, pct)));
  };

  return (
    <section id="ai-design" className="bg-[#0F2A33] py-20 text-white sm:py-24">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          {/* Copy */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#C9A227]/40 bg-[#C9A227]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#E7C86A]">
              <Sparkles size={13} /> {ta.badge}
            </span>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.3em] text-[#9FB9C4]">
              {ta.eyebrow}
            </p>
            <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              {ta.title}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-[#C6D4DA]">
              {ta.description}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/reservas"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C9A227] px-6 py-3.5 text-sm font-bold text-[#16323D] transition hover:bg-[#dab63f]"
              >
                {ta.cta} <ArrowRight size={16} />
              </Link>
              <a
                href="#before-after"
                className="inline-flex items-center justify-center rounded-xl border border-white/25 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {ta.secondary}
              </a>
            </div>

            <p className="mt-6 max-w-md text-xs leading-6 text-[#8FA6AF]">{ta.note}</p>
          </div>

          {/* Slider before/after */}
          <div>
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-70px" }}
              transition={{ duration: 0.6 }}
              ref={containerRef}
              className="relative aspect-[4/3] w-full cursor-ew-resize select-none overflow-hidden rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
              onMouseMove={(e) => e.buttons === 1 && move(e.clientX)}
              onPointerDown={(e) => move(e.clientX)}
              onTouchMove={(e) => move(e.touches[0].clientX)}
            >
              {/* After (base) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SAMPLES[active].after} alt={ta.after} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
              <span className="absolute right-4 top-4 rounded-md bg-[#C9A227] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#16323D]">
                {ta.after}
              </span>
              {/* Before (clipped) */}
              <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={SAMPLES[active].before} alt={ta.before} className="absolute inset-0 h-full w-full object-cover grayscale-[35%]" draggable={false} />
                <span className="absolute left-4 top-4 rounded-md bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-700">
                  {ta.before}
                </span>
              </div>
              {/* Handle */}
              <div className="absolute inset-y-0" style={{ left: `${pos}%` }}>
                <div className="absolute inset-y-0 -ml-px w-0.5 bg-white/90" />
                <div className="absolute top-1/2 -ml-4 -translate-y-1/2 grid size-8 place-items-center rounded-full bg-white text-[#16323D] shadow-lg">
                  <ArrowRight size={13} className="-mr-0.5" />
                  <ArrowRight size={13} className="ml-0.5 rotate-180" style={{ position: "absolute" }} />
                </div>
              </div>
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                {ta.dragHint}
              </span>
            </motion.div>

            {/* Thumbnails */}
            <div className="mt-4 flex justify-center gap-3">
              {ta.samples.map((s, i) => (
                <button
                  key={s.space}
                  onClick={() => { setActive(i); setPos(55); }}
                  className={`rounded-xl px-4 py-2 text-left transition ${
                    active === i ? "bg-white/15 ring-1 ring-[#C9A227]" : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <span className="block text-[12px] font-bold text-white">{s.space}</span>
                  <span className="block text-[10px] uppercase tracking-wide text-[#9FB9C4]">{s.city}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
