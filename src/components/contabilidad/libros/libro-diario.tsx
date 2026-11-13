import { AlertCircle, Ban, Undo2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Monto } from "@/components/contabilidad/comun";
import { CeldaMonto } from "@/components/contabilidad/libros/comun-libros";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { fechaCorta } from "@/lib/fechas";
import { INSIGNIA_SEMAFORO, TARJETA } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import type { AsientoDiario, LineaDiario, TotalesLibro } from "@/server/contabilidad/libros/consultas";

/**
 * El diario como lo lleva el departamento en papel (Observaciones #1): en
 * cada asiento, la CUENTA MAYOR con su monto en débito o crédito y, debajo,
 * sus cuentas auxiliares con su monto en la columna "Auxiliar". Primero los
 * cargos y después los abonos, sangrados.
 *
 * En ≥ md una sola tabla, con el asiento como cabecera de su grupo de
 * filas; en < md una tarjeta por asiento. Los totales salen de la base.
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
              <th className="px-4 py-3 text-right font-medium">{t("col.auxiliar")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("col.debe")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("col.haber")}</th>
            </tr>
          </thead>
          {asientos.map((a) => (
            <tbody key={a.id} className="border-b border-linea">
              <tr className="bg-muted/40">
                <th colSpan={5} scope="rowgroup" className="px-4 py-2.5 text-left font-normal">
                  <Cabecera asiento={a} idioma={idioma} />
                </th>
              </tr>
              {bloquesDe(a.lineas).map((bloque) => {
                const abono = Number(bloque.mayor.haber) > 0;
                // Abono sangrado, como en el diario en papel: se lee el sentido sin mirar columnas.
                const sangria = abono ? "pl-10" : "";
                return [
                  <tr key={`${bloque.mayor.id}-m`} className="font-medium text-tinta">
                    <td className={cn("px-4 py-2", sangria)}>
                      <span className="tabular-nums text-tinta-3">{bloque.mayor.mayorCodigo}</span>{" "}
                      {bloque.mayor.mayorNombre}
                    </td>
                    <td className="px-4 py-2 text-tinta-2">{bloque.directa ? bloque.mayor.descripcion : null}</td>
                    <td className={num} />
                    {abono ? <td className={num} /> : <CeldaMonto valor={bloque.mayor.totalMayor} className={num} />}
                    {abono ? <CeldaMonto valor={bloque.mayor.totalMayor} className={num} /> : <td className={num} />}
                  </tr>,
                  ...(bloque.directa
                    ? []
                    : bloque.lineas.map((l) => (
                        <tr key={l.id}>
                          <td className={cn("py-2 pr-4", abono ? "pl-16" : "pl-10")}>
                            <span className="tabular-nums text-tinta-3">{l.codigo}</span>{" "}
                            <span className="text-tinta">{l.cuenta}</span>
                          </td>
                          <td className="px-4 py-2 text-tinta-2">{l.descripcion}</td>
                          <CeldaMonto valor={abono ? l.haber : l.debe} className={cn(num, "text-tinta-2")} />
                          <td className={num} />
                          <td className={num} />
                        </tr>
                      ))),
                ];
              })}
              <tr className="text-tinta-2">
                <td colSpan={3} className="px-4 py-2 text-right texto-meta">{t("totalAsiento")}</td>
                <td className={`${num} font-medium`}><Monto valor={a.totalDebe} moneda="DOP" /></td>
                <td className={`${num} font-medium`}><Monto valor={a.totalHaber} moneda="DOP" /></td>
              </tr>
            </tbody>
          ))}
          <tfoot>
            <tr className="border-t-2 border-tinta font-semibold text-tinta">
              <td colSpan={3} className="px-4 py-3 text-right">
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
              {bloquesDe(a.lineas).map((bloque) => {
                const abono = Number(bloque.mayor.haber) > 0;
                return (
                  <li key={bloque.mayor.id} className="py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-medium text-tinta">{bloque.mayor.mayorNombre}</p>
                        <p className="texto-meta tabular-nums">{bloque.mayor.mayorCodigo}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="texto-meta">{abono ? t("col.haber") : t("col.debe")}</p>
                        <Monto valor={bloque.mayor.totalMayor} moneda="DOP" className="font-medium" />
                      </div>
                    </div>
                    {!bloque.directa && (
                      <ul className="mt-1.5 space-y-1 border-l border-linea pl-3">
                        {bloque.lineas.map((l) => (
                          <li key={l.id} className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate text-tinta-2">
                              <span className="tabular-nums text-tinta-3">{l.codigo}</span> {l.cuenta}
                            </span>
                            <Monto valor={abono ? l.haber : l.debe} moneda="DOP" className="shrink-0 text-tinta-2" />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </>
  );
}

type Bloque = {
  /** La primera línea del bloque: trae el código, nombre y total de la mayor. */
  mayor: LineaDiario;
  lineas: LineaDiario[];
  /** La cuenta no tiene madre: va sola, sin fila de auxiliar debajo. */
  directa: boolean;
};

/**
 * Agrupa las líneas (que la base ya ordenó por lado y por mayor) en un
 * bloque por mayor y lado. Solo agrupa: los montos de cada bloque vienen
 * sumados de la base (`totalMayor`).
 */
function bloquesDe(lineas: LineaDiario[]): Bloque[] {
  const bloques: Bloque[] = [];
  for (const linea of lineas) {
    const lado = Number(linea.debe) > 0;
    const actual = bloques.at(-1);
    if (actual && actual.mayor.mayorCodigo === linea.mayorCodigo && Number(actual.mayor.debe) > 0 === lado) {
      actual.lineas.push(linea);
    } else {
      bloques.push({ mayor: linea, lineas: [linea], directa: linea.codigo === linea.mayorCodigo });
    }
  }
  return bloques;
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
