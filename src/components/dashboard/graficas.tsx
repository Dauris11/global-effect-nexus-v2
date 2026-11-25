"use client";

import {
  GraficoAnillo,
  GraficoBarras,
  GraficoLinea,
  TONO,
} from "@/components/ui/grafico";

/**
 * Las gráficas del panel, como adaptadores finos sobre `ui/grafico`.
 *
 * Conservan la firma que ya usan los módulos (datos + textos traducidos) para
 * no tocar veinte pantallas, pero ya no dibujan nada propio: ejes, globo,
 * animación, vacío y accesibilidad viven en el kit y son los mismos para todos.
 */

/**
 * Ingresos y egresos por mes, en barras enfrentadas.
 *
 * Barras y no líneas: son doce valores sueltos por serie, no una tendencia
 * continua, y una línea entre dos meses sugiere que hubo algo en medio.
 */
export function GraficaFlujo({
  datos,
  etiquetas,
}: {
  datos: readonly { mes: string; ingresos: number; egresos: number }[];
  etiquetas: { ingresos: string; egresos: string; vacio: string };
}) {
  return (
    <GraficoBarras
      datos={datos}
      claveX="mes"
      series={[
        { clave: "ingresos", nombre: etiquetas.ingresos, color: TONO.base },
        { clave: "egresos", nombre: etiquetas.egresos, color: TONO.tinta },
      ]}
      etiqueta={`${etiquetas.ingresos} / ${etiquetas.egresos}`}
      vacio={etiquetas.vacio}
      altura={220}
      // El monto con su símbolo y sus miles: "$12,400" y no "12400".
      formato={(n) => `$${n.toLocaleString()}`}
      formatoX={(mes) => mes.slice(5)}
    />
  );
}

/** Reparto en anillo; cada porción trae su color decidido por quien llama. */
export function GraficaAnillo({
  datos,
  total,
  etiquetaTotal,
  vacio,
}: {
  datos: readonly { nombre: string; valor: number; color: string }[];
  total: number;
  etiquetaTotal: string;
  vacio: string;
}) {
  return (
    <GraficoAnillo
      datos={datos}
      etiqueta={etiquetaTotal || datos.map((d) => d.nombre).join(", ")}
      vacio={vacio}
      centro={{ valor: total, etiqueta: etiquetaTotal || undefined }}
    />
  );
}

/** Barras horizontales para pocas categorías de nombre largo. */
export function GraficaBarras({
  datos,
  vacio,
}: {
  datos: readonly { nombre: string; valor: number; color?: string }[];
  vacio: string;
}) {
  return (
    <GraficoBarras
      datos={datos}
      claveX="nombre"
      series={[{ clave: "valor", nombre: "" }]}
      etiqueta={datos.map((d) => d.nombre).join(", ") || vacio}
      vacio={vacio}
      orientacion="filas"
      colorFila={(_fila, i) => datos[i]?.color ?? ""}
    />
  );
}

/**
 * Índice académico a lo largo de los cuatrimestres: la única línea del sistema,
 * porque aquí lo que se lee es la pendiente. Eje fijo 0-4 y umbral siempre
 * visible: es la referencia contra la que se lee el resto.
 */
export function GraficaTendencia({
  datos,
  umbral,
  etiquetas,
}: {
  datos: readonly { periodo: string; indice: number; materias: number }[];
  /** Índice por debajo del cual el estudiante entra en prueba académica. */
  umbral: number;
  etiquetas: { indice: string; umbral: string; vacio: string };
}) {
  return (
    <GraficoLinea
      datos={datos}
      claveX="periodo"
      claveY="indice"
      nombreSerie={etiquetas.indice}
      etiqueta={etiquetas.indice}
      vacio={etiquetas.vacio}
      color={TONO.oscuro}
      dominio={[0, 4]}
      marcas={[0, 1, 2, 3, 4]}
      referencia={{ valor: umbral, etiqueta: etiquetas.umbral }}
      formato={(n) => n.toFixed(2)}
    />
  );
}
