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
  municipio?: string | null;
  distrito_municipal?: string | null;
  sector?: string | null;
  calle?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  profesoresAsignados?: Array<{
    profesorId: string;
    profesorNombre: string;
    tanda: TandaLiceo;
  }>;
  totalEstudiantes?: number;
  /** Fecha (YYYY-MM-DD) de la última visita no borrador; la usa el popup del mapa. */
  ultimaVisita?: string | null;
  totalVisitas?: number;
}

export interface HabitudesLiceoProfesor {
  id: string;
  liceoId: string;
  liceoNombre: string;
  profesorId: string;
  profesorNombre: string;
  profesorEmail: string;
  tanda: TandaLiceo;
  materiaTaller: string;
  activo: boolean;
  asignadoEn: string;
}

export interface HabitudesLiceoEstudiante {
  id: string;
  liceoId: string;
  liceoNombre: string;
  estudianteId: string;
  estudianteNombre: string;
  estudianteMatricula?: string | null;
  grado?: string | null;
  seccion?: string | null;
  activo: boolean;
  registradoEn: string;
}

export interface ProfesorMonitoreoItem {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  liceosAsignados: Array<{
    liceoId: string;
    liceoNombre: string;
    tanda: TandaLiceo;
    municipio: string;
  }>;
  totalEvidencias: number;
  estudiantesImpactados: number;
  ultimaVisita?: string | null;
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
  latitud?: number | null;
  longitud?: number | null;
}

export interface MetricasHabitudes {
  total_visitas: number;
  estudiantes_impactados: number;
  liceos_alcanzados: number;
  recursos_disponibles: number;
}
