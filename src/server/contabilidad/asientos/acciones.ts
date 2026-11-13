"use server";

import { revalidatePath } from "next/cache";
import type { PoolClient } from "pg";

import { requerirUsuario } from "@/lib/auth";
import {
  esRevertible,
  esTipoAsientoManual,
  leerLineasJson,
  MOTIVO_MINIMO,
  validarLineas,
  type ErrorAsiento,
  type LineaNormalizada,
} from "@/lib/contabilidad/asientos";
import { esFechaIso, esUuid, numeroDocumento } from "@/lib/contabilidad/formato";
import { enTransaccionComo } from "@/lib/db";
import { usuarioTienePermiso } from "@/lib/rbac";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import {
  contextoDe,
  estadoDeError,
  type EstadoErrorContable,
} from "@/server/contabilidad/sesion";

/**
 * Asientos manuales, reversos y plantillas recurrentes (§4 del plan, fase 1).
 *
 * Todo pide `contabilidad.asiento_manual`, que es el permiso de escribir
 * partida doble a mano. No hay paso de aprobación (y por eso no aplica
 * "quien registra no aprueba"), pero cada escritura queda en la bitácora con
 * su acción nombrada.
 *
 * Las líneas se validan aquí con la MISMA función que habilita el botón del
 * editor (`validarLineas`). La base vuelve a comprobar el cuadre al COMMIT
 * con su disparador diferido: dos redes, ninguna de las dos en el navegador.
 */

export type EstadoAccionAsiento = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "no_encontrado"
    | "datos_invalidos"
    | "cuenta_no_admitida"
    | "no_revertible"
    | "motivo_corto"
    | "ya_generado"
    | "plantilla_inactiva"
    | ErrorAsiento
    | EstadoErrorContable;
  id?: string;
  /** Índice de la línea con el problema, para señalarla en el editor. */
  linea?: number;
};

function texto(datos: FormData, campo: string, maximo: number): string {
  return String(datos.get(campo) ?? "").trim().slice(0, maximo);
}

/** Lee y valida las líneas del formulario; `null` si llegaron mal formadas. */
function lineasDe(datos: FormData) {
  const entrada = leerLineasJson(String(datos.get("lineas") ?? ""));
  return entrada ? validarLineas(entrada) : null;
}

/**
 * Las cuentas tienen que ser hojas activas. El editor solo ofrece esas,
 * pero el formulario se puede manipular y un movimiento en una cuenta de
 * grupo no aparece en ningún mayor.
 */
