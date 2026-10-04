================================================================
  GLOBAL EFFECT NEXUS — INVENTARIO COMPLETO DEL SISTEMA
  Páginas, Subpáginas, Login, Módulos, Formularios y Botones
  Fecha: 2026-07-02 · Revisado: 2026-10 (cambio de alcance a ERP)
================================================================

NOTA DE ALCANCE (octubre 2026): la Fundación eliminó el departamento
de Psicología. El sistema se describe ahora como un ERP institucional
(sistema de gestión + portal del estudiante integrado). Este inventario
ya no lista el portal, el módulo ni la cita de psicología; el
expediente pasa a ser de Administración (admin / super_admin), y en su
lugar aparece el módulo Solicitudes y aprobaciones.

══════════════════════════════════════════════════════════════════
  SECCIÓN 1: SISTEMA DE AUTENTICACIÓN Y LOGIN
══════════════════════════════════════════════════════════════════

La autenticación es gestionada por la plataforma Base44 (BaaS).
No existe una página de login personalizada — el sistema usa el
login nativo de Base44.

ARCHIVOS RELACIONADOS:
─────────────────────
• src/lib/AuthContext.jsx  → Contexto de autenticación
• src/components/ProtectedRoute.jsx → Protección de rutas
• src/components/UserNotRegisteredError.jsx → Pantalla de error

FLUJO DE AUTENTICACIÓN:
──────────────────────
1. AuthProvider verifica el estado al cargar la app:
   - Consulta /api/apps/public para obtener configuración pública.
   - Si hay token → llama base44.auth.me() para obtener el usuario.
   - Si no hay token → marca como no autenticado.

2. Pantalla de carga ("Cargando plataforma...") mientras verifica.

3. Posibles resultados:
   a) Usuario autenticado y registrado → muestra la app.
   b) auth_required → redirige al login de Base44
      (base44.auth.redirectToLogin()).
   c) user_not_registered → muestra UserNotRegisteredError
      ("Access Restricted - You are not registered to use this
      application. Please contact the app administrator").
   d) Error desconocido → muestra mensaje de error.

4. Logout: base44.auth.logout() limpia el token y redirige.

ROLES DISPONIBLES (src/lib/RoleContext.jsx):
──────────────────────────────────────────
• admin          → Administrador (acceso total)
• estudiante     → Estudiante — Curso Técnico
• profesor       → Docente — Cursos Técnicos
• administrativo → Administrativo (dueño del expediente)
• contabilidad   → Contabilidad

Los usuarios no se registran directamente; deben ser invitados
por un administrador (base44.users.inviteUser).


══════════════════════════════════════════════════════════════════
  SECCIÓN 2: ESTRUCTURA DE NAVEGACIÓN (APP ROUTER)
══════════════════════════════════════════════════════════════════

Archivo: src/App.jsx

RUTAS PÚBLICAS (sin autenticación):
──────────────────────────────────
• /              → Inicio (landing page)
• /comida        → Inscripción de Comida (pública, sin login)

RUTAS CON LAYOUT (requieren autenticación, AppLayout):
─────────────────────────────────────────────────────
• /dashboard                       → Dashboard general
• /portal/estudiante               → Portal Estudiante
• /portal/profesor                 → Portal Profesor
• /portal/administrativo           → Portal Administrativo
• /portal/contabilidad             → Portal Contabilidad
• /portal/cursos-tecnicos          → Portal Cursos Técnicos (selector)
• /portal/estudiante-ct            → Portal Estudiante CT
• /academico/cursos                → Cursos Técnicos
• /academico/materias              → Materias
• /academico/calificaciones        → Calificaciones
• /academico/historial             → Historial Académico
• /academico/prematricula          → Prematrícula
• /academico/periodos              → Períodos / Cuatrimestres
• /academias/programas             → Academias / Programas
• /academias/materiales            → Materiales Educativos
• /patrocinadores                  → Patrocinadores
• /patrocinadores/becas            → Asignación de Becas
• /expedientes                     → Expedientes Estudiantiles
• /administrativo/tareas           → Gestión de Tareas
• /administrativo/proyectos        → Proyectos
• /administrativo/personal         → Gestión de Personal
• /administrativo/solicitudes      → Solicitudes y aprobaciones (bandeja del personal)
• /contabilidad                    → Contabilidad
• /reportes                        → Reportes Visuales
• /chat-ia                         → Chat IA Interno
• /chat-ia-estudiantil             → Chat IA Estudiantil
• /portal/estudiante/solicitudes   → Mis solicitudes (trámites del estudiante)
• /calendario                      → Calendario y Agenda
• /configuracion                   → Configuración
• /servicios-mensuales             → Servicios Mensuales
• /inscripcion-comida              → Inscripción de Comida (con layout)
• /sitemap                         → Mapa de Navegación
• *                                → PageNotFound (404)


══════════════════════════════════════════════════════════════════
  SECCIÓN 3: MENÚS LATERALES POR ROL (Sidebar.jsx)
══════════════════════════════════════════════════════════════════

MENÚ ADMIN:
──────────
• Dashboard
• Académico (expandible):
    - Cursos
    - Materias
    - Calificaciones
    - Historial
    - Prematrícula
    - Períodos
• Academias (expandible):
    - Programas
    - Materiales
• Expedientes
• Patrocinadores (expandible):
    - Lista
    - Becas
