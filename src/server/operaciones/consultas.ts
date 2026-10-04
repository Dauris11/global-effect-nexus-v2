import { consultar } from "@/lib/db";

/**
 * Operaciones: el tablero de tareas y los proyectos que las agrupan.
 *
 * QUIÉN VE QUÉ TAREA. Aquí es donde `tarea.visibilidad` empieza a significar
 * algo. La columna existe desde la 0009 y hasta ahora no la miraba ninguna
 * pantalla: el calendario enseña las tareas ASIGNADAS a quien mira y punto, sin
 * consultarla. En un tablero de equipo esa regla no sirve —un tablero donde
 * cada uno ve solo lo suyo no es un tablero—, así que:
 *
 *   · `visibilidad = 'todos'`    → la ve cualquiera con `operaciones.leer`.
 *   · `visibilidad = 'asignados'` → solo quien la tiene asignada.
 *   · Con `operaciones.escribir` se ven todas: coordinación gestiona el
 *     conjunto, y un tablero con huecos no se puede coordinar.
 *
 * La condición va en el WHERE y no en el cliente. Filtrar en el navegador
 * significaría mandarle las tareas que no debe ver y confiar en que no mire.
 */

/*
 * Las columnas viven en `@/lib/operaciones` y no aquí: el tablero es cliente y
 * necesita ese valor, y de este archivo solo puede importar tipos —importar un
 * valor le metería el driver `pg` en el navegador—. Ahí está explicado.
 */

export type TareaTablero = {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: string;
  prioridad: string;
  visibilidad: string;
  fecha_limite: string | null;
  proyecto_id: string | null;
  proyecto: string | null;
  /** Nombres de quienes la llevan, ya unidos. Vacío si no hay nadie. */
  asignados: string | null;
  /** Si la fecha límite ya pasó y la tarea sigue abierta. Lo decide la base. */
  vencida: boolean;
};

/**
 * Las tareas del tablero.
 *
 * `cancelada` no entra: el tablero tiene tres columnas y una tarea cancelada no
 * está en ninguna de ellas. Sigue en la base y se ve en el calendario y en los
 * informes; lo que no hace es ocupar sitio en el trabajo del día.
 *
 * Los asignados se agregan con `string_agg` y no con un JOIN suelto: una tarea
 * con tres personas saldría tres veces, y una tarjeta repetida en un tablero es
 * peor que una sin nombres.
 */
export async function tareasDelTablero({
  usuarioId,
  puedeTodo,
}: {
  usuarioId: string;
  /** `operaciones.escribir`: ve el tablero completo. */
  puedeTodo: boolean;
}): Promise<TareaTablero[]> {
  return consultar<TareaTablero>(
    `SELECT t.id,
            t.titulo,
            t.descripcion,
            t.estado,
            coalesce(t.prioridad, 'media') AS prioridad,
            t.visibilidad,
            t.fecha_limite::text AS fecha_limite,
            t.proyecto_id,
            p.nombre AS proyecto,
            (SELECT string_agg(u.nombre, ', ' ORDER BY u.nombre)
               FROM tarea_asignado ta
               JOIN usuario u ON u.id = ta.usuario_id
              WHERE ta.tarea_id = t.id) AS asignados,
            (t.fecha_limite IS NOT NULL
             AND t.fecha_limite < CURRENT_DATE
             AND t.estado IN ('pendiente', 'en_progreso')) AS vencida
       FROM tarea t
       LEFT JOIN proyecto p ON p.id = t.proyecto_id
      WHERE t.estado IN ('pendiente', 'en_progreso', 'completada')
        AND ($2::boolean
             OR t.visibilidad = 'todos'
             OR EXISTS (SELECT 1 FROM tarea_asignado ta
                         WHERE ta.tarea_id = t.id
                           AND ta.usuario_id = $1))
      ORDER BY CASE coalesce(t.prioridad, 'media')
                 WHEN 'urgente' THEN 0
                 WHEN 'alta'    THEN 1
                 WHEN 'media'   THEN 2
                 ELSE 3
               END,
               t.fecha_limite NULLS LAST,
               t.created_at`,
    [usuarioId, puedeTodo],
  );
}

export type ProyectoConAvance = {
  id: string;
  nombre: string;
  descripcion: string | null;
  responsable: string | null;
  estado: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  /** Tareas del proyecto que no están canceladas, y cuántas están hechas. */
  tareas: number;
  hechas: number;
};

/**
 * Los proyectos con su avance REAL.
 *
 * `proyecto.progreso` existe en la tabla y no se usa para esto: es un número
 * que alguien escribió a mano y que se queda viejo en cuanto el equipo cierra
 * una tarea. El avance que se enseña se cuenta —tareas completadas sobre
 * tareas vivas—, que es lo que `admin.newProject.progressHint` ya promete:
 * "el avance se calcula solo".
 *
 * Las canceladas no cuentan en el denominador: si contaran, cancelar una tarea
 * haría BAJAR el avance del proyecto, que es exactamente al revés de lo que
 * significa cancelarla.
 */
export async function proyectosConAvance(): Promise<ProyectoConAvance[]> {
  return consultar<ProyectoConAvance>(
    `SELECT p.id,
            p.nombre,
            p.descripcion,
            p.responsable,
            p.estado,
            p.fecha_inicio::text AS fecha_inicio,
            p.fecha_fin::text    AS fecha_fin,
            (SELECT count(*)::int FROM tarea t
              WHERE t.proyecto_id = p.id AND t.estado <> 'cancelada') AS tareas,
            (SELECT count(*)::int FROM tarea t
              WHERE t.proyecto_id = p.id AND t.estado = 'completada') AS hechas
       FROM proyecto p
      ORDER BY p.estado, p.fecha_fin NULLS LAST, p.nombre`,
  );
}

export type OpcionOperaciones = { id: string; nombre: string };

/** Los proyectos, para el desplegable del formulario de tarea. */
export async function proyectosSimples(): Promise<OpcionOperaciones[]> {
  return consultar<OpcionOperaciones>(
    `SELECT id, nombre
       FROM proyecto
      WHERE estado <> 'completado'
      ORDER BY nombre`,
  );
}

/**
 * A quién se le puede asignar una tarea.
 *
 * Solo cuentas activas, y sin estudiantes: una tarea de operaciones es trabajo
 * del equipo de la Fundación. Un estudiante tiene sus entregas en el aula
 * virtual, que es otra cosa y otra tabla.
 */
export async function usuariosAsignables(): Promise<OpcionOperaciones[]> {
  return consultar<OpcionOperaciones>(
    `SELECT u.id, u.nombre
       FROM usuario u
       JOIN rol r ON r.id = u.rol_id
      WHERE u.activo
        AND r.nombre <> 'estudiante'
      ORDER BY u.nombre`,
  );
}
