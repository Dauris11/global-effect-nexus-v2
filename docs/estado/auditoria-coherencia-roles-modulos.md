# Auditoría Profunda de Sentido, Lógica y Coherencia entre Módulos y Roles
**Portal GlobalEffect (Fundación Global Effect — La Vega, República Dominicana)**  
**Fecha:** 25 de noviembre de 2026  
**Pregunta Rectora de Auditoría:** *«¿Es correcto y tiene sentido que este rol pueda ver y hacer esto en la operación real de la Fundación?»*

---

## 1. Metodología y Criterio de Evaluación

La Fundación Global Effect es una organización sin fines de lucro (ASFL) en La Vega, RD, cuyo propósito central es rescatar a jóvenes en vulnerabilidad a través de valores (Programa Habitudes en liceos públicos), formarlos en liderazgo (Global Effect 360) y acompañarlos integralmente con becas universitarias completas (UCATECI, UNPHU, UASD, UTESA), cubriendo transporte, alimentación, tutorías y seguimiento socioeconómico.

Para auditar el sistema no basta con verificar que el código compile o que las rutas tengan un `requerirPermiso`: se analizó cada interacción humana poniéndose en los zapatos de cada usuario real y preguntando:
1. **¿Pertenece esta función a su responsabilidad institucional?** (Pertinencia de rol).
2. **¿Tiene las herramientas que necesita para su día a día sin fricción?** (Completitud funcional).
3. **¿La información fluye entre un módulo y el siguiente?** (Coherencia inter-módulos).
4. **¿El lenguaje, la jerarquía visual y la complejidad son acordes a su perfil?** (Adecuación UX).

---

## 2. Radiografía Exhaustiva Rol por Rol

---

### 2.1. Estudiante (`estudiante`)
* **Quién es:** Joven becado (18 a 24 años), estudiante universitario diurno, con smartphone de gama media y plan de datos móviles recargable.

| Función / Pantalla actual | ¿Es correcto que la tenga este rol? | Veredicto y Justificación |
|---|---|---|
| **`FormularioCompra` (Cotizaciones y órdenes a contabilidad)** en `/portal/estudiante/solicitudes` | ❌ **TOTALMENTE INCORRECTO** | **Absurdo operativo.** Un estudiante becado no es un encargado de adquisiciones corporativas. No debe cotizar a suplidores con RNC ni pedir cheques contables. Sus solicitudes son académicas (constancia de estudios, permisos de inasistencia, ayuda para libros o batas). |
| **Agendar reuniones con cualquier empleado (`reuniones.agendar`)** | ❌ **INCORRECTO** | **Falta de jerarquía y control.** El estudiante tiene `reuniones.agendar` de fábrica y ve el directorio completo de correos de la directiva, administración y profesores. En una fundación, un estudiante solicita una cita con su tutor o coordinador; no le «convoca una reunión» a la Dirección Ejecutiva en su Google Calendar. |
| **Inscribir invitados en el autobús escolar (`Invitados`)** | ⚠️ **RIESGO OPERATIVO** | **Riesgo de seguro y cupos.** Los estudiantes pueden registrar "amigos invitados" para subirse al autobús de la fundación sin aprobación previa de Transporte o Administración, poniendo en riesgo la capacidad del vehículo y la responsabilidad civil. |
| **Ausencia de acceso directo al Comedor en su Menú** | ❌ **GRAVE OMISIÓN** | **Fricción innecesaria.** El estudiante come todos los días en la fundación, pero no tiene enlace a Comida en su barra lateral. Tiene que recordar entrar a la URL pública `/comida`. Debe tener un botón destacado de reserva diaria con 1 toque. |
| **Semáforo de Beca (Índice, Servicio Comunitario y Reunión del Mes)** | ✅ **CORRECTO Y VITAL** | **Acierto de retención.** Es lo que define si mantiene la beca. Debe estar en la parte superior de su pantalla de inicio todos los días. |
| **Ícono de Llave Inglesa (`Wrench`) en su menú** | ❌ **INCORRECTO** | **Diseño confuso.** El portal del estudiante no es un panel de ajustes técnicos. El ícono debe ser un birrete (`GraduationCap`) o un libro (`BookOpen`). |

---

### 2.2. Docente (`docente`)
* **Quién es:** Profesor que imparte los módulos de Global Effect 360 (Liderazgo, Principios, Vida Universitaria) en tandas sabatinas o vespertinas en la sede de la Fundación.

