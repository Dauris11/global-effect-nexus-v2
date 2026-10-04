================================================================
  PROMPT MAESTRO — GLOBAL EFFECT NEXUS
  Descripción completa de la plataforma y organización de portales
================================================================

══════════════════════════════════════════════════════════════════
  1. IDENTIDAD DE LA PLATAFORMA
══════════════════════════════════════════════════════════════════

Nombre: Global Effect Nexus
Tipo: ERP institucional de la Fundación Global Effect: sistema
de gestión (académico, expedientes, patrocinio, operaciones,
finanzas, solicitudes y aprobaciones) con portal del estudiante
integrado. (Octubre 2026: la Fundación eliminó el departamento
de Psicología; su portal y sus citas se retiraron y el
expediente pasa a administración.)
Stack: React + Vite + Tailwind CSS + shadcn/ui + Base44 BaaS.
Idioma: Español (LATAM).
Audiencia: 5 perfiles de usuario con accesos diferenciados.

Misión de la fundación: "Bringing Hope · Changing Lives ·
Transforming Communities" — centralizar los flujos
administrativos, educativos y de impacto social en una sola
plataforma.

══════════════════════════════════════════════════════════════════
  2. ARQUITECTURA DE NAVEGACIÓN
══════════════════════════════════════════════════════════════════

La app usa una arquitectura de "portales por rol":

  /                     → Landing pública (Inicio.jsx)
  /portal/{rol}         → Dashboard personalizado por rol
  /{modulo}             → Módulos compartidos o específicos
  /comida               → Ruta pública sin login

Flujo del usuario:
  1. Aterriza en / (Inicio) → ve landing con 6 tarjetas de acceso.
  2. Selecciona un portal → se setea el rol en RoleContext y
     navega al dashboard del rol.
  3. Entra al AppLayout (Sidebar + TopBar + Outlet).
  4. La Sidebar muestra solo los módulos permitidos para su rol.
  5. "Cambiar Portal" (logout del rol) regresa a /.

══════════════════════════════════════════════════════════════════
  3. DISEÑO Y TOKENS (Sistema de estilo unificado)
══════════════════════════════════════════════════════════════════

