# Diagrama Entidad-Relación — Global Effect Nexus

> Base de datos: **PostgreSQL 17 (Supabase)**. Este ERD refleja el núcleo del esquema desplegado por las migraciones `db/migrations/0001`–`0012`, con el cambio de alcance de octubre de 2026 ya aplicado: la `0030` retira las tablas de psicología (la Fundación eliminó el departamento) y la `0031` añade `solicitud` y `solicitud_paso`. El 24 de octubre la `0047` retira los cursos técnicos: se van `curso`, `calificacion` y el enum `tipo_evaluacion`, y `tipo_estudiante` se queda con un solo valor, `becado` (33 tablas del núcleo, 6 enums, pgvector para IA). Las tablas que llegaron en `0015`–`0029` (landing, noticia, aula virtual, etc.) se documentan en sus migraciones; entre ellas están las de Global Effect 360 (`materia_360`, `ventana_prematricula`, `inscripcion_360`), que desde la `0047` ocupan el lugar de los cursos técnicos.
> Los diagramas están en sintaxis **Mermaid** (se renderizan en GitHub, VS Code, Obsidian o [mermaid.live](https://mermaid.live)).

## Convenciones

- **PK** = clave primaria · **FK** = clave foránea · **UK** = único.
- Cardinalidades: `||--o{` = uno-a-muchos · `||--||` / `||--o|` = uno-a-uno · `}o--o{` = muchos-a-muchos (resuelto con tabla intermedia).
- Todas las PK son `UUID` (`gen_random_uuid()`), y las tablas con `updated_at` tienen trigger de auditoría de fecha.

---

## 1. Diagrama global (relaciones entre dominios)

```mermaid
erDiagram
  ROL                     ||--o{ USUARIO                : tiene
  ROL                     ||--o{ ROL_PERMISO            : agrupa
  PERMISO                 ||--o{ ROL_PERMISO            : concede
  USUARIO                 ||--o| ESTUDIANTE            : "credencial de"
  USUARIO                 ||--o{ NOTIFICACION           : recibe
  USUARIO                 ||--o{ AUDIT_LOG              : genera
  USUARIO                 ||--o{ DOCUMENTO              : sube
  USUARIO                 ||--o{ SOLICITUD              : solicita
  USUARIO                 ||--o{ SOLICITUD              : "es responsable de"
  USUARIO                 ||--o{ SOLICITUD_PASO         : registra
  USUARIO                 ||--o{ TAREA_ASIGNADO         : "asignado a"
  USUARIO                 ||--o{ CONVERSACION_IA        : inicia

  PATROCINADOR            ||--o{ ESTUDIANTE            : financia
  PATROCINADOR            ||--o{ ASIGNACION_BECA        : aporta

  ESTUDIANTE              ||--o{ FAMILIAR               : tiene
  ESTUDIANTE              ||--o| PERFIL_VIVIENDA        : reside
  ESTUDIANTE              ||--o| PERFIL_SALUD           : "salud de"
  ESTUDIANTE              ||--o| PERFIL_SOCIOECONOMICO  : "contexto de"
  ESTUDIANTE              ||--o{ ASIGNACION_BECA        : recibe
  ESTUDIANTE              ||--o{ INSCRIPCION            : matricula
  ESTUDIANTE              ||--o{ HISTORIAL_CALIFICACION : acumula
  ESTUDIANTE              ||--o{ SOLICITUD              : "objeto de"
  ESTUDIANTE              ||--o{ REGISTRO_SERVICIO      : reporta
  ESTUDIANTE              ||--o{ EXTRACCION_OCR         : "OCR de"

  DOCUMENTO               ||--o{ ESTUDIANTE            : "foto/expediente"
  DOCUMENTO               ||--o{ MATERIAL              : archivo
  DOCUMENTO               ||--o{ EXTRACCION_OCR         : origen

  PERIODO                 ||--o{ MATERIA               : enmarca
  PERIODO                 ||--o{ INSCRIPCION           : programa
  MATERIA                 ||--o{ INSCRIPCION           : incluye

  ACADEMIA                ||--o{ MATERIAL              : contiene

  SOLICITUD               ||--o{ SOLICITUD_PASO         : "historial de"

  PROYECTO                ||--o{ TAREA                 : agrupa
  TAREA                   ||--o{ TAREA_ASIGNADO         : asigna
  TAREA                   ||--o| EVENTO                : "agenda en"

  CONVERSACION_IA         ||--o{ MENSAJE_IA            : contiene
```

> `TRANSACCION`, `INSCRIPCION_COMIDA` y `FRAGMENTO_CONOCIMIENTO` son entidades sin FK entrantes en el grafo principal (se detallan por dominio abajo). `FRAGMENTO_CONOCIMIENTO.fuente_id` es una referencia polimórfica lógica (no física) a cualquier entidad.

---

## 2. Identidad y control de acceso (RBAC)

```mermaid
erDiagram
  ROL ||--o{ ROL_PERMISO : agrupa
  PERMISO ||--o{ ROL_PERMISO : concede
  ROL ||--o{ USUARIO : tiene

  ROL {
    uuid id PK
    text nombre UK
    text descripcion
    timestamptz created_at
    timestamptz updated_at
  }
  PERMISO {
    uuid id PK
    text codigo UK "expedientes.leer, solicitudes.gestionar, ia.usar..."
    text descripcion
  }
  ROL_PERMISO {
    uuid rol_id PK,FK
    uuid permiso_id PK,FK
  }
  USUARIO {
    uuid id PK
    citext email UK "case-insensitive"
    text password_hash "bcrypt/argon2"
    text nombre
    text idioma "es | en"
    boolean activo
    uuid rol_id FK
    timestamptz ultimo_acceso
    timestamptz created_at
    timestamptz updated_at
  }
```

---

## 3. Estudiantes (expediente normalizado)

El expediente se descompone en tablas hijas (2NF/3NF): familiares (1:N) y perfiles 1:1.

```mermaid
erDiagram
  PATROCINADOR ||--o{ ESTUDIANTE : financia
  USUARIO ||--o| ESTUDIANTE : "credencial de"
  ESTUDIANTE ||--o{ FAMILIAR : tiene
  ESTUDIANTE ||--o| PERFIL_VIVIENDA : reside
  ESTUDIANTE ||--o| PERFIL_SALUD : "salud de"
  ESTUDIANTE ||--o| PERFIL_SOCIOECONOMICO : "contexto de"
  ESTUDIANTE ||--o{ ASIGNACION_BECA : recibe
  PATROCINADOR ||--o{ ASIGNACION_BECA : aporta

  ESTUDIANTE {
    uuid id PK
    text nombre
    text cedula UK
    citext email
    date fecha_nacimiento
    genero genero "enum"
    tipo_estudiante tipo "becado (unico valor desde 0047)"
    estado_estudiante estado "pipeline: reclutado..graduado"
    text programa
    text universidad
    uuid patrocinador_id FK
    uuid foto_id FK
    uuid imagen_habitudes_id FK
    uuid expediente_id FK
    uuid usuario_id FK,UK
    timestamptz created_at
    timestamptz updated_at
  }
  FAMILIAR {
    uuid id PK
    uuid estudiante_id FK
    parentesco parentesco "enum"
    text nombre
    int edad
    text telefono
    text profesion
  }
  PERFIL_VIVIENDA {
    uuid estudiante_id PK,FK
    text con_quien_vive
    int hermanos_cantidad
    text casa_propia
    int habitaciones
    int camas
    text ciudad_residencia
    text pais_residencia
  }
  PERFIL_SALUD {
    uuid estudiante_id PK,FK
    text enfermedades
    text alergias
    text contacto_emergencia_nombre
    text contacto_emergencia_telefono
  }
  PERFIL_SOCIOECONOMICO {
    uuid estudiante_id PK,FK
    text historia_de_vida
    text situacion_familiar
    text situacion_economica
    text motivo_beca
    text metas_academicas
  }
  ASIGNACION_BECA {
    uuid id PK
    uuid estudiante_id FK
    uuid patrocinador_id FK
    numeric monto
    date fecha_inicio
    date fecha_fin
    text estado
  }
  PATROCINADOR {
    uuid id PK
    text nombre
    tipo_patrocinador tipo "enum"
    citext email
    text pais
    text estado
    numeric monto_mensual
  }
```

---

## 4. Académico

```mermaid
erDiagram
  PERIODO ||--o{ MATERIA : enmarca
  PERIODO ||--o{ INSCRIPCION : programa
  ESTUDIANTE ||--o{ INSCRIPCION : matricula
  MATERIA ||--o{ INSCRIPCION : incluye
  ESTUDIANTE ||--o{ HISTORIAL_CALIFICACION : acumula

  PERIODO {
    uuid id PK
    text nombre UK "2026-I"
    date fecha_inicio
    date fecha_fin
    text estado
  }
  MATERIA {
    uuid id PK
    text nombre
    text codigo
    uuid periodo_id FK
    int creditos
    text profesor_nombre
    uuid profesor_usuario_id FK
    text estado
  }
  INSCRIPCION {
    uuid id PK
    uuid estudiante_id FK
    uuid materia_id FK
    uuid periodo_id FK
    text estado
  }
  HISTORIAL_CALIFICACION {
    uuid id PK
    uuid estudiante_id FK
    text cuatrimestre
    text materia
    numeric nota_numerica
    text nota_letra "A-F"
    numeric gpa "0-4"
    text estado
  }
```

> `INSCRIPCION` impone `UNIQUE (estudiante_id, materia_id, periodo_id)` para evitar matrículas duplicadas.
>
> Hasta la `0047` este dominio tenía además `CURSO` (cursos técnicos) y `CALIFICACION` (notas por evaluación de esos cursos, con el enum `tipo_evaluacion`). La Fundación dejó de impartir cursos técnicos y las dos tablas se borraron sin copia, igual que la `0030` hizo con Psicología. Las notas universitarias siguen en `HISTORIAL_CALIFICACION`; la de Global Effect 360 es la `nota` final de cada `inscripcion_360`, que pone el docente con `calificaciones.registrar` y decide si queda `aprobada` o `reprobada`.

---

## 5. Academias y solicitudes

```mermaid
erDiagram
  ACADEMIA ||--o{ MATERIAL : contiene
  DOCUMENTO ||--o{ MATERIAL : archivo
  USUARIO ||--o{ SOLICITUD : solicita
  USUARIO ||--o{ SOLICITUD : "es responsable de"
  ESTUDIANTE ||--o{ SOLICITUD : "objeto de"
  SOLICITUD ||--o{ SOLICITUD_PASO : "historial de"
  USUARIO ||--o{ SOLICITUD_PASO : registra

  ACADEMIA {
    uuid id PK
    text nombre
    text tipo "liderazgo|habilidades|otro"
    text facilitador
    text estado
    int participantes
  }
  MATERIAL {
    uuid id PK
    text titulo
    uuid academia_id FK
    text tipo
    uuid documento_id FK
    text enlace_url
    text autor
  }
  SOLICITUD {
    uuid id PK
    bigint folio UK "identidad, legible"
    text tipo "constancia|carta|cita_administracion|permiso|otro|alta_expediente|beca|gasto"
    text estado "enviada|en_revision|pendiente_direccion|aprobada|rechazada|completada|cancelada"
    text titulo
    text detalle
    uuid solicitante_id FK
    uuid estudiante_id FK
    numeric monto "USD, > 0"
    date fecha_requerida
    text hora_preferida
    boolean requiere_direccion
    uuid responsable_id FK
    text respuesta
    timestamptz resuelta_en
    timestamptz created_at
    timestamptz updated_at
  }
  SOLICITUD_PASO {
    uuid id PK
    uuid solicitud_id FK
    text estado_anterior
    text estado_nuevo
    text comentario
    uuid usuario_id FK
    timestamptz created_at
  }
```

> **Flujo:** `enviada` → `en_revision` → [`pendiente_direccion`] → `aprobada` → `completada`; desde los tres primeros se puede pasar a `rechazada` (con comentario) y el solicitante puede `cancelada` mientras esté en `enviada` o `en_revision`. `requiere_direccion` se fija al crear. Cada cambio deja una fila en `solicitud_paso`. Un `CHECK` exige `estudiante_id` en `alta_expediente` y `beca`, y `monto` en `gasto`.
>
> **Historia:** hasta octubre de 2026 este dominio era *Academias y psicología* (`cita_psicologia`, `nota_psicologica`, `perfil_psicologico`). La Fundación eliminó el departamento de Psicología y la migración `0030` retiró esas tablas.

---

## 6. Operaciones (proyectos, tareas, calendario, servicio)

```mermaid
erDiagram
  PROYECTO ||--o{ TAREA : agrupa
  TAREA ||--o{ TAREA_ASIGNADO : asigna
  USUARIO ||--o{ TAREA_ASIGNADO : "asignado a"
  TAREA ||--o| EVENTO : "agenda en"
  ESTUDIANTE ||--o{ REGISTRO_SERVICIO : reporta

  PROYECTO {
    uuid id PK
    text nombre
    text estado "planificacion|en_curso|completado|pausado"
    int progreso "0-100"
    date fecha_inicio
    date fecha_fin
  }
  TAREA {
    uuid id PK
    text titulo
    uuid proyecto_id FK
    text visibilidad "todos|asignados"
    text estado "pendiente|en_progreso|completada|cancelada"
    text prioridad "baja|media|alta|urgente"
    date fecha_limite
  }
  TAREA_ASIGNADO {
    uuid tarea_id PK,FK
    uuid usuario_id PK,FK
  }
  EVENTO {
    uuid id PK
    text titulo
    text tipo "academico|administrativo|social|reunion|otro"
    date fecha
    text estado
    uuid tarea_id FK "si proviene de una tarea"
  }
  REGISTRO_SERVICIO {
    uuid id PK
    uuid estudiante_id FK
    text mes "YYYY-MM"
    boolean hizo_servicio
    boolean asistio_reunion
  }
```

> `REGISTRO_SERVICIO` impone `UNIQUE (estudiante_id, mes)`. El flujo "Tarea → Evento" se refleja en `evento.tarea_id`.

---

## 7. Transversal, bienestar y finanzas

```mermaid
erDiagram
  USUARIO ||--o{ DOCUMENTO : sube
  USUARIO ||--o{ NOTIFICACION : recibe
  USUARIO ||--o{ AUDIT_LOG : genera

  DOCUMENTO {
    uuid id PK
    text nombre
    text storage_key UK
    text tipo
    text mime
    bigint tamano_bytes
    uuid subido_por_id FK
  }
  NOTIFICACION {
    uuid id PK
    uuid usuario_id FK
    text titulo
    text mensaje
    text tipo "info|alerta|tarea"
    boolean leida
    text enlace
  }
  AUDIT_LOG {
    uuid id PK
    uuid usuario_id FK
    text accion
    text entidad
    uuid entidad_id
    jsonb datos "{antes, despues}"
    inet ip
  }
  INSCRIPCION_COMIDA {
    uuid id PK
    text nombre
    date fecha
    text hora_inscripcion
    boolean confirmado
  }
  TRANSACCION {
    uuid id PK
    text concepto
    tipo_transaccion tipo "ingreso|egreso"
    numeric monto
    text categoria
    date fecha
    text referencia
  }
```

> `INSCRIPCION_COMIDA` impone `UNIQUE (nombre, fecha)` (no duplicar inscripción del mismo día).

---

## 8. Inteligencia Artificial (chat, OCR y RAG con pgvector)

```mermaid
erDiagram
  USUARIO ||--o{ CONVERSACION_IA : inicia
  CONVERSACION_IA ||--o{ MENSAJE_IA : contiene
  DOCUMENTO ||--o{ EXTRACCION_OCR : origen
  ESTUDIANTE ||--o{ EXTRACCION_OCR : destino

  CONVERSACION_IA {
    uuid id PK
    uuid usuario_id FK
    text ambito "interno|estudiantil"
    text titulo
  }
  MENSAJE_IA {
    uuid id PK
    uuid conversacion_id FK
    text rol "user|assistant|system"
    text contenido
    int tokens
  }
  EXTRACCION_OCR {
    uuid id PK
    uuid documento_id FK
    uuid estudiante_id FK
    text estado "pendiente|procesando|completado|error"
    text modelo
    numeric confianza
    jsonb datos_extraidos
    uuid creado_por_id FK
  }
  FRAGMENTO_CONOCIMIENTO {
    uuid id PK
    text fuente_tipo "estudiante|evento..."
    uuid fuente_id "referencia lógica"
    text contenido
    jsonb metadata
    vector embedding "1536 dims (HNSW cosine)"
  }
```

> `FRAGMENTO_CONOCIMIENTO` habilita **búsqueda semántica / RAG**: cada fila es un fragmento de texto de una entidad institucional con su embedding vectorial, indexado con **HNSW** (`vector_cosine_ops`) para similitud a gran escala. `EXTRACCION_OCR` da trazabilidad al flujo *OCR → Expediente*.

---

## 9. Resumen de entidades por dominio

| Dominio | Tablas |
|---|---|
| Identidad / RBAC | `rol`, `permiso`, `rol_permiso`, `usuario` |
| Transversal | `documento`, `notificacion`, `audit_log` |
| Patrocinio | `patrocinador` |
| Estudiantes | `estudiante`, `familiar`, `perfil_vivienda`, `perfil_salud`, `perfil_socioeconomico`, `asignacion_beca` |
| Académico | `periodo`, `materia`, `inscripcion`, `historial_calificacion` |
| Academias | `academia`, `material` |
| Solicitudes | `solicitud`, `solicitud_paso` |
| Operaciones | `proyecto`, `tarea`, `tarea_asignado`, `evento`, `registro_servicio` |
| Bienestar | `inscripcion_comida` |
| Finanzas | `transaccion` |
| Inteligencia Artificial | `conversacion_ia`, `mensaje_ia`, `extraccion_ocr`, `fragmento_conocimiento` |

**Total: 33 tablas del núcleo · 6 enums · pgvector (HNSW) para IA.**

---

## 10. Matriz de relaciones entre tablas

Cada fila describe una relación real implementada por una clave foránea: tabla padre, tabla hija, columna FK, cardinalidad y regla de borrado. Las relaciones **N:M** se resuelven con tablas intermedias.

| # | Tabla padre | Relación | Tabla hija | Columna FK | Cardinalidad | ON DELETE |
|---|---|---|---|---|---|---|
| 1 | `rol` | tiene | `usuario` | `rol_id` | 1:N | NO ACTION |
| 2 | `rol` | agrupa | `rol_permiso` | `rol_id` | 1:N | CASCADE |
| 3 | `permiso` | concede | `rol_permiso` | `permiso_id` | 1:N | CASCADE |
| — | `rol` ↔ `permiso` | **N:M** vía `rol_permiso` | — | — | N:M | — |
| 4 | `usuario` | es credencial de | `estudiante` | `usuario_id` (UK) | **1:1** (0..1) | SET NULL |
| 5 | `usuario` | recibe | `notificacion` | `usuario_id` | 1:N | CASCADE |
| 6 | `usuario` | genera | `audit_log` | `usuario_id` | 1:N | SET NULL |
| 7 | `usuario` | sube | `documento` | `subido_por_id` | 1:N | SET NULL |
| 8 | `usuario` | inicia | `conversacion_ia` | `usuario_id` | 1:N | SET NULL |
| 9 | `usuario` | crea | `extraccion_ocr` | `creado_por_id` | 1:N | SET NULL |
| 10 | `usuario` | solicita | `solicitud` | `solicitante_id` | 1:N | SET NULL |
| 11 | `usuario` | es responsable de | `solicitud` | `responsable_id` | 1:N | SET NULL |
| 12 | `usuario` | registra | `solicitud_paso` | `usuario_id` | 1:N | SET NULL |
| 13 | `usuario` | está asignado a | `tarea_asignado` | `usuario_id` | 1:N | CASCADE |
| — | `tarea` ↔ `usuario` | **N:M** vía `tarea_asignado` | — | — | N:M | — |
| 14 | `patrocinador` | financia | `estudiante` | `patrocinador_id` | 1:N | SET NULL |
| 15 | `patrocinador` | aporta a | `asignacion_beca` | `patrocinador_id` | 1:N | CASCADE |
| 16 | `documento` | es foto de | `estudiante` | `foto_id` | 1:N | SET NULL |
| 17 | `documento` | es imagen (habitudes) de | `estudiante` | `imagen_habitudes_id` | 1:N | SET NULL |
| 18 | `documento` | es expediente de | `estudiante` | `expediente_id` | 1:N | SET NULL |
| 19 | `documento` | es archivo de | `material` | `documento_id` | 1:N | SET NULL |
| 20 | `documento` | es origen de | `extraccion_ocr` | `documento_id` | 1:N | SET NULL |
| 21 | `estudiante` | tiene | `familiar` | `estudiante_id` | 1:N | CASCADE |
| 22 | `estudiante` | reside en | `perfil_vivienda` | `estudiante_id` (PK) | **1:1** | CASCADE |
| 23 | `estudiante` | tiene salud | `perfil_salud` | `estudiante_id` (PK) | **1:1** | CASCADE |
| 24 | `estudiante` | tiene contexto | `perfil_socioeconomico` | `estudiante_id` (PK) | **1:1** | CASCADE |
| 25 | `estudiante` | recibe | `asignacion_beca` | `estudiante_id` | 1:N | CASCADE |
| 26 | `estudiante` | se matricula en | `inscripcion` | `estudiante_id` | 1:N | CASCADE |
| 27 | `estudiante` | acumula | `historial_calificacion` | `estudiante_id` | 1:N | CASCADE |
| 28 | `estudiante` | reporta | `registro_servicio` | `estudiante_id` | 1:N | CASCADE |
| 29 | `estudiante` | es destino de | `extraccion_ocr` | `estudiante_id` | 1:N | SET NULL |
| 30 | `estudiante` | es objeto de | `solicitud` | `estudiante_id` | 1:N | RESTRICT |
| 31 | `periodo` | enmarca | `materia` | `periodo_id` | 1:N | SET NULL |
| 32 | `periodo` | programa | `inscripcion` | `periodo_id` | 1:N | CASCADE |
| 33 | `materia` | incluye | `inscripcion` | `materia_id` | 1:N | CASCADE |
| 34 | `academia` | contiene | `material` | `academia_id` | 1:N | CASCADE |
| 35 | `solicitud` | tiene historial | `solicitud_paso` | `solicitud_id` | 1:N | CASCADE |
| 36 | `proyecto` | agrupa | `tarea` | `proyecto_id` | 1:N | SET NULL |
| 37 | `tarea` | agenda | `evento` | `tarea_id` | 1:0..N | SET NULL |
| 38 | `tarea` | asigna | `tarea_asignado` | `tarea_id` | 1:N | CASCADE |
| 39 | `conversacion_ia` | contiene | `mensaje_ia` | `conversacion_id` | 1:N | CASCADE |

**Restricciones de unicidad que refuerzan las relaciones:**
- `inscripcion (estudiante_id, materia_id, periodo_id)` — evita matrícula duplicada.
- `registro_servicio (estudiante_id, mes)` — un registro por estudiante y mes.
- `inscripcion_comida (nombre, fecha)` — una inscripción por persona y día.
- `estudiante.usuario_id` y `estudiante.cedula` son `UNIQUE`.
- `solicitud.folio` es `UNIQUE` (identidad numérica para referirse a la solicitud).

**Referencias polimórficas (lógicas, sin FK física):**
- `audit_log.entidad_id` → apunta al id de cualquier tabla auditada (el nombre va en `entidad`).
- `fragmento_conocimiento.fuente_id` → apunta al id de cualquier entidad indexada para IA (el tipo va en `fuente_tipo`).

**Tablas sin FK entrantes/salientes de negocio:** `transaccion`, `inscripcion_comida` (independientes por diseño).

> Verificación: las 39 relaciones anteriores existen físicamente en la base (`information_schema`), y toda columna terminada en `_id` tiene su FK, salvo las dos referencias polimórficas señaladas.

---

## 11. Puerta abierta a modificaciones futuras (extensibilidad)

El diseño está preparado para crecer sin romper lo existente:

- **Columna `metadata JSONB`** (default `'{}'`) en las entidades principales — `estudiante`, `usuario`, `patrocinador`, `periodo`, `materia`, `academia`, `material`, `proyecto`, `tarea`, `evento`, `transaccion` (+ `fragmento_conocimiento`). Permite guardar campos nuevos sin alterar el esquema; si un dato madura, se promueve a columna propia. Indexable por demanda con GIN.
- **Estados como `TEXT`** (con valores documentados) en vez de ENUM rígido donde se prevé evolución (`estado`, `categoria`, `modalidad`, `prioridad`, `visibilidad`…): añadir un valor nuevo no requiere `ALTER TYPE`.
- **Migraciones `.sql` numeradas**: cada cambio futuro es una nueva migración (`0032_…`), versionada y reproducible.
- **UUID** como PK: permite generación distribuida e integraciones/sincronización futuras.
- **Tablas de IA desacopladas** (`conversacion_ia`, `extraccion_ocr`, `fragmento_conocimiento`): el modelo/dimensión de embeddings se puede cambiar sin tocar el resto.

