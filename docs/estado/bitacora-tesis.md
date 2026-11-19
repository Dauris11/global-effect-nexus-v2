# Bitácora de decisiones — Sistema Web Inteligente para la Gestión Académica y Administrativa de la Fundación Global Effect

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

## 18 nov 2026 — Cierre de Portal Estudiantil/Académico, Dependencias Gantt, Modularización de Transporte y Limpieza UI (Gabriela)

**Qué se pidió.** Cerrar los puntos pendientes del apartado de estudiantes y
maestros (tope de créditos según pautas de la universidad del becado,
parametrización de la nota mínima de Global Effect 360, protección en servidor
contra retiros bajo el mínimo de 2 clases, filtros por materia y estado en Aula
Virtual y retiro del estado `standby_tecnico`), además de las tareas pendientes
de Operaciones/Gantt, Transporte/Chofer, Calendario y limpieza UI, dejando
intactos los módulos asignados a Dauris (**Habitudes**, **Contabilidad**,
**OCR** y **Expedientes**).

**Decisiones y motivo.**
1. *Tope de créditos por pauta de universidad (`UCATECI`, `UNPHU`, `UASD`, `UTESA`).*
   En lugar de un número único fijo, `topeCreditosDeUniversidad` detecta la
   institución registrada en `estudiante.universidad` (por siglas o nombre
   completo) y aplica el tope oficial de cada universidad (`UCATECI`: 24 cr.,
   `UNPHU`: 22 cr., `UASD`: 20 cr., `UTESA`: 24 cr., general: 24 cr.), todos
   parametrizables en `/configuracion/parametros`. La comprobación ocurre dentro
   del propio `INSERT` de `inscribirseEnMateria` para evitar condiciones de
   carrera.
2. *Protección en servidor del mínimo de 2 clases (`MINIMO_CLASES_UNIVERSITARIO_CUATRIMESTRE`).*
   Tanto `quitarseDeMateria` (carrera) como `retirarPrematricula` (Global Effect
   360) impiden en SQL que un estudiante universitario baje de 2 clases activas
   una vez cumplido el mínimo o iniciado el período académico. Para cambiar una
   materia de carrera cuando ya tiene 2, inscribe primero la nueva (pasando a 3)
   y luego retira la anterior (quedando en 2).
3. *Filtros combinados en Aula Virtual (`?materia=&estado=`).* Ambos filtros
   viven en la URL como enlaces de servidor, permitiendo compartir la vista y
   combinar asignatura + estado sin perder el filtro activo al cambiar el otro.
4. *Retiro de `standby_tecnico` (`0086`).* Tras el cierre de los cursos técnicos
   (`0047`), `standby_tecnico` se sacó de `ESTADOS_ESTUDIANTE` y de los filtros
   del embudo activo, migrando cualquier fila existente a `postulado` y
   conservando su entrada en `ESTADO_VISUAL` como respaldo visual para registros
   históricos.
5. *Dependencias `tarea_dependencia` en Gantt y modularización de cabina del chofer.*
   `LineaTiempo` dibuja conectores SVG curvos entre tareas dependientes y
   permite saltar a las predecesoras desde el panel de detalle; `panel-chofer.tsx`
   se partió en `cabecera-chofer.tsx`, `pasajeros-chofer.tsx` y
   `dialogo-incidencia-chofer.tsx`.
6. *Mapa en vivo de transporte con motor cinemático TIMOB y circuito universitario (`0087`).*
   Se reemplazaron las teselas CARTO (que exigían API key) por OpenStreetMap libre,
   se actualizaron las paradas oficiales al circuito urbano de La Vega (**Edificio
   Fundación Global Effect**, **UNPHU**, **UASD**, **UCATECI** y **UTESA**) con
   polilínea vial OSRM de 162 puntos, telemetría cinemática continua, relojes de
   arribo estimado (ETA) y filtros de enfoque rápido por universidad. Asimismo,
   el logo e isotipo de `sidebar.tsx` y `topbar.tsx` quedaron estáticos y no
   cliqueables en todos los portales.
