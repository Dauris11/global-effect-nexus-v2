import { MiPlanDeEstudios } from "@/components/estudiante/mi-plan-de-estudios";
import { alertasAcademicas, indiceDelEstudiante, umbralDeIndice } from "@/server/academico/indice";
import { catalogoDelEstudiante } from "@/server/universidades/consultas";
import type { Metadata } from "next";
import { AlertCircle } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { AvisoMinimoCuatrimestral } from "@/components/estudiante/aviso-minimo-cuatrimestral";
import { CondicionFundacion } from "@/components/estudiante/condicion-fundacion";
import {
  DashboardGraficoEstudiante,
  KpisAnimadosEstudiante,
} from "@/components/estudiante/dashboard-inicio-estudiante";
import {
  MateriasEnCursoInteractivo,
  NotasRecientesInteractivo,
  SolicitudesInteractivo,
} from "@/components/estudiante/dashboard-secciones-estudiante";
import { agruparPorPeriodo } from "@/components/estudiante/periodos";
import { TarjetaProximo } from "@/components/estudiante/tarjeta-proximo";
import { BannerLlamadasActivas } from "@/components/reuniones/banner-llamadas-activas";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import type { Locale } from "@/i18n/routing";
import { requerirRol } from "@/lib/auth";
import { claveDia } from "@/lib/fechas";
import {
  aprobada,
  promedio,
} from "@/lib/notas";
import { asignacionesDelEstudiante } from "@/server/estudiantes/aula";
import {
  condicionEnLaFundacion,
  cumplimientoCuatrimestralEstudiante,
  estudianteDeUsuario,
  eventosProximos,
  materiasInscritas,
  notasDelEstudiante,
  reunionesEstudiante,
} from "@/server/estudiantes/portal";
import { reunionesActivasParaUsuario } from "@/server/reuniones/consultas";
import { solicitudesDe } from "@/server/solicitudes/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "studentPortal" });

  return { title: t("studentPortalHeader") };
}

/**
 * Portal del estudiante.
 *
 * Muestra lo académico —materias, notas, índice—, su condición en la Fundación
 * y sus últimas solicitudes a administración. NO muestra el expediente: eso lo
 * redacta el equipo de la Fundación para uso interno, y
 * `server/estudiantes/portal.ts` explica por qué ninguna consulta de aquí lo
 * toca.
 *
 * Orden de la pantalla (docs/09-sistema-visual.md §4.2): saludo con las cifras,
 * "lo próximo" como tarjeta destacada —es lo que se viene a mirar—, los
 * accesos en rejilla de dos en el móvil y, debajo, el detalle por secciones.
 * Las piezas viven en `components/estudiante/` para que esta página solo
 * consulte y ordene.
 */
