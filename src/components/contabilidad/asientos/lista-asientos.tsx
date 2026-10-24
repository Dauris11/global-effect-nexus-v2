import { getTranslations } from "next-intl/server";

import { InsigniaEstadoAsiento } from "@/components/contabilidad/asientos/insignias";
import { Monto } from "@/components/contabilidad/comun";
import { Link } from "@/i18n/navigation";
import { claveDeOrigen, rutaDeOrigen } from "@/lib/contabilidad/asientos";
import { numeroDocumento } from "@/lib/contabilidad/formato";
import { fechaCorta } from "@/lib/fechas";
import { TARJETA } from "@/lib/paleta";
import type { FilaAsiento } from "@/server/contabilidad/asientos/consultas";

/**
 * El diario en tabla (≥ md) y en tarjetas (< md), con los mismos datos.
 * El total es el del debe: en un asiento cuadrado es también el del haber,
 * y dos columnas iguales solo ocuparían sitio.
 */
export async function ListaAsientos({
  filas,
  idioma,
}: {
  filas: FilaAsiento[];
  idioma: "es" | "en";
}) {
  const t = await getTranslations("contab.asientos");

  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-linea bg-card shadow-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-linea text-tinta-3">
            <tr>
              <th className="px-4 py-3 font-medium">{t("col.numero")}</th>
              <th className="px-4 py-3 font-medium">{t("col.fecha")}</th>
              <th className="px-4 py-3 font-medium">{t("col.concepto")}</th>
              <th className="px-4 py-3 font-medium">{t("col.origen")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("col.total")}</th>
              <th className="px-4 py-3 font-medium">{t("col.estado")}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.id} className="border-b border-linea last:border-b-0 hover:bg-muted/50">
                <td className="px-4 py-3 font-medium whitespace-nowrap tabular-nums">
                  <Link href={`/contabilidad/asientos/${fila.id}`} className="text-marca-600 hover:underline">
                    {numeroDocumento("AS", fila.numero)}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-tinta-2">{fechaCorta(fila.fecha, idioma)}</td>
                <td className="max-w-80 px-4 py-3">
                  <p className="truncate text-tinta">{fila.concepto}</p>
                  <p className="texto-meta">{t(`tipo.${fila.tipo}`)}</p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Origen fila={fila} etiqueta={etiquetaOrigen(fila, t)} />
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  <Monto valor={fila.total_debe} moneda="DOP" />
                </td>
                <td className="px-4 py-3">
                  <InsigniaEstadoAsiento estado={fila.estado} etiqueta={t(`estado.${fila.estado}`)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {filas.map((fila) => (
          <li key={fila.id}>
            <Link href={`/contabilidad/asientos/${fila.id}`} className={`${TARJETA.interactiva} block p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-tinta tabular-nums">{numeroDocumento("AS", fila.numero)}</p>
                  <p className="truncate text-[15px] text-tinta-2">{fila.concepto}</p>
                  <p className="texto-meta">
                    {fechaCorta(fila.fecha, idioma)} · {t(`tipo.${fila.tipo}`)}
                    {etiquetaOrigen(fila, t) && ` · ${etiquetaOrigen(fila, t)}`}
                  </p>
                </div>
                <Monto valor={fila.total_debe} moneda="DOP" className="font-semibold" />
              </div>
              <div className="mt-3">
                <InsigniaEstadoAsiento estado={fila.estado} etiqueta={t(`estado.${fila.estado}`)} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function etiquetaOrigen(fila: FilaAsiento, t: (clave: string) => string): string | null {
  const clave = claveDeOrigen(fila.origen_tabla);
  return clave ? t(`origen.${clave}`) : null;
}

/** El origen enlaza a su documento cuando tiene pantalla propia. */
function Origen({ fila, etiqueta }: { fila: FilaAsiento; etiqueta: string | null }) {
  if (!etiqueta) return <span className="text-tinta-3">—</span>;
  const ruta = rutaDeOrigen(fila.origen_tabla, fila.origen_id);
  return ruta ? (
    <Link href={ruta} className="text-marca-600 hover:underline">
      {etiqueta}
    </Link>
  ) : (
    <span className="text-tinta-2">{etiqueta}</span>
  );
}
