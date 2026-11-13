# Bitácora de decisiones — Global Effect Nexus

Registro cronológico del desarrollo con fines de tesis (UCATECI). Para cada
trabajo: **qué se pidió, qué se decidió y por qué, qué alternativas se
descartaron, cómo se verificó y qué queda sin resolver.** La cola de
pendientes concretos vive en [`pendientes.md`](pendientes.md); esto es el
razonamiento detrás.

Convención de verificación: `npm run lint`, `tsc --noEmit`, `npm run build`,
`npm run i18n:check` y `npm run audit:ui`. Cuando se dice "no probado en
navegador" significa que solo pasaron esas comprobaciones estáticas.

---

## 1 nov 2026 — Revisión de los commits del día contra las reglas del proyecto

**Petición.** Revisar los cinco commits hechos ese día por otro agente y
corregir nombres y funciones para ajustarlos al plan.

**Hallazgos y decisiones.**
- Las comprobaciones automáticas pasaban, pero había defectos que ninguna
  detecta: zona horaria (la base corre en UTC y `CURRENT_DATE` mandaba el turno
  de las 8 PM al día siguiente), control de acceso (cualquier chofer podía
  marcar averiado el viaje de otro), SQL interpolado y consultas copiadas 5
  veces.
- **Lección metodológica:** un build verde no demuestra que la pantalla
  funcione. Se encontró después, por lectura, que los componentes cliente de
  transporte no recibían sus mensajes de traducción y habrían fallado en
  ejecución. Se añadió una revisión sistemática de qué espacio de mensajes usa
  cada componente cliente y quién lo entrega.
- Nombres: las acciones pasaron de sufijo inglés `…Action` a verbos en español,
  como el resto del repositorio.

**Verificación.** Las cinco comprobaciones. **Limitación:** sin pruebas
automatizadas del dominio (el proyecto no tiene marco de pruebas).

---

## 1 nov 2026 — Roles definitivos y permisos granulares (migración `0065`)

**Petición.** Ajustar los roles a la estructura real de la Fundación y añadir
permisos granulares que solo el superadministrador pueda otorgar, por rol y por
persona.

**Roles resultantes:** `super_admin`, `admin` (administrativo), `docente`,
`estudiante`, `contabilidad`, `habitudes`, `dir_habitudes`, `chofer`. Se retiró
`colaborador`.

**Decisiones y razones.**
1. **Un solo rol de contabilidad, no tres.** La Fundación tiene un jefe de
   contabilidad estadounidense, contables locales y una contable externa. Se
   descartó crear `jefe_contabilidad` y `contable_externo` porque serían roles
   de una sola persona; se diferencian con permisos por persona.
2. **La base de datos manda, no el código.** Antes el reparto por rol estaba
   copiado en una constante; para que el superadmin pueda editarlo desde la
   interfaz, la sesión lee `rol_permiso`. La constante pasó a ser reparto de
   fábrica. Se reemplazaron unos 95 comprobadores de rol por comprobadores de
   persona (rol + excepciones).
3. **Permisos de capacidad.** El caso que motivó el diseño: un profesor de
   Habitudes que además da una clase de Global Effect 360. En vez de darle el
   rol `docente` (que le abriría el portal académico completo), se creó el
   permiso `docencia.impartir`, nativo de `docente` y concedible a una persona.
   Las pantallas pasaron de preguntar `rol === "docente"` a preguntar por el
   permiso.
4. **Eliminar `colaborador` pasando sus cuentas a `admin`** fue la opción
   elegida por la dueña del proyecto. **Riesgo documentado:** `admin` tiene casi
   todo el acceso; para personal de cocina o mantenimiento es excesivo. Se
   dejó anotado revisar esas cuentas tras migrar.
5. El `super_admin` no es editable en la interfaz: evita que un descuido deje
   al dueño del sistema fuera de su propia configuración.

**Verificación.** Cinco comprobaciones. **No aplicado a la base real:** la
migración debe correrse antes de desplegar; sin ella los docentes quedarían sin
`docencia.impartir`.

---

## 1 nov 2026 — Limpieza visual de landing y portales

**Petición.** Quitar subtítulos y textos innecesarios; portal limpio,
delicado, estandarizado y animado.

