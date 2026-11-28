import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PestanasConfig } from "@/components/contabilidad/configuracion/pestanas";
import { SeccionCodigos } from "@/components/contabilidad/configuracion/seccion-codigos";
import { SeccionCatalogo } from "@/components/contabilidad/configuracion/seccion-catalogo";
import { SeccionComprobantes } from "@/components/contabilidad/configuracion/seccion-comprobantes";
import { SeccionEntidad } from "@/components/contabilidad/configuracion/seccion-entidad";
import { SeccionFormatosBanco } from "@/components/contabilidad/configuracion/seccion-formatos-banco";
import { SeccionParametros } from "@/components/contabilidad/configuracion/seccion-parametros";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { listarCodigos } from "@/server/contabilidad/codigos-transaccion/consultas";
import {
  catalogo,
  comprobantesSecuencias,
  cuentasConMovimientoActivas,
  entidad,
  esPestanaConfig,
  formatosEstadoBanco,
  impuestosCargos,
  reglasLegales,
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
  const tabNormalizado = tab === "periodos" ? "comprobantes" : tab;
  const pestana: PestanaConfig = esPestanaConfig(tabNormalizado) ? tabNormalizado : "entidad";

  const t = await getTranslations({ locale, namespace: "contab.config" });
  const puedeConfigurar = usuarioTienePermiso(usuario, "contabilidad.configurar");

  return (
    <div className="space-y-6 animate-entrada">
      <EncabezadoPagina titulo={t("titulo")} />
      <PestanasConfig activa={pestana} />
      <Seccion pestana={pestana} locale={locale} puedeConfigurar={puedeConfigurar} />
    </div>
  );
}

/** Cada pestaña consulta solo lo suyo. */
async function Seccion({
  pestana,
  locale,
  puedeConfigurar,
}: {
  pestana: PestanaConfig;
  locale: string;
  puedeConfigurar: boolean;
}) {
  switch (pestana) {
    case "parametros": {
      const [listaCargos, listaReglas, cuentasMovimiento] = await Promise.all([
        impuestosCargos(),
        reglasLegales(),
        puedeConfigurar ? cuentasConMovimientoActivas() : Promise.resolve([]),
      ]);
      return (
        <SeccionParametros
          impuestosCargos={listaCargos}
          reglasLegales={listaReglas}
          cuentas={cuentasMovimiento}
          puedeEditar={puedeConfigurar}
        />
      );
    }
    case "comprobantes":
      return (
        <SeccionComprobantes
          comprobantes={await comprobantesSecuencias()}
          puedeEditar={puedeConfigurar}
        />
      );
    case "catalogo":
      return (
        <SeccionCatalogo
          cuentas={await catalogo()}
          codigos={await listarCodigos(locale)}
          puedeEditar={puedeConfigurar}
        />
      );
    case "codigos":
      return <SeccionCodigos codigos={await listarCodigos(locale)} puedeEditar={puedeConfigurar} />;
    case "formatos-banco":
      return <SeccionFormatosBanco formatos={await formatosEstadoBanco()} puedeEditar={puedeConfigurar} />;
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
