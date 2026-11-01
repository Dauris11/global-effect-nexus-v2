"use server";

import { revalidatePath } from "next/cache";

import { requerirUsuario } from "@/lib/auth";
import { consultar, consultarUna } from "@/lib/db";
import { fechaConHora } from "@/lib/fechas";
import {
  MAXIMO_CARACTERES_PREGUNTA,
  type TurnoIA,
} from "@/lib/ia";
import { tienePermiso, type Rol } from "@/lib/rbac";
import { estudianteDeUsuario } from "@/server/estudiantes/portal";
import { conversarComo } from "@/server/ia/agente";
import { reglamentoActual } from "@/server/ia/reglamento";
import {
  asegurarConversacion,
  conversacionDelEstudiante,
  guardarMensaje,
  instruccionesPara,
  mensajesDeConversacion,
} from "@/server/ia/estudiante";
import {
  asegurarConversacionInterna,
  conversacionInterna,
  guardarMensajeInterno,
  instruccionesInternas,
  mensajesInternos,
} from "@/server/ia/interno";

export type ModoAgente = "consultas" | "acciones";

export type AccionSugerida = {
  tipo: "navegacion";
  ruta: string;
  etiqueta: string;
  descripcion: string;
};

export type MensajeWidget = {
  id: string;
  rol: "user" | "assistant";
  contenido: string;
  hora: string;
  accion?: AccionSugerida | null;
};

export type RespuestaEnvioWidget = {
  ok: boolean;
  error?: string;
  mensaje?: MensajeWidget;
  accion?: AccionSugerida | null;
};

/**
 * Catálogo de rutas permitidas para ejecución de acciones por rol.
 */
type DefinicionAccion = {
  identificadores: string[];
  etiqueta: string;
  descripcion: string;
  ruta: string;
  rolesPermitidos: Rol[];
  permisoRequerido?: string;
};

