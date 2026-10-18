import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { FormularioRendicionGasto } from "@/components/colaborador/formulario-rendicion-gasto";
import { ListaRendiciones } from "@/components/colaborador/lista-rendiciones";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirUsuario } from "@/lib/auth";
import { tienePermiso } from "@/lib/rbac";
import {
  misRendiciones,
  programasParaRendicion,
  todasRendiciones,
} from "@/server/colaborador/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "rendicion" });

  return { title: t("pageTitle") };
}

/**
 * Módulo de Rendición de Gastos y Facturas con OCR.
 *
 * Permite a los colaboradores (docentes, líderes de Habitudes, administración y contabilidad)
 * subir comprobantes de compras operativas con escaneo inteligente de NCF y RNC ante DGII,
 * imputando cada egreso a los programas sociales de la fundación.
 */
export default async function PaginaRendiciones({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const usuario = await requerirUsuario();

  const puedeRevisar = tienePermiso(usuario.rol, "rendicion.revisar");

  const [t, programas, rendiciones, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "rendicion" }),
    programasParaRendicion(),
    puedeRevisar ? todasRendiciones() : misRendiciones(usuario.id),
    mensajesCliente(["rendicion", "colaborador", "admin"]),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold tracking-widest text-marca-500 uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-tinta">
            <Receipt className="size-6 text-marca-500" />
            {t("heading")}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/administrativo/tareas/hoy"
            className="inline-flex min-h-[40px] items-center rounded-lg border border-linea-fuerte bg-white px-3 text-xs font-medium text-tinta hover:bg-muted active:scale-95"
          >
            {t("backToToday")}
          </Link>
          {puedeRevisar && (
            <Link
              href="/portal/contabilidad/gastos"
              className="inline-flex min-h-[40px] items-center rounded-lg border border-marca-700/30 bg-marca-50 px-3 text-xs font-semibold text-marca-700 hover:bg-marca-100 active:scale-95"
            >
              {t("viewAccountingHub")}
            </Link>
          )}
        </div>
      </div>

      <NextIntlClientProvider messages={mensajes}>
        <div className="space-y-6">
          <FormularioRendicionGasto programas={programas} />

          <div className="pt-2">
            <h2 className="mb-3 text-base font-bold text-tinta">
              {puedeRevisar ? t("allSubmissionsTitle") : t("mySubmissionsTitle")}
            </h2>
            <ListaRendiciones
              rendiciones={rendiciones}
              puedeRevisar={puedeRevisar}
            />
          </div>
        </div>
      </NextIntlClientProvider>
    </div>
  );
}
