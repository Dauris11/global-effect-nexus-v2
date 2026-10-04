"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import type { TipoEstudiante } from "@/lib/expedientes";
import { esRutaActiva, pestanasMoviles } from "@/lib/nav";
import type { Rol } from "@/lib/rbac";
import { cn } from "@/lib/utils";

/**
 * Pestañas fijas abajo, solo en el móvil (docs/09-sistema-visual.md §3).
 *
 * Es lo que hace que el portal se sienta app en el teléfono: el pulgar llega
 * abajo, no a una hamburguesa arriba a la izquierda. Cinco destinos, y el
 * quinto, "Más", abre el menú completo como hoja inferior (la misma barra
 * lateral, ver `Sidebar`). Qué pestañas salen lo decide `pestanasMoviles` en
 * `nav.ts`, no este componente.
 *
 * `h-16` más el área segura del iPhone: sin ese relleno, la barra queda debajo
 * del indicador de inicio y las etiquetas se tapan.
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
  const t = useTranslations("nav");
  const ruta = usePathname();
  const pestanas = pestanasMoviles(rol, tipoEstudiante);

  // La más específica gana: en "/portal/estudiante/calendario" está activa
  // Calendario, no Inicio, aunque las dos casen como prefijo.
  const activa = pestanas
    .filter((p) => p.tipo === "enlace" && esRutaActiva(ruta, p.href))
    .sort((a, b) =>
      a.tipo === "enlace" && b.tipo === "enlace" ? b.href.length - a.href.length : 0,
    )[0];

  return (
    <nav
      aria-label={t("mainNav")}
      className="bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t border-linea pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="grid h-16 grid-cols-5">
        {pestanas.map((pestana) => {
          const Icono = pestana.icono;
          const esActiva = pestana.tipo === "mas" ? menuAbierto : pestana === activa;
          const clases = cn(
            "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors outline-none focus-visible:bg-muted",
            esActiva ? "text-marca-500" : "text-tinta-2",
          );
          const contenido = (
            <>
              <Icono className="size-6" />
              <span className="max-w-full truncate px-1">{t(pestana.etiqueta)}</span>
            </>
          );

          return (
            <li key={pestana.tipo === "enlace" ? pestana.href : "mas"}>
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
        })}
      </ul>
    </nav>
  );
}
