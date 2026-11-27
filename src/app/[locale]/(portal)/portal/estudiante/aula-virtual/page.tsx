import { redirect } from "@/i18n/navigation";

/**
 * El aula virtual se fundió en «Tareas» y «Mis clases». La ruta se queda como
 * redirección porque hay avisos ya guardados en la base (campana, correos) que
 * enlazan aquí. Con `?materia=` el estudiante pedía una clase concreta: sin su
 * id, lo más cercano es la lista de clases.
 */
export default async function AulaVirtualRedirigida({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ materia?: string }>;
}) {
  const [{ locale }, { materia }] = await Promise.all([params, searchParams]);

  redirect({ href: materia ? "/portal/estudiante/clases" : "/portal/estudiante/tareas", locale });
}
