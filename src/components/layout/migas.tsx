"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { usePermisos } from "@/components/layout/proveedor-permisos";
import { Link, usePathname } from "@/i18n/navigation";
import { esRutaActiva, migasDeRuta } from "@/lib/nav";
import type { Rol } from "@/lib/rbac";

/**
 * Dónde se muestran las migas: el módulo administrativo y Global Effect 360, en
 * el lado del personal, del docente y del estudiante. El resto de módulos las
 * recibirá cuando se revise su interfaz.
 */
const AREAS_CON_MIGAS = new Set(["operaciones", "global360"]);
const RUTAS_360 = [
  "/portal/estudiante/global-360",
  "/portal/estudiante/aula-virtual",
  "/portal/estudiante/prematricula",
  "/portal/profesor",
];

function enAmbito(area: string, ruta: string): boolean {
  return AREAS_CON_MIGAS.has(area) || RUTAS_360.some((base) => esRutaActiva(ruta, base));
}

/**
 * Migas de pan: Área › Sección › Pantalla (› Detalle). Salen del mismo menú que
 * la barra lateral, así que no hay otra lista que mantener y una pantalla que
 * la persona no puede abrir tampoco aparece aquí.
 *
 * Se pintan en el armazón y no en cada página: son cincuenta pantallas y una
 * miga olvidada rompería la uniformidad. Solo en escritorio; en el móvil la
 * barra inferior ya dice dónde se está.
 */
export function Migas({ rol }: { rol: Rol }) {
  const t = useTranslations("nav");
  const ruta = usePathname();
  const miga = migasDeRuta(rol, ruta, usePermisos());

  if (!miga || !enAmbito(miga.area.clave, ruta)) return null;

  const { area, seccion, item, esDetalle } = miga;
  // La sección que se llama como el área no añade nada.
  const tramos: { texto: string; href?: string }[] = [{ texto: t(area.etiqueta as never) }];
  if (seccion.etiqueta && seccion.etiqueta !== area.etiqueta) {
    tramos.push({ texto: t(seccion.etiqueta as never) });
  }
  tramos.push({ texto: t(item.etiqueta as never), href: esDetalle ? item.href : undefined });
  if (esDetalle) tramos.push({ texto: t("breadcrumbDetail") });

  return (
    <nav aria-label={t("breadcrumbLabel")} className="mb-4 hidden md:block">
      <ol className="texto-meta flex flex-wrap items-center gap-1">
        {tramos.map((tramo, indice) => {
          const ultimo = indice === tramos.length - 1;

          return (
            <li key={`${tramo.texto}-${indice}`} className="flex items-center gap-1">
              {tramo.href ? (
                <Link href={tramo.href} className="hover:text-marca-600">
                  {tramo.texto}
                </Link>
              ) : (
                <span aria-current={ultimo ? "page" : undefined} className={ultimo ? "text-tinta" : undefined}>
                  {tramo.texto}
                </span>
              )}
              {!ultimo && <ChevronRight className="size-3.5" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
