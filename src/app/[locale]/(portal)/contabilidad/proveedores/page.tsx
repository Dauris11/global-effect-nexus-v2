import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ListaProveedores } from "@/components/contabilidad/proveedores/lista-proveedores";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { proveedores } from "@/server/contabilidad/proveedores/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.proveedores" });
  return { title: t("titulo") };
}

export default async function PaginaProveedores({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;
  const usuario = await requerirPermiso("contabilidad.leer");

  const [t, lista] = await Promise.all([
    getTranslations({ locale, namespace: "contab.proveedores" }),
    proveedores(q || null),
  ]);

  const puedeRegistrar = usuarioTienePermiso(usuario, "contabilidad.registrar");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <EncabezadoPagina
        antetitulo={t("titulo")}
        titulo={t("titulo")}
        subtitulo={t("subtitulo")}
      />

      <ListaProveedores
        proveedores={lista}
        puedeRegistrar={puedeRegistrar}
      />
    </div>
  );
}
