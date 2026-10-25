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
  docente        → Portal docente: clases de Global 360, tareas y nota final
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
- Selector de portales: tarjetas con accesos directos (la de Cursos
  Técnicos se retiró con el programa, migración `0047`):
  - Administración Global
  - Contabilidad y Finanzas
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
  - Estudiantes activos
  - Clases de Global 360 en marcha
  - Tareas pendientes
  - Balance del mes
- Accesos rápidos a Expedientes, Patrocinadores, Solicitudes, Chat IA.
- Gráfico de barras: flujo financiero mensual (ingresos vs egresos).
- Gráfico circular: estudiantes por estado (desde la `0047` todos son
  becados universitarios, así que ya no se reparte por tipo).
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
  carrera universitaria y badges. Hay un solo tipo de estudiante, el
  becado universitario: el `regular` de curso técnico se retiró en la `0047`.
- Buscador inteligente con dropdown en tiempo real (BuscadorEstudiantes).
- Filtros por estado y por carrera.

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

## MÓDULO 5: CLASES DE GLOBAL EFFECT 360
*Ruta: /academico/clases-360*

Hasta octubre de 2026 este módulo era el de Cursos Técnicos
(`/academico/cursos`). La Fundación dejó de impartirlos y Global Effect
360 ocupa su lugar: es la formación propia que queda, y sus clases
tienen lo que tenían los cursos —docente, tareas, entregas y nota final—.

Funcionalidades:
- Clases de 360 por período y tanda, con su docente, horario, aula y
  cupo. El docente ve solo las suyas; administración las ve todas.
- Inscritos de cada clase con su cumplimiento de tareas.
- Publicar tarea o examen y revisar entregas con nota y devolución
  (ver Módulo 28).
- **Nota final de cada inscripción** (0–100): la pone el docente con
  `calificaciones.registrar` y decide el estado, aprobada o reprobada
  (hoy con 70 como mínimo). Una reprobada sigue faltándole al
  estudiante y la repite en otro período.

## MÓDULO 6: CALIFICACIONES (retirado)
*Ruta retirada: /academico/calificaciones*

Registraba notas por evaluación (examen, tarea, proyecto…) de los
cursos técnicos sobre la tabla `calificacion`. Se retiró con ellos en la
migración `0047`: la tabla se borró sin copia y la pantalla desaparece.
La nota de 360 se pone en `/academico/clases-360` y las notas
universitarias siguen en el Historial (Módulo 7). Se conserva el número
del módulo para no descolocar las referencias de los demás documentos.

## MÓDULO 7: HISTORIAL ACADÉMICO
*Ruta: /academico/historial*

Registro histórico de calificaciones agrupado por estudiante.

Funcionalidades:
- Estadísticas: total evaluaciones, promedio general, aprobados.
- Agrupación por estudiante con promedio individual.
- Filtro por período académico.
- Búsqueda por estudiante o materia.
- Badge de promedio con color (verde ≥70, rojo <70).

## MÓDULO 8: PREMATRÍCULA
*Ruta: /academico/prematricula*

Gestión de inscripciones y asignación de materias por período.

Funcionalidades:
- Catálogo de Global Effect 360 (todas sus materias son obligatorias) y
  ventanas de prematrícula por tanda: dos por cuatrimestre.
- Inscribir estudiantes en materias seleccionando de dropdowns.
- Estadísticas: total inscritos, pendientes (nota=0), activos (nota>0).
- Lista de todas las inscripciones registradas con su estado.

## MÓDULO 9: PERÍODOS / CUATRIMESTRES
*Ruta: /academico/periodos*

Gestión de períodos académicos institucionales.

Funcionalidades:
- Crear períodos con: nombre (ej: 2026-I), fechas de inicio/fin,
  estado (planificado/activo/completado), cantidad de materias.
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

- Estadísticas: becados, patrocinadores activos, aporte mensual total.

