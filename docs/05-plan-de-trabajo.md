# Plan de Trabajo — Global Effect Nexus

> Plan de 14 sprints (~7 meses) y próximos pasos. Detalle de las 527 subtareas en [`fuentes-datos/sprints-clickup.csv`](fuentes-datos/sprints-clickup.csv). El estado real de cada pantalla está en [`docs/estado/progreso.md`](estado/progreso.md).

## 1. Cronograma de sprints

| Sprint | Foco | Fechas |
|---|---|---|
| **S0** | Planeamiento y diseño (ERD, diccionario, entorno) | 06–17 jul 2026 |
| **S1** | BD: Identidad, RBAC y transversales + seed | 20–31 jul 2026 |
| **S2** | BD: Estudiante (normalizado) y Académico | 03–14 ago 2026 |
| **S3** | BD: dominios restantes | 17–28 ago 2026 |
| **S4** | Backend núcleo: Auth.js, RBAC, i18n | 31 ago–11 sep 2026 |
| **S5** | Expedientes (+ OCR) y Dashboard | 14–25 sep 2026 |
| **S6** | Académico (módulos) y portales | 28 sep–09 oct 2026 |
| **S7** | Patrocinio y Finanzas | 12–23 oct 2026 |
| **S8** | Solicitudes y aprobaciones (antes Psicología; descartado: el departamento de Psicología se eliminó, oct 2026) | 26 oct–06 nov 2026 |
| **S9** | Administrativo y Calendario | 09–20 nov 2026 |
| **S10** | Módulos restantes y páginas públicas | 23 nov–04 dic 2026 |
| **S11** | IA y Reportes | 07–18 dic 2026 |
| **S12** | Migración, QA y Seguridad | 21 dic 2026–01 ene 2027 |
| **S13** | Despliegue y Tesis | 04–15 ene 2027 |

## 2. Estado actual

La **capa de base de datos está adelantada** respecto al cronograma: el diseño y despliegue previstos en S0–S3 ya están hechos y verificados en Supabase.

- ✅ Diseño ER, normalización 1NF–3NF, diccionario de datos.
- ✅ Migraciones `0001`–`0012` desplegadas (36 tablas, RBAC, pgvector para IA).
- ✅ Seed de roles, permisos y datos de prueba.

## 3. Próximos pasos

### Inmediatos (S1 → S4: backend) — ✅ hechos
1. ✅ **Proyecto Next.js 16** con TypeScript, Tailwind 4 (CSS-first), next-intl y pool `pg` en `src/lib/db.ts`.
2. ✅ **Supabase Auth** (email + contraseña, sesión en cookies); `rol` resuelto desde `usuario`; `rbac.ts` (`requirePermission`) + `proxy.ts`.
3. ✅ **Scaffolding i18n** (`messages/{es,en}.json`) y rutas `/[locale]`.
4. ✅ **Runner de migraciones** integrado al repo (script npm) para reproducibilidad.

### Corto plazo (S5+)
5. **Primer vertical end-to-end** (Expedientes): queries parametrizadas → Zod → Server Actions → UI.
6. **Storage** + flujo **OCR → Expediente** (usando `documento` y `extraccion_ocr`).
7. **Servicios de IA:** chat con contexto RAG (`fragmento_conocimiento`), historial (`conversacion_ia`/`mensaje_ia`).

### Transversal
8. **`audit_log`** en acciones sensibles; **notificaciones** internas.
9. ~~Reforzar aislamiento de Psicología~~ — descartado: el departamento de Psicología se eliminó (oct 2026); la migración `0030` retira sus tablas. En su lugar: **trazabilidad de aprobaciones** (cada paso en `solicitud_paso`; aprobar, rechazar y completar en `audit_log`).
10. **Pruebas y seguridad** (S12): validación de constraints, RBAC, y consultas parametrizadas.

## 4. Orden de construcción sugerido (un módulo a la vez)

Identidad → Expedientes → Académico → Patrocinio/Becas → Contabilidad → Solicitudes y aprobaciones → Operaciones (Proyectos/Tareas/Calendario/Comida) → Reportes/Dashboard → IA → Estabilización/Despliegue.

Cada módulo = migración (ya lista) + queries parametrizadas + validación Zod + control de acceso por permiso + i18n.

---

## Backlog detallado de sprints

> Plan de 14 sprints (~7 meses) derivado de la planificación del proyecto. Los sprints de base de datos (**S0–S3**) ya están **completados y desplegados** en Supabase.

