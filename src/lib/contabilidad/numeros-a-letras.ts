/**
 * Monto en letras para recibos, comprobantes y cheques.
 *
 * Por qué no hay librería: las que existen en npm convierten desde `number`,
 * hablan español de España ("UN MIL", sin "DE" tras millones) o no conocen el
 * formato de cheque dominicano ("CON 50/100"). Este texto va impreso en un
 * documento contable, así que preferimos reglas cortas, revisables y probadas
 * (`scripts/probar-numeros-a-letras.mjs`) a una dependencia que no controlamos.
 *
 * Por qué no hay float: el monto llega como texto desde `NUMERIC(14,2)`.
 * Pasarlo por `number` puede convertir 0.29 en 0.28999… y escribir mal los
 * centavos en un documento firmado. Entero y centavos se separan en la cadena
 * y la parte entera se trabaja con `BigInt`.
 *
 * Archivo puro y sin imports a propósito: lo usan el PDF del servidor y las
 * pruebas con `node --test` sin pasar por el empaquetador.
 */

type Moneda = "DOP" | "USD";
type Idioma = "es" | "en";

const MAXIMO = 999_999_999_999n;
const MIL = 1_000n;
const MILLON = 1_000_000n;
const MIL_MILLONES = 1_000_000_000n;

/* ---------------------------------- Español --------------------------------- */

const UNIDADES_ES = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];

// Del 10 al 29 se escriben en una sola palabra, con sus tildes.
const DIEZ_A_VEINTINUEVE_ES = [
  "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE",
  "DIECIOCHO", "DIECINUEVE", "VEINTE", "VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS",
  "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE",
];

const DECENAS_ES = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];

const CENTENAS_ES = [
  "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS",
  "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS",
];

/**
 * 0–999. `apocopar` convierte "UNO" en "UN" y "VEINTIUNO" en "VEINTIÚN",
 * que es como se dice delante de un sustantivo ("VEINTIÚN PESOS", "UN MIL…").
 */
function centenasEs(n: number, apocopar: boolean): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";

  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (centena > 0) partes.push(CENTENAS_ES[centena]);

  if (resto >= 10 && resto <= 29) {
    if (resto === 21 && apocopar) partes.push("VEINTIÚN");
    else partes.push(DIEZ_A_VEINTINUEVE_ES[resto - 10]);
  } else if (resto > 0) {
    const decena = Math.floor(resto / 10);
    const unidad = resto % 10;
    const textoUnidad = unidad === 1 && apocopar ? "UN" : UNIDADES_ES[unidad];
    if (decena === 0) partes.push(textoUnidad);
    else partes.push(unidad === 0 ? DECENAS_ES[decena] : `${DECENAS_ES[decena]} Y ${textoUnidad}`);
  }
  return partes.join(" ");
}

/** 0–999 999. En RD se escribe "MIL", nunca "UN MIL". */
function milesEs(n: bigint, apocopar: boolean): string {
  const miles = Number(n / MIL);
  const resto = Number(n % MIL);
  const partes: string[] = [];
  if (miles === 1) partes.push("MIL");
  // Ante "MIL" siempre se apocopa: "VEINTIÚN MIL", "CIENTO UN MIL".
  else if (miles > 1) partes.push(`${centenasEs(miles, true)} MIL`);
  if (resto > 0) partes.push(centenasEs(resto, apocopar));
  return partes.join(" ");
}

function enteroEnLetrasEs(n: bigint): { texto: string; terminaEnMillones: boolean } {
  if (n === 0n) return { texto: "CERO", terminaEnMillones: false };

  const millones = n / MILLON;
  const resto = n % MILLON;
  const partes: string[] = [];
  if (millones === 1n) partes.push("UN MILLÓN");
  else if (millones > 1n) partes.push(`${milesEs(millones, true)} MILLONES`);
  // El número precede siempre al nombre de la moneda, por eso se apocopa.
  if (resto > 0n) partes.push(milesEs(resto, true));

  return { texto: partes.join(" "), terminaEnMillones: millones > 0n && resto === 0n };
}

