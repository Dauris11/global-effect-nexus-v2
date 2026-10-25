"use client";

import { useState } from "react";
import { Download, FileText, HandHeart, Layers, User } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RendicionDonante } from "@/server/contabilidad/rendicion/consultas";

export function VistaRendicionCuentas({
  donantes,
  rendicionInicial,
}: {
  donantes: { id: string; nombre: string; identificacion: string }[];
  rendicionInicial: RendicionDonante | null;
}) {
  const t = useTranslations("contab.rendicion");
  const [donanteId, setDonanteId] = useState(rendicionInicial?.donante.id ?? "");
  const [rendicion, setRendicion] = useState<RendicionDonante | null>(rendicionInicial);
  const [cargando, setCargando] = useState(false);

  async function handleCambioDonante(id: string) {
    setDonanteId(id);
    setCargando(true);
    // Redirección o recarga dinámica con query param
    window.location.search = `?donanteId=${encodeURIComponent(id)}`;
  }

  function handleImprimir() {
    window.print();
  }

  return (
    <div className="space-y-6">
      {/* Selector de Donante */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-linea bg-card p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 print:hidden">
        <div className="w-full sm:w-96 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t("seleccionarDonante")}
          </label>
          <Select value={donanteId} onValueChange={handleCambioDonante}>
            <SelectTrigger>
              <SelectValue placeholder={t("buscarPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {donantes.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nombre} ({d.identificacion})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {rendicion && (
          <Button variant="outline" onClick={handleImprimir} disabled={cargando}>
            <Download className="mr-2 size-4" />
            {t("exportarInforme")}
          </Button>
        )}
      </div>

      {!rendicion ? (
        <div className="rounded-xl border border-dashed border-linea p-12 text-center text-sm text-muted-foreground dark:border-slate-800">
          <User className="mx-auto size-10 text-slate-400 mb-3" />
          {t("sinDatos")}
        </div>
      ) : (
        <div className="space-y-6 print:space-y-4">
          {/* Ficha Resumen del Donante */}
          <div className="rounded-xl border border-linea bg-card p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-linea dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-tinta dark:text-slate-100">
                  {rendicion.donante.nombre}
                </h2>
                <div className="font-mono text-xs text-muted-foreground mt-0.5">
                  Identificación: {rendicion.donante.identificacion}
                  {rendicion.donante.email && ` • ${rendicion.donante.email}`}
                </div>
              </div>
              <Badge variant="outline" className="border-marca-200 bg-marca-50 text-marca-700 w-fit">
                Trazabilidad ASFL Ley 122-05
              </Badge>
            </div>

            {/* KPIs de Rendición */}
            <div className="grid gap-4 sm:grid-cols-3 pt-2">
              <div className="rounded-lg bg-muted p-4 dark:bg-slate-800/50">
                <span className="text-xs text-muted-foreground">{t("totalDonado")}</span>
                <div className="mt-1 font-mono text-xl font-bold text-tinta dark:text-slate-100">
                  RD$ {rendicion.totales.totalDonado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="rounded-lg bg-muted p-4 dark:bg-slate-800/50">
                <span className="text-xs text-muted-foreground">{t("totalEjecutado")}</span>
                <div className="mt-1 font-mono text-xl font-bold text-marca-600 dark:text-marca-400">
                  RD$ {rendicion.totales.totalEjecutadoLiberado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="rounded-lg bg-muted p-4 dark:bg-slate-800/50">
                <span className="text-xs text-muted-foreground">{t("saldoPendiente")}</span>
                <div className="mt-1 font-mono text-xl font-bold text-tinta dark:text-slate-100">
                  RD$ {rendicion.totales.saldoPendienteRestringido.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* 1. Donaciones Recibidas */}
          <div className="rounded-xl border border-linea bg-card p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <h3 className="font-semibold text-sm flex items-center text-tinta dark:text-slate-100">
              <HandHeart className="mr-2 size-4 text-marca-600" />
              {t("donacionesRecibidas")}
            </h3>
            {rendicion.donaciones.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin donaciones registradas para este tercero.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted text-muted-foreground dark:bg-slate-800/50">
                    <tr>
                      <th className="py-2 px-3">Núm</th>
                      <th className="py-2 px-3">Fecha</th>
                      <th className="py-2 px-3">Tipo</th>
                      <th className="py-2 px-3">Fondo Destino</th>
                      <th className="py-2 px-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rendicion.donaciones.map((d) => (
                      <tr key={d.id}>
                        <td className="py-2 px-3 font-mono">DON-{String(d.numero).padStart(5, "0")}</td>
                        <td className="py-2 px-3 font-mono">{d.fecha}</td>
                        <td className="py-2 px-3 capitalize">{d.clase}</td>
                        <td className="py-2 px-3">{d.fondoNombre}</td>
                        <td className="py-2 px-3 text-right font-mono font-medium">
                          {d.moneda} {d.monto.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 2. Fondos Vinculados */}
          <div className="rounded-xl border border-linea bg-card p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <h3 className="font-semibold text-sm flex items-center text-tinta dark:text-slate-100">
              <Layers className="mr-2 size-4 text-marca-600" />
              {t("fondosAsociados")}
            </h3>
            {rendicion.fondos.length === 0 ? (
              <p className="text-xs text-muted-foreground">No hay fondos con destino específico para este donante.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted text-muted-foreground dark:bg-slate-800/50">
                    <tr>
                      <th className="py-2 px-3">Fondo</th>
                      <th className="py-2 px-3">Condición Donante</th>
                      <th className="py-2 px-3 text-right">Asignado</th>
                      <th className="py-2 px-3 text-right">Liberado</th>
                      <th className="py-2 px-3 text-right">Disponible</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rendicion.fondos.map((f) => (
                      <tr key={f.id}>
                        <td className="py-2 px-3 font-medium">{f.nombre}</td>
                        <td className="py-2 px-3 text-muted-foreground italic">{f.propositoRestringido || "General"}</td>
                        <td className="py-2 px-3 text-right font-mono">
                          RD$ {f.montoOriginal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          RD$ {f.montoLiberado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          RD$ {f.saldoDisponible.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 3. Gastos y Becas Ejecutadas */}
          <div className="rounded-xl border border-linea bg-card p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <h3 className="font-semibold text-sm flex items-center text-tinta dark:text-slate-100">
              <FileText className="mr-2 size-4 text-marca-600" />
              {t("gastosEjecutados")}
            </h3>
            {rendicion.ejecuciones.length === 0 ? (
              <p className="text-xs text-muted-foreground">No hay asientos de gastos registrados aún bajo estos fondos.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted text-muted-foreground dark:bg-slate-800/50">
                    <tr>
                      <th className="py-2 px-3">Fecha</th>
                      <th className="py-2 px-3">Programa / CC</th>
                      <th className="py-2 px-3">Cuenta Contable</th>
                      <th className="py-2 px-3">Concepto</th>
                      <th className="py-2 px-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rendicion.ejecuciones.map((g) => (
                      <tr key={g.id}>
                        <td className="py-2 px-3 font-mono">{g.fecha}</td>
                        <td className="py-2 px-3">{g.centroCostoNombre || "—"}</td>
                        <td className="py-2 px-3 font-medium">{g.cuentaNombre}</td>
                        <td className="py-2 px-3 text-muted-foreground">{g.descripcion}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          RD$ {g.monto.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
