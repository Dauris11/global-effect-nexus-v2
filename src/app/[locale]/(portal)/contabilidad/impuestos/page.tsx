import type { Metadata } from "next";
import { Download, FileSpreadsheet, Landmark } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { TARJETA } from "@/lib/paleta";
import { cuentasConSaldo } from "@/server/contabilidad/bancos/consultas";
import { hoyEnLaBase } from "@/server/contabilidad/cxp/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.impuestos" });
  return { title: t("titulo") };
}

const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

/**
 * Impuestos y exportaciones: los formatos de la DGII y los libros en Excel, en
 * un solo sitio.
 *
 * Antes cada archivo era un botón suelto en la pantalla de la que salía sus
 * datos (el 606 en proveedores, el 607 en recibos) y siempre del mes en curso,
 * que es justo el que todavía no se declara. Aquí se elige el mes y, por
 * omisión, se propone el ANTERIOR: el 606 y el 607 de septiembre se presentan
 * el 15 de octubre.
 *
 * El mes por omisión sale del reloj de la base y no del servidor web: es el
 * mismo que decide en qué período cae cada documento.
 */
export default async function PaginaImpuestos({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  const { locale } = await params;
  const { mes } = await searchParams;

  await requerirPermiso("contabilidad.leer");

  const [t, hoy, cuentas] = await Promise.all([
    getTranslations({ locale, namespace: "contab.impuestos" }),
    hoyEnLaBase(),
    cuentasConSaldo(),
  ]);

  const elegido = MES.test(mes ?? "") ? mes! : mesAnterior(hoy);
  const [anio, numeroMes] = elegido.split("-");
  const consulta = `anio=${anio}&mes=${Number(numeroMes)}`;

  const formatos = [
    { clave: "f606", href: `/api/contabilidad/exportar/606?${consulta}`, origen: "/contabilidad/proveedores" },
    { clave: "f607", href: `/api/contabilidad/exportar/607?${consulta}`, origen: "/contabilidad/recibos" },
  ] as const;

  return (
    <div className="mx-auto max-w-5xl space-y-8 md:space-y-10">
      <EncabezadoPagina antetitulo={t("antetitulo")} titulo={t("titulo")} subtitulo={t("subtitulo")} />

      {/* Un formulario GET: el mes queda en la URL y el enlace se comparte. */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="mes">{t("mes")}</Label>
          <Input id="mes" name="mes" type="month" defaultValue={elegido} className="w-48" />
        </div>
        <Button type="submit" variant="outline">
          {t("cambiarMes")}
        </Button>
      </form>

      <section className="space-y-4">
        <h2 className="texto-titulo-seccion">{t("formatosDgii")}</h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {formatos.map((formato) => (
            <li key={formato.clave} className={`${TARJETA.contenido} flex flex-col gap-4 p-5`}>
              <div className="flex items-start gap-3">
                <span className={TARJETA.icono}>
                  <FileSpreadsheet className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="texto-titulo-tarjeta">{t(`${formato.clave}.nombre`)}</p>
                  <p className="texto-meta">{t(`${formato.clave}.texto`)}</p>
                </div>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-3">
                <Button asChild>
                  <a href={formato.href} download>
                    <Download className="size-4" />
                    {t("descargar", { mes: elegido })}
                  </a>
                </Button>
                <Link href={formato.origen} className="inline-flex min-h-11 items-center text-sm font-medium text-marca-600 hover:underline">
                  {t(`${formato.clave}.origen`)}
                </Link>
              </div>
            </li>
          ))}
        </ul>
        <p className="texto-meta">{t("nota")}</p>
      </section>

      <section className="space-y-4 border-t border-linea pt-8">
        <h2 className="texto-titulo-seccion">{t("libros")}</h2>
        <ul className={TARJETA.contenido}>
          <li className="flex min-h-11 flex-wrap items-center gap-3 border-b border-linea px-4 py-3 last:border-b-0">
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-tinta">{t("cxp.nombre")}</span>
              <span className="texto-meta block">{t("cxp.texto")}</span>
            </span>
            <Button asChild size="sm" variant="outline">
              <a href="/api/contabilidad/exportar/cxp" download>
                <Download className="size-4" />
                {t("excel")}
              </a>
            </Button>
          </li>
          {cuentas.map((cuenta) => (
            <li key={cuenta.id} className="flex min-h-11 flex-wrap items-center gap-3 border-b border-linea px-4 py-3 last:border-b-0">
              <Landmark className="size-4 shrink-0 text-tinta-3" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-tinta">{t("libroBanco", { cuenta: cuenta.nombre })}</span>
                <span className="texto-meta block">{cuenta.moneda}</span>
              </span>
              <Button asChild size="sm" variant="outline">
                <a href={`/api/contabilidad/exportar/bancos?cuentaId=${cuenta.id}`} download>
                  <Download className="size-4" />
                  {t("excel")}
                </a>
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** `YYYY-MM` del mes anterior a `hoy` (`YYYY-MM-DD`). */
function mesAnterior(hoy: string): string {
  const [anio, mes] = hoy.split("-").map(Number);
  return mes === 1 ? `${anio - 1}-12` : `${anio}-${String(mes - 1).padStart(2, "0")}`;
}
