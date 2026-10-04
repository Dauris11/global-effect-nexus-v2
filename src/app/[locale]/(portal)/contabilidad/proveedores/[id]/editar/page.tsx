import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { FormularioProveedor } from "@/components/contabilidad/proveedores/formularios";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { requerirPermiso } from "@/lib/auth";
import { proveedorPorId } from "@/server/contabilidad/proveedores/consultas";
import { opcionesRecibo } from "@/server/contabilidad/recibos/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const p = await proveedorPorId(id);
  return { title: p ? `Editar ${p.nombre}` : "Editar proveedor" };
}

export default async function PaginaEditarProveedor({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requerirPermiso("contabilidad.registrar");

  const [t, tp, proveedor, opciones] = await Promise.all([
    getTranslations({ locale, namespace: "contab.proveedorForm" }),
    getTranslations({ locale, namespace: "contab.proveedores" }),
    proveedorPorId(id),
    opcionesRecibo(),
  ]);

  if (!proveedor) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <EncabezadoPagina
        antetitulo={tp("titulo")}
        titulo={t("tituloEditar", { nombre: proveedor.nombre })}
      />

      <div className="rounded-tarjeta border border-linea bg-background p-6">
        <FormularioProveedor
          proveedor={proveedor}
          categorias={opciones.categorias}
        />
      </div>
    </div>
  );
}
