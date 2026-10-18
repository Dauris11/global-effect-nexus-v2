import { consultar, consultarUna } from "@/lib/db";
import type {
  HabitudesLiceo,
  HabitudesRecurso,
  HabitudesVisitaEvidencia,
  MetricasHabitudes,
  ProfesorMonitoreoItem,
} from "@/lib/habitudes";

/**
 * Métricas generales de impacto del Programa Habitudes.
 */
export async function metricasHabitudes(): Promise<MetricasHabitudes> {
  const query = `
    SELECT
      (SELECT count(*)::int FROM public.habitudes_visita_evidencia WHERE estado <> 'borrador') AS total_visitas,
      (SELECT coalesce(sum(estudiantes_impactados), 0)::int FROM public.habitudes_visita_evidencia WHERE estado <> 'borrador') AS estudiantes_impactados,
      (SELECT count(DISTINCT liceo_id)::int FROM public.habitudes_visita_evidencia WHERE estado <> 'borrador') AS liceos_alcanzados,
      (SELECT count(*)::int FROM public.habitudes_recurso WHERE activo = true) AS recursos_disponibles
  `;

  const fila = await consultarUna<MetricasHabitudes>(query, []);
  return (
    fila ?? {
      total_visitas: 0,
      estudiantes_impactados: 0,
      liceos_alcanzados: 0,
      recursos_disponibles: 0,
    }
  );
}

/**
 * Catálogo de liceos de La Vega con geolocalización y profesores asignados.
 */
export async function listarLiceosHabitudes(): Promise<HabitudesLiceo[]> {
  const liceosRows = await consultar<{
    id: string;
    nombre: string;
    codigo: string | null;
    distrito_educativo: string;
    director_nombre: string | null;
    telefono: string | null;
    direccion: string | null;
    activo: boolean;
    municipio: string | null;
    distrito_municipal: string | null;
    sector: string | null;
    calle: string | null;
    latitud: number | null;
    longitud: number | null;
    total_estudiantes: number;
  }>(
    `SELECT l.id,
            l.nombre,
            l.codigo,
            l.distrito_educativo,
            l.director_nombre,
            l.telefono,
            l.direccion,
            l.activo,
            l.municipio,
            l.distrito_municipal,
            l.sector,
            l.calle,
            l.latitud::float AS latitud,
            l.longitud::float AS longitud,
            (SELECT count(*)::int FROM public.habitudes_liceo_estudiante le WHERE le.liceo_id = l.id AND le.activo = true) AS total_estudiantes
       FROM public.habitudes_liceo l
      WHERE l.activo = true
      ORDER BY l.municipio ASC, l.nombre ASC`,
    [],
  );

  // Obtener profesores asignados a cada liceo
  const asignacionesRows = await consultar<{
    liceo_id: string;
    profesor_id: string;
    profesor_nombre: string;
    tanda: string;
  }>(
    `SELECT lp.liceo_id,
            lp.profesor_id,
            u.nombre AS profesor_nombre,
            lp.tanda
       FROM public.habitudes_liceo_profesor lp
       JOIN public.usuario u ON u.id = lp.profesor_id
      WHERE lp.activo = true
      ORDER BY u.nombre ASC`,
    [],
  );

  const mapaProfesores = new Map<string, Array<{ profesorId: string; profesorNombre: string; tanda: any }>>();
  for (const asig of asignacionesRows) {
    const arr = mapaProfesores.get(asig.liceo_id) ?? [];
    arr.push({
      profesorId: asig.profesor_id,
      profesorNombre: asig.profesor_nombre,
      tanda: asig.tanda as any,
    });
    mapaProfesores.set(asig.liceo_id, arr);
  }

  return liceosRows.map((l) => ({
    id: l.id,
    nombre: l.nombre,
    codigo: l.codigo,
    distrito_educativo: l.distrito_educativo,
    director_nombre: l.director_nombre,
    telefono: l.telefono,
    direccion: l.direccion,
    activo: l.activo,
    municipio: l.municipio,
    distrito_municipal: l.distrito_municipal,
    sector: l.sector,
    calle: l.calle,
    latitud: l.latitud,
    longitud: l.longitud,
    profesoresAsignados: mapaProfesores.get(l.id) ?? [],
    totalEstudiantes: l.total_estudiantes,
  }));
}

/**
 * Panel de Monitoreo de Profesores para el Director de Habitudes (DH).
 * Inspecciona cada facilitador, dónde da clases en La Vega, evidencias y estudiantes alcanzados.
 */
