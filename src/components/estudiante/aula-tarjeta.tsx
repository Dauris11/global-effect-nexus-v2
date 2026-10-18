import {
  Award,
  CalendarClock,
  Check,
  ClipboardCheck,
  Clock,
  ClockAlert,
  ExternalLink,
  FileText,
  Megaphone,
  Paperclip,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import { BotonBuzonMoodle } from "@/components/estudiante/boton-buzon-moodle";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/i18n/routing";
import { fechaConHora } from "@/lib/fechas";
import { TARJETA } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import type { AsignacionDelEstudiante } from "@/server/estudiantes/aula";

/**
 * La tarjeta de una asignación del aula virtual.
 *
 * Sale de la página porque la página pasaba de 300 líneas, y porque es la pieza
 * que se repite: una por tarea, examen, material o anuncio.
 *
 * Recibe los textos ya traducidos porque la página es la que tiene el `t` del
 * espacio `studentPortal`, y así la auditoría de i18n sigue viendo un solo
 * `getTranslations` por archivo.
 */

/** Icono por tipo de asignación (`tipo_asignacion` de la migración 0021). */
const ICONO_TIPO = {
  tarea: ClipboardCheck,
  examen: FileText,
  material: Paperclip,
  anuncio: Megaphone,
} as const;

/**
 * Estado de la entrega: peso del azul y un icono por estado, para que se
 * distinga también en escala de grises. Lo calificado es lo más pesado del
 * azul: ya está cerrado.
 *
 * "Vencida sin entregar" no está aquí: es el único estado que pide actuar, y
 * usa el rojo de `SEMAFORO` (ver `VENCIDA`).
 */
const ESTADO_ENTREGA: Record<string, { clases: string; icono: LucideIcon }> = {
  pendiente: { clases: "bg-muted text-tinta-2", icono: Clock },
  entregado: { clases: "bg-marca-50 text-marca-700", icono: Check },
  tarde: { clases: "bg-marca-50 text-marca-700", icono: ClockAlert },
  calificado: { clases: "bg-marca-700 text-white", icono: Award },
};

/**
 * La excepción `SEMAFORO` (docs/09-sistema-visual.md §2.3): una tarea vencida
 * sin entregar es el estado de una entidad que requiere una decisión del
 * estudiante. Va con su icono, escrito como hex arbitrario y nunca `red-*`.
 */
const VENCIDA = { clases: "bg-[#B4342B] text-white", icono: TriangleAlert };

export type TextosAsignacion = {
  due: string;
  delivered: string;
  overdue: string;
  noDue: string;
  openFile: string;
  estado: string;
  tipo: string;
};

export function TarjetaAsignacion({
  fila,
  idioma,
  textos,
}: {
  fila: AsignacionDelEstudiante;
  idioma: Locale;
  textos: TextosAsignacion;
}) {
  const Icono = ICONO_TIPO[fila.tipo];
  // Solo las tareas y exámenes se entregan y tienen estado; un material o un
  // anuncio solo se leen. Antes la sección de material también ofrecía
  // "Entregar", y no había nada que entregar.
  const evaluable = fila.tipo === "tarea" || fila.tipo === "examen";
  const estado = fila.estado_entrega ?? "pendiente";

  // Un material con fecha también cumple la condición de `vencida` en SQL, pero
  // no hay nada que entregar: solo lo evaluable se marca como vencido.
  const vencida = evaluable && fila.vencida;
  const visual = vencida
    ? VENCIDA
    : (ESTADO_ENTREGA[estado] ?? ESTADO_ENTREGA.pendiente);
  const IconoEstado = visual.icono;

  // El archivo solo se ofrece como enlace si es una URL absoluta: la columna
  // admite también una ruta dentro del bucket, y enlazarla desde el navegador
  // daría un 404 sin explicación.
  const enlazable = fila.archivo_url?.startsWith("http") ?? false;

  // Entregar solo en lo evaluable, y solo si todavía no está calificada: cuando
  // el profesor ya puso nota, volver a subir borraría su revisión sin que el
  // estudiante lo sepa.
  const puedeEntregar = evaluable && fila.estado_entrega !== "calificado";

  const materia = [fila.materia_codigo, fila.materia].filter(Boolean).join(" · ");

  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        {evaluable ? (
          <Badge className={visual.clases}>
            <IconoEstado aria-hidden />
            {vencida ? textos.overdue : textos.estado}
          </Badge>
        ) : (
          <Badge variant="neutra">{textos.tipo}</Badge>
        )}

        {evaluable && <span className="texto-meta">{textos.tipo}</span>}
      </div>

      <div className="mt-4 flex items-start gap-4">
        <span className={TARJETA.icono}>
          <Icono className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="texto-titulo-tarjeta line-clamp-2">{fila.titulo}</p>
          {materia && <p className="truncate text-sm text-tinta-2">{materia}</p>}
        </div>

        {fila.calificacion !== null && (
          <p className="shrink-0 text-[22px] leading-none font-semibold tracking-tight text-tinta">
            {fila.calificacion.toFixed(1)}
          </p>
        )}
      </div>

      {fila.descripcion && (
        <p className="mt-3 line-clamp-2 text-sm text-tinta-2">{fila.descripcion}</p>
      )}

      {fila.comentario_profesor && (
        <blockquote className="mt-3 line-clamp-3 border-l-2 border-linea-fuerte pl-3 text-sm text-tinta-2 italic">
          {fila.comentario_profesor}
        </blockquote>
      )}

      {(evaluable || fila.fecha_entrega || enlazable) && (
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-linea pt-4">
          <div className="texto-meta flex min-w-0 flex-col gap-1">
            {evaluable && (
              <span
                className={cn(
                  "flex items-center gap-1.5",
                  vencida && "font-medium text-tinta",
                )}
              >
                <CalendarClock className="size-4 shrink-0" aria-hidden />
                {fila.fecha_vencimiento
                  ? `${textos.due} ${fechaConHora(fila.fecha_vencimiento, null, idioma)}`
                  : textos.noDue}
              </span>
            )}

            {fila.fecha_entrega && (
              <span className="flex items-center gap-1.5">
                <Check className="size-4 shrink-0" aria-hidden />
                {textos.delivered} {fechaConHora(fila.fecha_entrega, null, idioma)}
              </span>
            )}

            {enlazable && (
              <a
                href={fila.archivo_url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-control font-medium text-marca-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ExternalLink className="size-4" aria-hidden />
                {textos.openFile}
              </a>
            )}
          </div>

          {evaluable && (
            <BotonBuzonMoodle fila={fila} />
          )}
        </div>
      )}
    </Card>
  );
}
