"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/src/lib/supabase";
import { logActivity } from "@/src/lib/activity";
import { PHOTO_TAG_ORDER, PHOTO_TAG_COLORS, uploadProjectPhoto } from "@/src/lib/photos";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import type { PhotoTag } from "@/src/types/project";

interface ProjRow { id: string; title: string; client: string }

// Destino del Web Share Target: la Galería del teléfono comparte fotos → el SW
// las deja en Cache → aquí se eligen proyecto/etiqueta y se suben
export default function CompartirPage() {
  const { t, language } = useLanguage();
  const { currentUser } = useAuth();
  const tf = t.panel.fotos;
  const EN = language === "en";

  const TAG_LABELS: Record<PhotoTag, string> = {
    antes: tf.tagAntes, avance: tf.tagAvance, despues: tf.tagDespues,
    problema: tf.tagProblema, material: tf.tagMaterial,
  };

  const [files, setFiles] = useState<File[] | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [projects, setProjects] = useState<ProjRow[]>([]);
  const [projectId, setProjectId] = useState("");
  const [caption, setCaption] = useState("");
  const [tag, setTag] = useState<PhotoTag>("avance");
  const [uploadStep, setUploadStep] = useState(0);
  const [done, setDone] = useState(false);
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
      .then(({ data }) => {
        const rows = (data as ProjRow[]) ?? [];
        setProjects(rows);
        setProjectId(prev => prev || rows[0]?.id || "");
      });
  }, []);

  const loadShared = useCallback(async () => {
    try {
      const cache = await caches.open("luxaris-shared-photos");
      const metaRes = await cache.match("/shared-meta");
      if (!metaRes) { setFiles([]); return; }
      const meta = await metaRes.json();
      const out: File[] = [];
      for (let i = 0; i < (meta.count ?? 0); i++) {
        const res = await cache.match("/shared-" + i);
        if (!res) continue;
        const blob = await res.blob();
        const name = decodeURIComponent(res.headers.get("x-file-name") ?? `foto-${i}.jpg`);
        const modified = Number(res.headers.get("x-file-modified")) || Date.now();
        out.push(new File([blob], name, { type: blob.type || "image/jpeg", lastModified: modified }));
      }
      setFiles(out);
      setPreviews(out.map(f => URL.createObjectURL(f)));
    } catch {
      setFiles([]);
    }
  }, []);

  useEffect(() => { loadShared(); }, [loadShared]);

  const clearShared = async () => {
    try { await caches.delete("luxaris-shared-photos"); } catch { /* no crítico */ }
  };

  const upload = async () => {
    if (!files?.length || !projectId || uploadStep > 0) return;
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      setUploadStep(i + 1);
      try {
        await uploadProjectPhoto({ projectId, file: files[i], caption, tag });
        ok++;
      } catch {
        showToast(tf.uploadError);
      }
    }
    if (ok > 0) {
      logActivity({
        user_id: currentUser?.id, user_name: currentUser?.name,
        user_role: currentUser?.role ?? "colaborador",
        action: "create", entity_type: "photo",
        entity_name: `${ok} ${tf.photosWord}`, project_id: projectId,
      });
      showToast(`✓ ${ok} ${tf.uploaded}`);
      setDone(true);
      await clearShared();
    }
    setUploadStep(0);
  };

  const projTitle = projects.find(p => p.id === projectId)?.title.split(" — ")[0] ?? "";

  return (
    <div className="mx-auto max-w-[560px] animate-in fade-in duration-300">
      <div className="mb-4 rounded-2xl bg-[var(--brand)] px-5 py-4">
        <h1 className="font-bookman text-[20px] font-semibold text-white">📤 {EN ? "Shared photos" : "Fotos compartidas"}</h1>
        <p className="mt-0.5 text-[12.5px] text-[#A8C0BC]">
          {EN ? "Choose the project and upload what you shared from your gallery" : "Elige el proyecto y sube lo que compartiste desde tu galería"}
        </p>
      </div>

      {files === null ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
        </div>
      ) : done ? (
        <div className="rounded-2xl border border-[#CFE3D2] bg-[#F2F8F3] dark:bg-[#14261c] p-8 text-center">
          <div className="text-[38px]">✅</div>
          <p className="mt-2 text-[15px] font-bold text-[#35664A]">
            {files.length} {tf.uploaded} — {projTitle}
          </p>
          <Link href="/proyectos/fotos" className="mt-4 inline-block rounded-xl bg-[var(--brand)] px-5 py-3 text-[13px] font-bold text-white">
            {EN ? "View photo history" : "Ver historial de fotos"}
          </Link>
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-2xl border border-[#E6DDCB] dark:border-[#22304d] bg-white dark:bg-[#111a2e] p-8 text-center text-[13.5px] leading-relaxed text-[#5C6A6E] dark:text-[#9fb0cc]">
          {EN
            ? "Nothing shared yet. Open your phone's Gallery, select photos → Share → Luxaris."
            : "Aún no hay nada compartido. Abre la Galería del teléfono, selecciona fotos → Compartir → Luxaris."}
          <br /><br />
          <Link href="/proyectos/fotos" className="font-bold text-[var(--accent)] underline">
            {EN ? "Go to Photos" : "Ir a Fotos"}
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-[var(--accent)] bg-white dark:bg-[#111a2e] p-4">
          <div className={`grid gap-2 ${previews.length === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
            {previews.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" className={`w-full rounded-xl object-cover ${previews.length === 1 ? "max-h-[260px]" : "aspect-square"}`} />
            ))}
          </div>

          <select
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            aria-label={tf.selectProject}
            className="mt-3 w-full rounded-xl border border-[#D7CBB3] dark:border-[#2c3c5e] bg-[#F7F3EA] dark:bg-[#0b1220] px-3 py-3 text-[15px] font-semibold text-[var(--brand)] focus:border-[var(--accent)] focus:outline-none"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.title.split(" — ")[0]}{p.client ? ` — ${p.client}` : ""}</option>
            ))}
          </select>

          <input
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder={tf.captionPlaceholder}
            className="mt-3 w-full rounded-xl border border-[#E6DDCB] dark:border-[#22304d] bg-[#F7F3EA] dark:bg-[#0b1220] px-3.5 py-3 text-[15px] text-[var(--brand)] placeholder:text-[#9CABB0] dark:placeholder:text-[#9fb0cc] focus:border-[var(--accent)] focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {PHOTO_TAG_ORDER.map(tg => (
              <button
                key={tg}
                onClick={() => setTag(tg)}
                className="rounded-full border-2 px-3.5 py-1.5 text-[12px] font-bold transition"
                style={tag === tg
                  ? { background: PHOTO_TAG_COLORS[tg], borderColor: PHOTO_TAG_COLORS[tg], color: "#fff" }
                  : { borderColor: "#E6DDCB", color: "#5C6A6E", background: "#fff" }}
              >
                {TAG_LABELS[tg]}
              </button>
            ))}
          </div>
          <button
            onClick={upload}
            disabled={uploadStep > 0 || !projectId}
            className="mt-4 w-full rounded-xl bg-[#4F8A63] py-3.5 text-[15px] font-bold text-white disabled:opacity-70"
          >
            {uploadStep > 0
              ? `${tf.uploading} ${uploadStep}/${files.length}…`
              : `${tf.upload} (${files.length}) → ${projTitle}`}
          </button>
        </div>
      )}

      <div className={`fixed bottom-24 left-1/2 z-[400] w-full max-w-sm -translate-x-1/2 rounded-2xl bg-[var(--brand)] px-4 py-3 text-center text-sm font-medium text-white shadow-2xl transition-all duration-300 ${toastVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}>
        {toast}
      </div>
    </div>
  );
}
