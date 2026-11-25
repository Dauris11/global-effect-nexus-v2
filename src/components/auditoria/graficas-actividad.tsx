"use client";

import { GraficoBarras, TONO } from "@/components/ui/grafico";

/**
 * Las cuatro gráficas del tablero de actividad, como adaptadores del kit
 * `ui/grafico`. Reciben los datos y los textos ya resueltos por el servidor.
 * Barras y no líneas: son recuentos por cubo (hora, día, persona, módulo), y
 * una línea entre dos horas sugiere una continuidad que no existe.
 */

export function GraficaPorHora({
  datos,
  etiqueta,
  vacio,
}: {
  datos: readonly { hora: number; eventos: number }[];
  /** Texto del globo: «eventos». */
  etiqueta: string;
  vacio: string;
}) {
  const filas = datos.map((d) => ({ ...d, nombre: `${String(d.hora).padStart(2, "0")}:00` }));

  return (
    <GraficoBarras
      datos={filas}
      claveX="nombre"
      series={[{ clave: "eventos", nombre: etiqueta, color: TONO.base }]}
      etiqueta={etiqueta}
      vacio={vacio}
      // Cada tres horas: veinticuatro etiquetas no caben en una tarjeta.
      formatoX={(nombre) => (Number(nombre.slice(0, 2)) % 3 === 0 ? nombre.slice(0, 2) : "")}
    />
  );
}

export function GraficaPorDia({
  datos,
  etiqueta,
  vacio,
}: {
  datos: readonly { dia: string; eventos: number }[];
  etiqueta: string;
  vacio: string;
}) {
  // «2026-10-24» → «24/10»: el año no ayuda a leer una semana.
  const filas = datos.map((d) => ({ ...d, corto: `${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}` }));

  return (
    <GraficoBarras
      datos={filas}
      claveX="corto"
      series={[{ clave: "eventos", nombre: etiqueta, color: TONO.oscuro }]}
      etiqueta={etiqueta}
      vacio={vacio}
    />
  );
}

/** Barras horizontales: los nombres largos no caben bajo una columna. */
export function GraficaHorizontal({
  datos,
  etiqueta,
  vacio,
}: {
  datos: readonly { nombre: string; eventos: number }[];
  etiqueta: string;
  vacio: string;
}) {
  return (
    <GraficoBarras
      datos={datos}
      claveX="nombre"
      series={[{ clave: "eventos", nombre: etiqueta, color: TONO.base }]}
      etiqueta={etiqueta}
      vacio={vacio}
      orientacion="filas"
    />
  );
}
