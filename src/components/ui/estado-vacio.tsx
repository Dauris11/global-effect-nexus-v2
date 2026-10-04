import type { LucideIcon } from "lucide-react";

import { VACIO } from "@/lib/paleta";
import { cn } from "@/lib/utils";

/**
 * Lo que se ve cuando no hay nada. Un icono grande en un círculo gris, qué
 * pasa y —si existe— la acción que lo resuelve. Un vacío sin acción tiene que
 * decir al menos cuándo va a dejar de estarlo.
 */
export function EstadoVacio({
  icono: Icono,
  titulo,
  texto,
  accion,
  className,
}: {
  icono: LucideIcon;
  titulo: string;
  texto?: string;
  accion?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(VACIO.contenedor, className)}>
      <span className={VACIO.icono}>
        <Icono className="size-7" />
      </span>
      <p className={VACIO.titulo}>{titulo}</p>
      {texto && <p className={VACIO.descripcion}>{texto}</p>}
      {accion && <div className="mt-5 flex justify-center">{accion}</div>}
    </div>
  );
}
