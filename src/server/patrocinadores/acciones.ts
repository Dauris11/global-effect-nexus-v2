"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { consultarUna, enTransaccion } from "@/lib/db";
import { tienePermiso } from "@/lib/rbac";

/**
 * Alta y edición de patrocinadores.
 *
 * Una sola puerta: `patrocinadores.escribir`, que hoy tienen `admin` y
 * `super_admin`. `contabilidad` tiene solo `patrocinadores.leer`: ve el
 * directorio y los aportes comprometidos —los necesita para cuadrar— pero no
 * cambia con quién tiene la Fundación un acuerdo.
 *
 * EL MONTO SE VALIDA AQUÍ Y LO GUARDA LA BASE COMO NUMERIC. Llega del
 * formulario como texto, se comprueba que sea un número no negativo y se manda
 * como parámetro: nunca se compone la cadena del SQL con él, y nunca se
 * redondea en JavaScript antes de guardarlo.
 *
 * NO HAY BORRADO. `estudiante.patrocinador_id` es ON DELETE SET NULL y
 * `asignacion_beca.patrocinador_id` es ON DELETE CASCADE: borrar un
 * patrocinador dejaría a sus becados sin origen de fondos y se llevaría por
 * delante el historial de aportes. Para retirar a alguien está el estado
 * `inactivo`, que además conserva cuánto aportaba.
 */

export type EstadoPatrocinador = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "no_encontrado"
    | "nombre_vacio"
    | "monto_invalido"
    | "error";
};

const TIPOS = ["empresa", "persona", "iglesia", "ong", "otro"];
const ESTADOS = ["activo", "inactivo"];

/** Alta y edición. Con `id` vacío, es un alta. */
export async function guardarPatrocinador(
  _previo: EstadoPatrocinador,
  datos: FormData,
): Promise<EstadoPatrocinador> {
  const usuario = await requerirUsuario();

  if (!tienePermiso(usuario.rol, "patrocinadores.escribir")) {
    return { estado: "no_permitido" };
  }

  const id = String(datos.get("id") ?? "").trim();
  const nombre = String(datos.get("nombre") ?? "").trim().slice(0, 160);
  const tipo = String(datos.get("tipo") ?? "persona");
  const email = String(datos.get("email") ?? "").trim().slice(0, 160);
  const telefono = String(datos.get("telefono") ?? "").trim().slice(0, 40);
  const pais = String(datos.get("pais") ?? "").trim().slice(0, 80);
  const estado = String(datos.get("estado") ?? "activo");
  const notas = String(datos.get("notas") ?? "").trim().slice(0, 900);
  const montoTexto = String(datos.get("monto") ?? "").trim();

  if (!nombre) return { estado: "nombre_vacio" };
  if (id && !esUuid(id)) return { estado: "no_encontrado" };

  // El CHECK de la tabla exige >= 0 y rechazaría la escritura con un error de
  // base. Se comprueba antes para poder decir qué pasa con el monto.
  const monto = montoTexto === "" ? 0 : Number(montoTexto);

  if (!Number.isFinite(monto) || monto < 0) {
    return { estado: "monto_invalido" };
  }

  const tipoOk = TIPOS.includes(tipo) ? tipo : "persona";
  const estadoOk = ESTADOS.includes(estado) ? estado : "activo";

  try {
    const guardado = id
      ? await consultarUna<{ id: string }>(
          `UPDATE patrocinador
              SET nombre = $2, tipo = $3::tipo_patrocinador,
                  email = NULLIF($4, '')::citext, telefono = NULLIF($5, ''),
                  pais = NULLIF($6, ''), estado = $7,
                  monto_mensual = $8, notas = NULLIF($9, '')
            WHERE id = $1
          RETURNING id`,
          [id, nombre, tipoOk, email, telefono, pais, estadoOk, monto, notas],
        )
      : await consultarUna<{ id: string }>(
          `INSERT INTO patrocinador
                  (nombre, tipo, email, telefono, pais, estado, monto_mensual, notas)
           VALUES ($1, $2::tipo_patrocinador, NULLIF($3, '')::citext, NULLIF($4, ''),
                   NULLIF($5, ''), $6, $7, NULLIF($8, ''))
           RETURNING id`,
          [nombre, tipoOk, email, telefono, pais, estadoOk, monto, notas],
        );

    if (!guardado) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: id ? "patrocinador.editado" : "patrocinador.creado",
      entidad: "patrocinador",
      entidadId: guardado.id,
      // El monto sí, las notas no: las notas son de la relación con una
      // persona y duplicarlas multiplica desde dónde se pueden filtrar.
      datos: { nombre, estado: estadoOk, monto },
    });
  } catch (error) {
    console.error("[patrocinadores] no se pudo guardar", error);
    return { estado: "error" };
  }

  revalidatePath("/[locale]/patrocinadores", "page");
  revalidatePath("/[locale]/patrocinadores/becas", "page");
  revalidatePath("/[locale]/dashboard", "page");

  return { estado: "ok" };
}

