"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirRol } from "@/lib/auth";
import { consultarUna } from "@/lib/db";
import { SQL_HOY_RD } from "@/lib/fecha-rd";
import {
  MINIMO_CLASES_UNIVERSITARIO_CUATRIMESTRE,
  topeCreditosDeUniversidad,
} from "@/lib/reglas-academicas";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";
import { parametros } from "@/server/parametros/consultas";

/**
 * Matrícula universitaria del estudiante: elegir sus materias del período.
 *
 * Hasta ahora `/portal/estudiante/prematricula` era de solo lectura y la
 * matrícula la escribía coordinación. Esto la abre al estudiante, con tres
 * reglas que no son negociables:
 *
 * 1. EL ID SALE DE LA SESIÓN, NUNCA DEL FORMULARIO. Aceptar un
 *    `estudiante_id` del navegador permitiría matricular a otra persona. Del
 *    formulario llega solo la materia.
 *
 * 2. LA VENTANA SE COMPRUEBA DENTRO DE LA ESCRITURA, no antes con un `if`. Es
 *    la diferencia entre cerrar la puerta y pedir por favor: entre leer la hora
 *    y escribir la fila pasa un rato, y el borde de la ventana es justo cuando
 *    media promoción está pulsando el botón. El INSERT selecciona de
 *    `ventana_prematricula`; si cerró, no hay fila que seleccionar y no se
 *    escribe nada.
 *
 * 3. LA VENTANA ES LA DEL PERÍODO DE LA MATERIA. Aquí está la diferencia con
 *    Global Effect 360: una materia de 360 no tiene período propio y hereda el
 *    de la ventana, mientras que `materia.periodo_id` sí existe. Así que el
 *    JOIN va por `v.periodo_id = m.periodo_id`, y una ventana abierta para el
 *    cuatrimestre que viene no deja matricularse en materias del anterior.
 *    La tanda de la ventana no importa aquí: la carrera se matricula por
 *    período, y la regla de una materia por tanda es solo de 360.
 *
 * Comparte molde con `@/server/global360/acciones` a propósito: son dos
 * programas con la misma ventana de prematrícula, y si uno la comprobara de
 * otra manera, tarde o temprano uno de los dos la comprobaría mal.
 *
 * 4. TOPE DE CRÉDITOS POR UNIVERSIDAD Y MÍNIMO CUATRIMESTRAL. El máximo de
 *    créditos por período se rige por las pautas de la universidad en la que
 *    estudia el becado (UCATECI, UNPHU, UASD o UTESA), parametrizable en
 *    `/configuracion/parametros`, y se comprueba dentro del propio INSERT. Al
 *    retirarse, si el estudiante es universitario se impide en servidor bajar
 *    del mínimo obligatorio de 2 clases (`MINIMO_CLASES_UNIVERSITARIO_CUATRIMESTRE`)
 *    una vez alcanzado el mínimo o iniciado el período.
 */

export type EstadoMatricula = {
  estado:
    | "inicial"
    | "ok"
    | "cerrada"
    | "sin_ficha"
    | "repetida"
    | "tope_creditos"
    | "minimo_clases"
    | "bloqueada"
    | "invalida"
    | "error";
};

