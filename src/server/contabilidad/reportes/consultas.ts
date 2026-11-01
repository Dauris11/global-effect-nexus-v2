import { consultar, consultarUna } from "@/lib/db";
import { requerirPermiso } from "@/lib/auth";

// ============================================================
// TIPOS: ESTADOS FINANCIEROS Y REPORTES ASFL
// ============================================================

export interface LineaCuentaBalance {
  id: string;
  codigo: string;
  nombre: string;
  tipo: "activo" | "pasivo" | "patrimonio";
  padreId: string | null;
  nivel: number;
  admiteMovimiento: boolean;
  saldo: number;
}

export interface GrupoBalance {
  titulo: string;
  subtotal: number;
  cuentas: LineaCuentaBalance[];
}

export interface BalanceGeneral {
  fechaCorte: string;
  activoCorriente: GrupoBalance;
  activoNoCorriente: GrupoBalance;
  totalActivos: number;
  pasivoCorriente: GrupoBalance;
  pasivoNoCorriente: GrupoBalance;
  totalPasivos: number;
  patrimonioSocial: GrupoBalance;
  superavitDeficitPeriodo: number;
  totalPatrimonio: number;
  diferenciaCuadre: number; // Activo - (Pasivo + Patrimonio) -> 0.00
  cuadrado: boolean;
}

export interface LineaCuentaActividades {
  id: string;
  codigo: string;
  nombre: string;
  padreId: string | null;
  nivel: number;
  admiteMovimiento: boolean;
  monto: number;
  sinRestricciones: number;
  conRestricciones: number;
}

export interface EstadoActividades {
  fechaDesde: string;
  fechaHasta: string;
  ingresos: {
    cuentas: LineaCuentaActividades[];
    total: number;
    totalSinRestricciones: number;
    totalConRestricciones: number;
  };
  gastos: {
    cuentas: LineaCuentaActividades[];
    total: number;
    totalSinRestricciones: number;
    totalConRestricciones: number;
  };
  superavitDeficitNeto: number;
  superavitSinRestricciones: number;
  superavitConRestricciones: number;
}

export interface FlujoEfectivoPartida {
  concepto: string;
  monto: number;
}

export interface EstadoFlujoEfectivo {
  fechaDesde: string;
  fechaHasta: string;
  actividadesOperativas: {
    superavitNeto: number;
    ajustesNoMonetarios: FlujoEfectivoPartida[];
    cambiosCapitalTrabajo: FlujoEfectivoPartida[];
    totalOperativo: number;
  };
  actividadesInversion: {
    partidas: FlujoEfectivoPartida[];
    totalInversion: number;
  };
  actividadesFinanciamiento: {
    partidas: FlujoEfectivoPartida[];
    totalFinanciamiento: number;
  };
  aumentoDisminucionNeta: number;
  saldoInicialEfectivo: number;
  saldoFinalEfectivo: number;
}

export interface ColumnaPatrimonio {
  noRestringido: number;
  temporalmenteRestringido: number;
  permanentementeRestringido: number;
  resultadosAcumulados: number;
  total: number;
}

export interface EstadoCambiosPatrimonio {
  ejercicio: number;
  saldoInicial: ColumnaPatrimonio;
  superavitEjercicio: ColumnaPatrimonio;
  aportesFondos: ColumnaPatrimonio;
  liberacionesFondos: ColumnaPatrimonio;
  saldoFinal: ColumnaPatrimonio;
}

export interface MovimientoMayor {
  asientoId: string;
  asientoNumero: number;
  fecha: string;
  concepto: string;
  centroCostoCodigo: string | null;
  centroCostoNombre: string | null;
  fondoCodigo: string | null;
  fondoNombre: string | null;
  debe: number;
  haber: number;
  saldoAcumulado: number;
}

export interface CuentaMayorAnalitico {
  cuentaId: string;
  codigo: string;
  nombre: string;
  tipo: string;
  saldoAnterior: number;
  totalDebe: number;
  totalHaber: number;
  saldoFinal: number;
  movimientos: MovimientoMayor[];
}

export interface MesProyeccionFlujo {
  anio: number;
  mes: number;
  mesNombre: string;
  saldoInicial: number;
  ingresosDonaciones: number;
  ingresosPromesas: number;
  otrosIngresos: number;
  totalEntradas: number;
  egresosNomina: number;
  egresosComprasComprometidas: number;
  egresosGastosFijos: number;
  totalSalidas: number;
  flujoNeto: number;
  saldoFinal: number;
}

export interface FlujoCajaProyectado {
  fechaInicio: string;
  saldoDisponibleActual: number;
  meses: MesProyeccionFlujo[];
}

export interface SnapshotFinanciero {
  id: string;
  tipo: string;
  ejercicio: number;
  mes: number | null;
  fechaCorte: string;
  titulo: string;
  datosJson: Record<string, unknown>;
  generadoPor: string;
  generadoPorNombre: string;
  generadoEn: string;
}

// ============================================================
// 1. ESTADO DE SITUACIÓN FINANCIERA (BALANCE GENERAL)
// ============================================================

