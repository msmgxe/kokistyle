"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ACCENT_KEY = "luxaris-accent";
const THEME_KEY = "luxaris-theme"; // "dark" | "light" (default)

export const ACCENTS = [
  { id: "luxaris",  label: "Luxaris Teal & Emerald", dab: "#0d9488", desc: "Clásico · Sofisticado · Miami Modern" },
  { id: "azure",    label: "Miami Azure & Sky",      dab: "#0284c7", desc: "Oceanfront · Azul Marino · Fresco" },
  { id: "gold",     label: "Boca Gold & Obsidian",   dab: "#d97706", desc: "Oro Champagne · Ultra Premium" },
  { id: "indigo",   label: "Royal Indigo & Violet",  dab: "#6366f1", desc: "Índigo Real · Arquitectónico" },
  { id: "navy",     label: "Navy Classic",           dab: "#2A4A7F", desc: "Clásico Marina" },
];

function applyAccent(id: string) {
  if (id === "luxaris") document.documentElement.removeAttribute("data-accent");
  else document.documentElement.setAttribute("data-accent", id);
}

function applyTheme(isDark: boolean) {
  if (isDark) document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
}

type ThemeValue = {
  accent: string;
  dark: boolean;
  setAccent: (id: string) => void;
  toggleDark: () => void;
};

const ThemeCtx = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState("luxaris");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      const a = localStorage.getItem(ACCENT_KEY);
      if (a) { setAccentState(a); applyAccent(a); }
    } catch { /* noop */ }
    // El <script> anti-flash del root layout ya fijó data-theme antes del primer
    // paint; aquí solo sincronizamos el estado de React con lo que quedó.
    try { setDark(document.documentElement.getAttribute("data-theme") === "dark"); } catch { /* noop */ }
  }, []);

  const setAccent = (id: string) => {
    setAccentState(id);
    applyAccent(id);
    try { localStorage.setItem(ACCENT_KEY, id); } catch { /* noop */ }
  };

  const toggleDark = () => setDark(d => {
    const n = !d;
    applyTheme(n);
    try { localStorage.setItem(THEME_KEY, n ? "dark" : "light"); } catch { /* noop */ }
    return n;
  });

  return (
    <ThemeCtx.Provider value={{ accent, dark, setAccent, toggleDark }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
