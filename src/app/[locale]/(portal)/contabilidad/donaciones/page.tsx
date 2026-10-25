import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { DialogoDonacion } from "@/components/contabilidad/donaciones/dialogo-donacion";
import { DialogoPromesa } from "@/components/contabilidad/donaciones/dialogo-promesa";
import { ListaDonaciones } from "@/components/contabilidad/donaciones/lista-donaciones";
import { requerirPermiso } from "@/lib/auth";
import { consultar } from "@/lib/db";
import { cuentasConSaldo } from "@/server/contabilidad/bancos/consultas";
import { listarDonaciones, listarPromesas } from "@/server/contabilidad/donaciones/consultas";
import { listarTerceros } from "@/server/contabilidad/terceros/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.donaciones" });
  return { title: t("titulo") };
}

export default async function PaginaDonaciones({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requerirPermiso("contabilidad.leer");

  const [t, donaciones, promesas, terceros, fondos, cuentas] = await Promise.all([
    getTranslations({ locale, namespace: "contab.donaciones" }),
    listarDonaciones(),
    listarPromesas(),
    listarTerceros({ filtro: "donantes" }),
    consultar<{ id: string; nombre: string }>(`SELECT id, nombre FROM contabilidad.fondo ORDER BY nombre`),
    cuentasConSaldo(),
  ]);

  const listaDonantes = terceros.map((ter) => ({
    id: ter.id,
    nombre: ter.nombreRazonSocial,
    identificacion: ter.identificacion,
  }));

  const listaFondos = fondos.map((f) => ({
    id: f.id,
    nombre: f.nombre,
  }));

  const listaCuentas = cuentas.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    moneda: c.moneda,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <EncabezadoPagina
          antetitulo={t("antetitulo")}
          titulo={t("titulo")}
          subtitulo={t("subtitulo")}
        />
        <div className="flex flex-wrap gap-2">
          <DialogoPromesa donantes={listaDonantes} fondos={listaFondos} />
          <DialogoDonacion
            donantes={listaDonantes}
            fondos={listaFondos}
            cuentasBancarias={listaCuentas}
          />
        </div>
      </div>

      <ListaDonaciones donaciones={donaciones} promesas={promesas} />
    </div>
  );
}
