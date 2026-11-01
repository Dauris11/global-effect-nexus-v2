import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";

/**
 * Encabezado de las subpáginas del portal del estudiante.
 *
 * Desde el rediseño "app web" (docs/09-sistema-visual.md §4.1) es un
 * `EncabezadoPagina` como el de cualquier otra pantalla: antetítulo, título
 * grande y subtítulo gris. Se conserva este envoltorio —y su firma— porque lo
 * importan siete subpáginas; cambiarlas todas a la vez para quitar dos props
 * habría sido tocar archivos de otros sin ganar nada.
 */
export function Cabecera({
  titulo,
  acciones,
}: {
  /**
   * @deprecated El icono en cuadro de color era del lenguaje de agosto. Se
   * acepta para no romper a quien lo pasa, pero ya no se pinta: el título no
   * lleva icono.
   */
  icono?: React.ComponentType<{ className?: string }>;
  /** @deprecated Igual que `icono`: un módulo ya no tiene color propio. */
  color?: string;
  /** @deprecated Repetía el módulo: ya no se pinta. */
  eyebrow?: string;
  titulo: string;
  /** @deprecated Una pantalla limpia no explica qué es: ya no se pinta. */
  descripcion?: string;
  /** Botones a la derecha del título (abajo en el móvil). */
  acciones?: React.ReactNode;
}) {
  return (
    <EncabezadoPagina
      titulo={titulo}
      acciones={acciones}
    />
  );
}
