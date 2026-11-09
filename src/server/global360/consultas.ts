import { consultar, consultarUna } from "@/lib/db";
import { SQL_HOY_RD } from "@/lib/fecha-rd";

/**
 * Global Effect 360: la formación propia de la Fundación, para todos sus
 * estudiantes.
 *
 * Todo el catálogo activo es obligatorio (migración 0047): no hay columna que lo
 * distinga porque una que siempre vale lo mismo invita a desmarcarla. El
 * cuatrimestre tiene dos tandas de dos meses y en cada una se cursa UNA materia,
 * así que el avance se mide contra el catálogo entero y la elección, por tanda.
 */

export type MateriaProgramada = {
  id: string;
  nombre: string;
  codigo: string | null;
  descripcion: string | null;
  creditos: number;
  horas: number | null;
  /**
   * Cómo está esta materia para ESTE estudiante:
   *
   *   aprobada      → ya la dio y cuenta
   *   cursando      → está en ella
   *   prematriculada→ la eligió y el período no ha empezado
   *   reprobada     → la dio y no la pasó: le sigue faltando
   *   pendiente     → no la ha tocado
   */
  situacion: string;
  /** Período de la inscripción que manda, si hay alguna. */
  periodo: string | null;
  nota: number | null;
};

/**
 * El catálogo entero con la situación de cada materia para un estudiante.
 *
 * Una sola consulta y no dos listas —dadas y pendientes— porque la pantalla las
 * necesita juntas para decir "4 de 6" y porque el estado de una materia depende
 * de la inscripción MÁS RELEVANTE, no de la última: si alguien reprobó en un
 * período y aprobó en otro, la materia está dada. De ahí el orden del
 * `DISTINCT ON`, que se queda con la inscripción de mayor peso.
 */
export async function catalogoConSituacion(
  estudianteId: string | null,
): Promise<MateriaProgramada[]> {
  if (!estudianteId) {
    return consultar<MateriaProgramada>(
      `SELECT m.id,
              m.nombre,
              m.codigo,
              m.descripcion,
              m.creditos,
              m.horas,
              'pendiente' AS situacion,
              NULL::text AS periodo,
              NULL::float8 AS nota
         FROM materia_360 m
        WHERE m.activa
        ORDER BY m.orden, m.nombre`,
    );
  }

  return consultar<MateriaProgramada>(
    `SELECT m.id,
            m.nombre,
            m.codigo,
            m.descripcion,
            m.creditos,
            m.horas,
            coalesce(i.estado, 'pendiente') AS situacion,
            p.nombre AS periodo,
            i.nota::float8 AS nota
       FROM materia_360 m
       LEFT JOIN (
              SELECT DISTINCT ON (materia_id)
                     materia_id, estado, periodo_id, nota
                FROM inscripcion_360
               WHERE estudiante_id = $1
               ORDER BY materia_id,
                        -- Aprobada manda sobre todo lo demás; retirada es lo
                        -- que menos dice. Con el mismo peso, la más reciente.
                        CASE estado
                          WHEN 'aprobada'       THEN 0
                          WHEN 'cursando'       THEN 1
                          WHEN 'prematriculada' THEN 2
                          WHEN 'reprobada'      THEN 3
                          ELSE 4
                        END,
                        created_at DESC
            ) i ON i.materia_id = m.id
       LEFT JOIN periodo p ON p.id = i.periodo_id
      WHERE m.activa
      ORDER BY m.orden, m.nombre`,
    [estudianteId],
  );
}

export type AvanceEn360 = {
  total: number;
  dadas: number;
};

/**
 * Cuánto lleva del programa: aprobadas sobre el catálogo activo. Como todo es
 * obligatorio, no hay otra cuenta que separar.
 */
