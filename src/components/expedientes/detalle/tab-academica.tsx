import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";

import { GraficaTendencia } from "@/components/dashboard/graficas";
import { Filas, Seccion, Vacio } from "@/components/expedientes/detalle/ficha";
import { Historial360 } from "@/components/expedientes/historial-360";
import { MateriasUniversidad } from "@/components/expedientes/materias-universidad";
import { TareasExpediente } from "@/components/expedientes/tareas-expediente";
import { ArchivosAcademicos } from "@/components/universidades/archivos-academicos";
import { RecordPorCuatrimestre } from "@/components/expedientes/detalle/record-nativo";
import { RegistrarCalificaciones } from "@/components/expedientes/detalle/registrar-calificaciones";
import { GraduaViva } from "@/components/expedientes/detalle/gradua-viva";
import { LogoUniversidad } from "@/components/universidades/logo-universidad";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { fechaCorta, fechaLarga } from "@/lib/fechas";
import { promedio } from "@/lib/notas";
import type { AsignacionDelEstudiante } from "@/server/estudiantes/aula";
import type { InscripcionDelEstudiante } from "@/server/estudiantes/academico";
import type { Historial360 as Datos360 } from "@/server/estudiantes/historial-360";
import type { NotaDelEstudiante } from "@/server/estudiantes/portal";
import type { ExpedienteCompleto } from "@/server/expedientes/consultas";
import type { CambioDePlan, SeguimientoExpediente } from "@/server/expedientes/seguimiento";
import type { ArchivoAcademico, CatalogoDelEstudiante, RecordNativo } from "@/server/universidades/consultas";

/**
 * Las pestañas académicas del expediente: universidad, récord de notas, pénsum y
 * graduación, y Global Effect 360. Lo que todavía no existe en el sistema (el
 * catálogo de pénsum por universidad y el récord de la academia) se dice con
 * todas sus letras: un número inventado aquí sería peor que un hueco.
 */

export async function TabUniversidad({
  e,
  inscripciones,
  asignaciones,
  catalogo,
  puedeEditar,
  puedeAdministrar,
  cambios = [],
}: {
  e: ExpedienteCompleto;
  inscripciones: InscripcionDelEstudiante[];
  asignaciones: AsignacionDelEstudiante[];
  catalogo: CatalogoDelEstudiante;
  puedeEditar: boolean;
  puedeAdministrar: boolean;
  cambios?: CambioDePlan[];
}) {
  const [t, tc, idioma] = await Promise.all([getTranslations("records"), getTranslations("catalog"), getLocale()]);

  return (
    <>
      <Seccion titulo={tc("link.title")}>
        {catalogo.universidad && (
          <div className="mb-4 flex items-center gap-3">
            <LogoUniversidad siglas={catalogo.universidad.siglas} url={catalogo.universidad.logo} className="size-12" />
            <p className="font-semibold">{catalogo.universidad.nombre}</p>
          </div>
        )}
        <Filas
          filas={[
            { etiqueta: tc("link.university"), valor: catalogo.universidad?.siglas },
            { etiqueta: tc("link.career"), valor: catalogo.carrera?.nombre },
            { etiqueta: tc("link.pensum"), valor: catalogo.pensum ? tc("pensum.versionLabel", { version: catalogo.pensum.version }) : null },
            { etiqueta: tc("link.matricula"), valor: catalogo.matricula },
            { etiqueta: t("field.whereStudies"), valor: e.donde_estudia },
          ]}
        />
        {/* Texto antiguo sin catálogo: se enseña como inconsistencia a resolver. */}
        {!catalogo.universidad && e.universidad && (
          <p className="mt-4 rounded-control bg-marca-50 px-4 py-3 text-sm text-marca-700">
            {tc("link.unlinked", { text: e.universidad })}
          </p>
        )}
        {puedeEditar && (
          <div className="mt-4 flex flex-wrap gap-4 text-sm font-medium text-marca-700">
            <Link href={`/expedientes/${e.id}?editar=1`} className="hover:underline">{tc("link.edit")}</Link>
            {puedeAdministrar && <Link href="/academico/universidades" className="hover:underline">{tc("link.manage")}</Link>}
          </div>
        )}
      </Seccion>
      {cambios.length > 0 && (
        <Seccion titulo={tc("link.changesTitle")}>
          <ol className="space-y-3">
            {cambios.map((c, i) => (
              <li key={`${c.cuando}-${i}`} className="text-sm">
                <span className="texto-meta mr-3">{fechaCorta(c.cuando, idioma === "en" ? "en" : "es")}</span>
                <span className="text-tinta-2">{c.de}</span>
                <ArrowRight className="mx-2 inline size-3.5" aria-hidden />
                <span className="font-medium">{c.a}</span>
                {c.por && <span className="texto-meta"> · {c.por}</span>}
              </li>
            ))}
          </ol>
        </Seccion>
      )}
      <MateriasUniversidad inscripciones={inscripciones} />
      <TareasExpediente asignaciones={asignaciones} />
    </>
  );
}

