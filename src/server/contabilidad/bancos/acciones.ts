"use server";

import { revalidatePath } from "next/cache";

import { requerirUsuario } from "@/lib/auth";
import { consultar, consultarUna, enTransaccionComo } from "@/lib/db";
import { esFechaIso, esMoneda, esUuid, montoValido, tasaValida } from "@/lib/contabilidad/formato";
import {
  CODIGO_BCRD_TASAREAL,
  URL_BASE_TASAREAL,
  esCodigoInstitucionTasareal,
  estadoHorarioTasasRD,
} from "@/lib/contabilidad/tasareal";
import { claveDia } from "@/lib/fechas";
import { usuarioTienePermiso } from "@/lib/rbac";
import { notificarUsuario } from "@/server/compartidos/notificaciones";
import { obtenerAdaptador, type ColumnasEstado } from "@/server/contabilidad/bancos";
import { tasasActualizadasHoy } from "@/server/contabilidad/bancos/consultas";
import { claveDeTransaccion } from "@/lib/contabilidad/extracto";
import {
  decodificarCsvBanco,
  extraerTransaccionesBanco,
  normalizarReferenciaBanco,
  parsearVistaPreviaEstadoBanco,
  type FormatoEstadoBanco,
} from "@/lib/contabilidad/formato-estado-banco";
import { problemaDeErrorSql } from "@/server/contabilidad/asientos/vista-sql";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { contextoDe, estadoDeError, type EstadoErrorContable } from "@/server/contabilidad/sesion";

/**
 * Transferencias entre cuentas propias, tasa del día, estado de cuenta y
 * conciliación.
 *
 * Una transferencia mueve dinero en el acto (dos movimientos y un asiento),
 * por eso exige `aprobar` y no solo `registrar`. Conciliar exige
 * `conciliar`. La tasa es un dato de configuración del día y la registra
 * quien registra.
 */

export type EstadoBanco = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "datos_invalidos"
    | "monto_invalido"
    | "misma_cuenta"
    | "archivo_invalido"
    | "archivo_vacio"
    | "montos_distintos"
    /** Un código de transacción (p. ej. la ganancia cambiaria) sin cuenta válida; `detalle` trae el código. */
    | "tesoreria_codigo_sin_cuenta"
    | EstadoErrorContable;
  /** Error de lectura del CSV ("Línea 12: fecha inválida…"). Es dato, no texto de interfaz. */
  detalle?: string;
  id?: string;
  /** Subida del estado de cuenta: transacciones nuevas, repetidas y conciliadas automáticamente. */
  nuevas?: number;
  repetidas?: number;
  conciliadasAuto?: number;
};

function texto(datos: FormData, campo: string, maximo = 200): string {
  return String(datos.get(campo) ?? "").trim().slice(0, maximo);
}

export async function transferirEntreCuentas(
  _previo: EstadoBanco,
  datos: FormData,
): Promise<EstadoBanco> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.aprobar")) return { estado: "no_permitido" };

  const origen = texto(datos, "origen", 40);
  const destino = texto(datos, "destino", 40);
  const fecha = texto(datos, "fecha", 10);
  const concepto = texto(datos, "concepto");
  const montoOrigen = montoValido(texto(datos, "monto_origen", 20));
  const destinoTexto = texto(datos, "monto_destino", 20);
  // Vacío = lo mismo que salió (cuentas de la misma moneda).
  const montoDestino = destinoTexto ? montoValido(destinoTexto) : montoOrigen;
  const usarTarifa = datos.get("usar_tarifa") === "true" || datos.get("usar_tarifa") === "on";

  if (!esUuid(origen) || !esUuid(destino) || !esFechaIso(fecha) || !concepto) {
    return { estado: "datos_invalidos" };
  }
  if (origen === destino) return { estado: "misma_cuenta" };
  if (!montoOrigen || !montoDestino) return { estado: "monto_invalido" };

  try {
    const id = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      const { rows } = await cliente.query<{ id: string }>(
        `SELECT contabilidad.transferir($1, $2, $3, $4, $5, $6, $7, $8) AS id`,
        [origen, destino, fecha, montoOrigen, montoDestino, concepto, texto(datos, "referencia", 120) || null, usarTarifa],
      );
      return rows[0].id;
    });
    refrescar();
    return { estado: "ok", id };
  } catch (error) {
    // `linea_por_codigo` avisa con «codigo_sin_cuenta:CODIGO» o «cuenta_no_valida:CODIGO».
    const problema = problemaDeErrorSql(error);
    if (problema.clave === "codigo_sin_cuenta" || problema.clave === "cuenta_inactiva") {
      return { estado: "tesoreria_codigo_sin_cuenta", detalle: problema.codigo };
    }
    return { estado: estadoDeError(error) };
  }
}

/** Tasa DOP/USD de un día. Si ya hay una para esa fecha, se corrige. */
export async function registrarTasa(_previo: EstadoBanco, datos: FormData): Promise<EstadoBanco> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.registrar")) return { estado: "no_permitido" };

  const fecha = texto(datos, "fecha", 10);
  const compra = tasaValida(texto(datos, "compra", 20));
  const venta = tasaValida(texto(datos, "venta", 20));
  if (!esFechaIso(fecha) || !compra || !venta) return { estado: "datos_invalidos" };

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await cliente.query(
        `INSERT INTO contabilidad.tasa_cambio (fecha, compra, venta, fuente)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (fecha) DO UPDATE SET compra = EXCLUDED.compra, venta = EXCLUDED.venta,
                                           fuente = EXCLUDED.fuente`,
        [fecha, compra, venta, texto(datos, "fuente", 60) || "BCRD"],
      );
    });
    refrescar();
    return { estado: "ok" };
  } catch (error) {
    return { estado: estadoDeError(error) };
  }
}

/** Lee las columnas del formulario de subida; las precarga la configuración del banco. */
function columnasDe(datos: FormData): ColumnasEstado | null {
  const formato = texto(datos, "formato_fecha", 12);
  const columnas: ColumnasEstado = {
    fecha: texto(datos, "col_fecha", 60),
    descripcion: texto(datos, "col_descripcion", 60),
    referencia: texto(datos, "col_referencia", 60) || undefined,
    debito: texto(datos, "col_debito", 60) || undefined,
    credito: texto(datos, "col_credito", 60) || undefined,
    monto: texto(datos, "col_monto", 60) || undefined,
    saldo: texto(datos, "col_saldo", 60) || undefined,
    formatoFecha:
      formato === "YYYY-MM-DD" || formato === "MM/DD/YYYY" ? formato : "DD/MM/YYYY",
    separadorDecimal: texto(datos, "separador", 1) === "," ? "," : ".",
  };
  const completo = columnas.fecha && columnas.descripcion && (columnas.monto || columnas.debito || columnas.credito);
  return completo ? columnas : null;
}

