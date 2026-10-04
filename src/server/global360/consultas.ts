import { consultar, consultarUna } from "@/lib/db";

/**
 * Global Effect 360: el programa de materias técnicas de los becados
 * universitarios.
 *
 * Cuatro materias del catálogo son obligatorias y el resto opcionales. El número
 * no está escrito en ningún sitio: se cuenta desde `materia_360.obligatoria`,
 * para que administración pueda corregir el catálogo sin que haya que tocar
 * código ni migrar nada.
 */

export type MateriaProgramada = {
  id: string;
  nombre: string;
  codigo: string | null;
  descripcion: string | null;
  obligatoria: boolean;
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
  estudianteId: string,
): Promise<MateriaProgramada[]> {
  return consultar<MateriaProgramada>(
    `SELECT m.id,
            m.nombre,
            m.codigo,
            m.descripcion,
            m.obligatoria,
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
      ORDER BY m.obligatoria DESC, m.orden, m.nombre`,
    [estudianteId],
  );
}

export type AvanceEn360 = {
  obligatorias: number;
  obligatorias_dadas: number;
  opcionales: number;
  opcionales_dadas: number;
};

/** Cuánto lleva del programa, separando obligatorias de opcionales. */
export async function avanceEn360(
  estudianteId: string,
): Promise<AvanceEn360> {
  const fila = await consultarUna<AvanceEn360>(
    `SELECT count(*) FILTER (WHERE m.obligatoria)::int AS obligatorias,
            count(*) FILTER (WHERE m.obligatoria AND d.dada)::int AS obligatorias_dadas,
            count(*) FILTER (WHERE NOT m.obligatoria)::int AS opcionales,
            count(*) FILTER (WHERE NOT m.obligatoria AND d.dada)::int AS opcionales_dadas
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

  return (
    fila ?? {
      obligatorias: 0,
      obligatorias_dadas: 0,
      opcionales: 0,
      opcionales_dadas: 0,
    }
  );
}

export type Ventana = {
  id: string;
  periodo_id: string;
  periodo: string;
  abre: string;
  cierra: string;
  mensaje: string | null;
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
            v.abre::text  AS abre,
            v.cierra::text AS cierra,
            v.mensaje,
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
            v.abre::text  AS abre,
            v.cierra::text AS cierra,
            v.mensaje,
            (now() >= v.abre AND now() < v.cierra) AS abierta
       FROM ventana_prematricula v
       JOIN periodo p ON p.id = v.periodo_id
      ORDER BY v.abre DESC`,
  );
}

export type MateriaCatalogo = {
  id: string;
  nombre: string;
  codigo: string | null;
  obligatoria: boolean;
  creditos: number;
  horas: number | null;
  activa: boolean;
  orden: number;
  /** Cuántos becados la llevan prematriculada o cursando ahora. */
  inscritos: number;
};

/** El catálogo tal cual, para administrarlo. */
export async function catalogo(): Promise<MateriaCatalogo[]> {
  return consultar<MateriaCatalogo>(
    `SELECT m.id, m.nombre, m.codigo, m.obligatoria, m.creditos, m.horas,
            m.activa, m.orden,
            (SELECT count(*)::int
               FROM inscripcion_360 i
              WHERE i.materia_id = m.id
                AND i.estado IN ('prematriculada', 'cursando')) AS inscritos
       FROM materia_360 m
      ORDER BY m.activa DESC, m.obligatoria DESC, m.orden, m.nombre`,
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
