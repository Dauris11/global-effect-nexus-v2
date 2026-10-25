"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Play, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  guardarRegla,
  procesarAutomaticos,
  type EstadoMiDia,
} from "@/server/contabilidad/automatizacion/acciones";

const INICIAL: EstadoMiDia = { estado: "inicial" };

/** Cuánta autonomía tiene la clasificación de comprobantes. La fija la contadora. */
export function ReglaAutonomia({
  nivel,
  umbralConfianza,
  umbralMonto,
  puedeConfigurar,
}: {
  nivel: 0 | 1 | 2;
  umbralConfianza: number;
  umbralMonto: number;
  puedeConfigurar: boolean;
}) {
  const t = useTranslations("miDia");
  const [guardado, guardar, guardando] = useActionState(guardarRegla, INICIAL);
  const [procesado, procesar, procesando] = useActionState(procesarAutomaticos, INICIAL);

  return (
    <div className="space-y-4">
      <form action={guardar} className="grid gap-3 sm:grid-cols-3 sm:items-end">
        <div className="sm:col-span-3">
          <Label htmlFor="regla-nivel">{t("rule.level")}</Label>
          <select
            id="regla-nivel"
            name="nivel"
            defaultValue={nivel}
            disabled={!puedeConfigurar}
            className="border-linea-fuerte bg-background h-11 w-full rounded-control border px-3 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {[0, 1, 2].map((n) => (
              <option key={n} value={n}>
                {t(`rule.levels.${n}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="regla-confianza">{t("rule.confidence")}</Label>
          <Input id="regla-confianza" name="umbral_confianza" type="number" min={1} max={100} defaultValue={umbralConfianza} disabled={!puedeConfigurar} />
        </div>
        <div>
          <Label htmlFor="regla-monto">{t("rule.amount")}</Label>
          <Input id="regla-monto" name="umbral_monto" inputMode="decimal" defaultValue={umbralMonto} disabled={!puedeConfigurar} />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!puedeConfigurar || guardando}>
            {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {t("rule.save")}
          </Button>
          {guardado.estado === "ok" && (
            <span role="status" className="text-marca-700 flex items-center gap-1 text-sm font-medium">
              <CheckCircle2 className="size-4" />
              {t("rule.saved")}
            </span>
          )}
          {(guardado.estado === "error" || guardado.estado === "no_permitido") && (
            <span role="alert" className="flex items-center gap-1 text-sm font-medium">
              <AlertCircle className="size-4" />
              {t("rule.failed")}
            </span>
          )}
        </div>
      </form>

      {!puedeConfigurar && <p className="texto-meta">{t("rule.readOnly")}</p>}

      {nivel === 2 && (
        <form action={procesar} className="space-y-2">
          <p className="texto-meta">{t("rule.level2Hint")}</p>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="outline" disabled={procesando}>
              {procesando ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {t("rule.process")}
            </Button>
            {procesado.estado === "ok" && (
              <span role="status" className="text-marca-700 text-sm font-medium">
                {t("queue.result.ok", { n: procesado.procesados ?? 0, m: procesado.omitidos ?? 0 })}
              </span>
            )}
            {procesado.estado === "nada" && <span className="texto-meta">{t("queue.result.nada")}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