export async function obtenerBalanceGeneral(filtros?: {
  fechaCorte?: string;
  centroCostoId?: string;
  fondoId?: string;
}): Promise<BalanceGeneral> {
  await requerirPermiso("contabilidad.leer");

  const fechaCorte = filtros?.fechaCorte ?? new Date().toISOString().slice(0, 10);

  // Consulta los saldos históricos acumulados de cada cuenta contable hasta fechaCorte
  const params: unknown[] = [fechaCorte];
  let filtroExtra = "";

  if (filtros?.centroCostoId) {
    params.push(filtros.centroCostoId);
    filtroExtra += ` AND al.centro_costo_id = $${params.length}`;
  }
  if (filtros?.fondoId) {
    params.push(filtros.fondoId);
    filtroExtra += ` AND al.fondo_id = $${params.length}`;
  }

  // Obtenemos todas las cuentas del catálogo y la agregación de movimientos válidos
  const filas = await consultar<{
    id: string;
    codigo: string;
    nombre: string;
    tipo: "activo" | "pasivo" | "patrimonio" | "ingreso" | "gasto";
    padre_id: string | null;
    admite_movimiento: boolean;
    total_debe: string;
    total_haber: string;
  }>(
    `SELECT
       c.id,
       c.codigo,
       c.nombre,
       c.tipo,
       c.padre_id,
       c.admite_movimiento,
       COALESCE(SUM(al.debe), 0) AS total_debe,
       COALESCE(SUM(al.haber), 0) AS total_haber
     FROM contabilidad.cuenta_contable c
     LEFT JOIN contabilidad.asiento_linea al ON al.cuenta_id = c.id
     LEFT JOIN contabilidad.asiento a ON a.id = al.asiento_id
       AND a.anulado = false
       AND a.fecha <= $1
       ${filtroExtra}
     GROUP BY c.id, c.codigo, c.nombre, c.tipo, c.padre_id, c.admite_movimiento
     ORDER BY c.codigo ASC`,
    params,
  );

  // Mapeamos los saldos por cuenta según la naturaleza
  // Activos: saldo = debe - haber (o haber - debe si es complementaria como depreciación acumulada 1.2.09)
  // Pasivo y Patrimonio: saldo = haber - debe
  // Ingresos: haber - debe
  // Gastos: debe - haber
  let totalIngresos = 0;
  let totalGastos = 0;

  const cuentasProcesadas: (LineaCuentaBalance & { tipoCuenta: string })[] = [];

  for (const r of filas) {
    const debe = Number(r.total_debe);
    const haber = Number(r.total_haber);
    const nivel = r.codigo.split(".").length;

    if (r.tipo === "ingreso") {
      totalIngresos += (haber - debe);
      continue;
    }
    if (r.tipo === "gasto") {
      totalGastos += (debe - haber);
      continue;
    }

    let saldo = 0;
    if (r.tipo === "activo") {
      // Depreciación acumulada u otras reguladoras de activo se restan
      if (r.codigo.startsWith("1.2.09") || r.codigo.startsWith("1.2.01.02")) {
        saldo = -(haber - debe); // Presentación negativa en activo
      } else {
        saldo = debe - haber;
      }
    } else {
      // Pasivo y Patrimonio: saldo acreedor
      saldo = haber - debe;
    }

    cuentasProcesadas.push({
      id: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      tipo: r.tipo as "activo" | "pasivo" | "patrimonio",
      padreId: r.padre_id,
      nivel,
      admiteMovimiento: r.admite_movimiento,
      saldo: Number(saldo.toFixed(2)),
      tipoCuenta: r.tipo,
    });
  }

  // Agrupación de Activos
  const cuentasActivoCorriente = cuentasProcesadas.filter(
    (c) => c.tipoCuenta === "activo" && c.codigo.startsWith("1.1"),
  );
  const cuentasActivoNoCorriente = cuentasProcesadas.filter(
    (c) => c.tipoCuenta === "activo" && (c.codigo.startsWith("1.2") || !c.codigo.startsWith("1.1")),
  );

  const subtotalActivoCorriente = cuentasActivoCorriente
    .filter((c) => c.admiteMovimiento)
    .reduce((acc, c) => acc + c.saldo, 0);

  const subtotalActivoNoCorriente = cuentasActivoNoCorriente
    .filter((c) => c.admiteMovimiento)
    .reduce((acc, c) => acc + c.saldo, 0);

  const totalActivos = Number((subtotalActivoCorriente + subtotalActivoNoCorriente).toFixed(2));

  // Agrupación de Pasivos
  const cuentasPasivoCorriente = cuentasProcesadas.filter(
    (c) => c.tipoCuenta === "pasivo" && (c.codigo.startsWith("2.1") || !c.codigo.startsWith("2.2")),
  );
  const cuentasPasivoNoCorriente = cuentasProcesadas.filter(
    (c) => c.tipoCuenta === "pasivo" && c.codigo.startsWith("2.2"),
  );

  const subtotalPasivoCorriente = cuentasPasivoCorriente
    .filter((c) => c.admiteMovimiento)
    .reduce((acc, c) => acc + c.saldo, 0);

  const subtotalPasivoNoCorriente = cuentasPasivoNoCorriente
    .filter((c) => c.admiteMovimiento)
    .reduce((acc, c) => acc + c.saldo, 0);

  const totalPasivos = Number((subtotalPasivoCorriente + subtotalPasivoNoCorriente).toFixed(2));

  // Agrupación de Patrimonio
  const cuentasPatrimonio = cuentasProcesadas.filter((c) => c.tipoCuenta === "patrimonio");
  const subtotalPatrimonioSocial = cuentasPatrimonio
    .filter((c) => c.admiteMovimiento)
    .reduce((acc, c) => acc + c.saldo, 0);

  // Superávit / Déficit del período en curso
  const superavitDeficitPeriodo = Number((totalIngresos - totalGastos).toFixed(2));
  const totalPatrimonio = Number((subtotalPatrimonioSocial + superavitDeficitPeriodo).toFixed(2));

  const diferenciaCuadre = Number((totalActivos - (totalPasivos + totalPatrimonio)).toFixed(2));
  const cuadrado = Math.abs(diferenciaCuadre) < 0.01;

  return {
    fechaCorte,
    activoCorriente: {
      titulo: "Activo Corriente",
      subtotal: Number(subtotalActivoCorriente.toFixed(2)),
      cuentas: cuentasActivoCorriente,
    },
    activoNoCorriente: {
      titulo: "Activo No Corriente",
      subtotal: Number(subtotalActivoNoCorriente.toFixed(2)),
      cuentas: cuentasActivoNoCorriente,
    },
    totalActivos,
    pasivoCorriente: {
      titulo: "Pasivo Corriente",
      subtotal: Number(subtotalPasivoCorriente.toFixed(2)),
      cuentas: cuentasPasivoCorriente,
    },
    pasivoNoCorriente: {
      titulo: "Pasivo No Corriente",
      subtotal: Number(subtotalPasivoNoCorriente.toFixed(2)),
      cuentas: cuentasPasivoNoCorriente,
    },
    totalPasivos,
    patrimonioSocial: {
      titulo: "Patrimonio y Fondos",
      subtotal: Number(subtotalPatrimonioSocial.toFixed(2)),
      cuentas: cuentasPatrimonio,
    },
    superavitDeficitPeriodo,
    totalPatrimonio,
    diferenciaCuadre,
    cuadrado,
  };
}

