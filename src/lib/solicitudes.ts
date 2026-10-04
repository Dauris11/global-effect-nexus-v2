/**
 * Vocabulario y reglas del flujo de solicitudes (migración 0031).
 *
 * Vive en `src/lib` por la misma razón que `operaciones.ts`: los formularios y
 * la bandeja son componentes cliente y necesitan estas listas, y un valor
 * importado de un archivo de consultas arrastraría `pg` al navegador. Las
 * Server Actions las vuelven a usar para comprobar lo que llega, así que el
 * botón que se pinta y la puerta que el servidor abre salen de la MISMA regla.
 *
 * Lo que este archivo decide —quién crea, quién revisa, qué paso sigue a cuál—
 * no está en la base. La 0031 solo impone la forma (tipos, estados, que una
 * beca lleve estudiante); el flujo es lógica de aplicación, igual que el resto
 * de la autorización del sistema (ver la nota de la 0014).
 */

import {
  Ban,
  CheckCircle2,
  CircleDot,
  Eye,
  type LucideIcon,
  PackageCheck,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import type { Permiso, Rol } from "@/lib/rbac";
import { tienePermiso } from "@/lib/rbac";

/** Lo que pide el estudiante desde su portal. */
export const TRAMITES_ESTUDIANTE = [
  "constancia",
  "carta",
  "cita_administracion",
  "permiso",
  "otro",
] as const;

/** Lo que pide el personal para que otro lo autorice. */
export const APROBACIONES_INTERNAS = ["alta_expediente", "beca", "gasto"] as const;

export const TIPOS_SOLICITUD = [
  ...TRAMITES_ESTUDIANTE,
  ...APROBACIONES_INTERNAS,
] as const;

export type TipoSolicitud = (typeof TIPOS_SOLICITUD)[number];
export type TramiteEstudiante = (typeof TRAMITES_ESTUDIANTE)[number];
export type AprobacionInterna = (typeof APROBACIONES_INTERNAS)[number];

export const ESTADOS_SOLICITUD = [
  "enviada",
  "en_revision",
  "pendiente_direccion",
  "aprobada",
  "rechazada",
  "completada",
  "cancelada",
] as const;

export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

/** Las que todavía esperan algo de alguien. */
export const ESTADOS_ABIERTOS: readonly EstadoSolicitud[] = [
  "enviada",
  "en_revision",
  "pendiente_direccion",
  "aprobada",
];

/**
 * A partir de qué gasto hace falta el visto bueno de dirección, en USD.
 *
 * Se aplica AL CREAR y se guarda en `solicitud.requiere_direccion`: cambiar
 * este número no altera las solicitudes que ya van por el flujo.
 */
export const UMBRAL_DIRECCION_USD = 1000;

/** Horas que se ofrecen para la cita con administración. Son una preferencia. */
export const HORAS_CITA = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "14:00",
  "15:00",
  "16:00",
] as const;

/** Mismos topes que los CHECK de la 0031, para que el navegador avise antes. */
export const MAXIMO_TITULO = 160;
export const MAXIMO_TEXTO = 2000;

type ReglaTipo = {
  /** Basta con uno de estos permisos para crearla. Vacío: solo el estudiante. */
  crea: readonly Permiso[];
  /** El permiso del primer nivel: tomarla, aprobarla, rechazarla, completarla. */
  revisa: Permiso;
  /** Si lleva un estudiante y si es obligatorio. */
  estudiante: "no" | "opcional" | "obligatorio";
  monto: "no" | "opcional" | "obligatorio";
  /** Si pide fecha (y hora, en la cita). */
  fecha: "no" | "opcional" | "obligatorio";
  /** Si necesita el segundo nivel de dirección, en función del monto. */
  direccion: (monto: number | null) => boolean;
};

const NUNCA = () => false;

/**
 * Las reglas de cada tipo.
 *
 * El gasto lo revisa contabilidad y no administración: es quien sabe si hay
 * partida y quien lo asentará después. La beca va siempre a dirección porque
 * compromete dinero de un patrocinador durante meses, no una vez.
 */
