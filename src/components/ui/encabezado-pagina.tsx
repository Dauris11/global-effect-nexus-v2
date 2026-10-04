import { cn } from "@/lib/utils";

/**
 * La cabecera de cada página: título grande, subtítulo gris y las acciones a
 * la derecha. En el móvil las acciones bajan debajo del texto en vez de
 * apretarlo.
 *
 * El título vive aquí, dentro de la página, y no en la barra superior: allí
 * acababa en `text-xs` en el teléfono, que es ilegible.
 */
export function EncabezadoPagina({
  titulo,
  subtitulo,
  antetitulo,
  acciones,
  className,
}: {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  /** Una palabra encima del título, cuando ayuda a situarse (el módulo). */
  antetitulo?: React.ReactNode;
  acciones?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {antetitulo && <p className="texto-meta mb-1 font-medium">{antetitulo}</p>}
        <h1 className="texto-titulo-pagina">{titulo}</h1>
        {subtitulo && (
          <p className="mt-1.5 max-w-2xl text-[15px] text-tinta-2">{subtitulo}</p>
        )}
      </div>
      {acciones && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{acciones}</div>
      )}
    </header>
  );
}
