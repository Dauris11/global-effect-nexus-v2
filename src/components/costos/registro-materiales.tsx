"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, Package, Save } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { AnularCosto } from "@/components/costos/anular-costo";
import { MensajeEstadoCosto } from "@/components/costos/mensaje-estado-costo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { fechaCorta } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { anularMaterial, registrarMaterial, type EstadoCosto } from "@/server/costos/acciones";
import type { ArticuloParaCosto, MaterialRegistrado } from "@/server/costos/consultas";

const SELECTOR =
  "border-linea-fuerte rounded-control h-12 w-full border bg-background px-3 text-base text-tinta outline-none focus-visible:border-tinta focus-visible:ring-1 focus-visible:ring-tinta sm:text-[15px]";

const dop = (n: number) => formatearMonto(n, "DOP");

/**
 * Materiales y equipamiento entregados al estudiante: formulario de alta y la
 * lista de lo ya registrado, con lo anulado tachado y su motivo. Al elegir un
 * artículo del inventario se propone su costo promedio, editable: lo que vale
 * es lo que costó entregarlo, no el promedio de hoy.
 */
export function RegistroMateriales({
  estudianteId,
  materiales,
  articulos,
}: {
  estudianteId: string;
  materiales: MaterialRegistrado[];
  articulos: ArticuloParaCosto[];
}) {
  const t = useTranslations("costs.register");
  const idioma = useLocale() === "en" ? "en" : "es";
  const formulario = useRef<HTMLFormElement>(null);
  // Campos no controlados: el artículo los rellena por referencia y `reset()` del formulario los limpia.
  const campoConcepto = useRef<HTMLInputElement>(null);
  const campoCosto = useRef<HTMLInputElement>(null);
  const [estado, enviar, pendiente] = useActionState(registrarMaterial, { estado: "inicial" } as EstadoCosto);

  useEffect(() => {
    if (estado.estado === "ok") formulario.current?.reset();
  }, [estado]);

  const vigentes = materiales.filter((m) => !m.anulado);
  const total = vigentes.reduce((suma, m) => suma + m.costo_total, 0);

  function alElegirArticulo(id: string) {
    const articulo = articulos.find((a) => a.id === id);
    if (!articulo) return;
    if (campoConcepto.current && campoConcepto.current.value.trim() === "") campoConcepto.current.value = articulo.nombre;
    if (campoCosto.current) campoCosto.current.value = String(articulo.costo_promedio);
  }

  return (
    <section className="space-y-4">
      <h2 className="texto-titulo-seccion">{t("materials.title")}</h2>

      <form ref={formulario} action={enviar} className="rounded-card border border-linea bg-card space-y-4 p-5">
        <input type="hidden" name="estudiante_id" value={estudianteId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mat-concepto">{t("materials.concept")}</Label>
            <Input id="mat-concepto" name="concepto" required maxLength={150} ref={campoConcepto} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mat-cantidad">{t("materials.quantity")}</Label>
            <Input id="mat-cantidad" name="cantidad" type="number" inputMode="numeric" min={1} step={1} defaultValue={1} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mat-costo">{t("materials.unitCost")}</Label>
            <Input id="mat-costo" name="costo_unitario" inputMode="decimal" required ref={campoCosto} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mat-fecha">{t("materials.date")}</Label>
            <Input id="mat-fecha" name="fecha" type="date" required defaultValue={new Date().toLocaleDateString("en-CA")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mat-articulo">{t("materials.article")}</Label>
            <select id="mat-articulo" name="articulo_id" defaultValue="" className={SELECTOR} onChange={(e) => alElegirArticulo(e.target.value)}>
              <option value="">{t("materials.noArticle")}</option>
              {articulos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.codigo} · {a.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
        <MensajeEstadoCosto estado={estado} />
        <Button type="submit" disabled={pendiente}>
          {pendiente ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {t("materials.save")}
        </Button>
      </form>

      {materiales.length === 0 ? (
        <EstadoVacio icono={Package} titulo={t("materials.empty")} />
      ) : (
        <ul className="rounded-card border border-linea bg-card divide-y divide-linea">
          {materiales.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className={cn("min-w-0 space-y-1", m.anulado && "text-tinta-3")}>
                <p className={cn("break-words font-medium", m.anulado && "line-through")}>
                  {m.concepto} × {m.cantidad}
                </p>
                <p className="texto-meta flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{fechaCorta(m.fecha, idioma)}</span>
                  <span>{dop(m.costo_unitario)} {t("materials.each")}</span>
                  {m.articulo && <span>{m.articulo}</span>}
                  {m.anulado && <Badge variant="neutra">{t("void.voided")}</Badge>}
                </p>
                {m.anulado && m.motivo_anulacion && <p className="texto-meta">{t("void.reasonIs", { motivo: m.motivo_anulacion })}</p>}
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <p className={cn("font-semibold tabular-nums", m.anulado && "text-tinta-3 line-through")}>{dop(m.costo_total)}</p>
                {!m.anulado && <AnularCosto id={m.id} accion={anularMaterial} />}
              </div>
            </li>
          ))}
          <li className="flex justify-between p-4 font-semibold">
            <span>{t("total")}</span>
            <span className="tabular-nums">{dop(total)}</span>
          </li>
        </ul>
      )}
    </section>
  );
}
