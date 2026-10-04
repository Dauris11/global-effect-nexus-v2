================================================================
  GLOBAL EFFECT NEXUS — DESCRIPCIÓN DEL PROYECTO Y MÓDULOS
  Fecha: 2026-06-25
================================================================

VISIÓN GENERAL
─────────────────────────────────────────────────────────────────
Global Effect Nexus es el ERP institucional de la Fundación Global
Effect: un sistema de gestión (académico, expedientes, patrocinio,
operaciones, finanzas, solicitudes y aprobaciones) con el portal del
estudiante integrado. Centraliza en un solo sistema todos los flujos
de trabajo relacionados con: estudiantes, docentes, patrocinadores,
finanzas, trámites y aprobaciones, tareas y comunicación
institucional.

Nota (oct 2026): el departamento de Psicología se eliminó. Su portal,
sus citas y sus notas desaparecieron del sistema, y el expediente del
estudiante pasó a manos de administración.

El sistema está construido sobre la plataforma Base44 (BaaS), que
proporciona autenticación, base de datos (entidades), integraciones
de IA, almacenamiento de archivos, y envío de correos — todo
gestionado desde un frontend React + Tailwind CSS.

TECNOLOGÍAS PRINCIPALES
─────────────────────────────────────────────────────────────────
• Frontend: React 18 + Vite + Tailwind CSS + shadcn/ui
• Enrutamiento: React Router DOM
• Estado/Datos: TanStack React Query (caché, invalidación, mutaciones)
• Backend: Base44 BaaS (entidades, auth, integraciones)
• Iconos: Lucide React
• Gráficos: Recharts (barras, circulares, áreas, radiales)
• Fechas: date-fns con localización en español
• IA: InvokeLLM (OCR, chat, extracción de datos)
• Archivos: UploadFile (fotos, documentos escaneados)
• Email: SendEmail (notificaciones automáticas)

ARQUITECTURA Y ROLES
─────────────────────────────────────────────────────────────────
La plataforma implementa control de acceso basado en roles (RBAC).
Cada usuario ve un menú lateral diferente según su rol:

  admin          → Acceso total: dashboard, todos los módulos
  estudiante     → Portal estudiantil: materias, notas, solicitudes
  profesor       → Portal docente: cursos, calificaciones
  administrativo → Expedientes (dueño), patrocinadores, tareas,
                   proyectos, bandeja de solicitudes
  contabilidad   → Transacciones, reportes financieros, aprobación
                   de solicitudes de gasto

La autenticación es gestionada por Base44 Auth (tokens, sesiones,
verificación de email). Los usuarios se invitan, no se registran
directamente.

================================================================
  MÓDULO 1: PÁGINA DE INICIO (Landing Pública)
  Archivo: pages/Inicio.jsx | Ruta: /
================================================================
Página pública de presentación de la fundación. No requiere login.

Funcionalidades:
• Hero slider rotativo (3 slides cada 6 segundos) con anuncios:
  becas universitarias, reuniones de coordinación, cursos técnicos.
• Barra de estadísticas: estudiantes activos, materias, patrocinadores.
• Selector de portales: tarjetas con accesos directos:
  - Administración Global
  - Contabilidad y Finanzas
  - Cursos Técnicos
  - Portal Administrativo
  - Portal del Estudiante (trámites y solicitudes)
• Sección de próximos eventos (traídos de la entidad Evento).
• Botón de inscripción de comida (acceso público directo).
• Footer con enlaces institucionales y redes sociales.

================================================================
  MÓDULO 2: DASHBOARD PRINCIPAL
  Archivo: pages/Dashboard.jsx | Ruta: /dashboard
================================================================
Panel de control para administradores con métricas en tiempo real.

Funcionalidades:
• Banner con resumen: estudiantes activos, becados, patrocinadores.
• Tarjetas de estadísticas (StatCard):
  - Estudiantes activos / becados
  - Cursos activos
  - Tareas pendientes
  - Balance del mes
