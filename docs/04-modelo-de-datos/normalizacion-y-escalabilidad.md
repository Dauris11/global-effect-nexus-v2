# Normalización, Escalabilidad e IA — Global Effect Nexus

> Justificación técnica del diseño de la base de datos: metodología SMART, formas normales (1NF, 2NF, 3NF), decisiones de escalabilidad y soporte nativo para Inteligencia Artificial. Documento de sustento para la memoria de tesis.

---

## 1. Enfoque SMART del diseño

- **S — Específico:** esquema relacional normalizado en PostgreSQL que cubre los 27 módulos de la fundación, con expediente estudiantil descompuesto y seguridad RBAC a nivel de datos.
- **M — Medible:** 35 tablas (tras la migración `0047`), 6 tipos ENUM, PK UUID auto-generadas, 39 claves foráneas con integridad referencial, índices en todas las FK y 20 triggers de auditoría de fecha.
- **A — Alcanzable:** PostgreSQL nativo con SQL escrito a mano (sin ORM), migraciones `.sql` numeradas y compatibilidad directa con el cliente `pg` (node-postgres) y consultas parametrizadas.
- **R — Relevante:** resuelve redundancia, inconsistencia de datos y trazabilidad de las aprobaciones (cada paso de una solicitud queda registrado); es la base de la arquitectura Next.js.
- **T — Temporal:** entregable desde el Sprint 0–1, desplegado y verificado en Supabase.

---

## 2. Formas de normalización aplicadas

### Primera Forma Normal (1NF) — atomicidad, sin grupos repetitivos
- Los datos de hermanos y familiares (antes cadenas de texto con varios valores) se normalizan en la tabla **`familiar`** (relación 1:N) con un enum `parentesco`.
- La asignación múltiple de responsables a una tarea (antes una lista de correos) se normaliza en la tabla de unión **`tarea_asignado`** (N:M), que referencia físicamente a `usuario`.
- La historia de una solicitud (quién la movió, cuándo, de qué estado a cuál y con qué comentario) no se guarda como lista dentro de la solicitud: cada paso es una fila de **`solicitud_paso`** (1:N).

### Segunda Forma Normal (2NF) — dependencia completa de la PK
- El expediente del estudiante (una sola entidad con decenas de campos heterogéneos) se **descompone** en tablas con dependencia directa de su clave:
  1. `estudiante` — datos personales e institucionales núcleo.
  2. `familiar` (1:N) — red familiar.
  3. `perfil_vivienda` (1:1) — condiciones del hogar.
  4. `perfil_salud` (1:1) — enfermedades, alergias, emergencias.
  5. `perfil_socioeconomico` (1:1) — historia de vida, motivo de beca, metas.

### Tercera Forma Normal (3NF) — sin dependencias transitivas
- Se elimina la duplicación de guardar el *nombre* junto al *id* (p. ej. `estudiante_nombre` + `estudiante_id`, `materia_nombre` + `materia_id`, `patrocinador_nombre` + `patrocinador_id`). Solo se almacena la **FK**; el nombre se obtiene por `JOIN`, evitando anomalías de actualización.
- **`solicitud`** guarda solo FKs (`solicitante_id`, `estudiante_id`, `responsable_id`); los nombres salen por `JOIN`.
- **Redundancia controlada:** `solicitud.estado` coincide con el `estado_nuevo` del último `solicitud_paso`. Se guarda igual para que la bandeja filtre por estado con un índice parcial sobre las abiertas (`idx_solicitud_abiertas`) en vez de buscar el último paso de cada solicitud; ambos se escriben en la misma transacción, así que no pueden divergir.

---

## 3. Integridad y auditoría

- **Claves foráneas físicas** con políticas explícitas: `ON DELETE CASCADE` para dependencias del estudiante (al borrar un estudiante se limpian sus perfiles, familiares, inscripciones, etc.) y `ON DELETE SET NULL` para referencias opcionales (documentos, patrocinador, usuario).
- **Restricciones `CHECK`** de dominio: notas 0–100, GPA 0–4, progreso 0–100, montos ≥ 0 (o > 0 en transacciones), edades/cantidades ≥ 0, idioma ∈ {es, en}, coherencia de fechas de período; en `solicitud`, `tipo` y `estado` dentro de su catálogo, `monto > 0`, estudiante obligatorio para `alta_expediente` y `beca`, y monto obligatorio para `gasto`.
- **Restricciones `UNIQUE`** de negocio: `inscripcion (estudiante, materia, periodo)`, `inscripcion_360 (estudiante, periodo, ronda)` como índice parcial que no cuenta las retiradas —una materia de Global Effect 360 por tanda, dos por cuatrimestre—, `registro_servicio (estudiante, mes)`, `inscripcion_comida (nombre, fecha)`, emails y cédula.
- **Triggers `set_updated_at()`** en todas las tablas con `updated_at`.
- **`audit_log`** para trazar acciones sensibles con snapshot JSONB `{antes, despues}`.

