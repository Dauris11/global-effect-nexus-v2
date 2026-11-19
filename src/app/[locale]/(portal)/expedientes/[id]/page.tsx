import type { Metadata } from "next";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { FichaFamilia, FichaInformacion, FichaPerfil, FichaSalud } from "@/components/expedientes/detalle/fichas";
import { PestanasDetalle } from "@/components/expedientes/detalle/pestanas-detalle";
import { textoAntiguedad } from "@/components/expedientes/detalle/antiguedad-texto";
import { Tab360, TabPensum, TabRecord, TabUniversidad } from "@/components/expedientes/detalle/tab-academica";
import { TabPatrocinio, TabSeguimiento } from "@/components/expedientes/detalle/tab-seguimiento";
import { EliminarExpediente } from "@/components/expedientes/eliminar-expediente";
import { FormularioEdicionExpediente } from "@/components/expedientes/formulario-edicion-expediente";
import { PortadaExpediente } from "@/components/expedientes/portada-expediente";
import { textosEdicion } from "@/components/expedientes/textos-edicion";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Link } from "@/i18n/navigation";
import { registrar } from "@/lib/auditoria";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { urlDeAvatar } from "@/lib/supabase/almacen";
import { asignacionesDelEstudiante } from "@/server/estudiantes/aula";
import { inscripcionesDelEstudiante } from "@/server/estudiantes/academico";
import { historial360DelEstudiante } from "@/server/estudiantes/historial-360";
import { notasDelEstudiante } from "@/server/estudiantes/portal";
import { cuentaVinculada, cuentasEstudianteSinVincular, obtenerExpediente } from "@/server/expedientes/consultas";
import { seguimientoDelEstudiante } from "@/server/expedientes/seguimiento";

const PESTANAS = ["info", "profile", "family", "health", "university", "record", "curriculum", "g360", "followUp", "sponsorship", "edit"] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "records" });
  const expediente = await obtenerExpediente(id);

  return { title: expediente ? expediente.nombre : t("detail.notFound") };
}

/**
 * Detalle de un expediente: la portada (foto, estado, grupo y tiempo en la
 * Fundación) y debajo, por tipo de información, sus pestañas. Se abre en
 * «Información»; lo académico (universidad, récord de notas, pénsum y
 * graduación, Global Effect 360) tiene la suya, y «Editar» es la última.
 *
 * Entra quien tenga `expedientes.leer`; solo guarda quien además tenga
 * `expedientes.escribir` (los demás no ven la pestaña «Editar»).
 */
