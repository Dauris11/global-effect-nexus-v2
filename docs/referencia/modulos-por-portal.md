================================================================
  MÓDULOS POR PORTAL — FUNCIONES DE CADA UNO
  Documento descriptivo del sistema Global Effect Nexus
  Fecha: 2026-08-08 · Actualizado: 2026-10-24 (fin de los cursos técnicos)
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

En octubre de 2026 la Fundación eliminó definitivamente el departamento
de Psicología: su portal y sus roles desaparecieron. Los expedientes
son de gestión administrativa y las antiguas citas de psicología pasaron a
ser una **Agenda de Reuniones Institucionales** para todo el personal,
agendables tanto por estudiantes como por colaboradores internos.

El departamento de **Contabilidad** asume el rol neurálgico central
del ERP, garantizando estricta consistencia contable y tributaria ante
la DGII (reportes 606/607, NCF B01/E31, retenciones, cajas chicas,
arqueos físicos y recepción de facturas rendidas por empleados).

El 24 de octubre de 2026 la Fundación dejó también de impartir **cursos
técnicos** (migración `0047`). Hay un solo tipo de estudiante, el becado
universitario, y **Global Effect 360** ocupa el sitio de los cursos: es la
única formación propia, abierta a todos, con todo su catálogo
obligatorio. Sus clases tienen docente, tareas, entregas y nota final, y
se gestionan en `/academico/clases-360`. El portal de Cursos Técnicos,
el del estudiante CT y `/academico/calificaciones` desaparecen.

Se incorporan al alcance:
  • **Torre de Control del Colaborador ("Lo que me toca hoy"):** panel
    diario con tareas de hoy, vencidas, pendientes y estados reales,
    autoasignación de tareas prioritarias e interfaz ágil tipo Claude.
  • **Proyectos por Rol:** asignación de proyectos gobernada por el
    `super_admin` con permisos granulares para todo el personal.
  • **Global 360 y Aula Virtual (Moodle-like):** matrícula cuatrimestral
    obligatoria de una materia por tanda (dos tandas de dos meses: dos
    materias por cuatrimestre), horarios, profesores asignados, gestión de tareas con vista de
    estudiante para el docente y control de extensiones/peso de archivo.
  • **Habitudes Colaborativo:** hub compartido de diapositivas e imágenes
    para liceos y registro fotográfico de evidencias docentes.
  • **Inventario de Activos con QR Mobile:** catálogo de muebles y
    equipos con fotos, generación/impresión de QR y escaneo móvil.

Roles disponibles (6):
  • super_admin      — Dirección General (acceso total, permisos granulares,
                       asignación de proyectos, auditoría contable inmutable)
  • admin            — Coordinación Operativa (expedientes administrativos,
                       personal, inventario QR, solicitudes y proyectos)
  • docente          — Docente (clases de Global 360 y materias, aula
                       virtual Moodle con vista de alumno y nota final)
  • estudiante       — Estudiante (materias, notas, matrícula Global 360,
                       aula virtual, agenda de reuniones y solicitudes)
  • contabilidad     — Contabilidad y Finanzas (libros de banco, cajas chicas,
                       arqueos, rendición de gastos internos, DGII 606)
  • habitudes        — Facilitadores de Habitudes (hub docente, diapositivas,
                       evidencias en liceos y embudo de candidatos)

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
  • 4 StatCards: Estudiantes Activos · Clases de 360 · Tareas
    Pendientes · Balance del Mes.
  • Quick Access: Expedientes, Patrocinadores, Solicitudes,
    Chat IA.
  • Gráficos: BarChart de flujo financiero (ingresos vs
    egresos por mes) + PieChart de estudiantes por estado.
  • Próximos Eventos (4) + Tareas Prioritarias (4).

