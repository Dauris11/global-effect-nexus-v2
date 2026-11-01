import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { Administracion360 } from "@/components/global360/administracion";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { docentesAsignables } from "@/server/academico/consultas";
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
 * lo muestra al estudiante en cuanto esta pantalla lo guarda.
 *
 * Cierra con `academico.escribir` —`admin` y `super_admin`— y no con una lista
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

  const [t, materias, lista, periodos, docentes, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "global360" }),
    catalogo(),
    ventanas(),
    periodosDisponibles(),
    docentesAsignables(),
    mensajesCliente(["global360"]),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-marca-500 uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="size-5 text-marca-500" />
          {t("title")}
        </h1>
      </div>

      <NextIntlClientProvider messages={mensajes}>
        <Administracion360
          materias={materias}
          ventanas={lista}
          periodos={periodos}
          docentes={docentes}
        />
      </NextIntlClientProvider>
    </div>
  );
}
