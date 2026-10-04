import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { StatCard } from "@/components/ui/stat-card";
import { Link } from "@/i18n/navigation";
import type { Rol } from "@/lib/rbac";
import { cn } from "@/lib/utils";

/**
 * Entrada de un portal y su rejilla de accesos (docs/09-sistema-visual.md §4.2).
 *
 * Hasta octubre de 2026 esto era un banner en degradado turquesa con las
 * cifras en blanco encima. El lenguaje "app web" lo sustituye por lo que hace
 * Airbnb al entrar: un saludo grande, un subtítulo gris y una fila de tarjetas
 * blancas con las cifras. Las props no cambian —`rol` e `icono` se aceptan y ya
 * no pintan nada— para que ningún portal tenga que cambiar de firma.
 */

export type KpiPortal = { valor: string; etiqueta: string };

export type AccesoPortal = {
  /** Sin `href` la tarjeta se dibuja apagada: el módulo aún no existe. */
  href?: string;
  icono: React.ComponentType<{ className?: string }>;
  /**
   * @deprecated Era la clase del cuadro de color del icono. El icono va ahora
   * en un círculo gris para todos: el acento no lo pone el módulo.
   */
  color?: string;
  titulo: string;
  texto: string;
  /** Etiqueta de "próximamente" cuando no hay `href`. */
  pendiente?: string;
};

export function BannerPortal({
  titulo,
  subtitulo,
  insignia,
  kpis,
}: {
  /** @deprecated El portal ya no tiene color por rol. */
  rol: Rol;
  /** @deprecated El saludo no lleva icono. */
  icono: React.ComponentType<{ className?: string }>;
  titulo: string;
  subtitulo: string;
  insignia?: string;
  kpis: readonly KpiPortal[];
}) {
  return (
    <section className="animate-fade-in-up space-y-6">
      <EncabezadoPagina titulo={titulo} subtitulo={subtitulo} antetitulo={insignia} />

      {kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {kpis.map((kpi) => (
            <StatCard key={kpi.etiqueta} valor={kpi.valor} etiqueta={kpi.etiqueta} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Accesos del portal como tarjetas grandes: icono en círculo gris arriba,
 * título y una línea. En el móvil van de dos en dos, que es como caben con el
 * pulgar; en escritorio, de tres.
 */
export function AccesosPortal({
  accesos,
}: {
  accesos: readonly AccesoPortal[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
      {accesos.map((acceso) => {
        const cuerpo = (
          <Card
            interactiva={Boolean(acceso.href)}
            className={cn(
              "group h-full p-5",
              !acceso.href && "cursor-default border-dashed opacity-60 shadow-none",
            )}
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-tinta transition-colors group-hover:text-marca-500">
              <acceso.icono className="size-6" />
            </span>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <p className="texto-titulo-tarjeta">{acceso.titulo}</p>
              {acceso.pendiente && <Badge variant="neutra">{acceso.pendiente}</Badge>}
            </div>

            <p className="mt-1 line-clamp-2 text-sm text-tinta-2">{acceso.texto}</p>

            {acceso.href && (
              <ArrowRight className="mt-3 size-4 text-tinta-3 transition-transform group-hover:translate-x-0.5 group-hover:text-tinta" />
            )}
          </Card>
        );

        if (!acceso.href) {
          return <div key={acceso.titulo}>{cuerpo}</div>;
        }

        return (
          <Link
            key={acceso.titulo}
            href={acceso.href}
            prefetch
            className="h-full rounded-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {cuerpo}
          </Link>
        );
      })}
    </div>
  );
}