/**
 * Sube el estado de cuenta (.csv) a la cuenta (Observaciones #1).
 *
 * Se puede subir cuantas veces haga falta, también archivos que se solapan:
 * cada transacción se reconoce por su referencia (`claveDeTransaccion`) y
 * la base ignora la que ya estaba (`ON CONFLICT DO NOTHING` sobre
 * `UNIQUE (cuenta_id, clave)`). La respuesta dice cuántas entraron y
 * cuántas se saltaron, para que el contable sepa que no se duplicó nada.
 * Dentro del mismo archivo también se descartan las repetidas.
 */
export async function subirEstadoBanco(_previo: EstadoBanco, datos: FormData): Promise<EstadoBanco> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.conciliar")) return { estado: "no_permitido" };

  const cuenta = texto(datos, "cuenta", 40);
  const archivo = datos.get("archivo");
  const columnas = columnasDe(datos);
  if (!esUuid(cuenta) || !columnas) return { estado: "datos_invalidos" };
  if (!(archivo instanceof File) || archivo.size === 0 || archivo.size > 5 * 1024 * 1024) {
    return { estado: "archivo_invalido" };
  }

  const banco = await consultarUna<{ adaptador: string }>(
    `SELECT b.adaptador FROM contabilidad.cuenta_bancaria cb
       JOIN contabilidad.banco b ON b.id = cb.banco_id
      WHERE cb.id = $1 AND cb.estado = 'activa'`,
    [cuenta],
  );
  if (!banco) return { estado: "datos_invalidos" };

  let movimientos;
  try {
    movimientos = obtenerAdaptador(banco.adaptador).parsearEstadoCuenta(await archivo.text(), columnas);
  } catch (error) {
    return { estado: "archivo_invalido", detalle: error instanceof Error ? error.message : undefined };
  }
  if (movimientos.length === 0) return { estado: "archivo_vacio" };

  const vistas = new Set<string>();
  const unicas = movimientos
    .map((m) => ({ ...m, clave: claveDeTransaccion(m) }))
    .filter((m) => (vistas.has(m.clave) ? false : (vistas.add(m.clave), true)));

  try {
    const nuevas = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      // Una sola sentencia con arreglos en vez de cien INSERT: la bitácora
      // igual escribe una fila por línea, pero el viaje a la base es uno.
      const { rowCount } = await cliente.query(
        `INSERT INTO contabilidad.extracto_linea
           (cuenta_id, fecha, descripcion, referencia, monto, saldo, clave, archivo_nombre, importado_por)
         SELECT $1, t.fecha, t.descripcion, t.referencia, t.monto, t.saldo, t.clave, $8, $9
           FROM unnest($2::date[], $3::text[], $4::text[], $5::numeric[], $6::numeric[], $7::text[])
                AS t(fecha, descripcion, referencia, monto, saldo, clave)
         ON CONFLICT (cuenta_id, clave) DO NOTHING`,
        [
          cuenta,
          unicas.map((m) => m.fecha),
          unicas.map((m) => m.descripcion.slice(0, 300)),
          unicas.map((m) => m.referencia),
          unicas.map((m) => m.monto),
          unicas.map((m) => m.saldo),
          unicas.map((m) => m.clave),
          archivo.name.slice(0, 200),
          usuario.id,
        ],
      );
      return rowCount ?? 0;
    });
    refrescar();
    return { estado: "ok", nuevas, repetidas: movimientos.length - nuevas };
  } catch (error) {
    return { estado: estadoDeError(error) };
  }
}

/**
 * Sube un estado de cuenta (.csv) usando un formato configurado en
 * `contabilidad.formato_estado_banco` (0126/0129):
 *   1. Decodifica UTF-8/Windows-1252, omite filas iniciales y fila de totales.
 *   2. Guarda cada transacción con sus columnas completas (`fecha_posteo`,
 *      `fecha`, `no_cheque`, `referencia`, `descripcion`, `retiros`,
 *      `depositos`, `monto`, `saldo`), saltando duplicados por `clave`.
 *   3. Concilia automáticamente las transacciones cuya referencia y monto
 *      coincidan exactamente con una línea sin conciliar del libro diario
 *      de la cuenta contable vinculada al banco.
 */
