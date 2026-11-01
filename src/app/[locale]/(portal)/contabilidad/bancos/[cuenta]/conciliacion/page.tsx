import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Scale } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { ImportarEstado } from "@/components/contabilidad/bancos/formularios-banco";
import { Monto } from "@/components/contabilidad/comun";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { claveDia, fechaCorta } from "@/lib/fechas";
import { TARJETA } from "@/lib/paleta";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  conciliacionesDeCuenta,
  configuracionEstado,
  cuentaPorId,
} from "@/server/contabilidad/bancos/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.conciliacion" });
  return { title: t("titulo") };
}

/**
 * Conciliaciones de una cuenta y la importación del estado de cuenta.
 *
 * El rango propuesto empieza el día después de la última conciliación
 * cerrada: así el contable no deja huecos ni repite días sin darse cuenta.
 */
export default async function PaginaConciliaciones({
  params,
}: {
  params: Promise<{ locale: string; cuenta: string }>;
}) {
  const { locale, cuenta: cuentaId } = await params;
  const idioma = locale === "en" ? "en" : "es";
  const usuario = await requerirPermiso("contabilidad.leer");

  const cuenta = await cuentaPorId(cuentaId);
  if (!cuenta) notFound();

  const [t, conciliaciones, config, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "contab.conciliacion" }),
    conciliacionesDeCuenta(cuenta.id),
    configuracionEstado(cuenta.id),
    mensajesCliente(["contab"]),
  ]);

  const hoy = claveDia();
  const ultima = conciliaciones.find((c) => c.estado === "cerrada")?.hasta;
  const desde = ultima
    ? new Date(new Date(`${ultima}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10)
    : `${hoy.slice(0, 7)}-01`;

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-entrada">
      <Link href={`/contabilidad/bancos/${cuenta.id}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-marca-600 hover:underline">
        <ArrowLeft className="size-4" />
        {cuenta.nombre}
      </Link>

      <EncabezadoPagina antetitulo={cuenta.nombre} titulo={t("titulo")} />

      {conciliaciones.length === 0 ? (
        <EstadoVacio icono={Scale} titulo={t("vacio")} />
      ) : (
        <ul className="space-y-3">
          {conciliaciones.map((c) => (
            <li key={c.id}>
              <Link href={`/contabilidad/bancos/${cuenta.id}/conciliacion/${c.id}`} className={`${TARJETA.interactiva} flex items-center gap-4 p-4`}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-tinta">
                    {t("rango", { desde: fechaCorta(c.desde, idioma), hasta: fechaCorta(c.hasta, idioma) })}
                  </p>
                  <p className="texto-meta">
                    {t("lineas", { confirmadas: c.confirmadas, lineas: c.lineas })} · {c.creado_por}
                  </p>
                </div>
                <Monto valor={c.saldo_banco} moneda={cuenta.moneda} className="hidden font-medium sm:inline" />
                <Badge variant={c.estado === "cerrada" ? "neutra" : "marca"}>{t(c.estado)}</Badge>
                <ChevronRight className="size-4 shrink-0 text-tinta-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {usuarioTienePermiso(usuario, "contabilidad.conciliar") && cuenta.estado === "activa" && (
        <Card className="space-y-4 p-5 md:p-6">
          <div>
            <h2 className="texto-titulo-seccion">{t("importar.titulo")}</h2>
            <p className="mt-1 text-sm text-tinta-2">{t("importar.descripcion")}</p>
          </div>
          <NextIntlClientProvider messages={mensajes}>
            <ImportarEstado cuentaId={cuenta.id} config={config?.config ?? {}} desde={desde} hasta={hoy} />
          </NextIntlClientProvider>
        </Card>
      )}
    </div>
  );
}