• Administrativo (expandible):
    - Tareas
    - Proyectos
    - Personal
    - Solicitudes
• Servicios Mensuales
• Lista de Comida
• Contabilidad
• Reportes
• Chat IA Admin
• Calendario
• Configuración
• Mapa del Sitio

MENÚ ESTUDIANTE:
──────────────
• Mi Portal
• Mis Materias
• Calificaciones
• Mis Solicitudes

MENÚ PROFESOR:
─────────────
• Mi Portal
• Mis Materias
• Calificaciones
• Cursos
• Calendario

MENÚ ADMINISTRATIVO:
───────────────────
• Mi Portal
• Expedientes
• Patrocinadores
• Servicios Mensuales
• Lista de Comida
• Tareas
• Proyectos
• Solicitudes
• Calendario
• Chat IA

MENÚ CONTABILIDAD:
─────────────────
• Mi Portal
• Contabilidad
• Solicitudes (revisa las de gasto)
• Reportes

BOTONES DEL SIDEBAR:
───────────────────
• Botón "Cambiar Portal" (logout/volver al inicio)
• Botón "Contraer" (colapsar sidebar en desktop)
• Botón X (cerrar sidebar en mobile)


══════════════════════════════════════════════════════════════════
  SECCIÓN 4: INVENTARIO POR PÁGINA
══════════════════════════════════════════════════════════════════

──────────────────────────────────────────────────────────────────
PÁGINA: INICIO (Landing Pública)
Archivo: src/pages/Inicio.jsx | Ruta: /
──────────────────────────────────────────────────────────────────
Página pública, no requiere login.

ELEMENTOS:
• Navbar sticky con logo y enlaces (Portales, Eventos, Contacto)
• Hero slider rotativo (3 slides automático cada 6s):
    Slide 1: "Transformando Vidas a Través de la Educación"
    Slide 2: "Becas Universitarias 2026"
    Slide 3: "Reunión de Coordinación Docente"
• Controles del slider: botón anterior, botón siguiente, indicadores
• Barra de estadísticas: 1,200+ estudiantes, 86 materias, 340+
  patrocinadores, 98% satisfacción
• 5 tarjetas de portales (clickeables):
    - Administración Global
    - Contabilidad y Finanzas
    - Cursos Técnicos
    - Portal Administrativo
    - Portal del Estudiante (trámites y solicitudes)
• Sección "Próximos Eventos" (datos de entidad Evento)
• Sección "Propuesta de valor" (3 tarjetas):
    - Acceso Seguro por Roles
    - Reportes en Tiempo Real
    - Asistente IA Integrado
• Footer con enlaces y redes sociales

BOTONES:
• "Inscripción de Comida" (navega a /comida)
• Botones de cada slide (Cursos Técnicos, Ver Requisitos, Ver
  Calendario)
• 5 botones de tarjetas de portal ("Acceder al portal")
• "Ver todos" (eventos)

──────────────────────────────────────────────────────────────────
PÁGINA: DASHBOARD
Archivo: src/pages/Dashboard.jsx | Ruta: /dashboard
──────────────────────────────────────────────────────────────────
Panel de control para administradores.

ELEMENTOS:
• Banner hero con resumen (estudiantes activos, becados, patrocinadores)
• 4 tarjetas StatCard:
    - Estudiantes Activos
    - Cursos Activos
    - Tareas Pendientes
    - Balance Mes
• 4 accesos rápidos (clickeables): Expedientes, Patrocinadores,
  Solicitudes, Chat IA
• Gráfico de barras: Flujo Financiero (Ingresos vs Egresos por mes)
• Gráfico circular: Tipos de Estudiantes (Becados vs Regulares)
• Tarjeta "Próximos Eventos" (lista de eventos programados)
• Tarjeta "Tareas Prioritarias" (lista de tareas no completadas)

BOTONES:
• Links de accesos rápidos (4 tarjetas)

──────────────────────────────────────────────────────────────────
PÁGINA: EXPEDIENTES ESTUDIANTILES
Archivo: src/pages/Expedientes.jsx | Ruta: /expedientes
──────────────────────────────────────────────────────────────────
El módulo más completo. CRUD de 75 campos por estudiante. El
expediente es de Administración: admin y super_admin lo leen, editan y
eliminan sobre todos los estudiantes; habitudes solo postula
candidatos. El paso de candidato a activo pasa por una solicitud
"alta_expediente" (ver Solicitudes y aprobaciones).

ELEMENTOS PRINCIPALES:
• PageHeader con título y buscador inteligente (BuscadorEstudiantes)
• Pestañas de filtro: Todos / Becados Universitarios / Cursos Técnicos
• Grid de tarjetas de estudiantes con:
    - Foto o inicial
    - Nombre, cédula
    - Email, ciudad, programa
    - Badge de estado (activo/inactivo/graduado/suspendido)
    - Badge de tipo (becado/curso técnico)
    - Botones de editar y eliminar

