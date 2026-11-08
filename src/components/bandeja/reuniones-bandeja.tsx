import { CalendarDays, Clock, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";

import { TarjetaBandeja } from "@/components/bandeja/tarjeta-bandeja";
import { Dato, FilaDatos } from "@/components/ui/dato";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fechaCorta } from "@/lib/fechas";
import type { Reunion } from "@/lib/reuniones";

/** Las próximas reuniones de la agenda, ya filtradas y ordenadas por la consulta. */
export function ReunionesBandeja({
  reuniones,
  idioma,
}: {
  reuniones: readonly Reunion[];
  idioma: Locale;
}) {
  const t = useTranslations("bandeja");

  return (
    <TarjetaBandeja
      icono={CalendarDays}
      titulo={t("meetings.title")}
      verTodo={{ href: "/reuniones", etiqueta: t("seeAll") }}
    >
      {reuniones.length === 0 ? (
        <EstadoVacio icono={CalendarDays} titulo={t("meetings.empty")} />
      ) : (
        <ul>
          {reuniones.map((reunion) => (
            <li key={reunion.id} className="-mx-2 border-b border-linea px-2 py-3 last:border-b-0">
              <Link
                href={`/reuniones#reunion-${reunion.id}`}
                className="group block space-y-1 rounded-control p-1 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="truncate text-sm font-semibold text-tinta transition-colors group-hover:text-marca-600">
                  {reunion.titulo}
                </p>
                <FilaDatos>
                  <Dato icono={CalendarDays}>{fechaCorta(reunion.fecha, idioma)}</Dato>
                  <Dato icono={Clock}>{reunion.hora_inicio}</Dato>
                  {reunion.lugar_o_enlace && <Dato icono={MapPin}>{reunion.lugar_o_enlace}</Dato>}
                </FilaDatos>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </TarjetaBandeja>
  );
}
