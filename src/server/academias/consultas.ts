import { consultar, consultarUna } from "@/lib/db";

/**
 * Academias: los programas extracurriculares y sus materiales.
 *
 * Dos tablas de la migración 0007, `academia` y `material`, que llevaban
 * escritas desde el principio y sin ninguna pantalla que las leyera.
 *
 * UNA ADVERTENCIA SOBRE `participantes`, porque se lee como si fuera una
 * cuenta y no lo es. En proyectos el avance se CUENTA desde las tareas, y en
 * cursos los inscritos se cuentan desde la matrícula; aquí no hay de dónde
 * contar: **no existe tabla de inscripción a una academia**. La columna es un
 * número que teclea quien lleva el programa, y la pantalla lo dice en voz alta
 * en vez de disfrazarlo de dato calculado. Si algún día importa saber QUIÉN
 * está en una academia —y para pasar lista importa—, hace falta una tabla, no
 * un número mejor mantenido.
 *
 * `materiales`, en cambio, sí se cuenta: es un `count(*)` de la tabla que
 * cuelga, y es lo que avisa de que borrar el programa se lleva sus recursos.
 */

export type AcademiaFila = {
  id: string;
  nombre: string;
  tipo: string;
  descripcion: string | null;
  facilitador: string | null;
  estado: string;
  participantes: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  /** Recursos que cuelgan del programa. Cascada al borrar (0007). */
  materiales: number;
};

export type FiltroAcademias = {
  busqueda?: string | null;
  tipo?: string | null;
  estado?: string | null;
};

/** Condición compartida por el catálogo y su resumen. Tres parámetros. */
const CONDICION_ACADEMIA = `($1::text IS NULL
                             OR a.nombre      ILIKE '%' || $1 || '%'
                             OR a.facilitador ILIKE '%' || $1 || '%')
                        AND ($2::text IS NULL OR a.tipo = $2)
                        AND ($3::text IS NULL OR a.estado = $3)`;

function parametrosAcademia(filtro: FiltroAcademias): unknown[] {
  return [
    filtro.busqueda?.trim() || null,
    filtro.tipo || null,
    filtro.estado || null,
  ];
}

/**
 * El catálogo de programas.
 *
 * Ordena por estado y luego por fecha de inicio descendente: lo que está en
 * marcha primero, y dentro de eso lo más reciente arriba. `NULLS LAST` porque
 * un programa sin fecha puesta no puede colarse por delante de los que sí la
 * tienen.
 */
export async function catalogoAcademias(
  filtro: FiltroAcademias = {},
): Promise<AcademiaFila[]> {
  return consultar<AcademiaFila>(
    `SELECT a.id,
            a.nombre,
            a.tipo,
            a.descripcion,
            a.facilitador,
            a.estado,
            coalesce(a.participantes, 0)::int AS participantes,
            a.fecha_inicio::text AS fecha_inicio,
            a.fecha_fin::text AS fecha_fin,
            (SELECT count(*)::int FROM material m WHERE m.academia_id = a.id) AS materiales
       FROM academia a
      WHERE ${CONDICION_ACADEMIA}
      ORDER BY CASE a.estado
                 WHEN 'activa' THEN 0
                 WHEN 'planificada' THEN 1
                 ELSE 2
               END,
               a.fecha_inicio DESC NULLS LAST,
               a.nombre`,
    parametrosAcademia(filtro),
  );
}

export type ResumenAcademias = {
  total: number;
  activas: number;
  planificadas: number;
  participantes: number;
};

/**
 * Las cifras de cabecera, sobre el conjunto filtrado.
 *
 * `participantes` suma solo las academias ACTIVAS, por la misma razón que el
 * aporte mensual de patrocinadores suma solo los activos: los participantes de
 * un programa que terminó son su histórico, no gente a la que haya que dar
 * clase esta semana.
 */
