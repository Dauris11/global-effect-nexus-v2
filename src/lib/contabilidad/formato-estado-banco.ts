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
