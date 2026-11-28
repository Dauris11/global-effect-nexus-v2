"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertTriangle, Link2, Loader2, Unlink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { AvisoError, AvisoOk, Monto, SELECT } from "@/components/contabilidad/comun";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TooltipAyuda } from "@/components/ui/tooltip-ayuda";
import type { Moneda } from "@/lib/contabilidad/formato";
import { normalizarReferenciaBanco } from "@/lib/contabilidad/formato-estado-banco";
import type { ImpuestoCargo } from "@/lib/contabilidad/impuestos-cargos";
import { fechaCorta } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import {
  anularPartida,
  conciliarCargoBancario,
  conciliarPartida,
  type EstadoBanco,
} from "@/server/contabilidad/bancos/acciones";
import type { LineaAsientoBanco, LineaExtracto } from "@/server/contabilidad/bancos/consultas";

const INICIAL: EstadoBanco = { estado: "inicial" };

function useError(estado: EstadoBanco): string | null {
  const t = useTranslations("contab");
  if (estado.estado === "inicial" || estado.estado === "ok") return null;
  return t(`error.${estado.estado}` as never);
}

/** Igualdad de montos para resaltar parejas; la que manda es la del servidor. */
const mismoMonto = (a: string, b: string) => Math.abs(Number(a) - Number(b)) < 0.005;
const esCero = (v: string) => /^-?0+(\.0+)?$/.test(v);

/**
 * Conciliar en dos tablas lado a lado:
 *   · Izquierda: Libro diario (cuenta contable vinculada al banco).
 *   · Derecha: Transacciones del banco, con lista desplegable «Comisiones»
 *     junto al título cargada desde Parámetros legales → Impuestos y Cargos:
 *       - Sin cargo seleccionado: conciliación normal banco ↔ libro diario.
 *       - Cargo fijo (p. ej. Impuesto por transferencia 0.20%): selecciona la
 *         transacción del banco y la carga directamente a la cuenta configurada.
 *       - Cargo variable (p. ej. Comisiones bancarias): permite seleccionar
 *         múltiples transacciones del banco y conciliarlas todas contra la
 *         cuenta contable configurada.
 */
