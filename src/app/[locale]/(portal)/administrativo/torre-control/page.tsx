import { redirigir } from "@/i18n/navigation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * La torre de control se fusionó en Pendientes. La torre propia es ahora «Mis
 * tareas»; `?usuario=<id>` (la de otra persona) pasa al detalle de «Equipo»,
 * que pide `operaciones.escribir` igual que antes.
 */
export default async function TorreControlAntigua({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ usuario?: string }>;
}) {
  const [{ locale }, { usuario }] = await Promise.all([params, searchParams]);

  redirigir(
    usuario && UUID.test(usuario)
      ? `/bandeja?tab=equipo&usuario=${usuario}`
      : "/bandeja?tab=tareas",
    locale,
  );
}
