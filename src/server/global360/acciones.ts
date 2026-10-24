"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirPermiso, requerirRol } from "@/lib/auth";
import { consultarUna, enTransaccion } from "@/lib/db";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";

/**
 * Global Effect 360: matrícula del estudiante y administración del programa.
 *
 * Dos puertas distintas y conviene no confundirlas:
 *
 *   · El estudiante se matricula a SÍ MISMO. El id no viene del formulario,
 *     sale de su sesión: aceptarlo permitiría matricular a otro.
 *   · Administración configura la ventana y el catálogo, con
 *     `academico.escribir`.
 *
 * Es la ÚNICA vía de matrícula en 360: el portal entero la usa, para que la
 * regla de una materia por tanda viva en un solo sitio y no en dos copias que
 * acaben discrepando.
 */

export type EstadoPrematricula = {
  estado:
    | "inicial"
    | "ok"
    | "cerrada"
    | "sin_ficha"
    | "repetida"
    | "ya_aprobada"
    | "ya_tiene_materia_en_tanda"
    | "sin_cupo"
    | "invalida"
    | "error";
};

/** Código de Postgres para la violación de un índice o restricción única. */
const VIOLACION_UNICA = "23505";
const INDICE_UNA_POR_TANDA = "uq_inscripcion_360_una_por_tanda";

/**
 * Matricula al estudiante de la sesión en una materia, en la tanda que tenga
 * abierta la ventana.
 *
 * La tanda la pone la ventana, nunca el navegador: si el formulario la
 * eligiera, bastaría cambiar un número para colarse en la tanda que no toca.
 *
 * Todo pasa en una transacción con la materia bloqueada (`FOR UPDATE`), para
 * que dos estudiantes no se lleven a la vez el último cupo. La comprobación de
 * "ya tienes materia en esta tanda" se hace antes del INSERT para dar un
 * mensaje claro, pero quien la garantiza es el índice único parcial: dos clics
 * a la vez en dos materias pasarían cualquier `SELECT` previo.
 */