export async function subirEstadoFormatoBanco(
  _previo: EstadoBanco,
  datos: FormData,
): Promise<EstadoBanco> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.conciliar")) return { estado: "no_permitido" };

  const cuenta = texto(datos, "cuenta", 40);
  const formatoId = texto(datos, "formato_id", 40);
  const archivo = datos.get("archivo");
  if (!esUuid(cuenta) || !esUuid(formatoId)) return { estado: "datos_invalidos" };
  if (!(archivo instanceof File) || archivo.size === 0 || archivo.size > 5 * 1024 * 1024) {
    return { estado: "archivo_invalido" };
  }

  const [cuentaActiva, formato] = await Promise.all([
    consultarUna<{ id: string }>(
      `SELECT id FROM contabilidad.cuenta_bancaria WHERE id = $1 AND estado = 'activa'`,
      [cuenta],
    ),
    consultarUna<FormatoEstadoBanco>(
      `SELECT id, nombre, filas_omitir_inicio AS "filasOmitirInicio",
              omitir_ultima_fila AS "omitirUltimaFila", columnas, activo
         FROM contabilidad.formato_estado_banco
        WHERE id = $1 AND activo = true`,
      [formatoId],
    ),
  ]);
  if (!cuentaActiva || !formato) return { estado: "datos_invalidos" };

  let transacciones;
  try {
    const textoCsv = decodificarCsvBanco(await archivo.arrayBuffer());
    const vista = parsearVistaPreviaEstadoBanco(textoCsv, formato);
    if (vista.columnasFaltantes.length > 0) {
      return {
        estado: "archivo_invalido",
        detalle: `Faltan columnas: ${vista.columnasFaltantes.join(", ")}`,
      };
    }
    transacciones = extraerTransaccionesBanco(vista);
  } catch (error) {
    return { estado: "archivo_invalido", detalle: error instanceof Error ? error.message : undefined };
  }

  if (transacciones.length === 0) return { estado: "archivo_vacio" };

  const vistas = new Set<string>();
  const unicas = transacciones
    .map((t) => ({
      ...t,
      clave: claveDeTransaccion({
        fecha: t.fechaEfectiva,
        monto: t.monto,
        descripcion: t.descripcion,
        referencia: t.referencia,
      }),
    }))
    .filter((t) => (vistas.has(t.clave) ? false : (vistas.add(t.clave), true)));

  try {
    const { nuevas, conciliadasAuto } = await enTransaccionComo(
      await contextoDe(usuario),
      async (cliente) => {
        const { rowCount } = await cliente.query(
          `INSERT INTO contabilidad.extracto_linea
             (cuenta_id, fecha_posteo, fecha, no_cheque, referencia, descripcion,
              retiros, depositos, monto, saldo, clave, archivo_nombre, importado_por)
           SELECT $1, t.fecha_posteo, t.fecha, t.no_cheque, t.referencia, t.descripcion,
                  t.retiros, t.depositos, t.monto, t.saldo, t.clave, $12, $13
             FROM unnest(
                    $2::date[], $3::date[], $4::text[], $5::text[], $6::text[],
                    $7::numeric[], $8::numeric[], $9::numeric[], $10::numeric[], $11::text[]
                  ) AS t(fecha_posteo, fecha, no_cheque, referencia, descripcion,
                         retiros, depositos, monto, saldo, clave)
           ON CONFLICT (cuenta_id, clave) DO NOTHING`,
          [
            cuenta,
            unicas.map((m) => m.fechaPosteo),
            unicas.map((m) => m.fechaEfectiva),
            unicas.map((m) => m.noCheque),
            unicas.map((m) => m.referencia),
            unicas.map((m) => m.descripcion.slice(0, 300)),
            unicas.map((m) => m.retiros),
            unicas.map((m) => m.depositos),
            unicas.map((m) => m.monto),
            unicas.map((m) => m.saldo),
            unicas.map((m) => m.clave),
            archivo.name.slice(0, 200),
            usuario.id,
          ],
        );

        // Conciliación automática: misma referencia normalizada y mismo monto exacto.
        const { rows: pendientesBanco } = await cliente.query<{
          id: string;
          referencia: string;
          monto: string;
        }>(
          `SELECT e.id, e.referencia, e.monto::text AS monto
             FROM contabilidad.extracto_linea e
            WHERE e.cuenta_id = $1
              AND nullif(trim(e.referencia), '') IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM contabilidad.conciliacion_partida p
                 WHERE p.extracto_linea_id = e.id AND p.anulado_en IS NULL
              )
            ORDER BY e.fecha, e.id
            FOR UPDATE`,
          [cuenta],
        );

        const { rows: pendientesLibro } = await cliente.query<{
          id: string;
          referencia: string;
          monto: string;
        }>(
          `SELECT l.id,
                  coalesce(nullif(trim(r.referencia), ''), nullif(trim(ti.referencia), '')) AS referencia,
                  (l.debe - l.haber)::text AS monto
             FROM contabilidad.cuenta_bancaria cb
             JOIN contabilidad.asiento_linea l ON l.cuenta_id = cb.cuenta_contable_id
             JOIN contabilidad.asiento a ON a.id = l.asiento_id AND NOT a.anulado
             LEFT JOIN contabilidad.recibo r ON r.asiento_id = a.id
             LEFT JOIN contabilidad.transferencia_interna ti ON ti.asiento_id = a.id
            WHERE cb.id = $1
              AND coalesce(nullif(trim(r.referencia), ''), nullif(trim(ti.referencia), '')) IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM contabilidad.conciliacion_partida p
                 WHERE p.asiento_linea_id = l.id AND p.anulado_en IS NULL
              )
              AND NOT EXISTS (
                SELECT 1 FROM contabilidad.impuesto_cargo ic
                 WHERE ic.tipo_valor = 'fijo'
                   AND ic.proposito = 'transferencia'
                   AND l.descripcion = ic.nombre
              )
            ORDER BY a.fecha, a.numero, l.id
            FOR UPDATE OF l`,
          [cuenta],
        );

        const usadasLibro = new Set<string>();
        let conciliadas = 0;

        for (const ext of pendientesBanco) {
          const refExt = normalizarReferenciaBanco(ext.referencia);
          if (!refExt) continue;
          const montoExt = Number(ext.monto);
          const match = pendientesLibro.find(
            (lib) =>
              !usadasLibro.has(lib.id) &&
              normalizarReferenciaBanco(lib.referencia) === refExt &&
              Math.abs(Number(lib.monto) - montoExt) < 0.005,
          );
          if (!match) continue;
          usadasLibro.add(match.id);
          await fijarAccion(
            cliente,
            "conciliar",
            "Conciliación automática por coincidencia de referencia y monto.",
          );
          const { rows: [grupo] } = await cliente.query<{ id: string }>(
            `SELECT gen_random_uuid() AS id`,
          );
          await cliente.query(
            `INSERT INTO contabilidad.conciliacion_partida
               (cuenta_id, extracto_linea_id, asiento_linea_id, grupo_id, conciliado_por)
             VALUES ($1, $2, $3, $4, $5)`,
            [cuenta, ext.id, match.id, grupo.id, usuario.id],
          );
          conciliadas++;
        }

        return { nuevas: rowCount ?? 0, conciliadasAuto: conciliadas };
      },
    );

    refrescar();
    return {
      estado: "ok",
      nuevas,
      repetidas: transacciones.length - nuevas,
      conciliadasAuto,
    };
  } catch (error) {
    return { estado: estadoDeError(error) };
  }
}

/**
 * Concilia una transacción del banco con una línea de asiento de la cuenta
 * auxiliar del banco. Se exige el MISMO monto con el mismo signo: si no
 * coinciden, no es la misma transacción y lo que falta es un ajuste.
 * Todo se vuelve a comprobar aquí, dentro de la transacción y con las filas
 * bloqueadas: la pantalla pudo quedarse vieja mientras otra persona
 * conciliaba la misma línea.
 */