const CATALOGO_ACCIONES: DefinicionAccion[] = [
  // Contabilidad
  {
    identificadores: ["mi dia", "cola de hoy", "pendientes de hoy"],
    etiqueta: "Mi día",
    descripcion: "Tu cola de decisiones de hoy: comprobantes por revisar, vencimientos y señales.",
    ruta: "/contabilidad/mi-dia",
    rolesPermitidos: ["contabilidad", "admin", "super_admin"],
  },
  {
    identificadores: ["actividad del equipo", "quien hizo que", "resguardo de actividades"],
    etiqueta: "Actividad del equipo",
    descripcion: "Quién hizo qué y a qué hora, con gráficas y línea de tiempo.",
    ruta: "/configuracion/actividad",
    rolesPermitidos: ["super_admin"],
  },
  {
    identificadores: ["visibilidad", "que ve cada rol", "ocultar modulos"],
    etiqueta: "Qué ve cada rol",
    descripcion: "Oculta o bloquea módulos para los demás roles.",
    ruta: "/configuracion/visibilidad",
    rolesPermitidos: ["super_admin"],
  },
  {
    identificadores: [
      "cuentas por pagar",
      "cxp",
      "facturas por pagar",
      "facturas pendientes",
      "pagar facturas",
      "vencimientos",
    ],
    etiqueta: "Cuentas por Pagar",
    descripcion: "Consulta de facturas pendientes de pago y análisis de vencimientos a 30/60/90 días.",
    ruta: "/contabilidad/cuentas-por-pagar",
    rolesPermitidos: ["contabilidad", "super_admin"],
  },
  {
    identificadores: [
      "proveedores",
      "proveedor",
      "nuevo proveedor",
      "suplidores",
      "rnc",
    ],
    etiqueta: "Proveedores",
    descripcion: "Directorio de proveedores registrados, RNC/Cédula y condiciones de pago.",
    ruta: "/contabilidad/proveedores",
    rolesPermitidos: ["contabilidad", "super_admin"],
  },
  {
    identificadores: [
      "recibos",
      "recibos de pago",
      "comprobantes",
      "comprobante",
      "egresos",
      "pagos",
    ],
    etiqueta: "Recibos de Pago",
    descripcion: "Historial de recibos emitidos, comprobantes firmados y transacciones contabilizadas.",
    ruta: "/contabilidad/recibos",
    rolesPermitidos: ["contabilidad", "super_admin"],
  },
  {
    identificadores: [
      "bancos",
      "cuentas bancarias",
      "conciliacion",
      "balance bancario",
      "popular",
      "banreservas",
      "bhd",
    ],
    etiqueta: "Cuentas Bancarias",
    descripcion: "Gestión de cuentas en DOP y USD, balances disponibles y conciliación bancaria.",
    ruta: "/contabilidad/bancos",
    rolesPermitidos: ["contabilidad", "super_admin"],
  },
  {
    identificadores: [
      "portal contabilidad",
      "inicio contabilidad",
      "panel contable",
    ],
    etiqueta: "Portal de Contabilidad",
    descripcion: "Vista principal del departamento financiero y métricas del mes.",
    ruta: "/portal/contabilidad",
    rolesPermitidos: ["contabilidad", "super_admin"],
  },

  // Académico & Docente
  {
    identificadores: [
      "materias",
      "mis materias",
      "asignaturas",
    ],
    etiqueta: "Materias Académicas",
    descripcion: "Catálogo de asignaturas registradas, créditos y códigos de aula.",
    ruta: "/academico/materias",
    rolesPermitidos: ["docente", "admin", "super_admin"],
  },
  {
    // Las notas finales de 360 se ponen aquí, así que "calificaciones" y
    // "notas" llevan a esta pantalla desde que se retiró la planilla de los
    // cursos técnicos.
    identificadores: [
      "clases 360",
      "global effect 360",
      "calificaciones",
      "calificar",
      "notas",
      "registrar notas",
    ],
    etiqueta: "Clases de Global Effect 360",
    descripcion: "Materias de Global Effect 360: docentes, inscritos, tareas y nota final.",
    ruta: "/academico/clases-360",
    rolesPermitidos: ["docente", "admin", "super_admin"],
  },
  {
    identificadores: [
      "portal docente",
      "portal profesor",
      "mi portal docente",
    ],
    etiqueta: "Portal Docente",
    descripcion: "Panel de control del profesor con sus clases activas y pendientes.",
    ruta: "/portal/profesor",
    rolesPermitidos: ["docente"],
  },

  // Operaciones & Administrativo
  {
    identificadores: [
      "tareas",
      "mis tareas",
      "tablero de tareas",
      "pendientes operaciones",
    ],
    etiqueta: "Tablero de Tareas",
    descripcion: "Gestión operativa de tareas institucionales y asignaciones del equipo.",
    ruta: "/administrativo/tareas",
    rolesPermitidos: ["admin", "super_admin"],
  },
  {
    identificadores: [
      "proyectos",
      "proyectos de operaciones",
      "mis proyectos",
    ],
    etiqueta: "Proyectos de Operaciones",
    descripcion: "Seguimiento y avance de los proyectos comunitarios e institucionales.",
    ruta: "/administrativo/proyectos",
    rolesPermitidos: ["admin", "super_admin"],
  },
  {
    identificadores: [
      "solicitudes",
      "bandeja de solicitudes",
      "aprobar solicitudes",
      "mis solicitudes",
    ],
    etiqueta: "Bandeja de Solicitudes",
    descripcion: "Trámites, permisos, reembolsos y solicitudes del personal y estudiantes.",
    ruta: "/administrativo/solicitudes",
    rolesPermitidos: ["admin", "super_admin", "contabilidad", "docente", "habitudes"],
  },
  {
    identificadores: [
      "personal",
      "usuarios",
      "cuentas",
      "gestionar personal",
      "crear usuario",
    ],
    etiqueta: "Gestión de Personal",
    descripcion: "Administración de cuentas de usuario, roles y permisos del personal.",
    ruta: "/administrativo/personal",
    rolesPermitidos: ["admin", "super_admin"],
  },
  {
    identificadores: [
      "expedientes",
      "estudiantes",
      "candidatos",
      "postulantes",
      "fichas",
    ],
    etiqueta: "Expedientes de Estudiantes",
    descripcion: "Fichas de postulantes y becados universitarios.",
    ruta: "/expedientes",
    rolesPermitidos: ["admin", "super_admin", "habitudes"],
  },
  {
    identificadores: [
      "calendario gantt",
      "gantt",
      "linea de tiempo",
      "cronograma",
    ],
    etiqueta: "Cronograma Gantt",
    descripcion: "Línea de tiempo de proyectos, materias y eventos institucionales.",
    ruta: "/calendario/gantt",
    rolesPermitidos: ["admin", "super_admin", "docente"],
  },
  {
    identificadores: [
      "calendario",
      "agenda",
      "eventos",
      "fechas",
    ],
    etiqueta: "Calendario Institucional",
    descripcion: "Calendario de actividades, reuniones, evaluaciones y entregas.",
    ruta: "/calendario",
    rolesPermitidos: ["admin", "super_admin", "docente"],
  },
  {
    identificadores: [
      "reportes",
      "informes",
      "estadisticas",
    ],
    etiqueta: "Reportes Institucionales",
    descripcion: "Informes de gestión, métricas financieras y avance operativo.",
    ruta: "/reportes",
    rolesPermitidos: ["admin", "super_admin", "contabilidad"],
  },
  {
    identificadores: [
      "dashboard",
      "panel general",
      "graficas",
      "inicio",
    ],
    etiqueta: "Panel General",
    descripcion: "Dashboard con métricas institucionales y gráficas de rendimiento.",
    ruta: "/dashboard",
    rolesPermitidos: ["admin", "super_admin"],
  },
  {
    identificadores: [
      "auditoria",
      "bitacora",
      "logs",
      "registro de auditoria",
    ],
    etiqueta: "Registro de Auditoría",
    descripcion: "Bitácora inmutable de acciones realizadas en el sistema.",
    ruta: "/configuracion/auditoria",
    rolesPermitidos: ["super_admin", "admin"],
  },
  {
    identificadores: [
      "configuracion",
      "ajustes",
    ],
    etiqueta: "Configuración del Sistema",
    descripcion: "Parámetros institucionales y preferencias de la plataforma.",
    ruta: "/configuracion",
    rolesPermitidos: ["admin", "super_admin"],
  },
  {
    identificadores: [
      "anuncios",
      "landing",
      "portada web",
    ],
    etiqueta: "Anuncios de Portada",
    descripcion: "Gestión de noticias y avisos en la página principal pública.",
    ruta: "/configuracion/landing",
    rolesPermitidos: ["admin", "super_admin"],
  },
  {
    identificadores: [
      "patrocinadores",
      "donantes",
      "becas patrocinadas",
    ],
    etiqueta: "Patrocinadores",
    descripcion: "Relación con patrocinadores y asignación de becas a estudiantes.",
    ruta: "/patrocinadores",
    rolesPermitidos: ["admin", "super_admin"],
  },
];

