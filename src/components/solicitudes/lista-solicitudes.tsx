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

/**
 * Bandeja de solicitudes (patrón Lista, docs/ux-rules.md): tabla densa en pantalla
 * ancha y filas en el móvil. Un clic en la fila abre el panel lateral con el detalle y
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
}: {
  filas: readonly FilaSolicitud[];
  /** En la bandeja de quien revisa importa quién lo pidió; en «lo mío» no. */
  mostrarSolicitante: boolean;
  /** Solicitud recién creada: entra resaltada unos segundos. */
  resaltarId?: string;
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

  return (
    <>
      <div className="overflow-x-auto rounded-card border border-linea bg-card shadow-card">
        {/* ≥ md: tabla densa */}
        <table className="hidden w-full text-sm md:table">
          <thead className="text-meta border-b border-linea text-left">
            <tr>
              <th className="px-4 py-3 font-medium">{l("column.request")}</th>
              <th className="px-4 py-3 font-medium">{l("column.status")}</th>
              {mostrarSolicitante && <th className="px-4 py-3 font-medium">{l("column.requester")}</th>}
              <th className="px-4 py-3 text-right font-medium">{l("column.amount")}</th>
              <th className="px-4 py-3 font-medium">{l("column.date")}</th>
              <th className="px-4 py-3">
                <span className="sr-only">{l("column.actions")}</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-linea">
            {filas.map((fila) => {
              const { positiva, puedeRechazar } = accionesEnFila(fila.acciones);

              return (
                <tr key={fila.id} className={`group relative h-[52px] transition-colors hover:bg-muted/50 ${fila.id === resaltarId ? "animate-resaltar" : ""}`}>
                  <td className="w-80 max-w-80 px-4 py-1.5">
                    <button
                      type="button"
                      onClick={() => setAbiertaId(fila.id)}
                      aria-label={`${l("view")}: ${fila.titulo}`}
                      className="flex w-full min-w-0 items-center gap-3 text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <FotoEstudiante nombre={persona(fila)} url={null} className="size-9 shrink-0 rounded-full" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{fila.titulo}</span>
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
                    <td className="max-w-48 px-4 py-1.5">
                      <span className="block truncate">{fila.solicitante ?? "—"}</span>
                      {fila.estudiante && fila.estudiante !== fila.solicitante && (
                        <span className="text-meta block truncate">{fila.estudiante}</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {fila.monto !== null ? montoUsd(fila.monto) : <span className="text-meta">—</span>}
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

        {/* < md: filas; las acciones van en el panel */}
        <ul className="divide-y divide-linea md:hidden">
          {filas.map((fila) => (
            <li key={fila.id}>
              <button
                type="button"
                onClick={() => setAbiertaId(fila.id)}
                className="flex w-full items-center gap-3 p-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <FotoEstudiante nombre={persona(fila)} url={null} className="size-11 rounded-full" />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block truncate font-semibold">{fila.titulo}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={fila.estado} />
                    <span className="text-meta">
                      #{fila.folio} · {t(`type.${fila.tipo}` as never)}
                    </span>
                  </span>
                  <span className="text-meta block truncate">
                    {[mostrarSolicitante ? fila.solicitante : null, fila.monto !== null ? montoUsd(fila.monto) : null, fecha(fila)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
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
                  {abierta.monto !== null ? ` · ${montoUsd(abierta.monto)}` : ""}
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
                <DetalleSolicitud key={abierta.id} solicitud={abierta} />
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
