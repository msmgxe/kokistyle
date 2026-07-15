"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/src/lib/supabase";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import type { Project } from "@/src/types/project";

const ROOMS = [
  { en: "Living Room",     es: "Sala de estar" },
  { en: "Kitchen",         es: "Cocina" },
  { en: "Master Bedroom",  es: "Habitación principal" },
  { en: "Master Bathroom", es: "Baño principal" },
  { en: "Dining Room",     es: "Comedor" },
  { en: "Home Office",     es: "Oficina en casa" },
  { en: "Laundry Room",    es: "Lavandería" },
  { en: "Outdoor",         es: "Exterior" },
];

const STYLES = [
  { en: "Modern",        es: "Moderno" },
  { en: "Contemporary",  es: "Contemporáneo" },
  { en: "Luxury",        es: "Lujo" },
  { en: "Minimalist",    es: "Minimalista" },
  { en: "Transitional",  es: "Transicional" },
  { en: "Mediterranean", es: "Mediterráneo" },
  { en: "Industrial",    es: "Industrial" },
  { en: "Scandinavian",  es: "Escandinavo" },
];

type RenderEntry = {
  before: string;
  after:  string;
  room:   string;
  style:  string;
  prompt: string;
  ts:     number;
};

type ScopeItem = {
  name_en: string;
  name_es: string;
  description_en: string;
  description_es: string;
  amount: number;
};

type ModalState = { before: string; after: string } | null;

interface Props {
  project: Project & { id: string };
  toast: (msg: string) => void;
}

