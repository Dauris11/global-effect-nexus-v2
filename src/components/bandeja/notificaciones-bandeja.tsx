import { Bell, Check, CheckCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { TarjetaBandeja } from "@/components/bandeja/tarjeta-bandeja";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fechaConHora } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { marcarLeida, marcarTodasLeidas } from "@/server/notificaciones/acciones";
import type { Notificacion } from "@/server/notificaciones/consultas";

/**
 * Notificaciones de la cuenta, con las mismas acciones que la campana
 * (`server/notificaciones/acciones.ts`). Son formularios con acción de
 * servidor y no un componente cliente: marcar como leída no necesita estado en
 * el navegador, y así el bloque funciona sin JavaScript. Las acciones
 * revalidan el layout, de modo que la campana de arriba se actualiza sola.
 *
 * Un aviso con enlace se abre desde el propio título; el botón de marcar
 * existe aparte para quien quiere archivarlo sin ir.
 */
export function NotificacionesBandeja({
  notificaciones,
  idioma,
}: {
  notificaciones: readonly Notificacion[];
  idioma: Locale;
}) {
  const t = useTranslations("bandeja.notifications");
  const sinLeer = notificaciones[0]?.sin_leer ?? 0;

  return (
    <TarjetaBandeja
      icono={Bell}
      titulo={t("title")}
      acciones={
        sinLeer > 0 ? (
          <form action={marcarTodasLeidas} className="ml-auto">
            <Button type="submit" variant="ghost" size="sm">
              <CheckCheck className="size-4" />
              {t("markAll")}
            </Button>
          </form>
        ) : undefined
      }
    >
      {notificaciones.length === 0 ? (
        <EstadoVacio icono={Bell} titulo={t("empty")} />
      ) : (
        <ul>
          {notificaciones.map((aviso) => (
            <li
              key={aviso.id}
              className="-mx-2 flex items-start gap-3 border-b border-linea px-2 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  {!aviso.leida && <Badge className="bg-marca-50 text-marca-700">{t("unread")}</Badge>}
                  {aviso.enlace ? (
                    <Link
                      href={aviso.enlace}
                      className={cn(
                        "min-w-0 truncate text-sm text-tinta hover:underline",
                        aviso.leida ? "font-medium" : "font-semibold",
                      )}
                    >
                      {aviso.titulo}
                    </Link>
                  ) : (
                    <p className={cn("min-w-0 truncate text-sm text-tinta", aviso.leida ? "font-medium" : "font-semibold")}>
                      {aviso.titulo}
                    </p>
                  )}
                </div>
                <p className="line-clamp-2 text-sm text-tinta-2">{aviso.mensaje}</p>
                <p className="texto-meta">{fechaConHora(aviso.created_at, null, idioma)}</p>
              </div>

              {!aviso.leida && (
                <form action={marcarLeida}>
                  <input type="hidden" name="id" value={aviso.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    aria-label={t("markRead")}
                    title={t("markRead")}
                  >
                    <Check className="size-4" />
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </TarjetaBandeja>
  );
}
