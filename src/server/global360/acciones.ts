"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirPermiso, requerirRol } from "@/lib/auth";
import { consultarUna, enTransaccion } from "@/lib/db";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";

/**
 * Global Effect 360: prematrícula del estudiante y administración del programa.
 *
 * Dos puertas distintas y conviene no confundirlas:
 *
 *   · El estudiante se prematricula a SÍ MISMO. El id no viene del formulario,
 *     sale de su sesión: aceptarlo permitiría matricular a otro.
 *   · Administración configura la ventana y el catálogo, con
 *     `academico.escribir`.
 *
 * La ventana se comprueba EN LA BASE, dentro del propio INSERT, y no antes con
 * un `if`. Es la diferencia entre cerrar la puerta y pedir por favor: entre leer
 * la hora y escribir la fila pasa un rato, y el borde de la ventana es justo
 * cuando media promoción está pulsando el botón.
 */

export type EstadoPrematricula = {
  estado:
    | "inicial"
    | "ok"
    | "cerrada"
    | "no_becado"
    | "sin_ficha"
    | "repetida"
    | "invalida"
    | "error";
};

/**
 * Prematricula al estudiante de la sesión en una materia del programa.
 *
 * El INSERT lleva la ventana en un SELECT sobre `ventana_prematricula`, así que
 * si la ventana cerró no encuentra período y no escribe nada. El trigger de la
 * 0027 remata: si el estudiante no es becado, la base lo rechaza.
 */
export async function prematricular(
  _previo: EstadoPrematricula,
  datos: FormData,
): Promise<EstadoPrematricula> {
  const usuario = await requerirRol(["estudiante"]);
  const estudiante = await estudianteDeUsuario(usuario.id);

  if (!estudiante) return { estado: "sin_ficha" };
  if (estudiante.tipo !== "becado") return { estado: "no_becado" };

  const materiaId = String(datos.get("materia") ?? "");

  if (!esUuid(materiaId)) return { estado: "invalida" };

  try {
    const creada = await consultarUna<{ id: string }>(
      `INSERT INTO inscripcion_360 (estudiante_id, materia_id, periodo_id)
       SELECT $1, m.id, v.periodo_id
         FROM materia_360 m
         JOIN ventana_prematricula v
           ON v.activa
          AND now() >= v.abre
          AND now() <  v.cierra
        WHERE m.id = $2
          AND m.activa
        ORDER BY v.abre
        LIMIT 1
       ON CONFLICT (estudiante_id, materia_id, periodo_id) DO NOTHING
       RETURNING id`,
      [estudiante.id, materiaId],
    );

    if (!creada) {
      // Puede ser que la ventana esté cerrada o que ya la tuviera. Se
      // distingue, porque son dos mensajes distintos para el estudiante.
      const yaLaTiene = await consultarUna<{ id: string }>(
        `SELECT i.id
           FROM inscripcion_360 i
           JOIN ventana_prematricula v
             ON v.periodo_id = i.periodo_id
            AND v.activa
            AND now() >= v.abre
            AND now() <  v.cierra
          WHERE i.estudiante_id = $1
            AND i.materia_id = $2`,
        [estudiante.id, materiaId],
      );

      return { estado: yaLaTiene ? "repetida" : "cerrada" };
    }

    await registrar({
      usuarioId: usuario.id,
      accion: "360.prematriculada",
      entidad: "inscripcion_360",
      entidadId: creada.id,
      datos: { materia: materiaId },
    });
  } catch (error) {
    console.error("[360] no se pudo prematricular", error);
    return { estado: "error" };
  }

  refrescarEstudiante();

  return { estado: "ok" };
}

/** Retira una prematrícula, mientras la ventana siga abierta. */
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
  const obligatoria = String(datos.get("obligatoria") ?? "") === "1";
  const creditos = Number(datos.get("creditos") ?? 0);
  const horas = Number(datos.get("horas") ?? 0);

  if (!nombre) return { estado: "nombre_vacio" };
  if (id && !esUuid(id)) return { estado: "no_encontrada" };

  try {
    if (id) {
      const editada = await consultarUna<{ id: string }>(
        `UPDATE materia_360
            SET nombre = $2, codigo = $3, obligatoria = $4,
                creditos = $5, horas = NULLIF($6, 0)
          WHERE id = $1
        RETURNING id`,
        [id, nombre, codigo, obligatoria, creditos, horas],
      );

      if (!editada) return { estado: "no_encontrada" };

      await anotar(admin.id, "360.materia_editada", editada.id, { nombre });
    } else {
      // `orden` al final del catálogo, como los anuncios del hero: con el
      // DEFAULT 0 cada materia nueva se colaría delante de las demás.
      const creada = await consultarUna<{ id: string }>(
        `INSERT INTO materia_360 (nombre, codigo, obligatoria, creditos, horas, orden)
         VALUES ($1, $2, $3, $4, NULLIF($5, 0),
                 coalesce((SELECT max(orden) + 1 FROM materia_360), 0))
         RETURNING id`,
        [nombre, codigo, obligatoria, creditos, horas],
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
 * Abre una ventana de prematrícula.
 *
 * Al guardar una nueva se desactivan las demás del mismo período, en la misma
 * transacción: dos ventanas abiertas a la vez para un período harían que el
 * anuncio dijera una cosa y el INSERT usara otra.
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

  if (!esUuid(periodoId)) return { estado: "no_encontrada" };
  if (!abre || !cierra || new Date(cierra) <= new Date(abre)) {
    return { estado: "fechas_invalidas" };
  }

  try {
    const id = await enTransaccion(async (cliente) => {
      await cliente.query(
        "UPDATE ventana_prematricula SET activa = FALSE WHERE periodo_id = $1",
        [periodoId],
      );

      const { rows } = await cliente.query<{ id: string }>(
        `INSERT INTO ventana_prematricula (periodo_id, abre, cierra, mensaje)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [periodoId, abre, cierra, mensaje],
      );

      return rows[0].id;
    });

    await anotar(admin.id, "360.ventana_abierta", id, { abre, cierra });
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

function refrescarEstudiante() {
  revalidatePath("/[locale]/portal/estudiante/global-360", "page");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(valor: string): boolean {
  return UUID.test(valor);
}
