/**
 * Utilidades puras de «Mis clases» y «Tareas» del estudiante (sin `pg`, para que
 * las usen tanto el servidor como los componentes cliente).
 *
 * Una «clase» es una materia de la carrera o una de Global Effect 360: son
 * tablas distintas y dos clases pueden llamarse igual, así que la identidad es
 * el par origen + id, nunca el nombre.
 */

export type OrigenClase = "g360" | "universidad";

const PREFIJO: Record<OrigenClase, string> = { g360: "g", universidad: "u" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Segmento de URL de una clase: `u-<uuid>` (carrera) o `g-<uuid>` (360). */
export function claveDeClase(origen: OrigenClase, id: string): string {
  return `${PREFIJO[origen]}-${id}`;
}

export function leerClaveDeClase(
  clave: string,
): { origen: OrigenClase; id: string } | null {
  const origen = clave.startsWith("g-") ? "g360" : clave.startsWith("u-") ? "universidad" : null;
  const id = clave.slice(2);

  return origen && UUID.test(id) ? { origen, id } : null;
}

/** Estado de una tarea para el estudiante, en el orden en que se le muestra. */
export type GrupoTarea = "vencidas" | "semana" | "proximas" | "entregadas";

export const GRUPOS_TAREA: readonly GrupoTarea[] = [
  "vencidas",
  "semana",
  "proximas",
  "entregadas",
];

/** Lo mínimo que hace falta de una asignación para agruparla. */
export type TareaAgrupable = {
  estado_entrega: "pendiente" | "entregado" | "calificado" | "tarde" | null;
  vencida: boolean;
  fecha_vencimiento: Date | null;
};

export const estaEntregada = (fila: Pick<TareaAgrupable, "estado_entrega">) =>
  fila.estado_entrega === "entregado" ||
  fila.estado_entrega === "tarde" ||
  fila.estado_entrega === "calificado";

/** Suma días a una clave `YYYY-MM-DD` sin pasar por la zona del proceso. */
function sumarDias(clave: string, dias: number): string {
  const [a, m, d] = clave.split("-").map(Number);

  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Domingo de la semana (lunes a domingo) a la que pertenece la clave. */
export function finDeSemana(clave: string): string {
  const [a, m, d] = clave.split("-").map(Number);
  const diaSemana = new Date(Date.UTC(a, m - 1, d)).getUTCDay(); // 0 = domingo

  return sumarDias(clave, diaSemana === 0 ? 0 : 7 - diaSemana);
}

/** Lunes de la semana a la que pertenece la clave. */
export function inicioDeSemana(clave: string): string {
  return sumarDias(finDeSemana(clave), -6);
}

/**
 * En qué grupo cae una tarea. `hoy` y `diaDeVencimiento` son claves en hora de la
 * Fundación (`diaEnRD`): comparar instantes UTC movería la tarea de las 8 p. m.
 * al día siguiente.
 */
export function grupoDeTarea(
  fila: TareaAgrupable,
  hoy: string,
  diaDeVencimiento: string | null,
): GrupoTarea {
  if (estaEntregada(fila)) return "entregadas";
  if (fila.vencida) return "vencidas";
  if (diaDeVencimiento && diaDeVencimiento <= finDeSemana(hoy)) return "semana";

  return "proximas";
}

/**
 * Urgencia de «lo próximo a entregar», con los estados que ya existen en
 * `status-map.ts`: vencida (rojo), esta semana (ámbar) y el resto sin alarma.
 */
export function estadoDeUrgencia(
  grupo: GrupoTarea,
): "vencida" | "pendiente" | "programada" | "entregado" {
  if (grupo === "vencidas") return "vencida";
  if (grupo === "semana") return "pendiente";
  if (grupo === "entregadas") return "entregado";

  return "programada";
}

/**
 * Una tarea, material o anuncio ya lista para pintar: fechas como texto, enlaces
 * ya firmados y el grupo decidido. Es lo que cruza de servidor a cliente (sin
 * `Date`, sin tipos de `pg`) para que el panel de entrega no dependa de la consulta.
 */
export type TareaVista = {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: "tarea" | "examen" | "material" | "anuncio";
  materia: string;
  origen: OrigenClase;
  claveClase: string;
  /** Instante de vencimiento (ISO) y su texto ya en hora de la Fundación. */
  vence: string | null;
  venceTexto: string | null;
  /** Día `YYYY-MM-DD` de publicación, en hora de la Fundación (para agrupar por semana). */
  publicadaDia: string;
  estado: "pendiente" | "entregado" | "calificado" | "tarde";
  vencida: boolean;
  grupo: GrupoTarea;
  calificacion: number | null;
  puntaje: number;
  comentarioProfesor: string | null;
  instrucciones: string | null;
  limiteMb: number;
  formatos: string[];
  tardiasPermitidas: boolean;
  /** Archivo del docente (material o enunciado), ya firmado si estaba en el bucket. */
  archivoUrl: string | null;
  entrega: {
    nombre: string | null;
    url: string | null;
    texto: string | null;
    comentario: string | null;
  } | null;
};

/** `jue 28 nov · 18:00`: el día y la hora de la Fundación, nunca los del servidor. */
export function textoDeVencimiento(valor: Date, idioma: "es" | "en"): string {
  const zona = "America/Santo_Domingo";
  const dia = new Intl.DateTimeFormat(idioma, {
    timeZone: zona,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(valor);
  const hora = new Intl.DateTimeFormat(idioma, {
    timeZone: zona,
    hour: "numeric",
    minute: "2-digit",
  }).format(valor);

  return `${dia.replace(/\./g, "")} · ${hora}`;
}

/** `24 – 30 nov`: el rango de una semana (lunes a domingo) a partir de sus claves. */
export function rangoDeSemana(inicio: string, fin: string, idioma: "es" | "en"): string {
  const aFecha = (clave: string) => {
    const [a, m, d] = clave.split("-").map(Number);

    return new Date(Date.UTC(a, m - 1, d));
  };
  const dia = new Intl.DateTimeFormat(idioma, { timeZone: "UTC", day: "numeric" });
  const diaMes = new Intl.DateTimeFormat(idioma, { timeZone: "UTC", day: "numeric", month: "short" });

  return `${dia.format(aFecha(inicio))} – ${diaMes.format(aFecha(fin)).replace(/\./g, "")}`;
}

/**
 * `27 nov` y `6:00 p. m.` de una fecha-hora ya escrita en hora de La Vega
 * (`YYYY-MM-DD HH:mm`, como la devuelve `ventanaVigente`). Se arma con `Date.UTC` y
 * se imprime en UTC a propósito: pasarla por `new Date("…")` la leería en la zona
 * del servidor y correría la hora.
 */
export function textoDeFechaLocal(
  local: string,
  idioma: "es" | "en",
): { fecha: string; hora: string } {
  const [dia, hora = "00:00"] = local.split(" ");
  const [a, m, d] = dia.split("-").map(Number);
  const [h, min] = hora.split(":").map(Number);
  const instante = new Date(Date.UTC(a, m - 1, d, h, min));

  return {
    fecha: new Intl.DateTimeFormat(idioma, { timeZone: "UTC", day: "numeric", month: "short" })
      .format(instante)
      .replace(/\./g, ""),
    hora: new Intl.DateTimeFormat(idioma, { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(instante),
  };
}

/** Lo que el docente marca por estudiante al pasar asistencia. */
export type MarcaDeAsistencia = "presente" | "ausente" | "tarde";
