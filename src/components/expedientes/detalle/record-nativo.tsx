"use client";

import { useActionState, useMemo, useState } from "react";
import { CheckCircle2, Circle, Clock, Loader2, MinusCircle, Trash2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { CLASE_SELECT } from "@/components/universidades/formularios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { quitarResultado, type EstadoCalificaciones } from "@/server/universidades/calificaciones";
import type { EstadoMateria, RecordNativo } from "@/server/universidades/consultas";

const ICONO: Record<EstadoMateria, typeof Circle> = {
  aprobada: CheckCircle2,
  reprobada: XCircle,
  retirada: MinusCircle,
  cursando: Clock,
  pendiente: Circle,
};

/**
 * El récord de notas por cuatrimestre, con el índice de cada uno y dos filtros:
 * el cuatrimestre y «solo con problemas» (reprobadas, retiradas y las que están
 * justo en la letra mínima). Es lo que reemplaza leer el reporte entero para
 * encontrar qué salió mal. Los datos ya vienen calculados del servidor: aquí solo
 * se filtra.
 */
export function RecordPorCuatrimestre({ record, umbral, puedeEditar }: { record: RecordNativo; umbral: number; puedeEditar: boolean }) {
  const t = useTranslations("catalog");
  const [periodo, setPeriodo] = useState("todos");
  const [soloProblemas, setSoloProblemas] = useState(false);

  const visibles = useMemo(
    () =>
      record.periodos
        .filter((p) => periodo === "todos" || p.periodo === periodo)
        .map((p) => ({
          ...p,
          intentos: p.intentos.filter((i) => !soloProblemas || i.estado === "reprobada" || i.estado === "retirada" || i.enLimite),
        }))
        .filter((p) => p.intentos.length > 0),
    [record, periodo, soloProblemas],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-48 space-y-1.5">
          <Label htmlFor="rec-periodo">{t("record.period")}</Label>
          <select id="rec-periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={CLASE_SELECT}>
            <option value="todos">{t("record.allPeriods")}</option>
            {record.periodos.map((p) => <option key={p.periodo} value={p.periodo}>{p.periodo}</option>)}
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={soloProblemas} onChange={(e) => setSoloProblemas(e.target.checked)} className="size-4" />
          {t("record.onlyProblems")}
        </label>
      </div>

      {visibles.length === 0 ? (
        <p className="texto-meta">{t("record.nothing")}</p>
      ) : (
        visibles.map((p) => (
          <section key={p.periodo} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{p.periodo}</h3>
              <Badge variant={p.indice !== null && p.indice < umbral ? "solida" : "marca"}>
                {t("record.periodIndex")} {p.indice !== null ? p.indice.toFixed(2) : "—"}
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-linea text-left text-xs text-tinta-3">
                    <th className="py-2 font-medium">{t("progress.code")}</th>
                    <th className="py-2 font-medium">{t("progress.subject")}</th>
                    <th className="w-14 py-2 text-right font-medium">{t("progress.creditsShort")}</th>
                    <th className="w-16 py-2 text-center font-medium">{t("record.grade")}</th>
                    <th className="w-44 py-2 text-right font-medium">{t("progress.state")}</th>
                    {puedeEditar && <th className="w-12 py-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-linea">
                  {p.intentos.map((i) => {
                    const Icono = ICONO[i.estado];

                    return (
                      <tr key={i.id}>
                        <td className="py-2 pr-2 font-medium">{i.codigo}</td>
                        <td className="py-2 pr-2 break-words">
                          {i.nombre}
                          {i.detalle && <span className="texto-meta block">{i.detalle}</span>}
                        </td>
                        <td className="py-2 text-right tabular-nums">{i.creditos}</td>
                        <td className="py-2 text-center font-semibold">{i.letra}{i.nota !== null && <span className="texto-meta block font-normal">{i.nota}</span>}</td>
                        <td className="py-2 text-right">
                          <span className="inline-flex flex-wrap justify-end gap-1">
                            <Badge variant={i.estado === "aprobada" ? "marca" : "neutra"} className="gap-1">
                              <Icono className="size-3" />
                              {t(`progress.${i.estado}`)}
                            </Badge>
                            {i.enLimite && <Badge variant="neutra">{t("record.atLimit")}</Badge>}
                            {!i.vigente && <Badge variant="neutra">{t("record.previousAttempt")}</Badge>}
                          </span>
                        </td>
                        {puedeEditar && (
                          <td className="py-2 text-right">
                            {i.fuente !== "gradua" && <BotonQuitarResultado id={i.id} />}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function BotonQuitarResultado({ id }: { id: string }) {
  const t = useTranslations("catalog");
  const [, enviar, enviando] = useActionState<EstadoCalificaciones, FormData>(quitarResultado, { estado: "inicial" });

  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="sm" cargando={enviando} aria-label={t("record.remove")}>
        {enviando ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </Button>
    </form>
  );
}
