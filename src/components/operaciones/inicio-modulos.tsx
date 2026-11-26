import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { SeccionNav } from "@/lib/nav";

/**
 * Los módulos del área, agrupados por sección, tal como los ve esta persona en
 * el menú. Recibe las secciones ya filtradas por permiso (`menuDe`), así que lo
 * que no puede abrir no aparece y no hay otra lista que mantener.
 */
export async function InicioModulos({
  secciones,
  locale,
}: {
  secciones: readonly SeccionNav[];
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "nav" });

  return (
    <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
      {secciones.map((seccion) => (
        <section key={seccion.etiqueta ?? "base"} className="min-w-0">
          {seccion.etiqueta && (
            <h2 className="texto-meta mb-2 font-medium">{t(seccion.etiqueta as never)}</h2>
          )}
          <ul className="space-y-1">
            {seccion.items.map((item) => {
              const Icono = item.icono;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="rounded-control flex min-h-11 items-center gap-3 px-2 py-2 hover:bg-muted/60"
                  >
                    <Icono className="size-5 shrink-0 text-tinta-2" />
                    <span className="font-medium text-tinta">{t(item.etiqueta as never)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
