import { consultar, consultarUna } from "@/lib/db";
import { etiquetaPeriodo } from "@/lib/gradua";
import { calcularIndice, RETIRADA, type ReglasIndice, type ResultadoIndice } from "@/lib/indice-academico";
import { urlDeAvatar } from "@/lib/supabase/almacen";

/**
 * Lecturas del catálogo universidad → carrera → pénsum → materias. Los tipos
 * viven aquí y los componentes cliente solo los importan como tipos.
 */

export type Regimen = "cuatrimestre" | "trimestre" | "semestre";

export type UniversidadCatalogo = {
  id: string;
  siglas: string;
  nombre: string;
  regimen: Regimen;
  activa: boolean;
  logo: string | null;
  carreras: number;
  estudiantes: number;
};

export type CarreraCatalogo = {
  id: string;
  universidad_id: string;
  nombre: string;
  activa: boolean;
  pensums: number;
  estudiantes: number;
};

export type PensumCatalogo = {
  id: string;
  carrera_id: string;
  version: string;
  vigente: boolean;
  materias: number;
  creditos: number;
  estudiantes: number;
};

export type MateriaPensum = {
  id: string;
  pensum_id: string;
  codigo: string;
  nombre: string;
  creditos: number;
  periodo_sugerido: number | null;
  prerrequisitos: string[];
};

export async function universidadesCatalogo(): Promise<UniversidadCatalogo[]> {
  const filas = await consultar<Omit<UniversidadCatalogo, "logo"> & { logo_ruta: string | null }>(
    `SELECT u.id, u.siglas, u.nombre, u.regimen, u.activa, u.logo_ruta,
            (SELECT count(*)::int FROM carrera c WHERE c.universidad_id = u.id) AS carreras,
            (SELECT count(*)::int FROM estudiante e WHERE e.universidad_id = u.id) AS estudiantes
       FROM universidad u
      ORDER BY u.activa DESC, u.siglas`,
  );

  return filas.map(({ logo_ruta, ...u }) => ({ ...u, logo: urlDeAvatar(logo_ruta) }));
}

export async function carrerasDeUniversidad(universidadId: string): Promise<CarreraCatalogo[]> {
  return consultar<CarreraCatalogo>(
    `SELECT c.id, c.universidad_id, c.nombre, c.activa,
            (SELECT count(*)::int FROM pensum p WHERE p.carrera_id = c.id) AS pensums,
            (SELECT count(*)::int FROM estudiante e WHERE e.carrera_id = c.id) AS estudiantes
       FROM carrera c
      WHERE c.universidad_id = $1
      ORDER BY c.activa DESC, c.nombre`,
    [universidadId],
  );
}

export type ReglasUniversidad = {
  puntos_por_letra: Record<string, number>;
  letra_minima_aprobar: string;
  retirada_cuenta_en_divisor: boolean;
  redondeo_indice: "truncar" | "redondear";
  reglas_confirmadas: boolean;
  /** Escala del índice (UCATECI 4,00) y umbrales de alerta; null = sin definir. */
  indice_maximo: number | null;
  indice_minimo_periodo: number | null;
  indice_minimo_acumulado: number | null;
};

export async function universidadPorId(id: string) {
  const fila = await consultarUna<{ id: string; siglas: string; nombre: string; regimen: Regimen; activa: boolean; logo_ruta: string | null } & ReglasUniversidad>(
    `SELECT id, siglas, nombre, regimen, activa, logo_ruta, puntos_por_letra, letra_minima_aprobar,
            retirada_cuenta_en_divisor, redondeo_indice, reglas_confirmadas,
            indice_maximo::float8 AS indice_maximo, indice_minimo_periodo::float8 AS indice_minimo_periodo,
            indice_minimo_acumulado::float8 AS indice_minimo_acumulado
       FROM universidad WHERE id = $1`,
    [id],
  );

  if (!fila) return null;

  const { logo_ruta, ...resto } = fila;

  return { ...resto, logo: urlDeAvatar(logo_ruta) };
}

