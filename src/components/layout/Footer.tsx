"use client";

import { Mail, MapPin, Phone } from "lucide-react";
import { FaFacebookF, FaInstagram, FaYoutube } from "react-icons/fa";

import { branding } from "@/src/config/branding";
import { useLanguage } from "@/src/context/LanguageContext";
import Container from "../ui/Container";

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
              {[FaInstagram, FaFacebookF, FaYoutube].map((Icon, index) => (
                <a
                  key={index}
                  href="#contact"
                  className="grid size-10 place-items-center rounded-lg border border-white/15 text-white/70 transition hover:border-white/40 hover:text-white"
                  aria-label={t.footer.socialProfile}
                >
                  <Icon size={18} />
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
