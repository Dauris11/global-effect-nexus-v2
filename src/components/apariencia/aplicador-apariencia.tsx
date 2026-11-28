"use client";

import { useEffect } from "react";

import { usePathname } from "next/navigation";
import { aplicarApariencia, leerApariencia } from "@/lib/apariencia";

/**
 * Aplica la apariencia guardada y, con «Sistema», la mantiene al día cuando el aparato cambia
 * de claro a oscuro. El primer pintado lo hace el script del `<head>` (sin destello).
 */
export function AplicadorApariencia() {
  const ruta = usePathname();

  useEffect(() => {
    aplicarApariencia(leerApariencia());

    const sistema = window.matchMedia("(prefers-color-scheme: dark)");
    const alCambiar = () => {
      const guardada = leerApariencia();

      if (guardada.tema === "sistema") aplicarApariencia(guardada);
    };

    sistema.addEventListener("change", alCambiar);

    return () => sistema.removeEventListener("change", alCambiar);
    // Cambiar de ruta vuelve a aplicar: entrar o salir de la página pública cambia el modo.
  }, [ruta]);

  return null;
}
