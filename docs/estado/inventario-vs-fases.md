# Inventario del sistema frente al plan por fases

Los dos documentos que describen el sitio módulo a módulo —**«Módulos por portal»**
(8 de agosto) y **«Inventario de módulos y submódulos»** (31 de julio)— estaban
sueltos: el primero ya vivía en el repo como
[`docs/referencia/modulos-por-portal.md`](../referencia/modulos-por-portal.md), el segundo no estaba en ninguna
parte. Aquí quedan los dos refundidos en una sola lista, y cada línea cruzada
contra las dos cosas que deciden si está hecho: el **sprint** que lo reclama en
[`docs/estado/plan-etapas.md`](plan-etapas.md) / [`docs/05-plan-de-trabajo.md`](../05-plan-de-trabajo.md),
y el **código que existe hoy** en `src/app/[locale]`.

Lo que este documento añade y los otros dos no tenían: la columna de estado. Un
inventario que no dice qué está construido se lee como una promesa.

> **Cambio de alcance (oct 2026).** El departamento de Psicología se eliminó y el
> sistema pasa a describirse como un **ERP institucional** con portal del
> estudiante integrado. El portal, el módulo y el rol de psicología desaparecen
> (migración `0030_fin_de_psicologia.sql`), el expediente pasa a administración
> (`admin` / `super_admin`, sobre todos los estudiantes) y la cita de psicología la
> sustituye **Solicitudes y aprobaciones** (migración
> `0031_solicitudes_y_aprobaciones.sql`). Las filas de psicología quedan marcadas
> como descartadas en §5 y §6.

> **Cambio de alcance (24 oct 2026).** La Fundación dejó de impartir cursos
> técnicos. La migración `0047_fin_de_cursos_tecnicos.sql` borra `curso` y
> `calificacion` (sin copia, como la `0030` con Psicología) y retira el
> estudiante `regular`: todo estudiante es becado universitario. Global Effect
> 360 ocupa el sitio de los cursos —docente, tareas, entregas y nota final—,
> abierto a todos y con el catálogo entero obligatorio: dos tandas de dos meses
> por cuatrimestre y **una** materia por tanda. `/academico/cursos` pasa a ser
> `/academico/clases-360` y `/academico/calificaciones` se retira. Las filas
> de cursos técnicos quedan marcadas en §3, §4, §5 y §6.

Fuente del estado: [`docs/estado/progreso.md`](progreso.md) (estado por módulo) y
[`docs/estado/pendientes.md`](pendientes.md) (cola de tareas). Si hay discrepancia entre este
archivo y el código, manda el código:

```sh
find 'src/app/[locale]' -name page.tsx          # lo que existe
grep -rl EnConstruccion 'src/app/[locale]'      # lo que es solo un esqueleto
grep -o 'href: "[^"]*"' src/lib/nav.ts | sort -u  # lo que ofrece el menú
```

| | Significado |
|---|---|
| ✅ | **Funcional.** Consulta la base, escribe si le toca, y su pantalla es la definitiva. |
| 🟡 | **Esqueleto.** La ruta existe y cierra su permiso, pero avisa de que el módulo no está construido. |
| ⬜ | **Sin ruta.** No existe la página. |
| ➖ | **Descartado.** El inventario lo pide, pero no aplica al sistema real (ver §1). |

---

## 1. Antes de leer las tablas: los dos documentos describen el prototipo, no el sitio

Los dos inventarios se escribieron sobre el prototipo **Base44 en React/JSX**.
El proyecto de hoy es Next.js con TypeScript, y hay cuatro desfases que se
repiten en cada página del inventario. Se anotan una vez aquí para no repetirlos
en cada fila:

