"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { CentroCostoItem } from "@/server/contabilidad/centros-costo/consultas";

export function ListaCentrosCosto({ centros }: { centros: CentroCostoItem[] }) {
  const t = useTranslations("contab.centrosCosto");

  if (centros.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-linea p-8 text-center text-sm text-muted-foreground dark:border-slate-800">
        {t("sinCentros")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-linea bg-card shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-linea bg-muted text-xs font-medium text-muted-foreground uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">{t("codigo")}</th>
            <th className="px-4 py-3">{t("nombre")}</th>
            <th className="px-4 py-3">{t("programa")}</th>
            <th className="px-4 py-3">{t("responsable")}</th>
            <th className="px-4 py-3 text-right">{t("gastosAcumulados")}</th>
            <th className="px-4 py-3 text-right">{t("estado")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {centros.map((cc) => (
            <tr key={cc.id} className="hover:bg-muted/50 dark:hover:bg-slate-800/30">
              <td className="px-4 py-3 font-mono font-bold text-tinta dark:text-slate-100">
                {cc.codigo}
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-tinta dark:text-slate-100">{cc.nombre}</div>
                {cc.descripcion && (
                  <div className="text-xs text-muted-foreground truncate max-w-sm">{cc.descripcion}</div>
                )}
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline" className="border-linea-fuerte bg-muted text-tinta capitalize">
                  {t(cc.programa as keyof typeof t)}
                </Badge>
              </td>
              <td className="px-4 py-3 text-xs text-tinta-2 dark:text-slate-400">
                {cc.responsableNombre || "—"}
              </td>
              <td className="px-4 py-3 text-right font-mono font-medium text-tinta dark:text-slate-100">
                RD$ {cc.totalGastos.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3 text-right">
                <Badge variant="outline" className={cc.activo ? "border-marca-200 bg-marca-50 text-marca-700" : "border-linea bg-muted text-tinta-2"}>
                  {cc.activo ? t("activo") : t("inactivo")}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
