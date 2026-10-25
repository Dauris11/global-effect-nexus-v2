"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Package, ArrowLeftRight, ClipboardCheck, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type {
  ArticuloInventario,
  MovimientoKardex,
  ConteoFisicoResumen,
} from "@/server/contabilidad/inventario/consultas";
import { DialogoArticulo } from "./dialogo-articulo";
import { DialogoMovimiento } from "./dialogo-movimiento";
import { DialogoConteoFisico } from "./dialogo-conteo-fisico";

export function VistaInventario({
  articulos,
  movimientosRecientes,
  conteos,
  centrosCosto,
  cuentasInventario,
  cuentasGasto,
}: {
  articulos: ArticuloInventario[];
  movimientosRecientes: MovimientoKardex[];
  conteos: ConteoFisicoResumen[];
  centrosCosto: Array<{ id: string; codigo: string; nombre: string }>;
  cuentasInventario: Array<{ id: string; codigo: string; nombre: string }>;
  cuentasGasto: Array<{ id: string; codigo: string; nombre: string }>;
}) {
  const t = useTranslations("contab.inventarioContable");
  const [tabActiva, setTabActiva] = useState("catalogo");

  const totalValorInventario = articulos.reduce((acc, a) => acc + a.valor_total, 0);
  const articulosBajoStock = articulos.filter((a) => a.stock_actual <= a.stock_minimo);

  return (
    <div className="space-y-6">
      {/* Resumen del almacén */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-linea bg-card p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-muted-foreground">Valorización Total de Inventario</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-[#2096BA]">
            RD$ {totalValorInventario.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Costo Promedio Ponderado (NIIF / NIC 2)
          </div>
        </div>

        <div className="rounded-xl border border-linea bg-card p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-muted-foreground">Artículos en Catálogo</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-tinta dark:text-slate-100">
            {articulos.length} artículos
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Comedor, suministros y material didáctico</div>
        </div>

        <div className="rounded-xl border border-linea bg-card p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-muted-foreground">Alertas de Reabastecimiento</div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`text-xl font-bold tabular-nums ${
                articulosBajoStock.length > 0 ? "text-[#B4342B]" : "text-[#1E9E6A]"
              }`}
            >
              {articulosBajoStock.length} artículos
            </span>
            {articulosBajoStock.length > 0 && <AlertTriangle className="h-5 w-5 text-[#B4342B]" />}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Existencias en o bajo el stock mínimo</div>
        </div>
      </div>

      <Tabs value={tabActiva} onValueChange={setTabActiva} className="w-full">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-linea pb-3 dark:border-slate-800">
          <TabsList className="bg-muted dark:bg-slate-800">
            <TabsTrigger value="catalogo" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              {t("tabs.catalogo")}
            </TabsTrigger>
            <TabsTrigger value="movimientos" className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              {t("tabs.movimientos")}
            </TabsTrigger>
            <TabsTrigger value="tomas" className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              {t("tabs.tomas")}
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <DialogoMovimiento
              articulos={articulos.map((a) => ({
                id: a.id,
                codigo: a.codigo,
                nombre: a.nombre,
                stock_actual: a.stock_actual,
                unidad_medida: a.unidad_medida,
              }))}
              centrosCosto={centrosCosto}
            />
            <DialogoConteoFisico />
            <DialogoArticulo
              centrosCosto={centrosCosto}
              cuentasInventario={cuentasInventario}
              cuentasGasto={cuentasGasto}
            />
          </div>
        </div>

        {/* 1. Catálogo de Consumibles */}
        <TabsContent value="catalogo" className="mt-4 space-y-4">
          {articulos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-linea p-8 text-center text-sm text-muted-foreground dark:border-slate-800">
              {t("sinArticulos")}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-linea bg-card shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-linea bg-muted text-xs font-medium text-muted-foreground uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">{t("codigo")}</th>
                    <th className="px-4 py-3">{t("nombre")}</th>
                    <th className="px-4 py-3">{t("categoria")}</th>
                    <th className="px-4 py-3 text-right">{t("stockActual")}</th>
                    <th className="px-4 py-3 text-right">{t("stockMinimo")}</th>
                    <th className="px-4 py-3 text-right">{t("costoPromedio")}</th>
                    <th className="px-4 py-3 text-right font-bold text-[#2096BA]">
                      {t("valorTotal")}
                    </th>
                    <th className="px-4 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {articulos.map((a) => {
                    const bajoStock = a.stock_actual <= a.stock_minimo;
                    return (
                      <tr key={a.id} className="hover:bg-muted/50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-mono font-medium text-tinta dark:text-slate-100">
                          {a.codigo}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-tinta dark:text-slate-100">{a.nombre}</div>
                          {a.centro_costo_codigo && (
                            <div className="text-xs text-muted-foreground">{a.centro_costo_nombre}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="border-linea bg-muted text-tinta-2 capitalize">
                            {a.categoria.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">
                          {a.stock_actual.toLocaleString("es-DO", { minimumFractionDigits: 2 })}{" "}
                          <span className="text-xs text-muted-foreground font-normal">{a.unidad_medida}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {a.stock_minimo} {a.unidad_medida}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-tinta-2 dark:text-slate-400">
                          RD$ {a.costo_promedio.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-[#2096BA]">
                          RD$ {a.valor_total.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {bajoStock ? (
                            <Badge variant="outline" className="border-linea bg-muted text-[#B4342B]">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              {t("alertaStock")}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-linea bg-muted text-[#1E9E6A]">
                              Óptimo
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* 2. Kardex de Movimientos */}
        <TabsContent value="movimientos" className="mt-4 space-y-4">
          {movimientosRecientes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-linea p-8 text-center text-sm text-muted-foreground dark:border-slate-800">
              {t("sinMovimientos")}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-linea bg-card shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-linea bg-muted text-xs font-medium text-muted-foreground uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">{t("fecha")}</th>
                    <th className="px-4 py-3">{t("tipoMovimiento")}</th>
                    <th className="px-4 py-3 text-right">{t("cantidad")}</th>
                    <th className="px-4 py-3 text-right">{t("costoUnitario")}</th>
                    <th className="px-4 py-3 text-right">{t("total")}</th>
                    <th className="px-4 py-3 text-right">{t("stockAnterior")}</th>
                    <th className="px-4 py-3 text-right font-semibold">{t("stockPosterior")}</th>
                    <th className="px-4 py-3">Motivo / Programa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {movimientosRecientes.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-tinta-2 dark:text-slate-400">{m.fecha}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={
                            m.tipo.startsWith("entrada")
                              ? "border-linea bg-muted text-[#1E9E6A]"
                              : m.tipo === "salida_consumo"
                              ? "border-[#2096BA]/30 bg-[#2096BA]/10 text-[#2096BA]"
                              : "border-linea bg-muted text-[#B4342B]"
                          }
                        >
                          {m.tipo.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {m.cantidad.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-tinta-2">
                        RD$ {m.costo_unitario.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-[#2096BA]">
                        RD$ {m.costo_total.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                        {m.stock_anterior}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        {m.stock_posterior}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {m.motivo ?? (m.centro_costo_nombre ? `Imputado a ${m.centro_costo_nombre}` : "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* 3. Tomas Físicas y Ajustes */}
        <TabsContent value="tomas" className="mt-4 space-y-4">
          {conteos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-linea p-8 text-center text-sm text-muted-foreground dark:border-slate-800">
              {t("sinTomas")}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-linea bg-card shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-linea bg-muted text-xs font-medium text-muted-foreground uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">{t("codigo")}</th>
                    <th className="px-4 py-3">{t("fecha")}</th>
                    <th className="px-4 py-3">{t("descripcion")}</th>
                    <th className="px-4 py-3 text-center">Artículos</th>
                    <th className="px-4 py-3 text-right">{t("diferencia")}</th>
                    <th className="px-4 py-3 text-right">{t("impacto")}</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {conteos.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono font-medium text-tinta dark:text-slate-100">
                        {c.codigo}
                      </td>
                      <td className="px-4 py-3 text-tinta-2 dark:text-slate-400">{c.fecha}</td>
                      <td className="px-4 py-3 font-medium text-tinta dark:text-slate-100">
                        {c.descripcion}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">{c.articulos_conteo}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {c.diferencia_neta > 0 ? `+${c.diferencia_neta}` : c.diferencia_neta}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#2096BA]">
                        RD$ {c.impacto_total.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={
                            c.estado === "aplicado"
                              ? "border-linea bg-muted text-[#1E9E6A]"
                              : "border-linea bg-muted text-tinta-2 dark:text-slate-300"
                          }
                        >
                          {c.estado}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
