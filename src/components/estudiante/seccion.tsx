import { ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Un bloque de las pantallas del estudiante: título de sección y, si hace
 * falta, un enlace a la derecha.
 *
 * Sustituye a las tarjetas con `CardTitle` que envolvían cada lista. En el
 * lenguaje "app web" las secciones se separan con aire y con línea, no con
 * cajas (docs/09-sistema-visual.md §1.3), y repetir ese encabezado a mano en
 * cinco sitios es la forma de que acaben con cinco tamaños distintos.
 */
export function Seccion({
  titulo,
  accion,
  className,
  children,
}: {
  titulo: React.ReactNode;
  accion?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("min-w-0 space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="texto-titulo-seccion">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  );
}

/** "Ver todas →": enlace de texto con la altura táctil de un botón. */
export function EnlaceSeccion({
  href,
  texto,
}: {
  href: string;
  texto: string;
}) {
  return (
    <Link
      href={href}
      className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-control px-2 text-sm font-semibold text-marca-600 outline-none hover:text-marca-700 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      {texto}
      <ArrowRight className="size-4" />
    </Link>
  );
}

/** Fila de lista: separada por línea, sin caja alrededor. */
export const FILA =
  "flex items-center gap-3 border-b border-linea py-3 last:border-b-0";

/** Icono de una fila, en círculo gris: el acento no lo pone el módulo. */
export const ICONO_FILA =
  "flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-tinta";
