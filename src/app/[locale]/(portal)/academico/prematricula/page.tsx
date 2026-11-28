import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { Administracion360 } from "@/components/global360/administracion";
import { VentanaYElecciones } from "@/components/global360/ventana-y-elecciones";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { docentesAsignables } from "@/server/academico/consultas";
import {
  catalogo,
  periodosDisponibles,
  ventanaVigente,
  ventanas,
} from "@/server/global360/consultas";
import { eleccionesDeLaVentana } from "@/server/global360/prematricula-admin";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "global360" });

  return { title: t("title") };
}

/**
 * Prematrícula y catálogo de Global Effect 360, desde administración.
 *
 * Aquí se decide QUÉ materias ofrece el programa y CUÁNDO se pueden elegir. El
 * anuncio de la ventana sale solo: la cabecera de todas las pantallas internas
 * lo muestra al estudiante en cuanto esta pantalla lo guarda.
 *
 * Cierra con `academico.escribir` —`admin` y `owner`— y no con una lista
 * de roles: quien administre el catálogo académico es quien tenga ese permiso.
 *
 * Todo el catálogo activo es obligatorio y se cursa una materia por tanda: por
 * eso cada ventana se abre para una tanda concreta (1 o 2) de un período.
 */
export default async function PaginaPrematricula({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  await requerirPermiso("academico.escribir");

  const [t, materias, lista, periodos, docentes, mensajes, vigente] = await Promise.all([
    getTranslations({ locale, namespace: "global360" }),
    catalogo(),
    ventanas(),
    periodosDisponibles(),
    docentesAsignables(),
    mensajesCliente(["global360", "estados"]),
    ventanaVigente(),
  ]);
  const elecciones = vigente ? await eleccionesDeLaVentana(vigente.periodo_id) : [];

  return (
    <PageContainer className="space-y-6">
      <PageHeader title={t("title")} />

      <NextIntlClientProvider messages={mensajes}>
        {/* Primero la ventana y quién ya eligió; el catálogo y el alta de ventanas, debajo. */}
        <VentanaYElecciones
          ventana={vigente ? { id: vigente.id, periodo: vigente.periodo, ronda: vigente.ronda, abre: vigente.abre, cierra: vigente.cierra, abierta: vigente.abierta } : null}
          elecciones={elecciones}
        />
        <Administracion360
          materias={materias}
          ventanas={lista}
          periodos={periodos}
          docentes={docentes}
        />
      </NextIntlClientProvider>
    </PageContainer>
  );
}
