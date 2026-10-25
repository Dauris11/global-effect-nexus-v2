"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Landmark, History, Layers } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type {
  ActivoFijoContable,
  DepreciacionMensualResumen,
  CategoriaActivo,
} from "@/server/contabilidad/activos-fijos/consultas";
import { DialogoActivoFijo } from "./dialogo-activo-fijo";
import { DialogoDepreciacion } from "./dialogo-depreciacion";

export function VistaActivosFijos({
  activos,
  depreciaciones,
  categorias,
  centrosCosto,
  activosFisicos,
}: {
  activos: ActivoFijoContable[];
  depreciaciones: DepreciacionMensualResumen[];
  categorias: CategoriaActivo[];
  centrosCosto: Array<{ id: string; codigo: string; nombre: string }>;
  activosFisicos: Array<{ id: string; codigo: string; nombre: string }>;
}) {
  const t = useTranslations("contab.activosFijos");
  const [tabActiva, setTabActiva] = useState("activos");

  const totalCosto = activos.reduce((acc, a) => acc + a.costo_adquisicion, 0);
  const totalDeprecAcum = activos.reduce((acc, a) => acc + a.depreciacion_acumulada, 0);
  const totalValorLibros = activos.reduce((acc, a) => acc + a.valor_en_libros, 0);

  return (
    <div className="space-y-6">
      {/* Tarjetas de Resumen Patrimonial */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-linea bg-card p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-muted-foreground">Costo Histórico de Adquisición</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-tinta dark:text-slate-100">
            RD$ {totalCosto.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">{activos.length} activos capitalizados</div>
        </div>

        <div className="rounded-xl border border-linea bg-card p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-muted-foreground">Depreciación Acumulada Total</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-[#B4342B]">
            RD$ {totalDeprecAcum.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {totalCosto > 0 ? ((totalDeprecAcum / totalCosto) * 100).toFixed(1) : 0}% amortizado
          </div>
        </div>

        <div className="rounded-xl border border-[#2096BA]/20 bg-[#2096BA]/5 p-4 shadow-xs">
          <div className="text-xs font-medium text-[#2096BA]">Valor Neto en Libros</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-[#2096BA]">
            RD$ {totalValorLibros.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-[#2096BA]/80">Patrimonio institucional vigente</div>
        </div>
      </div>

      <Tabs value={tabActiva} onValueChange={setTabActiva} className="w-full">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-linea pb-3 dark:border-slate-800">
          <TabsList className="bg-muted dark:bg-slate-800">
            <TabsTrigger value="activos" className="flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              {t("tabs.activos")}
            </TabsTrigger>
            <TabsTrigger value="depreciaciones" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              {t("tabs.depreciaciones")}
            </TabsTrigger>
            <TabsTrigger value="categorias" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              {t("tabs.categorias")}
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <DialogoDepreciacion />
            <DialogoActivoFijo
              categorias={categorias}
              centrosCosto={centrosCosto}
              activosFisicos={activosFisicos}
            />
          </div>
        </div>

        {/* 1. Activos Capitalizados */}
        <TabsContent value="activos" className="mt-4 space-y-4">
          {activos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-linea p-8 text-center text-sm text-muted-foreground dark:border-slate-800">
              {t("sinActivos")}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-linea bg-card shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-linea bg-muted text-xs font-medium text-muted-foreground uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">{t("codigo")}</th>
                    <th className="px-4 py-3">{t("nombre")}</th>
                    <th className="px-4 py-3">{t("categoria")}</th>
                    <th className="px-4 py-3">{t("centroCosto")}</th>
                    <th className="px-4 py-3">{t("fechaAdquisicion")}</th>
                    <th className="px-4 py-3 text-right">{t("costo")}</th>
                    <th className="px-4 py-3 text-right">{t("depreciacionAcumulada")}</th>
                    <th className="px-4 py-3 text-right font-bold text-[#2096BA]">{t("valorLibros")}</th>
                    <th className="px-4 py-3 text-center">{t("estado")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {activos.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono font-medium text-tinta dark:text-slate-100">
                        {a.codigo}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-tinta dark:text-slate-100">{a.nombre}</div>
                        {a.inventario_activo_codigo && (
                          <div className="text-xs text-muted-foreground">QR: {a.inventario_activo_codigo}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-tinta-2 dark:text-slate-400">
                        {a.categoria_nombre}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="border-linea bg-muted text-tinta-2">
                          {a.centro_costo_codigo}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-tinta-2 dark:text-slate-400">
                        {a.fecha_adquisicion}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        RD$ {a.costo_adquisicion.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-tinta-2 dark:text-slate-400">
                        RD$ {a.depreciacion_acumulada.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-[#2096BA]">
                        RD$ {a.valor_en_libros.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={
                            a.estado === "activo"
                              ? "border-linea bg-muted text-[#1E9E6A]"
                              : a.estado === "totalmente_depreciado"
                              ? "border-linea bg-muted text-tinta-2 dark:text-slate-300"
                              : "border-linea bg-muted text-muted-foreground"
                          }
                        >
                          {a.estado}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* 2. Historial de Depreciaciones */}
        <TabsContent value="depreciaciones" className="mt-4 space-y-4">
          {depreciaciones.length === 0 ? (
            <div className="rounded-xl border border-dashed border-linea p-8 text-center text-sm text-muted-foreground dark:border-slate-800">
              {t("sinDepreciaciones")}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-linea bg-card shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-linea bg-muted text-xs font-medium text-muted-foreground uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">{t("anio")} / {t("mes")}</th>
                    <th className="px-4 py-3">{t("fechaAsiento")}</th>
                    <th className="px-4 py-3">{t("asientoGenerado")}</th>
                    <th className="px-4 py-3 text-center">Activos amortizados</th>
                    <th className="px-4 py-3 text-right font-bold text-[#2096BA]">
                      {t("totalAmortizado")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {depreciaciones.map((d) => (
                    <tr key={d.id} className="hover:bg-muted/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-semibold text-tinta dark:text-slate-100">
                        {d.mes}/{d.anio}
                      </td>
                      <td className="px-4 py-3 text-tinta-2 dark:text-slate-400">{d.fecha_asiento}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[#2096BA]">
                        {d.asiento_numero ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">{d.activos_conteo}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-[#2096BA]">
                        RD$ {d.total_depreciacion.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* 3. Categorías DGII / NIIF */}
        <TabsContent value="categorias" className="mt-4 space-y-4">
          <div className="overflow-x-auto rounded-xl border border-linea bg-card shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-linea bg-muted text-xs font-medium text-muted-foreground uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">{t("codigo")}</th>
                  <th className="px-4 py-3">{t("nombre")}</th>
                  <th className="px-4 py-3 text-center">{t("vidaUtil")}</th>
                  <th className="px-4 py-3 text-center">{t("tasaAnual")}</th>
                  <th className="px-4 py-3">{t("cuentaActivo")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {categorias.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono font-medium text-tinta dark:text-slate-100">
                      {c.codigo}
                    </td>
                    <td className="px-4 py-3 font-medium text-tinta dark:text-slate-100">
                      {c.nombre}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {c.vida_util_meses} meses ({Math.round(c.vida_util_meses / 12)} años)
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums font-semibold text-[#2096BA]">
                      {c.porcentaje_anual}%
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-tinta-2 dark:text-slate-400">
                      {c.cuenta_activo_codigo} — {c.cuenta_activo_nombre}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
