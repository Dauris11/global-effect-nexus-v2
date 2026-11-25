"use client";

import { BarChart3 } from "lucide-react";
import { ResponsiveContainer } from "recharts";

import { EstadoVacio } from "@/components/ui/estado-vacio";
import { cn } from "@/lib/utils";

import { LeyendaGrafico, type ItemLeyenda } from "./leyenda-grafico";

/** Tabla equivalente del gráfico, solo para lectores de pantalla. */
export type TablaAlternativa = {
  columnas: readonly string[];
  filas: readonly (readonly (string | number)[])[];
};

/**
 * Envoltorio común de todos los gráficos: altura, estado vacío, nombre
 * accesible y alternativa en tabla.
 *
 * El SVG de Recharts no dice nada a un lector de pantalla, así que el dibujo va
 * como `role="img"` con su `aria-label` y, al lado, una tabla `sr-only` con las
 * mismas cifras. Recibe los textos ya traducidos: no lee mensajes.
 */
export function ContenedorGrafico({
  etiqueta,
  vacio,
  hayDatos,
  altura = 220,
  tabla,
  leyenda,
  className,
  children,
}: {
  /** Qué muestra el gráfico, para `aria-label`. */
  etiqueta: string;
  /** Texto del estado vacío, ya traducido. */
  vacio: string;
  hayDatos: boolean;
  altura?: number;
  tabla?: TablaAlternativa;
  leyenda?: readonly ItemLeyenda[];
  className?: string;
  children: React.ReactElement;
}) {
  if (!hayDatos) {
    return (
      <div
        className={cn("flex items-center justify-center", className)}
        style={{ minHeight: altura }}
      >
        <EstadoVacio icono={BarChart3} titulo={vacio} className="py-6" />
      </div>
    );
  }

  return (
    <div className={className}>
      <div role="img" aria-label={etiqueta} style={{ height: altura }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>

      {leyenda && leyenda.length > 0 && <LeyendaGrafico items={leyenda} className="mt-2" />}

      {tabla && (
        <table className="sr-only">
          <caption>{etiqueta}</caption>
          <thead>
            <tr>
              {tabla.columnas.map((columna, i) => (
                <th key={`${i}-${columna}`} scope="col">
                  {columna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabla.filas.map((fila, i) => (
              <tr key={i}>
                {fila.map((celda, j) => (
                  <td key={j}>{celda}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
