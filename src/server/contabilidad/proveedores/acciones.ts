"use server";

import { createHash, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { requerirUsuario } from "@/lib/auth";
import { consultarUna, enTransaccionComo } from "@/lib/db";
import {
  esFechaIso,
  esMoneda,
  esUuid,
  MAXIMO_ADJUNTO,
  montoValido,
  tasaValida,
  TIPOS_ADJUNTO,
} from "@/lib/contabilidad/formato";
import {
  identificacionValida,
  limpiarIdentificacion,
  ncfValido,
} from "@/lib/contabilidad/identificacion";
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
 * Proveedores y sus facturas (§4.4).
 *
 *   · Ficha del proveedor y facturas en borrador: `registrar`.
 *   · Aprobar una factura (asiento + cuenta por pagar) y anularla: `aprobar`,
 *     con "quien registra no aprueba".
 *   · Cambiar la cuenta bancaria del proveedor: `configurar`. Es el dato
 *     que se manipula en un fraude de pago, así que no basta con poder
 *     registrar recibos para tocarlo.
 */

export type EstadoProveedor = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "no_encontrado"
    | "datos_invalidos"
    | "identificacion_invalida"
    | "identificacion_repetida"
    | "ncf_invalido"
    | "ncf_requerido"
    | "factura_duplicada"
    | "monto_invalido"
    | "tasa_requerida"
    | "no_es_borrador"
    | "mismo_usuario"
    | "motivo_requerido"
    | "tiene_pagos"
    | "archivo_invalido"
    | EstadoErrorContable;
  id?: string;
};

function texto(datos: FormData, campo: string, maximo = 200): string {
  return String(datos.get(campo) ?? "").trim().slice(0, maximo);
}

function idOpcional(datos: FormData, campo: string): string | null {
  const valor = texto(datos, campo, 40);
  return esUuid(valor) ? valor : null;
}

/** Monto que puede ser cero (ITBIS, retenciones). Vacío cuenta como cero. */
function montoOCero(datos: FormData, campo: string): string | null {
  const valor = texto(datos, campo, 20);
  if (!valor) return "0";
  if (/^0+(\.0+)?$/.test(valor.replace(/,/g, ""))) return "0";
  return montoValido(valor);
}

function refrescar(): void {
  revalidatePath("/[locale]/contabilidad", "layout");
  revalidatePath("/[locale]/portal/contabilidad", "page");
}

