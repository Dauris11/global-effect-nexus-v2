"use server";

import { revalidatePath } from "next/cache";
import { enTransaccionComo, consultarUna, consultar } from "@/lib/db";
import { requerirPermiso, requerirUsuario } from "@/lib/auth";
import { fijarAccion } from "@/server/contabilidad/bitacora";
import { contextoDe } from "@/server/contabilidad/sesion";

export type CrearEmpleadoInput = {
  tercero_id: string;
  usuario_id?: string | null;
  centro_costo_id: string;
  codigo_empleado: string;
  cargo: string;
  departamento: string;
  fecha_ingreso: string;
  tipo_contrato: "indefinido" | "fijo" | "proyecto" | "pasantia";
  salario_base: number;
  banco_nombre?: string;
  banco_cuenta?: string;
  banco_tipo_cuenta?: "ahorros" | "corriente";
  cotiza_tss?: boolean;
  aplica_isr?: boolean;
};

export type CrearNominaInput = {
  anio: number;
  mes: number;
  periodo_tipo: "mensual" | "primera_quincena" | "segunda_quincena" | "regalia_pascual";
  fecha_corte: string;
  fecha_pago: string;
  notas?: string;
};

/**
 * Calcula la retención mensual del ISR para un salario gravable según
 * la escala de la DGII vigente en la fecha indicada.
 */
function calcularIsrMensual(
  salarioGravableMensual: number,
  tramos: Array<{ desde: number; hasta: number | null; tasa: number; cuota_fija: number }>,
): number {
  const salarioAnual = salarioGravableMensual * 12;

  for (const tramo of tramos) {
    if (tramo.hasta === null) {
      if (salarioAnual > tramo.desde) {
        const excedente = salarioAnual - tramo.desde;
        const impuestoAnual = tramo.cuota_fija + excedente * tramo.tasa;
        return Math.round((impuestoAnual / 12) * 100) / 100;
      }
    } else if (salarioAnual > tramo.desde && salarioAnual <= tramo.hasta) {
      const excedente = salarioAnual - tramo.desde;
      const impuestoAnual = tramo.cuota_fija + excedente * tramo.tasa;
      return Math.round((impuestoAnual / 12) * 100) / 100;
    }
  }

  return 0;
}

/**
 * Registra un nuevo empleado en el catálogo institucional.
 * Requiere el permiso `contabilidad.nomina`.
 */
