"use client";

import { useEffect, useState } from "react";
import { resolveFileUrls } from "@/src/lib/files";

/**
 * Traduce las referencias guardadas en la base a URLs que el navegador puede
 * mostrar: las públicas pasan tal cual y las privadas se firman en lote.
 *
 *   const url = useFileUrls(fotos.map(f => f.url));
 *   <img src={url(foto.url)} />
 */
export function useFileUrls(refs: (string | null | undefined)[]) {
  const [mapa, setMapa] = useState<Map<string, string>>(new Map());
  const clave = refs.filter(Boolean).join("|");

  useEffect(() => {
    let vivo = true;
    resolveFileUrls(clave ? clave.split("|") : [])
      .then(m => { if (vivo) setMapa(m); })
      .catch(() => { /* sin firma se muestra la referencia cruda */ });
    return () => { vivo = false; };
  }, [clave]);

  return (ref?: string | null) => (ref ? mapa.get(ref) ?? ref : "");
}
