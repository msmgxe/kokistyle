"use client";

import { motion } from "framer-motion";
import { Building2, Hammer, Palette } from "lucide-react";

import { useLanguage } from "@/src/context/LanguageContext";
import Container from "../ui/Container";

const services = [
  {
    icon: Hammer,
    image:
      "https://images.unsplash.com/photo-1556912173-3bb406ef7e77?auto=format&fit=crop&w=900&q=85",
  },
  {
    icon: Palette,
    image:
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85",
  },
  {
    icon: Building2,
    image:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=85",
  },
];

export default function Services() {
  const { t } = useLanguage();

  return (
    <section id="services" className="bg-white py-20 sm:py-24">
      <Container>
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#0F3D56]/70">
            {t.services.eyebrow}
          </p>
          <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#0F3D56] sm:text-5xl">
            {t.services.title}
          </h2>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {services.map((service, index) => {
            const Icon = service.icon;
            const content = t.services.items[index];

            return (
              <motion.article
                key={content.title}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.55, delay: index * 0.08 }}
                className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,61,86,0.14)]"
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={service.image}
                    alt={content.alt}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <div className="mb-5 grid size-12 place-items-center rounded-lg bg-[#F5E9DA] text-[#0F3D56]">
                    <Icon size={23} />
                  </div>
                  <h3 className="text-2xl font-bold text-[#0F3D56]">{content.title}</h3>
                  <p className="mt-4 leading-7 text-slate-600">{content.description}</p>
                </div>
              </motion.article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