export async function conciliarPartida(_previo: EstadoBanco, datos: FormData): Promise<EstadoBanco> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.conciliar")) return { estado: "no_permitido" };

  const cuenta = texto(datos, "cuenta", 40);
  const extracto = texto(datos, "extracto", 40);

  // Soporta una o varias líneas (conciliación 1-a-1 y 1-a-varios)
  const lineasEntrada = datos.getAll("linea").concat(datos.getAll("lineas")).map((v) => String(v).trim()).filter(Boolean);
  const lineas = Array.from(new Set(lineasEntrada));

  if (!esUuid(cuenta) || !esUuid(extracto) || lineas.length === 0 || lineas.some((l) => !esUuid(l))) {
    return { estado: "datos_invalidos" };
  }

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "conciliar");

      // 1. Bloquear y verificar el extracto (que no esté ya conciliado)
      const { rows: extractos } = await cliente.query<{ id: string; monto: string }>(
        `SELECT e.id, e.monto::text AS monto
           FROM contabilidad.extracto_linea e
          WHERE e.id = $1 AND e.cuenta_id = $2
            AND NOT EXISTS (
              SELECT 1 FROM contabilidad.conciliacion_partida p
               WHERE p.extracto_linea_id = e.id AND p.anulado_en IS NULL
            )
          FOR UPDATE`,
        [extracto, cuenta],
      );
      if (!extractos[0]) throw new RechazoBanco("datos_invalidos");
      const extractoFila = extractos[0];

      // 2. Bloquear y verificar las líneas de asiento
      const { rows: filasAsiento } = await cliente.query<{ id: string; monto: string }>(
        `SELECT l.id, (l.debe - l.haber)::text AS monto
           FROM contabilidad.asiento_linea l
           JOIN contabilidad.cuenta_bancaria cb ON cb.id = $1 AND l.cuenta_id = cb.cuenta_contable_id
           JOIN contabilidad.asiento a ON a.id = l.asiento_id AND NOT a.anulado
          WHERE l.id = ANY($2::uuid[])
            AND NOT EXISTS (
              SELECT 1 FROM contabilidad.conciliacion_partida p
               WHERE p.asiento_linea_id = l.id AND p.anulado_en IS NULL
            )
          FOR UPDATE OF l`,
        [cuenta, lineas],
      );

      if (filasAsiento.length !== lineas.length) throw new RechazoBanco("datos_invalidos");

      // 3. Comprobar que la suma de las líneas de asiento sea exactamente igual al monto del extracto
      const sumaAsientos = filasAsiento.reduce((acc, f) => acc + Number(f.monto), 0);
      const montoExtracto = Number(extractoFila.monto);
      if (Math.abs(sumaAsientos - montoExtracto) > 0.005) {
        throw new RechazoBanco("montos_distintos");
      }

      // 4. Insertar todas las partidas en el mismo grupo de conciliación
      const { rows: [grupo] } = await cliente.query<{ id: string }>(
        `SELECT gen_random_uuid() AS id`
      );
      const grupoId = grupo.id;

      for (const lineaId of lineas) {
        await cliente.query(
          `INSERT INTO contabilidad.conciliacion_partida
             (cuenta_id, extracto_linea_id, asiento_linea_id, grupo_id, conciliado_por)
           VALUES ($1, $2, $3, $4, $5)`,
          [cuenta, extracto, lineaId, grupoId, usuario.id],
        );
      }
    });
    refrescar();
    return { estado: "ok" };
  } catch (error) {
    if (error instanceof RechazoBanco) return { estado: error.estado };
    return { estado: estadoDeError(error) };
  }
}

/**
 * Concilia una o varias transacciones del estado de cuenta bancario usando
 * un impuesto o cargo configurado en Parámetros legales (sin asiento previo
 * en el libro diario):
 *   · Fijo (p. ej. "Impuesto por transferencia 0.20%"): contabiliza la
 *     transacción elegida en la cuenta configurada y la concilia.
 *   · Variable (p. ej. "Comisiones bancarias"): contabiliza todas las
 *     transacciones del banco seleccionadas contra la cuenta configurada y
 *     las concilia en una sola operación.
 */
