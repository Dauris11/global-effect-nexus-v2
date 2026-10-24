# Visión y Alcance — Global Effect Nexus

> Documento de visión del proyecto: propósito, alcance funcional, roles y estado. Última actualización: 2026-10-24 (fin de los cursos técnicos).

## 1. Visión general

**Global Effect Nexus** es el **ERP institucional** de la **Fundación Global Effect** (La Vega, República Dominicana), con el **portal del estudiante integrado**. Centraliza en un solo sistema integral la gestión académica, expedientes administrativos, patrocinio, operaciones, gestión de proyectos y tareas, inventario físico de activos con códigos QR, finanzas y contabilidad formal bajo normativa de la DGII, y las solicitudes y aprobaciones institucionales.

> **Directrices de alcance consolidadas (octubre 2026):**
> 1. **Extinción definitiva de Psicología y Expedientes Administrativos:** El departamento de psicología no existe. Los expedientes de estudiantes son estrictamente administrativos y socioeducativos. Las antiguas citas de psicología se transforman en una **Agenda de Reuniones Institucionales** disponible para todo el personal, donde tanto estudiantes (tutorías, asesorías, seguimiento) como colaboradores internos pueden coordinar reuniones.
> 2. **Contabilidad como Eje Neurálgico:** Es el departamento más crítico de la institución. Administra las cuentas sin discrepancias ni contradicciones numéricas, con estricto apego a las normativas tributarias de la DGII (reportes 606, 607, NCF B01/E31, retenciones, cajas chicas, conciliación bancaria y auditoría inmutable SHA-256).
> 3. **Rendición de Gastos y Facturación Interna:** Los empleados que realicen compras o gastos institucionales con comprobante fiscal pueden cargar su factura desde su plataforma de trabajo; esta llega directamente a Contabilidad para validación, imputación a un programa/centro de costos (ej. Casa de Herramientas, Programa Juan Bosch, Becas Universitarias) y asignación a la persona responsable.
> 4. **Torre de Control del Colaborador y Proyectos por Rol:** Todo el personal (excepto estudiantes) tiene asignados proyectos acordes a su rol, configurados por el `super_admin` con permisos granulares. Cada empleado cuenta con una "Torre de Control" diaria con sus tareas para hoy, vencidas, pendientes y sus estados reales (`por_hacer`, `en_progreso`, `en_revision`, `completada`), con autoasignación de prioridades (pagos, trámites externos) y una experiencia ágil y contextual tipo Claude.
> 5. **Global 360 y Aula Virtual (Estilo Moodle):** La Fundación dejó de impartir cursos técnicos (24 oct 2026, migración `0047`): solo hay un tipo de estudiante, el becado universitario, y Global Effect 360 es la única formación propia, abierta a todos. Todo su catálogo es obligatorio. El cuatrimestre tiene dos tandas de dos meses y en cada una el estudiante elige **una** materia con su horario y su profesor —dos por cuatrimestre—; elegir no es opcional, y quien no lo ha hecho en una tanda abierta aparece como pendiente. El docente de cada clase publica tareas, revisa entregas y pone la nota final, que decide si la materia queda aprobada o reprobada. Incluye aula virtual estilo Moodle con entrega de tareas, especificaciones de archivos/tamaño y vista previa del estudiante para el docente.
> 6. **Habitudes Colaborativo para Docentes en Liceos:** Espacio colaborativo para que los profesores que asisten a los liceos compartan diapositivas, imágenes y guías pedagógicas, registren evidencias de clases impartidas y mantengan comunicación activa.
> 7. **Inventario Físico de Activos con Códigos QR:** Registro de todo el mobiliario y equipo de la Fundación (muebles, cuadros, televisores, herramientas) con fotografía, generación e impresión de códigos QR únicos y escaneo ágil optimizado para dispositivos móviles.

El sistema se construye con arquitectura propia de extremo a extremo: frontend **Next.js 16 (App Router)** y backend sobre **PostgreSQL** con SQL parametrizado (sin ORM), autenticación con sesiones y control de acceso por roles (RBAC) propio, almacenamiento seguro de archivos, asistentes de IA, generación de reportes oficiales en Excel y PDF, e internacionalización simétrica (es/en).

## 2. Stack tecnológico

- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 + Radix UI + componentes propios
- **Estado/datos:** TanStack React Query + Server Actions parametrizadas
- **Base de datos:** PostgreSQL 17 (Supabase local / PostGIS) con `pg` (node-postgres) y SQL parametrizado a mano
- **Autenticación:** Supabase Auth (`@supabase/ssr`) — email + contraseña, sesión en cookies + RBAC granular (roles institucionales)
- **Internacionalización:** next-intl (español / inglés) simétrico y sin literales en JSX
- **Validación:** React Hook Form + Zod
- **UI/gráficos/fechas/mapas:** Lucide React · Recharts · date-fns · Leaflet · motion · qrcode
- **IA:** Anthropic / Gemini (OCR de facturas y documentos, asistentes de soporte, extracción de datos) + pgvector
- **Archivos y Hojas de Cálculo:** Storage privado + `exceljs` para exportaciones DGII/bancos + `sharp`
- **Integraciones:** Generador de Códigos QR para activos, webhooks institucionales y notificaciones

