import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { FormularioProveedor } from "@/components/contabilidad/proveedores/formularios";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { requerirPermiso } from "@/lib/auth";
import { opcionesRecibo } from "@/server/contabilidad/recibos/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.proveedores" });
  return { title: t("nuevo") };
}

export default async function PaginaNuevoProveedor({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requerirPermiso("contabilidad.registrar");

  const [t, tp, opciones] = await Promise.all([
    getTranslations({ locale, namespace: "contab.proveedorForm" }),
    getTranslations({ locale, namespace: "contab.proveedores" }),
    opcionesRecibo(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-entrada">
      <EncabezadoPagina
        titulo={t("tituloNuevo")}
      />

      <div className="rounded-tarjeta border border-linea bg-background p-6">
        <FormularioProveedor categorias={opciones.categorias} />
      </div>
    </div>
  );
}