// ============================================================
// 2. ESTADO DE ACTIVIDADES (RESULTADOS ASFL LEY 122-05)
// ============================================================

export async function obtenerEstadoActividades(filtros?: {
  fechaDesde?: string;
  fechaHasta?: string;
  centroCostoId?: string;
  fondoId?: string;
}): Promise<EstadoActividades> {
  await requerirPermiso("contabilidad.leer");

  const anioActual = new Date().getFullYear();
  const fechaDesde = filtros?.fechaDesde ?? `${anioActual}-01-01`;
  const fechaHasta = filtros?.fechaHasta ?? new Date().toISOString().slice(0, 10);

  const params: unknown[] = [fechaDesde, fechaHasta];
  let filtroExtra = "";

  if (filtros?.centroCostoId) {
    params.push(filtros.centroCostoId);
    filtroExtra += ` AND al.centro_costo_id = $${params.length}`;
  }
  if (filtros?.fondoId) {
    params.push(filtros.fondoId);
    filtroExtra += ` AND al.fondo_id = $${params.length}`;
  }

  const filas = await consultar<{
    id: string;
    codigo: string;
    nombre: string;
    tipo: "ingreso" | "gasto";
    padre_id: string | null;
    admite_movimiento: boolean;
    tipo_restriccion: string | null;
    debe: string;
    haber: string;
  }>(
    `SELECT
       c.id,
       c.codigo,
       c.nombre,
       c.tipo,
       c.padre_id,
       c.admite_movimiento,
       f.tipo_restriccion,
       COALESCE(SUM(al.debe), 0) AS debe,
       COALESCE(SUM(al.haber), 0) AS haber
     FROM contabilidad.cuenta_contable c
     JOIN contabilidad.asiento_linea al ON al.cuenta_id = c.id
     JOIN contabilidad.asiento a ON a.id = al.asiento_id
     LEFT JOIN contabilidad.fondo f ON f.id = al.fondo_id
     WHERE c.tipo IN ('ingreso', 'gasto')
       AND a.anulado = false
       AND a.fecha BETWEEN $1 AND $2
       ${filtroExtra}
     GROUP BY c.id, c.codigo, c.nombre, c.tipo, c.padre_id, c.admite_movimiento, f.tipo_restriccion
     ORDER BY c.codigo ASC`,
    params,
  );

  // Consolidamos por cuenta contable sumando desglose por restricción
  const mapaIngresos = new Map<string, LineaCuentaActividades>();
  const mapaGastos = new Map<string, LineaCuentaActividades>();

  let totalIngresos = 0;
  let totalIngresosSin = 0;
  let totalIngresosCon = 0;

  let totalGastos = 0;
  let totalGastosSin = 0;
  let totalGastosCon = 0;

  for (const r of filas) {
    const debe = Number(r.debe);
    const haber = Number(r.haber);
    const nivel = r.codigo.split(".").length;
    const esRestringido = r.tipo_restriccion && r.tipo_restriccion !== "no_restringido";

    if (r.tipo === "ingreso") {
      const monto = haber - debe;
      totalIngresos += monto;
      if (esRestringido) totalIngresosCon += monto;
      else totalIngresosSin += monto;

      const existente = mapaIngresos.get(r.codigo);
      if (existente) {
        existente.monto += monto;
        if (esRestringido) existente.conRestricciones += monto;
        else existente.sinRestricciones += monto;
      } else {
        mapaIngresos.set(r.codigo, {
          id: r.id,
          codigo: r.codigo,
          nombre: r.nombre,
          padreId: r.padre_id,
          nivel,
          admiteMovimiento: r.admite_movimiento,
          monto,
          sinRestricciones: esRestringido ? 0 : monto,
          conRestricciones: esRestringido ? monto : 0,
        });
      }
    } else {
      const monto = debe - haber;
      totalGastos += monto;
      if (esRestringido) totalGastosCon += monto;
      else totalGastosSin += monto;

      const existente = mapaGastos.get(r.codigo);
      if (existente) {
        existente.monto += monto;
        if (esRestringido) existente.conRestricciones += monto;
        else existente.sinRestricciones += monto;
      } else {
        mapaGastos.set(r.codigo, {
          id: r.id,
          codigo: r.codigo,
          nombre: r.nombre,
          padreId: r.padre_id,
          nivel,
          admiteMovimiento: r.admite_movimiento,
          monto,
          sinRestricciones: esRestringido ? 0 : monto,
          conRestricciones: esRestringido ? monto : 0,
        });
      }
    }
  }

  const superavitDeficitNeto = Number((totalIngresos - totalGastos).toFixed(2));
  const superavitSinRestricciones = Number((totalIngresosSin - totalGastosSin).toFixed(2));
  const superavitConRestricciones = Number((totalIngresosCon - totalGastosCon).toFixed(2));

  return {
    fechaDesde,
    fechaHasta,
    ingresos: {
      cuentas: Array.from(mapaIngresos.values()),
      total: Number(totalIngresos.toFixed(2)),
      totalSinRestricciones: Number(totalIngresosSin.toFixed(2)),
      totalConRestricciones: Number(totalIngresosCon.toFixed(2)),
    },
    gastos: {
      cuentas: Array.from(mapaGastos.values()),
      total: Number(totalGastos.toFixed(2)),
      totalSinRestricciones: Number(totalGastosSin.toFixed(2)),
      totalConRestricciones: Number(totalGastosCon.toFixed(2)),
    },
    superavitDeficitNeto,
    superavitSinRestricciones,
    superavitConRestricciones,
  };
}

