# Informe de Auditoría QA: Diseño, Funcionalidad y Coherencia Operativa
**Portal GlobalEffect (Fundación Global Effect — La Vega, RD)**  
**Fecha:** 24 de noviembre de 2026  
**Auditor:** QA Lead / Product Auditor  
**Alcance:** Portales por Rol (`super_admin`, `admin`, `docente`, `estudiante`, `contabilidad`, `habitudes`, `dir_habitudes`, `chofer`), Menús (`nav.ts`), Flujos Transversales, Diseño UI y Modelos de Trámite.

---

## 1. Diagnóstico Ejecutivo

El **Portal GlobalEffect** cuenta con una base de ingeniería de altísimo nivel técnico: arquitectura Next.js 16 App Router, TypeScript estricto, Postgres relacional sin sobrecarga de ORM, bitácora contable criptográfica (SHA-256), internacionalización es/en al 100% simétrica y apego riguroso a la paleta institucional (`#2096BA`).

Sin embargo, desde la perspectiva de **Producto, Experiencia de Usuario (UX) y Operación Real**, el sistema presenta una evidente **inflación funcional** y **desconexión del contexto operativo**:
1. **Sobrecarga de herramientas irrelevantes por rol:** Se le muestran pantallas y formularios a roles que jamás deberían utilizarlos (ej. estudiantes con formularios de adquisiciones corporativas; choferes con torres de control de proyectos).
2. **Trámites huérfanos o fuera de su portal:** Funciones críticas para la vida diaria de los usuarios están fuera de su espacio natural (ej. un estudiante tiene que salirse a una URL pública para pedir el almuerzo, y no tiene dónde ver si cumplió con sus horas de servicio comunitario).
3. **Módulos duplicados o fragmentados:** Existen hasta 4 pantallas distintas para ver tareas pendientes, y dos formas diferentes de entender las "materias" (universitarias vs Global Effect 360) que generan confusión entre docentes y administrativos.
4. **Formularios monolíticos:** Formularios con más de 30 campos sin guardado por etapas que desalientan la carga de datos en terreno.

A continuación se detalla la radiografía completa del sistema.

---

## 2. Los 10 Hallazgos Críticos: «Cosas Sin Sentido» en el Portal Actual

