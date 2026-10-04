import { cache } from "react";

import { consultar, consultarUna } from "@/lib/db";
import { esLetra, gpaDe, type Letra, letraDe } from "@/lib/notas";

/**
 * Datos del portal del estudiante.
 *
 * REGLA DE ESTE ARCHIVO: el estudiante NO tiene acceso a su expediente.
 *
 * El expediente son 75 campos —historia de vida, situación familiar y
 * económica, datos de los padres, salud, amonestaciones— y lo redacta el equipo de la Fundación PARA la Fundación. Que el
 * estudiante lo lea cambiaría lo que se escribe en él, y con eso perdería su
 * utilidad.
 *
 * De la tabla `estudiante` solo se leen aquí los campos que el propio
 * estudiante ya conoce de sí mismo: su nombre, si es becado y si está activo.
 * Ninguna consulta de este archivo toca `familiar`, `perfil_vivienda`,
 * `perfil_salud` ni `perfil_socioeconomico`.
 *
 * Y todas filtran por `estudiante_id`, que se obtiene del usuario de la sesión:
 * nunca de un parámetro de la URL, o cualquiera podría leer las notas de otro
 * cambiando un identificador.
 */

export type EstudianteDeSesion = {
  id: string;
  nombre: string;
  tipo: "regular" | "becado";
  estado: string;
};

/**
 * Localiza la ficha del estudiante a partir del usuario de la sesión.
 *
 * Devuelve `null` cuando el usuario existe pero nadie lo ha enlazado todavía a
 * una ficha (`estudiante.usuario_id`). No es un error: el portal lo explica y
 * remite a coordinación, tal como prevé `studentPortal.noRecord`.
 *
 * Va envuelta en `cache()` porque ahora la piden dos sitios en la misma
 * petición: el layout del portal, que necesita el tipo de estudiante para
 * armar el menú, y la propia pantalla. Sin esto serían dos consultas idénticas
 * a la base por cada página que abre un estudiante.
 */
