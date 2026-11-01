"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Interruptor } from "@/components/ui/interruptor";
import {
  clavePermiso,
  grupoDePermiso,
  GRUPOS_PERMISOS,
  PERMISOS,
  type GrupoPermiso,
  type Permiso,
} from "@/lib/rbac";

export type EstadoPermiso = {
  activo: boolean;
  /** Solo en la vista por persona: de dónde sale lo que tiene. */
  origen?: "rol" | "habilitado" | "retirado";
};

/**
 * Los permisos agrupados por módulo, cada uno con su interruptor. La comparten
 * la vista por rol y la vista por persona: cambian de dónde sale el estado, no
 * cómo se dibuja.
 */
export function ListaPermisos({
  estadoDe,
  onCambio,
  deshabilitado,
}: {
  estadoDe: (permiso: Permiso) => EstadoPermiso;
  onCambio: (permiso: Permiso, activo: boolean) => void;
  deshabilitado?: boolean;
}) {
  const t = useTranslations("permisosAdmin");

  const grupos = (Object.keys(GRUPOS_PERMISOS) as GrupoPermiso[]).map((grupo) => ({
    grupo,
    permisos: PERMISOS.filter((p) => grupoDePermiso(p) === grupo),
  }));

  return (
    <div className="animate-entrada space-y-8">
      {grupos.map(({ grupo, permisos }) => (
        <section key={grupo} aria-labelledby={`grupo-${grupo}`}>
          <h3 id={`grupo-${grupo}`} className="texto-meta mb-2 font-medium">
            {t(`module.${grupo}`)}
          </h3>
          <ul className="divide-y divide-linea overflow-hidden rounded-card border border-linea bg-card">
            {permisos.map((permiso) => {
              const { activo, origen } = estadoDe(permiso);
              const nombre = t(`permission.${clavePermiso(permiso)}`);

              return (
                <li
                  key={permiso}
                  className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <span className="min-w-0 text-sm text-tinta">{nombre}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    {origen === "habilitado" && (
                      <Badge variant="marca">{t("granted")}</Badge>
                    )}
                    {origen === "retirado" && (
                      <Badge variant="neutra">{t("revoked")}</Badge>
                    )}
                    <Interruptor
                      activo={activo}
                      etiqueta={nombre}
                      deshabilitado={deshabilitado}
                      onCambio={(valor) => onCambio(permiso, valor)}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