**Método.** Se repartió el trabajo entre seis agentes con carpetas disjuntas
(sin tocar tipos compartidos ni los archivos de traducción, para no pisarse) y
con un criterio común escrito: qué quitar, qué conservar (etiquetas, errores,
estados, contenido de la base de datos, accesibilidad) y cómo estandarizar
(`EncabezadoPagina` solo con título, `animate-entrada`).

**Decisión de proceso.** No se borraron claves de traducción en la misma pasada:
solo se dejaron de usar, y la poda queda como paso aparte, para que un error no
rompa pantallas ajenas.

**Limitación.** El criterio "qué es innecesario" es de juicio; se conservaron
los avisos que cambian lo que la persona puede hacer.

---

## 1 nov 2026 — Línea de tiempo rediseñada y unificada

**Petición.** Rediseñar la línea de tiempo y su función.

**Situación de partida.** Tres diagramas distintos (panorama general, detalle de
proyecto, vencimientos de cuentas por pagar), de solo lectura salvo uno.

**Decisiones.** Panorama **más edición por arrastre**; un **componente único**
para las tres; rejilla limpia. La edición se resolvió con una acción de
servidor que decide por clase de barra y permiso (`proyecto` y `tarea` con
`operaciones.escribir`, `periodo` con `academico.escribir`), valida, audita y
mueve la fecha de la tarea junto con su evento del calendario. La interfaz
aplica el cambio al instante y lo revierte si el servidor lo rechaza; el
servidor es quien decide, la interfaz solo evita ofrecer lo que va a fallar.
Lo vencido se marca con icono y tinta, no con rojo (regla de marca).

**Alternativa descartada:** hacerlo editable en las tres pantallas. Las fechas
de una factura pertenecen al documento y no se arrastran.

**Verificación.** Cinco comprobaciones. **No probado el arrastre en
navegador.**

---

## 1 nov 2026 — Transporte, etapa 1 (migración `0066`)

**Petición.** Nombres de viaje cortos y definidos; el estudiante elige origen y
destino; puede inscribir a otras personas; quien no tiene internet pide que lo
inscriban; recomendar mapa/API y cómo conectar Google Workspace.

**Decisiones.**
- Turnos renombrados a Mañana, Mediodía, Tarde y Noche; la hora se muestra al
  lado, no dentro del nombre.
- **Una sola función de inscripción** para tres vías (puerta pública,
  estudiante, asistida), con columnas `via` e `inscrito_por`. Así las tres
  validan igual (la puerta pública es la única sin sesión, por lo que la
  validación del servidor es la única barrera).
- Tope de 8 invitados por estudiante y día, contra el abuso.
- Origen y destino distintos, en la acción **y** como restricción en la base
  (`NOT VALID`, para no fallar con filas anteriores).

**Recomendación de mapa y Google Workspace** (documento completo en
[`../referencia/mapas-y-google-workspace.md`](../referencia/mapas-y-google-workspace.md)):
mantener Leaflet con teselas abiertas para todo el portal; para la vivienda,
marcar el punto en el mapa en lugar de geocodificar texto (las direcciones
dominicanas no están normalizadas); el seguimiento en vivo no necesita una API
de mapas porque la posición sale del teléfono del chofer; Google Workspace solo
para el personal (inicio de sesión con Google restringido al dominio, más
comprobación en servidor), los estudiantes con correo personal.

**Limitación documentada.** Los navegadores suspenden la geolocalización con la
pantalla apagada; mitigación propuesta (Wake Lock), no implementada.

---

## 1 nov 2026 — Etapa 2: un solo acento, sin degradados, sin subtítulos

**Petición.** Buscar portales comparables y tomar referencias visuales; quitar
el degradado de los botones y dejar un solo color (azul o negro, a elección del
usuario en la configuración); ningún degradado en ningún lado; sin subtítulos
ni textos de más en cartas, botones, tareas o asignaciones; los datos de una
carta deben verse como componentes (iconos), no como subtítulo.

**Referencias.** Se intentó una búsqueda web de portales comparables (LMS y
paneles estudiantiles). Devolvió casi solo portafolios de freelancers y
plantillas de venta, sin fuentes de principios de diseño que se puedan citar,
así que **no se inventaron referencias**. La guía visual se apoya en la norma
propia del proyecto (estilo "app web" tipo Airbnb, `docs/09-sistema-visual.md`).
*Para la tesis:* si se quiere citar referencias, hay que buscarlas en guías de
sistemas de diseño publicadas (p. ej. documentación de sistemas de diseño de
productos conocidos) y no en marketplaces.

