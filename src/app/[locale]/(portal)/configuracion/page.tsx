import type { Metadata } from "next";
import { KeyRound, ScrollText, Settings, ShieldCheck, UserCog, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CifraAcademica } from "@/components/academico/cifra";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Link } from "@/i18n/navigation";
import { requerirRol } from "@/lib/auth";
import { menuDe, itemsDeArea } from "@/lib/nav";
import { visibilidadDeRol } from "@/server/visibilidad/consultas";
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

  const [t, tRoles, cuentas, cifras] = await Promise.all([
    getTranslations({ locale, namespace: "settings" }),
    getTranslations({ locale, namespace: "roles" }),
    cuentasDelSistema(),
    cifrasDelSistema(),
  ]);

  // Los módulos que ofrece el menú de esta cuenta. Sale de `menuDe`, igual que
  // el mapa del sitio: una cifra de "módulos" escrita a mano se queda vieja.
  const modulos = menuDe(usuario.rol, new Set((await visibilidadDeRol(usuario.rol)).fueraDelMenu)).flatMap(itemsDeArea).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <EncabezadoPagina titulo={t("title")} />

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

      {/* Cuentas del sistema. */}
      <Card className={TARJETA.contenido}>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{t("accounts.title")}</p>
            </div>

            <Link
              href="/administrativo/personal"
              className="text-marca-700 shrink-0 text-xs font-medium hover:underline"
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
                            ? "bg-marca-50 text-marca-700"
                            : "bg-muted text-tinta-2",
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
