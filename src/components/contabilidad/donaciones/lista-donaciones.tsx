"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import type { DonacionItem, PromesaConCuotas } from "@/server/contabilidad/donaciones/consultas";

export function ListaDonaciones({
  donaciones,
  promesas,
}: {
  donaciones: DonacionItem[];
  promesas: PromesaConCuotas[];
}) {
  const t = useTranslations("contab.donaciones");

  return (
    <div className="space-y-8">
      {/* Sección 1: Donaciones Registradas */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-tinta dark:text-slate-100">
          {t("donacionesEfectivoYEspecie")}
        </h3>

        {donaciones.length === 0 ? (
          <div className="rounded-xl border border-dashed border-linea p-8 text-center text-sm text-muted-foreground dark:border-slate-800">
            {t("sinDonaciones")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-linea bg-card shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-linea bg-muted text-xs font-medium text-muted-foreground uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">{t("fecha")}</th>
                  <th className="px-4 py-3">{t("donante")}</th>
                  <th className="px-4 py-3">{t("clase")}</th>
                  <th className="px-4 py-3">{t("tratamiento")}</th>
                  <th className="px-4 py-3 text-right">{t("monto")}</th>
                  <th className="px-4 py-3">{t("fondo")}</th>
                  <th className="px-4 py-3">{t("estado")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {donaciones.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono font-medium text-tinta-2 dark:text-slate-300">
                      DON-{String(d.numero).padStart(5, "0")}
                    </td>
                    <td className="px-4 py-3 text-xs text-tinta-2 dark:text-slate-400">{d.fecha}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-tinta dark:text-slate-100">{d.donanteNombre}</div>
                      <div className="font-mono text-xs text-muted-foreground">{d.donanteIdentificacion}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={d.clase === "especie" ? "border-linea-fuerte bg-muted text-tinta" : "border-marca-200 bg-marca-50 text-marca-700"}>
                        {d.clase === "especie" ? t("especie") : t("efectivo")}
                      </Badge>
                      {d.descripcionEspecie && (
                        <div className="mt-1 text-xs text-muted-foreground truncate max-w-xs">{d.descripcionEspecie}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center text-xs font-medium text-tinta-2 dark:text-slate-400">
                        {d.tratamiento === "exento" ? t("exentoLey122") : t("gravado")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-tinta dark:text-slate-100">
                      {d.moneda} {d.monto.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-xs text-tinta-2 dark:text-slate-400">{d.fondoNombre}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="border-linea-fuerte bg-muted text-tinta">
                        <CheckCircle2 className="mr-1 size-3 text-marca-600" />
                        {t("confirmada")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sección 2: Promesas de Donación y Calendario de Cobro */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-tinta dark:text-slate-100">
          {t("promesasCompromisos")}
        </h3>

        {promesas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-linea p-8 text-center text-sm text-muted-foreground dark:border-slate-800">
            {t("sinPromesas")}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {promesas.map((p) => {
              const cobradas = p.cuotas.filter((c) => c.estado === "cobrada").length;
              const totalCuotas = p.cuotas.length;
              const pct = totalCuotas > 0 ? Math.round((cobradas / totalCuotas) * 100) : 0;

              return (
                <div key={p.id} className="rounded-xl border border-linea bg-card p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-mono text-xs font-semibold text-muted-foreground">
                        PRM-{String(p.numero).padStart(5, "0")}
                      </div>
                      <div className="font-medium text-tinta dark:text-slate-100">{p.donanteNombre}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.frecuencia} — {p.fondoNombre}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-tinta dark:text-slate-100">
                        {p.moneda} {p.montoTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {p.estado}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t("avanceCobro")}</span>
                      <span>
                        {cobradas} / {totalCuotas} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted dark:bg-slate-800">
                      <div className="h-full bg-marca-600 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {p.cuotas.length > 0 && (
                    <div className="mt-3 max-h-32 overflow-y-auto rounded-lg border border-linea bg-muted/50 p-2 text-xs dark:border-slate-800 dark:bg-slate-950/40">
                      {p.cuotas.slice(0, 4).map((c) => (
                        <div key={c.id} className="flex items-center justify-between py-1 text-tinta-2 dark:text-slate-400">
                          <span>
                            {t("cuota")} {c.numeroCuota} ({c.fechaVencimiento})
                          </span>
                          <span className="font-mono font-medium">
                            {p.moneda} {c.monto.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                      {p.cuotas.length > 4 && (
                        <div className="text-center text-[10px] text-slate-400 pt-1">
                          +{p.cuotas.length - 4} {t("cuotasMas")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
