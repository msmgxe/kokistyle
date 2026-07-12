// Especialidades de co-workers — canónicas en inglés, con traducción ES por índice.
// La DB siempre guarda el valor en inglés (ver contactos/page.tsx y VoiceFAB.tsx).
export const SPECIALTY_OPTIONS_EN = [
  "Plumbing", "Painting", "Finisher", "Electrical", "Marble",
  "Flooring", "Bathroom", "Handyman", "Helper",
] as const;

export const SPECIALTY_OPTIONS_ES = [
  "Plomería", "Pintura", "Finishero", "Electricidad", "Mármol",
  "Piso", "Baño", "Handyman", "Ayudante",
] as const;

export function specialtyDisplay(en: string, language: string): string {
  const idx = SPECIALTY_OPTIONS_EN.indexOf(en as (typeof SPECIALTY_OPTIONS_EN)[number]);
  if (idx === -1) return en || (language === "es" ? "Sin especialidad" : "No specialty");
  return language === "es" ? SPECIALTY_OPTIONS_ES[idx] : en;
}