| Función / Pantalla actual | ¿Es correcto que la tenga este rol? | Veredicto y Justificación |
|---|---|---|
| **Enlace de "Materias" redirige a `/academico/materias`** | ❌ **TOTALMENTE INCORRECTO** | **Desvío al módulo equivocado.** En `MENU_DOCENTE`, el botón lo envía al catálogo institucional donde administración registra códigos de asignaturas. El profesor debe ir a `/portal/profesor/materias` (su aula, sus alumnos inscritos, sus asistencias y sus tareas). |
| **Módulo Habitudes en su menú principal (`/habitudes`)** | ⚠️ **CONFUSO** | **Sobreingeniería.** Los docentes de 360 dan clases a becados universitarios en la Fundación, no en liceos públicos. Tienen permisos para subir evidencias de liceos (`habitudes.evidencias.subir`) que jamás usan. Solo deberían ver los recursos pedagógicos si los necesitan como material de apoyo. |
| **Torre de Control (`/administrativo/torre-control`)** | ❌ **INCORRECTO** | **Herramienta corporativa ajena.** Un profesor por horas no gestiona tareas en tableros Kanban de proyectos institucionales. Su única carga de trabajo son sus clases, asistencias y calificaciones. |
| **Bandeja de Entregas por Calificar (`/portal/profesor/entregas`)** | ✅ **CORRECTO Y NECESARIO** | **Excelente adición reciente.** Permite revisar las tareas entregadas por los alumnos en una sola cola sin tener que abrir materia por materia. |
| **Pase de lista alumno por alumno** | ⚠️ **LENTO Y MEJORABLE** | **Falta de sentido práctico.** Si asisten 28 de 30 estudiantes, el profesor tiene que hacer 28 clics para marcarlos presentes. Debe haber un botón *"Marcar todos presentes"* y solo desmarcar a los 2 ausentes. |

---

### 2.3. Chofer (`chofer`)
* **Quién es:** Conductor del autobús institucional que transporta a los becados desde diferentes sectores de La Vega hasta la sede y las universidades. Opera en la calle, con el celular en un soporte vehicular.

| Función / Pantalla actual | ¿Es correcto que la tenga este rol? | Veredicto y Justificación |
|---|---|---|
| **Carencia del permiso `rendicion.enviar`** | ❌ **BLOQUEO CRÍTICO** | **Paradoja contable.** El chofer es quien más gasta efectivo en la calle (combustible, pinchazos, peajes), pero en `src/lib/rbac.ts` no tiene `rendicion.enviar`. Si intenta subir una factura de gasoil a contabilidad, el sistema le responde 403 No Permitido. |
| **Torre de Control y Calendario de Reuniones corporativas** | ❌ **TOTALMENTE INCORRECTO** | **Absurdo UX.** El menú del chofer le muestra tableros de gestión ágil de proyectos (`/administrativo/torre-control`) y calendarios de reuniones ejecutivas. No tiene ningún sentido para alguien al volante. |
| **Falta de registro de Odómetro / Kilometraje** | ❌ **GRAVE OMISIÓN** | **Control de flota inexistente.** No hay dónde registrar el kilometraje al encender la guagua y al apagarla para cruzarlo con el consumo de combustible. |
| **Panel de Inicio/Fin de Viaje y Lista de Pasajeros** | ✅ **CORRECTO** | **Esencia de su trabajo.** Inicia recorrido, el GPS transmite la ubicación y va marcando quién subió en cada parada. |

---

### 2.4. Facilitador Habitudes (`habitudes`)
* **Quién es:** Facilitador de valores que visita escuelas y liceos públicos del Distrito 06 de La Vega, reuniéndose con directores y estudiantes de secundaria.

