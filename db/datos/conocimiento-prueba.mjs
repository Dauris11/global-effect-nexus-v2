// Documentos de PRUEBA para la base de conocimiento de Elly AI.
// Son genéricos y de ejemplo: sirven para medir cómo responde cada agente, no
// son normativa de la Fundación. Todos llevan «[PRUEBA]» en el título y en la
// fuente para poder filtrarlos y borrarlos de un golpe.
//
// Cada documento ejercita un caso distinto del buscador:
//   · normal       → vigente, activo y verificado: debe citarse.
//   · vencido      → `vigente` en el pasado: NO debe aparecer en respuestas.
//   · inactivo     → `activo: false`: NO debe aparecer.
//   · sinVerificar → sin fecha de verificación: debe citarse con aviso.
//   · compartido   → varios agentes a la vez.

const HOY = new Date().toISOString().slice(0, 10);
const ESTUDIANTE = ["agente_estudiante"];

export const DOCUMENTOS = [
  // ---------- Estudiante ----------
  {
    caso: "normal",
    titulo: "[PRUEBA] Guía de bienvenida del becado",
    fuente: "[PRUEBA] Documento de ejemplo — guía de bienvenida",
    version: "prueba-1",
    agentes: ESTUDIANTE,
    verificado: HOY,
    texto: `Bienvenido a la Fundación Global Effect. Esta guía de ejemplo resume lo que se espera de un becado durante el año.

Cada mes el estudiante cumple tres cosas: sube la foto de su servicio comunitario, asiste a la reunión mensual y envía una carta a su patrocinador antes del día 20. La carta la revisa Elly AI y, si está bien, se traduce y se envía al patrocinador.

El estudiante mantiene su beca conservando un índice académico por encima de 2.00 en la escala de 4.00. Si el índice baja de 2.00 entra en prueba académica y administración se pondrá en contacto con él.

Dudas sobre materias, calificaciones o solicitudes se resuelven en el portal del estudiante o preguntando a Elly AI.`,
  },
  {
    caso: "normal",
    titulo: "[PRUEBA] Preguntas frecuentes de la plataforma",
    fuente: "[PRUEBA] Documento de ejemplo — preguntas frecuentes",
    version: "prueba-1",
    agentes: ESTUDIANTE,
    verificado: HOY,
    texto: `¿Dónde veo mis calificaciones? En el portal del estudiante, sección Calificaciones, con el índice por período y el acumulado.

¿Cómo elijo mis materias del cuatrimestre? En la sección de prematrícula, respetando el tope de créditos de tu universidad. Siempre debes mantener al menos dos clases.

¿Cómo pido un trámite o una carta de la Fundación? Desde Solicitudes: eliges el tipo, escribes el motivo y administración responde por la misma pantalla.

¿Qué pasa si no envío mi carta al patrocinador antes del día 20? Queda marcada como pendiente en la planilla mensual y administración te lo recordará. Puedes enviarla tarde, pero el mes figura como no cumplido.`,
  },
  {
    caso: "vencido",
    titulo: "[PRUEBA] Calendario del cuatrimestre anterior",
    fuente: "[PRUEBA] Documento de ejemplo — calendario vencido",
    version: "prueba-0",
    agentes: ESTUDIANTE,
    verificado: "2025-01-15",
    vigente: "2025-04-30",
    texto: `Calendario de ejemplo del cuatrimestre enero-abril de 2025. La fecha límite de retiro de materias era el 14 de marzo y las evaluaciones finales empezaban el 21 de abril. Este documento está vencido a propósito: Elly AI no debe usarlo para responder.`,
  },
  {
    caso: "inactivo",
    titulo: "[PRUEBA] Política antigua de transporte",
    fuente: "[PRUEBA] Documento de ejemplo — desactivado",
    version: "prueba-0",
    agentes: ESTUDIANTE,
    verificado: HOY,
    activo: false,
    texto: `Política de ejemplo desactivada a propósito: el transporte salía a las seis de la mañana desde el parque central. Elly AI no debe usar este documento mientras esté inactivo.`,
  },
  {
    caso: "sinVerificar",
    titulo: "[PRUEBA] Horario de atención de administración",
    fuente: "[PRUEBA] Documento de ejemplo — sin verificar",
    version: "prueba-1",
    agentes: ESTUDIANTE,
    texto: `Administración atiende de lunes a viernes, de ocho de la mañana a cuatro de la tarde. Dato de ejemplo sin fecha de verificación: Elly AI puede citarlo, pero debe avisar que no está revisado.`,
  },

  // ---------- Docente ----------
  {
    caso: "normal",
    titulo: "[PRUEBA] Guía del docente de Global Effect 360",
    fuente: "[PRUEBA] Documento de ejemplo — guía docente",
    version: "prueba-1",
    agentes: ["agente_docente"],
    verificado: HOY,
    texto: `Global Effect 360 tiene materias de la Fundación, todas obligatorias, una por tanda. El docente publica tareas, toma asistencia y registra la nota final de cada estudiante.

La nota mínima de aprobación en Global Effect 360 es 70 de 100. El sistema sugiere aprobado o reprobado según esa nota, pero la decisión final es del docente.

Las calificaciones se entregan dentro de la semana siguiente al cierre de la clase. Si un estudiante tiene tres ausencias seguidas, el docente avisa a administración.`,
  },
  {
    caso: "normal",
    titulo: "[PRUEBA] Aula virtual y entregas de tareas",
    fuente: "[PRUEBA] Documento de ejemplo — aula virtual",
    version: "prueba-1",
    agentes: ["agente_docente"],
    verificado: HOY,
    texto: `Las tareas se publican en el aula virtual con fecha de entrega. Los estudiantes entregan desde su portal y el docente califica cada entrega con un comentario.

Una tarea vencida sigue visible pero se marca como tardía. El docente puede reabrir una entrega por una causa justificada; conviene dejar la razón escrita en el comentario.`,
  },

  // ---------- Contabilidad ----------
  {
    caso: "normal",
    titulo: "[PRUEBA] Cierre contable mensual",
    fuente: "[PRUEBA] Documento de ejemplo — cierre mensual",
    version: "prueba-1",
    agentes: ["agente_contabilidad"],
    verificado: HOY,
    texto: `Para cerrar un mes no puede quedar ningún borrador de recibo ni de factura. Se revisan los comprobantes recibidos, se concilia el banco y se cuadran los fondos restringidos.

Una vez cerrado el período nadie registra ni corrige nada con fecha de ese mes. Si hace falta un cambio se registra un ajuste en un período abierto. Reabrir un mes exige un motivo escrito y queda en la bitácora.`,
  },
  {
    caso: "normal",
    titulo: "[PRUEBA] Comprobantes y rendición de gastos",
    fuente: "[PRUEBA] Documento de ejemplo — comprobantes",
    version: "prueba-1",
    agentes: ["agente_contabilidad"],
    verificado: HOY,
    texto: `Todo gasto necesita un comprobante legible: factura con número de comprobante fiscal, o recibo cuando el suplidor no emite factura. El comprobante se asocia a un programa misional de la Fundación, por ejemplo Beca Universitaria o Comedor.

Los gastos se rinden dentro de los cinco días hábiles siguientes. Un comprobante ilegible se devuelve a quien lo subió.`,
  },

  // ---------- Administración ----------
  {
    caso: "normal",
    titulo: "[PRUEBA] Etapas del expediente del estudiante",
    fuente: "[PRUEBA] Documento de ejemplo — etapas del expediente",
    version: "prueba-1",
    agentes: ["agente_admin"],
    verificado: HOY,
    texto: `El expediente avanza por etapas. Un candidato entra como reclutado en Habitudes, pasa a postulado, luego a la academia de liderazgo, que es el último filtro, y de ahí entra a la universidad como activo o se descarta como inactivo con un motivo.

Al terminar la academia el estudiante entrega su récord de notas. Cada cambio de etapa queda registrado con quién lo hizo y cuándo. Un estudiante graduado conserva su expediente.`,
  },
  {
    caso: "normal",
    titulo: "[PRUEBA] Cartas mensuales a los patrocinadores",
    fuente: "[PRUEBA] Documento de ejemplo — cartas a patrocinadores",
    version: "prueba-1",
    agentes: ["agente_admin"],
    verificado: HOY,
    texto: `Cada estudiante con patrocinador envía una carta al mes antes del día 20. El agente de correos la revisa, la traduce al idioma del patrocinador y la reenvía. Una carta que no cumple se devuelve al estudiante con el motivo.

En la planilla de servicios mensuales administración ve quién cumplió y quién no, junto con el servicio comunitario y la asistencia a la reunión.`,
  },
  {
    caso: "normal",
    titulo: "[PRUEBA] Reunión mensual y servicio comunitario",
    fuente: "[PRUEBA] Documento de ejemplo — reunión y servicio",
    version: "prueba-1",
    agentes: ["agente_admin", "agente_estudiante"],
    verificado: HOY,
    texto: `La reunión mensual se hace una vez al mes con lista de activos y registro de asistencia. Tres inasistencias sin justificar dentro del año pueden llevar a una amonestación.

El servicio comunitario se acredita subiendo una foto del estudiante realizándolo; administración la aprueba o la rechaza con un comentario. Este documento es compartido entre el agente de administración y el de estudiantes a propósito.`,
  },

  // ---------- Habitudes ----------
  {
    caso: "normal",
    titulo: "[PRUEBA] Visitas a liceos y evidencias",
    fuente: "[PRUEBA] Documento de ejemplo — visitas a liceos",
    version: "prueba-1",
    agentes: ["agente_habitudes"],
    verificado: HOY,
    texto: `Cada visita a un liceo se planifica con el director del centro y se registra con fecha, facilitador y número de estudiantes. Después de la visita el facilitador sube las evidencias: fotos y la lista de asistencia.

Un director de Habitudes audita las evidencias y puede devolverlas si faltan datos.`,
  },
  {
    caso: "normal",
    titulo: "[PRUEBA] Postulación de candidatos",
    fuente: "[PRUEBA] Documento de ejemplo — postulación",
    version: "prueba-1",
    agentes: ["agente_habitudes", "agente_direccion"],
    verificado: HOY,
    texto: `Los candidatos se reclutan durante el programa Habitudes. El facilitador llena el expediente del postulante con sus datos, su familia y su breve historia. Cuando el expediente está completo se postula para pasar a la academia de liderazgo.`,
  },

  // ---------- Dirección ----------
  {
    caso: "normal",
    titulo: "[PRUEBA] Indicadores para la dirección",
    fuente: "[PRUEBA] Documento de ejemplo — indicadores",
    version: "prueba-1",
    agentes: ["agente_direccion"],
    verificado: HOY,
    texto: `Los indicadores que la dirección revisa cada mes: estudiantes activos, becados con patrocinador, cumplimiento de cartas, asistencia a reuniones y estudiantes en prueba académica.

Un estudiante está en prueba académica cuando su índice baja de 2.00. La dirección recibe el resumen y decide el seguimiento junto con administración.`,
  },

  // ---------- Colaborador (rol retirado, agente aún existe) ----------
  {
    caso: "normal",
    titulo: "[PRUEBA] Guía general del equipo",
    fuente: "[PRUEBA] Documento de ejemplo — guía del equipo",
    version: "prueba-1",
    agentes: ["agente_colaborador"],
    verificado: HOY,
    texto: `El equipo de la Fundación registra sus tareas en la bandeja, marca lo completado y reporta bloqueos a administración. Las tareas vencidas se priorizan al inicio de la semana.`,
  },

  // ---------- Compartido por todos ----------
  {
    caso: "compartido",
    titulo: "[PRUEBA] Glosario de la Fundación",
    fuente: "[PRUEBA] Documento de ejemplo — glosario",
    version: "prueba-1",
    agentes: [
      "agente_estudiante",
      "agente_docente",
      "agente_contabilidad",
      "agente_admin",
      "agente_habitudes",
      "agente_direccion",
      "agente_colaborador",
    ],
    verificado: HOY,
    texto: `Glosario de ejemplo. Habitudes: programa de liderazgo con el que la Fundación recluta a sus candidatos. Academia de liderazgo: último filtro antes de la universidad. Global Effect 360: materias propias de la Fundación, obligatorias para todos los becados. Becado: estudiante universitario sostenido por un patrocinador. Elly AI: el asistente de inteligencia artificial del Portal GlobalEffect.`,
  },
];
