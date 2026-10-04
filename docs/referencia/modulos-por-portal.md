================================================================
  MÓDULOS POR PORTAL — FUNCIONES DE CADA UNO
  Documento descriptivo del sistema Global Effect Nexus
  Fecha: 2026-08-08 · Actualizado: 2026-10-03 (ERP institucional)
================================================================

══════════════════════════════════════════════════════════════════
  INTRODUCCIÓN
══════════════════════════════════════════════════════════════════

Global Effect Nexus es el ERP institucional de la Fundación: un
sistema de gestión (académico, expedientes, patrocinio,
operaciones, finanzas, solicitudes y aprobaciones) con el portal
del estudiante integrado. Se organiza en 5 portales por rol +
módulos compartidos. Cada portal tiene su propio dashboard de
entrada y un conjunto de módulos accesibles desde la barra
lateral. Los roles controlan tanto la navegación como el acceso
a rutas.

En octubre de 2026 la Fundación eliminó el departamento de
Psicología: su portal, su módulo de citas y su rol
desaparecieron, y el expediente del estudiante pasó a manos de
administración (admin y super_admin). La cita del estudiante la
sustituye el módulo Solicitudes y aprobaciones.

Roles disponibles (6):
  • super_admin      — Dirección (acceso total, segundo nivel
                       de aprobación)
  • admin            — Personal administrativo (dueño del
                       expediente)
  • docente          — Docente de Cursos Técnicos
  • estudiante       — Estudiante de Curso Técnico
  • contabilidad     — Contabilidad
  • habitudes        — Postula candidatos al expediente

══════════════════════════════════════════════════════════════════
  PORTAL 1 — ADMINISTRADOR (acceso total)
══════════════════════════════════════════════════════════════════
Banner: from-slate-700 to-slate-900 · icono Shield

──────────────────────────────────────────────────────────────
1.1 DASHBOARD (/dashboard)
──────────────────────────────────────────────────────────────
  Función: Vista general de toda la fundación.
  • Hero banner con KPIs: estudiantes activos, becados,
    patrocinadores.
  • 4 StatCards: Estudiantes Activos · Cursos Activos · Tareas
    Pendientes · Balance del Mes.
  • Quick Access: Expedientes, Patrocinadores, Solicitudes,
    Chat IA.
  • Gráficos: BarChart de flujo financiero (ingresos vs
    egresos por mes) + PieChart de tipos de estudiantes.
  • Próximos Eventos (4) + Tareas Prioritarias (4).

──────────────────────────────────────────────────────────────
1.2 ACADÉMICO (grupo desplegable)
──────────────────────────────────────────────────────────────
  1.2.1 Cursos (/academico/cursos)
    Función: Gestión de cursos técnicos del Instituto.
    • Grid de tarjetas con: nombre, descripción, inscritos/
      capacidad, horario, docente, estado (activo/finalizado/
      planificado).
    • Modal "Nuevo Curso": nombre, descripción, docente,
      período, capacidad, modalidad (presencial/virtual/mixto),
      horario.
    • Búsqueda por nombre o docente.

  1.2.2 Materias (/academico/materias)
    Función: CRUD completo de materias por cuatrimestre.
    • Tabla (desktop) / tarjetas (mobile) con: código,
      materia, cuatrimestre, profesor, créditos, horario,
      estado (activa/inactiva).
    • Botones editar (Pencil) y eliminar (Trash2) por materia.
    • Modal crear/editar: nombre, código, cuatrimestre,
      créditos, aula, profesor, horario, estado, descripción.

  1.2.3 Calificaciones (/academico/calificaciones)
    Función: Registro y seguimiento de notas.
    • Tabla: estudiante, curso, tipo evaluación (examen/tarea/
      proyecto/participación/final), nota (color por rango:
      ≥90 emerald, ≥70 primary, ≥60 yellow, <60 red), período.
    • Modal "Registrar Calificación": estudiante, curso, nota,
      tipo, período.
    • Búsqueda por estudiante o curso.

  1.2.4 Historial Académico (/academico/historial)
    Función: Registro histórico de calificaciones agrupado por
    estudiante.
    • 3 KPIs: Evaluaciones totales · Promedio general ·
      Aprobados (≥70).
    • Filtros: búsqueda + selector de período.
    • Cards por estudiante con su promedio (badge emerald/red) y
      grid de notas individuales.

  1.2.5 Prematrícula (/academico/prematricula)
    Función: Gestión de inscripciones y asignación de materias.
    • 3 KPIs: Total Inscritos · Pendientes · Activas.
    • Lista de inscripciones con estudiante, curso y período.
    • Modal: seleccionar estudiante, curso y período.

  1.2.6 Períodos (/academico/periodos)
    Función: Gestión de períodos/cuatrimestres académicos.
    • 3 KPIs: Activos · Completados · Planificados.
    • Grid de tarjetas con nombre del período, fechas inicio/fin,
      cursos asignados, estado.
    • Modal: nombre, fechas, estado.

