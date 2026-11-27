import { MigasDeDetalle, PestanasModulo, TituloPagina } from "@/components/layout/pestanas-modulo";
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
  acciones,
  className,
}: {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  /** Ya no se pinta: sin eyebrows encima del título (docs/ux-rules.md §10). Se acepta para no tocar las pantallas que lo pasan. */
  antetitulo?: React.ReactNode;
  acciones?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="space-y-4">
      <MigasDeDetalle />
      <header
        className={cn(
          "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
          className,
        )}
      >
        <div className="min-w-0">
          <TituloPagina className="texto-titulo-pagina">{titulo}</TituloPagina>
        </div>
        {acciones && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{acciones}</div>
        )}
      </header>
      <PestanasModulo />
    </div>
  );
}
