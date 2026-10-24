"use server";

import { revalidatePath } from "next/cache";
import type { PoolClient } from "pg";

import { requerirUsuario, type UsuarioSesion } from "@/lib/auth";
import { enTransaccionComo } from "@/lib/db";
import { esFechaIso, esUuid, montoValido } from "@/lib/contabilidad/formato";
import { limpiarIdentificacion, rncValido } from "@/lib/contabilidad/identificacion";
import { usuarioTienePermiso, type Permiso } from "@/lib/rbac";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { FORMA_PARAMETRO_SQL } from "@/server/contabilidad/configuracion/consultas";
import { contextoDe, estadoDeError, type EstadoErrorContable } from "@/server/contabilidad/sesion";

/**
 * Escrituras de Configuración contable (§4.13).
 *
 * Dos permisos distintos, porque son dos responsabilidades distintas:
 * `configurar` toca la entidad, los parámetros y el catálogo; cerrar y
 * reabrir un período es `cerrar_periodo`, que congela o descongela meses
 * enteros de registros. `super_admin` no tiene ninguno de los dos: audita.
 *
 * Todo va por `enTransaccionComo`: la bitácora de la base aborta cualquier
 * escritura sin usuario. Nada se borra: un parámetro nuevo cierra el
 * anterior, una cuenta se desactiva.
 */

export type EstadoConfig = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "no_encontrado"
    | "datos_invalidos"
    | "rnc_invalido"
    | "email_invalido"
    | "cifra_invalida"
    | "fecha_invalida"
    | "fecha_anterior"
    | "fecha_solapada"
    | "fecha_en_periodo_cerrado"
    | "forma_no_editable"
    | "periodo_con_borradores"
    | "periodo_no_abierto"
    | "periodo_no_cerrado"
    | "motivo_requerido"
    | "codigo_invalido"
    | "codigo_repetido"
    | "padre_inactivo"
    | "padre_con_movimientos"
    | "padre_en_uso"
    | "cuenta_con_saldo"
    | "subcuentas_activas"
    | "cuenta_en_uso"
    | EstadoErrorContable;
};

type Estado = EstadoConfig["estado"];

function texto(datos: FormData, campo: string, maximo: number): string {
  return String(datos.get(campo) ?? "").trim().slice(0, maximo);
}

/** El permiso se comprueba aquí y no solo en la página: una acción se puede llamar sin pasar por ella. */
async function usuarioCon(permiso: Permiso): Promise<UsuarioSesion | null> {
  const usuario = await requerirUsuario();
  return usuarioTienePermiso(usuario, permiso) ? usuario : null;
}

/** Errores que lanzan las funciones de 0048 con un texto fijo. */
const ERRORES_SQL = [
  "periodo_con_borradores",
  "periodo_no_abierto",
  "periodo_no_cerrado",
  "motivo_requerido",
] as const;

function traducirError(error: unknown): Estado {
  const mensaje = error instanceof Error ? error.message : String(error);
  const conocido = ERRORES_SQL.find((clave) => mensaje.includes(clave));
  if (conocido) return conocido;
  if ((error as { code?: string })?.code === "23505") return "codigo_repetido";
  return estadoDeError(error);
}

/** Error de negocio dentro de la transacción: aborta y llega a la pantalla con su estado. */
class Rechazo extends Error {
  constructor(public readonly estado: Estado) {
    super(estado);
  }
}

async function ejecutar(
  usuario: UsuarioSesion,
  trabajo: (cliente: PoolClient) => Promise<void>,
): Promise<EstadoConfig> {
  try {
    await enTransaccionComo(await contextoDe(usuario), trabajo);
  } catch (error) {
    if (error instanceof Rechazo) return { estado: error.estado };
    return { estado: traducirError(error) };
  }
  revalidatePath("/[locale]/contabilidad/configuracion", "page");
  return { estado: "ok" };
}

