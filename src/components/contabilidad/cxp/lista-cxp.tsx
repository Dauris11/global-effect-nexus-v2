"use client";

import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/app/status-badge";
import { Monto } from "@/components/contabilidad/comun";
import { PanelCxp } from "@/components/contabilidad/cxp/panel-cxp";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { senalVencimiento } from "@/lib/contabilidad/cxp";
import type { FilaCxp } from "@/server/contabilidad/cxp/consultas";

/**
 * Tabla densa de cuentas por pagar. La señal «vencida» / «por vencer» sale de
 * `dias_vencida`, calculado en la base con la fecha de la Fundación (America/Santo_Domingo),
 * y se muestra como `StatusBadge` junto a la fecha, con su icono. Clic en la fila: panel lateral.
 */
export function ListaCxp({ cuentas, puedeRegistrar }: { cuentas: FilaCxp[]; puedeRegistrar: boolean }) {
  const t = useTranslations("contab.cxp");
  const tl = useTranslations("listas.cxp");

  const textoVencimiento = (c: FilaCxp) =>
    c.dias_vencida > 0
      ? t("vencida", { n: c.dias_vencida })
      : c.dias_vencida === 0
        ? t("venceHoy")
        : tl("venceEn", { n: -c.dias_vencida });
  const origen = (c: FilaCxp) =>
    [c.origen === "factura" ? t("origenFactura") : t("origenSolicitud", { folio: c.solicitud_folio ?? "" }), c.proyecto]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="overflow-hidden rounded-card border border-linea bg-card shadow-card">
      <table className="hidden w-full text-sm md:table">
        <thead className="border-b border-linea text-left texto-meta">
          <tr>
            <th className="px-4 py-3 font-medium">{t("col.tercero")}</th>
            <th className="px-4 py-3 font-medium">{t("col.concepto")}</th>
            <th className="px-4 py-3 font-medium">{t("col.vencimiento")}</th>
            <th className="px-4 py-3 text-right font-medium">{t("col.saldo")}</th>
            <th className="px-4 py-3 font-medium">{t("col.estado")}</th>
            <th className="px-4 py-3">
              <span className="sr-only">{tl("col.acciones")}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-linea">
          {cuentas.map((c) => {
            const senal = senalVencimiento(c.estado, c.dias_vencida);
            const abierta = c.estado !== "pagada" && c.estado !== "anulada";

            return (
              <tr key={c.id} className="group relative h-[52px] transition-colors hover:bg-muted/50">
                <td className="max-w-64 px-4 py-1.5">
                  <PanelCxp
                    cuenta={c}
                    puedeRegistrar={puedeRegistrar}
                    textoVencimiento={textoVencimiento(c)}
                    disparador={
                      <button
                        type="button"
                        aria-label={`${tl("vistaRapida")}: ${c.tercero}`}
                        className="block min-w-0 text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="block truncate font-semibold">{c.tercero}</span>
                        <span className="text-meta block truncate">{origen(c)}</span>
                      </button>
                    }
                  />
                </td>
                <td className="max-w-64 px-4 py-1.5">
                  <span className="block truncate">{c.concepto}</span>
                  {c.fecha_programada && (
                    <span className="text-meta block truncate">{t("programada", { fecha: c.fecha_programada })}</span>
                  )}
                </td>
                <td className="px-4 py-1.5 whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{c.fecha_vencimiento}</span>
                    {senal && <StatusBadge status={senal} />}
                  </span>
                  {abierta && <span className="text-meta block">{textoVencimiento(c)}</span>}
                </td>
                <td className="px-4 py-1.5 text-right whitespace-nowrap">
                  <Monto valor={c.saldo} moneda={c.moneda} className="block font-semibold" />
                  {Number(c.pagado) > 0 && (
                    <span className="text-meta block">
                      {t("pagado")}: <Monto valor={c.pagado} moneda={c.moneda} />
                    </span>
                  )}
                </td>
                <td className="px-4 py-1.5">
                  <StatusBadge status={c.estado} />
                </td>
                <td className="relative z-10 w-16 px-2 py-1.5 text-right">
                  <span className="inline-flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    <Button asChild variant="ghost" size="icon" aria-label={tl("verCuenta")}>
                      <Link href={`/contabilidad/cuentas-por-pagar/${c.id}`}><Eye /></Link>
                    </Button>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul className="divide-y divide-linea md:hidden">
        {cuentas.map((c) => {
          const senal = senalVencimiento(c.estado, c.dias_vencida);

          return (
            <li key={c.id}>
              <PanelCxp
                cuenta={c}
                puedeRegistrar={puedeRegistrar}
                textoVencimiento={textoVencimiento(c)}
                disparador={
                  <button type="button" className="flex w-full items-center gap-3 p-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="block truncate font-semibold">{c.tercero}</span>
                      <span className="text-meta block truncate">{c.concepto}</span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={c.estado} />
                        {senal && <StatusBadge status={senal} />}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <Monto valor={c.saldo} moneda={c.moneda} className="block font-semibold" />
                      <span className="text-meta block tabular-nums">{c.fecha_vencimiento}</span>
                    </span>
                  </button>
                }
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
