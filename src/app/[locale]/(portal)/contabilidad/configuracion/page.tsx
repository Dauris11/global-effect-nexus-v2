import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PestanasConfig } from "@/components/contabilidad/configuracion/pestanas";
import { SeccionCatalogo } from "@/components/contabilidad/configuracion/seccion-catalogo";
import { SeccionEntidad } from "@/components/contabilidad/configuracion/seccion-entidad";
import { SeccionParametros } from "@/components/contabilidad/configuracion/seccion-parametros";
import { SeccionPeriodos } from "@/components/contabilidad/configuracion/seccion-periodos";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  catalogo,
  entidad,
  esPestanaConfig,
  parametros,
  periodos,
  type PestanaConfig,
} from "@/server/contabilidad/configuracion/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.config" });
  return { title: t("titulo") };
}

/**
 * Configuración contable (§4.13). Entra quien tiene `contabilidad.leer`
 * —también `super_admin`, que audita—, pero los botones solo aparecen con
 * el permiso de escribir. Esconderlos no protege nada: cada server action
 * vuelve a comprobar el permiso.
 */
export default async function PaginaConfiguracionContable({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  const { tab } = await searchParams;
  const usuario = await requerirPermiso("contabilidad.leer");
  const pestana: PestanaConfig = esPestanaConfig(tab) ? tab : "entidad";

  const t = await getTranslations({ locale, namespace: "contab.config" });
  const puedeConfigurar = usuarioTienePermiso(usuario, "contabilidad.configurar");
  const puedeCerrar = usuarioTienePermiso(usuario, "contabilidad.cerrar_periodo");

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-entrada">
      <EncabezadoPagina
        titulo={t("titulo")}
        subtitulo={puedeConfigurar || puedeCerrar ? undefined : t("subtituloLectura")}
      />
      <PestanasConfig activa={pestana} />
      <Seccion pestana={pestana} puedeConfigurar={puedeConfigurar} puedeCerrar={puedeCerrar} />
    </div>
  );
}

/** Cada pestaña consulta solo lo suyo. */
async function Seccion({
  pestana,
  puedeConfigurar,
  puedeCerrar,
}: {
  pestana: PestanaConfig;
  puedeConfigurar: boolean;
  puedeCerrar: boolean;
}) {
  switch (pestana) {
    case "parametros":
      return <SeccionParametros parametros={await parametros()} puedeEditar={puedeConfigurar} />;
    case "periodos":
      return <SeccionPeriodos periodos={await periodos()} puedeCerrar={puedeCerrar} />;
    case "catalogo":
      return <SeccionCatalogo cuentas={await catalogo()} puedeEditar={puedeConfigurar} />;
    default: {
      const datos = await entidad();
      if (!datos) {
        // La 0048 siembra la fila; sin ella falta una migración, no un dato.
        const t = await getTranslations("contab.config.entidad");
        return <EstadoVacio icono={Building2} titulo={t("vacioTitulo")} />;
      }
      return <SeccionEntidad entidad={datos} puedeEditar={puedeConfigurar} />;
    }
  }
}
