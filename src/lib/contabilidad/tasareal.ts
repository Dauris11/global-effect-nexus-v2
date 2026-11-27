/**
 * Integración con la API de TasaReal (https://tasareal.com/docs).
 *
 * Lista oficial de códigos de institución (desde `instituciones.txt`) y reglas
 * de ventana diaria (a partir de las 8:00 AM hora de República Dominicana,
 * una sola vez por día).
 */

/**
 * Mientras estén activas las pruebas se permite pulsar «Actualizar tasas»
 * cuantas veces sea necesario. Al pasar esto a `false` se activa la restricción
 * de horario (>= 8:00 AM RD) y máximo una ejecución por día.
 */
export const MODO_PRUEBAS_TASAREAL = true;

/** Hora mínima (formato 24h en America/Santo_Domingo) para habilitar el botón diario. */
export const HORA_ACTIVACION_TASAS_RD = 8;

/** Código oficial del Banco Central en TasaReal (siempre se actualiza al consultar). */
export const CODIGO_BCRD_TASAREAL = "bcrd" as const;

export const URL_BASE_TASAREAL = "https://tasareal.com/api/v1";

export type InstitucionTasareal = {
  readonly codigo: string;
  readonly nombre: string;
};

/** Códigos exactos de `instituciones.txt`. */
export const INSTITUCIONES_TASAREAL: readonly InstitucionTasareal[] = [
  { codigo: "dgii", nombre: "DGII" },
  { codigo: "bcrd", nombre: "BCRD (Banco Central)" },
  { codigo: "reservas", nombre: "Banreservas" },
  { codigo: "santa_cruz", nombre: "Banco Santa Cruz" },
  { codigo: "scotiabank", nombre: "Scotiabank" },
  { codigo: "bhd", nombre: "Banco BHD" },
  { codigo: "caribe_bank", nombre: "Banco Caribe" },
  { codigo: "promerica", nombre: "Banco Promerica" },
  { codigo: "banesco", nombre: "Banesco" },
  { codigo: "alnap", nombre: "ALNAP" },
  { codigo: "cibao", nombre: "Asociación Cibao" },
  { codigo: "lafise", nombre: "Banco LAFISE" },
  { codigo: "bonanza", nombre: "Bonanza Banco" },
  { codigo: "motor_credito", nombre: "Motor Crédito" },
  { codigo: "quezada", nombre: "Agente de Cambio Quezada" },
  { codigo: "vimenca", nombre: "Banco Vimenca" },
  { codigo: "taveras", nombre: "Agente de Cambio Taveras" },
  { codigo: "cambio_extranjero", nombre: "Cambio Extranjero" },
  { codigo: "caribe", nombre: "Caribe Express" },
  { codigo: "moneycorps", nombre: "MoneyCorps" },
  { codigo: "gamelin", nombre: "Gamelin" },
  { codigo: "la_nacional", nombre: "Asociación La Nacional" },
  { codigo: "panora", nombre: "Panora" },
  { codigo: "rm", nombre: "RM" },
  { codigo: "sct", nombre: "SCT" },
] as const;

const CODIGOS_VALIDOS = new Set(INSTITUCIONES_TASAREAL.map((i) => i.codigo));

export function esCodigoInstitucionTasareal(valor: string): boolean {
  return CODIGOS_VALIDOS.has(valor);
}

export function etiquetaInstitucionTasareal(codigo: string | null | undefined): string | null {
  if (!codigo) return null;
  const encontrada = INSTITUCIONES_TASAREAL.find((i) => i.codigo === codigo);
  return encontrada ? `${encontrada.codigo} · ${encontrada.nombre}` : codigo;
}

export type EstadoHorarioTasas = {
  permitido: boolean;
  motivo: "ok" | "antes_de_hora" | "ya_actualizado_hoy";
};

/**
 * Evalúa si el botón «Actualizar tasas» puede ejecutarse en este momento.
 * En modo pruebas (`MODO_PRUEBAS_TASAREAL = true`) siempre devuelve `permitido: true`.
 */
export function estadoHorarioTasasRD(
  yaActualizadoHoy: boolean,
  ahora: Date = new Date(),
): EstadoHorarioTasas {
  if (MODO_PRUEBAS_TASAREAL) {
    return { permitido: true, motivo: "ok" };
  }

  const horaRd = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Santo_Domingo",
      hour: "numeric",
      hour12: false,
    }).format(ahora),
  );

  if (horaRd < HORA_ACTIVACION_TASAS_RD) {
    return { permitido: false, motivo: "antes_de_hora" };
  }
  if (yaActualizadoHoy) {
    return { permitido: false, motivo: "ya_actualizado_hoy" };
  }
  return { permitido: true, motivo: "ok" };
}