## Estado general

| Sprint | Foco | Fechas | Estado |
| :-- | :-- | :-- | :--: |
| **S0** | Planeamiento y diseno | 2026-07-06 → 2026-07-17 | ✅ Hecho |
| **S1** | BD Identidad y transversales | 2026-07-20 → 2026-07-31 | ✅ Hecho |
| **S2** | BD Estudiante y Academico | 2026-08-03 → 2026-08-14 | ✅ Hecho |
| **S3** | BD Dominios restantes | 2026-08-17 → 2026-08-28 | ✅ Hecho |
| **S4** | Backend nucleo (auth, RBAC, i18n) | 2026-08-31 → 2026-09-11 | ▶️ En curso |
| **S5** | Expedientes y Dashboard | 2026-09-14 → 2026-09-25 | ✅ Hecho |
| **S6** | Academico (modulos) y portales | 2026-09-28 → 2026-10-09 | ✅ Hecho |
| **S7** | Patrocinio y Finanzas | 2026-10-12 → 2026-10-23 | 🟦 Backend listo · UI pendiente |
| **S8** | Solicitudes y aprobaciones | 2026-10-26 → 2026-11-06 | ✅ Hecho en el cambio de alcance (Psicología descartada: el departamento se eliminó, oct 2026) |
| **S9** | Administrativo y Calendario | 2026-11-09 → 2026-11-20 | ✅ Hecho |
| **S10** | Modulos restantes y paginas publicas | 2026-11-23 → 2026-12-04 | 🟦 Backend listo · UI pendiente |
| **S11** | IA y Reportes | 2026-12-07 → 2026-12-18 | 🟦 Backend listo · UI pendiente |
| **S12** | Migracion, QA y Seguridad | 2026-12-21 → 2027-01-01 | ⏳ Pendiente |
| **S13** | Despliegue y Tesis | 2027-01-04 → 2027-01-15 | ⏳ Pendiente |

> **Estado del backend:** S0–S3 (BD) ✅. S4 (núcleo) ✅ en curso. **La capa de dominio backend de S5–S11 está construida** (`src/server/*`): consultas parametrizadas + Server Actions con `requirePermission` por módulo. Falta la **UI** de los módulos de S7, S10 y S11 (S8 se replanteó como Solicitudes y aprobaciones) (pantallas, formularios, gráficos).

> **Estado de la UI:** las pantallas están construidas —**login**, **panel**, **landing**, `/comida`, **Expedientes (S5)**, **Administrativo completo (S9)** y **Académico con los portales por rol (S6)**— y los módulos restantes reutilizan los mismos componentes de `src/components/ui/`: lo que falta es pantalla, no estructura.
>
> **Pero el proyecto está sin estilos a propósito.** Se retiraron los tokens, las fuentes y la generación de utilidades de Tailwind, a la espera de definir un sistema visual nuevo. Las pantallas funcionan y se navegan; no tienen decisiones visuales. Cuando el sistema nuevo exista, habrá que documentarlo: el estándar anterior se borró con él.

### Capa `server/` construida (backend por dominio)

| Dominio | Carpeta | Contenido | Permiso |
|---|---|---|---|
| Expedientes | `server/estudiantes/` | lista, expediente completo (perfiles + familiares + GPA), crear | `expedientes.*` |
| Dashboard | `server/dashboard/` | métricas, próximos eventos, tareas prioritarias | (sesión) |
| Académico | `server/academico/` | períodos, materias, inscripción, historial, Global Effect 360 (catálogo, tandas, clases y nota final) | `academico.*` · `calificaciones.registrar` |
| Portales | `server/portales/` | lectura recortada a una persona: expediente propio del estudiante y clases propias del docente (materias y 360) | (sesión + propiedad de la fila) |
| Patrocinio | `server/patrocinadores/` | patrocinadores + estadísticas, asignación de becas | `patrocinadores.*` |
| Finanzas | `server/finanzas/` | transacciones, balance, evolución mensual | `finanzas.*` |
| Solicitudes | `server/solicitudes/` | bandeja por permisos, flujo por pasos, segundo nivel de dirección, línea de tiempo (`solicitud`, `solicitud_paso`) | `solicitudes.gestionar` · `solicitudes.direccion` · `finanzas.escribir` (gastos) |
| Operaciones | `server/operaciones/` | proyectos, tareas (Kanban) + automatización email/evento, calendario, servicios | `operaciones.*` |
| Academias | `server/academias/` | programas y materiales | `academico.escribir` |
| Comida | `server/comida/` | inscripción pública (≤ 8:30 AM, no duplicado), conteo, lista admin | público / `operaciones.leer` |
| Landing | `server/landing/` | **hero configurable** (CRUD slides), estadísticas en vivo, eventos públicos | público / `landing.administrar` |
| Usuarios | `server/usuarios/` | personal, invitar, cambiar rol/estado | `usuarios.administrar` |
| IA | `server/ia/` | chat con contexto (Anthropic), conversaciones, OCR | `ia.usar` |
| Reportes | `server/reportes/` | agregaciones Proyectos/Académico/Contabilidad | `operaciones/academico/finanzas.leer` |
| Storage | `server/storage.ts` | subida a Supabase Storage + tabla `documento` | (sesión) |

