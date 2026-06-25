/**
 * Layout de la sección /proyectos (panel de administración).
 * Protege las rutas y muestra el navbar del panel de control.
 * Solo accesible cuando isAdmin === true.
 */
"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/src/context/AuthContext";
import Link from "next/link";
import { LogOut } from "lucide-react";

export default function ProyectosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin, logout } = useAuth();
  const router = useRouter();

  // Redirigir al inicio si no hay sesión activa de administrador
  useEffect(() => {
    if (!isAdmin) {
      router.replace("/");
    }
  }, [isAdmin, router]);

  if (!isAdmin) {
    // Pantalla de espera mientras redirige
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F3EA]">
        <p className="text-sm font-semibold text-[#5C6A6E]">Verificando acceso…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F3EA]">
      {/* Navbar del panel de control */}
      <nav
        className="sticky top-0 z-30 border-b border-[#E6DDCB] bg-[#F7F3EA]"
        aria-label="Panel de administración"
      >
        <div className="mx-auto flex max-w-[1180px] items-center gap-4 px-6 py-3">
          {/* Logotipo */}
          <Link
            href="/proyectos"
            className="flex items-center gap-3"
            aria-label="KokiStyle Panel"
          >
            <span className="grid size-10 flex-none place-items-center rounded-lg bg-[#16323D] text-sm font-bold text-white">
              KS
            </span>
            <span>
              <span className="block text-base font-bold leading-none text-[#16323D]">
                KokiStyle
              </span>
              <span className="mt-0.5 block text-[10px] uppercase tracking-[0.22em] text-[#5C6A6E]">
                Panel
              </span>
            </span>
          </Link>

          {/* Tabs de navegación del panel */}
          <nav className="flex flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
            <PanelTab href="/proyectos" label="Dashboard" />
            <PanelTab href="/proyectos/contactos" label="Contactos" />
            <PanelTab href="/proyectos/plan" label="Plan" />
          </nav>

          {/* Botón de salir */}
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

      {/* Contenido de la página */}
      <main className="mx-auto max-w-[1180px] px-6 pb-28 pt-7">{children}</main>
    </div>
  );
}

/** Componente de tab de navegación del panel */
function PanelTab({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold transition ${
        isActive
          ? "bg-[#16323D] text-white"
          : "text-[#5C6A6E] hover:bg-[#ECE3D1] hover:text-[#16323D]"
      }`}
    >
      {label}
    </Link>
  );
}
