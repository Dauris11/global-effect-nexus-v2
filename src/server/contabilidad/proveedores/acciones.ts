"use server";

import { createHash, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { requerirPermiso, requerirUsuario } from "@/lib/auth";
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
import {
  calcularMontoRetencion,
  retencionPorCodigo,
} from "@/lib/contabilidad/retenciones-dgii";
import { esPilarCosto } from "@/lib/costos";
import { usuarioTienePermiso } from "@/lib/rbac";
import { subirContable } from "@/lib/supabase/almacen";
import type { VistaAsiento } from "@/lib/contabilidad/vista-asiento";
import { vistaDeAsientoContabilizado } from "@/server/contabilidad/asientos/vista";
import { errorDeCodigoSql, vistaPreviaDeFactura } from "@/server/contabilidad/proveedores/asiento";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import {
  contextoDe,
  estadoDeError,
  otrosConPermiso,
  type EstadoErrorContable,
} from "@/server/contabilidad/sesion";
import {
  leerFacturaOcr,
  type DatosFacturaLeidos,
} from "@/server/contabilidad/facturas/ocr";


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
    | "proveedor_codigo_sin_cuenta"
    | "proveedor_cuenta_no_valida"
    | EstadoErrorContable;
  id?: string;
  /** Nombre del código de transacción implicado (para el texto del error). */
  codigo?: string;
};

function texto(datos: FormData, campo: string, maximo = 200): string {
  return String(datos.get(campo) ?? "").trim().slice(0, maximo);
}

function idOpcional(datos: FormData, campo: string): string | null {
  const valor = texto(datos, campo, 40);
  return esUuid(valor) ? valor : null;
}

function refrescar(): void {
  revalidatePath("/[locale]/contabilidad", "layout");
  revalidatePath("/[locale]/portal/contabilidad", "page");
}

export type DatosRncDgii = {
  nombreRazonSocial: string;
  nombreComercial: string;
  actividadEconomica: string;
  administracionLocal: string;
};

export type ResultadoConsultaRnc =
  | { ok: true; datos: DatosRncDgii }
  | { ok: false; error: "no_permitido" | "sin_guiones" | "formato_invalido" | "no_encontrado" | "servicio_no_disponible" };

/**
 * Consulta la ficha DGII (https://rnc.megaplus.com.do/api/consulta) solo sin guiones
 * y devuelve exclusivamente los cuatro campos autorizados para proveedores.
 */
