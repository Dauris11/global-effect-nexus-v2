"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { useTranslations } from "next-intl";

import { CajonAccionesRapidas } from "@/components/layout/cajon-acciones-rapidas";
import { useOcultos, usePermisos } from "@/components/layout/visibilidad";
import { Link, usePathname } from "@/i18n/navigation";
import { esRutaActiva, pestanasMoviles, type PestanaMovil } from "@/lib/nav";
import type { Rol } from "@/lib/rbac";
import { cn } from "@/lib/utils";

/**
 * Pestañas fijas abajo, solo en el móvil (docs/09-sistema-visual.md §3).
 *
 * Ofrece una experiencia completamente nativa en teléfonos móviles:
 * - 4 destinos clave + botón central táctil de acciones rápidas elevadas (Zap).
 * - Menú "Más" como hoja lateral completa.
 * - Soporte de áreas seguras (safe-area-inset-bottom) para iPhones modernos.
 */
export function BarraInferior({
  rol,
  menuAbierto,
  onAbrirMenu,
}: {
  rol: Rol;
  menuAbierto: boolean;
  onAbrirMenu: () => void;
}) {
  const [accionesRapidasAbiertas, setAccionesRapidasAbiertas] = useState(false);
  const t = useTranslations("nav");
  const tRapidas = useTranslations("accesoRapido");
  const ruta = usePathname();
  const ocultos = useOcultos();
  const permisos = usePermisos();
  const pestanas = pestanasMoviles(rol, ocultos, permisos);

  const activa = pestanas
    .filter((p) => p.tipo === "enlace" && esRutaActiva(ruta, p.href))
    .sort((a, b) =>
      a.tipo === "enlace" && b.tipo === "enlace" ? b.href.length - a.href.length : 0,
    )[0];

  // Distribuir en 5 ranuras con el botón de acción rápida en el centro
  const p0 = pestanas[0];
  const p1 = pestanas[1];
  const p2 = pestanas[2];
  const pMas = pestanas.find((p) => p.tipo === "mas") ?? pestanas[pestanas.length - 1];

  const renderItem = (pestana: PestanaMovil | undefined, clave: string) => {
    if (!pestana) return <li key={clave} />;
    const Icono = pestana.icono;
    const esActiva = pestana.tipo === "mas" ? menuAbierto : pestana === activa;
    const clases = cn(
      "group flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transicion-control outline-none focus-visible:bg-muted active:scale-95",
      esActiva ? "text-marca-500 font-bold" : "text-tinta-2",
    );
    const contenido = (
      <>
        {/* La pestaña activa sube el icono 2 px: se nota el cambio sin que nada
            salte, y en grises sigue leyéndose por el peso del texto. */}
        <Icono
          className={cn(
            "size-5 transition-transform duration-(--duracion-media) ease-salida",
            esActiva && "-translate-y-0.5",
          )}
        />
        <span className="max-w-full truncate px-1">{t(pestana.etiqueta)}</span>
      </>
    );

    return (
      <li key={clave} className="flex h-full items-center justify-center">
        {pestana.tipo === "enlace" ? (
          <Link
            href={pestana.href}
            prefetch
            aria-current={esActiva ? "page" : undefined}
            className={clases}
          >
            {contenido}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAbrirMenu}
            aria-expanded={menuAbierto}
            className={cn(clases, "w-full")}
          >
            {contenido}
          </button>
        )}
      </li>
    );
  };

  return (
    <>
      <nav
        aria-label={t("mainNav")}
        className="bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t border-linea pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <ul className="grid h-16 grid-cols-5 items-center">
          {/* Ranura 1: Inicio */}
          {renderItem(p0, "slot-0")}

          {/* Ranura 2: Módulo 1 */}
          {renderItem(p1, "slot-1")}

          {/* Ranura 3 (Central): Botón de Acción Rápida Elevado */}
          <li className="relative flex h-full items-center justify-center">
            <button
              type="button"
              onClick={() => setAccionesRapidasAbiertas(true)}
              aria-label={tRapidas("open")}
              className="group -mt-4 flex size-12 flex-col items-center justify-center rounded-full bg-marca-500 text-white shadow-elevada hover:bg-marca-600 transicion-control active:scale-90 focus-visible:ring-2 focus-visible:ring-marca-500"
            >
              <Zap className="size-6 transition-transform duration-(--duracion-rapida) ease-salida group-active:rotate-12" />
            </button>
          </li>

          {/* Ranura 4: Módulo 2 */}
          {renderItem(p2, "slot-2")}

          {/* Ranura 5: Menú Más */}
          {renderItem(pMas, "slot-mas")}
        </ul>
      </nav>

      <CajonAccionesRapidas
        abierto={accionesRapidasAbiertas}
        onCerrar={() => setAccionesRapidasAbiertas(false)}
        rol={rol}
      />
    </>
  );
}
