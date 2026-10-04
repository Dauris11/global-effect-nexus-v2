"use server";

import { createHash, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { requerirUsuario } from "@/lib/auth";
import { consultarUna, enTransaccionComo } from "@/lib/db";
import {
  esFechaIso,
  esFormaPago,
  esTipoRecibo,
  esUuid,
  MAXIMO_ADJUNTO,
  montoValido,
  tasaValida,
  TIPOS_ADJUNTO,
} from "@/lib/contabilidad/formato";
import { usuarioTienePermiso } from "@/lib/rbac";
import { subirContable } from "@/lib/supabase/almacen";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import {
  contextoDe,
  estadoDeError,
  otrosConPermiso,
  type EstadoErrorContable,
} from "@/server/contabilidad/sesion";

/**
 * Recibos de ingreso y comprobantes de egreso (§4.3).
 *
 * Tres puertas distintas, y no por capricho:
 *   · `registrar` crea y corrige BORRADORES.
 *   · `aprobar` contabiliza y anula. Contabilizar mueve el banco y escribe
 *     el asiento; anular los revierte.
 *   · Quien registró un recibo no lo aprueba, salvo que sea la única
 *     persona con `aprobar` (§2.2); en ese caso pasa y la bitácora lo dice.
 *
 * Todas las escrituras van por `enTransaccionComo`: la bitácora de la base
 * aborta cualquier escritura sin usuario. El trabajo de verdad (movimiento,
 * asiento, contra-asiento) lo hacen las funciones de la 0036, en la misma
 * transacción.
 */

export type EstadoRecibo = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "no_encontrado"
    | "datos_invalidos"
    | "monto_invalido"
    | "tasa_requerida"
    | "moneda_cuenta"
    | "no_es_borrador"
    | "mismo_usuario"
    | "motivo_requerido"
    | "archivo_invalido"
    | EstadoErrorContable;
  id?: string;
};

function texto(datos: FormData, campo: string, maximo: number): string {
  return String(datos.get(campo) ?? "").trim().slice(0, maximo);
}

function idOpcional(datos: FormData, campo: string): string | null {
  const valor = texto(datos, campo, 40);
  return esUuid(valor) ? valor : null;
}

