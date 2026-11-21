// Sin imports a propósito: así la prueba de scripts/ lo carga sin resolver alias. Estas dos
// definiciones repiten `soloDigitos` (gradua.ts) y `RETIRADA` (indice-academico.ts).
const soloDigitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const RETIRADA = "R";

/**
 * Carga guiada de calificaciones: la parte que no toca la base ni la IA.
 *
 *  - `filasDeRespuesta` valida lo que devolvió el modelo como si viniera de un
 *    desconocido: lo que no encaje se descarta fila por fila.
 *  - `emparejarEstudiante` decide a QUÉ estudiante pertenece una fila. Solo la
 *    matrícula o un nombre que dé exactamente un candidato cuentan; en cualquier
 *    otro caso la fila queda sin emparejar y una persona elige. Nunca se adivina:
 *    una nota puesta en la persona equivocada es peor que una nota sin poner.
 *  - `resolverMateria` y `resolverLetra` corroboran contra el pénsum del
 *    estudiante y las letras de SU universidad.
 */

export type FilaLeida = {
  matricula: string | null;
  nombre: string | null;
  codigo: string | null;
  materia: string | null;
  letra: string | null;
  nota: number | null;
  confianza: number | null;
};

export const MAX_FILAS_CARGA = 600;

const texto = (v: unknown, max = 160): string | null => {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const t = String(v).replace(/\s+/g, " ").trim().slice(0, max);

  return t === "" ? null : t;
};

/** Filas del JSON del modelo: `{ filas: [{ matricula, nombre, codigo, materia, letra, nota, confianza }] }`. */
export function filasDeRespuesta(datos: unknown): FilaLeida[] {
  const crudas = typeof datos === "object" && datos !== null ? (datos as { filas?: unknown }).filas : null;

  if (!Array.isArray(crudas)) return [];

  const filas: FilaLeida[] = [];

  for (const c of crudas.slice(0, MAX_FILAS_CARGA)) {
    if (typeof c !== "object" || c === null) continue;

    const o = c as Record<string, unknown>;
    const notaTxt = texto(o.nota, 8)?.replace(",", ".");
    const nota = notaTxt !== undefined && notaTxt !== null && Number.isFinite(Number(notaTxt)) && Number(notaTxt) >= 0 && Number(notaTxt) <= 100 ? Number(notaTxt) : null;
    const conf = Number(o.confianza);
    const fila: FilaLeida = {
      matricula: texto(o.matricula, 20),
      nombre: texto(o.nombre),
      codigo: texto(o.codigo, 20),
      materia: texto(o.materia),
      letra: texto(o.letra, 3),
      nota,
      confianza: Number.isFinite(conf) ? Math.min(100, Math.max(0, Math.round(conf))) : null,
    };

    // Sin forma de saber de quién ni de qué materia, no es una fila.
    if (!fila.matricula && !fila.nombre) continue;
    if (!fila.codigo && !fila.materia) continue;

    filas.push(fila);
  }

  return filas;
}

