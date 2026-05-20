import { Menu } from "lucide-react";

import { branding } from "@/src/config/branding";
import Button from "../ui/Button";
import Container from "../ui/Container";

const navItems = [
  { label: "Services", href: "#services" },
  { label: "Before / After", href: "#before-after" },
  { label: "Tours", href: "#tours" },
  { label: "Estimate", href: "#estimate" },
];

export default function Navbar() {
  return (
    <nav className="fixed left-0 top-0 z-50 w-full border-b border-white/50 bg-white/85 backdrop-blur-xl">
      <Container className="flex items-center justify-between py-4">
        <a href="#home" className="flex items-center gap-3" aria-label="KokiStyle home">
          <span className="grid size-10 place-items-center rounded-lg bg-[#0F3D56] text-sm font-bold text-white">
            KS
          </span>
          <span>
            <span className="block text-lg font-bold leading-none text-[#0F3D56]">
              KokiStyle
            </span>
            <span className="mt-1 block text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Florida
            </span>
          </span>
        </a>

        <div className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-slate-700 transition hover:text-[#0F3D56]"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <a className="text-sm font-semibold text-[#0F3D56]" href={`tel:${branding.phone}`}>
            {branding.phone}
          </a>
          <Button href="#estimate" className="min-h-11 px-5 py-2.5">
            Start Estimate
          </Button>
        </div>

        <button
          className="grid size-11 place-items-center rounded-lg border border-[#0F3D56]/15 text-[#0F3D56] md:hidden"
          aria-label="Open navigation"
        >
          <Menu size={22} />
        </button>
      </Container>
    </nav>
  );
}
