"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { usePermisos, useRol } from "@/components/layout/proveedor-permisos";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, usePathname } from "@/i18n/navigation";
import { accesoDeHref } from "@/lib/nav";
import { ICONO_DE_PESTANA, ICONO_PESTANA_POR_DEFECTO, pestanaActiva } from "@/lib/nav-modulos";
import { tienePermiso, type Permiso } from "@/lib/rbac";

/** La pestaña (y su módulo) de la ruta actual, con los permisos de quien mira. */
function useModuloActual() {
  const ruta = usePathname();
  const rol = useRol();
  const permisos = usePermisos();

  if (!rol) return { ruta, activa: null };
  const puede = (permiso: Permiso) => (permisos ? permisos.has(permiso) : tienePermiso(rol, permiso));

  return { ruta, activa: pestanaActiva(rol, ruta, { acceso: accesoDeHref, puede }) };
}

/**
 * Las pestañas del módulo, debajo del encabezado (docs/ux-rules.md): son las pantallas de siempre, así que
 * cada pestaña es un enlace a su ruta y la activa sale de la URL. Solo aparecen en las pantallas de primer
 * nivel del módulo (no en un detalle, que lleva su migaja de pan) y si el módulo tiene más de una pestaña
 * visible para esta persona.
 */
export function PestanasModulo() {
  const t = useTranslations("nav");
  const { activa } = useModuloActual();

  if (!activa || !activa.exacta || activa.modulo.pestanasVisibles.length < 2) return null;

  return (
    <Tabs value={activa.pestana.href} className="gap-0">
      <TabsList aria-label={t(`m.${activa.modulo.etiqueta}`)}>
        {activa.modulo.pestanasVisibles.map((pest) => {
          const Icono = ICONO_DE_PESTANA[pest.etiqueta] ?? ICONO_PESTANA_POR_DEFECTO;

          return (
            <TabsTrigger key={pest.href} value={pest.href} asChild>
              <Link href={pest.href}>
                <Icono aria-hidden />
                {t(`tab.${pest.etiqueta}`)}
              </Link>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

/**
 * El título de la página es el del menú (ux-rules §12): en una pantalla de primer nivel del módulo lleva el
 * nombre de su pestaña —o el del módulo, si solo tiene una— y no un nombre propio de cada pantalla. En un
 * detalle, en `/inicio` o fuera del menú queda lo que la página pidió.
 */
export function TituloPagina({ className, children }: { className?: string; children: React.ReactNode }) {
  const t = useTranslations("nav");
  const { ruta, activa } = useModuloActual();
  const propio = activa && activa.exacta && ruta !== "/inicio";
  const texto = propio
    ? activa.modulo.pestanasVisibles.length > 1
      ? t(`tab.${activa.pestana.etiqueta}`)
      : t(`m.${activa.modulo.etiqueta}`)
    : null;

  return <h1 className={className}>{texto ?? children}</h1>;
}

/**
 * Migas SOLO en un detalle (3.er nivel): «Estudiantes › Detalle». En una pantalla de primer nivel no hay
 * (ux-rules §10), que es lo que arregla «Administrativo › Resumen › Detalle» en Rendiciones. Las pantallas que
 * conocen el nombre del registro pasan su propio `breadcrumb` y esta no se pinta.
 */
export function MigasDeDetalle() {
  const t = useTranslations("nav");
  const { activa } = useModuloActual();

  if (!activa || activa.exacta) return null;

  return (
    <nav aria-label={t("breadcrumbLabel")}>
      <ol className="text-meta flex flex-wrap items-center gap-1">
        <li className="flex items-center gap-1">
          <Link href={activa.modulo.href} className="hover:text-tinta hover:underline">
            {t(`m.${activa.modulo.etiqueta}`)}
          </Link>
          <ChevronRight aria-hidden className="size-3.5" />
        </li>
        <li aria-current="page" className="text-tinta">
          {t("breadcrumbDetail")}
        </li>
      </ol>
    </nav>
  );
}