• Accesos rápidos a Expedientes, Patrocinadores, Solicitudes, Chat IA.
• Gráfico de barras: flujo financiero mensual (ingresos vs egresos).
• Gráfico circular: distribución becados vs regulares.
• Lista de próximos eventos programados.
• Lista de tareas prioritarias no completadas.

================================================================
  MÓDULO 3: EXPEDIENTES ESTUDIANTILES
  Archivo: pages/Expedientes.jsx | Ruta: /expedientes
  Componentes: ExpedienteDetalle, FormFamiliar, FormSeguimiento,
               BuscadorEstudiantes
================================================================
El módulo más completo del sistema. Gestiona 75 campos por estudiante.

Funcionalidades:
• CRUD completo: crear, ver, editar y eliminar expedientes.
• Tarjetas con foto, estado (activo/inactivo/graduado/suspendido),
  tipo (becado universitario / curso técnico) y badges.
• Buscador inteligente con dropdown en tiempo real (BuscadorEstudiantes).
• Filtros por pestañas: Todos / Becados Universitarios / Cursos Técnicos.

OCR CON INTELIGENCIA ARTIFICIAL:
• Permite subir imagen o PDF del expediente físico del estudiante.
• La IA (InvokeLLM) analiza el documento y extrae automáticamente:
  datos personales, familiares, historia de vida, situación económica,
  metas académicas, enfermedades, alergias, y más.
• Si se escanea sobre un estudiante existente, guarda los datos
  directamente en su perfil sin requerir confirmación manual.
• Si es nuevo, llena el formulario para revisión antes de guardar.

FORMULARIO POR PESTAÑAS (6 secciones):
1. Personal: nombre, cédula, contacto, dirección, nacionalidad, etc.
2. Académico: tipo de estudiante, programa, universidad, patrocinador.
3. Habitudes: facilitador, centro educativo, historia de habitudes.
4. Familia: padre, madre, tutor, madrastra/padrastro, hermanos,
   condiciones de vivienda (casa propia, baño, habitaciones, camas).
5. Historia: historia de vida, situación familiar/económica, motivo beca.
6. Seguimiento: amonestaciones, solicitudes pendientes, envío correo
   patrocinador, asistencia a reuniones, enfermedades, alergias.

VISTA DE DETALLE (ExpedienteDetalle):
• Modal con pestañas que muestra toda la información del estudiante.
• Calcula GPA, promedio de notas y tendencias académicas con gráficos.
• Botón de edición que abre el formulario precargado.

================================================================
  MÓDULO 4: MATERIAS
  Archivo: pages/academico/Materias.jsx | Ruta: /academico/materias
================================================================
Gestión de materias académicas por cuatrimestre.

Funcionalidades:
• CRUD completo: crear, editar y eliminar materias.
• Vista responsive: tarjetas en mobile, tabla en desktop.
• Campos: nombre, código, cuatrimestre, créditos, profesor, horario,
  aula, estado (activa/inactiva), descripción.
• Búsqueda en tiempo real por nombre, código o profesor.

================================================================
  MÓDULO 5: CURSOS TÉCNICOS
  Archivo: pages/academico/Cursos.jsx | Ruta: /academico/cursos
================================================================
Gestión de cursos del Instituto de Carreras Técnicas.

Funcionalidades:
• Crear cursos con: nombre, descripción, docente, período, estado
  (activo/finalizado/planificado), capacidad máxima, inscritos,
  horario, modalidad (presencial/virtual/mixto).
• Tarjetas con indicador de cupo (inscritos/capacidad).
• Búsqueda por nombre o docente.

================================================================
  MÓDULO 6: CALIFICACIONES
  Archivo: pages/academico/Calificaciones.jsx | Ruta: /academico/calificaciones
================================================================
Registro y seguimiento de notas de estudiantes.

