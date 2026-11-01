"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Calendar,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileCheck2,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type {
  PeriodoMensualItem,
  CierreAnualItem,
  ResumenPreCierreAnual,
} from "@/server/contabilidad/cierre/consultas";
import {
  cerrarPeriodoMensual,
  reabrirPeriodoMensual,
  ejecutarCierreAnual,
} from "@/server/contabilidad/cierre/acciones";

interface Props {
  ejercicioSeleccionado: number;
  periodosIniciales: PeriodoMensualItem[];
  cierresAnualesIniciales: CierreAnualItem[];
  resumenPreCierreInicial: ResumenPreCierreAnual;
}

export function VistaCierre({
  ejercicioSeleccionado,
  periodosIniciales,
  cierresAnualesIniciales,
  resumenPreCierreInicial,
}: Props) {
  const t = useTranslations("contab.cierreContable");
  const [isPending, startTransition] = useTransition();

  // Estados para diálogo de reapertura mensual
  const [periodoParaReabrir, setPeriodoParaReabrir] = useState<PeriodoMensualItem | null>(null);
  const [motivoReapertura, setMotivoReapertura] = useState("");
  const [errorReapertura, setErrorReapertura] = useState<string | null>(null);

  // Estados para diálogo de cierre anual
  const [dialogoCierreAnualAbierto, setDialogoCierreAnualAbierto] = useState(false);
  const [notasCierreAnual, setNotasCierreAnual] = useState("");
  const [errorCierreAnual, setErrorCierreAnual] = useState<string | null>(null);

  const nombresMeses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const formatearMonto = (valor: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(valor);
  };

  const mesesCerradosCount = periodosIniciales.filter((p) => p.estado === "cerrado").length;

  const handleCerrarMes = (periodoId: string) => {
    startTransition(async () => {
      try {
        await cerrarPeriodoMensual(periodoId);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Error al cerrar el período");
      }
    });
  };

  const handleReabrirMes = () => {
    if (!periodoParaReabrir) return;
    if (motivoReapertura.trim().length < 10) {
      setErrorReapertura(t("motivo"));
      return;
    }

    startTransition(async () => {
      try {
        await reabrirPeriodoMensual(periodoParaReabrir.id, motivoReapertura.trim());
        setPeriodoParaReabrir(null);
        setMotivoReapertura("");
        setErrorReapertura(null);
      } catch (err: unknown) {
        setErrorReapertura(err instanceof Error ? err.message : "Error al reabrir el período");
      }
    });
  };

  const handleEjecutarCierreAnual = () => {
    startTransition(async () => {
      try {
        await ejecutarCierreAnual(ejercicioSeleccionado, notasCierreAnual);
        setDialogoCierreAnualAbierto(false);
        setNotasCierreAnual("");
        setErrorCierreAnual(null);
      } catch (err: unknown) {
        setErrorCierreAnual(err instanceof Error ? err.message : "Error al ejecutar el cierre anual");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("antetitulo")}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("titulo")}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">{t("ejercicio")}:</span>
          <span className="text-base font-bold text-[#2096BA] bg-muted/70 px-3 py-1 rounded border border-linea">
            {ejercicioSeleccionado}
          </span>
        </div>
      </div>

      {/* Tarjetas resumen del ejercicio */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Estado del Ejercicio */}
        <div className="rounded-lg border border-linea bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">{t("tarjetaEstado")}</p>
          <div className="flex items-center gap-2 mt-2">
            {resumenPreCierreInicial.yaCerrado ? (
              <>
                <Lock className="h-5 w-5 text-[#2096BA]" />
                <span className="text-lg font-bold text-foreground">{t("estadoCerrado")}</span>
              </>
            ) : (
              <>
                <Unlock className="h-5 w-5 text-[#1E9E6A]" />
                <span className="text-lg font-bold text-foreground">{t("estadoAbierto")}</span>
              </>
            )}
          </div>
        </div>

        {/* Meses Cerrados */}
        <div className="rounded-lg border border-linea bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">{t("tarjetaMeses")}</p>
          <div className="flex items-center gap-2 mt-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <span className="text-lg font-bold text-foreground tabular-nums">
              {mesesCerradosCount} / 12
            </span>
            <span className="text-xs text-muted-foreground">
              ({Math.round((mesesCerradosCount / 12) * 100)} %)
            </span>
          </div>
        </div>

        {/* Resultado Proyectado del Ejercicio */}
        <div className="rounded-lg border border-linea bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">{t("tarjetaSuperavit")}</p>
          <p
            className={`text-lg font-bold tabular-nums mt-2 ${
              resumenPreCierreInicial.superavitDeficitNeto >= 0
                ? "text-[#1E9E6A]"
                : "text-[#B4342B]"
            }`}
          >
            {formatearMonto(resumenPreCierreInicial.superavitDeficitNeto)}
          </p>
        </div>
      </div>

      {/* 1. CONTROL MENSUAL DE PERÍODOS */}
      <div className="rounded-lg border border-linea bg-card p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-linea pb-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              {t("seccionMeses")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Bloqueo contra modificaciones y control de borradores pendientes
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted text-foreground font-semibold">
              <tr>
                <th className="p-3">{t("mes")}</th>
                <th className="p-3">{t("estado")}</th>
                <th className="p-3 text-right">{t("asientos")}</th>
                <th className="p-3 text-center">{t("borradores")}</th>
                <th className="p-3">{t("cerradoPor")}</th>
                <th className="p-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {periodosIniciales.map((p) => {
                const totalBorradores =
                  p.borradoresRecibos +
                  p.borradoresFacturas +
                  p.borradoresNominas +
                  p.borradoresConteos;

                return (
                  <tr key={p.id} className="hover:bg-muted/20">
                    <td className="p-3 font-semibold text-foreground">
                      {nombresMeses[p.mes - 1]} {p.anio}
                    </td>
                    <td className="p-3">
                      {p.estado === "cerrado" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-linea bg-muted px-2.5 py-0.5 text-[11px] font-medium text-foreground">
                          <Lock className="h-3 w-3 text-[#2096BA]" />
                          {t("estadoCerrado")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-linea bg-muted px-2.5 py-0.5 text-[11px] font-medium text-[#1E9E6A]">
                          <Unlock className="h-3 w-3 text-[#1E9E6A]" />
                          {t("estadoAbierto")}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right tabular-nums text-muted-foreground">
                      {p.totalAsientos}
                    </td>
                    <td className="p-3 text-center tabular-nums">
                      {totalBorradores > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-[#B4342B]">
                          <AlertTriangle className="h-3 w-3 text-[#B4342B]" />
                          {totalBorradores} pendientes
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">0</span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {p.estado === "cerrado" ? (
                        <div>
                          <span>{p.cerradoPorNombre ?? "—"}</span>
                          {p.cerradoEn && (
                            <span className="block text-[10px] text-muted-foreground">
                              {new Date(p.cerradoEn).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ) : p.motivoReapertura ? (
                        <span className="text-[10px] italic text-muted-foreground" title={p.motivoReapertura}>
                          Reabierto: {p.motivoReapertura.slice(0, 25)}...
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {p.estado === "abierto" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending || totalBorradores > 0}
                          onClick={() => handleCerrarMes(p.id)}
                          className="border-linea text-xs h-7"
                        >
                          <Lock className="mr-1 h-3 w-3 text-[#2096BA]" />
                          {t("cerrarMes")}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending || resumenPreCierreInicial.yaCerrado}
                          onClick={() => setPeriodoParaReabrir(p)}
                          className="text-xs h-7 text-muted-foreground hover:text-foreground"
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          {t("reabrirMes")}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. ASISTENTE DE CIERRE ANUAL */}
      <div className="rounded-lg border border-linea bg-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-linea pb-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              {t("seccionCierreAnual")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Liquidación de cuentas de ingresos y gastos hacia Resultados Acumulados
            </p>
          </div>

          {!resumenPreCierreInicial.yaCerrado && (
            <Button
              disabled={isPending || !resumenPreCierreInicial.todosMesesCerrados}
              onClick={() => setDialogoCierreAnualAbierto(true)}
              className="mt-3 sm:mt-0 bg-[#2096BA] hover:bg-[#187a99] text-white text-xs h-9"
            >
              <FileCheck2 className="mr-2 h-4 w-4" />
              {t("ejecutarCierre")}
            </Button>
          )}
        </div>

        {!resumenPreCierreInicial.todosMesesCerrados && !resumenPreCierreInicial.yaCerrado && (
          <div className="flex items-center gap-2 rounded-lg border border-linea bg-muted p-3 text-xs text-muted-foreground">
            <AlertCircle className="h-4 w-4 text-[#2096BA]" />
            <span>{t("alertaMesesAbiertos")}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2">
          <div className="rounded border border-linea p-3 bg-muted/40 text-xs">
            <span className="text-muted-foreground block">{t("ingresosLiquidar")}</span>
            <span className="text-base font-bold text-foreground tabular-nums mt-1 block">
              {formatearMonto(resumenPreCierreInicial.totalIngresos)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {resumenPreCierreInicial.cuentasIngresoSaldar.length} cuentas con saldo acreedor
            </span>
          </div>

          <div className="rounded border border-linea p-3 bg-muted/40 text-xs">
            <span className="text-muted-foreground block">{t("gastosLiquidar")}</span>
            <span className="text-base font-bold text-foreground tabular-nums mt-1 block">
              {formatearMonto(resumenPreCierreInicial.totalGastos)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {resumenPreCierreInicial.cuentasGastoSaldar.length} cuentas con saldo deudor
            </span>
          </div>

          <div className="rounded border border-linea p-3 bg-muted/40 text-xs">
            <span className="text-muted-foreground block">{t("resultadoNeto")}</span>
            <span
              className={`text-base font-bold tabular-nums mt-1 block ${
                resumenPreCierreInicial.superavitDeficitNeto >= 0
                  ? "text-[#1E9E6A]"
                  : "text-[#B4342B]"
              }`}
            >
              {formatearMonto(resumenPreCierreInicial.superavitDeficitNeto)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {t("cuentaDestino")}
            </span>
          </div>
        </div>
      </div>

      {/* 3. HISTORIAL DE CIERRES ANUALES */}
      <div className="rounded-lg border border-linea bg-card p-5 space-y-4">
        <div className="border-b border-linea pb-3">
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            {t("seccionHistorial")}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Registro formal inmutable de ejercicios cerrados
          </p>
        </div>

        {cierresAnualesIniciales.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            {t("sinHistorial")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted text-foreground font-semibold">
                <tr>
                  <th className="p-3">{t("ejercicio")}</th>
                  <th className="p-3">{t("fechaCierre")}</th>
                  <th className="p-3">#{t("asientoCierre")}</th>
                  <th className="p-3 text-right">Ingresos</th>
                  <th className="p-3 text-right">Gastos</th>
                  <th className="p-3 text-right">Superávit / Déficit</th>
                  <th className="p-3">{t("cerradoPorUsuario")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {cierresAnualesIniciales.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20">
                    <td className="p-3 font-bold text-foreground">{c.ejercicio}</td>
                    <td className="p-3 tabular-nums text-muted-foreground">{c.fechaCierre}</td>
                    <td className="p-3 font-medium tabular-nums text-[#2096BA]">
                      {c.asientoCierreNumero ? `#${c.asientoCierreNumero}` : "—"}
                    </td>
                    <td className="p-3 text-right tabular-nums">{formatearMonto(c.totalIngresos)}</td>
                    <td className="p-3 text-right tabular-nums">{formatearMonto(c.totalGastos)}</td>
                    <td
                      className={`p-3 text-right tabular-nums font-semibold ${
                        c.superavitDeficit >= 0 ? "text-[#1E9E6A]" : "text-[#B4342B]"
                      }`}
                    >
                      {formatearMonto(c.superavitDeficit)}
                    </td>
                    <td className="p-3 text-muted-foreground">{c.cerradoPorNombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DIÁLOGO REAPERTURA DE PERÍODO MENSUAL */}
      <Dialog
        open={periodoParaReabrir !== null}
        onOpenChange={(abierto) => !abierto && setPeriodoParaReabrir(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("modalReabrirTitulo")}</DialogTitle>
            <DialogDescription>{t("modalReabrirDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {errorReapertura && (
              <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                {errorReapertura}
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="motivoReapertura">{t("motivo")}</Label>
              <Textarea
                id="motivoReapertura"
                value={motivoReapertura}
                onChange={(e) => setMotivoReapertura(e.target.value)}
                placeholder={t("motivoPlaceholder")}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPeriodoParaReabrir(null)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleReabrirMes}
              disabled={isPending || motivoReapertura.trim().length < 10}
              className="bg-[#2096BA] hover:bg-[#187a99] text-white"
            >
              {isPending ? "Reabriendo..." : t("confirmarReabrir")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO EJECUTAR CIERRE ANUAL */}
      <Dialog open={dialogoCierreAnualAbierto} onOpenChange={setDialogoCierreAnualAbierto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("modalCierreAnualTitulo")}</DialogTitle>
            <DialogDescription>{t("modalCierreAnualDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            {errorCierreAnual && (
              <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                {errorCierreAnual}
              </p>
            )}

            <div className="rounded border border-linea p-3 bg-muted/30 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("ingresosLiquidar")}:</span>
                <span className="font-semibold tabular-nums">{formatearMonto(resumenPreCierreInicial.totalIngresos)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("gastosLiquidar")}:</span>
                <span className="font-semibold tabular-nums">{formatearMonto(resumenPreCierreInicial.totalGastos)}</span>
              </div>
              <div className="flex justify-between border-t border-linea pt-1.5 font-bold text-sm">
                <span>{t("resultadoNeto")}:</span>
                <span className="tabular-nums text-[#2096BA]">{formatearMonto(resumenPreCierreInicial.superavitDeficitNeto)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notasCierre">{t("notas")}</Label>
              <Textarea
                id="notasCierre"
                value={notasCierreAnual}
                onChange={(e) => setNotasCierreAnual(e.target.value)}
                placeholder={t("notasPlaceholder")}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogoCierreAnualAbierto(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEjecutarCierreAnual}
              disabled={isPending}
              className="bg-[#2096BA] hover:bg-[#187a99] text-white"
            >
              {isPending ? t("ejecutando") : t("ejecutarCierre")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
