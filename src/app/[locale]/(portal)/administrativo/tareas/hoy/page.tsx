import type { Metadata } from "next";
import { CheckSquare } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { VistaHoy } from "@/components/colaborador/vista-hoy";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirUsuario } from "@/lib/auth";
import {
  bitacoraDeHoy,
  proyectosPorRol,
  resumenColaborador,
  tareasColaborador,
} from "@/server/colaborador/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "colaborador" });

  return { title: t("pageTitle") };
}

/**
 * Torre de Control del Colaborador: "Lo que me toca hoy".
 *
 * Centro neurálgico diario para todo el personal institucional
 * (dirección, docentes, facilitadores de Habitudes, contabilidad y operaciones).
 * Proporciona avance de tareas táctil, bitácora de actividades diarias y
 * visualización de programas asignados a su rol.
 */
export default async function PaginaLoQueMeTocaHoy({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const usuario = await requerirUsuario();

  const [t, tareas, bitacora, proyectos, resumen, mensajes] =
    await Promise.all([
      getTranslations({ locale, namespace: "colaborador" }),
      tareasColaborador(usuario.id),
      bitacoraDeHoy(usuario.id),
      proyectosPorRol(usuario.rol),
      resumenColaborador(usuario.id),
      mensajesCliente(["colaborador", "rendicion", "admin"]),
    ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold tracking-widest text-marca-500 uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-tinta">
            <CheckSquare className="size-6 text-marca-500" />
            {t("heading")}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/administrativo/tareas"
            className="inline-flex min-h-[40px] items-center rounded-lg border border-linea-fuerte bg-white px-3 text-xs font-medium text-tinta hover:bg-muted active:scale-95"
          >
            {t("viewGeneralBoard")}
          </Link>
          <Link
            href="/administrativo/rendiciones"
            className="inline-flex min-h-[40px] items-center rounded-lg border border-marca-500/30 bg-marca-50 px-3 text-xs font-semibold text-marca-600 hover:bg-marca-100 active:scale-95"
          >
            {t("submitExpense")}
          </Link>
        </div>
      </div>

      <NextIntlClientProvider messages={mensajes}>
        <VistaHoy
          tareasIniciales={tareas}
          bitacoraInicial={bitacora}
          proyectosAsignados={proyectos}
          resumen={resumen}
        />
      </NextIntlClientProvider>
    </div>
  );
}
