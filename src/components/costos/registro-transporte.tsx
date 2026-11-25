"use client";

import { useActionState, useEffect, useRef } from "react";
import { Bus, Info, Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { AnularCosto } from "@/components/costos/anular-costo";
import { MensajeEstadoCosto } from "@/components/costos/mensaje-estado-costo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { cn } from "@/lib/utils";
import { anularTransporte, registrarTransporte, type EstadoCosto } from "@/server/costos/acciones";
import type { PeriodoCosto, TransporteRegistrado } from "@/server/costos/consultas";

const SELECTOR =
  "border-linea-fuerte rounded-control h-12 w-full border bg-background px-3 text-base text-tinta outline-none focus-visible:border-tinta focus-visible:ring-1 focus-visible:ring-tinta sm:text-[15px]";

const dop = (n: number) => formatearMonto(n, "DOP");

/**
 * Transporte institucional por estudiante y cuatrimestre, a mano. Solo lo usan
 * quienes tienen inscripción recurrente de guagua (Rincón, Jima, Ranchito, Saba
 * Rey y Rancho Viejo, hacia UCATECI); a quien no la tiene se le avisa, pero no
 * se le impide registrar (puede haber ido en una ruta extraordinaria). No hay
 * prorrateo automático entre becados: el monto lo fija contabilidad.
 */
export function RegistroTransporte({
  estudianteId,
  registros,
  periodos,
  diasTransporte,
}: {
  estudianteId: string;
  registros: TransporteRegistrado[];
  periodos: PeriodoCosto[];
  diasTransporte: number;
}) {
  const t = useTranslations("costs.register");
  const formulario = useRef<HTMLFormElement>(null);
  const [estado, enviar, pendiente] = useActionState(registrarTransporte, { estado: "inicial" } as EstadoCosto);

  useEffect(() => {
    if (estado.estado === "ok") formulario.current?.reset();
  }, [estado]);

  const vigentes = registros.filter((r) => !r.anulado);
  const total = vigentes.reduce((suma, r) => suma + r.costo_asignado, 0);
  // Cuatrimestres que ya tienen cobro vigente: no se ofrecen (el índice único los rechazaría).
  const ocupados = new Set(vigentes.map((r) => r.periodo_id));
  const libres = periodos.filter((p) => !ocupados.has(p.id));

  return (
    <section className="space-y-4">
      <h2 className="texto-titulo-seccion">{t("transport.title")}</h2>

      <p className="bg-marca-50 text-marca-700 flex items-start gap-2 rounded-control p-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>{diasTransporte > 0 ? t("transport.enrolled", { n: diasTransporte }) : t("transport.notEnrolled")}</span>
      </p>

      <form ref={formulario} action={enviar} className="rounded-card border border-linea bg-card space-y-4 p-5">
        <input type="hidden" name="estudiante_id" value={estudianteId} />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="tr-periodo">{t("transport.term")}</Label>
            <select id="tr-periodo" name="periodo_id" required defaultValue="" className={SELECTOR}>
              <option value="" disabled>
                {t("transport.chooseTerm")}
              </option>
              {libres.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tr-dias">{t("transport.days")}</Label>
            <Input id="tr-dias" name="dias_asignados" type="number" inputMode="numeric" min={0} max={366} step={1} defaultValue={0} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tr-costo">{t("transport.cost")}</Label>
            <Input id="tr-costo" name="costo_asignado" inputMode="decimal" required />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="tr-obs">{t("transport.notes")}</Label>
            <Input id="tr-obs" name="observaciones" maxLength={500} />
          </div>
        </div>
        <MensajeEstadoCosto estado={estado} />
        <Button type="submit" disabled={pendiente}>
          {pendiente ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {t("transport.save")}
        </Button>
      </form>

      {registros.length === 0 ? (
        <EstadoVacio icono={Bus} titulo={t("transport.empty")} texto={t("transport.emptyHint")} />
      ) : (
        <ul className="rounded-card border border-linea bg-card divide-y divide-linea">
          {registros.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className={cn("min-w-0 space-y-1", r.anulado && "text-tinta-3")}>
                <p className={cn("break-words font-medium", r.anulado && "line-through")}>{r.periodo}</p>
                <p className="texto-meta flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{t("transport.daysCount", { n: r.dias_asignados })}</span>
                  {r.observaciones && <span>{r.observaciones}</span>}
                  {r.anulado && <Badge variant="neutra">{t("void.voided")}</Badge>}
                </p>
                {r.anulado && r.motivo_anulacion && <p className="texto-meta">{t("void.reasonIs", { motivo: r.motivo_anulacion })}</p>}
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <p className={cn("font-semibold tabular-nums", r.anulado && "text-tinta-3 line-through")}>{dop(r.costo_asignado)}</p>
                {!r.anulado && <AnularCosto id={r.id} accion={anularTransporte} />}
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
