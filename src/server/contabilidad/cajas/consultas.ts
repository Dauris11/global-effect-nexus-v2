import { consultar, consultarUna } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth";
import { claveDenominacion, denominacionesDe, redondear } from "@/lib/contabilidad/cajas";
import { formatearNumeroComprobante } from "@/lib/contabilidad/comprobantes-rd";

export type DesgloseDenominacion = {
  denominacion: number;
  tipo: "billete" | "moneda";
  cantidad: number;
};

/**
 * Lecturas del cuadre de caja chica.
 *
 * Cada caja trae, además de su saldo, las dos piezas que completan la ecuación
 * del fondo fijo (vales por liquidar y gastos por reponer): sin ellas el
 * arqueo y la reposición tendrían que adivinar de dónde sale la diferencia
 * entre el fondo y el efectivo.
 */

export type CajaResumen = {
  id: string;
  codigo: string;
  nombre: string;
  departamento: string;
  tipo: "caja_chica" | "caja";
  responsableId: string;
  responsableNombre: string;
  supervisorId: string | null;
  supervisorNombre: string | null;
  moneda: "DOP" | "USD";
  fondoFijo: string;
  /** Efectivo que debería haber en la caja según el sistema. */
  saldoActual: string;
  umbralAdjunto: string;
  cuentaContableId: string | null;
  cuentaContableCodigo: string | null;
  cuentaContableNombre: string | null;
  cuentaBancariaId: string | null;
  estado: "activa" | "inactiva";
  /** Para Caja General: indica si la caja está abierta para operar o cerrada tras cuadre. */
  abierta: boolean;
  desgloseConfigurado: boolean;
  desglose: DesgloseDenominacion[];
  creadoEn: string;
  /** Gastos con comprobante aún no repuestos desde banco. */
  pendienteReposicion: string;
  /** Vales entregados que todavía no se han liquidado. */
  valesPendientes: string;
  arqueosPorAprobar: number;
  ultimoArqueo: string | null;
};

export type MovimientoCaja = {
  id: string;
  numero: number;
  cajaId: string;
  fecha: string;
  tipo: "vale" | "gasto" | "reposicion" | "ajuste";
  monto: string;
  concepto: string;
  personaId: string | null;
  personaNombre: string | null;
  entregadoA: string | null;
  facturaConComprobante: boolean;
  comprobanteNumero: string | null;
  reciboId: string | null;
  tieneAdjunto: boolean;
  estado: "pendiente" | "completado" | "anulado";
  arqueoId: string | null;
  /** Cuenta de gasto a la que fue el comprobante (solo gastos). */
  cuentaGasto: string | null;
  asientoId: string | null;
  creadoPorNombre: string;
  creadoEn: string;
};

export type DenominacionConteo = {
  denominacion: number;
  tipo: "billete" | "moneda";
  cantidadEsperada: number;
  subtotalEsperado: number;
  cantidad: number;
  subtotal: number;
};

export type DatosActaArqueo = ArqueoCaja & {
  cajaCodigo: string;
  cajaMoneda: "DOP" | "USD";
  cuentaContableCodigo: string | null;
  cuentaContableNombre: string | null;
  responsableNombre: string;
  supervisorNombre: string | null;
  denominaciones: DenominacionConteo[];
};

export type ArqueoCaja = {
  id: string;
  numero: number;
  cajaId: string;
  cajaNombre: string;
  fecha: string;
  saldoSistema: string;
  saldoContado: string;
  diferencia: string;
  estado: "abierto" | "cerrado" | "aprobado";
  justificacion: string | null;
  revisadoPorNombre: string | null;
  revisadoEn: string | null;
  creadoPorId: string;
  creadoPorNombre: string;
  creadoEn: string;
  asientoId: string | null;
  denominaciones?: DenominacionConteo[];
};

export type CategoriaGastoCaja = { id: string; nombre: string; cuenta: string };

