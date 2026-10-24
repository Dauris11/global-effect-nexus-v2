import type { Metadata } from "next";
import { FileSpreadsheet } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ListaProveedores } from "@/components/contabilidad/proveedores/lista-proveedores";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Link } from "@/i18n/navigation";
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
        acciones={
          // El 606 se elige por mes en Impuestos: aquí solo se enlaza.
          <Button asChild size="sm" variant="outline">
            <Link href="/contabilidad/impuestos">
              <FileSpreadsheet className="size-4" />
              {t("irImpuestos")}
            </Link>
          </Button>
        }
      />


      <ListaProveedores
        proveedores={lista}
        puedeRegistrar={puedeRegistrar}
      />
    </div>
  );
}
