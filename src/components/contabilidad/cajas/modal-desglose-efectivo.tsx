"use client";

import { useMemo } from "react";
import { Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { AvisoError } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  claveDenominacion,
  denominacionesDe,
  redondear,
  totalContado,
  type ConteoDenominacion,
} from "@/lib/contabilidad/cajas";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { cn } from "@/lib/utils";
import type { DesgloseDenominacion } from "@/server/contabilidad/cajas/consultas";

/**
 * Modal reutilizable de desglose de efectivo por denominación (billetes y monedas).
 *
 * Dos modos:
 *   · `ingreso`: reposición de caja — valida que el total desglosado coincida
 *     exactamente con `montoObjetivo` y suma las denominaciones al efectivo en caja.
 *   · `egreso`: salida de efectivo — además muestra el stock disponible por
 *     denominación (`desgloseDisponible`) y bloquea estrictamente cualquier
 *     cantidad que supere lo disponible en caja.
 */
export function ModalDesgloseEfectivo({
  abierto,
  onOpenChange,
  titulo,
  etiquetaObjetivo,
  etiquetaConfirmar,
  moneda,
  montoObjetivo,
  modo,
  desgloseDisponible = [],
  cantidades,
  onCambiarCantidad,
  guardando,
  errorExterno,
  onConfirmar,
}: {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  titulo: string;
  etiquetaObjetivo: string;
  etiquetaConfirmar: string;
  moneda: "DOP" | "USD";
  montoObjetivo: number;
  modo: "ingreso" | "egreso";
  desgloseDisponible?: readonly DesgloseDenominacion[];
  cantidades: Record<number, number>;
  onCambiarCantidad: (denominacion: number, cantidad: number) => void;
  guardando: boolean;
  errorExterno: string | null;
  onConfirmar: (conteos: ConteoDenominacion[]) => void | Promise<void>;
}) {
  const t = useTranslations("contab.cajas");
  const denominaciones = useMemo(() => denominacionesDe(moneda), [moneda]);

  const disponiblesPorClave = useMemo(() => {
    const mapa = new Map<number, number>();
    for (const item of desgloseDisponible) {
      const clave = claveDenominacion(item.denominacion);
      const cant = Math.max(0, Math.trunc(Number(item.cantidad) || 0));
      mapa.set(clave, (mapa.get(clave) ?? 0) + cant);
    }
    return mapa;
  }, [desgloseDisponible]);

  const objetivoSeguro = redondear(Number(montoObjetivo) || 0);

  const filas = useMemo(
    () =>
      denominaciones.map((d) => {
        const clave = claveDenominacion(d.valor);
        const cantidad = Math.max(0, Math.trunc(Number(cantidades[d.valor]) || 0));
        const disponible = disponiblesPorClave.get(clave) ?? 0;
        const excede = modo === "egreso" && cantidad > disponible;
        const subtotal = redondear(d.valor * cantidad);
        return { ...d, cantidad, disponible, excede, subtotal };
      }),
    [denominaciones, cantidades, disponiblesPorClave, modo],
  );

  const totalDesglose = useMemo(
    () =>
      redondear(
        totalContado(
          filas.map((f) => ({ denominacion: f.valor, cantidad: f.cantidad })),
        ),
      ),
    [filas],
  );

  const diferencia = redondear(totalDesglose - objetivoSeguro);
  const excesos = useMemo(() => filas.filter((f) => f.excede), [filas]);
  const hayExceso = excesos.length > 0;
  const hayDiferencia = Math.abs(diferencia) > 0.005;

  const mensajesExceso = useMemo(
    () =>
      excesos.map((f) => {
        const montoDenom = formatearMonto(f.valor.toFixed(2), moneda);
        if (f.disponible === 0) {
          const unidad = f.tipo === "billete" ? t("billetesPlural") : t("monedasPlural");
          return t("errorSinDenominacion", { unidad, denominacion: montoDenom });
        }
        if (f.disponible === 1) {
          const unidad =
            f.tipo === "billete"
              ? t("billete").toLowerCase()
              : t("monedaUnidad").toLowerCase();
          return t("errorExcedeDenominacionUno", { unidad, denominacion: montoDenom });
        }
        const unidad = f.tipo === "billete" ? t("billetesPlural") : t("monedasPlural");
        return t("errorExcedeDenominacion", {
          disponible: f.disponible,
          unidad,
          denominacion: montoDenom,
        });
      }),
    [excesos, moneda, t],
  );

  function manejarEnvio(e: React.FormEvent) {
    e.preventDefault();
    if (hayExceso || hayDiferencia || guardando) return;
    const activos: ConteoDenominacion[] = filas
      .filter((f) => f.cantidad > 0)
      .map((f) => ({
        denominacion: f.valor,
        tipo: f.tipo,
        cantidad: f.cantidad,
      }));
    void onConfirmar(activos);
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>

        <form onSubmit={manejarEnvio} className="space-y-4 pt-2 text-sm">
          <div className="overflow-x-auto rounded-control border border-linea">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-linea bg-muted/40 text-xs text-tinta-2">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("colDenominacion")}</th>
                  {modo === "egreso" && (
                    <th className="w-24 whitespace-nowrap px-3 py-2 text-right font-medium">
                      {t("colDisponible")}
                    </th>
                  )}
                  <th className="w-28 px-3 py-2 text-right font-medium">{t("cantidad")}</th>
                  <th className="w-36 px-3 py-2 text-right font-medium">{t("monto")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {filas.map((f) => {
                  const sinStock = modo === "egreso" && f.disponible === 0;
                  return (
                    <tr
                      key={f.valor}
                      className={cn(
                        f.excede && "bg-status-danger-bg/40",
                        sinStock && "opacity-60",
                      )}
                    >
                      <td className="px-3 py-1.5">
                        <Input
                          readOnly
                          tabIndex={-1}
                          value={`${f.tipo === "billete" ? t("billete") : t("monedaUnidad")} · ${formatearMonto(f.valor.toFixed(2), moneda)}`}
                          className="h-8 bg-muted/40 font-mono text-xs text-tinta"
                        />
                      </td>
                      {modo === "egreso" && (
                        <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums text-tinta-2">
                          <span
                            className={cn(
                              "inline-flex min-w-8 items-center justify-center rounded-md px-2 py-1 font-medium",
                              f.excede
                                ? "bg-status-danger-bg text-status-danger-fg"
                                : f.disponible > 0
                                  ? "bg-muted text-tinta"
                                  : "text-tinta-3",
                            )}
                          >
                            {f.disponible}
                          </span>
                        </td>
                      )}
                      <td className="px-3 py-1.5">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={modo === "egreso" ? f.disponible : undefined}
                          step={1}
                          disabled={sinStock || guardando}
                          aria-invalid={f.excede || undefined}
                          value={f.cantidad === 0 ? "" : String(f.cantidad)}
                          placeholder="0"
                          onChange={(e) => {
                            const crudo = e.target.value.trim();
                            if (crudo === "") {
                              onCambiarCantidad(f.valor, 0);
                              return;
                            }
                            const parsed = Number(crudo);
                            const n = Number.isFinite(parsed)
                              ? Math.max(0, Math.trunc(parsed))
                              : 0;
                            onCambiarCantidad(f.valor, n);
                          }}
                          className={cn(
                            "h-8 text-right font-mono text-xs tabular-nums",
                            f.excede &&
                              "border-status-danger-border bg-status-danger-bg/30 text-status-danger-fg focus-visible:border-status-danger-border focus-visible:ring-status-danger-border/40",
                          )}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          readOnly
                          tabIndex={-1}
                          value={formatearMonto(f.subtotal.toFixed(2), moneda)}
                          className="h-8 bg-muted/40 text-right font-mono text-xs tabular-nums text-tinta"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-control border border-linea bg-superficie/60 px-4 py-3 text-sm">
            <div>
              <span className="texto-meta block">{etiquetaObjetivo}</span>
              <span className="font-mono font-semibold tabular-nums text-tinta">
                {formatearMonto(objetivoSeguro.toFixed(2), moneda)}
              </span>
            </div>
            <div>
              <span className="texto-meta block">{t("totalDesglose")}</span>
              <span className="font-mono font-semibold tabular-nums text-marca-700">
                {formatearMonto(totalDesglose.toFixed(2), moneda)}
              </span>
            </div>
            <div>
              <span className="texto-meta block">{t("diferencia")}</span>
              <span
                className={cn(
                  "font-mono font-semibold tabular-nums",
                  !hayDiferencia ? "text-tinta-2" : "text-status-danger-fg",
                )}
              >
                {formatearMonto(diferencia.toFixed(2), moneda)}
              </span>
            </div>
          </div>

          {hayExceso && (
            <AvisoError>
              <span className="block space-y-0.5">
                {mensajesExceso.map((msg) => (
                  <span key={msg} className="block">
                    {msg}
                  </span>
                ))}
              </span>
            </AvisoError>
          )}

          {!hayExceso && hayDiferencia && totalDesglose > 0 && (
            <AvisoError>
              {t("alertaDiferenciaDesglose", {
                monto: formatearMonto(objetivoSeguro.toFixed(2), moneda),
              })}
            </AvisoError>
          )}

          {errorExterno && !hayExceso && <AvisoError>{errorExterno}</AvisoError>}

          <div className="flex justify-end gap-2 border-t border-linea pt-4">
            <Button
              type="button"
              variant="ghost"
              disabled={guardando}
              onClick={() => onOpenChange(false)}
            >
              {t("cancelar")}
            </Button>
            <Button
              type="submit"
              disabled={hayExceso || hayDiferencia || guardando}
              cargando={guardando}
            >
              {guardando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {etiquetaConfirmar}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
