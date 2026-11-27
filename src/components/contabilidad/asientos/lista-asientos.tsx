import { Eye } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { StatusBadge } from "@/components/app/status-badge";
import { DialogoRevertir, BotonProcesar } from "@/components/contabilidad/asientos/acciones";
import { LineasPanel } from "@/components/contabilidad/asientos/lineas-panel";
import { Monto } from "@/components/contabilidad/comun";
import { DatoPanel, PanelFila } from "@/components/contabilidad/panel-fila";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { claveDeOrigen, esRevertible, rutaDeOrigen } from "@/lib/contabilidad/asientos";
import { numeroDocumento } from "@/lib/contabilidad/formato";
import { fechaCorta } from "@/lib/fechas";
import type { FilaAsiento } from "@/server/contabilidad/asientos/consultas";

/**
 * El diario como tabla densa (≥ md, 52 px por fila) y como filas compactas
 * (< md). Clic en la fila abre el panel lateral con las líneas; ver y revertir
 * salen al pasar el ratón o con el foco. El total es el del debe: en un
 * asiento cuadrado es también el del haber.
 *
 * Los permisos llegan resueltos de la página; esconder el botón es comodidad,
 * cada server action vuelve a comprobarlos.
 */
export async function ListaAsientos({
  filas,
  idioma,
  elegible = false,
  puedeProcesar,
  puedeRevertir,
}: {
  filas: FilaAsiento[];
  idioma: "es" | "en";
  /** Casilla para procesar en los sin procesar (va dentro de `FormularioProcesar`). */
  elegible?: boolean;
  puedeProcesar: boolean;
  puedeRevertir: boolean;
}) {
  const t = await getTranslations("contab.asientos");
  const tl = await getTranslations("listas.asientos");
  const numero = (fila: FilaAsiento) => numeroDocumento("AS", fila.numero);

  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-linea bg-card shadow-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-linea text-meta">
            <tr>
              {elegible && <th className="w-12 px-4 py-3" />}
              <th className="px-4 py-3 font-medium">{t("col.numero")}</th>
              <th className="px-4 py-3 font-medium">{t("col.concepto")}</th>
              <th className="px-4 py-3 font-medium">{t("col.origen")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("col.total")}</th>
              <th className="px-4 py-3 font-medium">{t("col.estado")}</th>
              <th className="px-2 py-3">
                <span className="sr-only">{tl("acciones")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {filas.map((fila) => {
              const pendiente = !fila.procesado && fila.estado !== "anulado";
              const origen = etiquetaOrigen(fila, t);
              const ruta = rutaDeOrigen(fila.origen_tabla, fila.origen_id);
              const revertible = puedeRevertir && esRevertible(fila.tipo, fila.origen_tabla, fila.estado);

              return (
                <tr key={fila.id} className="group relative h-[52px] transition-colors hover:bg-muted/50">
                  {elegible && (
                    <td className="relative z-10 px-4 py-1">
                      {pendiente && (
                        // La celda entera es el objetivo táctil, no el cuadrito.
                        <label className="flex size-11 cursor-pointer items-center justify-center">
                          <input
                            type="checkbox"
                            name="ids"
                            value={fila.id}
                            aria-label={t("procesar.elegir", { numero: numero(fila) })}
                            className="size-5 accent-marca-500"
                          />
                        </label>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-1.5 whitespace-nowrap">
                    <PanelFila
                      disparador={
                        <span className="block">
                          <span className="block font-mono font-semibold tabular-nums">{numero(fila)}</span>
                          <span className="text-meta block">{fechaCorta(fila.fecha, idioma)}</span>
                        </span>
                      }
                      etiquetaAbrir={tl("abrir", { numero: numero(fila) })}
                      titulo={numero(fila)}
                      descripcion={fila.concepto}
                      estado={<EstadoAsiento fila={fila} t={t} />}
                      pie={
                        <>
                          {pendiente && puedeProcesar && <BotonProcesar id={fila.id} />}
                          {revertible && (
                            <DialogoRevertir id={fila.id} numero={numero(fila)} periodoCerrado={fila.periodo_cerrado} />
                          )}
                          <Button asChild variant="outline">
                            <Link href={`/contabilidad/asientos/${fila.id}`}>
                              <Eye className="size-4" />
                              {tl("verDetalle")}
                            </Link>
                          </Button>
                        </>
                      }
                    >
                      <dl className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <DatoPanel etiqueta={t("col.concepto")} ancho>{fila.concepto}</DatoPanel>
                        <DatoPanel etiqueta={t("detalle.fecha")}>{fechaCorta(fila.fecha, idioma)}</DatoPanel>
                        <DatoPanel etiqueta={t("detalle.tipo")}>{t(`tipo.${fila.tipo}`)}</DatoPanel>
                        <DatoPanel etiqueta={t("detalle.origen")}>
                          {origen ? (
                            ruta ? (
                              <Link href={ruta} className="text-marca-600 hover:underline">{origen}</Link>
                            ) : (
                              origen
                            )
                          ) : (
                            "—"
                          )}
                        </DatoPanel>
                        <DatoPanel etiqueta={t("col.total")}>
                          <Monto valor={fila.total_debe} moneda="DOP" className="font-semibold" />
                        </DatoPanel>
                      </dl>
                      <LineasPanel id={fila.id} />
                    </PanelFila>
                  </td>
                  <td className="max-w-80 px-4 py-1.5">
                    <p className="truncate">{fila.concepto}</p>
                    <p className="text-meta truncate">{t(`tipo.${fila.tipo}`)}</p>
                  </td>
                  <td className="px-4 py-1.5 whitespace-nowrap">
                    {origen ? <span className="text-tinta-2">{origen}</span> : <span className="text-meta">—</span>}
                  </td>
                  <td className="px-4 py-1.5 text-right font-medium tabular-nums">
                    <Monto valor={fila.total_debe} moneda="DOP" />
                  </td>
                  <td className="px-4 py-1.5">
                    <EstadoAsiento fila={fila} t={t} />
                  </td>
                  {/* Acciones al pasar el ratón o con el foco, por encima del botón que cubre la fila. */}
                  <td className="relative z-10 w-24 px-2 py-1.5 text-right">
                    <span className="inline-flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                      <Button asChild variant="ghost" size="icon" aria-label={`${tl("verDetalle")} ${numero(fila)}`}>
                        <Link href={`/contabilidad/asientos/${fila.id}`}><Eye /></Link>
                      </Button>
                      {revertible && (
                        <DialogoRevertir id={fila.id} numero={numero(fila)} periodoCerrado={fila.periodo_cerrado} compacto />
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-linea overflow-hidden rounded-card border border-linea bg-card shadow-card md:hidden">
        {filas.map((fila) => (
          <li key={fila.id}>
            <Link
              href={`/contabilidad/asientos/${fila.id}`}
              className="flex items-start justify-between gap-3 p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0 space-y-1">
                <span className="block font-mono font-semibold tabular-nums">{numero(fila)}</span>
                <span className="block truncate text-sm">{fila.concepto}</span>
                <span className="text-meta block truncate">
                  {fechaCorta(fila.fecha, idioma)} · {t(`tipo.${fila.tipo}`)}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1.5">
                <Monto valor={fila.total_debe} moneda="DOP" className="font-semibold" />
                <EstadoAsiento fila={fila} t={t} />
              </span>
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

/**
 * Estado del asiento con el mapa central: revertido manda sobre lo demás; si
 * no, procesado o sin procesar, y el reverso se marca aparte porque además
 * puede estar o no procesado. Las etiquetas son las del módulo («Revertido»
 * y no «Anulado») para no cambiarle el vocabulario al contador.
 */
function EstadoAsiento({ fila, t }: { fila: FilaAsiento; t: (clave: string) => string }) {
  if (fila.estado === "anulado") return <StatusBadge status="anulado" label={t("estado.anulado")} />;

  return (
    <span className="inline-flex flex-wrap gap-1">
      {fila.procesado ? (
        <StatusBadge status="contabilizado" label={t("estado.procesado")} />
      ) : (
        <StatusBadge status="borrador" label={t("estado.pendiente")} />
      )}
      {fila.estado === "reverso" && <StatusBadge status="reverso" label={t("estado.reverso")} />}
    </span>
  );
}