export async function resumenAcademias(
  filtro: FiltroAcademias = {},
): Promise<ResumenAcademias> {
  const fila = await consultarUna<ResumenAcademias>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE a.estado = 'activa')::int AS activas,
            count(*) FILTER (WHERE a.estado = 'planificada')::int AS planificadas,
            coalesce(sum(a.participantes) FILTER (WHERE a.estado = 'activa'), 0)::int AS participantes
       FROM academia a
      WHERE ${CONDICION_ACADEMIA}`,
    parametrosAcademia(filtro),
  );

  return fila ?? { total: 0, activas: 0, planificadas: 0, participantes: 0 };
}

/**
 * Los programas para el selector de un material.
 *
 * Sin filtro y con TODOS los estados, incluidos los inactivos: un material que
 * se sube hoy puede pertenecer a la edición del año pasado, y esconder esos
 * programas obligaría a reactivarlos para poder archivar su guía.
 */
export async function academiasParaSelector(): Promise<
  { id: string; nombre: string; estado: string }[]
> {
  return consultar<{ id: string; nombre: string; estado: string }>(
    `SELECT id, nombre, estado FROM academia ORDER BY estado, nombre`,
  );
}

export type MaterialFila = {
  id: string;
  titulo: string;
  descripcion: string | null;
  academia_id: string;
  academia: string;
  tipo: string;
  autor: string | null;
  enlace_url: string | null;
  /** Clave dentro del bucket privado, cuando el material es un archivo. */
  storage_key: string | null;
  archivo_nombre: string | null;
  creado: string;
};

export type FiltroMateriales = {
  busqueda?: string | null;
  academiaId?: string | null;
  tipo?: string | null;
};

/**
 * Los materiales, con el nombre de su academia ya resuelto.
 *
 * `JOIN` y no `LEFT JOIN`: `material.academia_id` es NOT NULL con clave ajena,
 * así que un material sin programa no puede existir. Un `LEFT JOIN` aquí
 * sugeriría que sí y obligaría a tratar un caso imposible en la vista.
 *
 * `storage_key` sale de `documento` para poder firmar el enlace de descarga. Se
 * devuelve la CLAVE y no una URL: el bucket es privado y la URL hay que
 * firmarla al pintar, con caducidad corta.
 */
export async function materialesDeAcademias(
  filtro: FiltroMateriales = {},
): Promise<MaterialFila[]> {
  return consultar<MaterialFila>(
    `SELECT m.id,
            m.titulo,
            m.descripcion,
            m.academia_id,
            a.nombre AS academia,
            m.tipo,
            m.autor,
            m.enlace_url,
            d.storage_key,
            d.nombre AS archivo_nombre,
            m.created_at::text AS creado
       FROM material m
       JOIN academia a ON a.id = m.academia_id
       LEFT JOIN documento d ON d.id = m.documento_id
      WHERE ($1::text IS NULL
             OR m.titulo ILIKE '%' || $1 || '%'
             OR m.autor  ILIKE '%' || $1 || '%'
             OR a.nombre ILIKE '%' || $1 || '%')
        AND ($2::uuid IS NULL OR m.academia_id = $2::uuid)
        AND ($3::text IS NULL OR m.tipo = $3)
      ORDER BY a.nombre, m.created_at DESC
      LIMIT 300`,
    [
      filtro.busqueda?.trim() || null,
      filtro.academiaId || null,
      filtro.tipo || null,
    ],
  );
}

export type ResumenMateriales = {
  total: number;
  archivos: number;
  enlaces: number;
  academias: number;
};

/**
 * Cifras de la pantalla de materiales.
 *
 * `archivos` y `enlaces` se cuentan por lo que el material TIENE y no por su
 * columna `tipo`: el tipo es una etiqueta que elige quien lo sube —«vídeo»,
 * «presentación»— y lo que decide si hay algo que descargar es que exista el
 * documento. Contar por la etiqueta daría "3 archivos" con el bucket vacío.
 */
export async function resumenMateriales(
  filtro: FiltroMateriales = {},
): Promise<ResumenMateriales> {
  const fila = await consultarUna<ResumenMateriales>(
    `SELECT count(*)::int AS total,
            count(m.documento_id)::int AS archivos,
            count(m.enlace_url)::int AS enlaces,
            count(DISTINCT m.academia_id)::int AS academias
       FROM material m
       JOIN academia a ON a.id = m.academia_id
      WHERE ($1::text IS NULL
             OR m.titulo ILIKE '%' || $1 || '%'
             OR m.autor  ILIKE '%' || $1 || '%'
             OR a.nombre ILIKE '%' || $1 || '%')
        AND ($2::uuid IS NULL OR m.academia_id = $2::uuid)
        AND ($3::text IS NULL OR m.tipo = $3)`,
    [
      filtro.busqueda?.trim() || null,
      filtro.academiaId || null,
      filtro.tipo || null,
    ],
  );

  return fila ?? { total: 0, archivos: 0, enlaces: 0, academias: 0 };
}
