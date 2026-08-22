// jsPDF se publica como CommonJS: en Node el import por defecto no entrega el
// constructor. Este puente lo expone como lo espera el código de la app.
import { createRequire } from "node:module";
const mod = createRequire(import.meta.url)("jspdf");
export default mod.jsPDF ?? mod;
export const jsPDF = mod.jsPDF ?? mod;