export async function consultarRncProveedorAction(rncCrudo: string): Promise<ResultadoConsultaRnc> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.registrar")) {
    return { ok: false, error: "no_permitido" };
  }

  const entrada = String(rncCrudo ?? "").trim();
  if (entrada.includes("-")) return { ok: false, error: "sin_guiones" };
  if (!/^[0-9]{9}$|^[0-9]{11}$/.test(entrada)) return { ok: false, error: "formato_invalido" };

  try {
    const res = await fetch(`https://rnc.megaplus.com.do/api/consulta?rnc=${encodeURIComponent(entrada)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    const data = (await res.json().catch(() => null)) as {
      error?: boolean;
      codigo_http?: number;
      nombre_razon_social?: string | null;
      nombre_comercial?: string | null;
      actividad_economica?: string | null;
      administracion_local?: string | null;
    } | null;

    if (res.status === 404 || data?.codigo_http === 404) {
      return { ok: false, error: "no_encontrado" };
    }
    if (res.status === 400 || data?.codigo_http === 400) {
      return { ok: false, error: "formato_invalido" };
    }
    if (!res.ok || !data || data.error) {
      return { ok: false, error: "servicio_no_disponible" };
    }

    return {
      ok: true,
      datos: {
        nombreRazonSocial: String(data.nombre_razon_social ?? "").trim(),
        nombreComercial: String(data.nombre_comercial ?? "").trim(),
        actividadEconomica: String(data.actividad_economica ?? "").trim(),
        administracionLocal: String(data.administracion_local ?? "").trim(),
      },
    };
  } catch {
    return { ok: false, error: "servicio_no_disponible" };
  }
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
    texto(datos, "actividad_economica", 300) || null,
    texto(datos, "administracion_local", 160) || null,
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
                    actividad_economica = $6, administracion_local = $7,
                    contacto = $8, telefono = $9, email = $10, direccion = $11,
                    condiciones_pago_dias = $12, categoria_id = $13, estado = $14
              WHERE id = $1 RETURNING id`,
            [id, ...valores],
          )
        : await cliente.query<{ id: string }>(
            `INSERT INTO contabilidad.proveedor
               (tipo, identificacion, nombre, nombre_comercial, actividad_economica,
                administracion_local, contacto, telefono, email, direccion,
                condiciones_pago_dias, categoria_id, estado, creado_por)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
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
  // Al ser una entidad sin fines de lucro (ASFL), no se registra ITBIS por separado en la factura.
  const itbis = "0";
  const tipoRetencionIsr = texto(datos, "tipo_retencion_isr", 60) || null;
  const tipoRetencionItbis = texto(datos, "tipo_retencion_itbis", 60) || null;
  const cuentaGastoId = idOpcional(datos, "cuenta_gasto_id");
  const categoria = idOpcional(datos, "categoria");
  const fondo = idOpcional(datos, "fondo");
  const concepto = texto(datos, "concepto");

  if (id && !esUuid(id)) return { estado: "no_encontrado" };
  if (!proveedorId || !esFechaIso(emision) || !esFechaIso(vencimiento) || vencimiento < emision
      || !esMoneda(moneda) || !cuentaGastoId || !fondo || !concepto) {
    return { estado: "datos_invalidos" };
  }
  if (!subtotal) return { estado: "monto_invalido" };
  if (tipoRetencionIsr && retencionPorCodigo(tipoRetencionIsr)?.impuesto !== "isr") {
    return { estado: "datos_invalidos" };
  }
  if (tipoRetencionItbis && retencionPorCodigo(tipoRetencionItbis)?.impuesto !== "itbis") {
    return { estado: "datos_invalidos" };
  }

  const cuentaGastoValida = await consultarUna<{ ok: boolean }>(
    `SELECT (activa AND admite_movimiento) AS ok
       FROM contabilidad.cuenta_contable
      WHERE id = $1`,
    [cuentaGastoId],
  );
  if (!cuentaGastoValida?.ok) return { estado: "datos_invalidos" };

  // Las retenciones se calculan en el servidor a partir del monto y del tipo elegido.
  const isr = tipoRetencionIsr ? calcularMontoRetencion(subtotal, tipoRetencionIsr) : "0";
  const retItbis = tipoRetencionItbis ? calcularMontoRetencion(subtotal, tipoRetencionItbis) : "0";
  const tasa = moneda === "USD" ? tasaValida(texto(datos, "tasa", 20)) : null;
  if (moneda === "USD" && !tasa) return { estado: "tasa_requerida" };

  const proveedor = await consultarUna<{ tipo: string; nombre: string }>(
    `SELECT tipo, nombre FROM contabilidad.proveedor WHERE id = $1`,
    [proveedorId],
  );
  if (!proveedor) return { estado: "no_encontrado" };
  if (ncf && !ncfValido(ncf)) return { estado: "ncf_invalido" };
  if (!ncf && proveedor.tipo === "juridica") return { estado: "ncf_requerido" };

  const solicitante = idOpcional(datos, "solicitante");
  const programa = texto(datos, "programa", 60) || null;
  // Costo por estudiante (0112): opcional. El pilar solo cuenta si hay estudiante.
  const estudiante = idOpcional(datos, "estudiante");
  if (estudiante && !esUuid(estudiante)) return { estado: "datos_invalidos" };
  const pilarCrudo = texto(datos, "pilar_costo", 20);
  if (estudiante && pilarCrudo && !esPilarCosto(pilarCrudo)) return { estado: "datos_invalidos" };
  const pilar = estudiante && esPilarCosto(pilarCrudo) ? pilarCrudo : null;

  const valores = [
    proveedorId, ncf, emision, vencimiento, moneda, tasa, subtotal, itbis, isr, retItbis,
    tipoRetencionIsr, tipoRetencionItbis,
    concepto, cuentaGastoId, categoria, fondo, idOpcional(datos, "proyecto"), solicitante, programa,
    estudiante, pilar,
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
                    tipo_retencion_isr = $12, tipo_retencion_itbis = $13,
                    concepto = $14, cuenta_gasto_id = $15, categoria_id = $16, fondo_id = $17,
                    proyecto_id = $18, solicitante_id = $19, programa_codigo = $20,
                    estudiante_id = $21, pilar_costo = $22
              WHERE id = $1 AND estado = 'borrador' RETURNING id`,
            [id, ...valores],
          )
        : await cliente.query<{ id: string }>(
            `INSERT INTO contabilidad.factura_proveedor
               (numero, proveedor_id, ncf, fecha_emision, fecha_vencimiento, periodo_id, moneda, tasa,
                subtotal, itbis, retencion_isr, retencion_itbis, tipo_retencion_isr, tipo_retencion_itbis,
                concepto, cuenta_gasto_id, categoria_id, fondo_id, proyecto_id, solicitante_id,
                programa_codigo, estudiante_id, pilar_costo, creado_por)
             VALUES (contabilidad.siguiente_numero('FP'), $1, $2, $3, $4, contabilidad.periodo_para($3),
                     $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
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
    // Sin cuenta asignada a un código de proveedores: se dice cuál, no «error».
    const deCodigo = await errorDeCodigoSql(error);
    if (deCodigo) return deCodigo;
    return { estado: estadoDeError(error) };
  }
}

/**
 * Opción «Asiento» de una factura: antes de aprobarla, el asiento que saldría
 * (con lo que falte); ya aprobada, el asiento real. Mostrarlo es leer
 * contabilidad, no aprobar.
 */
export async function asientoDeFactura(id: string): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  if (!esUuid(id)) throw new Error("Factura no válida.");
  const factura = await consultarUna<{ asiento_id: string | null }>(
    `SELECT asiento_id FROM contabilidad.factura_proveedor WHERE id = $1`,
    [id],
  );
  if (!factura) throw new Error("Factura no encontrada.");
  return factura.asiento_id ? vistaDeAsientoContabilizado(factura.asiento_id) : vistaPreviaDeFactura(id);
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

export type ResultadoOcrFacturaAction =
  | { exito: true; datos: DatosFacturaLeidos }
  | { exito: false; error: string };

export async function procesarFacturaOcrAction(
  formData: FormData,
): Promise<ResultadoOcrFacturaAction> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.registrar")) {
    return { exito: false, error: "No tienes permiso para registrar facturas." };
  }

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) {
    return { exito: false, error: "Archivo no recibido o inválido." };
  }

  try {
    const res = await leerFacturaOcr(archivo, usuario.id);
    if (res.estado === "ok") {
      return { exito: true, datos: res.datos };
    }
    if (res.estado === "tipo_no_admitido") {
      return { exito: false, error: "Formato no admitido. Sube imagen (JPG, PNG, WebP) o PDF." };
    }
    if (res.estado === "demasiado_grande") {
      return { exito: false, error: "El archivo excede el tamaño máximo permitido (5 MB)." };
    }
    if (res.estado === "sin_clave") {
      return { exito: false, error: "Servicio de OCR no configurado (falta clave de IA)." };
    }
    if (res.estado === "ilegible") {
      return {
        exito: false,
        error: "No se pudieron extraer datos legibles. Verifica la nitidez del comprobante.",
      };
    }
    return { exito: false, error: "Error al procesar el escaneo OCR." };
  } catch (err: unknown) {
    return { exito: false, error: (err as Error).message || "Error al procesar el archivo." };
  }
}