Integraciones backend: `lib/anthropic.ts` (chat/traducción/OCR), `lib/email.ts` (Resend), `lib/integrations.ts` (webhook n8n → CRM GENIALiA).

---

## S0 — Planeamiento y diseno
**Fase:** Planeamiento · **Fechas:** 2026-07-06 → 2026-07-17 · **Estimado:** 20 días · **Estado: ✅ COMPLETADO**

> META SMART Especifico: Dejar listo el diseno y el entorno antes de escribir DDL. Medible: ERD aprobado, diccionario de datos completo, matriz roles x permisos y repo Next.js corriendo con pg. Alcanzable: equipo de 2, stack Next.js+pg+PostgreSQL. Relevante: avanza el entregable de tesis. Temporal: 2 semanas.

- [x] Levantar requerimientos y casos de uso (27 modulos)
- [x] Disenar ERD completo
- [x] Diccionario de datos (tabla por tabla, columna por columna)
- [x] Definir tipos ENUM y catalogos
- [x] Definir matriz de roles x permisos (6 roles)
- [x] Inicializar repo Next.js + TypeScript
- [x] Configurar conexion pg (pool) + .env
- [x] Configurar runner de migraciones
- [x] Configurar i18n (next-intl) es/en
- [x] Integrar Tailwind + shadcn/ui + tokens

---

## S1 — BD Identidad y transversales
**Fase:** Base de datos · **Fechas:** 2026-07-20 → 2026-07-31 · **Estimado:** 18 días · **Estado: ✅ COMPLETADO**

> META SMART Especifico: Crear y migrar identidad, acceso y soporte con FKs, indices, triggers y seed. Medible: 7 tablas migradas + funcion set_updated_at + seed con 6 roles, permisos y admin. Alcanzable: equipo de 2, stack Next.js+pg+PostgreSQL. Relevante: avanza el entregable de tesis. Temporal: 2 semanas.

- [x] Infra: pgcrypto + funcion/trigger set_updated_at
- [x] Tabla rol
- [x] Tabla permiso
- [x] Tabla rol_permiso (union)
- [x] Tabla usuario
- [x] Tabla documento (reemplaza *_url)
- [x] Tabla notificacion
- [x] Tabla audit_log
- [x] seed.sql: roles, permisos y admin inicial

---

## S2 — BD Estudiante y Academico
**Fase:** Base de datos · **Fechas:** 2026-08-03 → 2026-08-14 · **Estimado:** 24 días · **Estado: ✅ COMPLETADO**

> META SMART Especifico: Construir el nucleo del beneficiario (normalizado) y el dominio academico. Medible: 10 tablas migradas (estudiante + 4 perfiles + periodo, materia, curso, inscripcion, calificacion, historial) con enums y FKs. Alcanzable: equipo de 2, stack Next.js+pg+PostgreSQL. Relevante: avanza el entregable de tesis. Temporal: 2 semanas.

- [x] Crear enums (estudiante y academico)
- [x] Tabla estudiante (normalizada)
- [x] Tabla familiar
- [x] Tabla perfil_vivienda (1:1)
- [x] Tabla perfil_salud (1:1)
- [x] Tabla perfil_socioeconomico (1:1)
- [x] Tabla periodo
- [x] Tabla materia
- [x] Tabla curso (tecnicos)
- [x] Tabla inscripcion (matricula)
- [x] Tabla calificacion
- [x] Tabla historial_calificacion

> `curso` y `calificacion` se retiraron en la migración `0047` (oct 2026), cuando la Fundación dejó de impartir cursos técnicos; con ellas se fue el valor `regular` de `tipo_estudiante`. La lista de arriba es lo que se construyó en agosto y se deja como historia.

