/**
 * Récord de notas de secundaria (liceo): tipos, cálculo de promedios, validación
 * y fusión de lecturas. Todo puro, sin base de datos ni IA, para que lo usen por
 * igual el servidor (al confirmar), la pantalla (vista previa en vivo) y las
 * pruebas.
 *
 * Reglas que no se negocian:
 *  - La IA TRANSCRIBE; nunca calcula. Los promedios que traiga el papel (a lápiz o
 *    impresos) se ignoran, y el servidor recalcula todo al confirmar.
 *  - Las notas van de 0 a 100 y todas pesan igual: no hay créditos en secundaria.
 *  - Esto NO es el índice universitario (escala 4,00): no se mezclan.
 */

export type NotaLiceo = {
  materia: string;
  /** Módulo técnico (MF_…) en vez de asignatura del currículo base. */
  esModulo: boolean;
  /** `null` mientras la lectura no haya podido leerla: la pantalla obliga a llenarla. */
  nota: number | null;
  /** Certeza de la lectura (0–100); ausente en lo escrito a mano. */
  confianza?: number | null;
};

export type GradoLiceo = {
  /** 1 a 6. */
  grado: number;
  /** Año en que empezó el año escolar (2016 en «2016-2017»). */
  anioInicio: number;
  /** Centro de procedencia de ESTE grado; un estudiante puede cambiar de liceo. */
  centro: string;
  notas: NotaLiceo[];
};

export const GRADO_MINIMO = 1;
export const GRADO_MAXIMO = 6;
export const NOTA_MINIMA = 0;
export const NOTA_MAXIMA = 100;
export const MAXIMO_GRADOS = 12;
export const MAXIMO_NOTAS_POR_GRADO = 30;

/**
 * Decimales con los que se muestra y se guarda cada promedio.
 *
 * Decisión: se REDONDEA (mitad hacia arriba), no se trunca. El lápiz del récord
 * trunca (85,666 → 85.66) y por eso su promedio por año da 88,92 donde redondeando
 * da 88,93. Está anotado en `docs/estado/por-entregar.md` por si la fundación o la
 * universidad pide el truncado.
 */
export const DECIMALES_PROMEDIO = 2;

/** Redondeo mitad hacia arriba sin el error de coma flotante (`1.005 → 1.01`). */
export function redondear(valor: number, decimales = DECIMALES_PROMEDIO): number {
  const f = 10 ** decimales;

  return Math.round((valor + Number.EPSILON) * f) / f;
}

const aCentesimas = (n: number) => Math.round(n * 100);

export type ResumenGrado = {
  grado: number;
  anioInicio: number;
  centro: string;
  cantidad: number;
  suma: number;
  promedio: number;
};

export type PromediosRecord = {
  /** Suma de todas las notas entre la cantidad de notas. Es el que se usa. */
  global: number | null;
  /** Promedio de los promedios de cada grado (cada uno sin redondear antes). */
  anual: number | null;
  totalNotas: number;
  sumaTotal: number;
  porGrado: ResumenGrado[];
};

/**
 * Promedios de un récord ya completo. Las notas sin valor (`null`) NO cuentan: la
 * pantalla y el servidor exigen que no haya ninguna antes de confirmar, así que
 * aquí solo sirven para mostrar una vista previa mientras se llena.
 */
export function promediosDelRecord(grados: readonly GradoLiceo[]): PromediosRecord {
  const porGrado: ResumenGrado[] = [];
  let centesimasTotal = 0;
  let total = 0;
  let sumaDeMedias = 0;

  for (const g of grados) {
    const valores = g.notas.flatMap((n) => (n.nota === null || !Number.isFinite(n.nota) ? [] : [aCentesimas(n.nota)]));

    if (valores.length === 0) continue;

    const suma = valores.reduce((a, b) => a + b, 0);

    centesimasTotal += suma;
    total += valores.length;
    sumaDeMedias += suma / valores.length;
    porGrado.push({
      grado: g.grado,
      anioInicio: g.anioInicio,
      centro: g.centro,
      cantidad: valores.length,
      suma: suma / 100,
      promedio: redondear(suma / valores.length / 100),
    });
  }

  return {
    global: total === 0 ? null : redondear(centesimasTotal / total / 100),
    anual: porGrado.length === 0 ? null : redondear(sumaDeMedias / porGrado.length / 100),
    totalNotas: total,
    sumaTotal: centesimasTotal / 100,
    porGrado,
  };
}

/** «2016-2017». */
export const anioEscolar = (anioInicio: number) => `${anioInicio}-${anioInicio + 1}`;

