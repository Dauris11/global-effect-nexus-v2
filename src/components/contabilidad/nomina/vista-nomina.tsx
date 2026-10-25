"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Users, FileSpreadsheet, Calculator } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { NominaResumen, EmpleadoContable } from "@/server/contabilidad/nomina/consultas";
import { DialogoNuevaNomina } from "./dialogo-nueva-nomina";
import { DialogoNuevoEmpleado } from "./dialogo-nuevo-empleado";
import { DialogoDetalleNomina } from "./dialogo-detalle-nomina";
import { CalculadoraLaboral } from "./calculadora-laboral";

export function VistaNomina({
  nominas,
  empleados,
  terceros,
  centrosCosto,
  cuentasBanco,
}: {
  nominas: NominaResumen[];
  empleados: EmpleadoContable[];
  terceros: Array<{ id: string; nombre: string; identificacion: string }>;
  centrosCosto: Array<{ id: string; codigo: string; nombre: string }>;
  cuentasBanco: Array<{ id: string; codigo: string; nombre: string }>;
}) {
  const t = useTranslations("contab.nomina");
  const [tabActiva, setTabActiva] = useState("corridas");

  return (
    <div className="space-y-6">
      <Tabs value={tabActiva} onValueChange={setTabActiva} className="w-full">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-linea pb-3 dark:border-slate-800">
          <TabsList className="bg-muted dark:bg-slate-800">
            <TabsTrigger value="corridas" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              {t("tabs.corridas")}
            </TabsTrigger>
            <TabsTrigger value="empleados" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t("tabs.empleados")}
            </TabsTrigger>
            <TabsTrigger value="calculadora" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              {t("tabs.calculadora")}
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            {tabActiva === "corridas" && <DialogoNuevaNomina />}
            {tabActiva === "empleados" && (
              <DialogoNuevoEmpleado terceros={terceros} centrosCosto={centrosCosto} />
            )}
          </div>
        </div>

        {/* 1. Corridas de Nómina */}
        <TabsContent value="corridas" className="mt-4 space-y-4">
          {nominas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-linea p-8 text-center text-sm text-muted-foreground dark:border-slate-800">
              {t("sinNominas")}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-linea bg-card shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-linea bg-muted text-xs font-medium text-muted-foreground uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">{t("codigo")}</th>
                    <th className="px-4 py-3">{t("periodo")}</th>
                    <th className="px-4 py-3">{t("fechaCorte")}</th>
                    <th className="px-4 py-3 text-right">{t("devengado")}</th>
                    <th className="px-4 py-3 text-right">TSS Empleado</th>
                    <th className="px-4 py-3 text-right">{t("isr")}</th>
                    <th className="px-4 py-3 text-right font-bold text-[#2096BA]">{t("neto")}</th>
                    <th className="px-4 py-3 text-center">{t("estado")}</th>
                    <th className="px-4 py-3 text-right">{t("acciones")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {nominas.map((n) => (
                    <tr key={n.id} className="hover:bg-muted/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono font-medium text-tinta dark:text-slate-100">
                        {n.codigo}
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize">{n.periodo_tipo.replace("_", " ")}</span>
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({n.mes}/{n.anio})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-tinta-2 dark:text-slate-400">
                        {n.fecha_corte}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        RD$ {n.total_devengado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-tinta-2 dark:text-slate-400">
                        RD${" "}
                        {(n.total_afp_empleado + n.total_sfs_empleado).toLocaleString("es-DO", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-tinta-2 dark:text-slate-400">
                        RD$ {n.total_isr_empleado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-[#2096BA]">
                        RD$ {n.total_neto.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={
                            n.estado === "pagada"
                              ? "border-linea bg-muted text-[#1E9E6A]"
                              : n.estado === "aprobada"
                              ? "border-[#2096BA]/30 bg-[#2096BA]/10 text-[#2096BA]"
                              : "border-linea bg-muted text-tinta-2 dark:text-slate-300"
                          }
                        >
                          {n.estado}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DialogoDetalleNomina
                          nominaId={n.id}
                          codigo={n.codigo}
                          cuentasBanco={cuentasBanco}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* 2. Personal Institucional */}
        <TabsContent value="empleados" className="mt-4 space-y-4">
          {empleados.length === 0 ? (
            <div className="rounded-xl border border-dashed border-linea p-8 text-center text-sm text-muted-foreground dark:border-slate-800">
              {t("sinEmpleados")}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-linea bg-card shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-linea bg-muted text-xs font-medium text-muted-foreground uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">{t("codigo")}</th>
                    <th className="px-4 py-3">Colaborador</th>
                    <th className="px-4 py-3">{t("cargo")}</th>
                    <th className="px-4 py-3">{t("centroCosto")}</th>
                    <th className="px-4 py-3">{t("tipoContrato")}</th>
                    <th className="px-4 py-3 text-right">{t("salarioBase")}</th>
                    <th className="px-4 py-3 text-center">{t("estado")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {empleados.map((e) => (
                    <tr key={e.id} className="hover:bg-muted/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono font-medium text-tinta dark:text-slate-100">
                        {e.codigo_empleado}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-tinta dark:text-slate-100">
                          {e.tercero_nombre}
                        </div>
                        <div className="text-xs text-muted-foreground">{e.tercero_identificacion}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-tinta dark:text-slate-100">{e.cargo}</div>
                        <div className="text-xs text-muted-foreground">{e.departamento}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="border-linea bg-muted text-tinta-2">
                          {e.centro_costo_codigo}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 capitalize text-tinta-2 dark:text-slate-400">
                        {e.tipo_contrato}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {e.salario_base !== null ? (
                          `RD$ ${e.salario_base.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`
                        ) : (
                          <span className="italic text-slate-400 text-xs">{t("salarioConfidencial")}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={
                            e.estado === "activo"
                              ? "border-linea bg-muted text-[#1E9E6A]"
                              : "border-linea bg-muted text-muted-foreground"
                          }
                        >
                          {e.estado}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* 3. Calculadora Laboral */}
        <TabsContent value="calculadora" className="mt-4">
          <CalculadoraLaboral />
        </TabsContent>
      </Tabs>
    </div>
  );
}
