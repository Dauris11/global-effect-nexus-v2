import type { Metadata } from "next";
import {
  Check,
  Globe,
  Layers,
  Lock,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CifraAcademica } from "@/components/academico/cifra";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Link } from "@/i18n/navigation";
import { requerirRol } from "@/lib/auth";
import { itemsDeArea, menuDe } from "@/lib/nav";
import { CUADRO, TARJETA } from "@/lib/paleta";
import {
  PORTAL_POR_ROL,
  ROLES,
  tienePermiso,
  type Rol,
  usuarioTienePermiso,
} from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { leerPermisosPorRol } from "@/server/configuracion/consultas-permisos";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "modules" });

  return { title: t("sitemap.title") };
}

/**
 * Rutas públicas, las que no piden cuenta.
 *
 * Escritas a mano porque no hay de dónde derivarlas: `nav.ts` describe los
 * menús de dentro, y la zona pública no tiene menú de rol. Son cuatro y no
 * cambian a menudo; si alguna vez se añade una quinta, este es el sitio.
 */
const PUBLICAS = [
  { href: "/", clave: "landing" },
  { href: "/comida", clave: "meals" },
  { href: "/login", clave: "login" },
  { href: "/auth/callback", clave: "oauth" },
] as const;

/**
 * Mapa del sitio.
 *
 * NO ES UNA LISTA ESCRITA A MANO, y esa es la única decisión que importa aquí.
 * El inventario del prototipo describía esta pantalla como cuatro tarjetas con
 * sus módulos dentro, escritos uno por uno; una lista así nace desfasada —el
 * día que se añade un módulo, esta pantalla es la última en enterarse— y
 * además miente con la mejor intención, porque nadie la revisa.
 *
 * Todo lo que se ve sale de `menuDe(rol)`, el mismo menú que dibuja la barra
 * lateral, recorrido para los siete roles. Si mañana un módulo cambia de área,
 * cambia de permiso o desaparece, este mapa lo refleja sin que nadie lo toque.
 * Es la misma decisión que ya se tomó en el portal administrativo.
 *
 * Lo que sí se calcula aquí y no está en ningún otro sitio:
 *
 *   · **Qué puede abrir la cuenta que mira.** Cada entrada se marca según
 *     `tienePermiso(rol de quien mira, permiso de la entrada)`. Un mapa del
 *     sitio que enseña puertas sin decir cuáles están cerradas para ti no
 *     ayuda a nadie.
 *   · **Qué módulos son compartidos.** Se cuenta en cuántos menús de rol
 *     aparece cada ruta; los que salen en más de uno se listan aparte. El
 *     inventario los enumeraba a mano y se le habían quedado tres fuera.
 *
 * Sin una línea de JavaScript de cliente: no escribe nada y no tiene estado,
 * así que todo son enlaces.
 */