/** Inscribe al estudiante de la sesión en una materia del período abierto. */
export async function inscribirseEnMateria(
  _previo: EstadoMatricula,
  datos: FormData,
): Promise<EstadoMatricula> {
  const usuario = await requerirRol(["estudiante"]);
  const estudiante = await estudianteDeUsuario(usuario.id);

  // Sin filtro por tipo: desde la 0047 todo estudiante es becado, y una
  // comprobación que nunca falla solo esconde dónde está la regla de verdad.
  if (!estudiante.id) return { estado: "sin_ficha" };

  const materiaId = String(datos.get("materia") ?? "");

  if (!esUuid(materiaId)) return { estado: "invalida" };

  const valoresParametros = await parametros();
  const { tope: topeCreditos } = topeCreditosDeUniversidad(
    estudiante.universidad,
    valoresParametros,
  );

  try {
    const creada = await consultarUna<{ id: string }>(
      `INSERT INTO inscripcion (estudiante_id, materia_id, periodo_id)
       SELECT $1, m.id, m.periodo_id
         FROM materia m
         JOIN ventana_prematricula v
           ON v.periodo_id = m.periodo_id
          AND v.activa
          AND now() >= v.abre
          AND now() <  v.cierra
        WHERE m.id = $2
          AND m.estado = 'activa'
          AND (
            SELECT coalesce(sum(coalesce(m2.creditos, 0)), 0)
              FROM inscripcion i2
              JOIN materia m2 ON m2.id = i2.materia_id
             WHERE i2.estudiante_id = $1
               AND i2.periodo_id = m.periodo_id
               AND i2.estado = 'activa'
          ) + coalesce(m.creditos, 0) <= $3
        LIMIT 1
       ON CONFLICT (estudiante_id, materia_id, periodo_id) DO NOTHING
       RETURNING id`,
      [estudiante.id, materiaId, topeCreditos],
    );

    if (!creada) {
      /*
       * No haber escrito nada puede ser tres cosas distintas —ya la tenía,
       * supera el tope de créditos del período o la ventana cerró— y al
       * estudiante hay que decirle cuál con una consulta.
       */
      const causa = await consultarUna<{
        ya_la_tiene: boolean;
        excede_creditos: boolean;
      }>(
        `SELECT EXISTS (
                  SELECT 1
                    FROM inscripcion i
                   WHERE i.estudiante_id = $1
                     AND i.materia_id = $2
                ) AS ya_la_tiene,
                EXISTS (
                  SELECT 1
                    FROM materia m
                    JOIN ventana_prematricula v
                      ON v.periodo_id = m.periodo_id
                     AND v.activa
                     AND now() >= v.abre
                     AND now() <  v.cierra
                   WHERE m.id = $2
                     AND m.estado = 'activa'
                     AND (
                       SELECT coalesce(sum(coalesce(m2.creditos, 0)), 0)
                         FROM inscripcion i2
                         JOIN materia m2 ON m2.id = i2.materia_id
                        WHERE i2.estudiante_id = $1
                          AND i2.periodo_id = m.periodo_id
                          AND i2.estado = 'activa'
                     ) + coalesce(m.creditos, 0) > $3
                ) AS excede_creditos`,
        [estudiante.id, materiaId, topeCreditos],
      );

      if (causa?.ya_la_tiene) return { estado: "repetida" };
      if (causa?.excede_creditos) return { estado: "tope_creditos" };
      return { estado: "cerrada" };
    }

    await registrar({
      usuarioId: usuario.id,
      accion: "matricula.inscrita",
      entidad: "inscripcion",
      entidadId: creada.id,
      datos: { materia: materiaId },
    });
  } catch (error) {
    console.error("[matricula] no se pudo inscribir", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/**
 * Quita una materia, mientras la ventana siga abierta.
 *
 * Solo lo que está `activa`. Una materia ya cerrada —`aprobada`, `reprobada`—
 * o `retirada` no la deshace el estudiante desde su portal: eso es historial
 * académico, y borrarlo es una decisión de coordinación.
 *
 * BORRA LA FILA en vez de marcarla `retirada`, y es lo correcto AQUÍ: mientras
 * la ventana está abierta nadie ha cursado nada todavía, así que quitarse de
 * una materia que se eligió por error no es un abandono que haya que registrar
 * —es corregir el formulario antes de entregarlo—. Dejar un rastro de
 * `retirada` por cada duda llenaría el expediente de bajas que no ocurrieron.
 * Retirarse una vez empezado el período es otra cosa, y esa no pasa por aquí.
 */
export async function quitarseDeMateria(
  _previo: EstadoMatricula,
  datos: FormData,
): Promise<EstadoMatricula> {
  const usuario = await requerirRol(["estudiante"]);
  const estudiante = await estudianteDeUsuario(usuario.id);

  if (!estudiante.id) return { estado: "sin_ficha" };

  const materiaId = String(datos.get("materia") ?? "");

  if (!esUuid(materiaId)) return { estado: "invalida" };

  const borrada = await consultarUna<{ id: string }>(
    `DELETE FROM inscripcion i
      USING ventana_prematricula v, periodo p
      WHERE i.estudiante_id = $1
        AND i.materia_id = $2
        AND i.estado = 'activa'
        AND v.periodo_id = i.periodo_id
        AND p.id = i.periodo_id
        AND v.activa
        AND now() >= v.abre
        AND now() <  v.cierra
        AND (
          NOT $3::boolean
          OR (
            (
              SELECT (SELECT count(*)::int FROM inscripcion ic
                       WHERE ic.estudiante_id = $1
                         AND ic.periodo_id = i.periodo_id
                         AND ic.estado <> 'retirada')
                   + (SELECT count(*)::int FROM inscripcion_360 i3
                       WHERE i3.estudiante_id = $1
                         AND i3.periodo_id = i.periodo_id
                         AND i3.estado <> 'retirada')
            ) > $4
          )
          OR (
            ${SQL_HOY_RD} < p.fecha_inicio
            AND (
              SELECT (SELECT count(*)::int FROM inscripcion ic
                       WHERE ic.estudiante_id = $1
                         AND ic.periodo_id = i.periodo_id
                         AND ic.estado <> 'retirada')
                   + (SELECT count(*)::int FROM inscripcion_360 i3
                       WHERE i3.estudiante_id = $1
                         AND i3.periodo_id = i.periodo_id
                         AND i3.estado <> 'retirada')
            ) < $4
          )
        )
    RETURNING i.id`,
    [
      estudiante.id,
      materiaId,
      estudiante.esUniversitario,
      MINIMO_CLASES_UNIVERSITARIO_CUATRIMESTRE,
    ],
  );

  if (!borrada) {
    // Tres causas posibles: la materia ya no está activa, el estudiante
    // universitario bajaría del mínimo de 2 clases, o la ventana cerró.
    const situacion = await consultarUna<{
      estado: string;
      ventana_abierta: boolean;
      total_clases: number;
      periodo_iniciado: boolean;
    }>(
      `SELECT i.estado,
              EXISTS (
                SELECT 1
                  FROM ventana_prematricula v
                 WHERE v.periodo_id = i.periodo_id
                   AND v.activa
                   AND now() >= v.abre
                   AND now() <  v.cierra
              ) AS ventana_abierta,
              (
                (SELECT count(*)::int FROM inscripcion ic
                  WHERE ic.estudiante_id = $1
                    AND ic.periodo_id = i.periodo_id
                    AND ic.estado <> 'retirada')
                +
                (SELECT count(*)::int FROM inscripcion_360 i3
                  WHERE i3.estudiante_id = $1
                    AND i3.periodo_id = i.periodo_id
                    AND i3.estado <> 'retirada')
              ) AS total_clases,
              (${SQL_HOY_RD} >= p.fecha_inicio) AS periodo_iniciado
         FROM inscripcion i
         JOIN periodo p ON p.id = i.periodo_id
        WHERE i.estudiante_id = $1
          AND i.materia_id = $2`,
      [estudiante.id, materiaId],
    );

    if (situacion && situacion.estado !== "activa") {
      return { estado: "bloqueada" };
    }
    if (
      situacion &&
      situacion.ventana_abierta &&
      estudiante.esUniversitario &&
      situacion.total_clases <= MINIMO_CLASES_UNIVERSITARIO_CUATRIMESTRE &&
      (situacion.periodo_iniciado ||
        situacion.total_clases >= MINIMO_CLASES_UNIVERSITARIO_CUATRIMESTRE)
    ) {
      return { estado: "minimo_clases" };
    }

    return { estado: "cerrada" };
  }

  await registrar({
    usuarioId: usuario.id,
    accion: "matricula.quitada",
    entidad: "inscripcion",
    entidadId: borrada.id,
    datos: { materia: materiaId },
  });

  refrescar();

  return { estado: "ok" };
}

/**
 * Lo que cambia al tocar la matrícula.
 *
 * La prematrícula de administración también, porque coordinación mira esa
 * pantalla mientras la ventana está abierta y necesita ver quién se va
 * apuntando.
 */
function refrescar() {
  revalidatePath("/[locale]/portal/estudiante/prematricula", "page");
  revalidatePath("/[locale]/portal/estudiante", "page");
  revalidatePath("/[locale]/academico/prematricula", "page");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(valor: string): boolean {
  return UUID.test(valor);
}