> Detalle completo y versiones en [08 · Stack Tecnológico](08-stack-tecnologico.md).

### ¿Por qué SQL a mano y no un ORM?
- Se documenta y justifica cada tabla, índice y constraint (relevante para la defensa académica).
- Las consultas parametrizadas (`$1`, `$2`…) son la defensa directa contra inyección SQL.
- El costo (más código, sin tipado automático de filas) se compensa con Zod + interfaces TypeScript por entidad.
- Permite funciones transaccionales estrictas para la bitácora contable auditada con hash encadenado SHA-256.

## 3. Roles y control de acceso (RBAC)

Cada usuario ve un menú lateral distinto según su rol. Los usuarios se **invitan**, no se registran. El `super_admin` cuenta con permisos granulares para gobernar la asignación de proyectos, presupuestos e inventario.

| Rol | Alcance |
|---|---|
| `super_admin` | Dirección General: acceso absoluto, configuración, auditoría contable inmutable, asignación granular de proyectos por rol y segundo nivel de aprobaciones |
| `admin` | Coordinación y Administración General: gestión operativa de expedientes administrativos, personal, solicitudes, agenda institucional e inventario |
| `docente` | Portal Docente: sus materias universitarias y sus clases de Global 360, tareas estilo Moodle con vista de estudiante, revisión de entregas y nota final de cada inscripción |
| `estudiante` | Portal Estudiantil: materias, notas, matrícula Global 360, aula virtual con entrega de tareas, agenda de reuniones con personal y solicitudes de trámites |
| `contabilidad` | Departamento Contable y Financiero: gestión de bancos, conciliación, facturas de proveedores con OCR, cajas chicas/operativas, arqueos, rendición de gastos internos de empleados y reportes tributarios DGII (606/607) |
| `habitudes` | Facilitadores de Habitudes: clases en liceos, repositorio compartido de diapositivas/imágenes, registro de evidencias de labor docente y postulación de candidatos |

**Expedientes:** son de administración. `admin` y `super_admin` leen, escriben y eliminan sobre todos los estudiantes; `habitudes` solo postula candidatos.

**Aprobaciones y Gastos:** `solicitudes.gestionar` revisa solicitudes operativas; las solicitudes de gasto y rendiciones con NCF son procesadas por contabilidad; `solicitudes.direccion` autoriza montos mayores a 1,000 USD (super_admin).

## 4. Alcance funcional (Módulos principales + Portales)

**Públicos (sin login):** Landing pública · Inscripción de comida (`/comida`).

**Autenticados:**
- **Torre de Control del Colaborador:** panel diario ("Lo que me toca hoy"): tareas de hoy, tareas vencidas, tareas por hacer (`por_hacer`, `en_progreso`, `en_revision`, `completada`), bitácora de actividad y autoasignación de tareas prioritarias (pagos, compras, gestiones externas).
- **Gestión de Proyectos y Tareas:** interfaz ágil estilo Claude, asignación de proyectos por rol administrada por el `super_admin`, hitos, calendario y Kanban.
- **Rendición de Gastos y Facturas:** módulo para que cualquier empleado envíe comprobantes fiscales de gastos a Contabilidad, con OCR automático y asignación a programas (Casa de Herramientas, Juan Bosch, Universidad, etc.) y personas.
- **Contabilidad Rigurosa (DGII):** libros de banco con saldo histórico corrido, conciliaciones mensuales en Excel/CSV, cajas chicas/operativas por persona/departamento, arqueos por denominación física (billetes RD$2000-50, monedas y USD), alertas de descuadre, facturas con OCR inteligente y exportación oficial DGII 606 / CxP.
- **Inventario Físico y Activos Fijos:** catálogo de mobiliario y activos (muebles, televisores, cuadros, herramientas), carga de fotografías, generación e impresión de etiquetas con Códigos QR únicos y lectura móvil responsive.
- **Agenda de Reuniones Institucionales:** programación de reuniones para todo el personal interno y citas solicitadas por estudiantes (asesorías, seguimiento, tutorías).
- **Expedientes Administrativos:** ficha integral del estudiante (datos personales, familiares, socioeconómicos y académicos) con OCR de documentos físicos.
- **Global 360 y Aula Virtual (Estilo Moodle):** matrícula cuatrimestral obligatoria de una materia por tanda (dos por cuatrimestre), todas del catálogo obligatorio, asignación de horarios y docentes, entrega de tareas con control de formato/tamaño y vista previa de alumno para profesores.
- **Habitudes Colaborativo:** banco compartido de recursos pedagógicos (diapositivas, imágenes) para facilitadores en liceos y registro fotográfico/reportes de evidencias de clases impartidas.
- **Académico:** Materias universitarias, Clases de Global 360, Historial, Prematrícula, Períodos. (Los cursos técnicos y su registro de calificaciones por evaluación se retiraron en la migración `0047`.)
- **Patrocinio y Becas:** Donantes, compromisos mensuales y asignación de becas universitarias.
- **Solicitudes y Aprobaciones:** trámites estudiantiles y flujo administrativo por pasos.
- **Calendario Institucional:** eventos institucionales, agenda combinada y vencimientos de tareas.
- **Asistente de IA Universal y Chat:** consultas con contexto institucional en tiempo real y asistencia por rol.
- **Reportes Analíticos:** dashboards de Proyectos, Académico y Contabilidad con exportación a Excel (.xlsx).