──────────────────────────────────────────────────────────────
1.3 ACADEMIAS (grupo desplegable)
──────────────────────────────────────────────────────────────
  1.3.1 Programas (/academias/programas)
    Función: Gestión de academias de liderazgo y habilidades.
    • Grid de tarjetas con: emoji por tipo (🎯 liderazgo,
      💡 habilidades, 📘 otro), nombre, descripción,
      participantes, fecha inicio, facilitador, estado.
    • Modal: nombre, tipo, descripción, facilitador, fechas,
      estado.

  1.3.2 Materiales (/academias/materiales)
    Función: Recursos educativos de las academias.
    • Grid de tarjetas con: icono por tipo (📄 documento,
      🎥 video, 📊 presentación, 🔗 enlace), título, descripción,
      academia asociada, autor.
    • Modal: título, descripción, academia, tipo, autor.

──────────────────────────────────────────────────────────────
1.4 EXPEDIENTES (/expedientes)
──────────────────────────────────────────────────────────────
  Función: Gestión completa de expedientes estudiantiles con
  CRUD y OCR. El expediente es de administración: admin y
  super_admin leen, escriben y eliminan sobre todos los
  estudiantes; habitudes solo postula candidatos.
  • Buscador de estudiantes.
  • Tabs: Todos / Becados / Cursos Técnicos.
  • Grid de tarjetas: foto/inicial, nombre, cédula, email,
    ciudad, programa, badges de estado y tipo, botones
    editar/eliminar.
  • Modal "Nuevo Expediente" con 6 pestañas (Personal, Académico,
    Habitudes, Familia, Historia, Seguimiento) + OCR + foto.
  • Modal "ExpedienteDetalle" con 6 pestañas de visualización
    completa (incluye historial académico con GPA 4.0 y
    gráfico de tendencia).

──────────────────────────────────────────────────────────────
1.5 PATROCINADORES (grupo desplegable)
──────────────────────────────────────────────────────────────
  1.5.1 Lista (/patrocinadores)
    Función: Gestión de patrocinadores.
    • 3 StatCards: Total · Aporte Mensual · Países.
    • Tabs: Todos / Activos / Inactivos.
    • Tabla (desktop) / tarjetas (mobile): nombre, tipo
      (emoji), país, contacto (email/tel), aporte/mes, estado.
    • Modal: nombre, tipo, país, email, teléfono, aporte
      mensual, notas.

  1.5.2 Becas (/patrocinadores/becas)
    Función: Asignación de becas a estudiantes.
    • 3 KPIs: Estudiantes Becados · Patrocinadores Activos ·
      Aporte Mensual Total.
    • Lista de estudiantes becados (badge 🎓).
    • Lista de patrocinadores activos con aporte.
    • Modal: estudiante, patrocinador, monto, notas.

