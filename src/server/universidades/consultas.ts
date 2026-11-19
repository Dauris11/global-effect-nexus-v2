import { consultar, consultarUna } from "@/lib/db";

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
  return consultar<UniversidadCatalogo>(
    `SELECT u.id, u.siglas, u.nombre, u.regimen, u.activa,
            (SELECT count(*)::int FROM carrera c WHERE c.universidad_id = u.id) AS carreras,
            (SELECT count(*)::int FROM estudiante e WHERE e.universidad_id = u.id) AS estudiantes
       FROM universidad u
      ORDER BY u.activa DESC, u.siglas`,
  );
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

export async function universidadPorId(id: string) {
  return consultarUna<{ id: string; siglas: string; nombre: string; regimen: Regimen; activa: boolean }>(
    `SELECT id, siglas, nombre, regimen, activa FROM universidad WHERE id = $1`,
    [id],
  );
}

export async function carreraPorId(id: string) {
  return consultarUna<{ id: string; nombre: string; activa: boolean; universidad_id: string; siglas: string; regimen: Regimen }>(
    `SELECT c.id, c.nombre, c.activa, c.universidad_id, u.siglas, u.regimen
       FROM carrera c JOIN universidad u ON u.id = c.universidad_id
      WHERE c.id = $1`,
    [id],
  );
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

/** El catálogo elegido por un estudiante y su avance sobre el pénsum. */
export type CatalogoDelEstudiante = {
  matricula: string | null;
  universidad: { id: string; siglas: string; nombre: string; regimen: Regimen } | null;
  carrera: { id: string; nombre: string } | null;
  pensum: { id: string; version: string } | null;
  materias: (MateriaPensum & { estado: "aprobada" | "cursando" | "pendiente" })[];
  creditosTotales: number;
  creditosAprobados: number;
};

/**
 * Cruza el pénsum con las inscripciones del estudiante. Una materia casa por
 * código (sin distinguir mayúsculas ni espacios) y, si la inscripción no trae
 * código, por nombre normalizado. Lo que no casa queda «pendiente»: nunca se
 * da por aprobada una materia que el sistema no vio aprobar.
 */
export async function catalogoDelEstudiante(estudianteId: string): Promise<CatalogoDelEstudiante> {
  const base = await consultarUna<{
    matricula: string | null;
    uni_id: string | null;
    siglas: string | null;
    uni_nombre: string | null;
    regimen: Regimen | null;
    carrera_id: string | null;
    carrera_nombre: string | null;
    pensum_id: string | null;
    version: string | null;
  }>(
    `SELECT e.matricula, u.id AS uni_id, u.siglas, u.nombre AS uni_nombre, u.regimen,
            c.id AS carrera_id, c.nombre AS carrera_nombre,
            p.id AS pensum_id, p.version
       FROM estudiante e
       LEFT JOIN universidad u ON u.id = e.universidad_id
       LEFT JOIN carrera c ON c.id = e.carrera_id
       LEFT JOIN pensum p ON p.id = e.pensum_id
      WHERE e.id = $1`,
    [estudianteId],
  );

  const vacio: CatalogoDelEstudiante = {
    matricula: base?.matricula ?? null,
    universidad: base?.uni_id && base.siglas ? { id: base.uni_id, siglas: base.siglas, nombre: base.uni_nombre ?? "", regimen: base.regimen ?? "cuatrimestre" } : null,
    carrera: base?.carrera_id ? { id: base.carrera_id, nombre: base.carrera_nombre ?? "" } : null,
    pensum: base?.pensum_id ? { id: base.pensum_id, version: base.version ?? "" } : null,
    materias: [],
    creditosTotales: 0,
    creditosAprobados: 0,
  };

  if (!base?.pensum_id) return vacio;

  // Dos fuentes: las inscripciones del sistema (activa / aprobada) y el
  // historial consolidado, que es donde cae lo aprobado en cuatrimestres
  // anteriores. Retirada y reprobada no cuentan como avance.
  const [materias, inscripciones] = await Promise.all([
    materiasDePensum(base.pensum_id),
    consultar<{ codigo: string | null; nombre: string; estado: string }>(
      `SELECT m.codigo, m.nombre, i.estado
         FROM inscripcion i JOIN materia m ON m.id = i.materia_id
        WHERE i.estudiante_id = $1 AND i.estado IN ('activa', 'aprobada')
       UNION ALL
       SELECT NULL, h.materia, 'aprobada'
         FROM historial_calificacion h
        WHERE h.estudiante_id = $1 AND h.estado = 'aprobada'`,
      [estudianteId],
    ),
  ]);

  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "").toLowerCase();
  const estados = new Map<string, string>();

  // Aprobada gana sobre cursando si hubiera dos filas de la misma materia.
  const peso = (e: string) => (e === "aprobada" ? 2 : 1);

  for (const i of inscripciones) {
    for (const clave of [i.codigo ? `c:${norm(i.codigo)}` : null, `n:${norm(i.nombre)}`]) {
      if (clave && peso(i.estado) >= peso(estados.get(clave) ?? "")) estados.set(clave, i.estado);
    }
  }

  const conEstado = materias.map((m) => {
    const e = estados.get(`c:${norm(m.codigo)}`) ?? estados.get(`n:${norm(m.nombre)}`);

    return { ...m, estado: (e === "aprobada" ? "aprobada" : e ? "cursando" : "pendiente") as "aprobada" | "cursando" | "pendiente" };
  });

  return {
    ...vacio,
    materias: conEstado,
    creditosTotales: conEstado.reduce((n, m) => n + m.creditos, 0),
    creditosAprobados: conEstado.filter((m) => m.estado === "aprobada").reduce((n, m) => n + m.creditos, 0),
  };
}
