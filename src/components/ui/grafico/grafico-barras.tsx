"use client";

import { useState } from "react";
import { Bar, BarChart, Cell, LabelList, Tooltip, XAxis, YAxis } from "recharts";

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
  // Al pasar sobre una barra, las demás bajan de tono: la mirada se queda en la que se lee.
  const [activa, setActiva] = useState<number | null>(null);
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
        barGap={4}
        margin={enFilas ? { left: 4, right: 36 } : { top: 22, right: 8, left: 8, bottom: 0 }}
        onMouseLeave={() => setActiva(null)}
      >
        {/* Sin rejilla ni eje de valores: cada barra trae su cifra escrita y una pista suave detrás. */}
        {enFilas ? (
          <>
            <XAxis type="number" hide domain={dominio ? [...dominio] : undefined} />
            <YAxis
              type="category"
              dataKey={claveX}
              tick={{ ...EJE, fontSize: 12, fill: "var(--tinta-2)" }}
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
              tick={{ ...EJE, fontSize: 12, fill: "var(--tinta-2)" }}
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              tickFormatter={formatoX}
            />
            <YAxis hide allowDecimals={false} domain={dominio ? [...dominio] : [0, "auto"]} />
          </>
        )}
        <Tooltip
          {...GLOBO}
          cursor={false}
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
            // Píldora completa y una pista detrás: el aspecto de una app, no de una hoja de cálculo.
            radius={enFilas ? 999 : [10, 10, 10, 10]}
            barSize={enFilas ? 14 : series.length > 1 ? 14 : 26}
            background={{ fill: "var(--linea)", fillOpacity: 0.45, radius: enFilas ? 999 : 10 }}
            isAnimationActive={!reducido}
            animationDuration={DURACION_ENTRADA}
            animationEasing="ease-out"
            onMouseEnter={(_, indice) => setActiva(indice)}
          >
            {datos.map((fila, indice) => (
              <Cell
                key={indice}
                fill={resolverColor(colorFila ? colorFila(fila, indice) : serie.color, i)}
                fillOpacity={activa !== null && activa !== indice ? 0.35 : 1}
              />
            ))}
            {series.length === 1 && (
              <LabelList
                dataKey={serie.clave}
                position={enFilas ? "right" : "top"}
                offset={8}
                formatter={(v: unknown) => (typeof v === "number" ? formato(v) : "")}
                style={{ fontSize: 12, fontWeight: 600, fill: "var(--tinta)" }}
              />
            )}
          </Bar>
        ))}
      </BarChart>
    </ContenedorGrafico>
  );
}
