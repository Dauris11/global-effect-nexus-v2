"use client";

import { useActionState, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  DollarSign,
  Loader2,
  MessageSquare,
  Paperclip,
  ShieldCheck,
  User,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dato, FilaDatos } from "@/components/ui/dato";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/i18n/routing";
import { fechaConHora, fechaCorta } from "@/lib/fechas";
import { montoUsd } from "@/lib/finanzas";
import {
  type AccionSolicitud,
  MAXIMO_TEXTO,
  visualDeSolicitud,
} from "@/lib/solicitudes";
import { cn } from "@/lib/utils";
import {
  avanzarSolicitud,
  type EstadoPasoSolicitud,
} from "@/server/solicitudes/acciones";
import type { FilaSolicitud } from "@/server/solicitudes/consultas";

/**
 * Una solicitud con su línea de tiempo y, si a quien mira le toca algo, los
 * botones del paso siguiente.
 *
 * Los botones salen de `solicitud.acciones`, que calculó el servidor con
 * `accionesPermitidas`. Este componente no decide nada: pinta lo que ya se
 * decidió y la acción vuelve a comprobarlo al recibir el clic.
 *
 * Todas las acciones van en UN formulario con un botón por acción
 * (`name="accion"`): el comentario se escribe una vez y vale para el botón que
 * se pulse. Rechazar lo exige; el resto lo admite.
 */
