import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { GrupoContable, ModuloContable } from "@/lib/contabilidad/modulos";

/**
 * Los módulos del departamento, agrupados por el trabajo que resuelven.
 *
 * Una lista por grupo y no un mosaico de tarjetas iguales: el contable busca
 * "dónde registro un gasto", no un icono, así que el nombre del grupo y la línea
 * de cada módulo hacen el trabajo. Recibe la lista ya filtrada por permiso.
 */
export function LanzadorModulos({
  grupos,
}: {
  grupos: readonly { grupo: GrupoContable; modulos: readonly ModuloContable[] }[];
}) {
  const t = useTranslations("contab.modulos");
  const tn = useTranslations("nav");

  return (
    <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
      {grupos.map(({ grupo, modulos }) => (
        <section key={grupo} aria-labelledby={`grupo-${grupo}`} className="min-w-0">
          <h3 id={`grupo-${grupo}`} className="texto-meta mb-2 font-medium">
            {tn(`contabGroups.${grupo}` as never)}
          </h3>
          <ul className="space-y-1">
            {modulos.map((modulo) => {
              const Icono = modulo.icono;
              return (
                <li key={modulo.clave}>
                  <Link
                    href={modulo.href}
                    className="rounded-control flex min-h-11 items-start gap-3 px-2 py-2 hover:bg-muted/60"
                  >
                    <Icono className="mt-0.5 size-5 shrink-0 text-tinta-2" />
                    <span className="min-w-0">
                      <span className="block font-medium text-tinta">
                        {tn(modulo.etiqueta as never)}
                      </span>
                      <span className="texto-meta block">{t(`${modulo.clave}` as never)}</span>
                    </span>
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