export async function crearEmpleado(input: CrearEmpleadoInput): Promise<{ id: string }> {
  const usuario = await requerirPermiso("contabilidad.nomina");
  const ctx = await contextoDe(usuario);

  if (input.salario_base <= 0) {
    throw new Error("El salario base debe ser mayor a cero.");
  }

  const res = await enTransaccionComo(ctx, async (cliente) => {
    await fijarAccion(cliente, "crear_empleado");

    const { rows } = await cliente.query<{ id: string }>(
      `INSERT INTO contabilidad.empleado
         (tercero_id, usuario_id, centro_costo_id, codigo_empleado, cargo,
          departamento, fecha_ingreso, tipo_contrato, salario_base,
          banco_nombre, banco_cuenta, banco_tipo_cuenta, cotiza_tss, aplica_isr)
       VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        input.tercero_id,
        input.usuario_id || null,
        input.centro_costo_id,
        input.codigo_empleado.trim(),
        input.cargo.trim(),
        input.departamento.trim(),
        input.fecha_ingreso,
        input.tipo_contrato,
        input.salario_base,
        input.banco_nombre?.trim() || null,
        input.banco_cuenta?.trim() || null,
        input.banco_tipo_cuenta || null,
        input.cotiza_tss ?? true,
        input.aplica_isr ?? true,
      ],
    );

    return rows[0];
  });

  revalidatePath("/contabilidad/nomina");
  return res;
}

/**
 * Actualiza el expediente y condiciones de un empleado.
 */
export async function actualizarEmpleado(
  id: string,
  cambios: Partial<CrearEmpleadoInput> & {
    estado?: "activo" | "licencia" | "suspendido" | "desvinculado";
    fecha_salida?: string | null;
  },
): Promise<void> {
  const usuario = await requerirPermiso("contabilidad.nomina");
  const ctx = await contextoDe(usuario);

  await enTransaccionComo(ctx, async (cliente) => {
    await fijarAccion(cliente, "actualizar_empleado");

    const campos: string[] = [];
    const valores: unknown[] = [id];

    if (cambios.cargo) {
      valores.push(cambios.cargo.trim());
      campos.push(`cargo = $${valores.length}`);
    }
    if (cambios.departamento) {
      valores.push(cambios.departamento.trim());
      campos.push(`departamento = $${valores.length}`);
    }
    if (cambios.centro_costo_id) {
      valores.push(cambios.centro_costo_id);
      campos.push(`centro_costo_id = $${valores.length}`);
    }
    if (cambios.salario_base !== undefined) {
      if (cambios.salario_base <= 0) throw new Error("El salario debe ser mayor a cero.");
      valores.push(cambios.salario_base);
      campos.push(`salario_base = $${valores.length}`);
    }
    if (cambios.estado) {
      valores.push(cambios.estado);
      campos.push(`estado = $${valores.length}`);
    }
    if (cambios.fecha_salida !== undefined) {
      valores.push(cambios.fecha_salida ? cambios.fecha_salida : null);
      campos.push(`fecha_salida = $${valores.length}::date`);
    }
    if (cambios.banco_nombre !== undefined) {
      valores.push(cambios.banco_nombre ? cambios.banco_nombre.trim() : null);
      campos.push(`banco_nombre = $${valores.length}`);
    }
    if (cambios.banco_cuenta !== undefined) {
      valores.push(cambios.banco_cuenta ? cambios.banco_cuenta.trim() : null);
      campos.push(`banco_cuenta = $${valores.length}`);
    }
    if (cambios.banco_tipo_cuenta !== undefined) {
      valores.push(cambios.banco_tipo_cuenta || null);
      campos.push(`banco_tipo_cuenta = $${valores.length}`);
    }
    if (cambios.cotiza_tss !== undefined) {
      valores.push(cambios.cotiza_tss);
      campos.push(`cotiza_tss = $${valores.length}`);
    }
    if (cambios.aplica_isr !== undefined) {
      valores.push(cambios.aplica_isr);
      campos.push(`aplica_isr = $${valores.length}`);
    }

    if (campos.length > 0) {
      campos.push(`actualizado_en = now()`);
      await cliente.query(
        `UPDATE contabilidad.empleado
            SET ${campos.join(", ")}
          WHERE id = $1`,
        valores,
      );
    }
  });

  revalidatePath("/contabilidad/nomina");
}

/**
 * Genera una nueva corrida de nómina con cálculo automático de aportes
 * y retenciones para todos los empleados activos según los parámetros
 * vigentes en la fecha de corte.
 */
export async function crearNomina(input: CrearNominaInput): Promise<{ id: string; codigo: string }> {
  const usuario = await requerirPermiso("contabilidad.nomina");
  const ctx = await contextoDe(usuario);

  const res = await enTransaccionComo(ctx, async (cliente) => {
    await fijarAccion(cliente, "crear_nomina");

    const sufijoPeriodo =
      input.periodo_tipo === "mensual"
        ? "M"
        : input.periodo_tipo === "primera_quincena"
        ? "Q1"
        : input.periodo_tipo === "segunda_quincena"
        ? "Q2"
        : "REG";

    const codigo = `NOM-${input.anio}-${String(input.mes).padStart(2, "0")}-${sufijoPeriodo}`;

    // Obtener parámetros vigentes
    const { rows: rowsParametros } = await cliente.query<{ clave: string; valor: any }>(
      `SELECT clave, valor
         FROM contabilidad.parametro
        WHERE vigente_desde <= $1::date
          AND (vigente_hasta IS NULL OR vigente_hasta > $1::date)`,
      [input.fecha_corte],
    );

    const params: Record<string, any> = {};
    for (const p of rowsParametros) {
      params[p.clave] = p.valor;
    }

    const tasaAfpEmpleado = Number(params["tss.afp.empleado.tasa"] ?? 0.0287);
    const tasaSfsEmpleado = Number(params["tss.sfs.empleado.tasa"] ?? 0.0304);
    const topeAfpMensual = Number(params["tss.afp.tope_mensual"] ?? 464460.0);
    const topeSfsMensual = Number(params["tss.sfs.tope_mensual"] ?? 232230.0);
    const topeSrlMensual = Number(params["tss.srl.tope_mensual"] ?? 92892.0);

    const tasaAfpPatronal = Number(params["tss.afp.empleador.tasa"] ?? 0.071);
    const tasaSfsPatronal = Number(params["tss.sfs.empleador.tasa"] ?? 0.0709);
    const tasaSrlPatronal = Number(params["tss.srl.empleador.tasa"] ?? 0.011);
    const tasaInfotepPatronal = Number(params["tss.infotep.empleador.tasa"] ?? 0.01);

    const escalaIsr = params["isr.escala"]?.tramos ?? [
      { desde: 0, hasta: 416220, tasa: 0, cuota_fija: 0 },
      { desde: 416220, hasta: 624329, tasa: 0.15, cuota_fija: 0 },
      { desde: 624329, hasta: 867123, tasa: 0.2, cuota_fija: 31216.35 },
      { desde: 867123, hasta: null, tasa: 0.25, cuota_fija: 79776.15 },
    ];

    // Obtener empleados activos
    const { rows: empleados } = await cliente.query<{
      id: string;
      salario_base: string;
      centro_costo_id: string;
      cotiza_tss: boolean;
      aplica_isr: boolean;
    }>(
      `SELECT id, salario_base::text AS salario_base, centro_costo_id, cotiza_tss, aplica_isr
         FROM contabilidad.empleado
        WHERE estado = 'activo'
        ORDER BY codigo_empleado ASC`,
    );

    if (empleados.length === 0) {
      throw new Error("No hay empleados activos registrados para procesar la nómina.");
    }

    const esQuincenal = input.periodo_tipo.includes("quincena");
    const factorPeriodo = esQuincenal ? 0.5 : 1.0;
    const diasPeriodo = esQuincenal ? 15 : 30;

    // Insertar cabecera en borrador
    const { rows: rowsNomina } = await cliente.query<{ id: string }>(
      `INSERT INTO contabilidad.nomina
         (codigo, anio, mes, periodo_tipo, fecha_corte, fecha_pago, estado, notas, creado_por)
       VALUES ($1, $2, $3, $4, $5::date, $6::date, 'borrador', $7, $8)
       RETURNING id`,
      [
        codigo,
        input.anio,
        input.mes,
        input.periodo_tipo,
        input.fecha_corte,
        input.fecha_pago,
        input.notas?.trim() || null,
        usuario.id,
      ],
    );
    const nominaId = rowsNomina[0].id;

    let totDevengado = 0;
    let totAfpEmp = 0;
    let totSfsEmp = 0;
    let totIsrEmp = 0;
    let totOtrasDed = 0;
    let totNeto = 0;
    let totAfpPat = 0;
    let totSfsPat = 0;
    let totSrlPat = 0;
    let totInfotepPat = 0;

    for (const emp of empleados) {
      const salarioBaseMes = Number(emp.salario_base);
      const salarioPeriodo = Math.round(salarioBaseMes * factorPeriodo * 100) / 100;

      let afpEmp = 0;
      let sfsEmp = 0;
      let afpPat = 0;
      let sfsPat = 0;
      let srlPat = 0;
      let infotepPat = 0;
      let isrEmp = 0;

      if (emp.cotiza_tss) {
        const cotizableAfp = Math.min(salarioPeriodo, topeAfpMensual * factorPeriodo);
        const cotizableSfs = Math.min(salarioPeriodo, topeSfsMensual * factorPeriodo);
        const cotizableSrl = Math.min(salarioPeriodo, topeSrlMensual * factorPeriodo);

        afpEmp = Math.round(cotizableAfp * tasaAfpEmpleado * 100) / 100;
        sfsEmp = Math.round(cotizableSfs * tasaSfsEmpleado * 100) / 100;

        afpPat = Math.round(cotizableAfp * tasaAfpPatronal * 100) / 100;
        sfsPat = Math.round(cotizableSfs * tasaSfsPatronal * 100) / 100;
        srlPat = Math.round(cotizableSrl * tasaSrlPatronal * 100) / 100;
        infotepPat = Math.round(salarioPeriodo * tasaInfotepPatronal * 100) / 100;
      }

      if (emp.aplica_isr) {
        // En República Dominicana, las cotizaciones a la TSS (AFP y SFS) son deducibles de la base del ISR
        const gravableMensual = salarioBaseMes - (afpEmp / factorPeriodo) - (sfsEmp / factorPeriodo);
        const isrMensualTotal = calcularIsrMensual(gravableMensual, escalaIsr);
        isrEmp = Math.round(isrMensualTotal * factorPeriodo * 100) / 100;
      }

      const totalDeducciones = afpEmp + sfsEmp + isrEmp;
      const netoPagar = salarioPeriodo - totalDeducciones;

      await cliente.query(
        `INSERT INTO contabilidad.nomina_linea
           (nomina_id, empleado_id, centro_costo_id, salario_base, dias_trabajados,
            total_devengado, deduccion_afp, deduccion_sfs, deduccion_isr,
            total_deducciones, neto_a_pagar, aporte_afp_patronal, aporte_sfs_patronal,
            aporte_srl_patronal, aporte_infotep_patronal)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          nominaId,
          emp.id,
          emp.centro_costo_id,
          salarioBaseMes,
          diasPeriodo,
          salarioPeriodo,
          afpEmp,
          sfsEmp,
          isrEmp,
          totalDeducciones,
          netoPagar,
          afpPat,
          sfsPat,
          srlPat,
          infotepPat,
        ],
      );

      totDevengado += salarioPeriodo;
      totAfpEmp += afpEmp;
      totSfsEmp += sfsEmp;
      totIsrEmp += isrEmp;
      totNeto += netoPagar;
      totAfpPat += afpPat;
      totSfsPat += sfsPat;
      totSrlPat += srlPat;
      totInfotepPat += infotepPat;
    }

    const totCostoPatronal = totAfpPat + totSfsPat + totSrlPat + totInfotepPat;

    await cliente.query(
      `UPDATE contabilidad.nomina
          SET total_devengado         = $2,
              total_afp_empleado      = $3,
              total_sfs_empleado      = $4,
              total_isr_empleado      = $5,
              total_otras_deducciones = $6,
              total_neto              = $7,
              total_afp_empleador     = $8,
              total_sfs_empleador     = $9,
              total_srl_empleador     = $10,
              total_infotep_empleador = $11,
              total_costo_patronal    = $12
        WHERE id = $1`,
      [
        nominaId,
        totDevengado,
        totAfpEmp,
        totSfsEmp,
        totIsrEmp,
        totOtrasDed,
        totNeto,
        totAfpPat,
        totSfsPat,
        totSrlPat,
        totInfotepPat,
        totCostoPatronal,
      ],
    );

    return { id: nominaId, codigo };
  });

  revalidatePath("/contabilidad/nomina");
  return res;
}

