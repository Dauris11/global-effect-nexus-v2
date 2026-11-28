"use client";

import { useActionState, useRef, useState } from "react";
import {
  AlertCircle,
  Loader2,
  MessageSquare,
  Paperclip,
  Pencil,
  Upload,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Dato, FilaDatos } from "@/components/ui/dato";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/i18n/routing";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { formatearIdentificacion } from "@/lib/contabilidad/identificacion";
import { fechaCorta } from "@/lib/fechas";
import {
  type AccionSolicitud,
  esSolicitudDinamica,
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

import {
  FormularioSolicitudDinamica,
  type CatalogosSolicitud,
} from "./formulario-solicitud-dinamica";

/**
 * Cuerpo de una solicitud: campos específicos por tipo, detalle, cotización,
 * edición (cuando está abierta), respuesta, línea de tiempo y botones de acción.
 */
export function DetalleSolicitud({
  solicitud,
  catalogos,
  className,
}: {
  solicitud: FilaSolicitud;
  catalogos?: CatalogosSolicitud;
  className?: string;
}) {
  const t = useTranslations("requests");
  const td = useTranslations("requests.dinamica");
  const locale = useLocale() as Locale;
  const comentarioRef = useRef<HTMLTextAreaElement>(null);
  const [sinMotivo, setSinMotivo] = useState(false);
  const [editando, setEditando] = useState(false);
  const [estado, enviar, enviando] = useActionState<EstadoPasoSolicitud, FormData>(
    avanzarSolicitud,
    { estado: "inicial" },
  );
  const [estadoCotizacion, enviarCotizacion, subiendoCotizacion] = useActionState<
    EstadoFormularioSolicitud,
    FormData
  >(reemplazarCotizacionCompra, { estado: "inicial" });

  const esDinamica = esSolicitudDinamica(solicitud.tipo);
  const puedeReemplazarCotizacion =
    (solicitud.tipo === "compra" ||
      solicitud.tipo === "MATERIALES" ||
      solicitud.tipo === "OTRO") &&
    solicitud.acciones.includes("cancelar");
  const puedeEditar =
    esDinamica && Boolean(catalogos) && solicitud.acciones.includes("cancelar");

  const error = sinMotivo
    ? t("step.error.falta_comentario")
    : estado.estado === "inicial" || estado.estado === "ok"
      ? null
      : t(`step.error.${estado.estado}` as never);

  function antesDeRechazar(evento: React.MouseEvent<HTMLButtonElement>) {
    if (comentarioRef.current?.value.trim()) return;

    evento.preventDefault();
    setSinMotivo(true);
    comentarioRef.current?.focus();
  }

  return (
    <div className={cn("space-y-4", className)}>
      {esDinamica && (
        <div className="space-y-3 rounded-control border border-linea bg-muted/30 p-3.5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-tinta-2">
              {t(`type.${solicitud.tipo}` as never)}
            </span>
            {puedeEditar && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setEditando(true)}
              >
                <Pencil className="size-3" />
                {td("editar")}
              </Button>
            )}
          </div>

          <dl className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
            {solicitud.tipo === "MATERIALES" && (
              <>
                {solicitud.tipo_material && (
                  <div>
                    <dt className="text-xs text-tinta-3">{td("tipoMaterial")}</dt>
                    <dd className="font-medium text-tinta">{solicitud.tipo_material}</dd>
                  </div>
                )}
                {solicitud.proveedor_catalogo && (
                  <div>
                    <dt className="text-xs text-tinta-3">{td("proveedor")}</dt>
                    <dd className="font-medium text-tinta">{solicitud.proveedor_catalogo}</dd>
                  </div>
                )}
              </>
            )}

            {solicitud.tipo === "PASAJE" && (
              <>
                <div>
                  <dt className="text-xs text-tinta-3">{td("lugar")}</dt>
                  <dd className="font-medium text-tinta">
                    {solicitud.lugar_pasaje_otro
                      ? td("lugarOtro")
                      : (solicitud.lugar_pasaje ?? "—")}
                  </dd>
                </div>
                {solicitud.lugar_pasaje_otro && solicitud.motivo_pasaje && (
                  <div>
                    <dt className="text-xs text-tinta-3">{td("motivo")}</dt>
                    <dd className="font-medium text-tinta">{solicitud.motivo_pasaje}</dd>
                  </div>
                )}
                {solicitud.periodo_pasaje && (
                  <div>
                    <dt className="text-xs text-tinta-3">{td("periodo")}</dt>
                    <dd className="font-medium text-tinta">
                      {td(`periodos.${solicitud.periodo_pasaje}` as never)}
                    </dd>
                  </div>
                )}
                {solicitud.periodo_pasaje === "personalizado" &&
                  solicitud.dias_pasaje &&
                  solicitud.dias_pasaje.length > 0 && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-tinta-3">{td("diasSemana")}</dt>
                      <dd className="mt-1 flex flex-wrap gap-1.5">
                        {solicitud.dias_pasaje.map((d) => (
                          <span
                            key={d}
                            className="rounded-full border border-marca-200 bg-marca-50 px-2.5 py-0.5 text-xs font-medium text-marca-800"
                          >
                            {td(`dias.${d}` as never)}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
              </>
            )}

            {solicitud.tipo === "OTRO" && (
              <>
                {solicitud.proposito_otro && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-tinta-3">{td("proposito")}</dt>
                    <dd className="font-medium text-tinta">{solicitud.proposito_otro}</dd>
                  </div>
                )}
                {solicitud.proveedor_nombre && (
                  <div>
                    <dt className="text-xs text-tinta-3">{td("proveedor")}</dt>
                    <dd className="font-medium text-tinta">{solicitud.proveedor_nombre}</dd>
                  </div>
                )}
                {solicitud.proveedor_rnc && (
                  <div>
                    <dt className="text-xs text-tinta-3">{td("rncProveedor")}</dt>
                    <dd className="font-mono font-medium text-tinta">
                      {formatearIdentificacion(solicitud.proveedor_rnc)}
                    </dd>
                  </div>
                )}
              </>
            )}

            {solicitud.monto !== null && (
              <div>
                <dt className="text-xs text-tinta-3">{td("monto")}</dt>
                <dd className="font-mono font-semibold tabular-nums text-marca-700">
                  {formatearMonto(solicitud.monto.toFixed(2), solicitud.moneda)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {solicitud.detalle && (
        <p className="text-sm whitespace-pre-line text-tinta-2 dark:text-tinta-2">
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
      <ol className="relative space-y-3 border-l border-linea pl-4 dark:border-linea">
        {solicitud.pasos.map((paso) => {
          const visual = visualDeSolicitud(paso.estado_nuevo);
          const IconoPaso = visual.icono;

          return (
            <li key={paso.id} className="relative">
              <span className="absolute top-0.5 -left-[25px] flex size-4 items-center justify-center rounded-full bg-card text-marca-600 dark:bg-background">
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

      {puedeEditar && catalogos && (
        <Dialog open={editando} onOpenChange={setEditando}>
          <DialogContent className="md:max-w-xl">
            <DialogHeader>
              <DialogTitle>{td("editarTitulo", { folio: solicitud.folio })}</DialogTitle>
            </DialogHeader>
            <div className="pt-2">
              <FormularioSolicitudDinamica
                catalogos={catalogos}
                solicitud={solicitud}
                alGuardar={() => setEditando(false)}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

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
        negativa && "border-tinta/30 text-tinta dark:text-tinta",
        !principal && !negativa && "border-marca-500/40 text-marca-600",
      )}
    >
      {etiqueta}
    </Button>
  );
}
