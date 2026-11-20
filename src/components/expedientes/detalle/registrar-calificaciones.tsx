"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { CLASE_SELECT } from "@/components/universidades/formularios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ALERTA_RIESGO } from "@/lib/paleta";
import { registrarCalificaciones, type EstadoCalificaciones } from "@/server/universidades/calificaciones";

const NUMERAL = ["I", "II", "III"];

/**
 * Pegar las calificaciones de un cuatrimestre de un estudiante. Es lo único que
 * hay que hacer después de la carga inicial: el pénsum, el índice y las alertas se
 * recalculan solos. Todo o nada: si una línea no cuadra con el pénsum o con las
 * letras de su universidad, no se guarda ninguna y se dice cuáles.
 */
export function RegistrarCalificaciones({ estudianteId }: { estudianteId: string }) {
  const t = useTranslations("catalog");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [ronda, setRonda] = useState(1);
  const [estado, enviar, enviando] = useActionState<EstadoCalificaciones, FormData>(registrarCalificaciones, { estado: "inicial" });

  return (
    <form action={enviar} className="space-y-3 rounded-card border border-linea bg-card p-4">
      <input type="hidden" name="estudiante" value={estudianteId} />
      <input type="hidden" name="periodo" value={`${anio}-${NUMERAL[ronda - 1]}`} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cal-anio">{t("grades.year")}</Label>
          <Input id="cal-anio" type="number" min={2000} max={new Date().getFullYear() + 1} value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cal-ronda">{t("grades.term")}</Label>
          <select id="cal-ronda" value={ronda} onChange={(e) => setRonda(Number(e.target.value))} className={CLASE_SELECT}>
            {NUMERAL.map((n, i) => <option key={n} value={i + 1}>{t("grades.termOption", { n })}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cal-lista">{t("grades.list")}</Label>
        <Textarea id="cal-lista" name="lista" required rows={5} placeholder={t("grades.placeholder")} className="font-mono text-sm" />
        <p className="texto-meta">{t("grades.help")}</p>
      </div>

      {estado.estado === "ok" && (
        <p role="status" className="flex items-start gap-2 text-sm font-medium">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-marca-700" />
          {t("grades.saved", { count: estado.guardadas ?? 0 })}
        </p>
      )}
      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className={ALERTA_RIESGO.contenedor}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>
            {t(`grades.errors.${estado.estado}`)}
            {estado.rechazadas && estado.rechazadas.length > 0 && ` ${t("pensum.rejected", { lines: estado.rechazadas.join(", ") })}`}
            {estado.desconocidos && estado.desconocidos.length > 0 && ` ${t("grades.unknown", { codes: estado.desconocidos.join(", ") })}`}
          </span>
        </p>
      )}

      <Button type="submit" size="sm" disabled={enviando}>
        {enviando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {t("grades.save")}
      </Button>
    </form>
  );
}