/** Gasto de sueldos por programa del centro de costo (catálogo de la Fundación). */
const CUENTA_SUELDOS_POR_PROGRAMA: Record<string, string> = {
  habitudes: "5.3.3.1",
  comedor: "5.3.3.2", // el comedor es parte del programa de alojamiento
  formacion_360: "5.3.3.3",
  becas: "5.3.3.4",
  administrativo: "5.3.3.5",
  institucional: "5.3.3.5",
};
const CUENTA_SUELDOS_OTROS = "5.3.3.5";
const CUENTA_TSS_POR_PAGAR = "2.3.1";
const CUENTAS_APORTES = { afp: "5.3.4.1", sfs: "5.3.4.2", srl: "5.3.4.3", infotep: "5.3.4.4" } as const;

type CuentasNomina = Map<string, string>;

/**
 * Busca las cuentas que usa la nómina. Faltar alguna es un error claro: el
 * catálogo de la Fundación debe tenerlas (5.3.3.x, 5.3.4.x y 2.3.1).
 */
async function resolverCuentasNomina(cliente: import("pg").PoolClient): Promise<CuentasNomina> {
  const codigos = [
    ...new Set([...Object.values(CUENTA_SUELDOS_POR_PROGRAMA), CUENTA_SUELDOS_OTROS, CUENTA_TSS_POR_PAGAR, ...Object.values(CUENTAS_APORTES)]),
  ];
  const { rows } = await cliente.query<{ codigo: string; id: string }>(
    `SELECT codigo, id FROM contabilidad.cuenta_contable
      WHERE codigo = ANY($1::text[]) AND admite_movimiento AND activa`,
    [codigos],
  );
  const mapa: CuentasNomina = new Map(rows.map((r) => [r.codigo, r.id]));
  const faltan = codigos.filter((c) => !mapa.has(c));
  if (faltan.length) {
    throw new Error(`Faltan cuentas de nómina en el catálogo (con movimiento): ${faltan.join(", ")}.`);
  }
  return mapa;
}

