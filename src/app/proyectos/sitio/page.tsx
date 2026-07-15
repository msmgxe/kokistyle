"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LayoutTemplate, Images, Eye, Save, Upload, Plus, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { supabase } from "@/src/lib/supabase";
import { SITE_DEFAULTS } from "@/src/types/site";
import type { SiteContent, SiteBAItem, SiteSectionKey, Bilingual } from "@/src/types/site";

type Tab = "hero" | "before" | "visibility";
type BiField = Partial<Bilingual> | undefined;

const SECTIONS: SiteSectionKey[] = ["beforeAfter", "aiDesign", "process", "tours", "reviews", "faq"];

const LBL = "mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5C6A6E] dark:text-[#9fb0cc]";
const INP = "w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-3 py-2 text-sm text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none";

/** Campo de texto bilingüe (EN/ES). A nivel de módulo para no perder el foco al escribir. */
function BiText({ lbl, val, on, area, enPh = "EN", esPh = "ES" }: {
  lbl: string; val: Partial<Bilingual> | undefined; on: (lang: "en" | "es", v: string) => void;
  area?: boolean; enPh?: string; esPh?: string;
}) {
  return (
    <div>
      <span className={LBL}>{lbl}</span>
      <div className="grid grid-cols-2 gap-2">
        {(["en", "es"] as const).map(lg => area ? (
          <textarea key={lg} rows={3} value={val?.[lg] ?? ""} placeholder={lg === "en" ? enPh : esPh}
            onChange={e => on(lg, e.target.value)} className={INP} />
        ) : (
          <input key={lg} value={val?.[lg] ?? ""} placeholder={lg === "en" ? enPh : esPh}
            onChange={e => on(lg, e.target.value)} className={INP} />
        ))}
      </div>
    </div>
  );
}

