import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { GestionClases360 } from "@/components/academico/gestion-clases-360";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirUsuario } from "@/lib/auth";
import {
  usuarioTienePermiso,
} from "@/lib/rbac";
import { enlaceDeDocumento } from "@/lib/supabase/almacen";
import { iniciarInscripcionesVigentes } from "@/server/global360/consultas";
import { asistenciaDeClases360 } from "@/server/profesor/asistencia";
import {
  cifrasDocente,
  clases360,
  entregasPorRevisar,
  inscritosDeClase360,
  periodosParaTareas360,
} from "@/server/profesor/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "academic.classes360" });

  return { title: t("title") };
}

/**
 * Las clases de Global Effect 360: tareas, entregas y nota final.
 *
 * Ocupa el sitio de la antigua pantalla de cursos técnicos (migración 0047). Entran
 * tres roles y ven cosas distintas, y la diferencia es UN parámetro:
 *
 *   · `docente` → `docenteId = usuario.id`: solo sus clases.
 *   · `admin` y `super_admin` → `docenteId = null`: el programa completo.
 *
 * No es una comodidad, es la frontera: las acciones aplican la misma condición
 * dentro de sus WHERE, así que un docente con el id de una clase ajena tampoco
 * puede tocarla.
 *
 * Los enlaces de las entregas se FIRMAN en el servidor y caducan a los diez
 * minutos: el bucket `documentos` es privado porque ahí está el trabajo de
 * menores de edad, y no hay URL pública que valga.
 */
export default async function PaginaClases360({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const usuario = await requerirUsuario();

  const puedeTodo = usuarioTienePermiso(usuario, "academico.escribir");
  const esDocente = usuarioTienePermiso(usuario, "docencia.impartir");

  const t = await getTranslations({ locale, namespace: "academic.classes360" });

  // Quien no gestiona nada no entra: el menú ya no le ofrece la entrada, así que
  // llegar aquí es haber escrito la URL.
  if (!puedeTodo && !esDocente) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <p className="text-sm font-semibold">{t("forbidden")}</p>
        <p className="text-tinta-3 mt-1 text-xs">{t("forbiddenHint")}</p>
      </div>
    );
  }

  const docenteId = puedeTodo ? null : usuario.id;

  // Antes de leer: así el estado que se pinta ya es el de hoy.
  await iniciarInscripcionesVigentes();

  const [cifras, clases, entregasBrutas, asistencia, periodosDeTarea, mensajes] = await Promise.all([
    cifrasDocente(docenteId),
    clases360(docenteId),
    entregasPorRevisar(docenteId, 20),
    asistenciaDeClases360(docenteId),
    periodosParaTareas360(docenteId),
    mensajesCliente(["academic"]),
  ]);

  const porClase = await Promise.all(
    clases.map(async (clase) => [clase.id, await inscritosDeClase360(clase.id)] as const),
  );

  // Un enlace firmado por entrega. Se piden en paralelo: son llamadas HTTP a
  // Storage y encadenarlas sumaría una ida y vuelta por cada una.
  const entregas = await Promise.all(
    entregasBrutas.map(async (entrega) => ({
      ...entrega,
      enlace: await enlaceDeDocumento(entrega.archivo_url),
    })),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <EncabezadoPagina
        antetitulo={t("eyebrow")}
        titulo={t("title")}
        subtitulo={
          <span className="flex flex-wrap gap-x-4">
            <span>
              {t("classes")}: <b>{cifras.clases_360}</b>
            </span>
            <span>
              {t("students")}: <b>{cifras.estudiantes}</b>
            </span>
            <span>
              {t("toReview")}: <b>{cifras.por_revisar}</b>
            </span>
          </span>
        }
      />

      <NextIntlClientProvider messages={mensajes}>
        <GestionClases360
          clases={clases}
          inscritosPorClase={Object.fromEntries(porClase)}
          entregas={entregas}
          asistencia={asistencia}
          periodosDeTarea={periodosDeTarea}
          puedeProgramar={puedeTodo}
          puedeCalificar={usuarioTienePermiso(usuario, "calificaciones.registrar")}
        />
      </NextIntlClientProvider>
    </div>
  );
}
