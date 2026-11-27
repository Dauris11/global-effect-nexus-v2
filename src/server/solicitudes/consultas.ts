import { consultar, consultarUna } from "@/lib/db";
import { usuarioTienePermiso, type UsuarioConPermisos } from "@/lib/rbac";
import {
  accionesPermitidas,
  type AccionSolicitud,
  type EstadoSolicitud,
  REGLAS,
  TIPOS_SOLICITUD,
} from "@/lib/solicitudes";

/**
 * Lectura de solicitudes (migración 0031).
 *
 * Dos preguntas y nada más: "¿qué espera algo de mí?" (la bandeja de quien
 * revisa) y "¿cómo va lo que pedí?" (el solicitante, sea estudiante o
 * personal). No hay un listado general de todas las solicitudes del sistema: lo
 * cerrado se consulta por quien lo pidió o lo resolvió, no por curiosidad.
 *
 * Las acciones posibles se calculan aquí, con `accionesPermitidas`, y viajan con
 * cada fila. La pantalla no decide qué botón pinta: pinta los que el servidor
 * ya calculó con la misma regla que comprobará al recibir el clic.
 */

export type PasoSolicitud = {
  id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  comentario: string | null;
  usuario: string | null;
  creado: string;
};

/** Datos visibles de la cotización; el archivo se baja por su ruta protegida. */
export type CotizacionSolicitud = {
  nombre: string;
  formato: string;
};

export type FilaSolicitud = {
  id: string;
  folio: number;
  tipo: string;
  estado: string;
  titulo: string;
  detalle: string | null;
  solicitante_id: string | null;
  solicitante: string | null;
  estudiante_id: string | null;
  estudiante: string | null;
  monto: number | null;
  fecha_requerida: string | null;
  hora_preferida: string | null;
  requiere_direccion: boolean;
  aprobo_primer_nivel: string | null;
  responsable: string | null;
  respuesta: string | null;
  creada: string;
  resuelta_en: string | null;
  pasos: PasoSolicitud[];
  /** Solo las compras (0070). La descarga comprueba el acceso en el servidor. */
  cotizacion: CotizacionSolicitud | null;
  /** Lo que quien mira puede hacer ahora mismo. Vacío si nada. */
  acciones: AccionSolicitud[];
};

/**
 * La persona con sus permisos de sesión. Con solo `{ id, rol }` las reglas
 * caían al reparto de fábrica y no a `rol_permiso` + `usuario_permiso`.
 */
type ConPermisos = UsuarioConPermisos & { id: string };

type FilaBase = Omit<FilaSolicitud, "pasos" | "acciones" | "cotizacion"> & {
  cotizacion_nombre: string | null;
  cotizacion_formato: string | null;
};

/**
 * Quién dio el primer visto bueno de lo que está en dirección. Dirección no
 * puede ser la misma persona cuando existe otro director activo que pueda dar
 * el segundo visto bueno; si en la Fundación solo hay un director activo
 * (distinto del solicitante), devuelve NULL para no dejar la solicitud
 * atascada en `pendiente_direccion`.
 */
const APROBO_PRIMER_NIVEL = `(SELECT p.usuario_id
     FROM solicitud_paso p
    WHERE p.solicitud_id = s.id
      AND p.estado_nuevo = 'pendiente_direccion'
      AND EXISTS (
            SELECT 1
              FROM usuario ud
              JOIN permiso pe ON pe.codigo = 'solicitudes.direccion'
             WHERE ud.activo
               AND ud.id IS DISTINCT FROM s.solicitante_id
               AND ud.id IS DISTINCT FROM p.usuario_id
               AND coalesce(
                     (SELECT up.concedido
                        FROM usuario_permiso up
                       WHERE up.usuario_id = ud.id
                         AND up.permiso_id = pe.id),
                     EXISTS (
                       SELECT 1
                         FROM rol_permiso rp
                        WHERE rp.rol_id = ud.rol_id
                          AND rp.permiso_id = pe.id
                     )
                   )
          )
    ORDER BY p.created_at DESC
    LIMIT 1) AS aprobo_primer_nivel`;

const COLUMNAS = `
  s.id,
  s.folio::int AS folio,
  s.tipo,
  s.estado,
  s.titulo,
  s.detalle,
  s.solicitante_id,
  so.nombre AS solicitante,
  s.estudiante_id,
  e.nombre AS estudiante,
  s.monto::float8 AS monto,
  to_char(s.fecha_requerida, 'YYYY-MM-DD') AS fecha_requerida,
  s.hora_preferida,
  s.requiere_direccion,
  ${APROBO_PRIMER_NIVEL},
  re.nombre AS responsable,
  s.respuesta,
  s.created_at::text AS creada,
  s.resuelta_en::text AS resuelta_en,
  ad.nombre AS cotizacion_nombre,
  ad.formato AS cotizacion_formato`;

const ORIGEN = `
  FROM solicitud s
  LEFT JOIN usuario so    ON so.id = s.solicitante_id
  LEFT JOIN usuario re    ON re.id = s.responsable_id
  LEFT JOIN estudiante e  ON e.id  = s.estudiante_id
  LEFT JOIN solicitud_adjunto ad ON ad.solicitud_id = s.id`;