export default async function PaginaSitemap({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const usuario = await requerirRol(["admin", "super_admin"]);

  const [t, tn, tr] = await Promise.all([
    getTranslations({ locale, namespace: "sitemap" }),
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "roles" }),
  ]);

  // El menú de cada rol, con el filtro de permisos de ESE rol: es lo que ese
  // rol ve de verdad al entrar, no el catálogo entero.
  const permisosPorRol = await leerPermisosPorRol();
  const menus = ROLES.map((rol) => ({
    rol,
    areas: menuDe(
      rol,
      undefined,
      new Set(permisosPorRol.find((r) => r.rol === rol)?.permisos ?? []),
    ),
  }));

  // Cuántos menús de rol nombran cada ruta. Un módulo en más de uno es
  // compartido, y eso es una propiedad del sistema, no una lista que mantener.
  const enCuantosRoles = new Map<string, { etiqueta: string; roles: Rol[] }>();

  for (const { rol, areas } of menus) {
    for (const item of areas.flatMap(itemsDeArea)) {
      const previo = enCuantosRoles.get(item.href);

      if (previo) previo.roles.push(rol);
      else enCuantosRoles.set(item.href, { etiqueta: item.etiqueta, roles: [rol] });
    }
  }

  const compartidos = [...enCuantosRoles.entries()]
    .filter(([, dato]) => dato.roles.length > 1)
    .sort((a, b) => b[1].roles.length - a[1].roles.length);

  return (
    <div className="animate-entrada mx-auto max-w-5xl space-y-6">
      <EncabezadoPagina titulo={t("title")} />

      <div className="grid gap-3 sm:grid-cols-3">
        <CifraAcademica
          valor={ROLES.length}
          etiqueta={t("stats.roles")}
          icono={Users}
        />
        <CifraAcademica
          valor={enCuantosRoles.size}
          etiqueta={t("stats.modules")}
          icono={Layers}
          acento
        />
        <CifraAcademica
          valor={PUBLICAS.length}
          etiqueta={t("stats.public")}
          icono={Globe}
        />
      </div>

      {/* Zona pública. Va primero porque es por donde entra todo el mundo. */}
      <Card className={TARJETA.contenido}>
        <CardContent className="space-y-3 pt-5">
          <div className="flex items-center gap-2">
            <span className={cn("size-7 rounded-lg", CUADRO.suave, "flex items-center justify-center")}>
              <Globe className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">{t("public.title")}</p>
            </div>
          </div>

          <ul className="grid gap-2 sm:grid-cols-2">
            {PUBLICAS.map((ruta) => (
              <li key={ruta.href} className={TARJETA.fila}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {t(`public.${ruta.clave}` as never)}
                  </p>
                  <p className="text-muted-foreground truncate font-mono text-[11px]">
                    {ruta.href}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Un bloque por rol, con sus áreas y sus módulos. */}
      {menus.map(({ rol, areas }) => (
        <Card key={rol} className={TARJETA.contenido}>
          <CardContent className="space-y-4 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{tr(rol)}</p>
                <p className="text-muted-foreground font-mono text-[11px]">
                  {rol} · {PORTAL_POR_ROL[rol]}
                </p>
              </div>

              <Badge variant="secondary" className="text-[10px]">
                {t("moduleCount", {
                  count: areas.flatMap(itemsDeArea).length,
                })}
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {areas.map((area) => (
                <div key={area.clave} className="space-y-1.5">
                  <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase">
                    <area.icono className="size-3.5" />
                    {tn(area.etiqueta as never)}
                  </p>

                  <ul className="space-y-1">
                    {itemsDeArea(area).map((item) => {
                      // Lo que la cuenta que mira puede abrir. Se calcula con
                      // SU rol, no con el rol del bloque: el bloque describe el
                      // menú de otro, y la marca dice si tú entras ahí.
                      const puedo =
                        !item.permiso || usuarioTienePermiso(usuario, item.permiso);

                      return (
                        <li key={`${area.clave}-${item.href}`}>
                          {/* Enlace solo si se puede entrar. Un enlace que
                              lleva a una pantalla que va a rechazarte no es un
                              atajo, es un tropiezo. */}
                          {puedo ? (
                            <Link
                              href={item.href}
                              className="hover:bg-muted/60 flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors"
                            >
                              <Contenido
                                etiqueta={tn(item.etiqueta as never)}
                                href={item.href}
                                permiso={item.permiso}
                                puedo
                              />
                            </Link>
                          ) : (
                            <div className="flex items-start gap-2 rounded-lg px-2 py-1.5 opacity-60">
                              <Contenido
                                etiqueta={tn(item.etiqueta as never)}
                                href={item.href}
                                permiso={item.permiso}
                                puedo={false}
                              />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Módulos compartidos, contados y no listados a mano. */}
      <Card className={TARJETA.contenido}>
        <CardContent className="space-y-3 pt-5">
          <div>
            <p className="text-sm font-semibold">{t("shared.title")}</p>
          </div>

          <ul className="space-y-1.5">
            {compartidos.map(([href, dato]) => (
              <li
                key={href}
                className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {tn(dato.etiqueta as never)}
                  </p>
                  <p className="text-muted-foreground truncate font-mono text-[11px]">
                    {href}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1">
                  {dato.roles.map((rol) => (
                    <Badge
                      key={rol}
                      variant="secondary"
                      className="text-[10px]"
                    >
                      {tr(rol)}
                    </Badge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

/** La fila de un módulo: su nombre, su ruta y qué permiso pide. */
function Contenido({
  etiqueta,
  href,
  permiso,
  puedo,
}: {
  etiqueta: string;
  href: string;
  permiso?: string;
  puedo: boolean;
}) {
  return (
    <>
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center",
          puedo ? "text-[#187a99]" : "text-muted-foreground",
        )}
      >
        {puedo ? <Check className="size-3.5" /> : <Lock className="size-3" />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm">{etiqueta}</span>
        <span className="text-muted-foreground block truncate font-mono text-[11px]">
          {href}
          {permiso ? ` · ${permiso}` : ""}
        </span>
      </span>
    </>
  );
}