──────────────────────────────────────────────────────────────
1.6 SOLICITUDES Y APROBACIONES (/administrativo/solicitudes)
──────────────────────────────────────────────────────────────
  Función: Bandeja única con flujo por pasos para los trámites
  del estudiante y las aprobaciones internas.
  • Trámites del estudiante: constancia (de estudios o de beca),
    carta (recomendación o referencia), cita_administracion
    (fecha y hora preferidas), permiso (ausencia), otro. Los
    revisa quien tiene solicitudes.gestionar.
  • Aprobaciones internas:
    - alta_expediente: pasar un candidato del embudo a
      estudiante activo (la crea expedientes.postular o
      expedientes.escribir; revisa solicitudes.gestionar).
    - beca: asignar o cambiar una beca (la crea
      patrocinadores.escribir; revisa solicitudes.gestionar y
      siempre pasa por dirección).
    - gasto: solicitud de gasto/compra con monto en USD (la crea
      cualquier miembro del personal; revisa finanzas.escribir;
      pasa por dirección si el monto es ≥ 1,000 USD).
  • Estados: enviada → en_revision → [pendiente_direccion] →
    aprobada → completada. Rechazada (con comentario
    obligatorio) desde enviada, en_revision o
    pendiente_direccion; el solicitante puede cancelarla
    mientras esté en enviada o en_revision.
  • Controles: nadie aprueba su propia solicitud; el segundo
    nivel de dirección (solicitudes.direccion) se fija al crear;
    "aprobada" es la decisión y "completada" es que el módulo
    dueño ya la ejecutó.
  • Vista: "por atender" (según permisos), "mis solicitudes",
    alta de solicitud interna y acciones del flujo con
    comentario.
  • Cada solicitud lleva folio legible y línea de tiempo de
    pasos (quién, cuándo, de qué estado a cuál, comentario).
  • Cada paso notifica dentro del sistema (sin correo); aprobar,
    rechazar y completar quedan en la auditoría.

──────────────────────────────────────────────────────────────
1.7 ADMINISTRATIVO (grupo desplegable)
──────────────────────────────────────────────────────────────
  1.7.1 Tareas (/administrativo/tareas)
    Función: Gestión estilo Asana/Kanban con notificaciones.
    • 3 columnas: Pendiente / En Progreso / Completada.
    • Tarjetas con: título, descripción, badge de prioridad
      (baja/media/alta/urgente), asignado, fecha límite,
      visibilidad (todos/asignados).
    • Dropdown para cambiar estado (solo admin).
    • Modal: título, descripción, prioridad, fecha límite,
      proyecto, visibilidad, selección de usuarios asignados.
    • Al crear: envía email + crea evento en calendario a cada
      usuario asignado.

  1.7.2 Proyectos (/administrativo/proyectos)
    Función: Gestión y seguimiento de proyectos.
    • Grid de tarjetas: nombre, descripción, badge de estado
      (planificación/en curso/completado/pausado), barra de
      progreso, responsable, fecha inicio.
    • Modal: nombre, descripción, responsable, fechas.

  1.7.3 Personal (/administrativo/personal)
    Función: Usuarios internos y control de roles/permisos.
    • 3 KPIs: Total Usuarios · Administradores · Regulares.
    • Lista de usuarios con avatar, nombre, email, badge de rol.
    • Grid de 6 roles con descripción y permisos detallados.

──────────────────────────────────────────────────────────────
1.8 SERVICIOS MENSUALES (/servicios-mensuales)
──────────────────────────────────────────────────────────────
  Función: Control mensual de servicio comunitario y reuniones.
  • Selector de mes (12 meses hacia atrás).
  • 3 StatCards: Activos · Hicieron Servicio · Asistieron Reunión.
  • Tabla estilo Excel: # · estudiante (con foto) · programa ·
    checkbox Servicio Mensual (CheckCircle2/XCircle) · checkbox
    Reunión Mensual.
  • Botón "Imprimir PDF" que genera reporte imprimible.

──────────────────────────────────────────────────────────────
1.9 LISTA DE COMIDA (/inscripcion-comida)
──────────────────────────────────────────────────────────────
  Función: Inscripción diaria para almuerzo.
  • Formulario de nombre con límite de hora (8:30 AM).
  • Contador de inscritos (si es admin, lista completa con
    hora de inscripción + botón imprimir).
  • Si no es admin, solo contador con candado.
  • Validación: no duplicados, horario límite.

