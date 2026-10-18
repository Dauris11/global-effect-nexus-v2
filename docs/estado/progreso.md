# Progreso — Global Effect Nexus

Estado real de cada pantalla del sistema, a **4 de octubre de 2026**.

> **Cambio de alcance (3 oct 2026).** La Fundación cerró el departamento de
> Psicología y todo lo que hacía pasó a administración. El sistema se describe
> ahora como un **ERP institucional** —gestión académica, expedientes,
> patrocinio, operaciones, finanzas y solicitudes— con el portal del estudiante
> integrado. La migración `0030` retiró el rol `psicologo`, los permisos
> `psicologia.*`, las tres tablas clínicas y `estudiante.psicologo_id`, y
> devolvió el expediente entero a `admin` y `super_admin`. La `0031` añadió
> **Solicitudes y aprobaciones**, que sustituye a la cita de psicología. Los
> eventos, el calendario y todo lo demás siguen igual.

Este documento no sustituye al plan: el cronograma está en
[`docs/05-plan-de-trabajo.md`](../05-plan-de-trabajo.md) y las 527 subtareas en
[`docs/fuentes-datos/sprints-clickup.csv`](../fuentes-datos/sprints-clickup.csv),
que sigue siendo la definición de "hecho". Lo que hay aquí es la otra mitad: qué
está construido de verdad, qué es solo una pantalla que evita un 404 y qué falta
dentro de lo que ya parece terminado.

Los tres estados:

| | Significado |
|---|---|
| ✅ | **Funcional.** Consulta la base, escribe si le toca, y su pantalla es la definitiva. |
| 🟡 | **Esqueleto.** La ruta existe y cierra su permiso, pero avisa de que el módulo no está construido. Sirve para que el menú no lleve a ninguna parte. |
| ⬜ | **Pendiente.** Ni siquiera la ruta. Hoy no queda ninguna así entre las que declara el menú. |

Para comprobar que esta tabla no ha quedado vieja, las rutas del menú se pueden
cruzar con las páginas que existen:

```sh
grep -o 'href: "[^"]*"' src/lib/nav.ts | sort -u   # lo que ofrece la barra lateral
find 'src/app/[locale]' -name page.tsx             # lo que existe de verdad
```

---

## Cuadro general

Las 37 rutas que declara `src/lib/nav.ts` tienen página, más la landing pública,
la inscripción de comida, el acceso y el retorno de OAuth. **Ninguna da
404.**

| Estado | Rutas |
|---|---:|
| ✅ Funcional | 44 páginas + el retorno de OAuth |
| 🟡 Esqueleto | **0** |
| ⬜ Sin ruta | 0 |

**No queda ningún esqueleto.** Los siete que había —academias (programas y
materiales), contabilidad, el portal de contabilidad, reportes, chat IA interno
y el mapa del sitio— se construyeron el 6 de septiembre, y con ellos el
componente `EnConstruccion` se quedó sin un solo uso (ver la deuda del final).

**Y no queda ningún módulo a medias.** Lo que el inventario daba por pendiente
—el alta de expediente, el OCR, el
visor de `audit_log`, la bandeja de avisos, el gráfico de la ficha, la
configuración y el calendario del docente— se construyó en la segunda sesión
del 6 de septiembre. Las dos rutas nuevas son `/configuracion/auditoria` y la
campana del armazón, que no es una ruta sino parte de la cabecera.

El recuento de esqueletos ha ido bajando así: 18 en `be502ff`, 7 tras cerrar el
Sprint 1 (materias, períodos, calificaciones, historial y el portal del
profesor) y los módulos de operaciones y patrocinio, y **0** desde el 6 de
septiembre.

El recuento sale del código, no de esta tabla:

```sh
grep -rl EnConstruccion 'src/app/[locale]' | wc -l   # esqueletos
find 'src/app/[locale]' -name page.tsx | wc -l       # total
```

---

## Público y acceso

| Estado | Pantalla | Ruta | Sprint |
|---|---|---|---|
| ✅ | Landing pública (hero editable, franja de acceso con cifras y estado del comedor, programas, dónde estamos, patrocinadores, eventos, noticias, preguntas y cierre) | `/` · `/en` | S10 |
| ✅ | Inscripción de comida, sin cuenta | `/comida` | S10 |
| ✅ | Acceso único; el rol de la cuenta decide el portal | `/login` | S4 |
| ✅ | Retorno de OAuth | `/auth/callback` | S4 |

---

## Portal 1 — Administración

