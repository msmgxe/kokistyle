"use client";

import { motion } from "framer-motion";

import { useLanguage } from "@/src/context/LanguageContext";
import Container from "../ui/Container";

const transformations = [
  {
    before:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=900&q=80",
    after:
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=85",
  },
  {
    before:
      "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=900&q=80",
    after:
      "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=900&q=85",
  },
];

export default function BeforeAfter() {
  const { t } = useLanguage();

  return (
    <section id="before-after" className="bg-[#F5E9DA] py-20 sm:py-24">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#0F3D56]/70">
              {t.beforeAfter.eyebrow}
            </p>
            <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#0F3D56] sm:text-5xl">
              {t.beforeAfter.title}
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-8 text-slate-700 lg:justify-self-end">
            {t.beforeAfter.description}
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          {transformations.map((project, index) => (
            <motion.article
              key={t.beforeAfter.projects[index].space}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-70px" }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="overflow-hidden rounded-lg bg-white shadow-[0_22px_70px_rgba(15,61,86,0.13)]"
            >
              <div className="grid sm:grid-cols-2">
                <figure className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={project.before}
                    alt={`${t.beforeAfter.projects[index].space} ${t.beforeAfter.before}`}
                    className="h-full w-full object-cover grayscale-[30%]"
                  />
                  <figcaption className="absolute left-4 top-4 rounded-md bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-700">
                    {t.beforeAfter.before}
                  </figcaption>
                </figure>
                <figure className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={project.after}
                    alt={`${t.beforeAfter.projects[index].space} ${t.beforeAfter.after}`}
                    className="h-full w-full object-cover"
                  />
                  <figcaption className="absolute left-4 top-4 rounded-md bg-[#0F3D56] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white">
                    {t.beforeAfter.after}
                  </figcaption>
                </figure>
              </div>
              <div className="flex flex-col gap-2 p-6 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-2xl font-bold text-[#0F3D56]">
                  {t.beforeAfter.projects[index].space}
                </h3>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t.beforeAfter.projects[index].city}
                </p>
              </div>
            </motion.article>
          ))}
        </div>
      </Container>
    </section>
  );
}