async function cuentasAdmitidas(cliente: PoolClient, lineas: LineaNormalizada[]): Promise<boolean> {
  const ids = [...new Set(lineas.map((l) => l.cuenta_id))];
  const { rows } = await cliente.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM contabilidad.cuenta_contable
      WHERE id = ANY($1::uuid[]) AND admite_movimiento AND activa`,
    [ids],
  );
  return rows[0]?.n === ids.length;
}

class Rechazo extends Error {
  constructor(readonly estado: EstadoAccionAsiento["estado"]) {
    super(estado);
  }
}

function errorDe(error: unknown): EstadoAccionAsiento {
  if (error instanceof Rechazo) return { estado: error.estado };
  const mensaje = error instanceof Error ? error.message : String(error);
  // Los dos los lanza generar_recurrente (0048) con este texto exacto.
  if (mensaje.includes("ya_generado")) return { estado: "ya_generado" };
  if (mensaje.includes("plantilla_inactiva")) return { estado: "plantilla_inactiva" };
  if (mensaje.includes("descuadrado")) return { estado: "descuadrado" };
  return { estado: estadoDeError(error) };
}

/** Asiento manual, de ajuste, de apertura o de cierre. */
export async function crearAsiento(
  _previo: EstadoAccionAsiento,
  datos: FormData,
): Promise<EstadoAccionAsiento> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.asiento_manual")) return { estado: "no_permitido" };

  const fecha = texto(datos, "fecha", 10);
  const tipo = texto(datos, "tipo", 20);
  const concepto = texto(datos, "concepto", 200);
  if (!esFechaIso(fecha) || !esTipoAsientoManual(tipo) || concepto.length < 3) {
    return { estado: "datos_invalidos" };
  }

  const resultado = lineasDe(datos);
  if (!resultado) return { estado: "datos_invalidos" };
  if (!resultado.ok) return { estado: resultado.error, linea: resultado.linea };
  const { lineas } = resultado;

  try {
    // Una fecha de un período cerrado no hace falta comprobarla aquí: el
    // disparador _fn_contabilidad_proteger rechaza el INSERT del asiento y
    // estadoDeError lo traduce a "periodo_cerrado".
    const id = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      if (!(await cuentasAdmitidas(cliente, lineas))) throw new Rechazo("cuenta_no_admitida");
      await fijarAccion(cliente, "crear");
      const { rows } = await cliente.query<{ id: string }>(
        `SELECT contabilidad.crear_asiento($1, $2, $3, NULL, NULL, $4::jsonb) AS id`,
        [fecha, concepto, tipo, JSON.stringify(lineas)],
      );
      return rows[0].id;
    });
    refrescar();
    return { estado: "ok", id };
  } catch (error) {
    return errorDe(error);
  }
}

/**
 * Revertir con motivo. El reverso lleva la fecha de HOY (lo pone
 * `revertir_asiento`), así que cae en el período abierto aunque el
 * original sea de un mes ya cerrado.
 *
 * El caso del período cerrado: marcar el original (`anulado = true`) es
 * un UPDATE sobre una fila de ese período, y `_fn_contabilidad_proteger`
 * lo rechaza, con razón: un período cerrado no admite cambios, tampoco
 * una marca. Entonces el original NO se toca y el vínculo vive solo en el
 * reverso (origen_tabla = 'contabilidad.asiento', origen_id = original).
 * Las consultas derivan "anulado" de ese vínculo, así que la pantalla dice
 * lo mismo en los dos casos, y el mes cerrado sigue igual que el día en
 * que se cerró. Se decide ANTES del UPDATE y no atrapando el error,
 * porque un error dentro de la transacción la deja abortada.
 */
export async function revertirAsiento(
  _previo: EstadoAccionAsiento,
  datos: FormData,
): Promise<EstadoAccionAsiento> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.asiento_manual")) return { estado: "no_permitido" };

  const id = texto(datos, "id", 40);
  const motivo = texto(datos, "motivo", 500);
  if (!esUuid(id)) return { estado: "no_encontrado" };
  if (motivo.length < MOTIVO_MINIMO) return { estado: "motivo_corto" };

  try {
    const reverso = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      // FOR UPDATE en el original: dos personas revirtiendo a la vez
      // generarían dos reversos. Bloquear una fila no dispara triggers, así
      // que vale también en un período cerrado.
      const { rows } = await cliente.query<{
        numero: string;
        concepto: string;
        tipo: "automatico" | "manual" | "ajuste" | "apertura" | "cierre" | "recurrente";
        origen_tabla: string | null;
        anulado: boolean;
        cerrado: boolean;
        ya_revertido: boolean;
      }>(
        `SELECT a.numero::text AS numero, a.concepto, a.tipo, a.origen_tabla, a.anulado,
                p.estado = 'cerrado' AS cerrado,
                EXISTS (SELECT 1 FROM contabilidad.asiento x
                         WHERE x.origen_tabla = 'contabilidad.asiento' AND x.origen_id = a.id) AS ya_revertido
           FROM contabilidad.asiento a
           JOIN contabilidad.periodo_contable p ON p.id = a.periodo_id
          WHERE a.id = $1
            FOR UPDATE OF a`,
        [id],
      );
      const original = rows[0];
      if (!original) throw new Rechazo("no_encontrado");
      const estado = original.anulado || original.ya_revertido ? "anulado" : "vigente";
      if (!esRevertible(original.tipo, original.origen_tabla, estado)) throw new Rechazo("no_revertible");

      await fijarAccion(cliente, "anular", motivo);
      const concepto = `Reverso de ${numeroDocumento("AS", original.numero)}: ${motivo}`.slice(0, 300);
      const creado = await cliente.query<{ id: string }>(
        `SELECT contabilidad.revertir_asiento($1, $2) AS id`,
        [id, concepto],
      );
      const reversoId = creado.rows[0].id;

      // revertir_asiento copia el origen del original (sirve a los
      // automáticos, que comparten documento). Un manual no tiene origen,
      // así que el reverso apunta al asiento que revierte.
      await cliente.query(
        `UPDATE contabilidad.asiento
            SET origen_tabla = 'contabilidad.asiento', origen_id = $2
          WHERE id = $1`,
        [reversoId, id],
      );

      if (!original.cerrado) {
        await cliente.query(
          `UPDATE contabilidad.asiento
              SET anulado = true, anulado_por = $2, anulado_en = now(), motivo_anulacion = $3
            WHERE id = $1`,
          [id, usuario.id, motivo],
        );
      }
      return reversoId;
    });
    refrescar();
    return { estado: "ok", id: reverso };
  } catch (error) {
    return errorDe(error);
  }
}

/** Plantilla nueva. Tiene que cuadrar ya: generarla no la arregla. */
export async function guardarPlantilla(
  _previo: EstadoAccionAsiento,
  datos: FormData,
): Promise<EstadoAccionAsiento> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.asiento_manual")) return { estado: "no_permitido" };

  const nombre = texto(datos, "nombre", 120);
  const concepto = texto(datos, "concepto", 200);
  const dia = Number(texto(datos, "dia_del_mes", 2));
  if (nombre.length < 3 || concepto.length < 3 || !Number.isInteger(dia) || dia < 1 || dia > 31) {
    return { estado: "datos_invalidos" };
  }

  const resultado = lineasDe(datos);
  if (!resultado) return { estado: "datos_invalidos" };
  if (!resultado.ok) return { estado: resultado.error, linea: resultado.linea };
  const { lineas } = resultado;

  try {
    const id = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      if (!(await cuentasAdmitidas(cliente, lineas))) throw new Rechazo("cuenta_no_admitida");
      await fijarAccion(cliente, "crear");
      const { rows } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.asiento_recurrente (nombre, concepto, lineas, dia_del_mes, creado_por)
         VALUES ($1, $2, $3::jsonb, $4, $5)
         RETURNING id`,
        [nombre, concepto, JSON.stringify(lineas), dia, usuario.id],
      );
      return rows[0].id;
    });
    refrescar();
    return { estado: "ok", id };
  } catch (error) {
    return errorDe(error);
  }
}

