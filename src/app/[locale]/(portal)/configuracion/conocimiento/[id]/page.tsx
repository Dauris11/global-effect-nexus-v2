import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { FormularioDocumento } from "@/components/ia-admin/formulario-documento";
import { Card, CardContent } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { redirect } from "@/i18n/navigation";
import { requerirUsuario } from "@/lib/auth";
import { AGENTES_CLAVES } from "@/lib/ia-conocimiento";
import { TARJETA } from "@/lib/paleta";
import { documentoParaEditar } from "@/server/ia/consultas-admin";
import {
  agentesGestionables,
  puedeGestionarAgentes,
} from "@/server/ia/permisos-conocimiento";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "iaAdmin" });

  return { title: t("knowledge.editTitle") };
}

/**
 * Edición de un documento de la base de conocimiento. El permiso se comprueba
 * sobre los agentes del documento, no solo sobre la pantalla: quien gestiona
 * un agente no puede abrir el documento de otro escribiendo su id.
 */
export default async function PaginaEditarDocumento({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const usuario = await requerirUsuario();

  // A la lista, no al inicio: quien llega aquí ya tiene acceso a la base.
  const volver = () => redirect({ href: "/configuracion/conocimiento", locale });

  if (!UUID.test(id)) return volver();

  const documento = await documentoParaEditar(id);

  if (!documento || !puedeGestionarAgentes(usuario, documento.agentes)) return volver();

  const [t, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "iaAdmin" }),
    mensajesCliente(["iaAdmin"]),
  ]);

  const visibles = agentesGestionables(usuario) ?? AGENTES_CLAVES;
  const agentes = visibles.map((clave) => ({ clave, nombre: t(`agentNames.${clave}`) }));

  return (
    <div className="animate-entrada space-y-6 pb-10">
      <EncabezadoPagina titulo={t("knowledge.editTitle")} />


      <Card className={TARJETA.contenido}>
        <CardContent className="pt-5">
          <NextIntlClientProvider messages={mensajes}>
            <FormularioDocumento agentes={agentes} documento={documento} />
          </NextIntlClientProvider>
        </CardContent>
      </Card>
    </div>
  );
}
