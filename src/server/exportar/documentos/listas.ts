
import { consultar, consultarUna } from "@/lib/db";
import { leerConsultaExpedientes } from "@/lib/filtros-expedientes";
import { estudiantesEnRiesgo } from "@/server/academico/riesgo";
import { listaExpedientes } from "@/server/expedientes/consultas";

import { traducir } from "../traducir";
import { nombreSeguro, type Documento } from "../documento";

const idx = (n: number | null | undefined) => (n === null || n === undefined ? null : Number(n).toFixed(2));

/** Lista de expedientes tal como se está viendo (mismos filtros y orden), completa y sin paginar. */
export async function documentoListaExpedientes(p: URLSearchParams): Promise<Documento> {
  const [t, c] = [await traducir("records"), leerConsultaExpedientes(Object.fromEntries(p))];
  const filas = await listaExpedientes({ busqueda: c.busqueda, estado: c.estado, universidad: c.universidad, situacion: c.situacion, orden: c.orden, porPagina: 5000, pagina: 1 });
  const filtros = [c.estado && `situación: ${t(`status.${c.estado}` as never)}`, c.universidad && `universidad: ${c.universidad}`, c.situacion && `filtro: ${t(`filters.${c.situacion}` as never)}`, c.busqueda && `búsqueda: «${c.busqueda}»`].filter(Boolean).join(" · ");

  return {
    titulo: "Lista de expedientes",
    subtitulo: `${filas.length} ${filas.length === 1 ? "expediente" : "expedientes"}${filtros ? ` · ${filtros}` : ""}`,
    horizontal: true,
    bloques: [
      {
        tipo: "tabla",
        nombreHoja: "Expedientes",
        columnas: ["Nombre", "Cédula", "Situación", "Universidad", "Programa", "Grupo", "Ingreso", "Índice", "Teléfono", "Correo"],
        alinear: ["l", "l", "l", "l", "l", "c", "l", "r", "l", "l"],
        filas: filas.map((f) => [f.nombre, f.cedula, t(`status.${f.estado}` as never), f.universidad, f.programa, f.grupo, f.fecha_ingreso, idx(f.indice), f.telefono, f.email]),
      },
    ],
    nombreArchivo: "expedientes",
  };
}

/** Estudiantes de una universidad: quién, en qué carrera, con qué índice y en qué situación. */
export async function documentoEstudiantesUniversidad(id: string): Promise<Documento | null> {
  const u = await consultarUna<{ siglas: string; nombre: string }>(`SELECT siglas, nombre FROM universidad WHERE id = $1`, [id]);

  if (!u) return null;

  const t = await traducir("records");
  const filas = await consultar<{ nombre: string; matricula: string | null; cedula: string | null; carrera: string | null; estado: string; indice: number | null; telefono: string | null; email: string | null }>(
    `SELECT e.nombre, e.matricula, e.cedula, c.nombre AS carrera, e.estado::text AS estado, indice_estudiante(e.id)::float8 AS indice, e.telefono, e.email::text AS email
       FROM estudiante e LEFT JOIN carrera c ON c.id = e.carrera_id
      WHERE e.universidad_id = $1 ORDER BY c.nombre NULLS LAST, e.nombre`,
    [id],
  );

  return {
    titulo: `Estudiantes de ${u.siglas}`,
    subtitulo: `${u.nombre} · ${filas.length} ${filas.length === 1 ? "estudiante" : "estudiantes"}`,
    horizontal: true,
    bloques: [{ tipo: "tabla", nombreHoja: u.siglas, columnas: ["N.º", "Nombre", "Matrícula", "Carrera", "Situación", "Índice", "Teléfono", "Correo"], alinear: ["c", "l", "l", "l", "l", "r", "l", "l"], anchos: [4, 26, 10, 26, 11, 7, 12, 24], filas: filas.map((f, i) => [i + 1, f.nombre, f.matricula, f.carrera, t(`status.${f.estado}` as never), idx(f.indice), f.telefono, f.email]) }],
    nombreArchivo: `estudiantes-${nombreSeguro(u.siglas)}`,
  };
}

