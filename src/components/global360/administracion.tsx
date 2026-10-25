"use client";

import { useActionState, useState } from "react";
import {
  CalendarClock,
  CalendarPlus,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  alternarMateria360,
  cerrarVentana,
  guardarMateria360,
  guardarVentana,
  type EstadoAdmin360,
} from "@/server/global360/acciones";
import type { MateriaCatalogo, Ventana } from "@/server/global360/consultas";

/**
 * Administración de Global Effect 360: el catálogo y las ventanas.
 *
 * Dos bloques y no dos pantallas: el catálogo dice QUÉ se puede elegir y la
 * ventana CUÁNDO, y quien configura una suele querer mirar la otra.
 *
 * Una materia no se borra nunca, se retira: las inscripciones pasadas apuntan a
 * ella, y con `ON DELETE RESTRICT` la base tampoco lo permitiría.
 *
 * Todo el catálogo activo es obligatorio (0047), así que no hay casilla que lo
 * marque: el estudiante cursa una materia por tanda y cada ventana abre una de
 * las dos tandas del período.
 */
export function Administracion360({
  materias,
  ventanas,
  periodos,
}: {
  materias: readonly MateriaCatalogo[];
  ventanas: readonly Ventana[];
  periodos: readonly { id: string; nombre: string }[];
}) {
  const t = useTranslations("global360");
  const [editando, setEditando] = useState<string | null>(null);
  const [nuevaVentana, setNuevaVentana] = useState(false);

  return (
    <div className="space-y-6">
      {/* ── Ventanas ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <CardTitle>
              <CalendarClock className="size-4" />
              {t("windowsTitle")}
            </CardTitle>

            {!nuevaVentana && (
              <Button type="button" size="sm" onClick={() => setNuevaVentana(true)}>
                <CalendarPlus className="size-3.5" />
                {t("newWindow")}
              </Button>
            )}
          </div>

          {nuevaVentana && (
            <FormularioVentana
              periodos={periodos}
              alTerminar={() => setNuevaVentana(false)}
            />
          )}

          {ventanas.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {t("windowsEmpty")}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {ventanas.map((ventana) => (
                <li
                  key={ventana.id}
                  className="bg-muted/40 flex flex-wrap items-center gap-3 rounded-lg p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {ventana.periodo} ·{" "}
                      {t(ventana.ronda === 1 ? "tanda1" : "tanda2")}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {ventana.abre.slice(0, 16).replace("T", " ")} →{" "}
                      {ventana.cierra.slice(0, 16).replace("T", " ")}
                    </p>
                    {ventana.mensaje && (
                      <p className="text-muted-foreground mt-0.5 text-xs italic">
                        {ventana.mensaje}
                      </p>
                    )}
                  </div>

                  {ventana.abierta && (
                    <Badge className="bg-marca-700 text-white">
                      {t("openNow")}
                    </Badge>
                  )}

                  {ventana.abierta && (
                    <BotonSimple
                      accion={cerrarVentana}
                      campos={{ id: ventana.id }}
                      etiqueta={t("closeWindow")}
                      icono={X}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Catálogo ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <CardTitle>
              <GraduationCap className="size-4" />
              {t("catalogTitle")}
            </CardTitle>

            {editando !== "nueva" && (
              <Button type="button" size="sm" onClick={() => setEditando("nueva")}>
                <Plus className="size-3.5" />
                {t("newSubject")}
              </Button>
            )}
          </div>

          <p className="texto-meta">{t("allRequired")}</p>

          {editando === "nueva" && (
            <FormularioMateria alTerminar={() => setEditando(null)} />
          )}

          {materias.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {t("catalogEmpty")}
            </p>
          ) : (
            <ul className="mt-3 divide-y">
              {materias.map((materia) => (
                <li key={materia.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm font-medium",
                          !materia.activa && "text-muted-foreground line-through",
                        )}
                      >
                        {materia.nombre}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {[
                          materia.codigo,
                          materia.creditos > 0
                            ? t("credits", { n: materia.creditos })
                            : null,
                          materia.inscritos > 0
                            ? t("enrolled", { n: materia.inscritos })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setEditando(editando === materia.id ? null : materia.id)
                      }
                      title={t("save")}
                      aria-label={t("save")}
                    >
                      <Pencil className="size-3.5" />
                    </Button>

                    <BotonSimple
                      accion={alternarMateria360}
                      campos={{ id: materia.id, activar: materia.activa ? "0" : "1" }}
                      etiqueta={materia.activa ? t("retire") : t("restore")}
                      icono={materia.activa ? EyeOff : Eye}
                    />
                  </div>

                  {editando === materia.id && (
                    <FormularioMateria
                      materia={materia}
                      alTerminar={() => setEditando(null)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Alta y edición de una materia. Con `materia`, es edición. */
function FormularioMateria({
  materia,
  alTerminar,
}: {
  materia?: MateriaCatalogo;
  alTerminar: () => void;
}) {
  const t = useTranslations("global360");
  const [estado, enviar, enviando] = useActionState<EstadoAdmin360, FormData>(
    async (previo, datos) => {
      const resultado = await guardarMateria360(previo, datos);
      if (resultado.estado === "ok") alTerminar();
      return resultado;
    },
    { estado: "inicial" },
  );

  const clave = materia?.id ?? "nueva";

  return (
    <form action={enviar} className="mt-3 space-y-3 border-t pt-3">
      <input type="hidden" name="id" value={materia?.id ?? ""} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor={`m-nombre-${clave}`}>{t("fieldName")}</Label>
          <Input
            id={`m-nombre-${clave}`}
            name="nombre"
            defaultValue={materia?.nombre}
            required
            maxLength={160}
            aria-invalid={estado.estado === "nombre_vacio" || undefined}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`m-codigo-${clave}`}>{t("fieldCode")}</Label>
          <Input
            id={`m-codigo-${clave}`}
            name="codigo"
            defaultValue={materia?.codigo ?? ""}
            maxLength={24}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`m-creditos-${clave}`}>{t("fieldCredits")}</Label>
          <Input
            id={`m-creditos-${clave}`}
            name="creditos"
            type="number"
            min={0}
            max={20}
            defaultValue={materia?.creditos ?? 0}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`m-horas-${clave}`}>{t("fieldHours")}</Label>
          <Input
            id={`m-horas-${clave}`}
            name="horas"
            type="number"
            min={0}
            defaultValue={materia?.horas ?? 0}
          />
        </div>

      </div>

      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className="text-destructive text-xs">
          {estado.estado === "nombre_vacio" ? t("errName") : t("errGeneric")}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={enviando}>
          {enviando && <Loader2 className="size-3.5 animate-spin" />}
          {enviando ? t("saving") : t("save")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={alTerminar}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

/** Abrir una ventana: período, tanda, apertura, cierre y una nota opcional. */
function FormularioVentana({
  periodos,
  alTerminar,
}: {
  periodos: readonly { id: string; nombre: string }[];
  alTerminar: () => void;
}) {
  const t = useTranslations("global360");
  const [estado, enviar, enviando] = useActionState<EstadoAdmin360, FormData>(
    async (previo, datos) => {
      const resultado = await guardarVentana(previo, datos);
      if (resultado.estado === "ok") alTerminar();
      return resultado;
    },
    { estado: "inicial" },
  );

  return (
    <form action={enviar} className="space-y-3 border-t pt-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="v-periodo">{t("fieldPeriod")}</Label>
          <select
            id="v-periodo"
            name="periodo"
            required
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          >
            {periodos.map((periodo) => (
              <option key={periodo.id} value={periodo.id}>
                {periodo.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Sin valor por defecto a propósito: abrir la tanda equivocada manda a
            todo el período a elegir en el hueco que no es. */}
        <div className="space-y-1.5">
          <Label htmlFor="v-ronda">{t("fieldTanda")}</Label>
          <select
            id="v-ronda"
            name="ronda"
            required
            defaultValue=""
            aria-invalid={estado.estado === "ronda_invalida" || undefined}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          >
            <option value="" disabled>
              {t("fieldTandaPlaceholder")}
            </option>
            <option value="1">{t("tanda1")}</option>
            <option value="2">{t("tanda2")}</option>
          </select>
        </div>

        {/* `datetime-local` porque el anuncio dice fecha Y hora, y es el control
            que el navegador ya sabe dibujar con el formato de cada idioma. */}
        <div className="space-y-1.5">
          <Label htmlFor="v-abre">{t("fieldOpens")}</Label>
          <Input id="v-abre" name="abre" type="datetime-local" required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="v-cierra">{t("fieldCloses")}</Label>
          <Input
            id="v-cierra"
            name="cierra"
            type="datetime-local"
            required
            aria-invalid={estado.estado === "fechas_invalidas" || undefined}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="v-mensaje">{t("fieldMessage")}</Label>
        <Input id="v-mensaje" name="mensaje" maxLength={280} />
      </div>

      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className="text-destructive text-xs">
          {estado.estado === "fechas_invalidas"
            ? t("errDates")
            : estado.estado === "ronda_invalida"
              ? t("errTanda")
              : estado.estado === "ventana_solapada"
                ? t("errOverlap")
                : t("errGeneric")}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={enviando}>
          {enviando && <Loader2 className="size-3.5 animate-spin" />}
          {enviando ? t("saving") : t("save")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={alTerminar}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

/** Botón de una acción sin campos: su propio `form`, funciona sin JavaScript. */
function BotonSimple({
  accion,
  campos,
  etiqueta,
  icono: Icono,
}: {
  accion: (previo: EstadoAdmin360, datos: FormData) => Promise<EstadoAdmin360>;
  campos: Record<string, string>;
  etiqueta: string;
  icono: React.ComponentType<{ className?: string }>;
}) {
  const [, enviar, enviando] = useActionState<EstadoAdmin360, FormData>(accion, {
    estado: "inicial",
  });

  return (
    <form action={enviar}>
      {Object.entries(campos).map(([nombre, valor]) => (
        <input key={nombre} type="hidden" name={nombre} value={valor} />
      ))}

      <Button
        type="submit"
        variant="ghost"
        size="icon"
        disabled={enviando}
        title={etiqueta}
        aria-label={etiqueta}
      >
        {enviando ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Icono className="size-3.5" />
        )}
      </Button>
    </form>
  );
}
