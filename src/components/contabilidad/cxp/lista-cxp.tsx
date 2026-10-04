"use client";

import { AlertTriangle, Calendar, CheckCircle2, Clock, FileText, GanttChartSquare, HandCoins } from "lucide-react";
import { useTranslations } from "next-intl";

import { Monto } from "@/components/contabilidad/comun";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { INSIGNIA_SEMAFORO } from "@/lib/paleta";
import type { EstadoCxp, FilaCxp } from "@/server/contabilidad/cxp/consultas";

export function ListaCxp({
  cuentas,
  estadoActual,
}: {
  cuentas: FilaCxp[];
  estadoActual: EstadoCxp | "abiertas";
}) {
  const t = useTranslations("contab.cxp");
  const tc = useTranslations("contab");

  const pestañas: { valor: EstadoCxp | "abiertas"; etiqueta: string }[] = [
    { valor: "abiertas", etiqueta: "Abiertas" },
    { valor: "pendiente", etiqueta: tc("estadoCxp.pendiente") },
    { valor: "programada", etiqueta: tc("estadoCxp.programada") },
    { valor: "pagada_parcial", etiqueta: tc("estadoCxp.pagada_parcial") },
    { valor: "pagada", etiqueta: tc("estadoCxp.pagada") },
    { valor: "anulada", etiqueta: tc("estadoCxp.anulada") },
  ];

  return (
    <div className="space-y-4">
      {/* Pestañas de estado y botón al Gantt */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5 border-b border-linea pb-2">
          {pestañas.map((p) => {
            const activa = estadoActual === p.valor;
            return (
              <Button
                key={p.valor}
                asChild
                variant={activa ? "secondary" : "ghost"}
                size="sm"
                className={activa ? "font-semibold" : "text-tinta-2"}
              >
                <Link
                  href={
                    p.valor === "abiertas"
                      ? "/contabilidad/cuentas-por-pagar"
                      : `/contabilidad/cuentas-por-pagar?estado=${p.valor}`
                  }
                >
                  {p.etiqueta}
                </Link>
              </Button>
            );
          })}
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href="/contabilidad/cuentas-por-pagar/gantt">
            <GanttChartSquare className="size-4" />
            {t("gantt")}
          </Link>
        </Button>
      </div>

      {cuentas.length === 0 ? (
        <div className="rounded-tarjeta border border-linea bg-background p-8 text-center text-tinta-2">
          <p className="font-medium text-tinta">{t("vacio")}</p>
          <p className="mt-1 text-sm">{t("vacioTexto")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-tarjeta border border-linea bg-background">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-linea text-xs text-tinta-2 uppercase bg-superficie/40">
              <tr>
                <th className="py-3 px-4">{t("col.tercero")}</th>
                <th className="py-3 px-4">{t("col.concepto")}</th>
                <th className="py-3 px-4">{t("col.vencimiento")}</th>
                <th className="py-3 px-4 text-right">{t("col.saldo")}</th>
                <th className="py-3 px-4 text-center">{t("col.estado")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {cuentas.map((c) => {
                const vencida = c.dias_vencida > 0 && c.estado !== "pagada" && c.estado !== "anulada";
                return (
                  <tr key={c.id} className="hover:bg-superficie/60 transition-colors">
                    <td className="py-3 px-4">
                      <Link
                        href={`/contabilidad/cuentas-por-pagar/${c.id}`}
                        className="font-medium text-marca-700 hover:underline block truncate max-w-xs"
                      >
                        {c.tercero}
                      </Link>
                      <span className="text-xs text-tinta-2 block">
                        {c.origen === "factura"
                          ? t("origenFactura")
                          : t("origenSolicitud", { folio: c.solicitud_folio ?? "" })}
                        {c.proyecto ? ` · ${c.proyecto}` : ""}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-tinta max-w-sm truncate">
                      {c.concepto}
                      {c.fecha_programada && (
                        <span className="text-xs text-marca-700 block mt-0.5">
                          {t("programada", { fecha: c.fecha_programada })}
                          {c.cuenta_salida ? ` (${c.cuenta_salida})` : ""}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono text-xs block text-tinta">{c.fecha_vencimiento}</span>
                      {vencida ? (
                        <span className="inline-flex items-center gap-1 text-xs text-alerta font-medium">
                          <AlertTriangle className="size-3" />
                          {t("vencida", { n: c.dias_vencida })}
                        </span>
                      ) : c.dias_vencida === 0 ? (
                        <span className="text-xs text-marca-700 font-medium">{t("venceHoy")}</span>
                      ) : (
                        <span className="text-xs text-tinta-2">
                          {t("vence", { fecha: c.fecha_vencimiento })}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Monto
                        valor={c.saldo}
                        moneda={c.moneda}
                        className="font-bold text-tinta block"
                      />
                      {Number(c.pagado) > 0 && (
                        <span className="text-xs text-tinta-2">
                          {t("pagado")}: <Monto valor={c.pagado} moneda={c.moneda} />
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <Badge
                        className={
                          c.estado === "pagada"
                            ? INSIGNIA_SEMAFORO.dentro
                            : c.estado === "anulada"
                            ? INSIGNIA_SEMAFORO.alerta
                            : vencida
                            ? "bg-alerta-fondo text-alerta border border-alerta-linea"
                            : undefined
                        }
                        variant={c.estado === "pendiente" ? "neutra" : undefined}
                      >
                        {tc(`estadoCxp.${c.estado}` as never)}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