export async function Tab360({ datos }: { datos: Datos360 }) {
  const t = await getTranslations("records");

  return datos.periodos.length === 0 ? <Vacio>{t("v2.empty360")}</Vacio> : <Historial360 datos={datos} />;
}

export async function TabRecord({
  notas,
  record,
  indice,
  umbral,
  puedeEditar,
}: {
  notas: NotaDelEstudiante[];
  /** Récord nativo por cuatrimestre; `null` si el estudiante solo tiene el historial anterior. */
  record: RecordNativo | null;
  indice: number | null;
  umbral: number;
  puedeEditar: boolean;
}) {
  const t = await getTranslations("records");

  // Con resultados nativos (el gradua leído y las calificaciones que se suban) el
  // récord se arma de ellos, por cuatrimestre y con filtros; el historial anterior
  // queda solo para quien aún no tiene.
  if (record) {
    return (
      <Seccion titulo={t("v2.record.title")}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <p className="texto-meta">{t("detail.subjectsCount", { count: record.total })}</p>
          <div className="text-right">
            <p className="text-2xl leading-none font-bold">{indice === null ? "—" : indice.toFixed(2)}</p>
            <p className="texto-meta mt-1">{t("v2.record.cumulative")} · {t("detail.gpaScale")}</p>
          </div>
        </div>
        <RecordPorCuatrimestre record={record} umbral={umbral} puedeEditar={puedeEditar} />
      </Seccion>
    );
  }

  if (notas.length === 0) return <Vacio>{t("v2.record.empty")}</Vacio>;

  const porPeriodo = new Map<string, NotaDelEstudiante[]>();

  for (const n of notas) porPeriodo.set(n.periodo, [...(porPeriodo.get(n.periodo) ?? []), n]);

  const acumulado = indice ?? promedio(notas.map((n) => n.gpa));
  // `notasDelEstudiante` ordena del período más reciente al más antiguo; la
  // gráfica de evolución se lee al revés.
  const tendencia = [...porPeriodo.entries()]
    .map(([periodo, lista]) => ({ periodo, indice: promedio(lista.map((n) => n.gpa)) ?? 0, materias: lista.length }))
    .reverse();

  return (
    <>
      <Seccion titulo={t("v2.record.title")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="texto-meta">{t("detail.subjectsCount", { count: notas.length })}</p>
          <div className="text-right">
            <p className="text-2xl leading-none font-bold">{acumulado === null ? "—" : acumulado.toFixed(2)}</p>
            <p className="texto-meta mt-1">{t("v2.record.cumulative")} · {t("detail.gpaScale")}</p>
          </div>
        </div>
        <div className="mt-4">
          <GraficaTendencia
            datos={tendencia}
            umbral={umbral}
            etiquetas={{ indice: t("detail.gpa"), umbral: t("detail.threshold"), vacio: t("detail.evolutionEmpty") }}
          />
        </div>
      </Seccion>

      {[...porPeriodo.entries()].map(([periodo, lista]) => (
        <Seccion key={periodo} titulo={periodo}>
          <div className="mb-3 flex justify-end">
            <Badge variant="marca">
              {t("v2.record.periodIndex")} {(promedio(lista.map((n) => n.gpa)) ?? 0).toFixed(2)}
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-tinta-3 border-b border-linea text-left text-xs">
                  <th className="py-2 font-medium">{t("v2.record.subject")}</th>
                  <th className="w-20 py-2 text-right font-medium">{t("v2.record.grade")}</th>
                  <th className="w-16 py-2 text-center font-medium">{t("v2.record.letter")}</th>
                  <th className="w-20 py-2 text-right font-medium">{t("v2.record.index")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {lista.map((n) => (
                  <tr key={n.id}>
                    <td className="py-2 pr-2 break-words">{n.materia}</td>
                    <td className="py-2 text-right tabular-nums">{n.nota.toFixed(1)}</td>
                    <td className="py-2 text-center">{n.letra}</td>
                    <td className="py-2 text-right tabular-nums">{n.gpa.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>
      ))}

      <Vacio>{t("v2.record.academyPending")}</Vacio>
    </>
  );
}

export async function TabPensum({
  e,
  inscripciones,
  seg,
  tiempo,
  catalogo,
  archivos,
  puedeEditar,
}: {
  e: ExpedienteCompleto;
  inscripciones: InscripcionDelEstudiante[];
  seg: SeguimientoExpediente;
  catalogo: CatalogoDelEstudiante;
  /** «1 año y 8 meses», ya redactado, o `null` sin fecha de ingreso. */
  tiempo: string | null;
  archivos: ArchivoAcademico[];
  puedeEditar: boolean;
}) {
  const [t, tc, idioma] = await Promise.all([getTranslations("records"), getTranslations("catalog"), getLocale()]);
  const lang = idioma === "en" ? "en" : "es";
  const graduado = e.estado === "graduado";
  const creditos = inscripciones.filter((i) => i.estado === "aprobada").reduce((n, i) => n + (i.creditos ?? 0), 0);

  return (
    <>
      <Seccion titulo={t("v2.curriculum.title")}>
        <Filas
          filas={[
            { etiqueta: t("v2.curriculum.approvedCredits"), valor: creditos > 0 ? String(creditos) : null },
          ]}
        />
        {catalogo.pensum ? <GraduaViva catalogo={catalogo} /> : <p className="mt-4 rounded-control bg-marca-50 px-4 py-3 text-sm text-marca-700">{t("v2.curriculum.pending")}</p>}
      </Seccion>

      {puedeEditar && (
        <Seccion titulo={tc("grades.title")}>
          <RegistrarCalificaciones
            estudianteId={e.id}
            materias={catalogo.materias.flatMap((m) =>
              m.estado === "aprobada" ? [] : [{ codigo: m.codigo, nombre: m.nombre, creditos: m.creditos, periodoSugerido: m.periodo_sugerido, estado: m.estado }],
            )}
            letras={Object.entries(catalogo.reglas?.puntosPorLetra ?? {}).map(([letra, puntos]) => ({ letra, puntos }))}
          />
        </Seccion>
      )}

      <Seccion titulo={tc("files.gradTitle")}>
        <ArchivosAcademicos destino="estudiante" id={e.id} archivos={archivos} tipos={["gradua", "record_notas"]} puedeEscribir={puedeEditar} />
      </Seccion>

      <Seccion titulo={t("v2.graduation.title")}>
        <div className="mb-4">
          <Badge variant={graduado ? "marca" : "neutra"} className="gap-1">
            {graduado ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
            {graduado ? t("v2.graduation.graduated") : t("v2.graduation.notYet")}
          </Badge>
        </div>
        <Filas
          filas={[
            {
              etiqueta: t("v2.graduation.date"),
              valor: seg.graduadoEl ? fechaLarga(seg.graduadoEl, lang) : graduado ? t("v2.graduation.noDate") : null,
            },
          ]}
        />
      </Seccion>
    </>
  );
}