export async function carreraPorId(id: string) {
  const fila = await consultarUna<{ id: string; nombre: string; activa: boolean; universidad_id: string; siglas: string; regimen: Regimen; logo_ruta: string | null }>(
    `SELECT c.id, c.nombre, c.activa, c.universidad_id, u.siglas, u.regimen, u.logo_ruta
       FROM carrera c JOIN universidad u ON u.id = c.universidad_id
      WHERE c.id = $1`,
    [id],
  );

  if (!fila) return null;

  const { logo_ruta, ...resto } = fila;

  return { ...resto, logo: urlDeAvatar(logo_ruta) };
}

export async function pensumsDeCarrera(carreraId: string): Promise<PensumCatalogo[]> {
  return consultar<PensumCatalogo>(
    `SELECT p.id, p.carrera_id, p.version, p.vigente,
            (SELECT count(*)::int FROM pensum_materia m WHERE m.pensum_id = p.id) AS materias,
            (SELECT COALESCE(sum(m.creditos), 0)::int FROM pensum_materia m WHERE m.pensum_id = p.id) AS creditos,
            (SELECT count(*)::int FROM estudiante e WHERE e.pensum_id = p.id) AS estudiantes
       FROM pensum p
      WHERE p.carrera_id = $1
      ORDER BY p.vigente DESC, p.version DESC`,
    [carreraId],
  );
}

export async function materiasDePensum(pensumId: string): Promise<MateriaPensum[]> {
  return consultar<MateriaPensum>(
    `SELECT id, pensum_id, codigo, nombre, creditos, periodo_sugerido, prerrequisitos
       FROM pensum_materia
      WHERE pensum_id = $1
      ORDER BY periodo_sugerido NULLS LAST, codigo`,
    [pensumId],
  );
}

/** Todo el árbol activo, para los selectores en cascada del expediente. */
export type ArbolCatalogo = {
  universidades: { id: string; siglas: string }[];
  carreras: { id: string; universidad_id: string; nombre: string }[];
  pensums: { id: string; carrera_id: string; version: string; vigente: boolean }[];
};

export async function arbolCatalogo(): Promise<ArbolCatalogo> {
  const [universidades, carreras, pensums] = await Promise.all([
    consultar<{ id: string; siglas: string }>(`SELECT id, siglas FROM universidad WHERE activa ORDER BY siglas`),
    consultar<{ id: string; universidad_id: string; nombre: string }>(
      `SELECT id, universidad_id, nombre FROM carrera WHERE activa ORDER BY nombre`,
    ),
    consultar<{ id: string; carrera_id: string; version: string; vigente: boolean }>(
      `SELECT id, carrera_id, version, vigente FROM pensum ORDER BY version DESC`,
    ),
  ]);

  return { universidades, carreras, pensums };
}

/** Cómo está una materia del pénsum para un estudiante. */
export type EstadoMateria = "aprobada" | "reprobada" | "retirada" | "cursando" | "pendiente";

export type MateriaConAvance = MateriaPensum & {
  estado: EstadoMateria;
  /** Resultado (A, B, C, D, F, P o R) y período en que se cursó, si se conocen. */
  letra: string | null;
  periodo: string | null;
  puntos: number | null;
  /** Electiva: la materia real que ocupó el cupo. */
  detalle: string | null;
  /** De dónde sale el resultado: el gradua oficial o las notas del sistema. */
  fuente: "gradua" | "sistema" | null;
};

