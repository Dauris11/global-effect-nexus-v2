import { redirigir } from "@/i18n/navigation";

/** «Mi día» pasó a «Mis tareas» de Pendientes; la ruta queda como redirección. */
export default async function HoyAntigua({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  redirigir("/bandeja?tab=tareas", locale);
}
