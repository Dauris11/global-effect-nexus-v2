import { redirigir } from "@/i18n/navigation";

/**
 * `/dashboard` ya no es una pantalla: la bandeja la sustituyó. La ruta se queda
 * como redirección para no romper marcadores ni enlaces guardados. El
 * `requerirRol` lo aplica la bandeja al llegar.
 */
export default async function PaginaDashboardAntigua({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  redirigir("/bandeja", locale);
}
