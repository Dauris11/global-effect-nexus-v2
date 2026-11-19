import { getLocale, getTranslations } from "next-intl/server";
import { CheckCircle2, XCircle } from "lucide-react";

import { GraficaTendencia } from "@/components/dashboard/graficas";
import { Filas, Seccion, Vacio } from "@/components/expedientes/detalle/ficha";
import { Historial360 } from "@/components/expedientes/historial-360";
import { MateriasUniversidad } from "@/components/expedientes/materias-universidad";
import { TareasExpediente } from "@/components/expedientes/tareas-expediente";
import { Badge } from "@/components/ui/badge";
import { fechaLarga } from "@/lib/fechas";
import { GPA_PRUEBA_ACADEMICA, promedio } from "@/lib/notas";
import type { AsignacionDelEstudiante } from "@/server/estudiantes/aula";
import type { InscripcionDelEstudiante } from "@/server/estudiantes/academico";
import type { Historial360 as Datos360 } from "@/server/estudiantes/historial-360";
import type { NotaDelEstudiante } from "@/server/estudiantes/portal";
import type { ExpedienteCompleto } from "@/server/expedientes/consultas";
import type { SeguimientoExpediente } from "@/server/expedientes/seguimiento";

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
}: {
  e: ExpedienteCompleto;
  inscripciones: InscripcionDelEstudiante[];
  asignaciones: AsignacionDelEstudiante[];
}) {
  const t = await getTranslations("records");

  return (
    <>
      <Seccion titulo={t("v2.sections.whereStudies")}>
        <Filas
          filas={[
            { etiqueta: t("field.university"), valor: e.universidad },
            { etiqueta: t("field.program"), valor: e.programa },
            { etiqueta: t("field.whereStudies"), valor: e.donde_estudia },
          ]}
        />
      </Seccion>
      <MateriasUniversidad inscripciones={inscripciones} />
      <TareasExpediente asignaciones={asignaciones} />
    </>
  );
}

export async function Tab360({ datos }: { datos: Datos360 }) {
  const t = await getTranslations("records");

  return datos.periodos.length === 0 ? <Vacio>{t("v2.empty360")}</Vacio> : <Historial360 datos={datos} />;
}

export async function TabRecord({ notas }: { notas: NotaDelEstudiante[] }) {
  const t = await getTranslations("records");

  if (notas.length === 0) return <Vacio>{t("v2.record.empty")}</Vacio>;

  const porPeriodo = new Map<string, NotaDelEstudiante[]>();

  for (const n of notas) porPeriodo.set(n.periodo, [...(porPeriodo.get(n.periodo) ?? []), n]);

  const acumulado = promedio(notas.map((n) => n.gpa));
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
            umbral={GPA_PRUEBA_ACADEMICA}
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
}: {
  e: ExpedienteCompleto;
  inscripciones: InscripcionDelEstudiante[];
  seg: SeguimientoExpediente;
  /** «1 año y 8 meses», ya redactado, o `null` sin fecha de ingreso. */
  tiempo: string | null;
}) {
  const [t, idioma] = await Promise.all([getTranslations("records"), getLocale()]);
  const lang = idioma === "en" ? "en" : "es";
  const graduado = e.estado === "graduado";
  const creditos = inscripciones.filter((i) => i.estado === "aprobada").reduce((n, i) => n + (i.creditos ?? 0), 0);

  return (
    <>
      <Seccion titulo={t("v2.curriculum.title")}>
        <Filas
          filas={[
            { etiqueta: t("field.university"), valor: e.universidad },
            { etiqueta: t("field.program"), valor: e.programa },
            { etiqueta: t("v2.curriculum.approvedCredits"), valor: creditos > 0 ? String(creditos) : null },
          ]}
        />
        {/* Sin catálogo de pénsum todavía: no hay total ni porcentaje de avance que
            enseñar, y no se inventan. */}
        <p className="mt-4 rounded-control bg-marca-50 px-4 py-3 text-sm text-marca-700">{t("v2.curriculum.pending")}</p>
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
            { etiqueta: t("field.entryDate"), valor: e.fecha_ingreso ? fechaLarga(e.fecha_ingreso, lang) : null },
            { etiqueta: t("v2.tenureLabel"), valor: tiempo },
            { etiqueta: t("field.group"), valor: e.grupo ? String(e.grupo) : t("v2.noGroup") },
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