Tipografía: Inter (heading + body).
Colores (src/index.css):

  Light:
    --primary:        193 71% 43%   (azul #2096BA — institucional)
    --secondary:       150 28% 77%  (verde claro)
    --background:      210 20% 98%  (gris casi blanco)
    --foreground:      220 15% 10%  (slate oscuro)
    --sidebar-bg:      220 15% 10%  (sidebar oscura)
    --sidebar-fg:      210 20% 92%  (texto sidebar claro)
    --destructive:     0 84% 60%   (rojo)
    --accent:          150 28% 77%  (verde menta)

  Dark: mismos tokens invertidos (background oscuro, sidebar más
  oscura, primary idéntico).

Patrones de layout:
  • PageHeader (título + descripción + acción principal + slot).
  • StatCard (icono + título + valor + subtítulo).
  • EmptyState (icono + título + descripción + CTA).
  • Cards con rounded-xl + shadow.
  • Tabs para filtros (todos/activos/inactivos).
  • Tabla desktop / Cards mobile (responsive).
  • Modal Dialog para formularios (max-w-md, scrollable).
  • Sidebar oscura colapsable (w-64 ↔ w-16).

Iconografía: lucide-react (Settings, GraduationCap, BookOpen,
FileCheck, DollarSign, ClipboardList, Inbox, BookMarked, etc.).

══════════════════════════════════════════════════════════════════
  4. LANDING PÚBLICA (Inicio.jsx)
══════════════════════════════════════════════════════════════════

Estructura:
  (a) Sticky nav: logo + enlaces ancla (Portales/Eventos/Contacto)
      + botón "Inscripción de Comida" (ámbar) + badge "Sistema
      activo".
  (b) Hero slider: 3 slides con fondo Unsplash + overlay oscuro
      + tag opcional + título + descripción + botones.
      Auto-rotación cada 6s, controles laterales, indicadores.
  (c) Stats bar: 4 KPIs (1,200+ estudiantes, 86 materias, 340+
      patrocinadores, 98% satisfacción).
  (d) Portals section: grid de 6 tarjetas (1-2-3 columnas).
      Cada tarjeta: barra gradient superior + icono cuadrado
      gradient + título + descripción + features con check + CTA.
  (e) Próximos Eventos: 4 cards de eventos programados.
  (f) Trust strip: 3 features (Acceso Seguro, Reportes tiempo
      real, Asistente IA).
  (g) Footer: brand + social + 3 columnas de links + copyright.

Portales en la landing (6 tarjetas):
  1. Administración Global      (Settings, #2096BA)
  2. Portal del Estudiante      (GraduationCap, #2096BA)
  3. Contabilidad y Finanzas    (BarChart3, #059669)
  4. Cursos Técnicos             (BookMarked, #2096BA)
  5. Portal Administrativo       (ClipboardList, #d97706)
  6. Solicitudes y trámites     (FileCheck, #187a99)

══════════════════════════════════════════════════════════════════
  5. LOS 5 PORTALES POR ROL
══════════════════════════════════════════════════════════════════

Cada portal tiene: dashboard de entrada + módulos en sidebar.
La Sidebar (NAV_BY_ROLE) filtra módulos según el rol activo.

──────────────────────────────────────────────────────────────
  PORTAL 1 · ADMINISTRADOR
  Ruta: /dashboard · Color: slate oscuro · Icono: Shield/Settings
──────────────────────────────────────────────────────────────
Acceso: TOTAL (todos los módulos).

Dashboard:
  • Hero con KPIs (estudiantes activos, becados, patrocinadores).
  • 4 StatCards: Activos · Cursos · Tareas Pendientes · Balance.
  • Quick Access: Expedientes, Patrocinadores, Solicitudes, Chat IA.
  • BarChart finanzas + PieChart tipos de estudiante.
  • Próximos eventos + Tareas prioritarias.

Sidebar (16 ítems + 3 grupos desplegables):
  • Dashboard
  • Académico (grupo): Cursos, Materias, Calificaciones, Historial,
    Prematrícula, Períodos
  • Academias (grupo): Programas, Materiales
  • Expedientes
  • Patrocinadores (grupo): Lista, Becas
  • Administrativo (grupo): Tareas, Proyectos, Personal,
    Solicitudes
  • Servicios Mensuales
  • Lista de Comida
  • Contabilidad
  • Reportes
  • Chat IA Admin
  • Calendario
  • Configuración
  • Mapa del Sitio

──────────────────────────────────────────────────────────────
  PORTAL 2 · ESTUDIANTE (Curso Técnico)
  Ruta: /portal/estudiante · Color: blue-500/700 · Icono: GraduationCap
──────────────────────────────────────────────────────────────
Acceso: Solo sus datos académicos y sus solicitudes (trámites).

Dashboard:
  • Banner hero con GPA, promedio %, materias activas, servicio
    mensual.
  • Cards de navegación: Materias, Calificaciones, Solicitudes,
    Servicios.
  • Materias inscritas (horario, aula).
  • Historial por cuatrimestre.
  • Estado de servicio comunitario + reunión mensual.
  • Próximos eventos.

Sidebar (4 ítems):
  • Mi Portal
  • Mis Materias (lectura)
  • Calificaciones (lectura)
  • Solicitudes (/portal/estudiante/solicitudes): constancia,
    carta, cita con administración, permiso u otro; lista "mis
    solicitudes" con folio, estado y línea de tiempo

──────────────────────────────────────────────────────────────
  PORTAL 3 · PROFESOR (Docente)
  Ruta: /portal/profesor · Color: amber-500/700 · Icono: BookOpen
──────────────────────────────────────────────────────────────
Acceso: Gestión de cursos, materias y calificaciones.

Dashboard:
  • KPIs: cursos activos, materias, calificaciones registradas.
  • Grid de navegación a módulos académicos.
  • Lista de cursos activos con inscritos, horario, modalidad.

Sidebar (5 ítems):
  • Mi Portal
  • Mis Materias
  • Calificaciones
  • Cursos
  • Calendario

──────────────────────────────────────────────────────────────
  PORTAL 4 · ADMINISTRATIVO
  Ruta: /portal/administrativo · Color: orange-500/700 · Icono: ClipboardList
──────────────────────────────────────────────────────────────
Acceso: Expedientes (de todos los estudiantes: administración es
dueña del expediente), patrocinadores, solicitudes y
aprobaciones, tareas, proyectos, servicios, comida, calendario,
chat IA.

Dashboard:
  • KPIs: tareas pendientes, proyectos activos, estudiantes,
    patrocinadores, solicitudes por atender.
  • Grid: Expedientes, Patrocinadores, Proyectos, Servicios,
    Chat IA.
  • Tareas urgentes pendientes.

Sidebar (10 ítems):
  • Mi Portal
  • Expedientes
  • Patrocinadores
  • Solicitudes (bandeja: por atender, mis solicitudes,
    alta interna de alta_expediente / beca / gasto)
  • Servicios Mensuales
  • Lista de Comida
  • Tareas
  • Proyectos
  • Calendario
  • Chat IA

──────────────────────────────────────────────────────────────
  PORTAL 5 · CONTABILIDAD
  Ruta: /portal/contabilidad · Color: violet-500/700 · Icono: DollarSign
──────────────────────────────────────────────────────────────
Acceso: Contabilidad y reportes (énfasis financiero).

Dashboard:
  • KPIs: ingresos totales, egresos, balance actual.
  • Grid de navegación a Contabilidad y Reportes.
  • Transacciones recientes (6) con tipo y monto.

Sidebar (3 ítems):
  • Mi Portal
  • Contabilidad
  • Reportes

══════════════════════════════════════════════════════════════════
  6. PORTAL SELECTOR — CURSOS TÉCNICOS
══════════════════════════════════════════════════════════════════

Ruta: /portal/cursos-tecnicos
Función: Página intermedia de selección entre dos sub-perfiles.

Estructura:
  • Header centrado (icono BookMarked + título + descripción).
  • 2 tarjetas grandes:
      (a) Portal de Estudiantes (azul #2096BA) — Mis
          calificaciones, Materias inscritas, GPA.
      (b) Portal de Docentes (ámbar #d97706) — Registrar notas,
          Horarios, Vincular estudiantes.
  • Cada tarjeta: barra gradient superior + icono + título + desc
    + features + botón "Acceder".
  • Al seleccionar: setea rol y navega al portal correspondiente.

Ruta adicional: /portal/estudiante-ct — Dashboard académico
detallado del estudiante de curso técnico (GPA 4.0, promedio %,
alertas de rendimiento, historial por cuatrimestre).

══════════════════════════════════════════════════════════════════
  7. MÓDULOS COMPARTIDOS Y PÚBLICOS
══════════════════════════════════════════════════════════════════

Compartidos (accesibles desde múltiples roles):
  • /dashboard            — Vista general global
  • /calendario           — Eventos y agenda
  • /expedientes          — Expedientes estudiantiles
  • /patrocinadores       — Gestión de patrocinadores
  • /academico/materias   — Materias (CRUD admin / lectura estudiante)
  • /academico/calificaciones — Notas (registro profesor / lectura
    estudiante)

Públicos (sin login):
  • /comida — Inscripción diaria de almuerzo (formulario simple
    con límite 8:30 AM, contador público, lista+imprimir si admin).

══════════════════════════════════════════════════════════════════
  8. CHATS IA (dos instancias)
══════════════════════════════════════════════════════════════════

Chat IA Admin (/chat-ia):
  • Contexto: estudiantes, cursos, transacciones, academias,
    eventos, tareas, patrocinadores.
  • 5 prompts rápidos institucionales.
  • Respuestas Markdown. Botón reiniciar.

Chat IA Estudiantil (/chat-ia-estudiantil):
  • Contexto: estudiantes, cursos, materias.
  • 5 preguntas rápidas (requisitos de beca, prematrícula,
    reprobar materia, asistencia, cómo pedir una constancia).
  • Estilo conversacional amable.

══════════════════════════════════════════════════════════════════
  9. ENTIDADES DE DATOS (15)
══════════════════════════════════════════════════════════════════

  Estudiante        — Expediente completo (70+ campos, OCR)
  Materia           — Asignatura por cuatrimestre
  Curso             — Curso técnico con capacidad/inscritos
  Calificacion      — Nota por evaluación
  HistorialCalificacion — Registro histórico con GPA
  Academia          — Programa de liderazgo/habilidades
  Material          — Recurso educativo
  Patrocinador      — Donante (empresa/persona/iglesia/ong)
  Transaccion       — Ingreso/egreso contable
  Tarea             — Tarea con asignación multi-usuario
  Proyecto          — Proyecto con progreso
  Evento            — Evento de calendario
  Solicitud         — Trámite o aprobación con folio, estado y
                      pasos (línea de tiempo)
  RegistroServicio  — Servicio comunitario mensual
  InscripcionComida — Inscripción diaria de almuerzo
  User              — Usuario del sistema (built-in)

══════════════════════════════════════════════════════════════════
  10. INTEGRACIONES
══════════════════════════════════════════════════════════════════

  • InvokeLLM      — OCR de expedientes, chats IA, extracción.
  • UploadFile     — Subir foto/expediente escaneado.
  • SendEmail      — Notificación de tarea.
  • ExtractData    — Extraer JSON de archivos subidos.
  • Impresión PDF  — window.print() para listas (comida,
    servicios mensuales).

══════════════════════════════════════════════════════════════════
  11. PATRONES DE COMPONENTES
══════════════════════════════════════════════════════════════════

  PageHeader   — Título + descripción + acción + slot (búsqueda).
  StatCard     — Icono + título + valor + subtítulo.
  EmptyState   — Estado vacío con CTA.
  BuscadorEstudiantes — Input con sugerencias de estudiantes.
  ExpedienteDetalle — Modal con 6 pestañas (Personal, Académico,
    Habitudes, Familiar, Historia, Seguimiento).
  FormSeguimiento / FormFamiliar — Sub-formularios de expediente.

Layout:
  AppLayout = Sidebar (oscura, colapsable) + TopBar (buscador,
    rol actual, avatar) + <Outlet />.

══════════════════════════════════════════════════════════════════
  12. CONTROL DE ACCESO (RoleContext)
══════════════════════════════════════════════════════════════════

RoleContext.jsx define:
  ROLES = {
    admin:          { label, icon, theme, routes },
    estudiante:     { ... },
    profesor:       { ... },
    administrativo: { ... },
    contabilidad:   { ... },
  }

  • setCurrentRole(rol) activa un rol.
  • useRole() retorna { currentRole, setCurrentRole, ROLES }.
  • La Sidebar lee NAV_BY_ROLE[currentRole] para renderizar.
  • "Cambiar Portal" limpia el rol y vuelve a /.

══════════════════════════════════════════════════════════════════
  13. RESUMEN DE ORGANIZACIÓN
══════════════════════════════════════════════════════════════════

  • 1 landing pública con 6 accesos a portales.
  • 5 portales por rol con dashboard + sidebar filtrada.
  • 1 portal selector intermedio (cursos técnicos).
  • 27+ módulos funcionales.
  • 15 entidades de base de datos.
  • Módulos compartidos entre roles.
  • 1 ruta pública sin login (/comida).
  • 2 chats IA (admin y estudiantil).
  • Diseño unificado con tokens (Inter + primary #2096BA).
  • Responsive: tabla desktop / cards mobile.

================================================================
  FIN DEL PROMPT MAESTRO
================================================================
