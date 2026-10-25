/**
 * Calculadora de Prestaciones Laborales de la República Dominicana
 * conforme al Código de Trabajo (Ley 16-92).
 *
 * Función matemática pura, ejecutable tanto en el servidor como en el cliente.
 *
 * Artículos aplicables:
 * - Preaviso (Art. 76):
 *   - 3 a 6 meses: 7 días
 *   - 6 meses a 1 año: 14 días
 *   - Más de 1 año: 28 días
 * - Auxilio de Cesantía (Art. 80):
 *   - 3 a 6 meses: 6 días
 *   - 6 meses a 1 año: 13 días
 *   - 1 a 5 años: 21 días por año o fracción superior a 6 meses
 *   - Más de 5 años: 23 días por año o fracción superior a 6 meses
 * - Vacaciones no disfrutadas (Art. 177):
 *   - 1 a 5 años: 14 días
 *   - Más de 5 años: 18 días
 * - Regalía pascual (Salario de Navidad / Art. 219): duodécima parte de salarios ordinarios del año.
 * - Factor diario para mensual: salario / 23.83 (Art. 24 del Reglamento 258-93).
 */

export type CalculoPrestacionesInput = {
  salarioMensual: number;
  fechaIngreso: string;
  fechaSalida: string;
  incluyePreaviso: boolean;
  incluyeCesantia: boolean;
  diasVacacionesPendientes?: number;
  mesesTrabajadosEnAnio?: number;
};

export type CalculoPrestacionesOutput = {
  antiguedadAnios: number;
  antiguedadMeses: number;
  antiguedadDias: number;
  salarioDiario: number;
  diasPreaviso: number;
  montoPreaviso: number;
  diasCesantia: number;
  montoCesantia: number;
  diasVacaciones: number;
  montoVacaciones: number;
  montoRegaliaPascual: number;
  totalLiquidacion: number;
};

export function calcularPrestacionesLaborales(
  input: CalculoPrestacionesInput,
): CalculoPrestacionesOutput {
  const ingreso = new Date(input.fechaIngreso);
  const salida = new Date(input.fechaSalida);
  const factorDiario = 23.83;
  const salarioDiario = Math.round((input.salarioMensual / factorDiario) * 100) / 100;

  let anios = salida.getFullYear() - ingreso.getFullYear();
  let meses = salida.getMonth() - ingreso.getMonth();
  let dias = salida.getDate() - ingreso.getDate();

  if (dias < 0) {
    meses -= 1;
    dias += 30;
  }
  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }

  const mesesTotales = anios * 12 + meses + dias / 30;

  // 1. Preaviso
  let diasPreaviso = 0;
  if (input.incluyePreaviso) {
    if (mesesTotales >= 3 && mesesTotales < 6) {
      diasPreaviso = 7;
    } else if (mesesTotales >= 6 && mesesTotales < 12) {
      diasPreaviso = 14;
    } else if (mesesTotales >= 12) {
      diasPreaviso = 28;
    }
  }
  const montoPreaviso = Math.round(diasPreaviso * salarioDiario * 100) / 100;

  // 2. Cesantía
  let diasCesantia = 0;
  if (input.incluyeCesantia) {
    if (mesesTotales >= 3 && mesesTotales < 6) {
      diasCesantia = 6;
    } else if (mesesTotales >= 6 && mesesTotales < 12) {
      diasCesantia = 13;
    } else if (anios >= 1 && anios < 5) {
      diasCesantia = anios * 21;
      if (meses >= 6) diasCesantia += 21;
    } else if (anios >= 5) {
      diasCesantia = anios * 23;
      if (meses >= 6) diasCesantia += 23;
    }
  }
  const montoCesantia = Math.round(diasCesantia * salarioDiario * 100) / 100;

  // 3. Vacaciones
  const diasVacaciones = input.diasVacacionesPendientes ?? (anios >= 5 ? 18 : 14);
  const montoVacaciones = Math.round(diasVacaciones * salarioDiario * 100) / 100;

  // 4. Regalía Pascual (Salario de Navidad)
  const mesesRegalia = input.mesesTrabajadosEnAnio ?? (salida.getMonth() + 1);
  const montoRegaliaPascual = Math.round(((input.salarioMensual * mesesRegalia) / 12) * 100) / 100;

  const totalLiquidacion =
    montoPreaviso + montoCesantia + montoVacaciones + montoRegaliaPascual;

  return {
    antiguedadAnios: anios,
    antiguedadMeses: meses,
    antiguedadDias: dias,
    salarioDiario,
    diasPreaviso,
    montoPreaviso,
    diasCesantia,
    montoCesantia,
    diasVacaciones,
    montoVacaciones,
    montoRegaliaPascual,
    totalLiquidacion: Math.round(totalLiquidacion * 100) / 100,
  };
}
