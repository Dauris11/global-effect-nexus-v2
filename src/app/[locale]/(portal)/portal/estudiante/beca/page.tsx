import type { Metadata } from "next";
import { Bus, CalendarDays, GraduationCap, HeartHandshake, Utensils } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/app/page-header";
import { FilaBeca } from "@/components/estudiante/beca/fila-beca";
import { requerirRol } from "@/lib/auth";
import { claveMes, fechaCorta } from "@/lib/fechas";
import { indiceDelEstudiante, umbralDeIndice } from "@/server/academico/indice";
import { comidaDeHoy, usaTransporte } from "@/server/estudiantes/beca";
import {
  condicionEnLaFundacion,
  estudianteDeUsuario,
  notasDelEstudiante,
  reunionesEstudiante,
} from "@/server/estudiantes/portal";
import { promedio } from "@/lib/notas";
import { obtenerInscripcionesRecurrentesEstudiante } from "@/server/transporte/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "studentClasses" });

  return { title: t("scholarship.title") };
}

/**
 * Mi beca: lo que decide si la conserva (índice, servicio y reunión del mes) y
 * los dos apoyos del día a día (comida y transporte), cada uno con su estado y
 * la acción para completarlo.
 *
 * Comida y transporte van separados a propósito (regla 16): el transporte solo
 * sale si le aplica (cinco zonas o ya inscrito), y el comedor es de todos.
 */
export default async function PaginaMiBeca({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const idioma = locale === "en" ? "en" : "es";

  const usuario = await requerirRol(["estudiante"]);
  const estudiante = await estudianteDeUsuario(usuario.id);

  const [t, condicion, reuniones, indiceNativo, minimo, notas, comida, conTransporte, rutas] = await Promise.all([
    getTranslations({ locale, namespace: "studentClasses" }),
    condicionEnLaFundacion(estudiante.id, 3),
    reunionesEstudiante(usuario.id, estudiante.id),
    indiceDelEstudiante(estudiante.id),
    umbralDeIndice(),
    notasDelEstudiante(estudiante.id),
    comidaDeHoy(estudiante.nombre),
    usaTransporte(estudiante.id),
    obtenerInscripcionesRecurrentesEstudiante(estudiante.id),
  ]);

  const mes = claveMes();
  const delMes = condicion.find((m) => m.mes === mes);
  const indice = indiceNativo ?? promedio(notas.map((n) => n.gpa));
  const reunionDelMes = reuniones.find((r) => r.fecha.startsWith(mes));

  const estadoBeca = indice === null ? "pendiente" : indice >= minimo ? "activa" : "prueba_academica";
  const estadoReunion = delMes?.asistio_reunion ? "cumplio" : reunionDelMes ? "programada" : "pendiente";

  return (
    <div className="animate-entrada space-y-6">
      <PageHeader title={t("scholarship.title")} />

      <div className="space-y-3">
        <FilaBeca
          icono={GraduationCap}
          titulo={t("scholarship.status")}
          detalle={
            indice === null
              ? t("scholarship.indexNone")
              : t("scholarship.indexLine", { indice: indice.toFixed(2), minimo: minimo.toFixed(2) })
          }
          estado={estadoBeca}
          etiquetaEstado={t(`scholarship.states.${estadoBeca}`)}
          accion={t("scholarship.seeGrades")}
          href="/portal/estudiante/calificaciones"
        />
        <FilaBeca
          icono={HeartHandshake}
          titulo={t("scholarship.service")}
          detalle={t("scholarship.serviceHint")}
          estado={delMes?.hizo_servicio ? "cumplio" : "pendiente"}
          etiquetaEstado={delMes?.hizo_servicio ? t("scholarship.states.cumplio") : t("scholarship.states.pendiente")}
          accion={delMes?.hizo_servicio ? undefined : t("scholarship.askAdmin")}
          href="/portal/estudiante/solicitudes"
        />
        <FilaBeca
          icono={CalendarDays}
          titulo={t("scholarship.meeting")}
          detalle={reunionDelMes ? t("scholarship.meetingOn", { fecha: fechaCorta(reunionDelMes.fecha, idioma) }) : t("scholarship.meetingNone")}
          estado={estadoReunion}
          etiquetaEstado={t(`scholarship.states.${estadoReunion}`)}
          accion={estadoReunion === "cumplio" ? undefined : t("scholarship.seeCalendar")}
          href="/portal/estudiante/calendario"
        />
        <FilaBeca
          icono={Utensils}
          titulo={t("scholarship.meal")}
          detalle={t("scholarship.mealHint")}
          estado={comida.inscrito ? "confirmada" : comida.abierto ? "pendiente" : "inactivo"}
          etiquetaEstado={comida.inscrito ? t("scholarship.mealIn") : comida.abierto ? t("scholarship.mealOut") : t("scholarship.mealClosed")}
          accion={comida.inscrito ? undefined : t("scholarship.mealAction")}
          href="/comida"
        />
        {conTransporte && (
          <FilaBeca
            icono={Bus}
            titulo={t("scholarship.transport")}
            detalle={t("scholarship.transportHint")}
            estado={rutas.length > 0 ? "activa" : "pendiente"}
            etiquetaEstado={rutas.length > 0 ? t("scholarship.transportIn", { n: rutas.length }) : t("scholarship.transportOut")}
            accion={rutas.length > 0 ? t("scholarship.transportManage") : t("scholarship.transportAction")}
            href="/portal/estudiante/transporte"
          />
        )}
      </div>
    </div>
  );
}