──────────────────────────────────────────────────────────────
1.10 CONTABILIDAD (/contabilidad)
──────────────────────────────────────────────────────────────
  Función: Control de ingresos, egresos y becas.
  • 3 StatCards: Total Ingresos · Total Egresos · Balance.
  • Tabs: Todos / Ingresos / Egresos.
  • Tabla: concepto, tipo (badge), categoría, monto (color),
    fecha.
  • Modal: concepto, tipo, monto, categoría (beca/donación/
    operativo/salario/material/evento/otro), fecha, referencia.

──────────────────────────────────────────────────────────────
1.11 REPORTES (/reportes)
──────────────────────────────────────────────────────────────
  Función: Reportes visuales con gráficos.
  • 3 secciones con tabs:
    (a) Proyectos: KPIs (total/en curso/completados/avance
        promedio), PieChart distribución por estado, BarChart
        horizontal % avance, BarChart tareas por proyecto.
    (b) Académico: KPIs (registros/promedio/aprobados/
        reprobados), BarChart distribución de notas por rango,
        BarChart promedio por tipo de evaluación, BarChart
        promedio por curso.
    (c) Contabilidad: KPIs (ingresos/egresos/balance/transacc.),
        AreaChart evolución mensual (6 meses), BarChart
        ingresos vs egresos por categoría, PieChart distribución
        de egresos.

──────────────────────────────────────────────────────────────
1.12 CHAT IA ADMIN (/chat-ia)
──────────────────────────────────────────────────────────────
  Función: Asistente IA interno para consultas institucionales.
  • Chat con contexto de datos del sistema (estudiantes, cursos,
    transacciones, academias, eventos, tareas, patrocinadores).
  • 5 prompts rápidos.
  • Respuestas en Markdown.
  • Botón reiniciar.

──────────────────────────────────────────────────────────────
1.13 CALENDARIO (/calendario)
──────────────────────────────────────────────────────────────
  Función: Planificación de eventos y agenda.
  • Tabs: Calendario / Agenda próxima.
  • Vista calendario mensual con puntos de color (primary =
    eventos, orange = tareas).
  • Panel lateral de día seleccionado con eventos y tareas.
  • Agenda: próximos 20 eventos/tareas con fecha, hora, tipo,
    prioridad.
  • Modal "Nuevo Evento": título, descripción, tipo (académico/
    administrativo/social/reunión/otro), fecha, horas, ubicación,
    responsable.

──────────────────────────────────────────────────────────────
1.14 CONFIGURACIÓN (/configuracion)
──────────────────────────────────────────────────────────────
  Función: Administración de usuarios y roles.
  • Tabla de usuarios (nombre, email, rol).
  • Card de información del sistema (plataforma, versión,
    módulos).
  • Card de roles disponibles con descripción.

──────────────────────────────────────────────────────────────
1.15 MAPA DEL SITIO (/sitemap)
──────────────────────────────────────────────────────────────
  Función: Visualización jerárquica de portales y módulos.
  • Grid de 4 portales con sub-módulos.
  • Módulos compartidos.
  • Flujos de navegación automáticos.

══════════════════════════════════════════════════════════════════
  PORTAL 2 — ESTUDIANTE (Curso Técnico)
══════════════════════════════════════════════════════════════════
Banner: from-blue-500 to-blue-700 · icono GraduationCap

──────────────────────────────────────────────────────────────
2.1 MI PORTAL (/portal/estudiante)
──────────────────────────────────────────────────────────────
  Función: Dashboard personal del estudiante.
  • Banner hero con: GPA, promedio %, materias activas,
    servicio mensual.
  • Cards de navegación: Materias, Calificaciones, Solicitudes,
    Servicios.
  • Lista de materias inscritas con horario y aula.
  • Historial de calificaciones por cuatrimestre.
  • Estado de servicio comunitario y reunión mensual.
  • Próximos eventos.

──────────────────────────────────────────────────────────────
2.2 MIS MATERIAS (/academico/materias)
──────────────────────────────────────────────────────────────
  Función: Consulta de materias inscritas (lectura).

──────────────────────────────────────────────────────────────
2.3 CALIFICACIONES (/academico/calificaciones)
──────────────────────────────────────────────────────────────
  Función: Consulta de sus notas (lectura).

