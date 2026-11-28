"use client";

import { useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { AvisoError } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import {
  JUSTIFICACION_MINIMA,
  claveDenominacion,
  denominacionesDe,
  redondear,
  totalContado,
} from "@/lib/contabilidad/cajas";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { cn } from "@/lib/utils";
import { realizarArqueoAction } from "@/server/contabilidad/cajas/acciones";
import type { CajaResumen } from "@/server/contabilidad/cajas/consultas";

/**
 * Arqueo físico comparativo por denominación:
 *   · Barra superior compacta con Saldo según sistema, Saldo físico contado y Diferencia.
 *   · Tabla unificada comparando Sistema (esperado, solo lectura) vs Conteo físico (editable)
 *     con indicador de diferencia por denominación y fila de totales.
 *   · Al cerrar y firmar, abre/descarga automáticamente el Acta de Arqueo en PDF.
 */
export function ContadorArqueo({
  caja,
  hoy,
  contador,
}: {
  caja: CajaResumen;
  hoy: string;
  contador: string;
}) {
  const t = useTranslations("contab.cajas");
  const router = useRouter();
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

  const [fecha, setFecha] = useState(hoy);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [justificacion, setJustificacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const totalEsperadoTabla = useMemo(
    () =>
      redondear(
        totalContado(
          filas.map((f) => ({ denominacion: f.valor, cantidad: f.cantidadEsperada })),
        ),
      ),
    [filas],
  );
  const contado = useMemo(
    () =>
      redondear(
        totalContado(
          filas.map((f) => ({ denominacion: f.valor, cantidad: f.cantidadFisica })),
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
  const cuadra = diferencia === 0;
  const m = (n: number) => formatearMonto(n.toFixed(2), caja.moneda);

  function abrirPdfActa(arqueoId: string) {
    const urlPdf = `/api/contabilidad/cajas/arqueos/${arqueoId}/pdf`;
    const ventana = window.open(urlPdf, "_blank", "noopener,noreferrer");
    if (!ventana) {
      const enlace = document.createElement("a");
      enlace.href = `${urlPdf}?download=1`;
      enlace.download = `acta-arqueo-${arqueoId}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
    }
  }

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    if (!cuadra && justificacion.trim().length < JUSTIFICACION_MINIMA) {
      setError(t("errores.falta_justificacion"));
      return;
    }

    setGuardando(true);
    try {
      const res = await realizarArqueoAction({
        cajaId: caja.id,
        fecha,
        conteos: filas
          .filter((f) => f.cantidadFisica > 0)
          .map((f) => ({ denominacion: f.valor, cantidad: f.cantidadFisica })),
        justificacion: justificacion.trim() || undefined,
      });

      if (res.exito) {
        if (res.id) {
          abrirPdfActa(res.id);
        }
        router.push(`/contabilidad/cajas/${caja.id}`);
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
    <form onSubmit={guardar} className="space-y-5">
      {/* 1. Barra ejecutiva de métricas compactas */}
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

      {/* Barra compacta de datos de la caja + Fecha del arqueo */}
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
              {t("auditorSupervisor")}
            </span>
            <span className="font-medium text-tinta">{contador}</span>
          </div>
        </div>

        <div className="w-full space-y-1 sm:w-48">
          <Label
            htmlFor="arq-fecha"
            className="block text-xs font-medium leading-none text-tinta-2"
          >
            {t("fechaArqueo")}
          </Label>
          <Input
            id="arq-fecha"
            type="date"
            required
            max={hoy}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="h-9 px-3 py-0 text-sm"
          />
        </div>
      </div>

      {/* 2. Tabla comparativa unificada (Sistema Esperado vs Conteo Físico) */}
      <fieldset className="overflow-hidden rounded-xl border border-linea bg-background">
        <legend className="sr-only">{t("denominaciones")}</legend>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-linea text-[11px] font-semibold uppercase tracking-wider">
                <th
                  rowSpan={2}
                  className="bg-background px-4 py-2.5 align-bottom text-tinta-2"
                >
                  {t("colDenominacion")}
                </th>
                <th
                  colSpan={2}
                  className="border-x border-linea bg-muted/50 px-3 py-2 text-center text-tinta-2"
                >
                  {t("grupoSistema")}
                </th>
                <th
                  colSpan={2}
                  className="border-r border-linea bg-marca-50/70 px-3 py-2 text-center text-marca-800"
                >
                  {t("grupoFisico")}
                </th>
                <th
                  rowSpan={2}
                  className="bg-background px-4 py-2.5 text-right align-bottom text-tinta-2"
                >
                  {t("colDifCant")}
                </th>
              </tr>
              <tr className="border-b border-linea text-xs font-medium text-tinta-2">
                <th className="whitespace-nowrap border-l border-linea bg-muted/40 px-3 py-2 text-right">
                  {t("colCantEsperada")}
                </th>
                <th className="whitespace-nowrap border-r border-linea bg-muted/40 px-3 py-2 text-right">
                  {t("colSubtotalEsperado")}
                </th>
                <th className="whitespace-nowrap bg-marca-50/40 px-3 py-2 text-right text-marca-800">
                  {t("colCantFisica")}
                </th>
                <th className="whitespace-nowrap border-r border-linea bg-marca-50/40 px-3 py-2 text-right text-marca-800">
                  {t("colSubtotalFisico")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {filas.map((f) => (
                <tr key={f.valor} className="transition-colors hover:bg-muted/20">
                  <td className="whitespace-nowrap px-4 py-2">
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={`den-${f.valor}`}
                        className="font-mono text-sm font-medium tabular-nums text-tinta"
                      >
                        {m(f.valor)}
                      </label>
                      <span className="rounded-full border border-linea bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-tinta-2">
                        {f.tipo === "billete" ? t("billete") : t("monedaUnidad")}
                      </span>
                    </div>
                  </td>

                  <td className="whitespace-nowrap border-l border-linea bg-muted/35 px-3 py-2 text-right font-mono text-sm tabular-nums text-tinta-2">
                    {f.cantidadEsperada}
                  </td>
                  <td className="whitespace-nowrap border-r border-linea bg-muted/35 px-3 py-2 text-right font-mono text-sm tabular-nums text-tinta-2">
                    {m(f.subtotalEsperado)}
                  </td>

                  <td className="px-3 py-1.5 text-right">
                    <div className="flex justify-end">
                      <Input
                        id={`den-${f.valor}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        placeholder="0"
                        value={f.cantidadFisica === 0 ? "" : String(f.cantidadFisica)}
                        onChange={(e) => {
                          const crudo = e.target.value.trim();
                          if (crudo === "") {
                            setCantidades((prev) => ({ ...prev, [f.valor]: 0 }));
                            return;
                          }
                          const parsed = Number(crudo);
                          const valor = Number.isFinite(parsed)
                            ? Math.max(0, Math.trunc(parsed))
                            : 0;
                          setCantidades((prev) => ({ ...prev, [f.valor]: valor }));
                        }}
                        className="h-8 w-24 px-2.5 text-right font-mono text-sm tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </div>
                  </td>
                  <td className="whitespace-nowrap border-r border-linea px-3 py-2 text-right font-mono text-sm font-medium tabular-nums text-tinta">
                    {m(f.subtotalFisico)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-xs tabular-nums">
                    {f.difCant === 0 ? (
                      <span className="text-tinta-3">0</span>
                    ) : f.difCant < 0 ? (
                      <span className="inline-flex rounded-full border border-status-danger-border bg-status-danger-bg px-2 py-0.5 font-semibold text-status-danger-fg">
                        {f.difCant}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-status-warning-border bg-status-warning-bg px-2 py-0.5 font-semibold text-status-warning-fg">
                        +{f.difCant}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-linea bg-muted/50 text-sm font-semibold text-tinta">
              <tr>
                <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-tinta-2">
                  {t("totales")}
                </td>
                <td className="whitespace-nowrap border-l border-linea px-3 py-3 text-right font-mono tabular-nums text-tinta-2">
                  {totalCantEsperada}
                </td>
                <td className="whitespace-nowrap border-r border-linea px-3 py-3 text-right font-mono tabular-nums text-tinta">
                  {m(totalEsperadoTabla)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums text-marca-700">
                  {totalCantFisica}
                </td>
                <td className="whitespace-nowrap border-r border-linea px-3 py-3 text-right font-mono tabular-nums text-marca-700">
                  {m(contado)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums">
                  <span
                    className={cn(
                      cuadra
                        ? "text-status-success-fg"
                        : diferencia < 0
                          ? "text-status-danger-fg"
                          : "text-status-warning-fg",
                    )}
                  >
                    {diferencia > 0 ? `+${m(diferencia)}` : m(diferencia)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </fieldset>

      {/* 3. Justificación (obligatoria si hay diferencia, opcional si cuadra) */}
      <div
        className={cn(
          "space-y-2 rounded-xl border p-4 transition-colors",
          !cuadra
            ? "border-status-warning-border bg-status-warning-bg/35"
            : "border-linea bg-background",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="arq-justificacion" className="text-sm font-medium text-tinta">
            {t("justificacion")}
            {!cuadra && (
              <span aria-hidden className="ml-0.5 text-status-danger-fg">
                *
              </span>
            )}
          </Label>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              !cuadra
                ? "border border-status-warning-border bg-status-warning-bg text-status-warning-fg"
                : "bg-muted text-tinta-3",
            )}
          >
            {!cuadra ? t("justificacionObligatoria") : t("justificacionOpcional")}
          </span>
        </div>
        <Textarea
          id="arq-justificacion"
          required={!cuadra}
          minLength={!cuadra ? JUSTIFICACION_MINIMA : undefined}
          maxLength={500}
          rows={2}
          value={justificacion}
          onChange={(e) => setJustificacion(e.target.value)}
          className="bg-background"
        />
      </div>

      <p className="texto-meta">{t("firmaConteo", { nombre: contador })}</p>
      {error && <AvisoError>{error}</AvisoError>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" cargando={guardando} disabled={guardando}>
          {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {t("guardarArqueo")}
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/contabilidad/cajas/${caja.id}`}>{t("cancelar")}</Link>
        </Button>
      </div>
    </form>
  );
}
