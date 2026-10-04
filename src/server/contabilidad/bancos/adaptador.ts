/**
 * Contrato común de los adaptadores de banco (spec §1.8) y las piezas que
 * todos comparten: el lector de CSV y la normalización de montos y fechas.
 *
 * Lo propio de cada banco (columnas del estado de cuenta, formato del archivo
 * de pago de nómina) vive en `bancos/<banco>.ts`. Así agregar un banco es
 * agregar un archivo, no tocar la conciliación ni la nómina.
 *
 * Este archivo no importa nada (ni next ni pg) para que las pruebas de
 * `scripts/probar-adaptadores.mjs` lo carguen con `node --test` tal cual.
 *
 * Excel (.xlsx) queda fuera a propósito: leerlo exige una dependencia pesada
 * que ha tenido fallos de seguridad al abrir archivos ajenos, y todos los
 * portales bancarios permiten exportar a CSV. La pantalla de importación le
 * pide al contable que guarde el estado de cuenta como CSV.
 */

export type MovimientoEstado = {
  fecha: string /* YYYY-MM-DD */;
  descripcion: string;
  referencia: string | null;
  monto: string /* decimal con signo: + crédito/depósito, - débito */;
  saldo: string | null;
};

/**
 * Dónde está cada dato en el CSV del banco. Cada columna se indica por el
 * nombre de su encabezado (sin distinguir mayúsculas ni espacios de los
 * extremos) o, si el archivo no trae encabezado, por su posición contando
 * desde 0 ("0", "1", …).
 */
export type ColumnasEstado = {
  fecha: string;
  descripcion: string;
  referencia?: string;
  debito?: string;
  credito?: string;
  monto?: string;
  saldo?: string;
  formatoFecha: "DD/MM/YYYY" | "YYYY-MM-DD" | "MM/DD/YYYY";
  separadorDecimal: "." | ",";
  /** Filas antes de los datos; la última se toma como encabezado. Por defecto 1. */
  filasEncabezado?: number;
};

export type LineaPagoNomina = {
  cedula: string;
  nombre: string;
  cuenta: string;
  monto: string;
  referencia: string;
};

export interface AdaptadorBanco {
  clave: string;
  nombre: string;
  formatosSoportados: readonly "csv"[];
  parsearEstadoCuenta(contenido: string, columnas: ColumnasEstado): MovimientoEstado[];
  generarArchivoNomina(lineas: LineaPagoNomina[]): {
    nombreArchivo: string;
    contenido: string;
    /** false mientras el banco no entregue su layout oficial. */
    oficial: boolean;
  };
}

/* --------------------------------- CSV ------------------------------------ */

export type FilaCsv = { linea: number; campos: string[] };

/**
 * Elige "," o ";" mirando la primera línea de datos y no el encabezado: hay
 * bancos que exportan el encabezado sin separadores raros pero los montos con
 * coma decimal, y entonces separan con ";". Se cuentan solo los separadores
 * fuera de comillas.
 */
export function detectarSeparador(contenido: string, filasEncabezado: number): "," | ";" {
  const lineas = contenido.split(/\r\n|\n|\r/).filter((l) => l.trim() !== "");
  const muestra = lineas[filasEncabezado] ?? lineas[0] ?? "";
  let comas = 0;
  let puntosYComa = 0;
  let enComillas = false;
  for (const caracter of muestra) {
    if (caracter === '"') enComillas = !enComillas;
    else if (!enComillas && caracter === ",") comas++;
    else if (!enComillas && caracter === ";") puntosYComa++;
  }
  return puntosYComa > comas ? ";" : ",";
}

/**
 * Lector RFC 4180: comillas, separador y saltos de línea dentro de comillas,
 * `""` como comilla escapada, CRLF/LF/CR y BOM UTF-8. Guarda la línea física
 * donde empieza cada fila para que los errores le digan al contable dónde mirar.
 */
export function leerCsv(contenido: string, separador: "," | ";"): FilaCsv[] {
  const texto = contenido.charCodeAt(0) === 0xfeff ? contenido.slice(1) : contenido;
  const filas: FilaCsv[] = [];
  let campos: string[] = [];
  let campo = "";
  let enComillas = false;
  let linea = 1;
  let lineaInicio = 1;

  const cerrarFila = () => {
    campos.push(campo);
    filas.push({ linea: lineaInicio, campos });
    campos = [];
    campo = "";
  };

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else enComillas = false;
      } else {
        if (c === "\n" || (c === "\r" && texto[i + 1] !== "\n")) linea++;
        campo += c;
      }
      continue;
    }
    if (c === '"') enComillas = true;
    else if (c === separador) {
      campos.push(campo);
      campo = "";
    } else if (c === "\r" || c === "\n") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      cerrarFila();
      linea++;
      lineaInicio = linea;
    } else campo += c;
  }
  if (enComillas) throw new Error(`Línea ${lineaInicio}: comilla sin cerrar`);
  if (campo !== "" || campos.length > 0) cerrarFila();
  return filas;
}

/* -------------------------------- Montos ---------------------------------- */

/**
 * Los montos se llevan en centavos con BigInt: un `number` convierte
 * 0.1 + 0.2 en 0.30000000000000004 y la conciliación dejaría de cuadrar.
 */