FORMULARIO (Dialog modal, 6 pestañas):
  Pestaña 1 - PERSONAL:
    • Nombre Completo * (Input, obligatorio)
    • Cédula / DUI (Input)
    • Teléfono (Input)
    • Email (Input)
    • Fecha de Nacimiento (Input date)
    • Nacionalidad (Input)
    • Sexo (Select: masculino/femenino)
    • Religión (Input)
    • Comunidad (Input)
    • Dirección (Input)
    • Ciudad (Input)
    • País (Input)

  Pestaña 2 - ACADÉMICO:
    • Tipo de Estudiante (Select: regular/becado)
    • Estado (Select: activo/inactivo/graduado/suspendido)
    • ¿Qué estudia? (Input)
    • ¿Dónde estudia? (Input)
    • Universidad (Input, solo becados)
    • Patrocinador (Input, solo becados)
    • Fecha de Ingreso (Input date)
    • Motivo de la Beca (Textarea, solo becados)
    • Metas Académicas y Profesionales (Textarea)

  Pestaña 3 - HABITUDES:
    • Facilitador de Habitudes (Input)
    • Centro Educativo (Input)
    • Director del Centro (Input)
    • Breve Historia de Habitudes (Textarea)
    • Imagen de Habitudes (upload de archivo)

  Pestaña 4 - FAMILIA (FormFamiliar.jsx):
    • Padre: nombre, edad, teléfono, profesión
    • Madre: nombre, edad, teléfono, profesión
    • Tutor: nombre, edad, teléfono, profesión
    • Madrastra: nombre, edad, teléfono, profesión
    • Padrastro: nombre, edad, teléfono, profesión
    • Con quién vive (Input)
    • Por qué vive con esa persona (Input)
    • Cantidad de hermanos (Input)
    • Nombres y edades de hermanos (Input)
    • Nombres y edades de hermanas (Input)
    • Casa propia (Select: sí/no/alquilada/prestada)
    • Tipo de casa (Input)
    • Baño (Select: dentro/fuera)
    • Número de habitaciones (Input number)
    • Número de camas (Input number)
    • Quiénes duermen en cada cama (Input)

  Pestaña 5 - HISTORIA:
    • Historia de Vida (Textarea)
    • Situación Familiar (Textarea)
    • Situación Económica (Textarea)

  Pestaña 6 - SEGUIMIENTO (FormSeguimiento.jsx):
    • Enfermedades (Textarea)
    • Alergias (Textarea)
    • Contacto de emergencia: nombre, teléfono
    • Amonestaciones del cuatrimestre (Textarea)
    • Solicitudes pendientes (Textarea)
    • Envío correo patrocinador (Select: sí/no/pendiente)
    • Asistió reunión mensual (Select: sí/no/justificado)
    • Notas adicionales (Textarea)

BOTONES DE ACCIÓN:
• "Nuevo Expediente" (abre formulario vacío)
• Botón editar (lápiz) en cada tarjeta
• Botón eliminar (basura) en cada tarjeta con confirmación
• Botón OCR "Subir y escanear documento" (sube imagen/PDF, IA extrae)
• Botón "Subir foto del estudiante" (upload de imagen)
• Botón "Subir imagen de Habitudes" (upload de imagen)
• Botón "Cancelar" (cierra formulario)
• Botón "Crear Expediente" / "Guardar Cambios"

VISTA DE DETALLE (ExpedienteDetalle.jsx - modal):
• Pestañas: Personal, Académico, Habitudes, Familia, Historia, Seguimiento
• Calcula GPA, promedio, tendencia con gráficos
• Botón "Editar" (abre formulario precargado)

──────────────────────────────────────────────────────────────────
PÁGINA: MATERIAS
Archivo: src/pages/academico/Materias.jsx | Ruta: /academico/materias
──────────────────────────────────────────────────────────────────
CRUD completo de materias.

ELEMENTOS:
• PageHeader con búsqueda
• Vista mobile: tarjetas / Vista desktop: tabla
• Tabla con columnas: Código, Materia, Cuatrimestre, Profesor,
  Créditos, Horario, Estado, Acciones

FORMULARIO (Dialog):
• Nombre (Input, obligatorio)
• Código (Input, ej: MAT-101)
• Cuatrimestre (Input, ej: 2025-I)
• Créditos (Input number)
• Aula (Input)
• Profesor (Input)
• Horario (Input, ej: Lun-Mié 8:00-10:00)
• Estado (Select: activa/inactiva)
• Descripción (Textarea)

BOTONES:
• "Nueva Materia" (abre formulario)
• Botón editar (lápiz) por materia
• Botón eliminar (basura) por materia con confirmación
• "Crear Materia" / "Guardar Cambios"

──────────────────────────────────────────────────────────────────
PÁGINA: CURSOS TÉCNICOS
Archivo: src/pages/academico/Cursos.jsx | Ruta: /academico/cursos
──────────────────────────────────────────────────────────────────
Gestión de cursos técnicos.

ELEMENTOS:
• PageHeader con búsqueda
• Grid de tarjetas con: icono, estado, nombre, descripción,
  inscritos/capacidad, horario, docente

FORMULARIO (Dialog):
• Nombre (Input)
• Descripción (Textarea)
• Docente (Input)
• Período (Input)
• Capacidad (Input number)
• Modalidad (Select: presencial/virtual/mixto)
• Horario (Input)

BOTONES:
• "Nuevo Curso" (abre formulario)
• "Crear Curso"

──────────────────────────────────────────────────────────────────
PÁGINA: CALIFICACIONES
Archivo: src/pages/academico/Calificaciones.jsx | Ruta: /academico/calificaciones
──────────────────────────────────────────────────────────────────
Registro de notas.

ELEMENTOS:
• PageHeader con búsqueda
• Tabla con: Estudiante, Curso, Tipo, Nota (con color), Período

