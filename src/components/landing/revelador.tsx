"use client";

import { useReveal } from "@/hooks/use-reveal";

/**
 * Monta `useReveal` una vez para toda la portada. Es un componente aparte porque las secciones son de
 * servidor y un hook necesita un componente cliente; el barrido por `.rv` evita envolver cada sección.
 */
export function Revelador() {
  useReveal();

  return null;
}
