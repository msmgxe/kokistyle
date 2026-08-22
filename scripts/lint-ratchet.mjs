/**
 * Trinquete de lint: la deuda que ya existe se tolera, la nueva no.
 *
 * El proyecto arrastra errores de reglas de React que arreglar de golpe sería
 * arriesgado. En vez de apagarlas o de bloquear todo, se fija una línea base:
 * si el conteo sube, el CI falla; si baja, avisa para bajar la base y que no
 * se pueda volver atrás.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const BASELINE = "lint-baseline.json";

// eslint sale con código 1 cuando hay errores: eso no es un fallo del script,
// es el dato que venimos a medir.
let salida;
try {
  salida = execFileSync("npx", ["eslint", "-f", "json", "."], {
    encoding: "utf8", maxBuffer: 128 * 1024 * 1024,
  });
} catch (err) {
  salida = err.stdout;
  if (!salida) { console.error("no se pudo ejecutar eslint"); process.exit(2); }
}
const resultados = JSON.parse(salida);
const actual = resultados.reduce(
  (acc, f) => ({ errores: acc.errores + f.errorCount, avisos: acc.avisos + f.warningCount }),
  { errores: 0, avisos: 0 },
);

if (process.argv.includes("--save") || !existsSync(BASELINE)) {
  writeFileSync(BASELINE, JSON.stringify(actual, null, 2) + "\n");
  console.log(`línea base guardada: ${actual.errores} errores, ${actual.avisos} avisos`);
  process.exit(0);
}

const base = JSON.parse(readFileSync(BASELINE, "utf8"));
console.log(`lint: ${actual.errores} errores / ${actual.avisos} avisos ` +
            `(base: ${base.errores} / ${base.avisos})`);

if (actual.errores > base.errores || actual.avisos > base.avisos) {
  console.error(
    `\n✖ El lint empeoró. Arregla lo nuevo antes de subir.\n` +
    `  errores ${base.errores} → ${actual.errores}, avisos ${base.avisos} → ${actual.avisos}\n` +
    `  Para ver el detalle: pnpm lint\n`);
  process.exit(1);
}

if (actual.errores < base.errores || actual.avisos < base.avisos) {
  console.log(
    `\n✓ Bajó la deuda. Fija la nueva base para que no se pueda volver atrás:\n` +
    `  node scripts/lint-ratchet.mjs --save\n`);
}
