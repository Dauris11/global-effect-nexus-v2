import type { Metadata } from "next";
import { BookOpen, CheckCheck, EyeOff, Eye, Trash2, TriangleAlert } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { FormularioDocumento } from "@/components/ia-admin/formulario-documento";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirUsuario } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { AGENTES_CLAVES } from "@/lib/ia-conocimiento";
import { TARJETA } from "@/lib/paleta";
import { PORTAL_POR_ROL, usuarioTienePermiso } from "@/lib/rbac";
import {
  alternarDocumento,
  eliminarDocumento,
  marcarVerificado,
} from "@/server/ia/acciones-conocimiento";
import { documentosDeConocimiento } from "@/server/ia/consultas-admin";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "iaAdmin" });

  return { title: t("knowledge.title") };
}

/**
 * Base de conocimiento de los agentes. `ia.administrar` ve y carga para todos;
 * Contabilidad (`contabilidad.configurar`) solo para `agente_contabilidad`, que
 * es su normativa y la que ella sabe cuándo cambia.
 */
export default async function PaginaConocimiento({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const usuario = await requerirUsuario();

  const todos = usuarioTienePermiso(usuario, "ia.administrar");
  const soloContabilidad = !todos && usuarioTienePermiso(usuario, "contabilidad.configurar");

  if (!todos && !soloContabilidad) {
    redirect({ href: PORTAL_POR_ROL[usuario.rol], locale });
  }

  const visibles = todos ? null : ["agente_contabilidad"];

  const [t, documentos, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "iaAdmin" }),
    documentosDeConocimiento(visibles),
    mensajesCliente(["iaAdmin"]),
  ]);

  const nombreAgente = (clave: string) => t(`agentNames.${clave}`);
  const agentesDisponibles = (visibles ?? AGENTES_CLAVES).map((clave) => ({
    clave,
    nombre: nombreAgente(clave),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <EncabezadoPagina
        antetitulo={t("eyebrow")}
        titulo={t("knowledge.title")}
        subtitulo={t("knowledge.subtitle")}
      />

      <Card className={TARJETA.contenido}>
        <CardContent className="space-y-4 pt-5">
          <p className="texto-titulo-tarjeta">{t("knowledge.newDoc")}</p>
          <NextIntlClientProvider messages={mensajes}>
            <FormularioDocumento agentes={agentesDisponibles} />
          </NextIntlClientProvider>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <p className="texto-titulo-seccion">{t("knowledge.docs")}</p>

        {documentos.length === 0 ? (
          <EstadoVacio
            icono={BookOpen}
            titulo={t("knowledge.emptyTitle")}
            texto={t("knowledge.emptyText")}
          />
        ) : (
          documentos.map((doc) => (
            <Card key={doc.documentoId} className={TARJETA.contenido}>
              <CardContent className="space-y-3 pt-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">{doc.titulo}</p>
                    <p className="texto-meta">
                      {doc.fuente}
                      {doc.version ? ` · ${t("knowledge.versionShort", { v: doc.version })}` : ""}
                      {" · "}
                      {t("knowledge.fragments", { n: doc.fragmentos })}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!doc.activo && <Badge variant="neutra">{t("knowledge.disabled")}</Badge>}
                    {doc.sinVerificar ? (
                      <Badge variant="solida" className="gap-1">
                        <TriangleAlert className="size-3" />
                        {t("knowledge.stale")}
                      </Badge>
                    ) : (
                      <Badge variant="marca">
                        {t("knowledge.verifiedShort", { fecha: doc.verificadoEl ?? "" })}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {doc.agentes.map((a) => (
                    <Badge key={a} variant="outline">{nombreAgente(a)}</Badge>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <AccionDocumento accion={marcarVerificado} id={doc.documentoId} icono={<CheckCheck className="size-4" />} texto={t("knowledge.markVerified")} />
                  <AccionDocumento
                    accion={alternarDocumento}
                    id={doc.documentoId}
                    icono={doc.activo ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    texto={doc.activo ? t("knowledge.disable") : t("knowledge.enable")}
                  />
                  <AccionDocumento accion={eliminarDocumento} id={doc.documentoId} icono={<Trash2 className="size-4" />} texto={t("knowledge.delete")} />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}

function AccionDocumento({
  accion,
  id,
  icono,
  texto,
}: {
  accion: (datos: FormData) => Promise<void>;
  id: string;
  icono: React.ReactNode;
  texto: string;
}) {
  return (
    <form action={accion}>
      <input type="hidden" name="documento" value={id} />
      <Button type="submit" variant="outline" size="sm">
        {icono}
        {texto}
      </Button>
    </form>
  );
}
