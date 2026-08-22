/**
 * Archivos privados con URL firmada.
 *
 * Las fotos de obra y los adjuntos de notas son de clientes: casas, documentos.
 * Vivían en un bucket público, así que bastaba con tener la URL para abrirlos.
 * Ahora van a un bucket privado y se sirven con enlaces que caducan.
 *
 * La convivencia es la clave para migrar sin apagar nada: en la base pueden
 * quedar dos formas de referencia y las dos se resuelven.
 *
 *   https://…/object/public/kokistyle-files/…   → pública, como siempre (legado)
 *   priv:project-photos/<proyecto>/<uuid>.jpg    → privada, hay que firmarla
 */
import { supabase } from "./supabase";

export const PRIVATE_BUCKET = "luxaris-privado";
const PREFIX = "priv:";

/** Minutos de vida del enlace. Suficiente para ver una galería sin recargar. */
const TTL_SECONDS = 60 * 60;

export const privateRef  = (path: string) => `${PREFIX}${path}`;
export const isPrivateRef = (ref: string) => typeof ref === "string" && ref.startsWith(PREFIX);
/** Ruta limpia: sin el prefijo y sin la query que algunas URLs arrastraban. */
export const refToPath = (ref: string) => ref.slice(PREFIX.length).split("?")[0];

/** Ruta dentro del bucket a partir de una URL pública (para migrar y para borrar). */
export function pathFromPublicUrl(url: string, bucket = "kokistyle-files"): string | null {
  const marca = `/${bucket}/`;
  const i = url.indexOf(marca);
  if (i === -1) return null;
  const cruda = url.slice(i + marca.length).split("?")[0];   // sin query (?t=…)
  return decodeURIComponent(cruda);
}

const cache = new Map<string, { url: string; expira: number }>();

/** URL del bucket público — respaldo mientras dure la migración. */
const publicUrlFor = (path: string) =>
  supabase.storage.from("kokistyle-files").getPublicUrl(path).data.publicUrl;

/**
 * Resuelve una lista de referencias a URLs mostrables. Las públicas se
 * devuelven tal cual; las privadas se firman **en lote**, que es una sola
 * llamada para toda la galería. El resultado se guarda en memoria hasta poco
 * antes de que caduque.
 */
export async function resolveFileUrls(refs: string[]): Promise<Map<string, string>> {
  const salida = new Map<string, string>();
  const ahora = Date.now();
  const porFirmar: string[] = [];

  for (const ref of refs) {
    if (!ref) continue;
    if (!isPrivateRef(ref)) { salida.set(ref, ref); continue; }
    const guardada = cache.get(ref);
    if (guardada && guardada.expira > ahora) salida.set(ref, guardada.url);
    else porFirmar.push(ref);
  }

  if (porFirmar.length) {
    const rutas = porFirmar.map(refToPath);
    const { data, error } = await supabase.storage
      .from(PRIVATE_BUCKET).createSignedUrls(rutas, TTL_SECONDS);
    if (error) console.error("firmar archivos:", error.message);
    porFirmar.forEach((ref, i) => {
      const firmada = data?.[i]?.signedUrl;
      if (firmada) {
        salida.set(ref, firmada);
        cache.set(ref, { url: firmada, expira: ahora + (TTL_SECONDS - 120) * 1000 });
        return;
      }
      // Sin firma: se sirve la copia pública si todavía existe. No se cachea,
      // para que vuelva a intentar firmar en cuanto el archivo esté migrado.
      salida.set(ref, publicUrlFor(refToPath(ref)));
    });
  }
  return salida;
}

/** Un solo archivo. Para listas usar `resolveFileUrls`: firma todo de una vez. */
export async function resolveFileUrl(ref: string): Promise<string> {
  return (await resolveFileUrls([ref])).get(ref) ?? ref;
}

/** Borra el archivo del bucket que corresponda. Best-effort. */
export async function removeFile(ref: string): Promise<void> {
  if (isPrivateRef(ref)) {
    await supabase.storage.from(PRIVATE_BUCKET).remove([refToPath(ref)]);
    return;
  }
  const path = pathFromPublicUrl(ref);
  if (path) await supabase.storage.from("kokistyle-files").remove([path]);
}