| El inventario dice | En el sistema real es | Por qué |
|---|---|---|
| Roles `profesor`, `administrativo` | `docente`, `admin` | Los nombres salen de las tablas `rol`/`rol_permiso`. Manda la base (`src/lib/rbac.ts`). Los **slugs de ruta** sí conservan el nombre viejo (`/portal/profesor`) porque son URLs ya documentadas. El rol de psicología del inventario ya no existe: la 0030 lo eliminó. |
| 6 roles | **6 roles**, pero no los mismos: `super_admin`, `admin`, `docente`, `estudiante`, `contabilidad`, `habitudes` | `super_admin` y `habitudes` no existían en el prototipo. Habitudes lleva a los reclutas por el embudo (migración 0025). El de psicología desapareció con el departamento (migración 0030). |
| `src/pages/*.jsx`, `RoleContext.jsx`, `AuthContext.jsx`, `ProtectedRoute.jsx` | `src/app/[locale]/(portal)/**/page.tsx`, `src/lib/rbac.ts`, `src/lib/auth.ts`, y el layout de cada grupo | No hay contexto de rol en el cliente: **cada layout valida contra la base**, no en el navegador ni en el proxy. |
| «Portal administrativo» como un panel de operaciones más | El portal **donde converge todo el sistema** | No hay rol `administrativo`; es el rol `admin`. Duplicar `/dashboard` no tenía sentido, así que `/portal/administrativo` se construyó como otra pregunta: lo que espera una decisión. |
| 15 entidades de base de datos | **43 tablas**, 31 migraciones | El esquema está normalizado: el «Estudiante» plano del inventario son seis tablas (ver §7). |

Dos cosas más que el inventario promete y el sistema **no tiene**:

- **Correo.** «Notificación automática por email»:
  este proyecto no tiene ninguna infraestructura de correo. Lo que hay es la
  tabla `notificacion`.
- **Rutas del prototipo que no existen**: `/portal/cursos-tecnicos` (selector),
  `/portal/estudiante-ct` y `/chat-ia-estudiantil`. Ver §6. Las dos primeras
  ya no tendrían a quién servir: los cursos técnicos se cerraron en oct 2026.

---

## 2. Zona pública (sin cuenta)

| Estado | Módulo del inventario | Ruta real | Sprint | Nota |
|---|---|---|---|---|
| ✅ | A.1 Landing / Inicio (navbar, hero, cifras, portales, eventos, propuesta, pie) | `/` · `/en` | S10 | Construida y **más grande que el inventario**: hero editable desde el panel, franja de acceso con estado del comedor, programas, dónde estamos, patrocinadores, noticias y preguntas. Las cinco consultas van en `unstable_cache`. |
| ✅ | A.1 · Hero slider (3 diapositivas) | `/configuracion/landing` | S10 | Las diapositivas se administran: alta, orden, mostrar/ocultar, botón propio, rastro en `audit_log`. |
| ✅ | A.2 Inscripción de comida pública | `/comida` | S10 | Con hora de corte calculada en SQL, la misma que usa la lista de cocina. |
| ✅ | (no estaba en el inventario) Acceso único | `/login` · `/auth/callback` | S4 | El inventario decía que no había login propio porque lo daba Base44. Hoy hay uno, y **el rol de la cuenta decide el portal**. Se borraron las seis puertas `/login/{portal}`: elegir puerta no concedía rol. |

---

## 3. Portal 1 — Administración

### 3.1 Dashboard y académico

| Estado | Módulo del inventario | Ruta real | Sprint | Qué hay / qué falta |
|---|---|---|---|---|
| ✅ | 1.1 Dashboard (KPIs, accesos, 2 gráficas, eventos, tareas) | `/dashboard` | S5 | Cifras por programa, **tres** gráficas, seis accesos, tareas con su dueño, proyectos y eventos. Lo financiero respeta el permiso: lo que el rol no puede ver **no se consulta**. |
| ✅ | 1.2.1 Cursos → Clases de 360 | `/academico/clases-360` | S6 · oct 2026 | Era `/academico/cursos`. Los cursos técnicos se retiraron en la `0047`; queda la parte de 360: inscritos por clase, publicar tarea o examen, revisar entregas con nota y devolución, y la **nota final** de cada inscripción, que la deja aprobada o reprobada. |
| ✅ | 1.2.2 Materias | `/academico/materias` | S6 | CRUD, búsqueda y filtro de período **en la URL** (el enlace se comparte y la lista se recorta en SQL). El profesor se elige en un campo con tres formas: nadie, usuario del sistema, o externo a mano. |
| ➖ | 1.2.3 Calificaciones | ~~`/academico/calificaciones`~~ | S6 | **Retirada en la `0047` (oct 2026).** Eran las notas por evaluación de los cursos técnicos, y su tabla `calificacion` se borró con ellos. La nota final de 360 se pone en `/academico/clases-360` con el mismo permiso, `calificaciones.registrar`; las notas universitarias siguen en `historial_calificacion`. Las bandas por peso de azul a negro (`src/lib/notas.ts`) siguen en uso. |
| ✅ | 1.2.4 Historial académico | `/academico/historial` | S6 | Una fila por estudiante con su índice **leído, nunca recalculado** (la escala de conversión cambia de un año a otro, migración 0006). Sin una línea de JavaScript de cliente. |
| ✅ | 1.2.5 Prematrícula | `/academico/prematricula` | S6 | Es el catálogo de **Global Effect 360** —todo obligatorio desde la `0047`— más las ventanas de prematrícula con fecha y hora, una por tanda. |
| ✅ | 1.2.6 Períodos | `/academico/periodos` | S6 | La raíz del módulo. Con **avisos de incoherencia** entre estado y fechas, comparados con `CURRENT_DATE` en la base y no con el reloj del navegador. |
| ✅ | (nuevo, no estaba en el inventario) Línea de tiempo | `/calendario/gantt` | S9 | Las cuatro familias sobre un mismo eje. Sin JavaScript de cliente. |

