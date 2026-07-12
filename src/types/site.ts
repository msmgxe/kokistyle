export interface Bilingual { en: string; es: string }

export interface SiteHero {
  eyebrow?: Partial<Bilingual>;
  title?: Partial<Bilingual>;
  description?: Partial<Bilingual>;
  primaryLabel?: Partial<Bilingual>;
  primaryHref?: string;
  secondaryLabel?: Partial<Bilingual>;
  secondaryHref?: string;
  imageMain?: string;
  imageSecondary?: string;
  focusLabel?: Partial<Bilingual>;
  focusValue?: Partial<Bilingual>;
}

export interface SiteBAItem {
  beforeImg?: string;
  afterImg?: string;
  space?: Partial<Bilingual>;
  city?: string;
}

export interface SiteBeforeAfter {
  eyebrow?: Partial<Bilingual>;
  title?: Partial<Bilingual>;
  description?: Partial<Bilingual>;
  items?: SiteBAItem[];
}

export type SiteSectionKey = "beforeAfter" | "aiDesign" | "process" | "tours" | "reviews" | "faq";
export type SiteVisibility = Partial<Record<SiteSectionKey, boolean>>;

export interface SiteContent {
  hero?: SiteHero;
  beforeAfter?: SiteBeforeAfter;
  visibility?: SiteVisibility;
}

/** Imágenes por defecto (las que hoy están hardcodeadas en las secciones). */
export const SITE_DEFAULTS = {
  heroMain:      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=90",
  heroSecondary: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=700&q=85",
  ba: [
    { before: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=900&q=80",
      after:  "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=85" },
    { before: "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=900&q=80",
      after:  "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=900&q=85" },
  ],
};