| # | Hallazgo Inconsistente | Dónde ocurre | Por qué no tiene sentido | Impacto en el usuario |
|---|---|---|---|---|
| **1** | **Formulario de Compras Corporativas en el Portal del Estudiante** | `/portal/estudiante/solicitudes` | Un becado universitario de 18 años ve en primer plano el componente `FormularioCompra` con carga de cotizaciones de proveedores, RNC y solicitud de cheques para contabilidad. | **Crítico / Confusión masiva:** El estudiante no es un agente de compras de la fundación; sus solicitudes son constancias de estudio, justificaciones médicas o estipendios. |
| **2** | **Ícono de Llave Inglesa (`Wrench`) para el Portal Estudiantil** | `src/lib/nav.ts` (Línea 434) | El acceso principal del estudiante a su vida académica tiene como ícono una llave inglesa de mecánico en lugar de un birrete (`GraduationCap`), libro (`BookOpen`) o casa (`Home`). | **Visual / Identidad:** Transmite que el estudiante entra a una sección de mantenimiento o configuración técnica. |
| **3** | **Comedor y Horas de Servicio Comunitario ocultos para el Becado** | Menú Estudiante vs `/comida` y `/servicios-mensuales` | El estudiante debe inscribirse al almuerzo en una página pública (`/comida`) fuera de su sesión, y no puede consultar en ningún lado si la fundación ya le validó sus horas de servicio o reunión mensual (requisito para no perder la beca). | **Operativo:** Pérdida de becas por falta de visibilidad del becado sobre su estatus de cumplimiento. |
| **4** | **Docente desviado al Catálogo Institucional en vez de a sus Clases** | `src/lib/nav.ts` (Línea 559) en `MENU_DOCENTE` | El botón de menú "Materias" del profesor lo manda a `/academico/materias` (CRUD administrativo donde coordinación crea códigos de asignaturas), en lugar de `/portal/profesor/materias` (donde están sus alumnos, notas y asistencia). | **Bloqueo UX:** El profesor cree que no puede calificar o que el sistema está roto porque cae en una lista vacía o de solo lectura. |
| **5** | **Chofer con Torre de Control y Calendario, pero sin Combustible ni Odómetro** | `src/lib/nav.ts` (`MENU_CHOFER`) | Un conductor de guagua institucional tiene asignadas vistas de gestión ágil de proyectos (Torre de Control) y calendarios de eventos, pero carece de un botón simple para reportar compra de combustible, cambio de aceite o registrar el kilometraje del vehículo. | **Grave en terreno:** El chofer no usa el sistema desde el volante porque lo que tiene no le sirve para su jornada de transporte. |
| **6** | **Dispersión y Cuádruple Vista de Tareas** | `/administrativo/tareas`, `/tareas/hoy`, `/torre-control`, `/proyectos` | Hay 4 interfaces distintas para dar seguimiento a pendientes. Torre de control duplica los estados de tareas y añade un Gantt separado que casi nadie alimenta. | **Parálisis por análisis:** Los colaboradores no saben dónde reportar el avance diario. |
| **7** | **Confusión Conceptual entre Materias Universitarias y Materias 360** | `/academico/*` vs `/portal/estudiante/*` | El sistema usa la palabra "Materia" para dos realidades completamente distintas: asignaturas de la universidad (donde Global Effect solo transcribe notas) y talleres internos de Global Effect 360 (que la fundación imparte). | **Ambigüedad:** Errores de matriculación y estudiantes confundidos intentando entregar tareas universitarias en la plataforma interna. |
| **8** | **Expediente Monolítico con más de 30 Campos en Pantalla Única** | `/expedientes/[id]?editar=1` | La edición de expediente obliga a cargar datos de salud, familiares, universitarios, socioeconómicos y de patrocinio en una sola tanda masiva. | **Fatiga y Abandono:** La información queda a medio llenar porque no existe un flujo de captura progresiva. |
| **9** | **Menú Administrativo Saturado de Enlaces Contables de Solo Lectura** | `MENU_ADMINISTRACION` (Área Finanzas) | Coordinación ve hasta 11 accesos directos del catálogo contable (asientos, libros, conciliaciones) donde todas las acciones de edición están bloqueadas por diseño institucional. | **Ruido cognitivo:** La barra lateral de administración mide cientos de píxeles con opciones que no forman parte de su labor. |
| **10** | **Rendición de Gastos Desconectada de la Solicitud Previa** | `/administrativo/rendiciones` | Un colaborador sube facturas de viáticos o gastos sin poder vincularlas al código de solicitud aprobada que autorizó el desembolso inicial. | **Auditoría financiera:** Dificultad para conciliar anticipos contra facturas reales en Contabilidad. |

---

## 3. Matriz de QA por Rol: «Lo que PUEDEN hacer» vs «Lo que DEBERÍAN poder hacer»

### 3.1. Estudiante (`estudiante`) — Becados Universitarios y Alumnos 360
* **Perfil Real:** Jóvenes universitarios (18-24 años) en UCATECI/UNPHU que usan el portal desde sus teléfonos móviles (Android/iOS) con conexiones de datos móviles limitadas.
* **Lo que PUEDEN hacer hoy:**
  - Ver su índice académico y notas de 360 en dashboards con animaciones y gráficos Recharts.
  - Subir tareas a buzones tipo Moodle en el Aula Virtual.
  - Solicitar materias para el cuatrimestre (prematrícula).
  - Llenar solicitudes generales de secretaría y... ¡solicitudes de compra corporativa de bienes!
