"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Upload, Wand2, Loader2, RotateCcw } from "lucide-react";

import { useLanguage } from "@/src/context/LanguageContext";
import { supabase } from "@/src/lib/supabase";
import Container from "../ui/Container";

const ROOMS = [
  { en: "Living Room", es: "Sala" }, { en: "Kitchen", es: "Cocina" },
  { en: "Master Bathroom", es: "Baño principal" }, { en: "Master Bedroom", es: "Habitación" },
  { en: "Dining Room", es: "Comedor" }, { en: "Home Office", es: "Oficina" },
  { en: "Outdoor", es: "Exterior" },
];
const STYLES = [
  { en: "Modern", es: "Moderno" }, { en: "Luxury", es: "Lujo" },
  { en: "Contemporary", es: "Contemporáneo" }, { en: "Minimalist", es: "Minimalista" },
  { en: "Mediterranean", es: "Mediterráneo" }, { en: "Scandinavian", es: "Escandinavo" },
];
const LS_KEY = "luxaris-prospect";

type Phase = "gate" | "tool";

export default function AiDesignPreview() {
  const { t, language } = useLanguage();
  const ta = t.aiDesign;
  const EN = language === "en";

  const [phase, setPhase]   = useState<Phase>("gate");
  const [prospectId, setProspectId] = useState<string | null>(null);
  const [rendersUsed, setRendersUsed] = useState(0);

  // Gate form
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [gateErr, setGateErr] = useState<string | null>(null);
  const [gating, setGating]   = useState(false);

  // Tool
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl]   = useState<string | null>(null);
  const [room, setRoom]   = useState(ROOMS[0].en);
  const [style, setStyle] = useState(STYLES[0].en);
  const [busy, setBusy]     = useState(false);
  const [toolMsg, setToolMsg] = useState<string | null>(null);
  const [pos, setPos] = useState(55);
  const fileRef = useRef<HTMLInputElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? "null");
      if (saved?.id) { setProspectId(saved.id); setRendersUsed(saved.rendersUsed ?? 0); setPhase("tool"); }
    } catch { /* noop */ }
  }, []);

  const persist = (id: string, used: number) => {
    setProspectId(id); setRendersUsed(used);
    try { localStorage.setItem(LS_KEY, JSON.stringify({ id, rendersUsed: used })); } catch { /* noop */ }
  };

  /* ── Gate ──────────────────────────────────────────────────────────────── */
  const submitGate = async () => {
    setGateErr(null);
    if (form.name.trim().length < 2)               { setGateErr(ta.errName);  return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setGateErr(ta.errEmail); return; }
    if (form.phone.replace(/\D/g, "").length < 7)  { setGateErr(ta.errPhone); return; }
    setGating(true);
    try {
      const res = await fetch("/api/prospects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, room_type: room, style }),
      });
      const data = await res.json();
      if (!data.ok) { setGateErr(ta.errGeneric); return; }
      persist(data.id, data.rendersUsed ?? 0);
      setPhase("tool");
    } catch { setGateErr(ta.errGeneric); }
    finally { setGating(false); }
  };

  /* ── Tool ──────────────────────────────────────────────────────────────── */
  const remaining = Math.max(0, 3 - rendersUsed);

  const onPick = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !prospectId) return;
    setBusy(true); setToolMsg(ta.uploading); setAfterUrl(null);
    try {
      const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const path = `design-leads/${prospectId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("kokistyle-files").upload(path, file, { upsert: true, contentType: file.type });
      if (error) { setToolMsg(ta.errGeneric); return; }
      const { data } = supabase.storage.from("kokistyle-files").getPublicUrl(path);
      setBeforeUrl(`${data.publicUrl}?v=${Date.now()}`);
      setToolMsg(null);
    } catch { setToolMsg(ta.errGeneric); }
    finally { setBusy(false); }
  };

  const generate = async () => {
    if (!beforeUrl || !prospectId) return;
    if (remaining <= 0) return;
    setBusy(true); setAfterUrl(null); setToolMsg(ta.generating);
    try {
      const res = await fetch("/api/design-render", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: beforeUrl, prompt: `${style} ${room} remodel`, roomType: room, style, strength: 0.72, prospectId,
        }),
      });
      const started = await res.json();
      if (res.status === 429) { persist(prospectId, 3); setToolMsg(null); setBusy(false); return; }
      if (res.status === 502) { setToolMsg(ta.errRender); setBusy(false); return; } // render falló, no cuenta
      if (!res.ok) { setToolMsg(ta.errGeneric); setBusy(false); return; }

      persist(prospectId, rendersUsed + 1);

      // Con Prefer:wait el POST suele traer el output directo; el polling es respaldo
      const pickOut = (o: unknown): string | null =>
        Array.isArray(o) ? (o[0] as string) ?? null : (typeof o === "string" ? o : null);
      let output: string | null = started?.status === "succeeded" ? pickOut(started.output) : pickOut(started.output);
      const id = started.id;
      let tries = 0;
      while (!output && id && tries < 60) {
        await new Promise(r => setTimeout(r, 2500));
        const pr = await fetch(`/api/design-render?id=${id}`).then(r => r.json()).catch(() => null);
        if (pr?.status === "succeeded") output = pickOut(pr.output);
        else if (pr?.status === "failed" || pr?.status === "canceled") break;
        tries++;
      }
      if (output) {
        setAfterUrl(output); setPos(50); setToolMsg(null);
        fetch("/api/prospects", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: prospectId, renderUrl: output, beforeUrl }) }).catch(() => {});
      }
      else setToolMsg(ta.errRender);
    } catch { setToolMsg(ta.errRender); }
    finally { setBusy(false); }
  };

  const move = (clientX: number) => {
    const el = sliderRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };

  const inputCls = "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-[#8FA6AF] focus:border-[#C9A227] focus:outline-none";
  const sel = "rounded-xl border border-white/15 bg-[#16323D] px-3 py-2.5 text-sm text-white focus:border-[#C9A227] focus:outline-none";

  return (
    <section id="ai-design" className="bg-[#0F2A33] py-20 text-white sm:py-24">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          {/* Left — copy + gate/controls */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#C9A227]/40 bg-[#C9A227]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#E7C86A]">
              <Sparkles size={13} /> {ta.badge} · {ta.free}
            </span>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.3em] text-[#9FB9C4]">{ta.eyebrow}</p>
            <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">{ta.title}</h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-[#C6D4DA]">{ta.description}</p>

            {phase === "gate" ? (
              <div className="mt-8 max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="mb-4 text-sm font-semibold text-white">{ta.gateTitle}</p>
                <div className="flex flex-col gap-3">
                  <input className={inputCls} placeholder={ta.namePh}  value={form.name}  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  <input className={inputCls} placeholder={ta.emailPh} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  <input className={inputCls} placeholder={ta.phonePh} type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  {gateErr && <p className="text-xs font-semibold text-[#F0A090]">{gateErr}</p>}
                  <button onClick={submitGate} disabled={gating}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C9A227] px-6 py-3.5 text-sm font-bold text-[#16323D] transition hover:bg-[#dab63f] disabled:opacity-60">
                    {gating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    {ta.gateCta}
                  </button>
                  <p className="text-[11px] leading-5 text-[#8FA6AF]">{ta.gateNote}</p>
                </div>
              </div>
            ) : (
              <div className="mt-8 max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">{ta.toolTitle}</p>
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-[#E7C86A]">
                    {remaining} {ta.rendersLeft}
                  </span>
                </div>

                {remaining <= 0 ? (
                  <div className="rounded-xl bg-white/5 p-4 text-center">
                    <p className="text-sm text-[#C6D4DA]">{ta.limitReached}</p>
                    <Link href="/reservas" className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-[#C9A227] px-5 py-2.5 text-sm font-bold text-[#16323D] hover:bg-[#dab63f]">
                      {ta.cta} <ArrowRight size={15} />
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      <select className={sel} value={room} onChange={e => setRoom(e.target.value)}>
                        {ROOMS.map(r => <option key={r.en} value={r.en}>{EN ? r.en : r.es}</option>)}
                      </select>
                      <select className={sel} value={style} onChange={e => setStyle(e.target.value)}>
                        {STYLES.map(s => <option key={s.en} value={s.en}>{EN ? s.en : s.es}</option>)}
                      </select>
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => onPick(e.target.files)} />
                    <button onClick={() => fileRef.current?.click()} disabled={busy}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50">
                      <Upload size={15} /> {beforeUrl ? ta.changePhoto : ta.uploadPhoto}
                    </button>
                    <button onClick={generate} disabled={busy || !beforeUrl}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C9A227] px-6 py-3.5 text-sm font-bold text-[#16323D] transition hover:bg-[#dab63f] disabled:opacity-50">
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                      {ta.generate}
                    </button>
                    {toolMsg && <p className="text-xs font-semibold text-[#9FB9C4]">{toolMsg}</p>}
                  </div>
                )}
                <p className="mt-4 text-[11px] leading-5 text-[#8FA6AF]">{ta.note}</p>
              </div>
            )}
          </div>

          {/* Right — preview */}
          <div>
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-70px" }} transition={{ duration: 0.6 }}
              ref={sliderRef}
              className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[#16323D] shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
              onMouseMove={e => e.buttons === 1 && afterUrl && move(e.clientX)}
              onPointerDown={e => afterUrl && move(e.clientX)}
              onTouchMove={e => afterUrl && move(e.touches[0].clientX)}
              style={{ cursor: afterUrl ? "ew-resize" : "default" }}
            >
              {afterUrl && beforeUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={afterUrl} alt={ta.after} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
                  <span className="absolute right-4 top-4 rounded-md bg-[#C9A227] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#16323D]">{ta.after}</span>
                  <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={beforeUrl} alt={ta.before} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
                    <span className="absolute left-4 top-4 rounded-md bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-700">{ta.before}</span>
                  </div>
                  <div className="absolute inset-y-0" style={{ left: `${pos}%` }}>
                    <div className="absolute inset-y-0 -ml-px w-0.5 bg-white/90" />
                    <div className="absolute top-1/2 -ml-4 -translate-y-1/2 grid size-8 place-items-center rounded-full bg-white text-[#16323D] shadow-lg"><ArrowRight size={14} /></div>
                  </div>
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">{ta.dragHint}</span>
                </>
              ) : beforeUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={beforeUrl} alt={ta.before} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
                  {busy && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0F2A33]/70 backdrop-blur-sm">
                      <Loader2 size={30} className="animate-spin text-[#C9A227]" />
                      <p className="text-sm font-semibold text-white">{ta.generating}</p>
                    </div>
                  )}
                  <span className="absolute left-4 top-4 rounded-md bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-700">{ta.before}</span>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <RotateCcw size={34} className="text-[#3E5B66]" />
                  <p className="max-w-xs text-sm text-[#8FA6AF]">{phase === "gate" ? ta.emptyGate : ta.emptyTool}</p>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </Container>
    </section>
  );
}