// ============================================================
// 3. ESTADO DE FLUJOS DE EFECTIVO (MÉTODO INDIRECTO)
// ============================================================

export async function obtenerEstadoFlujoEfectivo(filtros?: {
  fechaDesde?: string;
  fechaHasta?: string;
}): Promise<EstadoFlujoEfectivo> {
  await requerirPermiso("contabilidad.leer");

  const anioActual = new Date().getFullYear();
  const fechaDesde = filtros?.fechaDesde ?? `${anioActual}-01-01`;
  const fechaHasta = filtros?.fechaHasta ?? new Date().toISOString().slice(0, 10);

  // 1. Superávit / Déficit neto del período
  const actividades = await obtenerEstadoActividades({ fechaDesde, fechaHasta });
  const superavitNeto = actividades.superavitDeficitNeto;

  // 2. Depreciación de activos fijos (cuenta 5.2.01.09) en el período (partida no monetaria)
  const filaDepr = await consultarUna<{ depreciacion: string }>(
    `SELECT COALESCE(SUM(al.debe - al.haber), 0) AS depreciacion
     FROM contabilidad.asiento_linea al
     JOIN contabilidad.cuenta_contable c ON c.id = al.cuenta_id
     JOIN contabilidad.asiento a ON a.id = al.asiento_id
     WHERE c.codigo = '5.2.01.09'
       AND a.anulado = false
       AND a.fecha BETWEEN $1 AND $2`,
    [fechaDesde, fechaHasta],
  );
  const depreciacionMonto = Number(filaDepr?.depreciacion ?? 0);

  // 3. Cambios en capital de trabajo (CxC, Inventario, CxP, Nómina por pagar)
  // Calculamos la variación entre fechaDesde y fechaHasta
  const filaVariaciones = await consultarUna<{
    delta_cxc: string;
    delta_inv: string;
    delta_cxp: string;
    delta_nomina: string;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN c.codigo LIKE '1.1.03%' THEN (al.debe - al.haber) ELSE 0 END), 0) AS delta_cxc,
       COALESCE(SUM(CASE WHEN c.codigo LIKE '1.1.04%' THEN (al.debe - al.haber) ELSE 0 END), 0) AS delta_inv,
       COALESCE(SUM(CASE WHEN c.codigo LIKE '2.1.01%' THEN (al.haber - al.debe) ELSE 0 END), 0) AS delta_cxp,
       COALESCE(SUM(CASE WHEN c.codigo LIKE '2.1.03%' THEN (al.haber - al.debe) ELSE 0 END), 0) AS delta_nomina
     FROM contabilidad.asiento_linea al
     JOIN contabilidad.cuenta_contable c ON c.id = al.cuenta_id
     JOIN contabilidad.asiento a ON a.id = al.asiento_id
     WHERE a.anulado = false
       AND a.fecha BETWEEN $1 AND $2`,
    [fechaDesde, fechaHasta],
  );

  const deltaCxc = -Number(filaVariaciones?.delta_cxc ?? 0); // Si sube CxC, resta efectivo
  const deltaInv = -Number(filaVariaciones?.delta_inv ?? 0); // Si sube inventario, resta efectivo
  const deltaCxp = Number(filaVariaciones?.delta_cxp ?? 0);   // Si sube CxP, retiene efectivo (suma)
  const deltaNomina = Number(filaVariaciones?.delta_nomina ?? 0);

  const ajustesNoMonetarios: FlujoEfectivoPartida[] = [
    { concepto: "Depreciación de activos fijos capitalizados", monto: Number(depreciacionMonto.toFixed(2)) },
  ];

  const cambiosCapitalTrabajo: FlujoEfectivoPartida[] = [
    { concepto: "Variación en cuentas por cobrar y anticipos", monto: Number(deltaCxc.toFixed(2)) },
    { concepto: "Variación en inventarios de suministros y comedor", monto: Number(deltaInv.toFixed(2)) },
    { concepto: "Variación en cuentas por pagar a proveedores", monto: Number(deltaCxp.toFixed(2)) },
    { concepto: "Variación en nóminas y retenciones por pagar", monto: Number(deltaNomina.toFixed(2)) },
  ];

  const totalCapitalTrabajo = deltaCxc + deltaInv + deltaCxp + deltaNomina;
  const totalOperativo = Number((superavitNeto + depreciacionMonto + totalCapitalTrabajo).toFixed(2));

  // 4. Actividades de Inversión: compras de activo fijo capitalizado (cuentas 1.2.* excepto depreciación)
  const filaInversion = await consultarUna<{ compras_activo: string }>(
    `SELECT COALESCE(SUM(al.debe - al.haber), 0) AS compras_activo
     FROM contabilidad.asiento_linea al
     JOIN contabilidad.cuenta_contable c ON c.id = al.cuenta_id
     JOIN contabilidad.asiento a ON a.id = al.asiento_id
     WHERE c.codigo LIKE '1.2%' AND c.codigo NOT LIKE '1.2.09%' AND c.codigo NOT LIKE '1.2.01.02%'
       AND a.anulado = false
       AND a.fecha BETWEEN $1 AND $2`,
    [fechaDesde, fechaHasta],
  );
  const comprasActivo = -Number(filaInversion?.compras_activo ?? 0);
  const totalInversion = Number(comprasActivo.toFixed(2));

  // 5. Actividades de Financiamiento: aportes recibidos directamente a patrimonio o fondos restringidos
  const totalFinanciamiento = 0; // En ASFL todas las donaciones entran por el Estado de Actividades

  // 6. Saldos de efectivo inicial y final (cuentas 1.1.01 y 1.1.02)
  const filaSaldosEfectivo = await consultarUna<{
    saldo_inicial: string;
    movimiento_neto: string;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN a.fecha < $1 THEN (al.debe - al.haber) ELSE 0 END), 0) AS saldo_inicial,
       COALESCE(SUM(CASE WHEN a.fecha BETWEEN $1 AND $2 THEN (al.debe - al.haber) ELSE 0 END), 0) AS movimiento_neto
     FROM contabilidad.asiento_linea al
     JOIN contabilidad.cuenta_contable c ON c.id = al.cuenta_id
     JOIN contabilidad.asiento a ON a.id = al.asiento_id
     WHERE (c.codigo LIKE '1.1.01%' OR c.codigo LIKE '1.1.02%')
       AND a.anulado = false`,
    [fechaDesde, fechaHasta],
  );

  const saldoInicialEfectivo = Number(filaSaldosEfectivo?.saldo_inicial ?? 0);
  const aumentoDisminucionNeta = Number((totalOperativo + totalInversion + totalFinanciamiento).toFixed(2));
  const saldoFinalEfectivo = Number((saldoInicialEfectivo + aumentoDisminucionNeta).toFixed(2));

  return {
    fechaDesde,
    fechaHasta,
    actividadesOperativas: {
      superavitNeto: Number(superavitNeto.toFixed(2)),
      ajustesNoMonetarios,
      cambiosCapitalTrabajo,
      totalOperativo,
    },
    actividadesInversion: {
      partidas: [
        { concepto: "Adquisición de mobiliario, equipos y mejoras", monto: totalInversion },
      ],
      totalInversion,
    },
    actividadesFinanciamiento: {
      partidas: [
        { concepto: "Aportes institucionales directos a capital de fondos", monto: 0 },
      ],
      totalFinanciamiento,
    },
    aumentoDisminucionNeta,
    saldoInicialEfectivo: Number(saldoInicialEfectivo.toFixed(2)),
    saldoFinalEfectivo,
  };
}

