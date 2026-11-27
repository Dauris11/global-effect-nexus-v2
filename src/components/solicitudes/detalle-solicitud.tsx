"use client";

import { useActionState, useRef, useState } from "react";
import {
  AlertCircle,
  Loader2,
  MessageSquare,
  Paperclip,
  Upload,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Dato, FilaDatos } from "@/components/ui/dato";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/i18n/routing";
import { fechaCorta } from "@/lib/fechas";
import {
  type AccionSolicitud,
  MAXIMO_TEXTO,
  visualDeSolicitud,
} from "@/lib/solicitudes";
import { cn } from "@/lib/utils";
import {
  avanzarSolicitud,
  reemplazarCotizacionCompra,
  type EstadoFormularioSolicitud,
  type EstadoPasoSolicitud,
} from "@/server/solicitudes/acciones";
import type { FilaSolicitud } from "@/server/solicitudes/consultas";

/**
 * Cuerpo de una solicitud: detalle, cotización, respuesta, línea de tiempo y los
 * botones del paso siguiente. Lo comparten la tarjeta expandible (portal del
 * estudiante) y el panel lateral de la bandeja del personal, para que las dos vistas
 * no diverjan.
 *
 * Los botones salen de `solicitud.acciones`, que calculó el servidor con
 * `accionesPermitidas`. Este componente no decide nada: pinta lo que ya se
 * decidió y la acción vuelve a comprobarlo al recibir el clic. Todas las
 * acciones van en UN formulario con un botón por acción (`name="accion"`): el
 * comentario se escribe una vez y vale para el botón que se pulse. Rechazar lo exige.
 */
export function DetalleSolicitud({ solicitud, className }: { solicitud: FilaSolicitud; className?: string }) {
  const t = useTranslations("requests");
  const locale = useLocale() as Locale;
  const comentarioRef = useRef<HTMLTextAreaElement>(null);
  const [sinMotivo, setSinMotivo] = useState(false);
  const [estado, enviar, enviando] = useActionState<EstadoPasoSolicitud, FormData>(
    avanzarSolicitud,
    { estado: "inicial" },
  );
  const [estadoCotizacion, enviarCotizacion, subiendoCotizacion] = useActionState<
    EstadoFormularioSolicitud,
    FormData
  >(reemplazarCotizacionCompra, { estado: "inicial" });
  const puedeReemplazarCotizacion =
    solicitud.tipo === "compra" && solicitud.acciones.includes("cancelar");

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
    <div className={cn("space-y-4", className)}>
          {solicitud.detalle && (
            <p className="text-sm whitespace-pre-line text-tinta-2 dark:text-slate-300">
              {solicitud.detalle}
            </p>
          )}

          {solicitud.cotizacion && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
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

                {puedeReemplazarCotizacion && (
                  <form action={enviarCotizacion}>
                    <input type="hidden" name="id" value={solicitud.id} />
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-control border border-linea bg-card px-2.5 py-1 text-xs font-medium text-tinta-2 transition-colors hover:bg-muted hover:text-tinta">
                      <input
                        type="file"
                        name="cotizacion"
                        accept=".pdf,.png,.jpg,.jpeg,.docx"
                        className="sr-only"
                        disabled={subiendoCotizacion}
                        onChange={(e) => {
                          if (e.currentTarget.files?.[0]) {
                            e.currentTarget.form?.requestSubmit();
                          }
                        }}
                      />
                      {subiendoCotizacion ? (
                        <Loader2 className="size-3.5 animate-spin text-marca-500" />
                      ) : (
                        <Upload className="size-3.5 text-marca-600" />
                      )}
                      <span>
                        {subiendoCotizacion
                          ? t("purchase.replacingQuote")
                          : t("purchase.replaceQuote")}
                      </span>
                    </label>
                  </form>
                )}
              </div>

              {estadoCotizacion.estado !== "inicial" &&
                estadoCotizacion.estado !== "ok" && (
                  <p className="flex items-center gap-1.5 text-xs text-tinta">
                    <AlertCircle className="size-3.5 shrink-0" />
                    {t(`form.error.${estadoCotizacion.estado}` as never)}
                  </p>
                )}
            </div>
          )}

          {solicitud.respuesta && (
            <div className="flex items-start gap-2 rounded-lg bg-marca-500/10 p-3 text-xs text-marca-700">
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
                  <span className="absolute top-0.5 -left-[25px] flex size-4 items-center justify-center rounded-full bg-card text-marca-600 dark:bg-slate-950">
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
                aria-label={t("step.comment")}
                className="text-sm"
              />

              {error && (
                <p
                  role="alert"
                  className="flex items-center gap-2 rounded-control bg-tinta px-3 py-2 text-xs text-background"
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
                {enviando && <Loader2 className="size-4 animate-spin self-center text-marca-500" />}
              </div>
            </form>
          )}
        </div>
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
        principal && "bg-marca-500 text-white hover:bg-marca-600",
        negativa && "border-tinta/30 text-tinta dark:text-slate-200",
        !principal && !negativa && "border-marca-500/40 text-marca-600",
      )}
    >
      {etiqueta}
    </Button>
  );
}
