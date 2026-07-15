"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// El panel de Equipo vive ahora dentro de Contacts (tab "Team & Assignments") — jul 2026
export default function EquipoRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/proyectos/contactos?tab=equipo"); }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
    </div>
  );
}