/** El catálogo elegido por un estudiante y su avance sobre el pénsum. */
export type CatalogoDelEstudiante = {
  matricula: string | null;
  universidad: { id: string; siglas: string; nombre: string; regimen: Regimen; logo: string | null } | null;
  carrera: { id: string; nombre: string } | null;
  pensum: { id: string; version: string } | null;
  materias: MateriaConAvance[];
  creditosTotales: number;
  creditosAprobados: number;
  /** Índice según las reglas de la universidad; `null` sin resultados o sin reglas. */
  indice: ResultadoIndice | null;
  reglas: (ReglasIndice & { letraMinima: string; confirmadas: boolean }) | null;
  /** Lo que declara el último gradua leído, para compararlo con `indice`. */
  gradua: { indiceReportado: number | null; creditosReportados: number | null; subidoEl: string | null; fueraDelPensum: string[] } | null;
};

const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").toLowerCase();

/**
 * Estado de una materia a partir de su resultado. `R` es retirada y `P` un
 * seminario aprobado sin puntos; el resto se compara con la letra mínima de la
 * universidad. Una letra que sus reglas no conocen no se adivina: queda pendiente.
 */
function estadoDeLetra(letra: string, reglas: ReglasIndice & { letraMinima: string }): EstadoMateria {
  const l = letra.toUpperCase();

  if (l === RETIRADA) return "retirada";
  if (l === "P") return "aprobada";

  const valor = reglas.puntosPorLetra[l];
  const minimo = reglas.puntosPorLetra[reglas.letraMinima];

  if (valor === undefined || minimo === undefined) return "pendiente";

  return valor >= minimo ? "aprobada" : "reprobada";
}

/**
 * Cruza el pénsum con todo lo que se sabe del estudiante, en este orden de
 * confianza: los resultados nativos (el gradua leído y las calificaciones que se suban), las notas
 * que ya tiene el sistema (`historial_calificacion`) y, por último, sus
 * inscripciones. Lo que no aparece en ninguna queda «pendiente»: nunca se da por
 * aprobada una materia que nadie vio aprobada. Se calcula al mostrarlo, así que
 * se actualiza solo cuando entran notas nuevas o se sube un gradua más reciente.
 */