──────────────────────────────────────────────────────────────
1.2 ACADÉMICO (grupo desplegable)
──────────────────────────────────────────────────────────────
  1.2.1 Clases de 360 (/academico/clases-360)
    Función: Las clases de Global Effect 360, que ocupan el lugar
    de los antiguos cursos técnicos (ruta vieja: /academico/cursos).
    • Clases por período y tanda con docente, horario, aula,
      inscritos/cupo.
    • Inscritos de cada clase, tareas publicadas y entregas por
      revisar.
    • Nota final de cada inscripción (0–100), que la deja
      aprobada o reprobada. La pone el docente con
      calificaciones.registrar; administración la ve.
    • El docente solo ve sus clases.

  1.2.2 Materias (/academico/materias)
    Función: CRUD completo de materias por cuatrimestre.
    • Tabla (desktop) / tarjetas (mobile) con: código,
      materia, cuatrimestre, profesor, créditos, horario,
      estado (activa/inactiva).
    • Botones editar (Pencil) y eliminar (Trash2) por materia.
    • Modal crear/editar: nombre, código, cuatrimestre,
      créditos, aula, profesor, horario, estado, descripción.

  1.2.3 Calificaciones (retirada en la 0047)
    Eran las notas por evaluación de los cursos técnicos, sobre
    la tabla calificacion. Se fueron con el programa: la nota de
    360 se pone en 1.2.1 y la universitaria vive en 1.2.4.

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
    • Catálogo de Global Effect 360 (todo obligatorio) y
      ventanas de prematrícula, una por tanda.
    • Lista de inscripciones con estudiante, materia, período
      y tanda.
    • Modal: seleccionar estudiante, materia y período.

  1.2.6 Períodos (/academico/periodos)
    Función: Gestión de períodos/cuatrimestres académicos.
    • 3 KPIs: Activos · Completados · Planificados.
    • Grid de tarjetas con nombre del período, fechas inicio/fin,
      materias asignadas, estado.
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
  • Filtros por estado y carrera (todos son becados desde la 0047).
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
  1.7.1 Tareas y Torre de Control (/administrativo/tareas)
    Función: Gestión estilo Asana/Kanban y Torre de Control diaria.
    • Torre de Control ("Lo que me toca hoy"): tareas para hoy,
      vencidas y pendientes con estados reales: por_hacer,
      en_progreso, en_revision, completada.
    • Autoasignación de tareas prioritarias (pagos, compras,
      gestiones externas).
    • Gestor ágil con experiencia visual contextual inspirada en Claude.
    • Tablero Kanban: columnas por estado, notificaciones por email
      y sincronización automática con calendario.

  1.7.2 Proyectos Institucionales (/administrativo/proyectos)
    Función: Asignación y gobierno de proyectos institucionales.
    • Asignación por rol: cada empleado (excepto estudiantes)
      tiene asignados proyectos según su departamento.
    • Gobierno exclusivo del super_admin mediante permisos granulares.
    • Desglose de hitos, tareas y cronograma en calendario.

  1.7.3 Personal (/administrativo/personal)
    Función: Usuarios internos y matriz de permisos granulares.
    • 3 KPIs: Total Usuarios · Administradores · Regulares.
    • Asignación de roles y permisos especiales por super_admin.

──────────────────────────────────────────────────────────────
1.8 SERVICIOS MENSUALES (/servicios-mensuales)
──────────────────────────────────────────────────────────────
  Función: Control mensual de servicio comunitario y reuniones.
  • Selector de mes (12 meses hacia atrás).
  • 3 StatCards: Activos · Hicieron Servicio · Asistieron Reunión.
  • Tabla estilo Excel: # · estudiante (con foto) · programa ·
    checkbox Servicio Mensual · checkbox Reunión Mensual.
  • Botón "Imprimir PDF" que genera reporte imprimible.

──────────────────────────────────────────────────────────────
1.9 LISTA DE COMIDA (/inscripcion-comida)
──────────────────────────────────────────────────────────────
  Función: Inscripción diaria para almuerzo con pre-registro semanal.
  • Formulario de nombre con límite de hora (8:30 AM).
  • Lista con hora de inscripción y botón de impresión sin sidebar.

──────────────────────────────────────────────────────────────
1.10 CONTABILIDAD Y FINANZAS (/portal/contabilidad, /contabilidad)
──────────────────────────────────────────────────────────────
  Función: Gestión financiera centralizada con rigor legal DGII.
  • Bancos: Banco Santa Cruz DOP y USD con saldo corrido histórico.
  • Conciliación inteligente con estados de cuenta en Excel (.xlsx) y CSV.
  • Cajas chicas/operativas por persona o departamento con reposición
    automática desde banco (reponer_caja).
  • Arqueos interactivos por denominación física (billetes RD$2000-50,
    monedas y USD) con alerta automática por descuadre >= RD$200.
  • Facturación con OCR inteligente (RNC, NCF B01/E31, montos e ITBIS).
  • Recepción y validación de facturas rendidas por empleados con
    imputación a programas (Casa de Herramientas, Juan Bosch, etc.).
  • Exportaciones oficiales DGII 606 y Cuentas por Pagar a Excel (.xlsx).
  • Auditoría inmutable con cadena de hash SHA-256.