// ============================================================
// 4. ESTADO DE CAMBIOS EN EL PATRIMONIO / FONDOS
// ============================================================

export async function obtenerEstadoCambiosPatrimonio(filtros?: {
  ejercicio?: number;
}): Promise<EstadoCambiosPatrimonio> {
  await requerirPermiso("contabilidad.leer");

  const ejercicio = filtros?.ejercicio ?? new Date().getFullYear();
  const fechaDesde = `${ejercicio}-01-01`;
  const fechaHasta = `${ejercicio}-12-31`;

  // Saldos acumulados antes del ejercicio para resultados acumulados
  const filaInicial = await consultarUna<{ acumulado_historico: string }>(
    `SELECT COALESCE(SUM(al.haber - al.debe), 0) AS acumulado_historico
     FROM contabilidad.asiento_linea al
     JOIN contabilidad.cuenta_contable c ON c.id = al.cuenta_id
     JOIN contabilidad.asiento a ON a.id = al.asiento_id
     WHERE c.codigo = '3.1.01.02'
       AND a.anulado = false
       AND a.fecha < $1`,
    [fechaDesde],
  );
  const resAcumuladosInicial = Number(filaInicial?.acumulado_historico ?? 0);

  // Superávit del período por tipo de restricción
  const actividades = await obtenerEstadoActividades({ fechaDesde, fechaHasta });

  // Fondos liberados en el período (traslado de temporal a no restringido)
  const filaLiberaciones = await consultarUna<{ total_liberado: string }>(
    `SELECT COALESCE(SUM(monto_liberado), 0) AS total_liberado
     FROM contabilidad.fondo_liberacion
     WHERE fecha_liberacion BETWEEN $1 AND $2`,
    [fechaDesde, fechaHasta],
  );
  const totalLiberado = Number(filaLiberaciones?.total_liberado ?? 0);

  const saldoInicial: ColumnaPatrimonio = {
    noRestringido: 0,
    temporalmenteRestringido: 0,
    permanentementeRestringido: 0,
    resultadosAcumulados: resAcumuladosInicial,
    total: resAcumuladosInicial,
  };

  const superavitEjercicio: ColumnaPatrimonio = {
    noRestringido: actividades.superavitSinRestricciones,
    temporalmenteRestringido: actividades.superavitConRestricciones,
    permanentementeRestringido: 0,
    resultadosAcumulados: 0,
    total: actividades.superavitDeficitNeto,
  };

  const liberacionesFondos: ColumnaPatrimonio = {
    noRestringido: totalLiberado,
    temporalmenteRestringido: -totalLiberado,
    permanentementeRestringido: 0,
    resultadosAcumulados: 0,
    total: 0,
  };

  const aportesFondos: ColumnaPatrimonio = {
    noRestringido: 0,
    temporalmenteRestringido: 0,
    permanentementeRestringido: 0,
    resultadosAcumulados: 0,
    total: 0,
  };

  const saldoFinal: ColumnaPatrimonio = {
    noRestringido: Number((saldoInicial.noRestringido + superavitEjercicio.noRestringido + liberacionesFondos.noRestringido).toFixed(2)),
    temporalmenteRestringido: Number((saldoInicial.temporalmenteRestringido + superavitEjercicio.temporalmenteRestringido + liberacionesFondos.temporalmenteRestringido).toFixed(2)),
    permanentementeRestringido: 0,
    resultadosAcumulados: Number((saldoInicial.resultadosAcumulados).toFixed(2)),
    total: Number((saldoInicial.total + superavitEjercicio.total).toFixed(2)),
  };

  return {
    ejercicio,
    saldoInicial,
    superavitEjercicio,
    aportesFondos,
    liberacionesFondos,
    saldoFinal,
  };
}

