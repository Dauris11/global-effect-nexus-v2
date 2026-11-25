"use client";

import { GraficaAnillo, GraficaBarras } from "@/components/dashboard/graficas";
import { LeyendaGrafico } from "@/components/ui/grafico";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AZUL, AZUL_OSCURO, AZUL_SUAVE, NEUTRO } from "@/lib/paleta";

export type SeriePersonalItem = {
  nombre: string;
  valor: number;
};

export function GraficasPersonal({
  cuentas,
  roles,
  etiquetas,
}: {
  cuentas: {
    conAcceso: number;
    sinAcceso: number;
    inactivas: number;
    total: number;
  };
  roles: readonly SeriePersonalItem[];
  etiquetas: {
    tituloCuentas: string;
    tituloRoles: string;
    conAcceso: string;
    sinAcceso: string;
    inactivas: string;
    vacio: string;
  };
}) {
  const serieCuentas = [
    { nombre: etiquetas.conAcceso, valor: cuentas.conAcceso, color: AZUL },
    { nombre: etiquetas.sinAcceso, valor: cuentas.sinAcceso, color: AZUL_SUAVE },
    { nombre: etiquetas.inactivas, valor: cuentas.inactivas, color: NEUTRO },
  ];

  const serieRoles = roles
    .filter((r) => r.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .map((r, idx) => ({
      nombre: r.nombre,
      valor: r.valor,
      color: idx === 0 ? AZUL_OSCURO : AZUL,
    }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{etiquetas.tituloCuentas}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid items-center gap-3 sm:grid-cols-2">
            <GraficaAnillo
              datos={serieCuentas}
              total={cuentas.total}
              etiquetaTotal=""
              vacio={etiquetas.vacio}
            />
            <LeyendaGrafico enLista items={serieCuentas} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{etiquetas.tituloRoles}</CardTitle>
        </CardHeader>
        <CardContent>
          <GraficaBarras datos={serieRoles} vacio={etiquetas.vacio} />
        </CardContent>
      </Card>
    </div>
  );
}
