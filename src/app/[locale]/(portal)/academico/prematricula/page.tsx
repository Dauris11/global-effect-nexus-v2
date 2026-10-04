import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { Administracion360 } from "@/components/global360/administracion";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import {
  catalogo,
  periodosDisponibles,
  ventanas,
} from "@/server/global360/consultas";

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
 * lo muestra al becado universitario en cuanto esta pantalla lo guarda.
 *
 * Cierra con `academico.escribir` —`admin` y `super_admin`— y no con una lista
 * de roles: quien administre el catálogo académico es quien tenga ese permiso.
 *
 * El número de obligatorias no se fija en código: la pantalla enseña cuántas hay
 * activas para que administración vea si el catálogo cuadra con las cuatro que
 * pide el programa. Así se puede corregir sin migrar nada.
 */
export default async function PaginaPrematricula({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  await requerirPermiso("academico.escribir");

  const [t, materias, lista, periodos, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "global360" }),
    catalogo(),
    ventanas(),
    periodosDisponibles(),
    mensajesCliente(["global360"]),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-[#2096BA] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="size-5 text-[#2096BA]" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {t("description")}
        </p>
      </div>

      <NextIntlClientProvider messages={mensajes}>
        <Administracion360
          materias={materias}
          ventanas={lista}
          periodos={periodos}
        />
      </NextIntlClientProvider>
    </div>
  );
}
