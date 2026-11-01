import type { Metadata } from "next";
import { AlertCircle, GanttChartSquare, ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FiltrosLineaTiempo } from "@/components/linea-tiempo/filtros-linea-tiempo";
import { LineaTiempo } from "@/components/linea-tiempo/linea-tiempo";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Link } from "@/i18n/navigation";
import { requerirUsuario } from "@/lib/auth";
import {
  esIncoherente,
  tramoDe,
  type BarraTiempo,
  type SeccionTiempo,
} from "@/lib/linea-tiempo";
import { ALERTA_RIESGO } from "@/lib/paleta";
import { usuarioTieneAlgunPermiso, usuarioTienePermiso } from "@/lib/rbac";
import { moverBarra } from "@/server/calendario/acciones-gantt";
import {
  esFamilia,
  familiaAcademico,
  familiaClases360,
  familiaOperaciones,
  familiaTareas,
  hoyEnLaBase,
  periodosDelGantt,
  TRAMO_ABIERTO,
  ventanaDelGantt,
  type Barra,
  type Familia,
} from "@/server/calendario/gantt";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CERRADAS = ["completado", "completada", "finalizado", "inactiva", "aprobada"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "calendar" });

  return { title: t("gantt.title") };
}

/**
 * Línea de tiempo general de las cuatro familias: qué corre a la vez.
 *
 * Quien lleva `operaciones.escribir` mueve y estira proyectos y tareas, y quien
 * lleva `academico.escribir` mueve períodos, arrastrando la barra. Lo demás es
 * de lectura: las materias heredan las fechas de su período, las clases de 360
 * se deducen de sus inscritos y las entregas viven en el aula.
 *
 * QUIÉN ENTRA. Junta datos académicos y de operaciones, así que basta con
 * alguno de `operaciones.leer`, `academico.escribir` o `calificaciones.registrar`.
 * `academico.leer` a secas no vale: lo tiene el estudiante, y esto enseña la
 * carga de trabajo de toda la institución. Cada familia se dibuja solo si su
 * permiso está.
 */