export async function monitoreoProfesoresHabitudes(): Promise<ProfesorMonitoreoItem[]> {
  const profesoresRows = await consultar<{
    id: string;
    nombre: string;
    email: string;
    rol: string;
    total_evidencias: number;
    estudiantes_impactados: number;
    ultima_visita: string | null;
  }>(
    `SELECT u.id,
            u.nombre,
            u.email,
            r.nombre AS rol,
            (SELECT count(*)::int FROM public.habitudes_visita_evidencia v WHERE v.facilitador_id = u.id AND v.estado <> 'borrador') AS total_evidencias,
            (SELECT coalesce(sum(estudiantes_impactados), 0)::int FROM public.habitudes_visita_evidencia v WHERE v.facilitador_id = u.id AND v.estado <> 'borrador') AS estudiantes_impactados,
            (SELECT max(v.fecha_visita)::text FROM public.habitudes_visita_evidencia v WHERE v.facilitador_id = u.id) AS ultima_visita
       FROM public.usuario u
       JOIN public.rol r ON r.id = u.rol_id
      WHERE r.nombre IN ('habitudes', 'docente', 'dir_habitudes')
        AND u.activo = true
      ORDER BY u.nombre ASC`,
    [],
  );

  const asignacionesRows = await consultar<{
    profesor_id: string;
    liceo_id: string;
    liceo_nombre: string;
    tanda: string;
    municipio: string;
  }>(
    `SELECT lp.profesor_id,
            lp.liceo_id,
            l.nombre AS liceo_nombre,
            lp.tanda,
            coalesce(l.municipio, 'Concepción de La Vega') AS municipio
       FROM public.habitudes_liceo_profesor lp
       JOIN public.habitudes_liceo l ON l.id = lp.liceo_id
      WHERE lp.activo = true`,
    [],
  );

  const mapaLiceos = new Map<string, Array<{ liceoId: string; liceoNombre: string; tanda: any; municipio: string }>>();
  for (const asig of asignacionesRows) {
    const arr = mapaLiceos.get(asig.profesor_id) ?? [];
    arr.push({
      liceoId: asig.liceo_id,
      liceoNombre: asig.liceo_nombre,
      tanda: asig.tanda as any,
      municipio: asig.municipio,
    });
    mapaLiceos.set(asig.profesor_id, arr);
  }

  return profesoresRows.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    email: p.email,
    rol: p.rol,
    liceosAsignados: mapaLiceos.get(p.id) ?? [],
    totalEvidencias: p.total_evidencias,
    estudiantesImpactados: p.estudiantes_impactados,
    ultimaVisita: p.ultima_visita,
  }));
}

/**
 * Recursos pedagógicos compartidos (diapositivas, guías, dinámicas).
 */
export async function listarRecursosHabitudes(
  categoria?: string,
): Promise<HabitudesRecurso[]> {
  const params: unknown[] = [];
  let where = "WHERE r.activo = true";

  if (categoria && categoria !== "todas") {
    params.push(categoria);
    where += ` AND r.categoria = $${params.length}`;
  }

  const query = `
    SELECT r.id,
           r.titulo,
           r.descripcion,
           r.categoria,
           r.formato,
           r.archivo_url,
           r.archivo_nombre,
           r.tamano_mb::float AS tamano_mb,
           r.subido_por_id,
           u.nombre AS subido_por_nombre,
           r.descargas_conteo,
           r.creado_en::text AS creado_en
      FROM public.habitudes_recurso r
      LEFT JOIN public.usuario u ON u.id = r.subido_por_id
     ${where}
     ORDER BY r.creado_en DESC
  `;

  return consultar<HabitudesRecurso>(query, params);
}

/**
 * Visitas de campo a liceos con registro fotográfico de evidencias.
 */
export async function listarVisitasEvidenciasHabitudes(
  liceoId?: string,
): Promise<HabitudesVisitaEvidencia[]> {
  const params: unknown[] = [];
  let where = "WHERE 1=1";

  if (liceoId && liceoId !== "todos") {
    params.push(liceoId);
    where += ` AND v.liceo_id = $${params.length}`;
  }

  const query = `
    SELECT v.id,
           v.liceo_id,
           l.nombre AS liceo_nombre,
           l.codigo AS liceo_codigo,
           l.distrito_educativo,
           v.facilitador_id,
           u.nombre AS facilitador_nombre,
           v.fecha_visita::text AS fecha_visita,
           v.tema_impartido,
           v.tanda,
           v.estudiantes_impactados,
           v.observaciones,
           v.fotos_urls,
           v.estado,
           v.creado_en::text AS creado_en
      FROM public.habitudes_visita_evidencia v
      JOIN public.habitudes_liceo l ON l.id = v.liceo_id
      JOIN public.usuario u ON u.id = v.facilitador_id
     ${where}
     ORDER BY v.fecha_visita DESC, v.creado_en DESC
  `;

  return consultar<HabitudesVisitaEvidencia>(query, params);
}

/**
 * Obtiene facilitadores y estudiantes activos para asignación a liceos de La Vega.
 */
export async function listarDocentesYEstudiantesParaAsignacion(): Promise<{
  docentes: Array<{ id: string; nombre: string; email: string }>;
  estudiantes: Array<{ id: string; nombre: string; matricula: string | null }>;
}> {
  const docentes = await consultar<{ id: string; nombre: string; email: string }>(
    `SELECT u.id, u.nombre, u.email
       FROM public.usuario u
       JOIN public.rol r ON r.id = u.rol_id
      WHERE r.nombre IN ('habitudes', 'docente', 'dir_habitudes') AND u.activo = true
      ORDER BY u.nombre ASC`,
    [],
  );

  const estudiantes = await consultar<{ id: string; nombre: string; matricula: string | null }>(
    `SELECT id, nombre, matricula
       FROM public.estudiante
      WHERE estado = 'activo'
      ORDER BY nombre ASC
      LIMIT 200`,
    [],
  );

  return { docentes, estudiantes };
}
