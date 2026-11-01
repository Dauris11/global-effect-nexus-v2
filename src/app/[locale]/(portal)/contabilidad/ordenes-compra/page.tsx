import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { DialogoOrdenCompra } from "@/components/contabilidad/compras/dialogo-orden-compra";
import { ListaOrdenesCompra } from "@/components/contabilidad/compras/lista-ordenes-compra";
import { requerirPermiso } from "@/lib/auth";
import { consultar } from "@/lib/db";
import { usuarioTienePermiso } from "@/lib/rbac";
import { listarOrdenesCompra } from "@/server/contabilidad/compras/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.compras" });
  return { title: t("titulo") };
}

export default async function PaginaOrdenesCompra({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const usuario = await requerirPermiso("contabilidad.leer");
  const puedeAprobar = usuarioTienePermiso(usuario, "contabilidad.aprobar");

  const [t, ordenes, proveedores, fondos, categorias] = await Promise.all([
    getTranslations({ locale, namespace: "contab.compras" }),
    listarOrdenesCompra(),
    consultar<{ id: string; nombre: string; identificacion: string }>(
      `SELECT id, nombre, identificacion FROM contabilidad.proveedor WHERE estado = 'activo' ORDER BY nombre`
    ),
    consultar<{ id: string; nombre: string }>(`SELECT id, nombre FROM contabilidad.fondo ORDER BY nombre`),
    consultar<{ id: string; nombre: string }>(`SELECT id, nombre FROM contabilidad.categoria ORDER BY nombre`),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-entrada">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <EncabezadoPagina
          titulo={t("titulo")}
        />
        <DialogoOrdenCompra
          proveedores={proveedores}
          fondos={fondos}
          categorias={categorias}
        />
      </div>

      <ListaOrdenesCompra ordenes={ordenes} puedeAprobar={puedeAprobar} />
    </div>
  );
}
