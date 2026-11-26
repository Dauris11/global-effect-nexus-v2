/**
 * Lector y previsualizador de estados de cuenta bancarios (.csv) según los
 * formatos configurados en `contabilidad.formato_estado_banco`.
 *
 * Puro (sin imports de Next ni pg) para usarse tanto en la previsualización
 * inmediata del navegador como en el servidor y en las pruebas unitarias.
 */

export type FormatoEstadoBanco = {
  id: string;
  nombre: string;
  filasOmitirInicio: number;
  omitirUltimaFila: boolean;
  columnas: string[];
  activo: boolean;
};

export type ResultadoVistaPreviaCsv = {
  columnas: string[];
  filas: Record<string, string>[];
  totalLineasArchivo: number;
  filasOmitidasInicio: number;
  ultimaFilaOmitida: boolean;
  columnasFaltantes: string[];
};

/**
 * Decodifica un CSV bancario en UTF-8 con respaldo en Windows-1252 (Latin-1):
 * portales como Banco Santa Cruz exportan «Descripción» y «Depósitos» en
 * Windows-1252, que en UTF-8 estricto produce caracteres corruptos.
 */
export function decodificarCsvBanco(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let texto: string;
  try {
    texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    texto = new TextDecoder("windows-1252").decode(bytes);
  }
  return texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
}