export async function prematricular(
  _previo: EstadoPrematricula,
  datos: FormData,
): Promise<EstadoPrematricula> {
  const usuario = await requerirRol(["estudiante"]);
  const estudiante = await estudianteDeUsuario(usuario.id);

  if (!estudiante) return { estado: "sin_ficha" };

  const materiaId = String(datos.get("materia") ?? "");

  if (!esUuid(materiaId)) return { estado: "invalida" };

  try {
    const resultado = await enTransaccion<
      EstadoPrematricula | { estado: "creada"; id: string; ronda: number }
    >(async (cliente) => {
      // Dentro de la transacción `now()` es fijo, así que la ventana que se lee
      // aquí es la misma que valdría dentro del INSERT.
      const { rows: ventanas } = await cliente.query<{
        periodo_id: string;
        ronda: number;
      }>(
        `SELECT periodo_id, ronda
           FROM ventana_prematricula
          WHERE activa AND now() >= abre AND now() < cierra
          ORDER BY abre
          LIMIT 1`,
      );
      const ventana = ventanas[0];

      if (!ventana) return { estado: "cerrada" };

      const { rows: materias } = await cliente.query<{
        cupo_maximo: number;
      }>(
        `SELECT coalesce(cupo_maximo, 30)::int AS cupo_maximo
           FROM materia_360
          WHERE id = $1 AND activa
          FOR UPDATE`,
        [materiaId],
      );

      if (!materias[0]) return { estado: "invalida" };

      const { rows: previas } = await cliente.query<{
        materia_id: string;
        periodo_id: string;
        ronda: number;
        estado: string;
      }>(
        `SELECT materia_id, periodo_id, ronda, estado
           FROM inscripcion_360
          WHERE estudiante_id = $1
            AND estado <> 'retirada'
            AND (materia_id = $2 OR (periodo_id = $3 AND ronda = $4))`,
        [estudiante.id, materiaId, ventana.periodo_id, ventana.ronda],
      );

      // Una aprobada no se repite: ya cuenta para el programa.
      if (previas.some((p) => p.materia_id === materiaId && p.estado === "aprobada")) {
        return { estado: "ya_aprobada" };
      }
      if (
        previas.some(
          (p) => p.materia_id === materiaId && p.periodo_id === ventana.periodo_id,
        )
      ) {
        return { estado: "repetida" };
      }
      if (
        previas.some(
          (p) => p.periodo_id === ventana.periodo_id && p.ronda === ventana.ronda,
        )
      ) {
        return { estado: "ya_tiene_materia_en_tanda" };
      }

      const { rows: ocupacion } = await cliente.query<{ ocupado: number }>(
        `SELECT count(*)::int AS ocupado
           FROM inscripcion_360
          WHERE materia_id = $1
            AND estado IN ('prematriculada', 'cursando')`,
        [materiaId],
      );

      if (ocupacion[0].ocupado >= materias[0].cupo_maximo) {
        return { estado: "sin_cupo" };
      }

      // Si hay una fila `retirada` de esta materia en este período, se
      // reaprovecha: la restricción (estudiante, materia, período) no deja
      // escribir otra, y retirarse no debe impedir volver a elegirla.
      const { rows: creadas } = await cliente.query<{ id: string }>(
        `INSERT INTO inscripcion_360 (estudiante_id, materia_id, periodo_id, ronda)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (estudiante_id, materia_id, periodo_id)
         DO UPDATE SET estado = 'prematriculada',
                       ronda = EXCLUDED.ronda,
                       nota = NULL,
                       updated_at = now()
               WHERE inscripcion_360.estado = 'retirada'
         RETURNING id`,
        [estudiante.id, materiaId, ventana.periodo_id, ventana.ronda],
      );

      if (!creadas[0]) return { estado: "repetida" };

      return { estado: "creada", id: creadas[0].id, ronda: ventana.ronda };
    });

    if (resultado.estado !== "creada") return resultado;

    await registrar({
      usuarioId: usuario.id,
      accion: "360.prematriculada",
      entidad: "inscripcion_360",
      entidadId: resultado.id,
      datos: { materia: materiaId, ronda: resultado.ronda },
    });
  } catch (error) {
    if (esViolacionUnica(error)) {
      return {
        estado:
          error.constraint === INDICE_UNA_POR_TANDA
            ? "ya_tiene_materia_en_tanda"
            : "repetida",
      };
    }

    console.error("[360] no se pudo prematricular", error);
    return { estado: "error" };
  }

  refrescarEstudiante();

  return { estado: "ok" };
}

/**
 * Retira una prematrícula, mientras siga abierta la ventana de SU tanda.
 *
 * Solo la tanda abierta: retirar la de la otra dejaría un hueco que el
 * estudiante ya no podría llenar hasta que se abriera su ventana. Borrar la
 * fila libera la tanda para elegir otra.
 */
export async function retirarPrematricula(
  _previo: EstadoPrematricula,
  datos: FormData,
): Promise<EstadoPrematricula> {
  const usuario = await requerirRol(["estudiante"]);
  const estudiante = await estudianteDeUsuario(usuario.id);

  if (!estudiante) return { estado: "sin_ficha" };

  const materiaId = String(datos.get("materia") ?? "");

  if (!esUuid(materiaId)) return { estado: "invalida" };

  // Solo lo prematriculado, nunca lo que ya está cursando o aprobado: eso no lo
  // deshace el estudiante desde su portal.
  const borrada = await consultarUna<{ id: string }>(
    `DELETE FROM inscripcion_360 i
      USING ventana_prematricula v
      WHERE i.estudiante_id = $1
        AND i.materia_id = $2
        AND i.estado = 'prematriculada'
        AND v.periodo_id = i.periodo_id
        AND v.ronda = i.ronda
        AND v.activa
        AND now() >= v.abre
        AND now() <  v.cierra
    RETURNING i.id`,
    [estudiante.id, materiaId],
  );

  if (!borrada) return { estado: "cerrada" };

  await registrar({
    usuarioId: usuario.id,
    accion: "360.retirada",
    entidad: "inscripcion_360",
    entidadId: borrada.id,
    datos: { materia: materiaId },
  });

  refrescarEstudiante();

  return { estado: "ok" };
}