7. *Persistencia de foto de perfil y pulido integral del Portal Docente.*
   En `formulario-perfil.tsx` y `acciones.ts`, cualquier imagen seleccionada se
   normaliza en cliente con `<canvas>` (`360×360` JPEG) y se conserva en estado de
   React durante el envío, subiéndose al bucket `avatares` con versión `?v=` y
   sincronizando `estudiante.foto_url`. En el Portal Docente (`/portal/profesor`,
   `/portal/profesor/materias` y `/academico/clases-360`), se separaron las
   bandejas de entregas pendientes de 360 y de materias asignadas, se añadieron
   deep-links exactos desde el inicio del profesor, se completó el formulario de
   tareas de materias con enlace de recurso y rúbrica, se añadió el cálculo de
   cumplimiento y nota propuesta (`calcularNotaFinal`) con botón «Usar propuesta»
   en `inscritosDeMateria`, y se integraron en `notasDelEstudiante` las notas
   finales cerradas por el docente en `inscripcion`.

**Reparto de trabajo en GitHub (para coordinación con Dauris).**
- **Hecho por Gabriela en esta entrega:** Portal del Estudiante, Portal Docente y
  Académico (`360` y materias), Parámetros institucionales de becas/créditos,
  Línea de Tiempo Gantt (`tarea_dependencia`), Cabina del Chofer modularizada,
  limpieza de tokens en Calendario y Solicitudes, y retiro de componentes
  huérfanos.
- **Reservado para Dauris (sin tocar):** `Habitudes`, `Contabilidad`, `OCR` y
  `Expedientes`.

**Verificación.** `node scripts/auditar-i18n.mjs` (5,526 claves simétricas
`es`/`en`), `node scripts/auditar-ui.mjs` (0 arcoíris, 0 hex sueltos, 0
degradados) y `node --test scripts/probar-academico-360.mjs` (12/12 pruebas
unitarias en verde).

---

## 19 nov 2026 — Historial GPS del transporte y primera fase del expediente académico

**Petición.** (1) Convertir en integración real una guía de seguimiento de
guagua con Leaflet y GPS del teléfono; (2) desarrollar por fases el expediente
académico: recorrido Habitudes → academia → universidad, catálogo de
universidades con carreras y pénsum, notas por período, OCR de récords y
listados, servicio y reunión mensual, sanciones.

**Qué se encontró.** La guía ya estaba casi toda construida (Leaflet, mapa en
vivo, GPS del chofer, API de posición, tablas de viaje). Faltaba lo único que
la guía pedía y el repositorio no tenía: **conservar cada punto del recorrido**.
Del expediente ya existían los estados del embudo y el permiso
`expedientes.postular`; no existían universidad, carrera, pénsum ni matrícula.

**Decisiones y por qué.**
- **Historial en tabla propia** (`transporte_posicion`, `0089`) y no solo la
  última posición en `transporte_viaje`: sin puntos no se puede reconstruir
  dónde estuvo la guagua. El tope de un punto cada 5 s se aplica **en el
  servidor**, porque un cliente modificado podría inflar la tabla.
- **Recorrido en el mapa** dentro de la respuesta que el mapa ya sondea cada
  4 s (últimos 1500 puntos), en vez de un endpoint nuevo: menos superficie
  pública y una sola consulta.
- **Expediente por fases, empezando por lo que no necesita documentos**
  (`docs/estado/plan-expediente-academico.md`). La fase 1 es el historial de
  etapas (`estudiante_etapa`, `0090`): quién movió a cada estudiante y cuándo,
  base de las alertas y sanciones.
- **Las notas leídas por OCR nunca se guardan directo:** pasan por una pantalla
  de revisión y se emparejan por matrícula y después por nombre.
- **Descarte = `inactivo` con motivo**, no un valor nuevo del ENUM:
  `db:migrate` corre cada archivo en una transacción y `ALTER TYPE … ADD VALUE`
  no puede usarse en la misma transacción.
- **Universidades:** UCATECI, UNPHU, UTESA y UASD; «UCteci» se leyó como
  repetición de UCATECI y la que el solicitante no recordaba como UASD
  (suposición, por confirmar).