──────────────────────────────────────────────────────────────
1.11 INVENTARIO DE ACTIVOS CON CÓDIGOS QR (/administrativo/inventario)
──────────────────────────────────────────────────────────────
  Función: Control integral de activos físicos de la Fundación.
  • Registro de mobiliario y equipos (muebles, cuadros, televisores,
    herramientas) con foto del artículo y estado.
  • Generación automática de Código QR único e imprimible para cada bien.
  • Vista móvil con lector de cámara QR para inventarios in situ.

──────────────────────────────────────────────────────────────
1.12 REPORTES (/reportes)
──────────────────────────────────────────────────────────────
  Función: Reportes analíticos con gráficos (Proyectos, Académico,
  Finanzas) y exportaciones a hojas de cálculo.

──────────────────────────────────────────────────────────────
1.13 CHAT IA UNIVERSAL (/chat-ia)
──────────────────────────────────────────────────────────────
  Función: Asistente con IA contextual institucional por departamento.

──────────────────────────────────────────────────────────────
1.14 CALENDARIO Y REUNIONES INSTITUCIONALES (/calendario)
──────────────────────────────────────────────────────────────
  Función: Planificación de eventos institucionales y agenda de
  reuniones para todo el personal y estudiantes (tutorías/asesorías).

──────────────────────────────────────────────────────────────
1.15 CONFIGURACIÓN (/configuracion)
──────────────────────────────────────────────────────────────
  Función: Administración de usuarios, roles y parámetros institucionales.

──────────────────────────────────────────────────────────────
1.16 MAPA DEL SITIO (/sitemap)
──────────────────────────────────────────────────────────────
  Función: Visualización jerárquica de portales y módulos.

══════════════════════════════════════════════════════════════════
  PORTAL 2 — ESTUDIANTE (Con Global 360 y Moodle Integrado)
══════════════════════════════════════════════════════════════════
Banner: from-blue-500 to-blue-700 · icono GraduationCap

──────────────────────────────────────────────────────────────
2.1 MI PORTAL (/portal/estudiante)
──────────────────────────────────────────────────────────────
  Función: Dashboard personal del estudiante.
  • Banner hero con: GPA, promedio %, materias activas, servicio.
  • Accesos directos a Materias, Calificaciones, Solicitudes,
    Global 360 y Aula Virtual.
  • Agenda de reuniones y próximos eventos.

──────────────────────────────────────────────────────────────
2.2 GLOBAL 360 Y PREMATRÍCULA (/portal/estudiante/global-360)
──────────────────────────────────────────────────────────────
  Función: Matrícula obligatoria de una materia por tanda: el
  cuatrimestre tiene dos tandas de dos meses, así que son dos
  materias por cuatrimestre.
  • Catálogo de Global Effect 360: todas sus materias son
    obligatorias, no hay opcionales.
  • En cada tanda abierta elige exactamente una, con su horario
    y profesor. Si no ha elegido, el portal lo marca pendiente.
  • Materias dadas (aprobadas) y las que le faltan.

──────────────────────────────────────────────────────────────
2.3 AULA VIRTUAL (ESTILO MOODLE) (/portal/estudiante/aula-virtual)
──────────────────────────────────────────────────────────────
  Función: Entrega de asignaciones y tareas académicas.
  • Consulta de tareas pendientes con fecha límite y requerimientos.
  • Zona de carga con validación de extensiones (.pdf, .docx, .zip)
    y tamaño máximo estipulado por el docente.
  • Estado de entrega, calificación recibida y retroalimentación.

──────────────────────────────────────────────────────────────
2.4 MIS MATERIAS Y CALIFICACIONES (/portal/estudiante/prematricula, /portal/estudiante/calificaciones)
──────────────────────────────────────────────────────────────
  Función: Consulta de materias y notas (lectura): las universitarias
  de historial_calificacion y las notas finales de 360.

──────────────────────────────────────────────────────────────
2.5 SOLICITUDES Y AGENDA DE REUNIONES (/portal/estudiante/solicitudes)
──────────────────────────────────────────────────────────────
  Función: Trámites del estudiante y coordinación de reuniones.
  • Constancias, cartas, permisos u otros trámites con folio y tracking.
  • Agendamiento de reuniones con personal institucional o tutores.

══════════════════════════════════════════════════════════════════
  PORTAL 3 — PROFESOR (Con Vista Moodle y Hub Habitudes)
══════════════════════════════════════════════════════════════════
Banner: from-amber-500 to-amber-700 · icono BookOpen

──────────────────────────────────────────────────────────────
3.1 MI PORTAL (/portal/profesor)
──────────────────────────────────────────────────────────────
  Función: Dashboard docente con sus clases de 360, materias y alumnos.