export function Conciliador({
  cuentaId,
  moneda,
  banco,
  libros,
  cargos,
}: {
  cuentaId: string;
  moneda: Moneda;
  banco: LineaExtracto[];
  libros: LineaAsientoBanco[];
  cargos: ImpuestoCargo[];
}) {
  const t = useTranslations("contab.conciliacion");
  const idioma = useLocale() === "en" ? "en" : "es";
  const [cargoId, setCargoId] = useState<string>("");
  const [extractos, setExtractos] = useState<string[]>([]);
  const [lineas, setLineas] = useState<string[]>([]);

  const cargoActivo = useMemo(
    () => cargos.find((c) => c.id === cargoId) ?? null,
    [cargos, cargoId],
  );
  const permiteMultipleBanco = Boolean(cargoActivo);

  const [estado, enviar, enviando] = useActionState(async (previo: EstadoBanco, datos: FormData) => {
    const modoCargo = Boolean(String(datos.get("cargo_id") ?? "").trim());
    const resultado = modoCargo
      ? await conciliarCargoBancario(previo, datos)
      : await conciliarPartida(previo, datos);
    if (resultado.estado === "ok") {
      setExtractos([]);
      setLineas([]);
    }
    return resultado;
  }, INICIAL);
  const error = useError(estado);

  function cambiarCargo(nuevoId: string) {
    setCargoId(nuevoId);
    setLineas([]);
    if (!nuevoId) {
      setExtractos((prev) => prev.slice(0, 1));
    }
  }

  const toggleLinea = (id: string) => {
    if (cargoActivo) return;
    setLineas((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleBanco = (id: string) => {
    if (permiteMultipleBanco) {
      setExtractos((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
    } else {
      setExtractos((prev) => (prev[0] === id ? [] : [id]));
    }
  };

  // Referencias presentes en ambos lados cuyo monto NO coincide -> resaltar en naranja.
  const refsConDiferencia = useMemo(() => {
    const conjunto = new Set<string>();
    for (const b of banco) {
      const refB = normalizarReferenciaBanco(b.referencia);
      if (!refB) continue;
      const enLibro = libros.filter((l) => normalizarReferenciaBanco(l.referencia) === refB);
      if (enLibro.length > 0 && !enLibro.some((l) => mismoMonto(l.monto, b.monto))) {
        conjunto.add(refB);
      }
    }
    return conjunto;
  }, [banco, libros]);

  const bancoSeleccionados = banco.filter((b) => extractos.includes(b.id));
  const elegido = bancoSeleccionados[0] ?? null;
  const sumaBanco = bancoSeleccionados.reduce((acc, b) => acc + Math.abs(Number(b.monto)), 0);

  const seleccionados = libros.filter((l) => lineas.includes(l.id));
  const sumaLibros = seleccionados.reduce((acc, l) => acc + Number(l.monto), 0);
  const diferencia = elegido ? Number(elegido.monto) - sumaLibros : 0;

  const listo = cargoActivo
    ? bancoSeleccionados.length > 0
    : elegido !== null && seleccionados.length > 0 && Math.abs(diferencia) < 0.005;

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="cuenta" value={cuentaId} />
      {cargoId && <input type="hidden" name="cargo_id" value={cargoId} />}
      {extractos.map((id) => (
        <input key={id} type="hidden" name="extracto" value={id} />
      ))}

      {refsConDiferencia.size > 0 && !cargoActivo && (
        <div className="flex items-center gap-2 rounded-control border border-pri-alta/40 bg-pri-alta/10 px-3.5 py-2.5 text-xs text-tinta">
          <AlertTriangle className="size-4 shrink-0 text-pri-alta" />
          <span>{t("avisoDiferenciaRef")}</span>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Izquierda: Libro diario */}
        <section className={cn("min-w-0 space-y-3", cargoActivo && "opacity-60")}>
          <div className="flex min-h-9 items-center gap-1.5">
            <h2 className="text-sm font-semibold text-tinta">{t("libroDiario", { n: libros.length })}</h2>
            <TooltipAyuda texto={t("libroDiarioAyuda")} etiqueta={t("masInformacion")} />
          </div>

          {libros.length === 0 ? (
            <p className="texto-meta">{t("librosVacio")}</p>
          ) : (
            <div className="overflow-x-auto rounded-card border border-linea bg-card shadow-card">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-linea text-tinta-3">
                  <tr>
                    <th className="w-10 px-2.5 py-2.5" aria-label={t("seleccionar")} />
                    <th className="whitespace-nowrap px-2.5 py-2.5 font-medium">{t("col.fecha")}</th>
                    <th className="px-2.5 py-2.5 font-medium">{t("col.descripcion")}</th>
                    <th className="whitespace-nowrap px-2.5 py-2.5 font-medium">{t("col.referencia")}</th>
                    <th className="whitespace-nowrap px-2.5 py-2.5 text-right font-medium">{t("col.debito")}</th>
                    <th className="whitespace-nowrap px-2.5 py-2.5 text-right font-medium">{t("col.credito")}</th>
                  </tr>
                </thead>
                <tbody>
                  {libros.map((l) => {
                    const seleccionada = !cargoActivo && lineas.includes(l.id);
                    const refNorm = normalizarReferenciaBanco(l.referencia);
                    const refDiferente = !cargoActivo && refNorm !== "" && refsConDiferencia.has(refNorm);
                    return (
                      <tr
                        key={l.id}
                        onClick={() => toggleLinea(l.id)}
                        className={cn(
                          "border-b border-linea transition-colors last:border-b-0",
                          !cargoActivo && "cursor-pointer hover:bg-muted/40",
                          refDiferente && "border-l-2 border-l-pri-alta bg-pri-alta/15 hover:bg-pri-alta/20",
                          seleccionada && "bg-marca-500/15 hover:bg-marca-500/20",
                        )}
                      >
                        <td className="px-2.5 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            name={cargoActivo ? undefined : "linea"}
                            value={l.id}
                            disabled={Boolean(cargoActivo)}
                            checked={seleccionada}
                            onChange={() => toggleLinea(l.id)}
                            aria-label={l.concepto}
                            className="size-4 rounded accent-marca-500"
                          />
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-2.5 tabular-nums text-tinta-2">
                          {fechaCorta(l.fecha, idioma)}
                        </td>
                        <td className="max-w-44 truncate px-2.5 py-2.5 text-tinta" title={l.concepto}>
                          {l.concepto}
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-2.5 font-mono text-tinta-2">
                          <span className="inline-flex items-center gap-1">
                            {refDiferente && <AlertTriangle className="size-3.5 shrink-0 text-pri-alta" />}
                            {l.referencia || "—"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums text-tinta">
                          {esCero(l.debe) ? <span className="text-tinta-3">—</span> : <Monto valor={l.debe} moneda={moneda} />}
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums text-tinta">
                          {esCero(l.haber) ? <span className="text-tinta-3">—</span> : <Monto valor={l.haber} moneda={moneda} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Derecha: Transacciones del banco + desplegable Comisiones */}
        <section className="min-w-0 space-y-3">
          <div className="flex min-h-9 flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-tinta">{t("transaccionesBanco", { n: banco.length })}</h2>
              <TooltipAyuda texto={t("transaccionesBancoAyuda")} etiqueta={t("masInformacion")} />
            </div>

            <select
              aria-label={t("comisionesSelector")}
              value={cargoId}
              onChange={(e) => cambiarCargo(e.target.value)}
              className={cn(SELECT, "h-8 w-56 shrink-0 text-xs")}
            >
              <option value="">{t("comisionesDefault")}</option>
              {cargos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          {banco.length === 0 ? (
            <p className="texto-meta">{t("bancoVacio")}</p>
          ) : (
            <div className="overflow-x-auto rounded-card border border-linea bg-card shadow-card">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-linea text-tinta-3">
                  <tr>
                    <th className="w-10 px-2.5 py-2.5" aria-label={t("seleccionar")} />
                    <th className="whitespace-nowrap px-2.5 py-2.5 font-medium">{t("col.fechaEfectiva")}</th>
                    <th className="whitespace-nowrap px-2.5 py-2.5 font-medium">{t("col.noReferencia")}</th>
                    <th className="px-2.5 py-2.5 font-medium">{t("col.descripcion")}</th>
                    <th className="whitespace-nowrap px-2.5 py-2.5 text-right font-medium">{t("col.retiros")}</th>
                    <th className="whitespace-nowrap px-2.5 py-2.5 text-right font-medium">{t("col.depositos")}</th>
                  </tr>
                </thead>
                <tbody>
                  {banco.map((b) => {
                    const seleccionada = extractos.includes(b.id);
                    const refNorm = normalizarReferenciaBanco(b.referencia);
                    const refDiferente = !cargoActivo && refNorm !== "" && refsConDiferencia.has(refNorm);
                    return (
                      <tr
                        key={b.id}
                        onClick={() => toggleBanco(b.id)}
                        className={cn(
                          "cursor-pointer border-b border-linea transition-colors last:border-b-0 hover:bg-muted/40",
                          refDiferente && "border-l-2 border-l-pri-alta bg-pri-alta/15 hover:bg-pri-alta/20",
                          seleccionada && "bg-marca-500/15 hover:bg-marca-500/20",
                        )}
                      >
                        <td className="px-2.5 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={seleccionada}
                            onChange={() => toggleBanco(b.id)}
                            aria-label={b.descripcion}
                            className="size-4 rounded accent-marca-500"
                          />
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-2.5 tabular-nums text-tinta-2">
                          {fechaCorta(b.fecha, idioma)}
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-2.5 font-mono text-tinta-2">
                          <span className="inline-flex items-center gap-1">
                            {refDiferente && <AlertTriangle className="size-3.5 shrink-0 text-pri-alta" />}
                            {b.referencia || "—"}
                          </span>
                        </td>
                        <td className="max-w-44 truncate px-2.5 py-2.5 text-tinta" title={b.descripcion}>
                          {b.descripcion}
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums text-tinta">
                          {esCero(b.retiros) ? <span className="text-tinta-3">—</span> : <Monto valor={b.retiros} moneda={moneda} />}
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums text-marca-600">
                          {esCero(b.depositos) ? <span className="text-tinta-3">—</span> : <Monto valor={b.depositos} moneda={moneda} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Barra de totales cuando hay múltiples transacciones seleccionadas */}
      {!cargoActivo && seleccionados.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-linea bg-card p-3 shadow-card">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{t("variosAsientos", { n: seleccionados.length })}</Badge>
            <span className="text-sm font-medium text-tinta">
              {t("sumaSeleccionada", { suma: sumaLibros.toFixed(2) })}
            </span>
          </div>
          {elegido && !listo && (
            <span className="text-sm font-semibold text-pri-alta">
              {t("diferencia", { dif: Math.abs(diferencia).toFixed(2) })}
            </span>
          )}
        </div>
      )}

      {cargoActivo && bancoSeleccionados.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-linea bg-card p-3 shadow-card">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="marca">{cargoActivo.nombre}</Badge>
            <span className="text-sm font-medium text-tinta">
              {t("seleccionBancoCargo", { n: bancoSeleccionados.length })}
            </span>
          </div>
          <span className="text-sm font-semibold tabular-nums text-tinta">
            <Monto valor={sumaBanco.toFixed(2)} moneda={moneda} />
          </span>
        </div>
      )}

      {error && <AvisoError>{error}</AvisoError>}
      {estado.estado === "ok" && <AvisoOk>{t("conciliadaOk")}</AvisoOk>}
      {!cargoActivo && elegido && seleccionados.length > 0 && !listo && (
        <p className="texto-meta">{t("montosDistintos")}</p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={!listo || enviando}>
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
          {t("conciliar")}
        </Button>
      </div>
    </form>
  );
}

/** Anular / reversar una conciliación desde Conciliadas con mensaje explícito de confirmación. */
export function BotonAnularPartida({ id }: { id: string }) {
  const t = useTranslations("contab.conciliacion");
  const [abierto, setAbierto] = useState(false);
  const [estado, enviar, enviando] = useActionState(async (previo: EstadoBanco, datos: FormData) => {
    const resultado = await anularPartida(previo, datos);
    if (resultado.estado === "ok") setAbierto(false);
    return resultado;
  }, INICIAL);
  const error = useError(estado);

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 px-2 text-[11px] font-medium">
          {t("anular")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("anularTitulo")}</DialogTitle>
        </DialogHeader>
        <form action={enviar} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <p className="text-sm text-tinta-2">{t("anularMensaje")}</p>
          {error && <AvisoError>{error}</AvisoError>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
              {t("cancelar")}
            </Button>
            <Button type="submit" variant="destructive" cargando={enviando}>
              {enviando ? <Loader2 className="size-4 animate-spin" /> : <Unlink className="size-4" />}
              {t("anularConfirmar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