### 3.2 Academias

| Estado | Módulo del inventario | Ruta real | Sprint | Qué falta |
|---|---|---|---|---|
| ✅ | 1.3.1 Programas | `/academias/programas` | S4 / S10 | Construido el 6 de septiembre. Alta, edición y baja con filtros en la URL. Borrar exige vaciar el programa: `material.academia_id` es ON DELETE CASCADE. Los **emojis por tipo** (🎯💡📘) que pedía el inventario son iconos de `lucide-react`. Y los **participantes se teclean**: no hay tabla de inscripción a una academia, así que la cifra no se calcula, y la pantalla lo dice. |
| ✅ | 1.3.2 Materiales | `/academias/materiales` | S4 / S10 | Construido el 6 de septiembre. Agrupado por programa, con archivo (bucket privado), enlace o los dos. La descarga firma su enlace **al pulsarlo**, no al pintar la lista. |

### 3.3 Expedientes

| Estado | Módulo del inventario | Ruta real | Sprint | Qué falta |
|---|---|---|---|---|
| ✅ | 2.1–2.3 Buscador, filtros y tarjetas | `/expedientes` | S5 | Búsqueda, tipo, estado e índice acumulado desde `historial_calificacion`, vista rápida en diálogo, borrado con doble confirmación que cuenta antes lo que se llevaría. |
| ✅ | 2.7 Vista de detalle (6 pestañas) | `/expedientes/[id]` | S5 | Abre en lectura, con edición aparte. Las **seis pestañas = las seis tablas** del esquema, no el formulario plano de 70 campos que describe `docs/prototipo-base44/prompt-formulario-expediente.md`. Y son **8 estados**, no 4 (los cuatro primeros son el embudo de reclutamiento). |
| ✅ | 2.4 Alta «Nuevo Expediente» | `/expedientes` | S5 | Construido. Seis tablas en una transacción; los tres perfiles se insertan aunque vengan vacíos, para que no exista el estado intermedio de un expediente sin `perfil_vivienda`. Al guardar lleva a la ficha creada. |
| ✅ | 2.5 OCR de documentos | `/expedientes` | S7 / S11 | Construido: precarga nombre, cédula y fecha de nacimiento **con su porcentaje de confianza a la vista**, y solo en el alta —en la edición, precargar encima de lo escrito no es una ayuda—. El archivo no se guarda: va al modelo y se descarta, y queda el rastro en `extraccion_ocr`. **Responder sigue bloqueado por la clave de Anthropic (401)**, y la pantalla lo distingue de un fallo pasajero. |
| ✅ | 2.6 Subida de foto | `/perfil` y expedientes | S5 | Bucket `avatares` (público) y `documentos` (privado, con enlaces firmados de 10 minutos). No existía ninguno de los dos. |
| ✅ | 2.4.x Gráficos de la ficha (GPA 4.0, tendencia) | `/expedientes/[id]` | S5 | Construido: índice acumulado y tendencia por cuatrimestre, con el eje **fijo de 0 a 4** —con eje automático, un estudiante entre 3.6 y 3.8 dibujaría una montaña dramática— y la línea de prueba académica dibujada siempre. |

### 3.4 Patrocinadores, becas y operaciones

