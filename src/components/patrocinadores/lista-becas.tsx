"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Eye, GraduationCap, Link2, Link2Off, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { EmptyState } from "@/components/app/empty-state";
import { SidePanelForm } from "@/components/app/side-panel-form";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fechaCorta } from "@/lib/fechas";
import { formatoUsd } from "@/lib/moneda";
import { ALERTA_RIESGO } from "@/lib/paleta";
import { asignarBeca, desvincularBeca, type EstadoPatrocinador } from "@/server/patrocinadores/acciones";
import type { BecadoConPatrocinio } from "@/server/patrocinadores/consultas";

type PatrocinadorOpcion = { id: string; nombre: string; pais: string | null; monto_mensual: number };

const SELECT =
  "text-body h-11 w-full rounded-control border border-linea-fuerte bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Lista densa de becados y su patrocinio. Los que no tienen patrocinador van primero
 * (lo ordena el SQL): es el trabajo pendiente y una lista que empiece por lo resuelto
 * obliga a bajar para ver qué falta.
 *
 * Clic en la fila → panel lateral; el botón de la primera celda se estira sobre la
 * `<tr>` y las acciones van por encima (`z-10`). Vincular y desvincular siguen
 * validándose en el servidor (`patrocinadores.escribir`); aquí solo se esconden los
 * botones a quien no puede.
 */
