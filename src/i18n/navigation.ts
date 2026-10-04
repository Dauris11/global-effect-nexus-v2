import { hasLocale } from "next-intl";
import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Envoltorios de navegación conscientes del idioma. Hay que importar `Link`,
 * `redirect` y `useRouter` desde aquí y no desde `next/link` o `next/navigation`:
 * estos conservan el prefijo de idioma activo.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

/**
 * Igual que `redirect`, pero tipado como `never`.
 *
 * `redirect` funciona lanzando una excepción que Next intercepta, pero
 * next-intl lo declara devolviendo `void`. Con esa firma TypeScript cree que
 * la ejecución continúa, así que un guardián como
 * `if (!usuario) redirect(...); return usuario;` no compila: el compilador
 * sigue viendo `usuario` como posiblemente nulo.
 *
 * El `throw` final no se alcanza nunca; está para que la firma sea cierta.
 */
export function redirigir(href: string, locale: string): never {
  // `getLocale()` devuelve `string`; se normaliza aquí para no repartir
  // aserciones de tipo por cada sitio que redirige.
  redirect({
    href,
    locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
  });

  throw new Error(`La redirección a ${href} no interrumpió la ejecución.`);
}
