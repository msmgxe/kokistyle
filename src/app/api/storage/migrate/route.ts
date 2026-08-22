import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase-admin";
import { resolveSession } from "@/src/lib/session";
import { PRIVATE_BUCKET, privateRef, pathFromPublicUrl } from "@/src/lib/files";

export const maxDuration = 60;

const PUBLIC_BUCKET = "kokistyle-files";
const CARPETAS = ["project-photos", "notes"] as const;

/**
 * Mueve al bucket privado las fotos de obra y los adjuntos de notas, y deja en
 * la base la referencia `priv:` en lugar de la URL pública.
 *
 * Corre en el servidor porque necesita la service role. Es **repetible**: lo ya
 * migrado se salta, así que se puede lanzar tantas veces como haga falta hasta
 * que `pendientes` llegue a cero. Los archivos originales no se borran aquí:
 * eso se hace al final, con `?borrar=1`, cuando todo esté verificado.
 *
 *   POST /api/storage/migrate            → copia y reescribe (por tandas)
 *   POST /api/storage/migrate?borrar=1   → borra los originales ya migrados
 */
export async function POST(req: NextRequest) {
  const session = await resolveSession(req);
  if (session?.role !== "superadmin") {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const borrar = new URL(req.url).searchParams.get("borrar") === "1";
  const informe = {
    fotos: { migradas: 0, pendientes: 0, errores: [] as string[] },
    adjuntos: { migrados: 0, pendientes: 0, errores: [] as string[] },
    portadas: { migradas: 0, errores: [] as string[] },
    borrados: 0,
  };

  /** Copia un archivo al bucket privado. Devuelve la ruta si quedó allí. */
  const copiar = async (ruta: string): Promise<string | null> => {
    const { error } = await admin.storage.from(PUBLIC_BUCKET)
      .copy(ruta, ruta, { destinationBucket: PRIVATE_BUCKET });
    if (!error) return ruta;
    // Si ya existe en destino, damos la copia por buena
    if (/exists|duplicate/i.test(error.message)) return ruta;
    return null;
  };

  // ── Fotos de obra ────────────────────────────────────────────────────────
  const { data: fotos } = await admin
    .from("project_photos").select("id, url").not("url", "like", "priv:%").limit(400);

  for (const foto of (fotos ?? []) as { id: string; url: string }[]) {
    const ruta = pathFromPublicUrl(foto.url, PUBLIC_BUCKET);
    if (!ruta) { informe.fotos.errores.push(`url no reconocida: ${foto.id}`); continue; }
    const copiada = await copiar(ruta);
    if (!copiada) { informe.fotos.errores.push(`no se pudo copiar: ${ruta}`); continue; }
    const { error } = await admin.from("project_photos")
      .update({ url: privateRef(ruta) }).eq("id", foto.id);
    if (error) informe.fotos.errores.push(`no se pudo actualizar: ${foto.id}`);
    else informe.fotos.migradas++;
  }

  // ── Adjuntos de notas (viven dentro de un JSONB) ─────────────────────────
  const { data: notas } = await admin
    .from("project_notes").select("id, attachments").limit(400);

  for (const nota of (notas ?? []) as { id: string; attachments: { url?: string }[] | null }[]) {
    const adjuntos = nota.attachments ?? [];
    if (!adjuntos.length) continue;
    let cambio = false;
    const nuevos = [];
    for (const a of adjuntos) {
      const url = String(a?.url ?? "");
      if (!url || url.startsWith("priv:")) { nuevos.push(a); continue; }
      const ruta = pathFromPublicUrl(url, PUBLIC_BUCKET);
      if (!ruta) { nuevos.push(a); informe.adjuntos.errores.push(`url no reconocida en nota ${nota.id}`); continue; }
      const copiada = await copiar(ruta);
      if (!copiada) { nuevos.push(a); informe.adjuntos.errores.push(`no se pudo copiar: ${ruta}`); continue; }
      nuevos.push({ ...a, url: privateRef(ruta) });
      cambio = true;
      informe.adjuntos.migrados++;
    }
    if (cambio) {
      const { error } = await admin.from("project_notes")
        .update({ attachments: nuevos }).eq("id", nota.id);
      if (error) informe.adjuntos.errores.push(`no se pudo actualizar la nota ${nota.id}`);
    }
  }

  // ── Portadas ─────────────────────────────────────────────────────────────
  // Una portada no siempre está en la galería: `ProjectFormModal` sube la suya
  // directamente. Por eso hay que copiar el archivo, no sólo reescribir la
  // referencia — y hay que revisar también las que ya dicen `priv:`, por si se
  // reescribieron antes de que el archivo existiera en el bucket privado.
  const { data: portadas } = await admin
    .from("projects").select("id, photo_url").not("photo_url", "is", null).limit(400);

  for (const p of (portadas ?? []) as { id: string; photo_url: string }[]) {
    const yaPrivada = p.photo_url.startsWith("priv:");
    const ruta = yaPrivada
      ? p.photo_url.slice("priv:".length)
      : pathFromPublicUrl(p.photo_url, PUBLIC_BUCKET);
    if (!ruta) continue;

    const copiada = await copiar(ruta);          // idempotente: si ya está, sigue
    if (!copiada) {
      informe.portadas.errores.push(`no se pudo copiar la portada de ${p.id}: ${ruta}`);
      continue;
    }
    if (!yaPrivada) {
      await admin.from("projects").update({ photo_url: privateRef(ruta) }).eq("id", p.id);
    }
    informe.portadas.migradas++;
  }

  // ── Cuánto falta ─────────────────────────────────────────────────────────
  const { count: faltanFotos } = await admin
    .from("project_photos").select("id", { count: "exact", head: true }).not("url", "like", "priv:%");
  informe.fotos.pendientes = faltanFotos ?? 0;

  // ── Borrado de originales, sólo cuando se pide explícitamente ────────────
  if (borrar) {
    for (const carpeta of CARPETAS) {
      const { data: proyectos } = await admin.storage.from(PUBLIC_BUCKET).list(carpeta, { limit: 1000 });
      for (const sub of proyectos ?? []) {
        const { data: archivos } = await admin.storage
          .from(PUBLIC_BUCKET).list(`${carpeta}/${sub.name}`, { limit: 1000 });
        const rutas = (archivos ?? []).map(a => `${carpeta}/${sub.name}/${a.name}`);
        if (!rutas.length) continue;
        const { data: quitados } = await admin.storage.from(PUBLIC_BUCKET).remove(rutas);
        informe.borrados += quitados?.length ?? 0;
      }
    }
  }

  return NextResponse.json({ ok: true, ...informe });
}
