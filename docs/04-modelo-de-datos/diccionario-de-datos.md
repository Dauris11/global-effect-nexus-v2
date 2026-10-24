# Diccionario de Datos — Global Effect Nexus

> **Fuente:** generado desde la base de datos en vivo (PostgreSQL 17 · Supabase). Refleja el estado desplegado por las migraciones `db/migrations/0001`–`0013`, con el cambio de alcance de octubre de 2026 aplicado: la `0030` retira las tablas de psicología y la `0031` añade el dominio de solicitudes y aprobaciones. La `0047` (24 oct 2026) retira los cursos técnicos: borra `curso`, `calificacion` y el enum `tipo_evaluacion`, y deja `tipo_estudiante` con un solo valor, `becado`.

Cubre **33 tablas**, **308 columnas**, **6 tipos ENUM** y **4 extensiones** de PostgreSQL. Cada tabla lista sus columnas (tipo, nulabilidad, default, claves), sus restricciones CHECK y sus índices.

**Convenciones:** PK = clave primaria · FK = clave foránea · UK = único (columna). «Nulo = No» significa `NOT NULL`.

## Índice de dominios

- [1. Identidad y control de acceso (RBAC)](#1-identidad-y-control-de-acceso-rbac)
- [2. Transversal (documentos, notificaciones y auditoría)](#2-transversal-documentos-notificaciones-y-auditoria)
- [3. Patrocinio](#3-patrocinio)
- [4. Estudiantes (expediente normalizado)](#4-estudiantes-expediente-normalizado)
- [5. Académico](#5-academico)
- [6. Academias (programas extracurriculares)](#6-academias-programas-extracurriculares)
- [7. Solicitudes y aprobaciones](#7-solicitudes-y-aprobaciones)
- [8. Operaciones (proyectos, tareas, eventos, servicio)](#8-operaciones-proyectos-tareas-eventos-servicio)
- [9. Bienestar (inscripción de almuerzo)](#9-bienestar-inscripcion-de-almuerzo)
- [10. Finanzas](#10-finanzas)
- [11. Inteligencia Artificial (chat, OCR y RAG con pgvector)](#11-inteligencia-artificial-chat-ocr-y-rag-con-pgvector)
- [Apéndice A · Tipos ENUM](#apéndice-a--tipos-enum)
- [Apéndice B · Extensiones](#apéndice-b--extensiones)

---

## 1. Identidad y control de acceso (RBAC)

### `rol`
Roles institucionales del sistema (base del RBAC).

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `nombre` | text | No | UK | Nombre. |
| `descripcion` | text | Sí | — | Descripción. |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |
| `updated_at` | timestamp with time zone | No | — | Fecha de última modificación (trigger automático). |

**Índices:**
- `rol_nombre_key`: btree (nombre)
- `rol_pkey`: btree (id)

---

### `permiso`
Permisos granulares por módulo/acción.

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `codigo` | text | No | UK | Clave del permiso (ej: 'expedientes.leer', 'ia.usar'). |
| `descripcion` | text | Sí | — | Descripción. |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |
| `updated_at` | timestamp with time zone | No | — | Fecha de última modificación (trigger automático). |

**Índices:**
- `permiso_codigo_key`: btree (codigo)
- `permiso_pkey`: btree (id)

---

### `rol_permiso`
Relación N:M que asigna permisos a roles.

- **Clave primaria:** `permiso_id`, `rol_id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `rol_id` | uuid | No | PK, FK | Referencia a rol. |
| `permiso_id` | uuid | No | PK, FK | Referencia a permiso. |

**Claves foráneas:**
- `permiso_id` → `permiso(id)` · ON DELETE CASCADE
- `rol_id` → `rol(id)` · ON DELETE CASCADE

**Índices:**
- `idx_rol_permiso_permiso`: btree (permiso_id)
- `rol_permiso_pkey`: btree (rol_id, permiso_id)

---

### `usuario`
Usuarios con credenciales de acceso a la plataforma.

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `email` | citext | No | UK | Correo institucional y usuario de login (case-insensitive). |
| `password_hash` | text | No | — | Contraseña cifrada (bcrypt / argon2). |
| `nombre` | text | No | — | Nombre. |
| `idioma` | text | No | — | Idioma preferido (es | en). |
| `activo` | boolean | No | — | Indica si el usuario puede acceder al sistema. |
| `rol_id` | uuid | No | FK | Referencia a rol. |
| `ultimo_acceso` | timestamp with time zone | Sí | — | Marca del último inicio de sesión. |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |
| `updated_at` | timestamp with time zone | No | — | Fecha de última modificación (trigger automático). |
| `metadata` | jsonb | No | — | Datos adicionales para extensibilidad futura (JSONB). |

**Claves foráneas:**
- `rol_id` → `rol(id)` · ON DELETE NO ACTION

**Restricciones CHECK / UNIQUE:**
- CHECK ((idioma = ANY (ARRAY['es'::text, 'en'::text])))

**Índices:**
- `idx_usuario_rol`: btree (rol_id)
- `usuario_email_key`: btree (email)
- `usuario_pkey`: btree (id)

---

## 2. Transversal (documentos, notificaciones y auditoría)

### `documento`
Metadatos de archivos almacenados en el bucket (Storage). Centraliza las referencias a archivos.

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `nombre` | text | No | — | Nombre. |
| `storage_key` | text | No | UK | Ruta/clave única dentro del bucket de almacenamiento. |
| `tipo` | text | Sí | — | Categoría del archivo (foto, expediente_escaneado, etc.). |
| `mime` | text | Sí | — | Tipo MIME del archivo. |
| `tamano_bytes` | bigint | Sí | — | Tamaño del archivo en bytes. |
| `subido_por_id` | uuid | Sí | FK | Usuario que subió el archivo. |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |

**Claves foráneas:**
- `subido_por_id` → `usuario(id)` · ON DELETE SET NULL

**Restricciones CHECK / UNIQUE:**
- CHECK ((tamano_bytes >= 0))

**Índices:**
- `documento_pkey`: btree (id)
- `documento_storage_key_key`: btree (storage_key)
- `idx_documento_tipo`: btree (tipo)

---

### `notificacion`
Notificaciones internas dirigidas a un usuario.

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `usuario_id` | uuid | No | FK | Referencia a usuario. |
| `titulo` | text | No | — | Título. |
| `mensaje` | text | No | — | Contenido del mensaje. |
| `tipo` | text | No | — | Tipo de notificación (info, alerta, tarea). |
| `leida` | boolean | No | — | Indica si la notificación fue leída. |
| `enlace` | text | Sí | — | Ruta interna asociada (opcional). |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |

**Claves foráneas:**
- `usuario_id` → `usuario(id)` · ON DELETE CASCADE

**Índices:**
- `idx_notificacion_usuario_leida`: btree (usuario_id, leida)
- `notificacion_pkey`: btree (id)

---

### `audit_log`
Bitácora de auditoría de acciones sensibles (append-only).

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `usuario_id` | uuid | Sí | FK | Referencia a usuario. |
| `accion` | text | No | — | Operación registrada (INSERT, UPDATE, DELETE, LOGIN...). |
| `entidad` | text | No | — | Tabla/recurso afectado. |
| `entidad_id` | uuid | Sí | — | ID del registro afectado (referencia lógica). |
| `datos` | jsonb | Sí | — | Snapshot de cambios {antes, despues}. |
| `ip` | inet | Sí | — | Dirección IP de origen. |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |

**Claves foráneas:**
- `usuario_id` → `usuario(id)` · ON DELETE SET NULL

**Índices:**
- `audit_log_pkey`: btree (id)
- `idx_audit_log_created_brin`: brin (created_at)
- `idx_audit_log_entidad`: btree (entidad, entidad_id)

---

## 3. Patrocinio

### `patrocinador`
Patrocinadores de la fundación (personas, empresas, iglesias, ONG).

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `nombre` | text | No | — | Nombre. |
| `tipo` | tipo_patrocinador | No | — | Tipo (enum/categoría). |
| `email` | citext | Sí | — | Correo electrónico. |
| `telefono` | text | Sí | — | Teléfono de contacto. |
| `pais` | text | Sí | — | País. |
| `estado` | text | No | — | Estado del registro. |
| `monto_mensual` | numeric(10,2) | Sí | — | Aporte mensual promedio (USD). |
| `notas` | text | Sí | — | Notas / observaciones. |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |
| `updated_at` | timestamp with time zone | No | — | Fecha de última modificación (trigger automático). |
| `metadata` | jsonb | No | — | Datos adicionales para extensibilidad futura (JSONB). |

**Restricciones CHECK / UNIQUE:**
- CHECK ((monto_mensual >= 0.00))

**Índices:**
- `idx_patrocinador_estado`: btree (estado)
- `patrocinador_pkey`: btree (id)

---

## 4. Estudiantes (expediente normalizado)

### `estudiante`
Tabla núcleo del expediente estudiantil (datos personales e institucionales).

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `nombre` | text | No | — | Nombre. |
| `cedula` | text | Sí | UK | Cédula / documento de identidad (único). |
| `email` | citext | Sí | — | Correo electrónico. |
| `telefono` | text | Sí | — | Teléfono de contacto. |
| `fecha_nacimiento` | date | Sí | — | Fecha de nacimiento. |
| `lugar_nacimiento` | text | Sí | — | Lugar de nacimiento. |
| `nacionalidad` | text | Sí | — | Nacionalidad. |
| `genero` | genero | Sí | — | Género (enum). |
| `sexo_documento` | text | Sí | — | Sexo biológico registrado en el documento oficial. |
| `religion` | text | Sí | — | Afiliación religiosa. |
| `foto_id` | uuid | Sí | FK | Foto de perfil (referencia a documento). |
| `tipo` | tipo_estudiante | No | — | Tipo de estudiante. Desde la `0047` solo existe `becado`: el valor `regular` era el alumno de curso técnico y se retiró con ellos. |
| `estado` | estado_estudiante | No | — | Estado en el pipeline y situación escolar. |
| `programa` | text | Sí | — | Carrera universitaria del becado. |
| `donde_estudia` | text | Sí | — | Institución donde estudia. |
| `universidad` | text | Sí | — | Universidad física (para becados). |
| `fecha_ingreso` | date | Sí | — | Fecha de ingreso a la fundación. |
| `patrocinador_id` | uuid | Sí | FK | Patrocinador actual asignado. |
| `facilitador_habitudes` | text | Sí | — | Facilitador del programa de liderazgo (Habitudes). |
| `centro_educativo` | text | Sí | — | Escuela secundaria de procedencia. |
| `director_centro` | text | Sí | — | Director del centro de procedencia. |
| `imagen_habitudes_id` | uuid | Sí | FK | Imagen del programa Habitudes (documento). |
| `breve_historia_habitudes` | text | Sí | — | Resumen del proceso en Habitudes. |
| `amonestaciones` | text | Sí | — | Reportes de conducta. |
| `solicitudes_pendientes` | text | Sí | — | Peticiones del estudiante por procesar. |
| `envio_correo_patrocinador` | text | Sí | — | Estatus de cartas al patrocinador (pendiente, enviado, no_aplica). |
| `asistio_reunion_mensual` | text | Sí | — | Estatus de asistencia a reunión (si, no, justificado). |
| `expediente_id` | uuid | Sí | FK | Documento del expediente escaneado completo. |
| `notas_adicionales` | text | Sí | — | Observaciones operativas varias. |
| `usuario_id` | uuid | Sí | FK, UK | Cuenta de login vinculada (único). |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |
| `updated_at` | timestamp with time zone | No | — | Fecha de última modificación (trigger automático). |
| `metadata` | jsonb | No | — | Datos adicionales para extensibilidad futura (JSONB). |

**Claves foráneas:**
- `expediente_id` → `documento(id)` · ON DELETE SET NULL
- `foto_id` → `documento(id)` · ON DELETE SET NULL
- `imagen_habitudes_id` → `documento(id)` · ON DELETE SET NULL
- `patrocinador_id` → `patrocinador(id)` · ON DELETE SET NULL
- `usuario_id` → `usuario(id)` · ON DELETE SET NULL

**Índices:**
- `estudiante_cedula_key`: btree (cedula)
- `estudiante_pkey`: btree (id)
- `estudiante_usuario_id_key`: btree (usuario_id)
- `idx_estudiante_estado`: btree (estado)
- `idx_estudiante_nombre_trgm`: gin (nombre gin_trgm_ops)
- `idx_estudiante_patrocinador`: btree (patrocinador_id)
- `idx_estudiante_tipo`: btree (tipo)

---

### `familiar`
Red familiar del estudiante (1:N). Normaliza padre/madre/tutor/hermanos.

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `estudiante_id` | uuid | No | FK | Referencia a estudiante. |
| `parentesco` | parentesco | No | — | Relación familiar (enum parentesco). |
| `nombre` | text | No | — | Nombre. |
| `edad` | integer | Sí | — | Edad del familiar. |
| `telefono` | text | Sí | — | Teléfono de contacto. |
| `profesion` | text | Sí | — | Ocupación del familiar. |

**Claves foráneas:**
- `estudiante_id` → `estudiante(id)` · ON DELETE CASCADE

**Restricciones CHECK / UNIQUE:**
- CHECK ((edad >= 0))

**Índices:**
- `familiar_pkey`: btree (id)
- `idx_familiar_estudiante`: btree (estudiante_id)

---

### `perfil_vivienda`
Condiciones de vivienda del estudiante (1:1).

- **Clave primaria:** `estudiante_id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `estudiante_id` | uuid | No | PK, FK | Referencia a estudiante. |
| `con_quien_vive` | text | Sí | — | Personas con las que cohabita. |
| `por_que_vive_con_esa_persona` | text | Sí | — | Contexto residencial. |
| `hermanos_cantidad` | integer | Sí | — | Cantidad de hermanos. |
| `casa_propia` | text | Sí | — | Tenencia de la vivienda (si, no, alquilada, prestada). |
| `tipo_casa` | text | Sí | — | Descripción del tipo de vivienda. |
| `bano_dentro` | text | Sí | — | Ubicación del baño (dentro, fuera). |
| `habitaciones` | integer | Sí | — | Número de habitaciones. |
| `camas` | integer | Sí | — | Número de camas. |
| `quienes_duermen_cama` | text | Sí | — | Distribución de camas. |
| `direccion` | text | Sí | — | Dirección de residencia. |
| `comunidad` | text | Sí | — | Comunidad / barrio. |
| `ciudad_residencia` | text | Sí | — | Ciudad o municipio de residencia. |
| `pais_residencia` | text | Sí | — | País de residencia. |

**Claves foráneas:**
- `estudiante_id` → `estudiante(id)` · ON DELETE CASCADE

**Restricciones CHECK / UNIQUE:**
- CHECK ((habitaciones >= 0))
- CHECK ((camas >= 0))
- CHECK ((hermanos_cantidad >= 0))

**Índices:**
- `perfil_vivienda_pkey`: btree (estudiante_id)

---

### `perfil_salud`
Información de salud y contacto de emergencia del estudiante (1:1).

- **Clave primaria:** `estudiante_id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `estudiante_id` | uuid | No | PK, FK | Referencia a estudiante. |
| `enfermedades` | text | Sí | — | Enfermedades que padece. |
| `alergias` | text | Sí | — | Alergias conocidas. |
| `contacto_emergencia_nombre` | text | Sí | — | Nombre del contacto de emergencia. |
| `contacto_emergencia_telefono` | text | Sí | — | Teléfono del contacto de emergencia. |

**Claves foráneas:**
- `estudiante_id` → `estudiante(id)` · ON DELETE CASCADE

**Índices:**
- `perfil_salud_pkey`: btree (estudiante_id)

---

### `perfil_socioeconomico`
Contexto socioeconómico y proyecto de vida del estudiante (1:1).

- **Clave primaria:** `estudiante_id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `estudiante_id` | uuid | No | PK, FK | Referencia a estudiante. |
| `historia_de_vida` | text | Sí | — | Historia de vida del estudiante. |
| `situacion_familiar` | text | Sí | — | Situación familiar. |
| `situacion_economica` | text | Sí | — | Situación económica. |
| `motivo_beca` | text | Sí | — | Motivo por el cual solicita/recibe la beca. |
| `metas_academicas` | text | Sí | — | Metas académicas y proyecto de vida. |

**Claves foráneas:**
- `estudiante_id` → `estudiante(id)` · ON DELETE CASCADE

**Índices:**
- `perfil_socioeconomico_pkey`: btree (estudiante_id)

---

### `asignacion_beca`
Historial de asignaciones de beca (estudiante ↔ patrocinador).

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `estudiante_id` | uuid | No | FK | Referencia a estudiante. |
| `patrocinador_id` | uuid | No | FK | Referencia a patrocinador. |
| `monto` | numeric(10,2) | No | — | Monto de la beca (USD). |
| `fecha_inicio` | date | No | — | Inicio de la asignación. |
| `fecha_fin` | date | Sí | — | Fin de la asignación (si aplica). |
| `estado` | text | No | — | Estado (activo, finalizado). |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |

**Claves foráneas:**
- `estudiante_id` → `estudiante(id)` · ON DELETE CASCADE
- `patrocinador_id` → `patrocinador(id)` · ON DELETE CASCADE

**Restricciones CHECK / UNIQUE:**
- CHECK ((monto >= 0.00))

**Índices:**
- `asignacion_beca_pkey`: btree (id)
- `idx_asignacion_beca_estudiante`: btree (estudiante_id)
- `idx_asignacion_beca_patrocinador`: btree (patrocinador_id)

---

## 5. Académico

### `periodo`
Períodos / cuatrimestres académicos institucionales.

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `nombre` | text | No | UK | Código del período (ej: '2026-I'). |
| `fecha_inicio` | date | No | — | Fecha de inicio. |
| `fecha_fin` | date | No | — | Fecha de fin. |
| `estado` | text | No | — | Estado del registro. |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |
| `updated_at` | timestamp with time zone | No | — | Fecha de última modificación (trigger automático). |
| `metadata` | jsonb | No | — | Datos adicionales para extensibilidad futura (JSONB). |

**Restricciones CHECK / UNIQUE:**
- CHECK ((fecha_fin >= fecha_inicio))

**Índices:**
- `periodo_nombre_key`: btree (nombre)
- `periodo_pkey`: btree (id)

---

### `materia`
Materias académicas (becados universitarios).

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `nombre` | text | No | — | Nombre. |
| `codigo` | text | Sí | — | Código de la materia. |
| `descripcion` | text | Sí | — | Descripción. |
| `periodo_id` | uuid | Sí | FK | Referencia a periodo. |
| `creditos` | integer | Sí | — | Créditos académicos. |
| `profesor_nombre` | text | Sí | — | Nombre visible del profesor; puede ser alguien externo al sistema. |
| `profesor_usuario_id` | uuid | Sí | FK | El profesor como usuario del sistema, si lo es. Decide qué materias son suyas en el Portal Profesor. |
| `estado` | text | No | — | Estado del registro. |
| `horario` | text | Sí | — | Horario de clases. |
| `aula` | text | Sí | — | Aula asignada. |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |
| `updated_at` | timestamp with time zone | No | — | Fecha de última modificación (trigger automático). |
| `metadata` | jsonb | No | — | Datos adicionales para extensibilidad futura (JSONB). |

**Claves foráneas:**
- `periodo_id` → `periodo(id)` · ON DELETE SET NULL
- `profesor_usuario_id` → `usuario(id)` · ON DELETE SET NULL

**Restricciones CHECK / UNIQUE:**
- CHECK ((creditos >= 0))

**Índices:**
- `idx_materia_periodo`: btree (periodo_id)
- `idx_materia_profesor_usuario`: btree (profesor_usuario_id)
- `materia_pkey`: btree (id)

---

### `inscripcion`
Matrícula: relación estudiante ↔ materia ↔ período.

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `estudiante_id` | uuid | No | FK | Referencia a estudiante. |
| `materia_id` | uuid | No | FK | Referencia a materia. |
| `periodo_id` | uuid | No | FK | Referencia a periodo. |
| `estado` | text | No | — | Estado de la matrícula (activa, retirada, aprobada, reprobada). |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |

**Claves foráneas:**
- `estudiante_id` → `estudiante(id)` · ON DELETE CASCADE
- `materia_id` → `materia(id)` · ON DELETE CASCADE
- `periodo_id` → `periodo(id)` · ON DELETE CASCADE

**Índices:**
- `idx_inscripcion_estudiante`: btree (estudiante_id)
- `idx_inscripcion_materia`: btree (materia_id)
- `inscripcion_estudiante_id_materia_id_periodo_id_key`: btree (estudiante_id, materia_id, periodo_id)
- `inscripcion_pkey`: btree (id)

---

> Hasta la `0047` este dominio incluía `curso` (cursos técnicos) y `calificacion` (notas por evaluación de esos cursos). La Fundación dejó de impartir cursos técnicos en octubre de 2026 y las dos tablas se borraron sin copia, como la `0030` hizo con Psicología. Las tareas (`asignacion`) cuelgan ahora de una materia universitaria o de una materia de Global Effect 360, exactamente de una (CHECK `asignacion_una_sola_unidad`), y la nota final de 360 es `inscripcion_360.nota`. Las tablas de Global Effect 360 (`materia_360`, `ventana_prematricula`, `inscripcion_360`, migraciones `0027`, `0028`, `0042` y `0047`) y las del aula virtual (`asignacion`, `entrega_estudiante`, `0023`) no están en este volcado; sus reglas vigentes son: todo el catálogo es obligatorio (la columna `obligatoria` se retiró), 360 está abierto a todos los estudiantes (el trigger `solo_becado_en_360` se retiró), `ronda` es obligatoria (1 o 2, las dos tandas de dos meses del cuatrimestre) y el índice único parcial `uq_inscripcion_360_una_por_tanda (estudiante_id, periodo_id, ronda) WHERE estado <> 'retirada'` impone una materia por tanda: dos por cuatrimestre.

### `historial_calificacion`
Historial académico consolidado (GPA por materia/cuatrimestre).

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `estudiante_id` | uuid | No | FK | Referencia a estudiante. |
| `cuatrimestre` | text | No | — | Cuatrimestre (ej: '2025-I'). |
| `materia` | text | No | — | Nombre de la materia. |
| `nota_numerica` | numeric(5,2) | No | — | Nota numérica (0 a 100). |
| `nota_letra` | text | No | — | Nota en letra (A-F). |
| `gpa` | numeric(3,2) | No | — | Puntos GPA de la materia (0 a 4). |
| `estado` | text | No | — | Estado (aprobada, prueba_academica, reprobada). |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |

**Claves foráneas:**
- `estudiante_id` → `estudiante(id)` · ON DELETE CASCADE

**Restricciones CHECK / UNIQUE:**
- CHECK (((nota_numerica >= 0.00) AND (nota_numerica <= 100.00)))
- CHECK (((gpa >= 0.00) AND (gpa <= 4.00)))

**Índices:**
- `historial_calificacion_pkey`: btree (id)
- `idx_historial_estudiante`: btree (estudiante_id)

---

## 6. Academias (programas extracurriculares)

### `academia`
Programas extracurriculares (liderazgo, habilidades).

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `nombre` | text | No | — | Nombre. |
| `tipo` | text | No | — | Tipo (liderazgo, habilidades, otro). |
| `descripcion` | text | Sí | — | Descripción. |
| `facilitador` | text | Sí | — | Facilitador del programa. |
| `estado` | text | No | — | Estado del registro. |
| `participantes` | integer | Sí | — | Número de participantes. |
| `fecha_inicio` | date | Sí | — | Fecha de inicio. |
| `fecha_fin` | date | Sí | — | Fecha de fin. |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |
| `updated_at` | timestamp with time zone | No | — | Fecha de última modificación (trigger automático). |
| `metadata` | jsonb | No | — | Datos adicionales para extensibilidad futura (JSONB). |

**Restricciones CHECK / UNIQUE:**
- CHECK ((participantes >= 0))

**Índices:**
- `academia_pkey`: btree (id)

---

### `material`
Materiales educativos asociados a una academia.

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `titulo` | text | No | — | Título del material. |
| `descripcion` | text | Sí | — | Descripción. |
| `academia_id` | uuid | No | FK | Referencia a academia. |
| `tipo` | text | No | — | Tipo (documento, video, presentacion, enlace, otro). |
| `documento_id` | uuid | Sí | FK | Archivo asociado (documento). |
| `enlace_url` | text | Sí | — | URL para materiales tipo enlace. |
| `autor` | text | Sí | — | Autor del material. |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |
| `updated_at` | timestamp with time zone | No | — | Fecha de última modificación (trigger automático). |
| `metadata` | jsonb | No | — | Datos adicionales para extensibilidad futura (JSONB). |

**Claves foráneas:**
- `academia_id` → `academia(id)` · ON DELETE CASCADE
- `documento_id` → `documento(id)` · ON DELETE SET NULL

**Índices:**
- `idx_material_academia`: btree (academia_id)
- `material_pkey`: btree (id)

---

## 7. Solicitudes y aprobaciones

> Dominio creado en la migración `0031`. Sustituye al de psicología (`cita_psicologia`, `nota_psicologica`, `perfil_psicologico`), que la migración `0030` retiró cuando la Fundación eliminó el departamento (oct 2026). Esta sección se redactó a partir de la migración, no del volcado en vivo.

### `solicitud`
Trámites del estudiante y aprobaciones internas (alta de expediente, beca, gasto) con flujo por pasos.

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `folio` | bigint | No | UK | Número legible para referirse a la solicitud (`GENERATED ALWAYS AS IDENTITY`). |
| `tipo` | text | No | — | Tipo (constancia, carta, cita_administracion, permiso, otro, alta_expediente, beca, gasto). |
| `estado` | text | No | — | Estado del flujo (enviada, en_revision, pendiente_direccion, aprobada, rechazada, completada, cancelada). Default `enviada`. |
| `titulo` | text | No | — | Título corto. |
| `detalle` | text | Sí | — | Descripción de lo que se pide. |
| `solicitante_id` | uuid | Sí | FK | Usuario que creó la solicitud. |
| `estudiante_id` | uuid | Sí | FK | Estudiante al que se refiere; obligatorio en `alta_expediente` y `beca`. |
| `monto` | numeric(12,2) | Sí | — | Monto (USD, > 0); obligatorio en `gasto`, opcional en `beca`. |
| `fecha_requerida` | date | Sí | — | Fecha en que se necesita (o fecha preferida de la cita con administración). |
| `hora_preferida` | text | Sí | — | Hora preferida de la cita con administración. |
| `requiere_direccion` | boolean | No | — | Si necesita segundo nivel de dirección. Se fija al crear (siempre en `beca`; en `gasto` si el monto es ≥ 1,000 USD). Default `false`. |
| `responsable_id` | uuid | Sí | FK | Revisor que tomó la solicitud. |
| `respuesta` | text | Sí | — | Respuesta o motivo de la resolución, visible al solicitante. |
| `resuelta_en` | timestamp with time zone | Sí | — | Cuándo se aprobó, rechazó o canceló. |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |
| `updated_at` | timestamp with time zone | No | — | Fecha de última modificación (trigger automático). |

**Claves foráneas:**
- `estudiante_id` → `estudiante(id)` · ON DELETE RESTRICT
- `responsable_id` → `usuario(id)` · ON DELETE SET NULL
- `solicitante_id` → `usuario(id)` · ON DELETE SET NULL

**Restricciones CHECK / UNIQUE:**
- CHECK (tipo IN ('constancia', 'carta', 'cita_administracion', 'permiso', 'otro', 'alta_expediente', 'beca', 'gasto'))
- CHECK (estado IN ('enviada', 'en_revision', 'pendiente_direccion', 'aprobada', 'rechazada', 'completada', 'cancelada'))
- CHECK (length(titulo) BETWEEN 1 AND 160)
- CHECK (detalle IS NULL OR length(detalle) <= 2000) · ídem `respuesta`
- CHECK (monto IS NULL OR monto > 0)
- `solicitud_con_estudiante`: CHECK (tipo NOT IN ('alta_expediente', 'beca') OR estudiante_id IS NOT NULL)
- `solicitud_gasto_con_monto`: CHECK (tipo <> 'gasto' OR monto IS NOT NULL)
- UNIQUE (folio)

**Índices:**
- `idx_solicitud_abiertas`: btree (tipo, created_at) WHERE estado IN ('enviada', 'en_revision', 'pendiente_direccion', 'aprobada')
- `idx_solicitud_estudiante`: btree (estudiante_id)
- `idx_solicitud_solicitante`: btree (solicitante_id, created_at DESC)
- `solicitud_folio_key`: btree (folio)
- `solicitud_pkey`: btree (id)

---

### `solicitud_paso`
Línea de tiempo de una solicitud: un registro por cambio de estado (append-only).

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `solicitud_id` | uuid | No | FK | Solicitud a la que pertenece el paso. |
| `estado_anterior` | text | Sí | — | Estado de origen (NULL en el paso de creación). |
| `estado_nuevo` | text | No | — | Estado de destino. |
| `comentario` | text | Sí | — | Comentario del paso (obligatorio al rechazar). |
| `usuario_id` | uuid | Sí | FK | Quién hizo el cambio. |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |

**Claves foráneas:**
- `solicitud_id` → `solicitud(id)` · ON DELETE CASCADE
- `usuario_id` → `usuario(id)` · ON DELETE SET NULL

**Restricciones CHECK / UNIQUE:**
- CHECK (comentario IS NULL OR length(comentario) <= 2000)

**Índices:**
- `idx_solicitud_paso`: btree (solicitud_id, created_at)
- `solicitud_paso_pkey`: btree (id)

---

## 8. Operaciones (proyectos, tareas, eventos, servicio)

### `proyecto`
Proyectos de la fundación.

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `nombre` | text | No | — | Nombre. |
| `descripcion` | text | Sí | — | Descripción. |
| `responsable` | text | Sí | — | Persona responsable. |
| `estado` | text | No | — | Estado (planificacion, en_curso, completado, pausado). |
| `fecha_inicio` | date | Sí | — | Fecha de inicio. |
| `fecha_fin` | date | Sí | — | Fecha de fin. |
| `progreso` | integer | Sí | — | Porcentaje de avance (0-100). |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |
| `updated_at` | timestamp with time zone | No | — | Fecha de última modificación (trigger automático). |
| `metadata` | jsonb | No | — | Datos adicionales para extensibilidad futura (JSONB). |

**Restricciones CHECK / UNIQUE:**
- CHECK (((progreso >= 0) AND (progreso <= 100)))

**Índices:**
- `proyecto_pkey`: btree (id)

---

### `tarea`
Tareas del tablero Kanban administrativo.

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `titulo` | text | No | — | Título. |
| `descripcion` | text | Sí | — | Descripción. |
| `proyecto_id` | uuid | Sí | FK | Proyecto agrupador (opcional). |
| `visibilidad` | text | No | — | Visibilidad (todos, asignados). |
| `estado` | text | No | — | Estado Kanban (pendiente, en_progreso, completada, cancelada). |
| `prioridad` | text | No | — | Prioridad (baja, media, alta, urgente). |
| `fecha_limite` | date | Sí | — | Fecha límite de entrega. |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |
| `updated_at` | timestamp with time zone | No | — | Fecha de última modificación (trigger automático). |
| `metadata` | jsonb | No | — | Datos adicionales para extensibilidad futura (JSONB). |

**Claves foráneas:**
- `proyecto_id` → `proyecto(id)` · ON DELETE SET NULL

**Índices:**
- `idx_tarea_estado`: btree (estado)
- `idx_tarea_proyecto`: btree (proyecto_id)
- `tarea_pkey`: btree (id)

---

### `tarea_asignado`
Relación N:M que asigna usuarios responsables a tareas.

- **Clave primaria:** `tarea_id`, `usuario_id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `tarea_id` | uuid | No | PK, FK | Referencia a tarea. |
| `usuario_id` | uuid | No | PK, FK | Referencia a usuario. |

**Claves foráneas:**
- `tarea_id` → `tarea(id)` · ON DELETE CASCADE
- `usuario_id` → `usuario(id)` · ON DELETE CASCADE

**Índices:**
- `idx_tarea_asignado_usuario`: btree (usuario_id)
- `tarea_asignado_pkey`: btree (tarea_id, usuario_id)

---

### `evento`
Eventos del calendario institucional.

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `titulo` | text | No | — | Título. |
| `descripcion` | text | Sí | — | Descripción. |
| `tipo` | text | No | — | Tipo (academico, administrativo, social, reunion, otro). |
| `fecha` | date | No | — | Fecha. |
| `hora_inicio` | text | Sí | — | Hora de inicio. |
| `hora_fin` | text | Sí | — | Hora de fin. |
| `ubicacion` | text | Sí | — | Lugar del evento. |
| `responsable` | text | Sí | — | Responsable del evento. |
| `estado` | text | No | — | Estado del registro. |
| `tarea_id` | uuid | Sí | FK | Tarea de origen (si fue autogenerado). |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |
| `updated_at` | timestamp with time zone | No | — | Fecha de última modificación (trigger automático). |
| `metadata` | jsonb | No | — | Datos adicionales para extensibilidad futura (JSONB). |

**Claves foráneas:**
- `tarea_id` → `tarea(id)` · ON DELETE SET NULL

**Índices:**
- `evento_pkey`: btree (id)
- `idx_evento_fecha`: btree (fecha)

---

### `registro_servicio`
Registro mensual de servicio comunitario y asistencia a reunión.

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `estudiante_id` | uuid | No | FK | Referencia a estudiante. |
| `mes` | text | No | — | Mes en formato YYYY-MM. |
| `hizo_servicio` | boolean | No | — | Realizó el servicio comunitario. |
| `asistio_reunion` | boolean | No | — | Asistió a la reunión mensual. |
| `notas` | text | Sí | — | Notas / observaciones. |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |

**Claves foráneas:**
- `estudiante_id` → `estudiante(id)` · ON DELETE CASCADE

**Índices:**
- `idx_reg_servicio_estudiante`: btree (estudiante_id)
- `idx_reg_servicio_mes`: btree (mes)
- `registro_servicio_estudiante_id_mes_key`: btree (estudiante_id, mes)
- `registro_servicio_pkey`: btree (id)

---

## 9. Bienestar (inscripción de almuerzo)

### `inscripcion_comida`
Inscripción diaria pública al almuerzo (sin login).

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `nombre` | text | No | — | Nombre de quien se inscribe. |
| `fecha` | date | No | — | Fecha. |
| `hora_inscripcion` | text | No | — | Hora en que se realizó la inscripción. |
| `confirmado` | boolean | No | — | Inscripción confirmada. |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |

**Índices:**
- `idx_comida_fecha`: btree (fecha)
- `inscripcion_comida_nombre_fecha_key`: btree (nombre, fecha)
- `inscripcion_comida_pkey`: btree (id)

---

## 10. Finanzas

### `transaccion`
Registro de ingresos y egresos de la fundación.

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `concepto` | text | No | — | Concepto de la transacción. |
| `tipo` | tipo_transaccion | No | — | Tipo (ingreso | egreso). |
| `monto` | numeric(12,2) | No | — | Monto (USD, > 0). |
| `categoria` | text | No | — | Categoría (beca, donacion, operativo, salario, material, evento, otro). |
| `fecha` | date | No | — | Fecha. |
| `referencia` | text | Sí | — | Número de referencia/recibo. |
| `notas` | text | Sí | — | Notas / observaciones. |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |
| `updated_at` | timestamp with time zone | No | — | Fecha de última modificación (trigger automático). |
| `metadata` | jsonb | No | — | Datos adicionales para extensibilidad futura (JSONB). |

**Restricciones CHECK / UNIQUE:**
- CHECK ((monto > 0.00))

**Índices:**
- `idx_transaccion_categoria`: btree (categoria)
- `idx_transaccion_fecha`: btree (fecha)
- `idx_transaccion_tipo`: btree (tipo)
- `transaccion_pkey`: btree (id)

---

## 11. Inteligencia Artificial (chat, OCR y RAG con pgvector)

### `conversacion_ia`
Conversaciones del asistente de IA (chat interno / estudiantil).

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `usuario_id` | uuid | Sí | FK | Referencia a usuario. |
| `ambito` | text | No | — | Ámbito del chat (interno | estudiantil). |
| `titulo` | text | Sí | — | Título de la conversación. |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |
| `updated_at` | timestamp with time zone | No | — | Fecha de última modificación (trigger automático). |

**Claves foráneas:**
- `usuario_id` → `usuario(id)` · ON DELETE SET NULL

**Restricciones CHECK / UNIQUE:**
- CHECK ((ambito = ANY (ARRAY['interno'::text, 'estudiantil'::text])))

**Índices:**
- `conversacion_ia_pkey`: btree (id)
- `idx_conversacion_ia_usuario`: btree (usuario_id)

---

### `mensaje_ia`
Mensajes de cada conversación de IA (append-heavy).

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `conversacion_id` | uuid | No | FK | Referencia a conversacion_ia. |
| `rol` | text | No | — | Rol del mensaje (user, assistant, system). |
| `contenido` | text | No | — | Contenido del mensaje. |
| `tokens` | integer | Sí | — | Tokens consumidos. |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |

**Claves foráneas:**
- `conversacion_id` → `conversacion_ia(id)` · ON DELETE CASCADE

**Restricciones CHECK / UNIQUE:**
- CHECK ((rol = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])))
- CHECK ((tokens >= 0))

**Índices:**
- `idx_mensaje_ia_conversacion`: btree (conversacion_id, created_at)
- `idx_mensaje_ia_created_brin`: brin (created_at)
- `mensaje_ia_pkey`: btree (id)

---

### `extraccion_ocr`
Trazabilidad de extracciones OCR sobre documentos (flujo OCR → Expediente).

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `documento_id` | uuid | Sí | FK | Documento fuente del OCR. |
| `estudiante_id` | uuid | Sí | FK | Estudiante destino (si aplica). |
| `estado` | text | No | — | Estado del pipeline (pendiente, procesando, completado, error). |
| `modelo` | text | Sí | — | Modelo de IA utilizado. |
| `confianza` | numeric(5,2) | Sí | — | Nivel de confianza de la extracción (0-100). |
| `datos_extraidos` | jsonb | Sí | — | Campos detectados por la IA (JSONB). |
| `mensaje_error` | text | Sí | — | Detalle del error, si lo hubo. |
| `creado_por_id` | uuid | Sí | FK | Usuario que inició la extracción. |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |
| `updated_at` | timestamp with time zone | No | — | Fecha de última modificación (trigger automático). |

**Claves foráneas:**
- `creado_por_id` → `usuario(id)` · ON DELETE SET NULL
- `documento_id` → `documento(id)` · ON DELETE SET NULL
- `estudiante_id` → `estudiante(id)` · ON DELETE SET NULL

**Restricciones CHECK / UNIQUE:**
- CHECK (((confianza >= 0.00) AND (confianza <= 100.00)))
- CHECK ((estado = ANY (ARRAY['pendiente'::text, 'procesando'::text, 'completado'::text, 'error'::text])))

**Índices:**
- `extraccion_ocr_pkey`: btree (id)
- `idx_extraccion_ocr_estado`: btree (estado)
- `idx_extraccion_ocr_estudiante`: btree (estudiante_id)

---

### `fragmento_conocimiento`
Base de conocimiento vectorizada (embeddings) para búsqueda semántica / RAG.

- **Clave primaria:** `id`

| Columna | Tipo | Nulo | Claves | Descripción |
| :-- | :-- | :--: | :-- | :-- |
| `id` | uuid | No | PK | Identificador único del registro. |
| `fuente_tipo` | text | No | — | Entidad de origen del fragmento (estudiante, evento...). |
| `fuente_id` | uuid | Sí | — | ID del registro de origen (referencia lógica). |
| `contenido` | text | No | — | Fragmento de texto indexado. |
| `metadata` | jsonb | Sí | — | Datos auxiliares para filtrar/citar (JSONB). |
| `embedding` | vector(1536) | Sí | — | Vector de embedding (índice HNSW, coseno). |
| `created_at` | timestamp with time zone | No | — | Fecha de creación del registro. |
| `updated_at` | timestamp with time zone | No | — | Fecha de última modificación (trigger automático). |

**Índices:**
- `fragmento_conocimiento_pkey`: btree (id)
- `idx_fragmento_embedding_hnsw`: hnsw (embedding vector_cosine_ops)
- `idx_fragmento_fuente`: btree (fuente_tipo, fuente_id)

---

## Apéndice A · Tipos ENUM

| Tipo | Valores |
| :-- | :-- |
| `estado_estudiante` | `reclutado`, `postulado`, `academia_liderazgo`, `standby_tecnico`, `activo`, `inactivo`, `graduado`, `suspendido` |
| `genero` | `masculino`, `femenino`, `otro` |
| `parentesco` | `padre`, `madre`, `tutor`, `madrastra`, `padrastro`, `hermano`, `hermana`, `otro` |
| `tipo_estudiante` | `becado` (único valor desde la `0047`) |
| `tipo_patrocinador` | `empresa`, `persona`, `iglesia`, `ong`, `otro` |
| `tipo_transaccion` | `ingreso`, `egreso` |

## Apéndice B · Extensiones

| Extensión | Uso |
| :-- | :-- |
| `pgcrypto` | Generación de UUID (`gen_random_uuid()`). |
| `citext` | Texto sin distinción de mayúsculas (emails únicos). |
| `pg_trgm` | Búsqueda difusa por similitud (buscador de estudiantes). |
| `vector` (pgvector) | Embeddings e índice HNSW para búsqueda semántica / RAG. |