FORMULARIO (Dialog):
• Estudiante (Input)
• Curso (Input)
• Nota (Input number 0-100)
• Tipo (Select: examen/tarea/proyecto/participacion/final)
• Período (Input)
• Observaciones (Input, no visible en tabla)

BOTONES:
• "Registrar Nota" (abre formulario)
• "Registrar"

──────────────────────────────────────────────────────────────────
PÁGINA: HISTORIAL ACADÉMICO
Archivo: src/pages/academico/HistorialAcademico.jsx | Ruta: /academico/historial
──────────────────────────────────────────────────────────────────
Solo lectura. Agrupación por estudiante.

ELEMENTOS:
• PageHeader
• 3 tarjetas: Evaluaciones, Promedio, Aprobados
• Búsqueda por estudiante o curso
• Filtro por período (Select)
• Tarjetas agrupadas por estudiante con:
    - Promedio individual (badge verde/rojo)
    - Lista de notas con color

BOTONES:
• Sin botones de acción (solo filtros y búsqueda)

──────────────────────────────────────────────────────────────────
PÁGINA: PREMATRÍCULA
Archivo: src/pages/academico/Prematricula.jsx | Ruta: /academico/prematricula
──────────────────────────────────────────────────────────────────
Inscripción de estudiantes en cursos.

ELEMENTOS:
• 3 tarjetas: Total Inscritos, Pendientes, Activas
• Lista de inscripciones

FORMULARIO (Dialog):
• Estudiante (Select dropdown de estudiantes)
• Curso / Materia (Select dropdown de cursos)
• Período (Input, ej: 2025-I)

BOTONES:
• "Nueva Inscripción" (abre formulario)
• "Registrar Inscripción"

──────────────────────────────────────────────────────────────────
PÁGINA: PERÍODOS / CUATRIMESTRES
Archivo: src/pages/academico/Periodos.jsx | Ruta: /academico/periodos
──────────────────────────────────────────────────────────────────
Gestión de períodos académicos (datos estáticos).

ELEMENTOS:
• 3 tarjetas: Activos, Completados, Planificados
• Grid de tarjetas con: nombre, fechas, cursos asignados

FORMULARIO (Dialog):
• Nombre del Período (Input, ej: 2026-II)
• Fecha Inicio (Input date)
• Fecha Fin (Input date)
• Estado (Select: planificado/activo/completado)

BOTONES:
• "Nuevo Período" (abre formulario)
• "Crear Período"

──────────────────────────────────────────────────────────────────
PÁGINA: ACADEMIAS / PROGRAMAS
Archivo: src/pages/academias/Programas.jsx | Ruta: /academias/programas
──────────────────────────────────────────────────────────────────
Programas de liderazgo y habilidades.

ELEMENTOS:
• Grid de tarjetas con: icono, estado, nombre, descripción,
  participantes, fechas, facilitador

FORMULARIO (Dialog):
• Nombre (Input)
• Tipo (Select: liderazgo/habilidades/otro)
• Descripción (Textarea)
• Facilitador (Input)
• Fecha Inicio (Input date)
• Fecha Fin (Input date)

BOTONES:
• "Nueva Academia" (abre formulario)
• "Crear Academia"

──────────────────────────────────────────────────────────────────
PÁGINA: MATERIALES EDUCATIVOS
Archivo: src/pages/academias/Materiales.jsx | Ruta: /academias/materiales
──────────────────────────────────────────────────────────────────
Recursos de academias.

ELEMENTOS:
• Grid de tarjetas con: icono según tipo, título, descripción,
  academia, autor

FORMULARIO (Dialog):
• Título (Input)
• Descripción (Textarea)
• Academia (Input)
• Tipo (Select: documento/video/presentacion/enlace/otro)
• Autor (Input)

BOTONES:
• "Nuevo Material" (abre formulario)
• "Agregar Material"

──────────────────────────────────────────────────────────────────
PÁGINA: PATROCINADORES
Archivo: src/pages/Patrocinadores.jsx | Ruta: /patrocinadores
──────────────────────────────────────────────────────────────────
Gestión de patrocinadores.

ELEMENTOS:
• 3 StatCards: Total Patrocinadores, Aporte Mensual, Países
• Filtros por estado (Tabs: Todos/Activos/Inactivos)
• Vista mobile: tarjetas / Vista desktop: tabla
• Tabla: Nombre, Tipo, País, Contacto, Aporte/mes, Estado

FORMULARIO (Dialog):
• Nombre (Input)
• Tipo (Select: persona/empresa/iglesia/ong/otro)
• País (Input)
• Email (Input)
• Teléfono (Input)
• Aporte mensual USD (Input number)
• Notas (Textarea)

BOTONES:
• "Nuevo Patrocinador" (abre formulario)
• "Registrar Patrocinador"

──────────────────────────────────────────────────────────────────
PÁGINA: ASIGNACIÓN DE BECAS
Archivo: src/pages/patrocinadores/AsignacionBecas.jsx | Ruta: /patrocinadores/becas
──────────────────────────────────────────────────────────────────
Relación becados-patrocinadores.

ELEMENTOS:
• 3 tarjetas: Estudiantes Becados, Patrocinadores Activos,
  Aporte Mensual Total
• Lista de estudiantes becados
• Lista de patrocinadores activos con aporte

FORMULARIO (Dialog):
• Estudiante (Select dropdown)
• Patrocinador (Select dropdown)
• Monto de Beca USD/mes (Input number)
• Notas (Input)