| Estado | Módulo del inventario | Ruta real | Sprint | Qué hay / qué falta |
|---|---|---|---|---|
| ✅ | 5.1 Lista de patrocinadores | `/patrocinadores` | S7 | Alta, edición, filtros en URL y cifras. **El aporte mensual suma solo los activos.** Sin botón de borrar: borrar dejaría becados sin origen de fondos; para retirar a alguien está `inactivo`. |
| ✅ | 5.2 Asignación de becas | `/patrocinadores/becas` | S7 | Sobre **`asignacion_beca`**, que es la fuente de verdad; `estudiante.patrocinador_id` queda como espejo. Cambiar de patrocinador **cierra** la beca anterior y la conserva. |
| ✅ | 7.1 Tareas (Kanban 3 columnas) | `/administrativo/tareas` | S9 | Arrastrar **y** botón para empujar a la siguiente (sin él, con teclado no se movería nada). Crear escribe en cuatro tablas en una transacción: `tarea`, `tarea_asignado`, `evento` y `notificacion`. Usa `tarea.visibilidad`. **El aviso no es por correo** (7.1.6 del inventario): es una fila en `notificacion`. |
| ✅ | 7.2 Proyectos | `/administrativo/proyectos` | S9 | **El avance se cuenta, no se escribe**: tareas completadas sobre tareas vivas, no la columna `progreso` (que dice 0% mientras el avance real es 33%). Las canceladas salen del denominador. |
| ✅ | 7.3 Gestión de personal | `/administrativo/personal` | S9 | Alta con contraseña temporal que se enseña una vez, cambio de rol, activar/desactivar y reinicio. La propia cuenta no se toca desde aquí. |
| ✅ | 13 Servicios mensuales | `/servicios-mensuales` | S10 | **Se guarda al marcar**, sin botón, con `ON CONFLICT DO UPDATE` sobre el `UNIQUE (estudiante_id, mes)`. La casilla **vuelve a su sitio si la escritura falla**. Impresión con clases `print:`. |
| ✅ | 14 Lista de comida (interna) | `/inscripcion-comida` | S10 | La lista con la que cocina el comedor: orden de inscripción, hora, marca de fuera de plazo, navegación por día e impresión. No escribe nada. |

### 3.5 Finanzas, informes, IA y armazón

| Estado | Módulo del inventario | Ruta real | Sprint | Qué falta |
|---|---|---|---|---|
| ✅ | 8 Contabilidad | `/contabilidad` | S7 | Construido el 6 de septiembre. Ingresos en azul de marca y egresos en negro, **ni verde ni rojo**, con el signo escrito delante. Alta, corrección y borrado con rastro en `audit_log` —el borrado guarda la fila entera antes de irse—. Todas las sumas, en SQL. |
| ✅ | 12 Reportes (3 pestañas) | `/reportes` | S11 | Construido el 6 de septiembre. Operaciones, académico y finanzas con las gráficas del panel general, que ya usan `SERIE` y `GRAFICA`. **El permiso cierra pestañas, no la puerta**: el esqueleto pedía `finanzas.leer` y dejaba fuera a coordinación, dueña de dos de las tres. |
| ✅ | 10.1 Chat IA interno | `/chat-ia` | S11 | Construido el 6 de septiembre, en la misma pantalla que el chat del estudiante. El contexto se recorta con los permisos de quien pregunta. Responder sigue bloqueado por la clave de Anthropic (401). |
| ✅ | 9 Calendario y agenda | `/calendario` | S9 | **Cuatro** vistas (mes, semana, día, lista), buscador, filtros, arrastrar para mover, alta y edición. Lo que se ve y lo que se **puede mover** dependen del rol. El estudiante ve en el suyo sus citas con administración (`cita_administracion` aprobadas o en curso). |
| ✅ | 15 Configuración | `/configuracion` | S10 | Construido: cuentas del equipo (se enumeran; gestionarlas sigue siendo `/administrativo/personal`), los seis roles con sus permisos **recorriendo la misma función que decide los accesos**, y las cifras del sistema. Los parámetros institucionales **no se pueden editar y la pantalla lo dice**: no existe tabla donde guardarlos. |
| ✅ | 16 Mapa del sitio | `/sitemap` | S10 / S6 | Construido el 6 de septiembre. Recorre `menuDe(rol)` para los seis roles, marca lo que tu cuenta puede abrir y **cuenta** los módulos compartidos: al inventario se le habían quedado tres fuera. Ni una lista escrita a mano. |
| ✅ | (no estaba en el inventario) Visor de `audit_log` | `/configuracion/auditoria` | S5 | Construido, solo `super_admin`. El `audit_log` es append-only: la 0030 no lo tocó, así que las filas históricas de citas y notas del departamento eliminado siguen ahí, y siguen saliendo sin `datos` ni `entidad_id`. |
| ✅ | (no estaba en el inventario) Solicitudes y aprobaciones | `/administrativo/solicitudes` | oct 2026 | Construido en el cambio de alcance (migraciones 0030 y 0031). Bandeja del personal: «por atender» según permisos, «mis solicitudes», alta de solicitud interna (`alta_expediente`, `beca`, `gasto`) y acciones del flujo con comentario. Flujo `enviada` → `en_revision` → [`pendiente_direccion`] → `aprobada` → `completada`, con `rechazada` (comentario obligatorio) y `cancelada`. **Nadie aprueba su propia solicitud**; el segundo nivel de dirección se fija al crear (beca siempre, gasto desde 1,000 USD); cada paso queda en `solicitud_paso`, avisa en `notificacion` y, si aprueba, rechaza o completa, en `audit_log`. Folio legible. |
| ✅ | (no estaba en el inventario) Bandeja de notificaciones | campana del armazón | — | Construida. Lista y contador en **una sola consulta**, porque se pinta en cada página interna. Pulsar un aviso lo marca leído y navega en el mismo gesto; nada se borra. |