**Decisiones y razones.**
1. **El color elegido por la persona se resuelve en la capa de tokens, no en
   los componentes.** El acento negro reasigna la escala `marca-*` a tinta en
   `globals.css` bajo `data-acento="negro"`. Como todo el código ya pintaba con
   `bg-marca-500` y compañía (regla del proyecto: nunca hex), el cambio de color
   no tocó ningún componente. *Alternativa descartada:* un `if` por componente
   o dos hojas de estilo; multiplicaba el riesgo de olvidar sitios.
2. **Se guarda en el navegador, junto con el tema y la barra** (sistema de
   apariencia existente), no en la base: es una preferencia del dispositivo y se
   aplica antes de pintar, sin parpadeo.
3. **El negro solo en modo claro.** Un botón negro sobre fondo oscuro
   desaparece; de noche manda el azul. Límite asumido y documentado.
4. **Degradados: eliminados por completo** (botón, banners, avatares, icono
   flotante, barra inferior, anuncios, perfil, la cáscara de carga y el velo de
   la portada). El velo del hero, que servía para legibilidad del texto sobre
   foto, pasó a un velo plano. Se retiraron los exports sin uso (`GRADIENTE`,
   `PORTAL_BANNER`, `ESTILO_POR_ROL`).
5. **La regla se automatiza:** `audit:ui` ahora falla si reaparece un
   degradado (con excepción de las rayas de una rejilla y las máscaras de
   desvanecido, que no son decoración). Se probó con un archivo de muestra que
   el auditor realmente lo detecta.
6. **Los datos de una tarjeta pasan a `Dato`/`FilaDatos` (icono + valor)** en
   lugar de texto gris pequeño. Cada dato se reconoce sin leer. *Aplicado en:*
   tarjeta "Lo próximo" del estudiante, filas de tareas de la torre de control,
   y las tarjetas de acceso del portal (que ahora son icono y título).

**Verificación.** Las cinco comprobaciones. **No probado en navegador**, en
particular el cambio de acento y los contrastes del acento negro.

**Pendiente (honesto).** El criterio "dato que parece subtítulo" aparece en
decenas de tarjetas más (tabla de notas, aula virtual, solicitudes, matrícula…);
esta etapa fijó el patrón y lo aplicó a las más visibles. Una pasada completa
queda como trabajo explícito, no como hecho.

---

## 1 nov 2026 — Etapa 3 (parte 1): auditoría de Global Effect 360 y cierre de seguridad

**Petición.** Comprobar que las clases de Global Effect 360 funcionan como un
portal estudiantil completo: el profesor asigna y califica tareas, el
estudiante entrega documentos o texto, hay nota final, el profesor decide
aprobado o reprobado y registra asistencia; dos clases por cuatrimestre con
fechas fijadas por administración; cada materia al expediente y al historial
por cuatrimestre; cuatrimestres de enero a diciembre (3 a 4 por año).

**Método.** Auditoría de solo lectura contra una lista de diez requisitos
(R1–R10), con evidencia por archivo y línea, hecha por un agente
independiente para que el diagnóstico no quedara anclado a mi propia lectura.

**Resultado (estado inicial).**

| Requisito | Estado |
|---|---|
| R1 asignar y realizar tareas | parcial: las tareas cuelgan de la materia, no del período; quien repite hereda las del intento anterior |
| R2 entrega con documento o texto | parcial: no había texto; **la entrega con documento no subía el archivo** |
| R3 calificar cada tarea | cumple (con fallos de alcance) |
| R4 nota final derivada de las tareas | falta: se teclea a mano |
| R5 el profesor decide aprobó/reprobó | parcial: el estado sale automático del umbral de 70 |
| R6 asistencia por clase | **falta por completo** (no existe tabla) |
| R7 dos clases por cuatrimestre, fechas por administración | parcial: no hay fechas de clase, solo un horario en texto libre |
| R8 expediente e historial por cuatrimestre | parcial: el historial no incluye 360 |
| R9 cuatrimestres enero–diciembre, 3–4 por año | falta: no se valida rango, traslape ni cantidad |
| R10 no chocar con la carrera | parcial: el índice acumulado mezcla 360 con la carrera |