/**
 * Busca si el mensaje del usuario corresponde a una acción navegable o ejecutable.
 */
function interpretarAccion(
  comando: string,
  rol: Rol,
): AccionSugerida | null {
  const normalizado = comando
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  // Solo es navegación si EMPIEZA como una orden de ir a un sitio. Sin este
  // filtro, «crea una tarea para revisar el inventario» llevaba a Inventario en
  // vez de llegar al asistente, que sí puede crearla.
  if (!/^(ir|ve|vamos|llevame|llevarme|abre|abrir|muestrame|mostrar|ver|navega|quiero ir|go to|open|show|take me)\b/.test(normalizado)) {
    return null;
  }

  // Recorrer las acciones que el rol tiene permitido ver
  for (const item of CATALOGO_ACCIONES) {
    if (!item.rolesPermitidos.includes(rol)) continue;

    for (const id of item.identificadores) {
      const idNorm = id
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      if (normalizado.includes(idNorm)) {
        return {
          tipo: "navegacion",
          ruta: item.ruta,
          etiqueta: item.etiqueta,
          descripcion: item.descripcion,
        };
      }
    }
  }

  return null;
}

/**
 * Obtiene el historial de mensajes para el widget flotante de la cuenta en sesión.
 */
export async function obtenerHistorialWidget(): Promise<MensajeWidget[]> {
  const usuario = await requerirUsuario();

  if (usuario.rol === "estudiante") {
    const conversacionId = await conversacionDelEstudiante(usuario.id);
    if (!conversacionId) return [];

    const filas = await mensajesDeConversacion(conversacionId, 25);
    return filas.map((m) => ({
      id: m.id,
      rol: m.rol === "assistant" ? "assistant" : "user",
      contenido: m.contenido,
      hora: fechaConHora(m.created_at, null, usuario.idioma),
    }));
  }

  const conversacionId = await conversacionInterna(usuario.id);
  if (!conversacionId) return [];

  const filas = await mensajesInternos(conversacionId, 25);
  return filas.map((m) => ({
    id: m.id,
    rol: m.rol === "assistant" ? "assistant" : "user",
    contenido: m.contenido,
    hora: fechaConHora(m.created_at, null, usuario.idioma),
  }));
}