// ============================================================
// 5. MAYOR GENERAL ANALÍTICO FILTRABLE
// ============================================================

export async function obtenerMayorAnalitico(filtros: {
  cuentaId?: string;
  codigoCuenta?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  centroCostoId?: string;
  fondoId?: string;
}): Promise<CuentaMayorAnalitico[]> {
  await requerirPermiso("contabilidad.leer");

  const anioActual = new Date().getFullYear();
  const fechaDesde = filtros.fechaDesde ?? `${anioActual}-01-01`;
  const fechaHasta = filtros.fechaHasta ?? new Date().toISOString().slice(0, 10);

  // Filtro de cuentas a incluir
  let filtroCuenta = "";
  const params: unknown[] = [fechaDesde, fechaHasta];

  if (filtros.cuentaId) {
    params.push(filtros.cuentaId);
    filtroCuenta = ` AND c.id = $${params.length}`;
  } else if (filtros.codigoCuenta) {
    params.push(`${filtros.codigoCuenta}%`);
    filtroCuenta = ` AND c.codigo LIKE $${params.length}`;
  }

  let filtroExtra = "";
  if (filtros.centroCostoId) {
    params.push(filtros.centroCostoId);
    filtroExtra += ` AND al.centro_costo_id = $${params.length}`;
  }
  if (filtros.fondoId) {
    params.push(filtros.fondoId);
    filtroExtra += ` AND al.fondo_id = $${params.length}`;
  }

  // 1. Obtener las cuentas con movimiento
  const cuentas = await consultar<{
    id: string;
    codigo: string;
    nombre: string;
    tipo: string;
  }>(
    `SELECT DISTINCT c.id, c.codigo, c.nombre, c.tipo
     FROM contabilidad.cuenta_contable c
     WHERE c.admite_movimiento = true
       ${filtroCuenta}
     ORDER BY c.codigo ASC`,
  );

  const resultado: CuentaMayorAnalitico[] = [];

  for (const c of cuentas) {
    // Saldo anterior a fechaDesde
    const saldoAntFila = await consultarUna<{ saldo_ant: string }>(
      `SELECT
         COALESCE(
           SUM(
             CASE
               WHEN $2 IN ('activo', 'gasto') THEN (al.debe - al.haber)
               ELSE (al.haber - al.debe)
             END
           ),
           0
         ) AS saldo_ant
       FROM contabilidad.asiento_linea al
       JOIN contabilidad.asiento a ON a.id = al.asiento_id
       WHERE al.cuenta_id = $1
         AND a.anulado = false
         AND a.fecha < $3`,
      [c.id, c.tipo, fechaDesde],
    );
    const saldoAnterior = Number(saldoAntFila?.saldo_ant ?? 0);

    // Movimientos del rango
    const paramsMov: unknown[] = [c.id, fechaDesde, fechaHasta];
    let extraMov = "";
    if (filtros.centroCostoId) {
      paramsMov.push(filtros.centroCostoId);
      extraMov += ` AND al.centro_costo_id = $${paramsMov.length}`;
    }
    if (filtros.fondoId) {
      paramsMov.push(filtros.fondoId);
      extraMov += ` AND al.fondo_id = $${paramsMov.length}`;
    }

    const movs = await consultar<{
      asiento_id: string;
      numero: number;
      fecha: string;
      concepto: string;
      linea_descripcion: string | null;
      cc_codigo: string | null;
      cc_nombre: string | null;
      fnd_codigo: string | null;
      fnd_nombre: string | null;
      debe: string;
      haber: string;
    }>(
      `SELECT
         a.id AS asiento_id,
         a.numero,
         a.fecha::text,
         COALESCE(al.descripcion, a.concepto) AS concepto,
         cc.codigo AS cc_codigo,
         cc.nombre AS cc_nombre,
         f.codigo AS fnd_codigo,
         f.nombre AS fnd_nombre,
         al.debe,
         al.haber
       FROM contabilidad.asiento_linea al
       JOIN contabilidad.asiento a ON a.id = al.asiento_id
       LEFT JOIN contabilidad.centro_costo cc ON cc.id = al.centro_costo_id
       LEFT JOIN contabilidad.fondo f ON f.id = al.fondo_id
       WHERE al.cuenta_id = $1
         AND a.anulado = false
         AND a.fecha BETWEEN $2 AND $3
         ${extraMov}
       ORDER BY a.fecha ASC, a.numero ASC`,
      paramsMov,
    );

    let saldoAcumulado = saldoAnterior;
    let totalDebe = 0;
    let totalHaber = 0;

    const movimientosMapeados: MovimientoMayor[] = [];
    for (const m of movs) {
      const debe = Number(m.debe);
      const haber = Number(m.haber);
      totalDebe += debe;
      totalHaber += haber;

      if (c.tipo === "activo" || c.tipo === "gasto") {
        saldoAcumulado += (debe - haber);
      } else {
        saldoAcumulado += (haber - debe);
      }

      movimientosMapeados.push({
        asientoId: m.asiento_id,
        asientoNumero: m.numero,
        fecha: m.fecha,
        concepto: m.concepto,
        centroCostoCodigo: m.cc_codigo,
        centroCostoNombre: m.cc_nombre,
        fondoCodigo: m.fnd_codigo,
        fondoNombre: m.fnd_nombre,
        debe,
        haber,
        saldoAcumulado: Number(saldoAcumulado.toFixed(2)),
      });
    }

    // Solo agregamos cuentas que tengan saldo anterior o movimientos
    if (Math.abs(saldoAnterior) > 0.001 || movimientosMapeados.length > 0) {
      resultado.push({
        cuentaId: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        tipo: c.tipo,
        saldoAnterior: Number(saldoAnterior.toFixed(2)),
        totalDebe: Number(totalDebe.toFixed(2)),
        totalHaber: Number(totalHaber.toFixed(2)),
        saldoFinal: Number(saldoAcumulado.toFixed(2)),
        movimientos: movimientosMapeados,
      });
    }
  }

  return resultado;
}

