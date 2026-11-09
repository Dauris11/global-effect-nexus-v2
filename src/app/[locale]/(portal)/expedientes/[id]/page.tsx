import type { Metadata } from "next";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { GraficaTendencia } from "@/components/dashboard/graficas";
import { Historial360 } from "@/components/expedientes/historial-360";
import { MateriasUniversidad } from "@/components/expedientes/materias-universidad";
import { PortadaExpediente } from "@/components/expedientes/portada-expediente";
import { TareasExpediente } from "@/components/expedientes/tareas-expediente";
import { EliminarExpediente } from "@/components/expedientes/eliminar-expediente";
import { FormularioEdicionExpediente } from "@/components/expedientes/formulario-edicion-expediente";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { registrar } from "@/lib/auditoria";
import { requerirPermiso } from "@/lib/auth";
import {
  ASISTIO_REUNION,
  BANO,
  CASA_PROPIA,
  ENVIO_CORREO,
  ESTADOS_ESTUDIANTE,
  GENEROS,
  PARENTESCOS,
} from "@/lib/expedientes";
import { GPA_PRUEBA_ACADEMICA, promedio } from "@/lib/notas";
import {
  usuarioTienePermiso,
} from "@/lib/rbac";
import { urlDeAvatar } from "@/lib/supabase/almacen";
import { historial360DelEstudiante } from "@/server/estudiantes/historial-360";
import { notasDelEstudiante } from "@/server/estudiantes/portal";
import { asignacionesDelEstudiante } from "@/server/estudiantes/aula";
import { inscripcionesDelEstudiante } from "@/server/estudiantes/academico";
import {
  cuentaVinculada,
  cuentasEstudianteSinVincular,
  obtenerExpediente,
} from "@/server/expedientes/consultas";

/** Las mismas seis secciones que la lista y el alta. */
const SECCIONES = [
  "identity",
  "academic",
  "family",
  "housing",
  "health",
  "social",
] as const;

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
 * Detalle y edición de un expediente.
 *
 * Entra quien tenga `expedientes.leer` (administración y `super_admin`), igual
 * que la lista. Solo puede GUARDAR quien además tenga `expedientes.escribir`;
 * para cualquier otro, la pantalla se pinta igual pero con todos los campos
 * deshabilitados: se puede consultar, no tocar.
 */
