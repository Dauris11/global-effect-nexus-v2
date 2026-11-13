import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Monto } from "@/components/contabilidad/comun";
import type { FilaMayor } from "@/server/contabilidad/libros/consultas";

/**
 * El mayor general (Observaciones #1): solo cuentas mayores con su débito,
 * crédito y saldo; cada una se despliega para ver sus auxiliares con lo
 * mismo. Sin movimientos ni tarjetas de totales.
 *
 * `<details>` y no un acordeón de cliente: se pliega sin JavaScript, el
 * teclado y el lector de pantalla ya lo entienden, y la página sigue siendo
 * de servidor. La misma rejilla sirve en móvil: en < sm las tres cifras
 * bajan debajo del nombre.
 */
export async function LibroMayor({ mayores }: { mayores: FilaMayor[] }) {
  const t = await getTranslations("contab.libros");
  const cifras = "grid grid-cols-3 gap-3 text-right tabular-nums sm:contents";

  return (
    <div className="overflow-hidden rounded-card border border-linea bg-card shadow-card">
      <div className="hidden grid-cols-[minmax(0,1fr)_9rem_9rem_9rem] gap-3 border-b border-linea px-4 py-3 text-sm font-medium text-tinta-3 sm:grid">
        <span>{t("col.cuenta")}</span>
        <span className="text-right">{t("col.debe")}</span>
        <span className="text-right">{t("col.haber")}</span>
        <span className="text-right">{t("col.saldo")}</span>
      </div>
      <ul className="divide-y divide-linea">
        {mayores.map((m) => (
          <li key={m.id}>
            <details className="group">
              <summary className="grid min-h-11 cursor-pointer list-none gap-2 px-4 py-3 text-sm font-semibold text-tinta hover:bg-muted/50 sm:grid-cols-[minmax(0,1fr)_9rem_9rem_9rem] sm:items-center sm:gap-3 [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 items-center gap-2">
                  <ChevronRight className="size-4 shrink-0 text-tinta-3 transition-transform group-open:rotate-90" />
                  <span className="tabular-nums text-tinta-3">{m.codigo}</span>
                  <span className="truncate">{m.nombre}</span>
                </span>
                <span className={cifras}>
                  <Celda valor={m.debe} etiqueta={t("col.debe")} />
                  <Celda valor={m.haber} etiqueta={t("col.haber")} />
                  <Celda valor={m.saldo} etiqueta={t("col.saldo")} />
                </span>
              </summary>
              <ul className="border-t border-linea bg-muted/30">
                {m.auxiliares.map((a) => (
                  <li
                    key={a.id}
                    className="grid gap-2 py-2.5 pr-4 pl-12 text-sm text-tinta-2 sm:grid-cols-[minmax(0,1fr)_9rem_9rem_9rem] sm:items-center sm:gap-3"
                  >
                    <span className="min-w-0 truncate">
                      <span className="tabular-nums text-tinta-3">{a.codigo}</span> {a.nombre}
                    </span>
                    <span className={cifras}>
                      <Celda valor={a.debe} etiqueta={t("col.debe")} />
                      <Celda valor={a.haber} etiqueta={t("col.haber")} />
                      <Celda valor={a.saldo} etiqueta={t("col.saldo")} />
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** La etiqueta solo se ve en móvil, donde no hay fila de encabezado. */
function Celda({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <span className="block">
      <span className="texto-meta block font-normal sm:hidden">{etiqueta}</span>
      {/^-?0+(\.0+)?$/.test(valor) ? <span className="text-tinta-3">—</span> : <Monto valor={valor} moneda="DOP" />}
    </span>
  );
}