/* ---------------------------------- Inglés ---------------------------------- */

const UNIDADES_EN = [
  "", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN",
  "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN",
];

const DECENAS_EN = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];

function centenasEn(n: number): string {
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (centena > 0) partes.push(`${UNIDADES_EN[centena]} HUNDRED`);
  if (resto > 0 && resto < 20) partes.push(UNIDADES_EN[resto]);
  else if (resto >= 20) {
    const unidad = resto % 10;
    partes.push(unidad === 0 ? DECENAS_EN[Math.floor(resto / 10)] : `${DECENAS_EN[Math.floor(resto / 10)]}-${UNIDADES_EN[unidad]}`);
  }
  return partes.join(" ");
}

function enteroEnLetrasEn(n: bigint): string {
  if (n === 0n) return "ZERO";
  const escalas: [bigint, string][] = [
    [MIL_MILLONES, "BILLION"],
    [MILLON, "MILLION"],
    [MIL, "THOUSAND"],
  ];
  const partes: string[] = [];
  let resto = n;
  for (const [valor, nombre] of escalas) {
    const grupo = Number(resto / valor);
    if (grupo > 0) partes.push(`${centenasEn(grupo)} ${nombre}`);
    resto %= valor;
  }
  if (resto > 0n) partes.push(centenasEn(Number(resto)));
  return partes.join(" ");
}

/* ------------------------------- Entrada pública ---------------------------- */

/** Separa entero y centavos sin pasar por `number`. */
function descomponer(monto: string): { entero: bigint; centavos: string } {
  const limpio = monto.trim();
  if (limpio.startsWith("-")) throw new Error(`Monto negativo no admitido: "${monto}"`);
  const partes = /^(\d+)(?:\.(\d*))?$/.exec(limpio);
  if (!partes) throw new Error(`Monto no numérico: "${monto}"`);

  const decimales = partes[2] ?? "";
  // NUMERIC(14,2) nunca trae más de dos; si llegan ceros de relleno se aceptan,
  // pero un tercer decimal real obligaría a redondear y eso no se hace aquí.
  if (decimales.length > 2 && /[^0]/.test(decimales.slice(2))) {
    throw new Error(`Monto con más de dos decimales: "${monto}"`);
  }
  const entero = BigInt(partes[1]);
  if (entero > MAXIMO) throw new Error(`Monto fuera de rango: "${monto}"`);
  return { entero, centavos: decimales.slice(0, 2).padEnd(2, "0") };
}

export function montoEnLetras(monto: string, moneda: Moneda, idioma: Idioma): string {
  const { entero, centavos } = descomponer(monto);
  const singular = entero === 1n;

  if (idioma === "es") {
    const nombres: Record<Moneda, [string, string]> = {
      DOP: ["PESO DOMINICANO", "PESOS DOMINICANOS"],
      USD: ["DÓLAR ESTADOUNIDENSE", "DÓLARES ESTADOUNIDENSES"],
    };
    const { texto, terminaEnMillones } = enteroEnLetrasEs(entero);
    const numero = singular ? "UN" : texto;
    // "UN MILLÓN DE PESOS": el "DE" solo aparece cuando el número acaba en millón(es).
    const enlace = terminaEnMillones ? " DE" : "";
    return `${numero}${enlace} ${nombres[moneda][singular ? 0 : 1]} CON ${centavos}/100`;
  }

  const nombresEn: Record<Moneda, [string, string]> = {
    DOP: ["DOMINICAN PESO", "DOMINICAN PESOS"],
    USD: ["US DOLLAR", "US DOLLARS"],
  };
  return `${enteroEnLetrasEn(entero)} ${nombresEn[moneda][singular ? 0 : 1]} AND ${centavos}/100`;
}
