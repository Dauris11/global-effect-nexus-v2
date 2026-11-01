import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, FolderKanban, Layers, ListTodo } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import {
  usuarioTienePermiso,
} from "@/lib/rbac";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { EquipoProyecto } from "@/components/operaciones/equipo-proyecto";
import { LineaTiempo } from "@/components/linea-tiempo/linea-tiempo";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { moverBarra } from "@/server/calendario/acciones-gantt";
import { hoyEnLaBase } from "@/server/calendario/gantt";
import { esIncoherente, tramoDe, type SeccionTiempo } from "@/lib/linea-tiempo";
import { usuariosAsignables } from "@/server/operaciones/consultas";
import { proyectoParaGantt } from "@/server/operaciones/gantt-consultas";
import { equipoDeProyecto } from "@/server/operaciones/torre-consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const proyecto = await proyectoParaGantt(id);
  if (!proyecto) return { title: "Proyecto no encontrado" };

  return { title: `Gantt: ${proyecto.nombre} · Global Effect Nexus` };
}

export default async function PaginaDetalleProyectoGantt({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await requerirPermiso("operaciones.leer");
  const puedeEditar = usuarioTienePermiso(usuario, "operaciones.escribir");

  const proyecto = await proyectoParaGantt(id);
  if (!proyecto) notFound();

  // El equipo solo lo ve y lo toca coordinación: es reparto de trabajo.
  const [equipo, personas, mensajes] = puedeEditar
    ? await Promise.all([equipoDeProyecto(id), usuariosAsignables(), mensajesCliente(["torre"])])
    : [null, [], null];

  const [tc, tl, hoy] = await Promise.all([
    getTranslations("calendar"),
    getTranslations("lineaTiempo"),
    hoyEnLaBase(),
  ]);

  // Las tareas se agrupan por fase, en el orden de las fases; las que no
  // tienen fase cuelgan del proyecto.
  const porFase = new Map<string, SeccionTiempo>();
  for (const tarea of proyecto.tareas) {
    if (esIncoherente({ inicio: tarea.fecha_inicio, fin: tarea.fecha_limite })) continue;

    const titulo = tarea.fase_nombre ?? proyecto.nombre;
    const seccion = porFase.get(titulo) ?? { clave: titulo, titulo, barras: [] };
    seccion.barras.push({
      id: tarea.id,
      clase: "tarea",
      claseEtiqueta: tarea.es_hito ? tl("milestone") : tc("gantt.kind.tarea"),
      titulo: tarea.titulo,
      grupo: null,
      inicio: tarea.fecha_inicio,
      fin: tarea.fecha_limite,
      detalle: tarea.asignados,
      editable: puedeEditar,
      progreso: tarea.progreso,
      hito: tarea.es_hito,
      tono: tarea.estado === "completada" ? "apagado" : "marca",
    });
    porFase.set(titulo, seccion);
  }
  const secciones = [...porFase.values()];
  const rango = tramoDe(secciones.flatMap((s) => s.barras), hoy);

  return (
    <div className="animate-entrada space-y-6">
      {/* Barra superior con navegación */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/administrativo/proyectos"
              className="inline-flex items-center text-xs font-semibold text-marca-600 hover:underline"
            >
              <ArrowLeft className="size-3.5 mr-1" />
              Volver a Proyectos
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-tinta sm:text-3xl flex items-center gap-2.5">
            <FolderKanban className="size-6 text-marca-500" />
            {proyecto.nombre}
          </h1>
          {proyecto.descripcion && (
            <p className="texto-meta max-w-3xl text-sm">{proyecto.descripcion}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="neutra" className="capitalize text-xs">
            {proyecto.estado.replace("_", " ")}
          </Badge>
          {proyecto.responsable && (
            <Badge variant="marca" className="text-xs">
              Líder: {proyecto.responsable}
            </Badge>
          )}
        </div>
      </div>

      {rango && (
        <LineaTiempo
          secciones={secciones}
          inicio={rango.inicio}
          fin={rango.fin}
          hoy={hoy}
          alMover={puedeEditar ? moverBarra : undefined}
        />
      )}

      {equipo && mensajes && (
        <NextIntlClientProvider messages={mensajes}>
          <EquipoProyecto proyectoId={id} equipo={equipo} personas={personas} />
        </NextIntlClientProvider>
      )}
    </div>
  );
}
