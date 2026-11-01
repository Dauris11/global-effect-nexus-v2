import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ContadorArqueo } from "@/components/contabilidad/cajas/contador-arqueo";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { esUuid } from "@/lib/contabilidad/formato";
import { claveDia } from "@/lib/fechas";
import { obtenerCaja } from "@/server/contabilidad/cajas/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.cajas" });
  return { title: t("nuevoArqueo") };
}

export default async function PaginaRealizarArqueo({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id, locale } = await params;
  const usuario = await requerirPermiso("contabilidad.registrar");
  if (!esUuid(id)) notFound();

  const [t, caja] = await Promise.all([
    getTranslations({ locale, namespace: "contab.cajas" }),
    obtenerCaja(id),
  ]);
  if (!caja) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-entrada">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2 text-tinta-2">
          <Link href={`/contabilidad/cajas/${caja.id}`}>
            <ArrowLeft className="size-4" />
            {caja.nombre}
          </Link>
        </Button>
        <EncabezadoPagina
          antetitulo={`${t("cuadreArqueo")} · ${caja.codigo}`}
          titulo={t("nuevoArqueo")}
          subtitulo={caja.arqueosPorAprobar > 0 ? t("errores.arqueo_pendiente") : t("ecuacion")}
        />
      </div>
      <ContadorArqueo caja={caja} hoy={claveDia()} contador={usuario.nombre} />
    </div>
  );
}
