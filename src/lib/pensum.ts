/**
 * Lectura de una lista de materias pegada desde una hoja de cálculo o un PDF
 * ya copiado. Una materia por línea: `código ; nombre ; créditos ; período ;
 * prerrequisitos`. Sirve ; tabulador o | como separador, y los prerrequisitos
 * van separados por coma. Lo que no se pueda leer no se adivina: la línea se
 * devuelve como rechazada para que quien carga la corrija.
 */

export type MateriaLeida = {
  codigo: string;
  nombre: string;
  creditos: number;
  periodoSugerido: number | null;
  prerrequisitos: string[];
};

export type LecturaPensum = {
  materias: MateriaLeida[];
  /** Números de línea (desde 1) que no se pudieron leer. */
  rechazadas: number[];
};

const MAX_MATERIAS = 300;

function entero(texto: string | undefined, min: number, max: number): number | null {
  const limpio = (texto ?? "").trim();

  if (!/^\d{1,3}$/.test(limpio)) return null;
  const n = Number(limpio);

  return n >= min && n <= max ? n : null;
}

export function leerListaDePensum(texto: string): LecturaPensum {
  const materias: MateriaLeida[] = [];
  const rechazadas: number[] = [];
  const vistos = new Set<string>();

  texto.split(/\r?\n/).forEach((linea, i) => {
    // Líneas vacías y comentarios (#) no son materias ni errores.
    if (!linea.trim() || linea.trimStart().startsWith("#")) return;

    const campos = linea.split(/[;\t|]/).map((c) => c.trim());
    const [codigo, nombre, creditosTxt, periodoTxt, prereqTxt] = campos;
    const creditos = creditosTxt === undefined || creditosTxt === "" ? 3 : entero(creditosTxt, 0, 20);
    const periodo = periodoTxt === undefined || periodoTxt === "" ? null : entero(periodoTxt, 1, 20);
    const clave = (codigo ?? "").toUpperCase();

    const valida =
      codigo && nombre && codigo.length <= 20 && nombre.length <= 160 && creditos !== null &&
      (periodoTxt === undefined || periodoTxt === "" || periodo !== null) && !vistos.has(clave);

    if (!valida || materias.length >= MAX_MATERIAS) {
      rechazadas.push(i + 1);

      return;
    }

    vistos.add(clave);
    materias.push({
      codigo: clave,
      nombre,
      creditos: creditos as number,
      periodoSugerido: periodo,
      prerrequisitos: (prereqTxt ?? "")
        .split(",")
        .map((p) => p.trim().toUpperCase())
        .filter((p) => p && p !== clave && p.length <= 20),
    });
  });

  return { materias, rechazadas };
}
