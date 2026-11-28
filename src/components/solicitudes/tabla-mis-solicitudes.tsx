"use client";

import { useState } from "react";
import { Paperclip, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/app/status-badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { montoUsd } from "@/lib/finanzas";
import type { FilaSolicitud } from "@/server/solicitudes/consultas";

import { DetalleSolicitud } from "./detalle-solicitud";
import type { CatalogosSolicitud } from "./formulario-solicitud-dinamica";

/**
 * Tabla de «Mis Solicitudes» (Etapa 2): exactamente 5 columnas visibles
 * (Tipo de solicitud, Monto, Proveedor, Cotización y Estado). Un clic en la fila
 * abre el panel lateral con el detalle completo y opciones de edición/cancelación.
 */
export function TablaMisSolicitudes({
  filas,
  catalogos,
  resaltarId,
}: {
  filas: readonly FilaSolicitud[];
  catalogos?: CatalogosSolicitud;
  resaltarId?: string;
}) {
  const t = useTranslations("requests");
  const td = useTranslations("requests.dinamica");
  const [abiertaId, setAbiertaId] = useState<string | null>(null);

  const abierta = filas.find((f) => f.id === abiertaId) ?? null;

  const formatoMonto = (fila: FilaSolicitud) =>
    fila.monto === null
      ? "-"
      : fila.moneda === "DOP"
        ? formatearMonto(fila.monto.toFixed(2), "DOP")
        : montoUsd(fila.monto);

  const proveedorDe = (fila: FilaSolicitud) =>
    fila.proveedor_catalogo ?? fila.proveedor_nombre ?? "-";

  return (
    <>
      <div className="overflow-x-auto rounded-card border border-linea bg-card shadow-card">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="border-b border-linea bg-muted/30 text-left text-xs font-medium uppercase tracking-wider text-tinta-2">
            <tr>
              <th className="px-4 py-3">{td("colTipoSolicitud")}</th>
              <th className="px-4 py-3 text-right">{td("colMonto")}</th>
              <th className="px-4 py-3">{td("colProveedor")}</th>
              <th className="px-4 py-3">{td("colCotizacion")}</th>
              <th className="px-4 py-3">{td("colEstado")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {filas.map((fila) => {
              const proveedor = proveedorDe(fila);
              return (
                <tr
                  key={fila.id}
                  onClick={(e) => {
                    if (!(e.target as HTMLElement).closest("a, button")) {
                      setAbiertaId(fila.id);
                    }
                  }}
                  className={`cursor-pointer transition-colors hover:bg-muted/40 ${
                    fila.id === resaltarId ? "animate-resaltar" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-tinta">
                    {t(`type.${fila.tipo}` as never)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-tinta">
                    {formatoMonto(fila)}
                  </td>
                  <td className="px-4 py-3 text-tinta-2">
                    {proveedor === "-" ? (
                      <span className="text-tinta-3">-</span>
                    ) : (
                      <span className="block max-w-[240px] truncate">{proveedor}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {fila.cotizacion ? (
                      <a
                        href={`/api/solicitudes/${fila.id}/cotizacion`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-[220px] items-center gap-1.5 font-medium text-marca-600 hover:underline"
                        title={fila.cotizacion.nombre}
                      >
                        <Paperclip aria-hidden className="size-3.5 shrink-0" />
                        <span className="truncate">{fila.cotizacion.nombre}</span>
                      </a>
                    ) : (
                      <span className="text-tinta-3">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={fila.estado} />
                  </td>
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
                  {abierta.monto !== null ? ` · ${formatoMonto(abierta)}` : ""}
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
                <DetalleSolicitud key={abierta.id} solicitud={abierta} catalogos={catalogos} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