/**
 * Líneas del asiento de una nómina. El ISR retenido no tiene cuenta en el
 * catálogo vigente (ni «ISR por pagar» ni «Sueldos por pagar»): si hay ISR
 * se rechaza el pago en vez de repartirlo en otra cuenta sin avisar.
 */
async function lineasAsientoNomina(
  cliente: import("pg").PoolClient,
  nominaId: string,
  codigoNomina: string,
  cuentas: CuentasNomina,
  cuentaBancoId: string,
) {
  const { rows: tot } = await cliente.query<{
    afp_emp: string; sfs_emp: string; isr: string; neto: string;
    afp_pat: string; sfs_pat: string; srl_pat: string; infotep_pat: string;
  }>(
    `SELECT total_afp_empleado::text AS afp_emp, total_sfs_empleado::text AS sfs_emp,
            total_isr_empleado::text AS isr, total_neto::text AS neto,
            total_afp_empleador::text AS afp_pat, total_sfs_empleador::text AS sfs_pat,
            total_srl_empleador::text AS srl_pat, total_infotep_empleador::text AS infotep_pat
       FROM contabilidad.nomina WHERE id = $1`,
    [nominaId],
  );
  const t = tot[0];
  if (Number(t.isr) > 0) {
    throw new Error(
      "La nómina tiene ISR retenido y el catálogo vigente no tiene una cuenta de ISR por pagar. Agrégala al catálogo antes de pagar.",
    );
  }

  const { rows: porPrograma } = await cliente.query<{ programa: string; devengado: string }>(
    `SELECT cc.programa, sum(nl.total_devengado)::text AS devengado
       FROM contabilidad.nomina_linea nl
       JOIN contabilidad.centro_costo cc ON cc.id = nl.centro_costo_id
      WHERE nl.nomina_id = $1
      GROUP BY cc.programa`,
    [nominaId],
  );

  // Se agrupa por cuenta: dos programas pueden caer en 5.3.3.5.
  const sueldos = new Map<string, number>();
  for (const f of porPrograma) {
    const codigo = CUENTA_SUELDOS_POR_PROGRAMA[f.programa] ?? CUENTA_SUELDOS_OTROS;
    sueldos.set(codigo, (sueldos.get(codigo) ?? 0) + Number(f.devengado));
  }

  const aportes: [string, number][] = [
    [CUENTAS_APORTES.afp, Number(t.afp_pat)],
    [CUENTAS_APORTES.sfs, Number(t.sfs_pat)],
    [CUENTAS_APORTES.srl, Number(t.srl_pat)],
    [CUENTAS_APORTES.infotep, Number(t.infotep_pat)],
  ];
  const totalAportes = aportes.reduce((a, [, m]) => a + m, 0);
  const tssEmpleado = Number(t.afp_emp) + Number(t.sfs_emp);

  // `crear_asiento` descarta las líneas en cero.
  return [
    ...[...sueldos].map(([codigo, monto]) => ({
      cuenta_id: cuentas.get(codigo), debe: monto, haber: 0, descripcion: `Sueldos nómina ${codigoNomina}`,
    })),
    ...aportes.map(([codigo, monto]) => ({
      cuenta_id: cuentas.get(codigo), debe: monto, haber: 0, descripcion: `Aporte patronal nómina ${codigoNomina}`,
    })),
    {
      cuenta_id: cuentas.get(CUENTA_TSS_POR_PAGAR), debe: 0,
      haber: Number((tssEmpleado + totalAportes).toFixed(2)),
      descripcion: `TSS por pagar (empleado y empleador) nómina ${codigoNomina}`,
    },
    { cuenta_id: cuentaBancoId, debe: 0, haber: Number(t.neto), descripcion: `Desembolso de sueldos netos nómina ${codigoNomina}` },
  ];
}

