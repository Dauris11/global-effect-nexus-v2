# Módulos Funcionales — Global Effect Nexus

> Catálogo funcional de los módulos y portales del sistema (qué hace cada parte de la plataforma).

VISIÓN GENERAL
─────────────────────────────────────────────────────────────────
Global Effect Nexus es el ERP institucional de la Fundación Global
Effect, con el portal del estudiante integrado. Centraliza en un solo
sistema la gestión académica, los expedientes, el patrocinio, las
operaciones, las finanzas y las solicitudes y aprobaciones, además de
las tareas y la comunicación institucional.

Cambio de alcance (octubre 2026): la Fundación eliminó el departamento
de Psicología. Su módulo, su portal y la cita del estudiante salen del
sistema; en su lugar entra el módulo de Solicitudes y aprobaciones
(módulos 15 y 22 de este catálogo).

El sistema se construye desde cero con un frontend en Next.js
(App Router) + React + Tailwind CSS + shadcn/ui, y un backend propio
sobre PostgreSQL (acceso a datos con pg / node-postgres y consultas
SQL parametrizadas). Incorpora autenticación con control de acceso
por roles (RBAC), almacenamiento de archivos, asistentes de IA,
envío de correos e internacionalización (español / inglés).

TECNOLOGÍAS PRINCIPALES
─────────────────────────────────────────────────────────────────
- Frontend: Next.js (App Router) + React + TypeScript + Tailwind CSS + shadcn/ui
- Enrutamiento: App Router de Next.js (rutas por archivos)
- Estado/Datos: TanStack React Query (caché, invalidación, mutaciones)
- Base de datos: PostgreSQL con pg (node-postgres) y SQL parametrizado
- Autenticación: Auth.js (NextAuth) con credenciales + sesiones JWT y RBAC
- Internacionalización: next-intl (español / inglés)
- Validación: React Hook Form + Zod
- Iconos: Lucide React
- Gráficos: Recharts (barras, circulares, áreas, radiales)
- Fechas: date-fns con localización en español
- IA: servicio de IA (OCR, chat, extracción de datos)
- Archivos: almacenamiento de archivos (fotos, documentos escaneados)
- Email: envío de correos (notificaciones automáticas)

ARQUITECTURA Y ROLES
─────────────────────────────────────────────────────────────────
La plataforma implementa control de acceso basado en roles (RBAC).
Cada usuario ve un menú lateral diferente según su rol:

  super_admin    → Acceso total, incluida la aprobación de dirección
  admin          → Administración: expedientes, académico, operaciones,
                   patrocinadores, revisión de solicitudes
  estudiante     → Portal estudiantil: materias, notas, solicitudes
  docente        → Portal docente: cursos, calificaciones
  contabilidad   → Transacciones, reportes financieros, gastos
  habitudes      → Postulación de candidatos al expediente

La autenticación es gestionada por el módulo propio de autenticación
(Auth.js con credenciales y sesiones JWT). Los usuarios se invitan,
no se registran directamente.

