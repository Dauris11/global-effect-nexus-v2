import { consultar, consultarUna, enTransaccionComo } from "@/lib/db";
import { requerirPermiso, requerirUsuario } from "@/lib/auth";
import { usuarioTienePermiso } from "@/lib/rbac";
import { contextoDe } from "@/server/contabilidad/sesion";
import { registrarLectura } from "../bitacora";

export type EmpleadoContable = {
  id: string;
  tercero_id: string;
  tercero_nombre: string;
  tercero_identificacion: string;
  tercero_tipo_id: string;
  usuario_id: string | null;
  usuario_nombre: string | null;
  usuario_email: string | null;
  centro_costo_id: string;
  centro_costo_codigo: string;
  centro_costo_nombre: string;
  codigo_empleado: string;
  cargo: string;
  departamento: string;
  fecha_ingreso: string;
  fecha_salida: string | null;
  estado: "activo" | "licencia" | "suspendido" | "desvinculado";
  tipo_contrato: "indefinido" | "fijo" | "proyecto" | "pasantia";
  salario_base: number | null; // Nulo si el usuario no tiene permiso contabilidad.nomina
  banco_nombre: string | null;
  banco_cuenta: string | null;
  banco_tipo_cuenta: "ahorros" | "corriente" | null;
  cotiza_tss: boolean;
  aplica_isr: boolean;
  creado_en: string;
};

export type NominaResumen = {
  id: string;
  codigo: string;
  anio: number;
  mes: number;
  periodo_tipo: "mensual" | "primera_quincena" | "segunda_quincena" | "regalia_pascual" | "liquidacion";
  fecha_corte: string;
  fecha_pago: string;
  estado: "borrador" | "aprobada" | "pagada" | "anulada";
  total_devengado: number;
  total_afp_empleado: number;
  total_sfs_empleado: number;
  total_isr_empleado: number;
  total_otras_deducciones: number;
  total_neto: number;
  total_costo_patronal: number;
  asiento_id: string | null;
  empleados_conteo: number;
  creado_en: string;
};

export type NominaLineaDetalle = {
  id: string;
  empleado_id: string;
  codigo_empleado: string;
  empleado_nombre: string;
  empleado_identificacion: string;
  cargo: string;
  centro_costo_nombre: string;
  salario_base: number;
  dias_trabajados: number;
  horas_extras: number;
  bonificaciones: number;
  otros_ingresos: number;
  total_devengado: number;
  deduccion_afp: number;
  deduccion_sfs: number;
  deduccion_isr: number;
  otras_deducciones: number;
  total_deducciones: number;
  neto_a_pagar: number;
  aporte_afp_patronal: number;
  aporte_sfs_patronal: number;
  aporte_srl_patronal: number;
  aporte_infotep_patronal: number;
  notas: string | null;
};

export type NominaDetallada = NominaResumen & {
  lineas: NominaLineaDetalle[];
  aprobado_por: string | null;
  aprobado_en: string | null;
  notas: string | null;
};

/**
 * Lista los expedientes de empleados con control estricto de confidencialidad.
 * Si el usuario carece de `contabilidad.nomina`, el salario se omite y no se
 * registra lectura sensible de nómina. Si tiene el permiso, se entrega el salario
 * y queda constancia en la bitácora encadenada.
 */
