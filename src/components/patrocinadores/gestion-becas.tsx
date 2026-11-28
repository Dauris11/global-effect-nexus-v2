"use client";

import { useActionState, useState } from "react";
import {
  AlertCircle,
  GraduationCap,
  Link2,
  Link2Off,
  Loader2,
  Save,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { GraficaAnillo } from "@/components/dashboard/graficas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fechaCorta } from "@/lib/fechas";
import { ALERTA_RIESGO, ANIMACION, AZUL, AZUL_OSCURO, CUADRO, VACIO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  asignarBeca,
  desvincularBeca,
  type EstadoPatrocinador,
} from "@/server/patrocinadores/acciones";
import type { BecadoConPatrocinio } from "@/server/patrocinadores/consultas";

const SELECT =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm";

type PatrocinadorOpcion = {
  id: string;
  nombre: string;
  pais: string | null;
  monto_mensual: number;
};

/**
 * Vinculación de becados con patrocinadores.
 *
 * LOS QUE NO TIENEN PATROCINADOR VAN PRIMERO (lo ordena el SQL). Es la lista
 * del trabajo pendiente: una pantalla de asignación que empiece por los que ya
 * están resueltos obliga a bajar hasta el final para ver qué falta.
 *
 * No se pinta la foto del estudiante aunque la fila la traiga. `foto_url` es
 * una ruta del almacén, no una URL lista, y montarla aquí a ojo daría imágenes
 * rotas en una pantalla donde lo que importa es el nombre y el monto. Cuando
 * haga falta, se resuelve en el servidor como ya hace el armazón.
 */
export function GestionBecas({
  becados,
  patrocinadores,
  puedeEscribir,
  hayFiltro,
}: {
  becados: readonly BecadoConPatrocinio[];
  patrocinadores: readonly PatrocinadorOpcion[];
  puedeEscribir: boolean;
  hayFiltro: boolean;
}) {
  const t = useTranslations("sponsors");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "sin" | "con">("todos");

  if (becados.length === 0) {
    return (
      <Card>
        <CardContent className={VACIO.contenedor}>
          <span className={VACIO.icono}>
            <GraduationCap className="size-6" />
          </span>
          <p className={VACIO.titulo}>
            {hayFiltro ? t("grants.noMatches") : t("grants.empty")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const conPatrocinador = becados.filter((b) => Boolean(b.patrocinador_id)).length;
  const sinPatrocinador = becados.length - conPatrocinador;

  const serieCobertura = [
    { nombre: t("grants.stats.assigned"), valor: conPatrocinador, color: AZUL },
    { nombre: t("grants.stats.pending"), valor: sinPatrocinador, color: AZUL_OSCURO },
  ];

  const visibles = becados.filter((b) => {
    if (filtro === "con") return Boolean(b.patrocinador_id);
    if (filtro === "sin") return !b.patrocinador_id;
    return true;
  });

  return (
    <div className={cn("space-y-4", ANIMACION.entrada)}>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{t("grants.chartCoverageTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid items-center gap-4 sm:grid-cols-2">
            <GraficaAnillo
              datos={serieCobertura}
              total={becados.length}
              etiquetaTotal=""
              vacio={t("grants.chartEmpty")}
            />
            <ul className="divide-y divide-linea">
              {serieCobertura.map((fila) => (
                <li key={fila.nombre} className="flex items-center gap-2 py-2 text-xs">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: fila.color }}
                  />
                  <span className="flex-1 text-tinta-2">{fila.nombre}</span>
                  <span className="font-semibold text-tinta tabular-nums">{fila.valor}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { id: "todos", label: t("grants.filterAll"), count: becados.length },
            { id: "sin", label: t("grants.filterUnsponsored"), count: sinPatrocinador },
            { id: "con", label: t("grants.filterSponsored"), count: conPatrocinador },
          ] as const
        ).map((chip) => {
          const activo = filtro === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFiltro(chip.id)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                activo
                  ? "border-marca-500 bg-marca-50 text-marca-700"
                  : "border-linea bg-card text-tinta-2 hover:bg-muted/50",
              )}
            >
              <span>{chip.label}</span>
              <span className="tabular-nums opacity-75">{chip.count}</span>
            </button>
          );
        })}
      </div>

      {puedeEscribir && patrocinadores.length === 0 && (
        <p className={ALERTA_RIESGO.contenedor}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>
            {t("grants.form.noSponsors")}
          </span>
        </p>
      )}

      <ul className="space-y-3">
        {visibles.map((fila) => (
          <li key={fila.estudiante_id}>
            <Card className="group">
              <CardContent className="pt-5">
                <Fila
                  fila={fila}
                  puedeEscribir={puedeEscribir && patrocinadores.length > 0}
                  abierto={abierto === fila.estudiante_id}
                  alAbrir={() =>
                    setAbierto(
                      abierto === fila.estudiante_id ? null : fila.estudiante_id,
                    )
                  }
                  alCerrar={() => setAbierto(null)}
                  patrocinadores={patrocinadores}
                />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Un becado y su patrocinio actual. */
function Fila({
  fila,
  puedeEscribir,
  abierto,
  alAbrir,
  alCerrar,
  patrocinadores,
}: {
  fila: BecadoConPatrocinio;
  puedeEscribir: boolean;
  abierto: boolean;
  alAbrir: () => void;
  alCerrar: () => void;
  patrocinadores: readonly PatrocinadorOpcion[];
}) {
  const t = useTranslations("sponsors");
  const idioma = useLocale() as Locale;

  const vinculado = fila.asignacion_id !== null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-110",
            vinculado ? CUADRO.marca : CUADRO.neutro,
          )}
        >
          <GraduationCap className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold break-words">
            {/* Del becado al expediente: ahí están su pénsum, sus notas y su patrocinio. */}
            <Link href={`/expedientes/${fila.estudiante_id}`} className="hover:text-marca-700 hover:underline">
              {fila.nombre}
            </Link>
          </p>
          <p className="text-muted-foreground text-xs">
            {[fila.programa, fila.universidad].filter(Boolean).join(" · ") ||
              "—"}
          </p>
        </div>

        <div className="min-w-0 text-right">
          {vinculado ? (
            <>
              <p className="text-sm font-medium break-words">
                <Link href={`/patrocinadores/${fila.patrocinador_id}`} className="hover:text-marca-700 hover:underline">
                  {fila.patrocinador}
                </Link>
              </p>
              <p className="text-muted-foreground text-xs">
                {[
                  fila.pais,
                  fila.desde
                    ? t("grants.since", {
                        fecha: fechaCorta(fila.desde, idioma),
                      })
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </>
          ) : (
            <Badge className="bg-muted text-[10px] text-tinta-2">
              {t("grants.none")}
            </Badge>
          )}
        </div>

        {/* El monto en el azul de la marca: es lo que entra por esta beca. */}
        {vinculado && fila.monto !== null && (
          <p className="shrink-0 text-sm font-bold text-marca-700">
            {formatoUsd(fila.monto)}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        {/* El histórico solo se anuncia si existe: "0 becas anteriores" en cada
            fila sería ruido en la mayoría de ellas. */}
        {fila.anteriores > 0 ? (
          <span className="text-muted-foreground text-[11px]">
            {t("grants.previous", { count: fila.anteriores })}
          </span>
        ) : (
          <span />
        )}

        {puedeEscribir && (
          <div className="flex items-center gap-1.5">
            {vinculado && <BotonDesvincular id={fila.estudiante_id} />}

            <Button type="button" size="sm" variant="outline" onClick={alAbrir}>
              <Link2 className="size-3.5" />
              {vinculado ? t("grants.change") : t("grants.assign")}
            </Button>
          </div>
        )}
      </div>

      {abierto && (
        <FormularioVinculo
          estudianteId={fila.estudiante_id}
          patrocinadores={patrocinadores}
          alTerminar={alCerrar}
        />
      )}
    </div>
  );
}

/** Elegir patrocinador y monto para esta beca. */
function FormularioVinculo({
  estudianteId,
  patrocinadores,
  alTerminar,
}: {
  estudianteId: string;
  patrocinadores: readonly PatrocinadorOpcion[];
  alTerminar: () => void;
}) {
  const t = useTranslations("sponsors");
  const [estado, enviar, enviando] = useActionState<
    EstadoPatrocinador,
    FormData
  >(
    async (previo, datos) => {
      const resultado = await asignarBeca(previo, datos);
      if (resultado.estado === "ok") alTerminar();
      return resultado;
    },
    { estado: "inicial" },
  );

  return (
    <form action={enviar} className="space-y-3 border-t pt-3">
      <div>
        <p className="text-sm font-semibold">{t("grants.form.title")}</p>
      </div>

      <input type="hidden" name="estudiante" value={estudianteId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`b-pat-${estudianteId}`}>
            {t("grants.form.sponsor")}
          </Label>
          <select
            id={`b-pat-${estudianteId}`}
            name="patrocinador"
            required
            className={SELECT}
          >
            {patrocinadores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
                {p.pais ? ` · ${p.pais}` : ""} · {formatoUsd(p.monto_mensual)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`b-monto-${estudianteId}`}>
            {t("grants.form.amount")}
          </Label>
          <Input
            id={`b-monto-${estudianteId}`}
            name="monto"
            type="number"
            min={0}
            step="0.01"
            defaultValue={0}
          />
        </div>
      </div>

      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className={ALERTA_RIESGO.contenedor}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>
            {estado.estado === "no_encontrado"
              ? t("grants.form.notFound")
              : estado.estado === "monto_invalido"
                ? t("grants.form.amountInvalid")
                : t("grants.form.error")}
          </span>
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          size="sm"
          cargando={enviando}
        >
          {enviando ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          {enviando ? t("grants.form.saving") : t("grants.form.save")}
        </Button>

        <Button type="button" variant="ghost" size="sm" onClick={alTerminar}>
          {t("grants.form.cancel")}
        </Button>
      </div>
    </form>
  );
}

/**
 * Cierra la beca activa.
 *
 * No pregunta antes, y es defendible: no se borra nada. La asignación pasa a
 * `finalizado` con la fecha de hoy y sigue en el histórico, así que
 * equivocarse cuesta volver a vincular, no perder un dato.
 */
function BotonDesvincular({ id }: { id: string }) {
  const t = useTranslations("sponsors");
  const [estado, enviar, enviando] = useActionState<
    EstadoPatrocinador,
    FormData
  >(desvincularBeca, { estado: "inicial" });

  return (
    <form action={enviar} className="flex items-center gap-2">
      <input type="hidden" name="estudiante" value={id} />

      <Button type="submit" size="sm" variant="ghost" cargando={enviando}>
        {enviando ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Link2Off className="size-3.5" />
        )}
        {enviando ? t("grants.unlinking") : t("grants.unlink")}
      </Button>

      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <span role="alert" className="text-[11px] text-tinta">
          {t("grants.form.error")}
        </span>
      )}
    </form>
  );
}

/** Dólares, con el mismo formato en los dos idiomas. Ver `gestion-patrocinadores`. */
function formatoUsd(valor: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(valor);
}