| Estado | Módulo | Ruta | Sprint | Qué falta |
|---|---|---|---|---|
| ✅ | **Dashboard** | `/dashboard` | S5 | Cifras por programa (universitarios, técnicos, cursos), proyectos y tareas abiertas, tres gráficas, seis accesos rápidos, tareas con su dueño y su proyecto o evento, proyectos en marcha y próximos eventos. Lo financiero respeta el permiso: lo que el rol no puede ver, **no se consulta** |
| ✅ | **Cursos técnicos y clases de 360** | `/academico/cursos` | S6 | Alta, edición y borrado de cursos; estudiantes por curso con su promedio y su cumplimiento de tareas; publicar tarea o examen; y revisar entregas con nota y devolución. El docente ve **solo lo suyo** y administración todo, con la misma condición dentro de cada WHERE |
| ✅ | **Materias** | `/academico/materias` | S6 | Catálogo completo de las materias universitarias: alta, edición y baja, búsqueda por nombre/código/profesor y filtro por período, los dos **en la URL** para que el enlace se comparta y la lista se recorte en SQL. El profesor se elige en un solo campo con tres formas —nadie, usuario del sistema, o externo con el nombre a mano—; el nombre del usuario lo copia el servidor desde `usuario`, no el formulario |
| ✅ | **Calificaciones** | `/academico/calificaciones` | S6 | Notas por evaluación de los cursos técnicos: registrar, corregir y borrar, con búsqueda y filtro de período en la URL. Distribución por banda y cifras calculadas sobre la tabla entera, no sobre las 500 filas que se pintan. El docente solo toca las de **sus** cursos —resuelto en el SQL fila a fila y comprobado otra vez dentro de cada acción—; coordinación entra y lee pero **no pone notas**, porque `admin` no tiene `calificaciones.registrar` |
| ✅ | **Historial académico** | `/academico/historial` | S6 | Una fila por estudiante con su índice acumulado, cómo cerró y el detalle de sus materias, que se pide solo del que se abre. El índice se lee guardado, **nunca se recalcula** desde la nota (0006: la escala de conversión cambia de un año a otro). **Sin una línea de JavaScript de cliente**: no escribe nada, así que buscar, filtrar y abrir el detalle son un `form method="get"` y dos enlaces |
| ✅ | **Global Effect 360** | `/academico/prematricula` | S6 | Catálogo del programa (obligatorias y opcionales) y ventanas de prematrícula con fecha y hora. El anuncio sale solo en la cabecera del becado |
| ✅ | **Períodos** | `/academico/periodos` | S6 | La raíz del módulo: materias, cursos y matrícula cuelgan de aquí. Alta, edición y baja con lo que cuelga de cada uno, y **avisos de incoherencia** entre estado y fechas —un período `activo` que ya terminó sigue recibiendo notas como si fuera el cuatrimestre en curso—, comparados con `CURRENT_DATE` en la base y no con el reloj del navegador |
| ✅ | **Programas de academias** | `/academias/programas` | S10 | Catálogo de los programas extracurriculares: alta, edición y baja, con filtros de nombre/facilitador, tipo y estado **en la URL**. Borrar exige vaciar el programa primero: `material.academia_id` es ON DELETE CASCADE y el borrado se llevaría sus guías en silencio, así que el diálogo dice cuántas hay y propone marcarlo `inactiva`. Los **participantes se teclean y la pantalla lo dice**: no hay tabla de inscripción a una academia, así que no hay de dónde contarlos |
| ✅ | **Materiales de academias** | `/academias/materiales` | S10 | Repositorio agrupado por programa, con archivo, enlace o los dos. Los archivos van al bucket **privado** (el mismo de las entregas) y **la descarga no es un enlace pintado, es un botón**: firmar 300 enlaces por visita para los que nadie va a pulsar sale carísimo, y un enlace firmado al pintar sigue valiendo diez minutos después de retirarle el acceso a esa cuenta. Se firma uno, al pulsarlo, comprobando el permiso en ese momento. Borrar un material se lleva también su archivo del almacén |
| ✅ | **Expedientes** | `/expedientes` · `/expedientes/[id]` | S5 | **Lista, filtros y ficha funcionan**: búsqueda, tipo, estado e índice acumulado desde `historial_calificacion`; vista rápida en diálogo desde la tarjeta; ficha completa que abre en modo lectura, con edición aparte y borrado con doble confirmación que cuenta antes lo que se llevaría por delante. **El alta ya guarda**: escribe en las seis tablas dentro de una transacción y, al terminar, lleva a la ficha recién creada —después de rellenar setenta campos, lo que hace falta es ver el expediente que ha quedado—. Los tres perfiles se insertan aunque vengan vacíos, para que no exista el estado intermedio de un expediente sin `perfil_vivienda`. **El lector de documento** precarga nombre, cédula y fecha de nacimiento con su porcentaje de confianza a la vista, y solo en el alta: en la edición, precargar encima de lo escrito no es una ayuda. Y la ficha ya tiene su **gráfico de tendencia**, con el eje fijo de 0 a 4 y la línea de prueba académica dibujada siempre |
| ✅ | **Patrocinadores** | `/patrocinadores` | S7 | Directorio con alta, edición, filtros en URL (nombre/país, tipo, estado) y cifras agregadas. **El aporte mensual suma solo los activos**: un inactivo conserva su monto como histórico pero ya no aporta. Sin botón de borrar: `estudiante.patrocinador_id` cae a NULL y `asignacion_beca` va en cascada, así que borrar dejaría becados sin origen de fondos — para retirar a alguien está `inactivo` |
| ✅ | **Becas** | `/patrocinadores/becas` | S7 | Vinculación becado ↔ patrocinador sobre **`asignacion_beca`**, que pasa a ser la fuente de verdad (monto, fechas y estado propios); `estudiante.patrocinador_id` queda como espejo sincronizado en la misma transacción. Cambiar de patrocinador **cierra** la beca anterior con la fecha de hoy y la conserva en el histórico, no la borra |
| ✅ | **Tareas** | `/administrativo/tareas` | S9 | Tablero de tres columnas con arrastrar para mover **y** un botón que empuja a la siguiente (sin él, con teclado no se podría mover nada). Crear una tarea escribe en cuatro tablas **en una transacción**: `tarea`, `tarea_asignado`, `evento` (si tiene fecha) y `notificacion`. Es la primera pantalla que usa `tarea.visibilidad`: `todos` la ve cualquiera con `operaciones.leer`, `asignados` solo quien la lleva, y con `operaciones.escribir` se ven todas |
| ✅ | **Proyectos** | `/administrativo/proyectos` | S9 | Alta, edición y avance. **El avance se cuenta, no se escribe**: tareas completadas sobre tareas vivas del proyecto, no la columna `progreso` (que en la base dice 0% mientras el avance real es 33% y 25%). Las canceladas salen del denominador, así que cancelar una tarea nunca baja el avance. Sin botón de borrar: `tarea.proyecto_id` es ON DELETE SET NULL y borrar dejaría las tareas sueltas — para retirar una iniciativa está `pausado` o `completado` |
| ✅ | **Personal** | `/administrativo/personal` | S9 | Alta de cuentas con contraseña temporal que se enseña una sola vez, cambio de rol, activar y desactivar, y reinicio de acceso. La propia cuenta no se puede tocar desde aquí |
| ✅ | **Servicios mensuales** | `/servicios-mensuales` | S10 | Planilla del mes con una fila por estudiante activo y dos casillas. **Se guarda al marcar**, sin botón, con `ON CONFLICT DO UPDATE` sobre el `UNIQUE (estudiante_id, mes)`: una casilla, una escritura. La casilla **vuelve a su sitio si la escritura falla** — una marcada que no se guardó miente. La fila se crea al marcar: no se rellena la tabla con registros en blanco. Hoja de impresión con clases `print:` sobre la misma pantalla |
| ✅ | **Lista de comida** | `/inscripcion-comida` | S10 | La lista con la que cocina el comedor: comensales por orden de inscripción, con su hora y marca de fuera de plazo. Navegación por día y hoja de impresión. **La hora de corte no se repite**: sale del mismo SQL que ya usan `/comida` y la acción de inscripción. No escribe nada — quitar o añadir a mano sería otra decisión, no una casilla más |
| ✅ | **Contabilidad** | `/contabilidad` | S7 | Movimientos con alta, corrección y borrado, filtros de concepto/referencia, tipo, categoría y mes en la URL, y reparto por categoría. **Todas las sumas se hacen en SQL**: `monto` es NUMERIC y `pg` lo entrega como texto para no perder precisión, así que el `::float8` va siempre DESPUÉS del `sum()`. Las cifras se calculan sobre el conjunto filtrado entero y no sobre las 200 filas que se pintan. El selector de mes sale de **los meses que tienen movimientos**, no de los últimos doce. Ni verde ni rojo: azul lo que entra, negro lo que sale, y el signo escrito delante, que es lo único que sobrevive a una impresión en blanco y negro. **Sí hay borrado**, al contrario que en patrocinadores o proyectos: un movimiento no tiene estado al que retirarse y un duplicado seguiría sumando; la fila se guarda entera en `audit_log` antes de irse |
| ✅ | **Reportes** | `/reportes` | S11 | Tres pestañas —operaciones, académico y finanzas— con las gráficas del panel general, reutilizadas tal cual. **El permiso cierra pestañas, no la puerta**: el esqueleto pedía `finanzas.leer`, que `admin` no tiene, así que coordinación no podía ver un informe de su propio trabajo; ahora entra quien tenga cualquiera de los tres permisos de lectura y ve solo sus pestañas. La pestaña va en la URL —un informe se comparte con quien decide— y **solo se consulta la pestaña que se está viendo**. Un proyecto sin tareas no sale en el avance: su avance no es 0%, es que aún no se sabe |
| ✅ | **Chat IA interno** | `/chat-ia` | S11 | La misma pantalla que el chat del estudiante, con otra acción y otro contexto. El resto del contexto se recorta con los permisos de quien pregunta —las finanzas solo con `finanzas.leer`— llamando a las mismas consultas que alimentan sus pantallas, y **todo son agregados**: ni un nombre, ni un expediente. Sigue bloqueado por la clave de Anthropic (401) |
| ✅ | **Calendario** | `/calendario` | S9 | Cuatro vistas (mes, semana, día, lista), buscador, filtros por origen y por tipo, arrastrar para mover, y alta y edición de eventos en diálogo. Lo que se ve depende del rol — eventos para todos, tareas solo las propias, y **las citas con administración solo para quien las atiende** (`solicitudes.gestionar`). Lo que se puede MOVER también: un evento pide `operaciones.escribir`; una cita, `solicitudes.gestionar`, y moverla deja un paso en su solicitud y avisa al estudiante; una tarea no se mueve |
| ✅ | **Línea de tiempo (Gantt)** | `/calendario/gantt` | S9 | Las cuatro familias sobre un mismo eje: períodos y materias, tareas y entregas, proyectos y tareas administrativas, y cursos técnicos con clases de 360. Dos tramos: por período, o **autoajustado a los datos** (sin ninguna ventana inventada). Va aparte del calendario y **sin JavaScript de cliente**. Dice en voz alta lo que el esquema no da: materias y cursos no tienen fechas propias, y `materia_360` no tiene ni fechas ni período — su barra se deduce de las inscripciones |
| ✅ | **Anuncios del inicio** | `/configuracion/landing` | S10 | Alta, edición, orden, mostrar/ocultar y borrado de las diapositivas del hero, con vista previa y rastro en `audit_log`. Cierra con `landing.administrar` |
| ✅ | **Configuración** | `/configuracion` | S10 | Los ajustes que llevan a otra pantalla, las cuentas del equipo (se enumeran; gestionarlas es `/administrativo/personal`, y desde aquí se enlaza), y los **siete roles con sus permisos reales**, recorriendo la misma función que decide los accesos —así esta tabla no puede contradecir al sistema—. Los parámetros institucionales **no se pueden editar y la pantalla lo dice**: no existe tabla donde guardarlos, así que un formulario aquí escribiría en el aire |
| ✅ | **Registro de auditoría** | `/configuracion/auditoria` | S5 | Cierra la deuda más vieja: `audit_log` se escribía desde siete módulos y no había forma de leerlo salvo por SQL. Filtros de acción, entidad, cuenta y fechas en la URL, paginado en dos enlaces, sin JavaScript. Solo `super_admin`. **El historial clínico no se enseña**: las filas del antiguo módulo de psicología, anteriores a la `0030`, salen con su acción, su autor y su hora, sin `datos` ni `entidad_id` —el recorte lo hace el `CASE` del SELECT—. La `0030` borró las tablas por decisión de la Fundación, y un visor que enseñara su rastro sería devolverlas por la puerta de atrás |
| ✅ | **Mapa del sitio** | `/sitemap` | S10 | Los siete roles con sus áreas, sus módulos, la ruta y el permiso de cada uno. **No lleva ninguna lista escrita a mano**: recorre `menuDe(rol)`, el mismo menú de la barra lateral, así que un módulo nuevo aparece solo. Marca lo que la cuenta que mira puede abrir —y solo enlaza eso— y **cuenta** los módulos compartidos en vez de enumerarlos (al inventario se le habían quedado tres fuera). Sin JavaScript de cliente |

