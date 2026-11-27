import { redirect } from "@/i18n/navigation";

/**
 * Global Effect 360 ya no tiene página propia: su avance es la tarjeta de arriba
 * de «Mis clases» y elegir tanda y materia es la prematrícula. La ruta queda
 * como redirección por los avisos y favoritos que aún apuntan aquí.
 */
export default async function Global360Redirigida({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  redirect({ href: "/portal/estudiante/clases", locale });
}
