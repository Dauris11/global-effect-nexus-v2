import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { DialogoTercero } from "@/components/contabilidad/terceros/dialogo-tercero";
import { ListaTerceros } from "@/components/contabilidad/terceros/lista-terceros";
import { requerirPermiso } from "@/lib/auth";
import { listarTerceros } from "@/server/contabilidad/terceros/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.terceros" });
  return { title: t("titulo") };
}

export default async function PaginaTerceros({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filtro?: "todos" | "donantes" | "proveedores" | "empleados"; q?: string }>;
}) {
  const { locale } = await params;
  const { filtro, q } = await searchParams;

  await requerirPermiso("contabilidad.leer");

  const [t, terceros] = await Promise.all([
    getTranslations({ locale, namespace: "contab.terceros" }),
    listarTerceros({ filtro, busqueda: q }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-entrada">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <EncabezadoPagina
          titulo={t("titulo")}
        />
        <DialogoTercero />
      </div>

      <ListaTerceros terceros={terceros} />
    </div>
  );
}