type FilaCaja = {
  id: string;
  codigo: string;
  nombre: string;
  departamento: string;
  tipo: "caja_chica" | "caja";
  responsable_id: string;
  responsable_nombre: string;
  supervisor_id: string | null;
  supervisor_nombre: string | null;
  moneda: "DOP" | "USD";
  fondo_fijo: string;
  saldo_actual: string;
  umbral_adjunto: string;
  cuenta_contable_id: string | null;
  cuenta_codigo: string | null;
  cuenta_nombre: string | null;
  cuenta_bancaria_id: string | null;
  estado: "activa" | "inactiva";
  abierta: boolean;
  desglose_configurado: boolean;
  desglose: DesgloseDenominacion[] | null;
  creado_en: string;
  pendiente_reposicion: string;
  vales_pendientes: string;
  arqueos_por_aprobar: number;
  ultimo_arqueo: string | null;
};

// La cuenta de la caja cae en "Caja Chica" del catálogo cuando la caja se
// creó sin cuenta (la del código de transacción CAJ_CAJA_CHICA): así
// el cuadre nunca se queda sin contrapartida.
const SELECT_CAJA = `
  SELECT c.id, c.codigo, c.nombre, c.departamento, c.tipo,
         c.responsable_id, u.nombre AS responsable_nombre,
         c.supervisor_id, sup.nombre AS supervisor_nombre,
         c.moneda, c.fondo_fijo, c.saldo_actual, c.umbral_adjunto,
         c.cuenta_contable_id, cc.codigo AS cuenta_codigo, cc.nombre AS cuenta_nombre,
         c.cuenta_bancaria_id,
         c.estado, COALESCE(c.abierta, true) AS abierta, c.desglose_configurado,
         COALESCE((
           SELECT json_agg(
                    json_build_object(
                      'denominacion', d.denominacion::float8,
                      'tipo', d.tipo,
                      'cantidad', d.cantidad::int
                    ) ORDER BY d.denominacion DESC
                  )
             FROM contabilidad.caja_desglose d
            WHERE d.caja_id = c.id
         ), '[]'::json) AS desglose,
         c.creado_en,
         COALESCE((SELECT SUM(m.monto) FROM contabilidad.caja_movimiento m
                    WHERE m.caja_id = c.id AND m.tipo = 'gasto' AND m.estado = 'pendiente'), 0)::text
           AS pendiente_reposicion,
         COALESCE((SELECT SUM(m.monto) FROM contabilidad.caja_movimiento m
                    WHERE m.caja_id = c.id AND m.tipo = 'vale' AND m.estado = 'pendiente'), 0)::text
           AS vales_pendientes,
         (SELECT count(*)::int FROM contabilidad.arqueo a
           WHERE a.caja_id = c.id AND a.estado IN ('abierto', 'cerrado')) AS arqueos_por_aprobar,
         (SELECT to_char(max(a.fecha), 'YYYY-MM-DD') FROM contabilidad.arqueo a
           WHERE a.caja_id = c.id) AS ultimo_arqueo
    FROM contabilidad.caja c
    JOIN public.usuario u ON c.responsable_id = u.id
    LEFT JOIN public.usuario sup ON c.supervisor_id = sup.id
    LEFT JOIN contabilidad.cuenta_contable cc
           ON cc.id = COALESCE(c.cuenta_contable_id,
                               (SELECT cuenta_id FROM contabilidad.codigo_transaccion
                                WHERE codigo = 'CAJ_CAJA_CHICA'))`;

function aCaja(f: FilaCaja): CajaResumen {
  return {
    id: f.id,
    codigo: f.codigo,
    nombre: f.nombre,
    departamento: f.departamento,
    tipo: f.tipo,
    responsableId: f.responsable_id,
    responsableNombre: f.responsable_nombre,
    supervisorId: f.supervisor_id,
    supervisorNombre: f.supervisor_nombre,
    moneda: f.moneda,
    fondoFijo: f.fondo_fijo,
    saldoActual: f.saldo_actual,
    umbralAdjunto: f.umbral_adjunto,
    cuentaContableId: f.cuenta_contable_id,
    cuentaContableCodigo: f.cuenta_codigo,
    cuentaContableNombre: f.cuenta_nombre,
    cuentaBancariaId: f.cuenta_bancaria_id,
    estado: f.estado,
    abierta: Boolean(f.abierta),
    desgloseConfigurado: Boolean(f.desglose_configurado),
    desglose: Array.isArray(f.desglose) ? f.desglose : [],
    creadoEn: f.creado_en,
    pendienteReposicion: f.pendiente_reposicion,
    valesPendientes: f.vales_pendientes,
    arqueosPorAprobar: f.arqueos_por_aprobar,
    ultimoArqueo: f.ultimo_arqueo,
  };
}

