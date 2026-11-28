"use client";

import { Building2, Eye, FilePlus2, User } from "lucide-react";
import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/app/status-badge";
import { Monto } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { formatearIdentificacion } from "@/lib/contabilidad/identificacion";
import type { FilaProveedor } from "@/server/contabilidad/proveedores/consultas";

/**
 * Vista rápida de un proveedor sin salir de la lista. Usa lo que la fila ya trae (nada de
 * una segunda consulta al abrir): contactos, cuentas bancarias y estado de cuenta viven en
 * la ficha completa, a un clic.
 */
export function PanelProveedor({
  proveedor: p,
  puedeRegistrar,
  disparador,
}: {
  proveedor: FilaProveedor;
  puedeRegistrar: boolean;
  /** El botón que abre el panel; llega ya armado porque cambia entre la tabla y la lista móvil. */
  disparador: React.ReactElement;
}) {
  const t = useTranslations("listas.proveedores");
  const tp = useTranslations("contab.proveedores");
  const tc = useTranslations("contab");
  const saldos = p.saldos.filter((s) => Number(s.saldo) > 0.005);
  const Icono = p.tipo === "juridica" ? Building2 : User;

  return (
    <Sheet>
      <SheetTrigger asChild>{disparador}</SheetTrigger>
      <SheetContent>
        <header className="space-y-2 border-b border-linea px-6 pt-6 pr-16 pb-4">
          <SheetTitle className="text-section flex items-center gap-2">
            <Icono aria-hidden className="size-5 shrink-0 text-tinta-3" />
            {p.nombre}
          </SheetTitle>
          <SheetDescription className="sr-only">{t("vistaRapida")}</SheetDescription>
          <StatusBadge status={p.estado} />
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            {p.nombre_comercial && (
              <>
                <dt className="text-meta">{t("panel.comercial")}</dt>
                <dd className="font-medium">{p.nombre_comercial}</dd>
              </>
            )}
            <dt className="text-meta">{t("panel.identificacion")}</dt>
            <dd className="font-mono">{formatearIdentificacion(p.identificacion)}</dd>
            <dt className="text-meta">{t("panel.tipo")}</dt>
            <dd>{tc(`tipoProveedor.${p.tipo}` as never)}</dd>
            <dt className="text-meta">{tc("proveedorForm.proposito")}</dt>
            <dd>{tc(`propositoProveedor.${p.proposito}` as never)}</dd>
            <dt className="text-meta">{t("panel.credito")}</dt>
            <dd>{tp("condiciones", { dias: p.condiciones_pago_dias })}</dd>
            <dt className="text-meta">{t("panel.facturas")}</dt>
            <dd>{tp("facturas", { n: p.facturas })}</dd>
            <dt className="text-meta">{tp("debe")}</dt>
            <dd className="space-y-0.5">
              {saldos.length === 0 ? (
                <span>{tp("alDia")}</span>
              ) : (
                saldos.map((s) => <Monto key={s.moneda} valor={s.saldo} moneda={s.moneda} className="block font-semibold" />)
              )}
            </dd>
          </dl>
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-linea px-6 py-4">
          <Button asChild>
            <Link href={`/contabilidad/proveedores/${p.id}`}>
              <Eye />
              {t("verDetalle")}
            </Link>
          </Button>
          {puedeRegistrar && (
            <Button asChild variant="outline">
              <Link href={`/contabilidad/facturas/nueva?proveedor=${p.id}`}>
                <FilePlus2 />
                {t("registrarFactura")}
              </Link>
            </Button>
          )}
        </footer>
      </SheetContent>
    </Sheet>
  );
}