## MÓDULO 14: DEPARTAMENTO DE CONTABILIDAD (ERP DOMINICANO ASFL LEY 122-05)
*Ruta: /portal/contabilidad, /contabilidad/* · Esquema: contabilidad*

El departamento neurálgico que custodia las finanzas institucionales de la Fundación. Opera como un ERP contable integral e independiente conforme al marco legal de la República Dominicana (Ley 122-05 de ASFL, Código Tributario y DGII, Ley 155-17 contra lavado de activos, Ley 30-26, TSS y Código de Trabajo Ley 16-92).

Subsistemas y funcionalidades integradas:
- **Cimientos y Asientos:** Asientos manuales, de ajuste, de apertura y cierre con balanceo obligatorio al centavo ($\sum \text{Debe} = \sum \text{Haber}$), reverso justificado, plantillas recurrentes y punto de extensión `ComprobanteProvider`.
- **Libros y Balanza:** Libro Diario, Libro Mayor con saldo corrido histórico y Balanza de Comprobación con exportación a Excel (.xlsx).
- **Gestión Bancaria y Conciliación:** Banco Santa Cruz DOP y USD, libro con saldo corrido histórico sobre toda la línea de tiempo, transferencias entre cuentas propias con diferencial cambiario automatizado (tasas oficiales BCRD), y conciliación bancaria con propuesta automática de emparejamiento.
- **Cajas Chicas y Arqueos:** Cajas por departamento (`CJ-OP-01` Operaciones, `CJ-DIR-01` Dirección), reposición bancaria y arqueo interactivo por denominaciones dominicanas con alertas antifraude automáticas ante descuadres $\ge$ RD$200.
- **Terceros y Debida Diligencia (Ley 155-17):** Registro unificado de donantes, proveedores y colaboradores con validación de RNC/cédula, matriz de riesgo de lavado de activos y formulario de debida diligencia.
- **Donaciones y Promesas:** Donaciones en efectivo y especie (evaluadas a valor razonable), cronograma de cuotas de promesas por cobrar y emisión de recibos de ingreso (RI) con NCF B02.
- **Contabilidad por Fondos ASFL:** Fondos no restringidos vs temporalmente restringidos (Becas, Comedor), con registro de liberaciones y reclasificación patrimonial al cumplir fines misionales.
- **Rendición de Cuentas por Donante:** Informes oficiales de ejecución financiera filtrados por patrocinador institucional con exportación a PDF.
- **Compras, Proveedores y CxP:** Órdenes de compra aprobadas, cuentas por pagar con aging y cronograma Gantt, OCR de facturas y emisión de comprobantes de retención tributaria.
- **Impuestos y Formatos DGII:** Generador de archivos TXT oficiales 606, 607, 608 y 609, liquidaciones automáticas de IT-1, IR-17 (tasa 15 % Ley 30-26 vigente desde julio 2026) e ISFL-01, y calendario fiscal.
- **Calculadoras Financieras:** 6 herramientas interactivas (ITBIS, NCF, retenciones Ley 30-26, mora DGII Arts. 251/252, amortización de préstamos y prestaciones laborales Ley 16-92) con generación de asientos contables borrador.
- **Centros de Costo Misionales:** Centros de costo (`CC-BECAS`, `CC-FORM360`, `CC-COMEDOR`, `CC-ADMIN`, `CC-INST`) con responsable y presupuesto.
- **Presupuesto Institucional:** Formulación anual y asignaciones mensuales con control de sobregiro y semáforo preventivo (normal, atención $\ge$ 80 %, sobregiro > 100 %).
- **Nómina y TSS (SUIR Plus):** Planilla institucional, cálculo automático de retenciones TSS (AFP 2.87 %, SFS 3.04 %, SRL 1.10 %) e ISR asalariados, y exportación TXT SUIR Plus.
- **Activos Fijos:** Capitalización en Categoría 1 (5 %), Categoría 2 (25 %) y Categoría 3 (20 %), y corrida mensual automática de depreciación lineal en línea recta con asiento contable.
- **Inventario y Kardex:** Consumibles de oficina y comedor comunitario bajo método Costo Promedio Ponderado, registro de entradas/salidas y tomas físicas con ajuste contable.
- **Estados Financieros Oficiales:** Balance General ($\Delta = 0$), Estado de Actividades Ley 122-05, Estado de Flujos de Efectivo (método indirecto), Estado de Cambios en Patrimonio, Mayor Analítico, Flujo de Caja Proyectado a 3-6 meses y Snapshots inmutables.
- **Cierre Contable:** Gestión mensual de 12 períodos y Cierre Anual con asiento de liquidación saldando cuentas 4 y 5 contra `3.1.01.02 Resultados Acumulados`.
- **Auditoría Criptográfica Inmutable:** Trazabilidad encadenada SHA-256 en `contabilidad.bitacora`.

## MÓDULO 15: SOLICITUDES, APROBACIONES Y RENDICIONES
*Ruta: /administrativo/solicitudes · Tablas: solicitud, solicitud_paso*

Bandeja unificada con flujo de aprobación por pasos para trámites estudiantiles, aprobaciones operativas internas y rendición de facturas con comprobante fiscal.

Tipos de solicitud:
- **Trámites del estudiante:** constancia (estudios/beca), carta (recomendación/referencia), reunión con administración, permiso/ausencia, u otro.
- **Alta de expediente:** pase de candidato del embudo a estudiante activo (expedientes.postular).
- **Asignación de Beca:** otorgamiento o ajuste de beca (siempre requiere aprobación de dirección).
- **Solicitud de Gasto y Rendición de Factura:** solicitud de compra o rendición de gasto ejecutado con factura fiscal (NCF); revisado por contabilidad y derivado a dirección si el monto es $\ge$ 1,000 USD. Al aprobarse una rendición, se genera la cuenta por pagar o egreso de caja en Contabilidad vinculada al programa y colaborador.

Flujo de estados:
  enviada → en_revision → [pendiente_direccion] → aprobada → completada
- Separación estricta de funciones: nadie aprueba sus propias solicitudes o gastos.
- Trazabilidad paso a paso en `solicitud_paso` con comentarios obligatorios en rechazo.

## MÓDULO 16: TORRE DE CONTROL DEL COLABORADOR Y GESTIÓN DE TAREAS
*Ruta: /administrativo/tareas, /administrativo/torre-control*

Centro de operaciones diario para el personal de la Fundación, adaptado a la dinámica real de trabajo en terreno, eventos y oficinas.

Funcionalidades:
- **Torre de Control ("Lo que me toca hoy"):**
  - Panel operativo de inicio para cada empleado: tareas para hoy, tareas vencidas y tareas por hacer.
  - Estados operativos reales: `por_hacer`, `en_progreso`, `en_revision`, `completada`.
  - Conteo y métricas en tiempo real de carga de trabajo.
- **Bitácora y Registro Diario de Actividades:**
  - Registro ágil de lo realizado durante la jornada laboral para trazabilidad institucional.
- **Autoasignación de Tareas Prioritarias:**
  - Los colaboradores pueden autoasignarse tareas inmediatas o prioritarias (ej. efectuar un pago urgente, realizar una compra con comprobante fiscal, diligencia externa o logística en liceo).
- **Gestor Visual Ágil (Inspiración Claude):**
  - Interfaz limpia y despejada con panel lateral contextual, asistente para estructuración de tareas y rápida navegación.
  - Tablero Kanban sincronizado con calendario y notificaciones por correo electrónico al usuario asignado.

## MÓDULO 17: PROYECTOS INSTITUCIONALES (GOBIERNO POR ROL)
*Ruta: /administrativo/proyectos*

Gestión, seguimiento y asignación de proyectos institucionales (ej. Campañas de Becas, Laboratorios de Cómputo, Memoria Anual, Casa de Herramientas, Infraestructura).

Funcionalidades:
- **Asignación de Proyectos por Rol:**
  - Todo colaborador institucional (excepto estudiantes) tiene proyectos asignados según su rol y departamento.
  - Asignación y gobierno granular exclusivo del `super_admin` mediante permisos especiales.
- **Desglose de Tareas y Calendario:**
  - Cada proyecto contiene su árbol de tareas asignadas a empleados con fechas de entrega fijadas en el calendario institucional.
- **Métricas y Avance:**
  - Porcentaje de avance calculado automáticamente en base a tareas completadas, estado (planificación, en curso, pausado, completado) y fechas límite.

## MÓDULO 18: GESTIÓN DE PERSONAL Y PERMISOS GRANULARES
*Ruta: /administrativo/personal*

Directorio de usuarios internos del sistema, perfiles operativos y matriz de control de acceso.

Funcionalidades:
- Lista de usuarios institucionales con búsqueda por departamento, nombre y email.
- Matriz de roles (Super Admin, Admin, Docente, Estudiante, Contabilidad, Habitudes).
- Control de permisos granulares gobernados por el `super_admin` (asignación de proyectos, presupuestos de caja, aprobaciones de dirección).

## MÓDULO 19: CALENDARIO Y AGENDAS DE REUNIONES INSTITUCIONALES
*Ruta: /calendario, /calendario/reuniones*

Sistema unificado de eventos institucionales y agenda de reuniones para todo el personal de la Fundación (sustituye permanentemente el antiguo esquema de citas psicológicas).

Funcionalidades:
- **Agenda de Reuniones del Personal:**
  - Cualquier colaborador interno puede agendar reuniones de trabajo, coordinación o seguimiento con otros miembros del equipo.
- **Citas Solicitadas por Estudiantes:**
  - Los estudiantes pueden agendar reuniones de asesoría, tutoría o seguimiento administrativo con miembros del personal o profesores.
- **Vista de Calendario y Agenda:**
  - Calendario mensual con códigos visuales de color (eventos institucionales, reuniones agendadas y tareas con fecha de vencimiento).
  - Agenda a 30 días de compromisos inmediatos.
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
  estudiantes, materias y clases de 360, academias, patrocinadores, eventos, tareas,
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
- Gráfico de barras horizontales: promedio por materia de 360.

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

Centro de ajustes del sistema, agrupado por tema.

Funcionalidades:
- **Cuentas y acceso:** personal, permisos y excepciones por persona, y qué ve cada rol (`/configuracion/visibilidad`, solo `super_admin`).
- **La institución:** parámetros institucionales (`/configuracion/parametros`: horario del comedor, mínimos de la beca, plazo de revisión de normas, correo de contacto) y anuncios de la portada.
- **Asistente de IA:** uso, cuotas, precios y agentes (`/configuracion/ia`) y la base de conocimiento por agente (`/configuracion/conocimiento`).
- **Seguridad y registro:** actividad del equipo con gráficas y descarga en CSV (`/configuracion/actividad`) y registro de auditoría detallado.
- **Mi cuenta:** apariencia (tema claro u oscuro y barra lateral), en Mi perfil.
- Tabla de cuentas del sistema y los roles con los permisos que tienen de verdad.

## MÓDULO 27: MAPA DE NAVEGACIÓN (SITEMAP)
*Ruta: /sitemap*

Visualización jerárquica de toda la estructura de navegación.

Funcionalidades:
- Portales principales con sub-módulos navegables:
  - Portal Estudiante
  - Portal Profesor
  - Portal Administrativo
  - Portal Contabilidad
- Módulos compartidos (Dashboard, Calendario, Inscripción Comida).
- Flujos de navegación automáticos documentados.

## MÓDULO 28: PROGRAMA GLOBAL 360 Y AULA VIRTUAL (ESTILO MOODLE)
*Rutas: /portal/estudiante/global-360, /portal/estudiante/aula-virtual, /academico/clases-360, /academico/prematricula*

Plataforma educativa para el programa insignia Global 360 de la Fundación.

Funcionalidades:
- **Selección y Matrícula Cuatrimestral Obligatoria:**
  - Abierto a todos los estudiantes: desde la `0047` solo hay becados universitarios, y el antiguo «solo becados» dejó de distinguir a nadie.
  - Todo el catálogo es obligatorio; no hay materias opcionales.
  - El cuatrimestre tiene **dos tandas de dos meses**. En cada una el estudiante elige **exactamente una** materia: dos por cuatrimestre. Elegir es obligatorio, y quien no lo ha hecho en una tanda abierta aparece como pendiente.
  - Lo sostiene la base, no solo la pantalla: un índice único parcial sobre `inscripcion_360(estudiante_id, periodo_id, ronda)` que no cuenta las retiradas, para que dos clics a la vez no dejen dos materias en la misma tanda. Retirarse libera la tanda.
  - Asignación de horarios, aulas y profesores designados.
- **Aula Virtual y Entregas Estilo Moodle:**
  - Diseñada para facilitar el uso y la curva de aprendizaje tanto a estudiantes como a docentes.
  - Creación de tareas por parte del docente con: título, descripción/asignación, materia asociada (universitaria o de 360), fecha y hora de vencimiento.
  - **Restricciones y Controles de Entrega:** el profesor define el límite de espacio permitido (en MB) y las extensiones o tipos de archivo aceptados (ej. `.pdf`, `.docx`, `.xlsx`, `.zip`, imágenes).
  - **Vista Previa de Estudiante para el Docente:** el profesor puede alternar a la "Vista de Estudiante" para verificar con exactitud cómo se visualiza la tarea, las instrucciones y el área de carga antes o durante la asignación.
  - Buzón de entregas, calificación docente y espacio de retroalimentación cualitativa.
  - Al cierre de la tanda el docente pone la nota final de la inscripción, que la deja aprobada o reprobada.

## MÓDULO 29: PROGRAMA HABITUDES Y HUB COLABORATIVO DOCENTE
*Rutas: /academias/habitudes, /portal/profesor/habitudes*

Espacio de trabajo y colaboración para el cuerpo docente y facilitadores del programa Habitudes, quienes asisten semanalmente a liceos de la comunidad a impartir clases.

Funcionalidades:
- **Banco Compartido de Materiales Pedagógicos:**
  - Repositorio unificado donde los profesores de Habitudes suben, consultan y descargan recursos de apoyo compartidos entre todo el equipo.
  - Soporte especializado para presentaciones (diapositivas PowerPoint/PDF) e imágenes didácticas, que son los recursos prioritarios utilizados en los liceos.
- **Registro de Evidencias de Clases en Liceos:**
  - Módulo móvil para que los facilitadores suban fotografías de las sesiones impartidas, listas de asistencia y reportes breves de avance curricular directamente desde el terreno.
- **Canal de Coordinación Docente:**
  - Muro de avisos internos y coordinación entre profesores del programa para sincronizar temas y cronogramas de visitas escolares.

## MÓDULO 30: INVENTARIO INSTITUCIONAL Y ACTIVOS FIJOS CON CÓDIGOS QR
*Rutas: /administrativo/inventario, /administrativo/inventario/[id], /inventario/scan*

Control y registro integral de todos los activos, bienes físicos y mobiliario de la Fundación (muebles, cuadros, televisores, herramientas, equipos de computación, aires acondicionados).

Funcionalidades:
- **Registro Detallado del Activo:**
  - Datos de identificación: código interno, nombre del bien, categoría (mobiliario, audiovisual, cómputo, herramientas, otros), ubicación física (sede principal, aula, oficina, casa de herramientas, etc.), estado de conservación (excelente, bueno, regular, en reparación, de baja) y fecha de adquisición.
- **Captura y Almacenamiento Fotográfico:**
  - Subida o captura directa desde la cámara del celular de fotos del artículo para identificación visual inmediata.
- **Generación Automática de Códigos QR Únicos:**
  - Cada artículo registrado genera automáticamente un Código QR vectorial único con su identificador institucional.
  - Módulo de impresión de etiquetas para rotular físicamente cada mueble o equipo.
- **Optimización Mobile-First y Escaneo In Situ:**
  - Interfaz 100% responsiva y optimizada para teléfonos móviles.
  - Lector de QR con la cámara del dispositivo para auditorías rápidas en las instalaciones: el personal escanea la etiqueta pegada al activo e inmediatamente ve su ficha, fotos y responsable asignado.

## PORTALES POR ROL (Dashboards)
─────────────────────────────────────────────────────────────────
- **PORTAL ESTUDIANTE** (Ruta: `/portal/estudiante`):
  - Banner con promedio, GPA y materias aprobadas.
  - Accesos: materias, calificaciones, solicitudes, Global 360 (con aviso si tiene una tanda abierta sin elegir), aula virtual con tareas, agenda de reuniones.
  - Lista de materias activas y calificaciones por cuatrimestre.
  - Condición en la fundación (servicios y reuniones últimos 3 meses).
- **PORTAL PROFESOR** (Ruta: `/portal/profesor`):
  - Banner con clases de 360 activas, inscritos totales, notas finales puestas y entregas por revisar.
  - Accesos: clases de 360, materias, calendario, aula virtual con vista de estudiante, hub Habitudes.
  - Lista de sus clases de 360 con tanda, horario e inscritos, y de sus materias universitarias.
- **PORTAL ADMINISTRATIVO Y COLABORADORES** (Ruta: `/portal/administrativo`):
  - **Torre de Control del Colaborador:** "Lo que me toca hoy" (tareas hoy, vencidas, pendientes con estados `por_hacer`, `en_progreso`, `en_revision`, `completada`).
  - Bitácora diaria y autoasignación de tareas prioritarias (pagos, compras, trámites externos).
  - Proyectos asignados según rol institucional.
  - Rendición de facturas y gastos a Contabilidad con NCF.
  - Agenda de reuniones institucionales y gestión de inventario con QR.
- **PORTAL CONTABILIDAD** (Ruta: `/portal/contabilidad`):
  - Banner financiero en tiempo real (ingresos, egresos, saldos bancarios DOP/USD y cajas chicas).
  - Recepción y validación de facturas remitidas por colaboradores con asignación a programas y personas.
  - Libros de banco, conciliaciones mensuales, cajas chicas, arqueos con alertas antifraude y exportaciones DGII 606 / CxP a Excel (.xlsx).
- **PORTAL HABITUDES** (Ruta: `/expedientes`, `/academias/habitudes`):
  - Banco de diapositivas e imágenes compartidas para liceos.
  - Subida de evidencias fotográficas de clases en escuelas.
  - Postulación de candidatos al embudo.

## FLUJOS AUTOMATIZADOS PRINCIPALES
─────────────────────────────────────────────────────────────────
1. **RENDICIÓN DE GASTO EMPLEADO → CONTABILIDAD:**
   Colaborador sube foto/PDF de factura con NCF $\rightarrow$ OCR extrae datos fiscales $\rightarrow$ Bandeja de Contabilidad $\rightarrow$ Contable valida RNC/NCF, asigna a programa (Casa de Herramientas, Juan Bosch, Universidad) y persona $\rightarrow$ Genera CxP o egreso de caja chica.
2. **ASIGNACIÓN GRANULAR DE PROYECTOS:**
   `super_admin` asigna proyectos por rol $\rightarrow$ Se reflejan de inmediato en la Torre de Control y calendario de los colaboradores.
3. **INVENTARIO Y ETIQUETADO QR:**
   Alta de mueble/equipo con foto $\rightarrow$ Generación de QR único $\rightarrow$ Impresión de etiqueta física $\rightarrow$ Escaneo móvil in situ para auditoría.
4. **GLOBAL 360 Y TAREAS (MOODLE):**
   Docente crea tarea (título, archivo/tamaño permitido) $\rightarrow$ Previsualiza en vista de estudiante $\rightarrow$ Estudiante sube entrega en el aula virtual $\rightarrow$ Docente califica con feedback $\rightarrow$ Nota final de la inscripción: aprobada o reprobada.
5. **EVIDENCIAS HABITUDES EN LICEOS:**
   Docente acude a liceo $\rightarrow$ Captura foto o asistencia en móvil $\rightarrow$ Sube evidencia al hub de Habitudes $\rightarrow$ Disponible para todo el equipo.
6. **ARQUEO FÍSICO DE CAJA:**
   Contable cuenta billetes y monedas $\rightarrow$ Sistema calcula descuadre $\rightarrow$ Si diferencia $\ge$ RD$200, dispara alerta antifraude `diferencia_caja`.
7. **OCR → EXPEDIENTE ADMINISTRATIVO:**
   Subir documento $\rightarrow$ IA extrae datos $\rightarrow$ Precarga en perfil del estudiante.
8. **SOLICITUD → APROBACIÓN:**
   Crear solicitud $\rightarrow$ Notificar revisores $\rightarrow$ Revisión $\rightarrow$ [Dirección] $\rightarrow$ Aprobada/Rechazada $\rightarrow$ Módulo dueño ejecuta.
