"use client";

import { useCallback, useRef, useState } from "react";

// Algunos Android (MIUI) descartan showPicker()/click() sin error ni diálogo.
// Cuando un picker abre de verdad, la página pierde foco/visibilidad — si eso no
// ocurre, ofrecemos el gestor de archivos (otro componente del sistema) y, si
// tampoco abre, avisamos qué permiso habilitar.
export function useGalleryPicker(onBlocked: () => void) {
  const imgInputRef = useRef<HTMLInputElement>(null); // accept=image/* → Photo Picker
  const anyInputRef = useRef<HTMLInputElement>(null); // sin accept → gestor de archivos
  const [fallbackVisible, setFallbackVisible] = useState(false);

  const watchOpen = useCallback((onNoOpen: () => void) => {
    let opened = false;
    const mark = () => { opened = true; };
    window.addEventListener("blur", mark, { once: true });
    document.addEventListener("visibilitychange", mark, { once: true });
    setTimeout(() => {
      window.removeEventListener("blur", mark);
      document.removeEventListener("visibilitychange", mark);
      if (!opened) onNoOpen();
    }, 900);
  }, []);

  const tryOpen = (el: HTMLInputElement | null) => {
    if (!el) return;
    try { el.showPicker(); } catch { try { el.click(); } catch { /* bloqueado — lo reporta watchOpen */ } }
  };

  const openGallery = useCallback(() => {
    tryOpen(imgInputRef.current);
    watchOpen(() => setFallbackVisible(true));
  }, [watchOpen]);

  const openFileManager = useCallback(() => {
    tryOpen(anyInputRef.current);
    watchOpen(onBlocked);
  }, [watchOpen, onBlocked]);

  const dismissFallback = useCallback(() => setFallbackVisible(false), []);

  return { imgInputRef, anyInputRef, openGallery, openFileManager, fallbackVisible, dismissFallback };
}