* **Lo que DEBERÍAN poder hacer (y hoy no pueden):**
  1. **Semáforo de Beca de un vistazo:** Saber exactamente si su beca está en riesgo: Índice actual vs Mínimo exigido (ej. 80 pts), Horas de servicio comunitario realizadas en el mes (ej. 8 hrs) y asistencia a la reunión mensual obligatoria.
  2. **Comedor / Almuerzo integrado:** Un botón flotante "Reservar Almuerzo de Hoy" directo desde su portal, con confirmación inmediata antes de la hora de corte (10:00 AM).
  3. **Transporte en vivo:** Ver si la guagua ya salió, en qué parada viene y a qué hora estimada pasa por su punto de recogida.
  4. **Solicitud de Ayudas Académicas:** Pedir reembolso de libros, compra de batas/instrumental médico, o solicitud de tutoría académica si van perdiendo una materia.

---

### 3.2. Docente (`docente`) — Profesores de Global Effect 360
* **Perfil Real:** Profesores que imparten materias específicas de liderazgo, valores y desarrollo personal en las aulas de la Fundación.
* **Lo que PUEDEN hacer hoy:**
  - Crear publicaciones y tareas con fecha y archivo adjunto.
  - Pasar lista de asistencia por clase.
  - Ver una lista de materias que a menudo los confunde con el catálogo universitario general.
  - Ver Torre de Control y Líneas de Tiempo de Proyectos institucionales.
* **Lo que DEBERÍAN poder hacer (y hoy no pueden):**
  1. **Libro de Calificaciones en Matriz (Grid):** Ver a todos sus alumnos en una sola tabla editable donde puedan colocar las notas de tareas y exámenes de forma ágil sin entrar alumno por alumno.
  2. **Pase de Lista Rápido (1-Tap Attendance):** Marcar "Todos presentes" con un solo botón y solo tocar a los 2 o 3 que faltaron.
  3. **Bandeja de Entregas por Calificar:** Un buzón limpio que diga: *"Tienes 14 entregas pendientes de revisar en Liderazgo Juvenil"*, con acceso directo para calificar y retroalimentar.

---

### 3.3. Chofer (`chofer`) — Conductor Institucional
* **Perfil Real:** Personal operativo en ruta conduciendo un autobús escolar; opera con una sola mano en el teléfono celular montado en el tablero del vehículo.
* **Lo que PUEDEN hacer hoy:**
  - Presionar "Iniciar viaje" y "Finalizar viaje".
  - Ver lista de pasajeros y marcar quién subió.
  - Reportar incidencias (avería mecánica, retraso, estudiante no se presentó).
  - Acceder a Torre de Control y Calendario de Reuniones corporativas.
* **Lo que DEBERÍAN poder hacer (y hoy no pueden):**
  1. **Modo Conducción Ultralimpio (Botones gigantes):** Interfaz simplificada de alto contraste con botones de parada de al menos 56px de alto.
  2. **Registro Rápido de Combustible / Gastos de Ruta:** Botón "Cargar Gasoil": tomar foto al comprobante fiscal de la estación de servicio, ingresar galones y monto, y enviarlo directo a Contabilidad/Caja Chica.
  3. **Control de Kilometraje / Odómetro:** Registro del kilometraje al encender la guagua en la mañana y al guardarla en la tarde para calcular rendimiento de combustible y alertas de mantenimiento preventivo.

---

### 3.4. Facilitador Habitudes (`habitudes`) — Trabajo de Campo en Liceos
* **Perfil Real:** Facilitadores que visitan escuelas y liceos públicos de La Vega para impartir el currículo de valores e identificar potenciales becados.
* **Lo que PUEDEN hacer hoy:**
  - Ver el Hub de Recursos (manuales, dinámicas pedagógicas).
  - Subir evidencias fotográficas y reportar visitas a centros educativos con geolocalización.
  - Crear una solicitud de tipo `alta_expediente` para postular a un joven.
