import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ListaCxp } from "@/components/contabilidad/cxp/lista-cxp";
import { TablaAntiguedad } from "@/components/contabilidad/cxp/tabla-antiguedad";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { requerirPermiso } from "@/lib/auth";
import type { EstadoCxp } from "@/server/contabilidad/cxp/consultas";
import {
  antiguedadDeSaldos,
  cuentasPorPagar,
  ESTADOS_CXP,
} from "@/server/contabilidad/cxp/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.cxp" });
  return { title: t("titulo") };
}

export default async function PaginaCxp({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ estado?: string }>;
}) {
  const { locale } = await params;
  const { estado: paramEstado } = await searchParams;
  await requerirPermiso("contabilidad.leer");

  const estadoValido =
    paramEstado && (ESTADOS_CXP as readonly string[]).includes(paramEstado)
      ? (paramEstado as EstadoCxp)
      : "abiertas";

  const [t, antiguedad, lista] = await Promise.all([
    getTranslations({ locale, namespace: "contab.cxp" }),
    antiguedadDeSaldos(),
    cuentasPorPagar(estadoValido),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <EncabezadoPagina
        antetitulo={t("titulo")}
        titulo={t("titulo")}
        subtitulo={t("subtitulo")}
      />

      <TablaAntiguedad datos={antiguedad} />

      <ListaCxp cuentas={lista} estadoActual={estadoValido} />
    </div>
  );
}