**Hallazgos críticos.** (a) La entrega de tareas fabricaba una URL
`storage.globaleffect.org/...` en el navegador: el archivo nunca se subía y el
docente no podía abrirlo. (b) Cualquier cuenta con ficha podía entregar en
**cualquier** tarea (no se comprobaba la inscripción). (c) Un docente podía
calificar entregas de clases ajenas por la ruta de Moodle. (d) El alcance del
docente en `calificarInscripcion360` dependía de conservar `docencia.impartir`:
quitárselo a alguien lo dejaba calificando **cualquier** clase en lugar de
ninguna (consecuencia del permiso de capacidad añadido el mismo día).

**Lección.** Había dos rutas de entrega: una segura y sin usar (código muerto)
y otra insegura que sí usaba la interfaz. Tener dos caminos para lo mismo
esconde que el vivo es el malo.

**Corregido en esta parte.**
- Entrega unificada en `entregarTareaMoodleAction`: estudiante desde la sesión
  con rol `estudiante`; verifica inscripción en carrera o 360; **sube el
  archivo en el servidor** con ruta hecha de ids; valida tamaño, formato y
  plazo contra el archivo real; anula la revisión anterior al re-entregar.
- Lista cerrada de formatos (pdf, png, jpg, docx). **Decisión:** `zip` no se
  admite aunque una tarea lo anuncie; un bucket que acepta cualquier cosa es
  donde alguien sube un ejecutable.
- Entrega con **texto escrito** además del documento (migración `0067`); el
  profesor lo ve junto a la entrega.
- Calificar por la ruta de Moodle exige que la entrega exista y sea de la
  clase del docente (salvo `academico.escribir`).
- El alcance de `calificarInscripcion360` ya no depende de `docencia.impartir`.

**Queda por construir (no hecho; se declara).** Asistencia por clase (grande),
fechas de clase y validación de cuatrimestres (mediano), tareas ligadas al
período (mediano-grande), nota final derivada con anulación auditada
(mediano), decisión explícita aprobar/reprobar (pequeño), asignar docente,
horario, aula y cupo desde la interfaz (pequeño), y 360 en el expediente e
historial con índices separados (pequeño-mediano).

**Verificación.** Las cinco comprobaciones. **No probado en navegador ni con
una subida real a Storage.**

---

## 1 nov 2026 — Etapa 3 (parte 2): asistencia, fechas, nota final y 360 en el expediente (migraciones `0068`, `0069`)

**Petición.** Cerrar los huecos que dejó la auditoría de la parte 1.

**Método.** Tres bloques ejecutados en secuencia por agentes distintos (los
bloques tocan los mismos archivos del panel del profesor y los mismos archivos
de traducción, así que en paralelo se habrían pisado). Cada bloque se verificó
con las cinco comprobaciones antes de lanzar el siguiente, y yo revisé a mano
el SQL con control de acceso (marcar asistencia).

**Bloque A — asistencia, fechas, docente y cuatrimestres.**
- *Decisión de diseño:* "las fechas de clase las decide administración" y "el
  profesor marca presente o ausente por clase" se resolvieron con un solo
  concepto: la **sesión** (`sesion_360`). Administración programa las sesiones
  de cada clase y cuatrimestre; el profesor marca `asistencia_360` en cada una.
  Así la fecha de clase y la asistencia no pueden desincronizarse.
- *Seguridad:* programar exige `academico.escribir`; marcar exige
  `docencia.impartir` y el filtro por `docente_id` va **dentro** de la propia
  sentencia SQL (solo se omite con `academico.escribir`).
- *Cuatrimestres:* función pura `validarPeriodo` (`src/lib/periodos.ts`): tipo
  cuatrimestre, inicio y fin en el mismo año calendario (enero–diciembre), sin
  traslape y a lo sumo 4 por año. Se aplica en tres sitios que escribían fechas
  de período sin validar: `guardarPeriodo`, `guardarVentana` y el arrastre de la
  línea de tiempo (`moverBarra`).
- `guardarMateria360` ahora escribe docente, horario, aula y cupo: antes dar
  una clase exigía SQL manual.

**Bloque B — tareas por período, nota final y decisión.**
- Las tareas de 360 pasan a ligarse al cuatrimestre (`asignacion.periodo_id`);
  `NULL` conserva el comportamiento anterior para los datos existentes. Corrige
  que quien repite una materia heredara tareas, entregas y promedio.