---

## S3 — BD Dominios restantes
**Fase:** Base de datos · **Fechas:** 2026-08-17 → 2026-08-28 · **Estimado:** 26 días · **Estado: ✅ COMPLETADO**

> META SMART Especifico: Construir patrocinio, finanzas, psicologia, operacion, academias y bienestar. Medible: 12 tablas migradas con enums y FKs. Esquema 100% completo. Alcanzable: equipo de 2, stack Next.js+pg+PostgreSQL. Relevante: avanza el entregable de tesis. Temporal: 2 semanas.

- [x] Tabla patrocinador
- [x] Tabla asignacion_beca
- [x] Tabla transaccion
- [x] ~~Tabla cita_psicologia~~ — descartado: el departamento de Psicología se eliminó (oct 2026); retirada en `0030`
- [x] ~~Tabla nota_psicologica (CONFIDENCIAL)~~ — retirada en `0030`
- [x] Tabla proyecto
- [x] Tabla tarea
- [x] Tabla tarea_asignado (union)
- [x] Tabla evento
- [x] Tabla registro_servicio
- [x] Tabla academia
- [x] Tabla material
- [x] Tabla inscripcion_comida

---

## S4 — Backend nucleo (auth, RBAC, i18n)
**Fase:** Backend · **Fechas:** 2026-08-31 → 2026-09-11 · **Estimado:** 12 días · **Estado: ▶️ EN CURSO**

> META SMART Especifico: Montar autenticacion, control de acceso y la base transversal sobre la BD. Medible: Login con Supabase Auth, proteccion por rol en proxy, helper requirePermission()/can(), capa de queries, i18n operativo y subida de archivos. Alcanzable: equipo de 2, stack Next.js 16 + Supabase + pg. Relevante: avanza el entregable de tesis. Temporal: 2 semanas.

- [x] Supabase Auth (email + contraseña, sesión en cookies) — `lib/supabase/*`, `lib/auth.ts`
- [x] Proteccion por rol en `proxy.ts` + helpers `can()` / `requirePermission()`
- [x] Migración `0014`: enlace `usuario.auth_user_id ↔ auth.users` + trigger de sincronización
- [x] Capa base de queries pg (`lib/db.ts`) + patrón `server/<dominio>` (vertical de referencia: Estudiantes)
- [x] i18n operativo (es/en) + login localizado
- [x] Subida de archivos (Supabase Storage) + tabla `documento` — `server/storage.ts`
- [x] Layout: AppLayout + Sidebar por rol + TopBar (`components/layout/*`)
- [x] **Página de login pulida** — controles del inventario (`Field` + `Input` + `Button`) en vez de inputs con clases propias, halo de marca por token y el fallo de Google ya avisa (antes el botón solo dejaba de girar). Landing pública: ver S10.
- [x] **Identidad del admin maestro** — `npm run db:admin` (`scripts/crear-admin-maestro.mjs`): crea el perfil `super_admin`, la identidad en Auth y el enlace por email, en ese orden. Sin contraseña genera enlace de invitación; es idempotente y verifica el enlace al terminar.

---

## S5 — Expedientes y Dashboard
**Fase:** Implementacion · **Fechas:** 2026-09-14 → 2026-09-25 · **Estimado:** 10 días · **Estado: ✅ COMPLETADO**

> META SMART Especifico: Entregar el modulo mas grande (Expedientes) y el Dashboard. Medible: CRUD con formulario de 6 pestanas, detalle con GPA, OCR, y Dashboard con tarjetas y graficos. Alcanzable: equipo de 2, stack Next.js+pg+PostgreSQL. Relevante: avanza el entregable de tesis. Temporal: 2 semanas.

- [x] **CRUD de expedientes + buscador** — `/expedientes`: cifras de la cartera, filtros en la URL (`?q=`, `?tipo=`, `?estado=`, funcionan sin JavaScript) y tabla con el riel coloreado por **banda de GPA**, no por estado administrativo: recorriendo la lista lo que hay que detectar es a quién se le cae el rendimiento. Sin historial no hay riel — un gris se leería como nota mala. **Editar y eliminar** en `/expedientes/[id]/editar`, con el mismo formulario de seis pestañas prellenado.

