"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { ComprobanteRetencionItem } from "@/server/contabilidad/retenciones/consultas";

export function ListaRetenciones({ retenciones }: { retenciones: ComprobanteRetencionItem[] }) {
  const t = useTranslations("contab.retenciones");

  if (retenciones.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-linea p-8 text-center text-sm text-muted-foreground dark:border-slate-800">
        {t("sinComprobantes")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-linea bg-card shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-linea bg-muted text-xs font-medium text-muted-foreground uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">{t("secuencia")}</th>
            <th className="px-4 py-3">{t("fecha")}</th>
            <th className="px-4 py-3">{t("proveedor")}</th>
            <th className="px-4 py-3">{t("factura")}</th>
            <th className="px-4 py-3 text-right">{t("montoFacturado")}</th>
            <th className="px-4 py-3 text-right">{t("itbisRetenido")}</th>
            <th className="px-4 py-3 text-right">{t("isrRetenido")}</th>
            <th className="px-4 py-3 text-right">{t("totalRetenido")}</th>
            <th className="px-4 py-3">{t("estado")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {retenciones.map((r) => {
            const totalRet = r.itbisRetenido + r.isrRetenido;
            return (
              <tr key={r.id} className="hover:bg-muted/50 dark:hover:bg-slate-800/30">
                <td className="px-4 py-3 font-mono font-medium text-tinta dark:text-slate-100">
                  {r.secuenciaInterna}
                </td>
                <td className="px-4 py-3 text-xs text-tinta-2 dark:text-slate-400">{r.fechaEmision}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-tinta dark:text-slate-100">{r.proveedorNombre}</div>
                  <div className="font-mono text-xs text-muted-foreground">{r.proveedorRnc}</div>
                </td>
                <td className="px-4 py-3 text-xs text-tinta-2 dark:text-slate-400">
                  <div>FP-{String(r.facturaNumero).padStart(5, "0")}</div>
                  <div className="font-mono text-slate-400">{r.ncfFactura || "Sin NCF"}</div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  {r.montoFacturado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-tinta-2 dark:text-slate-300">
                  {r.itbisRetenido.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                  {r.tasaItbisRetenido > 0 && (
                    <span className="ml-1 text-[10px] text-slate-400">
                      ({Math.round(r.tasaItbisRetenido * 100)}%)
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-tinta-2 dark:text-slate-300">
                  {r.isrRetenido.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                  {r.tasaIsrRetenido > 0 && (
                    <span className="ml-1 text-[10px] text-slate-400">
                      ({Math.round(r.tasaIsrRetenido * 100)}%)
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-marca-600 dark:text-marca-400">
                  RD$ {totalRet.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="border-linea-fuerte bg-muted text-tinta">
                    {r.estado}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