---

## 4. Portal 2 — Estudiante

Cerrado. Es el único portal completo de punta a punta, y quedó **más grande que
el inventario**: el prototipo daba cuatro entradas, hoy hay ocho.

| Estado | Módulo del inventario | Ruta real | Nota |
|---|---|---|---|
| ✅ | 2.1 / P1 Mi portal | `/portal/estudiante` | Hasta oct 2026 distinguía universitario (`becado`) de curso técnico (`regular`). Desde la `0047` hay un solo tipo de estudiante, el becado, y la distinción desaparece. |
| ✅ | 2.2 Mis materias | `/portal/estudiante/prematricula` | Su matrícula período a período **y la elección de las del próximo**. La ventana se comprueba **dentro del INSERT**, no antes con un `if`. |
| ✅ | 2.3 Calificaciones | `/portal/estudiante/calificaciones` | Lee `historial_calificacion` (universitario) y la nota final de sus inscripciones de 360. La vía `calificacion`→`curso` del curso técnico se retiró en la `0047`. |
| ✅ | (nuevo) Global Effect 360 | `/portal/estudiante/global-360` | Todo el catálogo es obligatorio y abierto a todo estudiante (la `0047` quitó la columna `obligatoria` y el trigger de «solo becados»). Una materia por tanda, dos por cuatrimestre; una tanda abierta sin elección sale como pendiente. |
| ✅ | (nuevo) Aula virtual | `/portal/estudiante/aula-virtual` | Entrega de PDF al bucket privado; sin enlace firmado no se descarga. |
| ✅ | (nuevo) Calendario propio | `/portal/estudiante/calendario` | |
| ✅ | 10.2 Chat IA estudiantil | `/portal/estudiante/chat` | El inventario lo pone en `/chat-ia-estudiantil`; vive dentro del portal. El RAG con embeddings sobre `fragmento_conocimiento` es S11. Hoy responde «no está configurado» por el 401. |
| ✅ | 11 Solicitudes (sustituye a la cita de psicología) | `/portal/estudiante/solicitudes` | Trámites: constancia, carta, cita con administración (fecha y hora preferidas), permiso y otro. Formulario y «mis solicitudes» con folio y línea de tiempo de cada paso. Sin correo: los avisos van a `notificacion`. La cita de psicología se descartó con el departamento (oct 2026). |

---

## 5. Portales 3 a 5

### Portal 3 — Profesor (rol `docente`)

| Estado | Módulo del inventario | Ruta real | Sprint | Nota |
|---|---|---|---|---|
| ✅ | 3.1 Mi portal | `/portal/profesor` | S6 | KPIs reales y **dos** listas separadas —materias universitarias y clases de 360—, porque son dos programas distintos (la tercera, cursos técnicos, se fue con la `0047`). **No edita nada**: los formularios viven en `/academico/*`, que es donde están las comprobaciones. |
| ✅ | 3.2–3.4 Materias y clases de 360 | `/academico/materias` · `/academico/clases-360` | S6 · oct 2026 | Ve solo lo suyo; lo ajeno lo lee pero no lo toca. La nota final de 360 pide `calificaciones.registrar`. Escribir el catálogo pide `academico.escribir`, que el docente no tiene. |
| ✅ | 3.5 Calendario | `/calendario` | S9 | Ya enseña **lo que vence en sus clases** —tareas y exámenes que publicó, sobre las dos vías que puede dar, materia universitaria y clase de 360—, enlazadas por la clave del docente y nunca por su nombre (la 0019 existe por eso). |

