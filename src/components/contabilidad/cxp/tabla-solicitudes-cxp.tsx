"use client";

import { useState } from "react";
import { AlertTriangle, Building2, Paperclip } from "lucide-react";
import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/app/status-badge";
import { FormularioFactura } from "@/components/contabilidad/proveedores/formularios";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";
import { formatearMonto } from "@/lib/contabilidad/formato";
import {
  formatearIdentificacion,
  limpiarIdentificacion,
} from "@/lib/contabilidad/identificacion";
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
 * Tabla de «Cuentas por Pagar > Solicitudes» (Etapas 2 y 3).
 *
 * Muestra solicitudes de tipo «Materiales» y «Otro» con las columnas:
 * Solicitante, Tipo de solicitud, Monto, Proveedor, Cotización, Estado y
 * columna sin encabezado con el botón «Atender».
 *
 * En solicitudes de tipo «Otro» con Proveedor y RNC no registrados en catálogo,
 * «Atender» muestra primero una alerta bloqueante con el nombre y RNC.
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
  const [alertaProveedor, setAlertaProveedor] = useState<{
    nombre: string;
    rnc: string;
  } | null>(null);

  const seleccionada = filas.find((f) => f.id === seleccionadaId) ?? null;
  const facturaDraft =
    seleccionada?.factura_id ? facturasBorrador[seleccionada.factura_id] : undefined;

  const formatoMonto = (fila: FilaSolicitudMaterialCxp) =>
    fila.monto === null
      ? "-"
      : formatearMonto(fila.monto.toFixed(2), fila.moneda);

  /** Encuentra el proveedor activo del catálogo que coincide por RNC/cédula. */
  function buscarProveedorPorRnc(rnc: string | null): string | null {
    if (!rnc) return null;
    const limpio = limpiarIdentificacion(rnc);
    const encontrado = proveedores.find(
      (p) => p.identificacion && limpiarIdentificacion(p.identificacion) === limpio,
    );
    return encontrado?.id ?? null;
  }

  function manejarAtender(fila: FilaSolicitudMaterialCxp) {
    // Si es tipo OTRO, aún no tiene factura y trae proveedor + RNC sin registrar en el catálogo,
    // bloqueamos la continuación directa y mostramos alerta con ambos datos.
    if (
      fila.tipo === "OTRO" &&
      !fila.factura_id &&
      fila.proveedor_nombre &&
      fila.proveedor_rnc
    ) {
      const registradoId =
        fila.proveedor_registrado_id ?? buscarProveedorPorRnc(fila.proveedor_rnc);
      if (!registradoId) {
        setAlertaProveedor({
          nombre: fila.proveedor_nombre,
          rnc: fila.proveedor_rnc,
        });
        return;
      }
    }

    setSeleccionadaId(fila.id);
  }

  const proveedorSugeridoId = seleccionada
    ? seleccionada.proveedor_id ??
      seleccionada.proveedor_registrado_id ??
      buscarProveedorPorRnc(seleccionada.proveedor_rnc) ??
      undefined
    : undefined;

  return (
    <>
      <div className="overflow-x-auto rounded-card border border-linea bg-card shadow-card">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="border-b border-linea bg-muted/30 text-left text-xs font-medium uppercase tracking-wider text-tinta-2">
            <tr>
              <th className="px-4 py-3">{td("colSolicitante")}</th>
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
                <td className="px-4 py-3 text-tinta">
                  {fila.solicitante ? (
                    <span className="block max-w-[200px] truncate">{fila.solicitante}</span>
                  ) : (
                    <span className="text-tinta-3">-</span>
                  )}
                </td>
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
                      onClick={() => manejarAtender(fila)}
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

      {/* Modal de alerta cuando el proveedor + RNC de una solicitud OTRO no existe en catálogo */}
      <Dialog
        open={alertaProveedor !== null}
        onOpenChange={(open) => !open && setAlertaProveedor(null)}
      >
        <DialogContent className="md:max-w-lg">
          {alertaProveedor && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-center gap-2 text-status-warning-fg md:justify-start">
                  <AlertTriangle aria-hidden className="size-5 shrink-0 text-status-warning" />
                  {t("proveedorNoRegistradoTitulo")}
                </DialogTitle>
                <DialogDescription>{t("proveedorNoRegistradoDesc")}</DialogDescription>
              </DialogHeader>

              <div className="space-y-2.5 rounded-control border border-status-warning-border bg-status-warning-bg/60 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-tinta-2">
                    {td("colProveedor")}
                  </span>
                  <span className="font-semibold text-tinta">{alertaProveedor.nombre}</span>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-linea/60 pt-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-tinta-2">
                    {t("rncEtiqueta")}
                  </span>
                  <span className="font-mono font-semibold text-tinta">
                    {formatearIdentificacion(alertaProveedor.rnc)}
                  </span>
                </div>
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAlertaProveedor(null)}
                >
                  {t("cerrar")}
                </Button>
                <Button asChild>
                  <Link href="/contabilidad/proveedores/nuevo">
                    <Building2 aria-hidden className="size-4" />
                    {t("irAgregarProveedor")}
                  </Link>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal amplio para Agregar / Completar Factura */}
      <Dialog
        open={seleccionada !== null}
        onOpenChange={(open) => !open && setSeleccionadaId(null)}
      >
        <DialogContent className="max-h-[90vh] w-[96vw] overflow-y-auto md:max-w-5xl lg:max-w-[1100px]">
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
                  {seleccionada.tipo === "MATERIALES" && seleccionada.tipo_material && (
                    <span>
                      <strong className="font-medium text-tinta">{t("tipoMaterial")}:</strong>{" "}
                      {seleccionada.tipo_material}
                    </span>
                  )}
                  {seleccionada.tipo === "OTRO" && seleccionada.proposito_otro && (
                    <span>
                      <strong className="font-medium text-tinta">{td("proposito")}:</strong>{" "}
                      {seleccionada.proposito_otro}
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
                proveedorId={facturaDraft ? undefined : proveedorSugeridoId}
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