/** Activar o desactivar. Una plantilla no se borra: deja de generarse. */
export async function cambiarPlantilla(
  _previo: EstadoAccionAsiento,
  datos: FormData,
): Promise<EstadoAccionAsiento> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.asiento_manual")) return { estado: "no_permitido" };

  const id = texto(datos, "id", 40);
  const activo = texto(datos, "activo", 5) === "true";
  if (!esUuid(id)) return { estado: "no_encontrado" };

  try {
    const cambiado = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "editar");
      const { rowCount } = await cliente.query(
        `UPDATE contabilidad.asiento_recurrente SET activo = $2 WHERE id = $1`,
        [id, activo],
      );
      return (rowCount ?? 0) > 0;
    });
    if (!cambiado) return { estado: "no_encontrado" };
    refrescar();
    return { estado: "ok", id };
  } catch (error) {
    return errorDe(error);
  }
}

/** "Generar el de este mes": la base decide la fecha y si ya se generó. */
export async function generarDelMes(
  _previo: EstadoAccionAsiento,
  datos: FormData,
): Promise<EstadoAccionAsiento> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.asiento_manual")) return { estado: "no_permitido" };

  const id = texto(datos, "id", 40);
  if (!esUuid(id)) return { estado: "no_encontrado" };

  try {
    const asiento = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      // Una cuenta que se desactivó DESPUÉS de crear la plantilla: generar
      // escribiría en ella sin que nadie lo note. Se comprueba aquí porque
      // generar_recurrente no mira el catálogo.
      const { rows } = await cliente.query<{ lineas: LineaNormalizada[] }>(
        `SELECT lineas FROM contabilidad.asiento_recurrente WHERE id = $1`,
        [id],
      );
      if (!rows[0]) throw new Rechazo("no_encontrado");
      if (!(await cuentasAdmitidas(cliente, rows[0].lineas))) throw new Rechazo("cuenta_no_admitida");

      await fijarAccion(cliente, "crear");
      const generado = await cliente.query<{ id: string }>(
        `SELECT contabilidad.generar_recurrente($1, CURRENT_DATE) AS id`,
        [id],
      );
      return generado.rows[0].id;
    });
    refrescar();
    return { estado: "ok", id: asiento };
  } catch (error) {
    return errorDe(error);
  }
}

/**
 * Procesa asientos: los pasa a los libros (Observaciones #1). Pide
 * `contabilidad.aprobar` porque es el visto bueno de lo que otro registró.
 *
 * Un asiento y su reverso se procesan JUNTOS, igual que todos los asientos
 * de un mismo documento: procesar solo el reverso de un original sin
 * procesar restaría en el mayor algo que nunca se sumó. Por eso las
 * parejas se completan aquí y no se confía en que la persona marque ambas.
 */
export async function procesarAsientos(
  _previo: EstadoAccionAsiento,
  datos: FormData,
): Promise<EstadoAccionAsiento> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.aprobar")) return { estado: "no_permitido" };

  const ids = [...new Set(datos.getAll("ids").map(String))].filter(esUuid).slice(0, 500);
  if (ids.length === 0) return { estado: "datos_invalidos" };

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "aprobar");
      await cliente.query(
        `WITH elegidos AS (
           SELECT a.* FROM contabilidad.asiento a WHERE a.id = ANY($1::uuid[])
         ),
         grupo AS (
           SELECT id FROM elegidos
           UNION
           -- Reverso de un manual, y original de un reverso.
           SELECT x.id FROM contabilidad.asiento x JOIN elegidos e
               ON (x.origen_tabla = 'contabilidad.asiento' AND x.origen_id = e.id)
               OR (e.origen_tabla = 'contabilidad.asiento' AND x.id = e.origen_id)
           UNION
           -- Asientos del mismo documento (el automático y su contra-asiento).
           SELECT x.id FROM contabilidad.asiento x JOIN elegidos e
               ON e.origen_tabla IS NOT NULL AND e.origen_tabla <> 'contabilidad.asiento'
              AND x.origen_tabla = e.origen_tabla AND x.origen_id = e.origen_id
         )
         UPDATE contabilidad.asiento a
            SET procesado_en = now(), procesado_por = $2
          WHERE a.id IN (SELECT id FROM grupo) AND a.procesado_en IS NULL`,
        [ids, usuario.id],
      );
    });
    refrescar();
    return { estado: "ok" };
  } catch (error) {
    return errorDe(error);
  }
}

function refrescar(): void {
  revalidatePath("/[locale]/contabilidad", "layout");
}