// ============================================================
// 6. FLUJO DE CAJA PROYECTADO (CASH FLOW A 3 - 6 MESES)
// ============================================================

export async function obtenerFlujoCajaProyectado(filtros?: {
  mesesProyeccion?: number; // 3 a 6 meses
}): Promise<FlujoCajaProyectado> {
  await requerirPermiso("contabilidad.leer");

  const mesesTotal = Math.min(Math.max(filtros?.mesesProyeccion ?? 6, 3), 12);
  const fechaInicio = new Date().toISOString().slice(0, 10);

  // 1. Saldo actual disponible en bancos y cajas (1.1.01 y 1.1.02)
  const filaSaldo = await consultarUna<{ disponible: string }>(
    `SELECT COALESCE(SUM(al.debe - al.haber), 0) AS disponible
     FROM contabilidad.asiento_linea al
     JOIN contabilidad.cuenta_contable c ON c.id = al.cuenta_id
     JOIN contabilidad.asiento a ON a.id = al.asiento_id
     WHERE (c.codigo LIKE '1.1.01%' OR c.codigo LIKE '1.1.02%')
       AND a.anulado = false
       AND a.fecha <= $1`,
    [fechaInicio],
  );
  let saldoActual = Number(filaSaldo?.disponible ?? 0);

  // 2. Nómina estimada mensual (última nómina aprobada de empleados activos)
  const filaNominaEstimada = await consultarUna<{ total_neto: string }>(
    `SELECT COALESCE(SUM(salario_base), 0) AS total_neto
     FROM contabilidad.empleado
     WHERE estado = 'activo'`,
  );
  const gastoNominaMensual = Number(filaNominaEstimada?.total_neto ?? 0);

  // 3. Gastos fijos operativos recurrentes promedio (alquiler, agua, luz, internet 5.2.01.*)
  const filaGastosFijos = await consultarUna<{ promedio_fijo: string }>(
    `SELECT COALESCE(SUM(al.debe - al.haber) / 3, 0) AS promedio_fijo
     FROM contabilidad.asiento_linea al
     JOIN contabilidad.cuenta_contable c ON c.id = al.cuenta_id
     JOIN contabilidad.asiento a ON a.id = al.asiento_id
     WHERE c.codigo IN ('5.2.01.01', '5.2.01.02', '5.2.01.03')
       AND a.anulado = false
       AND a.fecha >= (CURRENT_DATE - INTERVAL '90 days')`,
  );
  const gastoFijoPromedio = Number(filaGastosFijos?.promedio_fijo ?? 0);

  const nombresMeses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const hoy = new Date();
  const meses: MesProyeccionFlujo[] = [];

  for (let i = 0; i < mesesTotal; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    const anio = d.getFullYear();
    const mes = d.getMonth() + 1;
    const mesNombre = `${nombresMeses[mes - 1]} ${anio}`;

    const fechaDesdeMes = `${anio}-${String(mes).padStart(2, "0")}-01`;
    const ultimoDia = new Date(anio, mes, 0).getDate();
    const fechaHastaMes = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;

    // Cuotas de promesa que vencen en el mes; se proyecta solo lo que falta
    // por cobrar porque una cuota puede haberse abonado en parte.
    const filaPromesas = await consultarUna<{ total_promesas: string }>(
      `SELECT COALESCE(SUM(monto - monto_cobrado), 0) AS total_promesas
       FROM contabilidad.promesa_cuota
       WHERE estado IN ('pendiente', 'vencida')
         AND fecha_vencimiento BETWEEN $1 AND $2`,
      [fechaDesdeMes, fechaHastaMes],
    );
    const ingresosPromesas = Number(filaPromesas?.total_promesas ?? 0);

    // Donaciones ordinarias estimadas (promedio histórico)
    const ingresosDonaciones = 50000; // Base institucional de donantes recurrentes
    const otrosIngresos = 0;
    const totalEntradas = ingresosPromesas + ingresosDonaciones + otrosIngresos;

    // Órdenes de compra aprobadas pendientes de pago programadas para este mes
    const filaOC = await consultarUna<{ total_oc: string }>(
      `SELECT COALESCE(SUM(total), 0) AS total_oc
       FROM contabilidad.orden_compra
       WHERE estado = 'aprobada'
         AND fecha BETWEEN $1 AND $2`,
      [fechaDesdeMes, fechaHastaMes],
    );
    const egresosComprasComprometidas = Number(filaOC?.total_oc ?? 0);

    const egresosNomina = gastoNominaMensual;
    const egresosGastosFijos = gastoFijoPromedio;
    const totalSalidas = egresosNomina + egresosComprasComprometidas + egresosGastosFijos;

    const flujoNeto = totalEntradas - totalSalidas;
    const saldoInicialMes = saldoActual;
    const saldoFinalMes = saldoInicialMes + flujoNeto;
    saldoActual = saldoFinalMes;

    meses.push({
      anio,
      mes,
      mesNombre,
      saldoInicial: Number(saldoInicialMes.toFixed(2)),
      ingresosDonaciones: Number(ingresosDonaciones.toFixed(2)),
      ingresosPromesas: Number(ingresosPromesas.toFixed(2)),
      otrosIngresos: Number(otrosIngresos.toFixed(2)),
      totalEntradas: Number(totalEntradas.toFixed(2)),
      egresosNomina: Number(egresosNomina.toFixed(2)),
      egresosComprasComprometidas: Number(egresosComprasComprometidas.toFixed(2)),
      egresosGastosFijos: Number(egresosGastosFijos.toFixed(2)),
      totalSalidas: Number(totalSalidas.toFixed(2)),
      flujoNeto: Number(flujoNeto.toFixed(2)),
      saldoFinal: Number(saldoFinalMes.toFixed(2)),
    });
  }

  return {
    fechaInicio,
    saldoDisponibleActual: Number(Number(filaSaldo?.disponible ?? 0).toFixed(2)),
    meses,
  };
}

