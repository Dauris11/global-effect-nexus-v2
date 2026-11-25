import { redirigir } from "@/i18n/navigation";

/** La torre del equipo pasó a la pestaña «Equipo» de Pendientes. */
export default async function TorreEquipoAntigua({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  redirigir("/bandeja?tab=equipo", locale);
}