**Portales por rol:**
1. Portal de Administración (`/dashboard` + `/portal/administrativo`)
2. Portal del Estudiante (`/portal/estudiante` + Global 360 + Aula Virtual)
3. Portal del Profesor (`/portal/profesor` + Clases de Global 360 + Materias)
4. Portal de Contabilidad (`/portal/contabilidad` + Bancos + Cajas + Proveedores + DGII)
5. Portal de Habitudes (`/expedientes` + Banco de Materiales + Evidencias de Liceos)

### Flujos automatizados clave
1. **Gasto Empleado → Contabilidad:** el empleado sube factura fiscal $\rightarrow$ OCR extrae RNC/NCF/montos $\rightarrow$ llega a Contabilidad $\rightarrow$ el contable valida e imputa al programa institucional y responsable $\rightarrow$ genera cuenta por pagar o egreso de caja chica.
2. **Asignación de Proyectos por Rol:** `super_admin` define permisos granulares $\rightarrow$ los proyectos se despliegan automáticamente en la Torre de Control de los colaboradores asignados.
3. **Inventario → Etiqueta QR:** registro de activo con foto $\rightarrow$ generación automática de código QR único $\rightarrow$ impresión de etiqueta física $\rightarrow$ escaneo móvil para inspección o inventario físico.
4. **Matrícula y Tareas Global 360 (Moodle):** elección de una materia por tanda $\rightarrow$ horario, aula y docente asignados $\rightarrow$ profesor publica tarea con restricciones de tipo/tamaño de archivo $\rightarrow$ estudiante sube entrega $\rightarrow$ profesor califica con retroalimentación $\rightarrow$ nota final de la inscripción (aprobada o reprobada).
5. **Evidencias Habitudes:** profesor imparte clase en liceo $\rightarrow$ sube fotos y reporte de evidencia desde el móvil $\rightarrow$ queda registrado en la bitácora del programa.
6. **Arqueo de Caja:** conteo físico por denominación (billetes/monedas) $\rightarrow$ cálculo automático de sobrante/faltante $\rightarrow$ si diferencia $\ge$ RD$200, genera alerta antifraude `diferencia_caja`.
7. **OCR → Expediente:** subir documento $\rightarrow$ IA extrae datos socioeducativos $\rightarrow$ precarga en ficha administrativa.
8. **Solicitud → Aprobación:** enviada $\rightarrow$ en revisión $\rightarrow$ [pendiente de dirección] $\rightarrow$ aprobada $\rightarrow$ completada con trazabilidad inmutable.

## 5. Estado del proyecto

- ✅ **Base de datos:** 39 migraciones aplicadas, esquema `contabilidad` con bitácora SHA-256 encadenada, cajas chicas, arqueos por denominación, retenciones DGII y asignación a programas.
- ✅ **Contabilidad y Finanzas:** Fase 1 a 4 completadas (bancos, recibos, proveedores, cuentas por pagar, Gantt de vencimientos, cajas chicas/operativas, arqueos, exportación DGII 606 e importador bancario en Excel .xlsx).
- ✅ **Validaciones de calidad:** Build Next.js 16 (Turbopack) 100% verde (106 rutas), ESLint sin errores, i18n simétrico en 2,548 claves y suite de pruebas contables superada.
- 🔄 **Nuevas directrices en ampliación de alcance:** Torre de control del colaborador, gestor de tareas tipo Claude, inventario de activos con QR mobile, Global 360 Moodle-like y Habitudes colaborativo docente.

Ver el [plan de trabajo](05-plan-de-trabajo.md) y [docs/estado/pendientes.md](estado/pendientes.md) para el detalle de tareas.
