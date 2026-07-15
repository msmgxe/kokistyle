"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { useLanguage } from "@/src/context/LanguageContext";
import ProjectPhotos from "@/src/components/ui/ProjectPhotos";

interface ProjRow { id: string; title: string; client: string }

export default function FotosPage() {
  const { t } = useLanguage();
  const tf = t.panel.fotos;
  const [projects, setProjects] = useState<ProjRow[] | null>(null);
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  useEffect(() => {
    supabase
      .from("projects")
      .select("id, title, client")
      .neq("status", "terminado")
      .order("priority_rank", { ascending: true, nullsFirst: false })
      .then(({ data }) => setProjects((data as ProjRow[]) ?? []));
  }, []);

  return (
    <div className="mx-auto max-w-[720px] animate-in fade-in duration-300">
      <div className="mb-4 rounded-2xl bg-[var(--brand)] px-5 py-4">
        <h1 className="font-bookman text-[22px] font-semibold text-white">📷 {tf.title}</h1>
        <p className="mt-0.5 text-[13px] text-[#A8C0BC]">{tf.subtitle}</p>
      </div>

      {projects === null ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
        </div>
      ) : (
        <ProjectPhotos projects={projects} toast={showToast} />
      )}

      <div className={`fixed bottom-24 left-1/2 z-[400] w-full max-w-sm -translate-x-1/2 rounded-2xl bg-[var(--brand)] px-4 py-3 text-center text-sm font-medium text-white shadow-2xl transition-all duration-300 ${toastVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}>
        {toast}
      </div>
    </div>
  );
}
