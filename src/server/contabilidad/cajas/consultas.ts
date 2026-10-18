import { consultar, consultarUna } from "@/lib/db";
import { requerirRol } from "@/lib/auth";

export type CajaResumen = {
  id: string;
  codigo: string;
  nombre: string;
  departamento: string;
  responsableId: string;
  responsableNombre: string;
  moneda: "DOP" | "USD";
  fondoFijo: string;
  saldoActual: string;
  umbralAdjunto: string;
  cuentaContableCodigo: string | null;
  cuentaContableNombre: string | null;
  estado: "activa" | "inactiva";
  creadoEn: string;
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
  facturaId: string | null;
  reciboId: string | null;
  adjuntoRuta: string | null;
  estado: "pendiente" | "completado" | "anulado";
  arqueoId: string | null;
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
  creadoPorNombre: string;
  creadoEn: string;
  denominaciones?: DenominacionConteo[];
};

export async function listarCajas(): Promise<CajaResumen[]> {
  await requerirRol(["contabilidad", "super_admin"]);

  const filas = await consultar<{
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
  }>(
    `SELECT
       c.id, c.codigo, c.nombre, c.departamento,
       c.responsable_id, u.nombre AS responsable_nombre,
       c.moneda, c.fondo_fijo, c.saldo_actual, c.umbral_adjunto,
       cc.codigo AS cuenta_codigo, cc.nombre AS cuenta_nombre,
       c.estado, c.creado_en
     FROM contabilidad.caja c
     JOIN public.usuario u ON c.responsable_id = u.id
     LEFT JOIN contabilidad.cuenta_contable cc ON c.cuenta_contable_id = cc.id
     ORDER BY c.nombre ASC`,
  );

  return filas.map((f) => ({
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
  }));
}

export async function obtenerCaja(cajaId: string): Promise<CajaResumen | null> {
  await requerirRol(["contabilidad", "super_admin"]);

  const f = await consultarUna<{
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
  }>(
    `SELECT
       c.id, c.codigo, c.nombre, c.departamento,
       c.responsable_id, u.nombre AS responsable_nombre,
       c.moneda, c.fondo_fijo, c.saldo_actual, c.umbral_adjunto,
       cc.codigo AS cuenta_codigo, cc.nombre AS cuenta_nombre,
       c.estado, c.creado_en
     FROM contabilidad.caja c
     JOIN public.usuario u ON c.responsable_id = u.id
     LEFT JOIN contabilidad.cuenta_contable cc ON c.cuenta_contable_id = cc.id
     WHERE c.id = $1`,
    [cajaId],
  );

  if (!f) return null;

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
  };
}

export async function listarMovimientosCaja(cajaId: string): Promise<MovimientoCaja[]> {
  await requerirRol(["contabilidad", "super_admin"]);

  const filas = await consultar<{
    id: string;
    numero: number;
    caja_id: string;
    fecha: string;
    tipo: "vale" | "gasto" | "reposicion" | "ajuste";
    monto: string;
    concepto: string;
    persona_id: string | null;
    persona_nombre: string | null;
    factura_id: string | null;
    recibo_id: string | null;
    adjunto_ruta: string | null;
    estado: "pendiente" | "completado" | "anulado";
    arqueo_id: string | null;
    creado_por_nombre: string;
    creado_en: string;
  }>(
    `SELECT
       m.id, m.numero, m.caja_id, to_char(m.fecha, 'YYYY-MM-DD') AS fecha,
       m.tipo, m.monto, m.concepto,
       m.persona_id, p.nombre AS persona_nombre,
       m.factura_id, m.recibo_id, m.adjunto_ruta,
       m.estado, m.arqueo_id,
       u.nombre AS creado_por_nombre, m.creado_en
     FROM contabilidad.caja_movimiento m
     JOIN public.usuario u ON m.creado_por = u.id
     LEFT JOIN public.usuario p ON m.persona_id = p.id
     WHERE m.caja_id = $1
     ORDER BY m.fecha DESC, m.numero DESC`,
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
    facturaId: f.factura_id,
    reciboId: f.recibo_id,
    adjuntoRuta: f.adjunto_ruta,
    estado: f.estado,
    arqueoId: f.arqueo_id,
    creadoPorNombre: f.creado_por_nombre,
    creadoEn: f.creado_en,
  }));
}

