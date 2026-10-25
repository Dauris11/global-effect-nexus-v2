"use client";

import { AlertTriangle, Ban, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { INSIGNIA_SEMAFORO } from "@/lib/paleta";
import { DialogoDebidaDiligencia } from "@/components/contabilidad/terceros/dialogo-debida-diligencia";
import type { TerceroResumen } from "@/server/contabilidad/terceros/consultas";

export function ListaTerceros({ terceros }: { terceros: TerceroResumen[] }) {
  const t = useTranslations("contab.terceros");

  if (terceros.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-linea p-8 text-center text-sm text-muted-foreground dark:border-slate-800">
        {t("sinTerceros")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-linea bg-card shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-linea bg-muted text-xs font-medium text-muted-foreground uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">{t("identificacion")}</th>
            <th className="px-4 py-3">{t("nombreRazonSocial")}</th>
            <th className="px-4 py-3">{t("clasificacion")}</th>
            <th className="px-4 py-3">{t("contacto")}</th>
            <th className="px-4 py-3">{t("debidaDiligencia")}</th>
            <th className="px-4 py-3 text-right">{t("acciones")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {terceros.map((ter) => (
            <tr key={ter.id} className="hover:bg-muted/50 dark:hover:bg-slate-800/30">
              <td className="px-4 py-3 font-mono text-xs">
                <span className="font-semibold text-tinta-2 dark:text-slate-300">
                  {ter.tipoId.toUpperCase()}:
                </span>{" "}
                {ter.identificacion}
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-tinta dark:text-slate-100">
                  {ter.nombreRazonSocial}
                </div>
                {ter.nombreComercial && (
                  <div className="text-xs text-muted-foreground">{ter.nombreComercial}</div>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {ter.esDonante && (
                    <Badge variant="outline" className="border-marca-200 bg-marca-50 text-marca-600">
                      {t("donante")}
                    </Badge>
                  )}
                  {ter.esProveedor && (
                    <Badge variant="outline" className="border-linea bg-muted text-tinta">
                      {t("proveedor")}
                    </Badge>
                  )}
                  {ter.esEmpleado && (
                    <Badge variant="outline" className="border-linea bg-muted text-tinta-2">
                      {t("empleado")}
                    </Badge>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-tinta-2 dark:text-slate-400">
                {ter.email && <div>{ter.email}</div>}
                {ter.telefono && <div>{ter.telefono}</div>}
              </td>
              <td className="px-4 py-3">
                {ter.debidaDiligenciaEstado === "aprobado" ? (
                  <Badge className={INSIGNIA_SEMAFORO.dentro}>
                    <CheckCircle2 className="mr-1 size-3" />
                    {t("cumpleLey155")}
                  </Badge>
                ) : ter.debidaDiligenciaEstado === "observado" ? (
                  <Badge className="border-linea-fuerte bg-muted text-tinta">
                    <AlertTriangle className="mr-1 size-3" />
                    {t("observado")}
                  </Badge>
                ) : ter.debidaDiligenciaEstado === "rechazado" ? (
                  <Badge className={INSIGNIA_SEMAFORO.alerta}>
                    <Ban className="mr-1 size-3" />
                    {t("rechazado")}
                  </Badge>
                ) : (
                  <span className="text-xs text-tinta-2">{t("sinEvaluar")}</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <DialogoDebidaDiligencia terceroId={ter.id} nombreTercero={ter.nombreRazonSocial} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
