"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirRol } from "@/lib/auth";
import { consultarUna } from "@/lib/db";
import {
  MAXIMO_ENTREGA,
  subirEntrega,
  TIPOS_ENTREGA,
} from "@/lib/supabase/almacen";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";

/**
 * El estudiante entrega una tarea.
 *
 * El estado va a `entregado`, en masculino, que es lo que dice el ENUM
 * `estado_entrega` de la migración 0023: sus valores son `pendiente`,
 * `entregado`, `calificado` y `tarde`. Escribir `entregada` habría fallado en la
 * base al primer intento.
 *
 * Sube un PDF —o una foto de un trabajo en papel— y la entrega pasa a
 * `entregada`, esperando revisión del profesor. Es lo que faltaba del aula
 * virtual: hasta ahora la pantalla mostraba el estado que anotaba el docente a
 * mano, porque no había dónde poner el archivo.
 *
 * Tres cosas que no se ven leyendo el formulario:
 *
 * - El estudiante sale de la SESIÓN, no del formulario. Aceptar un id
 *   permitiría entregar en nombre de otro.
 *
 * - La tarea tiene que ser de una unidad en la que el estudiante esté. Se
 *   comprueba en el propio SELECT, contra las tres vías posibles: su matrícula
 *   universitaria, su curso técnico o su inscripción de 360. Sin eso, con el id
 *   de una tarea ajena se podría entregar en una clase en la que no está.
 *
 * - Una tarea vencida SÍ admite entrega, y a propósito: lo que decide si cuenta
 *   es el profesor al revisarla, no el reloj. Lo que sí queda es la fecha, que
 *   es lo que le permite ver que llegó tarde.
 */

export type EstadoEntrega = {
  estado:
    | "inicial"
    | "ok"
    | "sin_ficha"
    | "no_es_tuya"
    | "sin_archivo"
    | "tipo_invalido"
    | "muy_grande"
    | "error";
};

export async function entregarTarea(
  _previo: EstadoEntrega,
  datos: FormData,
): Promise<EstadoEntrega> {
  const usuario = await requerirRol(["estudiante"]);
  const estudiante = await estudianteDeUsuario(usuario.id);

  if (!estudiante) return { estado: "sin_ficha" };

  const asignacionId = String(datos.get("asignacion") ?? "");
  const archivo = datos.get("archivo");

  if (!esUuid(asignacionId)) return { estado: "no_es_tuya" };

  if (!(archivo instanceof File) || archivo.size === 0) {
    return { estado: "sin_archivo" };
  }
  if (!(TIPOS_ENTREGA as readonly string[]).includes(archivo.type)) {
    return { estado: "tipo_invalido" };
  }
  if (archivo.size > MAXIMO_ENTREGA) return { estado: "muy_grande" };

  /*
   * ¿Es una tarea de una clase de este estudiante? Las tres vías, en un solo
   * SELECT. Si no encaja en ninguna, se responde lo mismo que si la tarea no
   * existiera: quien prueba ids ajenos no debe distinguir un caso del otro.
   */
  const suya = await consultarUna<{ id: string }>(
    `SELECT a.id
       FROM asignacion a
      WHERE a.id = $1
        AND (
          -- Materia universitaria en la que está matriculado
          EXISTS (SELECT 1 FROM inscripcion i
                   WHERE i.materia_id = a.materia_id
                     AND i.estudiante_id = $2
                     AND i.estado = 'activa')
          -- Curso técnico en el que tiene calificaciones
          OR EXISTS (SELECT 1 FROM calificacion c
                      WHERE c.curso_id = a.curso_id
                        AND c.estudiante_id = $2)
          -- Materia de Global Effect 360 que lleva
          OR EXISTS (SELECT 1 FROM inscripcion_360 t
                      WHERE t.materia_id = a.materia_360_id
                        AND t.estudiante_id = $2
                        AND t.estado IN ('prematriculada', 'cursando'))
        )`,
    [asignacionId, estudiante.id],
  );

  if (!suya) return { estado: "no_es_tuya" };

  const extension =
    archivo.type === "application/pdf"
      ? "pdf"
      : archivo.type === "image/png"
        ? "png"
        : "jpg";

  const subida = await subirEntrega(
    // Ruta con ids de la base, nunca con el nombre del archivo que subió.
    `entregas/${asignacionId}/${estudiante.id}.${extension}`,
    archivo,
  );

  if (!subida.ok) return { estado: "error" };

  try {
    await consultarUna(
      `INSERT INTO entrega_estudiante
              (asignacion_id, estudiante_id, estado, archivo_url, fecha_entrega)
       VALUES ($1, $2, 'entregado', $3, now())
       ON CONFLICT (asignacion_id, estudiante_id) DO UPDATE
          SET estado = 'entregado',
              archivo_url = EXCLUDED.archivo_url,
              fecha_entrega = now(),
              -- Una entrega nueva anula la revisión anterior: si volvió a
              -- entregar, lo que había revisado el profesor ya no es lo que hay.
              calificacion = NULL,
              comentario_profesor = NULL,
              revisada_por_id = NULL,
              revisada_en = NULL
       RETURNING id`,
      [asignacionId, estudiante.id, subida.ruta],
    );

    await registrar({
      usuarioId: usuario.id,
      accion: "tarea.entregada",
      entidad: "entrega_estudiante",
      entidadId: asignacionId,
    });
  } catch (error) {
    console.error("[aula] no se pudo registrar la entrega", error);
    return { estado: "error" };
  }

  revalidatePath("/[locale]/portal/estudiante/aula-virtual", "page");
  revalidatePath("/[locale]/portal/estudiante/global-360", "page");

  return { estado: "ok" };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(valor: string): boolean {
  return UUID.test(valor);
}