- **Nota final derivada** (`calcularNotaFinal`): promedio ponderado por `peso`
  de nota/puntaje máximo. *Decisión de producto declarada:* una tarea vencida
  sin entrega cuenta como 0; una vencida **entregada y aún sin calificar no
  cuenta**, para no castigar al estudiante por la demora de quien revisa. La
  dueña puede cambiar esta regla.
- El profesor ve la propuesta, puede usarla o teclear otra; si difiere, la
  auditoría guarda ambas (constancia de la anulación).
- **Aprobó/reprobó lo decide el profesor** (el umbral de 70 solo sugiere); se
  guarda quién decidió y cuándo.
- La escala de notas se amplía a 1000 puntos (`NUMERIC(6,2)`), porque con
  `(5,2)` una tarea de 1000 puntos ni siquiera se podía publicar.
- `prematriculada → cursando`: no había quien lo hiciera. Se resuelve de forma
  **perezosa** (al abrir las pantallas de 360), no con un cron: no hay
  infraestructura de tareas programadas y la operación es idempotente y barata.
- El cupo cuenta solo el mismo cuatrimestre.

**Bloque C — expediente, historial e índices.**
- El expediente y el historial muestran las materias de 360 por cuatrimestre
  (estado, nota, quién decidió, asistencia), en un bloque **aparte** de la
  carrera.
- **Separación de índices:** el índice académico de la carrera ya no se mezcla
  con 360 (contradecía el diseño original de la migración `0027`); 360 tiene su
  propio promedio. Efecto colateral aceptado: el inicio del portal del
  estudiante deja de mostrar notas de 360 en "recientes".
- El filtro por período se completó en calendario y agenda del estudiante.

**Verificación.** Las cinco comprobaciones sobre las tres partes, build incluido.

**Limitaciones que se declaran (importante para la defensa).**
1. **Ninguna consulta nueva se ejecutó contra una base real** ni se probó nada
   en navegador: la validación es estática (tipos, lint, build).
2. `validarPeriodo` y `calcularNotaFinal` son funciones puras, ideales para
   pruebas unitarias, pero el proyecto no tiene marco de pruebas.
3. La base no impide por sí sola que una marca de asistencia apunte a una
   inscripción de otra materia o período; lo garantiza el JOIN de la acción, no
   un trigger.
4. Inscripciones calificadas **antes** de la migración quedan sin "quién
   decidió".
5. Migraciones `0066` a `0069` aplicadas a la base real el 1 nov 2026 (ver
   «Aplicación de migraciones»).

---

## 1 nov 2026 — Etapa 4 (parte A): una sola Bandeja administrativa

**Qué se pidió.** Admin veía dos módulos redundantes ("Portal administrativo" y
"Panel"). Se pidió reemplazarlos por un inbox: tareas por hacer, proyectos
propios, reuniones en agenda, notificaciones y gráficos interactivos.

**Decisión.** Una sola ruta `/bandeja`, inicio de `admin` y `super_admin`. Las
rutas viejas quedan como redirecciones para no romper enlaces ni la PWA
(`start_url`). Orden: avisos que esperan decisión, tareas del usuario,
notificaciones, proyectos, reuniones y gráficas (recharts, solo tonos de marca).

**Por qué.** Dos pantallas respondían la misma pregunta ("qué debo atender").
Un inbox ordena por urgencia y no por módulo; las gráficas pasan a apoyo.

**Alternativas descartadas.** Conservar `/dashboard` como pantalla de gráficas
(mantenía la duplicidad); mantener las 12 cifras y el listado de módulos (ruido:
el menú lateral ya lista los módulos).

**Control de acceso.** Cada bloque se consulta solo con su permiso
(`operaciones.leer`, `reuniones.leer`, `finanzas.leer`, vía
`usuarioTienePermiso`): lo que el rol no puede ver no se lanza como consulta.

**Verificación.** `tsc`, `lint`, `i18n:check`, `audit:ui` y `build` en verde.

**Limitaciones.**
1. No probada en navegador ni con datos reales.
2. Se descartó la lectura de `audit_log` que tenía el portal viejo: ya no hay
   pantalla que la muestre.
3. Para admin las reuniones son todas las próximas de la Fundación, no solo las
   suyas.
