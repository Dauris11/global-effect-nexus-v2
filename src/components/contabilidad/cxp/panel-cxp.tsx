"use client";

import { Eye, HandCoins } from "lucide-react";
import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/app/status-badge";
import { Monto } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { senalVencimiento } from "@/lib/contabilidad/cxp";
import type { FilaCxp } from "@/server/contabilidad/cxp/consultas";

/**
 * Vista rápida de una cuenta por pagar. Pagar y programar piden cuentas, categorías y
 * tasa, así que viven en la ficha: el panel resume y lleva allí, sin duplicar el formulario.
 */
export function PanelCxp({
  cuenta: c,
  puedeRegistrar,
  disparador,
  textoVencimiento,
}: {
  cuenta: FilaCxp;
  puedeRegistrar: boolean;
  disparador: React.ReactElement;
  /** Frase ya armada («Vencida hace 3 días»); la calcula la lista para no repetir la lógica. */
  textoVencimiento: string;
}) {
  const t = useTranslations("contab.cxp");
  const tl = useTranslations("listas.cxp");
  const senal = senalVencimiento(c.estado, c.dias_vencida);
  const abierta = c.estado !== "pagada" && c.estado !== "anulada";

  return (
    <Sheet>
      <SheetTrigger asChild>{disparador}</SheetTrigger>
      <SheetContent>
        <header className="space-y-2 border-b border-linea px-6 pt-6 pr-16 pb-4">
          <SheetTitle className="text-section">{c.tercero}</SheetTitle>
          <SheetDescription className="sr-only">{tl("vistaRapida")}</SheetDescription>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={c.estado} />
            {senal && <StatusBadge status={senal} />}
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <dl className="divide-y divide-linea text-sm">
            <div className="grid grid-cols-[120px_1fr] items-baseline gap-4 py-2.5 first:pt-0">
              <dt className="text-meta">{t("col.concepto")}</dt>
              <dd className="min-w-0 break-words font-medium text-tinta">{c.concepto}</dd>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-baseline gap-4 py-2.5">
              <dt className="text-meta">{tl("panel.origen")}</dt>
              <dd className="min-w-0 font-medium text-tinta">
                {c.origen === "factura" ? t("origenFactura") : t("origenSolicitud", { folio: c.solicitud_folio ?? "" })}
              </dd>
            </div>
            {c.proyecto && (
              <div className="grid grid-cols-[120px_1fr] items-baseline gap-4 py-2.5">
                <dt className="text-meta">{t("proyecto")}</dt>
                <dd className="min-w-0 font-medium text-tinta">{c.proyecto}</dd>
              </div>
            )}
            <div className="grid grid-cols-[120px_1fr] items-baseline gap-4 py-2.5">
              <dt className="text-meta">{tl("panel.emision")}</dt>
              <dd className="font-mono tabular-nums text-tinta">{c.fecha_emision}</dd>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-baseline gap-4 py-2.5">
              <dt className="text-meta">{t("col.vencimiento")}</dt>
              <dd className="min-w-0">
                <span className="font-mono tabular-nums text-tinta">{c.fecha_vencimiento}</span>
                {abierta && <span className="text-meta block">{textoVencimiento}</span>}
              </dd>
            </div>
            {c.fecha_programada && (
              <div className="grid grid-cols-[120px_1fr] items-baseline gap-4 py-2.5">
                <dt className="text-meta">{tl("panel.pagoPrevisto")}</dt>
                <dd className="min-w-0">
                  <span className="font-mono tabular-nums text-tinta">{c.fecha_programada}</span>
                  {c.cuenta_salida && <span className="text-meta block">{c.cuenta_salida}</span>}
                </dd>
              </div>
            )}
            <div className="grid grid-cols-[120px_1fr] items-baseline gap-4 py-2.5">
              <dt className="text-meta">{t("monto")}</dt>
              <dd className="tabular-nums text-tinta"><Monto valor={c.monto} moneda={c.moneda} /></dd>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-baseline gap-4 py-2.5">
              <dt className="text-meta">{t("pagado")}</dt>
              <dd className="tabular-nums text-tinta"><Monto valor={c.pagado} moneda={c.moneda} /></dd>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-baseline gap-4 py-2.5 last:pb-0">
              <dt className="text-meta">{t("saldo")}</dt>
              <dd className="tabular-nums text-tinta"><Monto valor={c.saldo} moneda={c.moneda} className="font-semibold" /></dd>
            </div>
          </dl>
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-linea px-6 py-4">
          <Button asChild variant={puedeRegistrar && abierta ? "outline" : "default"}>
            <Link href={`/contabilidad/cuentas-por-pagar/${c.id}`}>
              <Eye />
              {tl("verDetalle")}
            </Link>
          </Button>
          {puedeRegistrar && abierta && (
            <Button asChild>
              <Link href={`/contabilidad/cuentas-por-pagar/${c.id}`}>
                <HandCoins />
                {t("pagar")}
              </Link>
            </Button>
          )}
        </footer>
      </SheetContent>
    </Sheet>
  );
}
