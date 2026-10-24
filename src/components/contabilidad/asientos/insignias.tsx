import {
  Ban,
  CheckCircle2,
  DoorOpen,
  Lock,
  PenLine,
  Repeat,
  SlidersHorizontal,
  Undo2,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { EstadoAsiento, TipoAsiento } from "@/lib/contabilidad/asientos";
import { INSIGNIA_SEMAFORO } from "@/lib/paleta";

/**
 * Piezas puras de la pantalla de asientos, sin "use client": las usan la
 * lista, la ficha y los filtros, todos de servidor.
 */

/** Un icono por tipo, el mismo en los chips del filtro y en la ficha. */
export const ICONO_TIPO: Record<TipoAsiento, LucideIcon> = {
  automatico: Workflow,
  manual: PenLine,
  ajuste: SlidersHorizontal,
  apertura: DoorOpen,
  cierre: Lock,
  recurrente: Repeat,
};

/**
 * Estado de un asiento. Vigente y anulado son estado de entidad, así que
 * llevan el `SEMAFORO` con su icono; el reverso va en gris porque no está
 * bien ni mal: es la corrección de otro.
 */
export function InsigniaEstadoAsiento({
  estado,
  etiqueta,
}: {
  estado: EstadoAsiento;
  etiqueta: string;
}) {
  if (estado === "vigente") {
    return (
      <Badge className={INSIGNIA_SEMAFORO.dentro}>
        <CheckCircle2 />
        {etiqueta}
      </Badge>
    );
  }
  if (estado === "anulado") {
    return (
      <Badge className={INSIGNIA_SEMAFORO.alerta}>
        <Ban />
        {etiqueta}
      </Badge>
    );
  }
  return (
    <Badge variant="neutra">
      <Undo2 />
      {etiqueta}
    </Badge>
  );
}
