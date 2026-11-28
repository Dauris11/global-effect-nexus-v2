"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  Bus,
  CheckCircle2,
  ClipboardList,
  History,
  Loader2,
  Printer,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { useToast } from "@/components/app/toaster";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { fechaCorta } from "@/lib/fechas";
import { entregarPasajeAction } from "@/server/contabilidad/pasaje/acciones";
import type { FilaSolicitudPasaje } from "@/server/contabilidad/pasaje/consultas";

/**
 * Panel del módulo «Contabilidad > Pasaje» (Etapa 3) con dos pestañas:
 *   1. Solicitudes
 *   2. Historial
 */
export function PanelPasaje({
  solicitudes,
  historial,
  puedeRegistrar,
  tabInicial = "solicitudes",
}: {
  solicitudes: readonly FilaSolicitudPasaje[];
  historial: readonly FilaSolicitudPasaje[];
  puedeRegistrar: boolean;
  tabInicial?: "solicitudes" | "historial";
}) {
  const t = useTranslations("contab.pasaje");
  const td = useTranslations("requests.dinamica");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const avisar = useToast();

  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [montoEntregado, setMontoEntregado] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  const seleccionada = solicitudes.find((f) => f.id === seleccionadaId) ?? null;
  const montoEntregadoNum = Number(montoEntregado);
  const montoValido =
    montoEntregado.trim() !== "" &&
    Number.isFinite(montoEntregadoNum) &&
    montoEntregadoNum > 0;

  function abrirModalEntrega(fila: FilaSolicitudPasaje) {
    setSeleccionadaId(fila.id);
    setMontoEntregado("");
    setError(null);
  }

  function imprimirComprobante(id: string) {
    window.open(`/api/contabilidad/pasaje/${id}/pdf`, "_blank", "noopener,noreferrer");
  }

  function confirmarEntrega(e: React.FormEvent) {
    e.preventDefault();
    if (!seleccionada || !montoValido) return;
    setError(null);

    iniciar(async () => {
      const res = await entregarPasajeAction({
        id: seleccionada.id,
        montoEntregado: montoEntregadoNum,
      });

      if (!res.ok) {
        setError(t(`errores.${res.error}` as never));
        return;
      }

      const idEntregado = seleccionada.id;
      setSeleccionadaId(null);
      setMontoEntregado("");
      avisar({ titulo: t("entregadoOk") });
      router.refresh();
      imprimirComprobante(idEntregado);
    });
  }

  const etiquetaPeriodo = (fila: FilaSolicitudPasaje) => {
    if (!fila.periodo_pasaje) return "-";
    const base = td(`periodos.${fila.periodo_pasaje}` as never);
    if (fila.periodo_pasaje === "semana") {
      return `${base} (×5)`;
    }
    if (fila.periodo_pasaje === "personalizado") {
      const nDias = fila.dias_pasaje?.length ?? 0;
      if (fila.multiplicar_por_dias) {
        return `${base} (×${fila.factor_periodo})`;
      }
      return `${base} (${t("montoFijoCorto", { dias: String(nDias) })})`;
    }
    return `${base} (×1)`;
  };

  const renderTabla = (
    filas: readonly FilaSolicitudPasaje[],
    esHistorial: boolean,
  ) => {
    if (filas.length === 0) {
      return (
        <EmptyState
          readOnly
          icon={esHistorial ? History : Bus}
          title={esHistorial ? t("historialVacio") : t("solicitudesVacio")}
        />
      );
    }

    return (
      <div className="overflow-x-auto rounded-card border border-linea bg-card shadow-card">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b border-linea bg-muted/30 text-left text-xs font-medium uppercase tracking-wider text-tinta-2">
            <tr>
              <th className="px-4 py-3">{t("colSolicitante")}</th>
              <th className="px-4 py-3">{t("colLugar")}</th>
              <th className="px-4 py-3 text-right">{t("colMontoEntregar")}</th>
              <th className="px-4 py-3">{t("colMotivo")}</th>
              <th className="px-4 py-3">{t("colPeriodo")}</th>
              <th className="px-4 py-3">{t("colEstado")}</th>
              <th className="px-4 py-3 text-right">
                <span className="sr-only">{t("entregar")}</span>
              </th>
              <th className="px-4 py-3 text-right">
                <span className="sr-only">{t("imprimir")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {filas.map((fila) => {
              const entregado = fila.estado_pasaje === "entregado";
              return (
                <tr key={fila.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3 text-tinta">
                    {fila.solicitante ? (
                      <span className="block max-w-[200px] truncate">{fila.solicitante}</span>
                    ) : (
                      <span className="text-tinta-3">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-tinta">
                    {fila.lugar_pasaje_otro ? td("lugarOtro") : fila.lugar_visible}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-tinta">
                    {formatearMonto(fila.monto_a_entregar.toFixed(2), fila.moneda)}
                  </td>
                  <td className="px-4 py-3 text-tinta-2">
                    <span className="block max-w-[200px] truncate">
                      {fila.lugar_pasaje_otro ? fila.motivo_visible : t("motivoPasajeFijo")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-sm font-medium tabular-nums text-tinta">
                      {formatearMonto(fila.monto_a_entregar.toFixed(2), fila.moneda)}
                    </div>
                    <div className="text-xs text-tinta-3">{etiquetaPeriodo(fila)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={fila.estado_pasaje} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant={entregado ? "outline" : "default"}
                      disabled={entregado || !puedeRegistrar || esHistorial}
                      onClick={() => abrirModalEntrega(fila)}
                    >
                      {t("entregar")}
                    </Button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!entregado}
                      onClick={() => imprimirComprobante(fila.id)}
                    >
                      <Printer aria-hidden className="size-3.5" />
                      {t("imprimir")}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <Tabs defaultValue={tabInicial} className="space-y-5">
        <TabsList className="h-auto flex-wrap gap-1 p-1">
          <TabsTrigger value="solicitudes" className="gap-2">
            <ClipboardList className="size-4" />
            {t("tabSolicitudes")}
          </TabsTrigger>
          <TabsTrigger value="historial" className="gap-2">
            <History className="size-4" />
            {t("tabHistorial")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="solicitudes">
          {renderTabla(solicitudes, false)}
        </TabsContent>

        <TabsContent value="historial">
          {renderTabla(historial, true)}
        </TabsContent>
      </Tabs>

      {/* Modal de detalles y confirmación de entrega de pasaje */}
      <Dialog
        open={seleccionada !== null}
        onOpenChange={(open) => {
          if (!open && !guardando) {
            setSeleccionadaId(null);
            setMontoEntregado("");
            setError(null);
          }
        }}
      >
        <DialogContent className="md:max-w-2xl">
          {seleccionada && (
            <>
              <DialogHeader>
                <DialogTitle>{t("modalTitulo")}</DialogTitle>
                <DialogDescription>
                  {t("modalSubtitulo", {
                    folio: String(seleccionada.folio),
                    solicitante: seleccionada.solicitante ?? "-",
                  })}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={confirmarEntrega} className="space-y-5 pt-1 text-sm">
                {/* Detalles completos de la solicitud */}
                <dl className="grid grid-cols-1 gap-x-5 gap-y-3 rounded-control border border-linea bg-muted/25 p-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-tinta-3">{t("colSolicitante")}</dt>
                    <dd className="font-medium text-tinta">
                      {seleccionada.solicitante ?? "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-tinta-3">{t("fechaSolicitud")}</dt>
                    <dd className="font-medium text-tinta">
                      {fechaCorta(seleccionada.creada.slice(0, 10), locale)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-tinta-3">{t("colLugar")}</dt>
                    <dd className="font-medium text-tinta">
                      {seleccionada.lugar_pasaje_otro
                        ? td("lugarOtro")
                        : seleccionada.lugar_visible}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-tinta-3">{t("colMotivo")}</dt>
                    <dd className="font-medium text-tinta">
                      {seleccionada.lugar_pasaje_otro
                        ? seleccionada.motivo_visible
                        : t("motivoPasajeFijo")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-tinta-3">{t("colPeriodo")}</dt>
                    <dd className="font-medium text-tinta">
                      {etiquetaPeriodo(seleccionada)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-tinta-3">{t("montoBase")}</dt>
                    <dd className="font-mono font-medium tabular-nums text-tinta">
                      {formatearMonto(seleccionada.monto_base.toFixed(2), seleccionada.moneda)}
                    </dd>
                  </div>
                  {seleccionada.periodo_pasaje === "personalizado" &&
                    seleccionada.dias_pasaje &&
                    seleccionada.dias_pasaje.length > 0 && (
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-tinta-3">{td("diasSemana")}</dt>
                        <dd className="mt-1 flex flex-wrap gap-1.5">
                          {seleccionada.dias_pasaje.map((d) => (
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
                  {seleccionada.detalle && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-tinta-3">{t("observaciones")}</dt>
                      <dd className="whitespace-pre-line text-tinta-2">
                        {seleccionada.detalle}
                      </dd>
                    </div>
                  )}
                </dl>

                {/* Campos de monto: Monto a entregar (solo lectura) y Entregado (editable) */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="pasaje-monto-entregar" className="text-xs font-medium text-tinta-2">
                      {t("colMontoEntregar")}
                    </Label>
                    <Input
                      id="pasaje-monto-entregar"
                      readOnly
                      tabIndex={-1}
                      value={formatearMonto(
                        seleccionada.monto_a_entregar.toFixed(2),
                        seleccionada.moneda,
                      )}
                      className="h-9 bg-muted/40 font-mono font-semibold tabular-nums text-tinta"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pasaje-entregado" className="text-xs font-medium text-tinta-2">
                      {t("campoEntregado")}
                      <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                    </Label>
                    <Input
                      id="pasaje-entregado"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={montoEntregado}
                      onChange={(e) => {
                        setMontoEntregado(e.target.value);
                        if (error) setError(null);
                      }}
                      className="h-9 font-mono tabular-nums"
                    />
                  </div>
                </div>

                {error && (
                  <p
                    role="alert"
                    className="flex items-center gap-2 rounded-control bg-tinta px-3 py-2 text-xs text-background"
                  >
                    <AlertCircle className="size-4 shrink-0" />
                    {error}
                  </p>
                )}

                <DialogFooter className="gap-2 border-t border-linea pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={guardando}
                    onClick={() => setSeleccionadaId(null)}
                  >
                    {t("cancelar")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={!montoValido || guardando}
                    cargando={guardando}
                  >
                    {guardando ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    {t("entregar")}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