export async function listarEmpleados(filtros?: {
  soloActivos?: boolean;
}): Promise<EmpleadoContable[]> {
  const usuario = await requerirPermiso("contabilidad.leer");
  const puedeVerNomina = usuarioTienePermiso(usuario, "contabilidad.nomina");

  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros?.soloActivos) {
    condiciones.push(`e.estado = 'activo'`);
  }

  const whereClausula = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const filas = await consultar<{
    id: string;
    tercero_id: string;
    tercero_nombre: string;
    tercero_identificacion: string;
    tercero_tipo_id: string;
    usuario_id: string | null;
    usuario_nombre: string | null;
    usuario_email: string | null;
    centro_costo_id: string;
    centro_costo_codigo: string;
    centro_costo_nombre: string;
    codigo_empleado: string;
    cargo: string;
    departamento: string;
    fecha_ingreso: string;
    fecha_salida: string | null;
    estado: "activo" | "licencia" | "suspendido" | "desvinculado";
    tipo_contrato: "indefinido" | "fijo" | "proyecto" | "pasantia";
    salario_base: string;
    banco_nombre: string | null;
    banco_cuenta: string | null;
    banco_tipo_cuenta: "ahorros" | "corriente" | null;
    cotiza_tss: boolean;
    aplica_isr: boolean;
    creado_en: string;
  }>(
    `SELECT e.id,
            e.tercero_id,
            t.nombre_razon_social AS tercero_nombre,
            t.identificacion AS tercero_identificacion,
            t.tipo_id AS tercero_tipo_id,
            e.usuario_id,
            u.nombre AS usuario_nombre,
            u.email AS usuario_email,
            e.centro_costo_id,
            cc.codigo AS centro_costo_codigo,
            cc.nombre AS centro_costo_nombre,
            e.codigo_empleado,
            e.cargo,
            e.departamento,
            to_char(e.fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso,
            to_char(e.fecha_salida, 'YYYY-MM-DD') AS fecha_salida,
            e.estado,
            e.tipo_contrato,
            e.salario_base::text AS salario_base,
            e.banco_nombre,
            e.banco_cuenta,
            e.banco_tipo_cuenta,
            e.cotiza_tss,
            e.aplica_isr,
            e.creado_en::text AS creado_en
       FROM contabilidad.empleado e
       JOIN contabilidad.tercero t ON t.id = e.tercero_id
       JOIN contabilidad.centro_costo cc ON cc.id = e.centro_costo_id
  LEFT JOIN public.usuario u ON u.id = e.usuario_id
      ${whereClausula}
      ORDER BY e.codigo_empleado ASC`,
    valores,
  );

  if (puedeVerNomina && filas.length > 0) {
    const ctx = await contextoDe(usuario);
    await enTransaccionComo(ctx, async () => {
      await registrarLectura(ctx, "ver_nomina", "contabilidad.empleado", undefined, "Listado de empleados con salario");
    });
  }

  return filas.map((f) => ({
    ...f,
    salario_base: puedeVerNomina ? Number(f.salario_base) : null,
  }));
}

/**
 * Obtiene el detalle de un empleado individual.
 */
export async function obtenerEmpleado(id: string): Promise<EmpleadoContable | null> {
  const usuario = await requerirPermiso("contabilidad.leer");
  const puedeVerNomina = usuarioTienePermiso(usuario, "contabilidad.nomina");

  const f = await consultarUna<{
    id: string;
    tercero_id: string;
    tercero_nombre: string;
    tercero_identificacion: string;
    tercero_tipo_id: string;
    usuario_id: string | null;
    usuario_nombre: string | null;
    usuario_email: string | null;
    centro_costo_id: string;
    centro_costo_codigo: string;
    centro_costo_nombre: string;
    codigo_empleado: string;
    cargo: string;
    departamento: string;
    fecha_ingreso: string;
    fecha_salida: string | null;
    estado: "activo" | "licencia" | "suspendido" | "desvinculado";
    tipo_contrato: "indefinido" | "fijo" | "proyecto" | "pasantia";
    salario_base: string;
    banco_nombre: string | null;
    banco_cuenta: string | null;
    banco_tipo_cuenta: "ahorros" | "corriente" | null;
    cotiza_tss: boolean;
    aplica_isr: boolean;
    creado_en: string;
  }>(
    `SELECT e.id,
            e.tercero_id,
            t.nombre_razon_social AS tercero_nombre,
            t.identificacion AS tercero_identificacion,
            t.tipo_id AS tercero_tipo_id,
            e.usuario_id,
            u.nombre AS usuario_nombre,
            u.email AS usuario_email,
            e.centro_costo_id,
            cc.codigo AS centro_costo_codigo,
            cc.nombre AS centro_costo_nombre,
            e.codigo_empleado,
            e.cargo,
            e.departamento,
            to_char(e.fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso,
            to_char(e.fecha_salida, 'YYYY-MM-DD') AS fecha_salida,
            e.estado,
            e.tipo_contrato,
            e.salario_base::text AS salario_base,
            e.banco_nombre,
            e.banco_cuenta,
            e.banco_tipo_cuenta,
            e.cotiza_tss,
            e.aplica_isr,
            e.creado_en::text AS creado_en
       FROM contabilidad.empleado e
       JOIN contabilidad.tercero t ON t.id = e.tercero_id
       JOIN contabilidad.centro_costo cc ON cc.id = e.centro_costo_id
  LEFT JOIN public.usuario u ON u.id = e.usuario_id
      WHERE e.id = $1`,
    [id],
  );

  if (!f) return null;

  if (puedeVerNomina) {
    const ctx = await contextoDe(usuario);
    await enTransaccionComo(ctx, async () => {
      await registrarLectura(ctx, "ver_nomina", "contabilidad.empleado", id, `Expediente del empleado ${f.codigo_empleado}`);
    });
  }

  return {
    ...f,
    salario_base: puedeVerNomina ? Number(f.salario_base) : null,
  };
}

