"use client";

import { useState } from "react";
import {
  BookOpen,
  Eye,
  GraduationCap,
  Mail,
  PencilLine,
  Phone,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";
import { visualDeEstado } from "@/lib/expedientes";
import { fechaCorta } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import type { FilaExpediente } from "@/server/expedientes/consultas";

/**
 * Vista rápida de un expediente, sin salir de la lista.
 *
 * Usa lo que la fila ya trae —nada de una segunda consulta al abrir el
 * diálogo—: es justo la promesa de una "previsualización", que sea
 * instantánea. Lo que la lista no trae (familia, vivienda, salud, situación)
 * se ve en la ficha completa, un clic más allá.
 */

export function PrevisualizarExpediente({
  fila,
  idioma,
  puedeEscribir,
  fotoUrl,
  variante = "fila",
  textos,
}: {
  fila: FilaExpediente;
  idioma: "es" | "en";
  puedeEscribir: boolean;
  /** URL pública ya resuelta, o `null` para la inicial. */
  fotoUrl: string | null;
  /**
   * `"fila"`: foto a la izquierda, texto a la derecha — para la vista de
   * lista. `"tarjeta"`: todo centrado en columna — para la tarjeta cuadrada.
   * Ninguna cambia el contenido del diálogo, solo cómo se ve el disparador.
   */
  variante?: "fila" | "tarjeta";
  textos: {
    preview: string;
    idCard: string;
    email: string;
    phone: string;
    program: string;
    university: string;
    since: string;
    gpa: string;
    gpaScale: string;
    noGpa: string;
    status: string;
    optional: string;
    edit: string;
    viewFull: string;
  };
}) {
  const fechaIngreso = fila.fecha_ingreso ? fechaCorta(fila.fecha_ingreso, idioma) : null;
  const [abierto, setAbierto] = useState(false);
  const inicial = fila.nombre.trim().charAt(0).toUpperCase() || "?";

  /*
   * El aspecto del estado se resuelve aquí, no llega por props.
   *
   * El icono es un componente de `lucide-react`, y un componente no cruza la
   * frontera de servidor a cliente: React solo sabe serializar objetos planos,
   * así que pasarlo reventaba en el navegador ("Only plain objects can be
   * passed to Client Components"). `fila.estado` ya viaja en la fila, que es
   * una cadena, y de ella sale todo lo demás sin cruzar nada.
   */
  const visual = visualDeEstado(fila.estado);
  const IconoEstado = visual.icono;
  const colorEstado = visual.insignia;

  const meta =
    [fila.cedula, fila.programa, fila.universidad]
      .filter(Boolean)
      .join(" · ") || textos.optional;

  const badges = (
    <>
      {/* Mismo tamaño en las dos vistas. En la tarjeta iban a `text-[9px]` con
          `py-0`, y a ese cuerpo la insignia deja de leerse: encoger la única
          señal de color del cuadrado para ganar dos píxeles era el peor sitio
          donde recortar. */}
      {/* El icono va dentro de la insignia del estado, no al lado: es la señal
          que separa `reclutado` de `inactivo` —los dos grises— y la única que
          queda si alguien no distingue el verde del rojo. */}
      <Badge className={cn("gap-1 px-2 py-0.5 text-[10px]", colorEstado)}>
        <IconoEstado className="size-3 shrink-0" />
        {textos.status}
      </Badge>
    </>
  );

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        {variante === "tarjeta" ? (
          /* Tres bloques con aire entre ellos —retrato, identidad, etiquetas—
             en vez de cinco líneas seguidas al mismo `gap`. Con un espacio
             uniforme todo pesaba igual y el cuadrado se leía como una lista
             apretada; agrupando, el nombre queda pegado a su dato y las
             insignias se separan de lo demás. */
          <button
            type="button"
            title={textos.preview}
            aria-label={`${textos.preview}: ${fila.nombre}`}
            className="group flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-center"
          >
            <Avatar className="size-14 shrink-0 rounded-2xl transition-transform duration-200 group-hover:scale-105">
              <AvatarImage src={fotoUrl ?? undefined} alt="" />
              <AvatarFallback className="rounded-2xl bg-[#2096BA]/10 text-lg text-[#187a99]">
                {inicial === "?" ? (
                  <GraduationCap className="size-6" />
                ) : (
                  inicial
                )}
              </AvatarFallback>
            </Avatar>

            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="line-clamp-2 text-[13px] leading-tight font-bold group-hover:underline">
                {fila.nombre}
              </span>

              {/* Solo el programa. La línea llevaba cédula, programa y
                  universidad unidos por puntos y recortados a un renglón: en
                  un cuadrado de este ancho no cabía ninguno de los tres
                  entero, así que no se leía nada. Los tres siguen completos en
                  el diálogo, a un clic. */}
              <span className="text-muted-foreground line-clamp-1 text-[10px]">
                {fila.programa ?? textos.optional}
              </span>
            </span>

            <span className="flex flex-wrap items-center justify-center gap-1">
              {badges}
            </span>
          </button>
        ) : (
          <button
            type="button"
            title={textos.preview}
            aria-label={`${textos.preview}: ${fila.nombre}`}
            className="group flex min-w-0 flex-1 items-start gap-3 text-left"
          >
            <Avatar className="size-10 shrink-0 rounded-xl transition-transform group-hover:scale-105">
              <AvatarImage src={fotoUrl ?? undefined} alt="" />
              <AvatarFallback className="rounded-xl bg-[#2096BA]/10 text-[#187a99]">
                {inicial === "?" ? (
                  <GraduationCap className="size-5" />
                ) : (
                  inicial
                )}
              </AvatarFallback>
            </Avatar>

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-bold group-hover:underline">
                  {fila.nombre}
                </span>
                <Eye className="text-muted-foreground size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
              </span>

              <span className="text-muted-foreground block truncate text-xs">
                {meta}
              </span>

              <span className="mt-2 flex flex-wrap items-center gap-1.5">
                {badges}

                {fechaIngreso && (
                  <span className="text-muted-foreground text-[10px]">
                    {textos.since} {fechaIngreso}
                  </span>
                )}
              </span>
            </span>
          </button>
        )}
      </DialogTrigger>

      {/* Ancho por defecto del diálogo (`max-w-lg`) y no `max-w-md`: con dos
          columnas de datos, 448px dejaba el correo y el programa partidos a
          media palabra. */}
      <DialogContent>
        {/* La cabecera lleva su propio `pr-8`: el aspa de cerrar del diálogo se
            posa en esa esquina y sin el hueco pisaba los nombres largos. */}
        <DialogHeader className="pr-8">
          <div className="flex items-center gap-4">
            <Avatar className="size-16 shrink-0 rounded-2xl">
              <AvatarImage src={fotoUrl ?? undefined} alt="" />
              <AvatarFallback className="rounded-2xl bg-[#2096BA]/10 text-xl text-[#187a99]">
                {inicial === "?" ? (
                  <GraduationCap className="size-7" />
                ) : (
                  inicial
                )}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 space-y-2">
              {/* Sin `truncate`: un expediente es de una persona y su nombre se
                  lee entero, aunque ocupe dos líneas. */}
              <DialogTitle className="text-base leading-snug">
                {fila.nombre}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className={cn("gap-1 text-[10px]", colorEstado)}>
                    <IconoEstado className="size-3 shrink-0" />
                    {textos.status}
                  </Badge>
                </div>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Los datos, en su propio panel. Antes flotaban sueltos entre la
            cabecera y los botones, y sin nada que los agrupara el diálogo se
            leía como una lista de tres cosas distintas en vez de como una
            ficha. `gap-y` mayor que `gap-x` porque las filas se confunden
            antes que las columnas. */}
        <dl className="bg-muted/40 grid grid-cols-1 gap-x-4 gap-y-4 rounded-xl border p-4 text-sm sm:grid-cols-2">
          <Campo etiqueta={textos.idCard} valor={fila.cedula} />
          <Campo etiqueta={textos.phone} valor={fila.telefono} icono={Phone} />
          <Campo
            etiqueta={textos.email}
            valor={fila.email}
            icono={Mail}
            ancho
          />
          <Campo etiqueta={textos.program} valor={fila.programa} icono={BookOpen} ancho />
          <Campo etiqueta={textos.university} valor={fila.universidad} ancho />
          <Campo etiqueta={textos.since} valor={fechaIngreso} />
          <Campo
            etiqueta={textos.gpa}
            valor={
              fila.indice === null
                ? textos.noGpa
                : `${fila.indice.toFixed(2)} ${textos.gpaScale}`
            }
          />
        </dl>

        {/* Dos botones y no tres: el diálogo ya trae su aspa de cerrar arriba a
            la derecha, así que un "Cerrar" aquí repetía la salida y dejaba las
            dos acciones que sí importan apretadas contra el borde. */}
        <DialogFooter>
          <Button asChild variant="outline">
            <Link href={`/expedientes/${fila.id}`}>
              <Eye className="size-4" />
              {textos.viewFull}
            </Link>
          </Button>

          {puedeEscribir && (
            <Button asChild>
              <Link href={`/expedientes/${fila.id}?editar=1`}>
                <PencilLine className="size-4" />
                {textos.edit}
              </Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Campo({
  etiqueta,
  valor,
  icono: Icono,
  ancho = false,
}: {
  etiqueta: string;
  valor: string | null;
  icono?: React.ComponentType<{ className?: string }>;
  ancho?: boolean;
}) {
  if (!valor) return null;

  // `sm:col-span-2` y no `col-span-2` a secas: en móvil la rejilla ya es de una
  // sola columna, y ocupar dos en una rejilla de una no significa nada.
  return (
    <div className={cn("min-w-0 space-y-1", ancho && "sm:col-span-2")}>
      <dt className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase">
        {Icono && <Icono className="size-3 shrink-0" />}
        {etiqueta}
      </dt>
      {/* `break-words` y no `truncate`: aquí se viene a leer el dato. Un correo
          cortado con puntos suspensivos no sirve para nada, y el diálogo tiene
          sitio de sobra para que baje de línea. */}
      <dd className="leading-snug font-medium break-words">{valor}</dd>
    </div>
  );
}
