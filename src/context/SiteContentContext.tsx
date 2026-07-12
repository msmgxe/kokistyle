"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/src/lib/supabase";
import type { SiteContent, SiteSectionKey } from "@/src/types/site";

interface Ctx {
  content: SiteContent;
  loading: boolean;
  /** Sección visible salvo que el CMS la haya apagado explícitamente (default: visible). */
  isVisible: (key: SiteSectionKey) => boolean;
}

const SiteContentCtx = createContext<Ctx>({ content: {}, loading: true, isVisible: () => true });

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<SiteContent>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("site_content").select("data").eq("id", true).maybeSingle()
      .then(({ data }) => { if (data?.data) setContent(data.data as SiteContent); })
      .then(() => setLoading(false), () => setLoading(false));
  }, []);

  const isVisible = (key: SiteSectionKey) => content.visibility?.[key] !== false;

  return <SiteContentCtx.Provider value={{ content, loading, isVisible }}>{children}</SiteContentCtx.Provider>;
}

export const useSiteContent = () => useContext(SiteContentCtx);
