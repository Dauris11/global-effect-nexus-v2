"use client";

import { useState } from "react";
import { Paperclip } from "lucide-react";
import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/app/status-badge";
import { FormularioFactura } from "@/components/contabilidad/proveedores/formularios";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";
import { formatearMonto } from "@/lib/contabilidad/formato";
import type { FilaSolicitudMaterialCxp } from "@/server/contabilidad/cxp/solicitudes-consultas";
import type {
  DetalleFactura,
  UsuarioSolicitante,
} from "@/server/contabilidad/proveedores/consultas";
import type { Opcion } from "@/server/contabilidad/recibos/consultas";

type ProveedorFacturaOpcion = Opcion & {
  tipo: "fisica" | "juridica";
  dias: number;
  identificacion?: string;
};

/**
 * Tabla de «Cuentas por Pagar > Solicitudes» (Etapa 2).
 *
 * Misma estructura base de 5 columnas que «Mis Solicitudes» (Tipo de solicitud,
 * Monto, Proveedor, Cotización y Estado), más una columna sin encabezado con el
 * botón «Atender» que abre el modal «Agregar Factura» (sin exigir NCF/e-CF en el
 * primer guardado, y habilitando «Aprobar» al completar el NCF/e-CF).
 */
export function TablaSolicitudesCxp({
  filas,
  facturasBorrador,
  proveedores,
  tiposGasto,
  fondos,
  proyectos,
  solicitantes,
  estudiantes,
  hoy,
  puedeRegistrar,
  puedeAprobar,
}: {
  filas: readonly FilaSolicitudMaterialCxp[];
  facturasBorrador: Record<string, DetalleFactura>;
  proveedores: ProveedorFacturaOpcion[];
  tiposGasto: Opcion[];
  fondos: Opcion[];
  proyectos: Opcion[];
  solicitantes: UsuarioSolicitante[];
  estudiantes: Opcion[];
  hoy: string;
  puedeRegistrar: boolean;
  puedeAprobar: boolean;
}) {
  const t = useTranslations("contab.solicitudesCxp");
  const tr = useTranslations("requests");
  const td = useTranslations("requests.dinamica");
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);

  const seleccionada = filas.find((f) => f.id === seleccionadaId) ?? null;
  const facturaDraft =
    seleccionada?.factura_id ? facturasBorrador[seleccionada.factura_id] : undefined;

  const formatoMonto = (fila: FilaSolicitudMaterialCxp) =>
    fila.monto === null
      ? "-"
      : formatearMonto(fila.monto.toFixed(2), fila.moneda);

  return (
    <>
      <div className="overflow-x-auto rounded-card border border-linea bg-card shadow-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-linea bg-muted/30 text-left text-xs font-medium uppercase tracking-wider text-tinta-2">
            <tr>
              <th className="px-4 py-3">{td("colTipoSolicitud")}</th>
              <th className="px-4 py-3 text-right">{td("colMonto")}</th>
              <th className="px-4 py-3">{td("colProveedor")}</th>
              <th className="px-4 py-3">{td("colCotizacion")}</th>
              <th className="px-4 py-3">{td("colEstado")}</th>
              <th className="px-4 py-3 text-right">
                <span className="sr-only">{t("colAccion")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {filas.map((fila) => (
              <tr key={fila.id} className="transition-colors hover:bg-muted/40">
                <td className="px-4 py-3 font-medium text-tinta">
                  {tr(`type.${fila.tipo}` as never)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-tinta">
                  {formatoMonto(fila)}
                </td>
                <td className="px-4 py-3 text-tinta-2">
                  {fila.proveedor ? (
                    <span className="block max-w-[240px] truncate">{fila.proveedor}</span>
                  ) : (
                    <span className="text-tinta-3">-</span>
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
                  <StatusBadge status={fila.estado_cxp} />
                </td>
                <td className="px-4 py-3 text-right">
                  {fila.estado_cxp === "pendiente" && fila.cxp_id ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/contabilidad/cuentas-por-pagar/${fila.cxp_id}`}>
                        {t("atender")}
                      </Link>
                    </Button>
                  ) : fila.estado_cxp === "pagada" ? (
                    <Button type="button" size="sm" variant="outline" disabled>
                      {t("atender")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant={fila.estado_cxp === "solicitado" ? "default" : "outline"}
                      disabled={!puedeRegistrar}
                      onClick={() => setSeleccionadaId(fila.id)}
                    >
                      {t("atender")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={seleccionada !== null} onOpenChange={(open) => !open && setSeleccionadaId(null)}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-4xl overflow-y-auto">
          {seleccionada && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {facturaDraft ? t("modalCompletarTitulo") : t("modalAgregarTitulo")}
                </DialogTitle>
                <DialogDescription>
                  {t("modalSubtitulo", {
                    folio: String(seleccionada.folio),
                    titulo: seleccionada.titulo,
                  })}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-linea bg-muted/30 px-4 py-3 text-xs text-tinta-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  {seleccionada.solicitante && (
                    <span>
                      <strong className="font-medium text-tinta">{t("solicitante")}:</strong>{" "}
                      {seleccionada.solicitante}
                    </span>
                  )}
                  {seleccionada.tipo_material && (
                    <span>
                      <strong className="font-medium text-tinta">{t("tipoMaterial")}:</strong>{" "}
                      {seleccionada.tipo_material}
                    </span>
                  )}
                </div>
                {seleccionada.cotizacion && (
                  <a
                    href={`/api/solicitudes/${seleccionada.id}/cotizacion`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-marca-600 hover:underline"
                  >
                    <Paperclip aria-hidden className="size-3.5" />
                    {t("verCotizacion")}
                  </a>
                )}
              </div>

              <FormularioFactura
                key={`${seleccionada.id}-${facturaDraft?.id ?? "nueva"}-${facturaDraft?.ncf ?? ""}`}
                proveedores={proveedores}
                proveedorId={facturaDraft ? undefined : (seleccionada.proveedor_id ?? undefined)}
                factura={facturaDraft}
                tiposGasto={tiposGasto}
                fondos={fondos}
                proyectos={proyectos}
                solicitantes={solicitantes}
                estudiantes={estudiantes}
                hoy={hoy}
                solicitudId={facturaDraft ? undefined : seleccionada.id}
                ncfOpcional
                enModal
                puedeAprobar={puedeAprobar}
                valoresIniciales={
                  facturaDraft
                    ? undefined
                    : {
                        subtotal:
                          seleccionada.monto !== null ? seleccionada.monto.toFixed(2) : "",
                        concepto: seleccionada.titulo,
                        moneda: seleccionada.moneda,
                        solicitanteId: seleccionada.solicitante_id,
                        estudianteId: seleccionada.estudiante_id,
                      }
                }
                alGuardar={() => setSeleccionadaId(null)}
                alCancelar={() => setSeleccionadaId(null)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
