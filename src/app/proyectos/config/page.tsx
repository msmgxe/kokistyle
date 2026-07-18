"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { supabase } from "@/src/lib/supabase";
import type { Project } from "@/src/types/project";
import UsersPanel from "@/src/components/ui/UsersPanel";
import AdminSettings from "@/src/components/ui/AdminSettings";

// Área de administración: Equipo (permisos por usuario) + Seguridad (PIN, correo,
// dispositivos). Solo superadmin. Antes vivía inline en el dashboard.
export default function ConfigPage() {
  const { isSuperAdmin } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const tp = t.panel;

  const [projects, setProjects] = useState<Project[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string; specialty: string }[]>([]);

  useEffect(() => {
    if (!isSuperAdmin) router.replace("/proyectos");
  }, [isSuperAdmin, router]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    supabase.from("projects").select("id, title, client, photo_url").neq("status", "terminado").order("title")
      .then(({ data }) => { if (data) setProjects(data as unknown as Project[]); });
    supabase.from("contacts").select("id, name, specialty").order("name")
      .then(({ data }) => { if (data) setContacts(data); });
  }, [isSuperAdmin]);

  if (!isSuperAdmin) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-medium text-[var(--brand)]">{tp.nav.config}</h1>
        <p className="text-[12px] text-[#97A1A0] dark:text-[#728098]">{tp.config.subtitle}</p>
      </div>

      <UsersPanel projects={projects} contacts={contacts} />

      <div className="mt-10">
        <div className="mb-4">
          <h2 className="text-base font-bold text-[var(--brand)]">{tp.dashboard.security}</h2>
          <p className="text-[11px] text-[#97A1A0] dark:text-[#728098]">{tp.dashboard.securityDesc}</p>
        </div>
        <AdminSettings />
      </div>
    </div>
  );
}