/** Normaliza encabezados para comparar sin distinguir mayúsculas ni tildes. */
export function normalizarNombreColumna(valor: string): string {
  return valor
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Lector RFC 4180 de una línea física CSV (respeta comillas y `""`). */
export function leerFilaCsv(linea: string, separador: "," | ";"): string[] {
  const campos: string[] = [];
  let campo = "";
  let enComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (enComillas) {
      if (c === '"') {
        if (linea[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          enComillas = false;
        }
      } else {
        campo += c;
      }
      continue;
    }
    if (c === '"') {
      enComillas = true;
    } else if (c === separador) {
      campos.push(campo);
      campo = "";
    } else {
      campo += c;
    }
  }
  campos.push(campo);
  return campos;
}

/**
 * Algunos bancos (como Banco Santa Cruz) envuelven toda la fila de datos en
 * una sola pareja de comillas externas con comillas internas duplicadas:
 * `"16/11/2026,""16/11/2026"","""",""242634096"",..."`.
 * Al desenvolver esa primera capa y volver a parsear se obtienen las columnas reales.
 */
function leerFilaConDesenvuelto(linea: string, separador: "," | ";"): string[] {
  const inicial = leerFilaCsv(linea, separador);
  if (inicial.length === 1 && inicial[0].includes(separador)) {
    return leerFilaCsv(inicial[0], separador);
  }
  return inicial;
}

function detectarSeparadorEncabezado(linea: string): "," | ";" {
  let comas = 0;
  let puntosYComa = 0;
  let enComillas = false;
  for (const c of linea) {
    if (c === '"') enComillas = !enComillas;
    else if (!enComillas && c === ",") comas++;
    else if (!enComillas && c === ";") puntosYComa++;
  }
  return puntosYComa > comas ? ";" : ",";
}

/**
 * Aplica las reglas del formato bancario (omitir filas iniciales, tomar
 * encabezados, omitir la última fila de totales si corresponde y extraer las
 * columnas configuradas con sus datos).
 */
export function parsearVistaPreviaEstadoBanco(
  contenido: string,
  formato: Pick<FormatoEstadoBanco, "filasOmitirInicio" | "omitirUltimaFila" | "columnas">,
): ResultadoVistaPreviaCsv {
  const texto = contenido.charCodeAt(0) === 0xfeff ? contenido.slice(1) : contenido;
  const lineasFisicas = texto.split(/\r\n|\n|\r/);

  // Quitar solo líneas completamente vacías al final del archivo (salto de línea final).
  while (lineasFisicas.length > 0 && lineasFisicas[lineasFisicas.length - 1].trim() === "") {
    lineasFisicas.pop();
  }

  const totalLineasArchivo = lineasFisicas.length;
  const omitirInicio = Math.max(0, Math.min(formato.filasOmitirInicio, totalLineasArchivo));
  const restantes = lineasFisicas.slice(omitirInicio);

  if (restantes.length === 0) {
    return {
      columnas: formato.columnas,
      filas: [],
      totalLineasArchivo,
      filasOmitidasInicio: omitirInicio,
      ultimaFilaOmitida: false,
      columnasFaltantes: [...formato.columnas],
    };
  }

  const lineaEncabezado = restantes[0];
  const separador = detectarSeparadorEncabezado(lineaEncabezado);
  const encabezadosCrudos = leerFilaConDesenvuelto(lineaEncabezado, separador);
  const mapaEncabezado = new Map<string, number>();
  encabezadosCrudos.forEach((col, idx) => {
    const clave = normalizarNombreColumna(col);
    if (clave && !mapaEncabezado.has(clave)) {
      mapaEncabezado.set(clave, idx);
    }
  });

  const columnasFaltantes: string[] = [];
  const indices: Array<{ nombre: string; idx: number }> = [];
  for (const col of formato.columnas) {
    const idx = mapaEncabezado.get(normalizarNombreColumna(col));
    if (idx === undefined) {
      columnasFaltantes.push(col);
    } else {
      indices.push({ nombre: col, idx });
    }
  }

  const lineasDatos = restantes.slice(1).filter((l) => l.trim() !== "");
  let ultimaFilaOmitida = false;
  if (formato.omitirUltimaFila && lineasDatos.length > 0) {
    lineasDatos.pop();
    ultimaFilaOmitida = true;
  }

  const filas: Record<string, string>[] = [];
  for (const linea of lineasDatos) {
    const campos = leerFilaConDesenvuelto(linea, separador);
    const fila: Record<string, string> = {};
    let tieneAlgunDato = false;
    for (const { nombre, idx } of indices) {
      const valor = (campos[idx] ?? "").trim();
      fila[nombre] = valor;
      if (valor !== "") tieneAlgunDato = true;
    }
    if (tieneAlgunDato) {
      filas.push(fila);
    }
  }

  return {
    columnas: formato.columnas,
    filas,
    totalLineasArchivo,
    filasOmitidasInicio: omitirInicio,
    ultimaFilaOmitida,
    columnasFaltantes,
  };
}

export type TransaccionEstadoBanco = {
  fechaPosteo: string | null;
  fechaEfectiva: string;
  noCheque: string | null;
  referencia: string | null;
  descripcion: string;
  retiros: string;
  depositos: string;
  /** Neto con signo (+ depósito, - retiro) en centavos exactos. */
  monto: string;
  saldo: string | null;
};

/** Normaliza una referencia bancaria/pago para comparar conciliación automática. */
export function normalizarReferenciaBanco(valor: string | null | undefined): string {
  return String(valor ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function parsearFechaBanco(texto: string): string | null {
  const limpio = texto.trim();
  if (!limpio) return null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(limpio);
  if (iso) {
    const [anio, mes, dia] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    const d = new Date(Date.UTC(anio, mes - 1, dia));
    if (d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia) {
      return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    }
    return null;
  }
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s.*)?$/.exec(limpio);
  if (!dmy) return null;
  const [dia, mes, anio] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return null;
  }
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function parsearCentavosBanco(texto: string): bigint | null {
  let limpio = texto.trim().replace(/\s/g, "").replace(/^(RD|US)?\$/i, "");
  if (!limpio) return null;
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
  // Si solo hay coma y exactamente 2 dígitos al final (p. ej. "1.234,56"), usar coma decimal.
  if (limpio.includes(",") && !limpio.includes(".") && /,\d{1,2}$/.test(limpio)) {
    limpio = limpio.replace(/\./g, "").replace(",", ".");
  } else {
    limpio = limpio.replace(/,/g, "");
  }
  const m = /^(\d+)(?:\.(\d{0,2}))?$/.exec(limpio);
  if (!m) return null;
  const centavos = BigInt(m[1]) * 100n + BigInt((m[2] ?? "").padEnd(2, "0"));
  return negativo ? -centavos : centavos;
}

function centavosAStr(c: bigint): string {
  const signo = c < 0n ? "-" : "";
  const abs = c < 0n ? -c : c;
  return `${signo}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}

function buscarColumnaPorAlias(columnas: string[], aliases: string[]): string | null {
  for (const alias of aliases) {
    const encontrada = columnas.find((c) => normalizarNombreColumna(c) === alias);
    if (encontrada) return encontrada;
  }
  for (const alias of aliases) {
    const encontrada = columnas.find((c) => normalizarNombreColumna(c).includes(alias));
    if (encontrada) return encontrada;
  }
  return null;
}

/**
 * Convierte las filas previsualizadas de un CSV bancario en transacciones
 * normalizadas listas para persistirse en `contabilidad.extracto_linea`.
 */
export function extraerTransaccionesBanco(
  resultado: ResultadoVistaPreviaCsv,
): TransaccionEstadoBanco[] {
  const cols = resultado.columnas;
  const colPosteo = buscarColumnaPorAlias(cols, ["fecha de posteo", "fecha posteo", "posteo"]);
  const colEfectiva = buscarColumnaPorAlias(cols, ["fecha efectiva", "fecha valor", "fecha"]);
  const colCheque = buscarColumnaPorAlias(cols, ["no. cheque", "no cheque", "cheque"]);
  const colRef = buscarColumnaPorAlias(cols, ["no. referencia", "no referencia", "referencia"]);
  const colDesc = buscarColumnaPorAlias(cols, ["descripcion", "concepto", "detalle"]);
  const colRetiros = buscarColumnaPorAlias(cols, ["retiros", "retiro", "debito", "debitos", "cargo"]);
  const colDepositos = buscarColumnaPorAlias(cols, ["depositos", "deposito", "credito", "creditos", "abono"]);
  const colBalance = buscarColumnaPorAlias(cols, ["balance", "saldo"]);

  const transacciones: TransaccionEstadoBanco[] = [];
  for (let idx = 0; idx < resultado.filas.length; idx++) {
    const f = resultado.filas[idx];
    const fechaPosteo = colPosteo ? parsearFechaBanco(f[colPosteo] ?? "") : null;
    const fechaEfectiva = (colEfectiva ? parsearFechaBanco(f[colEfectiva] ?? "") : null) ?? fechaPosteo;
    if (!fechaEfectiva) {
      throw new Error(`Fila ${idx + 1}: fecha efectiva inválida`);
    }

    const retRaw = colRetiros ? parsearCentavosBanco(f[colRetiros] ?? "") : 0n;
    const depRaw = colDepositos ? parsearCentavosBanco(f[colDepositos] ?? "") : 0n;
    const retC = retRaw === null ? 0n : retRaw < 0n ? -retRaw : retRaw;
    const depC = depRaw === null ? 0n : depRaw < 0n ? -depRaw : depRaw;
    const netoC = depC - retC;
    const saldoRaw = colBalance && (f[colBalance] ?? "").trim() !== ""
      ? parsearCentavosBanco(f[colBalance] ?? "")
      : null;

    const noCheque = colCheque ? (f[colCheque] ?? "").trim() || null : null;
    const referencia = colRef ? (f[colRef] ?? "").trim() || null : null;
    const descripcion = (colDesc ? (f[colDesc] ?? "").trim() : "") || "—";

    transacciones.push({
      fechaPosteo,
      fechaEfectiva,
      noCheque,
      referencia,
      descripcion,
      retiros: centavosAStr(retC),
      depositos: centavosAStr(depC),
      monto: centavosAStr(netoC),
      saldo: saldoRaw === null ? null : centavosAStr(saldoRaw),
    });
  }
  return transacciones;
}