──────────────────────────────────────────────────────────────
3.2 AULA VIRTUAL MOODLE-LIKE (/portal/profesor/aula-virtual)
──────────────────────────────────────────────────────────────
  Función: Gestión y revisión de tareas de materias y Global 360.
  • Creación de asignaciones: título, instrucciones, materia
    (universitaria o de 360, exactamente una), fecha límite.
  • Configuración de entrega: límite de tamaño (MB) y formatos permitidos.
  • **Vista de Estudiante:** previsualización exacta de cómo ve el
    alumno la tarea antes de publicarla.
  • Calificación ágil y retroalimentación docente para cada entrega.

──────────────────────────────────────────────────────────────
3.3 HUB COLABORATIVO HABITUDES (/portal/profesor/habitudes)
──────────────────────────────────────────────────────────────
  Función: Recursos y evidencias para profesores que van a liceos.
  • Banco compartido de diapositivas (PowerPoint/PDF) e imágenes de clase.
  • Carga móvil de evidencias fotográficas de clases impartidas en liceos.

──────────────────────────────────────────────────────────────
3.4 CLASES DE 360 (/academico/clases-360)
──────────────────────────────────────────────────────────────
  Función: Sus clases de Global Effect 360: inscritos, tareas,
  entregas y nota final de cada inscripción (aprobada o
  reprobada).

══════════════════════════════════════════════════════════════════
  PORTAL 4 — ADMINISTRATIVO Y COLABORADORES
══════════════════════════════════════════════════════════════════
Banner: from-orange-500 to-orange-700 · icono ClipboardList

──────────────────────────────────────────────────────────────
4.1 TORRE DE CONTROL ("LO QUE ME TOCA HOY") (/portal/administrativo)
──────────────────────────────────────────────────────────────
  Función: Centro operativo diario de cada colaborador institucional.
  • "Lo que me toca hoy": panel con tareas de hoy, vencidas y
    pendientes por hacer.
  • Estados de tarea: por_hacer, en_progreso, en_revision, completada.
  • Autoasignación de tareas prioritarias (pagos urgentes, compras,
    diligencias exteriores o coordinación en terreno).
  • Bitácora diaria de actividades ejecutadas por el empleado.

──────────────────────────────────────────────────────────────
4.2 PROYECTOS POR ROL (/administrativo/proyectos)
──────────────────────────────────────────────────────────────
  Función: Gestión de proyectos asignados por el super_admin.
  • Proyectos institucionales activos según el rol del empleado.
  • Desglose de tareas asignadas con vencimientos en calendario.

──────────────────────────────────────────────────────────────
4.3 RENDICIÓN DE FACTURAS A CONTABILIDAD (/administrativo/solicitudes)
──────────────────────────────────────────────────────────────
  Función: Carga de facturas con comprobante fiscal (NCF) por gastos.
  • El colaborador sube la factura $\rightarrow$ Contabilidad la valida
    e imputa al programa correspondiente (Casa de Herramientas,
    Juan Bosch, Universidad, etc.) y a la persona responsable.

──────────────────────────────────────────────────────────────
4.4 INVENTARIO MÓVIL CON QR (/administrativo/inventario)
──────────────────────────────────────────────────────────────
  Función: Consulta y escaneo móvil de muebles y equipos con código QR.

──────────────────────────────────────────────────────────────
4.5 EXPEDIENTES, PATROCINADORES Y REUNIONES
──────────────────────────────────────────────────────────────
  (Expedientes administrativos, becas, agenda de reuniones institucionales).

══════════════════════════════════════════════════════════════════
  PORTAL 5 — CONTABILIDAD Y FINANZAS
══════════════════════════════════════════════════════════════════
Banner: from-violet-500 to-violet-700 · icono DollarSign

──────────────────────────────────────────────────────────────
5.1 PANEL FINANCIERO Y AUDITORÍA (/portal/contabilidad)
──────────────────────────────────────────────────────────────
  Función: Centro de mando del departamento más crítico del ERP.
  • Consistencia de números para cumplimiento tributario DGII sin contradicciones.
  • Saldos de cuentas en bancos y cajas chicas al instante.
  • Recepción de facturas de compras y rendiciones de empleados.

──────────────────────────────────────────────────────────────
5.2 BANCOS Y CONCILIACIONES (/contabilidad/bancos)
──────────────────────────────────────────────────────────────
  Función: Libros de banco con saldo histórico y conciliación en Excel/CSV.

──────────────────────────────────────────────────────────────
5.3 CAJAS Y ARQUEOS (/contabilidad/cajas)
──────────────────────────────────────────────────────────────
  Función: Cajas chicas por persona/departamento, reposición automática
  desde banco y arqueos por denominación física (billetes y monedas)
  con alertas por descuadre >= RD$200.

