"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { useTranslations } from "next-intl";

import { CajonAccionesRapidas } from "@/components/layout/cajon-acciones-rapidas";
import { Link, usePathname } from "@/i18n/navigation";
import type { TipoEstudiante } from "@/lib/expedientes";
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
  tipoEstudiante,
  menuAbierto,
  onAbrirMenu,
}: {
  rol: Rol;
  tipoEstudiante: TipoEstudiante | null;
  menuAbierto: boolean;
  onAbrirMenu: () => void;
}) {
  const [accionesRapidasAbiertas, setAccionesRapidasAbiertas] = useState(false);
  const t = useTranslations("nav");
  const ruta = usePathname();
  const pestanas = pestanasMoviles(rol, tipoEstudiante);

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
      "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors outline-none focus-visible:bg-muted active:scale-95",
      esActiva ? "text-marca-500 font-bold" : "text-tinta-2",
    );
    const contenido = (
      <>
        <Icono className="size-5" />
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
              aria-label="Abrir accesos rápidos"
              className="group -mt-4 flex size-12 flex-col items-center justify-center rounded-full bg-linear-to-br from-marca-500 to-marca-700 text-white shadow-lg shadow-marca-500/40 transition-all active:scale-90 focus-visible:ring-2 focus-visible:ring-marca-500"
            >
              <Zap className="size-6 transition-transform group-hover:scale-110" />
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
