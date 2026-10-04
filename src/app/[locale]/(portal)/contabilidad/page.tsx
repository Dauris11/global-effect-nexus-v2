import { redirigir } from "@/i18n/navigation";

/**
 * `/contabilidad` era la pantalla vieja de transacciones (0011). Sus datos
 * pasaron a recibos y libros de banco (0036); la entrada del área es el
 * portal. Se redirige en vez de devolver 404 porque hay enlaces y
 * marcadores guardados que apuntan aquí.
 */
export default async function PaginaContabilidad({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirigir("/portal/contabilidad", locale);
}
