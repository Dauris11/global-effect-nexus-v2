import { Calculator, ReceiptText, User } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { UMBRAL_CAJA_BAJA } from "@/lib/contabilidad/cajas";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { TARJETA } from "@/lib/paleta";
import type { CajaResumen } from "@/server/contabilidad/cajas/consultas";

/**
 * Una caja chica en una tarjeta: efectivo frente al fondo fijo y los dos
 * caminos de trabajo (ver movimientos, contar). La comparten el inicio de
 * Contabilidad y la lista de cajas para que la misma caja se lea igual en los
 * dos sitios.
 *
 * Bajo el umbral la barra pasa a tinta y no a rojo: la marca no tiene rojo y
 * el número de al lado ya dice cuánto queda.
 */
export function TarjetaCaja({ caja }: { caja: CajaResumen }) {
  const t = useTranslations("contab.cajas");
  const fondo = Number(caja.fondoFijo) || 1;
  const proporcion = Number(caja.saldoActual) / fondo;
  const pct = Math.max(0, Math.min(100, Math.round(proporcion * 100)));
  const baja = proporcion < UMBRAL_CAJA_BAJA;

  return (
    <div className={`${TARJETA.contenido} flex flex-col justify-between gap-4 p-5`}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="rounded-full bg-marca-50 px-2 py-0.5 font-mono text-xs font-semibold text-marca-700">
              {caja.codigo}
            </span>
            <h3 className="texto-titulo-tarjeta mt-1.5 truncate">{caja.nombre}</h3>
            <p className="texto-meta flex items-center gap-1 truncate">
              <User className="size-3.5 shrink-0" />
              {caja.responsableNombre}
            </p>
          </div>
          {caja.arqueosPorAprobar > 0 ? (
            <Badge variant="neutra">{t("pendienteAprobacion")}</Badge>
          ) : (
            caja.estado === "inactiva" && <Badge variant="neutra">{t("inactiva")}</Badge>
          )}
        </div>

        <div>
          <p className="texto-meta">{t("efectivo")}</p>
          <p className="text-2xl font-semibold text-tinta">
            {formatearMonto(caja.saldoActual, caja.moneda)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-tinta-2">
            <span>
              {t("fondoFijo")} {formatearMonto(caja.fondoFijo, caja.moneda)}
            </span>
            <span className={baja ? "font-semibold text-tinta" : undefined}>{pct}%</span>
          </div>
          <div
            className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-linea"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("efectivo")}
          >
            <div
              className={`h-full rounded-full ${baja ? "bg-tinta" : "bg-marca-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {Number(caja.pendienteReposicion) > 0 && (
            <p className="texto-meta mt-2">
              {t("porReponer")}: {formatearMonto(caja.pendienteReposicion, caja.moneda)}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-t border-linea pt-3">
        <Button asChild variant="outline" size="sm" className="flex-1">
          <Link href={`/contabilidad/cajas/${caja.id}`}>
            <ReceiptText className="size-4" />
            {t("movimientos")}
          </Link>
        </Button>
        <Button asChild size="sm" className="flex-1">
          <Link href={`/contabilidad/cajas/${caja.id}/arqueo`}>
            <Calculator className="size-4" />
            {t("cuadreArqueo")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