──────────────────────────────────────────────────────────────
5.4 PROVEEDORES, FACTURACIÓN OCR Y DGII 606 (/contabilidad/proveedores, /contabilidad/cuentas-por-pagar)
──────────────────────────────────────────────────────────────
  Función: RNC/cédula DGII, escaneo OCR de facturas NCF B01/E31,
  Gantt de cuentas por pagar y exportación oficial de reportes DGII 606 a Excel.

══════════════════════════════════════════════════════════════════
══════════════════════════════════════════════════════════════════
  PORTAL 6 — HABITUDES (Facilitadores en Liceos)
══════════════════════════════════════════════════════════════════
Banner: from-teal-500 to-teal-700 · icono Users

──────────────────────────────────────────────────────────────
6.1 HUB COLABORATIVO HABITUDES (/academias/habitudes)
──────────────────────────────────────────────────────────────
  Función: Espacio de trabajo docente para visitas a liceos.
  • Banco compartido de diapositivas (PowerPoint/PDF) e imágenes didácticas.
  • Carga y consulta de recursos pedagógicos disponibles para todo el equipo.
  • Registro fotográfico y de evidencias de clases impartidas en escuelas.

──────────────────────────────────────────────────────────────
6.2 CANDIDATOS DEL EMBUDO (/expedientes)
──────────────────────────────────────────────────────────────
  Función: Postulación de candidatos reclutados en los liceos.

══════════════════════════════════════════════════════════════════
  MÓDULOS COMPARTIDOS / PÚBLICOS
══════════════════════════════════════════════════════════════════

──────────────────────────────────────────────────────────────
DASHBOARD (/dashboard) — accesible según permisos de rol
──────────────────────────────────────────────────────────────
  Vista general global (ver 1.1).

──────────────────────────────────────────────────────────────
CALENDARIO Y REUNIONES (/calendario) — compartido
──────────────────────────────────────────────────────────────
  Eventos institucionales, agenda de reuniones y tareas (ver 1.14).

──────────────────────────────────────────────────────────────
INSCRIPCIÓN COMIDA (/comida) — pública, sin login
──────────────────────────────────────────────────────────────
  Misma función que /inscripcion-comida pero accesible sin
  autenticación (ruta pública directa).

══════════════════════════════════════════════════════════════════
  CHAT IA ESTUDIANTIL (/chat-ia-estudiantil)
══════════════════════════════════════════════════════════════════
  Función: Asistente IA para estudiantes.
  • Chat con contexto de estudiantes, materias, Global 360 y vida académica.
  • Consultas sobre becas, prematrícula, normativas y trámites.

══════════════════════════════════════════════════════════════════
  RESUMEN DE ENTIDADES POR MÓDULO
══════════════════════════════════════════════════════════════════

  Estudiante        → Expedientes Administrativos
  Materia           → Materias
  Materia360        → Clases de 360, Global 360, Prematrícula
  Inscripcion360    → Global 360 (una por tanda), nota final
  HistorialCalif.   → Historial, Calificaciones del estudiante
  Tarea             → Torre de Control, Tareas, Moodle, Calendario
  Proyecto          → Proyectos por Rol, Reportes
  ActivoInventario  → Inventario Físico con Códigos QR
  Reunion           → Agenda de Reuniones Institucionales
  MaterialHabitudes → Hub de Materiales y Evidencias de Liceos
  Academia          → Programas
  Patrocinador      → Patrocinadores, Becas
  CuentaBancaria    → Bancos, Conciliación
  Caja              → Cajas Chicas, Arqueos
  FacturaProveedor  → Proveedores, OCR, Rendición de Empleados
  Recibo            → Recibos de Ingreso, Comprobantes de Egreso
  Solicitud         → Solicitudes y Aprobaciones, Rendiciones
  SolicitudPaso     → Línea de tiempo de Solicitudes
  RegistroServicio  → Servicios Mensuales
  InscripcionComida → Inscripción Comida
  User              → Configuración, Personal, RBAC

══════════════════════════════════════════════════════════════════
  RESUMEN TOTAL
══════════════════════════════════════════════════════════════════

  6 portales por rol (el selector de cursos técnicos se retiró)
  30 módulos funcionales estructurados
  Consistencia contable estricta bajo normativa DGII
  Torre de Control del Colaborador y Proyectos por Rol (super_admin)
  Aula Virtual estilo Moodle para Global 360 y Hub Habitudes
  Inventario de Activos Fijos con fotos y Códigos QR mobile-first

================================================================
  FIN DEL DOCUMENTO
================================================================