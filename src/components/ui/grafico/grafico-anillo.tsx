"use client";

import { Cell, Pie, PieChart, Tooltip } from "recharts";

import { ContenedorGrafico } from "./contenedor-grafico";
import { DURACION_ENTRADA, GLOBO, resolverColor } from "./tema";
import { useMovimientoReducido } from "./use-movimiento-reducido";

export type PorcionAnillo = { nombre: string; valor: number; color?: string };

/**
 * Reparto en anillo. El hueco del centro lleva el total (o un porcentaje), que
 * es el número que se busca primero. Sin leyenda propia: quien lo usa la pone
 * al lado con `LeyendaGrafico enLista`, con las cifras.
 *
 * `activo` / `alPasar` permiten que una lista vecina y el anillo se iluminen
 * juntos: la porción activa queda y las demás se atenúan.
 */
export function GraficoAnillo({
  datos,
  etiqueta,
  vacio,
  centro,
  altura = 200,
  activo = null,
  alPasar,
}: {
  datos: readonly PorcionAnillo[];
  etiqueta: string;
  vacio: string;
  centro?: { valor: React.ReactNode; etiqueta?: string };
  altura?: number;
  activo?: number | null;
  alPasar?: (indice: number | null) => void;
}) {
  const reducido = useMovimientoReducido();
  const porciones = datos.filter((p) => p.valor > 0);
  const hayDatos = porciones.length > 0;

  return (
    <div className="relative">
      <ContenedorGrafico
        etiqueta={etiqueta}
        vacio={vacio}
        hayDatos={hayDatos}
        altura={altura}
        tabla={{
          columnas: [etiqueta],
          filas: porciones.map((p) => [`${p.nombre}: ${p.valor}`]),
        }}
      >
        <PieChart>
          <Pie
            data={porciones.map((p) => ({ ...p }))}
            dataKey="valor"
            nameKey="nombre"
            innerRadius="66%"
            outerRadius="90%"
            paddingAngle={2}
            strokeWidth={0}
            isAnimationActive={!reducido}
            animationDuration={DURACION_ENTRADA}
            onMouseEnter={alPasar ? (_, i) => alPasar(i) : undefined}
            onMouseLeave={alPasar ? () => alPasar(null) : undefined}
          >
            {porciones.map((p, i) => (
              <Cell
                key={p.nombre}
                fill={resolverColor(p.color, i)}
                opacity={activo !== null && activo !== i ? 0.45 : 1}
              />
            ))}
          </Pie>
          <Tooltip {...GLOBO} />
        </PieChart>
      </ContenedorGrafico>

      {hayDatos && centro && (
        // `pointer-events-none` para no robarle el ratón a las porciones.
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[28px] leading-none font-semibold tracking-tight text-tinta">
            {centro.valor}
          </span>
          {centro.etiqueta && <span className="texto-meta mt-1">{centro.etiqueta}</span>}
        </div>
      )}
    </div>
  );
}