// ----------------------------------------------------------------
// Entidad
// ----------------------------------------------------------------

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONO = /^[0-9+()\-\s.]{7,25}$/;

export async function guardarEntidad(_previo: EstadoConfig, datos: FormData): Promise<EstadoConfig> {
  const usuario = await usuarioCon("contabilidad.configurar");
  if (!usuario) return { estado: "no_permitido" };

  const razonSocial = texto(datos, "razon_social", 200);
  const nombreComercial = texto(datos, "nombre_comercial", 200) || null;
  const rnc = limpiarIdentificacion(texto(datos, "rnc", 20)) || null;
  const mes = Number(texto(datos, "inicio_ejercicio_mes", 2));
  const decimales = Number(texto(datos, "decimales", 1));
  const direccion = texto(datos, "direccion", 300) || null;
  const telefono = texto(datos, "telefono", 25) || null;
  const email = texto(datos, "email", 160).toLowerCase() || null;

  if (!razonSocial || !Number.isInteger(mes) || mes < 1 || mes > 12
      || !Number.isInteger(decimales) || decimales < 0 || decimales > 4
      || (telefono && !TELEFONO.test(telefono))) {
    return { estado: "datos_invalidos" };
  }
  // El RNC sale en cada formato de la DGII: uno con el verificador mal
  // haría rechazar el envío entero, así que se valida el dígito y no solo
  // que sean nueve.
  if (rnc && !rncValido(rnc)) return { estado: "rnc_invalido" };
  if (email && !EMAIL.test(email)) return { estado: "email_invalido" };

  // `emision_comprobantes_habilitada` no se toca: la Fundación no emite
  // e-CF y encenderla sin un facturador homologado detrás sería mentirle
  // a la DGII. No hay campo que la reciba.
  return ejecutar(usuario, async (cliente) => {
    const { rowCount } = await cliente.query(
      `UPDATE contabilidad.entidad
          SET razon_social = $1, nombre_comercial = $2, rnc = $3, inicio_ejercicio_mes = $4,
              decimales = $5, direccion = $6, telefono = $7, email = $8,
              actualizado_por = $9, actualizado_en = now()
        WHERE id`,
      [razonSocial, nombreComercial, rnc, mes, decimales, direccion, telefono, email, usuario.id],
    );
    if (!rowCount) throw new Rechazo("no_encontrado");
  });
}

// ----------------------------------------------------------------
// Parámetros legales
// ----------------------------------------------------------------

/**
 * "18" → "0.18", "2.87" → "0.0287". Se corre la coma sobre los dígitos en
 * texto: 2.87 / 100 en float da 0.028700000000000003, y ese número acabaría
 * guardado en el jsonb.
 */
function porcentajeAFraccion(porcentaje: string): string | null {
  const limpio = porcentaje.trim().replace(",", ".");
  const partes = /^(\d{1,3})(?:\.(\d{1,4}))?$/.exec(limpio);
  if (!partes) return null;
  const [, entero, decimales = ""] = partes;
  if (Number(entero) > 100 || (Number(entero) === 100 && /[1-9]/.test(decimales))) return null;

  const escala = decimales.length + 2;
  const digitos = ((entero + decimales).replace(/^0+/, "") || "0").padStart(escala + 1, "0");
  const fraccion = `${digitos.slice(0, -escala)}.${digitos.slice(-escala)}`;
  return fraccion.replace(/0+$/, "").replace(/\.$/, "");
}

type UltimaVigencia = { id: string; desde: string; hasta: string | null; forma: string };

/**
 * Una vigencia nueva: inserta la fila y cierra la anterior en la misma
 * transacción. El valor anterior NO se edita: los cálculos de un mes ya
 * pasado tienen que seguir dando lo mismo (§1.9).
 */
