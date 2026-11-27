import { Eye } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { StatusBadge } from "@/components/app/status-badge";
import { Monto } from "@/components/contabilidad/comun";
import { DatoPanel, PanelFila } from "@/components/contabilidad/panel-fila";
import { BotonContabilizar, DialogoAnular } from "@/components/contabilidad/recibos/acciones-recibo";
import { ContabilizarFila } from "@/components/contabilidad/recibos/contabilizar-fila";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { numeroDocumento, SERIE_RECIBO } from "@/lib/contabilidad/formato";
import { fechaCorta } from "@/lib/fechas";
import type { FilaRecibo } from "@/server/contabilidad/recibos/consultas";

/**
 * Recibos como tabla densa (≥ md, 52 px por fila) y filas compactas (< md).
 * El monto lleva signo: + lo que entra, − lo que sale, para que una lista
 * mezclada se lea sin mirar la columna de tipo. Clic en la fila abre el panel
 * lateral; «Contabilizar» sale inline solo en los borradores.
 *
 * `puedeAprobar` viene resuelto de la página (contabilidad.aprobar); la
 * acción de servidor lo vuelve a exigir.
 */
export async function ListaRecibos({
  filas,
  idioma,
  puedeAprobar,
}: {
  filas: FilaRecibo[];
  idioma: "es" | "en";
  puedeAprobar: boolean;
}) {
  const t = await getTranslations("contab");
  const tl = await getTranslations("listas.recibos");
  const signo = (fila: FilaRecibo) => (fila.tipo === "egreso" ? `-${fila.monto}` : fila.monto);
  const numero = (fila: FilaRecibo) => numeroDocumento(SERIE_RECIBO[fila.tipo], fila.numero);

  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-linea bg-card shadow-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-linea text-meta">
            <tr>
              <th className="px-4 py-3 font-medium">{t("recibos.col.numero")}</th>
              <th className="px-4 py-3 font-medium">{t("recibos.col.concepto")}</th>
              <th className="px-4 py-3 font-medium">{t("recibos.col.cuenta")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("recibos.col.monto")}</th>
              <th className="px-4 py-3 font-medium">{t("recibos.col.estado")}</th>
              <th className="px-2 py-3">
                <span className="sr-only">{tl("acciones")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {filas.map((fila) => {
              const borrador = fila.estado === "borrador";
              const estado = <StatusBadge status={fila.estado} />;
              const meta = [fila.categoria, fila.tercero].filter(Boolean).join(" · ");

              return (
                <tr key={fila.id} className="group relative h-[52px] transition-colors hover:bg-muted/50">
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
                      estado={estado}
                      pie={
                        <>
                          {borrador && puedeAprobar && <BotonContabilizar id={fila.id} />}
                          {fila.estado !== "anulado" && puedeAprobar && <DialogoAnular id={fila.id} numero={numero(fila)} />}
                          <Button asChild variant="outline">
                            <Link href={`/contabilidad/recibos/${fila.id}`}>
                              <Eye className="size-4" />
                              {tl("verDetalle")}
                            </Link>
                          </Button>
                        </>
                      }
                    >
                      <p className="text-kpi mb-5">
                        <Monto valor={fila.monto} moneda={fila.moneda} />
                      </p>
                      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <DatoPanel etiqueta={t("formulario.concepto")} ancho>{fila.concepto}</DatoPanel>
                        <DatoPanel etiqueta={t("recibos.col.fecha")}>{fechaCorta(fila.fecha, idioma)}</DatoPanel>
                        <DatoPanel etiqueta={t("recibos.tipo")}>{t(`tipoCorto.${fila.tipo}`)}</DatoPanel>
                        <DatoPanel etiqueta={t("recibos.cuenta")}>{fila.cuenta}</DatoPanel>
                        <DatoPanel etiqueta={t("formulario.formaPago")}>{t(`formaPago.${fila.forma_pago}`)}</DatoPanel>
                        <DatoPanel etiqueta={t("formulario.categoria")}>{fila.categoria}</DatoPanel>
                        <DatoPanel etiqueta={t("formulario.fondo")}>{fila.fondo}</DatoPanel>
                        {fila.proyecto && <DatoPanel etiqueta={t("formulario.proyecto")}>{fila.proyecto}</DatoPanel>}
                        {fila.tercero && (
                          <DatoPanel etiqueta={t("recibos.tercero")}>{fila.tercero}</DatoPanel>
                        )}
                        {fila.referencia && <DatoPanel etiqueta={t("formulario.referencia")}>{fila.referencia}</DatoPanel>}
                        {fila.moneda === "USD" && fila.monto_dop && (
                          <DatoPanel etiqueta={t("detalle.montoDop")}>
                            <Monto valor={fila.monto_dop} moneda="DOP" />
                          </DatoPanel>
                        )}
                        <DatoPanel etiqueta={t("recibos.creadoPor")}>{fila.creado_por}</DatoPanel>
                        {fila.aprobado_por && <DatoPanel etiqueta={t("recibos.aprobadoPor")}>{fila.aprobado_por}</DatoPanel>}
                      </dl>
                    </PanelFila>
                  </td>
                  <td className="max-w-72 px-4 py-1.5">
                    <p className="truncate">{fila.concepto}</p>
                    {meta && <p className="text-meta truncate">{meta}</p>}
                  </td>
                  <td className="px-4 py-1.5 whitespace-nowrap text-tinta-2">{fila.cuenta}</td>
                  <td className="px-4 py-1.5 text-right font-medium tabular-nums">
                    <Monto valor={signo(fila)} moneda={fila.moneda} conSigno />
                  </td>
                  <td className="px-4 py-1.5">{estado}</td>
                  {/* Acciones al pasar el ratón o con el foco, por encima del botón que cubre la fila. */}
                  <td className="relative z-10 px-2 py-1.5 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                      {borrador && puedeAprobar && <ContabilizarFila id={fila.id} numero={numero(fila)} />}
                      <Button asChild variant="ghost" size="icon" aria-label={`${tl("verDetalle")} ${numero(fila)}`}>
                        <Link href={`/contabilidad/recibos/${fila.id}`}><Eye /></Link>
                      </Button>
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
              href={`/contabilidad/recibos/${fila.id}`}
              className="flex items-start justify-between gap-3 p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0 space-y-1">
                <span className="block font-mono font-semibold tabular-nums">{numero(fila)}</span>
                <span className="block truncate text-sm">{fila.concepto}</span>
                <span className="text-meta block truncate">
                  {fechaCorta(fila.fecha, idioma)} · {fila.cuenta}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1.5">
                <Monto valor={signo(fila)} moneda={fila.moneda} conSigno className="font-semibold" />
                <StatusBadge status={fila.estado} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
