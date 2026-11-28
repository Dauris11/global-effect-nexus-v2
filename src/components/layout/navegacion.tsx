"use client";

import { useEffect, useRef, useState } from "react";

import { usePermisos, useRol } from "@/components/layout/proveedor-permisos";
import { usePathname } from "@/i18n/navigation";
import { accesoDeHref } from "@/lib/nav";
import { pestanaActiva } from "@/lib/nav-modulos";
import { tienePermiso, type Permiso } from "@/lib/rbac";

/**
 * Comportamiento de navegación del armazón (sin interfaz propia salvo la barra):
 *
 *  · Scroll: al cambiar de pantalla la página vuelve arriba. El que se desplaza es
 *    la ventana (`html`), y Next no la reinicia si el primer elemento de la página
 *    es el encabezado fijo. Al pasar de una pestaña a otra DEL MISMO módulo se
 *    conserva, para comparar pantallas hermanas sin perder el sitio.
 *  · Barra de progreso: línea de 2 px arriba del todo que aparece solo si la
 *    navegación tarda más de 300 ms (si no, parpadearía en cada clic).
 */
const RETRASO_BARRA_MS = 300;

export function Navegacion() {
  const ruta = usePathname();
  const rol = useRol();
  const permisos = usePermisos();
  const anterior = useRef(ruta);
  const [navegando, setNavegando] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (anterior.current === ruta) return;

    const clave = (r: string) => {
      if (!rol) return null;

      const puede = (p: Permiso) => (permisos ? permisos.has(p) : tienePermiso(rol, p));
      const activa = pestanaActiva(rol, r, { acceso: accesoDeHref, puede });

      // Solo las pantallas de primer nivel del módulo son «hermanas»: un detalle no.
      return activa?.exacta ? activa.modulo.etiqueta : null;
    };

    const moduloAntes = clave(anterior.current);
    const hermanas = moduloAntes !== null && moduloAntes === clave(ruta);

    anterior.current = ruta;
    if (!hermanas) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    // La ruta cambió: la navegación terminó.
    setNavegando(false);
  }, [ruta, rol, permisos]);

  // Empieza al hacer clic en un enlace interno que cambia de ruta.
  useEffect(() => {
    const alHacerClic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const enlace = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;

      if (!enlace || enlace.target === "_blank" || enlace.hasAttribute("download")) return;

      const destino = new URL(enlace.href, location.href);

      if (destino.origin !== location.origin) return;
      if (destino.pathname === location.pathname && destino.search === location.search) return;

      setNavegando(true);
    };

    document.addEventListener("click", alHacerClic, true);

    return () => document.removeEventListener("click", alHacerClic, true);
  }, []);

  useEffect(() => {
    if (!navegando) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false);

      return;
    }

    const espera = setTimeout(() => setVisible(true), RETRASO_BARRA_MS);
    // Red de seguridad: un clic que no llega a navegar no deja la barra colgada.
    const limite = setTimeout(() => setNavegando(false), 15_000);

    return () => {
      clearTimeout(espera);
      clearTimeout(limite);
    };
  }, [navegando]);

  if (!visible) return null;

  return (
    <div
      role="progressbar"
      aria-label="Cargando"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-marca-100"
    >
      <div className="barra-progreso h-full w-1/3 bg-marca-500" />
    </div>
  );
}
