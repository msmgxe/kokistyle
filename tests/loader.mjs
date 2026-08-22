// Permite que `node --test` cargue el código de la app tal cual está escrito:
// resuelve los alias `@/…`, las importaciones sin extensión y los dos paquetes
// cuyo mapa de exports no funciona fuera de Next.
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { register } from "node:module";

if (!process.env.__LUX_LOADER__) {
  process.env.__LUX_LOADER__ = "1";
  register("./tests/loader.mjs", pathToFileURL("./"));
}

const local = (rel) => pathToFileURL(process.cwd() + "/" + rel).href;

export async function resolve(spec, ctx, next) {
  // `next/server` no tiene entrada en el mapa de exports para Node puro
  if (spec === "next/server") return next(local("node_modules/next/server.js"), ctx);
  // jsPDF es CommonJS: el import por defecto no da el constructor
  if (spec === "jspdf") return next(local("tests/jspdf-shim.mjs"), ctx);

  if (spec.startsWith("@/")) {
    const base = process.cwd() + "/" + spec.slice(2);
    return next(pathToFileURL(existsSync(base + ".ts") ? base + ".ts" : base).href, ctx);
  }
  if (spec.startsWith(".") && !/\.[a-z]+$/.test(spec)) {
    try { return await next(spec + ".ts", ctx); } catch { /* sigue con el original */ }
  }
  return next(spec, ctx);
}