* **Lo que DEBERÍAN poder hacer (y hoy no pueden):**
  1. **Ficha Rápida de Postulación ("Cazatalentos"):** Formulario offline-first de 5 campos (Nombre, Liceo, Teléfono, Promedio estimado y Foto de cédula/boletín) para levantar al candidato en el aula en 30 segundos.
  2. **Agenda de Visitas a Liceos:** Lista de liceos asignados para la semana con botón de "¿Cómo llegar?" en Google Maps / Waze.

---

### 3.5. Director de Habitudes (`dir_habitudes`)
* **Perfil Real:** Líder pedagógico y enlace con el Distrito Educativo de La Vega.
* **Lo que PUEDEN hacer hoy:**
  - Ver el mapa de liceos de La Vega y monitorear visitas registradas.
  - Ver qué facilitadores han subido fotos y asistencias.
* **Lo que DEBERÍAN poder hacer (y hoy no pueden):**
  1. **Aprobación de Candidatos de Campo:** Bandeja directa para revisar a los jóvenes postulados por sus facilitadores y dar el visto bueno pedagógico antes de pasar a Administración.
  2. **Dashboard de Cobertura por Liceo:** Saber cuántos estudiantes han recibido las charlas en cada centro educativo versus la meta anual pactada con el MINERD.

---

### 3.6. Contabilidad (`contabilidad`) — Administración Financiera ASFL
* **Perfil Real:** Contables profesionales regidos por normas de ASFL (Ley 122-05) y la Dirección General de Impuestos Internos (DGII) de República Dominicana.
* **Lo que PUEDEN hacer hoy:**
  - Gestionar catálogo contable de 6 dígitos, asientos de partida doble, libros mayor y diario.
  - Administrar cajas chicas, reposiciones, arqueos con firma.
  - Conciliación bancaria (1 a 1 y 1 a varios) contra extractos CSV.
  - Gestión de proveedores y cuentas por pagar con NCF / e-CF.
* **Lo que DEBERÍAN poder hacer (y hoy no pueden):**
  1. **Calendario Fiscal DGII Integrado:** Alertas automáticas para las fechas de corte dominicanas (Día 15: Envío 606 y 607; Día 20: IT-1; Día 10: TSS).
  2. **Centro de Costos por Estudiante Becado:** Poder imputar facturas de universidades (UCATECI/UNPHU) o compras de libros directamente al ID del estudiante para conocer el costo acumulado de su carrera.
  3. **Limpieza del Menú Contable:** Ocultar definitivamente las rutas de los 14 módulos experimentales retirados para no saturar la navegación.

---

### 3.7. Coordinación / Administración (`admin`)
* **Perfil Real:** Coordinadores operativos y académicos que mantienen al día las admisiones, la vida de los becados, el transporte y el bienestar.
* **Lo que PUEDEN hacer hoy:**
  - Ver y editar expedientes de estudiantes.
  - Subir actas de notas universitarias (OCR / manual).
  - Gestionar rutas de transporte y comensales del comedor.
  - Resolver solicitudes y aprobar tareas.
* **Lo que DEBERÍAN poder hacer (y hoy no pueden):**
  1. **Ciclo de Vida de la Beca (Pipeline Kanban):** Vista visual del estudiante desde: `Postulado en Liceo` → `Evaluación Socioeconómica` → `Entrevista` → `Admitido/Becado Activo` → `En Riesgo Académico` → `Graduado / Egresado`.
  2. **Bandeja de Aprobación Unificada:** Una sola pantalla donde caigan todas las aprobaciones pendientes del día (permisos de estudiantes, prematrículas de materias, postulaciones de Habitudes, justificaciones de faltas).

---

### 3.8. Super Administrador (`super_admin`)
* **Perfil Real:** Dirección Ejecutiva y Junta Directiva de la Fundación.
* **Lo que PUEDEN hacer hoy:**
  - Acceso total e irrestricto a todas las rutas, configuraciones y base de datos.
  - Gestión de permisos y roles por usuario (`usuario_permiso`).
  - Auditoría contable y registros de bitácora inmutable.
