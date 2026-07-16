import { supabase } from "@/src/lib/supabase";

// Nota de historial en el proyecto (best-effort — nunca bloquea la acción origen).
// Se usa para dejar rastro de envíos de correo (estimate/factura) e ingresos.
export async function addProjectNote(projectId: string, content: string): Promise<void> {
  if (!projectId || !content.trim()) return;
  try {
    await supabase.from("project_notes").insert({ project_id: projectId, content: content.trim(), attachments: [] });
    window.dispatchEvent(new CustomEvent("kokivoice_saved", { detail: { action: "note", projectId } }));
  } catch { /* historial best-effort */ }
}

// Fecha corta local para el texto de la nota (EN: MM/DD/YY · ES: DD/MM/AA)
export function noteDate(language: "en" | "es"): string {
  return new Date().toLocaleDateString(language === "en" ? "en-US" : "es-ES",
    { day: "2-digit", month: "2-digit", year: "2-digit" });
}
