import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { DialogoCentroCosto } from "@/components/contabilidad/centros-costo/dialogo-centro-costo";
import { ListaCentrosCosto } from "@/components/contabilidad/centros-costo/lista-centros-costo";
import { requerirPermiso } from "@/lib/auth";
import { listarCentrosCosto } from "@/server/contabilidad/centros-costo/consultas";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contab.centrosCosto");
  return { title: `${t("titulo")} | Global Effect Nexus` };
}

export default async function PaginaCentrosCosto() {
  await requerirPermiso("contabilidad.leer");
  const t = await getTranslations("contab.centrosCosto");
  const centros = await listarCentrosCosto();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <EncabezadoPagina
          antetitulo={t("antetitulo")}
          titulo={t("titulo")}
          subtitulo={t("subtitulo")}
        />
        <DialogoCentroCosto />
      </div>

      <ListaCentrosCosto centros={centros} />
    </div>
  );
}
