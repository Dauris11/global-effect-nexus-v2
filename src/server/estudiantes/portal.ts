import { cache } from "react";

import { consultar, consultarUna } from "@/lib/db";
import type { TipoEstudiante } from "@/lib/expedientes";
import { esLetra, gpaDe, type Letra, letraDe } from "@/lib/notas";

/**
 * Datos del portal del estudiante.
 *
 * REGLAS DE ESTE ARCHIVO:
 * 1. El estudiante NO tiene acceso a su expediente administrativo.
 *    El expediente son más de 75 campos —historia de vida, situación familiar y
 *    económica, datos de los padres, salud, amonestaciones— y lo redacta y gestiona
 *    el personal administrativo exclusivamente para la Fundación.
 * 2. El portal del estudiante es INDEPENDIENTE de su expediente:
 *    La sesión del estudiante se fundamenta en su usuario (`usuario`), y sus
 *    vistas académicas (materias, notas, aula virtual, 360) están correlacionadas
 *    con los registros cerrados al final de cada cuatrimestre por coordinación,
 *    no en vivo ni dependiendo de que exista un expediente enlazado para operar.
 *    Si un usuario aún no tiene expediente administrativo enlazado, el portal
 *    opera plenamente mostrando estados limpios sin bloquear al estudiante.
 */

export type EstudianteDeSesion = {
  /** Identificador de la ficha administrativa (`estudiante.id`), o `null` si no está enlazada. */
  id: string | null;
  nombre: string;
  tipo: TipoEstudiante;
  estado: string;
  tieneExpediente: boolean;
};

/**
 * Resuelve la sesión del estudiante a partir del usuario autenticado.
 *
 * Busca si existe un expediente enlazado en `estudiante.usuario_id`. Si no
 * existe, devuelve una sesión válida basada en `usuario`, garantizando que el
 * portal del estudiante funcione de forma autónoma e independiente.
 *
 * Va envuelta en `cache()` para deduplicar consultas en la misma petición.
 */
export const estudianteDeUsuario = cache(async function estudianteDeUsuario(
  usuarioId: string,
): Promise<EstudianteDeSesion> {
  const fila = await consultarUna<{
    id: string | null;
    nombre: string;
    tipo: string | null;
    estado: string | null;
  }>(
    `SELECT e.id,
            COALESCE(e.nombre, u.nombre) AS nombre,
            COALESCE(e.tipo::text, 'becado') AS tipo,
            COALESCE(e.estado::text, 'activo') AS estado
       FROM usuario u
       LEFT JOIN estudiante e ON e.usuario_id = u.id
      WHERE u.id = $1`,
    [usuarioId],
  );

  if (!fila) {
    return {
      id: null,
      nombre: "Estudiante",
      tipo: "becado",
      estado: "activo",
      tieneExpediente: false,
    };
  }

  return {
    id: fila.id,
    nombre: fila.nombre,
    tipo: (fila.tipo as TipoEstudiante) ?? "becado",
    estado: fila.estado ?? "activo",
    tieneExpediente: fila.id !== null,
  };
});

export type MateriaInscrita = {
  id: string;
  nombre: string;
  codigo: string | null;
  creditos: number | null;
  horario: string | null;
  aula: string | null;
  profesor: string | null;
  periodo: string;
};

/** Materias del estudiante con inscripción activa. */
export async function materiasInscritas(
  estudianteId: string | null,
): Promise<MateriaInscrita[]> {
  if (!estudianteId) return [];
  return consultar<MateriaInscrita>(
    `SELECT m.id, m.nombre, m.codigo, m.creditos, m.horario, m.aula,
            m.profesor_nombre AS profesor, p.nombre AS periodo
       FROM inscripcion i
       JOIN materia m ON m.id = i.materia_id
       JOIN periodo  p ON p.id = i.periodo_id
      WHERE i.estudiante_id = $1
        AND i.estado = 'activa'
      ORDER BY p.fecha_inicio DESC NULLS LAST, m.nombre`,
    [estudianteId],
  );
}

/** De dónde sale la nota: la materia de 360 o el historial universitario. */
export type OrigenNota = "g360" | "universidad";

export type NotaDelEstudiante = {
  id: string;
  nota: number;
  origen: OrigenNota;
  /** Materia de Global Effect 360 o materia universitaria, según el origen. */
  materia: string;
  periodo: string;
  periodo_id: string;
  /** Letra a mostrar: la guardada si viene y es válida, y si no la de la nota. */
  letra: Letra;
  /** Índice de la fila sobre 4.00, igual: el guardado manda sobre el calculado. */
  gpa: number;
};

