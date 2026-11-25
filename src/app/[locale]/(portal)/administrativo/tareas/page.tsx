import { redirigir } from "@/i18n/navigation";

/**
 * El tablero de tareas pasó a «Mis tareas» de Pendientes. La ruta se queda como
 * redirección para no romper marcadores ni enlaces guardados; el permiso
 * (`operaciones.leer`) lo aplica la pestaña al pintar el tablero.
 */
export default async function TareasAntigua({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  redirigir("/bandeja?tab=tareas&vista=tablero", locale);
}
