import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { BandejaEntregas, type EntregaBandeja } from "@/components/profesor/bandeja-entregas";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirDocencia } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { enlaceDeDocumento } from "@/lib/supabase/almacen";
import { entregasPorRevisar } from "@/server/profesor/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "teacherPortal.submissions" });

  return { title: t("title") };
}

/**
 * Todo lo que espera nota, de todas las clases del docente, en una sola cola.
 * Antes había que entrar clase por clase y abrir cada tarea para saber si había
 * algo pendiente.
 */
export default async function PaginaEntregasDocente({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const usuario = await requerirDocencia();
  // Coordinación ve las de todos; el docente, solo las de sus clases.
  const docenteId = usuarioTienePermiso(usuario, "academico.escribir") ? null : usuario.id;

  const [t, mensajes, filas] = await Promise.all([
    getTranslations({ locale, namespace: "teacherPortal.submissions" }),
    mensajesCliente(["teacherPortal"]),
    entregasPorRevisar(docenteId, 200),
  ]);

  const entregas: EntregaBandeja[] = await Promise.all(
    filas.map(async (fila) => ({
      id: fila.id,
      asignacion: fila.asignacion,
      unidad: fila.unidad,
      estudiante: fila.estudiante,
      tarde: fila.estado === "tarde",
      fechaEntrega: fila.fecha_entrega ? fila.fecha_entrega.toISOString() : null,
      textoRespuesta: fila.texto_respuesta,
      enlace: await enlaceDeDocumento(fila.archivo_url),
      puntajeMaximo: fila.puntaje_maximo,
    })),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-entrada">
      <EncabezadoPagina titulo={t("title")} />
      <NextIntlClientProvider messages={mensajes}>
        <BandejaEntregas entregas={entregas} idioma={locale === "en" ? "en" : "es"} />
      </NextIntlClientProvider>
    </div>
  );
}