## MÓDULO 1: PÁGINA DE INICIO (Landing Pública)
*Ruta: /*

Página pública de presentación de la fundación. No requiere login.

Funcionalidades:
- Hero slider rotativo (cada 6 segundos) con anuncios **configurables por el
  administrador** (tabla `landing_slide`, gestión en `/configuracion/landing`):
  título, subtítulo, texto, imagen, botón (CTA), orden y activo/oculto.
  Si no hay diapositivas, muestra una por defecto traducida. *(Implementado)*
- Barra de estadísticas: estudiantes activos, materias, patrocinadores.
- Selector de portales: 6 tarjetas con accesos directos:
  - Administración Global
  - Contabilidad y Finanzas
  - Cursos Técnicos
  - Portal Administrativo
  - Portal del Estudiante
  - Portal del Profesor
- Sección de próximos eventos (traídos de la entidad Evento).
- Botón de inscripción de comida (acceso público directo).
- Footer con enlaces institucionales y redes sociales.

## MÓDULO 2: DASHBOARD PRINCIPAL
*Ruta: /dashboard*

Panel de control para administradores con métricas en tiempo real.

Funcionalidades:
- Banner con resumen: estudiantes activos, becados, patrocinadores.
- Tarjetas de estadísticas (StatCard):
  - Estudiantes activos / becados
  - Cursos activos
  - Tareas pendientes
  - Balance del mes
- Accesos rápidos a Expedientes, Patrocinadores, Solicitudes, Chat IA.
- Gráfico de barras: flujo financiero mensual (ingresos vs egresos).
- Gráfico circular: distribución becados vs regulares.
- Lista de próximos eventos programados.
- Lista de tareas prioritarias no completadas.

## MÓDULO 3: EXPEDIENTES ESTUDIANTILES
*Ruta: /expedientes · Componentes: ExpedienteDetalle, FormFamiliar, FormSeguimiento, · BuscadorEstudiantes*

El módulo más completo del sistema. Gestiona el perfil integral del
estudiante (datos personales, familiares, vivienda, salud, historia
y seguimiento), normalizado en tablas relacionadas.

Funcionalidades:
- CRUD completo: crear, ver, editar y eliminar expedientes.
- Tarjetas con foto, estado (activo/inactivo/graduado/suspendido),
  tipo (becado universitario / curso técnico) y badges.
- Buscador inteligente con dropdown en tiempo real (BuscadorEstudiantes).
- Filtros por pestañas: Todos / Becados Universitarios / Cursos Técnicos.

OCR CON INTELIGENCIA ARTIFICIAL:
- Permite subir imagen o PDF del expediente físico del estudiante.
- El servicio de IA analiza el documento y extrae automáticamente:
  datos personales, familiares, historia de vida, situación económica,
  metas académicas, enfermedades, alergias, y más.
- Si se escanea sobre un estudiante existente, guarda los datos
  directamente en su perfil.
- Si es nuevo, llena el formulario para revisión antes de guardar.

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
- Modal con pestañas que muestra toda la información del estudiante.
- Calcula GPA, promedio de notas y tendencias académicas con gráficos.
- Botón de edición que abre el formulario precargado.

PROPIEDAD Y ACCESO:
- El expediente es de administración: admin y super_admin tienen
  expedientes.leer, expedientes.escribir y expedientes.eliminar sobre
  todos los estudiantes. Habitudes solo postula candidatos del embudo
  (expedientes.postular).
- Pasar un candidato a estudiante activo se pide como solicitud de
  tipo alta_expediente (módulo 15).

## MÓDULO 4: MATERIAS
*Ruta: /academico/materias*

Gestión de materias académicas por cuatrimestre.

Funcionalidades:
- CRUD completo: crear, editar y eliminar materias.
- Vista responsive: tarjetas en mobile, tabla en desktop.
- Campos: nombre, código, cuatrimestre, créditos, profesor, horario,
  aula, estado (activa/inactiva), descripción.
- Búsqueda en tiempo real por nombre, código o profesor.

## MÓDULO 5: CURSOS TÉCNICOS
*Ruta: /academico/cursos*

Gestión de cursos del Instituto de Carreras Técnicas.

Funcionalidades:
- Crear cursos con: nombre, descripción, docente, período, estado
  (activo/finalizado/planificado), capacidad máxima, inscritos,
  horario, modalidad (presencial/virtual/mixto).
- Tarjetas con indicador de cupo (inscritos/capacidad).
- Búsqueda por nombre o docente.

## MÓDULO 6: CALIFICACIONES
*Ruta: /academico/calificaciones*

Registro y seguimiento de notas de estudiantes.

Funcionalidades:
- Registrar calificaciones: estudiante, curso, nota (0-100), tipo de
  evaluación (examen/tarea/proyecto/participación/final), período,
  observaciones.
- Tabla con código de color según nota:
  - Verde: ≥90 (excelente)
  - Azul: 70-89 (aprobado)
  - Amarillo: 60-69 (marginal)
  - Rojo: <60 (reprobado)
- Búsqueda por estudiante o curso.

## MÓDULO 7: HISTORIAL ACADÉMICO
*Ruta: /academico/historial*

Registro histórico de calificaciones agrupado por estudiante.

Funcionalidades:
- Estadísticas: total evaluaciones, promedio general, aprobados.
- Agrupación por estudiante con promedio individual.
- Filtro por período académico.
- Búsqueda por estudiante o curso.
- Badge de promedio con color (verde ≥70, rojo <70).

## MÓDULO 8: PREMATRÍCULA
*Ruta: /academico/prematricula*

Gestión de inscripciones y asignación de materias por período.

Funcionalidades:
- Inscribir estudiantes en cursos seleccionando de dropdowns.
- Estadísticas: total inscritos, pendientes (nota=0), activos (nota>0).
- Lista de todas las inscripciones registradas con su estado.

## MÓDULO 9: PERÍODOS / CUATRIMESTRES
*Ruta: /academico/periodos*

Gestión de períodos académicos institucionales.

Funcionalidades:
- Crear períodos con: nombre (ej: 2026-I), fechas de inicio/fin,
  estado (planificado/activo/completado), cantidad de cursos.
- Tarjetas con badge de estado y color.
- Estadísticas: activos, completados, planificados.

## MÓDULO 10: ACADEMIAS / PROGRAMAS
*Ruta: /academias/programas*

Programas de liderazgo y desarrollo de habilidades.

Funcionalidades:
- Crear academias: nombre, tipo (liderazgo/habilidades/otro),
  descripción, facilitador, estado, participantes, fechas.
- Tarjetas con icono según tipo, conteo de participantes y fechas.

## MÓDULO 11: MATERIALES EDUCATIVOS
*Ruta: /academias/materiales*

Recursos y materiales de las academias.

Funcionalidades:
- Registrar materiales: título, descripción, academia asociada,
  tipo (documento/video/presentación/enlace/otro), archivo, autor.
- Tarjetas con icono según tipo de material.

## MÓDULO 12: PATROCINADORES
*Ruta: /patrocinadores*

Gestión de patrocinadores de la fundación.

Funcionalidades:
- Registrar patrocinadores: nombre, tipo (persona/empresa/iglesia/
  ong/otro), email, teléfono, país, estado, aporte mensual (USD),
  notas.
- Estadísticas: total patrocinadores, aporte mensual total estimado,
  países de origen.
- Filtros por estado (activos/inactivos).
- Vista responsive: tarjetas en mobile, tabla en desktop.

## MÓDULO 13: ASIGNACIÓN DE BECAS
*Ruta: /patrocinadores/becas*

Gestión de becas estudiantiles y su relación con patrocinadores.

Funcionalidades:
- Vista de estudiantes becados con su programa y estado.
- Vista de patrocinadores activos con su aporte mensual.
- Formulario para nueva asignación (estudiante + patrocinador + monto).
- Estadísticas: becados, patrocinadores activos, aporte mensual total.

## MÓDULO 14: CONTABILIDAD
*Ruta: /contabilidad*

Control de ingresos, egresos y becas otorgadas.

Funcionalidades:
- Registrar transacciones: concepto, tipo (ingreso/egreso), monto,
  categoría (beca/donacion/operativo/salario/material/evento/otro),
  fecha, referencia, notas.
- Estadísticas: total ingresos, total egresos, balance neto.
- Filtros por tipo (todos/ingresos/egresos).
- Tabla con monto coloreado (verde ingresos, rojo egresos).

## MÓDULO 15: SOLICITUDES Y APROBACIONES
*Ruta: /administrativo/solicitudes · Tablas: solicitud, solicitud_paso*

Una sola bandeja con flujo por pasos para los trámites del estudiante
y las aprobaciones internas. Sustituye al antiguo módulo de psicología
(retirado en oct 2026 con el departamento).

Tipos de solicitud:
- Trámites del estudiante (los crea el estudiante, módulo 22):
  constancia, carta, cita_administracion, permiso, otro. Revisa quien
  tenga solicitudes.gestionar.
- alta_expediente: pasar un candidato del embudo a estudiante activo.
  La crea quien tenga expedientes.postular o expedientes.escribir.
  Lleva estudiante. Revisa solicitudes.gestionar. Un nivel.
- beca: asignar o cambiar una beca. La crea patrocinadores.escribir.
  Lleva estudiante y monto opcional. Revisa solicitudes.gestionar y
  SIEMPRE requiere segundo nivel de dirección (solicitudes.direccion).
- gasto: solicitud de gasto o compra. La crea cualquier miembro del
  personal. Monto obligatorio (USD). Revisa finanzas.escribir. Requiere
  dirección si el monto es ≥ 1,000 USD.

Flujo de estados:
  enviada → en_revision → [pendiente_direccion] → aprobada → completada
- Desde enviada, en_revision o pendiente_direccion se puede rechazar
  (comentario obligatorio).
- El solicitante puede cancelar mientras esté en enviada o en_revision.

Reglas de control:
- Separación de funciones: nadie aprueba su propia solicitud.
- El segundo nivel se fija al crear (requiere_direccion), para que un
  cambio de umbral no altere solicitudes en curso.
- "Aprobada" es la decisión; "completada" es que el módulo dueño ya la
  ejecutó (la constancia se entregó, el gasto se registró en
  contabilidad, el expediente pasó a activo). La solicitud no ejecuta
  efectos por su cuenta.
- Cada paso queda en solicitud_paso (quién, cuándo, de qué estado a
  cuál, comentario): línea de tiempo visible al solicitante.
- Notificaciones en la campana (sin correo): al crear, a los
  revisores; al pasar a dirección, a quien tenga solicitudes.direccion;
  en cada cambio, al solicitante. Aprobar, rechazar y completar se
  registran en audit_log.
- Folio numérico legible para referirse a cada solicitud.

Funcionalidades:
- Pestaña "Por atender" según los permisos de quien mira.
- Pestaña "Mis solicitudes" con línea de tiempo.
- Alta de solicitud interna (alta_expediente, beca, gasto).
- Acciones del flujo con comentario: tomar, enviar a dirección,
  aprobar, rechazar, completar.
- El portal administrativo cuenta las solicitudes por atender.

## MÓDULO 16: GESTIÓN DE TAREAS
*Ruta: /administrativo/tareas*

Sistema de gestión de tareas tipo Kanban con notificaciones.

Funcionalidades:
- Tablero Kanban con 3 columnas: Pendiente / En Progreso / Completada.
- Crear tareas: título, descripción, prioridad (baja/media/alta/
  urgente), fecha límite, proyecto, visibilidad (todos/asignados).
- Asignación múltiple de usuarios mediante checkboxes.
- Control de visibilidad: admin ve todo; usuarios regulares solo ven
  tareas públicas o asignadas a su email.

AUTOMATIZACIONES AL CREAR TAREA:
- Envío automático de correo a cada usuario asignado con los detalles.
- Creación automática de evento en el calendario para cada asignado
  (tipo administrativo, con fecha límite como fecha del evento).
- Actualización de las vistas de calendario y tareas.

- Cambio de estado mediante menú desplegable en cada tarjeta.

## MÓDULO 17: PROYECTOS
*Ruta: /administrativo/proyectos*

Gestión y seguimiento de proyectos de la fundación.

Funcionalidades:
- Crear proyectos: nombre, descripción, responsable, estado
  (planificación/en_curso/completado/pausado), fechas inicio/fin,
  progreso (%).
- Tarjetas con barra de progreso visual.
- Badge de estado con color.

## MÓDULO 18: GESTIÓN DE PERSONAL
*Ruta: /administrativo/personal*

Usuarios internos del sistema y control de roles y permisos.

Funcionalidades:
- Lista de usuarios registrados con búsqueda.
- Estadísticas: total usuarios, administradores, usuarios regulares.
- Tarjeta informativa de roles y permisos del sistema:
  - Super admin, Admin, Docente, Estudiante, Contabilidad,
    Habitudes — con descripción y permisos de cada rol.

## MÓDULO 19: CALENDARIO Y AGENDA
*Ruta: /calendario*

Planificación de eventos, actividades y tareas.

Funcionalidades:
- Vista de calendario mensual con navegación entre meses.
- Puntos indicadores en cada día: azules para eventos, naranjas para
  tareas con vencimiento.
- Panel lateral con detalle del día seleccionado (eventos + tareas).
- Crear eventos: título, descripción, tipo (académico/administrativo/
  social/reunión/otro), fecha, hora inicio/fin, ubicación, responsable,
  estado.
- Vista de agenda: próximos 30 días combinando eventos y tareas.
- Los eventos creados desde el módulo de tareas aparecen aquí
  automáticamente.

## MÓDULO 20: CHAT IA INTERNO
*Ruta: /chat-ia*

Asistente con inteligencia artificial para consultas institucionales.

Funcionalidades:
- Chat interactivo con historial de mensajes (markdown renderizado).
- La IA recibe contexto en tiempo real de la base de datos:
  estudiantes, cursos, academias, patrocinadores, eventos, tareas,
  finanzas (ingresos, egresos, balance).
- Prompts rápidos sugeridos (botones de acceso directo).
- Respuestas en español, claras y concisas.
- Botón de reiniciar conversación.

## MÓDULO 21: CHAT IA ESTUDIANTIL
*Ruta: /chat-ia-estudiantil*

Asistente IA orientado a estudiantes para consultas académicas.

## MÓDULO 22: SOLICITUDES DEL ESTUDIANTE
*Ruta: /portal/estudiante/solicitudes*

La mitad estudiantil del módulo 15. Sustituye a la antigua cita de
psicología.

Funcionalidades:
- Formulario de trámite: constancia (de estudios o de beca), carta
  (recomendación o referencia), cita con administración (fecha y hora
  preferidas), permiso o ausencia, otro.
- "Mis solicitudes" con estado, folio y línea de tiempo de cada paso.
- Cancelar mientras la solicitud esté enviada o en revisión.
- Las citas con administración aprobadas o en curso aparecen en el
  calendario del estudiante.

## MÓDULO 23: REPORTES VISUALES
*Ruta: /reportes*

Dashboard analítico con gráficos interactivos (Recharts).

3 secciones por pestañas:

  PROYECTOS:
- KPIs: total, en curso, completados, avance promedio.
- Gráfico circular: distribución por estado.
- Gráfico de barras horizontales: % de avance por proyecto.
- Gráfico de barras apiladas: tareas por proyecto (completadas/
    pendientes/en progreso).

  ACADÉMICO:
- KPIs: total registros, promedio general, aprobados, reprobados.
- Gráfico de barras: distribución de calificaciones en rangos
    (90-100, 80-89, 70-79, 60-69, <60).
- Gráfico de barras: promedio por tipo de evaluación.
- Gráfico de barras horizontales: promedio por curso.

  CONTABILIDAD:
- KPIs: ingresos, egresos, balance neto, total transacciones.
- Gráfico de área: evolución mensual (últimos 6 meses).
- Gráfico de barras horizontales: ingresos vs egresos por categoría.
- Gráfico circular: distribución de egresos por categoría.

## MÓDULO 24: SERVICIOS MENSUALES
*Ruta: /servicios-mensuales*

Control mensual de servicios comunitarios y reuniones de estudiantes.

Funcionalidades:
- Selector de mes (últimos 12 meses).
- Tabla tipo Excel con toggles visuales:
  - ¿Hizo servicio mensual? (check verde / X roja)
  - ¿Asistió a reunión mensual? (check morado / X roja)
- Estadísticas: activos, hicieron servicio, asistieron reunión.
- Exportación a PDF imprimible con formato profesional.

## MÓDULO 25: INSCRIPCIÓN DE COMIDA
*Ruta: /comida (pública, sin login) | /inscripcion-comida (con layout)*

Sistema de inscripción para el almuerzo con pre-registro semanal. *(Implementado)*

Funcionalidades:
- Acceso público (ruta /comida) — no requiere autenticación.
- **Inscripción de varios días de una vez** (pre-registro semanal): el usuario
  elige varios días hábiles y se crea una fila por fecha; cada día, la lista
  del administrador muestra automáticamente a quienes tienen fila para esa
  fecha (sin re-inscribirse). Backend: `inscribirVariosDias`.
- Límite horario: el **día en curso** cierra a las 8:30 AM; los **días futuros**
  se pueden pre-registrar en cualquier momento. Días pasados y hoy-cerrado se
  rechazan por día (desglose confirmados/duplicados/rechazados).
- Validación: no duplicar inscripciones del mismo día (`UNIQUE (nombre, fecha)`).
- **Vista de administración imprimible** (`/inscripcion-comida`, requiere
  `operaciones.leer`): lista por fecha con navegación entre días, indicador
  **Cerrado/Abierto** (tras las 8:30) y botón **Imprimir** (limpio, sin sidebar).
- Notificación de cierre a administradores (`notificarListaComida`), pensada
  para dispararse por tarea programada (n8n / pg_cron) tras las 8:30 AM.
- Vista pública: contador de inscritos de hoy (sin nombres visibles).

## MÓDULO 26: CONFIGURACIÓN
*Ruta: /configuracion*

Administración de usuarios y roles del sistema.

Funcionalidades:
- Tabla de usuarios del sistema (nombre, email, rol).
- Información del sistema: versión y módulos.
- Roles disponibles con descripciones.

## MÓDULO 27: MAPA DE NAVEGACIÓN (SITEMAP)
*Ruta: /sitemap*

Visualización jerárquica de toda la estructura de navegación.

Funcionalidades:
- 4 portales principales con sub-módulos navegables:
  - Portal Estudiante
  - Portal Profesor
  - Portal Administrativo
  - Portal Cursos Técnicos
- Módulos compartidos (Dashboard, Calendario, Inscripción Comida).
- Flujos de navegación automáticos documentados.

## PORTALES POR ROL (Dashboards)
*───────────────────────────────────────────────────────────────── · PORTAL ESTUDIANTE  (Ruta: /portal/estudiante) · • Banner con promedio, GPA y materias aprobadas. · • Accesos: materias, calificaciones, solicitudes. · • Lista de materias activas. · • Calificaciones por cuatrimestre con letra (A-F) y GPA. · • Condición en la fundación (servicios y reuniones últimos 3 meses). · • Próximos eventos. · PORTAL PROFESOR  (Ruta: /portal/profesor) · • Banner con cursos activos, inscritos totales, notas registradas. · • Accesos: cursos, materias, calificaciones, calendario. · • Lista de cursos activos con modalidad e inscritos. · PORTAL ADMINISTRATIVO  (Ruta: /portal/administrativo) · • Banner con tareas pendientes, proyectos activos, estudiantes, solicitudes por atender. · • 8 accesos: expedientes, patrocinadores, tareas, proyectos, · servicios mensuales, lista de comida, calendario, chat IA. · • Lista de tareas urgentes / alta prioridad. · PORTAL CONTABILIDAD  (Ruta: /portal/contabilidad) · • Banner con ingresos, egresos y balance. · • Accesos: contabilidad, reportes. · • Últimas transacciones registradas. · ENTRADA HABITUDES  (Ruta: /expedientes) · • Postulación de candidatos del embudo de reclutamiento. · PORTAL CURSOS TÉCNICOS  (Ruta: /portal/cursos-tecnicos) · • Selector entre Portal de Estudiantes y Portal de Docentes.*

  COMPONENTES PRINCIPALES
─────────────────────────────────────────────────────────────────

LAYOUT:
- AppLayout: Layout principal con sidebar + topbar + área de contenido.
- Sidebar: Navegación lateral que cambia según rol del usuario.
  Incluye menús expandibles y cierre de sesión.
- TopBar: Barra superior con título de página y acciones.

COMPONENTES DE EXPEDIENTES:
- ExpedienteDetalle: Modal con vista completa del estudiante
  (datos personales, académicos, familiares, seguimiento) con
  cálculos de GPA y gráficos de rendimiento.
- FormFamiliar: Formulario de datos familiares y condiciones de
  vivienda (padre, madre, tutor, hermanos, casa, baños, camas).
- FormSeguimiento: Formulario de seguimiento administrativo
  (amonestaciones, solicitudes, correo patrocinador, reuniones,
  salud, alergias).

COMPONENTES COMPARTIDOS:
- BuscadorEstudiantes: Buscador con dropdown que resalta coincidencias
  y muestra avatares, badges de estado y biografías.
- PageHeader: Encabezado estándar con título, descripción, botón de
  acción y contenido personalizado.
- EmptyState: Estado vacío con icono, mensaje y acción opcional.
- StatCard: Tarjeta de estadística con icono, valor y subtítulo.

AUTENTICACIÓN Y ACCESO:
- Manejo de sesión y estado de autenticación (loading, errores de
  usuario no registrado o autenticación requerida).
- Manejo del rol activo del usuario para mostrar/ocultar menús.
- Protección de rutas que requieren autenticación.
- Pantalla para usuario autenticado pero no registrado en el sistema.

## FLUJOS AUTOMATIZADOS PRINCIPALES
*───────────────────────────────────────────────────────────────── · 1. OCR → EXPEDIENTE: · Subir documento → almacenamiento de archivos → la IA extrae datos → · Guarda en perfil del estudiante existente / llena formulario. · 2. TAREA → NOTIFICACIÓN: · Crear tarea con asignados → correo a cada usuario → · Crear evento en Calendario → Refrescar vistas. · 3. INSCRIPCIÓN COMIDA: · Usuario escribe nombre → Validar hora (≤8:30 AM) → · Validar no duplicado → Crear registro → Confirmación. · 4. SERVICIOS MENSUALES: · Toggle en tabla → Si existe registro: update → · Si no existe: create → Refrescar lista. · 5. CHAT IA: · Construir contexto con datos de las entidades → · Enviar a la IA con la pregunta → Renderizar respuesta markdown. · 6. SOLICITUD → APROBACIÓN: · Crear solicitud → notificar a revisores → · En revisión → [dirección] → Aprobada / Rechazada → · El módulo dueño ejecuta → Completada (cada paso en solicitud_paso).*
