import { CheckCircle2, FileImage, TriangleAlert } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { EditorRecordLiceo } from "@/components/expedientes/record-liceo/editor-record-liceo";
import { Seccion } from "@/components/expedientes/detalle/ficha";
import { anioEscolar, promediosDelRecord } from "@/lib/record-liceo";
import { fechaCorta } from "@/lib/fechas";
import { parametros } from "@/server/parametros/consultas";
import { recordLiceoDe } from "@/server/record-liceo/consultas";

/**
 * Récord de notas de secundaria dentro de la pestaña académica del expediente:
 * los dos promedios (general y por año), cada grado con su liceo y sus notas, las
 * fotos originales y, a quien puede editar, el flujo para leerlo o escribirlo.
 *
 * Es aparte del índice universitario (escala 4,00): este promedio va de 0 a 100 y
 * no alimenta la beca ni las alertas académicas.
 */
export async function SeccionRecordLiceo({ estudianteId, puedeEditar }: { estudianteId: string; puedeEditar: boolean }) {
  const [t, datos, idioma, valores] = await Promise.all([getTranslations("recordLiceo"), recordLiceoDe(estudianteId), getLocale(), parametros()]);
  const minimo = Number(valores["becas.promedio_liceo_minimo"]) || 89;
  const lang = idioma === "en" ? "en" : "es";
  const resumen = promediosDelRecord(datos.grados);
  const hayConfirmado = datos.confirmadoAt !== null && datos.grados.length > 0;

  return (
    <Seccion titulo={t("title")}>
      <div className="space-y-6">
        <p className="texto-meta">{t("intro")}</p>

        {hayConfirmado ? (
          <>
            <div className="flex flex-wrap gap-x-12 gap-y-4">
              <div>
                <p className="text-3xl leading-none font-bold tabular-nums">{datos.promedioGlobal?.toFixed(2) ?? resumen.global?.toFixed(2) ?? "—"}</p>
                <p className="texto-meta mt-1.5">{t("general")} · {t("notesCount", { count: resumen.totalNotas })}</p>
              </div>
              <div>
                <p className="text-3xl leading-none font-bold tabular-nums">{datos.promedioAnual?.toFixed(2) ?? resumen.anual?.toFixed(2) ?? "—"}</p>
                <p className="texto-meta mt-1.5">{t("byYear")}</p>
              </div>
            </div>

            {datos.promedioGlobal !== null && (
              <p className="flex items-center gap-2 text-sm font-medium">
                {datos.promedioGlobal >= minimo ? <CheckCircle2 className="size-4 text-marca-700" /> : <TriangleAlert className="size-4 text-[#B4342B]" />}
                {datos.promedioGlobal >= minimo ? t("minimum.met", { min: minimo }) : t("minimum.below", { min: minimo })}
              </p>
            )}

            <div className="space-y-2">
              {datos.grados.map((g, i) => (
                <details key={`${g.grado}-${g.anioInicio}-${g.centro}`} className="group rounded-card border border-linea">
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3 text-sm font-medium">
                    <span>{t("grade", { grade: g.grado })} · {anioEscolar(g.anioInicio)}</span>
                    <span className="texto-meta font-normal">{g.centro} · {t("gradeAverage", { value: (resumen.porGrado[i]?.promedio ?? 0).toFixed(2) })}</span>
                  </summary>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y border-linea text-left text-xs text-tinta-3">
                        <th className="px-3 py-2 font-medium">{t("subject")}</th>
                        <th className="w-20 px-3 py-2 text-right font-medium">{t("score")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-linea">
                      {g.notas.map((n, j) => (
                        <tr key={j}>
                          <td className="px-3 py-2 break-words">{n.materia}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{n.nota}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              ))}
            </div>

            {datos.confirmadoPor && <p className="texto-meta">{t("confirmedBy", { name: datos.confirmadoPor, date: fechaCorta(datos.confirmadoAt, lang) })}</p>}
          </>
        ) : (
          !puedeEditar && <p className="text-sm text-tinta-2">{t("empty")}</p>
        )}

        {datos.fotos.length > 0 && (
          <div className="space-y-2">
            <h3 className="texto-titulo-tarjeta">{t("photosTitle")}</h3>
            <ul className="flex flex-wrap gap-2">
              {datos.fotos.map((f, i) => (
                <li key={f.id}>
                  <a href={`/api/archivos-academicos/${f.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-linea px-3 py-1.5 text-sm font-medium text-marca-700 hover:bg-muted">
                    <FileImage className="size-4" />
                    {t("photoLink", { n: i + 1 })}
                    {f.pendiente && <span className="texto-meta font-normal">· {t("photoPending")}</span>}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {puedeEditar && <EditorRecordLiceo estudianteId={estudianteId} confirmados={datos.grados} borrador={datos.borrador} />}
        {!hayConfirmado && puedeEditar && !datos.borrador && <p className="texto-meta">{t("empty")}</p>}
      </div>
    </Seccion>
  );
}
