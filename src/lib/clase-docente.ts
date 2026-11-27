import type { MarcaDeAsistencia, OrigenClase } from "@/lib/clases";

/**
 * Tipos de la pantalla de clase del docente que cruzan de servidor a cliente.
 * Viven en `lib` porque los usan componentes cliente, que de `server/**` solo
 * importan tipos y aquí no hay nada que arrastrar del driver.
 */

export type EstudianteDeClase = {
  inscripcionId: string;
  nombre: string;
  estado: string;
  periodo: string | null;
  entregadas: number;
  tareas: number;
  /** Nota final ya puesta, si la hay. */
  nota: number | null;
  /** Nota que sugiere el promedio ponderado de las tareas (el docente decide). */
  propuesta: number | null;
  asistencia: number | null;
};

export type PublicacionDeClase = {
  id: string;
  titulo: string;
  tipo: "tarea" | "examen" | "material" | "anuncio";
  /** `YYYY-MM-DD HH:mm` en hora de La Vega, o `null`. */
  vence: string | null;
  puntaje: number;
  entregas: number;
  sinCalificar: number;
  /** Enlace ya firmado (o http) del archivo del docente. */
  enlace: string | null;
};

export type SesionDeClase = {
  id: string;
  fecha: string;
  presentes: number;
  tardes: number;
  ausentes: number;
  total: number;
};

export type RosterAsistencia = {
  inscripcionId: string;
  nombre: string;
  marcaHoy: MarcaDeAsistencia | null;
};

export type DatosDeClase = {
  origen: OrigenClase;
  id: string;
  periodoId: string | null;
  nombre: string;
  estudiantes: EstudianteDeClase[];
  publicaciones: PublicacionDeClase[];
  sesiones: SesionDeClase[];
  roster: RosterAsistencia[];
  /** Hoy ya tiene sesión: el botón dice «Corregir» y no «Pasar». */
  hoyYaPasada: boolean;
};