export async function listarCajas(): Promise<CajaResumen[]> {
  await requerirPermiso("contabilidad.leer");
  const filas = await consultar<FilaCaja>(
    `${SELECT_CAJA} WHERE c.eliminada_en IS NULL ORDER BY c.estado ASC, c.nombre ASC`,
  );
  return filas.map(aCaja);
}

export async function obtenerCaja(cajaId: string): Promise<CajaResumen | null> {
  await requerirPermiso("contabilidad.leer");
  const fila = await consultarUna<FilaCaja>(
    `${SELECT_CAJA} WHERE c.id = $1 AND c.eliminada_en IS NULL`,
    [cajaId],
  );
  return fila ? aCaja(fila) : null;
}

/** Cuentas del catálogo marcadas con «Agregar a caja chica» (para Categoría de gasto en salidas). */
export async function categoriasGastoCaja(): Promise<CategoriaGastoCaja[]> {
  await requerirPermiso("contabilidad.leer");
  return consultar<CategoriaGastoCaja>(
    `SELECT cc.id, cc.nombre, cc.codigo AS cuenta
       FROM contabilidad.cuenta_contable cc
      WHERE cc.activa = true
        AND cc.admite_movimiento = true
        AND cc.agregar_a_caja_chica = true
      ORDER BY cc.nombre ASC`,
  );
}

/** Cuentas auxiliares marcadas con «Permitir en Tipo de Ingreso» para Caja General. */
export async function cuentasTipoIngresoCaja(): Promise<CategoriaGastoCaja[]> {
  await requerirPermiso("contabilidad.leer");
  return consultar<CategoriaGastoCaja>(
    `SELECT cc.id, cc.nombre, cc.codigo AS cuenta
       FROM contabilidad.cuenta_contable cc
      WHERE cc.activa = true
        AND cc.admite_movimiento = true
        AND cc.agregar_a_caja_ingreso = true
      ORDER BY cc.codigo ASC, cc.nombre ASC`,
  );
}

/** Cuentas auxiliares marcadas con «Permitir en Tipo de Egreso» para Caja General. */
export async function cuentasTipoEgresoCaja(): Promise<CategoriaGastoCaja[]> {
  await requerirPermiso("contabilidad.leer");
  return consultar<CategoriaGastoCaja>(
    `SELECT cc.id, cc.nombre, cc.codigo AS cuenta
       FROM contabilidad.cuenta_contable cc
      WHERE cc.activa = true
        AND cc.admite_movimiento = true
        AND cc.agregar_a_caja_egreso = true
      ORDER BY cc.codigo ASC, cc.nombre ASC`,
  );
}

const SELECT_MOVIMIENTOS_CAJA = `
  SELECT m.id, m.numero, m.caja_id, to_char(m.fecha, 'YYYY-MM-DD') AS fecha,
         m.tipo, m.monto, m.concepto,
         m.persona_id, p.nombre AS persona_nombre,
         m.entregado_a, m.factura_con_comprobante, m.comprobante_numero,
         m.recibo_id, (m.adjunto_ruta IS NOT NULL) AS tiene_adjunto,
         m.estado, m.arqueo_id,
         COALESCE(cg.nombre, ast.cuenta_gasto) AS cuenta_gasto, ast.id AS asiento_id,
         u.nombre AS creado_por_nombre, m.creado_en
    FROM contabilidad.caja_movimiento m
    JOIN public.usuario u ON m.creado_por = u.id
    LEFT JOIN public.usuario p ON m.persona_id = p.id
    LEFT JOIN contabilidad.cuenta_contable cg ON cg.id = m.cuenta_gasto_id
    LEFT JOIN LATERAL (
      SELECT a.id,
             (SELECT cc.nombre
                FROM contabilidad.asiento_linea l
                JOIN contabilidad.cuenta_contable cc ON cc.id = l.cuenta_id
               WHERE l.asiento_id = a.id AND l.debe > 0
               LIMIT 1) AS cuenta_gasto
        FROM contabilidad.asiento a
       WHERE a.origen_tabla = 'caja_movimiento' AND a.origen_id = m.id AND NOT a.anulado
       LIMIT 1
    ) ast ON true`;