---

## Portal 2 — Estudiante

Cerrado. Es el único portal completo de punta a punta.

| Estado | Módulo | Ruta | Qué falta |
|---|---|---|---|
| ✅ | Mi portal | `/portal/estudiante` | — |
| ✅ | **Mis materias** | `/portal/estudiante/prematricula` | Su matrícula período a período **y la elección de las del próximo**: dentro de la ventana de prematrícula el becado se inscribe y se quita él mismo. Fuera de la ventana vuelve a ser solo lectura. La ventana se comprueba **dentro del INSERT**, no antes con un `if` |
| ✅ | Calificaciones | `/portal/estudiante/calificaciones` | — |
| ✅ | **Global Effect 360** | `/portal/estudiante/global-360` | Materias dadas y por dar, avance de obligatorias y opcionales, y prematrícula desde la propia pantalla cuando la ventana está abierta. Solo para becados: la base lo impone con un trigger |
| ✅ | Aula virtual | `/portal/estudiante/aula-virtual` | **Entrega de PDF funcionando**: sube al bucket privado y pasa a revisión del profesor. Probado de punta a punta, incluido que sin enlace firmado no se descarga |
| ✅ | Calendario | `/portal/estudiante/calendario` | — |
| ✅ | Chat IA | `/portal/estudiante/chat` | Funciona con el contexto académico del propio estudiante. El RAG con embeddings sobre `fragmento_conocimiento` es **S11**. Hoy la clave de Anthropic de `.env.local` es inválida (401), así que responde "no está configurado" |
| ✅ | **Mis solicitudes** | `/portal/estudiante/solicitudes` | Constancia, carta, cita con administración, permiso u otro trámite. Una solicitud abierta por tipo, la ficha sale de la sesión, y la línea de tiempo enseña cada paso con quién lo dio. Solo puede cancelar mientras nadie la haya decidido. Sustituye a la cita de psicología |

