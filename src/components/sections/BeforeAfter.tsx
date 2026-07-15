"use client";

import { motion } from "framer-motion";

import { useLanguage } from "@/src/context/LanguageContext";
import { useSiteContent } from "@/src/context/SiteContentContext";
import { SITE_DEFAULTS } from "@/src/types/site";
import Container from "../ui/Container";

export default function BeforeAfter() {
  const { t, language } = useLanguage();
  const { content } = useSiteContent();
  const ba = content.beforeAfter ?? {};
  const bi = (f?: { en?: string; es?: string }, fb = "") => (language === "es" ? f?.es : f?.en) || fb;

  const eyebrow     = bi(ba.eyebrow, t.beforeAfter.eyebrow);
  const title       = bi(ba.title, t.beforeAfter.title);
  const description = bi(ba.description, t.beforeAfter.description);

  // Items del CMS o los 2 por defecto (imágenes + labels de translations)
  const items = (ba.items && ba.items.length > 0)
    ? ba.items.map((it, i) => ({
        before: it.beforeImg || SITE_DEFAULTS.ba[i]?.before || SITE_DEFAULTS.ba[0].before,
        after:  it.afterImg  || SITE_DEFAULTS.ba[i]?.after  || SITE_DEFAULTS.ba[0].after,
        space:  bi(it.space, t.beforeAfter.projects[i]?.space ?? ""),
        city:   it.city || t.beforeAfter.projects[i]?.city || "",
      }))
    : SITE_DEFAULTS.ba.map((img, i) => ({
        before: img.before, after: img.after,
        space: t.beforeAfter.projects[i]?.space ?? "", city: t.beforeAfter.projects[i]?.city ?? "",
      }));

  return (
    <section id="before-after" className="bg-[#F5E9DA] dark:bg-[#17233d] py-20 sm:py-24">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#0F3D56]/70">{eyebrow}</p>
            <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#0F3D56] dark:text-[#e8edf7] sm:text-5xl">{title}</h2>
          </div>
          <p className="max-w-2xl text-base leading-8 text-slate-700 lg:justify-self-end">{description}</p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          {items.map((project, index) => (
            <motion.article
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-70px" }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="overflow-hidden rounded-lg bg-white dark:bg-[#111a2e] shadow-[0_22px_70px_rgba(15,61,86,0.13)]"
            >
              <div className="grid sm:grid-cols-2">
                <figure className="relative aspect-[4/3] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={project.before} alt={`${project.space} ${t.beforeAfter.before}`} className="h-full w-full object-cover grayscale-[30%]" />
                  <figcaption className="absolute left-4 top-4 rounded-md bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-700">
                    {t.beforeAfter.before}
                  </figcaption>
                </figure>
                <figure className="relative aspect-[4/3] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={project.after} alt={`${project.space} ${t.beforeAfter.after}`} className="h-full w-full object-cover" />
                  <figcaption className="absolute left-4 top-4 rounded-md bg-[#0F3D56] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white">
                    {t.beforeAfter.after}
                  </figcaption>
                </figure>
              </div>
              <div className="flex flex-col gap-2 p-6 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-2xl font-bold text-[#0F3D56] dark:text-[#e8edf7]">{project.space}</h3>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{project.city}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </Container>
    </section>
  );
}
