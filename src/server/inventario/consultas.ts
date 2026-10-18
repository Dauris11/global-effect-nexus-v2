import { consultar, consultarUna } from "@/lib/db";
import type {
  ActivoInventario,
  CategoriaActivo,
  EstadoActivo,
  HistorialActivo,
  MetricasInventario,
} from "@/lib/inventario";

interface FilaActivo {
  id: string;
  codigo: string;
  nombre: string;
  categoria: CategoriaActivo;
  ubicacion: string;
  estado: EstadoActivo;
  foto_url: string | null;
  codigo_qr: string;
  responsable_id: string | null;
  responsable_nombre: string | null;
  responsable_email: string | null;
  valor_estimado: string | number | null;
  numero_serie: string | null;
  marca_modelo: string | null;
  notas: string | null;
  creado_por: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapearActivo(fila: FilaActivo): ActivoInventario {
  return {
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    categoria: fila.categoria,
    ubicacion: fila.ubicacion,
    estado: fila.estado,
    fotoUrl: fila.foto_url,
    codigoQr: fila.codigo_qr,
    responsableId: fila.responsable_id,
    responsableNombre: fila.responsable_nombre,
    responsableEmail: fila.responsable_email,
    valorEstimado: fila.valor_estimado !== null ? Number(fila.valor_estimado) : null,
    numeroSerie: fila.numero_serie,
    marcaModelo: fila.marca_modelo,
    notas: fila.notas,
    creadoPor: fila.creado_por,
    createdAt: fila.created_at.toISOString(),
    updatedAt: fila.updated_at.toISOString(),
  };
}

/**
 * Lista los activos de la fundación con filtros opcionales de búsqueda,
 * categoría, estado y ubicación física.
 */
export async function listarActivos(filtros?: {
  busqueda?: string;
  categoria?: string;
  estado?: string;
  ubicacion?: string;
}): Promise<ActivoInventario[]> {
  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros?.busqueda) {
    valores.push(`%${filtros.busqueda.trim()}%`);
    const pos = valores.length;
    condiciones.push(
      `(a.codigo ILIKE $${pos} OR a.nombre ILIKE $${pos} OR a.numero_serie ILIKE $${pos} OR a.marca_modelo ILIKE $${pos} OR a.ubicacion ILIKE $${pos})`
    );
  }

  if (filtros?.categoria && filtros.categoria !== "todas") {
    valores.push(filtros.categoria);
    condiciones.push(`a.categoria = $${valores.length}`);
  }

  if (filtros?.estado && filtros.estado !== "todos") {
    valores.push(filtros.estado);
    condiciones.push(`a.estado = $${valores.length}`);
  }

