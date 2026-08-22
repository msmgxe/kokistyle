import { test, describe } from "node:test";
import assert from "node:assert/strict";

// `files.ts` arrastra el cliente del navegador, que exige estas variables al
// importarse. Valores de mentira: las pruebas sólo tocan funciones puras.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://ejemplo.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "clave-de-pruebas";

const { refToPath, pathFromPublicUrl, isPrivateRef, privateRef } = await import("@/src/lib/files");

describe("referencias de archivos privados", () => {
  test("refToPath quita el prefijo y la query que arrastraban las portadas", () => {
    // El bug: la portada se guardaba como `…/cover.jpg?v=<timestamp>` y esa
    // query acabó dentro de la referencia, apuntando a una ruta inexistente.
    assert.equal(refToPath("priv:project-photos/abc/cover.jpg?v=1755"), "project-photos/abc/cover.jpg");
    assert.equal(refToPath("priv:notes/1/doc.pdf"), "notes/1/doc.pdf");
  });

  test("pathFromPublicUrl saca la ruta de una URL pública, con o sin query", () => {
    const base = "https://x.supabase.co/storage/v1/object/public/kokistyle-files/";
    assert.equal(pathFromPublicUrl(base + "project-photos/a/cover.jpg?v=99"), "project-photos/a/cover.jpg");
    assert.equal(pathFromPublicUrl(base + "notes/1/con%20espacio.pdf"), "notes/1/con espacio.pdf");
    assert.equal(pathFromPublicUrl("https://otro.sitio/foto.jpg"), null);
  });

  test("distingue una referencia privada de una URL", () => {
    assert.equal(isPrivateRef("priv:algo.jpg"), true);
    assert.equal(isPrivateRef("https://x/algo.jpg"), false);
    assert.equal(isPrivateRef(""), false);
  });

  test("ida y vuelta: ruta → referencia → ruta", () => {
    const ruta = "project-photos/abc/def.jpg";
    assert.equal(refToPath(privateRef(ruta)), ruta);
  });
});
