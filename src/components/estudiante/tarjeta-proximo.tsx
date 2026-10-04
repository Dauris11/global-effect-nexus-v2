import {
  CalendarClock,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Card } from "@/components/ui/card";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fechaConHora } from "@/lib/fechas";
import type { AsignacionDelEstudiante } from "@/server/estudiantes/aula";
import type { EventoProximo } from "@/server/estudiantes/portal";

/**
 * "Lo próximo": la tarjeta destacada del inicio del estudiante.
 *
 * Es lo primero que se mira al entrar —qué vence y qué pasa—, así que va
 * arriba, justo debajo de las cifras, y con las dos cosas juntas: la próxima
 * entrega de sus materias y el próximo evento de la Fundación. Cada fila lleva
 * a la pantalla donde se ve entera (aula virtual, calendario).
 *
 * No consulta nada: recibe lo que la página ya trae.
 */
export async function TarjetaProximo({
  entrega,
  evento,
  locale,
}: {
  entrega: AsignacionDelEstudiante | null;
  evento: EventoProximo | null;
  locale: Locale;
}) {
  const t = await getTranslations("studentPortal");

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-linea px-5 py-4 md:px-6">
        <CalendarClock className="size-5 text-marca-500" />
        <h2 className="texto-titulo-tarjeta">{t("next.title")}</h2>
      </div>

      {!entrega && !evento ? (
        <EstadoVacio
          icono={CalendarClock}
          titulo={t("next.empty")}
          texto={t("next.emptyHint")}
          className="py-10"
        />
      ) : (
        <ul className="divide-y divide-linea">
          {entrega && (
            <Fila
              href="/portal/estudiante/aula-virtual"
              icono={ClipboardCheck}
              antetitulo={t("next.assignment")}
              titulo={entrega.titulo}
              // La fecha primero: si la línea se corta en el móvil, lo que
              // se pierde es el nombre de la materia, no cuándo vence.
              detalle={[
                `${t("classroom.dueOn")} ${fechaConHora(entrega.fecha_vencimiento, null, locale)}`,
                entrega.materia,
              ].join(" · ")}
            />
          )}

          {evento && (
            <Fila
              href="/portal/estudiante/calendario"
              icono={CalendarDays}
              antetitulo={t("heroEventBadge")}
              titulo={evento.titulo}
              detalle={[
                fechaConHora(evento.fecha, evento.hora_inicio, locale),
                evento.ubicacion,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          )}
        </ul>
      )}
    </Card>
  );
}

function Fila({
  href,
  icono: Icono,
  antetitulo,
  titulo,
  detalle,
}: {
  href: string;
  icono: React.ComponentType<{ className?: string }>;
  antetitulo: string;
  titulo: string;
  detalle: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-4 px-5 py-4 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:px-6"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-marca-50 text-marca-600">
          <Icono className="size-6" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="texto-meta font-medium">{antetitulo}</p>
          <p className="texto-titulo-tarjeta mt-0.5 truncate">{titulo}</p>
          <p className="mt-0.5 truncate text-sm text-tinta-2">{detalle}</p>
        </div>

        <ChevronRight className="size-5 shrink-0 text-tinta-3 transition-transform group-hover:translate-x-0.5 group-hover:text-tinta" />
      </Link>
    </li>
  );
}