Funcionalidades:
• Registrar calificaciones: estudiante, curso, nota (0-100), tipo de
  evaluación (examen/tarea/proyecto/participación/final), período,
  observaciones.
• Tabla con código de color según nota:
  - Verde: ≥90 (excelente)
  - Azul: 70-89 (aprobado)
  - Amarillo: 60-69 (marginal)
  - Rojo: <60 (reprobado)
• Búsqueda por estudiante o curso.

================================================================
  MÓDULO 7: HISTORIAL ACADÉMICO
  Archivo: pages/academico/HistorialAcademico.jsx | Ruta: /academico/historial
================================================================
Registro histórico de calificaciones agrupado por estudiante.

Funcionalidades:
• Estadísticas: total evaluaciones, promedio general, aprobados.
• Agrupación por estudiante con promedio individual.
• Filtro por período académico.
• Búsqueda por estudiante o curso.
• Badge de promedio con color (verde ≥70, rojo <70).

================================================================
  MÓDULO 8: PREMATRÍCULA
  Archivo: pages/academico/Prematricula.jsx | Ruta: /academico/prematricula
================================================================
Gestión de inscripciones y asignación de materias por período.

Funcionalidades:
• Inscribir estudiantes en cursos seleccionando de dropdowns.
• Estadísticas: total inscritos, pendientes (nota=0), activos (nota>0).
• Lista de todas las inscripciones registradas con su estado.

================================================================
  MÓDULO 9: PERÍODOS / CUATRIMESTRES
  Archivo: pages/academico/Periodos.jsx | Ruta: /academico/periodos
================================================================
Gestión de períodos académicos institucionales.

Funcionalidades:
• Crear períodos con: nombre (ej: 2026-I), fechas de inicio/fin,
  estado (planificado/activo/completado), cantidad de cursos.
• Tarjetas con badge de estado y color.
• Estadísticas: activos, completados, planificados.
• Datos estáticos pre-cargados (3 períodos de ejemplo).

================================================================
  MÓDULO 10: ACADEMIAS / PROGRAMAS
  Archivo: pages/academias/Programas.jsx | Ruta: /academias/programas
================================================================
Programas de liderazgo y desarrollo de habilidades.

Funcionalidades:
• Crear academias: nombre, tipo (liderazgo/habilidades/otro),
  descripción, facilitador, estado, participantes, fechas.
• Tarjetas con icono según tipo, conteo de participantes y fechas.

================================================================
  MÓDULO 11: MATERIALES EDUCATIVOS
  Archivo: pages/academias/Materiales.jsx | Ruta: /academias/materiales
================================================================
Recursos y materiales de las academias.

Funcionalidades:
• Registrar materiales: título, descripción, academia asociada,
  tipo (documento/video/presentación/enlace/otro), URL del archivo,
  autor.
• Tarjetas con icono según tipo de material.

================================================================
  MÓDULO 12: PATROCINADORES
  Archivo: pages/Patrocinadores.jsx | Ruta: /patrocinadores
================================================================
Gestión de patrocinadores de la fundación.

Funcionalidades:
• Registrar patrocinadores: nombre, tipo (persona/empresa/iglesia/
  ong/otro), email, teléfono, país, estado, aporte mensual (USD),
  notas.
• Estadísticas: total patrocinadores, aporte mensual total estimado,
  países de origen.
• Filtros por estado (activos/inactivos).
• Vista responsive: tarjetas en mobile, tabla en desktop.

================================================================
  MÓDULO 13: ASIGNACIÓN DE BECAS
  Archivo: pages/patrocinadores/AsignacionBecas.jsx | Ruta: /patrocinadores/becas
================================================================
Gestión de becas estudiantiles y su relación con patrocinadores.

Funcionalidades:
• Vista de estudiantes becados con su programa y estado.
• Vista de patrocinadores activos con su aporte mensual.
• Formulario para nueva asignación (estudiante + patrocinador + monto).
• Estadísticas: becados, patrocinadores activos, aporte mensual total.