/**
 * Procesa y responde un mensaje enviado desde el widget flotante (por texto o voz).
 */
export async function enviarMensajeWidget({
  contenido,
  modo,
}: {
  contenido: string;
  modo: ModoAgente;
  rutaActual?: string;
}): Promise<RespuestaEnvioWidget> {
  const usuario = await requerirUsuario();

  const texto = contenido.trim();
  if (!texto) {
    return { ok: false, error: "mensajeVacio" };
  }

  if (texto.length > MAXIMO_CARACTERES_PREGUNTA) {
    return { ok: false, error: "mensajeLargo" };
  }

  // REGLA FUNDAMENTAL: Los estudiantes NO tienen modo de acción activo.
  // Solo tienen disponible consultas normativas y académicas.
  const modoEfectivo: ModoAgente =
    usuario.rol === "estudiante" ? "consultas" : modo;

  // Si el usuario intentó forzar acciones siendo estudiante:
  if (usuario.rol === "estudiante" && modo === "acciones") {
    return {
      ok: true,
      mensaje: {
        id: crypto.randomUUID(),
        rol: "assistant",
        contenido:
          usuario.idioma === "en"
            ? "Students have access to Q&A mode only (rules, regulations, grades, and subjects). To submit official petitions or requests, please visit the «My requests» section."
            : "Como estudiante de la Fundación Global Effect, tu asistente está habilitado en modo de consultas sobre normativas, becas, calificaciones y materias. Si necesitas realizar un trámite o solicitud formal, puedes gestionarlo desde la sección «Mis solicitudes».",
        hora: fechaConHora(new Date(), null, usuario.idioma),
      },
    };
  }

  // Si estamos en modo ACCIONES:
  let accionDetectada: AccionSugerida | null = null;
  if (modoEfectivo === "acciones") {
    accionDetectada = interpretarAccion(texto, usuario.rol);
  }

  let respuestaTexto = "";

  // 1. Caso: Modo Acción con acción detectada
  if (modoEfectivo === "acciones" && accionDetectada) {
    respuestaTexto =
      usuario.idioma === "en"
        ? `Identified action: **${accionDetectada.etiqueta}**.\n\n${accionDetectada.descripcion}\n\nClick the button below to navigate to this screen.`
        : `Acción identificada: **${accionDetectada.etiqueta}**.\n\n${accionDetectada.descripcion}\n\nPuedes pulsar el botón de abajo para ir directamente a este módulo.`;
  } else if (usuario.rol === "estudiante") {
    // 2. Caso: Estudiante (Consultas con base de conocimiento)
    const estudiante = await estudianteDeUsuario(usuario.id);
    const conversacionPrevia = await conversacionDelEstudiante(usuario.id);
    const historial = conversacionPrevia
      ? await mensajesDeConversacion(conversacionPrevia, 15)
      : [];

    const instruccionesBase = await instruccionesPara(
      estudiante,
      usuario.idioma,
    );
    const instruccionesCompletas = `${instruccionesBase}\n\n${await reglamentoActual()}`;

    const turnos: TurnoIA[] = [
      ...historial.map((h) => ({
        rol: (h.rol === "assistant" ? "assistant" : "user") as "user" | "assistant",
        contenido: h.contenido,
      })),
      { rol: "user", contenido: texto },
    ];

    const res = await conversarComo(usuario, instruccionesCompletas, turnos);

    if (res.estado === "cuota") return { ok: false, error: "cuota" };
    if (res.estado === "limite") return { ok: false, error: "limite" };

    if (res.estado === "ok") {
      respuestaTexto = res.texto;
    } else {
      // Fallback semántico institucional cuando la clave de IA no está configurada en local
      respuestaTexto = responderConsultaEstudiantilFallback(
        texto,
        estudiante.nombre,
        usuario.idioma,
      );
    }

    const conversacionId =
      conversacionPrevia ??
      (await asegurarConversacion(usuario.id, texto.slice(0, 50)));

    if (conversacionId) {
      await guardarMensaje(conversacionId, "user", texto);
      await guardarMensaje(conversacionId, "assistant", respuestaTexto);
    }
  } else {
    // 3. Caso: Personal institucional (Consultas o Acciones sin coincidencia directa)
    const previa = await conversacionInterna(usuario.id);
    const historial = previa ? await mensajesInternos(previa, 15) : [];

    const instruccionesBase = await instruccionesInternas(
      usuario,
      usuario.idioma,
    );
    const instruccionesCompletas = `${instruccionesBase}\n\n${await reglamentoActual()}\n\nModo actual del asistente: ${modoEfectivo}. Si el usuario pide una acción que no puedes ejecutar directamente, indícale en qué menú o pantalla se realiza.`;

    const turnos: TurnoIA[] = [
      ...historial.map((h) => ({
        rol: (h.rol === "assistant" ? "assistant" : "user") as "user" | "assistant",
        contenido: h.contenido,
      })),
      { rol: "user", contenido: texto },
    ];

    const res = await conversarComo(usuario, instruccionesCompletas, turnos);

    if (res.estado === "cuota") return { ok: false, error: "cuota" };
    if (res.estado === "limite") return { ok: false, error: "limite" };

    if (res.estado === "ok") {
      respuestaTexto = res.texto;
    } else {
      // Fallback semántico para el departamento
      respuestaTexto = responderConsultaInternaFallback(
        texto,
        usuario.rol,
        usuario.nombre,
        modoEfectivo,
        usuario.idioma,
      );
    }

    const conversacionId =
      previa ?? (await asegurarConversacionInterna(usuario.id, texto.slice(0, 50)));

    if (conversacionId) {
      await guardarMensajeInterno(conversacionId, "user", texto);
      await guardarMensajeInterno(conversacionId, "assistant", respuestaTexto);
    }
  }

  // Notificar actualización de vistas de chat
  revalidatePath("/chat-ia");
  revalidatePath("/portal/estudiante/chat");

  return {
    ok: true,
    mensaje: {
      id: crypto.randomUUID(),
      rol: "assistant",
      contenido: respuestaTexto,
      hora: fechaConHora(new Date(), null, usuario.idioma),
      accion: accionDetectada,
    },
    accion: accionDetectada,
  };
}

