/**
 * Valores que admite un expediente, copiados de los tipos de la migración 0005.
 *
 * Viven aquí y no junto a las Server Actions porque un módulo `"use server"`
 * solo puede exportar funciones asíncronas, y estas listas las necesitan los
 * dos lados: el formulario para pintar los desplegables y el servidor para
 * volver a comprobar lo que llega.
 *
 * Ojo con `docs/prototipo-base44/prompt-formulario-expediente.md`: describe el formulario del prototipo, que era plano
 * y tenía cuatro estados. La base tiene ocho —los cuatro primeros son el
 * pipeline de reclutamiento— y las claves de `messages` ya están escritas para
 * los ocho. Manda la base.
 */

import {
  Ban,
  CheckCircle2,
  CircleSlash,
  GraduationCap,
  type LucideIcon,
  PauseCircle,
  Send,
  Sparkles,
  UserPlus,
} from "lucide-react";

/**
 * Un solo valor desde la 0047: el `regular` era el alumno de curso técnico y
 * los cursos ya no existen. Se mantiene como lista, y no como una constante
 * suelta, para que `TipoEstudiante` siga siendo el mismo tipo que el ENUM de la
 * base y el menú pueda seguir filtrando por él.
 */
export const TIPOS_ESTUDIANTE = ["becado"] as const;

/** Los cuatro primeros son el embudo de entrada; los otros cuatro, la vida académica. */
export const ESTADOS_ESTUDIANTE = [
  "reclutado",
  "postulado",
  "academia_liderazgo",
  "standby_tecnico",
  "activo",
  "inactivo",
  "graduado",
  "suspendido",
] as const;

export const GENEROS = ["masculino", "femenino", "otro"] as const;

/** `familiar.parentesco`. Los cinco primeros son los bloques fijos del formulario. */
export const PARENTESCOS = [
  "padre",
  "madre",
  "tutor",
  "madrastra",
  "padrastro",
  "hermano",
  "hermana",
  "otro",
] as const;

/**
 * Los cinco bloques fijos de familia; el resto de parentescos se añaden aparte.
 *
 * Vive aquí y no solo en el formulario porque la Server Action de guardado la
 * necesita igual: es la lista de qué filas de `familiar` borrar y volver a
 * escribir en cada edición, sin tocar un "hermano" u "otro" que hubiera
 * quedado de otra vía.
 */
export const FAMILIA_FIJA = PARENTESCOS.slice(0, 5);

export const CASA_PROPIA = ["si", "no", "alquilada", "prestada"] as const;

export const BANO = ["dentro", "fuera"] as const;

/**
 * `envio_correo_patrocinador`. Valor por defecto de la base: `pendiente`.
 *
 * Aquí hay una discrepancia sin resolver y conviene dejarla escrita: el
 * comentario de la columna en la migración 0005 dice "pendiente, enviado,
 * no_aplica", mientras que `docs/prototipo-base44/prompt-formulario-expediente.md` y las claves ya traducidas
 * (`records.followUp.*`) dicen sí / no / pendiente. La columna es TEXT sin
 * CHECK, así que nada de las dos está impuesto.
 *
 * Se sigue a la especificación y a las etiquetas, que son dos fuentes de acuerdo
 * frente a un comentario. Cuando llegue la escritura de S5 hay que decidirlo de
 * verdad y, si gana el comentario, añadir las dos etiquetas que faltan.
 */
export const ENVIO_CORREO = ["pendiente", "si", "no"] as const;

/** `asistio_reunion_mensual`. Coincide en las tres fuentes. */
export const ASISTIO_REUNION = ["si", "no", "justificado"] as const;

export type TipoEstudiante = (typeof TIPOS_ESTUDIANTE)[number];
export type EstadoEstudiante = (typeof ESTADOS_ESTUDIANTE)[number];

export function esEstadoEstudiante(valor: unknown): valor is EstadoEstudiante {
  return (
    typeof valor === "string" &&
    (ESTADOS_ESTUDIANTE as readonly string[]).includes(valor)
  );
}

/**
 * Cómo se ve cada estado: insignia, franja de la tarjeta e icono.
 *
 * Las tres señales van juntas en una sola entrada a propósito. Antes el color
 * vivía aquí y la franja lo reutilizaba por su cuenta; con el icono serían tres
 * sitios que hay que acordarse de mover a la vez cada vez que se toca un estado,
 * y basta olvidar uno para que la tarjeta diga una cosa y la insignia otra.
 *
 * El reparto de color sigue siendo por PESO —gris el embudo, que aún no es
 * firme; azul lo que ya cuenta— con las dos excepciones de `SEMAFORO`: `activo`
 * en verde y `suspendido` en rojo, que son los dos que tienen que saltar en una
 * lista de ocho. Ver el porqué en `src/lib/paleta.ts`.
 *
 * El icono no es decoración: es lo que separa `reclutado` de `inactivo`, que
 * comparten gris, y lo único que sobrevive en escala de grises o para quien no
 * distingue matices.
 *
 * `franja` va aparte de `insignia` porque la franja solo pinta fondo: necesita
 * un color sólido y visible aunque la insignia sea clara con texto oscuro.
 *
 * OJO: `icono` es un componente, y un componente no cruza de servidor a
 * cliente —React solo serializa objetos planos—. Una pantalla de servidor no
 * puede leer el icono de aquí y pasarlo por props a un componente `"use
 * client"`: lo que se pasa es `estado`, la cadena, y el cliente resuelve el
 * icono llamando a `visualDeEstado` por su cuenta.
 *
 * Clases literales para que Tailwind las compile.
 */
export const ESTADO_VISUAL: Record<
  string,
  { insignia: string; franja: string; icono: LucideIcon }
> = {
  reclutado: {
    insignia: "bg-slate-100 text-slate-600",
    franja: "bg-slate-300",
    icono: UserPlus,
  },
  postulado: {
    insignia: "bg-slate-200 text-slate-700",
    franja: "bg-slate-400",
    icono: Send,
  },
  academia_liderazgo: {
    insignia: "bg-[#2096BA]/15 text-[#187a99]",
    franja: "bg-[#5FB8D4]",
    icono: Sparkles,
  },
  standby_tecnico: {
    insignia: "bg-[#0a6a8a]/10 text-[#0a6a8a]",
    franja: "bg-[#2096BA]",
    icono: PauseCircle,
  },
  activo: {
    insignia: "bg-[#1E9E6A] text-white",
    franja: "bg-[#1E9E6A]",
    icono: CheckCircle2,
  },
  inactivo: {
    insignia: "bg-slate-100 text-slate-500",
    franja: "bg-slate-200",
    icono: CircleSlash,
  },
  graduado: {
    insignia: "bg-[#0a6a8a] text-white",
    franja: "bg-[#0a6a8a]",
    icono: GraduationCap,
  },
  suspendido: {
    insignia: "bg-[#B4342B] text-white",
    franja: "bg-[#B4342B]",
    icono: Ban,
  },
};

/** Un estado que no esté en el mapa no debe romper la pantalla. */
export function visualDeEstado(estado: string) {
  return ESTADO_VISUAL[estado] ?? ESTADO_VISUAL.inactivo;
}
