import { CheckCircle2, Circle, Clock, MinusCircle, XCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { textoDePuntos } from "@/lib/indice-academico";
import type { CatalogoDelEstudiante, EstadoMateria } from "@/server/universidades/consultas";

const ICONO: Record<EstadoMateria, typeof Circle> = {
  aprobada: CheckCircle2,
  reprobada: XCircle,
  retirada: MinusCircle,
  cursando: Clock,
  pendiente: Circle,
};

/**
 * El «gradua» vivo: el pénsum del estudiante materia por materia, agrupado por
 * período del plan como el reporte oficial, con su resultado, los totales por
 * período y el índice calculado con las reglas de SU universidad. No es una copia
 * del PDF: se recalcula al mostrarse con el gradua más reciente y con las notas
 * que haya en el sistema, así que cambia solo cuando entran calificaciones.
 *
 * El estado se dice con icono y texto (no con colores de alarma) para que se lea
 * igual en grises. Una materia sin ningún resultado es «pendiente», no «aprobada».
 */
export async function GraduaViva({ catalogo }: { catalogo: CatalogoDelEstudiante }) {
  const t = await getTranslations("catalog");
  const { materias, creditosAprobados: ap, creditosTotales: tot, indice, reglas, gradua } = catalogo;
  const pct = tot > 0 ? Math.round((ap / tot) * 100) : 0;

  if (materias.length === 0) {
    return <p className="mt-4 rounded-control bg-marca-50 px-4 py-3 text-sm text-marca-700">{t("progress.emptyPensum")}</p>;
  }

  const periodos = [...new Set(materias.map((m) => m.periodo_sugerido ?? 0))].sort((a, b) => a - b);
  // Coincide si el índice del sistema es el que imprime el reporte: es la prueba de
  // que las reglas de la universidad están bien puestas.
  const coincide = gradua?.indiceReportado != null && indice?.indice != null && gradua.indiceReportado === indice.indice;

  return (
    <div className="mt-4 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium">{t("progress.credits", { approved: ap, total: tot, percent: pct })}</p>
          <Progress value={pct} aria-label={t("progress.credits", { approved: ap, total: tot, percent: pct })} className="mt-2" />
        </div>
        <div className="sm:text-right">
          <p className="text-2xl leading-none font-bold">{indice?.indice != null ? indice.indice.toFixed(2) : "—"}</p>
          <p className="texto-meta mt-1">{t("progress.generalIndex")}</p>
        </div>
      </div>

      {reglas && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={reglas.confirmadas ? "marca" : "neutra"}>{reglas.confirmadas ? t("rules.confirmedBadge") : t("rules.pendingBadge")}</Badge>
          <span className="texto-meta">
            {t("rules.summary", {
              points: textoDePuntos(reglas.puntosPorLetra),
              min: reglas.letraMinima,
              withdrawn: reglas.retiradaCuentaEnDivisor ? t("rules.withdrawnYes") : t("rules.withdrawnNo"),
              rounding: reglas.redondeo === "truncar" ? t("rules.truncate") : t("rules.round"),
            })}
          </span>
        </div>
      )}

      {gradua ? (
        <p className="text-sm">
          {coincide
            ? t("progress.graduaMatches", { date: gradua.subidoEl ?? "", index: gradua.indiceReportado?.toFixed(2) ?? "" })
            : t("progress.graduaDiffers", { date: gradua.subidoEl ?? "", reported: gradua.indiceReportado?.toFixed(2) ?? "—", computed: indice?.indice?.toFixed(2) ?? "—" })}
          {gradua.fueraDelPensum.length > 0 && ` ${t("progress.outsidePensum", { codes: gradua.fueraDelPensum.join(", ") })}`}
        </p>
      ) : (
        <p className="texto-meta">{t("progress.noGradua")}</p>
      )}

      {periodos.map((n) => {
        const filas = materias.filter((m) => (m.periodo_sugerido ?? 0) === n);
        const cursadas = filas.filter((m) => m.letra);
        const cred = cursadas.reduce((a, m) => a + m.creditos, 0);
        const pts = cursadas.reduce((a, m) => a + (m.puntos ?? 0), 0);

        return (
          <section key={n} className="space-y-2">
            <h3 className="text-sm font-semibold">{n === 0 ? t("progress.noPeriod") : t("progress.period", { n })}</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-linea text-left text-xs text-tinta-3">
                    <th className="py-2 font-medium">{t("progress.code")}</th>
                    <th className="py-2 font-medium">{t("progress.subject")}</th>
                    <th className="w-14 py-2 text-right font-medium">{t("progress.creditsShort")}</th>
                    <th className="w-16 py-2 text-right font-medium">{t("progress.points")}</th>
                    <th className="w-28 py-2 text-center font-medium">{t("progress.periodGrade")}</th>
                    <th className="w-32 py-2 text-right font-medium">{t("progress.state")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-linea">
                  {filas.map((m) => {
                    const Icono = ICONO[m.estado];

                    return (
                      <tr key={m.id}>
                        <td className="py-2 pr-2 font-medium">{m.codigo}</td>
                        <td className="py-2 pr-2 break-words">
                          {m.nombre}
                          {m.detalle && <span className="texto-meta block">{m.detalle}</span>}
                        </td>
                        <td className="py-2 text-right tabular-nums">{m.creditos}</td>
                        <td className="py-2 text-right tabular-nums">{m.puntos ?? "—"}</td>
                        <td className="py-2 text-center">{m.letra ? `${m.periodo ?? ""} ${m.letra}`.trim() : "—"}</td>
                        <td className="py-2 text-right">
                          <Badge variant={m.estado === "aprobada" ? "marca" : "neutra"} className="gap-1">
                            <Icono className="size-3" />
                            {t(`progress.${m.estado}`)}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-linea text-xs text-tinta-3">
                    <td colSpan={2} className="py-2">{t("progress.periodTotal")}</td>
                    <td className="py-2 text-right tabular-nums">{cred}</td>
                    <td className="py-2 text-right tabular-nums">{pts}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
