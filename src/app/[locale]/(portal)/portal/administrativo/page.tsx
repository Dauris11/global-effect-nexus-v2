import { redirigir } from "@/i18n/navigation";

/**
 * `/portal/administrativo` ya no es una pantalla: `/inicio` la sustituyó. La ruta se queda
 * como redirección para no romper marcadores ni enlaces guardados.
 */
export default async function PortalAdministrativoAntiguo({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  redirigir("/inicio", locale);
}
