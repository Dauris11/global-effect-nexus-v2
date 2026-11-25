import type { Metadata } from "next";
import { ChevronLeft, FileQuestion } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { FichaFamilia, FichaInformacion, FichaPerfil, FichaSalud } from "@/components/expedientes/detalle/fichas";
import { FichaCompleta } from "@/components/expedientes/ficha-completa";
import { MenuExportar } from "@/components/compartido/menu-exportar";
import { AlertasAcademicas } from "@/components/expedientes/alertas-academicas";
import { AccionesRapidasExpediente } from "@/components/expedientes/acciones-rapidas-expediente";
import { PestanasDetalle } from "@/components/expedientes/detalle/pestanas-detalle";
import { textoAntiguedad } from "@/components/expedientes/detalle/antiguedad-texto";
import { alertasAcademicas, indiceDelEstudiante, umbralesDeUniversidad } from "@/server/academico/indice";
import { archivosAcademicos, arbolCatalogo, catalogoDelEstudiante, recordNativoDelEstudiante } from "@/server/universidades/consultas";
import { Tab360, TabPensum, TabRecord, TabUniversidad } from "@/components/expedientes/detalle/tab-academica";
import { TabCostos } from "@/components/expedientes/detalle/tab-costos";
import { TabPatrocinio, TabSeguimiento } from "@/components/expedientes/detalle/tab-seguimiento";
import { EliminarExpediente } from "@/components/expedientes/eliminar-expediente";
import { FormularioEdicionExpediente } from "@/components/expedientes/formulario-edicion-expediente";
import { PortadaExpediente } from "@/components/expedientes/portada-expediente";
import { textosCatalogo, textosEdicion } from "@/components/expedientes/textos-edicion";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import { registrar } from "@/lib/auditoria";
import { requerirPermiso } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { urlDeAvatar } from "@/lib/supabase/almacen";
import { asignacionesDelEstudiante } from "@/server/estudiantes/aula";
import { inscripcionesDelEstudiante } from "@/server/estudiantes/academico";
import { historial360DelEstudiante } from "@/server/estudiantes/historial-360";
import { notasDelEstudiante } from "@/server/estudiantes/portal";
import { costoDeEstudiante, gastosDeEstudiante, periodosParaCostos } from "@/server/costos/consultas";
import { cuentaVinculada, cuentasEstudianteSinVincular, obtenerExpediente } from "@/server/expedientes/consultas";
import { cambiosDePlanDelEstudiante, seguimientoDelEstudiante } from "@/server/expedientes/seguimiento";

const PESTANAS = ["info", "family", "academic", "followUp", "costs", "edit"] as const;

