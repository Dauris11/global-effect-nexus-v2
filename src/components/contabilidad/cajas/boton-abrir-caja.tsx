"use client";

import { useMemo, useState } from "react";
import { DoorOpen, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { AvisoError } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { denominacionesDe, redondear, totalContado } from "@/lib/contabilidad/cajas";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { abrirCajaGeneralAction } from "@/server/contabilidad/cajas/acciones";
import type { CajaResumen } from "@/server/contabilidad/cajas/consultas";

/**
 * Botón «Abrir» para una Caja General en estado Cerrada (o pendiente de desglose inicial).
 * Al abrirla (con el desglose confirmado por Supervisor o conservando el efectivo de cierre),
 * la caja pasa a Abierta y habilita el botón «Movimientos de caja».
 */
export function BotonAbrirCajaGeneral({
  caja,
  esSupervisor,
}: {
  caja: CajaResumen;
  esSupervisor: boolean;
}) {
  const t = useTranslations("contab.cajas");
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const denominaciones = useMemo(() => denominacionesDe(caja.moneda), [caja.moneda]);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});

  const requiereSupervisor = !caja.desgloseConfigurado && !esSupervisor;

  const totalDesglose = useMemo(
    () =>
      redondear(
        totalContado(
          denominaciones.map((d) => ({
            denominacion: d.valor,
            cantidad: Math.max(0, Math.trunc(Number(cantidades[d.valor]) || 0)),
          })),
        ),
      ),
    [denominaciones, cantidades],
  );

  function abrirModal() {
    const mapa: Record<number, number> = {};
    for (const d of caja.desglose) {
      mapa[Number(d.denominacion)] = Math.max(0, Math.trunc(Number(d.cantidad) || 0));
    }
    setCantidades(mapa);
    setError(null);
    setAbierto(true);
  }

  async function onConfirmarAbrir(e: React.FormEvent) {
    e.preventDefault();
    setAbriendo(true);
    setError(null);

    try {
      const conteos = denominaciones
        .map((d) => ({
          denominacion: d.valor,
          cantidad: Math.max(0, Math.trunc(Number(cantidades[d.valor]) || 0)),
        }))
        .filter((c) => c.cantidad > 0);

      const res = await abrirCajaGeneralAction({
        cajaId: caja.id,
        conteos: esSupervisor ? conteos : undefined,
        actualizarDesglose: esSupervisor,
      });

      if (res.exito) {
        setAbierto(false);
        router.refresh();
      } else {
        setError(t(`errores.${res.error}`));
      }
    } catch {
      setError(t("errores.error"));
    } finally {
      setAbriendo(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="default"
        size="sm"
        disabled={requiereSupervisor || caja.estado !== "activa"}
        title={requiereSupervisor ? t("cajaGeneral.requiereSupervisorAbrir") : undefined}
        onClick={abrirModal}
        className="w-full"
      >
        <DoorOpen className="size-4" />
        {t("cajaGeneral.abrir")}
      </Button>

      <Dialog open={abierto} onOpenChange={(v) => !abriendo && setAbierto(v)}>
        <DialogContent className="md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("cajaGeneral.abrirTitulo", { nombre: caja.nombre })}</DialogTitle>
            <DialogDescription>
              {esSupervisor
                ? t("cajaGeneral.abrirDescSupervisor")
                : t("cajaGeneral.abrirDescOperador")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onConfirmarAbrir} className="space-y-4 pt-2 text-sm">
            {esSupervisor ? (
              <div className="overflow-x-auto rounded-control border border-linea">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-linea bg-muted/40 text-xs text-tinta-2">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t("colDenominacion")}</th>
                      <th className="w-32 px-3 py-2 text-right font-medium">{t("cantidad")}</th>
                      <th className="w-40 px-3 py-2 text-right font-medium">{t("monto")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-linea">
                    {denominaciones.map((d) => {
                      const cant = cantidades[d.valor] ?? 0;
                      const sub = redondear(d.valor * cant);
                      return (
                        <tr key={d.valor}>
                          <td className="px-3 py-1.5">
                            <Input
                              readOnly
                              tabIndex={-1}
                              value={`${d.tipo === "billete" ? t("billete") : t("monedaUnidad")} · ${formatearMonto(d.valor.toFixed(2), caja.moneda)}`}
                              className="h-8 bg-muted/40 font-mono text-xs text-tinta"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              step={1}
                              value={cant === 0 ? "" : String(cant)}
                              placeholder="0"
                              onChange={(e) => {
                                const n = Math.max(0, Math.trunc(Number(e.target.value) || 0));
                                setCantidades((prev) => ({ ...prev, [d.valor]: n }));
                              }}
                              className="h-8 text-right font-mono text-xs tabular-nums"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input
                              readOnly
                              tabIndex={-1}
                              value={formatearMonto(sub.toFixed(2), caja.moneda)}
                              className="h-8 bg-muted/40 text-right font-mono text-xs tabular-nums text-tinta"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-control border border-linea bg-muted/30 p-4">
                <span className="texto-meta block">{t("cajaGeneral.saldoActual")}</span>
                <span className="mt-1 block font-mono text-xl font-semibold tabular-nums text-tinta">
                  {formatearMonto(Number(caja.saldoActual).toFixed(2), caja.moneda)}
                </span>
              </div>
            )}

            {esSupervisor && (
              <div className="flex items-center justify-between rounded-control border border-linea bg-superficie/60 px-4 py-3 text-sm">
                <span className="texto-meta">{t("cajaGeneral.efectivoApertura")}</span>
                <span className="font-mono text-base font-semibold tabular-nums text-marca-700">
                  {formatearMonto(totalDesglose.toFixed(2), caja.moneda)}
                </span>
              </div>
            )}

            {error && <AvisoError>{error}</AvisoError>}

            <div className="flex justify-end gap-2 border-t border-linea pt-4">
              <Button
                type="button"
                variant="ghost"
                disabled={abriendo}
                onClick={() => setAbierto(false)}
              >
                {t("cancelar")}
              </Button>
              <Button type="submit" cargando={abriendo} disabled={abriendo}>
                {abriendo ? <Loader2 className="size-4 animate-spin" /> : <DoorOpen className="size-4" />}
                {t("cajaGeneral.confirmarAbrir")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
