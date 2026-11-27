"use client";

import { Building2, Eye, User } from "lucide-react";
import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/app/status-badge";
import { Monto } from "@/components/contabilidad/comun";
import { PanelProveedor } from "@/components/contabilidad/proveedores/panel-proveedor";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatearIdentificacion } from "@/lib/contabilidad/identificacion";
import type { FilaProveedor } from "@/server/contabilidad/proveedores/consultas";

/**
 * Tabla densa de proveedores (docs/ux-rules.md §3): en ≥ md una fila de 52 px con el
 * nombre en negrita y lo demás en gris; en móvil, filas compactas. Un clic en la fila abre
 * el panel lateral; el ojo (al pasar el ratón o con el foco) va directo a la ficha.
 */
export function ListaProveedores({
  proveedores,
  puedeRegistrar,
}: {
  proveedores: FilaProveedor[];
  puedeRegistrar: boolean;
}) {
  const t = useTranslations("listas.proveedores");
  const tp = useTranslations("contab.proveedores");

  const saldosAbiertos = (p: FilaProveedor) => p.saldos.filter((s) => Number(s.saldo) > 0.005);
  const meta = (p: FilaProveedor) =>
    [p.nombre_comercial, formatearIdentificacion(p.identificacion)].filter(Boolean).join(" · ");

  return (
    <div className="overflow-hidden rounded-card border border-linea bg-card shadow-card">
      <table className="hidden w-full text-sm md:table">
        <thead className="border-b border-linea text-left texto-meta">
          <tr>
            <th className="px-4 py-3 font-medium">{t("col.proveedor")}</th>
            <th className="px-4 py-3 font-medium">{t("col.estado")}</th>
            <th className="px-4 py-3 font-medium">{t("col.credito")}</th>
            <th className="px-4 py-3 text-right font-medium">{t("col.facturas")}</th>
            <th className="px-4 py-3 text-right font-medium">{tp("debe")}</th>
            <th className="px-4 py-3">
              <span className="sr-only">{t("col.acciones")}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-linea">
          {proveedores.map((p) => {
            const Icono = p.tipo === "juridica" ? Building2 : User;
            const saldos = saldosAbiertos(p);

            return (
              <tr key={p.id} className="group relative h-[52px] transition-colors hover:bg-muted/50">
                <td className="max-w-80 px-4 py-1.5">
                  <PanelProveedor
                    proveedor={p}
                    puedeRegistrar={puedeRegistrar}
                    disparador={
                      <button
                        type="button"
                        aria-label={`${t("vistaRapida")}: ${p.nombre}`}
                        className="flex min-w-0 items-center gap-3 text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Icono aria-hidden className="size-4 shrink-0 text-tinta-3" />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{p.nombre}</span>
                          <span className="text-meta block truncate">{meta(p)}</span>
                        </span>
                      </button>
                    }
                  />
                </td>
                <td className="px-4 py-1.5">
                  <StatusBadge status={p.estado} />
                </td>
                <td className="text-meta px-4 py-1.5 whitespace-nowrap">{tp("condiciones", { dias: p.condiciones_pago_dias })}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{p.facturas}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {saldos.length === 0 ? (
                    <span className="text-meta">{tp("alDia")}</span>
                  ) : (
                    saldos.map((s) => <Monto key={s.moneda} valor={s.saldo} moneda={s.moneda} className="block font-semibold" />)
                  )}
                </td>
                {/* Por encima del botón que cubre la fila (z-10). */}
                <td className="relative z-10 w-16 px-2 py-1.5 text-right">
                  <span className="inline-flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    <Button asChild variant="ghost" size="icon" aria-label={t("verFicha")}>
                      <Link href={`/contabilidad/proveedores/${p.id}`}><Eye /></Link>
                    </Button>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul className="divide-y divide-linea md:hidden">
        {proveedores.map((p) => {
          const saldos = saldosAbiertos(p);

          return (
            <li key={p.id}>
              <PanelProveedor
                proveedor={p}
                puedeRegistrar={puedeRegistrar}
                disparador={
                  <button type="button" className="flex w-full items-center gap-3 p-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="block truncate font-semibold">{p.nombre}</span>
                      <span className="text-meta block truncate">{meta(p)}</span>
                      <StatusBadge status={p.estado} />
                    </span>
                    <span className="shrink-0 text-right text-sm tabular-nums">
                      {saldos.length === 0 ? (
                        <span className="text-meta">{tp("alDia")}</span>
                      ) : (
                        saldos.map((s) => <Monto key={s.moneda} valor={s.saldo} moneda={s.moneda} className="block font-semibold" />)
                      )}
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