export function TarjetaSolicitud({
  solicitud,
  mostrarSolicitante = false,
}: {
  solicitud: FilaSolicitud;
  /** En la bandeja de quien revisa sí importa quién lo pidió. */
  mostrarSolicitante?: boolean;
}) {
  const t = useTranslations("requests");
  const locale = useLocale() as Locale;
  const [abierta, setAbierta] = useState(solicitud.acciones.length > 0);
  const comentarioRef = useRef<HTMLTextAreaElement>(null);
  const [sinMotivo, setSinMotivo] = useState(false);
  const [estado, enviar, enviando] = useActionState<EstadoPasoSolicitud, FormData>(
    avanzarSolicitud,
    { estado: "inicial" },
  );

  const { insignia, icono: Icono } = visualDeSolicitud(solicitud.estado);

  const error = sinMotivo
    ? t("step.error.falta_comentario")
    : estado.estado === "inicial" || estado.estado === "ok"
      ? null
      : t(`step.error.${estado.estado}` as never);

  // Rechazar sin motivo se corta aquí para no hacer el viaje; el servidor lo
  // vuelve a exigir, que es el control de verdad.
  function antesDeRechazar(evento: React.MouseEvent<HTMLButtonElement>) {
    if (comentarioRef.current?.value.trim()) return;

    evento.preventDefault();
    setSinMotivo(true);
    comentarioRef.current?.focus();
  }

  return (
    <li className="rounded-xl border border-linea/80 bg-card shadow-xs transition-all duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
      <button
        type="button"
        onClick={() => setAbierta((valor) => !valor)}
        aria-expanded={abierta}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#2096BA]/15 text-[#187a99]">
          <Icono className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs font-semibold tabular-nums">
              #{solicitud.folio}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {t(`type.${solicitud.tipo}` as never)}
            </Badge>
            {solicitud.requiere_direccion && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <ShieldCheck className="size-3" />
                {t("needsDirection")}
              </Badge>
            )}
          </div>

          <p className="mt-1 truncate text-sm font-bold">{solicitud.titulo}</p>

          <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {mostrarSolicitante && solicitud.solicitante && (
              <span className="flex items-center gap-1">
                <User className="size-3" />
                {solicitud.solicitante}
              </span>
            )}
            {solicitud.estudiante && solicitud.estudiante !== solicitud.solicitante && (
              <span>{t("meta.student", { nombre: solicitud.estudiante })}</span>
            )}
            {solicitud.monto !== null && (
              <span className="flex items-center gap-1">
                <DollarSign className="size-3" />
                {montoUsd(solicitud.monto)}
              </span>
            )}
            {solicitud.fecha_requerida && (
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3" />
                {fechaConHora(solicitud.fecha_requerida, solicitud.hora_preferida, locale)}
              </span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge className={cn("text-[10px]", insignia)}>
            {t(`status.${solicitud.estado}` as never)}
          </Badge>
          <ChevronDown
            className={cn(
              "text-muted-foreground size-4 transition-transform",
              abierta && "rotate-180",
            )}
          />
        </div>
      </button>

      {abierta && (
        <div className="space-y-4 border-t border-linea px-4 pt-3 pb-4 dark:border-slate-800">
          {solicitud.detalle && (
            <p className="text-sm whitespace-pre-line text-tinta-2 dark:text-slate-300">
              {solicitud.detalle}
            </p>
          )}

          {solicitud.cotizacion && (
            <FilaDatos>
              <Dato icono={Paperclip}>
                <a
                  href={`/api/solicitudes/${solicitud.id}/cotizacion`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-marca-600 hover:underline"
                  title={t("purchase.download")}
                >
                  {solicitud.cotizacion.nombre}
                </a>
              </Dato>
            </FilaDatos>
          )}

          {solicitud.respuesta && (
            <div className="flex items-start gap-2 rounded-lg bg-[#2096BA]/10 p-3 text-xs text-[#0a6a8a]">
              <MessageSquare className="mt-0.5 size-3.5 shrink-0" />
              <div>
                <p className="font-semibold">
                  {solicitud.responsable
                    ? t("answerFrom", { nombre: solicitud.responsable })
                    : t("answer")}
                </p>
                <p className="mt-0.5 whitespace-pre-line">{solicitud.respuesta}</p>
              </div>
            </div>
          )}

          {/* Línea de tiempo: cada paso con quién, cuándo y por qué. */}
          <ol className="relative space-y-3 border-l border-linea pl-4 dark:border-slate-800">
            {solicitud.pasos.map((paso) => {
              const visual = visualDeSolicitud(paso.estado_nuevo);
              const IconoPaso = visual.icono;

              return (
                <li key={paso.id} className="relative">
                  <span className="absolute top-0.5 -left-[25px] flex size-4 items-center justify-center rounded-full bg-card text-[#187a99] dark:bg-slate-950">
                    <IconoPaso className="size-3.5" />
                  </span>
                  <p className="text-xs font-semibold">
                    {t(`status.${paso.estado_nuevo}` as never)}
                    <span className="text-muted-foreground font-normal">
                      {" · "}
                      {paso.usuario ?? t("unknownUser")}
                      {" · "}
                      {fechaCorta(paso.creado.slice(0, 10), locale)}
                    </span>
                  </p>
                  {paso.comentario && (
                    <p className="text-muted-foreground mt-0.5 text-xs whitespace-pre-line">
                      {paso.comentario}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>

          {solicitud.acciones.length > 0 && (
            <form action={enviar} className="space-y-2">
              <input type="hidden" name="id" value={solicitud.id} />
              <Textarea
                ref={comentarioRef}
                name="comentario"
                onChange={() => setSinMotivo(false)}
                rows={2}
                maxLength={MAXIMO_TEXTO}
                placeholder={t("step.commentPlaceholder")}
                aria-label={t("step.comment")}
                className="text-sm"
              />

              {error && (
                <p
                  role="alert"
                  className="flex items-center gap-2 rounded-lg bg-[#171A1D] px-3 py-2 text-xs text-white"
                >
                  <AlertCircle className="size-3.5 shrink-0" />
                  {error}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {solicitud.acciones.map((accion) => (
                  <BotonAccion
                    key={accion}
                    accion={accion}
                    etiqueta={t(`step.action.${accion}` as never)}
                    deshabilitado={enviando}
                    alPulsar={accion === "rechazar" ? antesDeRechazar : undefined}
                  />
                ))}
                {enviando && <Loader2 className="size-4 animate-spin self-center text-[#2096BA]" />}
              </div>
            </form>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Peso y no color: aprobar es la acción principal (azul lleno), rechazar y
 * cancelar van en tinta con borde, el resto en contorno azul.
 */
function BotonAccion({
  accion,
  etiqueta,
  deshabilitado,
  alPulsar,
}: {
  accion: AccionSolicitud;
  etiqueta: string;
  deshabilitado: boolean;
  alPulsar?: (evento: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const principal =
    accion === "aprobar" || accion === "aprobar_direccion" || accion === "completar";
  const negativa = accion === "rechazar" || accion === "cancelar";

  return (
    <Button
      type="submit"
      name="accion"
      value={accion}
      size="sm"
      disabled={deshabilitado}
      onClick={alPulsar}
      variant={principal ? "default" : "outline"}
      className={cn(
        "rounded-md active:scale-[0.99]",
        principal && "bg-[#2096BA] text-white hover:bg-[#187a99]",
        negativa && "border-[#171A1D]/30 text-[#171A1D] dark:text-slate-200",
        !principal && !negativa && "border-[#2096BA]/40 text-[#187a99]",
      )}
    >
      {etiqueta}
    </Button>
  );
}
