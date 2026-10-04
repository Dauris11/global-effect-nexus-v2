import { consultar, consultarUna } from "@/lib/db";
import type { Rol } from "@/lib/rbac";
import { tienePermiso } from "@/lib/rbac";
import {
  accionesPermitidas,
  type AccionSolicitud,
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
  responsable: string | null;
  respuesta: string | null;
  creada: string;
  resuelta_en: string | null;
  pasos: PasoSolicitud[];
  /** Lo que quien mira puede hacer ahora mismo. Vacío si nada. */
  acciones: AccionSolicitud[];
};

type FilaBase = Omit<FilaSolicitud, "pasos" | "acciones">;

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
  re.nombre AS responsable,
  s.respuesta,
  s.created_at::text AS creada,
  s.resuelta_en::text AS resuelta_en`;

const ORIGEN = `
  FROM solicitud s
  LEFT JOIN usuario so    ON so.id = s.solicitante_id
  LEFT JOIN usuario re    ON re.id = s.responsable_id
  LEFT JOIN estudiante e  ON e.id  = s.estudiante_id`;

/** La línea de tiempo de varias solicitudes en una sola consulta. */
async function conPasos(
  filas: FilaBase[],
  usuario: { id: string; rol: Rol },
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

  return filas.map((fila) => ({
    ...fila,
    pasos: pasos.filter((paso) => paso.solicitud_id === fila.id),
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
export async function solicitudesPorAtender(usuario: {
  id: string;
  rol: Rol;
}): Promise<FilaSolicitud[]> {
  const tipos = TIPOS_SOLICITUD.filter((tipo) =>
    tienePermiso(usuario.rol, REGLAS[tipo].revisa),
  );
  const dirige = tienePermiso(usuario.rol, "solicitudes.direccion");

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
export async function cuantasPorAtender(usuario: {
  id: string;
  rol: Rol;
}): Promise<number> {
  return (await solicitudesPorAtender(usuario)).length;
}

/** Lo que pidió esta persona, de lo más reciente a lo más viejo. */
export async function solicitudesDe(usuario: {
  id: string;
  rol: Rol;
}): Promise<FilaSolicitud[]> {
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
  usuario: { id: string; rol: Rol },
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

/** Una sola, con lo justo para que la acción decida. */
export async function solicitudParaFlujo(id: string) {
  return consultarUna<{
    id: string;
    folio: number;
    tipo: string;
    estado: string;
    titulo: string;
    solicitante_id: string | null;
    requiere_direccion: boolean;
  }>(
    `SELECT id, folio::int AS folio, tipo, estado, titulo, solicitante_id,
            requiere_direccion
       FROM solicitud
      WHERE id = $1`,
    [id],
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
         OR estado IN ('reclutado', 'postulado', 'academia_liderazgo', 'standby_tecnico')
      ORDER BY nombre
      LIMIT 1000`,
    [soloEmbudo],
  );
}