> **Sobre editar y borrar un expediente:** la actualización va en una transacción, como el alta, porque media ficha guardada no avisa de que está a medias. Los familiares se reemplazan enteros —el formulario es dueño de la lista, y casarlos por id solo añadiría formas de equivocarse— y los tres perfiles se insertan, actualizan o **borran** según traigan datos: una fila de vivienda con doce NULL se lee después como "ya se levantó la ficha", que es lo contrario de lo que pasó.
>
> El borrado se niega si el joven tiene vida registrada. La distinción es más fina que en el catálogo Académico: las tablas hijas del expediente (familia, vivienda, salud, situación) **son** el expediente y se van con él, pero las notas, la matrícula, las solicitudes y el servicio comunitario son lo que otros módulos registraron sobre esa persona, y todas esas FK son `ON DELETE CASCADE`. Borrar ahí no es corregir un tecleo: es hacer desaparecer el paso de un joven por la fundación. Para eso está `estado` (`inactivo`, `graduado`, `suspendido`). Exige `expedientes.eliminar`, que en `db/seed.sql` solo tiene `super_admin` — ni siquiera `admin`.
- [x] **Formulario por pestanas (6 secciones)** — `/expedientes/nuevo`: identidad, académico, familia (1:N), vivienda, salud y situación de vida, en el orden de la entrevista. Solo el nombre es obligatorio: la ficha se completa en semanas y exigirla entera haría que el personal invente datos. Escribe las cinco tablas en **una transacción** (`transaction()` en `lib/db.ts`).
- [x] **Vista de detalle con GPA y graficos** — `/expedientes/[id]`: GPA con su banda, evolución por cuatrimestre (cada punto con el color de *su* banda, eje fijo 0–4 y línea de prueba académica en 2.0) y las secciones de la ficha. Una sección sin llenar lo dice, en vez de mostrar una lista de guiones.
- [x] **OCR con IA (subir documento)** — subida + extracción con visión y **salida estructurada** (`output_config.format`), así el modelo queda obligado por el esquema y no hay que rescatar JSON de entre texto. La traza en `extraccion_ocr` se abre *antes* de llamar al modelo para que un fallo quede escrito. **La IA propone, la persona confirma:** los campos se muestran para revisarlos y no se escriben en el expediente.
- [x] **Dashboard principal** — cifras, serie financiera, próximos eventos y tareas que apremian, **armado según los permisos del rol**: el balance y la gráfica de ingresos/egresos exigen `finanzas.leer`, y lo que el rol no puede ver no se consulta (antes se mostraban a cualquiera con sesión, incluido un estudiante). Las fechas salen con `to_char` y el "vencida/hoy" lo decide `CURRENT_DATE` en SQL, no la zona horaria del navegador. Las cifras enlazan a su módulo con el filtro ya puesto.

> **Sobre el panel y los permisos:** los cinco bloques del dashboard pertenecen a cuatro dominios distintos (expedientes, académico, operaciones, finanzas) y los seis roles tienen combinaciones distintas de permisos. Por eso el panel no es una pantalla fija con partes ocultas por CSS: cada bloque se consulta solo si el rol lo puede leer. Un rol sin ningún permiso de lectura ve un estado vacío que le dice que su portal llega después, no un panel en blanco.

---

## S6 — Academico (modulos) y portales
**Fase:** Implementacion · **Fechas:** 2026-09-28 → 2026-10-09 · **Estimado:** 10 días

> META SMART Especifico: Entregar el flujo academico y los portales de estudiante y profesor. Medible: Materias, Cursos, Calificaciones, Historial, Prematricula, Periodos + Portal Estudiante y Profesor. Alcanzable: equipo de 2, stack Next.js+pg+PostgreSQL. Relevante: avanza el entregable de tesis. Temporal: 2 semanas.

- [x] **Materias y Cursos tecnicos** — `/academico/materias`: tabla (superficie Académico, claridad sobre densidad) **sin riel**, porque en un catálogo sano casi toda materia está activa y un riel en cada fila no señalaría nada (§5); la inactiva se apaga. `/academico/cursos`: tarjetas con **barra de ocupación**, porque el dato que se consulta de un curso es el cupo y "18 / 30" en una celda no se lee de un vistazo. Reparto de señales: el riel lleva el ciclo de vida, la barra el cupo — y pasarse de capacidad es lo único en rojo (un curso lleno es la meta, no un fallo). Las consultas ahora hacen `LEFT JOIN periodo` para mostrar el nombre en vez de un UUID. **CRUD completo**: menú por registro con edición y borrado; el mismo diálogo sirve para crear y editar, porque son los mismos campos con las mismas reglas y dos formularios paralelos divergen al primer campo nuevo.
- [x] **Calificaciones (color por nota)** — `/academico/calificaciones`: distribución por las cuatro bandas del estándar (≥90 · 70–89 · 60–69 · <60), promedio con su banda, tasa de aprobación (corte 70) y tabla con riel por banda. La nota se colorea **mientras se teclea** en el formulario: un 6 en lugar de un 60 se ve al instante. Cada color va con su nombre — el color nunca es el único portador del significado (§3.2).

