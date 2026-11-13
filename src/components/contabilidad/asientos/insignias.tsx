import {
  Ban,
  CheckCircle2,
  CircleDashed,
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
 * Estado de un asiento: "Sin procesar" o "Procesado" (Observaciones #1).
 * Procesado es estado de entidad aprobado, así que lleva el `SEMAFORO` con
 * su icono; sin procesar va en gris con un círculo punteado (aún no está en
 * los libros, no está mal). Anulado manda sobre lo demás. El reverso se
 * marca aparte: es una corrección, y además puede estar o no procesado.
 *
 * `t` es el traductor de `contab.asientos`.
 */
export function InsigniaEstadoAsiento({
  estado,
  procesado,
  t,
}: {
  estado: EstadoAsiento;
  procesado: boolean;
  t: (clave: string) => string;
}) {
  if (estado === "anulado") {
    return (
      <Badge className={INSIGNIA_SEMAFORO.alerta}>
        <Ban />
        {t("estado.anulado")}
      </Badge>
    );
  }
  return (
    <span className="inline-flex flex-wrap gap-1">
      {procesado ? (
        <Badge className={INSIGNIA_SEMAFORO.dentro}>
          <CheckCircle2 />
          {t("estado.procesado")}
        </Badge>
      ) : (
        <Badge variant="neutra">
          <CircleDashed />
          {t("estado.pendiente")}
        </Badge>
      )}
      {estado === "reverso" && (
        <Badge variant="neutra">
          <Undo2 />
          {t("estado.reverso")}
        </Badge>
      )}
    </span>
  );
}