---

## Portal 3 — Profesor

| Estado | Módulo | Ruta | Sprint | Qué falta |
|---|---|---|---|---|
| ✅ | **Mi portal** | `/portal/profesor` | S6 | KPIs reales (cursos activos, estudiantes, notas registradas y entregas por revisar) y tres listas separadas —cursos técnicos, materias universitarias a su nombre y clases de 360—, porque son tres programas distintos. **No edita nada**: registrar, publicar tarea y revisar viven en `/academico/*`, que es donde están los formularios con sus comprobaciones |
| ✅ | Cursos técnicos y clases de 360 | `/academico/cursos` | S6 | Ve **solo lo suyo**; administración ve todo |
| ✅ | Materias y períodos | `/academico/materias` · `/academico/periodos` | S6 | Los lee con `academico.leer`; escribirlos pide `academico.escribir`, que el docente no tiene |
| ✅ | Calificaciones | `/academico/calificaciones` | S6 | Registra las de sus cursos; las ajenas las ve pero no las toca |
| ✅ | **Calendario** | `/calendario` | S9 | Ya enseña **lo que vence en sus clases**: las tareas y exámenes que publicó, sobre las tres vías que puede dar —materia universitaria, curso técnico y clase de 360—, enlazadas por la clave del docente y nunca por su nombre (la 0019 existe por eso). Antes solo veía actos institucionales y tareas administrativas, así que abría el calendario, no encontraba nada suyo y no volvía |

---

## Portal 4 — Administrativo

«Administrativo» **es el rol `admin`**: no hay un rol aparte con ese nombre. Y su
portal no es un panel de operaciones más — es donde **converge todo el sistema**,
absorbiendo lo que pasa en los otros portales.

| Estado | Módulo | Ruta | Qué lleva |
|---|---|---|---|
| ✅ | **Mi portal** | `/portal/administrativo` | Cuatro bloques, en este orden: **lo que espera una decisión** (tareas urgentes y vencidas, entregas por calificar, becados sin patrocinador, períodos incoherentes, solicitudes esperando **tu** decisión, materias sin período — cada aviso enlaza a donde se resuelve, y los que están en cero no se dibujan); **doce cifras** de todos los módulos; **todos los módulos** derivados de `menuDe(rol)`, el mismo menú de la barra lateral, así que no puede quedarse desfasada; y **la actividad reciente**, que es la primera lectura de `audit_log` que existe en el sitio |

| ✅ | **Solicitudes y aprobaciones** | `/administrativo/solicitudes` | Una bandeja para todo el personal: **por atender** (lo que espera una decisión suya, nunca lo que pidió él), **pedir** (alta de expediente, beca, gasto o rendición de factura con NCF, según su rol), **mis solicitudes** y **resueltas por mí**. Flujo `enviada → en_revision → [pendiente_direccion] → aprobada → completada`, con rechazo comentado y cancelación del solicitante. La beca y el gasto desde 1.000 USD pasan por dirección (`solicitudes.direccion`, solo `super_admin`); el gasto lo revisa contabilidad. Cada paso va en una transacción con su línea en `solicitud_paso` y su aviso, y lleva el estado anterior en el WHERE para que dos revisores a la vez no aprueben dos veces. Probado de punta a punta contra PostgreSQL local (52 comprobaciones) |
| ✅ | Expedientes | `/expedientes` | Desde la `0030` lo lleva administración entero: `admin` y `super_admin` leen, escriben y borran cualquier ficha. Se acabó el aislamiento por fila de la `0025`. Un expediente con solicitudes no se borra (`ON DELETE RESTRICT`) |
| ✅ | **Torre de Control del Colaborador** | `/administrativo/tareas/hoy` | Centro operativo diario ("Lo que me toca hoy") con tareas de hoy, vencidas y pendientes; 4 estados de avance táctiles (`por_hacer`, `en_progreso`, `en_revision`, `completada`), bitácora diaria de horas y actividades (`colaborador_bitacora_diaria`), métricas en cabecera y autoasignación de tareas prioritarias (migración `0041`) |
| ✅ | **Inventario Físico con Códigos QR (Módulo 30)** | `/administrativo/inventario`, `/administrativo/inventario/escanear` | Registro de activos institucionales y Casa de Herramientas, fotografías, estado y ubicación física, generación e impresión de etiquetas con Códigos QR de alta resolución, y escáner de cámara in situ con actas de auditoría física (migración `0040`) |
| ✅ | **Rendición de Gastos y Facturas con OCR** | `/administrativo/rendiciones` | Carga de comprobantes por colaboradores con foto y escaneo inteligente de OCR (detección de NCF, RNC, proveedor, ITBIS y total), imputación a programas sociales y validación/aprobación fiscal para Contabilidad ante DGII |
| ✅ | **Gobernanza de Proyectos por Rol (Superadmin)** | `/administrativo/proyectos/roles` | Matriz institucional de asignación de programas sociales y proyectos a roles (`admin`, `docente`, `contabilidad`, `habitudes`), gobernada de manera centralizada y exclusiva por el `super_admin` con sincronización en tiempo real |

