import { AlertCircle, Ban, Undo2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Monto } from "@/components/contabilidad/comun";
import { CeldaMonto } from "@/components/contabilidad/libros/comun-libros";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { fechaCorta } from "@/lib/fechas";
import { INSIGNIA_SEMAFORO, TARJETA } from "@/lib/paleta";
import type { AsientoDiario, TotalesLibro } from "@/server/contabilidad/libros/consultas";

/**
 * El diario: cada asiento con sus líneas y su total. En ≥ md una sola
 * tabla, con el asiento como cabecera de su grupo de filas; en < md una
 * tarjeta por asiento. El total general sale de la base (`TotalesLibro`).
 */
export async function LibroDiario({
  asientos,
  totales,
  idioma,
}: {
  asientos: AsientoDiario[];
  totales: TotalesLibro;
  idioma: "es" | "en";
}) {
  const t = await getTranslations("contab.libros");
  const num = "px-4 py-2 text-right tabular-nums whitespace-nowrap";

  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-linea bg-card shadow-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-linea text-tinta-3">
            <tr>
              <th className="px-4 py-3 font-medium">{t("col.cuenta")}</th>
              <th className="px-4 py-3 font-medium">{t("col.descripcion")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("col.debe")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("col.haber")}</th>
            </tr>
          </thead>
          {asientos.map((a) => (
            <tbody key={a.id} className="border-b border-linea">
              <tr className="bg-muted/40">
                <th colSpan={4} scope="rowgroup" className="px-4 py-2.5 text-left font-normal">
                  <Cabecera asiento={a} idioma={idioma} />
                </th>
              </tr>
              {a.lineas.map((l) => (
                <tr key={l.id}>
                  {/* Abono sangrado, como en el diario en papel: se lee el sentido sin mirar columnas. */}
                  <td className={`px-4 py-2 ${Number(l.haber) > 0 ? "pl-10" : ""}`}>
                    <span className="tabular-nums text-tinta-3">{l.codigo}</span>{" "}
                    <span className="text-tinta">{l.cuenta}</span>
                  </td>
                  <td className="px-4 py-2 text-tinta-2">{l.descripcion}</td>
                  <CeldaMonto valor={l.debe} className={num} />
                  <CeldaMonto valor={l.haber} className={num} />
                </tr>
              ))}
              <tr className="text-tinta-2">
                <td colSpan={2} className="px-4 py-2 text-right texto-meta">{t("totalAsiento")}</td>
                <td className={`${num} font-medium`}><Monto valor={a.totalDebe} moneda="DOP" /></td>
                <td className={`${num} font-medium`}><Monto valor={a.totalHaber} moneda="DOP" /></td>
              </tr>
            </tbody>
          ))}
          <tfoot>
            <tr className="border-t-2 border-tinta font-semibold text-tinta">
              <td colSpan={2} className="px-4 py-3 text-right">
                {t("totalGeneral", { n: totales.asientos })}
              </td>
              <td className={`${num} py-3`}><Monto valor={totales.debe} moneda="DOP" /></td>
              <td className={`${num} py-3`}><Monto valor={totales.haber} moneda="DOP" /></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {asientos.map((a) => (
          <li key={a.id} className={`${TARJETA.contenido} p-4`}>
            <Cabecera asiento={a} idioma={idioma} />
            <ul className="mt-3 divide-y divide-linea border-t border-linea">
              {a.lineas.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] text-tinta">{l.cuenta}</p>
                    <p className="texto-meta tabular-nums">{l.codigo}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="texto-meta">{Number(l.debe) > 0 ? t("col.debe") : t("col.haber")}</p>
                    <Monto valor={Number(l.debe) > 0 ? l.debe : l.haber} moneda="DOP" className="font-medium" />
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </>
  );
}

async function Cabecera({ asiento: a, idioma }: { asiento: AsientoDiario; idioma: "es" | "en" }) {
  const t = await getTranslations("contab.libros");
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Link
        href={`/contabilidad/asientos/${a.id}`}
        className="inline-flex min-h-11 items-center font-semibold text-marca-600 tabular-nums hover:underline md:min-h-0"
      >
        {t("numeroAsiento", { numero: a.numero })}
      </Link>
      <span className="texto-meta whitespace-nowrap">{fechaCorta(a.fecha, idioma)}</span>
      <span className="min-w-0 flex-1 text-tinta">{a.concepto}</span>
      {/* Estado de la entidad: SEMAFORO con icono para el anulado; el reverso
          es un asiento válido que cancela otro, así que va en neutro. */}
      {a.estado === "anulado" && (
        <Badge className={INSIGNIA_SEMAFORO.alerta}>
          <Ban />
          {t("estado.anulado")}
        </Badge>
      )}
      {a.estado === "reverso" && (
        <Badge variant="neutra">
          <Undo2 />
          {t("estado.reverso")}
        </Badge>
      )}
      {!a.cuadra && (
        <Badge variant="solida">
          <AlertCircle />
          {t("asientoDescuadrado")}
        </Badge>
      )}
    </div>
  );
}
