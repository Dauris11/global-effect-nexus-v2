"use client";

import { useActionState, useState } from "react";
import { AlertCircle, FileUp, Loader2, ScanSearch } from "lucide-react";
import { useTranslations } from "next-intl";

import { AccionesFormulario, FormularioGuiado, PasoFormulario } from "@/components/ui/formulario-guiado";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { ALERTA_RIESGO } from "@/lib/paleta";
import { crearCargaCalificaciones, type EstadoCarga } from "@/server/universidades/carga-acciones";

const CLASE_SELECT =
  "h-11 w-full rounded-control border border-linea-fuerte bg-background px-3 text-base text-tinta outline-none focus-visible:border-tinta focus-visible:ring-1 focus-visible:ring-tinta sm:text-[15px]";

type Universidad = { id: string; siglas: string; nombre: string; regimen: string };

/**
 * Asistente para subir las calificaciones de una universidad: universidad →
 * período → medio. Lee el documento, empareja y lleva a la pantalla de revisión;
 * nada se guarda en el récord de nadie hasta confirmar allí.
 */
export function FormularioCarga({ universidades, anioInicial }: { universidades: Universidad[]; anioInicial: number }) {
  const t = useTranslations("catalog.upload");
  const tr = useTranslations("catalog.regime");
  const router = useRouter();
  const [universidadId, setUniversidadId] = useState("");
  const [anio, setAnio] = useState(String(anioInicial));
  const [ronda, setRonda] = useState("1");
  const [medio, setMedio] = useState<"archivo" | "lista">("archivo");
  const universidad = universidades.find((u) => u.id === universidadId);

  const [estado, enviar, enviando] = useActionState<EstadoCarga, FormData>(async (previo, datos) => {
    const r = await crearCargaCalificaciones(previo, datos);

    if (r.estado === "ok" && r.cargaId) router.push(`/academico/universidades/calificaciones/${r.cargaId}`);

    return r;
  }, { estado: "inicial" });

  return (
    <form action={enviar} className="space-y-4 rounded-card border border-linea bg-card p-4 sm:p-6">
      <input type="hidden" name="periodo" value={`${anio}-${ronda}`} />
      <input type="hidden" name="medio" value={medio} />

      <FormularioGuiado>
        <PasoFormulario titulo={t("form.university")}>
          <div className="space-y-1.5">
            <Label htmlFor="carga-universidad">{t("form.university")}</Label>
            <select id="carga-universidad" name="universidad" required value={universidadId} onChange={(e) => setUniversidadId(e.target.value)} className={CLASE_SELECT}>
              <option value="">{t("form.chooseUniversity")}</option>
              {universidades.map((u) => (
                <option key={u.id} value={u.id}>{u.siglas} · {u.nombre}</option>
              ))}
            </select>
            {universidad && <p className="texto-meta">{t("form.regime", { regime: tr(universidad.regimen as "cuatrimestre") })}</p>}
          </div>
        </PasoFormulario>

        <PasoFormulario titulo={t("form.round")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="carga-anio">{t("form.year")}</Label>
              <Input id="carga-anio" type="number" inputMode="numeric" min={2000} max={anioInicial + 1} required value={anio} onChange={(e) => setAnio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="carga-ronda">{t("form.round")}</Label>
              <select id="carga-ronda" value={ronda} onChange={(e) => setRonda(e.target.value)} className={CLASE_SELECT}>
                {(["1", "2", "3"] as const).map((r) => (
                  <option key={r} value={r}>{t(`form.rounds.${r}`)}</option>
                ))}
              </select>
            </div>
          </div>
        </PasoFormulario>

        <PasoFormulario titulo={t("form.medium")}>
          <div role="radiogroup" aria-label={t("form.medium")} className="flex flex-wrap gap-2">
            {(["archivo", "lista"] as const).map((m) => (
              <Button key={m} type="button" role="radio" aria-checked={medio === m} variant={medio === m ? "default" : "outline"} onClick={() => setMedio(m)}>
                {m === "archivo" ? <FileUp className="size-4" /> : <ScanSearch className="size-4" />}
                {m === "archivo" ? t("form.mediumFile") : t("form.mediumList")}
              </Button>
            ))}
          </div>

          {medio === "archivo" ? (
            <div className="space-y-1.5">
              <Label htmlFor="carga-archivo">{t("form.file")}</Label>
              <input id="carga-archivo" name="archivo" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required
                className="block w-full text-sm file:mr-3 file:rounded-control file:border file:border-linea-fuerte file:bg-background file:px-3 file:py-2 file:text-sm file:font-medium" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="carga-lista">{t("form.list")}</Label>
              <Textarea id="carga-lista" name="lista" rows={8} required className="font-mono text-sm" />
            </div>
          )}

          <p className="texto-meta">{t("form.help")}</p>

          {estado.estado !== "inicial" && estado.estado !== "ok" && (
            <p role="alert" className={ALERTA_RIESGO.contenedor}>
              <AlertCircle className={ALERTA_RIESGO.icono} />
              <span className={ALERTA_RIESGO.texto}>{t(`errors.${estado.estado}`)}</span>
            </p>
          )}
        </PasoFormulario>

        <AccionesFormulario>
          <Button type="submit" cargando={enviando}>
            {enviando ? <Loader2 className="size-4 animate-spin" /> : <ScanSearch className="size-4" />}
            {enviando ? t("form.reading") : t("form.submit")}
          </Button>
        </AccionesFormulario>
      </FormularioGuiado>
    </form>
  );
}
