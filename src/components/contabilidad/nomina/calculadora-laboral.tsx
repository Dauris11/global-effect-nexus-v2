"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calcularPrestacionesLaborales } from "@/lib/contabilidad/prestaciones";

export function CalculadoraLaboral() {
  const t = useTranslations("contab.nomina");

  const [salarioMensual, setSalarioMensual] = useState("35000");
  const [fechaIngreso, setFechaIngreso] = useState("2024-01-01");
  const [fechaSalida, setFechaSalida] = useState(new Date().toISOString().split("T")[0]);
  const [incluyePreaviso, setIncluyePreaviso] = useState(true);
  const [incluyeCesantia, setIncluyeCesantia] = useState(true);
  const [vacacionesPendientes, setVacacionesPendientes] = useState("14");

  const [resultado, setResultado] = useState<ReturnType<typeof calcularPrestacionesLaborales> | null>(() => {
    return calcularPrestacionesLaborales({
      salarioMensual: 35000,
      fechaIngreso: "2024-01-01",
      fechaSalida: new Date().toISOString().split("T")[0],
      incluyePreaviso: true,
      incluyeCesantia: true,
      diasVacacionesPendientes: 14,
    });
  });

  const handleCalcular = (e: React.FormEvent) => {
    e.preventDefault();
    const res = calcularPrestacionesLaborales({
      salarioMensual: Number(salarioMensual),
      fechaIngreso,
      fechaSalida,
      incluyePreaviso,
      incluyeCesantia,
      diasVacacionesPendientes: Number(vacacionesPendientes) || 0,
    });
    setResultado(res);
  };

  return (
    <div className="rounded-xl border border-linea bg-card p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-6 flex items-center gap-3 border-b border-linea pb-4 dark:border-slate-800">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2096BA]/10 text-[#2096BA]">
          <Calculator className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-tinta dark:text-slate-100">
            {t("calculadoraTitulo")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("calculadoraDesc")}</p>
        </div>
      </div>

      <form onSubmit={handleCalcular} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="calc-salario">{t("salarioBase")}</Label>
            <Input
              id="calc-salario"
              type="number"
              step="0.01"
              value={salarioMensual}
              onChange={(e) => setSalarioMensual(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="calc-ingreso">{t("fechaIngreso")}</Label>
            <Input
              id="calc-ingreso"
              type="date"
              value={fechaIngreso}
              onChange={(e) => setFechaIngreso(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="calc-salida">{t("fechaSalida")}</Label>
            <Input
              id="calc-salida"
              type="date"
              value={fechaSalida}
              onChange={(e) => setFechaSalida(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-center">
          <div className="space-y-1.5">
            <Label htmlFor="calc-vac">{t("vacacionesPendientes")}</Label>
            <Input
              id="calc-vac"
              type="number"
              value={vacacionesPendientes}
              onChange={(e) => setVacacionesPendientes(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-4 text-xs sm:text-sm">
            <input
              type="checkbox"
              checked={incluyePreaviso}
              onChange={(e) => setIncluyePreaviso(e.target.checked)}
              className="rounded border-linea-fuerte text-[#2096BA] focus:ring-[#2096BA]"
            />
            <span>{t("incluyePreaviso")}</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer pt-4 text-xs sm:text-sm">
            <input
              type="checkbox"
              checked={incluyeCesantia}
              onChange={(e) => setIncluyeCesantia(e.target.checked)}
              className="rounded border-linea-fuerte text-[#2096BA] focus:ring-[#2096BA]"
            />
            <span>{t("incluyeCesantia")}</span>
          </label>
        </div>

        <Button type="submit" className="bg-[#2096BA] hover:bg-[#187a99] text-white">
          Recalcular liquidación
        </Button>
      </form>

      {resultado && (
        <div className="mt-8 border-t border-linea pt-6 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
            <div className="rounded-lg bg-muted p-3 dark:bg-slate-800/40">
              <div className="text-xs text-muted-foreground">Antigüedad laboral</div>
              <div className="text-sm font-semibold text-tinta dark:text-slate-100">
                {resultado.antiguedadAnios} años, {resultado.antiguedadMeses} meses
              </div>
            </div>

            <div className="rounded-lg bg-muted p-3 dark:bg-slate-800/40">
              <div className="text-xs text-muted-foreground">{t("salarioDiario")}</div>
              <div className="text-sm font-semibold tabular-nums text-tinta dark:text-slate-100">
                RD$ {resultado.salarioDiario.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="rounded-lg bg-muted p-3 dark:bg-slate-800/40">
              <div className="text-xs text-muted-foreground">Días a liquidar</div>
              <div className="text-sm font-semibold tabular-nums text-tinta dark:text-slate-100">
                {resultado.diasPreaviso + resultado.diasCesantia + resultado.diasVacaciones} días
              </div>
            </div>

            <div className="rounded-lg bg-[#2096BA]/10 p-3 border border-[#2096BA]/20">
              <div className="text-xs font-medium text-[#2096BA]">{t("totalLiquidacion")}</div>
              <div className="text-base font-bold tabular-nums text-[#2096BA]">
                RD$ {resultado.totalLiquidacion.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-linea text-xs dark:border-slate-800">
            <table className="w-full text-left">
              <thead className="bg-muted text-muted-foreground uppercase tracking-wider dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-2.5">Concepto Laboral</th>
                  <th className="px-4 py-2.5">Base Legal</th>
                  <th className="px-4 py-2.5 text-right">Días</th>
                  <th className="px-4 py-2.5 text-right">Monto a Pagar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr>
                  <td className="px-4 py-2.5 font-medium">{t("preaviso")}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">Art. 76 del Código de Trabajo</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{resultado.diasPreaviso}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                    RD$ {resultado.montoPreaviso.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium">{t("cesantia")}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">Art. 80 del Código de Trabajo</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{resultado.diasCesantia}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                    RD$ {resultado.montoCesantia.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium">{t("vacaciones")}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">Art. 177 del Código de Trabajo</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{resultado.diasVacaciones}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                    RD$ {resultado.montoVacaciones.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium">{t("regalia")}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">Art. 219 (Salario de Navidad, inembargable)</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">—</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                    RD$ {resultado.montoRegaliaPascual.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