export default async function PortalEstudiante({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const idioma: Locale = locale === "en" ? "en" : "es";

  const usuario = await requerirRol(["estudiante"]);
  const estudiante = await estudianteDeUsuario(usuario.id);

  const t = await getTranslations({ locale, namespace: "studentPortal" });

  const [
    materias,
    notas,
    condicion,
    solicitudes,
    eventos,
    asignaciones,
    cumplimiento,
    reuniones,
    llamadasActivas,
    mensajes,
  ] = await Promise.all([
    materiasInscritas(estudiante.id),
    notasDelEstudiante(estudiante.id),
    condicionEnLaFundacion(estudiante.id, 3),
    solicitudesDe(usuario),
    eventosProximos(20),
    asignacionesDelEstudiante(estudiante.id),
    cumplimientoCuatrimestralEstudiante(
      estudiante.id,
      estudiante.esUniversitario,
    ),
    reunionesEstudiante(usuario.id, estudiante.id),
    reunionesActivasParaUsuario({ usuarioId: usuario.id, rol: usuario.rol }),
    mensajesCliente(["studentPortal", "requests"]),
  ]);

  const hoyIso = claveDia();
  const tareasDashboard = asignaciones.map((a) => {
    const fechaBase = a.fecha_vencimiento ?? a.fecha_publicacion;
    const fechaIso = fechaBase.toISOString().slice(0, 10);
    const hora = a.fecha_vencimiento
      ? fechaBase.toISOString().slice(11, 16)
      : null;
    return {
      id: a.id,
      titulo: a.titulo,
      tipo: a.tipo,
      materia: a.materia,
      fechaIso,
      hora,
      estadoEntrega: a.estado_entrega,
      vencida: a.vencida,
    };
  });
  const eventosDashboard = eventos.map((e) => ({
    id: e.id,
    titulo: e.titulo,
    tipo: e.tipo,
    fecha: e.fecha,
    hora: e.hora_inicio ? e.hora_inicio.slice(0, 5) : null,
    ubicacion: e.ubicacion,
  }));
  const reunionesDashboard = reuniones.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    tipo: r.tipo,
    modalidad: r.modalidad,
    fecha: r.fecha,
    hora: r.hora_inicio,
  }));

  const todasLasNotas = notas.map((nota) => nota.nota);
  const promedioGeneral = promedio(todasLasNotas);
  // Promedio de los índices de cada fila, que en el historial universitario
  // vienen guardados; ver `notasDelEstudiante`.
  // El mismo índice que ve administración: el nativo (reglas de su universidad) y,
  // solo sin resultados nativos, el promedio del historial anterior.
  const [indiceNativo, umbralIndice] = await Promise.all([indiceDelEstudiante(estudiante.id), umbralDeIndice()]);
  const indice = indiceNativo ?? promedio(notas.map((nota) => nota.gpa));
  // Su avance sobre el plan de estudios de su universidad (lo mismo que ve administración).
  const catalogo = await catalogoDelEstudiante(estudiante.id);
  const alertasPlan = alertasAcademicas(catalogo, indice, umbralIndice);
  const aprobadas = todasLasNotas.filter(aprobada).length;
  const creditos = materias.reduce(
    (total, materia) => total + (materia.creditos ?? 0),
    0,
  );

  // Notas agrupadas por período, respetando el orden que ya trae la consulta.
  const periodos = agruparPorPeriodo(notas);

  // La próxima entrega: la consulta ya viene ordenada por vencimiento, así que
  // basta la primera tarea o examen con fecha, sin entregar y sin vencer.
  const proximaEntrega =
    asignaciones.find(
      (a) =>
        (a.tipo === "tarea" || a.tipo === "examen") &&
        a.fecha_vencimiento !== null &&
        !a.vencida &&
        (a.estado_entrega === null || a.estado_entrega === "pendiente"),
    ) ?? null;

  return (
    <div className="animate-entrada space-y-10 md:space-y-12">
      <div className="space-y-6">
        <EncabezadoPagina
          titulo={t("greeting", { name: estudiante.nombre })}
          subtitulo={t("summary")}
        />

        <NextIntlClientProvider messages={mensajes}>
          <KpisAnimadosEstudiante
            promedio={promedioGeneral}
            indice={indice}
            aprobadas={aprobadas}
            creditos={creditos}
          />
        </NextIntlClientProvider>

        {/* Prueba académica: el aviso solo aparece si el índice ya está por
            debajo del mínimo, nunca cuando aún no hay historial. Es el aviso
            grave del sistema: tinta, no rojo. */}
        {indice !== null && indice < umbralIndice ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-control bg-tinta p-4 text-background"
          >
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
            <p className="text-sm font-medium leading-relaxed">
              {t("gpaHint.nota-critica")}
            </p>
          </div>
        ) : null}

        <AvisoMinimoCuatrimestral cumplimiento={cumplimiento} enlazar />

        <MiPlanDeEstudios catalogo={catalogo} alertas={alertasPlan} />

        <BannerLlamadasActivas activas={llamadasActivas} />
      </div>

      <NextIntlClientProvider messages={mensajes}>
        <DashboardGraficoEstudiante
          tareas={tareasDashboard}
          eventos={eventosDashboard}
          reuniones={reunionesDashboard}
          hoyIso={hoyIso}
          locale={idioma}
        />
      </NextIntlClientProvider>

      <TarjetaProximo
        entrega={proximaEntrega}
        evento={eventos[0] ?? null}
        locale={idioma}
      />

      <NextIntlClientProvider messages={mensajes}>
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
          <MateriasEnCursoInteractivo materias={materias} />
          <NotasRecientesInteractivo periodo={periodos[0]} />
        </div>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
          <CondicionFundacion condicion={condicion} />
          <SolicitudesInteractivo solicitudes={solicitudes} locale={idioma} />
        </div>
      </NextIntlClientProvider>
    </div>
  );
}
