"use client";

import { useActionState, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
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
  alternarAnuncio,
  eliminarAnuncio,
  guardarAnuncio,
  moverAnuncio,
  type EstadoAnuncio,
} from "@/server/landing/acciones";
import type { DiapositivaAdmin } from "@/server/landing/consultas";

/**
 * Panel de los anuncios del hero.
 *
 * La lista viene del servidor y esto solo maneja qué formulario está abierto:
 * uno por anuncio, más el del alta, y nunca dos a la vez. Cada formulario es un
 * `form` de verdad contra su Server Action, así que guardar no depende de que
 * haya JavaScript cargado.
 *
 * Los anuncios se muestran en dos grupos, activos y ocultos, porque es la única
 * distinción que importa: los primeros son literalmente lo que ve ahora mismo
 * cualquiera que abra la portada.
 */
export function AnunciosHero({
  anuncios,
}: {
  anuncios: readonly DiapositivaAdmin[];
}) {
  const t = useTranslations("announcements");
  const [abierto, setAbierto] = useState<string | null>(null);

  const activos = anuncios.filter((a) => a.activo);
  const ocultos = anuncios.filter((a) => !a.activo);

  return (
    <div className="space-y-6">
      {/* Lo que se ve ahora en la portada. Si no hay ninguno activo se dice, y
          se dice qué sale en su lugar: el hero traducido de `messages`. */}
      <section className="space-y-3">
        <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-semibold">
          <Eye className="size-4" />
          {t("liveNow")}
          <Badge className="bg-[#2096BA]/15 text-[10px] text-[#0a6a8a]">
            {activos.length}
          </Badge>
        </h2>

        {activos.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
            {t("fallback")}
          </p>
        ) : (
          activos.map((anuncio, indice) => (
            <Fila
              key={anuncio.id}
              anuncio={anuncio}
              primero={indice === 0}
              ultimo={indice === activos.length - 1}
              abierto={abierto === anuncio.id}
              alAbrir={() => setAbierto(abierto === anuncio.id ? null : anuncio.id)}
              alCerrar={() => setAbierto(null)}
            />
          ))
        )}
      </section>

      {ocultos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-semibold">
            <EyeOff className="size-4" />
            {t("hidden")}
            <Badge variant="secondary" className="text-[10px]">
              {ocultos.length}
            </Badge>
          </h2>

          {ocultos.map((anuncio, indice) => (
            <Fila
              key={anuncio.id}
              anuncio={anuncio}
              primero={indice === 0}
              ultimo={indice === ocultos.length - 1}
              abierto={abierto === anuncio.id}
              alAbrir={() => setAbierto(abierto === anuncio.id ? null : anuncio.id)}
              alCerrar={() => setAbierto(null)}
            />
          ))}
        </section>
      )}

      {anuncios.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("noSlides")}</p>
      )}

      {abierto === "nuevo" ? (
        <Card>
          <CardContent className="pt-5">
            <CardTitle className="mb-4">
              <Plus className="size-4" />
              {t("newTitle")}
            </CardTitle>

            <Formulario alTerminar={() => setAbierto(null)} />
          </CardContent>
        </Card>
      ) : (
        <Button type="button" onClick={() => setAbierto("nuevo")}>
          <Plus className="size-4" />
          {t("newTitle")}
        </Button>
      )}
    </div>
  );
}