export async function nuevaVigencia(_previo: EstadoConfig, datos: FormData): Promise<EstadoConfig> {
  const usuario = await usuarioCon("contabilidad.configurar");
  if (!usuario) return { estado: "no_permitido" };

  const clave = texto(datos, "clave", 120);
  const desde = texto(datos, "desde", 10);
  const cifraTexto = texto(datos, "cifra", 20);
  const fuente = texto(datos, "fuente", 200);
  const nota = texto(datos, "nota", 500) || null;

  if (!clave || fuente.length < 3) return { estado: "datos_invalidos" };
  if (!esFechaIso(desde)) return { estado: "fecha_invalida" };

  return ejecutar(usuario, async (cliente) => {
    // Dos personas cargando a la vez la misma clave podrían cerrar la misma
    // fila dos veces; el bloqueo por clave las pone en fila.
    await cliente.query(`SELECT pg_advisory_xact_lock(hashtext('contabilidad.parametro:' || $1))`, [clave]);

    const { rows } = await cliente.query<UltimaVigencia>(
      `SELECT p.id, to_char(p.vigente_desde, 'YYYY-MM-DD') AS desde,
              to_char(p.vigente_hasta, 'YYYY-MM-DD') AS hasta, ${FORMA_PARAMETRO_SQL} AS forma
         FROM contabilidad.parametro p
        WHERE p.clave = $1
        ORDER BY p.vigente_desde DESC
        LIMIT 1`,
      [clave],
    );
    const ultima = rows[0];
    if (!ultima) throw new Rechazo("no_encontrado");
    if (ultima.forma !== "tasa" && ultima.forma !== "monto") throw new Rechazo("forma_no_editable");

    const cifra = ultima.forma === "tasa" ? porcentajeAFraccion(cifraTexto) : montoValido(cifraTexto);
    if (cifra === null) throw new Rechazo("cifra_invalida");
    // Las fechas ISO se comparan bien como texto.
    if (desde <= ultima.desde) throw new Rechazo("fecha_anterior");
    if (ultima.hasta && desde < ultima.hasta) throw new Rechazo("fecha_solapada");

    // Un mes cerrado ya se calculó con la tasa de entonces: una vigencia
    // que empiece dentro de él cambiaría lo que dicen sus libros.
    const cerrado = await cliente.query(
      `SELECT 1 FROM contabilidad.periodo_contable
        WHERE estado = 'cerrado'
          AND (make_date(anio, mes, 1) + interval '1 month')::date > $1::date
        LIMIT 1`,
      [desde],
    );
    if (cerrado.rowCount) throw new Rechazo("fecha_en_periodo_cerrado");

    if (!ultima.hasta) {
      await cliente.query(
        `UPDATE contabilidad.parametro SET vigente_hasta = $2::date WHERE id = $1 AND vigente_hasta IS NULL`,
        [ultima.id, desde],
      );
    }

    // El valor nuevo copia la forma del anterior (y sus otras claves, como
    // los conceptos de una retención): solo cambia la cifra. `to_jsonb` de
    // un NUMERIC guarda el decimal exacto.
    await cliente.query(
      `INSERT INTO contabilidad.parametro (clave, valor, vigente_desde, fuente, nota)
       SELECT p.clave,
              CASE WHEN jsonb_typeof(p.valor) = 'object'
                   THEN jsonb_set(p.valor, ARRAY[$2::text], to_jsonb($3::numeric))
                   ELSE to_jsonb($3::numeric) END,
              $4::date, $5, $6
         FROM contabilidad.parametro p
        WHERE p.id = $1`,
      [ultima.id, ultima.forma, cifra, desde, fuente, nota],
    );
  });
}

// ----------------------------------------------------------------
// Períodos
// ----------------------------------------------------------------

