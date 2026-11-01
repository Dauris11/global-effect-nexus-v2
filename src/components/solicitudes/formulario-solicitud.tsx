"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  HORAS_CITA,
  MAXIMO_TEXTO,
  MAXIMO_TITULO,
  REGLAS,
  type TipoSolicitud,
  UMBRAL_DIRECCION_USD,
} from "@/lib/solicitudes";
import {
  crearSolicitudInterna,
  crearTramite,
  type EstadoFormularioSolicitud,
} from "@/server/solicitudes/acciones";
import type { EstudianteOpcion } from "@/server/solicitudes/consultas";

/** Clase del desplegable nativo, la misma del resto del proyecto. */
const SELECT =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm dark:bg-slate-950";

/** Estados de expediente que todavía están en el embudo. */
const EMBUDO = ["reclutado", "postulado", "academia_liderazgo", "standby_tecnico"];

/**
 * Formulario de una solicitud nueva. Uno solo para los dos lados.
 *
 * `origen` decide a qué acción va: el estudiante pide un trámite y su ficha
 * sale de la sesión; el personal pide una aprobación y nombra al estudiante.
 * Los campos que se pintan salen de `REGLAS`, la misma tabla con la que el
 * servidor valida: si un tipo no lleva monto, aquí no aparece y allí se ignora.
 */
export function FormularioSolicitud({
  origen,
  tipos,
  estudiantes = [],
  minimoFecha,
}: {
  origen: "estudiante" | "personal";
  /** Los tipos que esta persona puede pedir, ya filtrados en el servidor. */
  tipos: readonly TipoSolicitud[];
  estudiantes?: readonly EstudianteOpcion[];
  /** Hoy, `YYYY-MM-DD`, calculado en el servidor. */
  minimoFecha: string;
}) {
  const t = useTranslations("requests");
  const [tipo, setTipo] = useState<TipoSolicitud | undefined>(tipos[0]);
  const [estado, enviar, enviando] = useActionState<
    EstadoFormularioSolicitud,
    FormData
  >(origen === "estudiante" ? crearTramite : crearSolicitudInterna, {
    estado: "inicial",
  });

  if (!tipo) return null;

  const regla = REGLAS[tipo];

  // El alta es de candidatos del embudo; la beca, de quien ya estudia o va a
  // estudiar. Ofrecer los demás solo invita a equivocarse de persona.
  const opciones =
    tipo === "alta_expediente"
      ? estudiantes.filter((estudiante) => EMBUDO.includes(estudiante.estado))
      : estudiantes;

  const error =
    estado.estado === "inicial" || estado.estado === "ok"
      ? null
      : t(`form.error.${estado.estado}` as never);

  return (
    <form action={enviar} className="space-y-4">
      {estado.estado === "ok" && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg bg-[#2096BA]/15 px-3 py-2 text-xs font-medium text-[#187a99]"
        >
          <CheckCircle2 className="size-4 shrink-0" />
          {t("form.success")}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tipo" className="text-xs font-medium">
            {t("form.type")}
          </Label>
          <select
            id="tipo"
            name="tipo"
            value={tipo}
            onChange={(evento) => setTipo(evento.target.value as TipoSolicitud)}
            className={SELECT}
          >
            {tipos.map((opcion) => (
              <option key={opcion} value={opcion}>
                {t(`type.${opcion}` as never)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="titulo" className="text-xs font-medium">
            {t("form.title")}
          </Label>
          <Input
            id="titulo"
            name="titulo"
            required
            maxLength={MAXIMO_TITULO}
            placeholder={t(`titlePlaceholder.${tipo}` as never)}
          />
        </div>

        {origen === "personal" && regla.estudiante !== "no" && (
          <div className="space-y-1.5">
            <Label htmlFor="estudiante" className="text-xs font-medium">
              {t("form.student")}
            </Label>
            <select
              id="estudiante"
              name="estudiante"
              required={regla.estudiante === "obligatorio"}
              defaultValue=""
              className={SELECT}
            >
              <option value="" disabled>
                {t("form.studentPlaceholder")}
              </option>
              {opciones.map((estudiante) => (
                <option key={estudiante.id} value={estudiante.id}>
                  {estudiante.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        {regla.monto !== "no" && (
          <div className="space-y-1.5">
            <Label htmlFor="monto" className="text-xs font-medium">
              {t("form.amount")}
            </Label>
            <Input
              id="monto"
              name="monto"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              required={regla.monto === "obligatorio"}
            />
            {tipo === "gasto" && (
              <p className="text-muted-foreground text-[11px]">
                {t("form.amountHint", { umbral: UMBRAL_DIRECCION_USD })}
              </p>
            )}
          </div>
        )}

        {regla.fecha !== "no" && (
          <div className="space-y-1.5">
            <Label htmlFor="fecha" className="text-xs font-medium">
              {t(`dateLabel.${tipo}` as never)}
            </Label>
            <Input
              id="fecha"
              name="fecha"
              type="date"
              min={minimoFecha}
              required={regla.fecha === "obligatorio"}
            />
          </div>
        )}

        {tipo === "cita_administracion" && (
          <div className="space-y-1.5">
            <Label htmlFor="hora" className="text-xs font-medium">
              {t("form.time")}
            </Label>
            <select id="hora" name="hora" defaultValue="" className={SELECT}>
              <option value="">{t("form.timeAny")}</option>
              {HORAS_CITA.map((hora) => (
                <option key={hora} value={hora}>
                  {hora}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="detalle" className="text-xs font-medium">
          {t("form.detail")}
        </Label>
        <Textarea
          id="detalle"
          name="detalle"
          rows={3}
          maxLength={MAXIMO_TEXTO}
          placeholder={t("form.detailPlaceholder")}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-[#171A1D] px-3 py-2 text-xs text-white"
        >
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={enviando}
        className="rounded-md bg-[#2096BA] text-white hover:bg-[#187a99] active:scale-[0.99]"
      >
        {enviando ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Send className="size-4" />
        )}
        {enviando ? t("form.sending") : t("form.submit")}
      </Button>
    </form>
  );
}