export async function conciliarCargoBancario(
  _previo: EstadoBanco,
  datos: FormData,
): Promise<EstadoBanco> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.conciliar")) return { estado: "no_permitido" };

  const cuenta = texto(datos, "cuenta", 40);
  const cargoId = texto(datos, "cargo_id", 40);
  const extractosEntrada = datos
    .getAll("extracto")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const extractos = Array.from(new Set(extractosEntrada));

  if (
    !esUuid(cuenta) ||
    !esUuid(cargoId) ||
    extractos.length === 0 ||
    extractos.some((id) => !esUuid(id))
  ) {
    return { estado: "datos_invalidos" };
  }

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "conciliar", "Conciliación directa con impuesto/cargo bancario.");

      const { rows: [cargo] } = await cliente.query<{
        id: string;
        nombre: string;
        tipo_valor: "fijo" | "variable";
        proposito: "transferencia" | "nomina";
        cuenta_id: string;
      }>(
        `SELECT ic.id, ic.nombre, ic.tipo_valor, ic.proposito, ic.cuenta_id
           FROM contabilidad.impuesto_cargo ic
           JOIN contabilidad.cuenta_contable cc ON cc.id = ic.cuenta_id
          WHERE ic.id = $1 AND ic.activo = true AND cc.admite_movimiento = true AND cc.activa = true`,
        [cargoId],
      );
      if (!cargo) throw new RechazoBanco("datos_invalidos");

      if (cargo.tipo_valor === "fijo" && extractos.length > 1) {
        throw new RechazoBanco("datos_invalidos");
      }

      const { rows: [cb] } = await cliente.query<{
        id: string;
        moneda: "DOP" | "USD";
        cuenta_contable_id: string;
      }>(
        `SELECT id, moneda, cuenta_contable_id
           FROM contabilidad.cuenta_bancaria
          WHERE id = $1 AND estado = 'activa'`,
        [cuenta],
      );
      if (!cb) throw new RechazoBanco("datos_invalidos");

      const { rows: filasExtracto } = await cliente.query<{
        id: string;
        fecha: string;
        descripcion: string;
        referencia: string | null;
        monto: string;
      }>(
        `SELECT e.id, e.fecha::text AS fecha, e.descripcion, e.referencia, e.monto::text AS monto
           FROM contabilidad.extracto_linea e
          WHERE e.id = ANY($1::uuid[])
            AND e.cuenta_id = $2
            AND NOT EXISTS (
              SELECT 1 FROM contabilidad.conciliacion_partida p
               WHERE p.extracto_linea_id = e.id AND p.anulado_en IS NULL
            )
          ORDER BY e.fecha, e.id
          FOR UPDATE`,
        [extractos, cuenta],
      );
      if (filasExtracto.length !== extractos.length) {
        throw new RechazoBanco("datos_invalidos");
      }

      for (const ext of filasExtracto) {
        const montoNum = Number(ext.monto);
        if (!Number.isFinite(montoNum) || Math.abs(montoNum) < 0.005) {
          throw new RechazoBanco("monto_invalido");
        }

        // Si es un impuesto fijo de transferencia que ya fue generado al pagar una
        // factura por Transferencia, se enlaza con esa línea existente sin duplicar
        // el asiento ni el gasto. Si no existe (p. ej. pago en efectivo), se crea.
        let lineaBancoId: string | null = null;
        if (cargo.tipo_valor === "fijo" && cargo.proposito === "transferencia") {
          const { rows: existentes } = await cliente.query<{
            id: string;
            referencia: string | null;
          }>(
            `SELECT l.id,
                    coalesce(nullif(trim(r.referencia), ''), nullif(trim(ti.referencia), '')) AS referencia
               FROM contabilidad.asiento_linea l
               JOIN contabilidad.asiento a ON a.id = l.asiento_id AND NOT a.anulado
               LEFT JOIN contabilidad.recibo r ON r.asiento_id = a.id
               LEFT JOIN contabilidad.transferencia_interna ti ON ti.asiento_id = a.id
              WHERE l.cuenta_id = $1
                AND l.descripcion = $2
                AND abs((l.debe - l.haber) - $3::numeric) < 0.005
                AND NOT EXISTS (
                  SELECT 1 FROM contabilidad.conciliacion_partida p
                   WHERE p.asiento_linea_id = l.id AND p.anulado_en IS NULL
                )
              ORDER BY a.fecha, a.numero, l.id
              FOR UPDATE OF l`,
            [cb.cuenta_contable_id, cargo.nombre, montoNum.toFixed(2)],
          );

          if (existentes.length > 0) {
            const refExt = normalizarReferenciaBanco(ext.referencia);
            const exacta = refExt
              ? existentes.find((row) => normalizarReferenciaBanco(row.referencia) === refExt)
              : undefined;
            lineaBancoId = (exacta ?? existentes[0]).id;
          }
        }

        if (!lineaBancoId) {
          const montoAbs = Math.abs(montoNum).toFixed(2);
          const esSalida = montoNum < 0;

          let tasa: string | null = null;
          let montoDop = montoAbs;
          if (cb.moneda === "USD") {
            const { rows: [tasaRow] } = await cliente.query<{ tasa: string | null }>(
              `SELECT contabilidad.tasa_referencia($1::date)::text AS tasa`,
              [ext.fecha],
            );
            if (!tasaRow?.tasa) throw new RechazoBanco("datos_invalidos");
            tasa = tasaRow.tasa;
            montoDop = (Math.abs(montoNum) * Number(tasa)).toFixed(2);
          }

          const concepto = `${cargo.nombre} · ${ext.descripcion}`.slice(0, 200);
          const lineas = esSalida
            ? [
                { cuenta_id: cargo.cuenta_id, debe: Number(montoDop), descripcion: cargo.nombre },
                { cuenta_id: cb.cuenta_contable_id, haber: Number(montoDop), descripcion: cargo.nombre },
              ]
            : [
                { cuenta_id: cb.cuenta_contable_id, debe: Number(montoDop), descripcion: cargo.nombre },
                { cuenta_id: cargo.cuenta_id, haber: Number(montoDop), descripcion: cargo.nombre },
              ];

          const { rows: [asientoRow] } = await cliente.query<{ id: string }>(
            `SELECT contabilidad.crear_asiento(
               $1::date, $2, 'automatico', 'conciliacion_cargo', $3::uuid, $4::jsonb
             ) AS id`,
            [ext.fecha, concepto, ext.id, JSON.stringify(lineas)],
          );

          const { rows: [lineaBanco] } = await cliente.query<{ id: string }>(
            `SELECT id
               FROM contabilidad.asiento_linea
              WHERE asiento_id = $1 AND cuenta_id = $2
              LIMIT 1`,
            [asientoRow.id, cb.cuenta_contable_id],
          );
          if (!lineaBanco) throw new RechazoBanco("datos_invalidos");
          lineaBancoId = lineaBanco.id;

          await cliente.query(
            `INSERT INTO contabilidad.movimiento_bancario
               (numero, cuenta_id, periodo_id, fecha, tipo, monto, moneda, tasa, monto_dop,
                concepto, referencia, origen_tabla, origen_id, creado_por)
             VALUES (
               contabilidad.siguiente_numero('MB'),
               $1,
               contabilidad.periodo_para($2::date),
               $2::date,
               $3,
               $4::numeric,
               $5,
               $6::numeric,
               $7::numeric,
               $8,
               $9,
               'conciliacion_cargo',
               $10::uuid,
               $11::uuid
             )`,
            [
              cb.id,
              ext.fecha,
              esSalida ? "debito" : "deposito",
              montoAbs,
              cb.moneda,
              tasa,
              montoDop,
              concepto,
              ext.referencia,
              ext.id,
              usuario.id,
            ],
          );
        }

        const { rows: [grupo] } = await cliente.query<{ id: string }>(
          `SELECT gen_random_uuid() AS id`,
        );

        await cliente.query(
          `INSERT INTO contabilidad.conciliacion_partida
             (cuenta_id, extracto_linea_id, asiento_linea_id, grupo_id, conciliado_por)
           VALUES ($1, $2, $3, $4, $5)`,
          [cb.id, ext.id, lineaBancoId, grupo.id, usuario.id],
        );
      }
    });

    refrescar();
    return { estado: "ok" };
  } catch (error) {
    if (error instanceof RechazoBanco) return { estado: error.estado };
    return { estado: estadoDeError(error) };
  }
}

/** Anula una conciliación: las dos líneas vuelven a quedar por conciliar. */
export async function anularPartida(_previo: EstadoBanco, datos: FormData): Promise<EstadoBanco> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.conciliar")) return { estado: "no_permitido" };

  const id = texto(datos, "id", 40);
  if (!esUuid(id)) return { estado: "datos_invalidos" };

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "anular");
      await cliente.query(
        `UPDATE contabilidad.conciliacion_partida
            SET anulado_en = now(), anulado_por = $2
          WHERE grupo_id = (
            SELECT coalesce(grupo_id, id)
              FROM contabilidad.conciliacion_partida
             WHERE id = $1
          ) AND anulado_en IS NULL`,
        [id, usuario.id],
      );
    });
    refrescar();
    return { estado: "ok" };
  } catch (error) {
    return { estado: estadoDeError(error) };
  }
}

/**
 * Vincula el banco con su cuenta contable auxiliar. Es configuración del
 * catálogo, así que pide `contabilidad.configurar`. No se permite cambiarla
 * con partidas conciliadas vivas: quedarían emparejadas con líneas de otra
 * cuenta.
 */
export async function vincularCuentaContable(_previo: EstadoBanco, datos: FormData): Promise<EstadoBanco> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.configurar")) return { estado: "no_permitido" };

  const cuenta = texto(datos, "cuenta", 40);
  const contable = texto(datos, "cuenta_contable", 40);
  if (!esUuid(cuenta) || !esUuid(contable)) return { estado: "datos_invalidos" };

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "editar");
      const { rowCount } = await cliente.query(
        `UPDATE contabilidad.cuenta_bancaria cb SET cuenta_contable_id = $2
          WHERE cb.id = $1
            AND EXISTS (SELECT 1 FROM contabilidad.cuenta_contable c
                         WHERE c.id = $2 AND c.tipo = 'activo' AND c.admite_movimiento AND c.activa)
            AND NOT EXISTS (SELECT 1 FROM contabilidad.conciliacion_partida p
                             WHERE p.cuenta_id = cb.id AND p.anulado_en IS NULL)`,
        [cuenta, contable],
      );
      if (!rowCount) throw new RechazoBanco("datos_invalidos");
    });
    refrescar();
    return { estado: "ok" };
  } catch (error) {
    if (error instanceof RechazoBanco) return { estado: error.estado };
    return { estado: estadoDeError(error) };
  }
}