### Portal 4 — Administrativo (rol `admin`)

| Estado | Módulo del inventario | Ruta real | Nota |
|---|---|---|---|
| ✅ | 4.1 Mi portal | `/portal/administrativo` | El inventario pedía «KPIs + 8 accesos + tareas urgentes», es decir un `/dashboard` repetido. Se construyó como otra pregunta: **lo que espera una decisión** (tareas vencidas, entregas por calificar, becados sin patrocinador, períodos incoherentes, solicitudes por atender, materias sin período — los avisos en cero no se dibujan), doce cifras, **todos los módulos derivados de `menuDe(rol)`** para que no pueda quedarse desfasado, y la actividad reciente: la primera lectura de `audit_log` del sitio. |
| — | 4.2–4.9 (módulos repetidos del Portal 1) | ver §3 | Son los mismos módulos, no copias. El estado es el de §3. |

### Portal de Psicología — descartado

Descartado — el departamento de Psicología se eliminó (oct 2026). El portal
(`/portal/psicologia`), el módulo de citas y seguimientos (`/psicologia`), las
notas de sesión, el OCR de la cita (#372) y la cita del estudiante estaban
construidos en S8; la migración `0030_fin_de_psicologia.sql` los retiró junto con
el rol y sus tablas. Las cuentas que tenían ese rol pasaron a `admin`. El
expediente es ahora de administración: `admin` y `super_admin` lo leen, editan y
borran sobre **todos** los estudiantes (se acaba el aislamiento por fila de la
0025), y `habitudes` sigue postulando candidatos. La auditoría de lectura de la
ficha (`expediente.consultado`, #428) no dependía de psicología y se queda.

### Portal 5 — Contabilidad

| Estado | Módulo del inventario | Ruta real | Sprint | Qué falta |
|---|---|---|---|---|
| ✅ | 6.1 Mi portal | `/portal/contabilidad` | S7 | Construido el 6 de septiembre: las cuatro cifras del mes en curso —contado por la base, no por el reloj de nadie— y los seis últimos movimientos. |
| ✅ | 6.2 Contabilidad | `/contabilidad` | S7 | Ver §3.5. |
| ✅ | 6.3 Reportes | `/reportes` | S11 | Ver §3.5. Contabilidad ve las tres pestañas. |

---

## 6. Lo que el inventario pide y no se va a construir

| Módulo del inventario | Decisión |
|---|---|
| ➖ CT.1 Portal selector de cursos técnicos (`/portal/cursos-tecnicos`) | **Descartado.** Era una pantalla para elegir rol, y elegir no concede rol: el rol lo da la cuenta. Con las seis puertas `/login/{portal}` se borró la misma idea. Desde oct 2026 tampoco hay cursos técnicos (migración `0047`). |
| ➖ CT.2 Portal Estudiante CT (`/portal/estudiante-ct`) | **Descartado.** Primero como ruta aparte (un portal que solo cambia el origen de las notas no es otro portal) y, desde la `0047` (oct 2026), del todo: ya no existe el estudiante de curso técnico. |
| ➖ Portal administrativo como panel duplicado | **Reinterpretado**, ver §5. |
| ➖ Envío de correo (tareas, solicitudes) | **No aplica.** No hay infraestructura de correo. Su equivalente es `notificacion`. |
| ➖ Emojis por tipo (🎯💡📘 academias, 📄🎥📊🔗 materiales, 🎓 becados) | **Sustituidos** por iconos de `lucide-react`, que es la única familia permitida. |
| ➖ Colores por significado (emerald/yellow/red en notas, naranja en tareas del calendario, banner por rol) | **Sustituidos por peso.** Lo que distinguía por matiz distingue por peso de azul a negro. Eran 311 usos fuera de marca en 48 archivos. Única excepción: `SEMAFORO`, y solo para el estado de una entidad. |
| ➖ `RoleContext.jsx` y control de acceso en el cliente | **No aplica.** Cada layout valida contra la base. |
| ➖ Portal de Psicología, citas, notas de sesión y cita del estudiante | **Descartada — el departamento de Psicología se eliminó (oct 2026).** Estaba construido (S8); la migración 0030 lo retiró. Ver §5. |

---

## 7. Entidades: las 15 del inventario contra las 43 tablas

El inventario cuenta 15 entidades planas. El esquema tiene 43 tablas porque tres
de esas entidades estaban haciendo demasiado:

| Entidad del inventario | En la base |
|---|---|
| `Estudiante` | `estudiante` + `perfil_vivienda` + `perfil_salud` + `perfil_socioeconomico` + `familiar` + `seguimiento` — las **seis pestañas** de la ficha. |
| `Calificacion` | `historial_calificacion` (universitario, con letra e índice **guardados**) y `inscripcion_360.nota` (nota final de 360). La tabla `calificacion` del curso técnico se borró en la `0047`. |
| `Patrocinador` | `patrocinador` + `asignacion_beca` (monto, fechas y estado propios, con histórico). |
| `Tarea` | `tarea` + `tarea_asignado` + `notificacion`. |
| `Materia` | `materia` (universitaria) y `materia_360` (programa 360) — dos cosas, no una. Hubo una tercera, `curso` (técnico), retirada en la `0047`. |
| — | Más `periodo`, `inscripcion`, `inscripcion_360`, `rol`, `permiso`, `rol_permiso`, `usuario`, `audit_log`, `landing_slide`, `fragmento_conocimiento`, `solicitud`/`solicitud_paso`, `asignacion`/`entrega` del aula virtual, y el resto. |

---

## 8. Resumen del cruce

De todo lo que piden los dos inventarios:

| | Cuenta |
|---|---|
| ✅ Construido y funcional | 35 módulos, más la campana del armazón |
| 🟡 Esqueleto (ruta y permiso, sin construir) | **0.** Los siete se construyeron el 6 de septiembre |
| 🟡 Incompleto, pero no esqueleto | **0.** Configuración se cerró en la segunda sesión del 6 de septiembre |
| ⬜ Falta la pantalla | **0.** Alta de expediente, el OCR de expedientes, el visor de `audit_log`, solicitudes y aprobaciones, la bandeja de avisos, el gráfico de la ficha y el calendario del docente están construidos |
| ➖ Descartado o reinterpretado | 8 puntos, §6 |
| **Ninguna ruta del menú da 404** | 37 rutas declaradas en `nav.ts`, 37 con página (salen las tres de psicología, entran las dos de solicitudes) |

Lo que queda no son pantallas, son **decisiones y una clave**, y están en
[`docs/estado/pendientes.md`](pendientes.md):

1. **La clave de Anthropic devuelve 401.** El chat y el lector de
   documentos están construidos y no pueden responder. Las pantallas lo
   distinguen de un fallo pasajero y dicen a quién avisar.
2. **No hay proyecto de Supabase**, así que no se puede entrar: todo lo de esta
   sesión está comprobado contra el PostgreSQL local y con `ROLLBACK`, no en el
   navegador con sesión real.
3. **El rol `habitudes` no llega a ninguna parte**: su única entrada de menú
   pide `expedientes.postular` y la pantalla exige `expedientes.leer`. Hay que
   decidir qué ve —presumiblemente solo el embudo—, y eso es un WHERE.
4. **Si los escaneos se guardan o no.** Hoy no: el archivo va al modelo y se
   descarta, y queda el rastro en `extraccion_ocr`.
5. **Si los parámetros institucionales se centralizan**, que hoy no existen
   como tabla.

Y lo que el inventario **no pedía** y existe: la línea de tiempo (`/calendario/gantt`),
el panel de anuncios del inicio (`/configuracion/landing`), el perfil editable
(`/perfil`), Global Effect 360 y el aula virtual del estudiante, el acceso único
(`/login`), Solicitudes y aprobaciones, y los roles `super_admin` y `habitudes`.

Los tres bloqueos que no se resuelven escribiendo código están en
[`docs/estado/pendientes.md`](pendientes.md): la clave de Anthropic devuelve 401 (chat y OCR),
el proyecto de Supabase original ya no existe (no se puede entrar en local), y
los dos períodos del seed están desfasados (cada nota que se registre cae en el
cuatrimestre equivocado).