/**
 * Aprueba una corrida de nómina. El asiento contable nace al pagarla (ver
 * `pagarNomina`): el catálogo vigente no tiene pasivo de sueldos.
 */
export async function aprobarNomina(nominaId: string): Promise<{ asientoId: null }> {
  const usuario = await requerirPermiso("contabilidad.aprobar");
  const ctx = await contextoDe(usuario);

  const res = await enTransaccionComo(ctx, async (cliente) => {
    await fijarAccion(cliente, "aprobar_nomina");

    const { rows: nomRows } = await cliente.query<{
      id: string;
      codigo: string;
      estado: string;
      anio: number;
      mes: number;
      fecha_corte: string;
      total_devengado: string;
      total_afp_empleado: string;
      total_sfs_empleado: string;
      total_isr_empleado: string;
      total_neto: string;
      total_costo_patronal: string;
      total_afp_empleador: string;
      total_sfs_empleador: string;
      total_srl_empleador: string;
      total_infotep_empleador: string;
    }>(
      `SELECT id, codigo, estado, anio, mes,
              to_char(fecha_corte, 'YYYY-MM-DD') AS fecha_corte,
              total_devengado::text AS total_devengado,
              total_afp_empleado::text AS total_afp_empleado,
              total_sfs_empleado::text AS total_sfs_empleado,
              total_isr_empleado::text AS total_isr_empleado,
              total_neto::text AS total_neto,
              total_costo_patronal::text AS total_costo_patronal,
              total_afp_empleador::text AS total_afp_empleador,
              total_sfs_empleador::text AS total_sfs_empleador,
              total_srl_empleador::text AS total_srl_empleador,
              total_infotep_empleador::text AS total_infotep_empleador
         FROM contabilidad.nomina
        WHERE id = $1
          FOR UPDATE`,
      [nominaId],
    );

    const nom = nomRows[0];
    if (!nom) throw new Error("Nómina no encontrada.");
    if (nom.estado !== "borrador") {
      throw new Error(`La nómina está en estado '${nom.estado}' y no puede ser aprobada.`);
    }

    // El catálogo de la Fundación no tiene «Sueldos por pagar»: no se puede
    // devengar la nómina (gasto contra pasivo). El asiento se hace al pagar,
    // gasto contra banco y TSS por pagar. Aprobar solo exige que las cuentas
    // existan, para fallar aquí y no después de que alguien preparó el pago.
    await resolverCuentasNomina(cliente);

    // Actualizar estado de la nómina (sin asiento: nace al pagarse)
    await cliente.query(
      `UPDATE contabilidad.nomina
          SET estado = 'aprobada',
              aprobado_por = $2,
              aprobado_en = now()
        WHERE id = $1`,
      [nominaId, usuario.id],
    );

    return { asientoId: null };
  });

  revalidatePath("/contabilidad/nomina");
  return res;
}