> **Sobre el acceso a esta pantalla:** el permiso obvio, `academico.leer`, es el equivocado. El rol `estudiante` lo tiene (lo necesita para el catálogo de materias), así que gatear con él le dejaría ver las notas de sus compañeros. Se exige **`calificaciones.registrar` o `expedientes.leer`**: el docente entra por el primero (no lleva expedientes), quien lleva expedientes por el segundo (no registra notas), y el estudiante por ninguno — sus notas van en su portal. Para esto se añadió `permisos?: string[]` ("basta con uno") a `NavItem`.
>
> Además: en `db/seed.sql`, `calificaciones.registrar` lo tienen solo `docente` y `super_admin` — **`admin` no**. El botón de registrar lo respeta: quien califica es quien da clase.
- [x] **Historial + Prematricula + Periodos** — `/academico/historial`: una fila por estudiante con GPA, promedio y reparto aprobadas/reprobadas/en prueba, filtrable por cuatrimestre. `/academico/prematricula`: inscripción por desplegables (estudiante × materia × período) con resumen del período. `/academico/periodos`: cada período con lo que cuelga de él, contado por subconsulta y no con tres `JOIN` a la vez, que multiplicarían las filas entre sí (*fan-out*), y **con edición**, que es lo que convierte la pantalla en gestión: sin ella un cuatrimestre se quedaba en el estado que se eligió al crearlo y no podía activarse ni cerrarse — la propia pantalla avisaba del desajuste entre fechas y estado, pero no dejaba arreglarlo.

> **Sobre el borrado del catálogo:** las FK del esquema son `ON DELETE CASCADE`, así que borrar un curso se lleva sus calificaciones y borrar una materia, sus inscripciones. Un clic en un menú no puede destruir el historial de un cuatrimestre, de modo que el borrado **cuenta primero lo que cuelga y se niega** si hay algo, explicando qué hay y ofreciendo la alternativa real: desactivar la materia o dar el curso por finalizado. Queda así reservado a lo que nadie usa todavía —una materia tecleada por error—, que es lo único que de verdad se borra en un registro de vidas. Por eso tampoco hace falta un `academico.eliminar` aparte del permiso de escritura, como sí lo hay en Expedientes: aquí el borrado no puede destruir nada por construcción.
>
> El resultado viaja como **dato de retorno** y no como excepción, porque Next.js oculta el mensaje de un error no controlado de una Server Action en producción y la pantalla solo podría decir "algo falló".
- [x] **Portal Estudiante** — `/portal/estudiante`: banner con el GPA a tamaño de titular y coloreado por banda (es el número del que depende su beca), materias en curso, historial agrupado por cuatrimestre con letra A–F, condición en la Fundación de los últimos tres meses y próximos eventos. Sin comparativas con otros becados: un portal que ranquea convierte una ayuda en una competencia.
- [x] **Portal Profesor** — `/portal/profesor`: banner de cursos activos, inscritos, notas y materias; accesos rápidos comprobados contra el permiso real; y sus cursos —también los cerrados, detrás de los activos— con ocupación y lo que falta por calificar.

