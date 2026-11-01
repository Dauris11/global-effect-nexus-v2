import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { VistaHoy } from "@/components/colaborador/vista-hoy";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
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
    <div className="animate-entrada mx-auto max-w-5xl space-y-6">
      <EncabezadoPagina
        titulo={t("heading")}
        acciones={
      <div className="flex items-center gap-2">
        <Link
          href="/administrativo/tareas"
          className="inline-flex min-h-[44px] items-center rounded-control border border-linea-fuerte bg-card px-3 text-xs font-medium text-tinta hover:bg-muted active:scale-95"
        >
          {t("viewGeneralBoard")}
        </Link>
        <Link
          href="/administrativo/rendiciones"
          className="inline-flex min-h-[44px] items-center rounded-control border border-marca-500/30 bg-marca-50 px-3 text-xs font-semibold text-marca-600 hover:bg-marca-100 active:scale-95"
        >
          {t("submitExpense")}
        </Link>
      </div>
        }
      />

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