// ============================================================
// 7. SNAPSHOTS FINANCIEROS AUDITABLES
// ============================================================

export async function listarSnapshotsFinancieros(ejercicio?: number): Promise<SnapshotFinanciero[]> {
  await requerirPermiso("contabilidad.leer");

  const params: unknown[] = [];
  let where = "";

  if (ejercicio) {
    params.push(ejercicio);
    where = `WHERE s.ejercicio = $1`;
  }

  const filas = await consultar<{
    id: string;
    tipo: string;
    ejercicio: number;
    mes: number | null;
    fecha_corte: string;
    titulo: string;
    datos_json: Record<string, unknown>;
    generado_por: string;
    generado_por_nombre: string;
    generado_en: string;
  }>(
    `SELECT
       s.id,
       s.tipo,
       s.ejercicio,
       s.mes,
       s.fecha_corte::text,
       s.titulo,
       s.datos_json,
       s.generado_por,
       COALESCE(u.nombre, u.email) AS generado_por_nombre,
       s.generado_en::text
     FROM contabilidad.snapshot_financiero s
     JOIN public.usuario u ON u.id = s.generado_por
     ${where}
     ORDER BY s.generado_en DESC`,
    params,
  );

  return filas.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    ejercicio: r.ejercicio,
    mes: r.mes,
    fechaCorte: r.fecha_corte,
    titulo: r.titulo,
    datosJson: r.datos_json,
    generadoPor: r.generado_por,
    generadoPorNombre: r.generado_por_nombre,
    generadoEn: r.generado_en,
  }));
}