export async function guardarProveedor(
  _previo: EstadoProveedor,
  datos: FormData,
): Promise<EstadoProveedor> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.registrar")) return { estado: "no_permitido" };

  const id = texto(datos, "id", 40);
  const tipo = texto(datos, "tipo", 10);
  const identificacion = limpiarIdentificacion(texto(datos, "identificacion", 20));
  const nombre = texto(datos, "nombre", 160);
  const dias = Number(texto(datos, "condiciones", 3) || "30");
  const estado = texto(datos, "estado", 10) === "inactivo" ? "inactivo" : "activo";

  if (id && !esUuid(id)) return { estado: "no_encontrado" };
  if ((tipo !== "fisica" && tipo !== "juridica") || !nombre || !Number.isInteger(dias) || dias < 0 || dias > 365) {
    return { estado: "datos_invalidos" };
  }
  if (!identificacionValida(identificacion, tipo)) return { estado: "identificacion_invalida" };

  const valores = [
    tipo, identificacion, nombre, texto(datos, "nombre_comercial", 160) || null,
    texto(datos, "contacto", 120) || null, texto(datos, "telefono", 40) || null,
    texto(datos, "email", 120) || null, texto(datos, "direccion", 300) || null,
    dias, idOpcional(datos, "categoria"), estado,
  ];

  try {
    const guardado = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      const { rows } = id
        ? await cliente.query<{ id: string }>(
            `UPDATE contabilidad.proveedor
                SET tipo = $2, identificacion = $3, nombre = $4, nombre_comercial = $5,
                    contacto = $6, telefono = $7, email = $8, direccion = $9,
                    condiciones_pago_dias = $10, categoria_id = $11, estado = $12
              WHERE id = $1 RETURNING id`,
            [id, ...valores],
          )
        : await cliente.query<{ id: string }>(
            `INSERT INTO contabilidad.proveedor
               (tipo, identificacion, nombre, nombre_comercial, contacto, telefono, email,
                direccion, condiciones_pago_dias, categoria_id, estado, creado_por)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
            [...valores, usuario.id],
          );
      return rows[0]?.id ?? null;
    });
    if (!guardado) return { estado: "no_encontrado" };
    refrescar();
    return { estado: "ok", id: guardado };
  } catch (error) {
    if (error instanceof Error && error.message.includes("proveedor_identificacion_key")) {
      return { estado: "identificacion_repetida" };
    }
    return { estado: estadoDeError(error) };
  }
}

/** Cuenta nueva del proveedor. La anterior de esa moneda queda en el historial. */
export async function agregarCuentaProveedor(
  _previo: EstadoProveedor,
  datos: FormData,
): Promise<EstadoProveedor> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.configurar")) return { estado: "no_permitido" };

  const proveedor = idOpcional(datos, "proveedor");
  const banco = texto(datos, "banco", 120);
  const tipo = texto(datos, "tipo", 10);
  const moneda = texto(datos, "moneda", 3);
  const numero = texto(datos, "numero", 40).replace(/\s/g, "");

  if (!proveedor || !banco || (tipo !== "corriente" && tipo !== "ahorro") || !esMoneda(moneda)
      || !/^[0-9-]{4,40}$/.test(numero)) {
    return { estado: "datos_invalidos" };
  }

  try {
    await enTransaccionComo(await contextoDe(usuario), (cliente) =>
      cliente.query(`SELECT contabilidad.cambiar_cuenta_proveedor($1, $2, $3, $4, $5)`, [
        proveedor, banco, tipo, moneda, numero,
      ]),
    );
    refrescar();
    return { estado: "ok", id: proveedor };
  } catch (error) {
    return { estado: estadoDeError(error) };
  }
}

/**
 * Alta y corrección de una factura en borrador.
 *
 * El NCF es obligatorio salvo para la persona física sin comprobante, y
 * entonces la pantalla avisa que hay que emitir un comprobante de compras.
 * Una factura repetida (mismo proveedor y NCF) se rechaza y, además, deja
 * una alerta para el auditor: puede ser un error de tecleo o un intento de
 * cobrar dos veces, y quien decide cuál es no es quien la tecleó.
 */
export async function guardarFactura(
  _previo: EstadoProveedor,
  datos: FormData,
): Promise<EstadoProveedor> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.registrar")) return { estado: "no_permitido" };

  const id = texto(datos, "id", 40);
  const proveedorId = idOpcional(datos, "proveedor");
  const ncf = texto(datos, "ncf", 13).toUpperCase() || null;
  const emision = texto(datos, "fecha_emision", 10);
  const vencimiento = texto(datos, "fecha_vencimiento", 10);
  const moneda = texto(datos, "moneda", 3);
  const subtotal = montoValido(texto(datos, "subtotal", 20));
  const itbis = montoOCero(datos, "itbis");
  const isr = montoOCero(datos, "retencion_isr");
  const retItbis = montoOCero(datos, "retencion_itbis");
  const categoria = idOpcional(datos, "categoria");
  const fondo = idOpcional(datos, "fondo");
  const concepto = texto(datos, "concepto");

  if (id && !esUuid(id)) return { estado: "no_encontrado" };
  if (!proveedorId || !esFechaIso(emision) || !esFechaIso(vencimiento) || vencimiento < emision
      || !esMoneda(moneda) || !categoria || !fondo || !concepto) {
    return { estado: "datos_invalidos" };
  }
  if (!subtotal || itbis === null || isr === null || retItbis === null) return { estado: "monto_invalido" };
  const tasa = moneda === "USD" ? tasaValida(texto(datos, "tasa", 20)) : null;
  if (moneda === "USD" && !tasa) return { estado: "tasa_requerida" };

  const proveedor = await consultarUna<{ tipo: string; nombre: string }>(
    `SELECT tipo, nombre FROM contabilidad.proveedor WHERE id = $1`,
    [proveedorId],
  );
  if (!proveedor) return { estado: "no_encontrado" };
  if (ncf && !ncfValido(ncf)) return { estado: "ncf_invalido" };
  if (!ncf && proveedor.tipo === "juridica") return { estado: "ncf_requerido" };

  const valores = [
    proveedorId, ncf, emision, vencimiento, moneda, tasa, subtotal, itbis, isr, retItbis,
    concepto, categoria, fondo, idOpcional(datos, "proyecto"),
  ];
  const contexto = await contextoDe(usuario);

  try {
    const guardado = await enTransaccionComo(contexto, async (cliente) => {
      const { rows } = id
        ? await cliente.query<{ id: string }>(
            `UPDATE contabilidad.factura_proveedor
                SET proveedor_id = $2, ncf = $3, fecha_emision = $4, fecha_vencimiento = $5,
                    periodo_id = contabilidad.periodo_para($4), moneda = $6, tasa = $7,
                    subtotal = $8, itbis = $9, retencion_isr = $10, retencion_itbis = $11,
                    concepto = $12, categoria_id = $13, fondo_id = $14, proyecto_id = $15
              WHERE id = $1 AND estado = 'borrador' RETURNING id`,
            [id, ...valores],
          )
        : await cliente.query<{ id: string }>(
            `INSERT INTO contabilidad.factura_proveedor
               (numero, proveedor_id, ncf, fecha_emision, fecha_vencimiento, periodo_id, moneda, tasa,
                subtotal, itbis, retencion_isr, retencion_itbis, concepto, categoria_id, fondo_id,
                proyecto_id, creado_por)
             VALUES (contabilidad.siguiente_numero('FP'), $1, $2, $3, $4, contabilidad.periodo_para($3),
                     $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             RETURNING id`,
            [...valores, usuario.id],
          );
      return rows[0]?.id ?? null;
    });
    if (!guardado) return { estado: "no_es_borrador" };
    refrescar();
    return { estado: "ok", id: guardado };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "";
    if (mensaje.includes("factura_proveedor_proveedor_id_ncf_key")) {
      // Transacción aparte: la de la factura ya se deshizo.
      await enTransaccionComo(contexto, (cliente) =>
        cliente.query(
          `INSERT INTO contabilidad.alerta (tipo, severidad, tabla, registro_id, detalle)
           VALUES ('factura_duplicada', 'media', 'proveedor', $1,
                   jsonb_build_object('ncf', $2::text, 'proveedor', $3::text, 'subtotal', $4::text))`,
          [proveedorId, ncf, proveedor.nombre, subtotal],
        ),
      ).catch((e) => console.error("[contabilidad] no se pudo registrar la alerta", e));
      return { estado: "factura_duplicada" };
    }
    if (mensaje.includes("factura_proveedor_check") || mensaje.includes("check constraint")) {
      return { estado: "monto_invalido" };
    }
    return { estado: estadoDeError(error) };
  }
}

export async function aprobarFactura(
  _previo: EstadoProveedor,
  datos: FormData,
): Promise<EstadoProveedor> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.aprobar")) return { estado: "no_permitido" };

  const id = texto(datos, "id", 40);
  if (!esUuid(id)) return { estado: "no_encontrado" };
  const factura = await consultarUna<{ estado: string; creado_por: string }>(
    `SELECT estado, creado_por FROM contabilidad.factura_proveedor WHERE id = $1`,
    [id],
  );
  if (!factura) return { estado: "no_encontrado" };
  if (factura.estado !== "borrador") return { estado: "no_es_borrador" };

  // Quien registra no aprueba (§2.2), con la misma salida que los recibos.
  let motivo: string | undefined;
  if (factura.creado_por === usuario.id) {
    if ((await otrosConPermiso(usuario.id, "contabilidad.aprobar")) > 0) return { estado: "mismo_usuario" };
    motivo = "Aprobada por quien la registró: es la única cuenta con contabilidad.aprobar.";
  }

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      if (motivo) await fijarAccion(cliente, "aprobar", motivo);
      await cliente.query(`SELECT contabilidad.aprobar_factura($1)`, [id]);
    });
    refrescar();
    return { estado: "ok", id };
  } catch (error) {
    return { estado: estadoDeError(error) };
  }
}

export async function anularFactura(
  _previo: EstadoProveedor,
  datos: FormData,
): Promise<EstadoProveedor> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.aprobar")) return { estado: "no_permitido" };

  const id = texto(datos, "id", 40);
  const motivo = texto(datos, "motivo", 500);
  if (!esUuid(id)) return { estado: "no_encontrado" };
  if (motivo.length < 5) return { estado: "motivo_requerido" };

  try {
    await enTransaccionComo(await contextoDe(usuario), (cliente) =>
      cliente.query(`SELECT contabilidad.anular_factura($1, $2)`, [id, motivo]),
    );
    refrescar();
    return { estado: "ok", id };
  } catch (error) {
    if (error instanceof Error && error.message.includes("tiene pagos")) return { estado: "tiene_pagos" };
    return { estado: estadoDeError(error) };
  }
}

/** La factura escaneada, en el bucket privado, con su sha256. */
export async function adjuntarFactura(
  _previo: EstadoProveedor,
  datos: FormData,
): Promise<EstadoProveedor> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.registrar")) return { estado: "no_permitido" };

  const id = texto(datos, "id", 40);
  const archivo = datos.get("archivo");
  if (!esUuid(id)) return { estado: "no_encontrado" };
  if (!(archivo instanceof File) || archivo.size === 0 || archivo.size > MAXIMO_ADJUNTO
      || !(TIPOS_ADJUNTO as readonly string[]).includes(archivo.type)) {
    return { estado: "archivo_invalido" };
  }

  const factura = await consultarUna<{ carpeta: string }>(
    `SELECT to_char(fecha_emision, 'YYYY/MM') AS carpeta FROM contabilidad.factura_proveedor WHERE id = $1`,
    [id],
  );
  if (!factura) return { estado: "no_encontrado" };

  const extension = archivo.type === "application/pdf" ? "pdf" : archivo.type.split("/")[1];
  const ruta = `${factura.carpeta}/facturas/${id}/${randomUUID()}.${extension}`;
  const sha256 = createHash("sha256").update(Buffer.from(await archivo.arrayBuffer())).digest("hex");
  const subida = await subirContable(ruta, archivo);
  if (!subida.ok) return { estado: "error" };

  try {
    await enTransaccionComo(await contextoDe(usuario), (cliente) =>
      cliente.query(
        `INSERT INTO contabilidad.factura_adjunto (factura_id, ruta, nombre, tipo_mime, tamano, sha256, subido_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, ruta, archivo.name.slice(0, 200), archivo.type, archivo.size, sha256, usuario.id],
      ),
    );
    refrescar();
    return { estado: "ok", id };
  } catch (error) {
    return { estado: estadoDeError(error) };
  }
}
