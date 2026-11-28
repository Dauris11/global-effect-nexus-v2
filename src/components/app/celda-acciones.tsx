import { cn } from "@/lib/utils";

/**
 * Última columna de una tabla: las acciones de la fila.
 *
 * Fija a la derecha (`sticky right-0`) para que sea visible aunque la tabla haga scroll
 * horizontal dentro de su contenedor, y con el fondo OPACO de la fila (el `muted/50` del hover
 * dejaría ver las celdas que pasan por debajo). El ancho es el del contenido (`w-px`); la regla
 * es un botón visible como máximo más el menú «⋯» (docs/ux-rules.md §5). `z-10` la deja por
 * encima del botón que cubre la fila entera.
 *
 * La fila debe llevar `group`.
 */
export function CeldaAcciones({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td
      className={cn(
        "sticky right-0 z-10 w-px bg-surface px-2 py-1.5 text-right whitespace-nowrap transition-colors group-hover:bg-muted",
        className,
      )}
    >
      <span className="inline-flex items-center justify-end gap-1">{children}</span>
    </td>
  );
}