---

## 4. Escalabilidad

- **Identificadores UUID:** evitan colisiones y permiten generación distribuida (importante para sincronización, sharding e integraciones futuras).
- **Índices dirigidos:** en todas las FK y en columnas de filtro frecuente (estado, fecha, tipo, categoría). En solicitudes: índice parcial sobre las abiertas (la bandeja), por solicitante, por estudiante y el historial por solicitud.
- **Búsqueda difusa (`pg_trgm`):** índice GIN sobre `estudiante.nombre` para el buscador inteligente en tiempo real, escalable a miles de registros.
- **Índices BRIN** en tablas *append-only* de alto volumen (`audit_log.created_at`, `mensaje_ia.created_at`): ocupan una fracción de un B-tree y aceleran consultas por rango de fecha.
- **Emails case-insensitive (`citext`):** unicidad correcta sin normalización manual.
- **Tipos `TIMESTAMPTZ`** en todo momento para consistencia horaria multi-zona.
- **SQL parametrizado (`$1, $2…`):** además de seguridad contra inyección, favorece el *plan caching* del motor.

---

## 5. Soporte nativo de Inteligencia Artificial

El esquema contempla la IA como ciudadano de primera clase (extensión `vector` / pgvector):

- **Historial conversacional** (`conversacion_ia`, `mensaje_ia`): persiste los chats de los asistentes interno y estudiantil, con ámbito, rol de cada mensaje y conteo de tokens (para métricas de costo/uso).
- **Trazabilidad OCR** (`extraccion_ocr`): registra cada extracción sobre documentos escaneados — estado del pipeline, modelo usado, nivel de confianza y `datos_extraidos` en JSONB — dando soporte auditable al flujo *OCR → Expediente*.
- **Base de conocimiento vectorizada** (`fragmento_conocimiento`): almacena fragmentos de texto de entidades institucionales con su **embedding** (`vector(1536)`), indexado con **HNSW** (`vector_cosine_ops`) para búsqueda semántica / **RAG** eficiente a gran escala. Permite que los asistentes respondan con contexto recuperado de la propia base de datos.

> La dimensión del vector (1536) es configurable según el modelo de embeddings del servicio de IA.

---

## 6. Verificación realizada

El esquema fue desplegado y verificado en Supabase (PostgreSQL 17):

- ✅ Despliegue inicial (S3): 36 tablas, 7 enums, 20 triggers, 88 índices y 44 FKs creados sin errores.
- ✅ Extensiones activas: `pgcrypto`, `citext`, `pg_trgm`, `vector 0.8.0`.
- ✅ Índice vectorial **HNSW** operativo sobre `fragmento_conocimiento`.
- ✅ Prueba de borrado en cascada: al eliminar un estudiante se eliminan automáticamente su perfil de salud y familiares.
- ✅ RBAC sembrado en S3: super_admin (17 permisos), admin (9), psicólogo (4), contabilidad (3), docente (3), estudiante (2).
- ✅ Cambio de alcance (oct 2026): la migración `0030` retira el rol `psicologo` (sus cuentas pasan a `admin`), los permisos `psicologia.*`, las tablas `cita_psicologia`, `nota_psicologica` y `perfil_psicologico` y la columna `estudiante.psicologo_id`; la `0031` crea `solicitud` y `solicitud_paso` y los permisos `solicitudes.gestionar` (admin, super_admin) y `solicitudes.direccion` (super_admin). Roles finales: super_admin, admin, docente, estudiante, contabilidad, habitudes.
- ✅ Fin de los cursos técnicos (24 oct 2026): la migración `0047` pasa todo estudiante `regular` a `becado` y retira ese valor del enum, borra sin copia `curso`, `calificacion` y el enum `tipo_evaluacion` (como la `0030` con Psicología), quita `asignacion.curso_id` —una tarea cuelga de una materia universitaria o de una de 360, exactamente de una—, abre Global Effect 360 a todos los estudiantes, retira `materia_360.obligatoria` porque todo el catálogo es obligatorio y exige una materia por tanda con un índice único parcial.
