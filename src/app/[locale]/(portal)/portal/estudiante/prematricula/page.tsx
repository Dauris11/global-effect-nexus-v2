import type { Metadata } from "next";
import { BookOpen, CalendarRange, CircleCheck, Coins } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { ElegirMaterias } from "@/components/estudiante/elegir-materias";
import { PeriodoInscripciones } from "@/components/estudiante/prematricula-periodo";
import { TandasPeriodo360 } from "@/components/global360/tandas-periodo";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { StatCard } from "@/components/ui/stat-card";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import type { Locale } from "@/i18n/routing";
import { requerirRol } from "@/lib/auth";
import { fechaCorta } from "@/lib/fechas";
import {
  inscripcionesDelEstudiante,
  type InscripcionDelEstudiante,
  materiasOfertadas,
} from "@/server/estudiantes/academico";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";
import {
  tandasDelEstudiante,
  ventanaVigente,
} from "@/server/global360/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "studentPortal" });

  return { title: t("subjectsPage.title") };
}

/**
 * Mis materias: la matrícula del estudiante, período por período, y la elección
 * de las del período que viene.
 *
 * Esta pantalla era solo de lectura, y su comentario decía —con razón— que
 * dejar que el estudiante se apuntara "sería otra decisión, no una pantalla
 * más". Esa decisión ya se tomó, y lo que la hace sostenible es que la elección
 * NO está siempre abierta: solo dentro de la ventana de prematrícula que
 * configura coordinación en `/academico/prematricula`. Fuera de esa ventana la
 * pantalla vuelve a ser exactamente lo que era.
 *
 * LA VENTANA ES LA MISMA QUE LA DE GLOBAL EFFECT 360, y no una nueva:
 * `ventana_prematricula` cuelga de `periodo`, no de un programa. Un
 * cuatrimestre tiene UNA prematrícula, se anuncia una vez y se abre para todo
 * lo que se matricula en él. Duplicarla por programa habría permitido que el
 * mismo período estuviera abierto para 360 y cerrado para la carrera.
 *
 * El bloque de elección se dibuja solo si hay ventana vigente —abierta o
 * anunciada—; si no hay ninguna, no se enseña ni el aviso: no hay nada que
 * decir y una tarjeta que anuncia que no hay nada ocupa sitio.
 *
 * Con la ventana, también las dos tandas de Global Effect 360: es obligatorio
 * y se elige en la misma prematrícula, así que quien venga a matricular la
 * carrera tiene que enterarse aquí si le falta la materia de la tanda. Aquí
 * solo se avisa y se enlaza; elegir se hace en la página de 360.
 */
export default async function PaginaMisMaterias({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const idioma: Locale = locale === "en" ? "en" : "es";

  const usuario = await requerirRol(["estudiante"]);
  const estudiante = await estudianteDeUsuario(usuario.id);

  const t = await getTranslations({ locale, namespace: "studentPortal" });

  const [inscripciones, ventana] = await Promise.all([
    inscripcionesDelEstudiante(estudiante.id),
    ventanaVigente(),
  ]);

  // El catálogo solo se pide si hay ventana: sin ella no hay nada que elegir y
  // sería una consulta por visita para no dibujar nada.
  const [oferta, mensajes, tandas] = ventana
    ? await Promise.all([
        materiasOfertadas({
          periodoId: ventana.periodo_id,
          estudianteId: estudiante.id,
        }),
        mensajesCliente(["studentPortal"]),
        estudiante.id
          ? tandasDelEstudiante(estudiante.id, ventana.periodo_id)
          : Promise.resolve([]),
      ])
    : [[], null, []];

  const activas = inscripciones.filter((fila) => fila.estado === "activa");
  const cerradas = inscripciones.filter(
    (fila) => fila.estado === "aprobada" || fila.estado === "reprobada",
  );
  const creditosActivos = activas.reduce(
    (total, fila) => total + (fila.creditos ?? 0),
    0,
  );

  const periodos = agruparPorPeriodo(inscripciones);

  const columnas = {
    materia: t("subjectsPage.columns.subject"),
    horario: t("subjectsPage.columns.schedule"),
    aula: t("subjectsPage.columns.room"),
    profesor: t("subjectsPage.columns.teacher"),
    creditos: t("subjectsPage.columns.credits"),
    estado: t("subjectsPage.columns.status"),
  };

  return (
    <div className="space-y-8">
      <EncabezadoPagina
        antetitulo={t("subjectsPage.eyebrow")}
        titulo={t("subjectsPage.title")}
        subtitulo={t("subjectsPage.description")}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icono={BookOpen}
          valor={activas.length}
          etiqueta={t("subjectsPage.stats.active")}
          acento
        />
        <StatCard
          icono={Coins}
          valor={creditosActivos}
          etiqueta={t("subjectsPage.stats.credits")}
        />
        <StatCard
          icono={CalendarRange}
          valor={periodos.length}
          etiqueta={t("subjectsPage.stats.terms")}
        />
        <StatCard
          icono={CircleCheck}
          valor={cerradas.length}
          etiqueta={t("subjectsPage.stats.closed")}
        />
      </div>

      {ventana && <TandasPeriodo360 ventana={ventana} tandas={tandas} enlazar />}

      {ventana && mensajes && (
        <NextIntlClientProvider messages={mensajes}>
          <ElegirMaterias
            materias={oferta}
            periodo={ventana.periodo}
            abierta={ventana.abierta}
          />
        </NextIntlClientProvider>
      )}

      <section className="space-y-8 border-t border-linea pt-8">
        {/* La sección se titula "Mi matrícula" y no "Mis materias": ese ya es
            el título de la página. */}
        <h2 className="texto-titulo-seccion">{t("subjectsPage.eyebrow")}</h2>

        {periodos.length === 0 ? (
          <EstadoVacio
            icono={BookOpen}
            titulo={t("subjectsPage.empty")}
            texto={t("subjectsPage.emptyHint")}
          />
        ) : (
          periodos.map((periodo) => (
            <PeriodoInscripciones
              key={periodo.id}
              periodo={periodo}
              textos={{
                activo: t("subjectsPage.termActive"),
                resumen: t("subjectsPage.termSummary", {
                  subjects: periodo.filas.length,
                  credits: periodo.filas.reduce(
                    (total, fila) => total + (fila.creditos ?? 0),
                    0,
                  ),
                }),
                inicio: periodo.fechaInicio
                  ? t("subjectsPage.termStart", {
                      date: fechaCorta(periodo.fechaInicio, idioma),
                    })
                  : null,
                columnas,
                creditos: (n) => t("creditsShort", { count: n }),
                estado: (estado) => t(`subjectsPage.status.${estado}`),
              }}
            />
          ))
        )}
      </section>
    </div>
  );
}

/**
 * Agrupa las inscripciones por período conservando el orden de la consulta,
 * que ya llega del más reciente al más antiguo.
 */
function agruparPorPeriodo(filas: readonly InscripcionDelEstudiante[]) {
  const grupos = new Map<
    string,
    {
      id: string;
      nombre: string;
      estado: string;
      fechaInicio: string | null;
      filas: InscripcionDelEstudiante[];
    }
  >();

  for (const fila of filas) {
    const grupo = grupos.get(fila.periodo_id);

    if (grupo) grupo.filas.push(fila);
    else
      grupos.set(fila.periodo_id, {
        id: fila.periodo_id,
        nombre: fila.periodo,
        estado: fila.periodo_estado,
        fechaInicio: fila.fecha_inicio,
        filas: [fila],
      });
  }

  return [...grupos.values()];
}
