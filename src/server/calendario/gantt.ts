import { consultar, consultarUna } from "@/lib/db";

/**
 * Diagrama de Gantt: lo que dura cada cosa, sobre una misma línea de tiempo.
 *
 * El calendario responde "¿qué pasa el martes?". Esto responde otra pregunta
 * distinta y que hoy no se puede contestar en ninguna pantalla: "¿qué se
 * solapa con qué?". Un cuatrimestre, las tareas que vencen dentro, los
 * proyectos que corren en paralelo y las clases de 360 que se dan a la vez.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LO QUE EL ESQUEMA DA Y LO QUE NO. Esto condiciona todo lo demás y conviene
 * leerlo antes de tocar nada:
 *
 *   · `periodo` tiene fechas propias. Es la única fila que de verdad las tiene
 *     para lo académico.
 *   · `materia` NO tiene fechas: hereda las de su período. Sus
 *     barras miden lo mismo que el cuatrimestre entero. No es un fallo del
 *     dibujo, es lo que la base sabe — y por eso van agrupadas bajo su período
 *     en vez de fingir que cada una tiene su propio calendario.
 *   · `asignacion` sí las tiene, y buenas: `fecha_publicacion` y
 *     `fecha_vencimiento`. Es la familia donde el Gantt informa de verdad.
 *   · `proyecto` y `tarea` las tienen pero ANULABLES. Lo que no tiene fecha no
 *     se puede dibujar, así que se cuenta aparte y se dice cuántos quedaron
 *     fuera. Inventarles un rango sería dibujar una planificación que nadie
 *     hizo.
 *   · `materia_360` no tiene NI fechas NI período. Su barra se deduce de los
 *     períodos en los que hay gente inscrita (`inscripcion_360.periodo_id`),
 *     que es la única pista real. Una clase sin inscritos no se puede situar en
 *     el tiempo y no aparece. Queda anotado como deuda del esquema.
 *
 * Nada de esto se rellena con valores por omisión. Una barra dibujada es una
 * barra con fechas de verdad detrás.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Las cuatro familias de barras, en el orden en que se leen. */
export const FAMILIAS = [
  "academico",
  "tareas",
  "operaciones",
  "clases360",
] as const;

export type Familia = (typeof FAMILIAS)[number];

export function esFamilia(valor: string): valor is Familia {
  return (FAMILIAS as readonly string[]).includes(valor);
}

export type Barra = {
  id: string;
  /** Qué clase de fila es, para el icono y el texto. */
  clase: string;
  titulo: string;
  /** A qué pertenece: el período de una materia, el proyecto de una tarea. */
  grupo: string | null;
  /** Fechas en ISO `YYYY-MM-DD`. Nunca nulas: sin fechas no hay barra. */
  inicio: string;
  fin: string;
  estado: string;
  /** Una línea corta de contexto: entregas recibidas, progreso, inscritos. */
  detalle: string | null;
};

export type Familia_Resultado = {
  barras: Barra[];
  /** Filas reales que existen y NO se pudieron dibujar por no tener fechas. */
  sinFechas: number;
};

export type VentanaGantt = {
  periodo_id: string;
  periodo: string;
  inicio: string;
  fin: string;
};

/**
 * El tramo de tiempo que se dibuja: un período.
 *
 * Se elige el pedido; si no llega ninguno o no existe, el que esté activo; y si
 * no hay activo, el más reciente. Un Gantt necesita un principio y un final, y
 * el cuatrimestre es la unidad con la que ya piensa toda la institución —
 * inventar "los próximos tres meses" obligaría a explicar de dónde sale ese
 * número.
 */
export async function ventanaDelGantt(
  periodoId: string | null,
): Promise<VentanaGantt | null> {
  return consultarUna<VentanaGantt>(
    `SELECT p.id AS periodo_id,
            p.nombre AS periodo,
            p.fecha_inicio::text AS inicio,
            p.fecha_fin::text    AS fin
       FROM periodo p
      WHERE $1::uuid IS NULL OR p.id = $1
      ORDER BY (p.id = $1::uuid) DESC NULLS LAST,
               (p.estado = 'activo') DESC,
               p.fecha_inicio DESC
      LIMIT 1`,
    [periodoId],
  );
}