export default function DesignTab({ project, toast }: Props) {
  const { language } = useLanguage();
  const { currentUser } = useAuth();
  const isEN = language === "en";

  const [photos, setPhotos]         = useState<{ url: string; path: string }[]>([]);
  const [activePhoto, setActivePhoto] = useState(0);
  const [room, setRoom]             = useState(ROOMS[0].en);
  const [style, setStyle]           = useState(STYLES[0].en);
  const [strength, setStrength]     = useState(0.75);
  const [prompt, setPrompt]         = useState("");
  const [generating, setGenerating] = useState(false);
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [history, setHistory]       = useState<RenderEntry[]>([]);
  const [modal, setModal]           = useState<ModalState>(null);
  const [uploading, setUploading]   = useState(false);
  const [listening, setListening]   = useState(false);
  const [sliderPos, setSliderPos]   = useState(50);   // comparison slider 0–100
  const [scope, setScope]           = useState<ScopeItem[] | null>(null);
  const [scopeBusy, setScopeBusy]   = useState(false);
  const [scopeSel, setScopeSel]     = useState<Set<number>>(new Set());
  const [creatingSections, setCreatingSections] = useState(false);

  const fileInputRef  = useRef<HTMLInputElement>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const isDragging    = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef      = useRef<any>(null);

  // ── Strength label ──────────────────────────────────────────────────────
  const strengthLabel = (() => {
    if (strength <= 0.45) return isEN ? "Subtle — keeps structure" : "Sutil — conserva estructura";
    if (strength <= 0.62) return isEN ? "Balanced — guided change" : "Equilibrado — cambio guiado";
    if (strength <= 0.80) return isEN ? "Bold — major redesign"    : "Atrevido — rediseño mayor";
    return isEN ? "Full creative — maximum transformation" : "Máximo creativo — transformación total";
  })();

  // ── Comparison slider drag ───────────────────────────────────────────────
  const updateSliderFromX = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct  = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(3, Math.min(97, pct)));
  }, []);

  const startDrag = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    updateSliderFromX(clientX);

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      const x = "touches" in ev
        ? (ev as TouchEvent).touches[0]?.clientX ?? 0
        : (ev as MouseEvent).clientX;
      updateSliderFromX(x);
    };
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
  }, [updateSliderFromX]);

  // ── Poll Replicate async prediction ─────────────────────────────────────
  useEffect(() => {
    if (!predictionId) return;
    const interval = setInterval(async () => {
      try {
        const res  = await fetch(`/api/design-render?id=${predictionId}`);
        const data = await res.json();
        if (data.status === "succeeded") {
          const url = Array.isArray(data.output) ? data.output[0] : data.output;
          clearInterval(interval);
          setPredictionId(null);
          setGenerating(false);
          setSliderPos(50);
          setHistory(h => [
            { before: photos[activePhoto]?.url ?? "", after: url, room, style, prompt, ts: Date.now() },
            ...h,
          ]);
          toast(isEN ? "Render complete ✓" : "Render listo ✓");
        } else if (["failed", "canceled"].includes(data.status)) {
          clearInterval(interval);
          setPredictionId(null);
          setGenerating(false);
          toast(isEN ? "Generation failed. Try again." : "Error al generar. Intenta de nuevo.");
        }
      } catch { /* network hiccup — keep polling */ }
    }, 2500);
    return () => clearInterval(interval);
  }, [predictionId, photos, activePhoto, room, style, prompt, isEN, toast]);

  // ── Upload photos to Supabase Storage ───────────────────────────────────
  const uploadPhotos = useCallback(async (files: FileList) => {
    setUploading(true);
    const uploaded: { url: string; path: string }[] = [];
    for (const file of Array.from(files)) {
      const ext  = file.name.split(".").pop() ?? "jpg";
      const path = `design-refs/${project.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("kokistyle-files").upload(path, file, { upsert: false });
      if (error) { toast(isEN ? "Upload error" : "Error al subir"); continue; }
      const { data: pub } = supabase.storage.from("kokistyle-files").getPublicUrl(path);
      uploaded.push({ url: pub.publicUrl, path });
    }
    setPhotos(p => [...p, ...uploaded]);
    setUploading(false);
  }, [project.id, isEN, toast]);

  const removePhoto = async (idx: number) => {
    await supabase.storage.from("kokistyle-files").remove([photos[idx].path]);
    setPhotos(p => p.filter((_, i) => i !== idx));
    if (activePhoto >= idx) setActivePhoto(Math.max(0, activePhoto - 1));
  };

  // ── Generate render ──────────────────────────────────────────────────────
  const generate = async () => {
    if (photos.length === 0) {
      toast(isEN ? "Upload a reference photo first" : "Sube una foto de referencia primero");
      return;
    }
    if (!prompt.trim()) {
      toast(isEN ? "Describe what you want" : "Describe los cambios que deseas");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/design-render", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: photos[activePhoto].url,
          prompt:   prompt.trim(),
          roomType: room,
          style,
          strength,
          adminPin:   currentUser?.pin || undefined,
          adminToken: typeof window !== "undefined" ? (localStorage.getItem("kokistyle-device-token") || undefined) : undefined,
        }),
      });
      let data: Record<string, unknown>;
      try {
        data = await res.json();
      } catch {
        throw new Error(res.ok ? "Invalid response" : `HTTP ${res.status}`);
      }
      if (!res.ok) {
        const errMsg = (data.error as string) || "API error";
        throw new Error(`HTTP ${res.status}: ${errMsg}`);
      }

      if (data.output) {
        const url = Array.isArray(data.output) ? data.output[0] : data.output;
        setSliderPos(50);
        setHistory(h => [
          { before: photos[activePhoto].url, after: url, room, style, prompt, ts: Date.now() },
          ...h,
        ]);
        setGenerating(false);
        toast(isEN ? "Render complete ✓" : "Render listo ✓");
      } else if (data.id && typeof data.id === "string") {
        setPredictionId(data.id as string);
      } else {
        throw new Error("Unexpected response");
      }
    } catch (e) {
      setGenerating(false);
      const msg = e instanceof Error ? e.message : String(e);
      const isConfig  = /REPLICATE|configured|token/i.test(msg);
      const isAuth    = /HTTP 401/.test(msg);
      const isBilling = /HTTP 402/.test(msg);
      const isHttp    = /HTTP \d/.test(msg);
      toast(
        isConfig
          ? (isEN ? "REPLICATE_API_TOKEN not set — add it in Vercel → Environment Variables" : "Falta REPLICATE_API_TOKEN — agrégalo en Vercel → Environment Variables")
          : isAuth
          ? (isEN ? "Invalid Replicate token. Verify it at replicate.com/account/api-tokens" : "Token de Replicate inválido. Verifícalo en replicate.com/account/api-tokens")
          : isBilling
          ? (isEN ? "Add a payment method at replicate.com/account/billing (free credits may be exhausted)" : "Agrega un método de pago en replicate.com/account/billing")
          : isHttp
          ? (isEN ? `Replicate error: ${msg}` : `Error de Replicate: ${msg}`)
          : (isEN ? "Connection error. Try again." : "Error de conexión. Intenta de nuevo.")
      );
    }
  };

  // ── Alcance a presupuestar: Claude mira la foto + objetivo → secciones del Estimate ──
  const suggestScope = useCallback(async () => {
    const before = photos[activePhoto]?.url;
    if (!before) {
      toast(isEN ? "Upload a photo of the space first" : "Sube primero una foto del espacio");
      return;
    }
    setScopeBusy(true);
    setScope(null);
    try {
      const res = await fetch("/api/design-scope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: before, objective: prompt.trim(), language }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.scope)) throw new Error(data.error ?? `HTTP ${res.status}`);
      setScope(data.scope as ScopeItem[]);
      setScopeSel(new Set((data.scope as ScopeItem[]).map((_, i) => i)));
    } catch (e) {
      toast((isEN ? "Scope analysis failed: " : "Falló el análisis de alcance: ") + (e instanceof Error ? e.message : ""));
    } finally {
      setScopeBusy(false);
    }
  }, [photos, activePhoto, prompt, language, isEN, toast]);

  const createSections = useCallback(async () => {
    if (!scope) return;
    const chosen = scope.filter((_, i) => scopeSel.has(i));
    if (!chosen.length) return;
    setCreatingSections(true);
    try {
      let { data: est } = await supabase
        .from("project_estimates").select("id").eq("project_id", project.id).maybeSingle();
      if (!est) {
        const { data: created, error } = await supabase
          .from("project_estimates").insert({ project_id: project.id }).select("id").single();
        if (error || !created) throw error ?? new Error("estimate");
        est = created;
      }
      const { count } = await supabase
        .from("estimate_sections").select("id", { count: "exact", head: true }).eq("estimate_id", est.id);
      const base = count ?? 0;
      const rows = chosen.map((s, i) => ({
        estimate_id: est!.id,
        name_en: s.name_en,
        name_es: s.name_es,
        section_total: Number(s.amount) || 0,
        sort_order: base + i,
        is_material_type: false,
      }));
      const { error: insErr } = await supabase.from("estimate_sections").insert(rows);
      if (insErr) throw insErr;
      toast(isEN
        ? `✓ ${rows.length} sections added to the Estimate`
        : `✓ ${rows.length} secciones agregadas al Estimate`);
      setScope(null);
    } catch (e) {
      toast("Error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setCreatingSections(false);
    }
  }, [scope, scopeSel, project.id, isEN, toast]);

  // ── Voice input (same pattern as working prototypes) ────────────────────
  const toggleVoice = () => {
    if (listening) { recogRef.current?.stop(); setListening(false); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) { toast(isEN ? "Voice not supported in this browser" : "Voz no disponible en este navegador"); return; }
    const rec = new SR();
    rec.lang = language === "en" ? "en-US" : "es-US";
    rec.continuous = false;
    rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      setPrompt(cur => cur ? cur + ", " + transcript : transcript);
    };
    rec.onend  = () => setListening(false);
    rec.onerror = () => setListening(false);
    recogRef.current = rec;
    rec.start();
    setListening(true);
  };

  const downloadRender = (url: string) => {
    const a = document.createElement("a");
    a.href = url; a.download = `luxaris-render-${Date.now()}.jpg`; a.target = "_blank";
    a.click();
  };

  const latest = history[0];

  return (
    <>
      <div
        className="flex rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] overflow-hidden"
        style={{ height: "calc(100vh - 210px)" }}
      >
        {/* ── COL 1 · REFERENCIAS ──────────────────────────────── */}
        <div className="flex flex-col w-[200px] flex-none border-r border-[#E6DDCB] dark:border-[#22304d]">
          <div className="bg-[var(--brand)] px-3 py-2.5">
            <p className="text-[9px] font-bold tracking-widest text-white/40 uppercase">
              {isEN ? "References" : "Referencias"}
            </p>
            <p className="text-[11px] font-semibold text-white mt-0.5">
              {isEN ? "Inspiration Photos" : "Fotos de inspiración"}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
            {photos.map((p, i) => (
              <div
                key={p.path}
                onClick={() => setActivePhoto(i)}
                className={`relative group rounded-lg overflow-hidden cursor-pointer border-2 transition-all flex-none ${
                  activePhoto === i ? "border-[#C9A96E]" : "border-transparent hover:border-[#E6DDCB] dark:hover:border-[#22304d]"
                }`}
              >
                <img
                  src={p.url} alt={`Ref ${i + 1}`}
                  className="w-full h-[105px] object-cover"
                  onClick={e => { e.stopPropagation(); setModal({ before: p.url, after: p.url }); }}
                />
                <button
                  onClick={e => { e.stopPropagation(); removePhoto(i); }}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >✕</button>
                {activePhoto === i && (
                  <div className="absolute bottom-0 left-0 right-0 bg-[#C9A96E]/90 text-[var(--brand)] text-[9px] font-bold text-center py-0.5 uppercase tracking-wider">
                    {isEN ? "Active" : "Activa"}
                  </div>
                )}
              </div>
            ))}

            {photos.length === 0 && !uploading && (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-[#5C6A6E] dark:text-[#9fb0cc] py-8">
                <span className="text-3xl">📸</span>
                <p className="text-[11px] text-center leading-tight px-2">
                  {isEN
                    ? "Upload photos of the room to transform"
                    : "Sube fotos del espacio a transformar"}
                </p>
              </div>
            )}
            {uploading && (
              <div className="flex items-center justify-center py-4">
                <div className="w-5 h-5 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          <div className="p-2 border-t border-[#E6DDCB] dark:border-[#22304d]">
            <input
              ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => e.target.files && uploadPhotos(e.target.files)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 rounded-lg border border-dashed border-[#C9A96E] text-[#C9A96E] text-xs font-semibold hover:bg-[#C9A96E]/10 transition-colors"
            >
              + {isEN ? "Add Photos" : "Agregar fotos"}
            </button>
          </div>
        </div>

        {/* ── COL 2 · DESIGN BRIEF ─────────────────────────────── */}
        <div className="flex flex-col w-[260px] flex-none border-r border-[#E6DDCB] dark:border-[#22304d]">
          <div className="bg-[var(--brand)] px-3 py-2.5">
            <p className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Design Brief</p>
            <p className="text-[11px] font-semibold text-white mt-0.5">
              {isEN ? "Complete each section" : "Completa cada sección"}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
            {/* Room Type */}
            <div>
              <label className="block text-[9px] font-bold text-[#5C6A6E] dark:text-[#9fb0cc] uppercase tracking-wider mb-1.5">
                {isEN ? "Room Type" : "Tipo de ambiente"}
              </label>
              <select
                value={room} onChange={e => setRoom(e.target.value)}
                className="w-full text-xs border border-[#E6DDCB] dark:border-[#22304d] rounded-lg px-2.5 py-2 bg-white dark:bg-[#111a2e] text-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              >
                {ROOMS.map(r => (
                  <option key={r.en} value={r.en}>{isEN ? r.en : r.es}</option>
                ))}
              </select>
            </div>

            {/* Style */}
            <div>
              <label className="block text-[9px] font-bold text-[#5C6A6E] dark:text-[#9fb0cc] uppercase tracking-wider mb-1.5">
                {isEN ? "Design Style" : "Estilo de diseño"}
              </label>
              <div className="grid grid-cols-2 gap-1">
                {STYLES.map(s => (
                  <button
                    key={s.en} onClick={() => setStyle(s.en)}
                    className={`text-[10px] py-1.5 px-1 rounded-lg border font-semibold transition-all text-center ${
                      style === s.en
                        ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                        : "border-[#E6DDCB] dark:border-[#22304d] text-[#5C6A6E] dark:text-[#9fb0cc] hover:border-[var(--brand)] hover:text-[var(--brand)]"
                    }`}
                  >
                    {isEN ? s.en : s.es}
                  </button>
                ))}
              </div>
            </div>

            {/* Strength */}
            <div>
              <label className="flex justify-between text-[9px] font-bold text-[#5C6A6E] dark:text-[#9fb0cc] uppercase tracking-wider mb-1">
                <span>{isEN ? "Change Intensity" : "Intensidad del cambio"}</span>
                <span className="text-[#C9A96E] font-bold">{Math.round(strength * 100)}%</span>
              </label>
              <input
                type="range" min="0.3" max="0.95" step="0.05"
                value={strength} onChange={e => setStrength(parseFloat(e.target.value))}
                className="w-full h-1.5 accent-[#C9A96E]"
              />
              <p className="text-[9px] text-[#5C6A6E] dark:text-[#9fb0cc] mt-0.5 leading-tight">{strengthLabel}</p>
              <div className="flex justify-between text-[8px] text-[#5C6A6E]/60 mt-0.5">
                <span>{isEN ? "Keep original" : "Conserva original"}</span>
                <span>{isEN ? "Full creative" : "Total creativo"}</span>
              </div>
            </div>

            {/* Prompt + Voice */}
            <div className="flex flex-col" style={{ flex: 1, minHeight: 90 }}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[9px] font-bold text-[#5C6A6E] dark:text-[#9fb0cc] uppercase tracking-wider">
                  {isEN ? "Description" : "Descripción"}
                </label>
                <button
                  onClick={toggleVoice}
                  className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg font-semibold border transition-all ${
                    listening
                      ? "bg-red-50 text-red-600 border-red-200 animate-pulse"
                      : "bg-[#F7F3EA] dark:bg-[#0b1220] text-[var(--brand)] border-[#E6DDCB] dark:border-[#22304d] hover:border-[var(--brand)]"
                  }`}
                >
                  🎙 {listening ? (isEN ? "Stop" : "Parar") : (isEN ? "Voice" : "Voz")}
                </button>
              </div>
              <textarea
                value={prompt} onChange={e => setPrompt(e.target.value)}
                placeholder={
                  isEN
                    ? "Describe changes: marble floors, open concept kitchen, warm lighting, white cabinets..."
                    : "Describe cambios: piso de mármol, cocina abierta, iluminación cálida, gabinetes blancos..."
                }
                className="flex-1 w-full text-xs border border-[#E6DDCB] dark:border-[#22304d] rounded-lg px-2.5 py-2 bg-white dark:bg-[#111a2e] text-[var(--brand)] placeholder:text-[#5C6A6E]/50 focus:outline-none focus:ring-1 focus:ring-[var(--brand)] resize-none"
                style={{ minHeight: 90 }}
              />
            </div>
          </div>

          <div className="p-3 border-t border-[#E6DDCB] dark:border-[#22304d]">
            <button
              onClick={generate} disabled={generating || uploading}
              className="w-full py-2.5 rounded-xl bg-[var(--brand)] text-white text-sm font-bold tracking-wide hover:bg-[#1a3e4d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {predictionId
                    ? (isEN ? "Processing..." : "Procesando...")
                    : (isEN ? "Sending..." : "Enviando...")}
                </>
              ) : (
                "✨ " + (isEN ? "Generate Render" : "Generar Render")
              )}
            </button>

            {/* Foto + objetivo → Claude propone secciones listas para el Estimate */}
            <button
              onClick={suggestScope} disabled={scopeBusy || uploading}
              className="mt-2 w-full py-2.5 rounded-xl bg-[#B98A2F] text-white text-sm font-bold tracking-wide hover:bg-[#a3781f] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {scopeBusy ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {isEN ? "Analyzing photo..." : "Analizando foto..."}
                </>
              ) : (
                "💡 " + (isEN ? "Suggest scope to estimate" : "Sugerir alcance a presupuestar")
              )}
            </button>

            {scope && (
              <div className="mt-2.5 overflow-hidden rounded-xl border border-[#E6DDCB] dark:border-[#22304d]">
                {scope.map((s, i) => (
                  <label key={i} className="flex items-start gap-2 border-b border-[#F0EBE0] dark:border-[#22304d] bg-white dark:bg-[#111a2e] px-3 py-2 last:border-0">
                    <input
                      type="checkbox"
                      checked={scopeSel.has(i)}
                      onChange={() => setScopeSel(prev => {
                        const n = new Set(prev);
                        if (n.has(i)) n.delete(i); else n.add(i);
                        return n;
                      })}
                      className="mt-0.5 size-4 accent-[#4F8A63]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-bold text-[var(--brand)]">{isEN ? s.name_en : s.name_es}</span>
                      <span className="block text-[11px] leading-snug text-[#5C6A6E] dark:text-[#9fb0cc]">{isEN ? s.description_en : s.description_es}</span>
                    </span>
                    <span className="font-mono text-[12px] font-bold text-[var(--brand)]">${Number(s.amount).toLocaleString()}</span>
                  </label>
                ))}
                <button
                  onClick={createSections}
                  disabled={creatingSections || scopeSel.size === 0}
                  className="w-full bg-[#4F8A63] py-2.5 text-[12px] font-bold text-white transition-colors hover:bg-[#41724f] disabled:opacity-60"
                >
                  {creatingSections
                    ? "…"
                    : "➕ " + (isEN ? `Create ${scopeSel.size} sections in Estimate` : `Crear ${scopeSel.size} secciones en el Estimate`)}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── COL 3 · AI RENDER ────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="bg-[var(--brand)] px-3 py-2.5 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold tracking-widest text-white/40 uppercase">AI Render</p>
              <p className="text-[11px] font-semibold text-white mt-0.5">
                {latest
                  ? (isEN ? "Drag to compare Before / After" : "Arrastra para comparar Antes / Después")
                  : (isEN ? "Result will appear here" : "El resultado aparecerá aquí")}
              </p>
            </div>
            {latest && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setModal({ before: latest.before, after: latest.after })}
                  title={isEN ? "View full size" : "Ver completo"}
                  className="text-[10px] px-2 py-1 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
                >🔍</button>
                <button
                  onClick={generate} disabled={generating}
                  title={isEN ? "New variation" : "Nueva variación"}
                  className="text-[10px] px-2 py-1 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors disabled:opacity-30"
                >🔄</button>
                <button
                  onClick={() => downloadRender(latest.after)}
                  title={isEN ? "Download" : "Descargar"}
                  className="text-[10px] px-2 py-1 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
                >⬇</button>
                {history.length > 1 && (
                  <span className="text-[10px] bg-white/10 text-white/60 px-2 py-0.5 rounded-full">
                    {history.length}
                  </span>
                )}
              </div>
            )}
          </div>

          {latest ? (
            <>
              {/* ── COMPARISON DRAG SLIDER ── */}
              <div
                ref={containerRef}
                className="flex-1 relative overflow-hidden select-none"
                style={{ cursor: "ew-resize" }}
                onMouseDown={startDrag}
                onTouchStart={startDrag}
              >
                {/* After — base layer (full) */}
                <img
                  src={latest.after} alt="Después"
                  className="absolute inset-0 w-full h-full"
                  style={{ objectFit: "contain", background: "#0d1f27" }}
                  draggable={false}
                />

                {/* Before — clipped overlay */}
                <img
                  src={latest.before} alt="Antes"
                  className="absolute inset-0 w-full h-full"
                  style={{
                    objectFit: "contain",
                    background: "#0d1f27",
                    clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
                  }}
                  draggable={false}
                />

                {/* ANTES label */}
                <div
                  className="absolute top-3 left-3 text-[10px] font-bold text-white rounded px-2 py-0.5 pointer-events-none"
                  style={{ background: "rgba(0,0,0,.45)" }}
                >
                  {isEN ? "BEFORE" : "ANTES"}
                </div>

                {/* DESPUÉS label */}
                <div
                  className="absolute top-3 right-3 text-[10px] font-bold text-white rounded px-2 py-0.5 pointer-events-none"
                  style={{ background: "rgba(79,138,99,.7)" }}
                >
                  {isEN ? "AFTER" : "DESPUÉS"}
                </div>

                {/* Slider line */}
                <div
                  className="absolute top-0 bottom-0 pointer-events-none"
                  style={{ left: `${sliderPos}%`, width: 2, background: "#C9A96E", transform: "translateX(-1px)" }}
                >
                  {/* Handle */}
                  <div
                    className="absolute top-1/2 left-1/2 flex items-center justify-center rounded-full font-bold shadow-lg"
                    style={{
                      width: 32, height: 32,
                      transform: "translate(-50%, -50%)",
                      background: "#C9A96E",
                      border: "2.5px solid white",
                      color: "var(--brand)",
                      fontSize: 14,
                      userSelect: "none",
                    }}
                  >
                    ⟺
                  </div>
                </div>

                {/* Generating overlay */}
                {generating && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none"
                    style={{ background: "rgba(0,0,0,.55)" }}
                  >
                    <div className="w-10 h-10 border-4 border-white/20 border-t-[#C9A96E] rounded-full animate-spin" />
                    <p className="text-sm font-semibold text-white">
                      {predictionId
                        ? (isEN ? "Processing render..." : "Procesando render...")
                        : (isEN ? "Generating..." : "Generando...")}
                    </p>
                    <p className="text-xs text-white/60">
                      {isEN ? "20–40 seconds" : "20–40 segundos"}
                    </p>
                  </div>
                )}
              </div>

              {/* History strip */}
              {history.length > 1 && (
                <div className="border-t border-[#E6DDCB] dark:border-[#22304d] px-2 py-1.5 flex gap-2 overflow-x-auto items-center">
                  <span className="text-[9px] font-bold text-[#5C6A6E] dark:text-[#9fb0cc] uppercase tracking-wider flex-none">
                    {isEN ? "History" : "Historial"}
                  </span>
                  {history.slice(1).map((r, i) => (
                    <button
                      key={r.ts}
                      onClick={() => setHistory(h => [r, ...h.filter((_, idx) => idx !== i + 1)])}
                      className="flex-none w-10 h-10 rounded-lg overflow-hidden border border-[#E6DDCB] dark:border-[#22304d] hover:border-[#C9A96E] transition-colors"
                      title={`${r.room} · ${r.style}`}
                    >
                      <img src={r.after} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* ── EMPTY STATE ── */
            <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#F7F3EA] dark:bg-[#0b1220] p-8">
              {generating ? (
                <>
                  <div className="w-14 h-14 border-4 border-[var(--brand)]/20 border-t-[#C9A96E] rounded-full animate-spin" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-[var(--brand)]">
                      {isEN ? "Generating your render..." : "Generando tu render..."}
                    </p>
                    <p className="text-xs text-[#5C6A6E] dark:text-[#9fb0cc] mt-1">
                      {isEN ? "This may take 20–40 seconds" : "Puede tardar 20–40 segundos"}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-2xl bg-white dark:bg-[#111a2e] border-2 border-dashed border-[#E6DDCB] dark:border-[#22304d] flex items-center justify-center text-4xl shadow-sm">
                    ✨
                  </div>
                  <div className="text-center max-w-xs">
                    <p className="text-sm font-semibold text-[var(--brand)]">
                      {isEN ? "Ready to generate" : "Listo para generar"}
                    </p>
                    <p className="text-xs text-[#5C6A6E] dark:text-[#9fb0cc] mt-1.5 leading-relaxed">
                      {isEN
                        ? "Upload a reference photo, describe your vision and click Generate Render"
                        : "Sube una foto de referencia, describe tu visión y presiona Generar Render"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1 bg-white dark:bg-[#111a2e] rounded-xl border border-[#E6DDCB] dark:border-[#22304d] px-3 py-2">
                    <span className="w-2 h-2 rounded-full bg-[#4F8A63]" />
                    <span className="text-[10px] font-semibold text-[var(--brand)]">Replicate · img2img · {isEN ? "transforms YOUR photo" : "transforma TU foto"}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── FULL SCREEN MODAL ──────────────────────────────────────── */}
      {modal && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.88)" }}
          onClick={() => setModal(null)}
        >
          <div
            className="relative max-w-6xl w-full max-h-[92vh] rounded-2xl overflow-hidden shadow-2xl flex gap-px"
            style={{ background: "#0d1f27" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Before */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="px-3 py-2 flex items-center gap-2" style={{ background: "rgba(255,255,255,.05)" }}>
                <span className="w-2 h-2 rounded-full bg-white/30" />
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                  {isEN ? "Before" : "Antes"}
                </span>
              </div>
              <img src={modal.before === modal.after ? latest?.before ?? modal.before : modal.before}
                alt="Antes" className="w-full max-h-[82vh] object-contain" style={{ background: "#0d1f27" }} />
            </div>

            {/* After */}
            {modal.before !== modal.after && (
              <div className="flex-1 flex flex-col min-w-0">
                <div className="px-3 py-2 flex items-center justify-between" style={{ background: "rgba(255,255,255,.05)" }}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#4F8A63]" />
                    <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                      {isEN ? "After — AI Render" : "Después — AI Render"}
                    </span>
                  </div>
                  <button
                    onClick={() => downloadRender(modal.after)}
                    className="text-[10px] px-2 py-0.5 rounded-lg text-white/60 hover:text-white transition-colors"
                    style={{ background: "rgba(255,255,255,.08)" }}
                  >
                    ⬇ {isEN ? "Download" : "Descargar"}
                  </button>
                </div>
                <img src={modal.after} alt="Después" className="w-full max-h-[82vh] object-contain" style={{ background: "#0d1f27" }} />
              </div>
            )}

            <button
              onClick={() => setModal(null)}
              className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white text-lg"
              style={{ background: "rgba(255,255,255,.1)" }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