/** Alta y corrección de un borrador. Con `id` vacío, es un alta. */
export async function guardarRecibo(
  _previo: EstadoRecibo,
  datos: FormData,
): Promise<EstadoRecibo> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.registrar")) return { estado: "no_permitido" };

  const id = texto(datos, "id", 40);
  const tipo = texto(datos, "tipo", 10);
  const fecha = texto(datos, "fecha", 10);
  const cuenta = idOpcional(datos, "cuenta");
  const categoria = idOpcional(datos, "categoria");
  const fondo = idOpcional(datos, "fondo");
  const formaPago = texto(datos, "forma_pago", 20);
  const concepto = texto(datos, "concepto", 200);
  const monto = montoValido(texto(datos, "monto", 20));
  const tasaTexto = texto(datos, "tasa", 20);

  if (id && !esUuid(id)) return { estado: "no_encontrado" };
  if (!esTipoRecibo(tipo) || !esFechaIso(fecha) || !cuenta || !categoria || !fondo
      || !esFormaPago(formaPago) || !concepto) {
    return { estado: "datos_invalidos" };
  }
  if (!monto) return { estado: "monto_invalido" };

  const datosCuenta = await consultarUna<{ moneda: "DOP" | "USD" }>(
    `SELECT moneda FROM contabilidad.cuenta_bancaria WHERE id = $1 AND estado = 'activa'`,
    [cuenta],
  );
  if (!datosCuenta) return { estado: "datos_invalidos" };

  // La moneda NO la elige quien registra: es la de la cuenta. Un recibo en
  // dólares contra el libro en pesos descuadra el libro sin que se note.
  const moneda = datosCuenta.moneda;
  const tasa = moneda === "USD" ? tasaValida(tasaTexto) : null;
  if (moneda === "USD" && !tasa) return { estado: "tasa_requerida" };

  // El patrocinador solo en ingresos y el beneficiario solo en egresos:
  // el otro campo se ignora aunque venga relleno.
  const patrocinador = tipo === "ingreso" ? idOpcional(datos, "patrocinador") : null;
  const beneficiario = tipo === "egreso" ? texto(datos, "beneficiario", 160) || null : null;
  const valores = [
    fecha, cuenta, moneda, tasa, monto, concepto, categoria, fondo,
    idOpcional(datos, "proyecto"), patrocinador, beneficiario, formaPago,
    texto(datos, "referencia", 120) || null, texto(datos, "notas", 900) || null,
  ];

  try {
    const guardado = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      if (id) {
        const { rows } = await cliente.query<{ id: string }>(
          `UPDATE contabilidad.recibo
              SET fecha = $2, periodo_id = contabilidad.periodo_para($2), cuenta_bancaria_id = $3,
                  moneda = $4, tasa = $5, monto = $6, concepto = $7, categoria_id = $8,
                  fondo_id = $9, proyecto_id = $10, patrocinador_id = $11, beneficiario = $12,
                  forma_pago = $13, referencia = $14, notas = $15
            WHERE id = $1 AND estado = 'borrador'
          RETURNING id`,
          [id, ...valores],
        );
        return rows[0]?.id ?? null;
      }

      const { rows } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.recibo
           (tipo, numero, fecha, periodo_id, cuenta_bancaria_id, moneda, tasa, monto, concepto,
            categoria_id, fondo_id, proyecto_id, patrocinador_id, beneficiario, forma_pago,
            referencia, notas, creado_por)
         VALUES ($1, contabilidad.siguiente_numero(CASE $1 WHEN 'ingreso' THEN 'RI' ELSE 'CE' END),
                 $2, contabilidad.periodo_para($2), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                 $13, $14, $15, $16)
         RETURNING id`,
        [tipo, ...valores, usuario.id],
      );
      return rows[0].id;
    });

    if (!guardado) return { estado: "no_es_borrador" };
    refrescar();
    return { estado: "ok", id: guardado };
  } catch (error) {
    return { estado: estadoDeError(error) };
  }
}

/** Borrador → contabilizado: mueve el banco y escribe el asiento. */
export async function contabilizarRecibo(
  _previo: EstadoRecibo,
  datos: FormData,
): Promise<EstadoRecibo> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.aprobar")) return { estado: "no_permitido" };

  const id = texto(datos, "id", 40);
  if (!esUuid(id)) return { estado: "no_encontrado" };

  const recibo = await consultarUna<{ estado: string; creado_por: string }>(
    `SELECT estado, creado_por FROM contabilidad.recibo WHERE id = $1`,
    [id],
  );
  if (!recibo) return { estado: "no_encontrado" };
  if (recibo.estado !== "borrador") return { estado: "no_es_borrador" };

  // Quien registra no aprueba (§2.2). Si es la única cuenta con el
  // permiso, se deja pasar y se escribe el porqué en la bitácora.
  let motivo: string | undefined;
  if (recibo.creado_por === usuario.id) {
    if ((await otrosConPermiso(usuario.id, "contabilidad.aprobar")) > 0) {
      return { estado: "mismo_usuario" };
    }
    motivo = "Aprobado por quien lo registró: es la única cuenta con contabilidad.aprobar.";
  }

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      if (motivo) await fijarAccion(cliente, "aprobar", motivo);
      await cliente.query(`SELECT contabilidad.contabilizar_recibo($1)`, [id]);
    });
  } catch (error) {
    return { estado: estadoDeError(error) };
  }

  refrescar();
  return { estado: "ok", id };
}

/** Anular con motivo. Si estaba contabilizado, la base genera el contra-asiento. */
export async function anularRecibo(
  _previo: EstadoRecibo,
  datos: FormData,
): Promise<EstadoRecibo> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.aprobar")) return { estado: "no_permitido" };

  const id = texto(datos, "id", 40);
  const motivo = texto(datos, "motivo", 500);
  if (!esUuid(id)) return { estado: "no_encontrado" };
  if (motivo.length < 5) return { estado: "motivo_requerido" };

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await cliente.query(`SELECT contabilidad.anular_recibo($1, $2)`, [id, motivo]);
    });
  } catch (error) {
    return { estado: estadoDeError(error) };
  }

  refrescar();
  return { estado: "ok", id };
}

/**
 * Sube un comprobante al bucket privado y lo enlaza al recibo.
 *
 * La ruta la arman ids de la base, nunca el nombre del archivo (que es
 * texto del usuario y acabaría en una URL). El sha256 se calcula aquí,
 * sobre los bytes que de verdad se suben.
 */
export async function adjuntarArchivo(
  _previo: EstadoRecibo,
  datos: FormData,
): Promise<EstadoRecibo> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.registrar")) return { estado: "no_permitido" };

  const id = texto(datos, "id", 40);
  const archivo = datos.get("archivo");
  if (!esUuid(id)) return { estado: "no_encontrado" };
  if (
    !(archivo instanceof File) ||
    archivo.size === 0 ||
    archivo.size > MAXIMO_ADJUNTO ||
    !(TIPOS_ADJUNTO as readonly string[]).includes(archivo.type)
  ) {
    return { estado: "archivo_invalido" };
  }

  const recibo = await consultarUna<{ fecha: string }>(
    `SELECT to_char(fecha, 'YYYY/MM') AS fecha FROM contabilidad.recibo WHERE id = $1`,
    [id],
  );
  if (!recibo) return { estado: "no_encontrado" };

  const extension = archivo.type === "application/pdf" ? "pdf" : archivo.type.split("/")[1];
  const ruta = `${recibo.fecha}/recibos/${id}/${randomUUID()}.${extension}`;
  const sha256 = createHash("sha256").update(Buffer.from(await archivo.arrayBuffer())).digest("hex");

  const subida = await subirContable(ruta, archivo);
  if (!subida.ok) return { estado: "error" };

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await cliente.query(
        `INSERT INTO contabilidad.recibo_adjunto
           (recibo_id, ruta, nombre, tipo_mime, tamano, sha256, subido_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, ruta, archivo.name.slice(0, 200), archivo.type, archivo.size, sha256, usuario.id],
      );
    });
  } catch (error) {
    return { estado: estadoDeError(error) };
  }

  refrescar();
  return { estado: "ok", id };
}

function refrescar(): void {
  revalidatePath("/[locale]/contabilidad", "layout");
  revalidatePath("/[locale]/portal/contabilidad", "page");
  revalidatePath("/[locale]/dashboard", "page");
}
