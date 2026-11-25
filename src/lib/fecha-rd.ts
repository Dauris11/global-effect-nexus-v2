/**
 * "Hoy" en hora dominicana, como fragmento SQL constante (no lleva valores).
 * La BD corre en UTC: con `(now() AT TIME ZONE 'America/Santo_Domingo')::date` el turno de las 8 PM (00:00 UTC)
 * caería en el día siguiente y se perdería su lista de pasajeros; con los
 * cuatrimestres pasaría igual, un día antes o un día después.
 */
export const SQL_HOY_RD = "(now() AT TIME ZONE 'America/Santo_Domingo')::date";

/**
 * La hora de ahora en La Vega (`time`, sin zona). `CURRENT_TIME` es `timetz`
 * en la zona de la sesión, que es UTC: comparado con "06:00" abría el comedor
 * a las dos de la madrugada.
 */
export const SQL_HORA_RD = "(now() AT TIME ZONE 'America/Santo_Domingo')::time";

/**
 * La fecha de hoy en La Vega (`YYYY-MM-DD`), calculada en JavaScript. República
 * Dominicana no tiene horario de verano: UTC−4 todo el año. Es la gemela de
 * `SQL_HOY_RD` para cuando el cálculo se hace fuera de la base.
 */
export function hoyRD(ahora: number = Date.now()): string {
  return new Date(ahora - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