/**
 * Lista las corridas de nómina registradas en el sistema.
 */
export async function listarNominas(filtros?: {
  anio?: number;
  mes?: number;
}): Promise<NominaResumen[]> {
  await requerirPermiso("contabilidad.leer");

  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros?.anio) {
    valores.push(filtros.anio);
    condiciones.push(`n.anio = $${valores.length}`);
  }

  if (filtros?.mes) {
    valores.push(filtros.mes);
    condiciones.push(`n.mes = $${valores.length}`);
  }

  const whereClausula = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const filas = await consultar<{
    id: string;
    codigo: string;
    anio: number;
    mes: number;
    periodo_tipo: "mensual" | "primera_quincena" | "segunda_quincena" | "regalia_pascual" | "liquidacion";
    fecha_corte: string;
    fecha_pago: string;
    estado: "borrador" | "aprobada" | "pagada" | "anulada";
    total_devengado: string;
    total_afp_empleado: string;
    total_sfs_empleado: string;
    total_isr_empleado: string;
    total_otras_deducciones: string;
    total_neto: string;
    total_costo_patronal: string;
    asiento_id: string | null;
    empleados_conteo: string;
    creado_en: string;
  }>(
    `SELECT n.id,
            n.codigo,
            n.anio,
            n.mes,
            n.periodo_tipo,
            to_char(n.fecha_corte, 'YYYY-MM-DD') AS fecha_corte,
            to_char(n.fecha_pago, 'YYYY-MM-DD') AS fecha_pago,
            n.estado,
            n.total_devengado::text AS total_devengado,
            n.total_afp_empleado::text AS total_afp_empleado,
            n.total_sfs_empleado::text AS total_sfs_empleado,
            n.total_isr_empleado::text AS total_isr_empleado,
            n.total_otras_deducciones::text AS total_otras_deducciones,
            n.total_neto::text AS total_neto,
            n.total_costo_patronal::text AS total_costo_patronal,
            n.asiento_id,
            COUNT(nl.id)::text AS empleados_conteo,
            n.creado_en::text AS creado_en
       FROM contabilidad.nomina n
  LEFT JOIN contabilidad.nomina_linea nl ON nl.nomina_id = n.id
      ${whereClausula}
      GROUP BY n.id
      ORDER BY n.anio DESC, n.mes DESC, n.creado_en DESC`,
    valores,
  );

  return filas.map((f) => ({
    ...f,
    total_devengado: Number(f.total_devengado),
    total_afp_empleado: Number(f.total_afp_empleado),
    total_sfs_empleado: Number(f.total_sfs_empleado),
    total_isr_empleado: Number(f.total_isr_empleado),
    total_otras_deducciones: Number(f.total_otras_deducciones),
    total_neto: Number(f.total_neto),
    total_costo_patronal: Number(f.total_costo_patronal),
    empleados_conteo: Number(f.empleados_conteo),
  }));
}

/**
 * Obtiene la corrida de nómina con sus líneas detalladas.
 * Requiere el permiso `contabilidad.nomina` y deja constancia en bitácora.
 */
