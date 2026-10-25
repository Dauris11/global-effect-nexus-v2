"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { INSIGNIA_SEMAFORO } from "@/lib/paleta";
import { aprobarPresupuesto } from "@/server/contabilidad/presupuesto/acciones";
import type {
  PresupuestoItem,
  ResumenEjecucionCentroCosto,
} from "@/server/contabilidad/presupuesto/consultas";

export function VistaPresupuesto({
  presupuestos,
  ejecucionInicial,
  puedeAprobar,
}: {
  presupuestos: PresupuestoItem[];
  ejecucionInicial: ResumenEjecucionCentroCosto[];
  puedeAprobar: boolean;
}) {
  const t = useTranslations("contab.presupuesto");
  const [presupuestoSeleccionadoId, setPresupuestoSeleccionadoId] = useState(
    presupuestos[0]?.id ?? ""
  );
  const [aprobando, setAprobando] = useState(false);

  const presupuestoActual = presupuestos.find((p) => p.id === presupuestoSeleccionadoId);

  async function handleAprobar() {
    if (!presupuestoActual) return;
    setAprobando(true);
    await aprobarPresupuesto(presupuestoActual.id);
    setAprobando(false);
  }

  const totalPresupuestado = ejecucionInicial.reduce((acc, e) => acc + e.presupuestado, 0);
  const totalEjecutado = ejecucionInicial.reduce((acc, e) => acc + e.ejecutado, 0);
  const pctGlobal = totalPresupuestado > 0 ? Math.round((totalEjecutado / totalPresupuestado) * 100) : 0;

  if (presupuestos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-linea p-8 text-center text-sm text-muted-foreground dark:border-slate-800">
        {t("sinPresupuestos")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selector y Encabezado del Presupuesto */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-linea bg-card p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-tinta dark:text-slate-100">
              {presupuestoActual?.nombre}
            </span>
            <Badge
              variant="outline"
              className={
                presupuestoActual?.estado === "aprobado"
                  ? INSIGNIA_SEMAFORO.dentro
                  : "border-linea bg-muted text-tinta"
              }
            >
              {presupuestoActual?.estado === "aprobado" && (
                <CheckCircle2 className="mr-1 size-3" />
              )}
              {t(presupuestoActual?.estado as keyof typeof t)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Ejercicio fiscal: {presupuestoActual?.ejercicio} — Creado por {presupuestoActual?.creadoPor}
          </p>
        </div>

        {puedeAprobar && presupuestoActual?.estado === "borrador" && (
          <Button onClick={handleAprobar} disabled={aprobando} size="sm">
            <CheckCircle2 className="mr-2 size-4" />
            {aprobando ? "Aprobando..." : t("aprobar")}
          </Button>
        )}
      </div>

      {/* Tarjetas KPI de Resumen */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-linea bg-card p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-medium text-muted-foreground">{t("presupuestado")}</span>
          <div className="mt-2 text-2xl font-bold font-mono text-tinta dark:text-slate-100">
            RD$ {totalPresupuestado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="rounded-xl border border-linea bg-card p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-medium text-muted-foreground">{t("ejecutado")}</span>
          <div className="mt-2 text-2xl font-bold font-mono text-tinta dark:text-slate-100">
            RD$ {totalEjecutado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="rounded-xl border border-linea bg-card p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-medium text-muted-foreground">{t("ejecucionPct")}</span>
          <div className="mt-2 text-2xl font-bold font-mono text-marca-600 dark:text-marca-400">
            {pctGlobal}%
          </div>
        </div>
      </div>

      {/* Matriz de Ejecución por Centro de Costo */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-tinta dark:text-slate-100">
          {t("matrizTitulo")}
        </h3>

        <div className="overflow-x-auto rounded-xl border border-linea bg-card shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-linea bg-muted text-xs font-medium text-muted-foreground uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Centro de Costo</th>
                <th className="px-4 py-3 text-right">{t("presupuestado")}</th>
                <th className="px-4 py-3 text-right">{t("ejecutado")}</th>
                <th className="px-4 py-3 text-right">{t("desviacion")}</th>
                <th className="px-4 py-3 w-48">{t("ejecucionPct")}</th>
                <th className="px-4 py-3 text-right">Alerta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {ejecucionInicial.map((e) => {
                const pct = Math.min(100, Math.round(e.porcentajeEjecucion));
                return (
                  <tr key={e.centroCostoId} className="hover:bg-muted/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-tinta dark:text-slate-100">{e.nombre}</div>
                      <div className="font-mono text-xs text-muted-foreground">{e.codigo}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-tinta-2 dark:text-slate-300">
                      RD$ {e.presupuestado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-tinta-2 dark:text-slate-300">
                      RD$ {e.ejecutado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-tinta-2 dark:text-slate-300">
                      RD$ {e.desviacion.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span>{e.porcentajeEjecucion}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted dark:bg-slate-800">
                          <div
                            className={`h-full transition-all ${
                              e.estadoAlerta === "sobregiro"
                                ? "bg-tinta font-bold"
                                : "bg-marca-600"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {e.estadoAlerta === "sobregiro" ? (
                        <Badge className={INSIGNIA_SEMAFORO.alerta}>
                          <ShieldAlert className="mr-1 size-3" />
                          {t("alertas.sobregiro")}
                        </Badge>
                      ) : e.estadoAlerta === "atencion" ? (
                        <Badge variant="outline" className="border-linea-fuerte bg-muted text-tinta">
                          <AlertTriangle className="mr-1 size-3" />
                          {t("alertas.atencion")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-linea bg-muted text-tinta">
                          {t("alertas.normal")}
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