================================================================
  MÓDULO 14: CONTABILIDAD
  Archivo: pages/Contabilidad.jsx | Ruta: /contabilidad
================================================================
Control de ingresos, egresos y becas otorgadas.

Funcionalidades:
• Registrar transacciones: concepto, tipo (ingreso/egreso), monto,
  categoría (beca/donacion/operativo/salario/material/evento/otro),
  fecha, referencia, notas.
• Estadísticas: total ingresos, total egresos, balance neto.
• Filtros por tipo (todos/ingresos/egresos).
• Tabla con monto coloreado (verde ingresos, rojo egresos).

================================================================
  MÓDULO 15: SOLICITUDES Y APROBACIONES
  Ruta: /administrativo/solicitudes (bandeja del personal)
        /portal/estudiante/solicitudes (trámites del estudiante)
  Tablas: solicitud, solicitud_paso (migración 0031)
================================================================
Una sola bandeja con flujo por pasos para los trámites del
estudiante y las aprobaciones internas. Sustituye al antiguo
módulo de Psicología (eliminado en oct 2026, migración 0030).

Tipos de solicitud:
• Trámites del estudiante: constancia (de estudios o de beca),
  carta (recomendación o referencia), cita_administracion (fecha y
  hora preferidas), permiso (ausencia), otro. Los revisa quien
  tenga solicitudes.gestionar.
• Aprobaciones internas:
  - alta_expediente: pasar un candidato del embudo a estudiante
    activo. Un nivel de revisión (solicitudes.gestionar).
  - beca: asignar o cambiar una beca, con monto opcional. Siempre
    requiere segundo nivel de dirección (solicitudes.direccion).
  - gasto: solicitud de gasto o compra, monto obligatorio (USD).
    Revisa contabilidad (finanzas.escribir); requiere dirección si
    el monto es de 1,000 USD o más.

Flujo de estados:
  enviada → en_revision → [pendiente_direccion] → aprobada →
  completada. Se puede rechazar (comentario obligatorio) desde
  enviada, en_revision o pendiente_direccion. El solicitante puede
  cancelar mientras esté en enviada o en_revision.

Reglas de control:
• Separación de funciones: nadie aprueba su propia solicitud.
• El segundo nivel de dirección se fija al crear la solicitud, para
  que un cambio de umbral no altere solicitudes en curso.
• "Aprobada" es la decisión; "completada" es que el módulo dueño ya
  la ejecutó (constancia entregada, gasto registrado, expediente
  activo). La solicitud no ejecuta efectos por su cuenta.
• Cada paso queda en solicitud_paso (quién, cuándo, de qué estado a
  cuál, comentario): línea de tiempo visible al solicitante.
• Cada paso genera una notificación interna (sin correo); aprobar,
  rechazar y completar quedan en audit_log.
• Folio legible para referirse a cada solicitud.

================================================================
  MÓDULO 16: GESTIÓN DE TAREAS
  Archivo: pages/administrativo/Tareas.jsx | Ruta: /administrativo/tareas
================================================================
Sistema de gestión de tareas estilo Asana con notificaciones.

Funcionalidades:
• Tablero Kanban con 3 columnas: Pendiente / En Progreso / Completada.
• Crear tareas: título, descripción, prioridad (baja/media/alta/
  urgente), fecha límite, proyecto, visibilidad (todos/asignados).
• Asignación multiple de usuarios mediante checkboxes.
• Control de visibilidad: admin ve todo; usuarios regulares solo ven
  tareas públicas o asignadas a su email.

AUTOMATIZACIONES AL CREAR TAREA:
• Envío automático de email a cada usuario asignado con los detalles.
• Creación automática de evento en el calendario para cada asignado
  (tipo administrativo, con fecha límite como fecha del evento).
• Invalidación de queries para refrescar calendario y tareas.