/** Todas las calificaciones de una universidad, una fila por materia cursada. */
export async function documentoNotasUniversidad(id: string): Promise<Documento | null> {
  const u = await consultarUna<{ siglas: string; nombre: string }>(`SELECT siglas, nombre FROM universidad WHERE id = $1`, [id]);

  if (!u) return null;

  const filas = await consultar<{ matricula: string | null; nombre: string; carrera: string | null; anio: number; ronda: number; codigo: string; materia: string; creditos: number; letra: string; nota: string | null }>(
    `SELECT e.matricula, e.nombre, c.nombre AS carrera, r.anio, r.ronda, r.codigo, r.nombre AS materia, r.creditos, r.letra, r.nota_numerica::text AS nota
       FROM resultado_materia r JOIN estudiante e ON e.id = r.estudiante_id LEFT JOIN carrera c ON c.id = e.carrera_id
      WHERE e.universidad_id = $1 ORDER BY e.nombre, r.anio, r.ronda, r.codigo`,
    [id],
  );

  return {
    titulo: `Calificaciones de ${u.siglas}`,
    subtitulo: `${u.nombre} · ${filas.length} calificaciones`,
    horizontal: true,
    bloques: [{ tipo: "tabla", nombreHoja: "Calificaciones", columnas: ["Matrícula", "Estudiante", "Carrera", "Año", "Período", "Código", "Materia", "Créd.", "Letra", "Nota"], alinear: ["l", "l", "l", "c", "c", "l", "l", "r", "c", "r"], filas: filas.map((f) => [f.matricula, f.nombre, f.carrera, f.anio, f.ronda, f.codigo, f.materia, f.creditos, f.letra, f.nota]) }],
    nombreArchivo: `calificaciones-${nombreSeguro(u.siglas)}`,
  };
}

/** Estudiantes que hoy necesitan atención académica, con el motivo y cómo contactarlos. */
export async function documentoRiesgo(): Promise<Documento> {
  const filas = await estudiantesEnRiesgo();
  const motivo = (m: string) => (m === "acumulado" ? "índice acumulado" : m === "periodo" ? "índice del período" : "materias reprobadas");

  return {
    titulo: "Estudiantes en riesgo académico",
    subtitulo: `${filas.length} ${filas.length === 1 ? "estudiante" : "estudiantes"} · solo activos`,
    horizontal: true,
    bloques: [{ tipo: "tabla", nombreHoja: "En riesgo", columnas: ["Estudiante", "Universidad", "Carrera", "Motivo", "Índice", "Mínimo", "Último período", "Índice período", "Reprobadas", "Teléfono", "Correo"], alinear: ["l", "l", "l", "l", "r", "r", "c", "r", "c", "l", "l"], filas: filas.map((f) => [f.nombre, f.universidad, f.carrera, f.motivos.map(motivo).join(", "), idx(f.indice), idx(f.umbralAcumulado), f.periodo, idx(f.indicePeriodo), f.reprobadas, f.telefono, f.email]) }],
    nombreArchivo: "estudiantes-en-riesgo",
  };
}

/** Estudiantes inscritos en una clase de Global Effect 360 en un período. */
export async function documentoClase360(materiaId: string, periodoId: string, conAsistencia: boolean): Promise<Documento | null> {
  const clase = await consultarUna<{ materia: string; periodo: string }>(`SELECT m.nombre AS materia, p.nombre AS periodo FROM materia_360 m, periodo p WHERE m.id = $1 AND p.id = $2`, [materiaId, periodoId]);

  if (!clase) return null;

  const filas = await consultar<{ nombre: string; matricula: string | null; cedula: string | null; universidad: string | null; estado: string; nota: string | null; telefono: string | null }>(
    `SELECT e.nombre, e.matricula, e.cedula, u.siglas AS universidad, i.estado, i.nota::text AS nota, e.telefono
       FROM inscripcion_360 i JOIN estudiante e ON e.id = i.estudiante_id LEFT JOIN universidad u ON u.id = e.universidad_id
      WHERE i.materia_id = $1 AND i.periodo_id = $2 AND i.estado <> 'retirada' ORDER BY e.nombre`,
    [materiaId, periodoId],
  );
  const estados: Record<string, string> = { prematriculada: "Prematriculado", cursando: "Cursando", aprobada: "Aprobado", reprobada: "Reprobado", retirada: "Retirado" };

  if (conAsistencia) {
    const sesiones = Array.from({ length: 12 }, (_, i) => String(i + 1));

    return {
      titulo: `Hoja de asistencia — ${clase.materia}`,
      subtitulo: `Global Effect 360 · período ${clase.periodo} · ${filas.length} estudiantes`,
      horizontal: true,
      bloques: [{ tipo: "tabla", cuadricula: true, nombreHoja: "Asistencia", columnas: ["N.º", "Estudiante", "Matrícula / cédula", ...sesiones], alinear: ["c", "l", "l", ...sesiones.map(() => "c" as const)], anchos: [4, 26, 12, ...sesiones.map(() => 3.2)], filas: filas.map((f, i) => [i + 1, f.nombre, f.matricula ?? f.cedula, ...sesiones.map(() => "")]) }],
      nombreArchivo: `asistencia-${nombreSeguro(clase.materia)}-${nombreSeguro(clase.periodo)}`,
    };
  }

  return {
    titulo: `Estudiantes de ${clase.materia}`,
    subtitulo: `Global Effect 360 · período ${clase.periodo} · ${filas.length} estudiantes`,
    bloques: [{ tipo: "tabla", nombreHoja: "Clase", columnas: ["N.º", "Estudiante", "Matrícula / cédula", "Universidad", "Estado", "Nota", "Teléfono"], alinear: ["c", "l", "l", "l", "l", "r", "l"], anchos: [4, 28, 13, 11, 12, 6, 13], filas: filas.map((f, i) => [i + 1, f.nombre, f.matricula ?? f.cedula, f.universidad, estados[f.estado] ?? f.estado, f.nota, f.telefono]) }],
    nombreArchivo: `clase-${nombreSeguro(clase.materia)}-${nombreSeguro(clase.periodo)}`,
  };
}