──────────────────────────────────────────────────────────────
2.4 SOLICITUDES (/portal/estudiante/solicitudes)
──────────────────────────────────────────────────────────────
  Función: Trámites del estudiante ante administración.
  • Formulario de trámite: constancia (de estudios o de beca),
    carta (recomendación o referencia), cita con administración
    (fecha y hora preferidas), permiso (ausencia) u otro.
  • "Mis solicitudes": folio, estado y línea de tiempo de cada
    paso con el comentario del revisor.
  • Puede cancelar mientras esté en enviada o en_revision.
  • Recibe una notificación en cada cambio de estado.
  • Las citas con administración aprobadas o en curso aparecen
    en su calendario.

══════════════════════════════════════════════════════════════════
  PORTAL 3 — PROFESOR (Docente)
══════════════════════════════════════════════════════════════════
Banner: from-amber-500 to-amber-700 · icono BookOpen

──────────────────────────────────────────────────────────────
3.1 MI PORTAL (/portal/profesor)
──────────────────────────────────────────────────────────────
  Función: Dashboard del docente.
  • Resumen con KPIs: cursos activos, materias, calificaciones
    registradas.
  • Grid de navegación a módulos académicos.
  • Lista de cursos activos con inscritos, horario y modalidad.

──────────────────────────────────────────────────────────────
3.2 MIS MATERIAS (/academico/materias)
──────────────────────────────────────────────────────────────
  Función: Gestión de materias asignadas.

──────────────────────────────────────────────────────────────
3.3 CALIFICACIONES (/academico/calificaciones)
──────────────────────────────────────────────────────────────
  Función: Registro de notas de estudiantes.

──────────────────────────────────────────────────────────────
3.4 CURSOS (/academico/cursos)
──────────────────────────────────────────────────────────────
  Función: Gestión de cursos a cargo.

──────────────────────────────────────────────────────────────
3.5 CALENDARIO (/calendario)
──────────────────────────────────────────────────────────────
  Función: Visualización de eventos y agenda.

══════════════════════════════════════════════════════════════════
  PORTAL 4 — ADMINISTRATIVO
══════════════════════════════════════════════════════════════════
Banner: from-orange-500 to-orange-700 · icono ClipboardList

──────────────────────────────────────────────────────────────
4.1 MI PORTAL (/portal/administrativo)
──────────────────────────────────────────────────────────────
  Función: Dashboard administrativo.
  • KPIs: tareas pendientes, proyectos activos, estudiantes,
    patrocinadores, solicitudes por atender.
  • Grid de accesos: Expedientes, Patrocinadores, Proyectos,
    Servicios, Solicitudes, Chat IA.
  • Lista de tareas urgentes pendientes.

──────────────────────────────────────────────────────────────
4.2 EXPEDIENTES (/expedientes)
4.3 PATROCINADORES (/patrocinadores)
4.4 SERVICIOS MENSUALES (/servicios-mensuales)
4.5 LISTA DE COMIDA (/inscripcion-comida)
4.6 TAREAS (/administrativo/tareas)
4.7 PROYECTOS (/administrativo/proyectos)
4.8 SOLICITUDES (/administrativo/solicitudes)
4.9 CALENDARIO (/calendario)
4.10 CHAT IA (/chat-ia)
──────────────────────────────────────────────────────────────
  (Funciones idénticas a las descritas en el Portal Admin.)

══════════════════════════════════════════════════════════════════
  PORTAL 5 — CONTABILIDAD
══════════════════════════════════════════════════════════════════
Banner: from-violet-500 to-violet-700 · icono DollarSign

──────────────────────────────────────────────────────────────
5.1 MI PORTAL (/portal/contabilidad)
──────────────────────────────────────────────────────────────
  Función: Dashboard financiero.
  • KPIs: ingresos totales, egresos, balance actual.
  • Grid de navegación a Contabilidad y Reportes.
  • Lista de transacciones recientes (6) con tipo y monto.

──────────────────────────────────────────────────────────────
5.2 CONTABILIDAD (/contabilidad)
──────────────────────────────────────────────────────────────
  Función: Registro de transacciones (ver 1.10). Revisa las
  solicitudes de gasto (finanzas.escribir) y registra el gasto
  cuando se aprueba.

