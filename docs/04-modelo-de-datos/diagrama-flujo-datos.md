# Diagrama de Flujo de Datos (DFD) — Global Effect Nexus

> Parte de la **Cuarta Entrega** de la tesis (junto al ERD y el Diccionario de Datos).
> Representa cómo fluyen los datos entre las entidades externas (usuarios por rol), los procesos del sistema y los almacenes de datos (tablas).
> Diagramas en **Mermaid**. Convención DFD: **entidad externa** (quién interactúa), **proceso** (transforma datos), **almacén de datos** (dónde se guardan).

---

## 1. Nivel 0 — Diagrama de contexto

Visión general: quién usa el sistema y qué información intercambia con él.

```mermaid
flowchart TB
  ADMIN([Administrativo])
  DOCENTE([Docente])
  ESTUDIANTE([Estudiante])
  DIRECCION([Dirección])
  HAB([Habitudes])
  CONTA([Contabilidad])
  PUBLICO([Público / Visitante])
  IA{{Servicio de IA / OCR}}

  SISTEMA[("SISTEMA<br/>Global Effect Nexus")]

  ADMIN -->|expedientes, tareas, patrocinadores| SISTEMA
  SISTEMA -->|reportes, notificaciones| ADMIN
  DOCENTE -->|tareas, notas finales de 360| SISTEMA
  SISTEMA -->|listas de clase, notas| DOCENTE
  ESTUDIANTE -->|trámites, consultas| SISTEMA
  SISTEMA -->|notas, materias, estado de solicitudes, respuestas IA| ESTUDIANTE
  DIRECCION -->|aprobación de segundo nivel| SISTEMA
  SISTEMA -->|solicitudes pendientes de dirección| DIRECCION
  HAB -->|candidatos del embudo| SISTEMA
  CONTA -->|transacciones, revisión de gastos| SISTEMA
  SISTEMA -->|balances, reportes, gastos por aprobar| CONTA
  PUBLICO -->|inscripción de comida| SISTEMA
  SISTEMA -->|confirmación| PUBLICO
  SISTEMA <-->|documentos a analizar / datos extraídos| IA
```

---

## 2. Nivel 1 — Procesos principales y almacenes

Descomposición del sistema en sus procesos y los almacenes (tablas) que leen/escriben.

```mermaid
flowchart LR
  %% Entidades externas
  ADMIN([Administrativo])
  DOCENTE([Docente])
  ESTUDIANTE([Estudiante])
  DIRECCION([Dirección])
  HAB([Habitudes])
  CONTA([Contabilidad])
  PUBLICO([Público])
  IAEXT{{IA / OCR}}

  %% Procesos
  P1[1. Autenticación y control de acceso]
  P2[2. Gestión de expedientes]
  P3[3. Gestión académica]
  P4[4. Patrocinio y becas]
  P5[5. Solicitudes y aprobaciones]
  P6[6. Operaciones y calendario]
  P7[7. Finanzas]
  P8[8. Bienestar comida]
  P9[9. Asistentes de IA]

  %% Almacenes de datos
  D1[(usuario / rol / permiso)]
  D2[(estudiante + perfiles + familiar)]
  D3[(periodo / materia / inscripcion / materia_360 / inscripcion_360 / historial_calificacion)]
  D4[(patrocinador / asignacion_beca)]
  D5[(solicitud / solicitud_paso)]
  D6[(proyecto / tarea / evento / registro_servicio)]
  D7[(transaccion)]
  D8[(inscripcion_comida)]
  D9[(conversacion_ia / mensaje_ia / extraccion_ocr / fragmento_conocimiento)]
  DOC[(documento)]

  %% Acceso (todos los roles internos pasan por P1)
  ADMIN --> P1
  DOCENTE --> P1
  ESTUDIANTE --> P1
  DIRECCION --> P1
  HAB --> P1
  CONTA --> P1
  P1 <--> D1

  %% Expedientes
  ADMIN --> P2
  HAB -->|postula| P2
  P2 <--> D2
  P2 --> DOC
  P2 <-->|OCR| P9

  %% Académico
  DOCENTE --> P3
  ESTUDIANTE --> P3
  P3 <--> D3
  P3 --> D2

  %% Patrocinio
  ADMIN --> P4
  P4 <--> D4
  P4 --> D2

  %% Solicitudes y aprobaciones
  ESTUDIANTE -->|trámite| P5
  ADMIN -->|revisa / pide alta o beca| P5
  CONTA -->|revisa gastos| P5
  DIRECCION -->|segundo nivel| P5
  P5 <--> D5
  P5 -.lee.-> D2
  P5 -->|notifica| D1

  %% Operaciones
  ADMIN --> P6
  P6 <--> D6
  P6 -->|notifica| D1

  %% Finanzas
  CONTA --> P7
  P7 <--> D7
  P7 --> D4

  %% Comida
  PUBLICO --> P8
  P8 <--> D8

  %% IA
  ESTUDIANTE --> P9
  ADMIN --> P9
  P9 <--> D9
  P9 <--> IAEXT
  P9 -.lee contexto.-> D2
  P9 -.lee contexto.-> D3
```

