"use client";

import { Info } from "lucide-react";
import { useTranslations } from "next-intl";

import { BotonAsiento } from "@/components/contabilidad/asiento/boton-asiento";
import { previsualizarAsientoNominaAccion } from "@/server/contabilidad/nomina/acciones";

/**
 * Opción «Asiento» de la nómina: ejemplo canónico del contrato común
 * (docs/referencia/codigos-de-transaccion.md, «La opción Asiento en cada
 * proceso»). Antes pagar mostraba la tabla en línea; ahora es el mismo botón
 * que usa cualquier otro módulo, y se calcula con el banco elegido en ese
 * momento.
 */
export function AsientoPrevio({
  nominaId,
  cuentaBancoId,
}: {
  nominaId: string;
  cuentaBancoId: string | null;
}) {
  const t = useTranslations("contab.nomina");
  return (
    <section className="flex flex-wrap items-center justify-between gap-3" aria-labelledby="asiento-previo">
      <div className="space-y-1">
        <h3 id="asiento-previo" className="texto-titulo-tarjeta">{t("asientoTitulo")}</h3>
        {!cuentaBancoId && (
          <p className="texto-meta inline-flex items-center gap-1.5">
            <Info className="size-4" />
            {t("asientoBancoPendiente")}
          </p>
        )}
      </div>
      <BotonAsiento cargar={() => previsualizarAsientoNominaAccion(nominaId, cuentaBancoId)} />
    </section>
  );
}
