"use client";

import { useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { FotoEstudiante } from "@/components/expedientes/foto-estudiante";
import { CeldaAcciones } from "@/components/app/celda-acciones";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { Locale } from "@/i18n/routing";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { fechaCorta } from "@/lib/fechas";
import { montoUsd } from "@/lib/finanzas";
import type { AccionSolicitud } from "@/lib/solicitudes";
import type { FilaSolicitud } from "@/server/solicitudes/consultas";

import {
  accionesEnFila,
  ConfirmarAccionSolicitud,
  personaDeSolicitud,
} from "./confirmar-accion-solicitud";
import { DetalleSolicitud } from "./detalle-solicitud";
import type { CatalogosSolicitud } from "./formulario-solicitud-dinamica";

/**
 * Bandeja de solicitudes (patrón Lista, docs/ux-rules.md): tabla densa; en pantalla
 * estrecha desplaza dentro de su contenedor. Un clic en la fila abre el panel lateral con el detalle y
 * los pasos; aprobar y rechazar se resuelven en la propia fila, con una confirmación
 * que nombra la solicitud.
 *
 * Hay UN solo panel y UN solo diálogo para toda la lista, no uno por fila: el estado
 * guarda el id y se busca en `filas`, así que tras `router.refresh()` el panel abierto
 * enseña el dato nuevo en vez de una copia vieja.
 */
export function ListaSolicitudes({
  filas,
  mostrarSolicitante,
  resaltarId,
  catalogos,
}: {
  filas: readonly FilaSolicitud[];
  /** En la bandeja de quien revisa importa quién lo pidió; en «lo mío» no. */
  mostrarSolicitante: boolean;
  /** Solicitud recién creada: entra resaltada unos segundos. */
  resaltarId?: string;
  catalogos?: CatalogosSolicitud;
}) {
  const t = useTranslations("requests");
  const tl = useTranslations("listas");
  const locale = useLocale() as Locale;
  const [abiertaId, setAbiertaId] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<{ id: string; accion: AccionSolicitud } | null>(null);

  const abierta = filas.find((f) => f.id === abiertaId) ?? null;
  const porConfirmar = confirmando ? (filas.find((f) => f.id === confirmando.id) ?? null) : null;
  const l = (clave: string) => tl(`solicitudes.${clave}` as never);

  const fecha = (fila: FilaSolicitud) => fechaCorta(fila.creada.slice(0, 10), locale);
  const persona = (fila: FilaSolicitud) => personaDeSolicitud(fila, t("unknownUser"));
  const formatoMontoFila = (fila: FilaSolicitud) =>
    fila.monto === null
      ? null
      : fila.moneda === "DOP"
        ? formatearMonto(fila.monto.toFixed(2), "DOP")
        : montoUsd(fila.monto);

  return (
    <>
      <div className="overflow-x-auto rounded-card border border-linea bg-card shadow-card">
        {/* Misma tabla en todos los anchos: en el móvil el contenedor desplaza en horizontal y la
            columna Solicitud (izquierda) y las acciones (derecha) quedan fijas. `table-fixed` +
            `colgroup` dan anchos definidos y la columna Solicitud, sin ancho, absorbe el sobrante,
            así que no queda hueco a la derecha. */}
        <table className="w-full min-w-[960px] table-fixed text-sm">
          <colgroup>
            <col />
            <col className="w-[150px]" />
            {mostrarSolicitante && <col className="w-[180px]" />}
            <col className="w-[110px]" />
            <col className="w-[110px]" />
            <col className="w-[190px]" />
          </colgroup>
          <thead className="text-meta border-b border-linea text-left">
            <tr>
              <th className="sticky left-0 z-10 min-w-[320px] bg-card px-4 py-3 font-medium">{l("column.request")}</th>
              <th className="px-4 py-3 font-medium">{l("column.status")}</th>
              {mostrarSolicitante && <th className="px-4 py-3 font-medium">{l("column.requester")}</th>}
              <th className="px-4 py-3 text-right font-medium">{l("column.amount")}</th>
              <th className="px-4 py-3 font-medium">{l("column.date")}</th>
              <th className="sticky right-0 z-10 bg-card px-4 py-3">
                <span className="sr-only">{l("column.actions")}</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-linea">
            {filas.map((fila) => {
              const { positiva, puedeRechazar } = accionesEnFila(fila.acciones);

              return (
                <tr
                  key={fila.id}
                  // El botón de la primera celda es el control accesible; el clic en el resto de la fila
                  // hace lo mismo con el ratón (sin él, la capa que cubría la fila no cabe en una celda fija).
                  onClick={(e) => !(e.target as HTMLElement).closest("button, a") && setAbiertaId(fila.id)}
                  className={`group h-[52px] cursor-pointer transition-colors hover:bg-muted/50 ${fila.id === resaltarId ? "animate-resaltar" : ""}`}
                >
                  <td className="sticky left-0 z-10 min-w-[320px] bg-surface px-4 py-1.5 transition-colors group-hover:bg-muted">
                    <button
                      type="button"
                      onClick={() => setAbiertaId(fila.id)}
                      aria-label={`${l("view")}: ${fila.titulo}`}
                      className="flex w-full min-w-0 items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <FotoEstudiante nombre={persona(fila)} url={null} className="size-9 shrink-0 rounded-full" />
                      <span className="min-w-0">
                        <span className="line-clamp-2 text-sm font-semibold">{fila.titulo}</span>
                        <span className="text-meta block truncate">
                          #{fila.folio} · {t(`type.${fila.tipo}` as never)}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <StatusBadge status={fila.estado} />
                      {fila.requiere_direccion && (
                        <ShieldCheck aria-label={t("needsDirection")} className="size-4 text-tinta-3" />
                      )}
                    </span>
                  </td>
                  {mostrarSolicitante && (
                    <td className="px-4 py-1.5">
                      <span className="block truncate">{fila.solicitante ?? "—"}</span>
                      {fila.estudiante && fila.estudiante !== fila.solicitante && (
                        <span className="text-meta block truncate">{fila.estudiante}</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatoMontoFila(fila) ?? <span className="text-meta">—</span>}
                  </td>
                  <td className="text-meta px-4 py-1.5 whitespace-nowrap">{fecha(fila)}</td>
                  {/* Rechazar abre el diálogo que nombra la solicitud y pide el motivo (no hay popover de Radix instalado). */}
                  <CeldaAcciones>
                    {positiva && (
                      <Button type="button" size="sm" variant="secondary" onClick={() => setConfirmando({ id: fila.id, accion: positiva })}>
                        <Check />
                        {t(`step.action.${positiva}` as never)}
                      </Button>
                    )}
                    {puedeRechazar && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-(--btn-danger-fg)"
                        onClick={() => setConfirmando({ id: fila.id, accion: "rechazar" })}
                      >
                        <X />
                        {t("step.action.rechazar")}
                      </Button>
                    )}
                  </CeldaAcciones>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Sheet open={abierta !== null} onOpenChange={(a) => !a && setAbiertaId(null)}>
        <SheetContent>
          {abierta && (
            <>
              <div className="space-y-2 border-b border-linea px-6 py-5 pr-14">
                <SheetTitle className="text-section">{abierta.titulo}</SheetTitle>
                <SheetDescription className="text-meta">
                  #{abierta.folio} · {t(`type.${abierta.tipo}` as never)}
                  {abierta.solicitante ? ` · ${abierta.solicitante}` : ""}
                  {formatoMontoFila(abierta) ? ` · ${formatoMontoFila(abierta)}` : ""}
                </SheetDescription>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={abierta.estado} />
                  {abierta.requiere_direccion && (
                    <span className="text-meta inline-flex items-center gap-1">
                      <ShieldCheck aria-hidden className="size-3.5" />
                      {t("needsDirection")}
                    </span>
                  )}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                {/* `key`: al cambiar de solicitud se reinicia el comentario y el estado del formulario. */}
                <DetalleSolicitud key={abierta.id} solicitud={abierta} catalogos={catalogos} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {porConfirmar && confirmando && (
        <ConfirmarAccionSolicitud
          solicitud={porConfirmar}
          accion={confirmando.accion}
          alCerrar={() => setConfirmando(null)}
        />
      )}
    </>
  );
}