> **Sobre "de quién es un curso":** el Portal Profesor no podía construirse sobre el esquema tal como estaba. `curso.docente` y `materia.profesor_nombre` son TEXT libres: sirven para imprimir un nombre, no para decidir identidad. Cruzar por texto le habría enseñado a un homónimo los cursos de otro, y a "Juan A. Pérez" ninguno de los suyos. La **migración 0019** añade `curso.docente_usuario_id` y `materia.profesor_usuario_id` (FK a `usuario`, `ON DELETE SET NULL`) con backfill conservador —solo coincidencias exactas y únicas de nombre—, y **conserva** las columnas de texto: no todo docente es usuario del sistema (un tallerista externo nunca inicia sesión) y el nombre de quien dio el curso el año pasado no debe desaparecer al borrarse un usuario. Regla de lectura: la FK dice de quién es, el texto dice qué nombre se muestra.
>
> **Cambio de alcance (24 oct 2026).** Lo que este sprint construyó para cursos técnicos ya no existe: la migración `0047` borró `curso` y `calificacion`. `/academico/cursos` pasó a ser **`/academico/clases-360`** —solo clases de Global Effect 360: inscritos, tareas, entregas y la nota final de cada inscripción, que la deja aprobada o reprobada— y `/academico/calificaciones` se retiró; `calificaciones.registrar` sigue y ahora es el permiso para poner esa nota final. El portal del profesor deja de tener tres listas y se queda con dos: materias universitarias y clases de 360. Las decisiones de arriba (el riel, el borrado que cuenta antes, la FK del docente) siguen valiendo para lo que queda.
>
> **Sobre el acceso a un portal:** no lo da un permiso, lo da la propiedad de la fila. El Portal Estudiante no lee nada que un permiso pueda nombrar — lee `estudiante.usuario_id = <yo>`. Por eso `NavItem` gana `roles?: string[]`, una lista exacta que **también aplica a `super_admin`**: enseñarle "Mi portal" a quien no tiene expediente solo le ofrece una pantalla que no puede contener nada suyo. Y por eso `HOME_POR_ROL` cambia: el estudiante y el docente aterrizan en su portal, no en el panel general, cuyas cifras (becados, balance del mes) se les recortan hasta dejarlo casi vacío.

---

## S7 — Patrocinio y Finanzas
**Fase:** Implementacion · **Fechas:** 2026-10-12 → 2026-10-23 · **Estimado:** 8 días

> META SMART Especifico: Entregar patrocinadores, becas y contabilidad. Medible: Patrocinadores, Asignacion de Becas y Contabilidad con estadisticas + Portal Contabilidad. Alcanzable: equipo de 2, stack Next.js+pg+PostgreSQL. Relevante: avanza el entregable de tesis. Temporal: 2 semanas.

- [ ] Patrocinadores (CRUD + estadisticas)
- [ ] Asignacion de becas
- [ ] Contabilidad (transacciones + balance)
- [ ] Portal Contabilidad

---

## S8 — Solicitudes y aprobaciones
**Fase:** Implementacion · **Fechas:** 2026-10-26 → 2026-11-06 · **Estimado:** 8 días · **Estado: ✅ CONSTRUIDO (adelantado al cambio de alcance, oct 2026)**

> META SMART Especifico: Entregar el modulo de Solicitudes y aprobaciones: tramites del estudiante y aprobaciones internas en una sola bandeja con flujo por pasos. Medible: tablas `solicitud` y `solicitud_paso` (migracion `0031`), bandeja del personal, formulario del estudiante, segundo nivel de direccion y linea de tiempo. Alcanzable: equipo de 2, stack Next.js+pg+PostgreSQL. Relevante: avanza el entregable de tesis. Temporal: 2 semanas.

- [x] Migracion `0030_fin_de_psicologia.sql` (cuentas `psicologo` → `admin`; se retiran rol, permisos, tablas y `estudiante.psicologo_id`)
- [x] Migracion `0031_solicitudes_y_aprobaciones.sql` (tablas + permisos `solicitudes.gestionar` y `solicitudes.direccion`)
- [x] Bandeja del personal `/administrativo/solicitudes` (por atender, mis solicitudes, alta interna, acciones con comentario)
- [x] Solicitudes del estudiante `/portal/estudiante/solicitudes` (formulario + linea de tiempo)
- [x] Reglas de control: nadie aprueba lo suyo, `requiere_direccion` fijado al crear, notificaciones y `audit_log`
- [x] Citas con administracion en el calendario del estudiante; conteo de pendientes en `/portal/administrativo`

> **Descartado** (el departamento de Psicología se eliminó, oct 2026): gestión de citas y seguimientos, acceso estricto a notas confidenciales, agendar cita (estudiante) y Portal Psicología. Su lugar en el sprint lo ocupa este módulo.

---

## S9 — Administrativo y Calendario
**Fase:** Implementacion · **Fechas:** 2026-11-09 → 2026-11-20 · **Estimado:** 10 días

> META SMART Especifico: Entregar tareas (Kanban + automatizaciones), proyectos, personal y calendario. Medible: Kanban con email + evento automatico, proyectos con progreso, personal y calendario mensual + agenda. Alcanzable: equipo de 2, stack Next.js+pg+PostgreSQL. Relevante: avanza el entregable de tesis. Temporal: 2 semanas.

