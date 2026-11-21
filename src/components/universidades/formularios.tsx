"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { textoDePuntos } from "@/lib/indice-academico";
import { ALERTA_RIESGO } from "@/lib/paleta";
import {
  cargarMateriasPensum,
  guardarCarrera,
  guardarPensum,
  guardarUniversidad,
  quitarMateriaPensum,
  type EstadoCatalogo,
} from "@/server/universidades/acciones";

/**
 * Los formularios del catálogo. Comparten el mismo esqueleto —abrir, enviar,
 * decir qué falló— así que el cascarón es uno solo y cada formulario aporta sus
 * campos.
 */

const INICIAL: EstadoCatalogo = { estado: "inicial" };

export const CLASE_SELECT =
  "h-11 w-full rounded-control border border-linea-fuerte bg-background px-3 text-base text-tinta outline-none focus-visible:border-tinta focus-visible:ring-1 focus-visible:ring-tinta sm:text-[15px]";

export function MensajeEstado({ estado }: { estado: EstadoCatalogo }) {
  const t = useTranslations("catalog");

  if (estado.estado === "inicial") return null;

  if (estado.estado === "ok") {
    return estado.cargadas === undefined ? null : (
      <p role="status" className="flex items-start gap-2 text-sm text-tinta">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-marca-700" />
        <span>
          {t("pensum.loaded", { count: estado.cargadas })}
          {estado.rechazadas && estado.rechazadas.length > 0 && ` ${t("pensum.rejected", { lines: estado.rechazadas.slice(0, 15).join(", ") })}`}
        </span>
      </p>
    );
  }

  return (
    <p role="alert" className={ALERTA_RIESGO.contenedor}>
      <AlertCircle className={ALERTA_RIESGO.icono} />
      <span className={ALERTA_RIESGO.texto}>
        {t(`errors.${estado.estado}`)}
        {estado.rechazadas && estado.rechazadas.length > 0 && ` ${t("pensum.rejected", { lines: estado.rechazadas.slice(0, 15).join(", ") })}`}
      </span>
    </p>
  );
}