/**
 * Vincula a un becado con un patrocinador.
 *
 * TRES ESCRITURAS Y UNA SOLA COSA, así que van en `enTransaccion()`:
 *
 *   1. Se ABRE la nueva asignación. Va primero, y el orden importa: ver abajo.
 *   2. Se CIERRAN las anteriores que siguieran activas (`finalizado`, con
 *      `fecha_fin` de hoy). Cambiar de patrocinador no borra de quién venía
 *      antes: esa etapa se cierra y queda. Es justo lo que
 *      `estudiante.patrocinador_id` a solas no puede guardar, y la razón de
 *      que la verdad viva en `asignacion_beca`.
 *   3. Se pone al día el espejo `estudiante.patrocinador_id`.
 *
 * EL ORDEN NO ES UN DETALLE, y la transacción NO protege de equivocarlo. La
 * primera versión cerraba antes de abrir, y con un patrocinador inactivo el
 * INSERT no casaba ninguna fila —que es lo que debe pasar— pero el cierre ya
 * se había ejecutado: el becado se quedaba SIN patrocinador por un intento
 * fallido. No hay `ROLLBACK` que lo evite, porque desde el punto de vista de
 * PostgreSQL las tres sentencias fueron bien; simplemente una afectó a cero
 * filas. Se detectó probándolo contra la base, no compilando.
 *
 * Abriendo primero, si el INSERT no encuentra fila se sale sin haber tocado
 * nada. Y las dos activas coexisten solo dentro de la transacción, entre la
 * línea 1 y la 2, que es donde nadie las ve.
 *
 * El monto no se copia del patrocinador. Alguien puede aportar 250 al mes y
 * repartirlo entre dos becados: lo que se compromete con ESTA beca se escribe
 * aquí, y por eso `asignacion_beca` tiene monto propio.
 */