**Revisión de la documentación maestra.** Se contrastó con el código y la base
y se corrigió: cifras de la base (85 tablas, 833 columnas, 8 enums, 154 FKs,
33 triggers; antes 36–37), rango de migraciones (`0001`–`0090`), 31 módulos (se
añadió Transporte, que no figuraba), roles `dir_habitudes` y `chofer`, y el
stack: el catálogo decía Auth.js, React Query, React Hook Form y Zod, y el
proyecto usa Supabase Auth, Server Actions y validación manual (ninguna de esas
librerías está en `package.json`). S4 figuraba «en curso» y está completo.
**Sigue desfasado:** el diccionario de datos (llega a `0019`) hay que
regenerarlo desde la base.

**Verificación.** `tsc`, `lint`, `build`, `i18n:check` (5,548 claves) y
`audit:ui` en verde; migraciones `0087`–`0090` aplicadas. **Limitaciones:** no
probado en navegador con un viaje real, y el GPS web se suspende con el
teléfono bloqueado (un seguimiento fiable pediría app móvil). Sin pruebas
automatizadas del dominio.

---

## 19 nov 2026 — Seguridad y alcance del asistente de IA; base de conocimiento editable

**Petición.** Que el administrador pueda modificar el documento de la base de
conocimiento del asistente de estudiantes; que las acciones de la IA dependan
del rol; que solo responda sobre la Fundación; y capas de seguridad para que no
le inserten JSON ni código.

**Qué se encontró.** Casi todo lo estructural ya existía: el agente lo elige el
servidor según el rol (`AGENTE_POR_ROL`), cada rol tiene herramientas cerradas
con el permiso vuelto a comprobar, las escrituras son propuestas que aprueba una
persona y la salida se pinta como texto plano. Faltaban cuatro cosas: `admin` no
tenía el permiso para tocar el conocimiento, un documento no se podía editar
(solo cargar, activar o borrar), ninguna regla de alcance, y nada impedía que un
texto con código u órdenes llegara al modelo.

**Decisiones y por qué.**
- **Permiso propio `ia.conocimiento`** (solo el agente de estudiantes) en vez de
  darle `ia.administrar` a `admin`: éste además cambia modelos, cuotas y límites.
  Al editar se exige permiso sobre los agentes de antes y de después, para que
  nadie mueva un documento a un agente que no le corresponde.
- **Editar = reemplazar los fragmentos en una transacción** con el mismo
  `fuente_id`; hizo falta una columna `orden` (`0091`) porque los fragmentos de
  un documento no tenían secuencia.
- **Una sola función arma el prompt** (`ensamblarSistema`) para las cuatro rutas
  que llaman al modelo; antes las instrucciones editables podían ir al final y
  pisar las reglas. El bloque fijo de alcance va **último**.
- **Rechazar, no reescribir.** Un reglamento alterado en silencio es peor que
  uno rechazado. Aplica a preguntas y documentos.
- **Datos como no confiables:** resultados de herramientas, fragmentos y datos
  del portal (títulos de tareas escritos por docentes) van envueltos y con
  nuestras etiquetas desarmadas, para que nadie «cierre» el bloque de datos.
- **Alcance:** se mantiene la ayuda con las materias, tareas y notas del propio
  estudiante; quitarla dejaría sin respuesta a quien estudia. **Consecuencia que
  conviene revisar:** como las preguntas con código o SQL se rechazan (pedido
  explícito del solicitante), un estudiante de computación puede preguntar
  conceptos pero no pegar código para que se lo revisen. Es una decisión
  reversible, no un descuido.
- **Invisibles:** los inofensivos (ancho cero, BOM, saltos de página de un PDF)
  se quitan en silencio y se conservan los emoji compuestos; solo se rechazan los
  «tag characters», los selectores de variación y los controles de dirección,
  que son la forma conocida de esconder instrucciones. Rechazar todo invisible
  habría bloqueado textos pegados de PDF y emoji sin proteger nada más.

**Límite honesto.** Los filtros por patrón se pueden esquivar con suficiente
imaginación; no son la garantía. Las garantías son las estructurales de arriba.
La salida del modelo no se filtra: se pinta como texto plano y el prompt prohíbe
código.