/**
 * Detecta si lo escrito es una orden de navegación («abre la tesorería»). No usa
 * el modelo: es una coincidencia de palabras, así que responde al instante y
 * funciona aunque no haya clave de IA.
 */
export async function sugerirNavegacion(
  comando: string,
): Promise<AccionSugerida | null> {
  const usuario = await requerirUsuario();

  return interpretarAccion(comando.slice(0, MAXIMO_CARACTERES_PREGUNTA), usuario.rol);
}

/**
 * Limpia el historial de chat para reiniciar la conversación del widget.
 */
export async function limpiarHistorialWidget(): Promise<{ ok: boolean }> {
  const usuario = await requerirUsuario();

  if (usuario.rol === "estudiante") {
    const conversacionId = await conversacionDelEstudiante(usuario.id);
    if (conversacionId) {
      await consultar("DELETE FROM mensaje_ia WHERE conversacion_id = $1", [
        conversacionId,
      ]);
    }
  } else {
    const conversacionId = await conversacionInterna(usuario.id);
    if (conversacionId) {
      await consultar("DELETE FROM mensaje_ia WHERE conversacion_id = $1", [
        conversacionId,
      ]);
    }
  }

  return { ok: true };
}

/**
 * Fallback semántico para estudiantes cuando no hay clave API de Anthropic configurada.
 */
