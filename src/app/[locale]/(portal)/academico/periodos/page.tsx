import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { GestionPeriodos } from "@/components/academico/gestion-periodos";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import {
  usuarioTienePermiso,
} from "@/lib/rbac";
import { periodosGestionados } from "@/server/academico/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "modules" });

  return { title: t("academicTerms.title") };
}

/**
 * Períodos: los cuatrimestres y semestres de la Fundación.
 *
 * Es la raíz del módulo académico. Una materia, una inscripción y las dos tandas
 * de Global Effect 360 cuelgan todas de un período, así que esta es la primera fila que
 * hay que crear y la última que se puede borrar.
 *
 * DOS PUERTAS DISTINTAS, a propósito:
 *
 *   · `academico.leer` para entrar. El docente lo tiene: necesita saber qué
 *     cuatrimestre está abierto para entender sus propias pantallas.
 *   · `academico.escribir` para tocar. Un período es de la institución, no de
 *     nadie en concreto, y abrirlo o cerrarlo cambia dónde caen las notas de
 *     todo el mundo.
 *
 * `puedeEscribir` se resuelve aquí, en el servidor, y el componente solo decide
 * si pinta los botones. Las acciones lo vuelven a comprobar antes de escribir:
 * esconder un botón no es control de acceso.
 */
export default async function PaginaAcademicoPeriodos({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const usuario = await requerirPermiso("academico.leer");

  const [t, periodos, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "academic" }),
    periodosGestionados(),
    mensajesCliente(["academic"]),
  ]);

  return (
    <div className="animate-entrada mx-auto max-w-5xl space-y-6">
      <EncabezadoPagina titulo={t("terms.title")} />

      <NextIntlClientProvider messages={mensajes}>
        <GestionPeriodos
          periodos={periodos}
          puedeEscribir={usuarioTienePermiso(usuario, "academico.escribir")}
        />
      </NextIntlClientProvider>
    </div>
  );
}