**Verificación.** `node --test scripts/probar-ia-seguridad.mjs` (11 pruebas del
sanitizador, la neutralización y el orden del prompt) más las 12 de 360; `tsc`,
`lint`, `build`, `i18n:check` (5,561 claves) y `audit:ui` en verde. **No
probado:** con la API real ni con un documento cargado (la base no tiene ninguno).

---

## 19 nov 2026 — Cambio de nombres y cartas mensuales a patrocinadores

**Petición.** (1) El asistente de IA pasa a llamarse **Elly AI**, el portal es
**Portal GlobalEffect** (según el subdominio) y el proyecto es **Sistema Web
Inteligente para la Gestión Académica y Administrativa de la Fundación Global
Effect**; el nombre «Nexus» no debe aparecer en ningún lado. (2) Sustituir a la
persona externa que traduce y filtra las cartas de los becados a sus
patrocinadores por un agente.

**Renombrado.** Se cambió en interfaz, mensajes, código, documentos, scripts,
`package.json` y los comentarios de las migraciones (solo comentarios; se
comprobó que el SQL no cambió), más los datos de inventario (`0093`). **Quedan
tres excepciones por razones técnicas:** los nombres de archivo de las
migraciones `0057_nexus_ai_*` y `0058_nexus_ai_*` (ya registrados como aplicados;
renombrarlos las haría correr de nuevo), la URL del repositorio en GitHub, y el
campo `agente` de la bitácora contable, que vale «Nexus» en 572 filas: la bitácora
es una cadena de hashes sobre la fila entera y reescribirlas rompería la
verificación, además de que es evidencia de auditoría y no texto de interfaz.
Se asumió que el subdominio es `portal.globaleffect.org` (el QR de los activos
apuntaba a `nexus.globaleffect.org`).

**Cartas: qué se encontró.** Nada recibía correo, y `correo_cola` solo se llenaba:
ningún proceso la vaciaba ni existía el paquete de Resend. Había que construir
también el envío.

**Decisiones y por qué.**
- **Agnóstico del proveedor:** un webhook autenticado recibe un mensaje
  normalizado. Elegir el buzón (Gmail, Resend inbound, n8n) es decisión del
  dueño y puede implicar DNS, así que se dejó como paso de configuración.
- **El código decide, el modelo solo clasifica y traduce.** El modelo no tiene
  herramientas de envío; responde con un esquema cerrado y todo lo que no encaje
  retiene la carta. Sin clave de IA, ninguna carta se envía (se probó).
- **El destinatario sale de la base**, nunca de la carta.
- **El remitente se puede falsificar:** sin SPF/DKIM/DMARC en `pass`, la carta se
  retiene.
- **La traducción se revisa también con reglas** (enlaces, correos, teléfonos,
  cifras y palabras de pago), porque una carta puede pedirle al modelo que los
  añada.
- **Cumplimiento derivado, no marcado:** se calcula desde `correo_patrocinador`
  con un `LEFT JOIN`; no hay casilla que el agente escriba. Una sola carta válida
  por estudiante y mes, impuesta por un índice único.
- **Piloto prudente:** el reenvío automático está apagado; todas las cartas
  esperan la aprobación de administración hasta que se confíe en el agente.

**Verificación.** `node --test` sobre las reglas puras (zona horaria RD alrededor
de las 23:59 del día 20, HTML a texto, validación del veredicto, revisión del
texto saliente) y `npx tsx scripts/probar-correos-entrada.ts` contra la base real
con datos temporales (remitente desconocido, mensaje repetido, sin clave → retenido
sin correo encolado, duplicado del mes, estado en la planilla). **No probado:** con
la API de IA real, con un buzón real ni enviando un correo de verdad.

---

## 19 nov 2026 — Elly AI pasa de Anthropic a Gemini

**Petición.** Usar la API gratuita de Gemini mientras tanto y descartar la de
Anthropic.

**Decisiones y por qué.**
- **Cliente propio por REST con `fetch`**, sin paquete, y desinstalar
  `@anthropic-ai/sdk`. Pasar luego a un plan de pago es la misma API con
  facturación activada, así que no se mantienen dos proveedores.
