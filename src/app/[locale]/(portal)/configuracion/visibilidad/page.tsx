import { redirigir } from "@/i18n/navigation";

/**
 * La visibilidad del menú ya no se configura aparte: se deriva de los permisos
 * que declara cada entrada de `nav.ts`. La dirección vieja se conserva solo
 * para que un enlace guardado no dé 404; el destino hace su propio control de
 * acceso.
 */
export default async function PaginaVisibilidadRetirada({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  redirigir("/configuracion/permisos", locale);
}
