import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/app/page-header";
import { PestanasClase } from "@/components/profesor/clase/pestanas-clase";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirDocencia } from "@/lib/auth";
import { leerClaveDeClase } from "@/lib/clases";
import { usuarioTienePermiso } from "@/lib/rbac";
import { iniciarInscripcionesVigentes } from "@/server/global360/consultas";
import { datosDeClase } from "@/server/profesor/detalle-clase";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "teacherClasses" });

  return { title: t("title") };
}

/**
 * Una clase: Estudiantes · Tareas · Material · Asistencia · Notas finales. La
 * puerta es `docenteId` dentro de las consultas: con el id de una clase ajena no
 * hay fila y la respuesta es el mismo 404 que el de una clase inexistente.
 */
export default async function PaginaClaseDocente({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; clave: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ locale, clave }, { tab }] = await Promise.all([params, searchParams]);
  const leida = leerClaveDeClase(clave);

  if (!leida) notFound();
  const usuario = await requerirDocencia();
  const docenteId = usuarioTienePermiso(usuario, "academico.escribir") ? null : usuario.id;

  // Antes de leer: así «prematriculada» ya pasó a «cursando» si el período empezó.
  await iniciarInscripcionesVigentes();

  const [t, mensajes, datos] = await Promise.all([
    getTranslations({ locale, namespace: "teacherClasses" }),
    mensajesCliente(["teacherClasses"]),
    datosDeClase(docenteId, leida.origen, leida.id),
  ]);

  if (!datos) notFound();

  return (
    <div className="animate-entrada space-y-6">
      <PageHeader
        breadcrumb={[{ etiqueta: t("title"), href: "/portal/profesor/clases" }, { etiqueta: datos.nombre }]}
        title={datos.nombre}
      />
      <NextIntlClientProvider messages={mensajes}>
        <PestanasClase datos={datos} inicial={tab} />
      </NextIntlClientProvider>
    </div>
  );
}