/** La línea de tiempo de varias solicitudes en una sola consulta. */
async function conPasos(
  filas: FilaBase[],
  usuario: ConPermisos,
): Promise<FilaSolicitud[]> {
  if (filas.length === 0) return [];

  const pasos = await consultar<PasoSolicitud & { solicitud_id: string }>(
    `SELECT p.id,
            p.solicitud_id,
            p.estado_anterior,
            p.estado_nuevo,
            p.comentario,
            u.nombre AS usuario,
            p.created_at::text AS creado
       FROM solicitud_paso p
       LEFT JOIN usuario u ON u.id = p.usuario_id
      WHERE p.solicitud_id = ANY($1::uuid[])
      ORDER BY p.created_at`,
    [filas.map((fila) => fila.id)],
  );

  return filas.map(({ cotizacion_nombre, cotizacion_formato, ...fila }) => ({
    ...fila,
    pasos: pasos.filter((paso) => paso.solicitud_id === fila.id),
    cotizacion:
      cotizacion_nombre && cotizacion_formato
        ? { nombre: cotizacion_nombre, formato: cotizacion_formato }
        : null,
    acciones: accionesPermitidas(fila, usuario),
  }));
}

/**
 * Lo que espera una decisión de esta persona.
 *
 * El SQL trae las abiertas de los tipos que su rol revisa, más las que están en
 * dirección si es dirección; el filtro fino —que no sea suya, que el estado
 * admita una acción— lo hace `accionesPermitidas`, que es la regla. Así no hay
 * dos versiones de "qué me toca": una en SQL y otra en TypeScript.
 */
export async function solicitudesPorAtender(
  usuario: ConPermisos,
): Promise<FilaSolicitud[]> {
  const tipos = TIPOS_SOLICITUD.filter((tipo) =>
    usuarioTienePermiso(usuario, REGLAS[tipo].revisa),
  );
  const dirige = usuarioTienePermiso(usuario, "solicitudes.direccion");

  if (tipos.length === 0 && !dirige) return [];

  const filas = await consultar<FilaBase>(
    `SELECT ${COLUMNAS}
       ${ORIGEN}
      WHERE (s.tipo = ANY($1::text[])
             AND s.estado IN ('enviada', 'en_revision', 'aprobada'))
         OR ($2 AND s.estado = 'pendiente_direccion')
      ORDER BY s.created_at
      LIMIT 200`,
    [tipos, dirige],
  );

  const completas = await conPasos(filas, usuario);

  // Cancelar no es "atender": es lo único que puede hacer quien la pidió, y lo
  // hace desde "Mis solicitudes". Sin este filtro, lo propio se colaba en la
  // bandeja de quien también revisa ese tipo.
  return completas.filter((fila) =>
    fila.acciones.some((accion) => accion !== "cancelar"),
  );
}

/** Cuántas esperan a esta persona, para el portal y el resumen. */
export async function cuantasPorAtender(usuario: ConPermisos): Promise<number> {
  return (await solicitudesPorAtender(usuario)).length;
}

/** Lo que pidió esta persona, de lo más reciente a lo más viejo. */
export async function solicitudesDe(usuario: ConPermisos): Promise<FilaSolicitud[]> {
  const filas = await consultar<FilaBase>(
    `SELECT ${COLUMNAS}
       ${ORIGEN}
      WHERE s.solicitante_id = $1
      ORDER BY s.created_at DESC
      LIMIT 100`,
    [usuario.id],
  );

  return conPasos(filas, usuario);
}

/**
 * Lo que ya pasó por las manos de esta persona y está cerrado: el historial
 * de quien revisa. Sin él, una solicitud aprobada desaparece de la bandeja y
 * nadie puede volver a mirar qué se decidió.
 */
export async function resueltasPor(
  usuario: ConPermisos,
  limite = 30,
): Promise<FilaSolicitud[]> {
  const filas = await consultar<FilaBase>(
    `SELECT ${COLUMNAS}
       ${ORIGEN}
      WHERE s.estado IN ('rechazada', 'completada')
        AND EXISTS (SELECT 1 FROM solicitud_paso p
                     WHERE p.solicitud_id = s.id AND p.usuario_id = $1)
        AND s.solicitante_id IS DISTINCT FROM $1
      ORDER BY s.updated_at DESC
      LIMIT $2`,
    [usuario.id, limite],
  );

  return conPasos(filas, usuario);
}

/**
 * Solicitudes del área que esta persona revisa filtradas por un estado
 * concreto (p. ej. para que contabilidad o administración consulten todas las
 * aprobadas, rechazadas, en revisión o completadas de su ámbito).
 */