`/dashboard` se queda como la pantalla de gráficas: es otra pregunta y tiene su
propia entrada en el menú, debajo del portal.

---

## Portal 5 — Agenda de Reuniones Institucionales (Sustituye a Psicología)

El departamento de Psicología se retiró en octubre de 2026. Las antiguas agendas
de citas se convierten en una **Agenda de Reuniones Institucionales para todo el
personal**, donde cualquier colaborador o estudiante (tutorías, asesorías, seguimiento)
puede agendar y coordinar reuniones de trabajo, extinguiendo por completo el enfoque clínico.

---

## Portal 6 — Contabilidad

| Estado | Módulo | Ruta | Sprint | Qué falta |
|---|---|---|---|---|
> **Portal nuevo en construcción por fases** (`docs/prompts/portal-contabilidad.md`).
> Fase 1 (cimientos: esquema `contabilidad`, bitácora con cadena de hash,
> permisos por persona), Fase 2 (bancos, recibos, conciliación), Fase 3
> (proveedores, cuentas por pagar y cronograma Gantt de vencimientos) y Fase 4
> (cajas, arqueos por denominación DOP/USD, reposición bancaria, OCR de facturas
> con asignación a programas y personas, y exportaciones Excel .xlsx) completadas.
> Las fases 5 a 9 (nómina, presupuestos, reportes avanzados, visor del auditor) siguen en cola.

| ✅ | **Inicio** | `/portal/contabilidad` | Fase 2 | Saldo por cuenta en su moneda y su equivalente en pesos con la tasa del día (el total en pesos solo sale si **todas** las cuentas tienen equivalente), borradores por contabilizar y recibos recientes. La puerta es `contabilidad.leer`: `super_admin` mira y no ve ningún botón que escriba. Cuentas por pagar, cajas, presupuestos y calendario fiscal llegan con sus fases |
| ✅ | **Bancos y libros** | `/contabilidad/bancos`, `/contabilidad/bancos/[cuenta]` | Fase 2 | Santa Cruz USD y DOP (números DEMO). Libro con **saldo corrido calculado sobre toda la historia** y recortado al rango, totales del rango y anulados tachados. Transferencia entre cuentas propias con tasa aplicada y **diferencia cambiaria** contra la tasa de referencia del día. Tasa del día (compra/venta, BCRD). Exportación a Excel (.xlsx) |
| ✅ | **Conciliación** | `/contabilidad/bancos/[cuenta]/conciliacion` | Fase 2 | Importa el estado de cuenta en **CSV o Excel (.xlsx)** con las columnas del banco (precargadas desde `banco.config_estado`), propone parejas por importe, fecha ±3 días y referencia, el contable confirma o descarta y el reporte cuadra banco ajustado contra libros ajustado. Cerrar bloquea los movimientos |
| ✅ | **Recibos** | `/contabilidad/recibos` | Fase 2 | Ingresos (RI) y egresos (CE) en una consulta con todos los filtros de §4.3 en la URL, totales por tipo y moneda sobre el filtro entero, exportación CSV (queda en la bitácora). Borrador → contabilizado (movimiento + asiento en una transacción de la base) → anulado con motivo y contra-asiento. **Quien registra no aprueba**, salvo que sea la única cuenta con `aprobar` (queda dicho en la bitácora). Adjuntos en el bucket privado `contabilidad` con sha256. Recibo imprimible con monto en letras, firmas y QR |
| ✅ | **Proveedores y CxP** | `/contabilidad/proveedores`, `/contabilidad/cuentas-por-pagar`, `/contabilidad/cuentas-por-pagar/gantt`, `/contabilidad/facturas/[id]` | Fase 3 | Proveedores con validación de RNC/cédula DGII, registro de facturas con OCR inteligente (extracción automática de RNC, NCF B01/E31, montos, ITBIS y retenciones con score de confianza), asignación doble a solicitante y programa institucional, cronograma interactivo Gantt de vencimientos, aging de cuentas por pagar y exportación oficial de reporte DGII 606 y CxP a Excel |
| ✅ | **Cajas y Arqueos** | `/contabilidad/cajas`, `/contabilidad/cajas/[id]`, `/contabilidad/cajas/[id]/arqueo` | Fase 4 | Cajas chicas y operativas por persona o departamento, registro de entradas y salidas de efectivo, reposición automática desde banco (`contabilidad.reponer_caja`), contador interactivo de arqueo por denominación física (billetes RD$2000-50, monedas RD$25-1 y USD), cálculo en tiempo real de faltante/sobrante y disparo automático de alertas antifraude (`diferencia_caja`) cuando el descuadre supere RD$200 |
| ✅ | Contabilidad | `/contabilidad` | Fase 2 | Redirige al inicio: la pantalla de transacciones de la 0011 se retiró y `transaccion` es ahora una vista de solo lectura sobre los recibos |
| ✅ | Reportes | `/reportes` | S11 | Ver el Portal 1. Contabilidad ve las tres pestañas |

---

## Compartidos por todos los portales

| Estado | Módulo | Ruta | Qué falta |
|---|---|---|---|
| ✅ | Mi perfil | `/perfil` | Cada usuario edita sus propios datos y su foto, que se ve en todo el armazón |

---

## Transversal