- [x] **Tareas (Kanban) + asignacion multiple** — `/administrativo/tareas`: tablero de tres columnas con arrastre y menú "Mover a" (alternativa por teclado), tarjeta compacta con avatares apilados y panel lateral de detalle.
- [x] **Automatizaciones al crear tarea** — correo a cada asignado (Resend), evento espejo en el calendario cuando hay fecha límite, webhook a n8n y revalidación de las cinco vistas que dependen del estado de una tarea.
- [x] **Proyectos + Gestion de personal** — `/administrativo/proyectos` con avance calculado desde las tareas cerradas (no un porcentaje escrito a mano) y `/administrativo/personal` con cifras del equipo, reparto por rol y carga de trabajo por persona.
- [x] **Calendario mensual + agenda 30 dias** — `/calendario`: rejilla del mes con indicadores por día y panel del día, más agenda cronológica de 30 días que mezcla eventos y tareas. Navegación por `?mes=YYYY-MM` (funciona sin JavaScript).
- [x] **Portal Administrativo** — `/administrativo`: cuatro cifras del día, ocho accesos y las tareas que apremian (vencidas o de prioridad alta).

> **Sobre el calendario:** las tareas con fecha límite generan un evento espejo, así que la consulta de calendario descarta los eventos con `tarea_id` y muestra la tarea. Si no, cada tarea se vería dos veces el mismo día; y la tarea es la que conserva su estado vivo (completada, vencida) y su prioridad.

---

## S10 — Modulos restantes y paginas publicas
**Fase:** Implementacion · **Fechas:** 2026-11-23 → 2026-12-04 · **Estimado:** 10 días

> META SMART Especifico: Cerrar los modulos restantes y las paginas publicas. Medible: Academias/Materiales, Servicios mensuales (PDF), Comida (publica), Configuracion, Sitemap y Landing. Alcanzable: equipo de 2, stack Next.js+pg+PostgreSQL. Relevante: avanza el entregable de tesis. Temporal: 2 semanas.

- [x] Backend Academias/Programas + Materiales (`server/academias/`)
- [ ] Servicios mensuales (toggles + PDF) — backend en `server/operaciones/`
- [x] **Inscripcion de comida (publica)** — `/comida` con **pre-registro multi-día** + lista **imprimible** por día para el admin (`/inscripcion-comida`)
- [x] **Landing publica (Inicio)** con **hero configurable por el admin** — `/` + `/configuracion/landing`
- [ ] Configuracion (hub) + Sitemap — hub inicial creado

---

## S11 — IA y Reportes
**Fase:** Implementacion · **Fechas:** 2026-12-07 → 2026-12-18 · **Estimado:** 6 días

> META SMART Especifico: Entregar los asistentes de IA y el dashboard analitico. Medible: Chat IA interno con contexto de la BD, Chat IA estudiantil y Reportes (Proyectos/Academico/Contabilidad). Alcanzable: equipo de 2, stack Next.js+pg+PostgreSQL. Relevante: avanza el entregable de tesis. Temporal: 2 semanas.

- [ ] Chat IA interno (contexto de la BD)
- [ ] Chat IA estudiantil
- [ ] Reportes visuales (3 secciones)

---

## S12 — Migracion, QA y Seguridad
**Fase:** Estabilizacion · **Fechas:** 2026-12-21 → 2027-01-01 · **Estimado:** 6 días

> META SMART Especifico: Migrar datos reales, endurecer seguridad y asegurar calidad. Medible: Migracion >=30% de registros, pruebas de flujos criticos y revision de seguridad. Alcanzable: equipo de 2, stack Next.js+pg+PostgreSQL. Relevante: avanza el entregable de tesis. Temporal: 2 semanas.

- [ ] Migrar >=30% de registros actuales
- [ ] Pruebas de flujos criticos
- [ ] Revision de seguridad

---

## S13 — Despliegue y Tesis
**Fase:** Cierre · **Fechas:** 2027-01-04 → 2027-01-15 · **Estimado:** 6 días

> META SMART Especifico: Desplegar a produccion y dejar la documentacion de tesis lista. Medible: Sistema desplegado, UAT aprobado y documentacion entregada. Alcanzable: equipo de 2, stack Next.js+pg+PostgreSQL. Relevante: avanza el entregable de tesis. Temporal: 2 semanas.

- [ ] Desplegar a produccion
- [ ] UAT con la fundacion
- [ ] Documentacion final de tesis

---
