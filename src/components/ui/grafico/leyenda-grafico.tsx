import { cn } from "@/lib/utils";

import { resolverColor } from "./tema";

export type ItemLeyenda = {
  nombre: string;
  color?: string;
  /** Cifra escrita junto al nombre: el dibujo da la proporción, esto el número. */
  valor?: number | string;
};

/**
 * Leyenda común. El punto de color va con el nombre y, si hay, la cifra; así la
 * lectura no depende solo del color (que en grises se confunde).
 */
export function LeyendaGrafico({
  items,
  className,
  enLista = false,
}: {
  items: readonly ItemLeyenda[];
  className?: string;
  /** Filas con separador, para un anillo con su desglose al lado. */
  enLista?: boolean;
}) {
  return (
    <ul
      className={cn(
        enLista ? "divide-y divide-linea" : "flex flex-wrap gap-x-4 gap-y-1.5",
        className,
      )}
    >
      {items.map((item, i) => (
        <li
          key={item.nombre}
          className={cn("flex items-center gap-2 text-sm text-tinta-2", enLista && "py-2")}
        >
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: resolverColor(item.color, i) }}
          />
          <span className={cn(enLista && "flex-1")}>{item.nombre}</span>
          {item.valor !== undefined && (
            <span className="font-semibold text-tinta tabular-nums">{item.valor}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
