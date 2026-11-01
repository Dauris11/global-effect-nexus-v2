"use client";

import { useActionState, useState } from "react";
import { Calculator, Loader2, Save, UserCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dato, FilaDatos } from "@/components/ui/dato";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/routing";
import { fechaCorta } from "@/lib/fechas";
import { NOTA_APROBADA } from "@/lib/notas";
import { cn } from "@/lib/utils";
import {
  calificarInscripcion360,
  type EstadoAcademico,
} from "@/server/profesor/acciones";
import type { InscritoEn360 } from "@/server/profesor/consultas";

type Decision = "aprobada" | "reprobada";

/**
 * Un inscrito de una clase de 360: avance, nota propuesta y cierre de la nota.
 *
 * La propuesta sale de las tareas del período (`calcularNotaFinal`) y NO se
 * escribe sola: el botón la copia al campo y el profesor puede teclear otra
 * (un examen oral, la participación). La decisión aprobó/reprobó es suya: el
 * umbral solo propone cuál marcar hasta que él elige.
 */
export function FilaInscrito({
  fila,
  puedeCalificar,
}: {
  fila: InscritoEn360;
  puedeCalificar: boolean;
}) {
  const t = useTranslations("academic.classes360");
  const idioma = useLocale() as Locale;
  const [estado, enviar, enviando] = useActionState<EstadoAcademico, FormData>(
    calificarInscripcion360,
    { estado: "inicial" },
  );

  const [nota, setNota] = useState(fila.nota === null ? "" : String(fila.nota));
  // `null` = no ha elegido: se sigue el umbral. Una vez elige, manda su elección.
  const [elegida, setElegida] = useState<Decision | null>(
    fila.estado === "aprobada" || fila.estado === "reprobada" ? fila.estado : null,
  );

  const retirada = fila.estado === "retirada";
  const valor = nota.trim() === "" ? null : Number(nota);
  const sugerida: Decision | null =
    valor === null || !Number.isFinite(valor)
      ? null
      : valor >= NOTA_APROBADA
        ? "aprobada"
        : "reprobada";
  const decision = elegida ?? sugerida;

  return (
    <li className="bg-muted/40 rounded-control space-y-2 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{fila.nombre}</span>
          <span className="text-tinta-3 block truncate">
            {[fila.periodo, t("round", { ronda: fila.ronda }), t(`status.${fila.estado}` as never)]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>

        <Badge
          className={cn(
            "text-[10px]",
            fila.tareas > 0 && fila.entregadas >= fila.tareas
              ? "bg-marca-700 text-white"
              : "bg-marca-500/15 text-marca-600",
          )}
        >
          {t("compliance")}: {fila.entregadas}/{fila.tareas}
        </Badge>
      </div>

      <FilaDatos>
        <Dato icono={Calculator} className="text-xs">
          {t("proposedGrade")}: <b>{fila.notaPropuesta?.toFixed(1) ?? "—"}</b>
        </Dato>

        {fila.decidida_por && fila.decidida_en && (
          <Dato icono={UserCheck} className="text-xs">
            {t("decidedBy", {
              nombre: fila.decidida_por,
              fecha: fechaCorta(fila.decidida_en, idioma),
            })}
          </Dato>
        )}
      </FilaDatos>

      {puedeCalificar && !retirada ? (
        <form action={enviar} className="flex flex-wrap items-center gap-1.5">
          <input type="hidden" name="id" value={fila.id} />
          <input type="hidden" name="decision" value={decision ?? ""} />

          <Label htmlFor={`nota-${fila.id}`} className="sr-only">
            {t("finalGrade")}
          </Label>
          <Input
            id={`nota-${fila.id}`}
            name="nota"
            type="number"
            min={0}
            max={100}
            step="0.1"
            placeholder={t("finalGrade")}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            className="h-8 w-24 text-xs"
            aria-invalid={estado.estado === "nota_invalida" || undefined}
          />

          {fila.notaPropuesta !== null && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setNota(String(fila.notaPropuesta))}
            >
              {t("useProposal")}
            </Button>
          )}

          <div
            role="group"
            aria-label={t("decision")}
            className="rounded-control border-linea flex overflow-hidden border"
          >
            {(["aprobada", "reprobada"] as const).map((opcion) => (
              <button
                key={opcion}
                type="button"
                aria-pressed={decision === opcion}
                disabled={valor === null}
                onClick={() => setElegida(opcion)}
                className={cn(
                  "min-h-8 px-3 text-xs font-medium disabled:opacity-50",
                  decision === opcion ? "bg-tinta text-background" : "bg-card text-tinta-2",
                )}
              >
                {opcion === "aprobada" ? t("decisionApproved") : t("decisionFailed")}
              </button>
            ))}
          </div>

          <Button
            type="submit"
            size="icon"
            variant="ghost"
            disabled={enviando}
            title={t("saveGrade")}
            aria-label={t("saveGrade")}
          >
            {enviando ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
          </Button>
        </form>
      ) : (
        <p className="text-tinta-3">
          {t("finalGrade")}: <b>{fila.nota?.toFixed(1) ?? "—"}</b>
        </p>
      )}

      {estado.estado === "ok" && (
        <p className="text-marca-600 text-[11px] font-medium">{t("gradeSaved")}</p>
      )}

      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className="text-destructive text-[11px]">
          {estado.estado === "nota_invalida"
            ? t("errGrade")
            : estado.estado === "decision_invalida"
              ? t("errDecision")
              : estado.estado === "no_encontrado"
                ? t("errOwner")
                : t("errGeneric")}
        </p>
      )}
    </li>
  );
}
