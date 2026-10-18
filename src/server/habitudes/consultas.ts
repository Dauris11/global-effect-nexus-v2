import { consultar, consultarUna } from "@/lib/db";
import type {
  HabitudesLiceo,
  HabitudesRecurso,
  HabitudesVisitaEvidencia,
  MetricasHabitudes,
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
 * Catálogo de liceos y centros de secundaria de La Vega.
 */
export async function listarLiceosHabitudes(): Promise<HabitudesLiceo[]> {
  return consultar<HabitudesLiceo>(
    `SELECT id,
            nombre,
            codigo,
            distrito_educativo,
            director_nombre,
            telefono,
            direccion,
            activo
       FROM public.habitudes_liceo
      WHERE activo = true
      ORDER BY nombre ASC`,
    [],
  );
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