| Estado | Qué | Notas |
|---|---|---|
| ✅ | Base de datos | 31 migraciones, 43 tablas (la `0030` quitó tres y la `0031` añadió dos). `npm run db:migrate` es idempotente. El proyecto de Supabase donde estaban aplicadas ya no existe, así que hoy la base corre en local (ver la deuda de abajo) |
| ✅ | Autenticación y RBAC | Supabase Auth + tabla `usuario`; 6 roles y 19 permisos (la `0030` quitó `psicologo` y `psicologia.*`; la `0031` añadió `solicitudes.gestionar` y `solicitudes.direccion`). Cada layout valida contra la base, no en el proxy |
| ✅ | i18n | 1945 claves, español e inglés simétricos. `npm run i18n:check` lo verifica en cada cambio |
| ✅ | **Color de marca** | Azul claro, azul oscuro, blanco y negro. Nada más, en ningún sitio. `src/lib/paleta.ts` es la fuente única y `docs/09-sistema-visual.md` lo fija como regla dura, con la orden que lo comprueba |
| ✅ | **Auditoría** | Se escribe desde las decisiones de solicitudes, los anuncios del inicio, el alta, el borrado y ahora la **lectura** de expedientes, el catálogo académico, contabilidad y academias— y **ya se puede leer**: `/configuracion/auditoria`, solo para `super_admin` y con el historial clínico tapado en el propio SELECT |
| ✅ | **Notificaciones** | Se escriben al asignar una tarea y en cada paso de una solicitud (a los revisores al crearla, a dirección cuando le toca, al solicitante en cada cambio), y **ya se leen**: campana en la barra superior, con el número de las no leídas, las no leídas primero y marcado individual o en bloque. Lista y contador salen de **una sola consulta** (`count(...) FILTER (WHERE NOT leida) OVER ()`), porque se pintan en cada página interna. Nada se borra: un aviso es el rastro de que a alguien se le dijo algo. Sigue sin haber correo, y sigue sin hacer falta |
| ✅ | Storage | `avatares` (público, fotos de perfil) y `documentos` (privado, entregas y fichas escaneadas). No existía ninguno: el entorno nombraba uno y el proyecto estaba vacío. Las entregas se sirven con enlaces firmados de diez minutos |
| ⬜ | Pruebas y seguridad | S12 |
| ⬜ | Despliegue | S13 |

---

## Cómo revisarlo

El proyecto de Supabase ya no existe, así que la base corre en un PostgreSQL
local (17, el mismo mayor que usaba Supabase). Lo que hace falta en la máquina:

```sh
brew install pgvector      # lo único que pedía la 0001 y no estaba
createdb global_effect
```

Las migraciones dan por hecho el esquema `auth` que Supabase trae de fábrica —la
0014 cuelga una clave ajena de `usuario.auth_user_id` sobre `auth.users`—, así
que antes de migrar hay que crear en local ese esquema con las tres columnas que
las migraciones tocan (`id`, `email`, `raw_user_meta_data`). Con eso, las 29
migraciones se aplican **tal cual, sin editar ninguna**.

`npm run dev` lee `.env.development.local` antes que `.env.local`, así que la
conexión local se pone ahí y el archivo con las credenciales de Supabase no se
toca. Los scripts de `db:*` sí cargan `.env.local` a propósito, y necesitan la
variable delante:

```sh
export DATABASE_URL="postgresql://<usuario>@localhost:5432/global_effect"
npm run db:migrate            # las 31 migraciones, en orden e idempotentes
npm run db:seed               # roles, permisos y el admin maestro
npm run db:seed:operaciones   # proyectos, tareas y eventos
npm run db:seed:portales      # el expediente de Yeimy y sus solicitudes
npm run dev                   # http://localhost:3000
```

`npm run db:seed:usuarios` es el único que no corre en local: además de la fila
en `usuario`, crea la identidad en Supabase Auth por su API de administración.
En local hay que insertar solo la primera mitad —los seis correos con su rol—.

**Lo que en local no se puede probar es entrar.** La sesión la da Supabase Auth,
y sin proyecto no hay contraseñas ni sesión: se ve todo lo público (la landing en
los dos idiomas y `/comida`) y los portales quedan detrás del
acceso.

Usuarios de demostración — contraseña `GlobalEffect2026!` para todos, en cuanto
haya un proyecto de Supabase donde crear sus identidades. En local sus filas de
`usuario` existen y los datos cuelgan de ellas, pero no se puede entrar con
ninguno:

| Rol | Correo | Qué se ve |
|---|---|---|
| Estudiante | `estudiante@globaleffect.org` | Expediente con notas de dos cuatrimestres, 6 asignaciones del aula virtual y 3 solicitudes (enviada, en revisión y completada) |
| Habitudes | `habitudes@globaleffect.org` | Candidatos y alta de expediente por solicitud |
| Docente | `docente@globaleffect.org` | Un curso propio con 3 notas |
| Coordinación | `coordinacion@globaleffect.org` | Portal administrativo, expedientes y la bandeja de solicitudes |
| Contabilidad | `contabilidad@globaleffect.org` | Portal de contabilidad |
| Super admin | `admin@globaleffect.org` | Todo, incluido el segundo nivel de aprobación |

---

## Deuda encontrada por el camino

Cosas que no estaban en ningún plan y aparecieron al construir. Se dejan
anotadas porque el patrón se repite: lo que está en el repo no siempre está
desplegado.

