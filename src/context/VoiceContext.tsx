"use client";
/**
 * VoiceContext — estado global de metadatos de voz.
 * Cada página/tab llama a setMeta() para decirle al VoiceFAB
 * en qué contexto está el usuario (dashboard, workflow, pagos, etc.).
 */
import { createContext, useContext, useState, ReactNode } from "react";

export interface VoiceMeta {
  /** Identifica la pantalla activa, ej: "dashboard", "project.workflow" */
  context: string;
  projectId?: string;
  projectTitle?: string;
  /** Nombres de los contactos asignados (para el campo Responsable/Pagado a) */
  contacts?: string[];
  /** Lista de proyectos activos para que Katy resuelva referencias como "el de Brickell" */
  projects?: { id: string; title: string }[];
}

interface VoiceContextType {
  meta: VoiceMeta;
  setMeta: (m: VoiceMeta) => void;
}

const VoiceContext = createContext<VoiceContextType>({
  meta: { context: "dashboard" },
  setMeta: () => {},
});

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<VoiceMeta>({ context: "dashboard" });
  return (
    <VoiceContext.Provider value={{ meta, setMeta }}>
      {children}
    </VoiceContext.Provider>
  );
}

export const useVoice = () => useContext(VoiceContext);

/**
 * Evento personalizado que el VoiceFAB dispara cuando Claude
 * ha parseado un comando de voz. Las páginas escuchan con:
 *   window.addEventListener("kokivoice", handler)
 */
export interface VoiceAction {
  action: string;
  data: Record<string, unknown>;
  confirmMessage: string;
}

export function dispatchVoiceAction(va: VoiceAction) {
  window.dispatchEvent(new CustomEvent("kokivoice", { detail: va }));
}
