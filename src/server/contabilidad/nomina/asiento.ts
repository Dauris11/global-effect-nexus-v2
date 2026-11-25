import type { PoolClient } from "pg";

import type { Partida } from "@/server/contabilidad/codigos-transaccion/asiento";

/**
 * De dónde salen los montos del asiento de una nómina. Vive aparte de
 * `acciones.ts` ("use server" solo admite funciones async exportadas) y lo
 * comparten el pago real y la vista previa, para que ambos armen lo mismo.
 */

/** Centro de costo (programa) → código del gasto de sueldos. Lo no listado cae en ADMINISTRATIVO. */
const CODIGO_SUELDO_POR_PROGRAMA: Record<string, string> = {
  habitudes: "NOM_SUELDO_HABITUDES",
  comedor: "NOM_SUELDO_ALOJAMIENTO", // el comedor es parte del programa de alojamiento
  formacion_360: "NOM_SUELDO_FORMACION_360",
  becas: "NOM_SUELDO_BECAS",
  administrativo: "NOM_SUELDO_ADMINISTRATIVO",
  institucional: "NOM_SUELDO_ADMINISTRATIVO",
};
const CODIGO_SUELDO_OTROS = "NOM_SUELDO_ADMINISTRATIVO";

export type NominaParaAsiento = {
  partidas: Partida[];
  /** Neto a desembolsar: va por el banco, que no es un código sino una elección al pagar. */
  neto: number;
};

export async function partidasDeNomina(
  cliente: PoolClient,
  nominaId: string,
  codigoNomina: string,
): Promise<NominaParaAsiento> {
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
  if (!t) throw new Error("Nómina no encontrada.");

  const { rows: porPrograma } = await cliente.query<{ programa: string; devengado: string }>(
    `SELECT cc.programa, sum(nl.total_devengado)::text AS devengado
       FROM contabilidad.nomina_linea nl
       JOIN contabilidad.centro_costo cc ON cc.id = nl.centro_costo_id
      WHERE nl.nomina_id = $1
      GROUP BY cc.programa`,
    [nominaId],
  );

  const sueldo = `Sueldos nómina ${codigoNomina}`;
  const aporte = `Aporte patronal nómina ${codigoNomina}`;
  const tss = `TSS por pagar (empleado y empleador) nómina ${codigoNomina}`;
  const n = Number;

  // El orden es el del asiento: sueldos, aportes, por pagar, ISR. El motor
  // fusiona lo que caiga en la misma cuenta y lado.
  const partidas: Partida[] = [
    ...porPrograma.map((f) => ({
      codigo: CODIGO_SUELDO_POR_PROGRAMA[f.programa] ?? CODIGO_SUELDO_OTROS,
      monto: n(f.devengado),
      descripcion: sueldo,
    })),
    { codigo: "NOM_AFP_EMPLEADOR_GASTO", monto: n(t.afp_pat), descripcion: aporte },
    { codigo: "NOM_SFS_EMPLEADOR_GASTO", monto: n(t.sfs_pat), descripcion: aporte },
    { codigo: "NOM_SRL_EMPLEADOR_GASTO", monto: n(t.srl_pat), descripcion: aporte },
    { codigo: "NOM_INFOTEP_EMPLEADOR_GASTO", monto: n(t.infotep_pat), descripcion: aporte },
    { codigo: "NOM_AFP_EMPLEADO_X_PAGAR", monto: n(t.afp_emp), descripcion: tss },
    { codigo: "NOM_SFS_EMPLEADO_X_PAGAR", monto: n(t.sfs_emp), descripcion: tss },
    { codigo: "NOM_AFP_EMPLEADOR_X_PAGAR", monto: n(t.afp_pat), descripcion: tss },
    { codigo: "NOM_SFS_EMPLEADOR_X_PAGAR", monto: n(t.sfs_pat), descripcion: tss },
    { codigo: "NOM_SRL_EMPLEADOR_X_PAGAR", monto: n(t.srl_pat), descripcion: tss },
    { codigo: "NOM_INFOTEP_EMPLEADOR_X_PAGAR", monto: n(t.infotep_pat), descripcion: tss },
    // Con ISR retenido y sin cuenta asignada el motor se detiene con su mensaje claro.
    { codigo: "NOM_ISR_X_PAGAR", monto: n(t.isr), descripcion: `ISR retenido por pagar nómina ${codigoNomina}` },
  ];
  return { partidas, neto: n(t.neto) };
}

export function descripcionDesembolso(codigoNomina: string): string {
  return `Desembolso de sueldos netos nómina ${codigoNomina}`;
}