• Cambio de estado mediante menú desplegable en cada tarjeta.

================================================================
  MÓDULO 17: PROYECTOS
  Archivo: pages/administrativo/Proyectos.jsx | Ruta: /administrativo/proyectos
================================================================
Gestión y seguimiento de proyectos de la fundación.

Funcionalidades:
• Crear proyectos: nombre, descripción, responsable, estado
  (planificación/en_curso/completado/pausado), fechas inicio/fin,
  progreso (%).
• Tarjetas con barra de progreso visual (componente Progress).
• Badge de estado con color.

================================================================
  MÓDULO 18: GESTIÓN DE PERSONAL
  Archivo: pages/administrativo/GestionPersonal.jsx | Ruta: /administrativo/personal
================================================================
Usuarios internos del sistema y control de roles y permisos.

Funcionalidades:
• Lista de usuarios registrados con búsqueda.
• Estadísticas: total usuarios, administradores, usuarios regulares.
• Tarjeta informativa de roles y permisos del sistema:
  - Admin, Estudiante, Profesor, Administrativo, Contabilidad —
    con descripción y permisos de cada rol.

================================================================
  MÓDULO 19: CALENDARIO Y AGENDA
  Archivo: pages/Calendario.jsx | Ruta: /calendario
================================================================
Planificación de eventos, actividades y tareas.

Funcionalidades:
• Vista de calendario mensual con navegación entre meses.
• Puntos indicadores en cada día: azules para eventos, naranjas para
  tareas con vencimiento.
• Panel lateral con detalle del día seleccionado (eventos + tareas).
• Crear eventos: título, descripción, tipo (académico/administrativo/
  social/reunión/otro), fecha, hora inicio/fin, ubicación, responsable,
  estado.
• Vista de agenda: próximos 30 días combinando eventos y tareas.
• Los eventos creados desde el módulo de tareas aparecen aquí
  automáticamente.

================================================================
  MÓDULO 20: CHAT IA INTERNO
  Archivo: pages/ChatIA.jsx | Ruta: /chat-ia
================================================================
Asistente con inteligencia artificial para consultas institucionales.

Funcionalidades:
• Chat interactivo con historial de mensajes (markdown renderizado).
• La IA recibe contexto en tiempo real de toda la base de datos:
  estudiantes, cursos, academias, patrocinadores, eventos, tareas,
  finanzas (ingresos, egresos, balance).
• Prompts rápidos sugeridos (botones de acceso directo).
• Respuestas en español, claras y concisas.
• Botón de reiniciar conversación.

================================================================
  MÓDULO 21: CHAT IA ESTUDIANTIL
  Archivo: pages/ChatIAEstudiantil.jsx | Ruta: /chat-ia-estudiantil
================================================================
Asistente IA orientado a estudiantes para consultas académicas.

================================================================
  MÓDULO 22: SOLICITUDES DEL ESTUDIANTE
  Ruta: /portal/estudiante/solicitudes
================================================================
Permite al estudiante pedir trámites (constancia, carta, cita con
administración, permiso u otro) y seguir "mis solicitudes" con su
línea de tiempo. Las citas con administración aprobadas o en curso
aparecen en su calendario.

================================================================
  MÓDULO 23: REPORTES VISUALES
  Archivo: pages/Reportes.jsx | Ruta: /reportes
================================================================
Dashboard analítico con gráficos interactivos (Recharts).

3 secciones por pestañas:

  PROYECTOS:
  • KPIs: total, en curso, completados, avance promedio.
  • Gráfico circular: distribución por estado.
  • Gráfico de barras horizontales: % de avance por proyecto.
  • Gráfico de barras apiladas: tareas por proyecto (completadas/
    pendientes/en progreso).

  ACADÉMICO:
  • KPIs: total registros, promedio general, aprobados, reprobados.
  • Gráfico de barras: distribución de calificaciones en rangos
    (90-100, 80-89, 70-79, 60-69, <60).
  • Gráfico de barras: promedio por tipo de evaluación.
  • Gráfico de barras horizontales: promedio por curso.

  CONTABILIDAD:
  • KPIs: ingresos, egresos, balance neto, total transacciones.
  • Gráfico de área: evolución mensual (últimos 6 meses).
  • Gráfico de barras horizontales: ingresos vs egresos por categoría.
  • Gráfico circular: distribución de egresos por categoría.