/**
 * Paga una nómina aprobada: un solo asiento con los sueldos por programa
 * (5.3.3.x), los aportes patronales (5.3.4.x), las retenciones y aportes de
 * TSS por pagar (2.3.1) y el desembolso del neto por el banco. Pasa la
 * nómina a 'pagada'.
 */
export async function pagarNomina(
  nominaId: string,
  cuentaBancoId: string,
): Promise<{ asientoPagoId: string }> {
  const usuario = await requerirPermiso("contabilidad.aprobar");
  const ctx = await contextoDe(usuario);

  const res = await enTransaccionComo(ctx, async (cliente) => {
    await fijarAccion(cliente, "pagar_nomina");

    const { rows: nomRows } = await cliente.query<{
      id: string;
      codigo: string;
      estado: string;
      anio: number;
      mes: number;
      fecha_pago: string;
    }>(
      `SELECT id, codigo, estado, anio, mes,
              to_char(fecha_pago, 'YYYY-MM-DD') AS fecha_pago
         FROM contabilidad.nomina
        WHERE id = $1
          FOR UPDATE`,
      [nominaId],
    );

    const nom = nomRows[0];
    if (!nom) throw new Error("Nómina no encontrada.");
    if (nom.estado !== "aprobada") {
      throw new Error(`La nómina debe estar aprobada para poder pagarse (actual: '${nom.estado}').`);
    }

    const cuentas = await resolverCuentasNomina(cliente);
    const lineas = await lineasAsientoNomina(cliente, nominaId, nom.codigo, cuentas, cuentaBancoId);

    const { rows: asRows } = await cliente.query<{ id: string }>(
      `SELECT contabilidad.crear_asiento($1::date, $2, 'ajuste', 'contabilidad.nomina', $3, $4::jsonb) AS id`,
      [nom.fecha_pago, `Nómina ${nom.codigo}: gastos, TSS por pagar y desembolso`, nominaId, JSON.stringify(lineas)],
    );
    const asientoPagoId = asRows[0].id;

    await cliente.query(
      `UPDATE contabilidad.nomina
          SET estado = 'pagada',
              asiento_id = $2,
              actualizado_en = now()
        WHERE id = $1`,
      [nominaId, asientoPagoId],
    );

    return { asientoPagoId };
  });

  revalidatePath("/contabilidad/nomina");
  return res;
}

