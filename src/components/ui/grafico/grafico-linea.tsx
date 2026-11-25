"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ContenedorGrafico } from "./contenedor-grafico";
import {
  DURACION_ENTRADA,
  EJE,
  GLOBO,
  LINEA_EJE,
  REJILLA,
  TONO,
  resolverColor,
} from "./tema";
import { useMovimientoReducido } from "./use-movimiento-reducido";

/**
 * Tendencia a lo largo de periodos consecutivos, en línea o en área.
 *
 * Solo para series donde se lee la pendiente (índice por cuatrimestre). Para
 * valores sueltos —un mes, una materia— son barras. El dominio se fija desde
 * fuera: con eje automático dos estudiantes con la misma historia dibujarían
 * curvas distintas.
 */
export function GraficoLinea({
  datos,
  claveX,
  claveY,
  nombreSerie,
  etiqueta,
  vacio,
  area = false,
  color,
  dominio,
  marcas,
  referencia,
  altura = 200,
  formato = (n) => String(n),
}: {
  datos: readonly Record<string, string | number>[];
  claveX: string;
  claveY: string;
  nombreSerie: string;
  etiqueta: string;
  vacio: string;
  area?: boolean;
  color?: string;
  dominio?: readonly [number, number];
  marcas?: readonly number[];
  /** Límite que se dibuja siempre, a rayas: es una referencia, no un dato. */
  referencia?: { valor: number; etiqueta: string };
  altura?: number;
  formato?: (valor: number) => string;
}) {
  const reducido = useMovimientoReducido();
  const trazo = resolverColor(color, 0);
  const margen = { top: 8, right: 8, left: -12, bottom: 0 };

  const ejes = (
    <>
      <CartesianGrid {...REJILLA} />
      <XAxis dataKey={claveX} tick={EJE} axisLine={LINEA_EJE} tickLine={false} />
      <YAxis
        tick={EJE}
        axisLine={false}
        tickLine={false}
        width={44}
        domain={dominio ? [...dominio] : undefined}
        ticks={marcas ? [...marcas] : undefined}
        tickFormatter={(v: number) => formato(v)}
      />
      <Tooltip
        {...GLOBO}
        formatter={(valor) => [typeof valor === "number" ? formato(valor) : "—", nombreSerie]}
      />
      {referencia && (
        <ReferenceLine
          y={referencia.valor}
          stroke={TONO.tinta}
          strokeDasharray="4 4"
          strokeOpacity={0.5}
          label={{
            value: referencia.etiqueta,
            position: "insideBottomRight",
            fontSize: 10,
            fill: "var(--tinta-3)",
          }}
        />
      )}
    </>
  );

  const comunes = {
    type: "monotone" as const,
    dataKey: claveY,
    name: nombreSerie,
    stroke: trazo,
    strokeWidth: 2,
    // El punto se dibuja siempre: con dos periodos, una línea sin puntos no dice
    // dónde están las medidas y dónde la interpolación.
    dot: { r: 3, fill: trazo, strokeWidth: 0 },
    activeDot: { r: 5 },
    isAnimationActive: !reducido,
    animationDuration: DURACION_ENTRADA,
  };

  return (
    <ContenedorGrafico
      etiqueta={etiqueta}
      vacio={vacio}
      hayDatos={datos.length > 0}
      altura={altura}
      tabla={{
        columnas: [etiqueta, nombreSerie],
        filas: datos.map((f) => [String(f[claveX]), formato(Number(f[claveY]))]),
      }}
    >
      {area ? (
        <AreaChart data={[...datos]} margin={margen}>
          {ejes}
          {/* Relleno plano con opacidad, no degradado: la norma los prohíbe. */}
          <Area {...comunes} fill={trazo} fillOpacity={0.15} />
        </AreaChart>
      ) : (
        <LineChart data={[...datos]} margin={margen}>
          {ejes}
          <Line {...comunes} />
        </LineChart>
      )}
    </ContenedorGrafico>
  );
}
