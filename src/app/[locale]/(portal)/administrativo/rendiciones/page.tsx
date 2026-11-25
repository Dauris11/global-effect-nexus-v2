import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { FormularioRendicionGasto } from "@/components/colaborador/formulario-rendicion-gasto";
import { ListaRendiciones } from "@/components/colaborador/lista-rendiciones";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Link } from "@/i18n/navigation";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirUsuario } from "@/lib/auth";
import {
  usuarioTienePermiso,
} from "@/lib/rbac";
import {
  becadosParaRendicion,
  misRendiciones,
  programasParaRendicion,
  solicitudesParaRendir,
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

  const puedeRevisar = usuarioTienePermiso(usuario, "rendicion.revisar");
  // `admin` revisa rendiciones pero no entra en contabilidad: el atajo solo
  // se ofrece a quien la puerta va a dejar pasar.
  const veContabilidad = usuarioTienePermiso(usuario, "contabilidad.leer");

  // Ver a qué estudiante se imputó un gasto es ver estudiantes: quien revisa
  // lo necesita para validar, y quien tiene `expedientes.leer` ya lo veía.
  const puedeElegirEstudiante = usuarioTienePermiso(usuario, "expedientes.leer");
  const verEstudiante = puedeElegirEstudiante || puedeRevisar;

  const [t, programas, solicitudes, becados, rendiciones, mensajes] =
    await Promise.all([
    getTranslations({ locale, namespace: "rendicion" }),
    programasParaRendicion(),
    solicitudesParaRendir(usuario.id),
    puedeElegirEstudiante ? becadosParaRendicion() : Promise.resolve(null),
    puedeRevisar
      ? todasRendiciones(verEstudiante)
      : misRendiciones(usuario.id, verEstudiante),
    mensajesCliente(["rendicion", "colaborador", "admin"]),
    ]);

  return (
    <div className="animate-entrada mx-auto max-w-5xl space-y-6">
      <EncabezadoPagina
        titulo={t("heading")}
        acciones={
      <div className="flex items-center gap-2">
        <Link
          href="/bandeja?tab=tareas"
          className="inline-flex min-h-[44px] items-center rounded-control border border-linea-fuerte bg-card px-3 text-xs font-medium text-tinta hover:bg-muted active:scale-95"
        >
          {t("backToToday")}
        </Link>
        {veContabilidad && (
          <Link
            href="/portal/contabilidad"
            className="inline-flex min-h-[44px] items-center rounded-control border border-marca-700/30 bg-marca-50 px-3 text-xs font-semibold text-marca-700 hover:bg-marca-100 active:scale-95"
          >
            {t("viewAccountingHub")}
          </Link>
        )}
      </div>
        }
      />

      <NextIntlClientProvider messages={mensajes}>
        <div className="space-y-6">
          <FormularioRendicionGasto
            programas={programas}
            solicitudes={solicitudes}
            becados={becados}
          />

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