export async function solicitudesRevisionPorEstado(
  usuario: ConPermisos,
  estado: EstadoSolicitud,
  limite = 100,
): Promise<FilaSolicitud[]> {
  const tipos = TIPOS_SOLICITUD.filter((tipo) =>
    usuarioTienePermiso(usuario, REGLAS[tipo].revisa),
  );
  const dirige = usuarioTienePermiso(usuario, "solicitudes.direccion");

  if (tipos.length === 0 && !dirige) return [];

  const filas = await consultar<FilaBase>(
    `SELECT ${COLUMNAS}
       ${ORIGEN}
      WHERE s.estado = $1
        AND s.solicitante_id IS DISTINCT FROM $4
        AND (s.tipo = ANY($2::text[])
             OR ($3 AND (s.requiere_direccion OR s.estado = 'pendiente_direccion')))
      ORDER BY s.updated_at DESC
      LIMIT $5`,
    [estado, tipos, dirige, usuario.id, limite],
  );

  return conPasos(filas, usuario);
}

/**
 * Conteos para los chips de la bandeja, sin traer las filas.
 *
 * `revision` usa EXACTAMENTE el criterio de `solicitudesRevisionPorEstado` (tipos que
 * el rol revisa, dirección, y nunca lo que pidió la propia persona), agrupado por
 * estado: así el número del chip coincide con las filas que salen al pulsarlo y no
 * se amplía lo que cada rol puede ver. `propias` cuenta lo pedido por la persona.
 */
export async function conteosSolicitudes(usuario: ConPermisos): Promise<{
  revision: Partial<Record<EstadoSolicitud, number>>;
  propias: Partial<Record<EstadoSolicitud, number>>;
}> {
  const tipos = TIPOS_SOLICITUD.filter((tipo) =>
    usuarioTienePermiso(usuario, REGLAS[tipo].revisa),
  );
  const dirige = usuarioTienePermiso(usuario, "solicitudes.direccion");

  const [revision, propias] = await Promise.all([
    tipos.length === 0 && !dirige
      ? Promise.resolve([])
      : consultar<{ estado: EstadoSolicitud; n: number }>(
          `SELECT s.estado, count(*)::int AS n
             FROM solicitud s
            WHERE s.solicitante_id IS DISTINCT FROM $3
              AND (s.tipo = ANY($1::text[])
                   OR ($2 AND (s.requiere_direccion OR s.estado = 'pendiente_direccion')))
            GROUP BY s.estado`,
          [tipos, dirige, usuario.id],
        ),
    consultar<{ estado: EstadoSolicitud; n: number }>(
      `SELECT s.estado, count(*)::int AS n
         FROM solicitud s
        WHERE s.solicitante_id = $1
        GROUP BY s.estado`,
      [usuario.id],
    ),
  ]);

  const aMapa = (filas: { estado: EstadoSolicitud; n: number }[]) =>
    Object.fromEntries(filas.map((f) => [f.estado, f.n])) as Partial<
      Record<EstadoSolicitud, number>
    >;

  return { revision: aMapa(revision), propias: aMapa(propias) };
}

/** Una sola, con lo justo para que la acción decida. */
export async function solicitudParaFlujo(id: string) {
  return consultarUna<{
    id: string;
    folio: number;
    tipo: string;
    estado: string;
    titulo: string;
    solicitante_id: string | null;
    estudiante_id: string | null;
    requiere_direccion: boolean;
    aprobo_primer_nivel: string | null;
  }>(
    `SELECT s.id, s.folio::int AS folio, s.tipo, s.estado, s.titulo,
            s.solicitante_id, s.estudiante_id, s.requiere_direccion, ${APROBO_PRIMER_NIVEL}
       FROM solicitud s
      WHERE s.id = $1`,
    [id],
  );
}

/** La cotización de una solicitud, para decidir si se puede entregar el archivo. */
export async function cotizacionDeSolicitud(solicitudId: string) {
  return consultarUna<{
    ruta: string;
    nombre: string;
    solicitante_id: string | null;
  }>(
    `SELECT a.ruta, a.nombre, s.solicitante_id
       FROM solicitud_adjunto a
       JOIN solicitud s ON s.id = a.solicitud_id
      WHERE a.solicitud_id = $1`,
    [solicitudId],
  );
}

export type EstudianteOpcion = { id: string; nombre: string; estado: string };

/**
 * Estudiantes que se pueden nombrar en una solicitud interna.
 *
 * Con su estado, porque el formulario necesita los dos lados: el alta es para
 * candidatos del embudo y la beca para quien ya estudia.
 *
 * `soloEmbudo` es para quien no tiene `expedientes.leer` —Habitudes—: ese rol
 * solo conoce a sus candidatos, y la lista viaja entera al HTML aunque el
 * formulario la filtre después. Filtrar en el navegador no es control de
 * acceso; el recorte va aquí.
 */
export async function estudiantesParaSolicitud(
  soloEmbudo: boolean,
): Promise<EstudianteOpcion[]> {
  return consultar<EstudianteOpcion>(
    `SELECT id, nombre, estado::text AS estado
       FROM estudiante
      WHERE NOT $1
         OR estado IN ('reclutado', 'postulado', 'academia_liderazgo')
      ORDER BY nombre
      LIMIT 1000`,
    [soloEmbudo],
  );
}
