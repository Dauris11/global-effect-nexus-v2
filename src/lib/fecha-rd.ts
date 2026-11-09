/**
 * "Hoy" en hora dominicana, como fragmento SQL constante (no lleva valores).
 * La BD corre en UTC: con `CURRENT_DATE` el turno de las 8 PM (00:00 UTC)
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