4. Claves i18n del namespace `dashboard` quedaron sin uso (poda pendiente).

---

## 1 nov 2026 — Etapa 4 (parte B): solicitudes de compra a contabilidad (migración `0070`)

**Qué se pidió.** Que todos los roles puedan pedir a contabilidad una compra
con cotización adjunta; que contabilidad apruebe o rechace (rechazar exige
motivo); que ambas partes vean el estado; que la Bandeja avise a contabilidad.

**Decisiones.**
1. **Tipo nuevo `compra`, no reutilizar `gasto`.** El `gasto` es una decisión
   ya tomada del personal, con umbral de dirección y cuenta por pagar al
   aprobarse. La compra la puede pedir cualquier rol (también estudiante y
   chofer), exige archivo y contabilidad solo aprueba o rechaza. Mezclarlos
   habría obligado a bifurcar el flujo del gasto. `compra` queda fuera de
   `APROBACIONES_INTERNAS` y tiene su propia acción (`crearCompra`), porque
   sube un archivo y no depende de `tiposQuePuedeCrear`.
2. **Sin segundo nivel de dirección** (`direccion: NUNCA`): el requisito dice
   que contabilidad decide. Aprobar no genera cuenta por pagar; se registrará
   con la factura real.
3. **Adjunto en tabla propia `solicitud_adjunto`** (una por solicitud, UNIQUE),
   con CHECK de formato (pdf/png/jpg/docx) y tamaño (<= 10 MB). Alternativa
   descartada: columnas en `solicitud`, que es de todos los tipos.
4. **Validación en el servidor** (extensión, tipo MIME declarado, tamaño),
   mismo patrón que `subirEntrega`. La ruta del bucket privado lleva un UUID
   propio, nunca el nombre del archivo. Se sube antes de la transacción y se
   borra si esta falla.
5. **Descarga por ruta protegida** `/api/solicitudes/[id]/cotizacion`: solo el
   solicitante y quien tiene `contabilidad.aprobar`; al resto, 404. Enlace
   firmado de 10 minutos.
6. **Rechazo con motivo.** `rechazar` es la única vía de rechazo (también la de
   dirección), y `avanzarSolicitud` ya devolvía `falta_comentario`; se
   documentó y se añadió la comprobación en el formulario (no viaja si está vacío).
7. **Notificaciones:** ya existían: al crear, a quien revisa; en cada paso, al
   solicitante. La Bandeja cuenta lo pendiente con `cuantasPorAtender`, que
   recoge `compra` sin cambios porque filtra por los tipos que el rol revisa.
8. **Menús:** `requests` se añadió a contabilidad y chofer (docente, habitudes,
   dir_habitudes y admin ya lo tenían; el estudiante tiene su portal).
9. **`next.config.mjs`:** `serverActions.bodySizeLimit` a 12 MB; el tope por
   defecto (1 MB) habría roto cualquier subida mayor, incluidas las entregas.

**Verificación.** `tsc`, `lint`, `i18n:check`, `audit:ui` y `build` en verde.

**Limitaciones.**
1. La migración `0070` se aplicó el 1 nov 2026 (ver «Aplicación de
   migraciones»); nada se probó en navegador.
2. Que la compra lleve cotización lo garantiza la acción, no la base (un
   INSERT directo podría crear una compra sin adjunto).
3. Una cotización por solicitud; no se puede reemplazar tras enviar.
4. No hay vista de contabilidad por estado ni búsqueda de compras ya cerradas
   más allá de "Resueltas por ti".
5. Un usuario con permiso de contabilidad que pide una compra no puede
   aprobarla él mismo (separación de funciones): otro revisor debe decidir.

---

## 1 nov 2026 — Aplicación de migraciones `0065` a `0070` en la base real

**Qué se hizo.** A petición explícita del autor se corrió `npm run db:migrate`
contra la base de Supabase. El runner aplica cada archivo en su propia
transacción y lo registra en `_migracion`; si uno falla, se revierte y se
detiene. Se aplicaron las seis, sin errores.

**Verificación posterior (solo esquema, sin escribir datos).** Los 8 roles
definitivos y ninguno más (`colaborador` ya no existe); `docencia.impartir`
asignado a un rol; ningún usuario con rol inexistente; tablas `sesion_360`,
`asistencia_360` y `solicitud_adjunto`; columnas de entrega con texto, peso y
período de tarea, decisión del profesor y origen de la inscripción de
transporte; CHECK de `solicitud` con el tipo `compra` y monto obligatorio.

