"use client";

import { Bell, BellRing, Check, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  marcarLeida,
  marcarTodasLeidas,
} from "@/server/notificaciones/acciones";

export type AvisoVisible = {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: string;
  leida: boolean;
  enlace: string | null;
  /** Ya formateada en el servidor, para no cargar date-fns en el navegador. */
  cuando: string;
};

/**
 * Campana de avisos de la barra superior.
 *
 * Cierra el círculo que estaba abierto desde la migración 0003: `notificacion`
 * se escribía —un aviso por asignado al crear una tarea— y **no había forma de
 * leerla desde el sitio**. Estaba anotado como deuda en `docs/estado/progreso.md`.
 *
 * Tres decisiones que se ven al usarla:
 *
 *   · **El punto solo aparece si hay algo sin leer.** Una campana que siempre
 *     lleva un número es una campana que se deja de mirar.
 *   · **Pulsar un aviso lo marca leído Y navega**, en el mismo gesto. Separarlo
 *     en «abrir» y «marcar» obliga a hacer dos veces el mismo trabajo, y nadie
 *     marca nada: la bandeja se queda con cincuenta avisos en negrita.
 *   · **Nada se borra.** Un aviso leído baja en la lista y pierde el resalte,
 *     pero se queda: es el rastro de que a alguien se le dijo algo, y quien lo
 *     recibió tiene derecho a comprobar qué le avisaron y cuándo.
 *
 * El aviso sin enlace —que la tabla admite— no se dibuja como enlace: es un
 * botón que solo lo marca leído. Un `href` vacío llevaría a la propia página y
 * parecería que la aplicación se ha quedado colgada.
 */
export function Campana({ avisos, sinLeer }: { avisos: readonly AvisoVisible[]; sinLeer: number }) {
  const t = useTranslations("notifications");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative flex size-11 items-center justify-center rounded-full transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={
          sinLeer > 0 ? t("unread", { count: sinLeer }) : t("title")
        }
        title={sinLeer > 0 ? t("unread", { count: sinLeer }) : t("title")}
      >
        {sinLeer > 0 ? (
          <BellRing className="size-5 text-marca-500" />
        ) : (
          <Bell className="size-5 text-tinta" />
        )}

        {sinLeer > 0 && (
          // El número, no solo el punto: «tienes avisos» y «tienes doce» son
          // dos cosas distintas para quien decide si mirar ahora o después.
          <span className="absolute top-1 right-1 flex min-w-5 items-center justify-center rounded-full border-2 border-background bg-tinta px-1 text-[10px] font-semibold text-background">
            {sinLeer > 9 ? "9+" : sinLeer}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <p className="texto-titulo-tarjeta">{t("title")}</p>

          {sinLeer > 0 && (
            <form action={marcarTodasLeidas}>
              <button
                type="submit"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
              >
                <Check className="size-3" />
                {t("markAll")}
              </button>
            </form>
          )}
        </div>

        <DropdownMenuSeparator className="my-0" />

        {avisos.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <span className="bg-muted text-tinta-2 mx-auto flex size-12 items-center justify-center rounded-full">
              <Bell className="size-5" />
            </span>
            <p className="mt-2 text-sm font-medium">{t("empty")}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {t("emptyHint")}
            </p>
          </div>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {avisos.map((aviso) => (
              <li key={aviso.id} className="border-b last:border-0">
                <form action={marcarLeida}>
                  <input type="hidden" name="id" value={aviso.id} />

                  <Cuerpo aviso={aviso} />
                </form>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * El aviso por dentro. Con enlace es un enlace dentro del formulario; sin
 * enlace, el botón que envía el formulario y nada más.
 *
 * El enlace lleva `onClick` que envía el formulario padre: así el mismo gesto
 * marca leído y navega. Si el JavaScript no ha cargado todavía, el enlace sigue
 * llevando a su sitio —solo se pierde la marca—, que es el orden correcto de
 * las dos cosas que hace.
 */
function Cuerpo({ aviso }: { aviso: AvisoVisible }) {
  const t = useTranslations("notifications");

  const contenido = (
    <>
      <span
        className={cn(
          "mt-1 size-2 shrink-0 rounded-full",
          aviso.leida ? "bg-transparent" : "bg-marca-500",
        )}
      />

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm",
            aviso.leida ? "font-normal" : "font-semibold",
          )}
        >
          {aviso.titulo}
        </span>
        <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
          {aviso.mensaje}
        </span>
        <span className="text-muted-foreground mt-1 flex items-center gap-1.5 text-[10px]">
          {/* La etiqueta del tipo se traduce AQUÍ y el título y el mensaje no:
              esos son datos —el nombre de la tarea, el del estudiante— y en la
              tabla hay una sola copia, escrita por quien la generó. Traducir
              una frase al guardarla la congelaría en el idioma de esa persona,
              que no tiene por qué ser el de quien la lee. */}
          <span className="bg-muted rounded-full px-1.5 py-0.5 font-medium">
            {t(`type.${aviso.tipo}` as never)}
          </span>
          {aviso.cuando}
        </span>
      </span>

      {aviso.enlace && (
        <ChevronRight className="text-muted-foreground mt-1 size-3.5 shrink-0" />
      )}
    </>
  );

  const clases = cn(
    "hover:bg-muted/60 flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors",
    !aviso.leida && "bg-marca-50/60",
  );

  if (!aviso.enlace) {
    return (
      <button type="submit" className={clases}>
        {contenido}
      </button>
    );
  }

  return (
    <Link
      href={aviso.enlace}
      className={clases}
      onClick={(evento) => {
        evento.currentTarget.closest("form")?.requestSubmit();
      }}
    >
      {contenido}
    </Link>
  );
}
