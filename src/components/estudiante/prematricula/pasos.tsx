"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Check, ChevronLeft, ChevronRight, CircleDashed, GraduationCap, Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import { useToast } from "@/components/app/toaster";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { Materia360Matricula } from "@/lib/moodle";
import { cn } from "@/lib/utils";
import type { MateriaOfertada } from "@/server/estudiantes/academico";
import { quitarseDeMateria, inscribirseEnMateria } from "@/server/estudiantes/acciones-matricula";
import { prematricular, retirarPrematricula } from "@/server/global360/acciones";
import type { TandaDelEstudiante } from "@/server/global360/consultas";

export type DatosPrematricula = {
  periodo: string;
  /** Tanda que abre la ventana (1 o 2) y si está abierta AHORA (lo decide la base). */
  ronda: 1 | 2;
  abierta: boolean;
  /** Ya formateados en hora de La Vega: «Cierra el 27 nov, 6:00 p. m.». */
  plazo: string;
  mensaje: string | null;
  tandas: TandaDelEstudiante[];
  materias360: Materia360Matricula[];
  oferta: MateriaOfertada[];
  topeCreditos: number;
  universidadPauta: string | null;
};

const PASOS = ["tanda", "materia", "confirmar"] as const;
type Paso = (typeof PASOS)[number];

/**
 * Prematrícula en 3 pasos: Elegir tanda → Elegir materia → Confirmar.
 *
 * No es el interruptor «normal/guiado» que prohíbe `ux-rules.md`: es un flujo
 * único, con el plazo siempre a la vista. Nada se escribe hasta «Confirmar»;
 * ahí se aplican, en orden, las diferencias entre lo que ya tenía y lo elegido
 * (quitar primero, para que el tope de créditos y la tanda libre cuenten bien)
 * con las MISMAS acciones de servidor de siempre, que son las que comprueban
 * ventana, cupo, tanda y tope. Esto solo evita ofrecer lo que van a rechazar.
 *
 * La tanda la fija la ventana, no el estudiante: el paso 1 es mostrar cuál está
 * abierta y qué tiene en la otra, no un selector libre.
 */
export function PrematriculaPasos({ datos }: { datos: DatosPrematricula }) {
  // Tras confirmar se recarga el servidor: la `key` remonta el asistente con lo
  // que de verdad quedó guardado, sin que quede estado viejo de la selección.
  const huella = [
    datos.tandas.map((x) => `${x.materia_id}:${x.estado}`).join(","),
    datos.oferta.map((x) => `${x.id}:${x.estado_inscripcion}`).join(","),
  ].join("|");
  const [errores, setErrores] = useState<string[]>([]);

  return (
    <>
      {errores.length > 0 && (
        <ul role="alert" className="text-body space-y-1 rounded-control bg-tinta p-4 text-background">
          {errores.map((e) => (
            <li key={e} className="flex items-start gap-2">
              <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
              {e}
            </li>
          ))}
        </ul>
      )}
      <Asistente key={huella} datos={datos} onErrores={setErrores} />
    </>
  );
}