function saldoConSignoValido(crudo: string): string | null {
  const limpio = crudo.replace(/,/g, "").trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(limpio)) return null;
  const n = Number(limpio);
  if (!Number.isFinite(n) || Math.abs(n) > 999_999_999_999.99) return null;
  return n.toFixed(2);
}

function tarifaValida(crudo: string): string | null {
  const limpio = crudo.replace(/,/g, "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(limpio)) return null;
  const n = Number(limpio);
  if (!Number.isFinite(n) || n < 0 || n > 999_999_999_999.99) return null;
  return n.toFixed(2);
}

/**
 * Actualiza Título, No. de cuenta, Moneda (con tasas de compra/venta y tarifa si es USD),
 * Auxiliar contable y Saldo actual de una cuenta bancaria. Exclusivo del rol `contabilidad`.
 */
export async function actualizarCuentaBancaria(
  _previo: EstadoBanco,
  datos: FormData,
): Promise<EstadoBanco> {
  const usuario = await requerirUsuario();
  if (usuario.rol !== "contabilidad") return { estado: "no_permitido" };

  const cuenta = texto(datos, "cuenta", 40);
  const nombre = texto(datos, "nombre", 120);
  const numero = texto(datos, "numero", 60);
  const moneda = texto(datos, "moneda", 3);
  const contable = texto(datos, "cuenta_contable", 40);
  const saldoActual = saldoConSignoValido(texto(datos, "saldo_actual", 24));
  const tasaCompra = moneda === "USD" ? tasaValida(texto(datos, "tasa_compra", 20)) : null;
  const tasaVenta = moneda === "USD" ? tasaValida(texto(datos, "tasa_venta", 20)) : null;
  const tarifa = moneda === "USD" ? tarifaValida(texto(datos, "tarifa", 24)) : null;
  const codigoInstitucionCrudo = texto(datos, "codigo_institucion", 40);
  const codigoInstitucion =
    moneda === "USD" && esCodigoInstitucionTasareal(codigoInstitucionCrudo)
      ? codigoInstitucionCrudo
      : null;

  if (!esUuid(cuenta) || !nombre || !numero || !esMoneda(moneda) || !esUuid(contable)) {
    return { estado: "datos_invalidos" };
  }
  if (moneda === "USD" && (!tasaCompra || !tasaVenta || tarifa === null || !codigoInstitucion)) {
    return { estado: "datos_invalidos" };
  }
  if (saldoActual === null) return { estado: "monto_invalido" };

  try {
    await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "editar", "Configuración directa de cuenta bancaria.");
      const { rowCount } = await cliente.query(
        `UPDATE contabilidad.cuenta_bancaria cb
            SET nombre = $2,
                numero = $3,
                moneda = $4,
                cuenta_contable_id = $5,
                saldo_inicial = $6::numeric - coalesce((
                  SELECT sum(m.importe)
                    FROM contabilidad.movimiento_bancario m
                   WHERE m.cuenta_id = cb.id AND m.estado = 'vigente'
                ), 0),
                tasa_compra = $7,
                tasa_venta = $8,
                tarifa = $9,
                codigo_institucion = $10
          WHERE cb.id = $1
            AND EXISTS (
              SELECT 1 FROM contabilidad.cuenta_contable c
               WHERE c.id = $5 AND c.tipo = 'activo' AND c.admite_movimiento AND c.activa
            )
            AND (
              cb.cuenta_contable_id = $5
              OR NOT EXISTS (
                SELECT 1 FROM contabilidad.conciliacion_partida p
                 WHERE p.cuenta_id = cb.id AND p.anulado_en IS NULL
              )
            )`,
        [cuenta, nombre, numero, moneda, contable, saldoActual, tasaCompra, tasaVenta, tarifa, codigoInstitucion],
      );
      if (!rowCount) throw new RechazoBanco("datos_invalidos");
    });
    refrescar();
    return { estado: "ok", id: cuenta };
  } catch (error) {
    if (error instanceof RechazoBanco) return { estado: error.estado };
    if ((error as { code?: string })?.code === "23505") return { estado: "datos_invalidos" };
    return { estado: estadoDeError(error) };
  }
}

/**
 * Envía una solicitud de autorización al rol `contabilidad` para cambiar
 * la configuración de una cuenta bancaria (para cualquier otro rol).
 */
export async function solicitarCambioCuentaBancaria(
  _previo: EstadoBanco,
  datos: FormData,
): Promise<EstadoBanco> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.leer")) return { estado: "no_permitido" };

  const cuenta = texto(datos, "cuenta", 40);
  const nombre = texto(datos, "nombre", 120);
  const numero = texto(datos, "numero", 60);
  const moneda = texto(datos, "moneda", 3);
  const contable = texto(datos, "cuenta_contable", 40);
  const saldoActual = saldoConSignoValido(texto(datos, "saldo_actual", 24));
  const motivo = texto(datos, "motivo", 300);
  const tasaCompra = moneda === "USD" ? tasaValida(texto(datos, "tasa_compra", 20)) : null;
  const tasaVenta = moneda === "USD" ? tasaValida(texto(datos, "tasa_venta", 20)) : null;
  const tarifa = moneda === "USD" ? tarifaValida(texto(datos, "tarifa", 24)) : null;
  const codigoInstitucionCrudo = texto(datos, "codigo_institucion", 40);
  const codigoInstitucion =
    moneda === "USD" && esCodigoInstitucionTasareal(codigoInstitucionCrudo)
      ? codigoInstitucionCrudo
      : null;

  if (!esUuid(cuenta) || !nombre || !numero || !esMoneda(moneda) || !esUuid(contable) || !motivo) {
    return { estado: "datos_invalidos" };
  }
  if (moneda === "USD" && (!tasaCompra || !tasaVenta || tarifa === null || !codigoInstitucion)) {
    return { estado: "datos_invalidos" };
  }
  if (saldoActual === null) return { estado: "monto_invalido" };

  try {
    const solicitudId = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      const { rows } = await cliente.query<{ id: string }>(
        `INSERT INTO contabilidad.solicitud_cambio_cuenta_bancaria
           (cuenta_id, solicitado_por, nombre, numero, moneda, cuenta_contable_id, saldo_actual, motivo, tasa_compra, tasa_venta, tarifa, codigo_institucion)
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
          WHERE EXISTS (SELECT 1 FROM contabilidad.cuenta_bancaria WHERE id = $1)
            AND EXISTS (
              SELECT 1 FROM contabilidad.cuenta_contable c
               WHERE c.id = $6 AND c.tipo = 'activo' AND c.admite_movimiento AND c.activa
            )
         RETURNING id`,
        [cuenta, usuario.id, nombre, numero, moneda, contable, saldoActual, motivo, tasaCompra, tasaVenta, tarifa, codigoInstitucion],
      );
      if (!rows[0]) throw new RechazoBanco("datos_invalidos");
      return rows[0].id;
    });

    // Notificar a todos los usuarios activos con rol `contabilidad`.
    const destinatarios = await consultar<{ id: string }>(
      `SELECT u.id
         FROM public.usuario u
         JOIN public.rol r ON r.id = u.rol_id
        WHERE r.nombre = 'contabilidad' AND u.activo = true`,
    );
    await Promise.all(
      destinatarios.map((d) =>
        notificarUsuario({
          usuarioId: d.id,
          titulo: "Solicitud de cambio en cuenta bancaria",
          mensaje: `${usuario.nombre} solicitó modificar «${nombre}»: ${motivo}`,
          tipo: "alerta",
          enlace: `/contabilidad/bancos/${cuenta}`,
        }),
      ),
    );

    refrescar();
    return { estado: "ok", id: solicitudId };
  } catch (error) {
    if (error instanceof RechazoBanco) return { estado: error.estado };
    return { estado: estadoDeError(error) };
  }
}

