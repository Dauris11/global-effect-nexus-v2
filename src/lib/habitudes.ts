export type CategoriaHabitudes =
  | "diapositiva"
  | "guia_facilitador"
  | "infografia_didactica"
  | "dinamica_taller"
  | "evaluacion";

export type FormatoArchivo = "pptx" | "pdf" | "png" | "docx" | "jpg" | "xlsx";

export type TandaLiceo =
  | "matutina"
  | "vespertina"
  | "nocturna"
  | "jornada_extendida";

export type EstadoVisita = "borrador" | "completada" | "auditada";

export interface HabitudesLiceo {
  id: string;
  nombre: string;
  codigo: string | null;
  distrito_educativo: string;
  director_nombre: string | null;
  telefono: string | null;
  direccion: string | null;
  activo: boolean;
}

export interface HabitudesRecurso {
  id: string;
  titulo: string;
  descripcion: string | null;
  categoria: CategoriaHabitudes;
  formato: string;
  archivo_url: string;
  archivo_nombre: string;
  tamano_mb: number;
  subido_por_id: string | null;
  subido_por_nombre?: string | null;
  descargas_conteo: number;
  creado_en: string;
}

export interface HabitudesVisitaEvidencia {
  id: string;
  liceo_id: string;
  liceo_nombre: string;
  liceo_codigo: string | null;
  distrito_educativo: string;
  facilitador_id: string;
  facilitador_nombre: string;
  fecha_visita: string;
  tema_impartido: string;
  tanda: TandaLiceo;
  estudiantes_impactados: number;
  observaciones: string | null;
  fotos_urls: string[];
  estado: EstadoVisita;
  creado_en: string;
}

export interface MetricasHabitudes {
  total_visitas: number;
  estudiantes_impactados: number;
  liceos_alcanzados: number;
  recursos_disponibles: number;
}
