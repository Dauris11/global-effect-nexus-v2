import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { TableroTareas } from "@/components/operaciones/tablero-tareas";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirUsuario } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  actividadesSimples,
  proyectosSimples,
  tareasDelTablero,
  usuariosAsignables,
} from "@/server/operaciones/consultas";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });

  return { title: t("tasks") };
}

/**
 * «Tareas»: mi tablero (solo lo que tengo asignado). Arranca en «Abiertas» —vencidas + hoy +
 * próximas, por vencimiento— y muestra el chip rojo «Vencidas N» cuando hay atraso. Crear tareas
 * sigue pidiendo `operaciones.escribir`; mover las propias, no.
 */
export default async function PaginaTareas({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const usuario = await requerirUsuario();
  const puedeEscribir = usuarioTienePermiso(usuario, "operaciones.escribir");

  const [t, tareas, proyectos, actividades, personas, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "nav" }),
    tareasDelTablero({ usuarioId: usuario.id, puedeTodo: puedeEscribir, soloMias: true }),
    puedeEscribir ? proyectosSimples() : Promise.resolve([]),
    puedeEscribir ? actividadesSimples() : Promise.resolve([]),
    puedeEscribir ? usuariosAsignables() : Promise.resolve([]),
    mensajesCliente(["admin"]),
  ]);

  return (
    <PageContainer ancho className="space-y-6">
      <PageHeader title={t("tasks")} />
      <NextIntlClientProvider messages={mensajes}>
        <TableroTareas tareas={tareas} proyectos={proyectos} actividades={actividades} personas={personas} puedeEscribir={puedeEscribir} soloMias />
      </NextIntlClientProvider>
    </PageContainer>
  );
}