/** Campo de imagen autónomo: sube a Storage por su cuenta (estado local de subida). */
function ImageField({ lbl, keyName, url, onChange, fallback, urlPh = "Image URL", uploadLbl = "Upload" }: {
  lbl: string; keyName: string; url?: string; onChange: (u: string) => void; fallback?: string;
  urlPh?: string; uploadLbl?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const doUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const path = `site/${keyName}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("kokistyle-files").upload(path, file, { upsert: true, contentType: file.type });
      if (error) return;
      const { data } = supabase.storage.from("kokistyle-files").getPublicUrl(path);
      onChange(`${data.publicUrl}?v=${Date.now()}`);
    } finally { setUploading(false); }
  };
  return (
    <div>
      <span className={LBL}>{lbl}</span>
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url || fallback || ""} alt="" className="size-16 flex-none rounded-lg object-cover ring-1 ring-[#E6DDCB]" />
        <div className="flex-1 space-y-1.5">
          <input value={url ?? ""} onChange={e => onChange(e.target.value)} placeholder={urlPh} className={INP} />
          <input ref={ref} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) doUpload(f); }} />
          <button onClick={() => ref.current?.click()} disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand)] px-3 py-1.5 text-[11px] font-bold text-[var(--brand)] hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220] disabled:opacity-50">
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} {uploadLbl}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SitioPage() {
  const { isSuperAdmin, currentUser } = useAuth();
  const { t } = useLanguage();
  const ts = t.panel.site;

  const [tab, setTab]         = useState<Tab>("hero");
  const [content, setContent] = useState<SiteContent>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    supabase.from("site_content").select("data").eq("id", true).maybeSingle()
      .then(({ data }) => { if (data?.data) setContent(data.data as SiteContent); })
      .then(() => setLoading(false), () => setLoading(false));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    const res = await fetch("/api/site-content/admin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: currentUser?.pin || undefined,
        token: typeof window !== "undefined" ? (localStorage.getItem("kokistyle-device-token") || undefined) : undefined,
        data: content,
      }),
    });
    const d = await res.json();
    setSaving(false);
    showToast(d.ok ? ts.saved : ts.error);
  }, [content, currentUser, showToast, ts.saved, ts.error]);

  if (!isSuperAdmin) {
    return <div className="rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-8 text-center text-sm font-semibold text-[#5C6A6E] dark:text-[#9fb0cc]">{ts.onlyAdmin}</div>;
  }

  const hero = content.hero ?? {};
  const ba   = content.beforeAfter ?? {};
  const setHero = (patch: Partial<typeof hero>) => setContent(c => ({ ...c, hero: { ...c.hero, ...patch } }));
  const setBA   = (patch: Partial<typeof ba>)   => setContent(c => ({ ...c, beforeAfter: { ...c.beforeAfter, ...patch } }));
  const setBi = (cur: BiField, lang: "en" | "es", v: string): Partial<Bilingual> => ({ ...cur, [lang]: v });
  const items: SiteBAItem[] = ba.items && ba.items.length > 0 ? ba.items : [{}, {}];
  const setItem = (i: number, patch: Partial<SiteBAItem>) =>
    setBA({ items: items.map((it, idx) => idx === i ? { ...it, ...patch } : it) });

  return (
    <div className="pb-24">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-bookman text-2xl text-[var(--brand)]">🖥️ {ts.title}</h1>
          <p className="text-sm text-[#5C6A6E] dark:text-[#9fb0cc]">{ts.subtitle}</p>
        </div>
        <Link href="/" target="_blank" className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-4 py-2.5 text-sm font-bold text-[var(--accent)] hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]">
          <ExternalLink size={14} /> {ts.preview}
        </Link>
      </div>

      <div className="mb-4 inline-flex rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-[#F7F3EA] dark:bg-[#0b1220] p-0.5">
        {([["hero", <LayoutTemplate key="a" size={13} />, ts.tabHero],
           ["before", <Images key="b" size={13} />, ts.tabBefore],
           ["visibility", <Eye key="c" size={13} />, ts.tabVisibility]] as const).map(([id, icon, lbl]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12px] font-bold transition ${tab === id ? "bg-[var(--accent)] text-white" : "text-[#5C6A6E] dark:text-[#9fb0cc] hover:text-[var(--brand)]"}`}>
            {icon} {lbl}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-[#F0EAE0] dark:bg-[#17233d]" />
      ) : (
        <div className="rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-5 space-y-4">
          <p className="text-[11px] italic text-[#97A1A0] dark:text-[#728098]">{ts.resetHint}</p>

          {tab === "hero" && (<>
            <BiText lbl={ts.eyebrow} val={hero.eyebrow} on={(lg, v) => setHero({ eyebrow: setBi(hero.eyebrow, lg, v) })} enPh={ts.en} esPh={ts.es} />
            <BiText lbl={ts.heroTitle} val={hero.title} on={(lg, v) => setHero({ title: setBi(hero.title, lg, v) })} enPh={ts.en} esPh={ts.es} />
            <BiText lbl={ts.description} val={hero.description} on={(lg, v) => setHero({ description: setBi(hero.description, lg, v) })} area enPh={ts.en} esPh={ts.es} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <BiText lbl={ts.primaryBtn} val={hero.primaryLabel} on={(lg, v) => setHero({ primaryLabel: setBi(hero.primaryLabel, lg, v) })} enPh={ts.en} esPh={ts.es} />
                <input value={hero.primaryHref ?? ""} onChange={e => setHero({ primaryHref: e.target.value })} placeholder={ts.link} className={INP} />
              </div>
              <div className="space-y-2">
                <BiText lbl={ts.secondaryBtn} val={hero.secondaryLabel} on={(lg, v) => setHero({ secondaryLabel: setBi(hero.secondaryLabel, lg, v) })} enPh={ts.en} esPh={ts.es} />
                <input value={hero.secondaryHref ?? ""} onChange={e => setHero({ secondaryHref: e.target.value })} placeholder={ts.link} className={INP} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageField lbl={ts.imageMain} keyName="hero-main" url={hero.imageMain} fallback={SITE_DEFAULTS.heroMain} onChange={u => setHero({ imageMain: u })} urlPh={ts.orUrl} uploadLbl={ts.uploadImg} />
              <ImageField lbl={ts.imageSecondary} keyName="hero-sec" url={hero.imageSecondary} fallback={SITE_DEFAULTS.heroSecondary} onChange={u => setHero({ imageSecondary: u })} urlPh={ts.orUrl} uploadLbl={ts.uploadImg} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <BiText lbl={ts.focusLabel} val={hero.focusLabel} on={(lg, v) => setHero({ focusLabel: setBi(hero.focusLabel, lg, v) })} enPh={ts.en} esPh={ts.es} />
              <BiText lbl={ts.focusValue} val={hero.focusValue} on={(lg, v) => setHero({ focusValue: setBi(hero.focusValue, lg, v) })} enPh={ts.en} esPh={ts.es} />
            </div>
          </>)}

          {tab === "before" && (<>
            <BiText lbl={ts.eyebrow} val={ba.eyebrow} on={(lg, v) => setBA({ eyebrow: setBi(ba.eyebrow, lg, v) })} enPh={ts.en} esPh={ts.es} />
            <BiText lbl={ts.heroTitle} val={ba.title} on={(lg, v) => setBA({ title: setBi(ba.title, lg, v) })} enPh={ts.en} esPh={ts.es} />
            <BiText lbl={ts.description} val={ba.description} on={(lg, v) => setBA({ description: setBi(ba.description, lg, v) })} area enPh={ts.en} esPh={ts.es} />
            <div className="flex items-center justify-between pt-2">
              <span className={LBL}>{ts.baItems}</span>
              <button onClick={() => setBA({ items: [...items, {}] })} className="inline-flex items-center gap-1 rounded-lg border border-[var(--brand)] px-2.5 py-1 text-[11px] font-bold text-[var(--brand)] hover:bg-[#F7F3EA] dark:hover:bg-[#0b1220]"><Plus size={12} /> {ts.addItem}</button>
            </div>
            {items.map((it, i) => (
              <div key={i} className="rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#FBF8F2] dark:bg-[#17233d] p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#5C6A6E] dark:text-[#9fb0cc]">#{i + 1}</span>
                  {items.length > 1 && (
                    <button onClick={() => setBA({ items: items.filter((_, idx) => idx !== i) })} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B0492F] hover:underline"><Trash2 size={11} /> {ts.removeItem}</button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ImageField lbl={ts.beforeImg} keyName={`ba-${i}-before`} url={it.beforeImg} fallback={SITE_DEFAULTS.ba[i]?.before} onChange={u => setItem(i, { beforeImg: u })} urlPh={ts.orUrl} uploadLbl={ts.uploadImg} />
                  <ImageField lbl={ts.afterImg} keyName={`ba-${i}-after`} url={it.afterImg} fallback={SITE_DEFAULTS.ba[i]?.after} onChange={u => setItem(i, { afterImg: u })} urlPh={ts.orUrl} uploadLbl={ts.uploadImg} />
                </div>
                <BiText lbl={ts.space} val={it.space} on={(lg, v) => setItem(i, { space: setBi(it.space, lg, v) })} enPh={ts.en} esPh={ts.es} />
                <div>
                  <span className={LBL}>{ts.city}</span>
                  <input value={it.city ?? ""} onChange={e => setItem(i, { city: e.target.value })} className={INP} />
                </div>
              </div>
            ))}
          </>)}

          {tab === "visibility" && (
            <div className="space-y-2">
              <span className={LBL}>{ts.visibility}</span>
              {SECTIONS.map(key => {
                const on = content.visibility?.[key] !== false;
                const lbl = ts[`sec${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof typeof ts] as string;
                return (
                  <button key={key} onClick={() => setContent(c => ({ ...c, visibility: { ...c.visibility, [key]: !on } }))}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${on ? "border-[#4F8A63] bg-[#EEF6F0] dark:bg-[#14261c]" : "border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e]"}`}>
                    <span className="text-sm font-bold text-[var(--brand)]">{lbl}</span>
                    <span className={`inline-flex h-6 w-11 items-center rounded-full p-0.5 transition ${on ? "bg-[#4F8A63]" : "bg-[#D7CBB3] dark:bg-[#17233d]"}`}>
                      <span className={`size-5 rounded-full bg-white dark:bg-[#111a2e] shadow transition ${on ? "translate-x-5" : ""}`} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Barra de guardado fija */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E6DDCB] dark:border-[#22304d] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] items-center justify-end gap-3 px-6 py-3">
          {toast && <span className="text-sm font-semibold text-[#4F8A63]">{toast}</span>}
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-6 py-2.5 text-sm font-bold text-white hover:bg-[var(--brand-strong)] disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {saving ? ts.saving : ts.save}
          </button>
        </div>
      </div>
    </div>
  );
}
