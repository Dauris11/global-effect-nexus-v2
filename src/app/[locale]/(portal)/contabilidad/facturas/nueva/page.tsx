import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { FormularioFactura } from "@/components/contabilidad/proveedores/formularios";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { requerirPermiso } from "@/lib/auth";
import { consultar } from "@/lib/db";
import { claveDia } from "@/lib/fechas";
import { opcionesRecibo } from "@/server/contabilidad/recibos/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.facturaForm" });
  return { title: t("tituloNueva") };
}

export default async function PaginaNuevaFactura({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ proveedor?: string }>;
}) {
  const { locale } = await params;
  const { proveedor } = await searchParams;
  await requerirPermiso("contabilidad.registrar");

  const [t, tf, opciones, listaProveedores] = await Promise.all([
    getTranslations({ locale, namespace: "contab.facturaForm" }),
    getTranslations({ locale, namespace: "contab.factura" }),
    opcionesRecibo(),
    consultar<{
      id: string;
      nombre: string;
      tipo: "fisica" | "juridica";
      dias: number;
      categoria_id: string | null;
    }>(
      `SELECT id, nombre, tipo, condiciones_pago_dias AS dias, categoria_id
         FROM contabilidad.proveedor
        WHERE estado = 'activo'
        ORDER BY nombre`,
    ),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <EncabezadoPagina
        antetitulo={tf("titulo")}
        titulo={t("tituloNueva")}
      />

      <div className="rounded-tarjeta border border-linea bg-background p-6">
        <FormularioFactura
          proveedores={listaProveedores}
          proveedorId={proveedor}
          categorias={opciones.categorias}
          fondos={opciones.fondos}
          proyectos={opciones.proyectos}
          hoy={claveDia()}
        />
      </div>
    </div>
  );
}