- **Un archivo puro** (`src/lib/gemini.ts`) concentra la traducción de formatos
  para poder probarlo sin clave: esquemas de herramientas (Gemini rechaza
  `additionalProperties` y otras claves), `systemInstruction`, rol `model`,
  `inlineData` para imágenes y PDF, llamadas paralelas y errores.
- **Firmas de pensamiento (`thoughtSignature`):** Gemini 3 rechaza la siguiente
  petición si la llamada a herramienta que él devolvió no vuelve con su firma;
  por eso cada bloque conserva su parte cruda y se reenvía tal cual.
- **El flujo SSE se acumula en un búfer** porque un evento puede llegar partido.
- **429 es «límite», no «fallo»:** en la capa gratuita será frecuente; el chat lo
  explica y las cartas quedan retenidas (cerrado hacia el lado seguro).
- **Modelo por defecto `gemini-3.1-flash-lite`**, elegido porque fue el único de
  los probados que respondió el 19 nov: `gemini-3.6-flash`, `gemini-3.8-flash` y
  `gemini-flash-latest` devolvían 503 «alta demanda». Se puede subir con
  `GEMINI_MODEL` cuando haya menos demanda. `gemini-2.5-flash` figura como
  deprecado. Un modelo guardado en la configuración de un agente que no empiece
  por `gemini-` se ignora (daría 404). El cliente reintenta dos veces los 500/503.
- Las capas de seguridad (`ensamblarSistema`, `envolverDatos`, revisión de
  entrada) no cambian: viven antes del proveedor.

**Riesgo que se asume y debe saberse.** En la capa **gratuita**, la página oficial
de precios marca «Used to improve our products: Yes» (en la de pago, «No»): Google
puede usar lo enviado para mejorar sus productos. Elly envía a Google el contexto
del estudiante (notas), las cédulas del OCR y las cartas a patrocinadores. Hasta
tener facturación activa, conviene no pasar datos reales sensibles.

**Verificación.** `node --test scripts/probar-gemini.mjs` (11 pruebas: esquemas,
firma que vuelve intacta, llamadas paralelas, SSE partido, bloqueos, códigos HTTP,
PDF en línea), el motor de herramientas con proveedor simulado, y las pruebas de
cartas sin clave. **Probado en vivo** con la clave del proyecto (texto inventado):
chat, llamada forzada de herramienta y flujo en pantalla responden bien; falta
probar el bucle completo de herramientas con aprobación y el OCR con un documento
real.

---

## 19 nov 2026 — Elly AI con dos proveedores intercambiables (Gemini y OpenAI)

**Petición.** Cambiar a una clave de OpenAI porque se necesitaba una IA con API
gratuita para las pruebas.

**Qué se encontró.** La clave de OpenAI es válida y su cuenta tiene `gpt-4o-mini`,
pero responde `credit_balance_exhausted`: **la API de OpenAI no tiene capa
gratuita**, hay que cargar saldo. En cambio Gemini sí la tiene.

**Decisiones y por qué.**
- Como las formas internas del asistente ya eran neutrales (mensajes,
  herramientas, respuestas), se añadió un adaptador de OpenAI
  (`src/lib/openai.ts` puro y `openai-cliente.ts`) y una puerta única
  (`modelo-ia.ts`) que elige el proveedor con `IA_PROVEEDOR`. Cambiar de uno a
  otro es una variable de entorno, no código; esto evita rehacer el trabajo cuando
  llegue la clave definitiva, sea la que sea.
- Diferencias de OpenAI atendidas: la respuesta de una herramienta es un mensaje
  `tool` que debe seguir al del asistente; los argumentos llegan como texto por
  trozos y se unen por índice; se usa `max_completion_tokens`; y un 429 puede ser
  límite de frecuencia o falta de saldo (este último se trata como «no
  configurado», porque esperar no lo arregla).
- Se dejó **Gemini activo** (`IA_PROVEEDOR=gemini`) porque es el que funciona sin
  pagar. OpenAI queda listo para activarse al cargar saldo.