* **Lo que DEBERÍAN poder hacer (y hoy no pueden):**
  1. **Tablero Ejecutivo Institucional (Executive KPI Dashboard):** Métricas de alto impacto para donantes y consejo directivo: Total becados activos, tasa de retención universitaria, índice promedio de la fundación, costo promedio por egresado y saldo disponible en bancos.

---

## 4. Auditoría de Diseño Visual y Componentes UI

### 4.1. Coherencia de Marca y Paleta
* **Fortaleza:** Excelente uso del token `bg-marca-500` (`#2096BA`) y degradados suaves de marca. No se detectan colores arbitrarios o fuera del manual de marca.
* **Debilidad:** Falta de contraste en estados vacíos (`text-muted-foreground` a veces se funde con fondos grisáceos en monitores de bajo brillo).

### 4.2. Formularios y Carga Cognitiva
* **Problema:** Formularios excesivamente largos en una sola columna con inputs repetitivos (ej. Expediente con 33 inputs, Factura con 17 inputs).
* **Solución QA recomendada:** Convertir formularios críticos a componentes `Wizard` (pasos 1, 2 y 3) o tarjetas colapsables con guardado automático (*autosave*) por sección.

### 4.3. Consistencia de Iconografía y Etiquetas
* **Problema:** Etiquetas en spanglish o términos técnicos de software (ej. "Control Tower", "Timeline", "Gantt") mezclados con lenguaje comunitario dominicano ("Comedor", "Liceos", "Guagua").
* **Solución QA recomendada:** Estandarizar a terminología puramente institucional en español dominicano claro: *"Seguimiento de Actividades"* en vez de *"Torre de Control"*; *"Planificación de Fechas"* en vez de *"Gantt"*.

---

## 5. Plan de Remediación Priorizado (Roadmap de Limpieza QA)

### Fase 1: P0 — Sentido Común Inmediato (Limpieza Rápida)
1. **Retirar `FormularioCompra` del portal del estudiante:** Los estudiantes solo deben ver solicitudes de constancia, permisos y trámites estudiantiles.
2. **Corregir ícono del Estudiante:** Cambiar `Wrench` por `GraduationCap` en `MENU_ESTUDIANTE`.
3. **Corregir enlace de Materias del Docente:** En `MENU_DOCENTE`, redirigir "Materias" a `/portal/profesor/materias` en lugar de `/academico/materias`.
4. **Incorporar botón de Almuerzo en el Portal del Estudiante:** Añadir acceso directo a inscribirse en el comedor diario en el dashboard móvil del estudiante.
5. **Limpiar menú del Chofer:** Retirar "Torre de Control" y añadir enlace directo a "Rendición de Gastos / Combustible" (`/administrativo/rendiciones`).

### Fase 2: P1 — Usabilidad y Reducción de Fricción
1. **Semáforo de Beca en el Inicio del Estudiante:** Widget de 3 círculos: Índice ($\ge 80$), Servicio Comunitario (Horas del mes), Reunión Mensual (Asistió/Pendiente).
2. **Bandeja de Aprobaciones Unificada para Administración:** Centralizar aprobaciones en una sola cola clasificada por urgencia.
3. **Pase de Lista Ágil para Docentes:** Botón "Todos presentes" en la toma de asistencia de Clases 360 y Materias.
4. **Registro de Odómetro y Combustible para el Chofer:** Formulario adaptado al móvil con cámara para comprobante de gasoil.

### Fase 3: P2 — Madurez y Consolidación
1. **Imputación de Costo Contable por Estudiante:** Vincular órdenes y pagos universitarios al expediente del becado (según `plan-costo-por-estudiante.md`).
2. **Formulario de Expediente en Pasos (Stepper Wizard):** Separar alta de expediente en: 1. Datos Personales, 2. Situación Socioeconómica, 3. Carrera Universitaria y 4. Patrocinador.
3. **Tablero Ejecutivo para Super Admin:** Vista condensada de impacto social y financiero para la Junta Directiva.
