import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { MatrizProyectosRoles } from "@/components/operaciones/matriz-proyectos-roles";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { matrizProyectosRoles } from "@/server/colaborador/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "colaborador" });

  return { title: t("rolesPageTitle") };
}

/**
 * Gobernanza de Proyectos por Rol (Exclusivo de Superadmin).
 *
 * Cada personal dentro de la fundación tiene asignados proyectos
 * dependiendo de su rol institucional (Administración, Docencia, Contabilidad, Habitudes),
 * determinado centralmente por el superadministrador.
 */
export default async function PaginaProyectosRoles({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requerirPermiso("proyectos.asignar_rol");

  const [t, matriz, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "colaborador" }),
    matrizProyectosRoles(),
    mensajesCliente(["colaborador", "admin"]),
  ]);

  return (
    <div className="animate-entrada mx-auto max-w-5xl space-y-6">
      <EncabezadoPagina
        titulo={t("rolesHeading")}
        acciones={
      <Link
        href="/administrativo/proyectos"
        className="inline-flex min-h-[44px] items-center rounded-control border border-linea-fuerte bg-card px-3 text-xs font-medium text-tinta hover:bg-muted active:scale-95"
      >
        {t("backToProjects")}
      </Link>
        }
      />

      <NextIntlClientProvider messages={mensajes}>
        <MatrizProyectosRoles proyectosIniciales={matriz} />
      </NextIntlClientProvider>
    </div>
  );
}
