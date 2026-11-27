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
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-meta">{t("col.concepto")}</dt>
            <dd>{c.concepto}</dd>
            <dt className="text-meta">{tl("panel.origen")}</dt>
            <dd>{c.origen === "factura" ? t("origenFactura") : t("origenSolicitud", { folio: c.solicitud_folio ?? "" })}</dd>
            {c.proyecto && (
              <>
                <dt className="text-meta">{t("proyecto")}</dt>
                <dd>{c.proyecto}</dd>
              </>
            )}
            <dt className="text-meta">{tl("panel.emision")}</dt>
            <dd className="tabular-nums">{c.fecha_emision}</dd>
            <dt className="text-meta">{t("col.vencimiento")}</dt>
            <dd>
              <span className="tabular-nums">{c.fecha_vencimiento}</span>
              {abierta && <span className="text-meta block">{textoVencimiento}</span>}
            </dd>
            {c.fecha_programada && (
              <>
                <dt className="text-meta">{tl("panel.pagoPrevisto")}</dt>
                <dd>
                  <span className="tabular-nums">{c.fecha_programada}</span>
                  {c.cuenta_salida && <span className="text-meta block">{c.cuenta_salida}</span>}
                </dd>
              </>
            )}
            <dt className="text-meta">{t("monto")}</dt>
            <dd><Monto valor={c.monto} moneda={c.moneda} /></dd>
            <dt className="text-meta">{t("pagado")}</dt>
            <dd><Monto valor={c.pagado} moneda={c.moneda} /></dd>
            <dt className="text-meta">{t("saldo")}</dt>
            <dd><Monto valor={c.saldo} moneda={c.moneda} className="font-semibold" /></dd>
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
