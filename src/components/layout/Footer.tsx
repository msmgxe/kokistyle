"use client";

import { Mail, MapPin, Phone } from "lucide-react";

import { branding } from "@/src/config/branding";
import { useLanguage } from "@/src/context/LanguageContext";
import Container from "../ui/Container";

const socialIcons = [
  {
    viewBox: "0 0 448 512",
    d: "M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z",
  },
  {
    viewBox: "0 0 320 512",
    d: "M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z",
  },
  {
    viewBox: "0 0 576 512",
    d: "M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305zm-317.51 213.508V175.185l142.739 81.205-142.739 81.201z",
  },
];

const footerLinks = [
  { href: "#services" },
  { href: "#before-after" },
  { href: "#tours" },
  { href: "#estimate" },
];

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer id="contact" className="bg-slate-950 py-14 text-white">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-lg bg-[#F5E9DA] dark:bg-[#17233d] text-sm font-bold text-[#0F3D56] dark:text-[#e8edf7]">
                KS
              </span>
              <div>
                <p className="text-xl font-bold">{branding.companyName}</p>
                <p className="text-sm text-white/60">{branding.slogan}</p>
              </div>
            </div>
            <p className="mt-6 max-w-md leading-7 text-white/65">
              {t.footer.description}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.24em] text-[#F5E9DA]">
              {t.footer.explore}
            </h3>
            <div className="mt-5 grid gap-3">
              {footerLinks.map((link, index) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-white/65 transition hover:text-white"
                >
                  {t.footer.links[index]}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.24em] text-[#F5E9DA]">
              {t.footer.contact}
            </h3>
            <div className="mt-5 grid gap-3 text-white/70">
              <a href={`tel:${branding.phone}`} className="flex items-center gap-3 hover:text-white">
                <Phone size={17} /> {branding.phone}
              </a>
              <a href={`mailto:${branding.email}`} className="flex items-center gap-3 hover:text-white">
                <Mail size={17} /> {branding.email}
              </a>
              <span className="flex items-center gap-3">
                <MapPin size={17} /> {branding.address}
              </span>
            </div>
            <div className="mt-6 flex gap-3">
              {socialIcons.map((icon, index) => (
                <a
                  key={index}
                  href="#contact"
                  className="grid size-10 place-items-center rounded-lg border border-white/15 text-white/70 transition hover:border-white/40 hover:text-white"
                  aria-label={t.footer.socialProfile}
                >
                  <svg viewBox={icon.viewBox} width={18} height={18} fill="currentColor" aria-hidden="true">
                    <path d={icon.d} />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-sm text-white/45">
          {t.footer.copyright}
        </div>
      </Container>
    </footer>
  );
}