export async function listarArqueos(cajaId: string): Promise<ArqueoCaja[]> {
  await requerirRol(["contabilidad", "super_admin"]);

  const filas = await consultar<{
    id: string;
    numero: number;
    caja_id: string;
    caja_nombre: string;
    fecha: string;
    saldo_sistema: string;
    saldo_contado: string;
    diferencia: string;
    estado: "abierto" | "cerrado" | "aprobado";
    justificacion: string | null;
    revisado_por_nombre: string | null;
    revisado_en: string | null;
    creado_por_nombre: string;
    creado_en: string;
  }>(
    `SELECT
       a.id, a.numero, a.caja_id, c.nombre AS caja_nombre,
       to_char(a.fecha, 'YYYY-MM-DD') AS fecha,
       a.saldo_sistema, a.saldo_contado, a.diferencia,
       a.estado, a.justificacion,
       r.nombre AS revisado_por_nombre, a.revisado_en,
       u.nombre AS creado_por_nombre, a.creado_en
     FROM contabilidad.arqueo a
     JOIN contabilidad.caja c ON a.caja_id = c.id
     JOIN public.usuario u ON a.creado_por = u.id
     LEFT JOIN public.usuario r ON a.revisado_por = r.id
     WHERE a.caja_id = $1
     ORDER BY a.fecha DESC, a.numero DESC`,
    [cajaId],
  );

  return filas.map((f) => ({
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
    creadoPorNombre: f.creado_por_nombre,
    creadoEn: f.creado_en,
  }));
}

export async function obtenerArqueoConDenominaciones(arqueoId: string): Promise<ArqueoCaja | null> {
  await requerirRol(["contabilidad", "super_admin"]);

  const a = await consultarUna<{
    id: string;
    numero: number;
    caja_id: string;
    caja_nombre: string;
    fecha: string;
    saldo_sistema: string;
    saldo_contado: string;
    diferencia: string;
    estado: "abierto" | "cerrado" | "aprobado";
    justificacion: string | null;
    revisado_por_nombre: string | null;
    revisado_en: string | null;
    creado_por_nombre: string;
    creado_en: string;
  }>(
    `SELECT
       a.id, a.numero, a.caja_id, c.nombre AS caja_nombre,
       to_char(a.fecha, 'YYYY-MM-DD') AS fecha,
       a.saldo_sistema, a.saldo_contado, a.diferencia,
       a.estado, a.justificacion,
       r.nombre AS revisado_por_nombre, a.revisado_en,
       u.nombre AS creado_por_nombre, a.creado_en
     FROM contabilidad.arqueo a
     JOIN contabilidad.caja c ON a.caja_id = c.id
     JOIN public.usuario u ON a.creado_por = u.id
     LEFT JOIN public.usuario r ON a.revisado_por = r.id
     WHERE a.id = $1`,
    [arqueoId],
  );

  if (!a) return null;

  const denoms = await consultar<{
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
    id: a.id,
    numero: a.numero,
    cajaId: a.caja_id,
    cajaNombre: a.caja_nombre,
    fecha: a.fecha,
    saldoSistema: a.saldo_sistema,
    saldoContado: a.saldo_contado,
    diferencia: a.diferencia,
    estado: a.estado,
    justificacion: a.justificacion,
    revisadoPorNombre: a.revisado_por_nombre,
    revisadoEn: a.revisado_en,
    creadoPorNombre: a.creado_por_nombre,
    creadoEn: a.creado_en,
    denominaciones: denoms.map((d) => ({
      denominacion: parseFloat(d.denominacion),
      tipo: d.tipo,
      cantidad: d.cantidad,
      subtotal: parseFloat(d.subtotal),
    })),
  };
}
