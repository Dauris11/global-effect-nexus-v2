import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { PermisosPorPersona } from "@/components/permisos/permisos-por-persona";
import { PermisosPorRol } from "@/components/permisos/permisos-por-rol";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requerirRol } from "@/lib/auth";
import {
  listarPermisosPorRol,
  listarPersonasConPermisos,
} from "@/server/configuracion/consultas-permisos";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "permisosAdmin" });
  return { title: t("title") };
}

/**
 * Permisos, solo del super_admin. Dos vistas de lo mismo: lo que trae cada rol
 * y los cambios personales sobre ese rol (la función fuera de lo nativo, como
 * el profesor de Habitudes que además da una clase de 360).
 */
export default async function PaginaPermisos({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requerirRol(["super_admin"]);

  const [t, roles, personas, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "permisosAdmin" }),
    listarPermisosPorRol(),
    listarPersonasConPermisos(),
    // Los componentes de abajo son cliente: sin su espacio no tendrían textos.
    mensajesCliente(["permisosAdmin"]),
  ]);

  return (
    <div className="animate-entrada mx-auto max-w-5xl space-y-8">
      <EncabezadoPagina titulo={t("title")} />

      <Tabs defaultValue="rol" className="space-y-8">
        <TabsList className="grid w-full grid-cols-2 sm:w-72">
          <TabsTrigger value="rol">{t("byRole")}</TabsTrigger>
          <TabsTrigger value="persona">{t("byPerson")}</TabsTrigger>
        </TabsList>

        <NextIntlClientProvider messages={mensajes}>
          <TabsContent value="rol">
            <PermisosPorRol roles={roles} />
          </TabsContent>
          <TabsContent value="persona">
            <PermisosPorPersona personas={personas} roles={roles} />
          </TabsContent>
        </NextIntlClientProvider>
      </Tabs>
    </div>
  );
}