export default async function PaginaGantt({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ periodo?: string; tramo?: string; f?: string | string[] }>;
}) {
  const { locale } = await params;
  const { periodo, tramo, f } = await searchParams;

  const usuario = await requerirUsuario();
  const t = await getTranslations({ locale, namespace: "calendar" });

  if (
    !usuarioTieneAlgunPermiso(usuario, [
      "operaciones.leer",
      "academico.escribir",
      "calificaciones.registrar",
    ])
  ) {
    return (
      <EstadoVacio icono={ShieldAlert} titulo={t("gantt.forbidden")} className="mx-auto max-w-2xl" />
    );
  }

  const veAcademico = usuarioTieneAlgunPermiso(usuario, [
    "academico.escribir",
    "calificaciones.registrar",
  ]);
  const veOperaciones = usuarioTienePermiso(usuario, "operaciones.leer");
  const mueveOperaciones = usuarioTienePermiso(usuario, "operaciones.escribir");
  const mueveAcademico = usuarioTienePermiso(usuario, "academico.escribir");

  const permitidas: Familia[] = [
    ...(veAcademico ? (["academico", "tareas", "clases360"] as Familia[]) : []),
    ...(veOperaciones ? (["operaciones"] as Familia[]) : []),
  ];

  // Sin marcar nada se dibujan todas: la primera visita tiene que decir algo.
  const pedidas = (Array.isArray(f) ? f : f ? [f] : []).filter(esFamilia);
  const elegidas = pedidas.filter((familia) => permitidas.includes(familia));
  const familias = elegidas.length > 0 ? elegidas : permitidas;

  const todo = tramo === "todo";
  const periodoId = UUID.test(periodo ?? "") ? periodo! : null;

  const [ventana, periodos, hoy] = await Promise.all([
    ventanaDelGantt(periodoId),
    periodosDelGantt(),
    hoyEnLaBase(),
  ]);

  // En "todo" se piden los límites abiertos y el tramo se ajusta a lo que salga:
  // no hay ninguna ventana inventada.
  const desde = todo ? TRAMO_ABIERTO.desde : (ventana?.inicio ?? TRAMO_ABIERTO.desde);
  const hasta = todo ? TRAMO_ABIERTO.hasta : (ventana?.fin ?? TRAMO_ABIERTO.hasta);

  const vacio = { barras: [] as Barra[], sinFechas: 0 };
  const [academico, tareas, operaciones, clases360] = await Promise.all([
    familias.includes("academico") ? familiaAcademico(desde, hasta) : vacio,
    familias.includes("tareas") ? familiaTareas(desde, hasta) : vacio,
    familias.includes("operaciones") ? familiaOperaciones(desde, hasta) : vacio,
    familias.includes("clases360") ? familiaClases360(desde, hasta) : vacio,
  ]);

  const origen = { academico, tareas, operaciones, clases360 };
  const sinFechas =
    academico.sinFechas + tareas.sinFechas + operaciones.sinFechas + clases360.sinFechas;
  let incoherentes = 0;

  /** De la fila de la base a la barra que dibuja el componente compartido. */
  const aBarra = (b: Barra, familia: Familia): BarraTiempo => {
    const editable =
      (b.clase === "periodo" && mueveAcademico) ||
      (familia === "operaciones" && mueveOperaciones);

    return {
      id: b.id,
      // `tarea` existe en dos familias: la de entregas no se mueve desde aquí.
      clase: familia === "tareas" ? `asignacion_${b.clase}` : b.clase,
      claseEtiqueta: t(`gantt.kind.${b.clase}` as never),
      titulo: b.titulo,
      grupo: b.grupo,
      inicio: b.inicio,
      fin: b.fin,
      detalle: b.detalle,
      editable,
      progreso: b.clase === "proyecto" ? parseInt(b.detalle ?? "0", 10) : undefined,
      tono: CERRADAS.includes(b.estado)
        ? "apagado"
        : b.clase === "periodo"
          ? "oscuro"
          : b.clase === "examen"
            ? "tinta"
            : "marca",
    };
  };

  const secciones: SeccionTiempo[] = (
    ["academico", "tareas", "operaciones", "clases360"] as const
  )
    .filter((familia) => familias.includes(familia))
    .map((familia) => {
      const barras = origen[familia].barras.flatMap((b) => {
        if (esIncoherente(b)) {
          incoherentes += 1;
          return [];
        }
        return [aBarra(b, familia)];
      });
      return { clave: familia, titulo: t(`gantt.family.${familia}`), barras };
    });

  const rango = tramoDe(
    secciones.flatMap((s) => s.barras),
    hoy,
  );

  return (
    <div className="animate-entrada mx-auto max-w-7xl space-y-6">
      <EncabezadoPagina titulo={t("gantt.title")} />

      <FiltrosLineaTiempo
        periodos={periodos.map((p) => ({ id: p.id, nombre: p.nombre }))}
        periodoActual={ventana?.periodo_id ?? ""}
        todo={todo}
        familias={permitidas.map((clave) => ({
          clave,
          etiqueta: t(`gantt.family.${clave}`),
        }))}
        activas={familias}
        etiquetaPeriodo={t("gantt.span")}
        etiquetaTodo={t("gantt.spanAll")}
        etiquetaFamilias={t("gantt.families")}
      />

      {!rango ? (
        <EstadoVacio
          icono={GanttChartSquare}
          titulo={todo ? t("gantt.nothing") : t("gantt.empty")}
          accion={
            !todo && (
              <Button asChild variant="outline">
                <Link href="/calendario/gantt?tramo=todo">{t("gantt.seeAll")}</Link>
              </Button>
            )
          }
        />
      ) : (
        <LineaTiempo
          secciones={secciones}
          inicio={rango.inicio}
          fin={rango.fin}
          hoy={hoy}
          alMover={mueveOperaciones || mueveAcademico ? moverBarra : undefined}
        />
      )}

      {/* Datos incompletos: se dicen con palabras, no se dan por inexistentes. */}
      {(sinFechas > 0 || incoherentes > 0) && (
        <div className="space-y-2">
          {sinFechas > 0 && (
            <p className={ALERTA_RIESGO.contenedor}>
              <AlertCircle className={ALERTA_RIESGO.icono} />
              <span className={ALERTA_RIESGO.texto}>
                {t("gantt.noDates", { count: sinFechas })}
              </span>
            </p>
          )}
          {incoherentes > 0 && (
            <p className={ALERTA_RIESGO.contenedor}>
              <AlertCircle className={ALERTA_RIESGO.icono} />
              <span className={ALERTA_RIESGO.texto}>
                {t("gantt.inverted", { count: incoherentes })}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