/** Para comparar centros y materias sin que cuenten tildes, mayúsculas ni espacios de más. */
export const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // La puntuación («Castro Jima Abajo, La Vega.») no distingue un centro de otro.
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Misma tupla que la clave única de la base: grado + año escolar + centro. */
export const claveGrado = (g: Pick<GradoLiceo, "grado" | "anioInicio" | "centro">) => `${g.grado}|${g.anioInicio}|${normalizar(g.centro)}`;

export type ErrorRecord =
  | "sin_grados"
  | "demasiados_grados"
  | "grado_invalido"
  | "anio_invalido"
  | "centro_vacio"
  | "grado_sin_notas"
  | "demasiadas_notas"
  | "materia_vacia"
  | "nota_invalida"
  | "grado_repetido";

export type ValidacionRecord = { ok: true; grados: GradoLiceo[] } | { ok: false; error: ErrorRecord; grado?: number };

const ANIO_MINIMO = 1990;

/** Número con coma o punto decimal; cualquier otra cosa es `null`. */
export function leerNumero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== "string") return null;

  // Un punto suelto («95.» o «. 91») es mancha del papel, no parte de la nota.
  const limpio = valor.trim().replace(/^\.+|\.+$/g, "").replace(",", ".");

  return /^\d+(\.\d+)?$/.test(limpio) ? Number(limpio) : null;
}

const texto = (valor: unknown, maximo: number) => (typeof valor === "string" ? valor.replace(/\s+/g, " ").trim().slice(0, maximo) : "");

/**
 * Valida lo que llega del navegador (un récord a confirmar). Estricto: una nota
 * sin valor, fuera de 0–100 o un grado vacío lo rechaza entero; no se arregla
 * nada en silencio.
 */
export function validarRecord(entrada: unknown, anioActual = new Date().getFullYear()): ValidacionRecord {
  if (!Array.isArray(entrada) || entrada.length === 0) return { ok: false, error: "sin_grados" };
  if (entrada.length > MAXIMO_GRADOS) return { ok: false, error: "demasiados_grados" };

  const grados: GradoLiceo[] = [];
  const vistos = new Set<string>();

  for (const bruto of entrada) {
    const g = (bruto ?? {}) as Record<string, unknown>;
    const grado = leerNumero(g.grado);

    if (grado === null || !Number.isInteger(grado) || grado < GRADO_MINIMO || grado > GRADO_MAXIMO) return { ok: false, error: "grado_invalido" };

    const anioInicio = leerNumero(g.anioInicio);

    if (anioInicio === null || !Number.isInteger(anioInicio) || anioInicio < ANIO_MINIMO || anioInicio > anioActual + 1) return { ok: false, error: "anio_invalido", grado };

    const centro = texto(g.centro, 160);

    if (!centro) return { ok: false, error: "centro_vacio", grado };

    const crudas = Array.isArray(g.notas) ? g.notas : [];

    if (crudas.length === 0) return { ok: false, error: "grado_sin_notas", grado };
    if (crudas.length > MAXIMO_NOTAS_POR_GRADO) return { ok: false, error: "demasiadas_notas", grado };

    const notas: NotaLiceo[] = [];

    for (const c of crudas) {
      const n = (c ?? {}) as Record<string, unknown>;
      const materia = texto(n.materia, 120);

      if (!materia) return { ok: false, error: "materia_vacia", grado };

      const nota = leerNumero(n.nota);

      if (nota === null || nota < NOTA_MINIMA || nota > NOTA_MAXIMA) return { ok: false, error: "nota_invalida", grado };

      notas.push({ materia, esModulo: n.esModulo === true, nota: redondear(nota, 2) });
    }

    const limpio: GradoLiceo = { grado, anioInicio, centro, notas };
    const clave = claveGrado(limpio);

    if (vistos.has(clave)) return { ok: false, error: "grado_repetido", grado };
    vistos.add(clave);
    grados.push(limpio);
  }

  grados.sort((a, b) => a.grado - b.grado || a.anioInicio - b.anioInicio);

  return { ok: true, grados };
}

/** Parte del año escolar «2016-2017» (o «2016 - 2017», o solo «2016»); `null` si no se entiende. */
export function leerAnioEscolar(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isInteger(valor) ? valor : null;
  if (typeof valor !== "string") return null;

  const m = /(\d{4})/.exec(valor);

  return m ? Number(m[1]) : null;
}

/** El mínimo de certeza por debajo del cual la pantalla marca la nota para revisar. */
export const CONFIANZA_REVISAR = 80;

/**
 * Convierte la respuesta del modelo en grados BORRADOR. Es tolerante a propósito:
 * lo que no se entiende queda en `null` (la pantalla lo obliga a llenar), nunca se
 * inventa. Un grado sin ninguna materia se descarta.
 */
