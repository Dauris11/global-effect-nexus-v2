import { BookOpen, Search, X } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Monto, SELECT } from "@/components/contabilidad/comun";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { numeroDocumento, TIPOS_MOVIMIENTO_BANCO, type Moneda } from "@/lib/contabilidad/formato";
import { fechaCorta } from "@/lib/fechas";
import { TARJETA } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import type { FiltroLibro, FilaLibro, Libro } from "@/server/contabilidad/bancos/consultas";

/**
 * Los movimientos de una cuenta (§4.2): filtros, totales del rango y saldo
 * corrido. Los anulados se ven tachados y sin saldo: siguen en el libro
 * porque pasaron, pero no mueven el dinero.
 */
export async function LibroBanco({
  cuentaId,
  moneda,
  filtro,
  libro,
  idioma,
}: {
  cuentaId: string;
  moneda: Moneda;
  filtro: FiltroLibro;
  libro: Libro;
  idioma: "es" | "en";
}) {
  const [t, tc] = await Promise.all([getTranslations("contab.libro"), getTranslations("contab")]);
  const hayFiltro = Boolean(filtro.desde || filtro.hasta || filtro.tipo);

  const descripcion = (fila: FilaLibro) =>
    [
      tc(`movimiento.${fila.tipo}`),
      fila.cheque_numero && t("cheque", { numero: fila.cheque_numero }),
      fila.beneficiario,
      fila.referencia,
    ]
      .filter(Boolean)
      .join(" · ");

  const enlace = (fila: FilaLibro) =>
    fila.origen_tabla === "recibo" && fila.origen_id ? `/contabilidad/recibos/${fila.origen_id}` : null;

  return (
    <>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="space-y-1.5">
          <span className="block text-sm font-medium">{t("desde")}</span>
          <Input type="date" name="desde" defaultValue={filtro.desde ?? ""} />
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-medium">{t("hasta")}</span>
          <Input type="date" name="hasta" defaultValue={filtro.hasta ?? ""} />
        </label>
        <label className="min-w-48 space-y-1.5">
          <span className="block text-sm font-medium">{t("tipo")}</span>
          <select name="tipo" defaultValue={filtro.tipo ?? ""} className={SELECT}>
            <option value="">{t("todos")}</option>
            {TIPOS_MOVIMIENTO_BANCO.map((v) => (
              <option key={v} value={v}>{tc(`movimiento.${v}`)}</option>
            ))}
          </select>
        </label>
        <Button type="submit">
          <Search className="size-4" />
          {t("filtrar")}
        </Button>
        {hayFiltro && (
          <Button asChild variant="ghost">
            <Link href={`/contabilidad/bancos/${cuentaId}`}>
              <X className="size-4" />
              {t("limpiar")}
            </Link>
          </Button>
        )}
      </form>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [t("saldoInicial"), libro.saldoInicial],
          [t("entradas"), libro.entradas],
          [t("salidas"), libro.salidas],
          [t("saldoFinal"), libro.saldoFinal],
        ].map(([etiqueta, valor]) => (
          <div key={etiqueta} className="rounded-card border border-linea bg-card p-4 shadow-card">
            <dt className="texto-meta">{etiqueta}</dt>
            <dd className="mt-1 text-lg font-semibold text-tinta">
              <Monto valor={valor} moneda={moneda} />
            </dd>
          </div>
        ))}
      </dl>

      {libro.filas.length === 0 ? (
        <EstadoVacio icono={BookOpen} titulo={t("vacio")} />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-card border border-linea bg-card shadow-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-linea text-tinta-3">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("fecha")}</th>
                  <th className="px-4 py-3 font-medium">{t("numero")}</th>
                  <th className="px-4 py-3 font-medium">{t("concepto")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("importe")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("saldo")}</th>
                </tr>
              </thead>
              <tbody>
                {libro.filas.map((fila) => {
                  const destino = enlace(fila);
                  return (
                    <tr key={fila.id} className={cn("border-b border-linea last:border-b-0", fila.estado === "anulado" && "text-tinta-3")}>
                      <td className="px-4 py-3 whitespace-nowrap">{fechaCorta(fila.fecha, idioma)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-tinta-2">{numeroDocumento("MB", fila.numero)}</td>
                      <td className="max-w-96 px-4 py-3">
                        <p className={cn("truncate", fila.estado === "anulado" && "line-through")}>
                          {destino ? (
                            <Link href={destino} className="text-marca-600 hover:underline">{fila.concepto}</Link>
                          ) : (
                            fila.concepto
                          )}
                        </p>
                        <p className="texto-meta truncate">{descripcion(fila)}</p>
                        <Marcas fila={fila} anulado={t("anulado")} />
                      </td>
                      <td className={cn("px-4 py-3 text-right font-medium", fila.estado === "anulado" && "line-through")}>
                        <Monto valor={fila.importe} moneda={moneda} conSigno={fila.estado === "vigente"} />
                      </td>
                      <td className="px-4 py-3 text-right text-tinta-2">
                        {fila.saldo ? <Monto valor={fila.saldo} moneda={moneda} /> : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {libro.filas.map((fila) => (
              <li key={fila.id} className={cn(TARJETA.contenido, "p-4", fila.estado === "anulado" && "text-tinta-3")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={cn("truncate font-medium", fila.estado === "anulado" && "line-through")}>{fila.concepto}</p>
                    <p className="texto-meta">{fechaCorta(fila.fecha, idioma)} · {descripcion(fila)}</p>
                  </div>
                  <Monto valor={fila.importe} moneda={moneda} conSigno={fila.estado === "vigente"} className="font-semibold" />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Marcas fila={fila} anulado={t("anulado")} />
                  {fila.saldo && (
                    <span className="texto-meta">
                      {t("saldo")}: <Monto valor={fila.saldo} moneda={moneda} />
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {libro.filas.length === 500 && <p className="texto-meta">{t("tope")}</p>}
        </>
      )}
    </>
  );
}

function Marcas({ fila, anulado }: { fila: FilaLibro; anulado: string }) {
  if (fila.estado !== "anulado") return null;
  return (
    <span className="mt-1 flex gap-1">
      <Badge variant="neutra">{anulado}</Badge>
    </span>
  );
}
