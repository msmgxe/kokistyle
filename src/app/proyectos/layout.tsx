"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/src/context/AuthContext";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { VoiceProvider } from "@/src/context/VoiceContext";
import VoiceFAB from "@/src/components/ui/VoiceFAB";

export default function ProyectosLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAdmin) router.replace("/");
  }, [isAdmin, router]);

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F3EB]">
        <p className="text-sm font-semibold text-[#5C6A6E]">Verificando acceso…</p>
      </div>
    );
  }

  return (
    <VoiceProvider>
      <div className="min-h-screen bg-[#F7F3EB]">
        <nav
          className="sticky top-0 z-30 border-b border-[#D5DEEF] bg-[#F7F3EB]"
          aria-label="Panel de administración"
        >
          <div className="mx-auto flex max-w-[1180px] items-center gap-4 px-6 py-3">
            <Link href="/proyectos" className="flex items-center gap-3" aria-label="KokiStyle Panel">
              <span className="grid size-10 flex-none place-items-center rounded-lg bg-[#16323D] text-sm font-bold text-white">
                KS
              </span>
              <span>
                <span className="block text-base font-bold leading-none text-[#16323D]">KokiStyle</span>
                <span className="mt-0.5 block text-[10px] uppercase tracking-[0.22em] text-[#5C6A6E]">Panel</span>
              </span>
            </Link>

            <nav className="flex flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
              <PanelTab href="/proyectos" label="Dashboard" />
              <PanelTab href="/proyectos/contactos" label="Contactos" />
              <PanelTab href="/proyectos/plan" label="Plan" />
            </nav>

            <button
              id="panel-logout-btn"
              onClick={logout}
              className="inline-flex flex-none items-center gap-1.5 rounded-lg border border-[#E6DDCB] bg-white px-3 py-2 text-xs font-bold text-[#16323D] transition hover:bg-[#ECE3D1]"
              aria-label="Cerrar sesión"
            >
              <LogOut size={14} />
              Salir
            </button>
          </div>
        </nav>

        <main className="mx-auto max-w-[1180px] px-6 pb-28 pt-7">{children}</main>

        <VoiceFAB />
      </div>
    </VoiceProvider>
  );
}

function PanelTab({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
        isActive
          ? "bg-[#395886] text-white shadow-sm"
          : "text-[#628ECB] hover:bg-[#F0F3FA] hover:text-[#395886]"
      }`}
    >
      {label}
    </Link>
  );
}
