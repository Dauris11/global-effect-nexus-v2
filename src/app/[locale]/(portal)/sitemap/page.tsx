import type { Metadata } from "next";
import { Globe, Layers, Search, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CifraAcademica } from "@/components/academico/cifra";
import { BloqueRol } from "@/components/sitemap/bloque-rol";
import { BuscadorMapa } from "@/components/sitemap/buscador-mapa";
import { Card, CardContent } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { requerirRol } from "@/lib/auth";
import { TARJETA } from "@/lib/paleta";
import { ROLES, type Permiso, type Rol } from "@/lib/rbac";
import { leerPermisosPorRol } from "@/server/configuracion/consultas-permisos";
import { construirIndice, menusPorRol } from "@/server/mapa-sitio/indice";

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
 * Rutas públicas, las que no piden cuenta. Escritas a mano porque no hay de
 * dónde derivarlas: `nav.ts` describe los menús de dentro. Si se añade una
 * quinta, este es el sitio.
 */
const PUBLICAS = [
  { href: "/", clave: "landing" },
  { href: "/comida", clave: "meals" },
  { href: "/login", clave: "login" },
  { href: "/auth/callback", clave: "oauth" },
] as const;

/**
 * Mapa del sitio: un buscador «¿dónde está…?» y, debajo, el menú de cada rol.
 *
 * NADA ESTÁ ESCRITO A MANO. Todo sale de `menuDe(rol)` (la barra lateral) y de
 * `ajustesDeUsuario` (el menú de Configuración, donde viven la base de
 * conocimiento de Elly AI, los parámetros o los permisos), recorridos para los
 * ocho roles: un módulo nuevo aparece aquí solo. Cada pantalla dice cómo llegar
 * (el camino por los menús) y marca si la cuenta que mira puede abrirla.
 */
export default async function PaginaSitemap({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const usuario = await requerirRol(["admin", "super_admin"]);

  const [t, tn, tr, ta] = await Promise.all([
    getTranslations({ locale, namespace: "sitemap" }),
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "roles" }),
    getTranslations({ locale, namespace: "settings.nav" }),
  ]);

  const permisosPorRol = new Map<Rol, readonly Permiso[]>(
    (await leerPermisosPorRol()).map((r) => [r.rol as Rol, r.permisos as Permiso[]]),
  );

  // Las claves vienen de listas derivadas (menús, ajustes): next-intl solo las
  // conoce en tiempo de ejecución, de ahí el `as never`.
  const clave = (k: string) => k as never;
  const menus = menusPorRol(permisosPorRol, usuario, {
    nav: (k) => tn(clave(k)),
    ajuste: (k) => ta(clave(k)),
  });

  const indice = construirIndice(menus, usuario.rol, {
    nav: (k) => tn(clave(k)),
    rol: (k) => tr(clave(k)),
    ajuste: (k) => ta(clave(k)),
    descripcionAjuste: (k) => t(clave(`settingsDesc.${k}`)),
    clavesAjuste: (k) => t(clave(`settingsKeys.${k}`)),
    ajustesEtiqueta: ta("label"),
  });

  return (
    <div className="animate-entrada mx-auto max-w-5xl space-y-6 pb-10">
      <EncabezadoPagina titulo={t("title")} />

      <div className="grid gap-3 sm:grid-cols-3">
        <CifraAcademica valor={ROLES.length} etiqueta={t("stats.roles")} icono={Users} />
        <CifraAcademica valor={indice.length} etiqueta={t("stats.modules")} icono={Layers} acento />
        <CifraAcademica valor={PUBLICAS.length} etiqueta={t("stats.public")} icono={Globe} />
      </div>

      <Card className={TARJETA.contenido}>
        <CardContent className="space-y-3 pt-5">
          <p className="texto-titulo-tarjeta flex items-center gap-2">
            <Search className="size-4" />
            {t("finder.title")}
          </p>
          <BuscadorMapa
            entradas={indice}
            textos={{
              placeholder: t("finder.title"),
              vacio: t("finder.empty"),
              comoLlegar: t("finder.howTo"),
              abrir: t("finder.open"),
              sinAcceso: t("finder.locked"),
              roles: t("finder.roles"),
              resultados: t("finder.results"),
            }}
          />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <p className="texto-titulo-seccion">{t("public.title")}</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {PUBLICAS.map((ruta) => (
            <li key={ruta.href} className="rounded-card border border-linea px-4 py-3">
              <p className="text-sm font-medium">{t(clave(`public.${ruta.clave}`))}</p>
              <p className="texto-meta font-mono">{ruta.href}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <p className="texto-titulo-seccion">{t("byRole")}</p>
        {menus.map((menu) => (
          <BloqueRol key={menu.rol} menu={menu} abierto={menu.rol === usuario.rol} />
        ))}
      </section>
    </div>
  );
}