| Función / Pantalla actual | ¿Es correcto que la tenga este rol? | Veredicto y Justificación |
|---|---|---|
| **Ceguera sobre el estatus de sus candidatos postulados** | ❌ **DESCONEXIÓN TOTAL** | **Frustración operativa.** El facilitador tiene `expedientes.postular`, pero no tiene `expedientes.leer`. Postula a un joven talentoso de un liceo mediante una solicitud, pero nunca más sabe si el joven fue admitido, si le dieron la beca o si fue rechazado. No puede dar seguimiento a su propio trabajo de reclutamiento. |
| **Falta de acceso a la Academia de Liderazgo (`/academias/*`)** | ❌ **INCOHERENCIA DE ACCESO** | **Permisos invertidos.** La Academia de Liderazgo es parte del currículo de Habitudes, pero sus páginas exigen `academico.leer`, permiso que Habitudes NO tiene. El menú de Habitudes no las incluye, y si intentan entrar, les da error. |
| **Torre de Control de Proyectos en su menú** | ⚠️ **POCO ÚTIL** | **Burocracia innecesaria.** El facilitador de campo necesita un listado claro de visitas a liceos para hoy con enlace al mapa, no un software de gestión de proyectos corporativos. |

---

### 2.5. Director de Habitudes (`dir_habitudes`)
* **Quién es:** Director del programa, enlace con el Ministerio de Educación (MINERD) y supervisor de los facilitadores de La Vega.

| Función / Pantalla actual | ¿Es correcto que la tenga este rol? | Veredicto y Justificación |
|---|---|---|
| **Mismo menú idéntico que el facilitador (`MENU_HABITUDES`)** | ❌ **INCORRECTO** | **Falta de jerarquía.** En `src/lib/nav.ts`, `dir_habitudes` recibe `MENU_HABITUDES`. Un director pedagógico necesita ver métricas de liceos, comparativas de impacto, supervisión de facilitadores y aprobación de evidencias en su barra lateral, no el menú básico de un facilitador de campo. |
| **Aprobación de postulaciones a becas** | ⚠️ **FLUXO CONFUSO** | **Paso fantasma.** Las postulaciones de liceos van a administración, sin una etapa formal de visto bueno pedagógico del Director de Habitudes. |

---

### 2.6. Contabilidad (`contabilidad`)
* **Quién es:** Contables colegiados responsables de la contabilidad fiscal de la ONG ante la DGII (Ley 122-05), conciliaciones bancarias, compras, nómina y donaciones.

| Función / Pantalla actual | ¿Es correcto que la tenga este rol? | Veredicto y Justificación |
|---|---|---|
| **Torre de Control de Operaciones en su menú** | ❌ **INCORRECTO** | **Ruido cognitivo.** Contabilidad tiene su propia bandeja de entrada especializada: **«Mi Día»** (`/contabilidad/mi-dia`). Añadir la Torre de Control de tareas institucionales solo mezcla temas administrativos con el rigor contable. |
| **Imputación de gastos por estudiante inexistente en la interfaz** | ❌ **GRAVE OMISIÓN** | **Carencia analítica.** Cuando pagan la factura global de matrícula a UCATECI o compran útiles, no pueden imputar ese gasto al estudiante becado. La Fundación no puede saber cuánto le cuesta cada graduado. |
| **14 módulos retirados que siguen vivos en código** | ⚠️ **DEUDA TÉCNICA** | **Mantenimiento costoso.** Retenciones, calculadoras, centros de costo, etc., están apagados en el menú pero activos en la base y consultas. |
| **Conciliación bancaria y libros oficiales** | ✅ **EXCELENTE** | **Cimientos robustos.** Partida doble inmutable, bitácora criptográfica y conciliación 1 a varios funcionando a la perfección. |

---

### 2.7. Administración / Coordinación (`admin`)
* **Quién es:** Coordinación operativa y académica de la Fundación (admisiones, bienestar, eventos, expedientes).

| Función / Pantalla actual | ¿Es correcto que la tenga este rol? | Veredicto y Justificación |
|---|---|---|
| **Permiso para eliminar expedientes (`expedientes.eliminar`)** | ❌ **PELIGROSO** | **Riesgo de pérdida de datos.** Un coordinador no debe poder borrar físicamente un estudiante becado de la base de datos. El borrado debe estar restringido a `super_admin` con confirmación reforzada, o manejarse como archivado / baja lógica. |
| **Área de Finanzas en el menú con módulos en solo lectura** | ❌ **INCORRECTO** | **Menú inflado.** El menú lateral de administración incluye el área Finanzas con módulos que no puede editar por política institucional de separación de funciones. |
| **Cuádruple dispersión de tareas** | ❌ **CONFUSO** | **Falta de foco.** El coordinador tiene Tareas, Tareas Hoy, Torre de Control, Torre Equipo y Proyectos. No sabe dónde organizar el trabajo diario del personal. |

