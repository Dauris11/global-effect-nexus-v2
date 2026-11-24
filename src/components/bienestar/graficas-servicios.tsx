"use client";

import { GraficaAnillo, GraficaBarras } from "@/components/dashboard/graficas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AZUL, AZUL_OSCURO, AZUL_SUAVE } from "@/lib/paleta";

export function GraficasServicios({
  alDia,
  conPendientes,
  porcentajes,
  etiquetas,
}: {
  alDia: number;
  conPendientes: number;
  porcentajes: {
    servicio: number;
    reunion: number;
    carta: number;
  };
  etiquetas: {
    tituloBalance: string;
    tituloRequisitos: string;
    alDia: string;
    conPendientes: string;
    servicio: string;
    reunion: string;
    carta: string;
    vacio: string;
  };
}) {
  const total = alDia + conPendientes;
  if (total === 0) return null;

  const serieBalance = [
    { nombre: etiquetas.alDia, valor: alDia, color: AZUL },
    { nombre: etiquetas.conPendientes, valor: conPendientes, color: AZUL_OSCURO },
  ];

  const serieRequisitos = [
    { nombre: etiquetas.servicio, valor: porcentajes.servicio, color: AZUL },
    { nombre: etiquetas.reunion, valor: porcentajes.reunion, color: AZUL_OSCURO },
    { nombre: etiquetas.carta, valor: porcentajes.carta, color: AZUL_SUAVE },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2 print:hidden">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{etiquetas.tituloBalance}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid items-center gap-3 sm:grid-cols-2">
            <GraficaAnillo
              datos={serieBalance}
              total={total}
              etiquetaTotal=""
              vacio={etiquetas.vacio}
            />
            <ul className="divide-y divide-linea">
              {serieBalance.map((fila) => (
                <li key={fila.nombre} className="flex items-center gap-2 py-1.5 text-xs">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: fila.color }}
                  />
                  <span className="flex-1 text-tinta-2">{fila.nombre}</span>
                  <span className="font-semibold text-tinta tabular-nums">{fila.valor}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{etiquetas.tituloRequisitos}</CardTitle>
        </CardHeader>
        <CardContent>
          <GraficaBarras datos={serieRequisitos} vacio={etiquetas.vacio} />
        </CardContent>
      </Card>
    </div>
  );
}