export async function avanceEn360(
  estudianteId: string | null,
): Promise<AvanceEn360> {
  if (!estudianteId) {
    const fila = await consultarUna<{ total: number }>(
      `SELECT count(*)::int AS total FROM materia_360 WHERE activa`,
    );
    return { total: fila?.total ?? 0, dadas: 0 };
  }

  const fila = await consultarUna<AvanceEn360>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE d.dada)::int AS dadas
       FROM materia_360 m
       LEFT JOIN LATERAL (
              SELECT TRUE AS dada
                FROM inscripcion_360 i
               WHERE i.materia_id = m.id
                 AND i.estudiante_id = $1
                 AND i.estado = 'aprobada'
               LIMIT 1
            ) d ON TRUE
      WHERE m.activa`,
    [estudianteId],
  );

  return fila ?? { total: 0, dadas: 0 };
}

export type Ventana = {
  id: string;
  periodo_id: string;
  periodo: string;
  abre: string;
  cierra: string;
  mensaje: string | null;
  /** Tanda que abre: 1 (primeros dos meses) o 2 (últimos dos). */
  ronda: 1 | 2;
  /** Calculado por la base, no por el proceso: `now()` con zona. */
  abierta: boolean;
};

/**
 * La ventana de prematrícula que importa ahora: la abierta, o la próxima.
 *
 * Se decide en SQL y no en Node porque `abierta` depende de la hora actual con
 * zona horaria, y la única referencia común entre el servidor y la base es
 * `now()` de la base. Calcularlo en el proceso daría un resultado distinto
 * según dónde esté desplegado.
 *
 * Devuelve `null` si no hay ninguna activa ni por venir: entonces no hay
 * anuncio que dar.
 */
export async function ventanaVigente(): Promise<Ventana | null> {
  return consultarUna<Ventana>(
    `SELECT v.id,
            v.periodo_id,
            p.nombre AS periodo,
            -- Hora de La Vega, que es en la que se escribió: las pantallas
            -- cortan el texto (fecha y HH:MI) sin convertir zonas.
            to_char(v.abre AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD HH24:MI') AS abre,
            to_char(v.cierra AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD HH24:MI') AS cierra,
            v.mensaje,
            v.ronda,
            (now() >= v.abre AND now() < v.cierra) AS abierta
       FROM ventana_prematricula v
       JOIN periodo p ON p.id = v.periodo_id
      WHERE v.activa
        AND v.cierra > now()
      ORDER BY v.abre
      LIMIT 1`,
  );
}

/** Todas las ventanas, para la pantalla de administración. */
export async function ventanas(): Promise<Ventana[]> {
  return consultar<Ventana>(
    `SELECT v.id,
            v.periodo_id,
            p.nombre AS periodo,
            -- Hora de La Vega, que es en la que se escribió: las pantallas
            -- cortan el texto (fecha y HH:MI) sin convertir zonas.
            to_char(v.abre AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD HH24:MI') AS abre,
            to_char(v.cierra AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD HH24:MI') AS cierra,
            v.mensaje,
            v.ronda,
            (v.activa AND now() >= v.abre AND now() < v.cierra) AS abierta
       FROM ventana_prematricula v
       JOIN periodo p ON p.id = v.periodo_id
      ORDER BY v.abre DESC`,
  );
}

export type MateriaCatalogo = {
  id: string;
  nombre: string;
  codigo: string | null;
  creditos: number;
  horas: number | null;
  activa: boolean;
  orden: number;
  docente_id: string | null;
  horario: string | null;
  aula: string | null;
  cupo_maximo: number | null;
  /** Cuántos estudiantes la llevan prematriculada o cursando ahora. */
  inscritos: number;
};

/** El catálogo tal cual, para administrarlo. */
export async function catalogo(): Promise<MateriaCatalogo[]> {
  return consultar<MateriaCatalogo>(
    `SELECT m.id, m.nombre, m.codigo, m.creditos, m.horas,
            m.activa, m.orden, m.docente_id, m.horario, m.aula, m.cupo_maximo,
            (SELECT count(*)::int
               FROM inscripcion_360 i
              WHERE i.materia_id = m.id
                AND i.estado IN ('prematriculada', 'cursando')) AS inscritos
       FROM materia_360 m
      ORDER BY m.activa DESC, m.orden, m.nombre`,
  );
}

/** Períodos a los que se puede colgar una ventana. */
export async function periodosDisponibles(): Promise<
  { id: string; nombre: string }[]
> {
  return consultar<{ id: string; nombre: string }>(
    `SELECT id, nombre FROM periodo
      WHERE estado <> 'completado'
      ORDER BY fecha_inicio DESC`,
  );
}

export type TandaDelEstudiante = {
  ronda: 1 | 2;
  materia_id: string;
  materia: string;
  codigo: string | null;
  estado: string;
};

/**
 * Lo que el estudiante eligió en cada tanda de un período.
 *
 * Como mucho una fila por tanda: lo garantiza `uq_inscripcion_360_una_por_tanda`.
 * La `retirada` no cuenta porque retirarse libera la tanda, y la pantalla tiene
 * que enseñarla libre para que vuelva a elegir.
 */
export async function tandasDelEstudiante(
  estudianteId: string | null,
  periodoId: string,
): Promise<TandaDelEstudiante[]> {
  if (!estudianteId) return [];
  return consultar<TandaDelEstudiante>(
    `SELECT i.ronda, i.materia_id, m.nombre AS materia, m.codigo, i.estado
       FROM inscripcion_360 i
       JOIN materia_360 m ON m.id = i.materia_id
      WHERE i.estudiante_id = $1
        AND i.periodo_id = $2
        AND i.estado <> 'retirada'
      ORDER BY i.ronda`,
    [estudianteId, periodoId],
  );
}

/**
 * Pasa a `cursando` las inscripciones cuyo período ya empezó y no ha terminado.
 *
 * PEREZOSA A PROPÓSITO: no hay cron en el proyecto, así que la llaman al
 * principio las páginas que muestran el estado de las inscripciones
 * (clases-360, portal del profesor y global-360 del estudiante). Es idempotente
 * y barata —un UPDATE con índice por estado que casi nunca toca filas—, y vive
 * aquí y no en `acciones.ts` para que no sea una acción de servidor que el
 * navegador pueda invocar. La fecha de hoy es la de La Vega, no la de UTC.
 */
export async function iniciarInscripcionesVigentes(): Promise<void> {
  try {
    await consultar(
      `UPDATE inscripcion_360 i
          SET estado = 'cursando', updated_at = now()
         FROM periodo p
        WHERE p.id = i.periodo_id
          AND i.estado = 'prematriculada'
          AND p.fecha_inicio <= ${SQL_HOY_RD}
          AND p.fecha_fin >= ${SQL_HOY_RD}`,
    );
  } catch (error) {
    // Un fallo aquí no debe tumbar la pantalla: la inscripción sigue
    // prematriculada y se reintenta en la siguiente visita.
    console.error("[360] no se pudo iniciar las inscripciones vigentes", error);
  }
}