**Verificación.** 58 pruebas (`probar-openai`, `probar-gemini`, cartas, seguridad
y 360), y `scripts/probar-modelo-vivo.ts` contra la API activa (Gemini: chat,
llamada forzada y flujo correctos). **OpenAI en vivo: sin probar** por falta de
saldo.

---

## 19 nov 2026 — Groq como tercera opción de proveedor

**Petición.** Agregar Groq como otra opción gratuita para las pruebas.

**Decisiones y por qué.**
- Groq expone la **misma API que OpenAI** (Chat Completions), así que no se
  escribió un tercer adaptador: `openai-cliente.ts` pasó a ser una fábrica
  (`crearClienteChat`) que recibe dirección, variable de la clave y modelo, y
  `groq-cliente.ts` es una configuración de unas pocas líneas. `modelo-ia.ts`
  elige entre `gemini`, `groq` y `openai` con `IA_PROVEEDOR`.
- **Modelo por defecto `llama-3.3-70b-versatile`**, de los de producción que
  lista la documentación oficial de Groq y con llamadas a herramientas.
- **Limitaciones declaradas, no ocultas:** Groq no lee PDF y las imágenes solo con
  un modelo de visión que debe indicarse (`GROQ_MODEL_VISION`); no se adivinó un
  identificador. Sin eso, el OCR responde «ilegible» y la pantalla pide capturar a
  mano. Un modelo guardado de otro proveedor en la configuración de un agente se
  ignora.
- **No se afirman cifras del plan gratuito ni la política de datos de Groq:** la
  documentación consultada no las mostraba; se dejó como tarea comprobarlas en la
  consola con una clave real.

**Verificación.** `tsc`, `lint`, `build`, las 58 pruebas y un script que ejercita
la elección de proveedor y de modelo en cinco configuraciones. **Groq en vivo: sin
probar** (aún no hay clave).

---

## 19 nov 2026 — Groq y OpenAI combinados: cadena con respaldo

**Petición.** Usar a la vez la clave de OpenAI y la de Groq.

**Decisiones y por qué.**
- «Combinadas» se resolvió como **cadena con respaldo**, no como reparto al azar:
  `IA_PROVEEDOR=groq,openai` usa Groq (gratis) y, si falla por cualquier causa
  (límite de frecuencia, sin saldo, caída, una llamada a herramienta mal
  formada), prueba con OpenAI. Los proveedores sin clave se saltan.
- La lógica es **pura y está aparte** (`src/lib/respaldo.ts`) para probarla con
  proveedores falsos. En un flujo, **si ya se mostró texto no se cambia de
  proveedor a mitad**: no se puede desescribir y se mezclarían dos voces.
- Cada proveedor usa **su propio modelo**: el modelo pedido solo vale si es suyo.
  El OCR salta a los proveedores capaces de leer ese tipo de archivo (Groq no lee
  PDF). La respuesta lleva el modelo que de verdad respondió, y el medidor de uso
  lo registra.
- **Hallazgo en vivo:** `llama-3.3-70b-versatile` ya no existe en la cuenta de Groq
  (404); se listó `/models` y se eligió `openai/gpt-oss-120b`, con razonamiento
  bajo para que no consuma el presupuesto de salida.
- La cuenta de OpenAI sigue sin saldo; como respaldo no aporta hasta cargarla.

**Verificación.** 65 pruebas, entre ellas 7 del respaldo; en vivo, la cadena
responde con Groq y, al romper a propósito el modelo de Groq, cae a OpenAI (que
falla con «sin saldo», como se esperaba).

---

## 19 nov 2026 — Mapa del sitio como buscador y voz para Elly AI

**Peticiones.** (1) Que el mapa del sitio ayude a encontrar cada cosa y que se vea
dónde está la base de conocimiento del agente; (2) que Elly reciba preguntas e
instrucciones por voz y que pueda hablar con los usuarios.

