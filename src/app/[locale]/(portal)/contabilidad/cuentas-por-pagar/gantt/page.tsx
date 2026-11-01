import type { Metadata } from "next";
import { GanttChartSquare } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { LineaTiempo } from "@/components/linea-tiempo/linea-tiempo";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { claveDia } from "@/lib/fechas";
import {
  esIncoherente,
  tramoDe,
  type SeccionTiempo,
} from "@/lib/linea-tiempo";
import { cuentasPorPagar } from "@/server/contabilidad/cxp/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.gantt" });
  return { title: t("titulo") };
}

/**
 * Vencimientos: cada barra va de la emisión al vencimiento y el rombo marca el
 * pago programado. Es de lectura: las fechas de una factura son del documento,
 * no se arrastran. Lo vencido lleva el icono de aviso y va en tinta, no en rojo.
 */
export default async function PaginaGanttCxp({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ agrupar?: string }>;
}) {
  const { locale } = await params;
  const { agrupar = "proveedor" } = await searchParams;
  await requerirPermiso("contabilidad.leer");

  const [t, cuentas] = await Promise.all([
    getTranslations({ locale, namespace: "contab.gantt" }),
    cuentasPorPagar("abiertas"),
  ]);

  const hoy = claveDia();

  const grupos = new Map<string, SeccionTiempo>();
  for (const c of cuentas) {
    if (esIncoherente({ inicio: c.fecha_emision, fin: c.fecha_vencimiento })) continue;

    const titulo =
      agrupar === "proyecto" ? (c.proyecto ?? t("sinProyecto")) : c.tercero;
    const grupo = grupos.get(titulo) ?? { clave: titulo, titulo, barras: [] };
    const vencida = c.dias_vencida > 0;

    grupo.barras.push({
      id: c.id,
      clase: "cuenta",
      claseEtiqueta: vencida ? t("vencida") : t("aTiempo"),
      titulo: c.concepto,
      grupo: null,
      inicio: c.fecha_emision,
      fin: c.fecha_vencimiento,
      detalle: formatearMonto(c.saldo, c.moneda),
      editable: false,
      tono: vencida ? "tinta" : "marca",
      aviso: vencida,
      marcas: c.fecha_programada
        ? [{ fecha: c.fecha_programada, etiqueta: t("programada") }]
        : undefined,
      enlace: `/contabilidad/cuentas-por-pagar/${c.id}`,
    });
    grupos.set(titulo, grupo);
  }

  const secciones = [...grupos.values()];
  const rango = tramoDe(secciones.flatMap((s) => s.barras), hoy);

  return (
    <div className="animate-entrada mx-auto max-w-7xl space-y-6">
      <EncabezadoPagina
        titulo={t("titulo")}
        acciones={
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant={agrupar === "proveedor" ? "default" : "outline"}>
              <Link href="/contabilidad/cuentas-por-pagar/gantt?agrupar=proveedor">
                {t("porProveedor")}
              </Link>
            </Button>
            <Button asChild size="sm" variant={agrupar === "proyecto" ? "default" : "outline"}>
              <Link href="/contabilidad/cuentas-por-pagar/gantt?agrupar=proyecto">
                {t("porProyecto")}
              </Link>
            </Button>
          </div>
        }
      />

      {rango ? (
        <LineaTiempo secciones={secciones} inicio={rango.inicio} fin={rango.fin} hoy={hoy} />
      ) : (
        <EstadoVacio icono={GanttChartSquare} titulo={t("vacio")} />
      )}
    </div>
  );
}