/**
 * Anula una corrida de nómina que esté en borrador.
 */
export async function anularNomina(nominaId: string, motivo: string): Promise<void> {
  const usuario = await requerirPermiso("contabilidad.aprobar");
  const ctx = await contextoDe(usuario);

  await enTransaccionComo(ctx, async (cliente) => {
    await fijarAccion(cliente, "anular_nomina");

    const { rows } = await cliente.query<{ estado: string }>(
      `SELECT estado FROM contabilidad.nomina WHERE id = $1 FOR UPDATE`,
      [nominaId],
    );

    if (!rows[0]) throw new Error("Nómina no encontrada.");
    if (rows[0].estado !== "borrador") {
      throw new Error(`Solo se pueden anular nóminas en estado 'borrador' (actual: '${rows[0].estado}').`);
    }

    await cliente.query(
      `UPDATE contabilidad.nomina
          SET estado = 'anulada',
              notas = COALESCE(notas || ' | ', '') || 'Anulada: ' || $2,
              actualizado_en = now()
        WHERE id = $1`,
      [nominaId, motivo.trim()],
    );
  });

  revalidatePath("/contabilidad/nomina");
}

export async function obtenerDetalleNominaAccion(nominaId: string) {
  const { obtenerNomina } = await import("./consultas");
  return obtenerNomina(nominaId);
}

export async function generarTxtTssAccion(nominaId: string) {
  const { generarTxtTssSuirPlus } = await import("./consultas");
  return generarTxtTssSuirPlus(nominaId);
}
