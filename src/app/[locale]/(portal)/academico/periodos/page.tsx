import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { GestionPeriodos } from "@/components/academico/gestion-periodos";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { tienePermiso } from "@/lib/rbac";
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
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-[#2096BA] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <CalendarDays className="size-5 text-[#2096BA]" />
          {t("terms.title")}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {t("terms.description")}
        </p>
      </div>

      <NextIntlClientProvider messages={mensajes}>
        <GestionPeriodos
          periodos={periodos}
          puedeEscribir={tienePermiso(usuario.rol, "academico.escribir")}
        />
      </NextIntlClientProvider>
    </div>
  );
}
