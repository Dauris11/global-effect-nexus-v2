"use client";

import { useRef, useState, useTransition } from "react";
import { AlertCircle, Camera, CheckCircle2, Loader2, PencilLine, Plus, Save, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { reducirImagen } from "@/components/expedientes/record-liceo/reducir-imagen";
import { TablaGradoLiceo } from "@/components/expedientes/record-liceo/tabla-grado-liceo";
import { Button } from "@/components/ui/button";
import { ALERTA_RIESGO } from "@/lib/paleta";
import { MAXIMO_GRADOS, pendientesDeRevisar, promediosDelRecord, type GradoLiceo } from "@/lib/record-liceo";
import { confirmarRecordLiceo, descartarBorradorRecordLiceo, leerRecordLiceo, quitarRecordLiceo, type EstadoRecordLiceo } from "@/server/record-liceo/acciones";

const INICIAL: EstadoRecordLiceo = { estado: "inicial" };
const GRADO_VACIO = (g: number): GradoLiceo => ({ grado: g, anioInicio: new Date().getFullYear() - 1, centro: "", notas: [{ materia: "", esModulo: false, nota: null }] });

/**
 * Flujo del récord de secundaria: foto (o captura a mano) → tabla para corroborar →
 * confirmar. Las fotos se reducen en el navegador, se leen en el servidor y el
 * borrador queda guardado: recargar la página no lo pierde. Al confirmar, el
 * servidor valida de nuevo y calcula los promedios; la vista previa de aquí es solo
 * una ayuda con la misma función de `src/lib/record-liceo.ts`.
 */
export function EditorRecordLiceo({
  estudianteId,
  confirmados,
  borrador,
}: {
  estudianteId: string;
  /** Lo ya confirmado, para editarlo o agregarle grados (p. ej. el 6.º cuando termine). */
  confirmados: GradoLiceo[];
  borrador: GradoLiceo[] | null;
}) {
  const t = useTranslations("recordLiceo");
  const entrada = useRef<HTMLInputElement>(null);
  const [grados, setGrados] = useState<GradoLiceo[] | null>(borrador);
  const [estado, setEstado] = useState<EstadoRecordLiceo>(INICIAL);
  const [fase, setFase] = useState<"preparando" | "leyendo" | null>(null);
  const [pidiendoQuitar, setPidiendoQuitar] = useState(false);
  const [ocupado, empezar] = useTransition();

  const editando = grados !== null;
  const pendientes = grados ? pendientesDeRevisar(grados) : { sinNota: 0, dudosas: 0 };
  const promedios = grados ? promediosDelRecord(grados) : null;

  function subirFotos(lista: FileList | null) {
    const fotos = Array.from(lista ?? []);

    if (fotos.length === 0) return;
    empezar(async () => {
      setEstado(INICIAL);
      setFase("preparando");

      const datos = new FormData();

      datos.set("estudiante", estudianteId);
      datos.set("actual", JSON.stringify(grados ?? confirmados));
      for (const f of await Promise.all(fotos.map((x) => reducirImagen(x)))) datos.append("fotos", f);

      setFase("leyendo");

      const r = await leerRecordLiceo(INICIAL, datos);

      setFase(null);
      setEstado(r);
      if (r.estado === "ok" && r.grados) setGrados(r.grados);
      if (entrada.current) entrada.current.value = "";
    });
  }

  function confirmar() {
    empezar(async () => {
      const datos = new FormData();

      datos.set("estudiante", estudianteId);
      datos.set("grados", JSON.stringify(grados));

      const r = await confirmarRecordLiceo(INICIAL, datos);

      setEstado(r);
      if (r.estado === "ok") setGrados(null);
    });
  }

  function quitar() {
    empezar(async () => {
      const datos = new FormData();

      datos.set("estudiante", estudianteId);

      const r = await quitarRecordLiceo(INICIAL, datos);

      setEstado(r);
      setPidiendoQuitar(false);
      if (r.estado === "ok") setGrados(null);
    });
  }

  function descartar() {
    empezar(async () => {
      const datos = new FormData();

      datos.set("estudiante", estudianteId);
      await descartarBorradorRecordLiceo(INICIAL, datos);
      setGrados(null);
      setEstado(INICIAL);
    });
  }

  const mensajeError = estado.estado !== "inicial" && estado.estado !== "ok" ? t(`errors.${estado.estado}`) : null;

  return (
    <div className="space-y-4">
      <input ref={entrada} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => subirFotos(e.target.files)} />

      {!editando && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {/* Una acción principal grande, como la cabina del chofer: lo primero que se ve es qué hacer. */}
            <Button type="button" size="lg" onClick={() => entrada.current?.click()} cargando={ocupado}>
              <Camera className="size-5" />
              {t("actions.photo")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setGrados(confirmados.length > 0 ? structuredClone(confirmados) : [GRADO_VACIO(1)])}>
              <PencilLine className="size-4" />
              {confirmados.length > 0 ? t("actions.edit") : t("actions.manual")}
            </Button>
            {confirmados.length > 0 && !pidiendoQuitar && (
              <Button type="button" variant="ghost" onClick={() => setPidiendoQuitar(true)}>
                <Trash2 className="size-4" />
                {t("actions.remove")}
              </Button>
            )}
          </div>
          {pidiendoQuitar && (
            <div role="alertdialog" aria-label={t("remove.title")} className={ALERTA_RIESGO.contenedor}>
              <AlertCircle className={ALERTA_RIESGO.icono} />
              <div className="space-y-2">
                <p className={ALERTA_RIESGO.texto}>{t("remove.confirm")}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={quitar} cargando={ocupado}>
                    <Trash2 className="size-4" />
                    {t("remove.yes")}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setPidiendoQuitar(false)}>
                    {t("remove.no")}
                  </Button>
                </div>
              </div>
            </div>
          )}
          <p className="texto-meta">{t("photoHint")}</p>
        </div>
      )}

      {fase && (
        <p role="status" className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="size-4 animate-spin" />
          {fase === "preparando" ? t("editor.preparing") : t("editor.reading")}
        </p>
      )}

      {mensajeError && (
        <p role="alert" className={ALERTA_RIESGO.contenedor}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>{mensajeError}</span>
        </p>
      )}

      {estado.estado === "ok" && estado.promedioGlobal !== undefined && (
        <p role="status" className="flex items-start gap-2 text-sm font-medium">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-marca-700" />
          {t("editor.saved", { general: estado.promedioGlobal?.toFixed(2) ?? "—", byYear: estado.promedioAnual?.toFixed(2) ?? "—" })}
        </p>
      )}

      {editando && (
        <div className="space-y-4">
          <div>
            <h3 className="texto-titulo-tarjeta">{t("editor.title")}</h3>
            <p className="texto-meta">{t("editor.help")}</p>
          </div>

          {estado.estado === "ok" && estado.leidas !== undefined && (
            <ul className="space-y-1 text-sm">
              <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-marca-700" />{t("editor.read", { count: estado.leidas })}</li>
              {(estado.descartadas ?? 0) > 0 && <li className="flex items-start gap-2"><AlertCircle className="mt-0.5 size-4 shrink-0 text-tinta-3" />{t("editor.discarded", { count: estado.descartadas ?? 0 })}</li>}
              {(estado.avisos ?? []).map((a) => <li key={a} className="flex items-start gap-2"><AlertCircle className="mt-0.5 size-4 shrink-0 text-tinta-3" />{t(`warnings.${a}`)}</li>)}
            </ul>
          )}

          {pendientes.sinNota > 0 && <p className={ALERTA_RIESGO.contenedor}><AlertCircle className={ALERTA_RIESGO.icono} /><span className={ALERTA_RIESGO.texto}>{t("editor.missing", { count: pendientes.sinNota })}</span></p>}
          {pendientes.dudosas > 0 && <p className="flex items-start gap-2 text-sm"><AlertCircle className="mt-0.5 size-4 shrink-0 text-tinta-3" />{t("editor.doubtful", { count: pendientes.dudosas })}</p>}

          {grados.map((g, i) => (
            <TablaGradoLiceo
              key={i}
              indice={i}
              valor={g}
              onCambio={(nuevo) => setGrados(grados.map((x, j) => (j === i ? nuevo : x)))}
              onQuitar={() => setGrados(grados.filter((_, j) => j !== i))}
            />
          ))}

          <div className="flex flex-wrap gap-2">
            {grados.length < MAXIMO_GRADOS && (
              <Button type="button" variant="outline" size="sm" onClick={() => setGrados([...grados, GRADO_VACIO(Math.min(6, (grados.at(-1)?.grado ?? 0) + 1))])}>
                <Plus className="size-4" />
                {t("actions.addGrade")}
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => entrada.current?.click()} cargando={ocupado}>
              <Camera className="size-4" />
              {t("actions.morePhotos")}
            </Button>
          </div>

          <div className="rounded-card bg-muted p-4">
            <p className="texto-meta mb-2 font-medium">{t("editor.preview")}</p>
            {promedios && promedios.global !== null ? (
              <div className="flex flex-wrap gap-x-10 gap-y-3">
                <div><p className="text-2xl leading-none font-bold tabular-nums">{promedios.global.toFixed(2)}</p><p className="texto-meta mt-1">{t("general")} · {t("notesCount", { count: promedios.totalNotas })}</p></div>
                <div><p className="text-2xl leading-none font-bold tabular-nums">{promedios.anual?.toFixed(2) ?? "—"}</p><p className="texto-meta mt-1">{t("byYear")}</p></div>
              </div>
            ) : (
              <p className="text-sm">{t("editor.previewEmpty")}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={confirmar} cargando={ocupado} disabled={pendientes.sinNota > 0}>
              <Save className="size-4" />
              {t("actions.confirm")}
            </Button>
            <Button type="button" variant="ghost" onClick={descartar} cargando={ocupado}>
              <X className="size-4" />
              {t("actions.discard")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