export function gradosDeRespuesta(datos: unknown): GradoLiceo[] {
  const lista = (datos as { grados?: unknown } | null)?.grados;

  if (!Array.isArray(lista)) return [];

  const resultado: GradoLiceo[] = [];

  for (const bruto of lista) {
    const g = (bruto ?? {}) as Record<string, unknown>;
    const grado = leerNumero(g.grado);
    const anioInicio = leerAnioEscolar(g.anio);
    const crudas = Array.isArray(g.notas) ? g.notas : [];

    if (grado === null || !Number.isInteger(grado) || grado < GRADO_MINIMO || grado > GRADO_MAXIMO || anioInicio === null) continue;

    const notas = crudas.flatMap((c): NotaLiceo[] => {
      const n = (c ?? {}) as Record<string, unknown>;
      const materia = texto(n.materia, 120);

      if (!materia) return [];

      const valor = leerNumero(n.nota);
      const confianza = leerNumero(n.confianza);

      return [
        {
          materia,
          esModulo: n.modulo === true || /^MF[_\s-]?\d/i.test(materia),
          nota: valor !== null && valor >= NOTA_MINIMA && valor <= NOTA_MAXIMA ? valor : null,
          confianza: confianza !== null && confianza >= 0 && confianza <= 100 ? Math.round(confianza) : null,
        },
      ];
    });

    if (notas.length > 0) resultado.push({ grado, anioInicio, centro: texto(g.centro, 160), notas });
  }

  return resultado;
}

/**
 * Une lo leído de varias imágenes (el frente y el reverso del récord). Un bloque
 * con la misma clave (grado + año + centro) suma sus materias a las del otro; una
 * materia con el mismo nombre y la misma nota que ya estaba no se repite (es lo
 * que pasa cuando dos fotos cubren la misma tabla).
 */
export function fusionarGrados(base: readonly GradoLiceo[], nuevos: readonly GradoLiceo[]): GradoLiceo[] {
  const mapa = new Map<string, GradoLiceo>();

  for (const g of base) mapa.set(claveGrado(g), { ...g, notas: [...g.notas] });

  for (const g of nuevos) {
    const clave = claveGrado(g);
    const actual = mapa.get(clave);

    if (!actual) {
      mapa.set(clave, { ...g, notas: [...g.notas] });
      continue;
    }

    for (const n of g.notas) {
      const repetida = actual.notas.some((x) => normalizar(x.materia) === normalizar(n.materia) && x.nota === n.nota);

      if (!repetida) actual.notas.push(n);
    }
  }

  return [...mapa.values()].sort((a, b) => a.grado - b.grado || a.anioInicio - b.anioInicio);
}

/** Cuántas notas de un borrador aún no tienen valor o tienen poca certeza. */
export function pendientesDeRevisar(grados: readonly GradoLiceo[]): { sinNota: number; dudosas: number } {
  let sinNota = 0;
  let dudosas = 0;

  for (const g of grados) {
    for (const n of g.notas) {
      if (n.nota === null) sinNota += 1;
      else if (n.confianza !== null && n.confianza !== undefined && n.confianza < CONFIANZA_REVISAR) dudosas += 1;
    }
  }

  return { sinNota, dudosas };
}

/**
 * Lee un borrador que viene del navegador (lo que hay en pantalla mientras se
 * revisa). Es más suave que `validarRecord`: deja pasar notas sin valor, materias
 * o centros vacíos, porque todavía se está llenando. Solo exige la forma y los
 * topes de tamaño; lo demás lo comprueba `validarRecord` al confirmar.
 */
export function borradorDeEntrada(entrada: unknown): GradoLiceo[] {
  if (!Array.isArray(entrada)) return [];

  return entrada.slice(0, MAXIMO_GRADOS).flatMap((bruto): GradoLiceo[] => {
    const g = (bruto ?? {}) as Record<string, unknown>;
    const grado = leerNumero(g.grado);
    const anioInicio = leerNumero(g.anioInicio);

    if (grado === null || !Number.isInteger(grado) || grado < GRADO_MINIMO || grado > GRADO_MAXIMO) return [];
    if (anioInicio === null || !Number.isInteger(anioInicio)) return [];

    const notas = (Array.isArray(g.notas) ? g.notas : []).slice(0, MAXIMO_NOTAS_POR_GRADO).map((c): NotaLiceo => {
      const n = (c ?? {}) as Record<string, unknown>;
      const nota = leerNumero(n.nota);
      const confianza = leerNumero(n.confianza);

      return {
        materia: texto(n.materia, 120),
        esModulo: n.esModulo === true,
        nota: nota !== null && nota >= NOTA_MINIMA && nota <= NOTA_MAXIMA ? nota : null,
        confianza: confianza !== null && confianza >= 0 && confianza <= 100 ? Math.round(confianza) : null,
      };
    });

    return [{ grado, anioInicio, centro: texto(g.centro, 160), notas }];
  });
}