/**
 * Aprueba o rechaza una solicitud de cambio en cuenta bancaria.
 * Exclusivo del rol `contabilidad`.
 */
export async function resolverSolicitudCambioBanco(
  _previo: EstadoBanco,
  datos: FormData,
): Promise<EstadoBanco> {
  const usuario = await requerirUsuario();
  if (usuario.rol !== "contabilidad") return { estado: "no_permitido" };

  const solicitudId = texto(datos, "solicitud_id", 40);
  const decision = texto(datos, "decision", 12);
  if (!esUuid(solicitudId) || (decision !== "aprobada" && decision !== "rechazada")) {
    return { estado: "datos_invalidos" };
  }

  try {
    const info = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      const { rows } = await cliente.query<{
        id: string;
        cuenta_id: string;
        solicitado_por: string;
        nombre: string;
        numero: string;
        moneda: string;
        tasa_compra: string | null;
        tasa_venta: string | null;
        tarifa: string | null;
        codigo_institucion: string | null;
        cuenta_contable_id: string;
        saldo_actual: string;
      }>(
        `SELECT id, cuenta_id, solicitado_por, nombre, numero, moneda,
                tasa_compra::text AS tasa_compra, tasa_venta::text AS tasa_venta,
                tarifa::numeric(14,2)::text AS tarifa, codigo_institucion,
                cuenta_contable_id, saldo_actual::text AS saldo_actual
           FROM contabilidad.solicitud_cambio_cuenta_bancaria
          WHERE id = $1 AND estado = 'pendiente'
          FOR UPDATE`,
        [solicitudId],
      );
      const sol = rows[0];
      if (!sol) throw new RechazoBanco("datos_invalidos");

      if (decision === "aprobada") {
        await fijarAccion(cliente, "aprobar", "Aprobación de solicitud de cambio en cuenta bancaria.");
        const { rowCount } = await cliente.query(
          `UPDATE contabilidad.cuenta_bancaria cb
              SET nombre = $2,
                  numero = $3,
                  moneda = $4,
                  cuenta_contable_id = $5,
                  saldo_inicial = $6::numeric - coalesce((
                    SELECT sum(m.importe)
                      FROM contabilidad.movimiento_bancario m
                     WHERE m.cuenta_id = cb.id AND m.estado = 'vigente'
                  ), 0),
                  tasa_compra = $7,
                  tasa_venta = $8,
                  tarifa = $9,
                  codigo_institucion = $10
            WHERE cb.id = $1
              AND (
                cb.cuenta_contable_id = $5
                OR NOT EXISTS (
                  SELECT 1 FROM contabilidad.conciliacion_partida p
                   WHERE p.cuenta_id = cb.id AND p.anulado_en IS NULL
                )
              )`,
          [
            sol.cuenta_id,
            sol.nombre,
            sol.numero,
            sol.moneda,
            sol.cuenta_contable_id,
            sol.saldo_actual,
            sol.moneda === "USD" ? sol.tasa_compra : null,
            sol.moneda === "USD" ? sol.tasa_venta : null,
            sol.moneda === "USD" ? sol.tarifa : null,
            sol.moneda === "USD" ? sol.codigo_institucion : null,
          ],
        );
        if (!rowCount) throw new RechazoBanco("datos_invalidos");
      } else {
        await fijarAccion(cliente, "anular", "Rechazo de solicitud de cambio en cuenta bancaria.");
      }

      await cliente.query(
        `UPDATE contabilidad.solicitud_cambio_cuenta_bancaria
            SET estado = $2, resuelto_por = $3, resuelto_en = now()
          WHERE id = $1`,
        [solicitudId, decision, usuario.id],
      );
      return sol;
    });

    await notificarUsuario({
      usuarioId: info.solicitado_por,
      titulo:
        decision === "aprobada"
          ? "Cambio de cuenta bancaria aprobado"
          : "Cambio de cuenta bancaria rechazado",
      mensaje:
        decision === "aprobada"
          ? `Contabilidad aprobó tu solicitud sobre «${info.nombre}».`
          : `Contabilidad rechazó tu solicitud sobre «${info.nombre}».`,
      tipo: decision === "aprobada" ? "info" : "alerta",
      enlace: `/contabilidad/bancos/${info.cuenta_id}`,
    });

    refrescar();
    return { estado: "ok", id: solicitudId };
  } catch (error) {
    if (error instanceof RechazoBanco) return { estado: error.estado };
    if ((error as { code?: string })?.code === "23505") return { estado: "datos_invalidos" };
    return { estado: estadoDeError(error) };
  }
}

export type EstadoActualizarTasas = {
  estado:
    | "inicial"
    | "ok"
    | "no_permitido"
    | "antes_de_hora"
    | "ya_actualizado_hoy"
    | "sin_token"
    | "token_invalido"
    | "limite_api"
    | "error_api"
    | "sin_datos";
  bcrdActualizado?: boolean;
  bcrdCompra?: string;
  bcrdVenta?: string;
  bancosActualizados?: number;
  faltantes?: string[];
  detalle?: string;
};

