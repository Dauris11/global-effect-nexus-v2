"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Monto } from "@/components/contabilidad/comun";
import { lineasParaPanel } from "@/server/contabilidad/asientos/acciones";
import type { LineaAsiento } from "@/server/contabilidad/asientos/consultas";

/**
 * Líneas de un asiento dentro del panel lateral. Se montan solo cuando el
 * panel se abre (el contenido de un Sheet cerrado no existe), y ahí piden las
 * líneas: la lista no carga las de los 200 asientos.
 */
export function LineasPanel({ id }: { id: string }) {
  const t = useTranslations("contab.asientos.detalle");
  const tl = useTranslations("listas.asientos");
  const [lineas, setLineas] = useState<LineaAsiento[] | null>(null);
  const [falla, setFalla] = useState(false);

  useEffect(() => {
    let vigente = true;

    lineasParaPanel(id)
      .then((r) => vigente && setLineas(r))
      .catch(() => vigente && setFalla(true));

    return () => {
      vigente = false;
    };
  }, [id]);

  if (falla) return <p className="text-meta">{tl("lineasError")}</p>;
  if (!lineas) {
    return (
      <p role="status" className="text-meta flex items-center gap-2">
        <Loader2 aria-hidden className="size-4 animate-spin" />
        {tl("lineasCargando")}
      </p>
    );
  }

  const esCero = (valor: string) => /^0+(\.0+)?$/.test(valor);

  return (
    <section aria-label={t("lineas")}>
      <h3 className="text-label mb-2">{t("lineas")}</h3>
      <div className="overflow-x-auto rounded-card border border-linea">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-linea text-meta">
            <tr>
              <th className="px-3 py-2 font-medium">{t("col.cuenta")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("col.debe")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("col.haber")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {lineas.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2">
                  <span className="tabular-nums text-tinta-2">{l.codigo}</span> {l.cuenta}
                  {l.descripcion && <span className="text-meta block">{l.descripcion}</span>}
                </td>
                <td className="px-3 py-2 text-right">{!esCero(l.debe) && <Monto valor={l.debe} moneda="DOP" />}</td>
                <td className="px-3 py-2 text-right">{!esCero(l.haber) && <Monto valor={l.haber} moneda="DOP" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
