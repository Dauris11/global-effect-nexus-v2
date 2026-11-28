import type { Metadata } from "next";
import Image from "next/image";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import {
  FormularioParametros,
  type CampoParametro,
} from "@/components/parametros/formulario-parametros";
import { Card, CardContent } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirRol } from "@/lib/auth";
import { fechaConHora, diaEnRD } from "@/lib/fechas";
import { TARJETA } from "@/lib/paleta";
import { parametrosParaEditar } from "@/server/parametros/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "modules" });

  return { title: t("settings.title") };
}

/**
 * Datos de la institución. Antes esta pantalla era un tablero de cifras y una
 * lista de cuentas; las cuentas ya viven en «Personal» y las cifras no se
 * podían editar. Aquí solo hay datos que alguien cambia o consulta: el nombre y
 * el logo (fijos, vienen de la marca), el correo de contacto (parámetro
 * `contacto.correo`, editable) y el año fiscal.
 *
 * El año fiscal no tiene tabla propia: la Fundación cierra en diciembre, así que
 * es el año calendario en hora de RD. Si algún día se desfasa, ahí sí haría
 * falta un parámetro (y migración).
 */
export default async function PaginaConfiguracion({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const usuario = await requerirRol(["admin", "owner"]);

  const [t, tParametros, tComun, filas, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "settings" }),
    getTranslations({ locale, namespace: "parametros" }),
    getTranslations({ locale, namespace: "common" }),
    parametrosParaEditar(),
    mensajesCliente(["parametros"]),
  ]);

  const campos = filas
    .filter((f) => f.def.grupo === "contacto")
    .map<CampoParametro>((f) => ({
      clave: f.def.clave,
      grupo: "contacto",
      tipo: f.def.tipo,
      valor: f.valor,
      porDefecto: f.porDefecto,
      minimo: f.def.tipo === "numero" ? f.def.minimo : undefined,
      maximo: f.def.tipo === "numero" ? f.def.maximo : undefined,
      decimales: f.def.tipo === "numero" ? f.def.decimales : undefined,
      ultimoCambio: f.ultimoCambio
        ? tParametros("lastChange", {
            quien: f.ultimoCambio.quien ?? tParametros("unknownPerson"),
            cuando: fechaConHora(f.ultimoCambio.cuando, null, usuario.idioma),
          })
        : null,
    }));

  const anioFiscal = diaEnRD().slice(0, 4);

  return (
    <div className="animate-entrada space-y-6 pb-10">
      <EncabezadoPagina titulo={t("institutionPage.title")} />

      <Card className={TARJETA.contenido}>
        <CardContent className="space-y-5 pt-5">
          <div className="flex flex-wrap items-center gap-4">
            <Image src="/logo.webp" alt={tComun("foundation")} width={720} height={157} className="logo-claro h-10 w-auto" />
            <Image src="/logo-dark.webp" alt={tComun("foundation")} width={720} height={157} className="logo-oscuro h-10 w-auto" />
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="texto-meta">{t("institutionPage.name")}</dt>
              <dd className="text-sm font-semibold text-tinta">{tComun("foundation")}</dd>
            </div>
            <div>
              <dt className="texto-meta">{t("institutionPage.fiscalYear")}</dt>
              <dd className="text-sm font-semibold text-tinta">{anioFiscal}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <NextIntlClientProvider messages={mensajes}>
        <FormularioParametros grupos={[{ clave: "contacto", campos }]} />
      </NextIntlClientProvider>
    </div>
  );
}
