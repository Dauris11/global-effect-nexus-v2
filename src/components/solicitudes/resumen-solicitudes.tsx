import { ArrowRight, Inbox } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fechaCorta } from "@/lib/fechas";
import { visualDeSolicitud } from "@/lib/solicitudes";
import { cn } from "@/lib/utils";
import type { FilaSolicitud } from "@/server/solicitudes/consultas";

/**
 * Las últimas solicitudes de una persona, en corto, con un enlace a donde se
 * siguen enteras.
 *
 * Es de servidor y solo lee: la línea de tiempo y la cancelación viven en la
 * pantalla de solicitudes. Un resumen con botones obligaría a mandar al
 * navegador los mensajes del módulo entero para tres filas.
 *
 * Es una sección suelta —título, filas separadas por línea— y no una tarjeta:
 * en el lenguaje "app web" lo que separa los bloques es el aire. El estado
 * lleva su insignia de `ESTADO_SOLICITUD_VISUAL` con su icono, que es el único
 * sitio donde puede aparecer el `SEMAFORO`.
 */
export async function ResumenSolicitudes({
  solicitudes,
  href,
  locale,
}: {
  solicitudes: readonly FilaSolicitud[];
  /** A dónde lleva "ver todas". */
  href: string;
  locale: Locale;
}) {
  const t = await getTranslations("requests");

  return (
    <section className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="texto-titulo-seccion">{t("summaryTitle")}</h2>

        <Link
          href={href}
          className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-control px-2 text-sm font-semibold text-marca-600 outline-none hover:text-marca-700 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("summaryAll")}
          <ArrowRight className="size-4" />
        </Link>
      </div>

      {solicitudes.length === 0 ? (
        <EstadoVacio icono={Inbox} titulo={t("summaryEmpty")} />
      ) : (
        <ul>
          {solicitudes.map((solicitud) => {
            const { insignia, icono: Icono } = visualDeSolicitud(
              solicitud.estado,
            );

            return (
              <li
                key={solicitud.id}
                className="flex items-center gap-3 border-b border-linea py-3 last:border-b-0"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-tinta">
                  <Inbox className="size-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{solicitud.titulo}</p>
                  <p className="truncate text-sm text-tinta-2">
                    #{solicitud.folio} · {t(`type.${solicitud.tipo}` as never)}{" "}
                    · {fechaCorta(solicitud.creada.slice(0, 10), locale)}
                  </p>
                </div>

                <Badge className={cn("shrink-0", insignia)}>
                  <Icono />
                  {t(`status.${solicitud.estado}` as never)}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