export default async function PaginaExpediente({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ editar?: string; seccion?: string }>;
}) {
  const { locale, id } = await params;
  const { editar, seccion } = await searchParams;

  const usuario = await requerirPermiso("expedientes.leer");
  const [t, idiomaCrudo] = await Promise.all([getTranslations({ locale, namespace: "records" }), getLocale()]);
  const idioma = idiomaCrudo === "en" ? "en" : "es";

  const expediente = await obtenerExpediente(id);

  if (!expediente) {
    return (
      <div className="animate-entrada space-y-6">
        <Button asChild variant="outline" size="sm" className="transition-transform hover:-translate-x-0.5">
          <Link href="/expedientes">
            <ArrowLeft className="size-4" />
            {t("backToList")}
          </Link>
        </Button>

        <EstadoVacio icono={FileQuestion} titulo={t("detail.notFound")} />
      </div>
    );
  }

  /*
   * RASTRO DE LECTURA (tarea #428).
   *
   * Hasta aquí `audit_log` solo registraba ESCRITURAS —completar una cita,
   * cancelarla, anotar—, y el hueco era justo el que más importa en un módulo
   * confidencial: quién ABRIÓ la ficha de quién. Esta pantalla trae la historia
   * de vida, la situación familiar, las enfermedades y las amonestaciones; que
   * se pueda consultar sin dejar huella es lo que hace que nadie se atreva a
   * poner ahí lo que hace falta.
   *
   * Se anota UNA fila por apertura, con el nombre para poder leer el registro
   * sin cruzarlo con `estudiante`. **No se anota el contenido**: qué dice la
   * ficha no es auditoría (ver la cabecera de `lib/auditoria.ts`).
   *
   * Va aquí y no en `obtenerExpediente()`: esa consulta también la usa
   * `generateMetadata` —que solo saca el título de la pestaña— y desde el
   * formulario de edición, así que registrarla ahí produciría dos y tres filas
   * por visita y el registro dejaría de contar aperturas.
   *
   * `registrar()` no lanza nunca: si el rastro falla, la ficha se enseña igual
   * y el fallo queda en el registro del servidor. Es la decisión que ya tomó
   * ese módulo, y aquí se hereda a conciencia: negarle la ficha a quien la
   * abre porque su auditoría no escribe sería el peor de los dos males.
   */
  await registrar({
    usuarioId: usuario.id,
    accion: "expediente.consultado",
    entidad: "estudiante",
    entidadId: expediente.id,
    datos: { nombre: expediente.nombre, editando: editar === "1" },
  });

  const puedeEditar = usuarioTienePermiso(usuario, "expedientes.escribir");
  const puedeEliminar = usuarioTienePermiso(usuario, "expedientes.eliminar");

  // Todo se pide UNA vez: las pestañas son del cliente y no recargan la ficha.
  // Son las filas de UNA persona (unas decenas), no un agregado sobre la tabla.
  const [notas, historial360, inscripciones, asignaciones, cuenta, cuentasLibres, seguimiento] = await Promise.all([
    notasDelEstudiante(expediente.id),
    historial360DelEstudiante(expediente.id),
    inscripcionesDelEstudiante(expediente.id),
    asignacionesDelEstudiante(expediente.id),
    cuentaVinculada(expediente.id),
    puedeEditar ? cuentasEstudianteSinVincular() : Promise.resolve([]),
    seguimientoDelEstudiante(expediente.id),
  ]);

  const tiempo = textoAntiguedad(expediente.fecha_ingreso, (k, v) => t(k as never, v as never), idioma);
  const foto = urlDeAvatar(expediente.foto_url);

  const visibles = PESTANAS.filter((p) => p !== "edit" || puedeEditar);
  // `?editar=1` lo usan la lista y la vista rápida: abre directo la pestaña de edición.
  const pedida = seccion ?? (editar === "1" ? "edit" : "info");
  const inicial = (visibles as readonly string[]).includes(pedida) ? pedida : "info";

  return (
    <div className="animate-entrada space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Button asChild variant="outline" size="sm" className="transition-transform hover:-translate-x-0.5">
          <Link href="/expedientes">
            <ArrowLeft className="size-4" />
            {t("backToList")}
          </Link>
        </Button>

        {puedeEliminar && (
          <EliminarExpediente
            id={expediente.id}
            textos={{
              delete: t("rowActions.delete"),
              confirmDelete: t("rowActions.confirmDelete"),
              deleting: t("rowActions.deleting"),
              cancel: t("form.cancel"),
              confirmTitle: t("rowActions.confirmTitle", { name: expediente.nombre }),
              deleteHint: t("rowActions.deleteHint"),
              confirmHint: t("rowActions.confirmHint"),
              inUseTitle: t("rowActions.inUseTitle", { name: expediente.nombre }),
              inUseHint: t("rowActions.inUseHint"),
              understood: t("rowActions.understood"),
              error: t("rowActions.error"),
              deps: {
                enrollments: t("rowActions.deps.enrollments"),
                history: t("rowActions.deps.history"),
                requests: t("rowActions.deps.requests"),
                service: t("rowActions.deps.service"),
              },
            }}
          />
        )}
      </div>

      <PortadaExpediente
        expediente={expediente}
        foto={foto}
        cuenta={cuenta}
        cuentasLibres={cuentasLibres}
        puedeEditar={puedeEditar}
        tiempo={tiempo}
      />

      <PestanasDetalle
        inicial={inicial}
        pestanas={visibles.map((clave) => ({ clave, etiqueta: t(`v2.tabs.${clave}`) }))}
        contenido={{
          info: <FichaInformacion e={expediente} />,
          profile: <FichaPerfil e={expediente} />,
          family: <FichaFamilia e={expediente} />,
          health: <FichaSalud e={expediente} />,
          university: <TabUniversidad e={expediente} inscripciones={inscripciones} asignaciones={asignaciones} />,
          record: <TabRecord notas={notas} />,
          curriculum: <TabPensum e={expediente} inscripciones={inscripciones} seg={seguimiento} tiempo={tiempo} />,
          g360: <Tab360 datos={historial360} />,
          followUp: <TabSeguimiento e={expediente} seg={seguimiento} />,
          sponsorship: <TabPatrocinio seg={seguimiento} />,
          edit: (
            <FormularioEdicionExpediente
              expediente={expediente}
              fotoActual={foto}
              puedeEditar={puedeEditar}
              editarInicial={puedeEditar}
              textos={textosEdicion(t)}
            />
          ),
        }}
      />
    </div>
  );
}