---

## 3. Flujos automatizados clave (detalle)

Procesos con lógica de negocio encadenada (coinciden con los flujos del sistema):

### 3.1 OCR → Expediente
```mermaid
flowchart LR
  A([Administrativo]) -->|sube documento| P[Proceso OCR]
  P --> DOC[(documento)]
  P -->|envía imagen| IA{{IA / OCR}}
  IA -->|datos extraídos| P
  P --> OCR[(extraccion_ocr)]
  P -->|guarda / precarga| EST[(estudiante + perfiles)]
```

### 3.2 Tarea → Notificación → Calendario
```mermaid
flowchart LR
  A([Administrativo]) -->|crea tarea + asignados| P[Gestión de tareas]
  P --> T[(tarea / tarea_asignado)]
  P -->|correo| MAIL{{Servicio de email}}
  P -->|notificación interna| N[(notificacion)]
  P -->|evento automático| E[(evento)]
```

### 3.3 Solicitud → Aprobación
```mermaid
flowchart LR
  S([Solicitante]) -->|crea solicitud| P[Solicitudes y aprobaciones]
  P --> SOL[(solicitud)]
  P --> PASO[(solicitud_paso)]
  P -->|aviso a revisores| N[(notificacion)]
  R([Revisor]) -->|revisa / aprueba / rechaza| P
  D([Dirección]) -->|segundo nivel si requiere_direccion| P
  P -->|aprobar, rechazar, completar| AUD[(audit_log)]
  P -->|cada cambio, al solicitante| N
  M[Módulo dueño] -->|ejecuta y marca completada| P
```

La solicitud no ejecuta efectos por su cuenta: el módulo dueño (contabilidad, expedientes, patrocinio) hace el cambio y entonces la solicitud pasa a `completada`. Nadie aprueba su propia solicitud.

### 3.4 Chat IA con contexto (RAG)
```mermaid
flowchart LR
  U([Usuario]) -->|pregunta| P[Asistente IA]
  P -->|búsqueda semántica| FRAG[(fragmento_conocimiento · pgvector)]
  P -.lee.-> DATOS[(estudiantes / materias / finanzas ...)]
  P -->|prompt + contexto| IA{{Modelo de IA}}
  IA -->|respuesta| P
  P --> MSG[(conversacion_ia / mensaje_ia)]
  P -->|respuesta| U
```

---

## 4. Correspondencia procesos ↔ tablas ↔ permisos (RBAC)

| Proceso | Almacenes (tablas) | Permiso requerido |
|---|---|---|
| 1. Autenticación / acceso | `usuario`, `rol`, `permiso`, `rol_permiso` | — (login) / `usuarios.administrar` |
| 2. Expedientes | `estudiante`, `perfil_*`, `familiar`, `documento` | `expedientes.leer` / `.escribir` / `.eliminar` (administración) · `expedientes.postular` (habitudes) |
| 3. Académico | `periodo`, `materia`, `inscripcion`, `historial_calificacion`, `materia_360`, `ventana_prematricula`, `inscripcion_360`, `asignacion`, `entrega_estudiante` | `academico.*`, `calificaciones.registrar` |
| 4. Patrocinio y becas | `patrocinador`, `asignacion_beca` | `patrocinadores.*` |
| 5. Solicitudes y aprobaciones | `solicitud`, `solicitud_paso`, `notificacion`, `audit_log` | `solicitudes.gestionar` · `solicitudes.direccion` · `finanzas.escribir` (gastos) · el estudiante, sobre las suyas |
| 6. Operaciones | `proyecto`, `tarea`, `tarea_asignado`, `evento`, `registro_servicio`, `notificacion` | `operaciones.*` |
| 7. Finanzas | `transaccion` | `finanzas.leer` / `.escribir` |
| 8. Bienestar (comida) | `inscripcion_comida` | — (público) |
| 9. Asistentes de IA | `conversacion_ia`, `mensaje_ia`, `extraccion_ocr`, `fragmento_conocimiento` | `ia.usar` / `ia.administrar` |

> Desde la migración `0047` (24 oct 2026) el proceso 3 ya no tiene cursos técnicos: `curso` y `calificacion` se borraron. El docente da clases de Global Effect 360 —publica tareas, revisa entregas y pone la nota final de cada `inscripcion_360` con `calificaciones.registrar`—, y el estudiante elige una materia de 360 en cada una de las dos tandas del cuatrimestre.

> El proceso **1** es transversal: todo acceso a los procesos 2–7 y 9 pasa antes por autenticación y verificación de permisos (RBAC).