| Qué | Estado |
|---|---|
| `0023_aula_virtual.sql` estaba en el repo sin aplicar en Supabase, y su número chocaba con `0021_psicologo_asignado.sql` | Resuelto: renumerada y aplicada |
| No había forma de marcar una solicitud de cita como confirmada, así que la bandeja no se vaciaba y el estudiante veía su hora preferida como si fuera la acordada | Resuelto: migración `0024` |
| `docs/05-plan-de-trabajo.md` apuntaba a un CSV con otro nombre | Resuelto |
| Había dos documentos de diseño diciendo lo mismo: `docs/09-estandar-de-diseno.md` y [`docs/09-sistema-visual.md`](../09-sistema-visual.md) | Resuelto: se eliminó el 09 y `docs/09-sistema-visual.md` queda como única norma visual |
| `.env.local` fijaba `claude-sonnet-4-5`, un modelo que no acepta los parámetros que usa el chat | Resuelto |
| La clave de Anthropic de `.env.local` devuelve 401 | **Abierto.** Hace falta una clave válida para probar el chat |
| `docs/prototipo-base44/prompt-formulario-expediente.md` describe un formulario plano de 70 campos y cuatro estados; la base está normalizada en seis tablas y tiene ocho estados (los cuatro primeros son el embudo de reclutamiento). Las claves de `messages` ya estaban escritas para el esquema real | Resuelto: el formulario sigue la base, con las seis pestañas = las seis tablas |
| `envio_correo_patrocinador`: el comentario de la migración 0005 dice `pendiente/enviado/no_aplica`, y tanto `docs/prototipo-base44/prompt-formulario-expediente.md` como las etiquetas traducidas dicen `sí/no/pendiente`. La columna es TEXT sin CHECK, así que nada lo impone | **Abierto.** Se sigue a la especificación y a las etiquetas; hay que decidirlo al escribir la acción de S5 |
| `docs/prototipo-base44/prompt-formulario-expediente.md` pide dos campos de texto para nombres y edades de hermanos y hermanas; en el esquema solo existe `hermanos_cantidad` | **Abierto.** O se añaden las columnas, o los hermanos van como filas de `familiar` (que ya admite `hermano` y `hermana` como parentesco) |
| `src/components/layout/app-shell.tsx` tenía un `setState` dentro de un efecto que ESLint marcaba como error | Resuelto: el cajón móvil se cierra ajustando estado durante el render, no en un efecto |
| Había seis puertas de acceso (`/login/{portal}`) que no filtraban nada: elegir puerta no concedía rol, y dos de ellas (`administrativo`, `cursos-tecnicos`) apuntaban a portales sin página | Resuelto: una sola puerta, `/login`. Se borraron la ruta y `src/lib/portales.ts` |
| El portal del estudiante no distinguía universitario (`tipo = 'becado'`, cuelga de `inscripcion` → `materia`) de curso técnico (`regular`, cuelga de `calificacion` → `curso`), y ofrecía a los dos las mismas pantallas | Resuelto en el menú: Mis materias y Aula virtual solo para universitarios |
| `/portal/estudiante/calificaciones` leía solo `calificacion` → `curso`, que es la vía del curso técnico. Al universitario le salía vacía: sus notas viven en `historial_calificacion` | Resuelto: `notasDelEstudiante` une las dos tablas, y con ella se arreglan de una vez la pantalla, el dashboard y el contexto del chat |
| La letra y el índice de `historial_calificacion` vienen guardados —la 0006 dice que la escala de conversión puede cambiar de un año a otro— y el portal los recalculaba desde la nota de 0 a 100, así que un 3.70 guardado se mostraba como 4.00 | Resuelto: la consulta devuelve la letra y el índice guardados, y solo los calcula cuando faltan, que es el caso del curso técnico |
| El orden del historial no podía salir de `periodo.fecha_inicio`: un cuatrimestre ya cursado no suele tener fila en `periodo`, y sin fecha caía por detrás de otro anterior que sí la tenía | Resuelto: la lista ordena por el nombre del período (`2026-II` antes que `2026-I`), que es la convención que fija la 0006 y que ordena igual a las dos vías |
| El dashboard del estudiante mostraba `tipo_evaluacion` en crudo (`examen`, `participacion`), sin traducir | Resuelto: usa las claves `gradesPage.type.*`, que ya existían |
| Todo el sistema mezclaba matices fuera de marca: 311 usos de emerald, ámbar, naranja, rosa, violeta y rojo en 48 archivos, más un color de banner por rol. Cada portal parecía de otra aplicación | Resuelto: barrido completo a azul y negro. Lo que distinguía por matiz ahora distingue por peso (nota A→azul oscuro, F→negro; urgente→negro, baja→gris). `--destructive` es negro: un error no es rojo porque la marca no tiene rojo |
| El hero llevaba píldora, párrafo, dos botones fijos y una banda de "Matrícula Abierta": seis cosas compitiendo en la primera pantalla | Resuelto: solo el titular. La única excepción es el botón de un anuncio publicado desde el panel, que sin él no serviría de nada |
| Cada bloque de la portada prometía un verbo distinto —iniciar sesión, inscribirme, apadrinar, solicitar cita— y sonaban a cuatro productos | Resuelto: un solo verbo, «Acceder», en los 27 botones de la página |
| El panel de anuncios tenía campos —etiqueta y texto— que el hero ya no dibuja: se guardaban y no se veían en ninguna parte | Resuelto: el formulario ofrece solo lo que el hero pinta (titular, imagen y botón). Las columnas `subtitulo` y `texto` siguen en la tabla, sin uso |
| El raíl fijo de la barra lateral son iconos sin texto: para saber qué guarda cada uno había que pulsarlos de uno en uno | Resuelto: el botón de árbol despliega el menú completo —cada área por su nombre, plegable, con sus apartados y sus módulos— con `<details>` nativos |
| `docs/estado/progreso.md` daba el dashboard por funcional y la página era un marcador de posición que mostraba la sesión | Resuelto: construido |
| La landing consultaba la base en cada visita: cinco consultas al pooler por visitante para devolver lo mismo que a la anterior | Resuelto: las cinco van en `unstable_cache` con la etiqueta `TAG_LANDING`, y las acciones del panel la tiran con `updateTag` al publicar |
| `unstable_cache` sirve **stale-while-revalidate**: tras un cambio hecho por fuera del panel, la primera visita ve el valor viejo y la segunda el nuevo. Comprobado en local, y la caché de desarrollo vive en `.next/dev/cache/fetch-cache`, no en `.next/cache` | Anotado, no es un fallo. Lo que se publica desde el panel sí se ve al momento, porque `updateTag` vacía la entrada en vez de marcarla como vieja |
| `landing_slide` tenía `cta_texto` y `cta_enlace` desde la migración 0015 y la landing los ignoraba: un anuncio no podía llevar su propio botón | Resuelto: el hero dibuja el botón del anuncio delante de los dos fijos |
| `cta_enlace` es texto libre que acaba en un `href` de la página pública. Sin validar, un `javascript:` ahí es un XSS almacenado servido a todo el que entra | Resuelto: la acción solo admite rutas que empiecen por `/` o por `https://`, y lo mismo para la imagen |
| El proyecto de Supabase `phlopfymlrpkqnteoobk` ya no existe: su subdominio da NXDOMAIN y el pooler responde «tenant not found». Nada que toque la base arranca, ni el `npm run dev` de la landing | **Resuelto (3 oct 2026).** No estaba borrado sino **en pausa**: al reactivarlo la base volvió a responder con sus datos, y se le aplicaron `0030` y `0031` |
| El rol `habitudes` tiene en su menú `/expedientes` filtrado por `expedientes.postular`, pero esa pantalla exige `expedientes.leer`, que **no tiene**: su única entrada lleva a una puerta cerrada. Y `expedientes.postular` no lo consume ninguna acción todavía | **A medias.** Desde la `0031` Habitudes ya tiene una puerta que abre: `/administrativo/solicitudes`, donde pide el **alta de expediente** de un candidato del embudo (la lista que recibe ya viene recortada al embudo en el servidor) y la aprueba administración. Lo que sigue abierto es dar de alta al candidato **nuevo**: `expedientes.postular` sigue sin acción que lo consuma, y `/expedientes` sigue cerrada para ese rol. Hay que decidir si Habitudes crea la ficha mínima del candidato o si la crea administración al recibir la solicitud |
| El archivo que se lee por OCR **no se guarda**: va al modelo y se descarta. Queda el rastro en `extraccion_ocr` (modelo, confianza y campos leídos) con `documento_id` en NULL | **Anotado, no es un fallo.** Guardar escaneos de documentos de identidad de menores es una decisión de política de datos y no se toma de paso mientras se construye un OCR. El bucket privado existe el día que se decida que sí |
| Los dos lectores de documento están construidos y **no pueden responder**: la clave de Anthropic devuelve 401. Las dos pantallas lo distinguen de un fallo pasajero y dicen «avisa al equipo técnico», en vez de invitar a reintentar en bucle | **Abierto.** Es la misma clave que bloquea el chat |
| El PostgreSQL local estaba migrado solo hasta la **0024**: le faltaban las cinco últimas (0025–0029), así que `asignacion.curso_id` y `materia_360` no existían y media docena de consultas del repo no se podían probar contra él | Resuelto: `npm run db:migrate` aplicó las cinco. Son idempotentes |
| El componente `EnConstruccion` se quedó **sin un solo uso** al construirse los siete esqueletos. Sus dos claves de i18n (`common.buildingTag` y `common.buildingTitle`) siguen en los dos diccionarios | **Abierto.** O se borra el componente con sus dos claves, o se deja como herramienta para la próxima ruta que se abra antes de construirla. No se tocó porque borrarlo arrastra una limpieza de i18n que nadie pidió |
| `docs/estado/plan-etapas.md` nombra las tablas de academias como `programa_academia` y `material_academia`; en la base (migración 0007) son **`academia`** y **`material`**. También pedía `src/server/finanzas/transacciones.ts` y `src/server/academias/programas.ts`, y lo que se escribió sigue la forma del repo: un `consultas.ts` y un `acciones.ts` por área | Resuelto en el código, que sigue a la base. El plan sigue con los nombres viejos |
| La entrada de **Reportes** estaba marcada con `finanzas.leer` en `nav.ts`, permiso que `admin` no tiene: coordinación no veía el módulo, y dos de sus tres pestañas (operaciones y académico) son suyas | Resuelto: la entrada se movió al área de Herramientas sin permiso, y cada pestaña cierra el suyo dentro de la pantalla |
| `academia.participantes` se lee como una cuenta y **no lo es**: no existe tabla de inscripción a una academia, así que el número lo teclea quien lleva el programa | **Abierto.** La pantalla lo dice en voz alta en vez de disfrazarlo. Si hace falta pasar lista, hace falta una tabla, no un número mejor mantenido |
| `enlaceDeEntrega()` firmaba cualquier objeto del bucket privado pero se llamaba como su primer usuario. Y el POST a Storage estaba escrito tres veces, con su cabecera y su manejo de error | Resuelto: se llama `enlaceDeDocumento()`, y las tres subidas comparten un solo POST con su `upsert` como parámetro —la foto y la entrega sustituyen, un material de academia no debe poder pisar a otro— |
| Los dos períodos del seed llevan meses desfasados y nadie lo veía: `2026-I` sigue marcado `activo` aunque terminó el 28 de abril, y `2026-II` sigue `planificado` aunque empezó el 5 de mayo. Cada nota que se registre así cae en el cuatrimestre equivocado | **Abierto.** La pantalla nueva de períodos ya los señala los dos; hay que poner los períodos reales de la Fundación desde `/academico/periodos`, no arreglarlo en código |
| Los textos de todo el módulo académico —`terms`, `subjects`, `grades`, `history`, `enrollment`, `rowActions`, `teacherPicker`— estaban escritos y simétricos en `es.json` y `en.json` desde una sesión anterior, para pantallas que no existían | Resuelto en parte: materias y períodos se construyeron sobre ese copy sin tocarlo (solo hizo falta añadir `rowActions.deps.tasks`). El resto sigue esperando su pantalla |
| `docs/estado/plan-etapas.md` se sustituyó el 5 de septiembre por la versión «Plan Maestro por Sprints», que **reintroduce desfases ya corregidos**: `requerirRol(['admin','profesor'])` (el rol es `docente`), la firma vieja de `registrar()` (hoy recibe un objeto), la tabla `periodo_academico` (es `periodo`), los roles `administrativo` y `psicologia` (son `admin` y `psicologo`), la ruta `/portal/cursos-tecnicos` (no existe) y SEMÁFORO para «alertas críticas» (está limitado a estados de una entidad). El archivo está **sin trackear en git**, así que la versión anterior no se puede recuperar del repo | **Abierto.** Los nombres reales quedaron anotados dentro del propio Sprint 1; los prompts de los demás sprints siguen sin corregir |