/** Los estudiantes que apadrina un patrocinador, con su avance. */
export async function documentoEstudiantesPatrocinador(id: string): Promise<Documento | null> {
  const p = await consultarUna<{ nombre: string; pais: string | null }>(`SELECT nombre, pais FROM patrocinador WHERE id = $1`, [id]);

  if (!p) return null;

  const filas = await consultar<{ nombre: string; universidad: string | null; carrera: string | null; indice: number | null; monto: number; desde: string; hasta: string | null; activa: boolean }>(
    `SELECT e.nombre, u.siglas AS universidad, c.nombre AS carrera, indice_estudiante(e.id)::float8 AS indice, a.monto::float8 AS monto,
            a.fecha_inicio::text AS desde, a.fecha_fin::text AS hasta, (a.estado = 'activo') AS activa
       FROM asignacion_beca a JOIN estudiante e ON e.id = a.estudiante_id LEFT JOIN universidad u ON u.id = e.universidad_id LEFT JOIN carrera c ON c.id = e.carrera_id
      WHERE a.patrocinador_id = $1 ORDER BY (a.estado = 'activo') DESC, e.nombre`,
    [id],
  );

  return {
    titulo: `Estudiantes de ${p.nombre}`,
    subtitulo: `${p.pais ? `${p.pais} · ` : ""}${filas.filter((f) => f.activa).length} activos de ${filas.length}`,
    horizontal: true,
    bloques: [{ tipo: "tabla", nombreHoja: "Estudiantes", columnas: ["Estudiante", "Universidad", "Carrera", "Índice", "Aporte", "Desde", "Hasta", "Beca"], alinear: ["l", "l", "l", "r", "r", "l", "l", "l"], filas: filas.map((f) => [f.nombre, f.universidad, f.carrera, idx(f.indice), f.monto.toFixed(2), f.desde, f.hasta, f.activa ? "Vigente" : "Finalizada"]) }],
    nombreArchivo: `estudiantes-${nombreSeguro(p.nombre)}`,
  };
}

/** Un plan de estudios completo: sus materias por cuatrimestre, con créditos y prerrequisitos. */
export async function documentoPlanDeEstudios(pensumId: string): Promise<Documento | null> {
  const plan = await consultarUna<{ version: string; carrera: string; universidad: string; siglas: string }>(
    `SELECT p.version, c.nombre AS carrera, u.nombre AS universidad, u.siglas FROM pensum p JOIN carrera c ON c.id = p.carrera_id JOIN universidad u ON u.id = c.universidad_id WHERE p.id = $1`,
    [pensumId],
  );

  if (!plan) return null;

  const filas = await consultar<{ periodo: number | null; codigo: string; nombre: string; creditos: number; prerrequisitos: string[] }>(
    `SELECT periodo_sugerido AS periodo, codigo, nombre, creditos, prerrequisitos FROM pensum_materia WHERE pensum_id = $1 ORDER BY periodo_sugerido NULLS LAST, codigo`,
    [pensumId],
  );
  const total = filas.reduce((n, f) => n + f.creditos, 0);

  return {
    titulo: `Plan de estudios — ${plan.carrera}`,
    subtitulo: `${plan.universidad} · versión ${plan.version} · ${filas.length} materias · ${total} créditos`,
    bloques: [{ tipo: "tabla", nombreHoja: "Plan de estudios", columnas: ["Cuat.", "Código", "Materia", "Créd.", "Prerrequisitos"], alinear: ["c", "l", "l", "r", "l"], anchos: [5, 11, 44, 6, 22], filas: filas.map((f) => [f.periodo, f.codigo, f.nombre, f.creditos, (f.prerrequisitos ?? []).join(", ")]) }],
    nombreArchivo: `plan-${nombreSeguro(plan.siglas)}-${nombreSeguro(plan.carrera)}`,
  };
}
