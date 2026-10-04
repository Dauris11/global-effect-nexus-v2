import type { Metadata } from "next";
import {
  ArrowRight,
  Info,
  KeyRound,
  Megaphone,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CifraAcademica } from "@/components/academico/cifra";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requerirRol } from "@/lib/auth";
import { menuDe, itemsDeArea } from "@/lib/nav";
import { CUADRO, TARJETA } from "@/lib/paleta";
import {
  PERMISOS,
  ROLES,
  tienePermiso,
  type Rol,
} from "@/lib/rbac";
import { cn } from "@/lib/utils";
import {
  cifrasDelSistema,
  cuentasDelSistema,
} from "@/server/configuracion/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "modules" });

  return { title: t("settings.title") };
}

/**
 * Configuración: los ajustes, las cuentas, los roles y el estado del sistema.
 *
 * Era un índice con una sola tarjeta y quedaba pendiente «usuarios, roles y
 * parámetros institucionales». Se cierran los dos primeros, y el tercero se
 * dice en voz alta en vez de fingirlo (ver el aviso del final de la pantalla):
 * **no existe ninguna tabla de parámetros institucionales**, así que un
 * formulario aquí guardaría en el aire. Cuando haga falta, es una migración.
 *
 * Las cuentas se ENUMERAN, no se gestionan. El alta, el cambio de rol y el
 * reinicio de acceso están en `/administrativo/personal`, que ya existe y lo
 * hace bien; una segunda pantalla que también cambiara roles serían dos sitios
 * donde arreglar el mismo fallo. Desde aquí se enlaza allí.
 *
 * Los roles y sus permisos salen de `rbac.ts` recorrido con `tienePermiso`, no
 * de una lista escrita a mano: es el mismo objeto que decide los accesos de
 * verdad, así que esta tabla no puede mentir. Lo que sí conviene recordar es de
 * dónde viene ese objeto —de las tablas `rol` y `rol_permiso`—: si aquí sobra o
 * falta un permiso, lo que hay que mirar es la base.
 */
