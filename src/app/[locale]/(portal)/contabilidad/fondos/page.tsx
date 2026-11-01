import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { DialogoFondo } from "@/components/contabilidad/fondos/dialogo-fondo";
import { DialogoLiberarFondo } from "@/components/contabilidad/fondos/dialogo-liberar-fondo";
import { ListaFondos } from "@/components/contabilidad/fondos/lista-fondos";
import { requerirPermiso } from "@/lib/auth";
import { listarFondos, listarHistorialLiberaciones } from "@/server/contabilidad/fondos/consultas";
import { listarTerceros } from "@/server/contabilidad/terceros/consultas";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contab.fondos");
  return { title: `${t("titulo")} | Global Effect Nexus` };
}

export default async function PaginaFondos() {
  await requerirPermiso("contabilidad.leer");
  const t = await getTranslations("contab.fondos");

  const [fondos, liberaciones, terceros] = await Promise.all([
    listarFondos(),
    listarHistorialLiberaciones(),
    listarTerceros({ filtro: "donantes" }),
  ]);

  const donantes = terceros.map((t) => ({ id: t.id, nombre: t.nombreRazonSocial }));

  return (
    <div className="space-y-6 animate-entrada">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <EncabezadoPagina
          titulo={t("titulo")}
        />
        <div className="flex gap-2">
          <DialogoLiberarFondo fondos={fondos} />
          <DialogoFondo donantes={donantes} />
        </div>
      </div>

      <ListaFondos fondos={fondos} liberaciones={liberaciones} />
    </div>
  );
}