/**
 * Notas de la CARRERA del estudiante, agrupables por período.
 *
 * Lee solo `historial_calificacion`: una fila por materia universitaria
 * cerrada, con la letra y el índice ya escritos. Global Effect 360 es OTRO
 * programa y no cuenta para el índice de la carrera (ver la nota de la 0027);
 * sus notas salen de `notas360DelEstudiante`, y quien necesite las dos las pide
 * por separado en vez de recibirlas mezcladas.
 *
 * El índice y la letra del historial se respetan tal como están guardados, no se
 * recalculan: la escala de conversión puede cambiar de un año a otro y eso es lo
 * que dice la migración 0006.
 *
 * Ordena por el NOMBRE del cuatrimestre y no por fecha: un cuatrimestre ya
 * cursado no suele tener fila en `periodo`. El nombre sigue la convención de la
 * 0006 ('2026-I', '2026-II'), así que DESC pone el más reciente primero.
 *
 * `::float8` porque `pg` entrega NUMERIC como texto para no perder precisión, y
 * aquí hace falta un número con el que calcular promedios.
 */
export async function notasDelEstudiante(
  estudianteId: string | null,
): Promise<NotaDelEstudiante[]> {
  if (!estudianteId) return [];
  const filas = await consultar<{
    id: string;
    nota: number;
    origen: OrigenNota;
    materia: string;
    periodo: string;
    periodo_id: string;
    letra: string | null;
    gpa: number | null;
  }>(
    // periodo_id sale del periodo que se llame igual que el cuatrimestre, y solo
    // cae al texto si no existe, para que un cuatrimestre acabe en un único grupo.
    `SELECT h.id::text AS id,
            h.nota_numerica::float8 AS nota,
            'universidad' AS origen,
            h.materia AS materia,
            h.cuatrimestre AS periodo,
            coalesce(p.id::text, h.cuatrimestre) AS periodo_id,
            h.nota_letra AS letra,
            h.gpa::float8 AS gpa
       FROM historial_calificacion h
       LEFT JOIN periodo p ON p.nombre = h.cuatrimestre
      WHERE h.estudiante_id = $1
      ORDER BY h.cuatrimestre DESC, h.materia`,
    [estudianteId],
  );

  return filas.map((fila) => ({
    ...fila,
    letra: esLetra(fila.letra) ? fila.letra : letraDe(fila.nota),
    gpa: fila.gpa ?? gpaDe(fila.nota),
  }));
}

/**
 * Notas de Global Effect 360: `inscripcion_360.nota` de cada materia ya cerrada
 * como `aprobada` o `reprobada`.
 *
 * Una `cursando` con nota provisional no es todavía una calificación, y una
 * `retirada` no tiene nada que calificar. La base guarda el número y nada más,
 * así que letra e índice se calculan con la escala de `lib/notas.ts`; sirven
 * para mostrar, NO para el índice de la carrera.
 */
export async function notas360DelEstudiante(
  estudianteId: string | null,
): Promise<NotaDelEstudiante[]> {
  if (!estudianteId) return [];
  const filas = await consultar<{
    id: string;
    nota: number;
    materia: string;
    periodo: string;
    periodo_id: string;
  }>(
    `SELECT i.id::text AS id,
            i.nota::float8 AS nota,
            m.nombre AS materia,
            p.nombre AS periodo,
            p.id::text AS periodo_id
       FROM inscripcion_360 i
       JOIN materia_360 m ON m.id = i.materia_id
       JOIN periodo     p ON p.id = i.periodo_id
      WHERE i.estudiante_id = $1
        AND i.nota IS NOT NULL
        AND i.estado IN ('aprobada', 'reprobada')
      ORDER BY p.nombre DESC, m.nombre`,
    [estudianteId],
  );

  return filas.map((fila) => ({
    ...fila,
    origen: "g360" as const,
    letra: letraDe(fila.nota),
    gpa: gpaDe(fila.nota),
  }));
}

export type CondicionMes = {
  mes: string;
  hizo_servicio: boolean;
  asistio_reunion: boolean;
};

/**
 * Servicio mensual y asistencia a reuniones de los últimos meses.
 *
 * `notas` de `registro_servicio` queda fuera: es el comentario del equipo sobre
 * el cumplimiento, no un mensaje para el estudiante.
 */
export async function condicionEnLaFundacion(
  estudianteId: string | null,
  meses = 3,
): Promise<CondicionMes[]> {
  if (!estudianteId) return [];
  return consultar<CondicionMes>(
    `SELECT mes, hizo_servicio, asistio_reunion
       FROM registro_servicio
      WHERE estudiante_id = $1
      ORDER BY mes DESC
      LIMIT $2`,
    [estudianteId, meses],
  );
}

export type EventoProximo = {
  id: string;
  titulo: string;
  tipo: string;
  fecha: string;
  hora_inicio: string | null;
  ubicacion: string | null;
};

/** Eventos institucionales próximos, los mismos que ve todo el mundo. */
export async function eventosProximos(limite = 5): Promise<EventoProximo[]> {
  return consultar<EventoProximo>(
    `SELECT id, titulo, tipo, fecha::text AS fecha, hora_inicio, ubicacion
       FROM evento
      WHERE fecha >= CURRENT_DATE
        AND estado <> 'cancelado'
      ORDER BY fecha, hora_inicio NULLS LAST
      LIMIT $1`,
    [limite],
  );
}