/** Líneas pegadas: `matrícula ; nombre ; código ; letra ; nota` (la nota es opcional). */
export function filasDeLista(lista: string): FilaLeida[] {
  const filas: FilaLeida[] = [];

  for (const linea of lista.split(/\r?\n/).slice(0, MAX_FILAS_CARGA)) {
    if (!linea.trim() || linea.trimStart().startsWith("#")) continue;

    const [matricula, nombre, codigo, letra, nota] = linea.split(/[;\t|]/).map((c) => c.trim());

    filas.push(...filasDeRespuesta({ filas: [{ matricula, nombre, codigo, letra, nota, confianza: 100 }] }));
  }

  return filas;
}

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Código sin espacios, guiones ni mayúsculas: «CIM 001», «cim-001» y «CIM001» son uno. */
export const claveCodigo = (c: string | null | undefined) => sinAcentos(c ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const palabras = (n: string | null | undefined) =>
  sinAcentos(n ?? "").toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter((p) => p.length > 1);

/** Nombre de la lista y nombre del expediente: las mismas palabras, en cualquier orden («PEREZ, JUAN» = «Juan Pérez»). */
export function mismoNombre(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = palabras(a);
  const y = palabras(b);

  if (x.length < 2 || y.length < 2) return false;

  const cortos = x.length <= y.length ? x : y;
  const largos = new Set(x.length <= y.length ? y : x);

  // Todas las palabras del nombre más corto están en el más largo (un segundo apellido de más no estorba).
  return cortos.every((p) => largos.has(p));
}

export type CandidatoEstudiante = { id: string; nombre: string; matricula: string | null };

export type Emparejamiento =
  | { estado: "emparejado"; estudianteId: string; por: "matricula" | "nombre" }
  | { estado: "sin_emparejar"; motivo: "sin_candidato" | "ambiguo" | "matricula_otra_persona" };

export function emparejarEstudiante(fila: Pick<FilaLeida, "matricula" | "nombre">, candidatos: readonly CandidatoEstudiante[]): Emparejamiento {
  const dig = soloDigitos(fila.matricula ?? "");

  if (dig.length >= 4) {
    const porMatricula = candidatos.filter((c) => c.matricula && soloDigitos(c.matricula) === dig);

    if (porMatricula.length === 1) {
      // La matrícula manda, pero si el nombre leído no se parece en nada, es sospechoso: no se empareja solo.
      if (!fila.nombre || mismoNombre(fila.nombre, porMatricula[0].nombre) || palabras(fila.nombre).length < 2) {
        return { estado: "emparejado", estudianteId: porMatricula[0].id, por: "matricula" };
      }

      return { estado: "sin_emparejar", motivo: "matricula_otra_persona" };
    }

    if (porMatricula.length > 1) return { estado: "sin_emparejar", motivo: "ambiguo" };
  }

  if (fila.nombre) {
    const porNombre = candidatos.filter((c) => mismoNombre(fila.nombre, c.nombre));

    if (porNombre.length === 1) return { estado: "emparejado", estudianteId: porNombre[0].id, por: "nombre" };
    if (porNombre.length > 1) return { estado: "sin_emparejar", motivo: "ambiguo" };
  }

  return { estado: "sin_emparejar", motivo: "sin_candidato" };
}

export type MateriaPensum = { codigo: string; nombre: string; creditos: number };

/** La materia de la fila dentro del pénsum del estudiante: por código y, si no, por nombre exacto único. */
export function resolverMateria(fila: Pick<FilaLeida, "codigo" | "materia">, pensum: readonly MateriaPensum[]): MateriaPensum | null {
  const clave = claveCodigo(fila.codigo);

  if (clave) {
    const porCodigo = pensum.find((m) => claveCodigo(m.codigo) === clave);

    if (porCodigo) return porCodigo;
  }

  const nombre = sinAcentos(fila.materia ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

  if (nombre.length >= 5) {
    const porNombre = pensum.filter((m) => sinAcentos(m.nombre).toLowerCase().replace(/[^a-z0-9]/g, "") === nombre);

    if (porNombre.length === 1) return porNombre[0];
  }

  return null;
}

/** La letra normalizada si la universidad la usa (más retirada «R» y seminario «P»); si no, null. */
export function resolverLetra(letra: string | null | undefined, letrasDeLaUniversidad: readonly string[]): string | null {
  const l = (letra ?? "").toUpperCase().replace(/\s+/g, "");

  return l && [...letrasDeLaUniversidad, RETIRADA, "P"].includes(l) ? l : null;
}

export type ProblemaFila = "sin_estudiante" | "ambiguo" | "matricula_otra_persona" | "sin_pensum" | "materia_fuera_del_pensum" | "letra_invalida" | "repetida" | "confianza_baja";

/** Confianza bajo la cual se pide mirar la fila aunque todo cuadre. */
export const CONFIANZA_MINIMA = 70;