──────────────────────────────────────────────────────────────
5.3 REPORTES (/reportes)
──────────────────────────────────────────────────────────────
  Función: Reportes visuales con énfasis financiero (ver 1.11).

══════════════════════════════════════════════════════════════════
  PORTAL ADICIONAL — CURSOS TÉCNICOS
══════════════════════════════════════════════════════════════════

──────────────────────────────────────────────────────────────
CT.1 PORTAL CURSOS TÉCNICOS (/portal/cursos-tecnicos)
──────────────────────────────────────────────────────────────
  Función: Página de selección de sub-portal para cursos
  técnicos.
  • 2 tarjetas grandes: Portal de Estudiantes (azul) y Portal
    de Docentes (ámbar), cada una con features y botón Acceder.
  • Al seleccionar, setea el rol y navega al portal
    correspondiente.

──────────────────────────────────────────────────────────────
CT.2 PORTAL ESTUDIANTE CT (/portal/estudiante-ct)
──────────────────────────────────────────────────────────────
  Función: Dashboard académico del estudiante de curso técnico.
  • Cálculo de GPA 4.0, promedio %, alertas de rendimiento.
  • Historial de calificaciones categorizado por cuatrimestre.
  • Lista de cursos activos con detalle.

══════════════════════════════════════════════════════════════════
  MÓDULOS COMPARTIDOS / PÚBLICOS
══════════════════════════════════════════════════════════════════

──────────────────────────────────────────────────────────────
DASHBOARD (/dashboard) — accesible desde cualquier rol
──────────────────────────────────────────────────────────────
  Vista general global (ver 1.1).

──────────────────────────────────────────────────────────────
CALENDARIO (/calendario) — accesible desde varios roles
──────────────────────────────────────────────────────────────
  Eventos y agenda (ver 1.13).

──────────────────────────────────────────────────────────────
INSCRIPCIÓN COMIDA (/comida) — pública, sin login
──────────────────────────────────────────────────────────────
  Misma función que /inscripcion-comida pero accesible sin
  autenticación (ruta pública directa).

══════════════════════════════════════════════════════════════════
  CHAT IA ESTUDIANTIL (/chat-ia-estudiantil)
══════════════════════════════════════════════════════════════════
  Función: Asistente IA para estudiantes.
  • Chat con contexto de estudiantes, cursos y materias.
  • 5 preguntas rápidas (requisitos de beca, prematrícula,
    reprobar materia, reglamento de asistencia, cómo pedir una
    constancia o cita con administración).
  • Respuestas en Markdown.

══════════════════════════════════════════════════════════════════
  RESUMEN DE ENTIDADES POR MÓDULO
══════════════════════════════════════════════════════════════════

  Estudiante        → Expedientes
  Materia           → Materias
  Curso             → Cursos
  Calificacion      → Calificaciones, Historial, Prematrícula
  Academia          → Programas
  Material          → Materiales
  Patrocinador      → Patrocinadores, Becas
  Transaccion       → Contabilidad, Reportes
  Tarea             → Tareas, Reportes, Calendario
  Proyecto          → Proyectos, Reportes
  Evento            → Calendario, Dashboard
  Solicitud         → Solicitudes (bandeja y portal estudiante),
                      Calendario
  SolicitudPaso     → Línea de tiempo de Solicitudes
  RegistroServicio  → Servicios Mensuales
  InscripcionComida → Inscripción Comida
  User              → Configuración, Personal

══════════════════════════════════════════════════════════════════
  RESUMEN TOTAL
══════════════════════════════════════════════════════════════════

  5 portales por rol + 1 portal selector de cursos técnicos
  27+ módulos funcionales
  16 entidades de base de datos
  Acceso controlado por rol (6 roles)
  Módulos compartidos: Dashboard, Calendario, Comida
  Módulos públicos: Inscripción Comida (/comida sin login)
  Integraciones: OCR (InvokeLLM+UploadFile), Email (SendEmail),
    Chat IA (InvokeLLM), impresión PDF

================================================================
  FIN DEL DOCUMENTO
================================================================