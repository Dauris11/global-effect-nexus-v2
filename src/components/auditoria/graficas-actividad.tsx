"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AZUL, AZUL_OSCURO, GRAFICA } from "@/lib/paleta";

/**
 * Las cuatro gráficas del tablero de actividad.
 *
 * Reciben los datos y los textos ya resueltos por el servidor: aquí no se
 * consulta ni se traduce nada. Barras y no líneas en las cuatro: son recuentos
 * por cubo (hora, día, persona, módulo), y una línea entre dos horas sugiere una
 * continuidad que no existe.
 */

const GLOBO = {
  contentStyle: {
    borderRadius: "var(--radius-control)",
    border: "1px solid var(--linea)",
    background: "var(--card)",
    color: "var(--tinta)",
    fontSize: 13,
    padding: "8px 12px",
    boxShadow: "var(--shadow-elevada)",
  },
  labelStyle: { fontWeight: 600, color: "var(--tinta)", marginBottom: 2 },
  cursor: { fill: GRAFICA.rejilla, fillOpacity: 0.5 },
} as const;

const REJILLA = { vertical: false, stroke: GRAFICA.rejilla, strokeDasharray: "3 3" } as const;
const EJE = { fontSize: 11, fill: GRAFICA.texto } as const;

export function GraficaPorHora({
  datos,
  etiqueta,
}: {
  datos: readonly { hora: number; eventos: number }[];
  /** Texto del globo: «eventos». */
  etiqueta: string;
}) {
  const filas = datos.map((d) => ({ ...d, nombre: `${String(d.hora).padStart(2, "0")}:00` }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={filas} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid {...REJILLA} />
        <XAxis dataKey="hora" tick={EJE} tickLine={false} axisLine={false} interval={2} />
        <YAxis tick={EJE} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip {...GLOBO} labelFormatter={(_h, p) => p?.[0]?.payload?.nombre ?? ""} formatter={(v) => [v, etiqueta]} />
        <Bar dataKey="eventos" fill={AZUL} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficaPorDia({
  datos,
  etiqueta,
}: {
  datos: readonly { dia: string; eventos: number }[];
  etiqueta: string;
}) {
  // «2026-10-24» → «24/10»: el año no ayuda a leer una semana.
  const filas = datos.map((d) => ({ ...d, corto: `${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}` }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={filas} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid {...REJILLA} />
        <XAxis dataKey="corto" tick={EJE} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={EJE} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip {...GLOBO} formatter={(v) => [v, etiqueta]} />
        <Bar dataKey="eventos" fill={AZUL_OSCURO} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Barras horizontales: los nombres largos no caben bajo una columna. */
export function GraficaHorizontal({
  datos,
  etiqueta,
}: {
  datos: readonly { nombre: string; eventos: number }[];
  etiqueta: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, datos.length * 34 + 20)}>
      <BarChart data={[...datos]} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
        <CartesianGrid {...REJILLA} horizontal={false} vertical />
        <XAxis type="number" tick={EJE} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="nombre" tick={EJE} tickLine={false} axisLine={false} width={120} />
        <Tooltip {...GLOBO} formatter={(v) => [v, etiqueta]} />
        <Bar dataKey="eventos" fill={AZUL} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