BOTONES:
• "Nueva Asignación" (abre formulario)
• "Registrar Asignación"

──────────────────────────────────────────────────────────────────
PÁGINA: SOLICITUDES Y APROBACIONES (PERSONAL)
Ruta: /administrativo/solicitudes · Tablas: solicitud, solicitud_paso
(migración 0031)
──────────────────────────────────────────────────────────────────
Bandeja única con flujo por pasos para trámites del estudiante y
aprobaciones internas.

ELEMENTOS:
• Pestaña "Por atender" (según los permisos de quien entra:
  solicitudes.gestionar, finanzas.escribir o solicitudes.direccion)
• Pestaña "Mis solicitudes" (las que creó la persona)
• Cada solicitud muestra folio, tipo, estado, solicitante,
  estudiante (si aplica), monto (si aplica) y línea de tiempo
• Línea de tiempo desde solicitud_paso: quién, cuándo, de qué estado
  a cuál, comentario

FORMULARIO "Nueva solicitud interna" (Dialog):
• Tipo (Select):
    - alta_expediente → pasar un candidato a estudiante activo
      (crea expedientes.postular o expedientes.escribir; un nivel)
    - beca → asignar o cambiar una beca (crea patrocinadores.escribir;
      monto opcional; siempre requiere dirección)
    - gasto → solicitud de gasto/compra (cualquier miembro del
      personal; monto USD obligatorio; revisa finanzas.escribir;
      requiere dirección si monto ≥ 1,000 USD)
• Título, detalle, estudiante (alta_expediente y beca), monto

FLUJO DE ESTADOS:
  enviada → en_revision → [pendiente_direccion] → aprobada → completada
  • rechazada: desde enviada / en_revision / pendiente_direccion,
    con comentario obligatorio
  • cancelada: por el solicitante mientras esté en enviada o
    en_revision

REGLAS:
• Nadie aprueba su propia solicitud (separación de funciones)
• requiere_direccion se fija al crear; un cambio de umbral no altera
  solicitudes en curso
• "Aprobada" es la decisión; "completada" es que el módulo dueño ya
  la ejecutó (la solicitud no ejecuta efectos por su cuenta)
• Cada paso notifica en la campana (sin correo): revisores al crear,
  dirección al pasar a pendiente_direccion, solicitante en cada cambio
• Aprobar, rechazar y completar quedan en audit_log

BOTONES:
• "Nueva solicitud"
• Acciones del flujo según el estado (pasar a revisión, aprobar,
  rechazar, completar, cancelar), cada una con comentario

──────────────────────────────────────────────────────────────────
PÁGINA: GESTIÓN DE TAREAS
Archivo: src/pages/administrativo/Tareas.jsx | Ruta: /administrativo/tareas
──────────────────────────────────────────────────────────────────
Tablero Kanban estilo Asana con notificaciones automáticas.

ELEMENTOS:
• Tablero de 3 columnas: Pendiente / En Progreso / Completada
• Tarjetas con: título, descripción, badges de prioridad,
  asignados, fecha límite, visibilidad
• Menú desplegable por tarea (cambiar estado)

FORMULARIO (Dialog):
• Título * (Input, obligatorio)
• Descripción (Textarea)
• Prioridad (Select: baja/media/alta/urgente)
• Fecha Límite (Input date)
• Proyecto (Input)
• Visibilidad (Select: asignados/todos)
• Asignar usuarios (lista con checkboxes, envía email automático)

BOTONES:
• "Nueva Tarea" (abre formulario, solo admin)
• Menú desplegable por tarea: Pendiente/En Progreso/Completada/Cancelar
• "Crear y Notificar" (crea tarea + envía emails + crea eventos)

AUTOMATIZACIONES:
• SendEmail a cada usuario asignado
• Crear Evento en calendario por cada asignado
• Invalidación de queries (tareas + eventos)

──────────────────────────────────────────────────────────────────
PÁGINA: PROYECTOS
Archivo: src/pages/administrativo/Proyectos.jsx | Ruta: /administrativo/proyectos
──────────────────────────────────────────────────────────────────
Gestión de proyectos.

ELEMENTOS:
• Grid de tarjetas con: estado, nombre, descripción, barra de
  progreso, responsable, fecha inicio

FORMULARIO (Dialog):
• Nombre (Input)
• Descripción (Textarea)
• Responsable (Input)
• Fecha Inicio (Input date)
• Fecha Fin (Input date)

BOTONES:
• "Nuevo Proyecto" (abre formulario)
• "Crear Proyecto"

──────────────────────────────────────────────────────────────────
PÁGINA: GESTIÓN DE PERSONAL
Archivo: src/pages/administrativo/GestionPersonal.jsx | Ruta: /administrativo/personal
──────────────────────────────────────────────────────────────────
Usuarios y roles.

ELEMENTOS:
• 3 tarjetas: Total Usuarios, Administradores, Usuarios Regulares
• Lista de usuarios con búsqueda
• 5 tarjetas de roles con permisos:
    - Admin, Estudiante, Profesor, Administrativo, Contabilidad

BOTONES:
• Sin botones de acción (solo búsqueda)

──────────────────────────────────────────────────────────────────
PÁGINA: CONTABILIDAD
Archivo: src/pages/Contabilidad.jsx | Ruta: /contabilidad
──────────────────────────────────────────────────────────────────
Control financiero.