export function ListaBecas({
  becados,
  patrocinadores,
  puedeEscribir,
  hayFiltro,
}: {
  becados: readonly BecadoConPatrocinio[];
  patrocinadores: readonly PatrocinadorOpcion[];
  puedeEscribir: boolean;
  hayFiltro: boolean;
}) {
  const t = useTranslations("sponsors");
  const tl = useTranslations("listas");
  const idioma = useLocale() as Locale;
  const [detalle, setDetalle] = useState<BecadoConPatrocinio | null>(null);
  const [vinculando, setVinculando] = useState<BecadoConPatrocinio | null>(null);
  const puedeVincular = puedeEscribir && patrocinadores.length > 0;

  if (becados.length === 0) {
    return hayFiltro ? (
      <EmptyState readOnly icon={GraduationCap} title={t("grants.noMatches")} description={t("grants.noMatchesHint")} />
    ) : (
      <EmptyState
        icon={GraduationCap}
        title={t("grants.empty")}
        description={t("grants.emptyHint")}
        action={
          <Button asChild variant="outline">
            <Link href="/expedientes">{tl("becas.irExpedientes")}</Link>
          </Button>
        }
      />
    );
  }

  const estadoDe = (b: BecadoConPatrocinio) => (b.asignacion_id ? "activa" : "sin_asignar");
  const desde = (b: BecadoConPatrocinio) => (b.desde ? fechaCorta(b.desde, idioma) : null);

  return (
    <div className="space-y-3">
      {puedeEscribir && patrocinadores.length === 0 && (
        <p className={ALERTA_RIESGO.contenedor}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>{t("grants.form.noSponsors")}</span>
        </p>
      )}

      <div className="overflow-hidden rounded-card border border-linea bg-card shadow-card">
        <table className="hidden w-full text-sm md:table">
          <thead className="texto-meta border-b border-linea text-left">
            <tr>
              <th className="px-4 py-3 font-medium">{tl("becas.becado")}</th>
              <th className="px-4 py-3 font-medium">{tl("becas.universidad")}</th>
              <th className="px-4 py-3 font-medium">{t("grants.form.sponsor")}</th>
              <th className="px-4 py-3 text-right font-medium">{tl("becas.monto")}</th>
              <th className="px-4 py-3 font-medium">{tl("becas.estado")}</th>
              <th className="px-4 py-3">
                <span className="sr-only">{tl("becas.acciones")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {becados.map((fila) => (
              <tr key={fila.estudiante_id} className="group relative h-[52px] transition-colors hover:bg-muted/50">
                <td className="max-w-64 px-4 py-1.5">
                  <button
                    type="button"
                    onClick={() => setDetalle(fila)}
                    title={tl("becas.vistaRapida")}
                    aria-label={`${tl("becas.vistaRapida")}: ${fila.nombre}`}
                    className="block max-w-full text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="block truncate font-semibold">{fila.nombre}</span>
                    <span className="text-meta block truncate">{fila.programa ?? "—"}</span>
                  </button>
                </td>
                <td className="text-meta max-w-48 truncate px-4 py-1.5">{fila.universidad ?? "—"}</td>
                <td className="max-w-56 px-4 py-1.5">
                  {fila.patrocinador ? (
                    <>
                      <span className="block truncate">{fila.patrocinador}</span>
                      <span className="text-meta block truncate">{fila.pais ?? ""}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-1.5 text-right font-semibold tabular-nums">
                  {fila.monto !== null ? formatoUsd(fila.monto) : "—"}
                </td>
                <td className="px-4 py-1.5">
                  <StatusBadge status={estadoDe(fila)} />
                </td>
                <td className="relative z-10 w-24 px-2 py-1.5 text-right">
                  <span className="inline-flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    {puedeVincular && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={fila.asignacion_id ? t("grants.change") : t("grants.assign")}
                        onClick={() => setVinculando(fila)}
                      >
                        <Link2 />
                      </Button>
                    )}
                    <Button asChild variant="ghost" size="icon" aria-label={tl("becas.verExpediente")}>
                      <Link href={`/expedientes/${fila.estudiante_id}`}><Eye /></Link>
                    </Button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="divide-y divide-linea md:hidden">
          {becados.map((fila) => (
            <li key={fila.estudiante_id}>
              <button
                type="button"
                onClick={() => setDetalle(fila)}
                className="flex w-full items-center gap-3 p-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block truncate font-semibold">{fila.nombre}</span>
                  <span className="text-meta block truncate">
                    {[fila.programa, fila.universidad].filter(Boolean).join(" · ") || "—"}
                  </span>
                  <StatusBadge status={estadoDe(fila)} />
                </span>
                <span className="text-right">
                  <span className="block truncate">{fila.patrocinador ?? ""}</span>
                  <span className="block font-semibold tabular-nums">{fila.monto !== null ? formatoUsd(fila.monto) : ""}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Sheet open={detalle !== null} onOpenChange={(abierto) => !abierto && setDetalle(null)}>
        <SheetContent>
          {detalle && (
            <>
              <header className="border-b border-linea px-6 pt-6 pr-16 pb-4">
                <SheetTitle className="text-section">{detalle.nombre}</SheetTitle>
                <SheetDescription className="sr-only">{tl("becas.vistaRapida")}</SheetDescription>
                <div className="mt-2">
                  <StatusBadge status={estadoDe(detalle)} />
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-4 text-sm sm:grid-cols-2">
                  <Campo etiqueta={tl("becas.programa")} valor={detalle.programa} ancho />
                  <Campo etiqueta={tl("becas.universidad")} valor={detalle.universidad} ancho />
                  <Campo
                    etiqueta={t("grants.form.sponsor")}
                    valor={detalle.patrocinador}
                    enlace={detalle.patrocinador_id ? `/patrocinadores/${detalle.patrocinador_id}` : undefined}
                  />
                  <Campo etiqueta={t("field.country")} valor={detalle.pais} />
                  <Campo etiqueta={tl("becas.monto")} valor={detalle.monto !== null ? formatoUsd(detalle.monto) : null} />
                  <Campo etiqueta={tl("becas.desde")} valor={desde(detalle)} />
                  {detalle.anteriores > 0 && (
                    <Campo etiqueta={tl("becas.historial")} valor={t("grants.previous", { count: detalle.anteriores })} ancho />
                  )}
                </dl>
              </div>

              <footer className="flex flex-wrap justify-end gap-2 border-t border-linea px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <Button asChild variant="outline">
                  <Link href={`/expedientes/${detalle.estudiante_id}`}>
                    <Eye className="size-4" />
                    {tl("becas.verExpediente")}
                  </Link>
                </Button>
                {puedeVincular && detalle.asignacion_id && <BotonDesvincular id={detalle.estudiante_id} />}
                {puedeVincular && (
                  <Button
                    type="button"
                    onClick={() => {
                      setVinculando(detalle);
                      setDetalle(null);
                    }}
                  >
                    <Link2 className="size-4" />
                    {detalle.asignacion_id ? t("grants.change") : t("grants.assign")}
                  </Button>
                )}
              </footer>
            </>
          )}
        </SheetContent>
      </Sheet>

      {puedeVincular && vinculando && (
        <PanelVinculo
          key={vinculando.estudiante_id}
          becado={vinculando}
          patrocinadores={patrocinadores}
          alCerrar={() => setVinculando(null)}
        />
      )}
    </div>
  );
}

function Campo({
  etiqueta,
  valor,
  enlace,
  ancho = false,
}: {
  etiqueta: string;
  valor: string | null;
  enlace?: string;
  ancho?: boolean;
}) {
  return (
    <div className={ancho ? "sm:col-span-2" : undefined}>
      <dt className="text-meta">{etiqueta}</dt>
      <dd className="mt-0.5 break-words">
        {valor && enlace ? (
          <Link href={enlace} className="text-marca-700 hover:underline">{valor}</Link>
        ) : (
          valor || "—"
        )}
      </dd>
    </div>
  );
}

/** Elegir patrocinador y monto para esta beca, en panel lateral. */
function PanelVinculo({
  becado,
  patrocinadores,
  alCerrar,
}: {
  becado: BecadoConPatrocinio;
  patrocinadores: readonly PatrocinadorOpcion[];
  alCerrar: () => void;
}) {
  const t = useTranslations("sponsors");
  const [estado, enviar, enviando] = useActionState<EstadoPatrocinador, FormData>(
    async (previo, datos) => {
      const resultado = await asignarBeca(previo, datos);

      if (resultado.estado === "ok") alCerrar();

      return resultado;
    },
    { estado: "inicial" },
  );
  const mensajeError =
    estado.estado === "no_encontrado"
      ? t("grants.form.notFound")
      : estado.estado === "monto_invalido"
        ? t("grants.form.amountInvalid")
        : t("grants.form.error");

  return (
    <SidePanelForm
      open
      onOpenChange={(abierto) => !abierto && alCerrar()}
      title={`${t("grants.form.title")} · ${becado.nombre}`}
      description={t("grants.form.subtitle")}
      submitLabel={enviando ? t("grants.form.saving") : t("grants.form.save")}
      submitIcon={<Link2 />}
      pending={enviando}
      action={enviar}
    >
      <input type="hidden" name="estudiante" value={becado.estudiante_id} />

      <div className="space-y-1.5">
        <Label htmlFor="b-pat">{t("grants.form.sponsor")}</Label>
        <select id="b-pat" name="patrocinador" required defaultValue={becado.patrocinador_id ?? undefined} className={SELECT}>
          {patrocinadores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}{p.pais ? ` · ${p.pais}` : ""} · {formatoUsd(p.monto_mensual)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="b-monto">{t("grants.form.amount")}</Label>
        <Input id="b-monto" name="monto" type="number" min={0} step="0.01" defaultValue={becado.monto ?? 0} />
      </div>

      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className={ALERTA_RIESGO.contenedor}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>{mensajeError}</span>
        </p>
      )}
    </SidePanelForm>
  );
}

/**
 * Cierra la beca activa. No pregunta antes y es defendible: no se borra nada, la
 * asignación pasa a `finalizado` con la fecha de hoy y queda en el histórico.
 */
function BotonDesvincular({ id }: { id: string }) {
  const t = useTranslations("sponsors");
  const [estado, enviar, enviando] = useActionState<EstadoPatrocinador, FormData>(desvincularBeca, { estado: "inicial" });

  return (
    <form action={enviar} className="flex items-center gap-2">
      <input type="hidden" name="estudiante" value={id} />
      <Button type="submit" variant="outline" cargando={enviando}>
        {enviando ? <Loader2 className="size-4 animate-spin" /> : <Link2Off className="size-4" />}
        {enviando ? t("grants.unlinking") : t("grants.unlink")}
      </Button>
      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <span role="alert" className="text-meta">{t("grants.form.error")}</span>
      )}
    </form>
  );
}
