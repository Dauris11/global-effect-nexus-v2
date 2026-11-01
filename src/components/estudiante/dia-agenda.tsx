import { BookOpen, CalendarDays, ClipboardCheck, Inbox, MapPin, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { tipoDeEvento } from "@/components/estudiante/periodos";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/i18n/routing";
import { diaConSemana } from "@/lib/fechas";
import { visualDeSolicitud } from "@/lib/solicitudes";
import { cn } from "@/lib/utils";
import type { EntradaAgenda } from "@/server/estudiantes/agenda";

/**
 * Icono de cada origen. Todos en el mismo círculo gris: lo que distingue un
 * evento de un vencimiento es el icono y la línea de detalle, no un color por
 * módulo (docs/09-sistema-visual.md §1.2).
 */
const ICONO_ORIGEN = {
  evento: CalendarDays,
  asignacion: ClipboardCheck,
  solicitud: Inbox,
  reunion: Users,
  clase: BookOpen,
} as const;

/**
 * Un día de la agenda del estudiante: el encabezado del día y sus entradas,
 * separadas por línea. Hoy se marca con el acento y la insignia "Hoy".
 */
export async function DiaAgenda({
  clave,
  entradas,
  esHoy,
  locale,
}: {
  clave: string;
  entradas: readonly EntradaAgenda[];
  esHoy: boolean;
  locale: Locale;
}) {
  const [t, tSolicitud] = await Promise.all([
    getTranslations("studentPortal"),
    getTranslations("requests"),
  ]);

  return (
    <section aria-current={esHoy ? "date" : undefined}>
      <div className="flex items-center gap-2 border-b border-linea pb-2">
        <h3
          className={cn(
            "text-sm font-semibold capitalize",
            esHoy ? "text-marca-600" : "text-tinta",
          )}
        >
          {diaConSemana(clave, locale)}
        </h3>
        {esHoy && <Badge variant="marca">{t("agenda.today")}</Badge>}
      </div>

      <ul>
        {entradas.map((entrada) => {
          const Icono = ICONO_ORIGEN[entrada.origen];

          return (
            <li
              key={`${entrada.origen}-${entrada.id}`}
              className="flex items-start gap-3 border-b border-linea py-3 last:border-b-0"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-tinta">
                <Icono className="size-5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{entrada.titulo}</p>
                <p className="truncate text-sm text-tinta-2">
                  {entrada.origen === "evento"
                    ? t(`agenda.eventType.${tipoDeEvento(entrada.detalle)}`)
                    : entrada.origen === "asignacion"
                      ? entrada.detalle
                      : entrada.origen === "reunion"
                        ? entrada.detalle ?? t("agenda.meetingDefault")
                        : entrada.origen === "clase"
                          ? entrada.detalle ?? t("agenda.regularClass")
                          : tSolicitud(`type.${entrada.detalle}` as never)}
                </p>

                {entrada.ubicacion && (
                  <p className="texto-meta mt-1 flex items-center gap-1">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="truncate">{entrada.ubicacion}</span>
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-sm font-medium tabular-nums text-tinta-2">
                  {entrada.hora ? entrada.hora.slice(0, 5) : t("agenda.allDay")}
                </span>

                {entrada.origen === "asignacion" && (
                  <Badge
                    variant={
                      entrada.estado === "pendiente" ? "marca" : "neutra"
                    }
                  >
                    {t(`agenda.assignment.${entrada.estado}`)}
                  </Badge>
                )}

                {entrada.origen === "clase" && (
                  <Badge variant="marca">
                    {t("agenda.classBadge")}
                  </Badge>
                )}

                {entrada.origen === "reunion" && (
                  <Badge variant="marca">
                    {entrada.estado}
                  </Badge>
                )}

                {entrada.origen === "solicitud" && (
                  <SolicitudInsignia
                    estado={entrada.estado}
                    texto={tSolicitud(`status.${entrada.estado}` as never)}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Estado de un trámite: su insignia y su icono, como en la pantalla de solicitudes. */
function SolicitudInsignia({
  estado,
  texto,
}: {
  estado: string;
  texto: string;
}) {
  const { insignia, icono: Icono } = visualDeSolicitud(estado);

  return (
    <Badge className={insignia}>
      <Icono />
      {texto}
    </Badge>
  );
}