export async function cerrarPeriodo(_previo: EstadoConfig, datos: FormData): Promise<EstadoConfig> {
  const usuario = await usuarioCon("contabilidad.cerrar_periodo");
  if (!usuario) return { estado: "no_permitido" };

  const id = texto(datos, "id", 40);
  if (!esUuid(id)) return { estado: "no_encontrado" };

  return ejecutar(usuario, async (cliente) => {
    await fijarAccion(cliente, "cerrar_periodo");
    await cliente.query(`SELECT contabilidad.cerrar_periodo($1)`, [id]);
  });
}

export async function reabrirPeriodo(_previo: EstadoConfig, datos: FormData): Promise<EstadoConfig> {
  const usuario = await usuarioCon("contabilidad.cerrar_periodo");
  if (!usuario) return { estado: "no_permitido" };

  const id = texto(datos, "id", 40);
  const motivo = texto(datos, "motivo", 500);
  if (!esUuid(id)) return { estado: "no_encontrado" };
  // La base vuelve a exigirlo; aquí se corta antes para no abrir una
  // transacción que va a fallar.
  if (motivo.length < 10) return { estado: "motivo_requerido" };

  return ejecutar(usuario, async (cliente) => {
    await fijarAccion(cliente, "reabrir_periodo", motivo);
    await cliente.query(`SELECT contabilidad.reabrir_periodo($1, $2)`, [id, motivo]);
  });
}

// ----------------------------------------------------------------
// Catálogo de cuentas
// ----------------------------------------------------------------

type CuentaBloqueada = {
  id: string;
  codigo: string;
  tipo: string;
  activa: boolean;
  admite_movimiento: boolean;
  padre_activo: boolean | null;
};

async function bloquearCuenta(cliente: PoolClient, id: string): Promise<CuentaBloqueada> {
  const { rows } = await cliente.query<CuentaBloqueada>(
    `SELECT c.id, c.codigo, c.tipo, c.activa, c.admite_movimiento, p.activa AS padre_activo
       FROM contabilidad.cuenta_contable c
       LEFT JOIN contabilidad.cuenta_contable p ON p.id = c.padre_id
      WHERE c.id = $1
        FOR UPDATE OF c`,
    [id],
  );
  if (!rows[0]) throw new Rechazo("no_encontrado");
  return rows[0];
}

/**
 * Categorías, cuentas bancarias, cajas y recibos que escriben asientos
 * contra esta cuenta. Si deja de ser hoja o se desactiva, el siguiente
 * recibo de esa categoría fallaría al contabilizar.
 */
async function cuentaEnUso(cliente: PoolClient, id: string): Promise<boolean> {
  const { rowCount } = await cliente.query(
    `SELECT 1 FROM contabilidad.categoria WHERE cuenta_id = $1 AND activa
     UNION ALL
     SELECT 1 FROM contabilidad.cuenta_bancaria WHERE cuenta_contable_id = $1 AND estado = 'activa'
     UNION ALL
     SELECT 1 FROM contabilidad.caja WHERE cuenta_contable_id = $1 AND estado = 'activa'
     UNION ALL
     SELECT 1 FROM contabilidad.recibo WHERE cuenta_contrapartida_id = $1 AND estado = 'borrador'
     LIMIT 1`,
    [id],
  );
  return Boolean(rowCount);
}

const SEGMENTO = /^\d{1,4}$/;