type TasaRealItem = {
  institution?: string;
  currency?: string;
  buy?: number | string | null;
  sell?: number | string | null;
  date?: string | null;
};

type TasaRealRespuesta = {
  date?: string;
  rates?: TasaRealItem[];
  missing_institutions?: string[];
};

function normalizarTasaApi(valor: number | string | null | undefined): string | null {
  if (valor === null || valor === undefined) return null;
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0 || n >= 10000) return null;
  return n.toFixed(4);
}

/**
 * Consulta la API de TasaReal (`GET /api/v1/rates?currency=USD`) y actualiza:
 *   1. La tasa oficial del BCRD (`contabilidad.tasa_cambio`) usando el código `bcrd`.
 *   2. Las tasas de compra y venta de cada cuenta bancaria activa en USD según
 *      su `codigo_institucion` configurado.
 */
export async function actualizarTasasDesdeApi(): Promise<EstadoActualizarTasas> {
  const usuario = await requerirUsuario();
  if (!usuarioTienePermiso(usuario, "contabilidad.registrar")) {
    return { estado: "no_permitido" };
  }

  const yaActualizado = await tasasActualizadasHoy();
  const horario = estadoHorarioTasasRD(yaActualizado);
  if (!horario.permitido) {
    return { estado: horario.motivo === "antes_de_hora" ? "antes_de_hora" : "ya_actualizado_hoy" };
  }

  const token = process.env.TASAREAL_API_KEY?.trim();
  if (!token) {
    return { estado: "sin_token" };
  }

  let payload: TasaRealRespuesta;
  try {
    const respuesta = await fetch(`${URL_BASE_TASAREAL}/rates?currency=USD`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (respuesta.status === 401 || respuesta.status === 403) {
      return { estado: "token_invalido" };
    }
    if (respuesta.status === 429) {
      return { estado: "limite_api" };
    }
    if (!respuesta.ok) {
      return { estado: "error_api", detalle: `HTTP ${respuesta.status}` };
    }

    payload = (await respuesta.json()) as TasaRealRespuesta;
  } catch (error) {
    return {
      estado: "error_api",
      detalle: error instanceof Error ? error.message : undefined,
    };
  }

  const lista = Array.isArray(payload.rates) ? payload.rates : [];
  if (lista.length === 0) {
    return { estado: "sin_datos" };
  }

  const mapa = new Map<string, TasaRealItem>();
  for (const item of lista) {
    const codigo = item.institution?.trim().toLowerCase();
    if (!codigo) continue;
    if (item.currency && item.currency.toUpperCase() !== "USD") continue;
    mapa.set(codigo, item);
  }

  const fechaHoyRd = claveDia();

  try {
    const resumen = await enTransaccionComo(await contextoDe(usuario), async (cliente) => {
      await fijarAccion(cliente, "editar", "Actualización automática de tasas vía API TasaReal.");

      let bcrdActualizado = false;
      let bcrdCompra: string | undefined;
      let bcrdVenta: string | undefined;
      const faltantes: string[] = [];

      // 1) BCRD siempre con código `bcrd`
      const tasaBcrd = mapa.get(CODIGO_BCRD_TASAREAL);
      const compraBcrd = normalizarTasaApi(tasaBcrd?.buy);
      const ventaBcrd = normalizarTasaApi(tasaBcrd?.sell);
      if (compraBcrd && ventaBcrd) {
        const fechaBcrd =
          tasaBcrd?.date && esFechaIso(tasaBcrd.date)
            ? tasaBcrd.date
            : payload.date && esFechaIso(payload.date)
              ? payload.date
              : fechaHoyRd;
        await cliente.query(
          `INSERT INTO contabilidad.tasa_cambio (fecha, compra, venta, fuente)
           VALUES ($1, $2, $3, 'BCRD')
           ON CONFLICT (fecha) DO UPDATE
             SET compra = EXCLUDED.compra,
                 venta = EXCLUDED.venta,
                 fuente = EXCLUDED.fuente`,
          [fechaBcrd, compraBcrd, ventaBcrd],
        );
        bcrdActualizado = true;
        bcrdCompra = compraBcrd;
        bcrdVenta = ventaBcrd;
      } else {
        faltantes.push(CODIGO_BCRD_TASAREAL);
      }

      // 2) Cuentas bancarias activas en USD con código de institución configurado
      const { rows: cuentasUsd } = await cliente.query<{
        id: string;
        nombre: string;
        codigo_institucion: string;
      }>(
        `SELECT id, nombre, codigo_institucion
           FROM contabilidad.cuenta_bancaria
          WHERE estado = 'activa'
            AND moneda = 'USD'
            AND nullif(trim(codigo_institucion), '') IS NOT NULL
          FOR UPDATE`,
      );

      let bancosActualizados = 0;
      const detalleBancos: Record<string, { compra: string | null; venta: string | null }> = {};

      for (const cb of cuentasUsd) {
        const codigo = cb.codigo_institucion.trim().toLowerCase();
        const item = mapa.get(codigo);
        const buy = normalizarTasaApi(item?.buy);
        const sell = normalizarTasaApi(item?.sell);
        if (!buy && !sell) {
          faltantes.push(codigo);
          continue;
        }
        await cliente.query(
          `UPDATE contabilidad.cuenta_bancaria
              SET tasa_compra = coalesce($2::numeric, tasa_compra),
                  tasa_venta  = coalesce($3::numeric, tasa_venta)
            WHERE id = $1`,
          [cb.id, buy, sell],
        );
        bancosActualizados++;
        detalleBancos[codigo] = { compra: buy, venta: sell };
      }

      await cliente.query(
        `INSERT INTO contabilidad.tasareal_actualizacion
           (fecha_rd, ejecutado_por, bcrd_actualizado, bancos_actualizados, detalle)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
          fechaHoyRd,
          usuario.id,
          bcrdActualizado,
          bancosActualizados,
          JSON.stringify({
            fecha_api: payload.date ?? null,
            bcrd: bcrdActualizado ? { compra: bcrdCompra, venta: bcrdVenta } : null,
            bancos: detalleBancos,
            faltantes,
          }),
        ],
      );

      return { bcrdActualizado, bcrdCompra, bcrdVenta, bancosActualizados, faltantes };
    });

    refrescar();
    return { estado: "ok", ...resumen };
  } catch (error) {
    return {
      estado: "error_api",
      detalle: error instanceof Error ? error.message : undefined,
    };
  }
}

class RechazoBanco extends Error {
  constructor(readonly estado: EstadoBanco["estado"]) {
    super(estado);
  }
}

function refrescar(): void {
  revalidatePath("/[locale]/contabilidad", "layout");
  revalidatePath("/[locale]/portal/contabilidad", "page");
}
