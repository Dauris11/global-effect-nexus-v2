"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FileText, Download, CheckCircle2, DollarSign, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { NominaDetallada } from "@/server/contabilidad/nomina/consultas";
import {
  aprobarNomina,
  pagarNomina,
  obtenerDetalleNominaAccion,
  generarTxtTssAccion,
} from "@/server/contabilidad/nomina/acciones";

export function DialogoDetalleNomina({
  nominaId,
  codigo,
  cuentasBanco,
}: {
  nominaId: string;
  codigo: string;
  cuentasBanco: Array<{ id: string; codigo: string; nombre: string }>;
}) {
  const t = useTranslations("contab.nomina");
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [procesandoAccion, setProcesandoAccion] = useState(false);
  const [nomina, setNomina] = useState<NominaDetallada | null>(null);
  const [cuentaBancoSeleccionada, setCuentaBancoSeleccionada] = useState(
    cuentasBanco[0]?.id || "",
  );
  const [error, setError] = useState<string | null>(null);

  const cargarDetalle = async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await obtenerDetalleNominaAccion(nominaId);
      setNomina(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar nómina");
    } finally {
      setCargando(false);
    }
  };

  const handleDescargarTss = async () => {
    try {
      const { nombreArchivo, contenido } = await generarTxtTssAccion(nominaId);
      const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al generar TXT TSS");
    }
  };

  const handleAprobar = async () => {
    setProcesandoAccion(true);
    setError(null);
    try {
      await aprobarNomina(nominaId);
      await cargarDetalle();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al aprobar nómina");
    } finally {
      setProcesandoAccion(false);
    }
  };

  const handlePagar = async () => {
    if (!cuentaBancoSeleccionada) return;
    setProcesandoAccion(true);
    setError(null);
    try {
      await pagarNomina(nominaId, cuentaBancoSeleccionada);
      await cargarDetalle();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al pagar nómina");
    } finally {
      setProcesandoAccion(false);
    }
  };

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (v) cargarDetalle();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 text-[#2096BA] hover:text-[#187a99]">
          <FileText className="mr-1 h-3.5 w-3.5" />
          {t("verDetalle")}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{t("detalleTitulo", { codigo })}</DialogTitle>
            {nomina && (
              <Badge
                variant="outline"
                className={
                  nomina.estado === "pagada"
                    ? "border-linea bg-muted text-[#1E9E6A]"
                    : nomina.estado === "aprobada"
                    ? "border-[#2096BA]/30 bg-[#2096BA]/10 text-[#2096BA]"
                    : "border-linea bg-muted text-tinta-2 dark:text-slate-300"
                }
              >
                {nomina.estado.toUpperCase()}
              </Badge>
            )}
          </div>
          <DialogDescription>{t("detalleDesc")}</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive dark:bg-destructive/20">
            {error}
          </div>
        )}

        {cargando ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[#2096BA]" />
          </div>
        ) : nomina ? (
          <div className="space-y-6">
            {/* Resumen numérico */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-linea bg-muted/50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="text-xs text-muted-foreground">{t("devengado")}</div>
                <div className="text-base font-semibold tabular-nums text-tinta dark:text-slate-100">
                  RD$ {nomina.total_devengado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="rounded-xl border border-linea bg-muted/50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="text-xs text-muted-foreground">TSS (AFP+SFS) Empleado</div>
                <div className="text-base font-semibold tabular-nums text-tinta dark:text-slate-100">
                  RD${" "}
                  {(nomina.total_afp_empleado + nomina.total_sfs_empleado).toLocaleString("es-DO", {
                    minimumFractionDigits: 2,
                  })}
                </div>
              </div>
              <div className="rounded-xl border border-linea bg-muted/50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="text-xs text-muted-foreground">{t("isr")}</div>
                <div className="text-base font-semibold tabular-nums text-tinta dark:text-slate-100">
                  RD$ {nomina.total_isr_empleado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="rounded-xl border border-[#2096BA]/20 bg-[#2096BA]/5 p-3">
                <div className="text-xs font-medium text-[#2096BA]">{t("neto")}</div>
                <div className="text-base font-bold tabular-nums text-[#2096BA]">
                  RD$ {nomina.total_neto.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Tabla de líneas por empleado */}
            <div className="overflow-x-auto rounded-xl border border-linea bg-card shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-linea bg-muted font-medium text-muted-foreground uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5">Empleado</th>
                    <th className="px-3 py-2.5">Centro Costo</th>
                    <th className="px-3 py-2.5 text-right">{t("devengado")}</th>
                    <th className="px-3 py-2.5 text-right">AFP (2.87%)</th>
                    <th className="px-3 py-2.5 text-right">SFS (3.04%)</th>
                    <th className="px-3 py-2.5 text-right">ISR</th>
                    <th className="px-3 py-2.5 text-right font-bold">{t("neto")}</th>
                    <th className="px-3 py-2.5 text-right text-slate-400">TSS Patronal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {nomina.lineas.map((l) => (
                    <tr key={l.id} className="hover:bg-muted/50 dark:hover:bg-slate-800/30">
                      <td className="px-3 py-2">
                        <div className="font-medium text-tinta dark:text-slate-100">
                          {l.empleado_nombre}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {l.codigo_empleado} · {l.empleado_identificacion}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-tinta-2 dark:text-slate-400">
                        {l.centro_costo_nombre}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {l.total_devengado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-tinta-2">
                        {l.deduccion_afp.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-tinta-2">
                        {l.deduccion_sfs.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-tinta-2">
                        {l.deduccion_isr.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-[#2096BA]">
                        {l.neto_a_pagar.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-400">
                        {(
                          l.aporte_afp_patronal +
                          l.aporte_sfs_patronal +
                          l.aporte_srl_patronal +
                          l.aporte_infotep_patronal
                        ).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Opciones de pago si está aprobada */}
            {nomina.estado === "aprobada" && cuentasBanco.length > 0 && (
              <div className="flex flex-col gap-3 rounded-xl border border-linea bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-semibold text-tinta dark:text-slate-200">
                    {t("bancoDesembolso")}
                  </div>
                  <div className="text-xs text-tinta-2 dark:text-slate-400">
                    Generará el asiento de salida de efectivo por RD${" "}
                    {nomina.total_neto.toLocaleString("es-DO", { minimumFractionDigits: 2 })}.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={cuentaBancoSeleccionada}
                    onChange={(e) => setCuentaBancoSeleccionada(e.target.value)}
                    className="rounded-md border border-linea-fuerte bg-card px-3 py-1.5 text-xs text-tinta dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {cuentasBanco.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.codigo} — {b.nombre}
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={handlePagar}
                    disabled={procesandoAccion}
                    size="sm"
                    className="bg-[#2096BA] hover:bg-[#187a99] text-white"
                  >
                    <DollarSign className="mr-1 h-3.5 w-3.5" />
                    {t("confirmarPago")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDescargarTss}
            className="text-tinta-2 dark:text-slate-200"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {t("descargarTss")}
          </Button>

          <div className="flex gap-2">
            {nomina?.estado === "borrador" && (
              <Button
                type="button"
                onClick={handleAprobar}
                disabled={procesandoAccion}
                className="bg-[#2096BA] hover:bg-[#187a99] text-white"
                size="sm"
              >
                {procesandoAccion ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                {t("aprobar")}
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => setAbierto(false)}>
              {t("cerrar")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