---

### 2.8. Super Administrador (`super_admin`)
* **Quién es:** Dirección Ejecutiva / Junta Directiva de la Fundación Global Effect.

| Función / Pantalla actual | ¿Es correcto que la tenga este rol? | Veredicto y Justificación |
|---|---|---|
| **Aterrizaje forzado en la bandeja de micro-tareas (`/bandeja`)** | ❌ **INCORRECTO** | **Falta de perspectiva ejecutiva.** El Director Ejecutivo entra a la misma bandeja de tickets operativos que el personal de recepción, en vez de un **Tablero de Control Ejecutivo** con indicadores clave: Total becados activos, Índice promedio institucional, Becados en riesgo, Saldo disponible en bancos y Cumplimiento con donantes. |
| **Separación de funciones en contabilidad (`solo auditar`)** | ✅ **MUY CORRECTO** | **Gobierno corporativo.** El super_admin puede ver y auditar todo, pero no puede registrar asientos a su antojo sin pasar por el departamento de contabilidad. Excelente cumplimiento de auditoría. |

---

## 3. Coherencia entre Módulos (Flujos Inter-Departamentales)

### 3.1. Transporte $\longleftrightarrow$ Comedor (Alimentación)
* **Incoherencia actual:** Si un estudiante notifica que no asistirá a la fundación (o el chofer no lo recoge en la parada matutina), la cocina del comedor no se entera y prepara su porción de almuerzo, generando desperdicio de comida y costo innecesario.
* **Flujo correcto:** La falta en la guagua matutina debe descontar automáticamente el comensal de la lista de cocina de ese día antes de las 10:00 AM.

### 3.2. Habitudes $\longleftrightarrow$ Admisión de Becados
* **Incoherencia actual:** El facilitador postula a un estudiante en un liceo y el trámite entra como una solicitud administrativa aislada.
* **Flujo correcto:** Debe existir un **Embudo de Talento** visual: `Candidato en Liceo` $\to$ `Evaluado por Habitudes` $\to$ `Visto Bueno Dir. Habitudes` $\to$ `Aprobación Beca por Dirección` $\to$ `Expediente Activo`. Y el facilitador debe ver el badge de su candidato: *"Aceptado en UCATECI"*.

### 3.3. Rendición de Gastos $\longleftrightarrow$ Solicitudes Aprobadas
* **Incoherencia actual:** En `/administrativo/rendiciones`, un colaborador sube facturas sueltas sin referenciar la solicitud de gasto previo que aprobó el desembolso.
* **Flujo correcto:** Cada rendición debe estar vinculada obligatoriamente al código de solicitud aprobada (`solicitud_id`), cerrando el ciclo: *Petición de dinero $\to$ Aprobación $\to$ Desembolso $\to$ Comprobantes fiscales $\to$ Cierre de rendición*.

---

## 4. Matriz de Correcciones Inmediatas Recomendadas

| Módulo / Archivo | Rol afectado | Acción Correctiva de QA |
|---|---|---|
| `src/app/[locale]/(portal)/portal/estudiante/solicitudes/page.tsx` | `estudiante` | **Eliminar `<FormularioCompra />`** del portal del estudiante. |
| `src/lib/nav.ts` (L. 434) | `estudiante` | Cambiar ícono `Wrench` por `GraduationCap`. |
| `src/lib/nav.ts` (L. 559) | `docente` | Cambiar enlace de Materias de `/academico/materias` a `/portal/profesor/materias`. |
| `src/lib/rbac.ts` (L. 321) | `chofer` | **Conceder `rendicion.enviar` al chofer** para que pueda rendir facturas de combustible. |
| `src/lib/nav.ts` (L. 763) | `chofer` | Quitar Torre de Control y Calendario; agregar enlace a "Rendición de Gastos". |
| `src/lib/nav.ts` (L. 865) | `dir_habitudes` | Crear `MENU_DIR_HABITUDES` con foco en supervisión y mapa de liceos. |
| `src/lib/rbac.ts` (L. 251) | `admin` | **Retirar `expedientes.eliminar` a `admin`**, dejándolo exclusivo de `super_admin`. |
| `src/app/[locale]/(portal)/portal/estudiante/page.tsx` | `estudiante` | Agregar botón de acceso rápido para reservar almuerzo del día. |