export default async function PaginaExpediente({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ editar?: string }>;
}) {
  const { locale, id } = await params;
  const { editar } = await searchParams;

  const usuario = await requerirPermiso("expedientes.leer");
  const t = await getTranslations({ locale, namespace: "records" });

  const expediente = await obtenerExpediente(id);

  if (!expediente) {
    return (
      <div className="animate-entrada space-y-6">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="transition-transform hover:-translate-x-0.5"
        >
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

  /*
   * LA TENDENCIA ACADÉMICA de la ficha.
   *
   * Se agrupa en JavaScript y no en SQL, que es lo contrario de lo que hace el
   * resto del sistema, y hay un motivo concreto: el índice sobre 4.00 sale de
   * `notasDelEstudiante`, que devuelve el gpa GUARDADO del historial
   * universitario; agrupar en SQL obligaría a escribir la escala de conversión
   * dentro de la consulta, y la 0006 dice que puede cambiar de un año a otro.
   * Global Effect 360 es otro programa: ni el índice ni la gráfica lo incluyen,
   * va en su propia sección. Son las notas de UNA persona:
   * unas decenas de filas, no un agregado sobre la tabla entera.
   */
  const puedeEditar = usuarioTienePermiso(usuario, "expedientes.escribir");

  // Todo lo que ata el expediente con el resto del sistema: su cuenta, la
  // carrera (inscripciones), Global Effect 360 y las tareas que le dejan los
  // docentes en el aula virtual. Las cuentas libres solo se piden si quien mira
  // puede vincular una.
  const [notas, historial360, inscripciones, asignaciones, cuenta, cuentasLibres] =
    await Promise.all([
      notasDelEstudiante(expediente.id),
      historial360DelEstudiante(expediente.id),
      inscripcionesDelEstudiante(expediente.id),
      asignacionesDelEstudiante(expediente.id),
      cuentaVinculada(expediente.id),
      puedeEditar ? cuentasEstudianteSinVincular() : Promise.resolve([]),
    ]);

  const porPeriodo = new Map<string, number[]>();

  for (const nota of notas) {
    const lista = porPeriodo.get(nota.periodo);

    if (lista) lista.push(nota.gpa);
    else porPeriodo.set(nota.periodo, [nota.gpa]);
  }

  // `notasDelEstudiante` ordena del período más reciente al más antiguo, que es
  // como se lee una lista; una gráfica de evolución se lee al revés.
  const tendencia = [...porPeriodo.entries()]
    .map(([periodo, valores]) => ({
      periodo,
      indice: promedio(valores) ?? 0,
      materias: valores.length,
    }))
    .reverse();

  const indiceAcumulado = promedio(notas.map((nota) => nota.gpa));

  const puedeEliminar = usuarioTienePermiso(usuario, "expedientes.eliminar");

  return (
    <div className="animate-entrada space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="transition-transform hover:-translate-x-0.5"
        >
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

      {/* La portada: foto, estado, dónde estudia y con qué cuenta entra al
          portal. El estado va junto al nombre porque es el dato que más
          condiciona cómo se lee la ficha. */}
      <PortadaExpediente
        expediente={expediente}
        foto={urlDeAvatar(expediente.foto_url)}
        cuenta={cuenta}
        cuentasLibres={cuentasLibres}
        puedeEditar={puedeEditar}
      />

      {/* La tendencia académica, antes de la ficha: es la respuesta a "cómo va"
          y por eso va arriba. Si no hay ninguna nota, la tarjeta no se dibuja:
          un gráfico vacío con una línea de prueba académica sugeriría que el
          estudiante está en riesgo, cuando lo que pasa es que no ha cursado
          nada todavía. */}
      {notas.length > 0 && (
        <Card className="shadow-sm transition-all duration-200 hover:shadow-md">
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{t("detail.evolution")}</p>
                <p className="text-muted-foreground text-xs">
                  {t("detail.subjectsCount", { count: notas.length })}
                </p>
              </div>

              <div className="text-right">
                <p className="text-2xl leading-none font-bold text-[#187a99]">
                  {indiceAcumulado === null
                    ? "—"
                    : indiceAcumulado.toFixed(2)}
                </p>
                <p className="text-muted-foreground mt-1 text-[10px]">
                  {t("detail.gpa")} · {t("detail.gpaScale")}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <GraficaTendencia
                datos={tendencia}
                umbral={GPA_PRUEBA_ACADEMICA}
                etiquetas={{
                  indice: t("detail.gpa"),
                  umbral: t("detail.threshold"),
                  vacio: t("detail.evolutionEmpty"),
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <MateriasUniversidad inscripciones={inscripciones} />

      <Historial360 datos={historial360} />

      <TareasExpediente asignaciones={asignaciones} />

      <FormularioEdicionExpediente
        expediente={expediente}
        fotoActual={urlDeAvatar(expediente.foto_url)}
        puedeEditar={puedeEditar}
        editarInicial={puedeEditar && editar === "1"}
        textos={{
          nuevo: t("new"),
          titulo: t("form.titleEdit"),
          guardar: t("form.saveEdit"),
          guardando: t("form.saving"),
          faltaNombre: t("form.faltaNombreSeccion"),
          cancelar: t("form.cancel"),
          opcional: t("field.optional"),
          savedEdit: t("form.savedEdit"),
          notOwner: t("form.notOwner"),
          verExpediente: t("rowActions.view"),
          editarExpediente: t("rowActions.edit"),
          readOnlyNote: t("form.readOnlyNote"),
          photoInvalid: t("form.photoInvalid"),
          photoTooLarge: t("form.photoTooLarge"),
          error: t("form.error"),
          pestanas: Object.fromEntries(
            SECCIONES.map((clave) => [clave, t(`tab.${clave}`)]),
          ),
          campos: {
            name: t("field.name"),
            idCard: t("field.idCard"),
            email: t("field.email"),
            phone: t("field.phone"),
            birthDate: t("field.birthDate"),
            birthPlace: t("field.birthPlace"),
            nationality: t("field.nationality"),
            gender: t("field.gender"),
            sexDocument: t("field.sexDocument"),
            religion: t("field.religion"),
            photo: t("field.photo"),
            photoHint: t("field.photoHint"),
            status: t("field.status"),
            program: t("field.program"),
            whereStudies: t("field.whereStudies"),
            university: t("field.university"),
            entryDate: t("field.entryDate"),
            school: t("field.school"),
            schoolDirector: t("field.schoolDirector"),
            facilitator: t("field.facilitator"),
            habitudesStory: t("field.habitudesStory"),
            livesWith: t("field.livesWith"),
            whyLivesWith: t("field.whyLivesWith"),
            siblings: t("field.siblings"),
            ownHouse: t("field.ownHouse"),
            houseType: t("field.houseType"),
            bathroom: t("field.bathroom"),
            rooms: t("field.rooms"),
            beds: t("field.beds"),
            whoSleeps: t("field.whoSleeps"),
            address: t("field.address"),
            community: t("field.community"),
            city: t("field.city"),
            illnesses: t("field.illnesses"),
            allergies: t("field.allergies"),
            emergencyName: t("field.emergencyName"),
            emergencyPhone: t("field.emergencyPhone"),
            lifeStory: t("field.lifeStory"),
            familySituation: t("field.familySituation"),
            economicSituation: t("field.economicSituation"),
            scholarshipReason: t("field.scholarshipReason"),
            academicGoals: t("field.academicGoals"),
            sponsorEmail: t("field.sponsorEmail"),
            monthlyMeeting: t("field.monthlyMeeting"),
            warnings: t("field.warnings"),
            pendingRequests: t("field.pendingRequests"),
            notes: t("field.notes"),
          },
          familia: {
            name: t("family.name"),
            age: t("family.age"),
            phone: t("family.phone"),
            occupation: t("family.occupation"),
            emptyHint: t("family.emptyHint"),
          },
          parentescos: Object.fromEntries(
            PARENTESCOS.map((clave) => [clave, t(`relation.${clave}`)]),
          ),
          estados: Object.fromEntries(
            ESTADOS_ESTUDIANTE.map((clave) => [clave, t(`status.${clave}`)]),
          ),
          generos: Object.fromEntries(
            GENEROS.map((clave) => [clave, t(`gender.${clave}`)]),
          ),
          casa: Object.fromEntries(
            CASA_PROPIA.map((clave) => [clave, t(`house.${clave}`)]),
          ),
          bano: Object.fromEntries(
            BANO.map((clave) => [clave, t(`bathroom.${clave}`)]),
          ),
          seguimiento: Object.fromEntries(
            [...new Set([...ENVIO_CORREO, ...ASISTIO_REUNION])].map((clave) => [
              clave,
              t(`followUp.${clave}`),
            ]),
          ),
        }}
      />
    </div>
  );
}
