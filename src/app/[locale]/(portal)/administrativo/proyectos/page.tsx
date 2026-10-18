import type { Metadata } from "next";
import { FolderKanban } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { GestionProyectos } from "@/components/operaciones/gestion-proyectos";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { tienePermiso } from "@/lib/rbac";
import { proyectosConAvance } from "@/server/operaciones/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });

  return { title: t("projects.title") };
}

/**
 * Proyectos: las iniciativas que agrupan las tareas del equipo.
 *
 * Mismas dos puertas que el tablero: `operaciones.leer` para entrar y
 * `operaciones.escribir` para tocar. Docencia ve en qué anda el
 * equipo sin poder cambiarlo.
 *
 * No hay filtros ni tope de filas, a diferencia del catálogo académico: los
 * proyectos de una fundación se cuentan por decenas al año, no por cientos.
 * Añadir un buscador aquí sería resolver un problema que esta lista no tiene.
 */
import { Link } from "@/i18n/navigation";

export default async function PaginaProyectos({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const usuario = await requerirPermiso("operaciones.leer");
  const puedeAsignarRoles = tienePermiso(usuario.rol, "proyectos.asignar_rol");

  const [t, proyectos, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    proyectosConAvance(),
    mensajesCliente(["admin"]),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold tracking-widest text-marca-500 uppercase">
            {t("hub.link_projects")}
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
            <FolderKanban className="size-5 text-marca-500" />
            {t("projects.title")}
          </h1>
        </div>

        {puedeAsignarRoles && (
          <Link
            href="/administrativo/proyectos/roles"
            className="inline-flex min-h-[40px] items-center rounded-lg border border-marca-500/30 bg-marca-50 px-3.5 text-xs font-semibold text-marca-600 hover:bg-marca-100 active:scale-95"
          >
            {t("hub.link_role_assignments")}
          </Link>
        )}
      </div>

      <NextIntlClientProvider messages={mensajes}>
        <GestionProyectos
          proyectos={proyectos}
          puedeEscribir={tienePermiso(usuario.rol, "operaciones.escribir")}
        />
      </NextIntlClientProvider>
    </div>
  );
}