export const REGLAS: Record<TipoSolicitud, ReglaTipo> = {
  constancia: {
    crea: [],
    revisa: "solicitudes.gestionar",
    estudiante: "obligatorio",
    monto: "no",
    fecha: "opcional",
    direccion: NUNCA,
  },
  carta: {
    crea: [],
    revisa: "solicitudes.gestionar",
    estudiante: "obligatorio",
    monto: "no",
    fecha: "opcional",
    direccion: NUNCA,
  },
  cita_administracion: {
    crea: [],
    revisa: "solicitudes.gestionar",
    estudiante: "obligatorio",
    monto: "no",
    fecha: "obligatorio",
    direccion: NUNCA,
  },
  permiso: {
    crea: [],
    revisa: "solicitudes.gestionar",
    estudiante: "obligatorio",
    monto: "no",
    fecha: "obligatorio",
    direccion: NUNCA,
  },
  otro: {
    crea: [],
    revisa: "solicitudes.gestionar",
    estudiante: "obligatorio",
    monto: "no",
    fecha: "opcional",
    direccion: NUNCA,
  },
  alta_expediente: {
    crea: ["expedientes.postular", "expedientes.escribir"],
    revisa: "solicitudes.gestionar",
    estudiante: "obligatorio",
    monto: "no",
    fecha: "no",
    direccion: NUNCA,
  },
  beca: {
    crea: ["patrocinadores.escribir"],
    revisa: "solicitudes.gestionar",
    estudiante: "obligatorio",
    monto: "opcional",
    fecha: "opcional",
    direccion: () => true,
  },
  gasto: {
    // Cualquiera del personal: la lista vacía de abajo no aplica a los
    // internos, ver `puedeCrear`.
    crea: [],
    revisa: "finanzas.escribir",
    estudiante: "no",
    monto: "obligatorio",
    fecha: "opcional",
    direccion: (monto) => (monto ?? 0) >= UMBRAL_DIRECCION_USD,
  },
};

export function esTipoSolicitud(valor: unknown): valor is TipoSolicitud {
  return (
    typeof valor === "string" &&
    (TIPOS_SOLICITUD as readonly string[]).includes(valor)
  );
}

export function esTramiteEstudiante(valor: unknown): valor is TramiteEstudiante {
  return (
    typeof valor === "string" &&
    (TRAMITES_ESTUDIANTE as readonly string[]).includes(valor)
  );
}

export function esEstadoSolicitud(valor: unknown): valor is EstadoSolicitud {
  return (
    typeof valor === "string" &&
    (ESTADOS_SOLICITUD as readonly string[]).includes(valor)
  );
}

/**
 * Qué aprobaciones internas puede pedir este rol.
 *
 * El estudiante no pide ninguna: sus trámites van por su portal, con su ficha
 * sacada de la sesión. El gasto lo puede pedir todo el personal.
 */
export function tiposQuePuedeCrear(rol: Rol): AprobacionInterna[] {
  if (rol === "estudiante") return [];

  return APROBACIONES_INTERNAS.filter((tipo) => {
    const { crea } = REGLAS[tipo];

    return crea.length === 0 || crea.some((permiso) => tienePermiso(rol, permiso));
  });
}

/** Las acciones del flujo. Cada una es un paso en `solicitud_paso`. */
export const ACCIONES = [
  "tomar",
  "aprobar",
  "aprobar_direccion",
  "rechazar",
  "completar",
  "cancelar",
] as const;

export type AccionSolicitud = (typeof ACCIONES)[number];

export function esAccionSolicitud(valor: unknown): valor is AccionSolicitud {
  return (
    typeof valor === "string" && (ACCIONES as readonly string[]).includes(valor)
  );
}

/** Lo mínimo de una solicitud para decidir qué se puede hacer con ella. */
export type SolicitudParaFlujo = {
  tipo: string;
  estado: string;
  solicitante_id: string | null;
  requiere_direccion: boolean;
};

