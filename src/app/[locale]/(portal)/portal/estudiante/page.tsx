import type { Metadata } from "next";
import {
  AlertCircle,
  BookOpen,
  Bot,
  CalendarDays,
  GraduationCap,
  Inbox,
  MonitorPlay,
  Star,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AvisoSinFicha } from "@/components/estudiante/aviso-sin-ficha";
import { CondicionFundacion } from "@/components/estudiante/condicion-fundacion";
import { EventosProximos } from "@/components/estudiante/eventos-proximos";
import { MateriasEnCurso } from "@/components/estudiante/materias-en-curso";
import { NotasRecientes } from "@/components/estudiante/notas-recientes";
import { agruparPorPeriodo } from "@/components/estudiante/periodos";
import { TarjetaProximo } from "@/components/estudiante/tarjeta-proximo";
import {
  AccesosPortal,
  BannerPortal,
  type AccesoPortal,
} from "@/components/layout/banner-portal";
import { ResumenSolicitudes } from "@/components/solicitudes/resumen-solicitudes";
import type { Locale } from "@/i18n/routing";
import { requerirRol } from "@/lib/auth";
import {
  aprobada,
  consejoDeIndice,
  GPA_PRUEBA_ACADEMICA,
  promedio,
} from "@/lib/notas";
import { tienePermiso } from "@/lib/rbac";
import { asignacionesDelEstudiante } from "@/server/estudiantes/aula";
import {
  condicionEnLaFundacion,
  estudianteDeUsuario,
  eventosProximos,
  materiasInscritas,
  notasDelEstudiante,
} from "@/server/estudiantes/portal";
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

  // Usuario sin ficha enlazada: se explica y se remite a coordinación, en vez
  // de mostrar un portal vacío que parecería roto.
  if (!estudiante) return <AvisoSinFicha />;

  const [materias, notas, condicion, solicitudes, eventos, asignaciones] =
    await Promise.all([
      materiasInscritas(estudiante.id),
      notasDelEstudiante(estudiante.id),
      condicionEnLaFundacion(estudiante.id, 3),
      solicitudesDe(usuario),
      eventosProximos(4),
      asignacionesDelEstudiante(estudiante.id),
    ]);

  const todasLasNotas = notas.map((nota) => nota.nota);
  const promedioGeneral = promedio(todasLasNotas);
  // Promedio de los índices de cada fila, que en el historial universitario
  // vienen guardados; ver `notasDelEstudiante`.
  const indice = promedio(notas.map((nota) => nota.gpa));
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

  const accesos: AccesoPortal[] = [
    {
      href: "/portal/estudiante/aula-virtual",
      icono: MonitorPlay,
      titulo: t("classroom.title"),
      texto: t("classroom.description"),
    },
    {
      href: "/portal/estudiante/calificaciones",
      icono: Star,
      titulo: t("gradesSubTitle"),
      texto: t("gradesSubDesc"),
    },
    {
      href: "/portal/estudiante/prematricula",
      icono: BookOpen,
      titulo: t("mySubjectsTitle"),
      texto: t("mySubjectsDesc"),
    },
    {
      href: "/portal/estudiante/calendario",
      icono: CalendarDays,
      titulo: t("agenda.title"),
      texto: t("agenda.description"),
    },
    {
      href: "/portal/estudiante/solicitudes",
      icono: Inbox,
      titulo: t("requestsTitle"),
      texto: t("requestsDesc"),
    },
    // El chat solo se ofrece a quien tiene el permiso: su pantalla lo
    // comprueba igual, pero un acceso que lleva a "no disponible" sobra.
    ...(tienePermiso(usuario.rol, "ia.usar")
      ? [
          {
            href: "/portal/estudiante/chat",
            icono: Bot,
            titulo: t("chat.title"),
            texto: t("chat.description"),
          },
        ]
      : []),
  ];

  return (
    <div className="animate-fade-in-up space-y-10 md:space-y-12">
      <div className="space-y-4">
        <BannerPortal
          rol="estudiante"
          icono={GraduationCap}
          insignia={t(`type.${estudiante.tipo}`)}
          titulo={t("greeting", { name: estudiante.nombre })}
          kpis={[
            {
              valor:
                promedioGeneral === null ? "—" : promedioGeneral.toFixed(1),
              etiqueta: t("stats.average"),
            },
            {
              valor: indice === null ? "—" : indice.toFixed(2),
              etiqueta: `${t("gradesPage.gpaShort")} ${t("gpaScale")}`,
            },
            { valor: String(aprobadas), etiqueta: t("stats.passed") },
            { valor: String(creditos), etiqueta: t("stats.credits") },
          ]}
        />

        {/* Prueba académica: el aviso solo aparece si el índice ya está por
            debajo del mínimo, nunca cuando aún no hay historial. Es el aviso
            grave del sistema: tinta, no rojo. */}
        {indice !== null && indice < GPA_PRUEBA_ACADEMICA ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-control bg-tinta p-4 text-background"
          >
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
            <p className="text-sm font-medium leading-relaxed">
              {t("gpaHint.nota-critica")}
            </p>
          </div>
        ) : (
          <p className="texto-meta">
            {t(`gpaHint.${consejoDeIndice(indice)}`)}
          </p>
        )}
      </div>

      <TarjetaProximo
        entrega={proximaEntrega}
        evento={eventos[0] ?? null}
        locale={idioma}
      />

      <AccesosPortal accesos={accesos} />

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
        <MateriasEnCurso materias={materias} />
        <NotasRecientes periodo={periodos[0]} />
      </div>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
        <CondicionFundacion condicion={condicion} />
        <ResumenSolicitudes
          solicitudes={solicitudes.slice(0, 5)}
          href="/portal/estudiante/solicitudes"
          locale={idioma}
        />
      </div>

      <EventosProximos eventos={eventos} locale={idioma} />
    </div>
  );
}