export const estudianteDeUsuario = cache(async function estudianteDeUsuario(
  usuarioId: string,
): Promise<EstudianteDeSesion | null> {
  const fila = await consultarUna<{
    id: string;
    nombre: string;
    tipo: string;
    estado: string;
  }>(
    `SELECT e.id, e.nombre, e.tipo::text AS tipo, e.estado::text AS estado
       FROM estudiante e
      WHERE e.usuario_id = $1`,
    [usuarioId],
  );

  if (!fila) return null;

  return {
    id: fila.id,
    nombre: fila.nombre,
    tipo: fila.tipo === "becado" ? "becado" : "regular",
    estado: fila.estado,
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
  estudianteId: string,
): Promise<MateriaInscrita[]> {
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

export type NotaDelEstudiante = {
  id: string;
  nota: number;
  /**
   * Tipo de evaluación en la vía del curso técnico. En la del historial
   * universitario no existe tal cosa —cada fila es la nota cerrada de una
   * materia— y se declara `final`, que es la etiqueta que ya describe eso.
   */
  tipo_evaluacion: string;
  /** Curso técnico o materia, según de dónde venga la fila. */
  curso: string;
  periodo: string;
  periodo_id: string;
  /** Letra a mostrar: la guardada si viene y es válida, y si no la de la nota. */
  letra: Letra;
  /** Índice de la fila sobre 4.00, igual: el guardado manda sobre el calculado. */
  gpa: number;
};

/**
 * Notas del estudiante, agrupables por período.
 *
 * Lee LAS DOS vías, porque hay dos clases de estudiante y cada una guarda sus
 * notas en otra tabla:
 *
 *   - Curso técnico → `calificacion` → `curso`, una fila por evaluación.
 *   - Universitario → `historial_calificacion`, una fila por materia cerrada,
 *     con la letra y el índice ya escritos.
 *
 * Antes solo leía la primera, y al becado universitario la pantalla de
 * calificaciones le salía vacía aunque tuviera historial completo.
 *
 * Un estudiante normalmente está en una sola vía y la otra devuelve cero filas,
 * así que se unen en vez de elegir por `tipo`: si alguien tiene registros en las
 * dos —un técnico que pasa a becado— las ve todas, y la consulta no depende de
 * que `estudiante.tipo` esté bien puesto.
 *
 * El índice y la letra del historial se respetan tal como están guardados, no se
 * recalculan: la escala de conversión puede cambiar de un año a otro y eso es lo
 * que dice la migración 0006. Solo se completan cuando faltan, que es el caso de
 * la vía del curso técnico, donde la base guarda el número y nada más.
 *
 * `::float8` porque `pg` entrega NUMERIC como texto para no perder precisión, y
 * aquí hace falta un número con el que calcular promedios.
 *
 * No se trae `observaciones`: las escribe el docente como nota interna de la
 * evaluación y no forma parte de lo que el estudiante consulta.
 */
export async function notasDelEstudiante(
  estudianteId: string,
): Promise<NotaDelEstudiante[]> {
  const filas = await consultar<{
    id: string;
    nota: number;
    tipo_evaluacion: string;
    curso: string;
    periodo: string;
    periodo_id: string;
    letra: string | null;
    gpa: number | null;
  }>(
    // El ORDEN va fuera de la unión, sobre las dos mitades a la vez, y ordena
    // por el NOMBRE del período, no por su fecha de inicio. La fecha parece la
    // clave natural y no sirve aquí: el historial universitario solo la tiene
    // cuando su cuatrimestre coincide por nombre con una fila de `periodo`, y
    // lo normal es que no coincida —son cuatrimestres ya cursados, anteriores
    // a los períodos que la plataforma abre—. Con la fecha, un '2025-II' sin
    // período caía por detrás de un '2025-I' que sí lo tenía. El nombre sigue
    // la convención que fija la 0006 ('2026-I', '2026-II'), es único, y ordena
    // igual a las dos mitades: DESC pone el más reciente primero.
    `SELECT q.id, q.nota, q.tipo_evaluacion, q.curso, q.periodo, q.periodo_id,
            q.letra, q.gpa
       FROM (
              SELECT c.id::text AS id,
                     c.nota::float8 AS nota,
                     c.tipo_evaluacion::text AS tipo_evaluacion,
                     cu.nombre AS curso,
                     p.nombre AS periodo,
                     p.id::text AS periodo_id,
                     NULL::text AS letra,
                     NULL::float8 AS gpa
                FROM calificacion c
                JOIN curso   cu ON cu.id = c.curso_id
                JOIN periodo p  ON p.id  = c.periodo_id
               WHERE c.estudiante_id = $1

              UNION ALL

              -- periodo_id sale del periodo que se llame igual que el
              -- cuatrimestre, y solo cae al texto si no existe: así una nota de
              -- las dos vías en el mismo cuatrimestre acaba en un único grupo.
              SELECT h.id::text AS id,
                     h.nota_numerica::float8 AS nota,
                     'final' AS tipo_evaluacion,
                     h.materia AS curso,
                     h.cuatrimestre AS periodo,
                     coalesce(p.id::text, h.cuatrimestre) AS periodo_id,
                     h.nota_letra AS letra,
                     h.gpa::float8 AS gpa
                FROM historial_calificacion h
                LEFT JOIN periodo p ON p.nombre = h.cuatrimestre
               WHERE h.estudiante_id = $1
            ) q
      ORDER BY q.periodo DESC, q.curso`,
    [estudianteId],
  );

  return filas.map((fila) => ({
    ...fila,
    letra: esLetra(fila.letra) ? fila.letra : letraDe(fila.nota),
    gpa: fila.gpa ?? gpaDe(fila.nota),
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
  estudianteId: string,
  meses = 3,
): Promise<CondicionMes[]> {
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
