"use client";

import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";

import { itemsDeArea, menuDe, type ItemNav } from "@/lib/nav";
import type { Permiso, Rol } from "@/lib/rbac";

/**
 * Los módulos que vería una persona con estos permisos, agrupados por área del
 * menú. Sale de `menuDe`, el mismo que dibuja la barra lateral: así lo que se
 * enseña aquí no puede discrepar de lo que de verdad aparece, y la visibilidad
 * deja de ser una lista aparte que mantener.
 *
 * `compacto` aplana las áreas en una sola fila de chips (vista por persona).
 */
export function VistaModulos({
  rol,
  permisos,
  compacto = false,
}: {
  rol: Rol;
  permisos: ReadonlySet<Permiso>;
  compacto?: boolean;
}) {
  const t = useTranslations("permisosAdmin");
  const tNav = useTranslations("nav");

  const areas = menuDe(rol, permisos);
  const total = new Set(areas.flatMap((area) => itemsDeArea(area).map((i) => i.href))).size;

  const chip = (item: ItemNav) => (
    <li
      key={item.href}
      className="inline-flex items-center gap-1.5 rounded-full border border-linea px-3 py-1.5 text-sm text-tinta-2"
    >
      <item.icono className="size-4 shrink-0" />
      {tNav(item.etiqueta)}
    </li>
  );

  return (
    <section aria-labelledby={`vista-${rol}`} className="rounded-card border border-linea bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 id={`vista-${rol}`} className="texto-titulo-tarjeta flex items-center gap-2">
          <Eye className="text-marca-600 size-5" aria-hidden />
          {t("preview.title")}
        </h3>
        <span className="texto-meta">{t("preview.count", { count: total })}</span>
      </div>

      {areas.length === 0 ? (
        <p className="texto-meta">{t("preview.empty")}</p>
      ) : compacto ? (
        <ul className="flex flex-wrap gap-2">
          {areas.flatMap(itemsDeArea).filter((item, i, todos) => todos.findIndex((o) => o.href === item.href) === i).map(chip)}
        </ul>
      ) : (
        <div className="space-y-4">
          {areas.map((area) => (
            <div key={area.clave}>
              <p className="texto-meta mb-1.5 font-medium">{tNav(area.etiqueta)}</p>
              <ul className="flex flex-wrap gap-2">{itemsDeArea(area).map(chip)}</ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