  if (filtros?.ubicacion && filtros.ubicacion !== "todas") {
    valores.push(filtros.ubicacion);
    condiciones.push(`a.ubicacion = $${valores.length}`);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const filas = await consultar<FilaActivo>(
    `SELECT a.id, a.codigo, a.nombre, a.categoria, a.ubicacion, a.estado,
            a.foto_url, a.codigo_qr, a.responsable_id, u.nombre AS responsable_nombre,
            u.email AS responsable_email, a.valor_estimado, a.numero_serie,
            a.marca_modelo, a.notas, a.creado_por, a.created_at, a.updated_at
       FROM public.inventario_activo a
       LEFT JOIN public.usuario u ON u.id = a.responsable_id
       ${where}
      ORDER BY a.codigo ASC`,
    valores
  );

  return filas.map(mapearActivo);
}

/**
 * Obtiene un activo por su ID único.
 */
export async function obtenerActivoPorId(id: string): Promise<ActivoInventario | null> {
  const fila = await consultarUna<FilaActivo>(
    `SELECT a.id, a.codigo, a.nombre, a.categoria, a.ubicacion, a.estado,
            a.foto_url, a.codigo_qr, a.responsable_id, u.nombre AS responsable_nombre,
            u.email AS responsable_email, a.valor_estimado, a.numero_serie,
            a.marca_modelo, a.notas, a.creado_por, a.created_at, a.updated_at
       FROM public.inventario_activo a
       LEFT JOIN public.usuario u ON u.id = a.responsable_id
      WHERE a.id = $1`,
    [id]
  );

  return fila ? mapearActivo(fila) : null;
}

/**
 * Obtiene un activo por su código alfanumérico visible o escaneado (ej: 'ACT-0001').
 */
export async function obtenerActivoPorCodigo(codigo: string): Promise<ActivoInventario | null> {
  const fila = await consultarUna<FilaActivo>(
    `SELECT a.id, a.codigo, a.nombre, a.categoria, a.ubicacion, a.estado,
            a.foto_url, a.codigo_qr, a.responsable_id, u.nombre AS responsable_nombre,
            u.email AS responsable_email, a.valor_estimado, a.numero_serie,
            a.marca_modelo, a.notas, a.creado_por, a.created_at, a.updated_at
       FROM public.inventario_activo a
       LEFT JOIN public.usuario u ON u.id = a.responsable_id
      WHERE a.codigo = $1 OR a.id::text = $1`,
    [codigo.trim()]
  );

  return fila ? mapearActivo(fila) : null;
}

/**
 * Métricas globales del patrimonio físico para el panel y dashboard.
 */
export async function obtenerMetricasInventario(): Promise<MetricasInventario> {
  const [metricasGlobales, categorias] = await Promise.all([
    consultarUna<{
      total: string;
      operativos: string;
      mantenimiento: string;
      prestado: string;
      baja: string;
      valor_total: string;
    }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE estado = 'operativo')::text AS operativos,
              COUNT(*) FILTER (WHERE estado = 'mantenimiento')::text AS mantenimiento,
              COUNT(*) FILTER (WHERE estado = 'prestado')::text AS prestado,
              COUNT(*) FILTER (WHERE estado = 'baja')::text AS baja,
              COALESCE(SUM(valor_estimado), 0)::text AS valor_total
         FROM public.inventario_activo`
    ),
    consultar<{ categoria: string; cantidad: string }>(
      `SELECT categoria, COUNT(*)::text AS cantidad
         FROM public.inventario_activo
        GROUP BY categoria
        ORDER BY cantidad DESC`
    ),
  ]);

  return {
    totalActivos: Number(metricasGlobales?.total ?? 0),
    operativos: Number(metricasGlobales?.operativos ?? 0),
    enMantenimiento: Number(metricasGlobales?.mantenimiento ?? 0),
    enPrestamo: Number(metricasGlobales?.prestado ?? 0),
    deBaja: Number(metricasGlobales?.baja ?? 0),
    valorTotalEstimado: Number(metricasGlobales?.valor_total ?? 0),
    porCategoria: categorias.map((c) => ({
      categoria: c.categoria,
      cantidad: Number(c.cantidad),
    })),
  };
}

interface FilaHistorial {
  id: string;
  activo_id: string;
  usuario_id: string | null;
  usuario_nombre: string | null;
  accion: HistorialActivo["accion"];
  ubicacion_anterior: string | null;
  ubicacion_nueva: string | null;
  responsable_anterior_nombre: string | null;
  responsable_nuevo_nombre: string | null;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  notas: string | null;
  created_at: Date;
}

/**
 * Obtiene la bitácora de trazabilidad y movimientos de un activo.
 */
export async function obtenerHistorialActivo(activoId: string): Promise<HistorialActivo[]> {
  const filas = await consultar<FilaHistorial>(
    `SELECT h.id, h.activo_id, h.usuario_id, u.nombre AS usuario_nombre,
            h.accion, h.ubicacion_anterior, h.ubicacion_nueva,
            u_ant.nombre AS responsable_anterior_nombre,
            u_nue.nombre AS responsable_nuevo_nombre,
            h.estado_anterior, h.estado_nuevo, h.notas, h.created_at
       FROM public.inventario_historial h
       LEFT JOIN public.usuario u ON u.id = h.usuario_id
       LEFT JOIN public.usuario u_ant ON u_ant.id = h.responsable_anterior_id
       LEFT JOIN public.usuario u_nue ON u_nue.id = h.responsable_nuevo_id
      WHERE h.activo_id = $1
      ORDER BY h.created_at DESC`,
    [activoId]
  );

  return filas.map((f) => ({
    id: f.id,
    activoId: f.activo_id,
    usuarioId: f.usuario_id,
    usuarioNombre: f.usuario_nombre,
    accion: f.accion,
    ubicacionAnterior: f.ubicacion_anterior,
    ubicacionNueva: f.ubicacion_nueva,
    responsableAnteriorNombre: f.responsable_anterior_nombre,
    responsableNuevoNombre: f.responsable_nuevo_nombre,
    estadoAnterior: f.estado_anterior,
    estadoNuevo: f.estado_nuevo,
    notas: f.notas,
    createdAt: f.created_at.toISOString(),
  }));
}

/**
 * Lista las ubicaciones físicas únicas registradas en el sistema.
 */
export async function listarUbicacionesUnicas(): Promise<string[]> {
  const filas = await consultar<{ ubicacion: string }>(
    `SELECT DISTINCT ubicacion FROM public.inventario_activo WHERE ubicacion IS NOT NULL ORDER BY ubicacion ASC`
  );
  return filas.map((f) => f.ubicacion);
}