export async function obtenerNomina(id: string): Promise<NominaDetallada | null> {
  const usuario = await requerirPermiso("contabilidad.nomina");

  const resumen = await consultarUna<{
    id: string;
    codigo: string;
    anio: number;
    mes: number;
    periodo_tipo: "mensual" | "primera_quincena" | "segunda_quincena" | "regalia_pascual" | "liquidacion";
    fecha_corte: string;
    fecha_pago: string;
    estado: "borrador" | "aprobada" | "pagada" | "anulada";
    total_devengado: string;
    total_afp_empleado: string;
    total_sfs_empleado: string;
    total_isr_empleado: string;
    total_otras_deducciones: string;
    total_neto: string;
    total_costo_patronal: string;
    asiento_id: string | null;
    aprobado_por: string | null;
    aprobado_en: string | null;
    notas: string | null;
    creado_en: string;
  }>(
    `SELECT n.id,
            n.codigo,
            n.anio,
            n.mes,
            n.periodo_tipo,
            to_char(n.fecha_corte, 'YYYY-MM-DD') AS fecha_corte,
            to_char(n.fecha_pago, 'YYYY-MM-DD') AS fecha_pago,
            n.estado,
            n.total_devengado::text AS total_devengado,
            n.total_afp_empleado::text AS total_afp_empleado,
            n.total_sfs_empleado::text AS total_sfs_empleado,
            n.total_isr_empleado::text AS total_isr_empleado,
            n.total_otras_deducciones::text AS total_otras_deducciones,
            n.total_neto::text AS total_neto,
            n.total_costo_patronal::text AS total_costo_patronal,
            n.asiento_id,
            u.nombre AS aprobado_por,
            to_char(n.aprobado_en, 'YYYY-MM-DD HH24:MI:SS') AS aprobado_en,
            n.notas,
            n.creado_en::text AS creado_en
       FROM contabilidad.nomina n
  LEFT JOIN public.usuario u ON u.id = n.aprobado_por
      WHERE n.id = $1`,
    [id],
  );

  if (!resumen) return null;

  const lineas = await consultar<{
    id: string;
    empleado_id: string;
    codigo_empleado: string;
    empleado_nombre: string;
    empleado_identificacion: string;
    cargo: string;
    centro_costo_nombre: string;
    salario_base: string;
    dias_trabajados: number;
    horas_extras: string;
    bonificaciones: string;
    otros_ingresos: string;
    total_devengado: string;
    deduccion_afp: string;
    deduccion_sfs: string;
    deduccion_isr: string;
    otras_deducciones: string;
    total_deducciones: string;
    neto_a_pagar: string;
    aporte_afp_patronal: string;
    aporte_sfs_patronal: string;
    aporte_srl_patronal: string;
    aporte_infotep_patronal: string;
    notas: string | null;
  }>(
    `SELECT nl.id,
            nl.empleado_id,
            e.codigo_empleado,
            t.nombre_razon_social AS empleado_nombre,
            t.identificacion AS empleado_identificacion,
            e.cargo,
            cc.nombre AS centro_costo_nombre,
            nl.salario_base::text AS salario_base,
            nl.dias_trabajados,
            nl.horas_extras::text AS horas_extras,
            nl.bonificaciones::text AS bonificaciones,
            nl.otros_ingresos::text AS otros_ingresos,
            nl.total_devengado::text AS total_devengado,
            nl.deduccion_afp::text AS deduccion_afp,
            nl.deduccion_sfs::text AS deduccion_sfs,
            nl.deduccion_isr::text AS deduccion_isr,
            nl.otras_deducciones::text AS otras_deducciones,
            nl.total_deducciones::text AS total_deducciones,
            nl.neto_a_pagar::text AS neto_a_pagar,
            nl.aporte_afp_patronal::text AS aporte_afp_patronal,
            nl.aporte_sfs_patronal::text AS aporte_sfs_patronal,
            nl.aporte_srl_patronal::text AS aporte_srl_patronal,
            nl.aporte_infotep_patronal::text AS aporte_infotep_patronal,
            nl.notas
       FROM contabilidad.nomina_linea nl
       JOIN contabilidad.empleado e ON e.id = nl.empleado_id
       JOIN contabilidad.tercero t ON t.id = e.tercero_id
       JOIN contabilidad.centro_costo cc ON cc.id = nl.centro_costo_id
      WHERE nl.nomina_id = $1
      ORDER BY e.codigo_empleado ASC`,
    [id],
  );

  const ctx = await contextoDe(usuario);
  await enTransaccionComo(ctx, async () => {
    await registrarLectura(ctx, "ver_nomina", "contabilidad.nomina", id, `Apertura de la nómina ${resumen.codigo}`);
  });

  return {
    ...resumen,
    total_devengado: Number(resumen.total_devengado),
    total_afp_empleado: Number(resumen.total_afp_empleado),
    total_sfs_empleado: Number(resumen.total_sfs_empleado),
    total_isr_empleado: Number(resumen.total_isr_empleado),
    total_otras_deducciones: Number(resumen.total_otras_deducciones),
    total_neto: Number(resumen.total_neto),
    total_costo_patronal: Number(resumen.total_costo_patronal),
    empleados_conteo: lineas.length,
    lineas: lineas.map((l) => ({
      ...l,
      salario_base: Number(l.salario_base),
      horas_extras: Number(l.horas_extras),
      bonificaciones: Number(l.bonificaciones),
      otros_ingresos: Number(l.otros_ingresos),
      total_devengado: Number(l.total_devengado),
      deduccion_afp: Number(l.deduccion_afp),
      deduccion_sfs: Number(l.deduccion_sfs),
      deduccion_isr: Number(l.deduccion_isr),
      otras_deducciones: Number(l.otras_deducciones),
      total_deducciones: Number(l.total_deducciones),
      neto_a_pagar: Number(l.neto_a_pagar),
      aporte_afp_patronal: Number(l.aporte_afp_patronal),
      aporte_sfs_patronal: Number(l.aporte_sfs_patronal),
      aporte_srl_patronal: Number(l.aporte_srl_patronal),
      aporte_infotep_patronal: Number(l.aporte_infotep_patronal),
    })),
  };
}