export function montoACentavos(texto: string, separadorDecimal: "." | ","): bigint | null {
  let limpio = texto.trim().replace(/\s/g, "").replace(/^(RD|US)?\$/i, "");
  if (limpio === "") return null;

  // Los bancos escriben los débitos como "-500", "500-" o "(500)".
  let negativo = false;
  if (/^\(.*\)$/.test(limpio)) {
    negativo = true;
    limpio = limpio.slice(1, -1);
  }
  if (limpio.startsWith("-")) {
    negativo = !negativo;
    limpio = limpio.slice(1);
  } else if (limpio.endsWith("-")) {
    negativo = !negativo;
    limpio = limpio.slice(0, -1);
  }
  limpio = limpio.replace(/^(RD|US)?\$/i, "");

  const miles = separadorDecimal === "," ? "." : ",";
  limpio = limpio.split(miles).join("");
  if (separadorDecimal === ",") limpio = limpio.replace(",", ".");

  const partes = /^(\d+)(?:\.(\d{0,2}))?$/.exec(limpio);
  if (!partes) throw new Error(`monto inválido "${texto}"`);
  const centavos = BigInt(partes[1]) * 100n + BigInt((partes[2] ?? "").padEnd(2, "0"));
  return negativo ? -centavos : centavos;
}

export function centavosATexto(centavos: bigint): string {
  const signo = centavos < 0n ? "-" : "";
  const absoluto = centavos < 0n ? -centavos : centavos;
  return `${signo}${absoluto / 100n}.${(absoluto % 100n).toString().padStart(2, "0")}`;
}

/** "1.234,56" con separador "," → "1234.56". Vacío → null. */
export function normalizarMonto(texto: string, separadorDecimal: "." | ","): string | null {
  const centavos = montoACentavos(texto, separadorDecimal);
  return centavos === null ? null : centavosATexto(centavos);
}

/* -------------------------------- Fechas ---------------------------------- */

export function normalizarFecha(texto: string, formato: ColumnasEstado["formatoFecha"]): string | null {
  const limpio = texto.trim();
  let anio: number, mes: number, dia: number;
  if (formato === "YYYY-MM-DD") {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(limpio);
    if (!m) return null;
    [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else {
    // Algunos portales exportan la fecha con hora ("01/02/2026 00:00"); la hora se descarta.
    const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s.*)?$/.exec(limpio);
    if (!m) return null;
    const [a, b] = [Number(m[1]), Number(m[2])];
    [dia, mes] = formato === "DD/MM/YYYY" ? [a, b] : [b, a];
    anio = Number(m[3]);
  }
  // Date.UTC desborda (31/02 → 03/03); comparar de vuelta descarta fechas imposibles.
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
    return null;
  }
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/* ------------------------- Estado de cuenta genérico ------------------------ */

function resolverIndice(columna: string, encabezado: string[] | null): number {
  const buscada = columna.trim().toLowerCase();
  if (encabezado) {
    const indice = encabezado.findIndex((nombre) => nombre.trim().toLowerCase() === buscada);
    if (indice >= 0) return indice;
  }
  if (/^\d+$/.test(buscada)) return Number(buscada);
  throw new Error(`La columna "${columna}" no está en el encabezado del archivo`);
}

/** Lector de estados de cuenta guiado por columnas; lo reutilizan todos los adaptadores. */
export function parsearEstadoCuentaCsv(contenido: string, columnas: ColumnasEstado): MovimientoEstado[] {
  if (columnas.monto === undefined && columnas.debito === undefined && columnas.credito === undefined) {
    throw new Error("Hay que indicar la columna de monto o las de débito/crédito");
  }
  const filasEncabezado = columnas.filasEncabezado ?? 1;
  const separador = detectarSeparador(contenido.replace(/^﻿/, ""), filasEncabezado);
  const noVacias = leerCsv(contenido, separador).filter((f) => f.campos.some((c) => c.trim() !== ""));

  const encabezado = filasEncabezado > 0 ? (noVacias[filasEncabezado - 1]?.campos ?? null) : null;
  const indice = (columna: string | undefined) =>
    columna === undefined ? undefined : resolverIndice(columna, encabezado);
  const i = {
    fecha: indice(columnas.fecha)!,
    descripcion: indice(columnas.descripcion)!,
    referencia: indice(columnas.referencia),
    debito: indice(columnas.debito),
    credito: indice(columnas.credito),
    monto: indice(columnas.monto),
    saldo: indice(columnas.saldo),
  };
  const valor = (campos: string[], posicion: number | undefined) =>
    posicion === undefined ? "" : (campos[posicion] ?? "").trim();

  return noVacias.slice(filasEncabezado).map(({ linea, campos }) => {
    const textoFecha = valor(campos, i.fecha);
    const fecha = normalizarFecha(textoFecha, columnas.formatoFecha);
    if (!fecha) throw new Error(`Línea ${linea}: fecha inválida "${textoFecha}" (se esperaba ${columnas.formatoFecha})`);

    try {
      let centavos: bigint;
      if (i.monto !== undefined) {
        centavos = montoACentavos(valor(campos, i.monto), columnas.separadorDecimal) ?? 0n;
      } else {
        // Se usan magnitudes porque unos bancos escriben el débito en positivo y
        // otros con signo; lo que define el sentido es la columna, no el signo.
        const absoluto = (c: bigint | null) => (c === null ? 0n : c < 0n ? -c : c);
        const debito = absoluto(montoACentavos(valor(campos, i.debito), columnas.separadorDecimal));
        const credito = absoluto(montoACentavos(valor(campos, i.credito), columnas.separadorDecimal));
        centavos = credito - debito;
      }
      const textoSaldo = valor(campos, i.saldo);
      return {
        fecha,
        descripcion: valor(campos, i.descripcion),
        referencia: valor(campos, i.referencia) || null,
        monto: centavosATexto(centavos),
        saldo: textoSaldo === "" ? null : normalizarMonto(textoSaldo, columnas.separadorDecimal),
      };
    } catch (error) {
      throw new Error(`Línea ${linea}: ${(error as Error).message}`);
    }
  });
}