type FilaMovimientoDb = {
  id: string;
  numero: number;
  caja_id: string;
  fecha: string;
  tipo: MovimientoCaja["tipo"];
  monto: string;
  concepto: string;
  persona_id: string | null;
  persona_nombre: string | null;
  entregado_a: string | null;
  factura_con_comprobante: boolean;
  comprobante_numero: string | null;
  recibo_id: string | null;
  tiene_adjunto: boolean;
  estado: MovimientoCaja["estado"];
  arqueo_id: string | null;
  cuenta_gasto: string | null;
  asiento_id: string | null;
  creado_por_nombre: string;
  creado_en: string;
};

function aMovimiento(f: FilaMovimientoDb): MovimientoCaja {
  return {
    id: f.id,
    numero: f.numero,
    cajaId: f.caja_id,
    fecha: f.fecha,
    tipo: f.tipo,
    monto: f.monto,
    concepto: f.concepto,
    personaId: f.persona_id,
    personaNombre: f.persona_nombre,
    entregadoA: f.entregado_a,
    facturaConComprobante: Boolean(f.factura_con_comprobante),
    comprobanteNumero: f.comprobante_numero,
    reciboId: f.recibo_id,
    tieneAdjunto: f.tiene_adjunto,
    estado: f.estado,
    arqueoId: f.arqueo_id,
    cuentaGasto: f.cuenta_gasto,
    asientoId: f.asiento_id,
    creadoPorNombre: f.creado_por_nombre,
    creadoEn: f.creado_en,
  };
}

/** Movimientos activos (salidas pendientes de reposición). */
export async function listarMovimientosCaja(cajaId: string): Promise<MovimientoCaja[]> {
  await requerirPermiso("contabilidad.leer");
  const filas = await consultar<FilaMovimientoDb>(
    `${SELECT_MOVIMIENTOS_CAJA}
      WHERE m.caja_id = $1
        AND m.tipo = 'gasto'
        AND m.estado = 'pendiente'
      ORDER BY m.fecha DESC, m.numero DESC
      LIMIT 500`,
    [cajaId],
  );
  return filas.map(aMovimiento);
}

/** Histórico de salidas ya repuestas de una caja. */
export async function listarHistoricoCaja(cajaId: string): Promise<MovimientoCaja[]> {
  await requerirPermiso("contabilidad.leer");
  const filas = await consultar<FilaMovimientoDb>(
    `${SELECT_MOVIMIENTOS_CAJA}
      WHERE m.caja_id = $1
        AND m.tipo = 'gasto'
        AND m.estado = 'completado'
      ORDER BY m.fecha DESC, m.numero DESC
      LIMIT 1000`,
    [cajaId],
  );
  return filas.map(aMovimiento);
}

/**
 * Próximo comprobante fiscal disponible para salidas de caja chica sin factura
 * con comprobante (utilizando B11 mientras tanto). Ignora secuencias marcadas
 * como no vigentes (`vigente = false`).
 */
export async function proximoComprobanteCaja(tipo = "B11"): Promise<string | null> {
  await requerirPermiso("contabilidad.leer");
  const fila = await consultarUna<{ desde: string; usados: number }>(
    `SELECT desde::text AS desde, usados::int AS usados
       FROM contabilidad.comprobante_secuencia
      WHERE tipo = $1
        AND vigente IS NOT FALSE
        AND usados < cantidad
      ORDER BY desde ASC, creado_en ASC
      LIMIT 1`,
    [tipo],
  );
  if (!fila) return null;
  return formatearNumeroComprobante(tipo, Number(fila.desde) + fila.usados);
}

type FilaArqueo = {
  id: string;
  numero: number;
  caja_id: string;
  caja_nombre: string;
  fecha: string;
  saldo_sistema: string;
  saldo_contado: string;
  diferencia: string;
  estado: ArqueoCaja["estado"];
  justificacion: string | null;
  revisado_por_nombre: string | null;
  revisado_en: string | null;
  creado_por: string;
  creado_por_nombre: string;
  creado_en: string;
  asiento_id: string | null;
};

