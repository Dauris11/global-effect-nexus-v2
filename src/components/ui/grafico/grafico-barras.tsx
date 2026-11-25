"use client";

import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from "recharts";

import { ContenedorGrafico } from "./contenedor-grafico";
import {
  DURACION_ENTRADA,
  EJE,
  GLOBO,
  LINEA_EJE,
  REJILLA,
  resolverColor,
} from "./tema";
import { useMovimientoReducido } from "./use-movimiento-reducido";

export type SerieBarras = {
  /** Campo de cada fila que trae el valor. */
  clave: string;
  /** Nombre ya traducido: sale en el globo y en la leyenda. */
  nombre: string;
  color?: string;
};

/**
 * Barras en columnas (`columnas`) o en filas (`filas`).
 *
 * Filas cuando los nombres son largos: bajo una columna se girarían y girados no
 * se leen. Con una sola serie no hay leyenda; con varias sí. `colorFila` pinta
 * cada barra de un tono distinto (una serie, varias categorías).
 */
export function GraficoBarras({
  datos,
  claveX,
  nombreEjeX,
  series,
  etiqueta,
  vacio,
  orientacion = "columnas",
  altura,
  dominio,
  formato = (n) => String(n),
  formatoX,
  colorFila,
  radioEje = 120,
}: {
  datos: readonly Record<string, string | number>[];
  /** Campo de cada fila que trae la categoría (eje de nombres). */
  claveX: string;
  /** Encabezado de la categoría en la tabla alternativa, ya traducido. */
  nombreEjeX?: string;
  series: readonly SerieBarras[];
  etiqueta: string;
  vacio: string;
  orientacion?: "columnas" | "filas";
  altura?: number;
  dominio?: readonly [number, number];
  formato?: (valor: number) => string;
  formatoX?: (valor: string) => string;
  colorFila?: (fila: Record<string, string | number>, indice: number) => string;
  /** Ancho reservado a los nombres en `filas`. */
  radioEje?: number;
}) {
  const reducido = useMovimientoReducido();
  const enFilas = orientacion === "filas";
  const alto = altura ?? (enFilas ? Math.max(120, datos.length * 40 + 16) : 220);
  const hayDatos = datos.some((fila) => series.some((s) => Number(fila[s.clave]) > 0));

  return (
    <ContenedorGrafico
      etiqueta={etiqueta}
      vacio={vacio}
      hayDatos={hayDatos}
      altura={alto}
      leyenda={series.length > 1 ? series.map((s, i) => ({ nombre: s.nombre, color: resolverColor(s.color, i) })) : undefined}
      tabla={{
        columnas: [nombreEjeX ?? etiqueta, ...series.map((s) => s.nombre)],
        filas: datos.map((fila) => [String(fila[claveX]), ...series.map((s) => formato(Number(fila[s.clave])))]),
      }}
    >
      <BarChart
        data={[...datos]}
        layout={enFilas ? "vertical" : "horizontal"}
        barGap={2}
        margin={enFilas ? { left: 4, right: 12 } : { top: 8, right: 8, left: -12, bottom: 0 }}
      >
        <CartesianGrid {...REJILLA} vertical={enFilas} horizontal={!enFilas} />
        {enFilas ? (
          <>
            <XAxis type="number" hide domain={dominio ? [...dominio] : undefined} />
            <YAxis
              type="category"
              dataKey={claveX}
              tick={EJE}
              axisLine={false}
              tickLine={false}
              width={radioEje}
              tickFormatter={formatoX}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey={claveX}
              tick={EJE}
              axisLine={LINEA_EJE}
              tickLine={false}
              tickFormatter={formatoX}
            />
            <YAxis
              tick={EJE}
              axisLine={false}
              tickLine={false}
              width={44}
              allowDecimals={false}
              domain={dominio ? [...dominio] : undefined}
              tickFormatter={(v: number) => formato(v)}
            />
          </>
        )}
        <Tooltip
          {...GLOBO}
          formatter={(valor, nombre) => [
            typeof valor === "number" ? formato(valor) : "—",
            String(nombre ?? ""),
          ]}
        />
        {series.map((serie, i) => (
          <Bar
            key={serie.clave}
            dataKey={serie.clave}
            name={serie.nombre}
            fill={resolverColor(serie.color, i)}
            radius={enFilas ? [0, 6, 6, 0] : [5, 5, 0, 0]}
            barSize={enFilas ? 18 : undefined}
            isAnimationActive={!reducido}
            animationDuration={DURACION_ENTRADA}
          >
            {colorFila &&
              datos.map((fila, indice) => (
                <Cell key={indice} fill={resolverColor(colorFila(fila, indice), indice)} />
              ))}
          </Bar>
        ))}
      </BarChart>
    </ContenedorGrafico>
  );
}
