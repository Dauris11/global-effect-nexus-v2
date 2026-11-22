import { redirigir } from "@/i18n/navigation";

/**
 * Esta pantalla ya no existe: repetía el récord de notas que cada expediente muestra por
 * cuatrimestre con las reglas de su universidad. Se deja la dirección viva para que un
 * enlace guardado no dé error: lleva a la lista de expedientes, donde está el récord de
 * cada estudiante y la vista «Estudiantes en riesgo».
 */
export default async function PaginaAcademicoHistorial({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  redirigir("/expedientes", locale);
}