**Limitaciones.** No hubo copia de respaldo previa hecha desde aquí ni entorno
de pruebas separado: se aplicó directamente. Verificar el esquema no prueba el
SQL de las consultas nuevas; falta el recorrido manual en navegador.

---

## 9 nov 2026 — Datos de demostración en todos los estados

**Qué se hizo.** Dos scripts idempotentes, `seed-demo-estados.mjs` (esquema
público) y `seed-demo-contabilidad.mjs`, que dejan al menos una fila por cada
valor de estado de cada entidad y trabajo pendiente para los ocho roles.

**Decisiones y motivo.**
- *Ids deterministas* (hash de una clave fija) en lugar de borrar-y-recrear:
  permite repetir el script sin duplicar y sin tocar datos ajenos.
- *Sin asientos fabricados.* Un asiento escrito a mano puede descuadrar el
  libro (hay un trigger de cuadre) o romper la cadena de hash de la bitácora.
  Los documentos aprobados quedan sin `asiento_id`; se comprobó después que la
  cadena sigue íntegra (1362 eslabones, 0 rotos).
- *Numeración por `contabilidad.siguiente_numero`* solo para filas nuevas, para
  que repetir el seed no consuma números de la secuencia.
- Las columnas generadas (`total`, `saldo`…) se descartan leyendo el catálogo,
  no a mano.

**Alternativas descartadas.** Reutilizar las acciones de `src/server` (cubren
las reglas de negocio pero exigen sesión y no corren desde un script de Node);
datos solo con SQL plano (frágil ante cambios de columnas).

**Limitaciones.** Falta pagos, nómina y conciliación en estados intermedios.
La base es la de Supabase real del proyecto, no un entorno aparte.

---

## 9 nov 2026 — Formularios Normal / Guiado y portada del expediente

**Qué se hizo.** Una pieza común, `FormularioGuiado`, que deja a cada persona
llenar los formularios largos con todo a la vista o paso a paso, aplicada a
unos 45 formularios. Y una portada del expediente con la foto, la cuenta del
portal vinculada, las materias de la universidad, las clases de 360 y las
tareas que dejan los docentes en el aula virtual.

**Decisiones y motivo.**
- *Los pasos ocultos siguen montados* (atributo `hidden`), así el envío es el
  mismo en los dos modos y ningún formulario cambió su lógica de guardado.
- *Se valida al pulsar Siguiente*: un campo obligatorio escondido no se puede
  señalar, así que solo se avanza con el paso en regla.
- *Preferencia en el navegador*, como la apariencia: es costumbre de quien usa
  esa pantalla y abre ya en el modo correcto. Por defecto, normal.
- *Solo formularios de ≥ 5 campos en 2+ grupos*: en un filtro o una
  confirmación, un asistente es un clic más sin ganancia.
- *Portada*: la foto vivía solo dentro del formulario de edición; el vínculo
  con la cuenta se muestra porque sin él el portal del estudiante no ve sus
  materias ni sus tareas.

**Alternativas descartadas.** Un asistente separado por formulario (duplica
campos y lógica); desmontar los pasos ocultos (rompe el `FormData` y lo
escrito en campos no controlados); guardar la preferencia en la base (una
consulta más por formulario para algo del aparato).

**Limitaciones.** No se probó en navegador con sesión iniciada; queda la
prueba manual listada en `pendientes.md`.

---

## 12 nov 2026 — Observaciones #1 del Departamento de Contabilidad

**Qué se pidió.** El contador revisó el portal con capturas y dejó once
observaciones; además, quitar del portal lo que el departamento no usa.

**Qué se hizo, observación por observación.**
1. *Inicio: «¿a qué mes, trimestre o año se refiere?»* El tablero nombra el
   periodo («noviembre de 2026», «4.º trimestre 2026») con su rango de fechas y
   flechas para ir al anterior o al siguiente (`?ref=` en la URL). Las cifras
   salen de ese rango y no de `CURRENT_DATE`.