export async function catalogoDelEstudiante(estudianteId: string | null): Promise<CatalogoDelEstudiante> {
  const vacio: CatalogoDelEstudiante = {
    matricula: null, universidad: null, carrera: null, pensum: null, materias: [],
    creditosTotales: 0, creditosAprobados: 0, indice: null, reglas: null, gradua: null,
  };

  // Una cuenta sin ficha enlazada no tiene catálogo.
  if (!estudianteId) return vacio;

  const base = await consultarUna<{
    matricula: string | null;
    uni_id: string | null;
    logo_ruta: string | null;
    siglas: string | null;
    uni_nombre: string | null;
    regimen: Regimen | null;
    puntos_por_letra: Record<string, number> | null;
    letra_minima_aprobar: string | null;
    retirada_cuenta_en_divisor: boolean | null;
    redondeo_indice: "truncar" | "redondear" | null;
    reglas_confirmadas: boolean | null;
    carrera_id: string | null;
    carrera_nombre: string | null;
    pensum_id: string | null;
    version: string | null;
  }>(
    `SELECT e.matricula, u.id AS uni_id, u.logo_ruta, u.siglas, u.nombre AS uni_nombre, u.regimen,
            u.puntos_por_letra, u.letra_minima_aprobar, u.retirada_cuenta_en_divisor,
            u.redondeo_indice, u.reglas_confirmadas,
            c.id AS carrera_id, c.nombre AS carrera_nombre,
            p.id AS pensum_id, p.version
       FROM estudiante e
       LEFT JOIN universidad u ON u.id = e.universidad_id
       LEFT JOIN carrera c ON c.id = e.carrera_id
       LEFT JOIN pensum p ON p.id = e.pensum_id
      WHERE e.id = $1`,
    [estudianteId],
  );

  const reglas = base?.puntos_por_letra
    ? {
        puntosPorLetra: base.puntos_por_letra,
        retiradaCuentaEnDivisor: base.retirada_cuenta_en_divisor ?? true,
        redondeo: base.redondeo_indice ?? "truncar",
        letraMinima: base.letra_minima_aprobar ?? "D",
        confirmadas: base.reglas_confirmadas ?? false,
      }
    : null;

  const resultado: CatalogoDelEstudiante = {
    ...vacio,
    matricula: base?.matricula ?? null,
    universidad: base?.uni_id && base.siglas
      ? { id: base.uni_id, logo: urlDeAvatar(base.logo_ruta), siglas: base.siglas, nombre: base.uni_nombre ?? "", regimen: base.regimen ?? "cuatrimestre" }
      : null,
    carrera: base?.carrera_id ? { id: base.carrera_id, nombre: base.carrera_nombre ?? "" } : null,
    pensum: base?.pensum_id ? { id: base.pensum_id, version: base.version ?? "" } : null,
    reglas,
  };

  if (!base?.pensum_id || !reglas) return resultado;

  const [materias, avance, historial, inscripciones, ultimoGradua] = await Promise.all([
    materiasDePensum(base.pensum_id),
    // El intento MÁS RECIENTE de cada materia es su estado vigente: una retirada que
    // se vuelve a cursar deja de figurar como retirada.
    consultar<{ codigo: string; detalle: string | null; nombre: string; creditos: number; puntos: number | null; anio: number; ronda: number; letra: string; fuente: string }>(
      `SELECT DISTINCT ON (codigo) codigo, detalle, nombre, creditos, puntos, anio, ronda, letra, fuente
         FROM resultado_materia WHERE estudiante_id = $1
        ORDER BY codigo, anio DESC, ronda DESC`,
      [estudianteId],
    ),
    consultar<{ materia: string; cuatrimestre: string; nota_letra: string; estado: string }>(
      `SELECT materia, cuatrimestre, nota_letra, estado FROM historial_calificacion WHERE estudiante_id = $1 ORDER BY cuatrimestre`,
      [estudianteId],
    ),
    consultar<{ codigo: string | null; nombre: string; estado: string }>(
      `SELECT m.codigo, m.nombre, i.estado
         FROM inscripcion i JOIN materia m ON m.id = i.materia_id
        WHERE i.estudiante_id = $1`,
      [estudianteId],
    ),
    consultarUna<{ resumen: { indiceReportado: number | null; creditosReportados: number | null } | null; created_at: string }>(
      `SELECT resumen, created_at::text AS created_at FROM archivo_academico
        WHERE estudiante_id = $1 AND tipo = 'gradua' AND resumen IS NOT NULL
        ORDER BY created_at DESC LIMIT 1`,
      [estudianteId],
    ),
  ]);

  const avancePorCodigo = new Map(avance.map((a) => [a.codigo.toUpperCase(), a]));
  // Si una materia se cursó más de una vez gana el último período (están ordenadas).
  const historialPorNombre = new Map(historial.map((h) => [normalizar(h.materia), h]));
  const inscripcionPorClave = new Map<string, string>();

  for (const i of inscripciones) {
    for (const clave of [i.codigo ? `c:${normalizar(i.codigo)}` : null, `n:${normalizar(i.nombre)}`]) {
      if (clave) inscripcionPorClave.set(clave, i.estado);
    }
  }

  const conAvance: MateriaConAvance[] = materias.map((m) => {
    const base0 = { ...m, letra: null, periodo: null, puntos: null, detalle: null, fuente: null };
    const a = avancePorCodigo.get(m.codigo.toUpperCase());

    if (a) {
      return {
        ...m,
        estado: estadoDeLetra(a.letra, reglas),
        letra: a.letra,
        periodo: etiquetaPeriodo(a.anio, a.ronda),
        puntos: a.puntos ?? (a.letra.toUpperCase() === RETIRADA ? 0 : (reglas.puntosPorLetra[a.letra.toUpperCase()] ?? 0) * a.creditos),
        detalle: a.detalle,
        fuente: a.fuente === "gradua" ? ("gradua" as const) : ("sistema" as const),
      };
    }

    const h = historialPorNombre.get(normalizar(m.nombre));

    if (h) {
      return {
        ...m,
        estado: estadoDeLetra(h.nota_letra, reglas),
        letra: h.nota_letra,
        periodo: h.cuatrimestre,
        puntos: (reglas.puntosPorLetra[h.nota_letra.toUpperCase()] ?? 0) * m.creditos,
        detalle: null,
        fuente: "sistema" as const,
      };
    }

    const i = inscripcionPorClave.get(`c:${normalizar(m.codigo)}`) ?? inscripcionPorClave.get(`n:${normalizar(m.nombre)}`);
    const estado: EstadoMateria =
      i === "aprobada" ? "aprobada" : i === "reprobada" ? "reprobada" : i === "retirada" ? "retirada" : i === "activa" ? "cursando" : "pendiente";

    return { ...base0, estado };
  });

  // El índice usa TODO lo que tiene resultado: lo del gradua (incluidas filas que
  // no están en el pénsum elegido, p. ej. convalidaciones) y las notas del sistema
  // de las materias que el gradua no cubre.
  const codigosDelPensum = new Set(materias.map((m) => m.codigo.toUpperCase()));
  const items = [
    ...avance.map((a) => ({ creditos: a.creditos, resultado: a.letra })),
    // Del historial anterior solo lo que los resultados nativos no cubren.
    ...conAvance.filter((m) => m.fuente === "sistema" && m.letra && !avancePorCodigo.has(m.codigo.toUpperCase())).map((m) => ({ creditos: m.creditos, resultado: m.letra as string })),
  ];

  return {
    ...resultado,
    materias: conAvance,
    creditosTotales: conAvance.reduce((n, m) => n + m.creditos, 0),
    creditosAprobados: conAvance.filter((m) => m.estado === "aprobada").reduce((n, m) => n + m.creditos, 0),
    indice: items.length > 0 ? calcularIndice(items, reglas) : null,
    gradua: ultimoGradua?.resumen
      ? {
          indiceReportado: ultimoGradua.resumen.indiceReportado,
          creditosReportados: ultimoGradua.resumen.creditosReportados,
          subidoEl: ultimoGradua.created_at.slice(0, 10),
          fueraDelPensum: avance.filter((a) => !codigosDelPensum.has(a.codigo.toUpperCase())).map((a) => a.codigo),
        }
      : null,
  };
}

