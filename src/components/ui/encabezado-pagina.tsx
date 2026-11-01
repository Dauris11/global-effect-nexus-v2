import { cn } from "@/lib/utils";

/**
 * La cabecera de cada página: título grande, subtítulo gris y las acciones a
 * la derecha. En el móvil las acciones bajan debajo del texto en vez de
 * apretarlo.
 *
 * El título vive aquí, dentro de la página, y no en la barra superior: allí
 * acababa en `text-xs` en el teléfono, que es ilegible.
 *
 * `subtitulo` se acepta y no se pinta: el panel interno va sin subtítulos
 * (decisión de oct 2026), y quitarlo aquí evita tocar las cincuenta pantallas
 * que lo pasan. Si vuelve, basta con restaurar el párrafo.
 */
export function EncabezadoPagina({
  titulo,
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
      </div>
      {acciones && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{acciones}</div>
      )}
    </header>
  );
}