/** Una fila de la lista, con sus botones y su formulario plegado. */
function Fila({
  anuncio,
  primero,
  ultimo,
  abierto,
  alAbrir,
  alCerrar,
}: {
  anuncio: DiapositivaAdmin;
  primero: boolean;
  ultimo: boolean;
  abierto: boolean;
  alAbrir: () => void;
  alCerrar: () => void;
}) {
  const t = useTranslations("announcements");

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-wrap items-start gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              anuncio.activo
                ? "bg-[#2096BA]/10 text-[#187a99]"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Sparkles className="size-4" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{anuncio.titulo}</p>
            <p className="text-muted-foreground truncate text-xs">
              {anuncio.cta_texto && anuncio.cta_enlace
                ? `${anuncio.cta_texto} → ${anuncio.cta_enlace}`
                : t("noButton")}
            </p>
          </div>

          <Badge
            className={cn(
              "text-[10px]",
              anuncio.activo
                ? "bg-[#2096BA]/15 text-[#0a6a8a]"
                : "bg-muted text-tinta-2",
            )}
          >
            {anuncio.activo ? t("active") : t("inactive")}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <BotonAccion
            accion={alternarAnuncio}
            campos={{ id: anuncio.id, activar: anuncio.activo ? "0" : "1" }}
            etiqueta={anuncio.activo ? t("deactivate") : t("activate")}
            icono={anuncio.activo ? EyeOff : Eye}
          />

          <Button type="button" variant="ghost" size="sm" onClick={alAbrir}>
            <Pencil className="size-3.5" />
            {abierto ? t("cancel") : t("save")}
          </Button>

          <div className="ml-auto flex items-center gap-1">
            {!primero && (
              <BotonAccion
                accion={moverAnuncio}
                campos={{ id: anuncio.id, direccion: "arriba" }}
                etiqueta={t("moveUp")}
                icono={ArrowUp}
                soloIcono
              />
            )}

            {!ultimo && (
              <BotonAccion
                accion={moverAnuncio}
                campos={{ id: anuncio.id, direccion: "abajo" }}
                etiqueta={t("moveDown")}
                icono={ArrowDown}
                soloIcono
              />
            )}

            <BotonAccion
              accion={eliminarAnuncio}
              campos={{ id: anuncio.id }}
              etiqueta={t("remove")}
              icono={Trash2}
              confirmacion={t("removeConfirm")}
              destructivo
            />
          </div>
        </div>

        {abierto && (
          <Formulario anuncio={anuncio} alTerminar={alCerrar} />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Formulario de alta y de edición. El mismo para los dos: la acción distingue
 * por el `id` oculto, vacío en un alta.
 *
 * El título y el texto se llevan al estado para la vista previa; los demás
 * campos no, porque no se ven en el hero mientras se escribe.
 */
function Formulario({
  anuncio,
  alTerminar,
}: {
  anuncio?: DiapositivaAdmin;
  alTerminar: () => void;
}) {
  const t = useTranslations("announcements");
  const [estado, enviar, enviando] = useActionState<EstadoAnuncio, FormData>(
    async (previo, datos) => {
      const resultado = await guardarAnuncio(previo, datos);

      // Solo se cierra si de verdad se guardó: con un error hay que poder
      // corregir sobre lo que ya está escrito.
      if (resultado.estado === "ok") alTerminar();

      return resultado;
    },
    { estado: "inicial" },
  );

  const [titulo, setTitulo] = useState(anuncio?.titulo ?? "");

  return (
    <form action={enviar} className="space-y-4 border-t pt-4">
      <input type="hidden" name="id" value={anuncio?.id ?? ""} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor={`titulo-${anuncio?.id ?? "nuevo"}`}>
            {t("fieldTitle")}
          </Label>
          <Input
            id={`titulo-${anuncio?.id ?? "nuevo"}`}
            name="titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
            maxLength={160}
            aria-invalid={estado.campo === "titulo" || undefined}
          />
          {estado.campo === "titulo" && (
            <p role="alert" className="text-destructive text-xs">
              {t("errTitle")}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`imagen-${anuncio?.id ?? "nuevo"}`}>
            {t("fieldImage")}
          </Label>
          <Input
            id={`imagen-${anuncio?.id ?? "nuevo"}`}
            name="imagen"
            defaultValue={anuncio?.imagen_url ?? ""}
            maxLength={500}
            placeholder="/hero-slide-1.webp"
            aria-invalid={estado.campo === "imagen" || undefined}
          />
          <p
            className={cn(
              "text-xs",
              estado.campo === "imagen"
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {estado.campo === "imagen" ? t("errImage") : t("fieldImageHint")}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`cta-${anuncio?.id ?? "nuevo"}`}>
            {t("fieldCtaText")}
          </Label>
          <Input
            id={`cta-${anuncio?.id ?? "nuevo"}`}
            name="cta_texto"
            defaultValue={anuncio?.cta_texto ?? ""}
            maxLength={40}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`enlace-${anuncio?.id ?? "nuevo"}`}>
            {t("fieldCtaLink")}
          </Label>
          <Input
            id={`enlace-${anuncio?.id ?? "nuevo"}`}
            name="cta_enlace"
            defaultValue={anuncio?.cta_enlace ?? ""}
            maxLength={500}
            placeholder="/login"
            aria-invalid={estado.campo === "enlace" || undefined}
          />
          <p
            className={cn(
              "text-xs",
              estado.campo === "enlace"
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {estado.campo === "enlace" ? t("errLink") : t("fieldCtaHint")}
          </p>
        </div>
      </div>

      {/* Vista previa con el velo y la tipografía del hero de verdad, para no
          publicar a ciegas un titular que allí ocupa tres líneas. El hero solo
          dibuja el titular y el botón, así que esto también: si aquí saliera
          algo que allí no sale, la vista previa mentiría. */}
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-semibold">
          {t("preview")}
        </p>
        <div className="rounded-card bg-tinta p-6">
          <p className="text-2xl font-bold tracking-tight text-white">
            {titulo || t("fieldTitle")}
          </p>
        </div>
      </div>

      {(estado.estado === "error" ||
        estado.estado === "no_encontrado" ||
        estado.estado === "no_permitido") && (
        <p role="alert" className="text-destructive text-xs">
          {estado.estado === "no_encontrado"
            ? t("errNotFound")
            : estado.estado === "no_permitido"
              ? t("errNotAllowed")
              : t("errGeneric")}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={enviando}>
          {enviando && <Loader2 className="size-4 animate-spin" />}
          {anuncio ? t("save") : t("create")}
        </Button>

        <Button type="button" variant="ghost" onClick={alTerminar}>
          <X className="size-4" />
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

/**
 * Botón que lanza una acción sin campos que rellenar: activar, mover, borrar.
 *
 * Cada uno es su propio `form`, y no un `onClick`, para que funcione sin
 * JavaScript. `confirmacion` usa el `confirm` del navegador a propósito: es una
 * pregunta de una línea antes de un borrado y montar un diálogo para eso serían
 * cuarenta líneas y un foco que atrapar.
 */
function BotonAccion({
  accion,
  campos,
  etiqueta,
  icono: Icono,
  soloIcono = false,
  destructivo = false,
  confirmacion,
}: {
  accion: (previo: EstadoAnuncio, datos: FormData) => Promise<EstadoAnuncio>;
  campos: Record<string, string>;
  etiqueta: string;
  icono: React.ComponentType<{ className?: string }>;
  soloIcono?: boolean;
  destructivo?: boolean;
  confirmacion?: string;
}) {
  const t = useTranslations("announcements");
  const [estado, enviar, enviando] = useActionState<EstadoAnuncio, FormData>(
    accion,
    { estado: "inicial" },
  );

  return (
    <form
      action={enviar}
      onSubmit={(evento) => {
        if (confirmacion && !window.confirm(confirmacion)) {
          evento.preventDefault();
        }
      }}
      className="contents"
    >
      {Object.entries(campos).map(([nombre, valor]) => (
        <input key={nombre} type="hidden" name={nombre} value={valor} />
      ))}

      <Button
        type="submit"
        variant="ghost"
        size={soloIcono ? "icon" : "sm"}
        disabled={enviando}
        aria-label={soloIcono ? etiqueta : undefined}
        title={soloIcono ? etiqueta : undefined}
        className={destructivo ? "text-destructive hover:text-destructive" : ""}
      >
        {enviando ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Icono className="size-3.5" />
        )}
        {!soloIcono && etiqueta}
      </Button>

      {(estado.estado === "no_encontrado" ||
        estado.estado === "no_permitido") && (
        <span role="alert" className="text-destructive text-xs">
          {estado.estado === "no_encontrado"
            ? t("errNotFound")
            : t("errNotAllowed")}
        </span>
      )}
    </form>
  );
}
