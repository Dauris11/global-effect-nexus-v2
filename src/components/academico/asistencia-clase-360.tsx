"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  Save,
  Trash2,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Dato, FilaDatos } from "@/components/ui/dato";
import { Input } from "@/components/ui/input";
import { Interruptor } from "@/components/ui/interruptor";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/routing";
import { fechaCorta } from "@/lib/fechas";
import { ALERTA_RIESGO } from "@/lib/paleta";
import {
  borrarSesion360,
  guardarSesion360,
  marcarAsistencia360,
  type EstadoSesion360,
} from "@/server/profesor/acciones-asistencia";
import type {
  MarcaAsistencia,
  PeriodoDeClase360,
  SesionClase360,
} from "@/server/profesor/asistencia";

const SELECTOR =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 rounded-control h-11 w-full border bg-card px-3 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm";

/**
 * Asistencia de una clase: sus sesiones del período y, al abrir una, la lista
 * de inscritos con un interruptor presente/ausente.
 *
 * Administración (`puedeProgramar`) además programa, edita y borra sesiones; el
 * profesor solo marca. Los permisos se vuelven a comprobar en las acciones:
 * esconder el formulario aquí no es control de acceso.
 */
export function AsistenciaClase360({
  materiaId,
  sesiones,
  marcas,
  periodos,
  puedeProgramar,
}: {
  materiaId: string;
  sesiones: readonly SesionClase360[];
  marcas: Record<string, MarcaAsistencia[]>;
  periodos: readonly PeriodoDeClase360[];
  puedeProgramar: boolean;
}) {
  const t = useTranslations("academic.classes360");
  const idioma = useLocale() as Locale;
  const [abierta, setAbierta] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<SesionClase360 | "nueva" | null>(null);
  const [error, setError] = useState<EstadoSesion360 | null>(null);
  const [borrando, iniciarBorrado] = useTransition();

  function borrar(id: string) {
    setError(null);
    iniciarBorrado(async () => {
      const { estado } = await borrarSesion360(id);
      if (estado !== "ok") setError(estado);
      else if (abierta === id) setAbierta(null);
    });
  }

  return (
    <div className="border-linea mt-3 space-y-3 border-t pt-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarCheck className="size-4" aria-hidden />
          {t("attendance")}
        </h3>

        {puedeProgramar && formulario === null && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setFormulario("nueva")}>
            <CalendarPlus className="size-3.5" />
            {t("scheduleSession")}
          </Button>
        )}
      </div>

      {puedeProgramar && formulario !== null && (
        <FormularioSesion
          materiaId={materiaId}
          periodos={periodos}
          sesion={formulario === "nueva" ? null : formulario}
          alTerminar={() => setFormulario(null)}
        />
      )}

      {error && <Aviso estado={error} />}

      {sesiones.length === 0 ? (
        <p className="text-tinta-3 py-3 text-center text-xs">{t("noSessions")}</p>
      ) : (
        <ul className="space-y-2">
          {sesiones.map((sesion) => (
            <li key={sesion.id} className="bg-muted/40 rounded-card px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-expanded={abierta === sesion.id}
                  aria-label={abierta === sesion.id ? t("closeSession") : t("openSession")}
                  onClick={() => setAbierta(abierta === sesion.id ? null : sesion.id)}
                  className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronDown
                    aria-hidden
                    className={`size-4 shrink-0 transition-transform ${abierta === sesion.id ? "rotate-180" : ""}`}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {fechaCorta(sesion.fecha, idioma)}
                    </span>
                    <FilaDatos>
                      {sesion.hora_inicio && (
                        <Dato icono={CalendarClock}>
                          {sesion.hora_fin
                            ? `${sesion.hora_inicio} – ${sesion.hora_fin}`
                            : sesion.hora_inicio}
                        </Dato>
                      )}
                      <Dato icono={UserCheck}>{t("presentCount", { n: sesion.presentes })}</Dato>
                      <Dato icono={UserX}>{t("absentCount", { n: sesion.ausentes })}</Dato>
                    </FilaDatos>
                  </span>
                </button>

                {puedeProgramar && (
                  <div className="flex shrink-0 items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title={t("editSession")}
                      aria-label={t("editSession")}
                      onClick={() => setFormulario(sesion)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title={t("deleteSession")}
                      aria-label={t("deleteSession")}
                      disabled={borrando}
                      onClick={() => borrar(sesion.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {abierta === sesion.id && (
                <ListaAsistencia sesionId={sesion.id} marcas={marcas[sesion.id] ?? []} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Los inscritos de una sesión. El cambio se pinta al instante y se revierte si
 * el servidor lo rechaza: marcar a veinte alumnos con un viaje de ida y vuelta
 * por cada toque se siente roto.
 */
function ListaAsistencia({
  sesionId,
  marcas,
}: {
  sesionId: string;
  marcas: readonly MarcaAsistencia[];
}) {
  const t = useTranslations("academic.classes360");
  const [valores, setValores] = useState<Record<string, boolean | null>>(() =>
    Object.fromEntries(marcas.map((m) => [m.inscripcion_id, m.presente])),
  );
  const [falla, setFalla] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function marcar(ids: string[] | undefined, presente: boolean) {
    const anterior = valores;
    const objetivo = ids ?? marcas.map((m) => m.inscripcion_id);

    setFalla(false);
    setEnviando(true);
    setValores({ ...valores, ...Object.fromEntries(objetivo.map((id) => [id, presente])) });

    const { estado } = await marcarAsistencia360({
      sesionId,
      presente,
      inscripcionIds: ids,
    });

    if (estado !== "ok") {
      setValores(anterior);
      setFalla(true);
    }
    setEnviando(false);
  }

  if (marcas.length === 0) {
    return <p className="text-tinta-3 pt-2 text-center text-xs">{t("noStudents")}</p>;
  }

  return (
    <div className="border-linea mt-2 space-y-2 border-t pt-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={enviando}
        onClick={() => marcar(undefined, true)}
      >
        {enviando ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        {t("markAllPresent")}
      </Button>

      {falla && (
        <p role="alert" className={ALERTA_RIESGO.contenedor}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>{t("markError")}</span>
        </p>
      )}

      <ul className="divide-linea divide-y">
        {marcas.map((m) => {
          const valor = valores[m.inscripcion_id] ?? null;
          return (
            <li key={m.inscripcion_id} className="flex items-center gap-3 py-1.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{m.nombre}</span>
                <span className="text-tinta-3 text-xs">
                  {valor === null ? t("unmarked") : valor ? t("present") : t("absent")}
                </span>
              </span>
              <Interruptor
                activo={valor === true}
                etiqueta={t("markFor", { nombre: m.nombre })}
                onCambio={(activo) => marcar([m.inscripcion_id], activo)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Programar una sesión nueva o editar fecha y hora de una existente. */
function FormularioSesion({
  materiaId,
  periodos,
  sesion,
  alTerminar,
}: {
  materiaId: string;
  periodos: readonly PeriodoDeClase360[];
  sesion: SesionClase360 | null;
  alTerminar: () => void;
}) {
  const t = useTranslations("academic.classes360");
  const [periodoId, setPeriodoId] = useState(sesion?.periodo_id ?? periodos[0]?.id ?? "");
  const [error, setError] = useState<EstadoSesion360 | null>(null);
  const [enviando, iniciar] = useTransition();
  const periodo = periodos.find((p) => p.id === periodoId);

  if (periodos.length === 0) {
    return <p className="text-tinta-3 text-center text-xs">{t("noTerms")}</p>;
  }

  function enviar(datos: FormData) {
    setError(null);
    iniciar(async () => {
      const { estado } = await guardarSesion360({
        id: sesion?.id,
        materiaId,
        periodoId,
        fecha: String(datos.get("fecha") ?? ""),
        horaInicio: String(datos.get("hora_inicio") ?? ""),
        horaFin: String(datos.get("hora_fin") ?? ""),
      });
      if (estado === "ok") alTerminar();
      else setError(estado);
    });
  }

  const clave = sesion?.id ?? "nueva";

  return (
    <form action={enviar} className="rounded-card border-linea space-y-3 border p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor={`s-periodo-${clave}`}>{t("fieldTerm")}</Label>
          <select
            id={`s-periodo-${clave}`}
            value={periodoId}
            disabled={sesion !== null}
            onChange={(e) => setPeriodoId(e.target.value)}
            className={SELECTOR}
          >
            {periodos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`s-fecha-${clave}`}>{t("fieldDate")}</Label>
          <Input
            id={`s-fecha-${clave}`}
            name="fecha"
            type="date"
            required
            min={periodo?.fecha_inicio}
            max={periodo?.fecha_fin}
            defaultValue={sesion?.fecha}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`s-inicio-${clave}`}>{t("fieldStart")}</Label>
          <Input
            id={`s-inicio-${clave}`}
            name="hora_inicio"
            type="time"
            defaultValue={sesion?.hora_inicio ?? ""}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`s-fin-${clave}`}>{t("fieldEnd")}</Label>
          <Input
            id={`s-fin-${clave}`}
            name="hora_fin"
            type="time"
            defaultValue={sesion?.hora_fin ?? ""}
          />
        </div>
      </div>

      {error && <Aviso estado={error} />}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={enviando}>
          {enviando ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          {t("saveSession")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={alTerminar}>
          <X className="size-3.5" />
          {t("closeSession")}
        </Button>
      </div>
    </form>
  );
}

function Aviso({ estado }: { estado: EstadoSesion360 }) {
  const t = useTranslations("academic.classes360");

  return (
    <p role="alert" className={ALERTA_RIESGO.contenedor}>
      <AlertCircle className={ALERTA_RIESGO.icono} />
      <span className={ALERTA_RIESGO.texto}>{t(`sessionError.${estado}`)}</span>
    </p>
  );
}