2. *El atajo ⌘K en Windows.* Se rotula «Ctrl K» y solo en Mac «⌘K».
3. *Estados «Sin procesar» y «Procesado».* Migración `0080`: `asiento.procesado_en`.
   Lo nuevo nace sin procesar y no entra al diario, mayor, balanza, estados
   financieros, cierre ni presupuesto hasta que alguien con
   `contabilidad.aprobar` lo procesa (desde la ficha o eligiendo varios en la
   lista). Un período no se cierra con asientos sin procesar (disparador).
4. *Débito y Crédito* en lugar de Debe y Haber, en pantalla y en Excel.
5. *Quitar las tarjetas de totales* de los libros. Los totales siguen al pie.
6. *Diario con cuentas auxiliares y sus montos.* Cada asiento muestra la cuenta
   mayor con su monto y debajo sus auxiliares en la columna «Auxiliar».
7. *Mayor general sin movimientos.* Cuentas mayores con débito, crédito y saldo,
   plegables (`<details>`) para ver sus auxiliares, filtradas por un rango
   «desde la cuenta / hasta la cuenta».
8. *Balanza sin saldo anterior ni final.* Débito y crédito del rango.
9. a 11. *Bancos.* Migración `0081`: `extracto_linea` y `conciliacion_partida`.
   El estado de cuenta (.csv) se sube desde la propia cuenta y no se duplica:
   cada transacción se reconoce por su referencia (o fecha + monto +
   descripción si no trae). La cuenta muestra su cuenta contable auxiliar y se
   puede cambiar. «Conciliar» enfrenta lo que trae el banco con las líneas de
   asiento de esa auxiliar; se empareja una con otra si el monto coincide. Lo
   conciliado se lista y cada pareja se puede anular.

**Módulos retirados del menú.** Por la lista de lo que el departamento sí usa
(archivos, Gantt de cuentas por pagar, tareas, proveedores, bancos en pesos y
dólares, proyectos con presupuesto, cajas por persona o departamento, recibos
con filtros, reportes de bancos, historial de gastos, recibos de egreso):
fuera nómina, impuestos, retenciones, activos fijos, consumibles,
calculadoras, centros de costo, órdenes de compra, comprobantes recibidos,
terceros, fondos, donaciones, la rendición por fondo y el `/reportes`
repetido. Solo salen del registro `MODULOS_CONTABLES`; rutas y tablas siguen.
La conciliación por lotes de la `0036` sí se borró de la interfaz: la sustituye
la nueva.

**Decisiones y motivo.**
- *Los asientos que ya existían quedan procesados*: ya estaban en los libros y
  sacarlos cambiaría balances ya vistos. Se rellenan con el `DEFAULT` del
  `ALTER`, que no dispara la protección de períodos cerrados.
- *Un asiento y su reverso se procesan juntos* (y los asientos de un mismo
  documento): procesar solo el reverso restaría en el mayor algo que nunca se
  sumó.
- *Conciliar contra líneas de asiento y no contra el libro de banco*: así entra
  también un asiento manual que tocó la cuenta del banco, que es lo que pidió
  el contador («asientos no conciliados que utilicen bancos»).
- *Ocultar módulos en vez de borrarlos*: lo decidió el usuario; es reversible.

**Alternativas descartadas.** Un estado «procesado» solo visual, sin efecto en
los libros (no respondería a la observación). Mantener la conciliación por
lotes junto a la nueva (dos formas de hacer lo mismo). Comparar códigos de
cuenta como texto para el rango del mayor («1.10» quedaría entre «1.1.01» y
«1.1.02»): se usa la posición en el árbol.

**Corrección colateral.** El balance general sumaba todas las líneas de la
historia: el `LEFT JOIN` al asiento no descartaba las de asientos anulados o
fuera de fecha. Ahora suma con `FILTER (WHERE a.id IS NOT NULL)`.

**Verificación.** `lint`, `build`, `i18n:check` y `audit:ui` en verde.
Migraciones `0080` y `0081` aplicadas en la base real con autorización del
usuario; las consultas nuevas (diario, mayor, balanza, asientos, inicio,
bancos) se ejecutaron contra ella y responden.
**Limitaciones.** Falta probar en el navegador. La conciliación es una a una; un depósito del banco que
junta varios recibos todavía no se puede emparejar con varios asientos.

---

## Pendiente de registrar (se completará al cerrar cada etapa)

- Nada por registrar de las etapas 1 a 4: todas tienen su entrada. Las pruebas contra base real y navegador siguen pendientes (ver limitaciones de cada una).
