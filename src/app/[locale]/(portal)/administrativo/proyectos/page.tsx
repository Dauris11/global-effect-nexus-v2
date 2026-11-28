import type { Metadata } from "next";
import { UsersRound } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { MenuMasAcciones } from "@/components/app/menu-mas-acciones";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { GestionProyectos } from "@/components/operaciones/gestion-proyectos";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import {
  usuarioTienePermiso,
} from "@/lib/rbac";
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

export default async function PaginaProyectos({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const usuario = await requerirPermiso("operaciones.leer");
  const puedeAsignarRoles = usuarioTienePermiso(usuario, "proyectos.asignar_rol");

  const [t, proyectos, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    proyectosConAvance(),
    mensajesCliente(["admin"]),
  ]);

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title={t("projects.title")}
        secondaryActions={
          // «Asignar por rol» es de uso ocasional: va en el menú ⋯ y no como botón junto al título.
          puedeAsignarRoles ? (
            <MenuMasAcciones acciones={[{ etiqueta: t("hub.link_role_assignments"), icono: <UsersRound />, href: "/administrativo/proyectos/roles" }]} />
          ) : undefined
        }
      />

      <NextIntlClientProvider messages={mensajes}>
        <GestionProyectos
          proyectos={proyectos}
          puedeEscribir={usuarioTienePermiso(usuario, "operaciones.escribir")}
        />
      </NextIntlClientProvider>
    </PageContainer>
  );
}