/**
 * Familia 1 — períodos y las materias que cuelgan de ellos.
 *
 * El período va primero y las materias debajo, agrupadas por su nombre. Todas
 * miden lo mismo porque todas duran lo mismo: es la consecuencia de que
 * `materia` no tenga fechas propias, y verlo así es más honesto que repartirlas
 * por el cuatrimestre como si tuvieran horario.
 */
export async function familiaAcademico(
  desde: string,
  hasta: string,
): Promise<Familia_Resultado> {
  const barras = await consultar<Barra>(
    `SELECT p.id::text AS id,
            'periodo' AS clase,
            p.nombre AS titulo,
            NULL::text AS grupo,
            p.fecha_inicio::text AS inicio,
            p.fecha_fin::text    AS fin,
            p.estado,
            p.tipo AS detalle
       FROM periodo p
      WHERE p.fecha_fin >= $1::date AND p.fecha_inicio <= $2::date

      UNION ALL

     SELECT m.id::text,
            'materia',
            m.nombre,
            p.nombre,
            p.fecha_inicio::text,
            p.fecha_fin::text,
            m.estado,
            m.codigo
       FROM materia m
       JOIN periodo p ON p.id = m.periodo_id
      WHERE p.fecha_fin >= $1::date AND p.fecha_inicio <= $2::date

      ORDER BY 4 NULLS FIRST, 3`,
    [desde, hasta],
  );

  const huerfanas = await consultarUna<{ n: number }>(
    `SELECT count(*)::int AS n FROM materia WHERE periodo_id IS NULL`,
  );

  return { barras, sinFechas: huerfanas?.n ?? 0 };
}

/**
 * Familia 2 — tareas y exámenes, de la publicación al vencimiento.
 *
 * Es la familia con fechas de verdad, y la única donde el ancho de la barra
 * significa algo: cuánto tiempo tuvo la gente. El detalle cuenta las entregas
 * recibidas sobre las esperadas, que es lo que convierte una barra en una
 * pregunta ("vence el jueves y van 3 de 20").
 *
 * `material` y `anuncio` no entran: son tipos de `asignacion` que no se
 * entregan, así que no tienen vencimiento ni nada que contar.
 */
