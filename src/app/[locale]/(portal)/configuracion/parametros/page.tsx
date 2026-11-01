import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import {
  FormularioParametros,
  type CampoParametro,
} from "@/components/parametros/formulario-parametros";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import { requerirRol } from "@/lib/auth";
import { fechaConHora } from "@/lib/fechas";
import { GRUPOS } from "@/lib/parametros";
import { parametrosParaEditar } from "@/server/parametros/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "parametros" });

  return { title: t("title") };
}

/**
 * Parámetros institucionales: lo que antes estaba escrito en el código y ahora
 * cambia coordinación —el horario del comedor, los mínimos de la beca, el correo
 * de contacto—. Cada uno está conectado a algo real: la lista de
 * `src/lib/parametros.ts` es la única que existe.
 */
export default async function PaginaParametros({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const usuario = await requerirRol(["admin", "super_admin"]);

  const [t, filas, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "parametros" }),
    parametrosParaEditar(),
    mensajesCliente(["parametros"]),
  ]);

  const grupos = GRUPOS.map((grupo) => ({
    clave: grupo,
    campos: filas
      .filter((f) => f.def.grupo === grupo)
      .map<CampoParametro>((f) => ({
        clave: f.def.clave,
        grupo,
        tipo: f.def.tipo,
        valor: f.valor,
        porDefecto: f.porDefecto,
        minimo: f.def.tipo === "numero" ? f.def.minimo : undefined,
        maximo: f.def.tipo === "numero" ? f.def.maximo : undefined,
        decimales: f.def.tipo === "numero" ? f.def.decimales : undefined,
        ultimoCambio: f.ultimoCambio
          ? t("lastChange", {
              quien: f.ultimoCambio.quien ?? t("unknownPerson"),
              cuando: fechaConHora(f.ultimoCambio.cuando, null, usuario.idioma),
            })
          : null,
      })),
  })).filter((g) => g.campos.length > 0);

  return (
    <div className="animate-entrada mx-auto max-w-3xl space-y-8 pb-10">
      <Button asChild variant="outline" size="sm">
        <Link href="/configuracion">
          <ArrowLeft className="size-4" />
          {t("back")}
        </Link>
      </Button>

      <EncabezadoPagina titulo={t("title")} />

      <NextIntlClientProvider messages={mensajes}>
        <FormularioParametros grupos={grupos} />
      </NextIntlClientProvider>
    </div>
  );
}
