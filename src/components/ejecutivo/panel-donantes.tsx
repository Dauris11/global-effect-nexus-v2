import { HandCoins } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Link } from "@/i18n/navigation";
import { formatearMonto } from "@/lib/contabilidad/formato";
import type { CuotasDonantes } from "@/server/ejecutivo/consultas";

/**
 * Cumplimiento con donantes: lo comprometido frente a lo cobrado por moneda y
 * las cuotas que vencen pronto. Las monedas no se suman entre sí (no hay una
 * tasa que no sea inventar), por eso una fila por moneda.
 *
 * Sin promesas registradas es un vacío honesto, no un cero que parezca
 * cumplimiento total.
 */
export async function PanelDonantes({ cuotas }: { cuotas: readonly CuotasDonantes[] }) {
  const t = await getTranslations("executive.donors");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>
          <HandCoins className="size-4" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {cuotas.length === 0 ? (
          <EstadoVacio icono={HandCoins} titulo={t("emptyTitle")} />
        ) : (
          <ul className="divide-y divide-linea">
            {cuotas.map((c) => {
              const avance = c.comprometido > 0 ? Math.min(100, Math.round((c.cobrado / c.comprometido) * 100)) : 0;

              return (
                <li key={c.moneda} className="grid grid-cols-2 gap-x-4 gap-y-3 py-4 md:grid-cols-4">
                  <Dato etiqueta={t("committed")} valor={formatearMonto(c.comprometido, c.moneda)} />
                  <Dato etiqueta={t("collected")} valor={`${formatearMonto(c.cobrado, c.moneda)} · ${avance}%`} />
                  <Dato
                    etiqueta={t("dueSoon", { n: c.porVencer })}
                    valor={formatearMonto(c.montoPorVencer, c.moneda)}
                  />
                  <Dato etiqueta={t("overdue")} valor={String(c.vencidas)} />
                </li>
              );
            })}
          </ul>
        )}
        <Link href="/contabilidad/donaciones" className="mt-3 inline-block text-sm font-medium text-marca-600 hover:underline">
          {t("view")}
        </Link>
      </CardContent>
    </Card>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="min-w-0">
      <p className="texto-meta">{etiqueta}</p>
      <p className="text-base font-semibold text-tinta tabular-nums break-words">{valor}</p>
    </div>
  );
}