================================================================
  MÓDULO 24: SERVICIOS MENSUALES
  Archivo: pages/ServiciosMensuales.jsx | Ruta: /servicios-mensuales
================================================================
Control mensual de servicios comunitarios y reuniones de estudiantes.

Funcionalidades:
• Selector de mes (últimos 12 meses).
• Tabla tipo Excel con toggles visuales:
  - ¿Hizo servicio mensual? (check verde / X roja)
  - ¿Asistió a reunión mensual? (check morado / X roja)
• Estadísticas: activos, hicieron servicio, asistieron reunión.
• Exportación a PDF imprimible con formato profesional.

================================================================
  MÓDULO 25: INSCRIPCIÓN DE COMIDA
  Archivo: pages/InscripcionComida.jsx | Ruta: /comida (pública, sin login)
                                            /inscripcion-comida (con layout)
================================================================
Sistema diario de inscripción para el almuerzo.

Funcionalidades:
• Acceso público (ruta /comida) — no requiere autenticación.
• Límite horario: inscripción abierta solo hasta las 8:30 AM.
• Validación: no duplicar inscripciones del mismo día.
• Confirmación visual al inscribirse.
• Vista de admin: lista completa de inscritos + impresión de lista.
• Vista de usuario: contador de inscritos (sin nombres visibles).
• Actualización automática cada 30 segundos.

================================================================
  MÓDULO 26: CONFIGURACIÓN
  Archivo: pages/Configuracion.jsx | Ruta: /configuracion
================================================================
Administración de usuarios y roles del sistema.

Funcionalidades:
• Tabla de usuarios del sistema (nombre, email, rol).
• Información del sistema: plataforma, versión, módulos.
• Roles disponibles con descripciones.

================================================================
  MÓDULO 27: MAPA DE NAVEGACIÓN (SITEMAP)
  Archivo: pages/Sitemap.jsx | Ruta: /sitemap
================================================================
Visualización jerárquica de toda la estructura de navegación.

Funcionalidades:
• 4 portales principales con sub-módulos navegables:
  - Portal Estudiante
  - Portal Profesor
  - Portal Administrativo
  - Portal Cursos Técnicos
• Módulos compartidos (Dashboard, Calendario, Inscripción Comida).
• Flujos de navegación automáticos documentados.

================================================================
  PORTALES POR ROL (Dashboards)
─────────────────────────────────────────────────────────────────

PORTAL ESTUDIANTE (pages/portales/PortalEstudiante.jsx)
  Ruta: /portal/estudiante
  • Banner con promedio, GPA y materias aprobadas.
  • Accesos: materias, calificaciones, solicitudes.
  • Lista de materias activas.
  • Calificaciones por cuatrimestre con letra (A-F) y GPA.
  • Condición en la fundación (servicios y reuniones últimos 3 meses).
  • Próximos eventos.

PORTAL PROFESOR (pages/portales/PortalProfesor.jsx)
  Ruta: /portal/profesor
  • Banner con cursos activos, inscritos totales, notas registradas.
  • Accesos: cursos, materias, calificaciones, calendario.
  • Lista de cursos activos con modalidad y inscritos.

PORTAL ADMINISTRATIVO (pages/portales/PortalAdministrativo.jsx)
  Ruta: /portal/administrativo
  • Banner con tareas pendientes, proyectos activos, estudiantes y
    solicitudes por atender.
  • 9 accesos: expedientes, solicitudes, patrocinadores, tareas,
    proyectos, servicios mensuales, lista de comida, calendario,
    chat IA.
  • Lista de tareas urgentes / alta prioridad.