ELEMENTOS:
• 3 StatCards: Total Ingresos, Total Egresos, Balance
• Filtros por tipo (Tabs: Todos/Ingresos/Egresos)
• Tabla: Concepto, Tipo, Categoría, Monto, Fecha

FORMULARIO (Dialog):
• Concepto (Input, obligatorio)
• Tipo (Select: ingreso/egreso)
• Monto (Input number, obligatorio)
• Categoría (Select: beca/donacion/operativo/salario/material/
  evento/otro)
• Fecha (Input date)
• Referencia (Input)

BOTONES:
• "Nueva Transacción" (abre formulario)
• "Registrar Transacción"

──────────────────────────────────────────────────────────────────
PÁGINA: CALENDARIO Y AGENDA
Archivo: src/pages/Calendario.jsx | Ruta: /calendario
──────────────────────────────────────────────────────────────────
Planificación de eventos.

ELEMENTOS:
• 2 pestañas: Calendario / Agenda próxima
• Vista calendario mensual con navegación (mes anterior/siguiente)
• Puntos indicadores: azules (eventos), naranjas (tareas)
• Panel lateral con detalle del día seleccionado
• Vista agenda: próximos 30 días combinando eventos + tareas

FORMULARIO (Dialog):
• Título * (Input, obligatorio)
• Descripción (Textarea)
• Tipo (Select: academico/administrativo/social/reunion/otro)
• Fecha * (Input date, obligatorio)
• Hora Inicio (Input time)
• Hora Fin (Input time)
• Ubicación (Input)
• Responsable (Input)

BOTONES:
• "Nuevo Evento" (abre formulario)
• Botón mes anterior (ChevronLeft)
• Botón mes siguiente (ChevronRight)
• Botón "Evento" en panel de día (crea evento con fecha precargada)
• "Agregar al Calendario"

──────────────────────────────────────────────────────────────────
PÁGINA: CHAT IA INTERNO
Archivo: src/pages/ChatIA.jsx | Ruta: /chat-ia
──────────────────────────────────────────────────────────────────
Asistente IA para administradores.

ELEMENTOS:
• Header con título y botón reiniciar
• 5 botones de prompts rápidos:
    - "¿Cuántos estudiantes becados hay activos?"
    - "¿Cuál es el curso con más inscritos?"
    - "¿Cuántos eventos hay programados este mes?"
    - "¿Cómo está el balance financiero actual?"
    - "Resume el estado general de la fundación"
• Área de mensajes (markdown renderizado)
• Input de texto + botón enviar
• Indicador de carga "Analizando datos..."

BOTONES:
• Botones de prompts rápidos (5)
• Botón enviar (Send)
• Botón reiniciar (RotateCcw)

CONTEXTO ENVIADO A LA IA:
• Estudiantes (total, activos, becados)
• Cursos (total, activos)
• Academias, Patrocinadores
• Eventos programados, Tareas pendientes
• Finanzas (ingresos, egresos, balance)
• Listado de estudiantes, cursos y patrocinadores

──────────────────────────────────────────────────────────────────
PÁGINA: CHAT IA ESTUDIANTIL
Archivo: src/pages/ChatIAEstudiantil.jsx | Ruta: /chat-ia-estudiantil
──────────────────────────────────────────────────────────────────
Asistente IA para estudiantes.

ELEMENTOS:
• Header con botón reiniciar
• 5 preguntas rápidas:
    - "¿Cuáles son los requisitos para mantener mi beca?"
    - "¿Cómo es el proceso de prematrícula?"
    - "¿Qué pasa si repruebo una materia?"
    - "¿Cuál es el reglamento de asistencia?"
    - "¿Cómo pido una constancia o una cita con administración?"
• Área de mensajes (markdown)
• Input + botón enviar
• Indicador de carga (puntos animados)

BOTONES:
• Botones de preguntas rápidas (5)
• Botón enviar (Send)
• Botón reiniciar (RotateCcw)

──────────────────────────────────────────────────────────────────
PÁGINA: MIS SOLICITUDES (ESTUDIANTE)
Ruta: /portal/estudiante/solicitudes
──────────────────────────────────────────────────────────────────
Trámites que el estudiante pide desde su portal.

ELEMENTOS:
• Formulario de trámite
• Lista "Mis solicitudes" con folio, estado y línea de tiempo

FORMULARIO:
• Tipo (Select):
    - constancia (de estudios o de beca)
    - carta (de recomendación o referencia)
    - cita_administracion (fecha y hora preferidas)
    - permiso (ausencia/permiso)
    - otro
• Título y detalle
• Fecha requerida / hora preferida (cita_administracion)

BOTONES:
• "Enviar solicitud"
• "Cancelar" (mientras esté en enviada o en_revision)

AUTOMATIZACIÓN:
• Notificación en la campana a quien tenga solicitudes.gestionar;
  el estudiante recibe una en cada cambio de estado
• Las cita_administracion aprobadas o en curso aparecen en su
  calendario

──────────────────────────────────────────────────────────────────
PÁGINA: REPORTES VISUALES
Archivo: src/pages/Reportes.jsx | Ruta: /reportes
──────────────────────────────────────────────────────────────────
Dashboard analítico con gráficos Recharts.