export async function familiaTareas(
  desde: string,
  hasta: string,
): Promise<Familia_Resultado> {
  const barras = await consultar<Barra>(
    `SELECT a.id::text AS id,
            a.tipo::text AS clase,
            a.titulo,
            coalesce(mu.nombre, m3.nombre) AS grupo,
            a.fecha_publicacion::date::text AS inicio,
            a.fecha_vencimiento::date::text AS fin,
            a.tipo::text AS estado,
            (SELECT count(*) FILTER (WHERE d.estado IN ('entregado','tarde','calificado'))::text
                    || '/' || count(*)::text
               FROM entrega_estudiante d
              WHERE d.asignacion_id = a.id) AS detalle
       FROM asignacion a
       LEFT JOIN materia     mu ON mu.id = a.materia_id
       LEFT JOIN materia_360 m3 ON m3.id = a.materia_360_id
      WHERE a.tipo IN ('tarea', 'examen')
        AND a.fecha_vencimiento IS NOT NULL
        AND a.fecha_vencimiento::date >= $1::date
        AND a.fecha_publicacion::date <= $2::date
      ORDER BY a.fecha_vencimiento`,
    [desde, hasta],
  );

  const sinFecha = await consultarUna<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM asignacion
      WHERE tipo IN ('tarea', 'examen') AND fecha_vencimiento IS NULL`,
  );

  return { barras, sinFechas: sinFecha?.n ?? 0 };
}

/**
 * Familia 3 — proyectos y las tareas administrativas que cuelgan de ellos.
 *
 * Una tarea empieza en su `fecha_inicio` y, si no la tiene, cuando se creó:
 * `created_at` es la marca real de cuándo entró en la lista de alguien. Es una aproximación y se dice; lo que no se hace es fingir
 * que la tarea empieza el día que vence.
 */
export async function familiaOperaciones(
  desde: string,
  hasta: string,
): Promise<Familia_Resultado> {
  const barras = await consultar<Barra>(
    `SELECT p.id::text AS id,
            'proyecto' AS clase,
            p.nombre AS titulo,
            NULL::text AS grupo,
            p.fecha_inicio::text AS inicio,
            p.fecha_fin::text    AS fin,
            p.estado,
            coalesce(p.progreso, 0)::text || '%' AS detalle
       FROM proyecto p
      WHERE p.fecha_inicio IS NOT NULL
        AND p.fecha_fin IS NOT NULL
        AND p.fecha_fin >= $1::date AND p.fecha_inicio <= $2::date

      UNION ALL

     SELECT t.id::text,
            'tarea',
            t.titulo,
            pr.nombre,
            coalesce(t.fecha_inicio, t.created_at::date)::text,
            t.fecha_limite::text,
            t.estado,
            t.prioridad
       FROM tarea t
       LEFT JOIN proyecto pr ON pr.id = t.proyecto_id
      WHERE t.fecha_limite IS NOT NULL
        AND t.fecha_limite >= $1::date
        AND coalesce(t.fecha_inicio, t.created_at::date) <= $2::date

      ORDER BY 4 NULLS FIRST, 6`,
    [desde, hasta],
  );

  const sinFecha = await consultarUna<{ n: number }>(
    `SELECT (SELECT count(*)::int FROM proyecto
              WHERE fecha_inicio IS NULL OR fecha_fin IS NULL)
          + (SELECT count(*)::int FROM tarea WHERE fecha_limite IS NULL) AS n`,
  );

  return { barras, sinFechas: sinFecha?.n ?? 0 };
}

/**
 * Familia 4 — clases de Global Effect 360.
 *
 * `materia_360` no guarda fechas ni período, así que la barra de cada clase se
 * DEDUCE de los períodos donde tiene inscritos —del primero que empieza al
 * último que acaba—. Es la única pista real que hay, y por eso una clase sin
 * inscritos no aparece: no es que no exista, es que no hay forma de situarla en
 * el tiempo. Va contada en `sinFechas`.
 */
export async function familiaClases360(
  desde: string,
  hasta: string,
): Promise<Familia_Resultado> {
  const barras = await consultar<Barra>(
    `SELECT m.id::text AS id,
            'clase360' AS clase,
            m.nombre AS titulo,
            NULL::text AS grupo,
            min(p.fecha_inicio)::text AS inicio,
            max(p.fecha_fin)::text AS fin,
            CASE WHEN m.activa THEN 'activo' ELSE 'inactiva' END AS estado,
            count(DISTINCT i.estudiante_id)::text AS detalle
       FROM materia_360 m
       JOIN inscripcion_360 i ON i.materia_id = m.id
       JOIN periodo p ON p.id = i.periodo_id
      GROUP BY m.id, m.nombre, m.activa
     HAVING max(p.fecha_fin) >= $1::date AND min(p.fecha_inicio) <= $2::date
      ORDER BY min(p.fecha_inicio), m.nombre`,
    [desde, hasta],
  );

  const sinSituar = await consultarUna<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM materia_360 m
      WHERE NOT EXISTS (SELECT 1 FROM inscripcion_360 i
                         WHERE i.materia_id = m.id)`,
  );

  return { barras, sinFechas: sinSituar?.n ?? 0 };
}

/** Los períodos con fechas, para el selector de tramo. */
export async function periodosDelGantt(): Promise<
  { id: string; nombre: string; estado: string }[]
> {
  return consultar<{ id: string; nombre: string; estado: string }>(
    `SELECT id, nombre, estado
       FROM periodo
      ORDER BY fecha_inicio DESC`,
  );
}

/**
 * Hoy, según la BASE.
 *
 * La marca de "hoy" del diagrama no puede salir de `new Date()` en el proceso:
 * es la misma regla que en períodos —el reloj del dispositivo o del servidor no
 * decide qué día es para la institución—, y aquí además se compara contra
 * fechas que la base calculó.
 */
export async function hoyEnLaBase(): Promise<string> {
  const fila = await consultarUna<{ hoy: string }>(
    `SELECT CURRENT_DATE::text AS hoy`,
  );

  return fila?.hoy ?? "";
}

/**
 * Los límites de TODO lo que hay, para el tramo automático.
 *
 * Existe porque el tramo por período deja fuera casi todo cuando los períodos
 * no cubren el presente —que es exactamente lo que pasa hoy en esta base—. En
 * vez de inventar una ventana ("los próximos 90 días"), el diagrama se ajusta a
 * los datos: del primero que empieza al último que acaba. No hay ningún número
 * elegido a dedo.
 */
export const TRAMO_ABIERTO = { desde: "1900-01-01", hasta: "2999-12-31" } as const;

/** Barra cuya fecha de fin cae ANTES que la de inicio: un dato incoherente. */
export function esIncoherente(barra: Barra): boolean {
  return barra.fin < barra.inicio;
}
