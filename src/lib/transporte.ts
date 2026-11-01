/**
 * Tipos y utilidades compartidas del Sistema de Transporte Institucional.
 * Fundación Global Effect (La Vega, RD).
 */

export type SentidoRuta = "horario" | "antihorario";

export type EstadoViaje =
  | "programado"
  | "en_curso"
  | "completado"
  | "averiado"
  | "cancelado";

export type TipoIncidenciaTransporte =
  | "averia_mecanica"
  | "transito_pesado"
  | "desvio_ruta"
  | "accidente"
  | "otro";

export type TransporteRuta = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  sentido: SentidoRuta;
  activo: boolean;
};

export type TransporteParada = {
  id: string;
  ruta_id: string;
  orden: number;
  nombre: string;
  referencia: string | null;
  lat: number;
  lng: number;
  minutos_estimados: number;
};

export type TransporteHorario = {
  id: string;
  codigo: string;
  nombre: string;
  hora_salida: string; // "HH:MM"
  hora_llegada_estimada: string; // "HH:MM"
  ruta_id: string;
  ruta_nombre?: string;
  orden: number;
  activo: boolean;
};

export type TransporteViaje = {
  id: string;
  horario_id: string;
  horario_nombre: string;
  hora_salida: string;
  chofer_id: string;
  chofer_nombre: string;
  fecha: string; // "YYYY-MM-DD"
  estado: EstadoViaje;
  lat_actual: number | null;
  lng_actual: number | null;
  rumbo: number;
  velocidad_kmh: number;
  parada_actual_id: string | null;
  parada_actual_nombre?: string | null;
  iniciado_en: string | null;
  finalizado_en: string | null;
  incidencias?: TransporteIncidencia[];
};

export type TransporteInscripcionRecurrente = {
  id: string;
  estudiante_id: string;
  horario_id: string;
  horario_codigo?: string;
  horario_nombre?: string;
  hora_salida?: string;
  dia_semana: number; // 1 = Lunes .. 6 = Sábado
  parada_abordaje_id: string;
  parada_abordaje_nombre?: string;
  parada_destino_id: string;
  parada_destino_nombre?: string;
  activo: boolean;
};

export type TransporteIncidencia = {
  id: string;
  viaje_id: string;
  chofer_id: string;
  chofer_nombre?: string;
  tipo: TipoIncidenciaTransporte;
  descripcion: string;
  lat: number | null;
  lng: number | null;
  creado_en: string;
};

export type ViaInscripcion = "publica" | "estudiante" | "asistida";

/** Una persona que el estudiante inscribió, para que pueda ver y quitar a sus invitados. */
export type InvitadoInscrito = {
  id: string;
  fecha: string;
  nombre: string;
  horario_nombre: string;
  hora_salida: string;
  parada_abordaje_nombre: string;
  parada_destino_nombre: string;
};

export type PasajeroViaje = {
  id: string;
  nombre: string;
  matricula_o_telefono: string | null;
  tipo: "recurrente" | "diaria";
  parada_abordaje_nombre: string;
  parada_destino_nombre: string;
  presente: boolean;
};

// Vive en `fecha-rd.ts` desde que lo usan también los cuatrimestres de 360.
export { SQL_HOY_RD } from "@/lib/fecha-rd";

/** Minutos desde medianoche en La Vega; el servidor puede estar en otra zona. */
export function minutosActualesRD(ahora: Date = new Date()): number {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Santo_Domingo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(ahora);
  const valor = (tipo: string) =>
    Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  return valor("hour") * 60 + valor("minute");
}

/** Fecha de hoy (YYYY-MM-DD) en La Vega, para validar lo que llega del cliente. */
export function fechaHoyRD(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
  }).format(ahora);
}

export const DIAS_SEMANA_TRANSPORTE = [
  { dia: 1, llave: "monday" },
  { dia: 2, llave: "tuesday" },
  { dia: 3, llave: "wednesday" },
  { dia: 4, llave: "thursday" },
  { dia: 5, llave: "friday" },
  { dia: 6, llave: "saturday" },
] as const;

