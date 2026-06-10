"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { motion } from "framer-motion";
import { BadgeCheck, MapPin, Ruler } from "lucide-react";

import { cliente01Content } from "@/src/config/cliente01";
import { useLanguage } from "@/src/context/LanguageContext";
import Button from "../ui/Button";
import Container from "../ui/Container";

const Bathroom360Viewer = dynamic(() => import("./Bathroom360Viewer"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[420px] w-full place-items-center rounded-xl bg-black/40 text-sm text-white/50 sm:h-[560px]">
      Loading 3D…
    </div>
  ),
});

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-70px" },
  transition: { duration: 0.6 },
} as const;

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p
      className={`text-xs font-bold uppercase tracking-[0.3em] ${
        light ? "text-[#F5E9DA]/80" : "text-[#8BA890]"
      }`}
    >
      {children}
    </p>
  );
}

export default function Cliente01Showcase() {
  const { language } = useLanguage();
  const c = cliente01Content[language];

  return (
    <div className="pt-[72px]">
      {/* ── Hero ── */}
      <section className="bg-gradient-to-br from-[#0F3D56] via-[#1a5a7a] to-[#0F3D56] py-20 text-white sm:py-24">
        <Container>
          <motion.div {...fadeUp} className="mx-auto max-w-3xl text-center">
            <Eyebrow light>{c.hero.eyebrow}</Eyebrow>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">{c.hero.title}</h1>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[#F5E9DA]/90">
              <span className="flex items-center gap-2">
                <MapPin size={16} /> {c.hero.location}
              </span>
              <span className="flex items-center gap-2">
                <Ruler size={16} /> {c.hero.size}
              </span>
            </div>
            <p className="mt-6 leading-8 text-white/75">{c.hero.description}</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button href="#tour360" variant="secondary">
                {c.hero.ctaTour}
              </Button>
              <Button href="#budget" variant="ghost" className="text-white hover:bg-white/10">
                {c.hero.ctaBudget}
              </Button>
            </div>
          </motion.div>
        </Container>
      </section>

      {/* ── Photos: current + inspiration ── */}
      <section className="bg-[#F9F7F4] py-20 sm:py-24">
        <Container>
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <Eyebrow>{c.photos.eyebrow}</Eyebrow>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#0F3D56] sm:text-4xl">
              {c.photos.title}
            </h2>
            <p className="mt-5 leading-8 text-slate-600">{c.photos.description}</p>
          </motion.div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:mx-auto lg:max-w-4xl">
            {(
              [
                {
                  src: "/proyectos/cliente-01/antes.jpg",
                  label: c.photos.beforeLabel,
                  caption: c.photos.beforeCaption,
                  badge: "bg-[#0F3D56]",
                },
                {
                  src: "/proyectos/cliente-01/inspiracion.jpg",
                  label: c.photos.inspirationLabel,
                  caption: c.photos.inspirationCaption,
                  badge: "bg-[#8BA890]",
                },
              ] as const
            ).map((photo) => (
              <motion.figure
                key={photo.src}
                {...fadeUp}
                className="overflow-hidden rounded-xl bg-white shadow-[0_24px_70px_rgba(15,61,86,0.14)]"
              >
                <div className="relative aspect-[3/4] w-full">
                  <Image
                    src={photo.src}
                    alt={photo.caption}
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-cover"
                  />
                  <span
                    className={`absolute left-4 top-4 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-white ${photo.badge}`}
                  >
                    {photo.label}
                  </span>
                </div>
                <figcaption className="px-5 py-4 text-sm text-slate-600">{photo.caption}</figcaption>
              </motion.figure>
            ))}
          </div>
        </Container>
      </section>

      {/* ── 360° Tour ── */}
      <section id="tour360" className="bg-[#111] py-20 sm:py-24">
        <Container>
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center text-white">
            <Eyebrow light>{c.viewer.eyebrow}</Eyebrow>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{c.viewer.title}</h2>
            <p className="mt-5 leading-8 text-white/65">{c.viewer.description}</p>
          </motion.div>
          <div className="mt-10">
            <Bathroom360Viewer labels={c.viewer} />
          </div>
        </Container>
      </section>

      {/* ── Materials ── */}
      <section className="bg-white py-20 sm:py-24">
        <Container>
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <Eyebrow>{c.materials.eyebrow}</Eyebrow>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#0F3D56] sm:text-4xl">
              {c.materials.title}
            </h2>
            <p className="mt-5 leading-8 text-slate-600">{c.materials.description}</p>
          </motion.div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {c.materials.items.map((item) => (
              <motion.div
                key={item.area}
                {...fadeUp}
                className="rounded-xl border border-[#0F3D56]/10 bg-[#F9F7F4] p-6"
              >
                <span
                  className="block size-11 rounded-full border-2 border-white shadow"
                  style={{ backgroundColor: item.swatch }}
                />
                <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  {item.area}
                </p>
                <h3 className="mt-1 font-semibold text-[#0F3D56]">{item.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.spec}</p>
                <p className="mt-3 border-t border-[#0F3D56]/10 pt-3 text-xs leading-5 text-slate-500">
                  <span className="font-bold uppercase tracking-[0.12em] text-[#8BA890]">
                    {c.materials.dimensionLabel}:
                  </span>{" "}
                  {item.dimensions}
                </p>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Palette ── */}
      <section className="bg-[#0F3D56] py-20 text-white sm:py-24">
        <Container>
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <Eyebrow light>{c.palette.eyebrow}</Eyebrow>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{c.palette.title}</h2>
            <p className="mt-5 leading-8 text-white/70">{c.palette.description}</p>
          </motion.div>

          <div className="mt-12 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
            {c.palette.colors.map((color) => (
              <motion.div key={color.hex} {...fadeUp} className="text-center">
                <span
                  className="mx-auto block size-20 rounded-full border-4 border-white/15 shadow-xl"
                  style={{ backgroundColor: color.hex }}
                />
                <p className="mt-4 font-semibold">{color.name}</p>
                <p className="mt-1 font-mono text-xs uppercase text-[#F5E9DA]/70">{color.hex}</p>
                <p className="mt-2 text-xs leading-5 text-white/55">{color.usage}</p>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Floor plan & dimensions ── */}
      <section className="bg-[#F9F7F4] py-20 sm:py-24">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <motion.div {...fadeUp}>
              <Eyebrow>{c.plan.eyebrow}</Eyebrow>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#0F3D56] sm:text-4xl">
                {c.plan.title}
              </h2>
              <p className="mt-5 leading-8 text-slate-600">{c.plan.description}</p>
              <ul className="mt-7 grid gap-3">
                {c.plan.legend.map((line) => (
                  <li key={line} className="flex items-center gap-3 text-slate-700">
                    <BadgeCheck className="shrink-0 text-[#8BA890]" size={20} />
                    <span className="text-sm font-medium">{line}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              {...fadeUp}
              className="mx-auto w-full max-w-md rounded-xl bg-white p-6 shadow-[0_24px_70px_rgba(15,61,86,0.14)]"
            >
              <FloorPlanSVG labels={c.plan.planLabels} />
            </motion.div>
          </div>
        </Container>
      </section>

      {/* ── Budget ── */}
      <section id="budget" className="bg-white py-20 sm:py-24">
        <Container>
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <Eyebrow>{c.budget.eyebrow}</Eyebrow>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#0F3D56] sm:text-4xl">
              {c.budget.title}
            </h2>
            <p className="mt-5 leading-8 text-slate-600">{c.budget.description}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {c.budget.perNote}
            </p>
          </motion.div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {c.budget.packages.map((pkg) => (
              <motion.div
                key={pkg.tag}
                {...fadeUp}
                className={`relative flex flex-col rounded-xl border p-7 ${
                  pkg.highlighted
                    ? "border-[#8BA890] bg-[#8BA890]/6 shadow-[0_28px_80px_rgba(139,168,144,0.25)]"
                    : "border-[#0F3D56]/10 bg-[#F9F7F4]"
                }`}
              >
                {pkg.highlighted && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#8BA890] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-white">
                    {c.budget.recommended}
                  </span>
                )}
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#C9A840]">
                  {pkg.tag}
                </p>
                <h3 className="mt-2 text-2xl font-bold text-[#0F3D56]">{pkg.name}</h3>
                <p className="mt-3 text-3xl font-bold tracking-tight text-[#0F3D56]">{pkg.range}</p>
                <p className="mt-4 text-sm leading-6 text-slate-600">{pkg.description}</p>
                <ul className="mt-6 grid gap-2.5">
                  {pkg.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <BadgeCheck className="mt-0.5 shrink-0 text-[#8BA890]" size={17} />
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          {/* Premium breakdown */}
          <motion.div
            {...fadeUp}
            className="mx-auto mt-14 max-w-3xl overflow-hidden rounded-xl border border-[#0F3D56]/10"
          >
            <div className="bg-[#0F3D56] px-6 py-4">
              <h3 className="font-semibold text-white">{c.budget.breakdownTitle}</h3>
            </div>
            <div className="divide-y divide-[#0F3D56]/8 bg-white">
              {c.budget.breakdown.map((line) => (
                <div key={line.item} className="flex items-center justify-between gap-4 px-6 py-3.5">
                  <span className="text-sm text-slate-700">{line.item}</span>
                  <span className="whitespace-nowrap text-sm font-semibold text-[#0F3D56]">
                    {line.range}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-6 text-slate-400">
            {c.budget.disclaimer}
          </p>

          <div className="mt-8 text-center">
            <Button href="/#estimate">{c.budget.cta}</Button>
          </div>
        </Container>
      </section>

      {/* ── CTA ── */}
      <section className="bg-gradient-to-br from-[#0F3D56] via-[#1a5a7a] to-[#0F3D56] py-16 text-white">
        <Container className="text-center">
          <motion.div {...fadeUp}>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{c.cta.title}</h2>
            <p className="mx-auto mt-4 max-w-xl leading-8 text-white/70">{c.cta.description}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button href="/#estimate" variant="secondary">
                {c.cta.primary}
              </Button>
              <Button href="/" variant="ghost" className="text-white hover:bg-white/10">
                {c.cta.secondary}
              </Button>
            </div>
          </motion.div>
        </Container>
      </section>
    </div>
  );
}

/* Scaled floor plan of the proposed layout: 2.00 m × 2.50 m at 130 px/m */
function FloorPlanSVG({
  labels,
}: {
  labels: { shower: string; vanity: string; toilet: string; door: string; niche: string };
}) {
  const S = 130; // px per meter
  const W = 2.0 * S;
  const D = 2.5 * S;
  const PAD = 46;

  return (
    <svg
      viewBox={`0 0 ${W + PAD * 2} ${D + PAD * 2}`}
      className="w-full"
      role="img"
      aria-label={`${labels.shower} / ${labels.vanity} / ${labels.toilet}`}
    >
      {/* Room outline */}
      <rect x={PAD} y={PAD} width={W} height={D} fill="#F9F7F4" stroke="#0F3D56" strokeWidth="5" />

      {/* Walk-in shower 1.40 × 0.80 (back-left) */}
      <rect x={PAD} y={PAD} width={1.4 * S} height={0.8 * S} fill="#8BA890" opacity="0.8" />
      <text x={PAD + 0.7 * S} y={PAD + 0.38 * S} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">
        {labels.shower}
      </text>
      <text x={PAD + 0.7 * S} y={PAD + 0.58 * S} textAnchor="middle" fontSize="11" fill="#ffffffcc">
        1.40 × 0.80 m
      </text>
      {/* Niche */}
      <rect x={PAD + 0.45 * S} y={PAD + 2} width={0.32 * S} height={7} fill="#C9A840" />
      <text x={PAD + 0.61 * S} y={PAD - 8} textAnchor="middle" fontSize="9" fill="#C9A840" fontWeight="600">
        {labels.niche} 32 cm
      </text>
      {/* Rain head */}
      <circle cx={PAD + 0.7 * S} cy={PAD + 0.42 * S} r={0.125 * S} fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="4 3" />

      {/* Glass partition */}
      <line x1={PAD + 1.4 * S} y1={PAD} x2={PAD + 1.4 * S} y2={PAD + 0.8 * S} stroke="#7FC8C0" strokeWidth="4" />

      {/* Vanity 1.00 × 0.50 (right wall) */}
      <rect x={PAD + W - 0.5 * S} y={PAD + 1.1 * S} width={0.5 * S} height={1.0 * S} fill="#7D5A3C" opacity="0.9" rx="3" />
      <circle cx={PAD + W - 0.25 * S} cy={PAD + 1.6 * S} r={0.18 * S} fill="#F5F3EF" stroke="#5d4329" strokeWidth="1.5" />
      <text
        x={PAD + W - 0.25 * S}
        y={PAD + 1.06 * S}
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="#7D5A3C"
      >
        {labels.vanity} 1.00 m
      </text>

      {/* Toilet (left wall) */}
      <rect x={PAD} y={PAD + 1.0 * S} width={0.4 * S} height={0.55 * S} fill="#fff" stroke="#0F3D56" strokeWidth="2" rx="8" />
      <ellipse cx={PAD + 0.26 * S} cy={PAD + 1.27 * S} rx={0.13 * S} ry={0.17 * S} fill="#F5F3EF" stroke="#0F3D56" strokeWidth="1.5" />
      <text x={PAD + 0.2 * S} y={PAD + 1.72 * S} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0F3D56">
        {labels.toilet}
      </text>

      {/* Door opening 0.80 m with swing arc */}
      <line x1={PAD + 0.25 * S} y1={PAD + D} x2={PAD + 1.05 * S} y2={PAD + D} stroke="#F9F7F4" strokeWidth="6" />
      <path
        d={`M ${PAD + 0.25 * S} ${PAD + D} A ${0.8 * S} ${0.8 * S} 0 0 1 ${PAD + 1.05 * S} ${PAD + D - 0.8 * S}`}
        fill="none"
        stroke="#C9A840"
        strokeWidth="2"
        strokeDasharray="5 4"
      />
      <line x1={PAD + 0.25 * S} y1={PAD + D} x2={PAD + 0.25 * S} y2={PAD + D - 0.8 * S} stroke="#C9A840" strokeWidth="4" />
      <text x={PAD + 0.65 * S} y={PAD + D - 10} textAnchor="middle" fontSize="10" fontWeight="600" fill="#C9A840">
        {labels.door} 0.80 m
      </text>

      {/* Dimension lines */}
      {/* Width 2.00 m (top) */}
      <line x1={PAD} y1={PAD - 22} x2={PAD + W} y2={PAD - 22} stroke="#0F3D56" strokeWidth="1.5" />
      <line x1={PAD} y1={PAD - 28} x2={PAD} y2={PAD - 16} stroke="#0F3D56" strokeWidth="1.5" />
      <line x1={PAD + W} y1={PAD - 28} x2={PAD + W} y2={PAD - 16} stroke="#0F3D56" strokeWidth="1.5" />
      <rect x={PAD + W / 2 - 34} y={PAD - 34} width="68" height="20" fill="#fff" />
      <text x={PAD + W / 2} y={PAD - 19} textAnchor="middle" fontSize="13" fontWeight="700" fill="#0F3D56">
        2.00 m
      </text>
      {/* Depth 2.50 m (right) */}
      <line x1={PAD + W + 22} y1={PAD} x2={PAD + W + 22} y2={PAD + D} stroke="#0F3D56" strokeWidth="1.5" />
      <line x1={PAD + W + 16} y1={PAD} x2={PAD + W + 28} y2={PAD} stroke="#0F3D56" strokeWidth="1.5" />
      <line x1={PAD + W + 16} y1={PAD + D} x2={PAD + W + 28} y2={PAD + D} stroke="#0F3D56" strokeWidth="1.5" />
      <rect x={PAD + W + 8} y={PAD + D / 2 - 28} width="28" height="56" fill="#fff" />
      <text
        x={PAD + W + 22}
        y={PAD + D / 2}
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill="#0F3D56"
        transform={`rotate(-90 ${PAD + W + 22} ${PAD + D / 2})`}
      >
        2.50 m
      </text>
    </svg>
  );
}
