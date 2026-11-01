"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirRol } from "@/lib/auth";
import { consultarUna } from "@/lib/db";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";

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
 * NO HAY TOPE DE CRÉDITOS NI DE CUPOS, y no es un olvido: `materia` no tiene
 * columna de capacidad y no existe ningún máximo de créditos escrito en la base
 * ni en la especificación. Inventar aquí un número sería inventar una norma
 * académica. La pantalla enseña el total de créditos elegidos para que se vea, y
 * quien tenga que ponerle tope lo decide y entonces se implementa.
 */

export type EstadoMatricula = {
  estado:
    | "inicial"
    | "ok"
    | "cerrada"
    | "sin_ficha"
    | "repetida"
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
        LIMIT 1
       ON CONFLICT (estudiante_id, materia_id, periodo_id) DO NOTHING
       RETURNING id`,
      [estudiante.id, materiaId],
    );

    if (!creada) {
      /*
       * No haber escrito nada puede ser dos cosas muy distintas —la ventana
       * cerró, o ya la tenía— y al estudiante hay que decirle cuál. Se
       * distingue con una consulta, no adivinando.
       */
      const yaLaTiene = await consultarUna<{ id: string }>(
        `SELECT i.id
           FROM inscripcion i
          WHERE i.estudiante_id = $1
            AND i.materia_id = $2`,
        [estudiante.id, materiaId],
      );

      return { estado: yaLaTiene ? "repetida" : "cerrada" };
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
      USING ventana_prematricula v
      WHERE i.estudiante_id = $1
        AND i.materia_id = $2
        AND i.estado = 'activa'
        AND v.periodo_id = i.periodo_id
        AND v.activa
        AND now() >= v.abre
        AND now() <  v.cierra
    RETURNING i.id`,
    [estudiante.id, materiaId],
  );

  if (!borrada) {
    // Otra vez dos causas distintas: o la ventana cerró, o la materia ya no
    // está en un estado que el estudiante pueda deshacer.
    const cerrada = await consultarUna<{ estado: string }>(
      `SELECT estado FROM inscripcion
        WHERE estudiante_id = $1 AND materia_id = $2`,
      [estudiante.id, materiaId],
    );

    return {
      estado: cerrada && cerrada.estado !== "activa" ? "bloqueada" : "cerrada",
    };
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
