import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import {
  GestionMateriasDocente,
  type EntregaConEnlace,
} from "@/components/profesor/gestion-materias-docente";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirDocencia } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { enlaceDeDocumento } from "@/lib/supabase/almacen";
import { asistenciaDeMaterias } from "@/server/profesor/asistencia";
import {
  asignacionesDeMaterias,
  entregasDeMaterias,
  inscritosDeMateria,
  materiasDelDocente,
} from "@/server/profesor/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "teacherPortal.assignedSubjects",
  });

  return { title: t("title") };
}

/**
 * Materias asignadas al profesor por administración:
 * ver alumnos inscritos, pasar lista, asignar tareas y revisar entregas.
 */
export default async function PaginaMateriasDocente({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{
    materia?: string;
    accion?: "asistencia" | "alumnos" | "tarea" | "publicaciones";
  }>;
}) {
  const { locale } = await params;
  const { materia: materiaInicialId, accion: seccionInicial } =
    (await searchParams) ?? {};

  const usuario = await requerirDocencia();
  const puedeTodo = usuarioTienePermiso(usuario, "academico.escribir");
  const docenteId = puedeTodo ? null : usuario.id;

  const [t, materias, asignaciones, entregasBrutas, asistencia, mensajes] =
    await Promise.all([
      getTranslations({ locale, namespace: "teacherPortal.assignedSubjects" }),
      materiasDelDocente(docenteId),
      asignacionesDeMaterias(docenteId),
      entregasDeMaterias(docenteId),
      asistenciaDeMaterias(docenteId),
      mensajesCliente(["academic", "teacherPortal"]),
    ]);

  const porMateria = await Promise.all(
    materias.map(async (m) => [m.id, await inscritosDeMateria(m.id)] as const),
  );
  const inscritosPorMateria = Object.fromEntries(porMateria);

  const entregas: EntregaConEnlace[] = await Promise.all(
    entregasBrutas.map(async (entrega) => ({
      ...entrega,
      enlace: await enlaceDeDocumento(entrega.archivo_url),
    })),
  );

  return (
    <div className="animate-entrada space-y-6">
      <EncabezadoPagina titulo={t("title")} subtitulo={t("subtitle")} />

      <NextIntlClientProvider messages={mensajes}>
        <GestionMateriasDocente
          materias={materias}
          inscritosPorMateria={inscritosPorMateria}
          asignacionesPorMateria={asignaciones}
          entregas={entregas}
          asistencia={asistencia}
          materiaInicialId={materiaInicialId}
          seccionInicial={seccionInicial}
        />
      </NextIntlClientProvider>
    </div>
  );
}

