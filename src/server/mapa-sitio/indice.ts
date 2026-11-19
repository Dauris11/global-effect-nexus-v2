import { ajustesDeUsuario } from "@/lib/configuracion";
import { itemsDeArea, menuDe, type AreaNav } from "@/lib/nav";
import { ROLES, usuarioTienePermiso, type Permiso, type Rol, type UsuarioConPermisos } from "@/lib/rbac";

/**
 * Lo que el mapa del sitio sabe de cada pantalla, derivado de los menús reales.
 *
 * Nada está escrito a mano: sale de `menuDe(rol)` (la barra lateral) y de
 * `ajustesDeUsuario` (el menú de Configuración, que NO forma parte de la barra
 * y por eso el mapa antiguo no lo enseñaba: ahí vive, por ejemplo, la base de
 * conocimiento de Elly AI). Si un módulo cambia de lugar o de permiso, el mapa
 * lo refleja solo.
 */

export type EntradaMenu = {
  etiqueta: string;
  href: string;
  permiso?: Permiso;
  puedo: boolean;
};

export type AreaMapa = { clave: string; etiqueta: string; area: AreaNav; items: EntradaMenu[] };

export type AjusteMapa = EntradaMenu & { clave: string };

export type MenuDeRol = { rol: Rol; areas: AreaMapa[]; ajustes: AjusteMapa[] };

/** Una pantalla del buscador: dónde está, cómo se llega y quién la ve. */
export type EntradaIndice = {
  id: string;
  etiqueta: string;
  descripcion: string | null;
  href: string;
  /** «Configuración › Conocimiento»: el camino por los menús, para el rol de quien mira si lo tiene. */
  camino: string;
  roles: string[];
  permiso: string | null;
  puedo: boolean;
  /** Palabras extra para encontrarla («base de conocimiento», «cuotas»…). */
  claves: string;
};

type Traductores = {
  nav: (clave: string) => string;
  rol: (clave: string) => string;
  ajuste: (clave: string) => string;
  descripcionAjuste: (clave: string) => string;
  clavesAjuste: (clave: string) => string;
  ajustesEtiqueta: string;
};

export function menusPorRol(
  permisosPorRol: ReadonlyMap<Rol, readonly Permiso[]>,
  quien: UsuarioConPermisos,
  t: Pick<Traductores, "nav" | "ajuste">,
): MenuDeRol[] {
  return ROLES.map((rol) => {
    const permisos = permisosPorRol.get(rol) ?? [];
    const conjunto = new Set<Permiso>(permisos);

    const areas = menuDe(rol, undefined, conjunto).map((area) => ({
      clave: area.clave,
      etiqueta: t.nav(area.etiqueta),
      area,
      items: itemsDeArea(area).map((item) => ({
        etiqueta: t.nav(item.etiqueta),
        href: item.href,
        permiso: item.permiso,
        // Lo que puede abrir la cuenta que MIRA, no la del rol del bloque.
        puedo: !item.permiso || usuarioTienePermiso(quien, item.permiso),
      })),
    }));

    const ajustes = ajustesDeUsuario({ rol, permisosRol: permisos }).map((a) => {
      const permiso = a.permiso as Permiso;

      return {
        clave: a.clave,
        etiqueta: t.ajuste(a.clave),
        href: a.href,
        permiso,
        puedo: usuarioTienePermiso(quien, permiso) || ("roles" in a && Boolean((a.roles as readonly Rol[] | undefined)?.includes(quien.rol))),
      };
    });

    return { rol, areas, ajustes };
  });
}

/** El índice plano del buscador: una fila por ruta, con los roles que la tienen. */
export function construirIndice(
  menus: readonly MenuDeRol[],
  quien: Rol,
  t: Traductores,
): EntradaIndice[] {
  const porRuta = new Map<string, EntradaIndice & { caminos: Map<Rol, string> }>();

  const anotar = (
    rol: Rol,
    item: EntradaMenu,
    camino: string,
    extra?: { descripcion: string; claves: string; clave: string },
  ) => {
    const previo = porRuta.get(item.href);

    if (previo) {
      previo.roles.push(t.rol(rol));
      previo.caminos.set(rol, camino);
      previo.puedo ||= item.puedo;

      return;
    }

    porRuta.set(item.href, {
      id: item.href,
      etiqueta: item.etiqueta,
      descripcion: extra?.descripcion ?? null,
      href: item.href,
      camino,
      roles: [t.rol(rol)],
      permiso: item.permiso ?? null,
      puedo: item.puedo,
      claves: extra?.claves ?? "",
      caminos: new Map([[rol, camino]]),
    });
  };

  for (const { rol, areas, ajustes } of menus) {
    for (const area of areas) {
      for (const item of area.items) anotar(rol, item, `${area.etiqueta} › ${item.etiqueta}`);
    }

    for (const a of ajustes) {
      anotar(rol, a, `${t.nav("settings")} › ${t.ajustesEtiqueta} › ${a.etiqueta}`, {
        descripcion: t.descripcionAjuste(a.clave),
        claves: t.clavesAjuste(a.clave),
        clave: a.clave,
      });
    }
  }

  return [...porRuta.values()].map(({ caminos, ...entrada }) => ({
    ...entrada,
    // El camino del rol de quien mira, si lo tiene; si no, el del primero.
    camino: caminos.get(quien) ?? entrada.camino,
    roles: [...new Set(entrada.roles)],
  }));
}