export async function asignarBeca(
  _previo: EstadoPatrocinador,
  datos: FormData,
): Promise<EstadoPatrocinador> {
  const usuario = await requerirUsuario();

  if (!tienePermiso(usuario.rol, "patrocinadores.escribir")) {
    return { estado: "no_permitido" };
  }

  const estudianteId = String(datos.get("estudiante") ?? "");
  const patrocinadorId = String(datos.get("patrocinador") ?? "");
  const montoTexto = String(datos.get("monto") ?? "").trim();

  if (!esUuid(estudianteId) || !esUuid(patrocinadorId)) {
    return { estado: "no_encontrado" };
  }

  const monto = montoTexto === "" ? 0 : Number(montoTexto);

  if (!Number.isFinite(monto) || monto < 0) return { estado: "monto_invalido" };

  try {
    const asignada = await enTransaccion(async (cliente) => {
      /*
       * El INSERT selecciona de las dos tablas con sus condiciones puestas: el
       * estudiante tiene que ser becado y el patrocinador estar activo. Con
       * ids que no cumplan, no hay fila que seleccionar y no se escribe nada.
       * Comprobarlo antes con dos consultas dejaría una rendija entre la
       * comprobación y la escritura.
       */
      const { rows } = await cliente.query<{ id: string }>(
        `INSERT INTO asignacion_beca (estudiante_id, patrocinador_id, monto)
         SELECT e.id, p.id, $3
           FROM estudiante e, patrocinador p
          WHERE e.id = $1 AND e.tipo = 'becado'
            AND p.id = $2 AND p.estado = 'activo'
         RETURNING id`,
        [estudianteId, patrocinadorId, monto],
      );

      // Sin fila no se ha escrito nada todavía: se sale y el becado conserva
      // el patrocinador que tuviera.
      if (rows.length === 0) return null;

      // `id <> $2` para no cerrar la que se acaba de abrir.
      await cliente.query(
        `UPDATE asignacion_beca
            SET estado = 'finalizado', fecha_fin = CURRENT_DATE
          WHERE estudiante_id = $1 AND estado = 'activo' AND id <> $2`,
        [estudianteId, rows[0].id],
      );

      await cliente.query(
        `UPDATE estudiante SET patrocinador_id = $2 WHERE id = $1`,
        [estudianteId, patrocinadorId],
      );

      return rows[0].id;
    });

    if (!asignada) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: "beca.asignada",
      entidad: "asignacion_beca",
      entidadId: asignada,
      datos: { estudiante: estudianteId, patrocinador: patrocinadorId, monto },
    });
  } catch (error) {
    console.error("[patrocinadores] no se pudo asignar la beca", error);
    return { estado: "error" };
  }

  refrescarBecas();

  return { estado: "ok" };
}

/**
 * Desvincula a un becado de su patrocinador.
 *
 * CIERRA la asignación, no la borra: que alguien tuvo una beca durante seis
 * meses es un hecho, y borrarlo dejaría un hueco en el histórico que después
 * nadie puede reconstruir. El espejo cae a NULL en la misma transacción.
 */
export async function desvincularBeca(
  _previo: EstadoPatrocinador,
  datos: FormData,
): Promise<EstadoPatrocinador> {
  const usuario = await requerirUsuario();

  if (!tienePermiso(usuario.rol, "patrocinadores.escribir")) {
    return { estado: "no_permitido" };
  }

  const estudianteId = String(datos.get("estudiante") ?? "");

  if (!esUuid(estudianteId)) return { estado: "no_encontrado" };

  try {
    const cerrada = await enTransaccion(async (cliente) => {
      const { rows } = await cliente.query<{ id: string }>(
        `UPDATE asignacion_beca
            SET estado = 'finalizado', fecha_fin = CURRENT_DATE
          WHERE estudiante_id = $1 AND estado = 'activo'
        RETURNING id`,
        [estudianteId],
      );

      if (rows.length === 0) return null;

      await cliente.query(
        `UPDATE estudiante SET patrocinador_id = NULL WHERE id = $1`,
        [estudianteId],
      );

      return rows[0].id;
    });

    if (!cerrada) return { estado: "no_encontrado" };

    await registrar({
      usuarioId: usuario.id,
      accion: "beca.desvinculada",
      entidad: "asignacion_beca",
      entidadId: cerrada,
      datos: { estudiante: estudianteId },
    });
  } catch (error) {
    console.error("[patrocinadores] no se pudo desvincular", error);
    return { estado: "error" };
  }

  refrescarBecas();

  return { estado: "ok" };
}

function refrescarBecas() {
  revalidatePath("/[locale]/patrocinadores/becas", "page");
  revalidatePath("/[locale]/patrocinadores", "page");
  revalidatePath("/[locale]/expedientes", "page");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(valor: string): boolean {
  return UUID.test(valor);
}