/**
 * Genera el archivo plano oficial en texto (TXT) de autodeterminación
 * para la Tesorería de la Seguridad Social (TSS / SUIR Plus).
 *
 * Estructura estándar SUIR Plus:
 * Encabezado: E|RNC_EMPRESA|AÑO_MES|TOTAL_REGISTROS|TOTAL_COTIZABLE
 * Detalle: D|CEDULA_O_NSS|SUELDO_COTIZABLE|INGRESOS_ADICIONALES|DIAS_TRABAJADOS|TIPO_INGRESO
 */
export async function generarTxtTssSuirPlus(nominaId: string): Promise<{
  nombreArchivo: string;
  contenido: string;
  totalRegistros: number;
  totalCotizable: number;
}> {
  const usuario = await requerirPermiso("contabilidad.nomina");
  const nomina = await obtenerNomina(nominaId);

  if (!nomina) {
    throw new Error("Nómina no encontrada.");
  }

  const entidad = await consultarUna<{ rnc: string; razon_social: string }>(
    `SELECT rnc, razon_social FROM contabilidad.entidad LIMIT 1`,
  );
  const rncEntidad = (entidad?.rnc ?? "430123456").replace(/\D/g, "");

  const periodoStr = `${nomina.anio}${String(nomina.mes).padStart(2, "0")}`;
  const totalRegistros = nomina.lineas.length;
  const totalCotizable = nomina.lineas.reduce((acc, l) => acc + l.total_devengado, 0);

  const lineasTxt: string[] = [];
  // Encabezado
  lineasTxt.push(
    `E|${rncEntidad}|${periodoStr}|${totalRegistros}|${totalCotizable.toFixed(2)}`,
  );

  // Registros de empleados
  for (const l of nomina.lineas) {
    const cedulaLimpia = l.empleado_identificacion.replace(/\D/g, "");
    lineasTxt.push(
      `D|${cedulaLimpia}|${l.total_devengado.toFixed(2)}|${(l.horas_extras + l.bonificaciones).toFixed(2)}|${l.dias_trabajados}|01`,
    );
  }

  const contenido = lineasTxt.join("\r\n");
  const nombreArchivo = `TSS_SUIR_${rncEntidad}_${periodoStr}.txt`;

  const ctx = await contextoDe(usuario);
  await enTransaccionComo(ctx, async () => {
    await registrarLectura(
      ctx,
      "exportar",
      "contabilidad.nomina",
      nominaId,
      `Exportación de autodeterminación TSS SUIR Plus: ${nombreArchivo}`,
    );
  });

  return {
    nombreArchivo,
    contenido,
    totalRegistros,
    totalCotizable,
  };
}

export {
  calcularPrestacionesLaborales,
  type CalculoPrestacionesInput,
  type CalculoPrestacionesOutput,
} from "@/lib/contabilidad/prestaciones";