3 SECCIONES POR PESTAÑAS:

  Pestaña PROYECTOS:
  • KPIs: Total, En Curso, Completados, Avance Promedio
  • Gráfico circular: distribución por estado
  • Gráfico de barras: % avance por proyecto
  • Gráfico de barras apiladas: tareas por proyecto

  Pestaña ACADÉMICO:
  • KPIs: Total Registros, Promedio General, Aprobados, Reprobados
  • Gráfico de barras: distribución de calificaciones (rangos)
  • Gráfico de barras: promedio por tipo de evaluación
  • Gráfico de barras: promedio por curso

  Pestaña CONTABILIDAD:
  • KPIs: Ingresos, Egresos, Balance Neto, Transacciones
  • Gráfico de área: evolución mensual (6 meses)
  • Gráfico de barras: ingresos vs egresos por categoría
  • Gráfico circular: distribución de egresos

BOTONES:
• 3 pestañas de navegación (Proyectos/Académico/Contabilidad)

──────────────────────────────────────────────────────────────────
PÁGINA: SERVICIOS MENSUALES
Archivo: src/pages/ServiciosMensuales.jsx | Ruta: /servicios-mensuales
──────────────────────────────────────────────────────────────────
Control de servicios y reuniones.

ELEMENTOS:
• Selector de mes (Select, últimos 12 meses)
• 3 tarjetas: Activos, Hicieron servicio, Asistieron reunión
• Tabla tipo Excel con toggles:
    Columnas: #, Estudiante, Programa, Servicio mensual, Reunión mensual
    Cada toggle es un botón con icono (CheckCircle verde/morado o
    XCircle rojo)

BOTONES:
• "Imprimir PDF" (abre ventana de impresión con tabla formateada)
• Botones toggle por estudiante (servicio y reunión)

──────────────────────────────────────────────────────────────────
PÁGINA: INSCRIPCIÓN DE COMIDA
Archivo: src/pages/InscripcionComida.jsx | Rutas: /comida (pública), /inscripcion-comida
──────────────────────────────────────────────────────────────────
Sistema diario de inscripción para almuerzo.

ELEMENTOS:
• Header con icono, fecha actual y estado (abierto/cerrado)
• Indicador de hora límite (8:30 AM)
• Formulario de inscripción (nombre)
• Confirmación visual al inscribirse
• Vista admin: lista completa de inscritos + botón imprimir
• Vista usuario: contador de inscritos (sin nombres)

BOTONES:
• "Inscribirme para hoy" (registra inscripción)
• "Imprimir lista" (solo admin, imprime tabla)

VALIDACIONES:
• Hora ≤ 8:30 AM para inscribirse
• No duplicar inscripción del mismo día
• Nombre obligatorio
• Auto-refresh cada 30 segundos

──────────────────────────────────────────────────────────────────
PÁGINA: CONFIGURACIÓN
Archivo: src/pages/Configuracion.jsx | Ruta: /configuracion
──────────────────────────────────────────────────────────────────
Administración del sistema.

ELEMENTOS:
• Tabla de usuarios: Nombre, Email, Rol
• Tarjeta "Información del Sistema":
    - Plataforma, Versión (1.0.0 MVP), Módulos
• Tarjeta "Roles Disponibles":
    - Administrador, Docente, Estudiante, Personal

BOTONES:
• Sin botones de acción (solo visualización)

──────────────────────────────────────────────────────────────────
PÁGINA: MAPA DE NAVEGACIÓN (SITEMAP)
Archivo: src/pages/Sitemap.jsx | Ruta: /sitemap
──────────────────────────────────────────────────────────────────
Visualización jerárquica de toda la navegación.

ELEMENTOS:
• Nodo raíz "Global Effect — Plataforma" (link a /)
• 4 tarjetas de portales (expandibles al hacer clic):
    - Portal Estudiante (7 sub-módulos)
    - Portal Profesor (5 sub-módulos)
    - Portal Administrativo (9 sub-módulos)
    - Portal Cursos Técnicos (4 sub-módulos)
• Módulos compartidos: Dashboard, Calendario, Inscripción Comida
• Flujos de navegación automáticos (5 flujos documentados)

BOTONES:
• Link "Global Effect — Plataforma"
• Links "Ir al portal" por cada tarjeta
• Links de cada sub-módulo
• Click en tarjeta para expandir/colapsar


══════════════════════════════════════════════════════════════════
  SECCIÓN 5: PORTALES POR ROL (DASHBOARDS)
══════════════════════════════════════════════════════════════════

──────────────────────────────────────────────────────────────────
PORTAL ESTUDIANTE
Archivo: src/pages/portales/PortalEstudiante.jsx | Ruta: /portal/estudiante
──────────────────────────────────────────────────────────────────
• Banner con promedio %, GPA, materias aprobadas
• 3 accesos: Mis Materias, Calificaciones, Mis Solicitudes
• Lista de materias activas
• Calificaciones por cuatrimestre (letra A-F, GPA)
• Condición en la fundación (servicios y reuniones últimos 3 meses)
• Próximos eventos

──────────────────────────────────────────────────────────────────
PORTAL PROFESOR
Archivo: src/pages/portales/PortalProfesor.jsx | Ruta: /portal/profesor
──────────────────────────────────────────────────────────────────
• Banner con cursos activos, inscritos totales, notas registradas
• 4 accesos: Cursos, Materias, Calificaciones, Calendario
• Lista de cursos activos

