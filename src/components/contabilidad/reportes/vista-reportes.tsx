"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Printer,
  TrendingUp,
  FileSpreadsheet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type {
  BalanceGeneral,
  EstadoActividades,
  EstadoFlujoEfectivo,
  EstadoCambiosPatrimonio,
  CuentaMayorAnalitico,
  FlujoCajaProyectado,
  SnapshotFinanciero,
} from "@/server/contabilidad/reportes/consultas";
import { guardarSnapshotFinanciero } from "@/server/contabilidad/reportes/acciones";

interface Props {
  balanceInicial: BalanceGeneral;
  actividadesInicial: EstadoActividades;
  flujoInicial: EstadoFlujoEfectivo;
  patrimonioInicial: EstadoCambiosPatrimonio;
  mayorInicial: CuentaMayorAnalitico[];
  proyeccionInicial: FlujoCajaProyectado;
  snapshotsInicial: SnapshotFinanciero[];
}

type TabActivo = "balance" | "actividades" | "flujo" | "patrimonio" | "mayor" | "proyeccion" | "snapshots";

export function VistaReportes({
  balanceInicial,
  actividadesInicial,
  flujoInicial,
  patrimonioInicial,
  mayorInicial,
  proyeccionInicial,
  snapshotsInicial,
}: Props) {
  const t = useTranslations("contab.reportesFinancieros");
  const [tab, setTab] = useState<TabActivo>("balance");
  const [dialogoSnapshotAbierto, setDialogoSnapshotAbierto] = useState(false);
  const [tituloSnapshot, setTituloSnapshot] = useState("");
  const [isPending, startTransition] = useTransition();

  const formatearMonto = (valor: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(valor);
  };

  const handleGuardarSnapshot = () => {
    if (!tituloSnapshot.trim()) return;

    startTransition(async () => {
      let datos: Record<string, unknown> = {};
      if (tab === "balance") datos = balanceInicial as unknown as Record<string, unknown>;
      else if (tab === "actividades") datos = actividadesInicial as unknown as Record<string, unknown>;
      else if (tab === "flujo") datos = flujoInicial as unknown as Record<string, unknown>;
      else if (tab === "patrimonio") datos = patrimonioInicial as unknown as Record<string, unknown>;
      else if (tab === "proyeccion") datos = proyeccionInicial as unknown as Record<string, unknown>;

      const tipoMapeado =
        tab === "balance"
          ? "balance_general"
          : tab === "actividades"
          ? "estado_actividades"
          : tab === "flujo"
          ? "flujo_efectivo"
          : tab === "patrimonio"
          ? "cambios_patrimonio"
          : "ejecucion_presupuestaria";

      await guardarSnapshotFinanciero({
        tipo: tipoMapeado,
        ejercicio: new Date().getFullYear(),
        fechaCorte: balanceInicial.fechaCorte,
        titulo: tituloSnapshot.trim(),
        datosJson: datos,
      });

      setDialogoSnapshotAbierto(false);
      setTituloSnapshot("");
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

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="border-linea"
          >
            <Printer className="mr-2 h-4 w-4" />
            {t("acciones.imprimir")}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogoSnapshotAbierto(true)}
            className="border-linea"
          >
            <Camera className="mr-2 h-4 w-4" />
            {t("acciones.guardarSnapshot")}
          </Button>
        </div>
      </div>

      {/* Selector de pestañas */}
      <div className="flex flex-wrap gap-2 border-b border-linea pb-2">
        <Button
          variant={tab === "balance" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTab("balance")}
          className={tab === "balance" ? "bg-[#2096BA] hover:bg-[#187a99] text-white" : ""}
        >
          {t("tabs.balance")}
        </Button>
        <Button
          variant={tab === "actividades" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTab("actividades")}
          className={tab === "actividades" ? "bg-[#2096BA] hover:bg-[#187a99] text-white" : ""}
        >
          {t("tabs.actividades")}
        </Button>
        <Button
          variant={tab === "flujo" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTab("flujo")}
          className={tab === "flujo" ? "bg-[#2096BA] hover:bg-[#187a99] text-white" : ""}
        >
          {t("tabs.flujo")}
        </Button>
        <Button
          variant={tab === "patrimonio" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTab("patrimonio")}
          className={tab === "patrimonio" ? "bg-[#2096BA] hover:bg-[#187a99] text-white" : ""}
        >
          {t("tabs.patrimonio")}
        </Button>
        <Button
          variant={tab === "mayor" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTab("mayor")}
          className={tab === "mayor" ? "bg-[#2096BA] hover:bg-[#187a99] text-white" : ""}
        >
          {t("tabs.mayor")}
        </Button>
        <Button
          variant={tab === "proyeccion" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTab("proyeccion")}
          className={tab === "proyeccion" ? "bg-[#2096BA] hover:bg-[#187a99] text-white" : ""}
        >
          {t("tabs.proyeccion")}
        </Button>
        <Button
          variant={tab === "snapshots" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTab("snapshots")}
          className={tab === "snapshots" ? "bg-[#2096BA] hover:bg-[#187a99] text-white" : ""}
        >
          {t("tabs.snapshots")}
        </Button>
      </div>

      {/* 1. BALANCE GENERAL */}
      {tab === "balance" && (
        <div className="space-y-6">
          {/* Alerta de cuadre */}
          <div
            className={`flex items-center gap-3 rounded-lg border p-4 ${
              balanceInicial.cuadrado
                ? "border-linea bg-muted"
                : "border-destructive/20 bg-destructive/10"
            }`}
          >
            {balanceInicial.cuadrado ? (
              <CheckCircle2 className="h-5 w-5 text-[#1E9E6A]" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-[#B4342B]" />
            )}
            <div className="flex-1 text-sm">
              <span className="font-semibold">
                {balanceInicial.cuadrado
                  ? t("balance.cuadreOk")
                  : t("balance.descuadre", { diferencia: formatearMonto(balanceInicial.diferenciaCuadre) })}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">
                ({t("filtros.fechaCorte")}: {balanceInicial.fechaCorte})
              </span>
            </div>
            <div className="text-right text-xs text-muted-foreground tabular-nums">
              Activo: {formatearMonto(balanceInicial.totalActivos)} | Pasivo + Patrimonio:{" "}
              {formatearMonto(balanceInicial.totalPasivos + balanceInicial.totalPatrimonio)}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Columna Activos */}
            <div className="space-y-4 rounded-lg border border-linea bg-card p-5">
              <div className="flex items-center justify-between border-b border-linea pb-3">
                <h2 className="text-lg font-bold uppercase tracking-wide text-foreground">
                  {t("balance.totalActivos")}
                </h2>
                <span className="text-lg font-bold text-[#2096BA] tabular-nums">
                  {formatearMonto(balanceInicial.totalActivos)}
                </span>
              </div>

              {/* Activo Corriente */}
              <div className="space-y-2">
                <div className="flex justify-between font-semibold text-sm text-foreground bg-muted/60 p-2 rounded">
                  <span>{t("balance.activoCorriente")}</span>
                  <span className="tabular-nums">{formatearMonto(balanceInicial.activoCorriente.subtotal)}</span>
                </div>
                <div className="divide-y divide-linea/60 text-xs pl-2">
                  {balanceInicial.activoCorriente.cuentas
                    .filter((c) => Math.abs(c.saldo) > 0.001)
                    .map((c) => (
                      <div key={c.id} className="flex justify-between py-1.5 pr-2">
                        <span className="text-muted-foreground">
                          {c.codigo} — {c.nombre}
                        </span>
                        <span className="font-medium tabular-nums">{formatearMonto(c.saldo)}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Activo No Corriente */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between font-semibold text-sm text-foreground bg-muted/60 p-2 rounded">
                  <span>{t("balance.activoNoCorriente")}</span>
                  <span className="tabular-nums">{formatearMonto(balanceInicial.activoNoCorriente.subtotal)}</span>
                </div>
                <div className="divide-y divide-linea/60 text-xs pl-2">
                  {balanceInicial.activoNoCorriente.cuentas
                    .filter((c) => Math.abs(c.saldo) > 0.001)
                    .map((c) => (
                      <div key={c.id} className="flex justify-between py-1.5 pr-2">
                        <span className="text-muted-foreground">
                          {c.codigo} — {c.nombre}
                        </span>
                        <span className="font-medium tabular-nums">{formatearMonto(c.saldo)}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Columna Pasivos y Patrimonio */}
            <div className="space-y-6">
              {/* Pasivos */}
              <div className="space-y-4 rounded-lg border border-linea bg-card p-5">
                <div className="flex items-center justify-between border-b border-linea pb-3">
                  <h2 className="text-lg font-bold uppercase tracking-wide text-foreground">
                    {t("balance.totalPasivos")}
                  </h2>
                  <span className="text-lg font-bold text-foreground tabular-nums">
                    {formatearMonto(balanceInicial.totalPasivos)}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between font-semibold text-sm text-foreground bg-muted/60 p-2 rounded">
                    <span>{t("balance.pasivoCorriente")}</span>
                    <span className="tabular-nums">{formatearMonto(balanceInicial.pasivoCorriente.subtotal)}</span>
                  </div>
                  <div className="divide-y divide-linea/60 text-xs pl-2">
                    {balanceInicial.pasivoCorriente.cuentas
                      .filter((c) => Math.abs(c.saldo) > 0.001)
                      .map((c) => (
                        <div key={c.id} className="flex justify-between py-1.5 pr-2">
                          <span className="text-muted-foreground">
                            {c.codigo} — {c.nombre}
                          </span>
                          <span className="font-medium tabular-nums">{formatearMonto(c.saldo)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Patrimonio Social */}
              <div className="space-y-4 rounded-lg border border-linea bg-card p-5">
                <div className="flex items-center justify-between border-b border-linea pb-3">
                  <h2 className="text-lg font-bold uppercase tracking-wide text-foreground">
                    {t("balance.totalPatrimonio")}
                  </h2>
                  <span className="text-lg font-bold text-foreground tabular-nums">
                    {formatearMonto(balanceInicial.totalPatrimonio)}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between font-semibold text-sm text-foreground bg-muted/60 p-2 rounded">
                    <span>{t("balance.patrimonioSocial")}</span>
                    <span className="tabular-nums">{formatearMonto(balanceInicial.patrimonioSocial.subtotal)}</span>
                  </div>
                  <div className="divide-y divide-linea/60 text-xs pl-2">
                    {balanceInicial.patrimonioSocial.cuentas
                      .filter((c) => Math.abs(c.saldo) > 0.001)
                      .map((c) => (
                        <div key={c.id} className="flex justify-between py-1.5 pr-2">
                          <span className="text-muted-foreground">
                            {c.codigo} — {c.nombre}
                          </span>
                          <span className="font-medium tabular-nums">{formatearMonto(c.saldo)}</span>
                        </div>
                      ))}
                  </div>

                  {/* Superávit / Déficit del período */}
                  <div className="flex justify-between py-2 text-sm font-semibold border-t border-linea mt-3">
                    <span className="text-muted-foreground">{t("balance.superavitPeriodo")}</span>
                    <span
                      className={`tabular-nums ${
                        balanceInicial.superavitDeficitPeriodo >= 0
                          ? "text-[#1E9E6A]"
                          : "text-[#B4342B]"
                      }`}
                    >
                      {formatearMonto(balanceInicial.superavitDeficitPeriodo)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t-2 border-linea pt-3 mt-4 text-sm font-bold">
                  <span>{t("balance.totalPasivoPatrimonio")}</span>
                  <span className="text-base text-[#2096BA] tabular-nums">
                    {formatearMonto(balanceInicial.totalPasivos + balanceInicial.totalPatrimonio)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. ESTADO DE ACTIVIDADES (RESULTADOS ASFL) */}
      {tab === "actividades" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-linea bg-card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-linea pb-4 mb-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  {t("tabs.actividades")}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {actividadesInicial.fechaDesde} — {actividadesInicial.fechaHasta}
                </p>
              </div>
              <div className="mt-3 sm:mt-0 text-right">
                <span className="text-xs text-muted-foreground uppercase tracking-wider block">
                  {t("actividades.superavitNeto")}
                </span>
                <span
                  className={`text-2xl font-bold tabular-nums ${
                    actividadesInicial.superavitDeficitNeto >= 0
                      ? "text-[#1E9E6A]"
                      : "text-[#B4342B]"
                  }`}
                >
                  {formatearMonto(actividadesInicial.superavitDeficitNeto)}
                </span>
              </div>
            </div>

            {/* Ingresos */}
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-muted/60 p-2.5 rounded font-bold text-sm">
                <span>{t("actividades.ingresos")}</span>
                <span className="text-[#2096BA] tabular-nums">
                  {formatearMonto(actividadesInicial.ingresos.total)}
                </span>
              </div>
              <div className="divide-y divide-linea/60 text-xs pl-2">
                {actividadesInicial.ingresos.cuentas.map((c) => (
                  <div key={c.id} className="flex justify-between py-2 pr-2">
                    <span className="text-muted-foreground">
                      {c.codigo} — {c.nombre}
                    </span>
                    <div className="space-x-4 tabular-nums text-right">
                      <span className="text-muted-foreground">
                        Sin: {formatearMonto(c.sinRestricciones)}
                      </span>
                      {c.conRestricciones > 0 && (
                        <span className="text-muted-foreground">
                          Con: {formatearMonto(c.conRestricciones)}
                        </span>
                      )}
                      <span className="font-semibold text-foreground">
                        {formatearMonto(c.monto)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gastos */}
            <div className="space-y-3 pt-6">
              <div className="flex justify-between items-center bg-muted/60 p-2.5 rounded font-bold text-sm">
                <span>{t("actividades.gastos")}</span>
                <span className="text-foreground tabular-nums">
                  {formatearMonto(actividadesInicial.gastos.total)}
                </span>
              </div>
              <div className="divide-y divide-linea/60 text-xs pl-2">
                {actividadesInicial.gastos.cuentas.map((c) => (
                  <div key={c.id} className="flex justify-between py-2 pr-2">
                    <span className="text-muted-foreground">
                      {c.codigo} — {c.nombre}
                    </span>
                    <div className="space-x-4 tabular-nums text-right">
                      <span className="text-muted-foreground">
                        Sin: {formatearMonto(c.sinRestricciones)}
                      </span>
                      {c.conRestricciones > 0 && (
                        <span className="text-muted-foreground">
                          Con: {formatearMonto(c.conRestricciones)}
                        </span>
                      )}
                      <span className="font-semibold text-foreground">
                        {formatearMonto(c.monto)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. ESTADO DE FLUJOS DE EFECTIVO */}
      {tab === "flujo" && (
        <div className="rounded-lg border border-linea bg-card p-5 space-y-6">
          <div className="border-b border-linea pb-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {t("tabs.flujo")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Método Indirecto ({flujoInicial.fechaDesde} — {flujoInicial.fechaHasta})
            </p>
          </div>

          <div className="space-y-4 text-xs">
            {/* Actividades Operativas */}
            <div className="space-y-2">
              <div className="flex justify-between font-bold text-sm bg-muted/60 p-2 rounded">
                <span>{t("flujo.actividadesOperacion")}</span>
                <span className="tabular-nums">
                  {formatearMonto(flujoInicial.actividadesOperativas.totalOperativo)}
                </span>
              </div>
              <div className="pl-3 divide-y divide-linea/50">
                <div className="flex justify-between py-1.5 pr-2">
                  <span className="text-muted-foreground">Superávit neto de actividades</span>
                  <span className="font-medium tabular-nums">
                    {formatearMonto(flujoInicial.actividadesOperativas.superavitNeto)}
                  </span>
                </div>
                {flujoInicial.actividadesOperativas.ajustesNoMonetarios.map((a, idx) => (
                  <div key={idx} className="flex justify-between py-1.5 pr-2">
                    <span className="text-muted-foreground">{a.concepto}</span>
                    <span className="font-medium tabular-nums">{formatearMonto(a.monto)}</span>
                  </div>
                ))}
                {flujoInicial.actividadesOperativas.cambiosCapitalTrabajo.map((c, idx) => (
                  <div key={idx} className="flex justify-between py-1.5 pr-2">
                    <span className="text-muted-foreground">{c.concepto}</span>
                    <span className="font-medium tabular-nums">{formatearMonto(c.monto)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actividades Inversión */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between font-bold text-sm bg-muted/60 p-2 rounded">
                <span>{t("flujo.actividadesInversion")}</span>
                <span className="tabular-nums">
                  {formatearMonto(flujoInicial.actividadesInversion.totalInversion)}
                </span>
              </div>
              <div className="pl-3 divide-y divide-linea/50">
                {flujoInicial.actividadesInversion.partidas.map((p, idx) => (
                  <div key={idx} className="flex justify-between py-1.5 pr-2">
                    <span className="text-muted-foreground">{p.concepto}</span>
                    <span className="font-medium tabular-nums">{formatearMonto(p.monto)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Conciliación Efectivo */}
            <div className="rounded-lg border border-linea p-4 bg-muted/30 space-y-2 pt-3 mt-4 text-sm font-semibold">
              <div className="flex justify-between">
                <span>{t("flujo.aumentoNeto")}</span>
                <span className="tabular-nums text-[#2096BA]">
                  {formatearMonto(flujoInicial.aumentoDisminucionNeta)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground text-xs font-normal">
                <span>{t("flujo.saldoInicial")}</span>
                <span className="tabular-nums">{formatearMonto(flujoInicial.saldoInicialEfectivo)}</span>
              </div>
              <div className="flex justify-between border-t border-linea pt-2 text-base font-bold">
                <span>{t("flujo.saldoFinal")}</span>
                <span className="tabular-nums text-foreground">
                  {formatearMonto(flujoInicial.saldoFinalEfectivo)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. CAMBIOS EN EL PATRIMONIO */}
      {tab === "patrimonio" && (
        <div className="rounded-lg border border-linea bg-card p-5 space-y-4">
          <div className="border-b border-linea pb-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {t("tabs.patrimonio")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ejercicio Fiscal {patrimonioInicial.ejercicio}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted text-foreground font-semibold">
                <tr>
                  <th className="p-3">Concepto</th>
                  <th className="p-3 text-right">{t("patrimonio.noRestringido")}</th>
                  <th className="p-3 text-right">{t("patrimonio.tempRestringido")}</th>
                  <th className="p-3 text-right">{t("patrimonio.resAcumulados")}</th>
                  <th className="p-3 text-right font-bold">{t("patrimonio.total")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                <tr>
                  <td className="p-3 font-medium">{t("patrimonio.saldoInicial")}</td>
                  <td className="p-3 text-right tabular-nums">{formatearMonto(patrimonioInicial.saldoInicial.noRestringido)}</td>
                  <td className="p-3 text-right tabular-nums">{formatearMonto(patrimonioInicial.saldoInicial.temporalmenteRestringido)}</td>
                  <td className="p-3 text-right tabular-nums">{formatearMonto(patrimonioInicial.saldoInicial.resultadosAcumulados)}</td>
                  <td className="p-3 text-right tabular-nums font-semibold">{formatearMonto(patrimonioInicial.saldoInicial.total)}</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium">{t("patrimonio.superavit")}</td>
                  <td className="p-3 text-right tabular-nums">{formatearMonto(patrimonioInicial.superavitEjercicio.noRestringido)}</td>
                  <td className="p-3 text-right tabular-nums">{formatearMonto(patrimonioInicial.superavitEjercicio.temporalmenteRestringido)}</td>
                  <td className="p-3 text-right tabular-nums">RD$ 0.00</td>
                  <td className="p-3 text-right tabular-nums font-semibold">{formatearMonto(patrimonioInicial.superavitEjercicio.total)}</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium">{t("patrimonio.liberaciones")}</td>
                  <td className="p-3 text-right tabular-nums text-[#1E9E6A]">{formatearMonto(patrimonioInicial.liberacionesFondos.noRestringido)}</td>
                  <td className="p-3 text-right tabular-nums text-[#B4342B]">{formatearMonto(patrimonioInicial.liberacionesFondos.temporalmenteRestringido)}</td>
                  <td className="p-3 text-right tabular-nums">RD$ 0.00</td>
                  <td className="p-3 text-right tabular-nums font-semibold">RD$ 0.00</td>
                </tr>
                <tr className="bg-muted/40 font-bold text-sm">
                  <td className="p-3">{t("patrimonio.saldoFinal")}</td>
                  <td className="p-3 text-right tabular-nums text-[#2096BA]">{formatearMonto(patrimonioInicial.saldoFinal.noRestringido)}</td>
                  <td className="p-3 text-right tabular-nums text-[#2096BA]">{formatearMonto(patrimonioInicial.saldoFinal.temporalmenteRestringido)}</td>
                  <td className="p-3 text-right tabular-nums text-[#2096BA]">{formatearMonto(patrimonioInicial.saldoFinal.resultadosAcumulados)}</td>
                  <td className="p-3 text-right tabular-nums text-foreground">{formatearMonto(patrimonioInicial.saldoFinal.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. MAYOR GENERAL ANALÍTICO */}
      {tab === "mayor" && (
        <div className="rounded-lg border border-linea bg-card p-5 space-y-4">
          <div className="border-b border-linea pb-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {t("tabs.mayor")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Movimientos detallados y saldos progresivos
            </p>
          </div>

          {mayorInicial.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              {t("mayor.sinMovimientos")}
            </p>
          ) : (
            <div className="space-y-6">
              {mayorInicial.map((cuenta) => (
                <div key={cuenta.cuentaId} className="border border-linea rounded-lg overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between bg-muted/60 p-3 text-xs font-semibold">
                    <span className="text-foreground text-sm">
                      {cuenta.codigo} — {cuenta.nombre}
                    </span>
                    <div className="space-x-4 tabular-nums">
                      <span>{t("mayor.saldoAnterior")}: {formatearMonto(cuenta.saldoAnterior)}</span>
                      <span>Debe: {formatearMonto(cuenta.totalDebe)}</span>
                      <span>Haber: {formatearMonto(cuenta.totalHaber)}</span>
                      <span className="font-bold text-[#2096BA]">
                        {t("mayor.saldo")}: {formatearMonto(cuenta.saldoFinal)}
                      </span>
                    </div>
                  </div>

                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/30 border-b border-linea text-muted-foreground">
                      <tr>
                        <th className="p-2.5">{t("mayor.fecha")}</th>
                        <th className="p-2.5">#{t("mayor.asiento")}</th>
                        <th className="p-2.5">{t("mayor.concepto")}</th>
                        <th className="p-2.5 text-right">{t("mayor.debe")}</th>
                        <th className="p-2.5 text-right">{t("mayor.haber")}</th>
                        <th className="p-2.5 text-right font-semibold">{t("mayor.saldo")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-linea/60">
                      {cuenta.movimientos.map((m, idx) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="p-2.5 tabular-nums text-muted-foreground">{m.fecha}</td>
                          <td className="p-2.5 font-medium tabular-nums">#{m.asientoNumero}</td>
                          <td className="p-2.5 text-foreground max-w-md truncate">
                            {m.concepto}
                            {m.centroCostoCodigo && (
                              <span className="ml-2 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px]">
                                {m.centroCostoCodigo}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-right tabular-nums">
                            {m.debe > 0 ? formatearMonto(m.debe) : "—"}
                          </td>
                          <td className="p-2.5 text-right tabular-nums">
                            {m.haber > 0 ? formatearMonto(m.haber) : "—"}
                          </td>
                          <td className="p-2.5 text-right tabular-nums font-medium">
                            {formatearMonto(m.saldoAcumulado)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. FLUJO DE CAJA PROYECTADO */}
      {tab === "proyeccion" && (
        <div className="rounded-lg border border-linea bg-card p-5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-linea pb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                {t("tabs.proyeccion")}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Estimación de liquidez y compromisos futuros a 6 meses
              </p>
            </div>
            <div className="mt-2 sm:mt-0 text-right">
              <span className="text-xs text-muted-foreground block">
                {t("proyeccion.saldoDisponibleActual")}
              </span>
              <span className="text-xl font-bold text-[#2096BA] tabular-nums">
                {formatearMonto(proyeccionInicial.saldoDisponibleActual)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted text-foreground font-semibold">
                <tr>
                  <th className="p-3">{t("proyeccion.mes")}</th>
                  <th className="p-3 text-right">{t("proyeccion.saldoInicial")}</th>
                  <th className="p-3 text-right text-[#1E9E6A]">{t("proyeccion.totalEntradas")}</th>
                  <th className="p-3 text-right text-[#B4342B]">{t("proyeccion.totalSalidas")}</th>
                  <th className="p-3 text-right">{t("proyeccion.flujoNeto")}</th>
                  <th className="p-3 text-right font-bold text-[#2096BA]">{t("proyeccion.saldoFinal")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {proyeccionInicial.meses.map((m, idx) => (
                  <tr key={idx} className="hover:bg-muted/20">
                    <td className="p-3 font-semibold text-foreground">{m.mesNombre}</td>
                    <td className="p-3 text-right tabular-nums">{formatearMonto(m.saldoInicial)}</td>
                    <td className="p-3 text-right tabular-nums font-medium text-[#1E9E6A]">
                      +{formatearMonto(m.totalEntradas)}
                    </td>
                    <td className="p-3 text-right tabular-nums font-medium text-[#B4342B]">
                      -{formatearMonto(m.totalSalidas)}
                    </td>
                    <td
                      className={`p-3 text-right tabular-nums font-semibold ${
                        m.flujoNeto >= 0 ? "text-[#1E9E6A]" : "text-[#B4342B]"
                      }`}
                    >
                      {formatearMonto(m.flujoNeto)}
                    </td>
                    <td className="p-3 text-right tabular-nums font-bold text-foreground">
                      {formatearMonto(m.saldoFinal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. SNAPSHOTS OFICIALES */}
      {tab === "snapshots" && (
        <div className="rounded-lg border border-linea bg-card p-5 space-y-4">
          <div className="border-b border-linea pb-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {t("tabs.snapshots")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fotografías auditables e inmutables generadas
            </p>
          </div>

          {snapshotsInicial.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              {t("snapshots.sinSnapshots")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted text-foreground font-semibold">
                  <tr>
                    <th className="p-3">{t("snapshots.titulo")}</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">{t("snapshots.fechaCorte")}</th>
                    <th className="p-3">{t("snapshots.generadoPor")}</th>
                    <th className="p-3">{t("snapshots.fecha")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-linea">
                  {snapshotsInicial.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/20">
                      <td className="p-3 font-semibold text-foreground">{s.titulo}</td>
                      <td className="p-3 text-muted-foreground capitalize">
                        {s.tipo.replace("_", " ")}
                      </td>
                      <td className="p-3 tabular-nums">{s.fechaCorte}</td>
                      <td className="p-3 text-muted-foreground">{s.generadoPorNombre}</td>
                      <td className="p-3 tabular-nums text-muted-foreground">{s.generadoEn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DIÁLOGO GUARDAR SNAPSHOT */}
      <Dialog open={dialogoSnapshotAbierto} onOpenChange={setDialogoSnapshotAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("snapshots.tituloModal")}</DialogTitle>
            <DialogDescription>{t("snapshots.descModal")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="tituloSnapshot">{t("snapshots.titulo")}</Label>
              <Input
                id="tituloSnapshot"
                value={tituloSnapshot}
                onChange={(e) => setTituloSnapshot(e.target.value)}
                placeholder={t("snapshots.tituloPlaceholder")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogoSnapshotAbierto(false)}
              disabled={isPending}
            >
              {t("snapshots.cancelar")}
            </Button>
            <Button
              onClick={handleGuardarSnapshot}
              disabled={isPending || !tituloSnapshot.trim()}
              className="bg-[#2096BA] hover:bg-[#187a99] text-white"
            >
              {isPending ? t("snapshots.guardando") : t("snapshots.guardar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
