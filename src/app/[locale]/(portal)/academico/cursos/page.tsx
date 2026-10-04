import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { GestionCursos } from "@/components/academico/gestion-cursos";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirUsuario } from "@/lib/auth";
import { consultar } from "@/lib/db";
import { tienePermiso } from "@/lib/rbac";
import { enlaceDeDocumento } from "@/lib/supabase/almacen";
import {
  cifrasDocente,
  clases360,
  cursosGestionados,
  entregasPorRevisar,
  estudiantesDeCurso,
  inscritosDeClase360,
} from "@/server/profesor/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "academic" });

  return { title: t("courses.title") };
}

/**
 * Gestión de cursos técnicos y de las clases de Global Effect 360.
 *
 * Entran tres roles y ven cosas distintas, y la diferencia es UN parámetro:
 *
 *   · `docente` → `docenteId = usuario.id`: solo sus cursos y sus clases.
 *   · `admin` y `super_admin` → `docenteId = null`: el programa completo.
 *
 * No es una comodidad, es la frontera: las acciones aplican la misma condición
 * dentro de sus WHERE, así que un docente con el id de un curso ajeno tampoco
 * puede editarlo. Comprobado contra la base.
 *
 * Los estudiantes de cada curso se cargan aquí, no al desplegar: son listas
 * cortas —decenas, no miles— y una petición por clic para veinte filas es peor
 * experiencia y más código.
 *
 * Los enlaces de las entregas se FIRMAN en el servidor y caducan a los diez
 * minutos: el bucket `documentos` es privado porque ahí está el trabajo de
 * menores de edad, y no hay URL pública que valga.
 */
export default async function PaginaCursos({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const usuario = await requerirUsuario();

  const puedeTodo = tienePermiso(usuario.rol, "academico.escribir");
  const esDocente = usuario.rol === "docente";

  // Quien no gestiona nada no entra: el menú ya no le ofrece la entrada, así que
  // llegar aquí es haber escrito la URL.
  if (!puedeTodo && !esDocente) {
    const t = await getTranslations({ locale, namespace: "academic" });

    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <p className="text-sm font-semibold">{t("forbidden")}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {t("forbiddenHint")}
        </p>
      </div>
    );
  }

  const docenteId = puedeTodo ? null : usuario.id;

  const [t, cifras, cursos, clases, entregasBrutas, periodos, mensajes] =
    await Promise.all([
      getTranslations({ locale, namespace: "academic" }),
      cifrasDocente(docenteId),
      cursosGestionados(docenteId),
      clases360(docenteId),
      entregasPorRevisar(docenteId, 20),
      consultar<{ id: string; nombre: string; tipo: string }>(
        `SELECT id, nombre, tipo FROM periodo
          WHERE estado <> 'completado'
          ORDER BY fecha_inicio DESC`,
      ),
      mensajesCliente(["academic"]),
    ]);

  // Los estudiantes de cada curso y los inscritos de cada clase, en paralelo.
  const [porCurso, porClase] = await Promise.all([
    Promise.all(
      cursos.map(async (curso) => [curso.id, await estudiantesDeCurso(curso.id)] as const),
    ),
    Promise.all(
      clases.map(async (clase) => [clase.id, await inscritosDeClase360(clase.id)] as const),
    ),
  ]);

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
      <div>
        <p className="text-xs font-semibold tracking-widest text-[#2096BA] uppercase">
          {t("courses.title")}
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <BookOpen className="size-5 text-[#2096BA]" />
          {t("courses.title")}
        </h1>
        <p className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 text-sm">
          <span>
            {t("courses.stats.active")}: <b>{cifras.cursos}</b>
          </span>
          <span>
            {t("courses.my360")}: <b>{cifras.clases_360}</b>
          </span>
          <span>
            {t("courses.students")}: <b>{cifras.estudiantes}</b>
          </span>
          <span>
            {t("courses.toReview")}: <b>{cifras.por_revisar}</b>
          </span>
        </p>
      </div>

      <NextIntlClientProvider messages={mensajes}>
        <GestionCursos
          cursos={cursos}
          estudiantesPorCurso={Object.fromEntries(porCurso)}
          clases={clases}
          inscritosPorClase={Object.fromEntries(porClase)}
          entregas={entregas}
          periodos={periodos}
          puedeCrear={puedeTodo || esDocente}
        />
      </NextIntlClientProvider>
    </div>
  );
}
