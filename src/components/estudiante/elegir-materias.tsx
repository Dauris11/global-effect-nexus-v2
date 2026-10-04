"use client";

import { useActionState } from "react";
import {
  AlertCircle,
  BookOpen,
  CalendarClock,
  Check,
  Clock,
  Loader2,
  MapPin,
  Plus,
  User,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { visualDeInscripcion } from "@/components/estudiante/prematricula-estado";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { ALERTA_RIESGO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  type EstadoMatricula,
  inscribirseEnMateria,
  quitarseDeMateria,
} from "@/server/estudiantes/acciones-matricula";
import type { MateriaOfertada } from "@/server/estudiantes/academico";

/**
 * El estudiante elige sus materias del período, mientras la ventana esté
 * abierta.
 *
 * Esta pantalla era de solo lectura y decía, con razón, que apuntarse solo
 * "sería otra decisión, no una pantalla más". Esa decisión ya se tomó: se abre,
 * pero **solo dentro de la ventana de prematrícula** que configura coordinación,
 * que es lo que hace que sea una matrícula y no un formulario libre.
 *
 * El botón desaparece en cuanto la ventana cierra, pero eso NO es lo que
 * protege la matrícula: la ventana se comprueba dentro del propio INSERT, en la
 * base. Esconder un botón no impide nada; aquí solo evita ofrecer algo que va a
 * fallar.
 *
 * Cada materia lleva su propio formulario y su propio estado de envío. Con un
 * formulario único y un campo oculto, pulsar en una fila dejaría las diez
 * ocupadas a la vez, que es exactamente la duda que no se quiere sembrar
 * cuando alguien está eligiendo su cuatrimestre.
 */
export function ElegirMaterias({
  materias,
  periodo,
  abierta,
  esBecado,
}: {
  materias: readonly MateriaOfertada[];
  /** Nombre del período de la ventana, para decir de cuál se habla. */
  periodo: string;
  /** Si la ventana está abierta AHORA. Lo calcula la base, no el navegador. */
  abierta: boolean;
  esBecado: boolean;
}) {
  const t = useTranslations("studentPortal");

  const elegidas = materias.filter(
    (materia) => materia.estado_inscripcion === "activa",
  );
  const creditos = elegidas.reduce(
    (total, materia) => total + (materia.creditos ?? 0),
    0,
  );

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="texto-titulo-seccion">{t("subjectsPage.enrol.title")}</h2>
          <Badge variant={abierta ? "marca" : "neutra"}>
            <CalendarClock aria-hidden />
            {abierta
              ? t("subjectsPage.enrol.windowOpen")
              : t("subjectsPage.enrol.windowSoon")}
          </Badge>
        </div>

        <p className="texto-meta font-medium">
          {t("subjectsPage.enrol.forTerm", { periodo })}
        </p>
        <p className="max-w-2xl text-sm text-tinta-2">
          {abierta
            ? t("subjectsPage.enrol.hint")
            : t("subjectsPage.enrol.windowClosedHint")}
        </p>
      </div>

      {!esBecado && (
        <p className={ALERTA_RIESGO.contenedor}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>
            {t("subjectsPage.enrol.onlyScholar")}
          </span>
        </p>
      )}

      {materias.length === 0 ? (
        <EstadoVacio icono={BookOpen} titulo={t("subjectsPage.enrol.catalogEmpty")} />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {materias.map((materia) => (
              <TarjetaOferta
                key={materia.id}
                materia={materia}
                puedeElegir={abierta && esBecado}
              />
            ))}
          </ul>

          {/* La barra de abajo, como el resumen de una reserva: cuántas lleva y
              cuántos créditos suman, siempre a la vista mientras elige. No
              tiene "Guardar" porque no hay nada que guardar: cada materia se
              inscribe al pulsar su botón. En el teléfono se apoya encima de la
              barra de pestañas (h-16) en vez de quedar tapada por ella. */}
          <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-linea bg-background/95 px-4 py-4 backdrop-blur-md md:bottom-0 md:mx-0 md:px-0">
            <div className="min-w-0">
              <p className="font-semibold text-tinta">
                {t("subjectsPage.enrol.chosen", { count: elegidas.length })}
              </p>
              <p className="texto-meta">
                {t("subjectsPage.enrol.chosenCredits", { credits: creditos })}
              </p>
            </div>

            {/* Se dice en voz alta que no hay tope, en vez de dejar que alguien
                lo suponga: la base no tiene ni cupos ni máximo de créditos, y
                un número inventado aquí sería una norma académica inventada. */}
            <p className="texto-meta max-w-md md:text-right">
              {t("subjectsPage.enrol.noLimitHint")}
            </p>
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Una materia del catálogo, como tarjeta de anuncio: no tiene foto, así que el
 * hueco lleva un icono grande en círculo, con su estado arriba a la izquierda
 * y el botón al pie.
 */
function TarjetaOferta({
  materia,
  puedeElegir,
}: {
  materia: MateriaOfertada;
  puedeElegir: boolean;
}) {
  const t = useTranslations("studentPortal");

  const elegida = materia.estado_inscripcion === "activa";
  // Una materia ya cerrada —aprobada, reprobada, retirada— no se toca desde
  // aquí: eso es historial y lo mueve coordinación.
  const cerrada =
    materia.estado_inscripcion !== null &&
    materia.estado_inscripcion !== "activa";

  const visual = visualDeInscripcion(materia.estado_inscripcion);
  const IconoEstado = visual.icono;

  return (
    <li className="flex flex-col">
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-card bg-muted">
        <span
          className={cn(
            "flex size-16 items-center justify-center rounded-full bg-background shadow-card",
            elegida ? "text-marca-600" : "text-tinta-2",
          )}
        >
          {elegida ? <Check className="size-7" /> : <BookOpen className="size-7" />}
        </span>

        {materia.estado_inscripcion !== null && (
          <Badge className={cn("absolute top-3 left-3 shadow-card", visual.clases)}>
            <IconoEstado aria-hidden />
            {t(`subjectsPage.status.${materia.estado_inscripcion}` as never)}
          </Badge>
        )}
      </div>

      <p className="texto-titulo-tarjeta mt-3 line-clamp-2">{materia.nombre}</p>
      <p className="truncate text-sm text-tinta-2">
        {[
          materia.codigo,
          materia.creditos !== null
            ? t("creditsShort", { count: materia.creditos })
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {/* Horario, aula y profesor solo si existen: son opcionales en la
          materia y una línea de guiones no informa de nada. */}
      {(materia.horario || materia.aula || materia.profesor) && (
        <div className="texto-meta mt-2 flex flex-col gap-1">
          {materia.horario && (
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 shrink-0" />
              <span className="truncate">{materia.horario}</span>
            </span>
          )}
          {materia.aula && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{materia.aula}</span>
            </span>
          )}
          {materia.profesor && (
            <span className="flex items-center gap-1.5">
              <User className="size-3.5 shrink-0" />
              <span className="truncate">{materia.profesor}</span>
            </span>
          )}
        </div>
      )}

      {!cerrada && puedeElegir && (
        <div className="mt-3">
          <BotonMatricula id={materia.id} elegida={elegida} />
        </div>
      )}
    </li>
  );
}

/**
 * Inscribirse o quitarse de una materia.
 *
 * Un solo componente para las dos acciones porque son la misma decisión vista
 * desde los dos lados, y separarlos duplicaría el manejo de errores —que es lo
 * único con enjundia aquí— en dos sitios que tendrían que decir lo mismo.
 */
function BotonMatricula({ id, elegida }: { id: string; elegida: boolean }) {
  const t = useTranslations("studentPortal");
  const [estado, enviar, enviando] = useActionState<EstadoMatricula, FormData>(
    elegida ? quitarseDeMateria : inscribirseEnMateria,
    { estado: "inicial" },
  );

  const fallo = estado.estado !== "inicial" && estado.estado !== "ok";

  return (
    <form action={enviar} className="flex flex-col gap-1.5">
      <input type="hidden" name="materia" value={id} />

      <Button
        type="submit"
        variant={elegida ? "secondary" : "default"}
        disabled={enviando}
        className="w-full"
      >
        {enviando ? (
          <Loader2 className="animate-spin" />
        ) : elegida ? (
          <X />
        ) : (
          <Plus />
        )}
        {enviando
          ? elegida
            ? t("subjectsPage.enrol.removing")
            : t("subjectsPage.enrol.adding")
          : elegida
            ? t("subjectsPage.enrol.remove")
            : t("subjectsPage.enrol.add")}
      </Button>

      {fallo && (
        <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-tinta">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          {estado.estado === "cerrada"
            ? t("subjectsPage.enrol.errClosed")
            : estado.estado === "repetida"
              ? t("subjectsPage.enrol.errRepeated")
              : estado.estado === "no_becado"
                ? t("subjectsPage.enrol.errNotScholar")
                : estado.estado === "sin_ficha"
                  ? t("subjectsPage.enrol.errNoRecord")
                  : estado.estado === "bloqueada"
                    ? t("subjectsPage.enrol.errLocked")
                    : t("subjectsPage.enrol.errGeneric")}
        </p>
      )}
    </form>
  );
}