export default async function PaginaConfiguracion({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const usuario = await requerirRol(["admin", "super_admin"]);

  const [t, tAnuncios, tAudit, tRoles, cuentas, cifras] = await Promise.all([
    getTranslations({ locale, namespace: "settings" }),
    getTranslations({ locale, namespace: "announcements" }),
    getTranslations({ locale, namespace: "audit" }),
    getTranslations({ locale, namespace: "roles" }),
    cuentasDelSistema(),
    cifrasDelSistema(),
  ]);

  const ajustes = [
    {
      permiso: "landing.administrar" as const,
      href: "/configuracion/landing",
      icono: Megaphone,
      titulo: tAnuncios("title"),
      descripcion: tAnuncios("desc"),
      soloMaestro: false,
    },
    {
      // El visor de auditoría es solo del administrador maestro: enseña lo que
      // ha hecho cada cuenta, y eso incluye a quien coordina.
      permiso: "usuarios.administrar" as const,
      href: "/configuracion/auditoria",
      icono: ScrollText,
      titulo: tAudit("title"),
      descripcion: tAudit("description"),
      soloMaestro: true,
    },
    {
      permiso: "usuarios.administrar" as const,
      href: "/administrativo/personal",
      icono: UserCog,
      titulo: t("staff.title"),
      descripcion: t("staff.desc"),
      soloMaestro: false,
    },
  ].filter(
    (ajuste) =>
      tienePermiso(usuario.rol, ajuste.permiso) &&
      (!ajuste.soloMaestro || usuario.rol === "super_admin"),
  );

  // Los módulos que ofrece el menú de esta cuenta. Sale de `menuDe`, igual que
  // el mapa del sitio: una cifra de "módulos" escrita a mano se queda vieja.
  const modulos = menuDe(usuario.rol).flatMap(itemsDeArea).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-[#2096BA] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <Settings className="size-5 text-[#2096BA]" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {t("description")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CifraAcademica
          valor={cifras.activas}
          etiqueta={t("stats.activeAccounts")}
          icono={Users}
          acento
        />
        <CifraAcademica
          valor={cifras.cuentas}
          etiqueta={t("stats.accounts")}
          icono={UserCog}
        />
        <CifraAcademica
          valor={modulos}
          etiqueta={t("stats.modules")}
          icono={Settings}
        />
        <CifraAcademica
          valor={cifras.eventos}
          etiqueta={t("stats.events")}
          icono={ScrollText}
        />
      </div>

      {/* Ajustes que llevan a otra pantalla. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ajustes.map((ajuste) => (
          <Link key={ajuste.href} href={ajuste.href} className="group">
            <Card className={cn("h-full", TARJETA.interactiva)}>
              <CardContent className="pt-5">
                <span className={TARJETA.icono}>
                  <ajuste.icono className="size-5" />
                </span>

                <p className="mt-3 text-sm font-semibold">{ajuste.titulo}</p>
                <p className="text-muted-foreground mt-1 line-clamp-3 text-xs">
                  {ajuste.descripcion}
                </p>

                <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#2096BA]">
                  {t("open")}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Cuentas del sistema. */}
      <Card className={TARJETA.contenido}>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{t("accounts.title")}</p>
              <p className="text-muted-foreground text-xs">
                {t("accounts.hint")}
              </p>
            </div>

            <Link
              href="/administrativo/personal"
              className="shrink-0 text-xs font-medium text-[#187a99] hover:underline"
            >
              {t("accounts.manage")}
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th className="pb-2 font-medium">{t("accounts.name")}</th>
                  <th className="pb-2 font-medium">{t("accounts.email")}</th>
                  <th className="pb-2 font-medium">{t("accounts.role")}</th>
                  <th className="pb-2 font-medium">{t("accounts.state")}</th>
                </tr>
              </thead>

              <tbody>
                {cuentas.map((cuenta) => (
                  <tr key={cuenta.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{cuenta.nombre}</td>
                    <td className="text-muted-foreground py-2 pr-3 text-xs">
                      {cuenta.email}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant="secondary" className="text-[10px]">
                        {tRoles(cuenta.rol as never)}
                      </Badge>
                    </td>
                    <td className="py-2">
                      {/* Activa o no: peso, no matiz. Una cuenta desactivada no
                          es un error, es una decisión. */}
                      <Badge
                        className={cn(
                          "text-[10px]",
                          cuenta.activo
                            ? "bg-[#2096BA]/15 text-[#187a99]"
                            : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {cuenta.activo
                          ? t("accounts.active")
                          : t("accounts.inactive")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Roles y permisos. */}
      <Card className={TARJETA.contenido}>
        <CardContent className="space-y-3 pt-5">
          <div>
            <p className="text-sm font-semibold">{t("rolesTitle")}</p>
            <p className="text-muted-foreground text-xs">{t("rolesHint")}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {ROLES.map((rol) => (
              <FichaRol
                key={rol}
                rol={rol}
                nombre={tRoles(rol)}
                sinPermisos={t("noPermissions")}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lo que falta, dicho aquí y no en un cartel de "en construcción". */}
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-slate-500" />
        <p className="text-xs text-slate-600">{t("parametersNotice")}</p>
      </div>
    </div>
  );
}

/**
 * Un rol con los permisos que tiene de verdad.
 *
 * Se calcula recorriendo `PERMISOS` con `tienePermiso`, que es la misma función
 * que decide los accesos: si esta tarjeta y el sistema no coincidieran, sería
 * porque el sistema cambió de opinión, y eso es imposible por construcción.
 */
function FichaRol({
  rol,
  nombre,
  sinPermisos,
}: {
  rol: Rol;
  nombre: string;
  sinPermisos: string;
}) {
  const suyos = PERMISOS.filter((permiso) => tienePermiso(rol, permiso));

  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center gap-2">
        <span className={cn("flex size-7 items-center justify-center rounded-lg", CUADRO.marca)}>
          {rol === "super_admin" ? (
            <ShieldCheck className="size-3.5" />
          ) : (
            <KeyRound className="size-3.5" />
          )}
        </span>

        <div className="min-w-0">
          <p className="text-sm font-semibold">{nombre}</p>
          <p className="text-muted-foreground font-mono text-[11px]">{rol}</p>
        </div>
      </div>

      {suyos.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-xs">{sinPermisos}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1">
          {suyos.map((permiso) => (
            <span
              key={permiso}
              className="bg-muted rounded-full px-2 py-0.5 font-mono text-[10px]"
            >
              {permiso}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