**Mapa del sitio.** El mapa ya se derivaba de los menús, pero no incluía el menú de
Configuración (de ahí que la base de conocimiento no apareciera) y era una lista
larga. Se rehízo como buscador con «cómo llegar», derivado de `menuDe` y de
`ajustesDeUsuario`, con búsqueda tolerante (tildes, plurales, palabras vacías). Al
revisarlo con los menús reales se vio que las cartas a patrocinadores no estaban en
ningún menú y se añadieron. **La base de conocimiento está en Configuración →
Ajustes → Conocimiento (`/configuracion/conocimiento`).**

**Voz.** Se eligió la **Web Speech API del navegador** para dictar y para hablar:
gratis, sin clave y sin depender del proveedor de IA. La lógica que se puede probar
(limpiar el texto para leerlo —sin asteriscos, rutas ni emoji—, trocearlo porque
Chrome corta locuciones largas, elegir la voz latinoamericana) es pura y está
probada. «Conversación por voz» une las dos mitades: lo dictado se envía al
terminar y la respuesta se lee; al empezar a dictar se calla la lectura para que el
micrófono no oiga a Elly. Lo dictado entra al chat como cualquier pregunta, con las
mismas revisiones de seguridad.

**Límites declarados.** No se probó en un navegador real. El dictado lo procesa el
servicio del navegador (en Chrome, Google), lo que importa para la política de datos
con estudiantes. Firefox no tiene reconocimiento de voz. Una alternativa que
resolvería ambos es transcribir en el servidor con Whisper de Groq.

---

## 19 nov 2026 — Detalle del expediente por pestañas y enlace patrocinador ↔ estudiante

**Peticiones.** (1) Que la información de la persona aparezca primero y lo
académico se separe por tipo (personal, perfil, 360, universidad, familia…), con el
**grupo** del estudiante (van por el 10), cuánto lleva en la Fundación, y el
pénsum, la graduación y el récord de notas; (2) que Patrocinadores (lista y becas),
los expedientes y los estudiantes estén vinculados entre sí.

**Decisiones y por qué.**
- **Pestañas del cliente, no por enlace.** Cada apertura del expediente escribe
  una fila `expediente.consultado` y esa auditoría cuenta aperturas; con una
  pestaña por URL cada clic habría contado otra. Todo se pide una vez (son unas
  decenas de filas de una persona) y la pestaña activa se refleja en `?seccion=`
  sin navegar.
- **Grupo = número simple, sin tope y nullable** (`0094`): sigue creciendo y no se
  adivina por la fecha de ingreso; los existentes quedan «sin grupo». Está por
  confirmar si es la cohorte de Habitudes o la generación de la beca.
- **Antigüedad calculada desde `fecha_ingreso`** con meses cumplidos y el
  aniversario del día 31 (o 29 de febrero) adelantado al último día del mes corto;
  sin fecha de ingreso se dice, no se cae a la fecha de creación del expediente.
  El «hoy» es el de La Vega, no el de un servidor en UTC.
- **Nada inventado en pénsum y graduación.** El catálogo de pénsum (fase 2) y los
  récords con OCR (fase 4) no existen aún: el récord de notas muestra lo real
  (notas por período, índice del período y acumulado, tendencia); el pénsum dice
  que está pendiente; la fecha de graduación se deduce del historial de etapas, no
  de una segunda columna que pudiera contradecirlo.
- **El vínculo ya existía en los datos** (`asignacion_beca`) y faltaba en la
  pantalla: se añadió la ficha del patrocinador con sus estudiantes y los enlaces
  lista → ficha, becas → expediente y patrocinador, y expediente → patrocinador.
- La página de detalle bajó de 396 a ~210 líneas al sacar los textos del
  formulario a un helper y cada pestaña a su componente.

**Verificación.** `tsc`, `lint`, `i18n:check`, `audit:ui`, `build`, 5 pruebas de
antigüedad (fecha futura, nula, 29 de febrero, día 31) y las consultas nuevas
contra la base real (expediente, seguimiento de 12 meses, patrocinador y sus
becados). **No visto en pantalla.**

---

## Pendiente de registrar (se completará al cerrar cada etapa)

- Nada por registrar de las etapas 1 a 4: todas tienen su entrada. Las pruebas contra base real y navegador siguen pendientes (ver limitaciones de cada una).
