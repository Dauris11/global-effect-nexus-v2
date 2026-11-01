"use client";

import { BarChart3, DollarSign, FolderKanban, ListTodo } from "lucide-react";
import { useState } from "react";

import {
  GraficaAnillo,
  GraficaBarras,
  GraficaFlujo,
} from "@/components/dashboard/graficas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChipFiltro } from "@/components/ui/chip-filtro";
import { AZUL, AZUL_OSCURO, AZUL_SUAVE, NEUTRO, PRIORIDAD, PRIORIDADES } from "@/lib/paleta";
import {
  ESTADOS_TAREA_COLABORADOR,
  type EstadoTareaColaborador,
  type PrioridadTarea,
} from "@/lib/torre-control";
import { cn } from "@/lib/utils";

/**
 * Las gráficas de la bandeja. Reciben datos ya consultados y textos ya
 * traducidos (igual que `dashboard/graficas.tsx`): aquí no se lee ningún
 * mensaje, así que no hace falta proveedor de i18n ni viaja el diccionario.
 *
 * Todo en tonos de la marca. El estado de una tarea no es un estado de entidad
 * del semáforo, así que "completada" no se pinta de verde: se distingue por el
 * peso del azul y por la leyenda con su cifra.
 *
 * La interacción es doble: el globo de datos de recharts y el selector que
 * cambia el reparto de las tareas entre prioridad y estado (una sola tarjeta
 * para dos preguntas, en vez de dos anillos casi idénticos).
 */

const COLOR_ESTADO: Record<EstadoTareaColaborador, string> = {
  por_hacer: NEUTRO,
  en_progreso: AZUL,
  en_revision: AZUL_SUAVE,
  completada: AZUL_OSCURO,
};

type Vista = "prioridad" | "estado";

export type DatosGraficasBandeja = {
  /** Prioridad y estado de cada tarea abierta (y las cerradas hace poco). */
  tareas: readonly { prioridad: PrioridadTarea; estado: EstadoTareaColaborador }[] | null;
  flujo: readonly { mes: string; ingresos: number; egresos: number }[] | null;
  /** Avance 0-100 de cada proyecto en marcha. */
  proyectos: readonly { nombre: string; avance: number }[] | null;
};

export type EtiquetasGraficasBandeja = {
  porPrioridad: string;
  porEstado: string;
  abiertas: string;
  tareasVacio: string;
  finanzas: string;
  ingresos: string;
  egresos: string;
  finanzasVacio: string;
  proyectos: string;
  proyectosVacio: string;
  prioridades: Record<PrioridadTarea, string>;
  estados: Record<EstadoTareaColaborador, string>;
};

export function GraficasBandeja({
  datos,
  etiquetas,
}: {
  datos: DatosGraficasBandeja;
  etiquetas: EtiquetasGraficasBandeja;
}) {
  const [vista, setVista] = useState<Vista>("prioridad");

  const tareas = datos.tareas ?? [];
  const porPrioridad = PRIORIDADES.map((prioridad) => ({
    nombre: etiquetas.prioridades[prioridad],
    valor: tareas.filter((t) => t.prioridad === prioridad && t.estado !== "completada").length,
    color: PRIORIDAD[prioridad].color,
  }));
  const porEstado = ESTADOS_TAREA_COLABORADOR.map((estado) => ({
    nombre: etiquetas.estados[estado],
    valor: tareas.filter((t) => t.estado === estado).length,
    color: COLOR_ESTADO[estado],
  }));

  const serie = vista === "prioridad" ? porPrioridad : porEstado;
  const total = serie.reduce((suma, fila) => suma + fila.valor, 0);

  const visibles = [datos.tareas, datos.flujo, datos.proyectos].filter((d) => d !== null).length;

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4",
        visibles >= 3 ? "lg:grid-cols-3" : visibles === 2 ? "lg:grid-cols-2" : "",
      )}
    >
      {datos.tareas && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>
              <ListTodo className="size-4" />
              {vista === "prioridad" ? etiquetas.porPrioridad : etiquetas.porEstado}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 flex gap-5">
              <ChipFiltro
                icono={BarChart3}
                etiqueta={etiquetas.porPrioridad}
                activo={vista === "prioridad"}
                onClick={() => setVista("prioridad")}
              />
              <ChipFiltro
                icono={ListTodo}
                etiqueta={etiquetas.porEstado}
                activo={vista === "estado"}
                onClick={() => setVista("estado")}
              />
            </div>

            <GraficaAnillo
              datos={serie}
              total={total}
              etiquetaTotal={vista === "prioridad" ? etiquetas.abiertas : ""}
              vacio={etiquetas.tareasVacio}
            />

            {/* La cifra escrita junto a cada porción: el anillo da la
                proporción y la lista el número que se acaba diciendo en voz alta. */}
            <ul className="mt-3 divide-y divide-linea">
              {serie.map((fila) => (
                <li key={fila.nombre} className="flex items-center gap-2.5 py-2 text-sm">
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
          </CardContent>
        </Card>
      )}

      {datos.flujo && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>
              <DollarSign className="size-4" />
              {etiquetas.finanzas}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GraficaFlujo
              datos={datos.flujo}
              etiquetas={{
                ingresos: etiquetas.ingresos,
                egresos: etiquetas.egresos,
                vacio: etiquetas.finanzasVacio,
              }}
            />
          </CardContent>
        </Card>
      )}

      {datos.proyectos && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>
              <FolderKanban className="size-4" />
              {etiquetas.proyectos}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GraficaBarras
              datos={datos.proyectos.map((p) => ({ nombre: p.nombre, valor: p.avance, color: AZUL }))}
              vacio={etiquetas.proyectosVacio}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