export type EstadoAdmin360 = {
  estado:
    | "inicial"
    | "ok"
    | "nombre_vacio"
    | "fechas_invalidas"
    | "ronda_invalida"
    | "ventana_solapada"
    | "no_encontrada"
    | "error";
};

/** Alta o edición de una materia del catálogo. Con `id` vacío, es un alta. */
export async function guardarMateria360(
  _previo: EstadoAdmin360,
  datos: FormData,
): Promise<EstadoAdmin360> {
  const admin = await requerirPermiso("academico.escribir");

  const id = String(datos.get("id") ?? "").trim();
  const nombre = String(datos.get("nombre") ?? "").trim().slice(0, 160);
  const codigo = String(datos.get("codigo") ?? "").trim().slice(0, 24) || null;
  const creditos = Number(datos.get("creditos") ?? 0);
  const horas = Number(datos.get("horas") ?? 0);

  if (!nombre) return { estado: "nombre_vacio" };
  if (id && !esUuid(id)) return { estado: "no_encontrada" };

  try {
    if (id) {
      const editada = await consultarUna<{ id: string }>(
        `UPDATE materia_360
            SET nombre = $2, codigo = $3,
                creditos = $4, horas = NULLIF($5, 0)
          WHERE id = $1
        RETURNING id`,
        [id, nombre, codigo, creditos, horas],
      );

      if (!editada) return { estado: "no_encontrada" };

      await anotar(admin.id, "360.materia_editada", editada.id, { nombre });
    } else {
      // `orden` al final del catálogo, como los anuncios del hero: con el
      // DEFAULT 0 cada materia nueva se colaría delante de las demás.
      const creada = await consultarUna<{ id: string }>(
        `INSERT INTO materia_360 (nombre, codigo, creditos, horas, orden)
         VALUES ($1, $2, $3, NULLIF($4, 0),
                 coalesce((SELECT max(orden) + 1 FROM materia_360), 0))
         RETURNING id`,
        [nombre, codigo, creditos, horas],
      );

      if (!creada) return { estado: "error" };

      await anotar(admin.id, "360.materia_creada", creada.id, { nombre });
    }
  } catch (error) {
    console.error("[360] no se pudo guardar la materia", error);
    return { estado: "error" };
  }

  refrescarAdmin();

  return { estado: "ok" };
}

/** Saca o devuelve una materia al catálogo. No la borra: hay inscripciones. */
export async function alternarMateria360(
  _previo: EstadoAdmin360,
  datos: FormData,
): Promise<EstadoAdmin360> {
  const admin = await requerirPermiso("academico.escribir");

  const id = String(datos.get("id") ?? "");
  const activar = String(datos.get("activar") ?? "") === "1";

  if (!esUuid(id)) return { estado: "no_encontrada" };

  const cambiada = await consultarUna<{ id: string }>(
    `UPDATE materia_360 SET activa = $2
      WHERE id = $1 AND activa <> $2
    RETURNING id`,
    [id, activar],
  );

  if (!cambiada) return { estado: "no_encontrada" };

  await anotar(
    admin.id,
    activar ? "360.materia_activada" : "360.materia_retirada",
    cambiada.id,
  );

  refrescarAdmin();

  return { estado: "ok" };
}

/**
 * Abre una ventana de prematrícula para una tanda (1 o 2) de un período.
 *
 * La tanda es obligatoria porque es lo que decide en qué hueco cae cada
 * matrícula. Al guardar se desactiva la ventana anterior de la MISMA tanda y
 * período, en la misma transacción; la de la otra tanda se respeta, para poder
 * dejar programada la segunda mientras corre la primera.
 *
 * Dos ventanas del mismo período que se pisen en el tiempo se rechazan: con las
 * dos abiertas, la matrícula no sabría a qué tanda mandar al estudiante.
 */