function Cascaron({
  accion,
  etiquetaBoton,
  alTerminar,
  children,
  limpiar,
}: {
  accion: (p: EstadoCatalogo, d: FormData) => Promise<EstadoCatalogo>;
  etiquetaBoton: string;
  alTerminar?: () => void;
  limpiar?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("catalog");
  const [estado, enviar, enviando] = useActionState<EstadoCatalogo, FormData>(async (previo, datos) => {
    const r = await accion(previo, datos);

    if (r.estado === "ok") alTerminar?.();

    return r;
  }, INICIAL);

  return (
    <form action={enviar} className="space-y-3 rounded-card border border-linea bg-card p-4" key={limpiar ? String(estado.estado === "ok") : undefined}>
      {children}
      <MensajeEstado estado={estado} />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={enviando}>
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {etiquetaBoton}
        </Button>
        {alTerminar && (
          <Button type="button" variant="ghost" size="sm" onClick={alTerminar}>
            <X className="size-4" />
            {t("cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}

function Campo({ id, etiqueta, children }: { id: string; etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
    </div>
  );
}

/** Botón que abre un formulario en el sitio, para altas y ediciones. */
function Desplegable({ etiqueta, icono, children }: { etiqueta: string; icono?: boolean; children: (cerrar: () => void) => React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);

  return abierto ? (
    children(() => setAbierto(false))
  ) : (
    <Button type="button" size="sm" variant={icono ? "default" : "outline"} onClick={() => setAbierto(true)}>
      {icono && <Plus className="size-4" />}
      {etiqueta}
    </Button>
  );
}

export function FormUniversidad({
  universidad,
}: {
  universidad?: {
    id: string; siglas: string; nombre: string; regimen: string; activa: boolean;
    logo: string | null;
    puntos_por_letra: Record<string, number>; letra_minima_aprobar: string;
    retirada_cuenta_en_divisor: boolean; redondeo_indice: string; reglas_confirmadas: boolean;
    indice_maximo: number | null; indice_minimo_periodo: number | null; indice_minimo_acumulado: number | null;
  };
}) {
  const t = useTranslations("catalog");
  const k = universidad?.id ?? "nueva";

  return (
    <Desplegable etiqueta={universidad ? t("edit") : t("university.new")} icono={!universidad}>
      {(cerrar) => (
        <Cascaron accion={guardarUniversidad} etiquetaBoton={t("save")} alTerminar={cerrar}>
          <input type="hidden" name="id" value={universidad?.id ?? ""} />
          <div className="grid gap-3 sm:grid-cols-4">
            <Campo id={`u-siglas-${k}`} etiqueta={t("university.acronym")}>
              <Input id={`u-siglas-${k}`} name="siglas" defaultValue={universidad?.siglas} required maxLength={20} />
            </Campo>
            <div className="sm:col-span-2">
              <Campo id={`u-nombre-${k}`} etiqueta={t("university.name")}>
                <Input id={`u-nombre-${k}`} name="nombre" defaultValue={universidad?.nombre} required maxLength={160} />
              </Campo>
            </div>
            <Campo id={`u-regimen-${k}`} etiqueta={t("university.regime")}>
              <select id={`u-regimen-${k}`} name="regimen" defaultValue={universidad?.regimen ?? "cuatrimestre"} className={CLASE_SELECT}>
                {(["cuatrimestre", "trimestre", "semestre"] as const).map((r) => (
                  <option key={r} value={r}>{t(`regime.${r}`)}</option>
                ))}
              </select>
            </Campo>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`u-logo-${k}`}>{t("logo.label")}</Label>
            <input id={`u-logo-${k}`} name="logo" type="file" accept="image/png,image/jpeg,image/webp"
              className="block w-full text-sm file:mr-3 file:rounded-control file:border file:border-linea-fuerte file:bg-background file:px-3 file:py-2 file:text-sm file:font-medium" />
            <p className="texto-meta">{t("logo.help")}</p>
            {universidad?.logo && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="quitar_logo" value="si" className="size-4" />
                {t("logo.remove")}
              </label>
            )}
          </div>
          <p className="text-sm font-semibold">{t("rules.title")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo id={`u-puntos-${k}`} etiqueta={t("rules.points")}>
              <Input id={`u-puntos-${k}`} name="puntos" required maxLength={200}
                defaultValue={universidad ? textoDePuntos(universidad.puntos_por_letra) : "A=4, B=3, C=2, D=1, F=0"} />
            </Campo>
            <Campo id={`u-minima-${k}`} etiqueta={t("rules.minLetter")}>
              <Input id={`u-minima-${k}`} name="letra_minima" required maxLength={3} defaultValue={universidad?.letra_minima_aprobar ?? "D"} />
            </Campo>
            <Campo id={`u-retirada-${k}`} etiqueta={t("rules.withdrawn")}>
              <select id={`u-retirada-${k}`} name="retirada" defaultValue={universidad && !universidad.retirada_cuenta_en_divisor ? "no" : "si"} className={CLASE_SELECT}>
                <option value="si">{t("rules.withdrawnYes")}</option>
                <option value="no">{t("rules.withdrawnNo")}</option>
              </select>
            </Campo>
            <Campo id={`u-redondeo-${k}`} etiqueta={t("rules.rounding")}>
              <select id={`u-redondeo-${k}`} name="redondeo" defaultValue={universidad?.redondeo_indice ?? "truncar"} className={CLASE_SELECT}>
                <option value="truncar">{t("rules.truncate")}</option>
                <option value="redondear">{t("rules.round")}</option>
              </select>
            </Campo>
          </div>
          <p className="text-sm font-semibold">{t("rules.alertsTitle")}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo id={`u-maximo-${k}`} etiqueta={t("rules.maxIndex")}>
              <Input id={`u-maximo-${k}`} name="indice_maximo" inputMode="decimal" maxLength={5} defaultValue={universidad?.indice_maximo ?? ""} />
            </Campo>
            <Campo id={`u-minper-${k}`} etiqueta={t("rules.minPeriod")}>
              <Input id={`u-minper-${k}`} name="minimo_periodo" inputMode="decimal" maxLength={5} defaultValue={universidad?.indice_minimo_periodo ?? ""} />
            </Campo>
            <Campo id={`u-minacu-${k}`} etiqueta={t("rules.minOverall")}>
              <Input id={`u-minacu-${k}`} name="minimo_acumulado" inputMode="decimal" maxLength={5} defaultValue={universidad?.indice_minimo_acumulado ?? ""} />
            </Campo>
          </div>
          <p className="texto-meta">{t("rules.alertsHelp")}</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirmadas" value="si" defaultChecked={universidad?.reglas_confirmadas} className="size-4" />
            {t("rules.confirmed")}
          </label>
          <p className="texto-meta">{t("rules.help")}</p>
          {universidad && (
            <Campo id={`u-activa-${k}`} etiqueta={t("university.status")}>
              <select id={`u-activa-${k}`} name="activa" defaultValue={universidad.activa ? "si" : "no"} className={CLASE_SELECT}>
                <option value="si">{t("status.active")}</option>
                <option value="no">{t("status.inactive")}</option>
              </select>
            </Campo>
          )}
        </Cascaron>
      )}
    </Desplegable>
  );
}

export function FormCarrera({
  universidadId,
  carrera,
}: {
  universidadId: string;
  carrera?: { id: string; nombre: string; activa: boolean };
}) {
  const t = useTranslations("catalog");
  const k = carrera?.id ?? "nueva";

  return (
    <Desplegable etiqueta={carrera ? t("edit") : t("career.new")} icono={!carrera}>
      {(cerrar) => (
        <Cascaron accion={guardarCarrera} etiquetaBoton={t("save")} alTerminar={cerrar}>
          <input type="hidden" name="id" value={carrera?.id ?? ""} />
          <input type="hidden" name="universidad" value={universidadId} />
          <Campo id={`c-nombre-${k}`} etiqueta={t("career.name")}>
            <Input id={`c-nombre-${k}`} name="nombre" defaultValue={carrera?.nombre} required maxLength={160} />
          </Campo>
          {carrera && (
            <Campo id={`c-activa-${k}`} etiqueta={t("university.status")}>
              <select id={`c-activa-${k}`} name="activa" defaultValue={carrera.activa ? "si" : "no"} className={CLASE_SELECT}>
                <option value="si">{t("status.active")}</option>
                <option value="no">{t("status.inactive")}</option>
              </select>
            </Campo>
          )}
        </Cascaron>
      )}
    </Desplegable>
  );
}

export function FormPensum({
  carreraId,
  pensum,
}: {
  carreraId: string;
  pensum?: { id: string; version: string; vigente: boolean };
}) {
  const t = useTranslations("catalog");
  const k = pensum?.id ?? "nuevo";

  return (
    <Desplegable etiqueta={pensum ? t("edit") : t("pensum.new")} icono={!pensum}>
      {(cerrar) => (
        <Cascaron accion={guardarPensum} etiquetaBoton={t("save")} alTerminar={cerrar}>
          <input type="hidden" name="id" value={pensum?.id ?? ""} />
          <input type="hidden" name="carrera" value={carreraId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo id={`p-version-${k}`} etiqueta={t("pensum.version")}>
              <Input id={`p-version-${k}`} name="version" defaultValue={pensum?.version} placeholder="2022" required maxLength={40} />
            </Campo>
            <Campo id={`p-vigente-${k}`} etiqueta={t("pensum.currentLabel")}>
              <select id={`p-vigente-${k}`} name="vigente" defaultValue={pensum && !pensum.vigente ? "no" : "si"} className={CLASE_SELECT}>
                <option value="si">{t("pensum.current")}</option>
                <option value="no">{t("pensum.old")}</option>
              </select>
            </Campo>
          </div>
        </Cascaron>
      )}
    </Desplegable>
  );
}

export function FormCargaMaterias({ pensumId }: { pensumId: string }) {
  const t = useTranslations("catalog");

  return (
    <Cascaron accion={cargarMateriasPensum} etiquetaBoton={t("pensum.loadButton")} limpiar>
      <input type="hidden" name="pensum" value={pensumId} />
      <Campo id="carga-lista" etiqueta={t("pensum.load")}>
        <Textarea id="carga-lista" name="lista" required rows={6} placeholder={t("pensum.loadPlaceholder")} className="font-mono text-sm" />
      </Campo>
      {/* Lee un .csv/.txt (p. ej. exportado de Excel con «;») y lo pone en el cuadro
          para revisarlo antes de cargar. No sube el archivo al servidor. */}
      <div className="space-y-1.5">
        <Label htmlFor="carga-archivo">{t("pensum.fromFile")}</Label>
        <input id="carga-archivo" type="file" accept=".csv,.txt,.tsv,text/plain,text/csv"
          className="block w-full text-sm file:mr-3 file:rounded-control file:border file:border-linea-fuerte file:bg-background file:px-3 file:py-2 file:text-sm file:font-medium"
          onChange={async (e) => {
            const archivo = e.target.files?.[0];
            const cuadro = document.getElementById("carga-lista") as HTMLTextAreaElement | null;

            if (archivo && cuadro && archivo.size <= 200_000) cuadro.value = await archivo.text();
          }} />
      </div>
      <p className="texto-meta">{t("pensum.loadHelp")}</p>
    </Cascaron>
  );
}

export function BotonQuitarMateria({ id, nombre }: { id: string; nombre: string }) {
  const t = useTranslations("catalog");
  const [, enviar, enviando] = useActionState<EstadoCatalogo, FormData>(quitarMateriaPensum, INICIAL);

  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="sm" disabled={enviando} aria-label={t("pensum.remove", { name: nombre })}>
        {enviando ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </Button>
    </form>
  );
}
