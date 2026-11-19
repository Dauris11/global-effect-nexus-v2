import { Check, Lock, Settings2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { PORTAL_POR_ROL } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import type { EntradaMenu, MenuDeRol } from "@/server/mapa-sitio/indice";

/**
 * El menú completo de un rol: sus áreas y, aparte, sus ajustes de Configuración.
 * Va plegado (`<details>`) salvo el de quien mira: son ocho roles y leerlos todos
 * seguidos es justo lo que el buscador de arriba evita.
 */
export async function BloqueRol({ menu, abierto }: { menu: MenuDeRol; abierto: boolean }) {
  const [t, tr] = await Promise.all([getTranslations("sitemap"), getTranslations("roles")]);
  const total = menu.areas.reduce((n, a) => n + a.items.length, 0) + menu.ajustes.length;

  return (
    <details open={abierto} className="rounded-card border border-linea">
      <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span className="min-w-0">
          <span className="text-[15px] font-semibold">{tr(menu.rol)}</span>
          <span className="texto-meta ml-2 font-mono">{PORTAL_POR_ROL[menu.rol]}</span>
        </span>
        <Badge variant="neutra">{t("moduleCount", { count: total })}</Badge>
      </summary>

      <div className="grid gap-4 border-t border-linea p-4 sm:grid-cols-2">
        {menu.areas.map((area) => (
          <div key={area.clave} className="space-y-1.5">
            <p className="texto-meta flex items-center gap-1.5 font-semibold tracking-wide uppercase">
              <area.area.icono className="size-3.5" />
              {area.etiqueta}
            </p>
            <ul className="space-y-1">
              {area.items.map((item) => (
                <li key={`${area.clave}-${item.href}`}>
                  <Fila item={item} />
                </li>
              ))}
            </ul>
          </div>
        ))}

        {menu.ajustes.length > 0 && (
          <div className="space-y-1.5">
            <p className="texto-meta flex items-center gap-1.5 font-semibold tracking-wide uppercase">
              <Settings2 className="size-3.5" />
              {t("settingsArea")}
            </p>
            <ul className="space-y-1">
              {menu.ajustes.map((a) => (
                <li key={a.href}>
                  <Fila item={a} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

/** Enlace solo si se puede entrar: uno que lleva a un rechazo no es un atajo, es un tropiezo. */
function Fila({ item }: { item: EntradaMenu }) {
  const contenido = (
    <>
      <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center", item.puedo ? "text-marca-700" : "text-tinta-3")}>
        {item.puedo ? <Check className="size-3.5" /> : <Lock className="size-3" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm">{item.etiqueta}</span>
        <span className="texto-meta block truncate font-mono">{item.href}</span>
      </span>
    </>
  );

  return item.puedo ? (
    <Link href={item.href} className="flex min-h-11 items-start gap-2 rounded-control px-2 py-1.5 transition-colors hover:bg-muted/60">
      {contenido}
    </Link>
  ) : (
    <div className="flex items-start gap-2 rounded-control px-2 py-1.5 opacity-60">{contenido}</div>
  );
}