export async function crearSubcuenta(_previo: EstadoConfig, datos: FormData): Promise<EstadoConfig> {
  const usuario = await usuarioCon("contabilidad.configurar");
  if (!usuario) return { estado: "no_permitido" };

  const padreId = texto(datos, "padre_id", 40);
  const codigo = texto(datos, "codigo", 40);
  const nombre = texto(datos, "nombre", 160);
  if (!esUuid(padreId)) return { estado: "no_encontrado" };
  if (!nombre) return { estado: "datos_invalidos" };

  return ejecutar(usuario, async (cliente) => {
    const padre = await bloquearCuenta(cliente, padreId);
    if (!padre.activa) throw new Rechazo("padre_inactivo");
    // El código dice dónde está la cuenta en el árbol: una hija cuyo
    // código no empiece por el del padre se perdería en los reportes.
    if (!codigo.startsWith(`${padre.codigo}.`) || !SEGMENTO.test(codigo.slice(padre.codigo.length + 1))) {
      throw new Rechazo("codigo_invalido");
    }

    const repetido = await cliente.query(
      `SELECT 1 FROM contabilidad.cuenta_contable WHERE codigo = $1`,
      [codigo],
    );
    if (repetido.rowCount) throw new Rechazo("codigo_repetido");

    if (padre.admite_movimiento) {
      // Una cuenta con movimientos que pasa a tener hijas dejaría su saldo
      // en un nivel que ya no recibe asientos: el saldo no se movería nunca.
      const movimientos = await cliente.query(
        `SELECT 1 FROM contabilidad.asiento_linea WHERE cuenta_id = $1 LIMIT 1`,
        [padre.id],
      );
      if (movimientos.rowCount) throw new Rechazo("padre_con_movimientos");
      if (await cuentaEnUso(cliente, padre.id)) throw new Rechazo("padre_en_uso");
      await cliente.query(
        `UPDATE contabilidad.cuenta_contable SET admite_movimiento = false WHERE id = $1`,
        [padre.id],
      );
    }

    await cliente.query(
      `INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo, padre_id, admite_movimiento)
       VALUES ($1, $2, $3, $4, true)`,
      [codigo, nombre, padre.tipo, padre.id],
    );
  });
}

export async function renombrarCuenta(_previo: EstadoConfig, datos: FormData): Promise<EstadoConfig> {
  const usuario = await usuarioCon("contabilidad.configurar");
  if (!usuario) return { estado: "no_permitido" };

  const id = texto(datos, "id", 40);
  const nombre = texto(datos, "nombre", 160);
  if (!esUuid(id)) return { estado: "no_encontrado" };
  if (!nombre) return { estado: "datos_invalidos" };

  return ejecutar(usuario, async (cliente) => {
    const { rowCount } = await cliente.query(
      `UPDATE contabilidad.cuenta_contable SET nombre = $2 WHERE id = $1`,
      [id, nombre],
    );
    if (!rowCount) throw new Rechazo("no_encontrado");
  });
}

export async function cambiarEstadoCuenta(_previo: EstadoConfig, datos: FormData): Promise<EstadoConfig> {
  const usuario = await usuarioCon("contabilidad.configurar");
  if (!usuario) return { estado: "no_permitido" };

  const id = texto(datos, "id", 40);
  const activar = texto(datos, "activar", 1) === "1";
  if (!esUuid(id)) return { estado: "no_encontrado" };

  return ejecutar(usuario, async (cliente) => {
    const cuenta = await bloquearCuenta(cliente, id);
    if (cuenta.activa === activar) return;

    if (activar) {
      if (cuenta.padre_activo === false) throw new Rechazo("padre_inactivo");
    } else {
      // Una cuenta con saldo que desaparece del catálogo descuadra el
      // balance: primero se traslada el saldo con un asiento.
      const saldo = await cliente.query(
        `SELECT 1 FROM contabilidad.asiento_linea WHERE cuenta_id = $1
          HAVING sum(debe) - sum(haber) <> 0`,
        [id],
      );
      if (saldo.rowCount) throw new Rechazo("cuenta_con_saldo");
      const hijas = await cliente.query(
        `SELECT 1 FROM contabilidad.cuenta_contable WHERE padre_id = $1 AND activa LIMIT 1`,
        [id],
      );
      if (hijas.rowCount) throw new Rechazo("subcuentas_activas");
      if (await cuentaEnUso(cliente, id)) throw new Rechazo("cuenta_en_uso");
    }

    await cliente.query(
      `UPDATE contabilidad.cuenta_contable SET activa = $2 WHERE id = $1`,
      [id, activar],
    );
  });
}