const SELECT_ARQUEO = `
  SELECT a.id, a.numero, a.caja_id, c.nombre AS caja_nombre,
         to_char(a.fecha, 'YYYY-MM-DD') AS fecha,
         a.saldo_sistema, a.saldo_contado, a.diferencia,
         a.estado, a.justificacion,
         r.nombre AS revisado_por_nombre, a.revisado_en,
         a.creado_por, u.nombre AS creado_por_nombre, a.creado_en,
         (SELECT s.id FROM contabilidad.asiento s
           WHERE s.origen_tabla = 'arqueo' AND s.origen_id = a.id AND NOT s.anulado
           LIMIT 1) AS asiento_id
    FROM contabilidad.arqueo a
    JOIN contabilidad.caja c ON a.caja_id = c.id
    JOIN public.usuario u ON a.creado_por = u.id
    LEFT JOIN public.usuario r ON a.revisado_por = r.id`;

function aArqueo(f: FilaArqueo): ArqueoCaja {
  return {
    id: f.id,
    numero: f.numero,
    cajaId: f.caja_id,
    cajaNombre: f.caja_nombre,
    fecha: f.fecha,
    saldoSistema: f.saldo_sistema,
    saldoContado: f.saldo_contado,
    diferencia: f.diferencia,
    estado: f.estado,
    justificacion: f.justificacion,
    revisadoPorNombre: f.revisado_por_nombre,
    revisadoEn: f.revisado_en,
    creadoPorId: f.creado_por,
    creadoPorNombre: f.creado_por_nombre,
    creadoEn: f.creado_en,
    asientoId: f.asiento_id,
  };
}

export async function listarArqueos(cajaId: string): Promise<ArqueoCaja[]> {
  await requerirPermiso("contabilidad.leer");
  const filas = await consultar<FilaArqueo>(
    `${SELECT_ARQUEO} WHERE a.caja_id = $1 ORDER BY a.fecha DESC, a.numero DESC LIMIT 100`,
    [cajaId],
  );
  return filas.map(aArqueo);
}

export async function obtenerArqueoConDenominaciones(arqueoId: string): Promise<ArqueoCaja | null> {
  await requerirPermiso("contabilidad.leer");

  const fila = await consultarUna<FilaArqueo>(`${SELECT_ARQUEO} WHERE a.id = $1`, [arqueoId]);
  if (!fila) return null;

  const denominaciones = await consultar<{
    denominacion: string;
    tipo: "billete" | "moneda";
    cantidad_esperada: number;
    cantidad: number;
    subtotal: string;
  }>(
    `SELECT denominacion, tipo, COALESCE(cantidad_esperada, 0)::int AS cantidad_esperada,
            cantidad, subtotal
       FROM contabilidad.arqueo_denominacion
      WHERE arqueo_id = $1
      ORDER BY denominacion DESC`,
    [arqueoId],
  );

  return {
    ...aArqueo(fila),
    denominaciones: denominaciones.map((d) => {
      const denom = Number(d.denominacion);
      const esperada = Number(d.cantidad_esperada) || 0;
      return {
        denominacion: denom,
        tipo: d.tipo,
        cantidadEsperada: esperada,
        subtotalEsperado: redondear(denom * esperada),
        cantidad: d.cantidad,
        subtotal: Number(d.subtotal),
      };
    }),
  };
}