function Asistente({ datos, onErrores }: { datos: DatosPrematricula; onErrores: (e: string[]) => void }) {
  const t = useTranslations("studentClasses");
  const router = useRouter();
  const avisar = useToast();
  const [pendiente, iniciar] = useTransition();
  const [paso, setPaso] = useState<Paso>("tanda");

  const { ronda, abierta, tandas, materias360, oferta } = datos;
  const enTanda = tandas.find((x) => x.ronda === ronda) ?? null;
  // Solo lo «prematriculada» se puede cambiar; lo que ya está cursando lo mueve coordinación.
  const bloqueada360 = enTanda !== null && enTanda.estado !== "prematriculada";

  const [elegida360, setElegida360] = useState<string | null>(enTanda?.materia_id ?? null);
  const inicialCarrera = oferta.filter((m) => m.estado_inscripcion === "activa").map((m) => m.id);
  const [elegidasCarrera, setElegidasCarrera] = useState<string[]>(inicialCarrera);

  const creditos = oferta
    .filter((m) => elegidasCarrera.includes(m.id))
    .reduce((n, m) => n + (m.creditos ?? 0), 0);
  const sobreTope = creditos > datos.topeCreditos;

  const candidatas360 = materias360.filter((m) => !m.aprobada && (!tandas.some((x) => x.ronda !== ronda && x.materia_id === m.id)));
  const nombre360 = (id: string | null) => materias360.find((m) => m.id === id)?.nombre ?? null;

  const agregar = oferta.filter((m) => elegidasCarrera.includes(m.id) && !inicialCarrera.includes(m.id));
  const quitar = oferta.filter((m) => !elegidasCarrera.includes(m.id) && inicialCarrera.includes(m.id));
  const cambio360 = elegida360 !== (enTanda?.materia_id ?? null);
  const hayCambios = cambio360 || agregar.length > 0 || quitar.length > 0;

  const siguienteBloqueado =
    (paso === "tanda" && !abierta) ||
    (paso === "materia" && (elegida360 === null || sobreTope));

  const confirmar = () => {
    iniciar(async () => {
      const fallos: string[] = [];
      const uno = (id: string) => {
        const f = new FormData();

        f.set("materia", id);

        return f;
      };
      const previo = { estado: "inicial" } as const;
      const anotar = (que: string | null, estado: string) => {
        if (estado !== "ok") fallos.push(`${que ?? ""} · ${t(`enroll.err.${estado}` as never)}`);

        return estado === "ok";
      };

      // Quitar primero: libera la tanda y baja los créditos antes de agregar.
      for (const m of quitar) anotar(m.nombre, (await quitarseDeMateria(previo, uno(m.id))).estado);

      if (cambio360 && !bloqueada360) {
        const libre = !enTanda || anotar(enTanda.materia, (await retirarPrematricula(previo, uno(enTanda.materia_id))).estado);

        if (libre && elegida360) anotar(nombre360(elegida360), (await prematricular(previo, uno(elegida360))).estado);
      }

      for (const m of agregar) anotar(m.nombre, (await inscribirseEnMateria(previo, uno(m.id))).estado);

      onErrores(fallos);
      router.refresh();
      if (fallos.length === 0) {
        avisar({ titulo: t("enroll.done"), accion: { etiqueta: t("enroll.seeClasses"), href: "/portal/estudiante/clases" } });
        router.push("/portal/estudiante/clases");
      }
    });
  };

  return (
    <div className="space-y-6">
      <nav aria-label={t("enroll.stepsLabel")}>
        <ol className="flex items-center gap-2">
          {PASOS.map((p, i) => {
            const actual = p === paso;
            const hecho = PASOS.indexOf(paso) > i;

            return (
              <li key={p} className="flex min-w-0 flex-1 items-center gap-2" aria-current={actual ? "step" : undefined}>
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    actual && "border-marca-500 bg-marca-500 text-white",
                    hecho && "border-marca-500 text-marca-600",
                    !actual && !hecho && "border-linea-fuerte text-tinta-3",
                  )}
                >
                  {hecho ? <Check aria-hidden className="size-4" /> : i + 1}
                </span>
                <span className={cn("text-label truncate", actual ? "text-tinta" : "text-tinta-3")}>{t(`enroll.steps.${p}`)}</span>
                {i < PASOS.length - 1 && <span aria-hidden className="h-px flex-1 bg-linea" />}
              </li>
            );
          })}
        </ol>
      </nav>

      {paso === "tanda" && (
        <section className="space-y-3">
          <h2 className="text-section">{t("enroll.tandaTitle", { periodo: datos.periodo })}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {([1, 2] as const).map((r) => {
              const propia = tandas.find((x) => x.ronda === r);
              const esta = r === ronda;

              return (
                <li
                  key={r}
                  className={cn(
                    "flex items-start gap-3 rounded-card border p-4",
                    esta && abierta ? "border-marca-500 bg-marca-50" : "border-linea",
                  )}
                >
                  <span className="mt-0.5 text-tinta-2">
                    {propia ? <GraduationCap aria-hidden className="size-5" /> : esta && abierta ? <Check aria-hidden className="size-5" /> : <CircleDashed aria-hidden className="size-5" />}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <p className="text-label">{t(`enroll.tanda.${r}`)}</p>
                    <p className="text-meta">
                      {propia ? propia.materia : esta ? (abierta ? t("enroll.openNow") : t("enroll.notOpenYet")) : t("enroll.opensLater")}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          {!abierta && (
            <p role="status" className="text-body rounded-control bg-muted p-3">
              {t("enroll.notOpenHint")}
            </p>
          )}
        </section>
      )}

      {paso === "materia" && (
        <section className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-section">{t("enroll.chooseFor360", { n: ronda })}</h2>
            {bloqueada360 && (
              <p className="text-meta flex items-center gap-2">
                <Lock aria-hidden className="size-4" />
                {t("enroll.locked360")}
              </p>
            )}
            <ul className="space-y-2" role="radiogroup" aria-label={t("enroll.chooseFor360", { n: ronda })}>
              {candidatas360.map((m) => {
                const llena = m.cupo_ocupado >= m.cupo_maximo && m.id !== enTanda?.materia_id;
                const marcada = elegida360 === m.id;

                return (
                  <li key={m.id}>
                    <label
                      className={cn(
                        "flex min-h-14 cursor-pointer items-start gap-3 rounded-card border p-4",
                        marcada ? "border-marca-500 bg-marca-50" : "border-linea",
                        (llena || bloqueada360) && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <input
                        type="radio"
                        name="materia360"
                        className="mt-1 size-4 accent-marca-500"
                        checked={marcada}
                        disabled={llena || bloqueada360}
                        onChange={() => setElegida360(m.id)}
                      />
                      <span className="min-w-0 flex-1 space-y-0.5">
                        <span className="text-body block font-medium">{m.nombre}</span>
                        <span className="text-meta block">
                          {[m.docente_nombre, m.horario, m.aula].filter(Boolean).join(" · ") || t("enroll.noSchedule")}
                        </span>
                      </span>
                      <span className="text-meta shrink-0 tabular-nums">
                        {llena ? t("enroll.full") : t("enroll.seats", { libres: m.cupo_maximo - m.cupo_ocupado })}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          {oferta.length > 0 && (
            <div className="space-y-3 border-t border-linea pt-6">
              <h2 className="text-section">{t("enroll.chooseCareer")}</h2>
              <ul className="space-y-2">
                {oferta.map((m) => {
                  const marcada = elegidasCarrera.includes(m.id);
                  const cerrada = m.estado_inscripcion !== null && m.estado_inscripcion !== "activa";

                  return (
                    <li key={m.id}>
                      <label
                        className={cn(
                          "flex min-h-14 cursor-pointer items-start gap-3 rounded-card border p-4",
                          marcada ? "border-marca-500 bg-marca-50" : "border-linea",
                          cerrada && "cursor-not-allowed opacity-60",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 size-4 accent-marca-500"
                          checked={marcada}
                          disabled={cerrada}
                          onChange={(e) =>
                            setElegidasCarrera((lista) =>
                              e.target.checked ? [...lista, m.id] : lista.filter((id) => id !== m.id),
                            )
                          }
                        />
                        <span className="min-w-0 flex-1 space-y-0.5">
                          <span className="text-body block font-medium">{m.nombre}</span>
                          <span className="text-meta block">
                            {[m.codigo, m.profesor, m.horario].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <span className="text-meta shrink-0 tabular-nums">{t("enroll.credits", { n: m.creditos ?? 0 })}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className={cn("text-label tabular-nums", sobreTope && "font-semibold")}>
                {t("enroll.creditsTotal", { actual: creditos, tope: datos.topeCreditos })}
                {sobreTope && ` · ${t("enroll.overCap")}`}
              </p>
            </div>
          )}
        </section>
      )}

      {paso === "confirmar" && (
        <section className="space-y-4">
          <h2 className="text-section">{t("enroll.reviewTitle")}</h2>
          <dl className="divide-y divide-linea rounded-card border border-linea">
            <div className="flex items-start justify-between gap-4 p-4">
              <dt className="text-label">{t("enroll.tanda.label", { n: ronda })}</dt>
              <dd className="text-body text-right">{nombre360(elegida360) ?? "—"}</dd>
            </div>
            {agregar.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-4 p-4">
                <dt className="text-body">{m.nombre}</dt>
                <dd>
                  <StatusBadge status="activa" label={t("enroll.willAdd")} />
                </dd>
              </div>
            ))}
            {quitar.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-4 p-4">
                <dt className="text-body">{m.nombre}</dt>
                <dd>
                  <StatusBadge status="cancelada" label={t("enroll.willRemove")} />
                </dd>
              </div>
            ))}
          </dl>
          {!hayCambios && <p className="text-meta">{t("enroll.noChanges")}</p>}
        </section>
      )}

      <footer className="flex items-center justify-between gap-3 border-t border-linea pt-4">
        <Button
          type="button"
          variant="ghost"
          disabled={paso === "tanda" || pendiente}
          onClick={() => setPaso(PASOS[PASOS.indexOf(paso) - 1])}
        >
          <ChevronLeft aria-hidden />
          {t("enroll.back")}
        </Button>
        {paso !== "confirmar" ? (
          <Button type="button" disabled={siguienteBloqueado} onClick={() => setPaso(PASOS[PASOS.indexOf(paso) + 1])}>
            {t("enroll.next")}
            <ChevronRight aria-hidden />
          </Button>
        ) : (
          <Button type="button" cargando={pendiente} disabled={!hayCambios} onClick={confirmar}>
            <Check aria-hidden />
            {t("enroll.confirm")}
          </Button>
        )}
      </footer>
    </div>
  );
}
