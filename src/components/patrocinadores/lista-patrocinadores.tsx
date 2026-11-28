"use client";

import { useState } from "react";
import { Eye, HandCoins, Mail, PencilLine, Phone } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { BotonNuevoPatrocinador, PanelPatrocinador } from "@/components/patrocinadores/panel-patrocinador";
import { CeldaAcciones } from "@/components/app/celda-acciones";
import { MenuMasAcciones } from "@/components/app/menu-mas-acciones";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { formatoUsd } from "@/lib/moneda";
import type { PatrocinadorFila } from "@/server/patrocinadores/consultas";

/**
 * Lista densa del directorio. El clic en la fila abre el panel lateral con el resumen;
 * el botón de la primera celda se estira sobre toda la `<tr>` (`after:inset-0`) y las
 * acciones de la derecha van por encima (`z-10`), igual que en /expedientes.
 *
 * No hay botón de borrar: retirar a un patrocinador es marcarlo `inactivo`. Borrarlo
 * dejaría a sus becados sin origen de fondos y se llevaría el historial de aportes
 * (`asignacion_beca` va en cascada).
 */
export function ListaPatrocinadores({
  patrocinadores,
  puedeEscribir,
  hayMas,
  hayFiltro,
}: {
  patrocinadores: readonly PatrocinadorFila[];
  puedeEscribir: boolean;
  hayMas: boolean;
  hayFiltro: boolean;
}) {
  const t = useTranslations("sponsors");
  const tl = useTranslations("listas");
  const tc = useTranslations("sponsorMail");
  const ta = useTranslations("appUi");
  const [detalle, setDetalle] = useState<PatrocinadorFila | null>(null);
  const [edicion, setEdicion] = useState<PatrocinadorFila | null>(null);

  if (patrocinadores.length === 0) {
    if (hayFiltro) {
      return <EmptyState readOnly icon={HandCoins} title={t("noMatches")} description={t("noMatchesHint")} />;
    }

    return puedeEscribir ? (
      <EmptyState icon={HandCoins} title={t("empty")} description={t("emptyHint")} action={<BotonNuevoPatrocinador />} />
    ) : (
      <EmptyState readOnly icon={HandCoins} title={t("empty")} description={t("emptyHint")} />
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-card border border-linea bg-card shadow-card">
        <table className="hidden w-full text-sm md:table">
          <thead className="texto-meta border-b border-linea text-left">
            <tr>
              <th className="px-4 py-3 font-medium">{t("field.name")}</th>
              <th className="px-4 py-3 font-medium">{t("field.type")}</th>
              <th className="px-4 py-3 font-medium">{t("field.country")}</th>
              <th className="px-4 py-3 text-right font-medium">{tl("patrocinadores.aporte")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("grants.stats.scholars")}</th>
              <th className="px-4 py-3 font-medium">{t("field.state")}</th>
              <th className="px-4 py-3">
                <span className="sr-only">{tl("patrocinadores.acciones")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {patrocinadores.map((fila) => (
              <tr key={fila.id} className="group relative h-[52px] transition-colors hover:bg-muted/50">
                <td className="max-w-72 px-4 py-1.5">
                  <button
                    type="button"
                    onClick={() => setDetalle(fila)}
                    title={tl("patrocinadores.vistaRapida")}
                    aria-label={`${tl("patrocinadores.vistaRapida")}: ${fila.nombre}`}
                    className="block max-w-full truncate text-left font-semibold outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {fila.nombre}
                  </button>
                </td>
                <td className="text-meta px-4 py-1.5">{t(`type.${fila.tipo}` as never)}</td>
                <td className="text-meta px-4 py-1.5">{fila.pais ?? "—"}</td>
                <td className="px-4 py-1.5 text-right font-semibold tabular-nums">{formatoUsd(fila.monto_mensual)}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{fila.becados}</td>
                <td className="px-4 py-1.5">
                  <StatusBadge status={fila.estado} />
                </td>
                <CeldaAcciones>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/patrocinadores/${fila.id}`}>{ta("menu.row.view")}</Link>
                  </Button>
                  {puedeEscribir && (
                    <MenuMasAcciones
                      compacto
                      acciones={[{ etiqueta: ta("menu.row.edit"), icono: <PencilLine />, onClick: () => setEdicion(fila) }]}
                    />
                  )}
                </CeldaAcciones>
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="divide-y divide-linea md:hidden">
          {patrocinadores.map((fila) => (
            <li key={fila.id}>
              <button
                type="button"
                onClick={() => setDetalle(fila)}
                className="flex w-full items-center gap-3 p-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block truncate font-semibold">{fila.nombre}</span>
                  <span className="text-meta block truncate">
                    {[t(`type.${fila.tipo}` as never), fila.pais].filter(Boolean).join(" · ")}
                  </span>
                  <StatusBadge status={fila.estado} />
                </span>
                <span className="text-right">
                  <span className="block font-semibold tabular-nums">{formatoUsd(fila.monto_mensual)}</span>
                  <span className="text-meta block tabular-nums">{t("scholars", { count: fila.becados })}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {hayMas && <p className="text-meta text-center">{t("limitHint")}</p>}

      <Sheet open={detalle !== null} onOpenChange={(abierto) => !abierto && setDetalle(null)}>
        <SheetContent>
          {detalle && (
            <>
              <header className="border-b border-linea px-6 pt-6 pr-16 pb-4">
                <SheetTitle className="text-section">{detalle.nombre}</SheetTitle>
                <SheetDescription className="sr-only">{tl("patrocinadores.vistaRapida")}</SheetDescription>
                <div className="mt-2">
                  <StatusBadge status={detalle.estado} />
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-4 text-sm sm:grid-cols-2">
                  <Campo etiqueta={t("field.type")} valor={t(`type.${detalle.tipo}` as never)} />
                  <Campo etiqueta={t("field.country")} valor={detalle.pais} />
                  <Campo etiqueta={tl("patrocinadores.aporte")} valor={formatoUsd(detalle.monto_mensual)} />
                  <Campo etiqueta={t("grants.stats.scholars")} valor={t("scholars", { count: detalle.becados })} />
                  <Campo etiqueta={t("field.email")} valor={detalle.email} icono={<Mail aria-hidden className="size-4 text-tinta-3" />} ancho />
                  <Campo etiqueta={t("field.phone")} valor={detalle.telefono} icono={<Phone aria-hidden className="size-4 text-tinta-3" />} />
                  <Campo etiqueta={tl("patrocinadores.idiomaCartas")} valor={detalle.idioma === "es" ? tc("languageEs") : tc("languageEn")} />
                  <Campo etiqueta={t("field.notes")} valor={detalle.notas} ancho />
                </dl>
              </div>

              <footer className="flex justify-end gap-2 border-t border-linea px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <Button asChild variant="outline">
                  <Link href={`/patrocinadores/${detalle.id}`}>
                    <Eye className="size-4" />
                    {tl("patrocinadores.verDetalleCompleto")}
                  </Link>
                </Button>
                {puedeEscribir && (
                  <Button
                    type="button"
                    onClick={() => {
                      setEdicion(detalle);
                      setDetalle(null);
                    }}
                  >
                    <PencilLine className="size-4" />
                    {t("edit")}
                  </Button>
                )}
              </footer>
            </>
          )}
        </SheetContent>
      </Sheet>

      {puedeEscribir && edicion && (
        <PanelPatrocinador
          key={edicion.id}
          patrocinador={edicion}
          abierto
          alCambiar={(abierto) => !abierto && setEdicion(null)}
        />
      )}
    </div>
  );
}

function Campo({
  etiqueta,
  valor,
  icono,
  ancho = false,
}: {
  etiqueta: string;
  valor: string | null;
  icono?: React.ReactNode;
  ancho?: boolean;
}) {
  return (
    <div className={ancho ? "sm:col-span-2" : undefined}>
      <dt className="text-meta">{etiqueta}</dt>
      <dd className="mt-0.5 flex items-center gap-2 break-words">
        {valor ? icono : null}
        {valor || "—"}
      </dd>
    </div>
  );
}
