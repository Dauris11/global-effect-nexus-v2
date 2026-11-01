import { DollarSign, ListTodo, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  GraficaAnillo,
  GraficaBarras,
  GraficaFlujo,
} from "@/components/dashboard/graficas";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AZUL, AZUL_OSCURO, NEUTRO, PRIORIDAD, PRIORIDADES } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import type {
  CifrasPanel,
  flujoFinanciero,
  TareasPorPrioridad,
} from "@/server/dashboard/consultas";

type MesFinanciero = Awaited<ReturnType<typeof flujoFinanciero>>[number];

/**
 * Las tres gráficas del panel, cada una en su tarjeta limpia: título, una línea
 * de contexto si hace falta y la gráfica. Sin fondos de color ni cabeceras con
 * cuadro: el dato es lo que pesa.
 *
 * En tres columnas cuando hay finanzas y en dos cuando no, para no dejar un
 * hueco a la derecha al rol que no las ve. `flujo` llega `null` en ese caso:
 * la página ni siquiera lo consulta.
 */
export function GraficasPanel({
  cifras,
  prioridades,
  flujo,
}: {
  cifras: CifrasPanel;
  prioridades: readonly TareasPorPrioridad[];
  flujo: readonly MesFinanciero[] | null;
}) {
  const t = useTranslations("dashboard");

  // Las cuatro prioridades siempre, en su orden, aunque la base no devuelva
  // ninguna de alguna: un anillo que cambia de colores según los datos del día
  // no se puede leer de un vistazo.
  const porPrioridad = PRIORIDADES.map((prioridad) => ({
    clave: prioridad,
    nombre: t(`priority.${prioridad}`),
    valor: prioridades.find((f) => f.prioridad === prioridad)?.total ?? 0,
    color: PRIORIDAD[prioridad].color,
  }));

  const porPrograma = [
    { nombre: t("university"), valor: cifras.universitarios, color: AZUL_OSCURO },
    { nombre: t("g360Students"), valor: cifras.cursando360, color: AZUL },
    { nombre: t("pipeline"), valor: cifras.reclutamiento, color: NEUTRO },
  ];

  return (
    <div className={cn("grid grid-cols-1 gap-4", flujo ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
      {flujo && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>
              <DollarSign className="size-4" />
              {t("financeTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GraficaFlujo
              datos={flujo}
              etiquetas={{
                ingresos: t("income"),
                egresos: t("expenses"),
                vacio: t("noFinance"),
              }}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>
            <ListTodo className="size-4" />
            {t("byPriority")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GraficaAnillo
            datos={porPrioridad}
            total={cifras.tareas}
            etiquetaTotal={t("tasksTotal")}
            vacio={t("tasksEmpty")}
          />

          {/* La leyenda, con la cifra escrita: el anillo da la proporción y la
              lista el número, que es lo que se acaba repitiendo en voz alta. */}
          <ul className="mt-3 divide-y divide-linea">
            {porPrioridad.map((fila) => (
              <li key={fila.clave} className="flex items-center gap-2.5 py-2 text-sm">
                <span
                  aria-hidden
                  className={cn("size-2.5 shrink-0 rounded-full", PRIORIDAD[fila.clave].punto)}
                />
                <span className="flex-1 text-tinta-2">{fila.nombre}</span>
                <span className="font-semibold text-tinta tabular-nums">{fila.valor}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>
            <Users className="size-4" />
            {t("byProgram")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GraficaBarras datos={porPrograma} vacio={t("noData")} />
        </CardContent>
      </Card>
    </div>
  );
}