/** Datos completos para generar o reimprimir el Acta de Arqueo de Caja Chica en PDF. */
export async function obtenerDatosActaArqueo(arqueoId: string): Promise<DatosActaArqueo | null> {
  await requerirPermiso("contabilidad.leer");

  const fila = await consultarUna<
    FilaArqueo & {
      caja_codigo: string;
      caja_moneda: "DOP" | "USD";
      cuenta_codigo: string | null;
      cuenta_nombre: string | null;
      responsable_nombre: string;
      supervisor_nombre: string | null;
    }
  >(
    `SELECT a.id, a.numero, a.caja_id, c.nombre AS caja_nombre,
            c.codigo AS caja_codigo, c.moneda AS caja_moneda,
            cc.codigo AS cuenta_codigo, cc.nombre AS cuenta_nombre,
            resp.nombre AS responsable_nombre, sup.nombre AS supervisor_nombre,
            to_char(a.fecha, 'YYYY-MM-DD') AS fecha,
            a.saldo_sistema, a.saldo_contado, a.diferencia,
            a.estado, a.justificacion,
            r.nombre AS revisado_por_nombre, a.revisado_en,
            a.creado_por, u.nombre AS creado_por_nombre, a.creado_en,
            (SELECT s.id FROM contabilidad.asiento s
              WHERE s.origen_tabla = 'arqueo' AND s.origen_id = a.id AND NOT s.anulado
              LIMIT 1) AS asiento_id
       FROM contabilidad.arqueo a
       JOIN contabilidad.caja c ON a.caja_id = c.id
       JOIN public.usuario u ON a.creado_por = u.id
       JOIN public.usuario resp ON c.responsable_id = resp.id
       LEFT JOIN public.usuario sup ON c.supervisor_id = sup.id
       LEFT JOIN public.usuario r ON a.revisado_por = r.id
       LEFT JOIN contabilidad.cuenta_contable cc
              ON cc.id = COALESCE(c.cuenta_contable_id,
                                  (SELECT cuenta_id FROM contabilidad.codigo_transaccion
                                   WHERE codigo = 'CAJ_CAJA_CHICA'))
      WHERE a.id = $1`,
    [arqueoId],
  );
  if (!fila) return null;

  const filasDenom = await consultar<{
    denominacion: string;
    tipo: "billete" | "moneda";
    cantidad_esperada: number;
    cantidad: number;
    subtotal: string;
  }>(
    `SELECT denominacion, tipo, COALESCE(cantidad_esperada, 0)::int AS cantidad_esperada,
            cantidad, subtotal
       FROM contabilidad.arqueo_denominacion
      WHERE arqueo_id = $1
      ORDER BY denominacion DESC`,
    [arqueoId],
  );

  const porClave = new Map(
    filasDenom.map((d) => [claveDenominacion(Number(d.denominacion)), d]),
  );

  const denominaciones: DenominacionConteo[] = denominacionesDe(fila.caja_moneda).map((d) => {
    const guardada = porClave.get(claveDenominacion(d.valor));
    const cantidadEsperada = guardada ? Number(guardada.cantidad_esperada) || 0 : 0;
    const cantidad = guardada ? Number(guardada.cantidad) || 0 : 0;
    return {
      denominacion: d.valor,
      tipo: d.tipo,
      cantidadEsperada,
      subtotalEsperado: redondear(d.valor * cantidadEsperada),
      cantidad,
      subtotal: redondear(d.valor * cantidad),
    };
  });

  return {
    ...aArqueo(fila),
    cajaCodigo: fila.caja_codigo,
    cajaMoneda: fila.caja_moneda,
    cuentaContableCodigo: fila.cuenta_codigo,
    cuentaContableNombre: fila.cuenta_nombre,
    responsableNombre: fila.responsable_nombre,
    supervisorNombre: fila.supervisor_nombre,
    denominaciones,
  };
}

/** Ruta del comprobante de un movimiento, para firmar la descarga. */
export async function adjuntoDeMovimiento(
  movimientoId: string,
): Promise<{ id: string; ruta: string } | null> {
  await requerirPermiso("contabilidad.leer");
  return consultarUna<{ id: string; ruta: string }>(
    `SELECT id, adjunto_ruta AS ruta FROM contabilidad.caja_movimiento
      WHERE id = $1 AND adjunto_ruta IS NOT NULL`,
    [movimientoId],
  );
}

export type MovimientoCajaGeneral = {
  id: string;
  numero: number;
  fecha: string;
  tipo: "ingreso" | "egreso";
  concepto: string;
  monto: string;
  cuentaContrapartidaNombre: string | null;
  cuentaContrapartidaCodigo: string | null;
  arqueoId: string | null;
  cierreNumero: number | null;
  cierreFecha: string | null;
  creadoPorNombre: string;
};

