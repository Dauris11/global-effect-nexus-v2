import type { Metadata } from "next";
import { ScrollText, Settings, UserCog, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CifraAcademica } from "@/components/academico/cifra";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Link } from "@/i18n/navigation";
import { requerirRol } from "@/lib/auth";
import { menuDe, itemsDeArea } from "@/lib/nav";
import { visibilidadDeRol } from "@/server/visibilidad/consultas";
import { TARJETA } from "@/lib/paleta";
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

/** Las cuentas se enumeran aquí; el alta y el cambio de rol viven en `/administrativo/personal`. */
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
  const modulos = menuDe(
    usuario.rol,
    new Set((await visibilidadDeRol(usuario.rol)).fueraDelMenu),
    new Set(usuario.permisos),
  ).flatMap(itemsDeArea).length;

  return (
    <div className="animate-entrada mx-auto max-w-5xl space-y-6">
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
    </div>
  );
}