/**
 * Las acciones que esta persona puede hacer ahora sobre esta solicitud.
 *
 * Es LA regla del flujo: la pantalla la usa para pintar botones y la acción del
 * servidor para dejar pasar o no. Tres controles van aquí dentro:
 *
 *   · Separación de funciones: quien pidió no revisa, no aprueba y no rechaza
 *     lo suyo, aunque tenga el permiso. Solo puede cancelarlo.
 *   · El segundo nivel es de `solicitudes.direccion` y solo de eso: el revisor
 *     del primer nivel no se aprueba a sí mismo el paso siguiente.
 *   · Completar lo hace el revisor del primer nivel, que es quien ejecuta (la
 *     constancia la entrega administración, el gasto lo asienta contabilidad).
 */
export function accionesPermitidas(
  solicitud: SolicitudParaFlujo,
  usuario: { id: string; rol: Rol },
): AccionSolicitud[] {
  if (!esTipoSolicitud(solicitud.tipo)) return [];

  const propia = solicitud.solicitante_id === usuario.id;
  const revisa = !propia && tienePermiso(usuario.rol, REGLAS[solicitud.tipo].revisa);
  const dirige = !propia && tienePermiso(usuario.rol, "solicitudes.direccion");

  switch (solicitud.estado) {
    case "enviada":
      return [
        ...(revisa ? (["tomar", "rechazar"] as const) : []),
        ...(propia ? (["cancelar"] as const) : []),
      ];
    case "en_revision":
      return [
        ...(revisa ? (["aprobar", "rechazar"] as const) : []),
        ...(propia ? (["cancelar"] as const) : []),
      ];
    case "pendiente_direccion":
      return dirige ? ["aprobar_direccion", "rechazar"] : [];
    case "aprobada":
      return revisa ? ["completar"] : [];
    default:
      return [];
  }
}

/** A qué estado lleva cada acción. `aprobar` depende del segundo nivel. */
export function estadoTrasAccion(
  accion: AccionSolicitud,
  requiereDireccion: boolean,
): EstadoSolicitud {
  switch (accion) {
    case "tomar":
      return "en_revision";
    case "aprobar":
      return requiereDireccion ? "pendiente_direccion" : "aprobada";
    case "aprobar_direccion":
      return "aprobada";
    case "rechazar":
      return "rechazada";
    case "completar":
      return "completada";
    case "cancelar":
      return "cancelada";
  }
}

/**
 * Si la persona revisa ALGO, es decir, si la bandeja le enseña "por atender".
 */
export function revisaAlgo(rol: Rol): boolean {
  return (
    tienePermiso(rol, "solicitudes.gestionar") ||
    tienePermiso(rol, "solicitudes.direccion") ||
    tienePermiso(rol, "finanzas.escribir")
  );
}

/**
 * Cómo se ve cada estado: insignia e icono, juntos por la misma razón que
 * `ESTADO_VISUAL` en `expedientes.ts`.
 *
 * Es un estado de entidad con siete valores, así que entra en la excepción
 * `SEMAFORO`: verde para lo que salió bien (aprobada, completada) y rojo para
 * lo que se cerró en contra (rechazada). El resto, por peso de azul y gris. El
 * icono es lo que distingue enviada de cancelada en escala de grises.
 *
 * OJO: `icono` es un componente y no cruza de servidor a cliente; el cliente lo
 * resuelve con `visualDeSolicitud` por su cuenta.
 */
export const ESTADO_SOLICITUD_VISUAL: Record<
  EstadoSolicitud,
  { insignia: string; icono: LucideIcon }
> = {
  enviada: { insignia: "bg-slate-100 text-slate-700", icono: Send },
  en_revision: { insignia: "bg-[#2096BA]/15 text-[#187a99]", icono: Eye },
  pendiente_direccion: {
    insignia: "bg-[#171A1D] text-white",
    icono: ShieldCheck,
  },
  aprobada: { insignia: "bg-[#1E9E6A] text-white", icono: CheckCircle2 },
  rechazada: { insignia: "bg-[#B4342B] text-white", icono: XCircle },
  completada: { insignia: "bg-[#0a6a8a] text-white", icono: PackageCheck },
  cancelada: { insignia: "bg-slate-100 text-slate-500", icono: Ban },
};

export function visualDeSolicitud(estado: string) {
  return esEstadoSolicitud(estado)
    ? ESTADO_SOLICITUD_VISUAL[estado]
    : { insignia: "bg-slate-100 text-slate-600", icono: CircleDot };
}
