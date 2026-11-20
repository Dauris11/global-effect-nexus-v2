import {
  BookOpen,
  CalendarCheck,
  FileUp,
  HandCoins,
  Mail,
  Pencil,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * Atajos a lo que está correlacionado con este expediente: editar, subir el
 * «gradua», ver el pénsum de su carrera, la ficha de su patrocinador, las cartas
 * y la planilla del mes. Cada botón aparece solo si hay a dónde llevar y la
 * persona puede entrar allí; el permiso real lo vuelve a exigir cada pantalla.
 * Las pestañas se abren con `?seccion=`: la página rehace las pestañas cuando
 * cambia ese parámetro.
 */
export async function AccionesRapidasExpediente({
  id,
  puedeEditar,
  carreraId,
  pensumId,
  puedeVerCatalogo,
  patrocinador,
  puedeVerPatrocinadores,
  puedeEscribirPatrocinadores,
  puedeVerPlanilla,
}: {
  id: string;
  puedeEditar: boolean;
  carreraId: string | null;
  pensumId: string | null;
  puedeVerCatalogo: boolean;
  /** Patrocinador con la beca vigente, si lo hay. */
  patrocinador: { id: string; nombre: string } | null;
  puedeVerPatrocinadores: boolean;
  puedeEscribirPatrocinadores: boolean;
  puedeVerPlanilla: boolean;
}) {
  const t = await getTranslations("records.quick");

  const acciones: { href: string; texto: string; icono: typeof Pencil }[] = [
    ...(puedeEditar
      ? [
          { href: `/expedientes/${id}?seccion=edit`, texto: t("edit"), icono: Pencil },
          { href: `/expedientes/${id}?seccion=curriculum`, texto: t("uploadGradua"), icono: FileUp },
        ]
      : []),
    ...(puedeVerCatalogo && carreraId
      ? [{ href: `/academico/universidades/carreras/${carreraId}${pensumId ? `?pensum=${pensumId}` : ""}`, texto: t("careerCurriculum"), icono: BookOpen }]
      : []),
    ...(puedeVerPatrocinadores && patrocinador
      ? [{ href: `/patrocinadores/${patrocinador.id}`, texto: t("sponsor", { name: patrocinador.nombre }), icono: HandCoins }]
      : []),
    ...(puedeEscribirPatrocinadores && patrocinador
      ? [{ href: "/patrocinadores/correos", texto: t("letters"), icono: Mail }]
      : []),
    ...(puedeVerPlanilla ? [{ href: "/servicios-mensuales", texto: t("monthly"), icono: CalendarCheck }] : []),
  ];

  if (acciones.length === 0) return null;

  return (
    <nav aria-label={t("label")} className="flex flex-wrap gap-2">
      {acciones.map((a) => (
        <Button key={a.href} asChild variant="outline" size="sm">
          <Link href={a.href}>
            <a.icono className="size-4" />
            {a.texto}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
