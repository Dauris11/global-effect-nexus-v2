"use client";

import { GraficaAnillo, GraficaBarras } from "@/components/dashboard/graficas";
import { LeyendaGrafico } from "@/components/ui/grafico";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AZUL, AZUL_OSCURO, AZUL_SUAVE } from "@/lib/paleta";

export function GraficasSolicitudes({
  resumen,
  tipos,
  etiquetas,
}: {
  resumen: {
    porAtender: number;
    mias: number;
    resueltas: number;
  };
  tipos: readonly { nombre: string; valor: number }[];
  etiquetas: {
    tituloBandeja: string;
    tituloTipos: string;
    porAtender: string;
    mias: string;
    resueltas: string;
    vacio: string;
  };
}) {
  const total = resumen.porAtender + resumen.mias + resumen.resueltas;
  if (total === 0) return null;

  const serieBandeja = [
    { nombre: etiquetas.porAtender, valor: resumen.porAtender, color: AZUL_OSCURO },
    { nombre: etiquetas.mias, valor: resumen.mias, color: AZUL },
    { nombre: etiquetas.resueltas, valor: resumen.resueltas, color: AZUL_SUAVE },
  ];

  const serieTipos = [...tipos]
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 6)
    .map((item, idx) => ({
      nombre: item.nombre,
      valor: item.valor,
      color: idx === 0 ? AZUL_OSCURO : AZUL,
    }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{etiquetas.tituloBandeja}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid items-center gap-3 sm:grid-cols-2">
            <GraficaAnillo
              datos={serieBandeja}
              total={total}
              etiquetaTotal=""
              vacio={etiquetas.vacio}
            />
            <LeyendaGrafico enLista items={serieBandeja} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{etiquetas.tituloTipos}</CardTitle>
        </CardHeader>
        <CardContent>
          <GraficaBarras datos={serieTipos} vacio={etiquetas.vacio} />
        </CardContent>
      </Card>
    </div>
  );
}
