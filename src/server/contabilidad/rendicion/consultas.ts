import { consultar } from "@/lib/db";

export type RendicionDonante = {
  donante: {
    id: string;
    nombre: string;
    identificacion: string;
    email: string | null;
    telefono: string | null;
  };
  donaciones: {
    id: string;
    numero: number;
    fecha: string;
    clase: string;
    monto: number;
    moneda: string;
    fondoNombre: string;
    asientoNumero: number | null;
  }[];
  fondos: {
    id: string;
    codigo: string | null;
    nombre: string;
    tipoRestriccion: string;
    propositoRestringido: string | null;
    montoOriginal: number;
    montoLiberado: number;
    saldoDisponible: number;
  }[];
  ejecuciones: {
    id: string;
    fecha: string;
    fondoNombre: string;
    centroCostoNombre: string | null;
    cuentaNombre: string;
    monto: number;
    descripcion: string | null;
  }[];
  totales: {
    totalDonado: number;
    totalEjecutadoLiberado: number;
    saldoPendienteRestringido: number;
  };
};

export async function obtenerTrazabilidadDonante(donanteId: string): Promise<RendicionDonante | null> {
  // 1. Datos del donante
  const dRows = await consultar<{
    id: string;
    nombre: string;
    identificacion: string;
    email: string | null;
    telefono: string | null;
  }>(
    `SELECT id, nombre_razon_social AS nombre, identificacion, email, telefono
       FROM contabilidad.tercero
      WHERE id = $1`,
    [donanteId]
  );

  if (dRows.length === 0) return null;
  const donante = dRows[0];

  // 2. Donaciones recibidas
  const donaciones = await consultar<{
    id: string;
    numero: number;
    fecha: string;
    clase: string;
    monto: number;
    moneda: string;
    fondoNombre: string;
    asientoNumero: number | null;
  }>(
    `SELECT d.id,
            d.numero,
            d.fecha::text,
            d.clase,
            d.monto::float,
            d.moneda,
            f.nombre AS "fondoNombre",
            a.numero::int AS "asientoNumero"
       FROM contabilidad.donacion d
       JOIN contabilidad.fondo f ON f.id = d.fondo_id
       LEFT JOIN contabilidad.asiento a ON a.id = d.asiento_id
      WHERE d.tercero_id = $1
      ORDER BY d.fecha DESC`,
    [donanteId]
  );

  // 3. Fondos vinculados
  const fondos = await consultar<{
    id: string;
    codigo: string | null;
    nombre: string;
    tipoRestriccion: string;
    propositoRestringido: string | null;
    montoOriginal: number;
    montoLiberado: number;
    saldoDisponible: number;
  }>(
    `SELECT f.id,
            f.codigo,
            f.nombre,
            f.tipo_restriccion AS "tipoRestriccion",
            f.proposito_restringido AS "propositoRestringido",
            f.monto_restringido_original::float AS "montoOriginal",
            f.monto_liberado_acumulado::float AS "montoLiberado",
            (f.monto_restringido_original - f.monto_liberado_acumulado)::float AS "saldoDisponible"
       FROM contabilidad.fondo f
      WHERE f.donante_id = $1
      ORDER BY f.nombre ASC`,
    [donanteId]
  );

  // 4. Ejecuciones de gastos vinculados a los fondos del donante
  const ejecuciones = await consultar<{
    id: string;
    fecha: string;
    fondoNombre: string;
    centroCostoNombre: string | null;
    cuentaNombre: string;
    monto: number;
    descripcion: string | null;
  }>(
    `SELECT al.id,
            a.fecha::text,
            f.nombre AS "fondoNombre",
            cc.nombre AS "centroCostoNombre",
            cta.nombre AS "cuentaNombre",
            (al.debe - al.haber)::float AS monto,
            al.descripcion
       FROM contabilidad.asiento_linea al
       JOIN contabilidad.asiento a ON a.id = al.asiento_id
       JOIN contabilidad.fondo f ON f.id = al.fondo_id
       JOIN contabilidad.cuenta_contable cta ON cta.id = al.cuenta_id
       LEFT JOIN contabilidad.centro_costo cc ON cc.id = al.centro_costo_id
      WHERE f.donante_id = $1
        AND cta.tipo = 'gasto'
      ORDER BY a.fecha DESC
      LIMIT 100`,
    [donanteId]
  );

  const totalDonado = donaciones.reduce((acc, d) => acc + d.monto, 0);
  const totalEjecutadoLiberado = fondos.reduce((acc, f) => acc + f.montoLiberado, 0);
  const saldoPendienteRestringido = fondos.reduce((acc, f) => acc + f.saldoDisponible, 0);

  return {
    donante,
    donaciones,
    fondos,
    ejecuciones,
    totales: {
      totalDonado,
      totalEjecutadoLiberado,
      saldoPendienteRestringido,
    },
  };
}
