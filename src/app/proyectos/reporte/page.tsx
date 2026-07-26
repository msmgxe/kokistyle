"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { supabase } from "@/src/lib/supabase";
import ReportBuilder from "@/src/components/ui/ReportBuilder";

// Reporte general de pendientes (objetivos + notas de varios proyectos). Solo superadmin.
export default function ReportePage() {
  const { isSuperAdmin } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const tr = t.panel.report;
  const [projects, setProjects] = useState<{ id: string; title: string; client?: string | null; status?: string }[]>([]);

  useEffect(() => { if (!isSuperAdmin) router.replace("/proyectos"); }, [isSuperAdmin, router]);
  useEffect(() => {
    if (!isSuperAdmin) return;
    supabase.from("projects").select("id, title, client, status").order("title")
      .then(({ data }) => { if (data) setProjects(data as { id: string; title: string; client?: string | null; status?: string }[]); });
  }, [isSuperAdmin]);

  if (!isSuperAdmin) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-medium text-[var(--brand)]">{tr.title}</h1>
        <p className="text-[12px] text-[#97A1A0] dark:text-[#728098]">{tr.subtitle}</p>
      </div>
      <ReportBuilder projects={projects} />
    </div>
  );
}