export type ArchivoAcademico = {
  id: string;
  tipo: "gradua" | "record_notas" | "pensum_pdf";
  nombre: string;
  tamano: number;
  created_at: string;
  subido_por_nombre: string | null;
};

/**
 * Los PDF de un estudiante o de un pénsum, del más reciente al más antiguo. Las fotos
 * del récord de secundaria llevan su propio panel (`record_liceo_id`), por eso no salen aquí.
 */
export async function archivosAcademicos(destino: "estudiante" | "pensum", id: string): Promise<ArchivoAcademico[]> {
  return consultar<ArchivoAcademico>(
    `SELECT a.id, a.tipo, a.nombre, a.tamano, a.created_at::text AS created_at, u.nombre AS subido_por_nombre
       FROM archivo_academico a LEFT JOIN usuario u ON u.id = a.subido_por
      WHERE ${destino === "pensum" ? "a.pensum_id" : "a.estudiante_id"} = $1
        AND a.record_liceo_id IS NULL
      ORDER BY a.created_at DESC`,
    [id],
  );
}

/** Para la ruta de descarga: la ruta del bucket y a quién pertenece. */
export async function archivoAcademicoPorId(id: string) {
  return consultarUna<{ ruta: string; estudiante_id: string | null; pensum_id: string | null; tipo: string }>(
    `SELECT ruta, estudiante_id, pensum_id, tipo FROM archivo_academico WHERE id = $1`,
    [id],
  );
}

