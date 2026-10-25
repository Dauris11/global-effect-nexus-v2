"use client";

import { useState } from "react";
import {
  ArrowRightLeft,
  Calculator,
  Coins,
  FileCheck,
  Percent,
  Receipt,
  Scale,
  TrendingDown,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  calcularAmortizacionFrancesa,
  calcularDeduccionesLaborales,
  calcularFacturaCompleta,
  calcularItbis,
  calcularRetencionesDominicanas,
} from "@/server/contabilidad/calculadoras/motor";
import { convertirCalculoEnAsientoBorrador } from "@/server/contabilidad/calculadoras/acciones";
import { calcularRecargosYMora } from "@/server/contabilidad/dgii/recargos-mora";

export function SuiteCalculadoras() {
  const t = useTranslations("contab.calculadoras");

  // Estado pestaña activa
  const [tab, setTab] = useState("factura");

  // Estado Calculadora 1: Factura
  const [cant1, setCant1] = useState("1");
  const [precio1, setPrecio1] = useState("10000");
  const [desc1, setDesc1] = useState("0");
  const [itbisTasa1, setItbisTasa1] = useState("0.18");
  const [retIsrTasa1, setRetIsrTasa1] = useState("0.15"); // 15% Ley 30-26
  const [retItbisTasa1, setRetItbisTasa1] = useState("1.00"); // 100%

  const resFactura = calcularFacturaCompleta({
    lineas: [
      {
        descripcion: "Servicio profesional / honorarios",
        cantidad: Number(cant1 || 1),
        precioUnitario: Number(precio1 || 0),
        descuentoPorcentaje: Number(desc1 || 0),
        itbisTasa: Number(itbisTasa1 || 0.18),
      },
    ],
    retencionIsrTasa: Number(retIsrTasa1 || 0),
    retencionItbisTasa: Number(retItbisTasa1 || 0),
  });

  // Estado Calculadora 2: ITBIS Directo e Inverso
  const [montoItbis, setMontoItbis] = useState("1180");
  const [tipoItbis, setTipoItbis] = useState<"directo" | "inverso">("inverso");
  const [tasaItbis, setTasaItbis] = useState("0.18");
  const resItbis = calcularItbis({
    monto: Number(montoItbis || 0),
    tipo: tipoItbis,
    tasa: Number(tasaItbis || 0.18),
  });

  // Estado Calculadora 3: Retenciones Dominicanas
  const [subtotalRet, setSubtotalRet] = useState("50000");
  const [itbisRet, setItbisRet] = useState("9000");
  const [tipoProv, setTipoProv] = useState<"fisica" | "juridica">("fisica");
  const [conceptoServ, setConceptoServ] = useState<"honorarios" | "alquileres" | "servicios_tecnicos" | "bienes">("honorarios");
  const resRetenciones = calcularRetencionesDominicanas({
    subtotal: Number(subtotalRet || 0),
    itbis: Number(itbisRet || 0),
    tipoProveedor: tipoProv,
    conceptoServicio: conceptoServ,
  });

  // Estado Calculadora 4: Recargos y Mora DGII
  const [montoImpuestoMora, setMontoImpuestoMora] = useState("25000");
  const [vencimientoMora, setVencimientoMora] = useState("2026-08-20");
  const [pagoMora, setPagoMora] = useState("2026-10-25");
  const resMora = calcularRecargosYMora(Number(montoImpuestoMora || 0), vencimientoMora, pagoMora);

  // Estado Calculadora 5: Amortización de Préstamo
  const [montoPrestamo, setMontoPrestamo] = useState("500000");
  const [tasaAnual, setTasaAnual] = useState("14");
  const [plazoMeses, setPlazoMeses] = useState("24");
  const resPrestamo = calcularAmortizacionFrancesa({
    monto: Number(montoPrestamo || 0),
    tasaAnualPorcentaje: Number(tasaAnual || 0),
    plazoMeses: Number(plazoMeses || 12),
  });

  // Estado Calculadora 6: Salario y TSS
  const [salarioBruto, setSalarioBruto] = useState("65000");
  const resLaboral = calcularDeduccionesLaborales(Number(salarioBruto || 0));

  // Estado acción crear borrador
  const [mensajeAsiento, setMensajeAsiento] = useState<string | null>(null);
  const [creandoAsiento, setCreandoAsiento] = useState(false);

  async function handleConvertirEnAsientoFactura() {
    setCreandoAsiento(true);
    setMensajeAsiento(null);

    const res = await convertirCalculoEnAsientoBorrador({
      tipo: "factura",
      concepto: `Asiento borrador de factura (calculadora) - Neto: ${resFactura.netoAPagar.toFixed(2)}`,
      lineas: [
        {
          cuentaCodigo: "5.1.01.01",
          descripcion: "Gasto de servicios profesionales",
          debe: resFactura.subtotalNeto,
          haber: 0,
        },
        {
          cuentaCodigo: "1.1.05.01",
          descripcion: "ITBIS pagado / adelantado",
          debe: resFactura.totalItbis,
          haber: 0,
        },
        {
          cuentaCodigo: "2.1.02.03",
          descripcion: "Retención de ISR por pagar (Ley 30-26)",
          debe: 0,
          haber: resFactura.retencionIsr,
        },
        {
          cuentaCodigo: "2.1.02.02",
          descripcion: "Retención de ITBIS por pagar",
          debe: 0,
          haber: resFactura.retencionItbis,
        },
        {
          cuentaCodigo: "2.1.01.01",
          descripcion: "Cuentas por pagar a proveedores (Neto)",
          debe: 0,
          haber: resFactura.netoAPagar,
        },
      ],
    });

    setCreandoAsiento(false);
    if (res.ok) {
      setMensajeAsiento(t("asientoCreado", { num: res.asientoNumero ?? 0 }));
    } else {
      setMensajeAsiento(res.error || t("errorAsiento"));
    }
  }

  return (
    <div className="space-y-6">
      {mensajeAsiento && (
        <div className="rounded-lg bg-marca-50 p-4 text-sm font-medium text-marca-700 dark:bg-marca-950/40 dark:text-marca-200">
          {mensajeAsiento}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-6 h-auto p-1 bg-muted dark:slate-800 rounded-xl">
          <TabsTrigger value="factura" className="py-2.5 text-xs">
            <Receipt className="mr-1.5 size-3.5" />
            {t("tabFactura")}
          </TabsTrigger>
          <TabsTrigger value="itbis" className="py-2.5 text-xs">
            <Percent className="mr-1.5 size-3.5" />
            {t("tabItbis")}
          </TabsTrigger>
          <TabsTrigger value="retenciones" className="py-2.5 text-xs">
            <Scale className="mr-1.5 size-3.5" />
            {t("tabRetenciones")}
          </TabsTrigger>
          <TabsTrigger value="mora" className="py-2.5 text-xs">
            <TrendingDown className="mr-1.5 size-3.5" />
            {t("tabMora")}
          </TabsTrigger>
          <TabsTrigger value="prestamo" className="py-2.5 text-xs">
            <Coins className="mr-1.5 size-3.5" />
            {t("tabPrestamos")}
          </TabsTrigger>
          <TabsTrigger value="laboral" className="py-2.5 text-xs">
            <Users className="mr-1.5 size-3.5" />
            {t("tabLaboral")}
          </TabsTrigger>
        </TabsList>

        {/* 1. FACTURA */}
        <TabsContent value="factura" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-linea bg-card p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <h3 className="font-semibold text-tinta dark:text-slate-100">{t("parametrosFactura")}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("cantidad")}</Label>
                  <Input type="number" value={cant1} onChange={(e) => setCant1(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("precioUnitario")}</Label>
                  <Input type="number" value={precio1} onChange={(e) => setPrecio1(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("descuentoPct")}</Label>
                  <Input type="number" value={desc1} onChange={(e) => setDesc1(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("itbis")}</Label>
                  <Select value={itbisTasa1} onValueChange={setItbisTasa1}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.18">18%</SelectItem>
                      <SelectItem value="0.16">16%</SelectItem>
                      <SelectItem value="0">0%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("retencionIsr")}</Label>
                  <Select value={retIsrTasa1} onValueChange={setRetIsrTasa1}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.15">15% (Ley 30-26)</SelectItem>
                      <SelectItem value="0.10">10%</SelectItem>
                      <SelectItem value="0.02">2%</SelectItem>
                      <SelectItem value="0">0%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-linea bg-muted p-5 shadow-xs dark:border-slate-800 dark:bg-slate-950 space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-tinta dark:text-slate-100">{t("liquidacionLiquidada")}</h3>
                <div className="mt-4 space-y-2 text-sm divide-y divide-slate-200 dark:divide-slate-800">
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">{t("subtotalNeto")}:</span>
                    <span className="font-mono font-medium">RD$ {resFactura.subtotalNeto.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">{t("itbisFacturado")}:</span>
                    <span className="font-mono font-medium">RD$ {resFactura.totalItbis.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 text-tinta-2">
                    <span>{t("retencionIsr")}:</span>
                    <span className="font-mono font-medium">- RD$ {resFactura.retencionIsr.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 text-tinta-2">
                    <span>{t("retencionItbis")}:</span>
                    <span className="font-mono font-medium">- RD$ {resFactura.retencionItbis.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-base font-bold text-tinta dark:text-slate-100">
                    <span>{t("netoAPagar")}:</span>
                    <span className="font-mono text-marca-600 dark:text-marca-400">
                      RD$ {resFactura.netoAPagar.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleConvertirEnAsientoFactura}
                disabled={creandoAsiento}
                className="w-full"
              >
                <FileCheck className="mr-2 size-4" />
                {creandoAsiento ? t("generando") : t("convertirEnAsientoBorrador")}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* 2. ITBIS */}
        <TabsContent value="itbis" className="mt-6">
          <div className="max-w-xl mx-auto rounded-xl border border-linea bg-card p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h3 className="font-semibold text-tinta dark:text-slate-100">{t("calculadoraItbisDirectoInverso")}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("modoCalculo")}</Label>
                <Select value={tipoItbis} onValueChange={(v: "directo" | "inverso") => setTipoItbis(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inverso">{t("desglosarDesdeTotal")}</SelectItem>
                    <SelectItem value="directo">{t("calcularDesdeBase")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("tasaItbis")}</Label>
                <Select value={tasaItbis} onValueChange={setTasaItbis}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.18">18% {t("general")}</SelectItem>
                    <SelectItem value="0.16">16% {t("reducida")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{tipoItbis === "inverso" ? t("montoTotalConItbis") : t("montoBaseSinItbis")}</Label>
              <Input
                type="number"
                step="0.01"
                value={montoItbis}
                onChange={(e) => setMontoItbis(e.target.value)}
              />
            </div>

            <div className="rounded-lg bg-muted p-4 dark:bg-slate-800/50 space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">{t("baseImponible")}:</span>
                <span className="font-bold">RD$ {resItbis.base.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">{t("itbisDeterminado")}:</span>
                <span className="font-bold text-marca-600 dark:text-marca-400">
                  RD$ {resItbis.impuesto.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base">
                <span className="text-tinta-2 font-sans">{t("totalGeneral")}:</span>
                <span className="font-bold">RD$ {resItbis.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 3. RETENCIONES */}
        <TabsContent value="retenciones" className="mt-6">
          <div className="max-w-xl mx-auto rounded-xl border border-linea bg-card p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h3 className="font-semibold text-tinta dark:text-slate-100">{t("retencionesDominicanasDgii")}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("tipoProveedor")}</Label>
                <Select value={tipoProv} onValueChange={(v: "fisica" | "juridica") => setTipoProv(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fisica">{t("personaFisica")}</SelectItem>
                    <SelectItem value="juridica">{t("personaJuridica")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("conceptoServicio")}</Label>
                <Select value={conceptoServ} onValueChange={(v: "honorarios" | "alquileres" | "servicios_tecnicos" | "bienes") => setConceptoServ(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="honorarios">{t("honorariosServicios")}</SelectItem>
                    <SelectItem value="alquileres">{t("alquileres")}</SelectItem>
                    <SelectItem value="servicios_tecnicos">{t("serviciosTecnicos")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("subtotalFacturado")}</Label>
                <Input
                  type="number"
                  value={subtotalRet}
                  onChange={(e) => setSubtotalRet(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("itbisFacturado")}</Label>
                <Input
                  type="number"
                  value={itbisRet}
                  onChange={(e) => setItbisRet(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg bg-muted p-4 dark:bg-slate-800/50 space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">
                  {t("retencionIsr")} ({Math.round(resRetenciones.tasaIsr * 100)}%):
                </span>
                <span className="font-bold text-tinta-2">
                  - RD$ {resRetenciones.retencionIsr.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">
                  {t("retencionItbis")} ({Math.round(resRetenciones.tasaItbis * 100)}%):
                </span>
                <span className="font-bold text-tinta-2">
                  - RD$ {resRetenciones.retencionItbis.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base">
                <span className="text-tinta-2 font-sans">{t("netoAlProveedor")}:</span>
                <span className="font-bold text-marca-600 dark:text-marca-400">
                  RD$ {resRetenciones.netoAPagar.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 4. RECARGOS Y MORA */}
        <TabsContent value="mora" className="mt-6">
          <div className="max-w-xl mx-auto rounded-xl border border-linea bg-card p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h3 className="font-semibold text-tinta dark:text-slate-100">{t("calculadoraRecargosYMora")}</h3>
            <p className="text-xs text-muted-foreground">{t("normativaRecargos")}</p>
            <div className="space-y-1.5">
              <Label>{t("impuestoPendiente")}</Label>
              <Input
                type="number"
                value={montoImpuestoMora}
                onChange={(e) => setMontoImpuestoMora(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("fechaVencimientoLegal")}</Label>
                <Input
                  type="date"
                  value={vencimientoMora}
                  onChange={(e) => setVencimientoMora(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("fechaEfectivaPago")}</Label>
                <Input
                  type="date"
                  value={pagoMora}
                  onChange={(e) => setPagoMora(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg bg-muted p-4 dark:bg-slate-800/50 space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">{t("mesesOFraccionesMora")}:</span>
                <span className="font-bold">{resMora.mesesMora}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">{t("recargoMora")} ({resMora.porcentajeRecargo}%):</span>
                <span className="font-bold text-tinta">RD$ {resMora.montoRecargo.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">{t("interesIndemnizatorio")} ({resMora.porcentajeInteres}%):</span>
                <span className="font-bold text-tinta">RD$ {resMora.montoInteres.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base">
                <span className="text-tinta-2 font-sans">{t("totalLiquidacionPagar")}:</span>
                <span className="font-bold text-marca-600 dark:text-marca-400">RD$ {resMora.totalAPagar.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 5. PRÉSTAMO Y AMORTIZACIÓN */}
        <TabsContent value="prestamo" className="mt-6">
          <div className="max-w-xl mx-auto rounded-xl border border-linea bg-card p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h3 className="font-semibold text-tinta dark:text-slate-100">{t("amortizacionFrancesa")}</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{t("montoPrincipal")}</Label>
                <Input type="number" value={montoPrestamo} onChange={(e) => setMontoPrestamo(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("tasaAnualPct")}</Label>
                <Input type="number" value={tasaAnual} onChange={(e) => setTasaAnual(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("plazoMeses")}</Label>
                <Input type="number" value={plazoMeses} onChange={(e) => setPlazoMeses(e.target.value)} />
              </div>
            </div>

            <div className="rounded-lg bg-muted p-4 dark:bg-slate-800/50 space-y-2 text-sm font-mono">
              <div className="flex justify-between text-base">
                <span className="text-tinta-2 font-sans font-bold">{t("cuotaMensualNivelada")}:</span>
                <span className="font-bold text-marca-600 dark:text-marca-400">
                  RD$ {resPrestamo.cuotaMensual.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">{t("totalIntereses")}:</span>
                <span className="font-bold">RD$ {resPrestamo.totalIntereses.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground font-sans">{t("totalFinal")}:</span>
                <span className="font-bold">RD$ {resPrestamo.totalAPagar.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 6. LABORAL / SALARIOS Y TSS */}
        <TabsContent value="laboral" className="mt-6">
          <div className="max-w-xl mx-auto rounded-xl border border-linea bg-card p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h3 className="font-semibold text-tinta dark:text-slate-100">{t("calculadoraTssEIsr")}</h3>
            <div className="space-y-1.5">
              <Label>{t("salarioBrutoMensual")}</Label>
              <Input
                type="number"
                value={salarioBruto}
                onChange={(e) => setSalarioBruto(e.target.value)}
              />
            </div>

            <div className="rounded-lg bg-muted p-4 dark:bg-slate-800/50 space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">{t("afpEmpleado")} (2.87%):</span>
                <span className="font-bold text-tinta-2">- RD$ {resLaboral.afpEmpleado.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">{t("sfsEmpleado")} (3.04%):</span>
                <span className="font-bold text-tinta-2">- RD$ {resLaboral.sfsEmpleado.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">{t("isrRetencionMensual")}:</span>
                <span className="font-bold text-tinta-2">- RD$ {resLaboral.isrMensual.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base">
                <span className="text-tinta-2 font-sans font-bold">{t("salarioNetoCobrar")}:</span>
                <span className="font-bold text-marca-600 dark:text-marca-400">
                  RD$ {resLaboral.salarioNeto.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
