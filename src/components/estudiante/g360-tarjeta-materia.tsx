import {
  CircleCheck,
  CircleDashed,
  GraduationCap,
  Hourglass,
  PlayCircle,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Una materia de Global Effect 360, como tarjeta de anuncio.
 *
 * Sale de la página para que la página quede por debajo de 300 líneas, y
 * porque es la pieza que se repite en las dos listas (dadas y por dar).
 *
 * La materia no tiene foto, así que el hueco de la foto (`aspect-[4/3]`
 * `rounded-card` `bg-muted`) lleva un icono grande en círculo. Se mantiene el
 * hueco y no una fila compacta para que la lista se lea como el resto de
 * entidades del portal: estado arriba a la izquierda, nombre, una línea.
 *
 * Recibe los textos ya traducidos: la página tiene el único `t` del espacio
 * `global360`.
 */

/**
 * Situación de la materia: peso del azul y un icono por situación. "Dada" es
 * lo más pesado del azul; "hay que repetirla" va en tinta, que es lo que pide
 * actuar sin salirse de la marca.
 *
 * "Por dar" va en blanco sobre el gris del hueco: el gris neutro de siempre
 * (`bg-muted`) desaparecería encima de un fondo del mismo gris.
 */
const SITUACION: Record<string, { clases: string; icono: LucideIcon }> = {
  aprobada: { clases: "bg-marca-700 text-white", icono: CircleCheck },
  cursando: { clases: "bg-marca-50 text-marca-700", icono: PlayCircle },
  prematriculada: { clases: "bg-marca-50 text-marca-700", icono: Hourglass },
  reprobada: { clases: "bg-tinta text-background", icono: RotateCcw },
  pendiente: { clases: "bg-background text-tinta-2", icono: CircleDashed },
};

export type MateriaG360 = {
  id: string;
  nombre: string;
  codigo: string | null;
  obligatoria: boolean;
  creditos: number;
  situacion: string;
  periodo: string | null;
};

export function TarjetaMateriaG360({
  materia,
  situacion,
  detalle,
  acciones,
}: {
  materia: MateriaG360;
  /** La situación ya traducida. */
  situacion: string;
  /** "Obligatoria · 3 cr · 2026-I", ya traducido. */
  detalle: string;
  acciones?: React.ReactNode;
}) {
  const visual = SITUACION[materia.situacion] ?? SITUACION.pendiente;
  const IconoSituacion = visual.icono;

  return (
    <article className="flex h-full flex-col">
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-card bg-muted">
        {/* La obligatoria lleva el icono en el azul de la marca: es la que no
            se puede esquivar. La opcional, en gris. */}
        <span
          className={cn(
            "flex size-16 items-center justify-center rounded-full bg-background shadow-card",
            materia.obligatoria ? "text-marca-600" : "text-tinta-2",
          )}
        >
          <GraduationCap className="size-7" aria-hidden />
        </span>

        <Badge className={cn("absolute top-3 left-3 shadow-card", visual.clases)}>
          <IconoSituacion aria-hidden />
          {situacion}
        </Badge>
      </div>

      <p className="texto-titulo-tarjeta mt-3 line-clamp-2">{materia.nombre}</p>
      <p className="truncate text-sm text-tinta-2">{detalle}</p>

      {acciones && <div className="mt-3">{acciones}</div>}
    </article>
  );
}