/** Enlaces viejos (`?seccion=record`…) siguen llegando a su sitio: cada pestaña antigua cae en la que la absorbió. */
const PESTANA_ANTIGUA: Record<string, (typeof PESTANAS)[number]> = {
  profile: "info",
  health: "family",
  university: "academic",
  record: "academic",
  curriculum: "academic",
  g360: "academic",
  sponsorship: "followUp",
  financiero: "costs",
};

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
  const [t, tc, te, idiomaCrudo] = await Promise.all([getTranslations({ locale, namespace: "records" }), getTranslations({ locale, namespace: "catalog" }), getTranslations({ locale, namespace: "export" }), getLocale()]);
  const idioma = idiomaCrudo === "en" ? "en" : "es";

  const expediente = await obtenerExpediente(id);

  if (!expediente) {
    return (
      <div className="animate-entrada space-y-6">
        <Button asChild variant="outline" size="sm" className="transition-transform hover:-translate-x-0.5">
          <Link href="/expedientes">
            <ChevronLeft className="size-4" />
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
  // El costo de un becado es de la Junta y de contabilidad: sin el permiso la
  // pestaña no existe y las cifras ni se consultan.
  const puedeVerCostos = usuarioTienePermiso(usuario, "expedientes.costos.leer");

  // Todo se pide UNA vez: las pestañas son del cliente y no recargan la ficha.
  // Son las filas de UNA persona (unas decenas), no un agregado sobre la tabla.
  const mensajes = await mensajesCliente(["records", "catalog"]);
  const [notas, historial360, inscripciones, asignaciones, cuenta, cuentasLibres, seguimiento, catalogo, arbol, archivos, record, indice, umbrales, cambios] = await Promise.all([
    notasDelEstudiante(expediente.id),
    historial360DelEstudiante(expediente.id),
    inscripcionesDelEstudiante(expediente.id),
    asignacionesDelEstudiante(expediente.id),
    cuentaVinculada(expediente.id),
    puedeEditar ? cuentasEstudianteSinVincular() : Promise.resolve([]),
    seguimientoDelEstudiante(expediente.id),
    catalogoDelEstudiante(expediente.id),
    puedeEditar ? arbolCatalogo() : Promise.resolve(null),
    archivosAcademicos("estudiante", expediente.id),
    recordNativoDelEstudiante(expediente.id),
    indiceDelEstudiante(expediente.id),
    umbralesDeUniversidad(expediente.id),
    cambiosDePlanDelEstudiante(expediente.id),
  ]);
  const [costo, gastos, periodosCosto] = puedeVerCostos
    ? await Promise.all([costoDeEstudiante(expediente.id), gastosDeEstudiante(expediente.id), periodosParaCostos()])
    : [null, [], []];
  // Rastro aparte del de la ficha: las cifras de dinero son lo más sensible que hay aquí.
  if (puedeVerCostos) {
    await registrar({ usuarioId: usuario.id, accion: "expediente.costos.consultado", entidad: "estudiante", entidadId: expediente.id, datos: { nombre: expediente.nombre } });
  }
  const ultimo = record?.periodos[0];
  const alertas = alertasAcademicas(catalogo, indice, umbrales.acumulado, ultimo ? { periodo: ultimo.periodo, indice: ultimo.indice, umbral: umbrales.periodo } : null);

  const tiempo = textoAntiguedad(expediente.fecha_ingreso, (k, v) => t(k as never, v as never), idioma);
  const foto = urlDeAvatar(expediente.foto_url);

  const visibles = PESTANAS.filter((p) => (p !== "edit" || puedeEditar) && (p !== "costs" || (puedeVerCostos && costo)));
  // `?editar=1` lo usan la lista y la vista rápida: abre directo la pestaña de edición.
  const pedida = PESTANA_ANTIGUA[seccion ?? ""] ?? seccion ?? (editar === "1" ? "edit" : "info");
  const inicial = (visibles as readonly string[]).includes(pedida) ? pedida : "info";

  return (
    <NextIntlClientProvider messages={mensajes}>
    <div className="animate-entrada space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Button asChild variant="outline" size="sm" className="transition-transform hover:-translate-x-0.5">
          <Link href="/expedientes">
            <ChevronLeft className="size-4" />
            {t("backToList")}
          </Link>
        </Button>

        <MenuExportar
          documentos={[
            { tipo: "ficha", etiqueta: te("docs.ficha"), params: { id: expediente.id } },
            { tipo: "record", etiqueta: te("docs.record"), params: { id: expediente.id } },
            { tipo: "avance", etiqueta: te("docs.avance"), params: { id: expediente.id } },
          ]}
        />

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
        universidadCatalogo={catalogo.universidad}
      />

      <FichaCompleta e={expediente} puedeEditar={puedeEditar} />

      <AlertasAcademicas alertas={alertas} />

      <AccionesRapidasExpediente
        id={expediente.id}
        puedeEditar={puedeEditar}
        carreraId={catalogo.carrera?.id ?? null}
        pensumId={catalogo.pensum?.id ?? null}
        puedeVerCatalogo={usuarioTienePermiso(usuario, "catalogo.leer")}
        patrocinador={(() => {
          const a = seguimiento.asignaciones.find((x) => x.activa);

          return a ? { id: a.patrocinador_id, nombre: a.patrocinador } : null;
        })()}
        puedeVerPatrocinadores={usuarioTienePermiso(usuario, "patrocinadores.leer")}
        puedeEscribirPatrocinadores={usuarioTienePermiso(usuario, "patrocinadores.escribir")}
        puedeVerPlanilla={usuarioTienePermiso(usuario, "operaciones.leer")}
      />

      <PestanasDetalle
        key={inicial}
        inicial={inicial}
        pestanas={visibles.map((clave) => ({ clave, etiqueta: t(`v2.tabs.${clave}`) }))}
        contenido={{
          info: (
            <>
              <FichaInformacion e={expediente} tiempo={tiempo} />
              <FichaPerfil e={expediente} />
            </>
          ),
          family: (
            <>
              <FichaFamilia e={expediente} />
              <FichaSalud e={expediente} />
            </>
          ),
          academic: (
            <>
              <TabUniversidad e={expediente} inscripciones={inscripciones} asignaciones={asignaciones} catalogo={catalogo} puedeEditar={puedeEditar} puedeAdministrar={usuarioTienePermiso(usuario, "catalogo.leer")} cambios={cambios} />
              <TabRecord notas={notas} record={record} indice={indice} umbral={umbrales.acumulado} puedeEditar={puedeEditar} />
              <TabPensum e={expediente} inscripciones={inscripciones} seg={seguimiento} tiempo={tiempo} catalogo={catalogo} archivos={archivos} puedeEditar={puedeEditar} />
              <Tab360 datos={historial360} />
            </>
          ),
          followUp: (
            <>
              <TabSeguimiento e={expediente} seg={seguimiento} />
              <TabPatrocinio seg={seguimiento} />
            </>
          ),
          costs: costo ? <TabCostos resumen={costo} gastos={gastos} periodos={periodosCosto} /> : null,
          edit: (
            <FormularioEdicionExpediente
              expediente={expediente}
              fotoActual={foto}
              puedeEditar={puedeEditar}
              editarInicial={puedeEditar}
              textos={textosEdicion(t)}
              catalogo={arbol ? { arbol, textos: textosCatalogo((k, v) => tc(k as never, v as never)) } : undefined}
            />
          ),
        }}
      />
    </div>
    </NextIntlClientProvider>
  );
}
