import { consultar, consultarUna } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth";

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
  responsableId: string;
  responsableNombre: string;
  moneda: "DOP" | "USD";
  fondoFijo: string;
  /** Efectivo que debería haber en la caja según el sistema. */
  saldoActual: string;
  umbralAdjunto: string;
  cuentaContableCodigo: string | null;
  cuentaContableNombre: string | null;
  estado: "activa" | "inactiva";
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
  cantidad: number;
  subtotal: number;
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
  responsable_id: string;
  responsable_nombre: string;
  moneda: "DOP" | "USD";
  fondo_fijo: string;
  saldo_actual: string;
  umbral_adjunto: string;
  cuenta_codigo: string | null;
  cuenta_nombre: string | null;
  estado: "activa" | "inactiva";
  creado_en: string;
  pendiente_reposicion: string;
  vales_pendientes: string;
  arqueos_por_aprobar: number;
  ultimo_arqueo: string | null;
};

// La cuenta de la caja cae en "Caja Chica" del catálogo cuando la caja se
// creó sin cuenta (código = CUENTA_CAJA_CHICA de lib/contabilidad/cajas): así
// el cuadre nunca se queda sin contrapartida.
const SELECT_CAJA = `
  SELECT c.id, c.codigo, c.nombre, c.departamento,
         c.responsable_id, u.nombre AS responsable_nombre,
         c.moneda, c.fondo_fijo, c.saldo_actual, c.umbral_adjunto,
         cc.codigo AS cuenta_codigo, cc.nombre AS cuenta_nombre,
         c.estado, c.creado_en,
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
    LEFT JOIN contabilidad.cuenta_contable cc
           ON cc.id = COALESCE(c.cuenta_contable_id,
                               (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '1.1.01.02'))`;

function aCaja(f: FilaCaja): CajaResumen {
  return {
    id: f.id,
    codigo: f.codigo,
    nombre: f.nombre,
    departamento: f.departamento,
    responsableId: f.responsable_id,
    responsableNombre: f.responsable_nombre,
    moneda: f.moneda,
    fondoFijo: f.fondo_fijo,
    saldoActual: f.saldo_actual,
    umbralAdjunto: f.umbral_adjunto,
    cuentaContableCodigo: f.cuenta_codigo,
    cuentaContableNombre: f.cuenta_nombre,
    estado: f.estado,
    creadoEn: f.creado_en,
    pendienteReposicion: f.pendiente_reposicion,
    valesPendientes: f.vales_pendientes,
    arqueosPorAprobar: f.arqueos_por_aprobar,
    ultimoArqueo: f.ultimo_arqueo,
  };
}

export async function listarCajas(): Promise<CajaResumen[]> {
  await requerirPermiso("contabilidad.leer");
  const filas = await consultar<FilaCaja>(`${SELECT_CAJA} ORDER BY c.estado ASC, c.nombre ASC`);
  return filas.map(aCaja);
}

export async function obtenerCaja(cajaId: string): Promise<CajaResumen | null> {
  await requerirPermiso("contabilidad.leer");
  const fila = await consultarUna<FilaCaja>(`${SELECT_CAJA} WHERE c.id = $1`, [cajaId]);
  return fila ? aCaja(fila) : null;
}

/** Categorías de egreso con cuenta contable: sin cuenta no hay asiento posible. */
export async function categoriasGastoCaja(): Promise<CategoriaGastoCaja[]> {
  await requerirPermiso("contabilidad.leer");
  return consultar<CategoriaGastoCaja>(
    `SELECT cat.id, cat.nombre, cc.codigo || ' ' || cc.nombre AS cuenta
       FROM contabilidad.categoria cat
       JOIN contabilidad.cuenta_contable cc ON cc.id = cat.cuenta_id
      WHERE cat.activa AND cat.tipo IN ('egreso', 'ambos') AND cc.tipo = 'gasto'
      ORDER BY cat.nombre`,
  );
}

export async function listarMovimientosCaja(cajaId: string): Promise<MovimientoCaja[]> {
  await requerirPermiso("contabilidad.leer");

  const filas = await consultar<{
    id: string;
    numero: number;
    caja_id: string;
    fecha: string;
    tipo: MovimientoCaja["tipo"];
    monto: string;
    concepto: string;
    persona_id: string | null;
    persona_nombre: string | null;
    recibo_id: string | null;
    tiene_adjunto: boolean;
    estado: MovimientoCaja["estado"];
    arqueo_id: string | null;
    cuenta_gasto: string | null;
    asiento_id: string | null;
    creado_por_nombre: string;
    creado_en: string;
  }>(
    `SELECT m.id, m.numero, m.caja_id, to_char(m.fecha, 'YYYY-MM-DD') AS fecha,
            m.tipo, m.monto, m.concepto,
            m.persona_id, p.nombre AS persona_nombre,
            m.recibo_id, (m.adjunto_ruta IS NOT NULL) AS tiene_adjunto,
            m.estado, m.arqueo_id,
            ast.cuenta_gasto, ast.id AS asiento_id,
            u.nombre AS creado_por_nombre, m.creado_en
       FROM contabilidad.caja_movimiento m
       JOIN public.usuario u ON m.creado_por = u.id
       LEFT JOIN public.usuario p ON m.persona_id = p.id
       LEFT JOIN LATERAL (
         SELECT a.id,
                (SELECT cc.codigo || ' ' || cc.nombre
                   FROM contabilidad.asiento_linea l
                   JOIN contabilidad.cuenta_contable cc ON cc.id = l.cuenta_id
                  WHERE l.asiento_id = a.id AND l.debe > 0
                  LIMIT 1) AS cuenta_gasto
           FROM contabilidad.asiento a
          WHERE a.origen_tabla = 'caja_movimiento' AND a.origen_id = m.id AND NOT a.anulado
          LIMIT 1
       ) ast ON true
      WHERE m.caja_id = $1
      ORDER BY m.fecha DESC, m.numero DESC
      LIMIT 200`,
    [cajaId],
  );

  return filas.map((f) => ({
    id: f.id,
    numero: f.numero,
    cajaId: f.caja_id,
    fecha: f.fecha,
    tipo: f.tipo,
    monto: f.monto,
    concepto: f.concepto,
    personaId: f.persona_id,
    personaNombre: f.persona_nombre,
    reciboId: f.recibo_id,
    tieneAdjunto: f.tiene_adjunto,
    estado: f.estado,
    arqueoId: f.arqueo_id,
    cuentaGasto: f.cuenta_gasto,
    asientoId: f.asiento_id,
    creadoPorNombre: f.creado_por_nombre,
    creadoEn: f.creado_en,
  }));
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
    cantidad: number;
    subtotal: string;
  }>(
    `SELECT denominacion, tipo, cantidad, subtotal
       FROM contabilidad.arqueo_denominacion
      WHERE arqueo_id = $1
      ORDER BY denominacion DESC`,
    [arqueoId],
  );

  return {
    ...aArqueo(fila),
    denominaciones: denominaciones.map((d) => ({
      denominacion: Number(d.denominacion),
      tipo: d.tipo,
      cantidad: d.cantidad,
      subtotal: Number(d.subtotal),
    })),
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
