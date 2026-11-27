"use client";

import { useState } from "react";
import {
  BookOpen,
  Eye,
  Mail,
  PencilLine,
  Phone,
} from "lucide-react";

import { FotoEstudiante } from "@/components/expedientes/foto-estudiante";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
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
   * `"boton"`: un botón discreto "Vista rápida", para las tarjetas y la tabla
   * donde la foto y el nombre ya llevan a la ficha completa.
   * `"celda"`: la celda de nombre de la tabla densa. Su botón se estira sobre
   * toda la fila (la `<tr>` es `relative`), así que un clic en cualquier parte
   * de la fila abre el panel; las acciones de la fila van por encima (`z-10`).
   * Ninguna cambia el contenido del diálogo, solo cómo se ve el disparador.
   */
  variante?: "fila" | "tarjeta" | "boton" | "celda";
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
    sinFoto: string;
  };
}) {
  const fechaIngreso = fila.fecha_ingreso ? fechaCorta(fila.fecha_ingreso, idioma) : null;
  const [abierto, setAbierto] = useState(false);

  const meta =
    [fila.cedula, fila.programa, fila.universidad]
      .filter(Boolean)
      .join(" · ") || textos.optional;

  const badges = <StatusBadge status={fila.estado} />;

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger asChild>
        {variante === "celda" ? (
          <button
            type="button"
            title={textos.preview}
            aria-label={`${textos.preview}: ${fila.nombre}`}
            className="group flex min-w-0 items-center gap-3 text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FotoEstudiante
              nombre={fila.nombre}
              url={fotoUrl}
              className="size-9 shrink-0 rounded-full"
              aviso="punto"
              textoSinFoto={textos.sinFoto}
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{fila.nombre}</span>
              <span className="text-meta block truncate">{meta}</span>
            </span>
          </button>
        ) : variante === "boton" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`${textos.preview}: ${fila.nombre}`}
          >
            <Eye className="size-4" />
            {textos.preview}
          </Button>
        ) : variante === "tarjeta" ? (
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
            <FotoEstudiante
              nombre={fila.nombre}
              url={fotoUrl}
              className="size-14 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-105"
              aviso="punto"
              textoSinFoto={textos.sinFoto}
            />

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
            <FotoEstudiante
              nombre={fila.nombre}
              url={fotoUrl}
              className="size-10 shrink-0 rounded-full transition-transform group-hover:scale-105"
              aviso="punto"
              textoSinFoto={textos.sinFoto}
            />

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
      </SheetTrigger>

      <SheetContent>
        <header className="border-b border-linea px-6 pt-6 pr-16 pb-4">
          <div className="flex items-center gap-4">
            <FotoEstudiante
              nombre={fila.nombre}
              url={fotoUrl}
              className="size-16 shrink-0 rounded-full"
              claseIcono="text-xl"
              aviso="punto"
              textoSinFoto={textos.sinFoto}
            />

            <div className="min-w-0 space-y-2">
              {/* Sin `truncate`: un expediente es de una persona y su nombre se
                  lee entero, aunque ocupe dos líneas. */}
              <SheetTitle className="text-section">{fila.nombre}</SheetTitle>
              <SheetDescription className="sr-only">{textos.preview}</SheetDescription>
              <StatusBadge status={fila.estado} />
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-4 text-sm sm:grid-cols-2">
            <Campo etiqueta={textos.idCard} valor={fila.cedula} />
            <Campo etiqueta={textos.phone} valor={fila.telefono} icono={Phone} />
            <Campo etiqueta={textos.email} valor={fila.email} icono={Mail} ancho />
            <Campo etiqueta={textos.program} valor={fila.programa} icono={BookOpen} ancho />
            <Campo etiqueta={textos.university} valor={fila.universidad} ancho />
            <Campo etiqueta={textos.since} valor={fechaIngreso} />
            <Campo
              etiqueta={textos.gpa}
              valor={fila.indice === null ? textos.noGpa : `${fila.indice.toFixed(2)} ${textos.gpaScale}`}
            />
          </dl>
        </div>

        <footer className="flex justify-end gap-2 border-t border-linea px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
        </footer>
      </SheetContent>
    </Sheet>
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
