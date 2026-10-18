import type { Metadata } from "next";
import { FolderKanban, ShieldCheck } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { MatrizProyectosRoles } from "@/components/operaciones/matriz-proyectos-roles";
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
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold tracking-widest text-marca-500 uppercase">
            {t("rolesEyebrow")}
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-tinta">
            <ShieldCheck className="size-6 text-marca-500" />
            {t("rolesHeading")}
          </h1>
        </div>

        <Link
          href="/administrativo/proyectos"
          className="inline-flex min-h-[40px] items-center rounded-lg border border-linea-fuerte bg-white px-3 text-xs font-medium text-tinta hover:bg-muted active:scale-95"
        >
          {t("backToProjects")}
        </Link>
      </div>

      <NextIntlClientProvider messages={mensajes}>
        <MatrizProyectosRoles proyectosIniciales={matriz} />
      </NextIntlClientProvider>
    </div>
  );
}