export type CierreCajaGeneral = {
  id: string;
  numero: number;
  fecha: string;
};

type FilaCajaGeneralDb = {
  id: string;
  numero: number;
  fecha: string;
  tipo: "ingreso" | "egreso";
  concepto: string;
  monto: string;
  cuenta_nombre: string | null;
  cuenta_codigo: string | null;
  arqueo_id: string | null;
  cierre_numero: number | null;
  cierre_fecha: string | null;
  creado_por_nombre: string;
};

function aMovimientoGeneral(f: FilaCajaGeneralDb): MovimientoCajaGeneral {
  return {
    id: f.id,
    numero: f.numero,
    fecha: f.fecha,
    tipo: f.tipo,
    concepto: f.concepto,
    monto: f.monto,
    cuentaContrapartidaNombre: f.cuenta_nombre,
    cuentaContrapartidaCodigo: f.cuenta_codigo,
    arqueoId: f.arqueo_id,
    cierreNumero: f.cierre_numero,
    cierreFecha: f.cierre_fecha,
    creadoPorNombre: f.creado_por_nombre,
  };
}

const SELECT_MOV_GENERAL = `
  SELECT m.id, m.numero, to_char(m.fecha, 'YYYY-MM-DD') AS fecha,
         m.tipo, m.concepto, m.monto::text AS monto,
         cc.nombre AS cuenta_nombre, cc.codigo AS cuenta_codigo,
         m.arqueo_id,
         a.numero::int AS cierre_numero,
         to_char(a.fecha, 'YYYY-MM-DD') AS cierre_fecha,
         u.nombre AS creado_por_nombre
    FROM contabilidad.caja_movimiento m
    JOIN public.usuario u ON u.id = m.creado_por
    LEFT JOIN contabilidad.cuenta_contable cc ON cc.id = m.cuenta_contrapartida_id
    LEFT JOIN contabilidad.arqueo a ON a.id = m.arqueo_id`;

/** Ingresos y egresos activos del turno actual en Caja General. */
export async function listarMovimientosCajaGeneral(cajaId: string): Promise<{
  ingresos: MovimientoCajaGeneral[];
  egresos: MovimientoCajaGeneral[];
}> {
  await requerirPermiso("contabilidad.leer");
  const filas = await consultar<FilaCajaGeneralDb>(
    `${SELECT_MOV_GENERAL}
      WHERE m.caja_id = $1
        AND m.tipo IN ('ingreso', 'egreso')
        AND m.estado = 'pendiente'
      ORDER BY m.fecha DESC, m.numero DESC
      LIMIT 400`,
    [cajaId],
  );
  const todos = filas.map(aMovimientoGeneral);
  return {
    ingresos: todos.filter((m) => m.tipo === "ingreso"),
    egresos: todos.filter((m) => m.tipo === "egreso"),
  };
}

/** Ingresos y egresos cerrados por Cuadre y Cierre (Historial de Caja General). */
export async function listarHistorialCajaGeneral(cajaId: string): Promise<{
  ingresos: MovimientoCajaGeneral[];
  egresos: MovimientoCajaGeneral[];
  cierres: CierreCajaGeneral[];
}> {
  await requerirPermiso("contabilidad.leer");
  const [filas, cierres] = await Promise.all([
    consultar<FilaCajaGeneralDb>(
      `${SELECT_MOV_GENERAL}
        WHERE m.caja_id = $1
          AND m.tipo IN ('ingreso', 'egreso')
          AND m.estado = 'completado'
        ORDER BY m.fecha DESC, m.numero DESC
        LIMIT 800`,
      [cajaId],
    ),
    consultar<CierreCajaGeneral>(
      `SELECT a.id, a.numero::int AS numero, to_char(a.fecha, 'YYYY-MM-DD') AS fecha
         FROM contabilidad.arqueo a
        WHERE a.caja_id = $1
        ORDER BY a.fecha DESC, a.numero DESC
        LIMIT 100`,
      [cajaId],
    ),
  ]);
  const todos = filas.map(aMovimientoGeneral);
  return {
    ingresos: todos.filter((m) => m.tipo === "ingreso"),
    egresos: todos.filter((m) => m.tipo === "egreso"),
    cierres,
  };
}
