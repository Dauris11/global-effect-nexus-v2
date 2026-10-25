import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { VistaRendicionCuentas } from "@/components/contabilidad/rendicion/vista-rendicion-cuentas";
import { requerirPermiso } from "@/lib/auth";
import { obtenerTrazabilidadDonante } from "@/server/contabilidad/rendicion/consultas";
import { listarTerceros } from "@/server/contabilidad/terceros/consultas";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contab.rendicion");
  return { title: `${t("titulo")} | Global Effect Nexus` };
}

export default async function PaginaRendicionCuentas({
  searchParams,
}: {
  searchParams: Promise<{ donanteId?: string }>;
}) {
  await requerirPermiso("contabilidad.leer");
  const t = await getTranslations("contab.rendicion");
  const { donanteId } = await searchParams;

  const terceros = await listarTerceros({ filtro: "donantes" });
  const donantes = terceros.map((t) => ({
    id: t.id,
    nombre: t.nombreRazonSocial,
    identificacion: t.identificacion,
  }));

  const seleccionadoId = donanteId || donantes[0]?.id;
  const rendicion = seleccionadoId ? await obtenerTrazabilidadDonante(seleccionadoId) : null;

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        antetitulo={t("antetitulo")}
        titulo={t("titulo")}
        subtitulo={t("subtitulo")}
      />

      <VistaRendicionCuentas
        donantes={donantes}
        rendicionInicial={rendicion}
      />
    </div>
  );
}
