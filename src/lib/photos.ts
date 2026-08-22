import { supabase } from "./supabase";
import { PRIVATE_BUCKET, privateRef } from "./files";
import type { PhotoTag, ProjectPhoto } from "@/src/types/project";

/** Bucket público histórico. Las fotos nuevas ya no van aquí. */
export const PHOTOS_BUCKET = "kokistyle-files";

export const PHOTO_TAG_ORDER: PhotoTag[] = ["antes", "avance", "despues", "problema", "material"];

export const PHOTO_TAG_COLORS: Record<string, string> = {
  antes:    "#5C6A6E",
  avance:   "#395886",
  despues:  "#4F8A63",
  problema: "#B0492F",
  material: "#B98A2F",
};

const CUSTOM_TAG_PALETTE = ["#6D3AAD", "#4E7A82", "#A0582A", "#3F6AB0", "#7A6230", "#8C3A5E"];

// Etiquetas custom: color determinístico por nombre (mismo tag → mismo color en todo lado)
export function photoTagColor(tag: string): string {
  if (PHOTO_TAG_COLORS[tag]) return PHOTO_TAG_COLORS[tag];
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return CUSTOM_TAG_PALETTE[h % CUSTOM_TAG_PALETTE.length];
}

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Las fotos del teléfono pesan 5-15MB — se comprimen a máx 1600px JPEG antes de subir.
// `rotate` (0/90/180/270, en grados horarios) se hornea en el canvas: la foto queda
// derecha en el Storage, sin depender de cómo la muestre cada visor.
export async function compressImage(file: File, rotate = 0): Promise<Blob> {
  const quarter = ((Math.round(rotate / 90) * 90) % 360 + 360) % 360;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const swap = quarter === 90 || quarter === 270;
    const canvas = document.createElement("canvas");
    canvas.width = swap ? h : w;
    canvas.height = swap ? w : h;
    const ctx = canvas.getContext("2d")!;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    if (quarter) ctx.rotate((quarter * Math.PI) / 180);
    ctx.drawImage(bmp, -w / 2, -h / 2, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/jpeg", 0.82));
    if (!blob) return file;
    // Con rotación siempre gana el canvas; sin ella, solo si de verdad pesa menos
    return quarter || blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

// Comprime, sube al Storage y crea la fila — siempre anclada a un proyecto concreto
export async function uploadProjectPhoto(opts: {
  projectId: string;
  file: File;
  caption: string;
  tag: PhotoTag;
  album?: string;
  rotate?: number;   // grados horarios elegidos en el compositor (0/90/180/270)
}): Promise<ProjectPhoto> {
  const blob = await compressImage(opts.file, opts.rotate ?? 0);
  const path = `project-photos/${opts.projectId}/${crypto.randomUUID()}.jpg`;
  // Las fotos de obra son de casas de clientes: nacen en el bucket privado y en
  // la base queda una referencia que hay que firmar para poder ver.
  const { error: upErr } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg" });
  if (upErr) throw upErr;
  const pub = { publicUrl: privateRef(path) };
  // taken_at desde la fecha real del archivo — las fotos viejas del carrete quedan en su día
  const taken_at = isoLocal(new Date(opts.file.lastModified || Date.now()));
  const row = {
    project_id: opts.projectId,
    url: pub.publicUrl,
    caption: opts.caption.trim() || null,
    tag: opts.tag,
    album: opts.album?.trim() || null,
    taken_at,
  };
  let { data, error } = await supabase.from("project_photos").insert(row).select("*").single();
  // Si la migración de `album` aún no corrió, no romper la subida: reintentar sin la columna
  if (error && /album/i.test(error.message)) {
    const { album: _omit, ...legacy } = row;
    void _omit;
    ({ data, error } = await supabase.from("project_photos").insert(legacy).select("*").single());
  }
  if (error || !data) throw error ?? new Error("insert failed");
  return data as ProjectPhoto;
}
