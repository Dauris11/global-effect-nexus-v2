"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Loader2,
  Save,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { useToast } from "@/components/app/toaster";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import {
  JUSTIFICACION_MINIMA,
  claveDenominacion,
  denominacionesDe,
  redondear,
  totalContado,
} from "@/lib/contabilidad/cajas";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { cn } from "@/lib/utils";
import { cuadreYCierreCajaGeneralAction } from "@/server/contabilidad/cajas/acciones";
import type { CajaResumen } from "@/server/contabilidad/cajas/consultas";

/**
 * Modal de «Cuadre y cierre» de Caja General (exclusivo del Supervisor).
 *
 * Misma estructura comparativa que el arqueo físico de Caja Chica, adaptada
 * a Cuadre de Caja. Al confirmar, mueve todos los ingresos y egresos del turno
 * al Historial, deja la caja Cerrada y regresa automáticamente al listado de cajas.
 */
export function ModalCuadreCierre({
  caja,
  hoy,
  supervisorNombre,
}: {
  caja: CajaResumen;
  hoy: string;
  supervisorNombre: string;
}) {
  const t = useTranslations("contab.cajas");
  const tg = useTranslations("contab.cajas.cajaGeneral");
  const router = useRouter();
  const avisar = useToast();

  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(hoy);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [justificacion, setJustificacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const denominaciones = useMemo(() => denominacionesDe(caja.moneda), [caja.moneda]);

  const esperadoPorClave = useMemo(() => {
    const mapa = new Map<number, number>();
    for (const d of caja.desglose) {
      const clave = claveDenominacion(d.denominacion);
      const cant = Math.max(0, Math.trunc(Number(d.cantidad) || 0));
      mapa.set(clave, (mapa.get(clave) ?? 0) + cant);
    }
    return mapa;
  }, [caja.desglose]);

  const filas = useMemo(
    () =>
      denominaciones.map((d) => {
        const clave = claveDenominacion(d.valor);
        const cantidadEsperada = esperadoPorClave.get(clave) ?? 0;
        const subtotalEsperado = redondear(d.valor * cantidadEsperada);
        const cantidadFisica = Math.max(0, Math.trunc(Number(cantidades[d.valor]) || 0));
        const subtotalFisico = redondear(d.valor * cantidadFisica);
        const difCant = cantidadFisica - cantidadEsperada;
        return {
          ...d,
          cantidadEsperada,
          subtotalEsperado,
          cantidadFisica,
          subtotalFisico,
          difCant,
        };
      }),
    [denominaciones, esperadoPorClave, cantidades],
  );

  const sistema = redondear(Number(caja.saldoActual) || 0);
  const contado = useMemo(
    () =>
      redondear(
        totalContado(
          filas.map((f) => ({ denominacion: f.valor, cantidad: f.cantidadFisica })),
        ),
      ),
    [filas],
  );
  const totalEsperadoTabla = useMemo(
    () =>
      redondear(
        totalContado(
          filas.map((f) => ({ denominacion: f.valor, cantidad: f.cantidadEsperada })),
        ),
      ),
    [filas],
  );
  const totalCantEsperada = useMemo(
    () => filas.reduce((acc, f) => acc + f.cantidadEsperada, 0),
    [filas],
  );
  const totalCantFisica = useMemo(
    () => filas.reduce((acc, f) => acc + f.cantidadFisica, 0),
    [filas],
  );

  const diferencia = redondear(contado - sistema);
  const cuadra = Math.abs(diferencia) < 0.005;
  const m = (n: number) => formatearMonto(n.toFixed(2), caja.moneda);

  function abrirModal() {
    setFecha(hoy);
    setCantidades({});
    setJustificacion("");
    setError(null);
    setAbierto(true);
  }

  async function onConfirmar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!cuadra && justificacion.trim().length < JUSTIFICACION_MINIMA) {
      setError(t("errores.falta_justificacion"));
      return;
    }

    setGuardando(true);
    try {
      const res = await cuadreYCierreCajaGeneralAction({
        cajaId: caja.id,
        fecha,
        conteos: filas
          .filter((f) => f.cantidadFisica > 0)
          .map((f) => ({ denominacion: f.valor, cantidad: f.cantidadFisica })),
        justificacion: justificacion.trim() || undefined,
      });

      if (res.exito) {
        setAbierto(false);
        avisar({ titulo: tg("cierreExitoso") });
        router.push("/contabilidad/cajas");
        router.refresh();
      } else {
        setError(t(`errores.${res.error}`));
      }
    } catch {
      setError(t("errores.error"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="md"
        className="whitespace-nowrap px-3.5"
        onClick={abrirModal}
      >
        <Calculator className="size-4" />
        {tg("cuadreYCierre")}
      </Button>

      <Dialog open={abierto} onOpenChange={(v) => !guardando && setAbierto(v)}>
        <DialogContent className="max-h-[92vh] w-[96vw] overflow-y-auto md:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{tg("cuadreTitulo", { nombre: caja.nombre })}</DialogTitle>
            <DialogDescription>{tg("cuadreDescripcion")}</DialogDescription>
          </DialogHeader>

          <form onSubmit={onConfirmar} className="space-y-5 pt-1 text-sm">
            {/* 1. Barra ejecutiva compacta */}
            <dl className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-linea bg-background px-4 py-3">
                <dt className="text-xs font-medium uppercase tracking-wider text-tinta-3">
                  {t("saldoSistema")}
                </dt>
                <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-tinta">
                  {m(sistema)}
                </dd>
              </div>

              <div className="rounded-xl border border-linea bg-background px-4 py-3">
                <dt className="text-xs font-medium uppercase tracking-wider text-tinta-3">
                  {t("saldoContado")}
                </dt>
                <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-marca-700">
                  {m(contado)}
                </dd>
              </div>

              <div className="rounded-xl border border-linea bg-background px-4 py-3">
                <dt className="text-xs font-medium uppercase tracking-wider text-tinta-3">
                  {t("diferencia")}
                </dt>
                <dd className="mt-1.5" aria-live="polite">
                  {cuadra ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-status-success-border bg-status-success-bg px-2.5 py-1 text-xs font-medium text-status-success-fg tabular-nums">
                      <CheckCircle2 className="size-3.5 shrink-0" />
                      {t("cuadradoMonto", { monto: m(0) })}
                    </span>
                  ) : diferencia < 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-status-danger-border bg-status-danger-bg px-2.5 py-1 text-xs font-medium text-status-danger-fg tabular-nums">
                      <AlertCircle className="size-3.5 shrink-0" />
                      {t("faltanteMonto", { monto: m(Math.abs(diferencia)) })}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-status-warning-border bg-status-warning-bg px-2.5 py-1 text-xs font-medium text-status-warning-fg tabular-nums">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      {t("sobranteMonto", { monto: m(diferencia) })}
                    </span>
                  )}
                </dd>
              </div>
            </dl>

            {/* 2. Metadatos y fecha de cuadre */}
            <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-linea bg-background px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div>
                  <span className="block text-[11px] font-medium uppercase tracking-wider text-tinta-3">
                    {t("cajaEtiqueta")}
                  </span>
                  <span className="font-medium text-tinta">
                    {caja.nombre}
                    {caja.cuentaContableCodigo && (
                      <span className="ml-1.5 font-mono text-xs text-tinta-2">
                        ({caja.cuentaContableCodigo})
                      </span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-medium uppercase tracking-wider text-tinta-3">
                    {t("responsable")}
                  </span>
                  <span className="font-medium text-tinta">{caja.responsableNombre}</span>
                </div>
                <div>
                  <span className="block text-[11px] font-medium uppercase tracking-wider text-tinta-3">
                    {t("supervisor")}
                  </span>
                  <span className="font-medium text-tinta">{supervisorNombre}</span>
                </div>
              </div>

              <div className="w-full space-y-1 sm:w-48">
                <Label htmlFor="cuadre-fecha" className="block text-xs font-medium leading-none text-tinta-2">
                  {tg("fechaCuadre")}
                </Label>
                <Input
                  id="cuadre-fecha"
                  type="date"
                  required
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* 3. Tabla comparativa por denominación */}
            <div className="overflow-x-auto rounded-xl border border-linea bg-background">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-linea bg-muted/40 text-xs text-tinta-2">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">{t("colDenominacion")}</th>
                    <th className="w-24 px-3 py-2.5 text-right font-medium">{t("colCantSistema")}</th>
                    <th className="w-32 px-3 py-2.5 text-right font-medium">{t("colSubtotalSistema")}</th>
                    <th className="w-28 px-3 py-2.5 text-right font-medium">{t("colCantFisica")}</th>
                    <th className="w-32 px-3 py-2.5 text-right font-medium">{t("colSubtotalFisico")}</th>
                    <th className="w-20 px-3 py-2.5 text-right font-medium">{t("colDif")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-linea">
                  {filas.map((f) => {
                    const hayDif = f.difCant !== 0;
                    return (
                      <tr
                        key={f.valor}
                        className={cn(
                          "transition-colors",
                          hayDif && "bg-status-warning-bg/25",
                        )}
                      >
                        <td className="px-3 py-1.5 font-mono text-xs text-tinta">
                          {f.tipo === "billete" ? t("billete") : t("monedaUnidad")} · {m(f.valor)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums text-tinta-2">
                          {f.cantidadEsperada}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums text-tinta-2">
                          {m(f.subtotalEsperado)}
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            disabled={guardando}
                            value={f.cantidadFisica === 0 ? "" : String(f.cantidadFisica)}
                            placeholder="0"
                            onChange={(e) => {
                              const crudo = e.target.value.trim();
                              const n = crudo === "" ? 0 : Math.max(0, Math.trunc(Number(crudo) || 0));
                              setCantidades((prev) => ({ ...prev, [f.valor]: n }));
                            }}
                            className="h-8 text-right font-mono text-xs tabular-nums"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs font-medium tabular-nums text-tinta">
                          {m(f.subtotalFisico)}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-1.5 text-right font-mono text-xs font-semibold tabular-nums",
                            f.difCant === 0
                              ? "text-tinta-3"
                              : f.difCant < 0
                                ? "text-status-danger-fg"
                                : "text-status-warning-fg",
                          )}
                        >
                          {f.difCant > 0 ? `+${f.difCant}` : f.difCant}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-linea bg-muted/30 font-mono text-xs font-semibold">
                  <tr>
                    <td className="px-3 py-2.5 uppercase tracking-wider text-tinta-2">
                      {tg("total")}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-tinta-2">
                      {totalCantEsperada}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-tinta">
                      {m(totalEsperadoTabla)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-marca-700">
                      {totalCantFisica}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-marca-700">
                      {m(contado)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right tabular-nums",
                        totalCantFisica - totalCantEsperada === 0
                          ? "text-tinta-3"
                          : "text-status-warning-fg",
                      )}
                    >
                      {totalCantFisica - totalCantEsperada > 0
                        ? `+${totalCantFisica - totalCantEsperada}`
                        : totalCantFisica - totalCantEsperada}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 4. Justificación cuando existe diferencia */}
            {!cuadra && (
              <div className="space-y-1.5">
                <Label htmlFor="cuadre-justificacion" className="text-xs font-medium text-tinta-2">
                  {t("justificacion")}
                  <span aria-hidden className="ml-0.5 text-status-danger-fg">*</span>
                </Label>
                <Textarea
                  id="cuadre-justificacion"
                  rows={2}
                  required
                  minLength={JUSTIFICACION_MINIMA}
                  maxLength={500}
                  value={justificacion}
                  onChange={(e) => setJustificacion(e.target.value)}
                  placeholder={tg("justificacionPlaceholder")}
                />
              </div>
            )}

            {error && <AvisoError>{error}</AvisoError>}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-linea pt-4">
              <Button
                type="button"
                variant="ghost"
                disabled={guardando}
                onClick={() => setAbierto(false)}
              >
                {t("cancelar")}
              </Button>
              <Button type="submit" cargando={guardando} disabled={guardando}>
                {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {tg("confirmarCuadreYCierre")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