export async function guardarVentana(
  _previo: EstadoAdmin360,
  datos: FormData,
): Promise<EstadoAdmin360> {
  const admin = await requerirPermiso("academico.escribir");

  const periodoId = String(datos.get("periodo") ?? "");
  const abre = String(datos.get("abre") ?? "");
  const cierra = String(datos.get("cierra") ?? "");
  const mensaje = String(datos.get("mensaje") ?? "").trim().slice(0, 280) || null;
  const ronda = Number(datos.get("ronda") ?? 0);

  if (!esUuid(periodoId)) return { estado: "no_encontrada" };
  if (ronda !== 1 && ronda !== 2) return { estado: "ronda_invalida" };
  if (!abre || !cierra || new Date(cierra) <= new Date(abre)) {
    return { estado: "fechas_invalidas" };
  }

  try {
    const id = await enTransaccion(async (cliente) => {
      // Antes de escribir nada, porque salir de la transacción con `return` la
      // confirma. La de la misma tanda no cuenta: se va a sustituir.
      const { rows: solapadas } = await cliente.query<{ id: string }>(
        `SELECT id FROM ventana_prematricula
          WHERE periodo_id = $1
            AND ronda <> $4
            AND activa
            AND abre < $3::timestamptz
            AND cierra > $2::timestamptz
          LIMIT 1`,
        [periodoId, abre, cierra, ronda],
      );

      if (solapadas[0]) return null;

      await cliente.query(
        `UPDATE ventana_prematricula SET activa = FALSE
          WHERE periodo_id = $1 AND ronda = $2`,
        [periodoId, ronda],
      );

      const { rows } = await cliente.query<{ id: string }>(
        `INSERT INTO ventana_prematricula (periodo_id, abre, cierra, mensaje, ronda)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [periodoId, abre, cierra, mensaje, ronda],
      );

      return rows[0].id;
    });

    if (!id) return { estado: "ventana_solapada" };

    await anotar(admin.id, "360.ventana_abierta", id, { abre, cierra, ronda });
  } catch (error) {
    console.error("[360] no se pudo guardar la ventana", error);
    return { estado: "error" };
  }

  refrescarAdmin();

  return { estado: "ok" };
}

/** Cierra una ventana antes de su hora. */
export async function cerrarVentana(
  _previo: EstadoAdmin360,
  datos: FormData,
): Promise<EstadoAdmin360> {
  const admin = await requerirPermiso("academico.escribir");

  const id = String(datos.get("id") ?? "");

  if (!esUuid(id)) return { estado: "no_encontrada" };

  const cerrada = await consultarUna<{ id: string }>(
    "UPDATE ventana_prematricula SET activa = FALSE WHERE id = $1 AND activa RETURNING id",
    [id],
  );

  if (!cerrada) return { estado: "no_encontrada" };

  await anotar(admin.id, "360.ventana_cerrada", cerrada.id);

  refrescarAdmin();

  return { estado: "ok" };
}

function anotar(
  usuarioId: string,
  accion: string,
  entidadId: string,
  extra?: Record<string, unknown>,
) {
  return registrar({
    usuarioId,
    accion,
    entidad: "materia_360",
    entidadId,
    datos: extra,
  });
}

/**
 * El anuncio de la ventana sale en la cabecera de TODAS las pantallas internas,
 * así que un cambio de ventana refresca el armazón entero y no solo su ruta.
 */
function refrescarAdmin() {
  revalidatePath("/[locale]", "layout");
}

/**
 * La prematrícula del estudiante enseña el aviso de tanda pendiente, y la de
 * administración cuenta inscritos: las dos cambian con cada matrícula.
 */
function refrescarEstudiante() {
  revalidatePath("/[locale]/portal/estudiante/global-360", "page");
  revalidatePath("/[locale]/portal/estudiante/prematricula", "page");
  revalidatePath("/[locale]/academico/prematricula", "page");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(valor: string): boolean {
  return UUID.test(valor);
}

function esViolacionUnica(
  error: unknown,
): error is { code: string; constraint?: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === VIOLACION_UNICA
  );
}
