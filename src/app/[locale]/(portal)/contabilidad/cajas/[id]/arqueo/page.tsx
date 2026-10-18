import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { claveDia } from "@/lib/fechas";
import { obtenerCaja } from "@/server/contabilidad/cajas/consultas";
import { ContadorArqueo } from "@/components/contabilidad/cajas/contador-arqueo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const caja = await obtenerCaja(id);
  return { title: caja ? `Arqueo físico · ${caja.nombre}` : "Arqueo de caja" };
}

export default async function PaginaRealizarArqueo({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  await requerirPermiso("contabilidad.registrar");

  const caja = await obtenerCaja(id);
  if (!caja) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2 text-tinta-2">
          <Link href={`/contabilidad/cajas/${caja.id}`}>
            <ArrowLeft className="size-4" />
            <span>Volver a {caja.nombre}</span>
          </Link>
        </Button>

        <EncabezadoPagina
          antetitulo={`Cuadre Físico · ${caja.codigo}`}
          titulo={`Arqueo de ${caja.nombre}`}
          subtitulo="Cuenta física de billetes y monedas para verificar el saldo en caja frente a los registros."
        />
      </div>

      <div className="rounded-tarjeta border border-linea bg-background p-6 shadow-sm">
        <ContadorArqueo caja={caja} hoy={claveDia()} />
      </div>
    </div>
  );
}
