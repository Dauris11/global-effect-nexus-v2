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

## Pendiente de registrar (se completará al cerrar cada etapa)

- Etapa 3 (parte 2) — asistencia, fechas, nota final, expediente (ver arriba).
- Etapa 4 — administrativo como ERP: bandeja y solicitudes a contabilidad.
