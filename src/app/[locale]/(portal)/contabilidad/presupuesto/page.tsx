import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { DialogoPresupuesto } from "@/components/contabilidad/presupuesto/dialogo-presupuesto";
import { VistaPresupuesto } from "@/components/contabilidad/presupuesto/vista-presupuesto";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  calcularEjecucionPresupuestaria,
  listarPresupuestos,
} from "@/server/contabilidad/presupuesto/consultas";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contab.presupuesto");
  return { title: `${t("titulo")} | Global Effect Nexus` };
}

export default async function PaginaPresupuesto() {
  const usuario = await requerirPermiso("contabilidad.leer");
  const t = await getTranslations("contab.presupuesto");

  const presupuestos = await listarPresupuestos();
  const primerId = presupuestos[0]?.id;
  const ejecucion = primerId ? await calcularEjecucionPresupuestaria(primerId) : [];
  const puedeAprobar = usuarioTienePermiso(usuario, "contabilidad.aprobar");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <EncabezadoPagina
          antetitulo={t("antetitulo")}
          titulo={t("titulo")}
          subtitulo={t("subtitulo")}
        />
        <DialogoPresupuesto />
      </div>

      <VistaPresupuesto
        presupuestos={presupuestos}
        ejecucionInicial={ejecucion}
        puedeAprobar={puedeAprobar}
      />
    </div>
  );
}
