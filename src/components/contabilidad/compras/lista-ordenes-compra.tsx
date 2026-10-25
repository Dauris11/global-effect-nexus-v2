"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { INSIGNIA_SEMAFORO } from "@/lib/paleta";
import { aprobarOrdenCompra, rechazarOrdenCompra } from "@/server/contabilidad/compras/acciones";
import type { OrdenCompraItem } from "@/server/contabilidad/compras/consultas";

export function ListaOrdenesCompra({
  ordenes,
  puedeAprobar,
}: {
  ordenes: OrdenCompraItem[];
  puedeAprobar: boolean;
}) {
  const t = useTranslations("contab.compras");
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  async function handleAprobar(id: string) {
    setProcesandoId(id);
    await aprobarOrdenCompra(id);
    setProcesandoId(null);
  }

  async function handleRechazar(id: string) {
    const motivo = prompt(t("indicarMotivoRechazo"));
    if (!motivo) return;
    setProcesandoId(id);
    await rechazarOrdenCompra(id, motivo);
    setProcesandoId(null);
  }

  if (ordenes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-linea p-8 text-center text-sm text-muted-foreground dark:border-slate-800">
        {t("sinOrdenesCompra")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-linea bg-card shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-linea bg-muted text-xs font-medium text-muted-foreground uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">{t("fecha")}</th>
            <th className="px-4 py-3">{t("proveedor")}</th>
            <th className="px-4 py-3">{t("fondoYCategoria")}</th>
            <th className="px-4 py-3 text-right">{t("subtotal")}</th>
            <th className="px-4 py-3 text-right">{t("itbis")}</th>
            <th className="px-4 py-3 text-right">{t("total")}</th>
            <th className="px-4 py-3">{t("estado")}</th>
            {puedeAprobar && <th className="px-4 py-3 text-right">{t("acciones")}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {ordenes.map((oc) => (
            <tr key={oc.id} className="hover:bg-muted/50 dark:hover:bg-slate-800/30">
              <td className="px-4 py-3 font-mono font-medium text-tinta-2 dark:text-slate-300">
                OC-{String(oc.numero).padStart(5, "0")}
              </td>
              <td className="px-4 py-3 text-xs text-tinta-2 dark:text-slate-400">{oc.fecha}</td>
              <td className="px-4 py-3">
                <div className="font-medium text-tinta dark:text-slate-100">{oc.proveedorNombre}</div>
                <div className="font-mono text-xs text-muted-foreground">{oc.proveedorRnc}</div>
              </td>
              <td className="px-4 py-3 text-xs text-tinta-2 dark:text-slate-400">
                <div>{oc.fondoNombre}</div>
                <div className="text-slate-400">{oc.categoriaNombre}</div>
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs">
                {oc.subtotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs">
                {oc.itbis.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3 text-right font-mono font-bold text-tinta dark:text-slate-100">
                {oc.moneda} {oc.total.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3">
                {oc.estado === "aprobada" ? (
                  <Badge className={INSIGNIA_SEMAFORO.dentro}>
                    <Check className="mr-1 size-3" />
                    {t("aprobada")}
                  </Badge>
                ) : oc.estado === "pendiente_aprobacion" ? (
                  <Badge variant="outline" className="border-linea-fuerte bg-muted text-tinta">
                    {t("pendienteAprobacion")}
                  </Badge>
                ) : oc.estado === "rechazada" ? (
                  <Badge className={INSIGNIA_SEMAFORO.alerta}>
                    <X className="mr-1 size-3" />
                    {t("rechazada")}
                  </Badge>
                ) : (
                  <Badge variant="outline">{oc.estado}</Badge>
                )}
              </td>
              {puedeAprobar && (
                <td className="px-4 py-3 text-right">
                  {oc.estado === "pendiente_aprobacion" && (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0 text-tinta hover:bg-muted"
                        title={t("aprobar")}
                        disabled={procesandoId === oc.id}
                        onClick={() => handleAprobar(oc.id)}
                      >
                        <Check className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0 text-tinta-2 hover:bg-muted hover:text-tinta"
                        title={t("rechazar")}
                        disabled={procesandoId === oc.id}
                        onClick={() => handleRechazar(oc.id)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
