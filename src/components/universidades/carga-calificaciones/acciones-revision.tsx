"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Save, Trash2, UserCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { ALERTA_RIESGO } from "@/lib/paleta";
import {
  asignarEstudianteCarga,
  confirmarCargaCalificaciones,
  descartarCargaCalificaciones,
  type EstadoCarga,
} from "@/server/universidades/carga-acciones";

const INICIAL: EstadoCarga = { estado: "inicial" };

const CLASE_SELECT =
  "h-11 w-full rounded-control border border-linea-fuerte bg-background px-3 text-base text-tinta outline-none focus-visible:border-tinta focus-visible:ring-1 focus-visible:ring-tinta sm:text-[15px]";

function Error({ estado }: { estado: EstadoCarga["estado"] }) {
  const t = useTranslations("catalog.upload.errors");

  if (estado === "inicial" || estado === "ok") return null;

  return (
    <p role="alert" className={ALERTA_RIESGO.contenedor}>
      <AlertCircle className={ALERTA_RIESGO.icono} />
      <span className={ALERTA_RIESGO.texto}>{t(estado)}</span>
    </p>
  );
}

/** Elegir a mano a quién pertenece una fila que el programa no pudo emparejar. */
export function AsignarEstudiante({
  cargaId,
  filaId,
  estudiantes,
}: {
  cargaId: string;
  filaId: string;
  estudiantes: { id: string; nombre: string; matricula: string | null }[];
}) {
  const t = useTranslations("catalog.upload.review");
  const [estado, enviar, enviando] = useActionState<EstadoCarga, FormData>(asignarEstudianteCarga, INICIAL);

  return (
    <form action={enviar} className="space-y-2">
      <input type="hidden" name="carga" value={cargaId} />
      <input type="hidden" name="fila" value={filaId} />
      <div className="flex flex-wrap items-center gap-2">
        <select name="estudiante" required aria-label={t("choose")} defaultValue="" className={`${CLASE_SELECT} min-w-48 flex-1`}>
          <option value="">{t("choose")}</option>
          {estudiantes.map((e) => (
            <option key={e.id} value={e.id}>{e.nombre}{e.matricula ? ` · ${e.matricula}` : ""}</option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="outline" cargando={enviando}>
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <UserCheck className="size-4" />}
          {t("assign")}
        </Button>
      </div>
      <Error estado={estado.estado} />
    </form>
  );
}

/** Confirmar (escribe las notas y muestra las alertas) o descartar la carga. */
export function AccionesCarga({ cargaId }: { cargaId: string; hayProblemas: boolean }) {
  const t = useTranslations("catalog.upload.review");
  const [confirmacion, confirmar, confirmando] = useActionState<EstadoCarga, FormData>(confirmarCargaCalificaciones, INICIAL);
  const [descarte, descartar, descartando] = useActionState<EstadoCarga, FormData>(descartarCargaCalificaciones, INICIAL);

  if (confirmacion.estado === "ok") {
    const alertas = confirmacion.alertas ?? [];

    return (
      <div className="space-y-3" role="status">
        <p className="flex items-start gap-2 text-sm text-tinta">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-marca-700" />
          <span>{t("confirmed", { notes: confirmacion.escritas ?? 0, students: confirmacion.estudiantes ?? 0 })}</span>
        </p>
        {(confirmacion.omitidos ?? 0) > 0 && <p className="texto-meta">{t("omitted", { count: confirmacion.omitidos ?? 0 })}</p>}
        {(confirmacion.sinEstudiante ?? 0) > 0 && <p className="texto-meta">{t("noStudent", { count: confirmacion.sinEstudiante ?? 0 })}</p>}
        <p className="text-sm font-semibold">{t("alertsTitle")}</p>
        {alertas.length === 0 ? (
          <p className="texto-meta">{t("noAlerts")}</p>
        ) : (
          <ul className="space-y-2">
            {alertas.map((a) => (
              <li key={`${a.estudianteId}-${a.tipo}`} className={ALERTA_RIESGO.contenedor}>
                <AlertCircle className={ALERTA_RIESGO.icono} />
                <span className={ALERTA_RIESGO.texto}>
                  {t(a.tipo === "periodo" ? "alertPeriod" : "alertOverall", { name: a.nombre, index: a.indice.toFixed(2), min: a.umbral.toFixed(2) })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form action={confirmar}>
          <input type="hidden" name="carga" value={cargaId} />
          <Button type="submit" disabled={confirmando || descartando}>
            {confirmando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {t("confirm")}
          </Button>
        </form>
        <form action={descartar}>
          <input type="hidden" name="carga" value={cargaId} />
          <Button type="submit" variant="outline" disabled={confirmando || descartando}>
            <Trash2 className="size-4" />
            {t("discard")}
          </Button>
        </form>
      </div>
      <Error estado={confirmacion.estado} />
      <Error estado={descarte.estado} />
    </div>
  );
}