/** Un intento de cursar una materia, tal como se enseña en el récord. */
export type IntentoMateria = {
  id: string;
  codigo: string;
  nombre: string;
  detalle: string | null;
  creditos: number;
  periodo: string;
  letra: string;
  nota: number | null;
  fuente: "gradua" | "calificaciones" | "manual";
  estado: EstadoMateria;
  /** Aprobada pero con la letra mínima: no es un problema todavía, pero está en el límite. */
  enLimite: boolean;
  /** Es el intento más reciente de su materia (el que decide su estado actual). */
  vigente: boolean;
};

export type RecordNativo = {
  periodos: { periodo: string; indice: number | null; creditos: number; intentos: IntentoMateria[] }[];
  total: number;
};

/**
 * El récord nativo: todos los intentos del estudiante agrupados por cuatrimestre,
 * del más reciente al más antiguo, con el índice de cada período según las reglas
 * de su universidad. Es lo que permite filtrar por cuatrimestre y ver las malas
 * calificaciones. `null` si el estudiante no tiene resultados nativos.
 */
export async function recordNativoDelEstudiante(estudianteId: string | null): Promise<RecordNativo | null> {
  if (!estudianteId) return null;

  const [filas, uni] = await Promise.all([
    consultar<{ id: string; codigo: string; nombre: string; detalle: string | null; creditos: number; anio: number; ronda: number; letra: string; nota: string | null; fuente: IntentoMateria["fuente"] }>(
      `SELECT id, codigo, nombre, detalle, creditos, anio, ronda, letra, nota_numerica::text AS nota, fuente
         FROM resultado_materia WHERE estudiante_id = $1 ORDER BY anio DESC, ronda DESC, codigo`,
      [estudianteId],
    ),
    consultarUna<{ puntos_por_letra: Record<string, number>; letra_minima_aprobar: string; retirada_cuenta_en_divisor: boolean; redondeo_indice: "truncar" | "redondear" }>(
      `SELECT u.puntos_por_letra, u.letra_minima_aprobar, u.retirada_cuenta_en_divisor, u.redondeo_indice
         FROM estudiante e JOIN universidad u ON u.id = e.universidad_id WHERE e.id = $1`,
      [estudianteId],
    ),
  ]);

  if (filas.length === 0 || !uni) return null;

  const reglas = {
    puntosPorLetra: uni.puntos_por_letra,
    retiradaCuentaEnDivisor: uni.retirada_cuenta_en_divisor,
    redondeo: uni.redondeo_indice,
    letraMinima: uni.letra_minima_aprobar,
  };
  // Las filas vienen del período más reciente al más antiguo: la primera de cada
  // código es su intento vigente.
  const vigentes = new Set<string>();
  const intentos: IntentoMateria[] = filas.map((f) => {
    const vigente = !vigentes.has(f.codigo);

    vigentes.add(f.codigo);

    const estado = estadoDeLetra(f.letra, reglas);

    return {
      id: f.id,
      codigo: f.codigo,
      nombre: f.nombre,
      detalle: f.detalle,
      creditos: f.creditos,
      periodo: etiquetaPeriodo(f.anio, f.ronda),
      letra: f.letra,
      nota: f.nota === null ? null : Number(f.nota),
      fuente: f.fuente,
      estado,
      enLimite: estado === "aprobada" && f.letra.toUpperCase() === reglas.letraMinima.toUpperCase(),
      vigente,
    };
  });

  const grupos = new Map<string, IntentoMateria[]>();

  for (const i of intentos) grupos.set(i.periodo, [...(grupos.get(i.periodo) ?? []), i]);

  return {
    total: intentos.length,
    periodos: [...grupos.entries()].map(([periodo, lista]) => ({
      periodo,
      indice: calcularIndice(lista.map((i) => ({ creditos: i.creditos, resultado: i.letra })), reglas).indice,
      creditos: lista.filter((i) => i.letra.toUpperCase() !== RETIRADA).reduce((n, i) => n + i.creditos, 0),
      intentos: lista,
    })),
  };
}
