import { redirect } from "@/i18n/navigation";

/**
 * «Asignación de materias» se fundió con «Clases de 360» en «Mis clases». La
 * ruta queda como redirección: la campana y los correos viejos enlazan aquí.
 */
export default async function MateriasRedirigida({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  redirect({ href: "/portal/profesor/clases", locale });
}