PORTAL CONTABILIDAD (pages/portales/PortalContabilidad.jsx)
  Ruta: /portal/contabilidad
  • Banner con ingresos, egresos y balance.
  • Accesos: contabilidad, reportes.
  • Últimas transacciones registradas.

PORTAL CURSOS TÉCNICOS (pages/portales/PortalCursosTecnicos.jsx)
  Ruta: /portal/cursos-tecnicos
  • Selector entre Portal de Estudiantes y Portal de Docentes.

================================================================
  COMPONENTES PRINCIPALES
─────────────────────────────────────────────────────────────────

LAYOUT:
• AppLayout.jsx: Layout principal con sidebar + topbar + <Outlet/>.
• Sidebar.jsx: Navegación lateral que cambia según rol del usuario.
  Incluye menús expandibles y logout.
• TopBar.jsx: Barra superior con título de página y acciones.

COMPONENTES DE EXPEDIENTES:
• ExpedienteDetalle.jsx: Modal con vista completa del estudiante
  (datos personales, académicos, familiares, seguimiento) con
  cálculos de GPA y gráficos de rendimiento.
• FormFamiliar.jsx: Formulario de datos familiares y condiciones
  de vivienda (padre, madre, tutor, hermanos, casa, baños, camas).
• FormSeguimiento.jsx: Formulario de seguimiento administrativo
  (amonestaciones, solicitudes, correo patrocinador, reuniones,
  salud, alergias).

COMPONENTES COMPARTIDOS:
• BuscadorEstudiantes.jsx: Buscador con dropdown que resalta
  coincidencias y muestra avatares, badges de estado y biografías.
• PageHeader.jsx: Encabezado estándar con título, descripción,
  botón de acción y contenido personalizado.
• EmptyState.jsx: Estado vacío con icono, mensaje y acción opcional.
• StatCard.jsx: Tarjeta de estadística con icono, valor y subtítulo.

AUTENTICACIÓN:
• AuthContext.jsx: Contexto que gestiona el estado de autenticación,
  loading, errores (usuario no registrado, auth requerida).
• RoleContext.jsx: Contexto que gestiona el rol activo del usuario
  para mostrar/ocultar menús del sidebar.
• ProtectedRoute.jsx: Componente que protege rutas que requieren
  autenticación.
• UserNotRegisteredError.jsx: Pantalla mostrada cuando un usuario
  autenticado no está registrado en el sistema.

================================================================
  FLUJOS AUTOMATIZADOS PRINCIPALES
─────────────────────────────────────────────────────────────────

1. OCR → EXPEDIENTE:
   Subir documento → UploadFile → InvokeLLM extrae datos →
   Guarda en perfil del estudiante existente / llena formulario.

2. TAREA → NOTIFICACIÓN:
   Crear tarea con asignados → SendEmail a cada usuario →
   Crear Evento en Calendario → Refrescar vistas.

3. INSCRIPCIÓN COMIDA:
   Usuario escribe nombre → Validar hora (≤8:30 AM) →
   Validar no duplicado → Crear registro → Confirmación.

4. SERVICIOS MENSUALES:
   Toggle en tabla → Si existe registro: update →
   Si no existe: create → Refrescar lista.

5. CHAT IA:
   Construir contexto con datos de todas las entidades →
   Enviar a InvokeLLM con la pregunta → Renderizar respuesta markdown.

6. SOLICITUD → APROBACIÓN:
   Crear solicitud (folio) → Notificar a revisores → en_revision →
   [pendiente_direccion] → aprobada / rechazada → el módulo dueño la
   ejecuta → completada. Cada paso queda en la línea de tiempo y
   notifica al solicitante.

================================================================
  FIN DEL DOCUMENTO
================================================================