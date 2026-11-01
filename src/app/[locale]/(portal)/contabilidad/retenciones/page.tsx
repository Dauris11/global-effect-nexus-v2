import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { DialogoRetencion } from "@/components/contabilidad/retenciones/dialogo-retencion";
import { ListaRetenciones } from "@/components/contabilidad/retenciones/lista-retenciones";
import { requerirPermiso } from "@/lib/auth";
import { consultar } from "@/lib/db";
import { listarComprobantesRetencion } from "@/server/contabilidad/retenciones/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.retenciones" });
  return { title: t("titulo") };
}

export default async function PaginaRetenciones({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requerirPermiso("contabilidad.leer");

  const [t, retenciones, facturasConRet] = await Promise.all([
    getTranslations({ locale, namespace: "contab.retenciones" }),
    listarComprobantesRetencion(),
    consultar<{
      id: string;
      numero: number;
      proveedorNombre: string;
      ncf: string | null;
      retencionIsr: number;
      retencionItbis: number;
    }>(`
      SELECT
        fp.id,
        fp.numero,
        pr.nombre AS "proveedorNombre",
        fp.ncf,
        fp.retencion_isr::float AS "retencionIsr",
        fp.retencion_itbis::float AS "retencionItbis"
      FROM contabilidad.factura_proveedor fp
      JOIN contabilidad.proveedor pr ON pr.id = fp.proveedor_id
      WHERE fp.estado = 'aprobada' AND (fp.retencion_isr > 0 OR fp.retencion_itbis > 0)
        AND NOT EXISTS (
          SELECT 1 FROM contabilidad.comprobante_retencion cr
          WHERE cr.factura_id = fp.id AND cr.estado = 'emitido'
        )
      ORDER BY fp.fecha_emision DESC
      LIMIT 50
    `),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-entrada">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <EncabezadoPagina
          titulo={t("titulo")}
        />
        <DialogoRetencion facturasConRetencion={facturasConRet} />
      </div>

      <ListaRetenciones retenciones={retenciones} />
    </div>
  );
}