──────────────────────────────────────────────────────────────────
PORTAL ADMINISTRATIVO
Archivo: src/pages/portales/PortalAdministrativo.jsx | Ruta: /portal/administrativo
──────────────────────────────────────────────────────────────────
• Banner con tareas pendientes, proyectos activos, estudiantes
• Contador de solicitudes por atender
• 9 accesos: Expedientes, Patrocinadores, Tareas, Proyectos,
  Solicitudes, Servicios Mensuales, Lista de Comida, Calendario,
  Chat IA
• Lista de tareas urgentes / alta prioridad

──────────────────────────────────────────────────────────────────
PORTAL CONTABILIDAD
Archivo: src/pages/portales/PortalContabilidad.jsx | Ruta: /portal/contabilidad
──────────────────────────────────────────────────────────────────
• Banner con ingresos, egresos, balance
• 2 accesos: Contabilidad, Reportes
• Últimas transacciones (6)

──────────────────────────────────────────────────────────────────
PORTAL CURSOS TÉCNICOS
Archivo: src/pages/portales/PortalCursosTecnicos.jsx | Ruta: /portal/cursos-tecnicos
──────────────────────────────────────────────────────────────────
• Selector entre 2 sub-portales:
    - Portal de Estudiantes
    - Portal de Docentes
• Botón "Volver al inicio"

──────────────────────────────────────────────────────────────────
PORTAL ESTUDIANTE CT
Archivo: src/pages/portales/PortalEstudianteCT.jsx | Ruta: /portal/estudiante-ct
──────────────────────────────────────────────────────────────────
• 4 tarjetas: Promedio %, GPA, Evaluaciones, Aprobadas
• Alerta de prueba académica si GPA < 2.0
• Calificaciones por período (letra A-F con color y label)
• Lista de materias activas


══════════════════════════════════════════════════════════════════
  SECCIÓN 6: COMPONENTES COMPARTIDOS
══════════════════════════════════════════════════════════════════

LAYOUT:
• AppLayout.jsx → Layout con Sidebar + TopBar + Outlet
• Sidebar.jsx → Navegación lateral por rol
• TopBar.jsx → Barra superior con título dinámico, búsqueda,
  notificaciones y badge de rol

EXPEDIENTES:
• ExpedienteDetalle.jsx → Modal con 6 pestañas de detalle completo
• FormFamiliar.jsx → Sub-formulario de datos familiares
• FormSeguimiento.jsx → Sub-formulario de seguimiento

COMPARTIDOS:
• BuscadorEstudiantes.jsx → Buscador con dropdown y resaltado
• PageHeader.jsx → Encabezado estándar con título + acción
• EmptyState.jsx → Estado vacío con icono y acción
• StatCard.jsx → Tarjeta de estadística

AUTH:
• AuthContext.jsx → Contexto de autenticación
• RoleContext.jsx → Contexto de rol activo
• ProtectedRoute.jsx → Protección de rutas
• UserNotRegisteredError.jsx → Pantalla de acceso restringido


══════════════════════════════════════════════════════════════════
  SECCIÓN 7: RESUMEN DE BOTONES Y ACCIONES PRINCIPALES
══════════════════════════════════════════════════════════════════

BOTONES DE CREACIÓN (abren formularios Dialog):
• "Nuevo Expediente" → Expedientes
• "Nueva Materia" → Materias
• "Nuevo Curso" → Cursos
• "Registrar Nota" → Calificaciones
• "Nueva Inscripción" → Prematrícula
• "Nuevo Período" → Períodos
• "Nueva Academia" → Academias
• "Nuevo Material" → Materiales
• "Nuevo Patrocinador" → Patrocinadores
• "Nueva Asignación" → Becas
• "Nueva solicitud" → Solicitudes y aprobaciones
• "Nueva Tarea" → Tareas
• "Nuevo Proyecto" → Proyectos
• "Nueva Transacción" → Contabilidad
• "Nuevo Evento" → Calendario
• "Enviar solicitud" → Mis Solicitudes (estudiante)
• "Inscribirme para hoy" → Inscripción Comida

BOTONES DE ACCIÓN POR REGISTRO:
• Editar (ícono lápiz) → Expedientes, Materias
• Eliminar (ícono basura) → Expedientes, Materias (con confirmación)
• Aprobar / Rechazar / Completar / Cancelar → Solicitudes
• Cambiar estado (menú) → Tareas
• Toggle servicio/reunión → Servicios Mensuales
• Abrir expediente → Expedientes

BOTONES DE AUTOMATIZACIÓN:
• "Subir y escanear documento" (OCR) → Expedientes
• "Subir foto" → Expedientes
• "Subir imagen de Habitudes" → Expedientes
• "Crear y Notificar" → Tareas (envía emails + crea eventos)
• Cambio de estado → Solicitudes (notificación en la campana)
• "Imprimir lista" → Inscripción Comida, Servicios Mensuales

BOTONES DE NAVEGACIÓN:
• 5 tarjetas de portales → Inicio
• 4 accesos rápidos → Dashboard
• Links de portales → cada Portal por rol
• Links de sub-módulos → Sitemap
• "Cambiar Portal" → Sidebar (logout)
• "Contraer" → Sidebar

BOTONES DE CHAT IA:
• 5 prompts rápidos → ChatIA
• 5 preguntas rápidas → ChatIAEstudiantil
• Botón enviar → ambos chats
• Botón reiniciar → ambos chats

================================================================
  FIN DEL DOCUMENTO
================================================================