function responderConsultaEstudiantilFallback(
  pregunta: string,
  nombre: string,
  idioma: "es" | "en",
): string {
  const p = pregunta.toLowerCase();

  if (p.includes("regla") || p.includes("requisito") || p.includes("beca")) {
    return idioma === "en"
      ? `Hello ${nombre}. The scholarship regulations require:\n- Maintain a GPA of at least 3.00 / 4.00 (technical courses: 70+).\n- Minimum 80% class and workshop attendance.\n- 8 hours of community service per month.\n- Attendance at monthly meetings.`
      : `Hola ${nombre}. Las normativas de la beca de la Fundación Global Effect establecen:\n- Mantener un índice académico (GPA) igual o superior a 3.00 / 4.00 (en cursos técnicos mínimo 70 puntos).\n- Mínimo 80% de asistencia obligatoria a clases y talleres.\n- Cumplir al menos 8 horas de servicio comunitario mensual.\n- Asistir a las reuniones generales mensuales de la Fundación.`;
  }

  if (p.includes("servicio") || p.includes("hora")) {
    return idioma === "en"
      ? `Community service is a requirement of 8 hours per month. You can register and verify your completed hours with the operations team.`
      : `El servicio comunitario es de 8 horas mensuales obligatorias. Puedes registrar y validar tus horas cumplidas con el equipo de operaciones.`;
  }

  if (p.includes("reprob") || p.includes("perder") || p.includes("bajo")) {
    return idioma === "en"
      ? `If you fail a subject or your GPA drops below 3.00, your scholarship enters academic observation. You will receive tutoring and support from coordination.`
      : `Si repruebas una materia o tu índice baja de 3.00, la beca entra en período de observación y acompañamiento académico, asignándote tutorías para recuperarte.`;
  }

  if (p.includes("solicitud") || p.includes("carta") || p.includes("permiso") || p.includes("cita")) {
    return idioma === "en"
      ? `To request study certificates, recommendation letters, or appointments with administration, go to «My requests» in your student portal.`
      : `Para cartas de estudio, constancias, permisos o citas con administración, puedes solicitarlas directamente desde la sección «Mis solicitudes» en tu portal de estudiante.`;
  }

  return idioma === "en"
    ? `I'm your assistant at Fundación Global Effect. You can ask me about your scholarship rules, grades, schedule, or community service.`
    : `Soy tu asistente de la Fundación Global Effect. Puedes consultarme sobre los requisitos de tu beca, materias, calificaciones, horas de servicio comunitario o trámites de solicitudes.`;
}

/**
 * Fallback semántico para personal interno y otros departamentos.
 */
function responderConsultaInternaFallback(
  pregunta: string,
  rol: Rol,
  nombre: string,
  modo: ModoAgente,
  idioma: "es" | "en",
): string {
  const p = pregunta.toLowerCase();

  if (rol === "contabilidad") {
    if (p.includes("retencion") || p.includes("dgii") || p.includes("itbis") || p.includes("isr")) {
      return idioma === "en"
        ? `In Accounting, DGII withholdings apply: 100% ITBIS on physical persons for services, 10% ISR on professional services, and 2% on technical services.`
        : `En Contabilidad se aplican las retenciones de la DGII: 100% de ITBIS en servicios prestados por personas físicas, 10% de ISR para honorarios profesionales y 2% para servicios técnicos.`;
    }
    if (p.includes("cxp") || p.includes("pagar") || p.includes("factura")) {
      return idioma === "en"
        ? `Accounts Payable (CxP) are classified into 30, 60, and 90+ days. In Action Mode you can say "Take me to Accounts Payable" to inspect pending invoices.`
        : `Las Cuentas por Pagar (CxP) están categorizadas a 30, 60 y 90+ días. En Modo Acciones puedes decir "Llévame a Cuentas por Pagar" para gestionarlas directamente.`;
    }
  }

  if (rol === "docente") {
    if (p.includes("nota") || p.includes("calific") || p.includes("escala")) {
      return idioma === "en"
        ? `The academic grading scale goes from 0 to 100: A (90-100), B (80-89), C (70-79, risk), and F (<70, fail).`
        : `La escala de calificaciones es de 0 a 100 puntos: A (90-100 Excelente), B (80-89 Buena), C (70-79 En riesgo) y F (<70 Reprobada).`;
    }
  }

  if (modo === "acciones") {
    return idioma === "en"
      ? `Action mode active for ${nombre} (${rol}). You can ask me to navigate to any module by voice or text (e.g., "Take me to Accounts Payable", "Open Tasks", "Go to Grades").`
      : `Modo de acciones activo para ${nombre} (${rol}). Puedes indicarme un comando por voz o texto (por ejemplo: «Llévame a Cuentas por Pagar», «Abrir tareas», «Ver calificaciones»).`;
  }

  return idioma === "en"
    ? `Institutional assistant active for ${nombre} (${rol}). Feel free to ask about Foundation metrics, departmental procedures, or switch to Action Mode.`
    : `Asistente institucional activo para ${nombre} (${rol}). Puedes consultarme sobre métricas de la Fundación, normativas de tu departamento o cambiar al Modo Acciones para navegar.`;
}
