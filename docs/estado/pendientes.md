# Pendientes

Lista de tareas abiertas que se van marcando conforme se resuelven. Se actualiza
en cada sesión de trabajo: lo que se cierra se tacha o se quita, lo nuevo que
aparece se agrega. No sustituye a [`docs/estado/progreso.md`](progreso.md) (estado por
módulo) — esto es solo la cola de pendientes concretos.

## Abiertos

- [x] **Documentación de Entregables de Grado (UCATECI Entregas 1 a 6):** Actualización
      maestra de [`docs/entregables/contexto-general.md`](../entregables/contexto-general.md) y
      [`docs/06-plan-de-entregas.md`](../06-plan-de-entregas.md) para cubrir los 30 módulos funcionales,
      los 6 portales de rol, el subsistema contable formal homologado a DGII (NCF B01/B02/B14/B15/E31,
      Formatos 606/607, arqueos de caja con desglose de denominaciones y alerta de fraude $\ge$ RD$200),
      el inventario físico de activos con códigos QR imprimibles y escaneo móvil, la Torre de Control
      del colaborador, el aula virtual Moodle Global 360 y la agenda institucional de reuniones.
- [x] **Asistente de IA Flotante (Widget Universal):** Pop-up flotante interactivo
      accesible en todas las pantallas del sistema tras iniciar sesión
      (`WidgetFlotanteIA` en `(portal)/layout.tsx`), selector de modo
      («Consultas» vs «Acciones»), comandos de voz vía Web Speech API, base de
      conocimiento por departamento/rol, restricción estricta para estudiantes
      (solo consultas sobre normativas de la Fundación y vida académica), y
      ejecución de acciones con tarjetas interactivas y navegación automática
      (migración `0038_ia_asistente_global.sql`).
- [x] **Contabilidad, Fase 3:** Proveedores, cuentas por pagar y Gantt de
      vencimientos completados (migración 0037, validación RNC/cédula,
      pantallas /contabilidad/proveedores, /contabilidad/cuentas-por-pagar,
      /contabilidad/cuentas-por-pagar/gantt, /contabilidad/facturas/[id], y
      alertas antifraude correspondientes).
- [x] **Torre de Control del Colaborador ("Lo que me toca hoy"):** Centro operativo
      diario para cada empleado (`/administrativo/tareas/hoy` y `VistaHoy`),
      con tareas para hoy, tareas vencidas y tareas por hacer; estados de avance
      reales (`por_hacer`, `en_progreso`, `en_revision`, `completada`), bitácora diaria
      de actividades con registro de horas y minutos (`colaborador_bitacora_diaria`),
      resumen de indicadores en cabecera y autoasignación de tareas prioritarias
      (migración `0041_torre_control_y_rendicion_gastos.sql`).
- [x] **Gestión de Proyectos Institucionales por Rol (Gobierno Superadmin):**
      Asignación y gobernanza exclusiva de proyectos por el `super_admin`
      (`/administrativo/proyectos/roles` y `MatrizProyectosRoles` con permisos `proyectos.asignar_rol`),
      asociando proyectos a roles institucionales (`admin`, `docente`, `contabilidad`, `habitudes`)
      en `public.proyecto_rol`, visualización contextual de programas en la jornada del colaborador.
- [x] **Rendición de Gastos y Facturas de Empleados hacia Contabilidad:** Flujo
      integrado (`/administrativo/rendiciones`, `FormularioRendicionGasto`, `ListaRendiciones`)
      para que cualquier colaborador institucional con `rendicion.enviar` cargue comprobantes fiscales
      con captura de foto y escaneo inteligente de OCR (NCF dominicano B01/B02/E31, RNC, proveedor, montos e ITBIS),
      imputación a programas sociales (Casa de Herramientas, Becas, etc.) y bandeja de aprobación
      y rechazo con validación fiscal ante DGII para Contabilidad (`rendicion.revisar`).
- [x] **Global 360 y Aula Virtual (Estilo Moodle):** Selección y matrícula cuatrimestral
      obligatoria en 2 rondas por cuatrimestre (Ronda 1: Regular, Ronda 2: Ajustes y Bloque 2)
      con horarios, aulas/Zoom, cupo máximo y docentes asignados (`MatriculaCuatrimestral360` en `/portal/estudiante/global-360`);
      módulo de tareas estilo Moodle con restricciones estrictas de formato (`.pdf`, `.docx`, `.zip`),
      límite en MB (`limite_mb`), rúbricas (`instrucciones_entrega`), buzón de entregas estudiantil con notas (`BuzonTareaMoodle` y `BotonBuzonMoodle`),
      calificaciones con feedback docente y plantillas rápidas (`EvaluadorEntregasMoodle`), y
      **Vista de Estudiante** interactiva (`VistaEstudianteModal`) para que el docente simule y verifique la experiencia del alumno sin alterar datos reales
      (migración `0042_aula_virtual_moodle_y_matricula_360.sql` y `scripts/seed-moodle-g360.mjs`).
- [x] **Programa Habitudes — Hub Colaborativo y Evidencias de Liceos:** Repositorio
      compartido de diapositivas (`.pptx`), guías de facilitador (`.pdf`), dinámicas de taller (`.docx`)
      e infografías didácticas con contador de descargas y subida colaborativa (`HubRecursos` en `/habitudes`);
      módulo móvil nativo de registro de visitas a liceos de La Vega con captura de evidencias fotográficas
      vía cámara del smartphone (`<input capture="environment" accept="image/*">`), selector de tanda,
      conteo rápido de estudiantes impactados (+5/+15/+30) y galería visual de evidencias en alta resolución
      con lightbox interactivo (`RegistroVisitaLiceo` y `GaleriaEvidencias`),
      respaldado por la migración `0043_habitudes_hub_y_evidencias_liceos.sql` y `scripts/seed-habitudes.mjs`.
- [x] **Inventario Institucional y Activos Fijos con Códigos QR (Módulo 30):** Catálogo de mobiliario,
      herramientas (Casa de Herramientas), tecnología, electrodomésticos y vehículos (migración `0040_inventario_activos_qr.sql`);
      captura y visualización de fotografías, generación automática e impresión de etiquetas con Códigos QR
      corporativos de alta resolución, y escáner móvil de cámara web in situ (`/administrativo/inventario/escanear`)
      con registro de actas de auditoría física y trazabilidad histórica.
- [x] **Arquitectura Móvil Nativa y Dock de Acceso Rápido:** Manifiesto PWA (`manifest.webmanifest`)
      en `src/app/manifest.ts` para modo standalone en iOS/Android sin barra de URL, barra inferior táctil
      con botón central elevado de acceso rápido táctil (`BarraInferior`) y cajón deslizable nativo
      (`CajonAccionesRapidas`) con atajos a cámara QR, rendición de comprobantes, tareas del día, agenda y Nexus IA por voz.
- [ ] **Agenda de Reuniones Institucionales para Todo el Personal:** Agendamiento de
      reuniones internas entre colaboradores y citas solicitadas por estudiantes (asesorías,
      tutorías, seguimiento administrativo), extinguiendo definitivamente las citas clínicas.
- [x] **Contabilidad, Fase 4:** Cajas y cuadre de caja completados (migración `0039_contabilidad_cajas_y_asignacion.sql`, reposición desde banco con `contabilidad.reponer_caja`, pantallas `/contabilidad/cajas`, `/contabilidad/cajas/[id]`, contador interactivo de arqueos por denominación DOP/USD en `/contabilidad/cajas/[id]/arqueo`, alertas automáticas de descuadre `diferencia_caja`, OCR inteligente de facturas de proveedores con asignación doble a solicitante y programa institucional, e importación/exportación a Excel .xlsx con auditoría).
- [ ] **Contabilidad, a validar con el contador:** la tasa de referencia para
      valorar dólares en pesos es la **venta** del BCRD
      (`contabilidad.tasa_referencia`); puede preferir compra o promedio.
- [ ] **Contabilidad:** la vista `public.transaccion` (compatibilidad con el
      panel general, `/reportes` y el asistente) está en dólares; un recibo en
      pesos sin tasa registrada para su fecha **no aparece ahí**. Se resuelve
      en la Fase 7, cuando esas pantallas lean los recibos directamente.
- [ ] **Contabilidad:** no hay pantalla de Configuración contable (§4.13): un
      banco nuevo, una cuenta real o las columnas del estado de cuenta se
      cargan por SQL. Antes de usar el módulo con cuentas reales.
- [ ] **Contabilidad:** los adjuntos se suben y se descargan (con bitácora),
      pero todavía no se pueden archivar desde la pantalla.
- [ ] **Datos de prueba en la base de desarrollo:** el recibo RI-000001
      «PRUEBA E2E» (RD$2,500.75) y una conciliación abierta de Santa Cruz DOP
      del 1 al 4 oct 2026. Se crearon al probar la Fase 2 en el navegador; en
      contabilidad nada se borra, así que se quedan (anular el recibo exigiría
      descartar antes su pareja en la conciliación).
- [ ] **Faltan claves de `landing`** en `messages/*.json`
      (`access_portal_desc`, `role_students`, `heroCarousel`, `searchPill`…):
      `npm run build` avisa `MISSING_MESSAGE` en `/`. Ya faltaban en
      `cca04bf`; `i18n:check` no las ve porque `page.tsx` usa varios
      espacios de nombres.
- [ ] **`npm run audit:ui` falla con 299 hex sueltos** en `.tsx` (sobre todo
      el `SEMAFORO` escrito como `bg-[#1E9E6A]` en solicitudes, patrocinadores,
      operaciones y perfil). Ya fallaba en `cca04bf`, antes de contabilidad (299; 288 tras retirar la pantalla vieja de `/contabilidad`). Lo nuevo de contabilidad no añade ninguno: las insignias del semáforo están en `INSIGNIA_SEMAFORO` de `paleta.ts`.
      Decidir si `scripts/auditar-ui.mjs` admite el `SEMAFORO` (la norma lo
      exige escrito así) o si pasa a un token.
- [ ] **Contabilidad:** `usuario_permiso` no tiene pantalla. Hoy una
      excepción solo se da por SQL; hace falta en `/configuracion` antes de
      que exista un auxiliar contable.
- [ ] **Habitudes, a medias.** Ya tiene una puerta que abre
      (`/administrativo/solicitudes`): pide el alta de un candidato del embudo
      y la aprueba administración. Pero `/expedientes` sigue cerrada para ese
      rol (exige `expedientes.leer`) y `expedientes.postular` sigue sin
      acción: no puede **crear** la ficha de un candidato nuevo. Decidir si la
      crea Habitudes (ficha mínima del embudo) o administración al recibir la
      solicitud.
- [ ] Los dos `.drawio` de `docs/04-modelo-de-datos/` todavía dibujan las
      tablas de psicología. Los `.md` y el `.dbml` ya están al día; los
      diagramas hay que rehacerlos en draw.io.
- [ ] En `docs/entregables/contexto-general.md`, la fila de S8 (ahora «Solicitudes y
      aprobaciones») conserva las fechas planificadas del sprint viejo
      (26 oct–06 nov 2026) y figura como completada. Ajustar las fechas.
- [ ] Los avisos de un paso de solicitud sin comentario llevan en `mensaje` el
      código del estado (`aprobada`, `pendiente_direccion`): la campana
      traduce el `tipo` pero no el mensaje, que es dato. Si molesta, la campana
      puede traducir el mensaje cuando el tipo es `solicitud`.
- [ ] El lector de documento del expediente está construido y **no puede
      responder**: es la misma clave de Anthropic que
      devuelve 401. Las pantallas lo distinguen de un fallo pasajero y dicen
      «avisa al equipo técnico» en vez de invitar a reintentar en bucle.
- [ ] Decidir si los escaneos se guardan. Hoy **no**: el archivo va al modelo y
      se descarta, y lo que queda es el rastro en `extraccion_ocr` (modelo,
      confianza y campos leídos) con `documento_id` en NULL. Guardar documentos
      de identidad de menores es una decisión de política de datos, no un
      detalle técnico; el bucket privado está listo el día que se decida.
- [ ] Los parámetros institucionales no se pueden editar desde
      `/configuracion` porque **no existe tabla donde guardarlos**, y la
      pantalla lo dice. Lo que hoy son parámetros vive donde se usa (la hora de
      corte del comedor sale del mismo SQL que la lista de cocina). Si se
      quieren centralizar, es una migración.

- [ ] El componente `EnConstruccion` (`src/components/layout/en-construccion.tsx`)
      se quedó **sin un solo uso** al construirse los siete esqueletos, y sus
      dos claves de i18n (`common.buildingTag`, `common.buildingTitle`) siguen
      en los dos diccionarios. Decidir si se borra —con las claves— o si se
      deja como herramienta para la próxima ruta que se abra antes de estar
      construida. No se tocó porque borrarlo arrastra una limpieza de i18n que
      nadie pidió.
- [ ] `academia.participantes` es un número **que se teclea**: no existe tabla
      de inscripción a una academia, así que no hay de dónde contarlo. La
      pantalla lo dice en voz alta. Si hace falta saber quién está en cada
      programa —y para pasar lista hace falta—, es una tabla nueva, no un
      número mejor mantenido.
- [ ] `academias/materiales`: si una transacción falla DESPUÉS de subir el
      archivo, el archivo queda huérfano en el bucket. Se anota su ruta en el
      registro del servidor para poder limpiarlo, pero **no hay barrido** que
      lo haga solo. Con el volumen de una fundación no urge; si algún día
      urge, es un `documento` sin `material` que lo nombre, que se encuentra
      con una consulta.
- [ ] `transaccion.categoria` es TEXT **sin CHECK** (migración 0011). La lista
      de siete categorías vive en `src/lib/finanzas.ts` y la respetan las dos
      pantallas, pero nada impide que un INSERT por SQL cree una octava. Si
      importa que la base lo sostenga, es una migración de una línea.

- [ ] `ANTHROPIC_API_KEY` en `.env.local` devuelve 401 — el chat IA y el OCR de
      expedientes no funcionan hasta tener una clave válida.
- [ ] Decidir el valor real de `envio_correo_patrocinador` (TEXT sin CHECK):
      la migración 0005 comenta `pendiente/enviado/no_aplica`, pero
      `docs/prototipo-base44/prompt-formulario-expediente.md` y las etiquetas traducidas usan `sí/no/pendiente`.
- [ ] Nombres y edades de hermanos/hermanas en Expedientes: `docs/prototipo-base44/prompt-formulario-expediente.md`
      pide campos de texto libre, el esquema solo tiene `hermanos_cantidad`.
      Elegir entre añadir columnas o usar filas de `familiar` (ya admite
      `hermano`/`hermana`).
- [ ] No se puede probar el login en local: la sesión la da Supabase Auth y el
      proyecto de Supabase original ya no existe. Falta un proyecto nuevo (o
      equivalente local) para crear las identidades de los 6 usuarios demo. Por
      esto tampoco se pudo probar visualmente, con sesión real de psicólogo, la
      edición de expedientes de más abajo — quedó verificada por SQL directo y
      `tsc`/`eslint`, no en el navegador.
- [ ] "Usa iconos, animaciones y efectos hover para todo el sitio y portales"
      (pedido en esta sesión): se aplicó con fuerza a lo que se tocó ahora
      (expedientes: salida, previsualización, borrado), pero un repaso de
      **todo** el sitio y los 6 portales es un trabajo grande y transversal —
      no se hizo un barrido general. Si se quiere, conviene tratarlo como
      tarea propia (posiblemente con `/design` o un barrido módulo por
      módulo), no colarlo dentro de otro pedido.

- [ ] Los dos períodos que hay en la base están desfasados y la pantalla nueva
      los señala: `2026-I` sigue marcado `activo` pero terminó el 28 de abril, y
      `2026-II` sigue `planificado` aunque empezó el 5 de mayo. Mientras estén
      así, cada nota que se registre cae en el cuatrimestre equivocado. Son
      datos del seed: hay que poner los períodos reales de la Fundación desde
      `/academico/periodos`, no arreglarlo en código.
- [ ] `admin` (coordinación) **no tiene `calificaciones.registrar`** en
      `rbac.ts`, así que entra a `/academico/calificaciones` y lee, pero no
      puede poner ni corregir una nota. Se implementó respetando la base, que
      es la norma del proyecto. Si coordinación tiene que poder calificar, es
      un cambio en la tabla `rol_permiso` **y** en `rbac.ts`, no en la
      pantalla.
- [ ] **Decidir si la matrícula universitaria tiene tope.** No se implementó
      ninguno porque no existe: `materia` no tiene columna de capacidad y no
      hay máximo de créditos escrito en la base ni en la especificación.
      Inventar un número habría sido inventar una norma académica. La pantalla
      enseña el total de créditos elegidos y dice en voz alta que no hay tope.
      Si lo hay, hacen falta las dos cosas: la columna (o la constante) y la
      comprobación dentro del INSERT.
- [ ] `inscripcion` **no tiene el trigger** que sí protege a `inscripcion_360`
      ("solo becados"). La regla vive únicamente en
      `src/server/estudiantes/acciones-matricula.ts`, así que un script que
      escriba directo en la tabla se la salta. Si importa que la base la
      sostenga, es una migración de tres líneas copiando `solo_becado_en_360`.
- [ ] **Seis filas tienen la fecha de fin ANTES que la de inicio**, y la línea
      de tiempo las señala: tres asignaciones `[demo]` publicadas el 10 de
      agosto con vencimiento el 25 de julio, el 1 y el 6 de agosto; y tres
      tareas administrativas creadas el 28 de julio con fecha límite del 8, 18
      y 26 de julio. Las asignaciones son un dato mal puesto del seed. Las
      tareas puede que no lo sean —registrar una tarea vencida es legítimo—,
      pero entonces `created_at` no sirve como fecha de inicio y a `tarea` le
      falta una columna propia. Decidir cuál de las dos cosas es.
- [ ] `materia_360` **no guarda ni fechas ni período**. Su barra en la línea de
      tiempo se deduce de los períodos donde tiene inscritos, que es la única
      pista real, y una clase sin inscritos no se puede situar en el tiempo y
      no aparece. Si el programa 360 tiene calendario propio, le falta la
      columna.
- [ ] Ni `materia` ni `curso` tienen fechas propias: heredan las del período,
      así que en el Gantt todas sus barras miden lo mismo. Está dicho en
      pantalla, pero si una materia puede empezar más tarde que su
      cuatrimestre, hace falta la columna.

- [ ] Las notificaciones **se escriben pero no se leen**: crear una tarea deja
      un aviso por asignado en `notificacion`, y no hay campana ni bandeja en
      el armazón donde verlos. Mientras no la haya, el aviso existe solo en la
      base. Es pantalla propia, pequeña, y encaja en el armazón (`app-shell`).
- [ ] La guía maestra nombra **cinco permisos que no existen** en `rbac.ts`:
      `estudiantes.leer`, `academias.leer`, `academias.escribir`,
      `reportes.leer` e `ia.consultar`. Los 19 reales están en `PERMISOS`. Al
      construir academias, servicios, reportes y chat IA hay que elegir con
      cuáles se cierran esas puertas (o añadirlos a `rol_permiso` y a
      `rbac.ts`, que es un cambio de base).

## Hechos el 4 de octubre de 2026 — cimientos de contabilidad

- [x] **Fase 2 (0036):** bancos y cuentas (Santa Cruz USD/DOP, DEMO), libro
      de banco, recibos de ingreso y comprobantes de egreso, transferencias
      con diferencia cambiaria y conciliación por CSV; contabilizar, anular y
      transferir son funciones de la base. `transaccion` pasó a recibos y
      quedó como vista. Retirados la pantalla vieja y `finanzas.escribir`; los
      gastos de Solicitudes los revisa ahora `contabilidad.aprobar`.
- [x] Adaptadores de banco (`src/server/contabilidad/bancos/`) sin layout
      inventado y monto en letras propio (es/en, DOP/USD).
- [x] Pruebas: `npm run db:probar:contabilidad` (19) y
      `npm run test:contabilidad` (53).

- [x] Esquema `contabilidad` con secuencias sin huecos, parámetros con
      vigencia, períodos, catálogo, fondos, categorías y asientos con cuadre
      diferido (0032); bitácora (0033); permisos finos y `usuario_permiso`
      (0034).
- [x] **0035:** la cadena de hash de la 0033 no se podía verificar (el
      disparador encadenaba por tabla, el verificador en global, el orden era
      aleatorio dentro de una transacción y el hash no cubría motivo, IP ni
      hora). Ahora es una cadena global con `orden` sin huecos, hash de la fila
      entera y un verificador que dice qué fila y por qué (`hueco`, `enlace` o
      `hash`). Además: nada se borra (DELETE y TRUNCATE prohibidos), los
      períodos cerrados no se tocan y los roles de la API pública no ven el
      esquema.
- [x] `requerirPermiso` resuelve los permisos por persona (rol + excepciones).
- [x] Restaurado `finanzas.escribir` del rol `contabilidad` en `rbac.ts`: se
      había quitado solo ahí (la base lo seguía dando) y la pantalla vieja de
      `/contabilidad` se quedaba sin escritura.
- [x] `npm run db:probar:contabilidad`: 13 pruebas, todas en verde.

## Hechos el 3 de octubre de 2026 — de psicología a ERP

- [x] **Psicología, fuera.** La Fundación cerró el departamento. Migración
      `0030`: las cuentas `psicologo` pasan a `admin`, se borran el rol, los
      permisos `psicologia.*`, las tres tablas clínicas, `estudiante.psicologo_id`
      y los avisos de tipo `cita`. Se borraron las tres rutas, el código del
      módulo, el script `db:asignar:psicologos` y el espacio `psychology` de
      los dos diccionarios. `audit_log` no se tocó: el visor sigue tapando el
      detalle de esas filas viejas.
- [x] **El expediente vuelve a administración, entero.** `admin` y
      `super_admin` leen, escriben y borran cualquier ficha; se acabó el
      aislamiento por fila de la `0025`. Las acciones comprueban el permiso, no
      el rol.
- [x] **Solicitudes y aprobaciones** (migración `0031`). Trámites del
      estudiante (constancia, carta, cita con administración, permiso, otro) y
      aprobaciones internas (alta de expediente, beca, gasto), con flujo por
      pasos, segundo nivel de dirección, separación de funciones, folio, línea
      de tiempo, avisos y auditoría. Pantallas `/portal/estudiante/solicitudes`
      y `/administrativo/solicitudes`. El portal administrativo cuenta lo que
      espera **tu** decisión, y las citas con administración salen en los dos
      calendarios (y se pueden mover desde el del personal).
- [x] **Documentación reescrita como ERP**: los `.md` de la raíz, `docs/` y
      `db/README.md`. `docs/entregables/` y el CSV de ClickUp no se tocaron:
      son entregas ya hechas y datos de origen.
- [x] **`0030` y `0031` aplicadas en Supabase** el mismo día, cuando el
      proyecto volvió de la pausa. Sin respaldo, por decisión del usuario: las
      4 citas y 2 notas que se borraron eran las del seed de demostración. La
      cuenta de psicóloga quedó en `admin`, y `db:seed:portales` sembró las 3
      solicitudes de demostración.
- [x] Verificado: `tsc`, ESLint, `i18n:check` (1945 claves, simétricas),
      `next build`, la auditoría de color, y 52 comprobaciones del flujo
      contra PostgreSQL local (crear, duplicar, fechas pasadas, tomar,
      aprobar, dirección, rechazar sin motivo, separación de funciones,
      calendario, agenda y expedientes).

## Hechos el 6 de septiembre de 2026

- [x] **Lo que quedaba de `docs/estado/inventario-vs-fases.md`, construido.** Once cosas, y
      ninguna de ellas era una pantalla nueva de relleno:
      · **Campana de avisos** en la barra superior. `notificacion` se escribía
        desde la 0003 y no había forma de leerla. La lista y el contador salen
        de **una sola consulta** —`count(*) FILTER (WHERE NOT leida) OVER ()`,
        que las funciones de ventana se calculan antes del LIMIT— porque la
        campana se pinta en cada página interna y dos viajes al pooler por
        página, para siempre, por un número que casi siempre es cero, no.
        Pulsar un aviso lo marca leído **y** navega, en el mismo gesto; nada se
        borra, porque un aviso es el rastro de que a alguien se le dijo algo.
      · **#433 · Aviso al psicólogo.** La solicitud de cita y el aviso van en
        una sola transacción: si el aviso fallara aparte, la cita quedaría en
        la bandeja sin que nadie se enterara, que es el fallo que #433 cierra.
        `titulo` y `mensaje` son DATOS (el nombre del estudiante, su fecha
        preferida) y no una frase traducida: la tabla guarda una sola copia y
        quien la lee puede tener la interfaz en otro idioma. Lo que la campana
        traduce al pintar es la etiqueta del tipo.
      · **#423 · Registrar cita** desde el módulo, con las claves de i18n que
        ya estaban escritas. La comprobación de que el estudiante es suyo va
        **dentro del INSERT** (`INSERT ... SELECT ... WHERE e.psicologo_id`), no
        en un `if` previo: un `if` serían dos viajes, una rendija entre ambos y
        una segunda definición de la frontera de confidencialidad.
      · **#372 · Lector de documento en psicología.** Busca con `similarity()`
        de pg_trgm y no con `ILIKE`: el OCR devuelve «MARIA PEREZ» donde el
        expediente dice «María Pérez». **No elige por nadie**, ni con una sola
        coincidencia al 99%.
      · **#428 · Rastro de lectura del expediente.** Abrir una ficha escribe
        `expediente.consultado`. Va en la página y no en la consulta, que
        también la usa `generateMetadata`: ahí serían dos y tres filas por
        visita y el registro dejaría de contar aperturas.
      · **Visor de `audit_log`** (`/configuracion/auditoria`), solo
        `super_admin`. **Lo clínico se tapa en el SELECT**, no en la vista: las
        filas de citas y notas salen sin `datos` y sin `entidad_id`, así que el
        dato no sale de la base. La 0025 le quitó a `super_admin` los permisos
        de psicología y un visor que los devolviera por detrás sería peor que
        no tener visor. Queda dicho en la propia pantalla: desde el sitio **no
        se puede auditar el contenido** de psicología.
      · **Configuración**: cuentas del equipo (se enumeran; gestionarlas sigue
        siendo `/administrativo/personal`, y se enlaza), los siete roles con sus
        permisos **recorriendo la misma función que decide los accesos**, y el
        aviso de que los parámetros institucionales no existen como tabla.
      · **Alta de expediente**: seis tablas en una transacción. Los tres
        perfiles se insertan aunque vengan vacíos, para que no exista el estado
        intermedio de un expediente sin `perfil_vivienda` —cualquier consulta
        futura que los una con `JOIN` en vez de `LEFT JOIN` haría desaparecer al
        estudiante de su propia lista—. Al terminar lleva a la ficha creada.
      · **Lector de documento en el alta**: precarga nombre, cédula y fecha con
        el porcentaje de confianza a la vista. Solo en el alta: en la edición,
        precargar encima de lo escrito no es una ayuda. Y avisa de que
        precargar reemplaza, porque los campos son no controlados y la precarga
        los remonta.
      · **Gráfico de tendencia** en la ficha, con el eje **fijo de 0 a 4** —con
        eje automático, un estudiante entre 3.6 y 3.8 dibujaría una montaña
        dramática— y la línea de prueba académica dibujada siempre. Se agrupa
        en JavaScript a propósito: el índice sale de `notasDelEstudiante`, que
        usa el gpa guardado cuando existe, y agrupar en SQL obligaría a escribir
        la escala de conversión dentro de la consulta.
      · **Calendario del docente**: lo que vence en sus clases, sobre las tres
        vías que puede dar, enlazadas por la clave del docente y nunca por su
        nombre (la 0019 existe por eso). Antes abría el calendario, no veía nada
        suyo y no volvía.

- [x] **Comprobado contra la base local, no solo con `tsc`.** Las doce consultas
      nuevas corridas de verdad, y las escrituras —el alta de expediente en sus
      seis tablas, el registro de cita, el aviso, el marcado de la campana, el
      rastro del OCR y el del expediente— dentro de una transacción con
      `ROLLBACK`. Se comprobó además que el INSERT del registro **no casa
      ninguna fila** con un psicólogo ajeno, y que el visor devuelve la fila
      clínica con `datos` y `entidad_id` en NULL y `reservado` en cierto. La
      base quedó como estaba. `npm run build`, `tsc`, `lint`, `i18n:check`
      (1998 claves, es/en simétricos) y el grep de color, en verde. **Lo que no
      se pudo probar sigue siendo el navegador con sesión real**: no hay
      proyecto de Supabase.

- [x] **El PostgreSQL local estaba migrado solo hasta la 0024.** Le faltaban las
      cinco últimas, así que `asignacion.curso_id` (0028) y `materia_360`
      (0027) no existían y media docena de consultas del repo no se podían
      probar contra él. Aplicadas con `npm run db:migrate`, que es idempotente.

- [x] **Los siete esqueletos que quedaban, construidos.** No queda ninguna
      pantalla que avise de que no está hecha. Uno por uno:
      · **`/contabilidad`** — movimientos con alta, corrección y borrado,
        filtros en la URL (concepto/referencia, tipo, categoría y mes) y
        reparto por categoría. **Las sumas se hacen en SQL**: `monto` es
        NUMERIC y `pg` lo entrega como texto para no perder precisión, así que
        el `::float8` va siempre DESPUÉS del `sum()`. Las cifras salen del
        conjunto filtrado entero, no de las 200 filas que se pintan. El
        selector de mes sale de **los meses que tienen algo**, no de los
        últimos doce: un mes vacío en el desplegable invita a elegirlo y
        encontrarse la pantalla en blanco. Ni verde ni rojo: azul entra, negro
        sale, con el signo escrito delante.
      · **`/portal/contabilidad`** — las cuatro cifras del mes en curso y los
        seis últimos movimientos. **El mes lo decide la base**, no el reloj de
        nadie: `date_trunc('month', CURRENT_DATE)`.
      · **`/academias/programas`** — catálogo con filtros en la URL. Borrar
        exige vaciar el programa primero, porque `material.academia_id` es ON
        DELETE CASCADE y el borrado se llevaría sus guías en silencio: el
        diálogo dice cuántas hay y propone `inactiva`.
      · **`/academias/materiales`** — repositorio agrupado por programa, con
        archivo (bucket privado), enlace, o los dos. **La descarga es un botón,
        no un enlace pintado**: firmar 300 enlaces por visita para los que
        nadie va a pulsar sale carísimo, y un enlace firmado al pintar sigue
        valiendo diez minutos después de retirarle el acceso a esa cuenta.
      · **`/reportes`** — tres pestañas con las gráficas del panel, reutilizadas
        tal cual. **El permiso cierra pestañas, no la puerta.**
      · **`/chat-ia`** — el asistente interno, en la misma pantalla que el del
        estudiante. **Psicología no entra nunca**, ni el recuento; el resto del
        contexto se recorta con los permisos de quien pregunta.
      · **`/sitemap`** — recorre `menuDe(rol)` para los siete roles. Ni una
        lista escrita a mano.

- [x] **Cuatro cosas que se quitaron de en medio por el camino**, todas por el
      mismo motivo: había dos copias de algo que tiene que ser una.
      · `balanceDelMes()` del panel y el balance del portal de contabilidad
        eran la misma consulta escrita dos veces; ahora el panel delega en
        `resumenDelMesEnCurso()` de finanzas. Lo mismo con `flujoFinanciero()`
        y `flujoMensual()`.
      · El POST a Supabase Storage estaba escrito tres veces, con su cabecera y
        su manejo de error. Ahora es uno, con el `upsert` como parámetro: la
        foto y la entrega SUSTITUYEN, un material de academia no debe poder
        pisar a otro.
      · `enlaceDeEntrega()` firma cualquier objeto del bucket privado, no solo
        una entrega: se llama `enlaceDeDocumento()`.
      · El componente del chat del estudiante ahora recibe su Server Action por
        prop y lo comparten los dos asistentes. Duplicarlo habría duplicado el
        desplazamiento al último mensaje, el "pensando" y once mensajes de
        error, y el segundo se habría quedado atrás en el primer arreglo.

- [x] **Comprobado contra la base de datos local**, no solo con `tsc`: las 21
      consultas nuevas se corrieron contra el PostgreSQL local, y las
      escrituras (INSERT, UPDATE, DELETE de transacción, academia, documento y
      material) dentro de una transacción con `ROLLBACK`. Se verificaron de
      paso las dos sutilezas: una fecha vacía conserva la que había, y un
      material que se edita sin archivo nuevo conserva su documento. `npm run
      build`, `npx tsc --noEmit`, `npm run lint`, `npm run i18n:check` (1930
      claves, es/en simétricos) y el grep de color, todos en verde. **Lo que no
      se pudo probar es en el navegador con sesión real**: sigue sin haber
      proyecto de Supabase, así que no se puede entrar (ver más abajo).

- [x] **[`docs/estado/inventario-vs-fases.md`](inventario-vs-fases.md)**: los dos documentos
      que describen el sitio módulo a módulo —«Módulos por portal» (8 de agosto,
      que ya estaba en el repo como `docs/referencia/modulos-por-portal.md`) e «Inventario de
      módulos y submódulos» (31 de julio, que **no estaba en ninguna parte**)—
      refundidos en una sola lista, con cada línea cruzada contra su sprint y
      contra el código que existe hoy.
      · **Se añadió la columna que a los dos les faltaba: el estado.** Un
        inventario que no dice qué está construido se lee como una promesa.
      · Los dos describen el prototipo Base44 en JSX, así que los desfases que
        se repetían en cada página (roles `profesor`/`administrativo`/`psicologia`,
        el correo que no existe, los colores por matiz, `RoleContext.jsx`) se
        anotan **una vez** en §1 y no en cada fila.
      · §6 recoge lo que el inventario pide y **no se va a construir**, con el
        motivo: el selector `/portal/cursos-tecnicos`, `/portal/estudiante-ct`,
        el correo y los emojis por tipo.

- [x] **Servicios mensuales** (`/servicios-mensuales`) y **Lista de comida**
      (`/inscripcion-comida`), las dos entradas que faltaban de la guía.
      · **La planilla se guarda al marcar, sin botón.** Es una lista de
        asistencia de decenas de filas: obligar a pulsar "guardar" al final
        significa que un despiste pierde media hora de trabajo, y un botón por
        fila llenaría la pantalla de botones. Una casilla = una escritura, con
        `ON CONFLICT DO UPDATE` sobre el `UNIQUE (estudiante_id, mes)`: sin
        preguntar antes si la fila existe, que serían dos viajes y una rendija
        entre ambos.
      · **La casilla vuelve a su sitio si la escritura falla.** Una casilla que
        se queda marcada tras un error es peor que una que no se deja marcar:
        dice que el dato está guardado cuando no lo está.
      · **La fila se crea al marcar, no antes.** No se rellena la tabla con un
        registro en blanco por estudiante y mes: "no marcado" y "marcado que
        no" significan lo mismo aquí, y las filas vacías serían datos que no
        dicen nada. La planilla une por LEFT JOIN.
      · **La hora de corte del comedor no se repite.** Sale del mismo SQL que
        ya usaban `/comida` y la acción de inscripción; si mañana cierra a las
        9:00, el cambio es en un sitio. Igual con "hoy" y con "el mes actual":
        los decide la base, porque un servidor en otro huso abriría el día o el
        mes equivocado justo a primera hora, que es cuando se usan.
      · **La hoja impresa se compone con clases `print:`** sobre la misma
        pantalla, no con un CSS aparte: lo que sobra al imprimir se marca donde
        está y no hay una segunda versión que mantener. El único JavaScript de
        las dos pantallas es el botón de imprimir, porque `window.print()` no
        se puede llamar desde el servidor.
      Probado contra la base: la planilla crea y actualiza sin duplicar (el
      UNIQUE aguanta), un id inventado escribe 0 filas, y los doce meses se
      generan con `generate_series` desde `CURRENT_DATE`.

- [x] Corregido sobre la marcha un comentario que mentía: escribí que el
      selector de mes "se envía al cambiar", y la pantalla es de servidor —no
      hay dónde colgar un `onChange`—. Lleva su botón, como las demás barras de
      filtro del sistema.

- [x] **Portal administrativo** (`/portal/administrativo`), con el modelo
      corregido. Yo lo había cuestionado por redundante con `/dashboard` y me
      equivoqué: «administrativo» **es el rol `admin`**, y ese portal es donde
      converge todo el sistema, absorbiendo lo de los otros cinco portales.
      Cuatro bloques, y el orden es el argumento:
      1. **Lo que espera una decisión**, primero, porque es lo único con
         alguien al otro lado. Siete avisos —tareas urgentes y vencidas,
         entregas por calificar, becados sin patrocinador, períodos
         incoherentes, citas sin confirmar, materias sin período— y **cada uno
         enlaza a la pantalla donde se resuelve**: un aviso que no se puede
         accionar es decoración. Los que están en cero no se dibujan, para que
         no escondan al que sí tiene número.
      2. **Doce cifras** de todos los módulos, en una sola consulta con
         subconsultas: doce viajes al pooler para pintar una pantalla de
         entrada es justo lo que la hace sentir lenta.
      3. **Todos los módulos**, derivados de `menuDe(rol)` —el MISMO menú que
         la barra lateral— en vez de una lista escrita a mano. Una rejilla
         copiada se desfasa la primera vez que alguien añade una pantalla;
         esta no puede, y hereda el filtrado por permiso.
      4. **La actividad reciente**: primera pantalla del sitio que lee
         `audit_log`. No muestra la columna `datos` —ahí va el detalle de cada
         cambio, incluida la nota de una calificación— porque una tira de
         actividad en la entrada no es sitio para eso.
      `/dashboard` se queda como la pantalla de gráficas, con su propia entrada
      en el menú debajo del portal. Comprobado contra la base: 7 tareas
      vencidas, 4 urgentes, 1 entrega por revisar, 1 becado sin patrocinador y
      los 2 períodos incoherentes salen todos.

- [x] **Becas** (`/patrocinadores/becas`). Decisión tomada por el usuario:
      **manda `asignacion_beca`**, no `estudiante.patrocinador_id`.
      · La tabla tiene monto, fechas y estado propios, así que aguanta el
        histórico: un becado puede haber pasado por tres patrocinadores y las
        tres etapas quedan. La columna suelta no puede guardar eso.
      · `estudiante.patrocinador_id` se conserva como **espejo**, sincronizado
        en la misma transacción. No se deja en NULL porque es una clave ajena
        real del esquema, y una columna que existe y no dice nada es una trampa
        para el siguiente que consulte por SQL. El recuento de becados del
        directorio pasó a contar por `asignacion_beca`: contar por el espejo es
        cómo empiezan a divergir dos cifras que deberían ser una.
      · Cambiar de patrocinador **cierra** la beca anterior (`finalizado`, con
        la fecha de hoy) y la conserva. Desvincular hace lo mismo: no borra.

- [x] **Un fallo de ORDEN dentro de una transacción, encontrado probando contra
      la base.** La primera versión de `asignarBeca` cerraba la beca activa
      ANTES de abrir la nueva. Con un patrocinador inactivo, el INSERT no casa
      ninguna fila —que es lo correcto— pero el cierre ya se había ejecutado:
      **un intento fallido dejaba al becado sin patrocinador**. Y la transacción
      no protege de esto, porque para PostgreSQL las tres sentencias fueron
      bien; simplemente una afectó a cero filas. `tsc` y `eslint` tampoco lo
      ven. Corregido invirtiendo el orden —abrir primero, y solo si hay fila,
      cerrar las anteriores con `id <> $nueva`— y reverificado: ahora un intento
      fallido conserva el patrocinador que hubiera.

- [x] **Patrocinadores** (`/patrocinadores`): directorio con alta, edición,
      filtros en la URL (nombre o país, tipo, estado) y cifras de cabecera.
      · **El aporte mensual suma solo los activos.** Un patrocinador inactivo
        conserva su `monto_mensual` como histórico, pero ya no aporta: meterlo
        en el total daría una cifra de ingresos que no entra por la puerta.
        Comprobado con datos de prueba: 250 + 150,50 = **400,50**, dejando
        fuera un inactivo de 999,99.
      · **Las cifras salen de una consulta agregada aparte**, no de contar las
        filas visibles: la lista está topada en 200.
      · **No hay borrado**, y no es un olvido: `estudiante.patrocinador_id` es
        ON DELETE SET NULL y `asignacion_beca.patrocinador_id` es CASCADE, así
        que borrar dejaría a los becados sin origen de fondos y se llevaría el
        historial de aportes. Para retirar a alguien está `inactivo`.
      · El dinero va en el **azul de la marca**, nunca en verde, siguiendo lo
        que `MOVIMIENTO` ya fija para lo que entra. Y se formatea con
        `Intl.NumberFormat('en-US')` fijo y no con el idioma de la interfaz:
        son dólares, y "US$ 250,00" en español frente a "$250.00" en inglés
        sería la misma cifra escrita de dos formas.
      · Este módulo **no traía la copia escrita** (a diferencia de académico y
        operaciones): el espacio `sponsors` se redactó entero, 26 claves en
        los dos idiomas.

- [x] **Proyectos** (`/administrativo/proyectos`). Con esto el Sprint 2 queda
      hecho salvo el portal que se cuestiona más arriba.
      · **El avance se cuenta, no se escribe.** `proyecto.progreso` existe desde
        la 0009 y esta pantalla ni lo enseña ni deja tocarlo: es un número
        puesto a mano que se queda viejo en cuanto alguien cierra una tarea. En
        la base dice **0%** en los tres proyectos, mientras el avance real es
        33% y 25%. Se cuentan tareas completadas sobre tareas vivas, que es lo
        que `newProject.progressHint` ya prometía antes de que la pantalla
        existiera.
      · **Las canceladas salen del denominador.** Si contaran, cancelar una
        tarea haría BAJAR el avance, que es lo contrario de lo que significa
        cancelarla. Comprobado: cancelar una tarea de un proyecto lo lleva de
        33% a 50%.
      · **Un proyecto sin tareas dice "Sin tareas", no 0%.** No es lo mismo: el
        0% afirma que se empezó y no se ha avanzado, y una lista de proyectos
        recién creados con barras vacías hace parecer que el equipo está
        parado.
      · **No hay botón de borrar, a propósito**: `tarea.proyecto_id` es
        ON DELETE SET NULL, así que borrar un proyecto deja sus tareas sueltas y
        sin rastro de a qué pertenecían. Para retirar una iniciativa están
        `pausado` y `completado`.

- [x] **Tablero de tareas** (`/administrativo/tareas`), primer trozo del
      Sprint 2.
      · **Arrastrar no es la única forma de mover.** Con solo arrastre, quien
        navega con teclado o con lector de pantalla no puede cambiar una tarea
        de columna. Cada tarjeta lleva además un botón que la empuja a la
        siguiente, y las dos formas llaman a la misma acción. El arrastre es
        HTML nativo, el mismo que ya usa el calendario: sin librería nueva.
      · **Crear una tarea es UNA cosa que toca cuatro tablas**, así que va en
        `enTransaccion()`: `tarea`, `tarea_asignado`, `evento` (solo si hay
        fecha límite: `evento.fecha` es NOT NULL) y `notificacion`. Si la tarea
        entrara y el aviso no, alguien tendría trabajo asignado sin enterarse.
      · **Primera pantalla que usa `tarea.visibilidad`.** La columna existe
        desde la 0009 y no la miraba nadie: el calendario filtra por asignación
        y punto. Aquí `todos` la ve cualquiera con `operaciones.leer`,
        `asignados` solo quien la lleva, y con `operaciones.escribir` se ven
        todas. La condición va en el WHERE, no en el navegador.
      · **Se corrigió una promesa que el sistema no puede cumplir.** La copia ya
        escrita decía "se avisa por correo a cada asignado" y este proyecto
        **no tiene ninguna infraestructura de correo** (ni nodemailer, ni
        Resend, ni SMTP). Prometer un correo que nunca sale es peor que no
        prometer nada: alguien deja de avisar por su cuenta creyendo que el
        sistema ya lo hizo. Ahora dice "un aviso en el sistema", que es lo que
        de verdad ocurre.
      Comprobado contra la base: el tablero reparte 5/3/2 en las tres columnas
      y ordena por prioridad; el alta deja 2 asignados, 2 notificaciones y 1
      evento; mover a completada cierra el evento; y asignar a un id inventado
      crea 0 filas. La regla de visibilidad se probó forzándola —las 10 tareas
      del seed son `todos`—: marcando dos como `asignados`, el docente pasa de
      ver 10 a ver 9 (pierde la ajena, conserva la suya) y coordinación sigue
      viendo 10.

- [x] **Un fallo que ni `tsc` ni `eslint` ven, y que conviene no repetir**: el
      tablero es cliente e importaba `COLUMNAS` —un **valor**— desde
      `@/server/operaciones/consultas`. Eso arrastra `@/lib/db` y con él el
      driver `pg` entero al navegador, que pide `fs` y `net` y devuelve **500**
      en la página. Los tipos se borran al compilar, así que `import type` de
      un archivo de consultas es seguro; un valor, no. Se movió a
      `src/lib/operaciones.ts`, que es donde el proyecto ya guarda el
      vocabulario compartido (`expedientes.ts`, `psicologia.ts`, `notas.ts`).
      Revisado que **ningún otro componente cliente** importe valores de un
      archivo de consultas: era el único.
      Es el mismo tipo de fallo que el del icono de `lucide-react` cruzando la
      frontera servidor→cliente: solo aparece con la página cargada de verdad.

- [x] Los dos errores de ESLint de `portal/psicologia` (las comillas rectas
      alrededor de `motivo_estudiante`, que `react/no-unescaped-entities`
      rechaza en JSX). Se cambiaron por comillas tipográficas y no por las
      españolas «»: esa misma línea se pinta en los dos idiomas, y «» sería
      incorrecto en inglés. También se quitó el `eslint-disable no-var` que
      sobraba en `src/lib/db.ts`: esa regla no está activa, así que ESLint
      avisaba de la directiva inútil. El `var` se queda —una declaración
      global solo se engancha a `globalThis` con `var`— y ahora lleva escrito
      el porqué. **`npx eslint .` sobre el repo entero está completamente
      limpio: 0 errores y 0 avisos.**

- [x] **Línea de tiempo (Gantt)** en `/calendario/gantt`, con las cuatro
      familias acordadas: períodos y materias, tareas y entregas, proyectos y
      tareas administrativas, y cursos técnicos con clases de 360.
      · **Va aparte del calendario**, no como quinta vista de `EventManager`:
        ese componente es cliente, arrastra para mover y gira alrededor de un
        mes; esto es de servidor, no escribe nada y gira alrededor de un tramo
        largo. Meterlo dentro habría cargado el componente más grande y
        delicado del proyecto con cuatro consultas que no son suyas.
      · **Sin JavaScript de cliente**: filtros con `form method="get"`,
        casillas nativas para elegir familias, y barras posicionadas con
        porcentajes calculados en el servidor.
      · **Dos tramos, y ninguno inventado.** Por período (la unidad con la que
        ya piensa la institución) o **autoajustado a los datos**, del primero
        que empieza al último que acaba. Hizo falta porque los períodos de la
        base (ene–ago) no cubren dónde vive todo lo demás (jun–oct), así que el
        tramo por período salía casi vacío; la alternativa habría sido inventar
        "los próximos 90 días", y ese número no sale de ningún sitio.
      · **Lo que el esquema no da se dice con palabras**, en vez de dejar que
        alguien deduzca que no existe: materias y cursos no tienen fechas
        propias, `materia_360` no tiene ni fechas ni período, y las filas sin
        fechas se cuentan y se anuncian en vez de desaparecer sin más.
      · Quién entra: `operaciones.leer`, `academico.escribir` o
        `calificaciones.registrar`. **`academico.leer` a secas no vale** —lo
        tiene el rol `estudiante`— y cada familia se dibuja solo si su permiso
        está, así que psicología ve los proyectos y no lo académico.
      Comprobado contra la base: 24 barras (18 dibujables), tramo autoajustado
      2026-01-07 → 2026-10-26, la marca de hoy al 82.5% del eje y **ninguna
      barra se sale**. De paso destapó las seis filas con fechas invertidas del
      pendiente de arriba.

- [x] **Selección de materia del estudiante** (`/portal/estudiante/prematricula`):
      la pantalla deja de ser solo lectura. Dentro de la ventana de
      prematrícula, el becado se inscribe y se quita él mismo; fuera de ella
      vuelve a ser exactamente lo que era.
      · **La ventana es la MISMA que la de Global Effect 360**, no una nueva:
        `ventana_prematricula` cuelga de `periodo`, no de un programa. Un
        cuatrimestre tiene una prematrícula, se anuncia una vez y vale para
        todo lo que se matricula en él. Duplicarla por programa habría
        permitido que el mismo período estuviera abierto para 360 y cerrado
        para la carrera.
      · **La ventana se comprueba dentro del INSERT**, no antes con un `if`:
        entre leer la hora y escribir la fila pasa un rato, y el borde de la
        ventana es justo cuando media promoción está pulsando el botón. Mismo
        molde que `@/server/global360/acciones`, a propósito — si una de las
        dos comprobara la ventana de otra manera, tarde o temprano una la
        comprobaría mal.
      · **La ventana tiene que ser la del período de la materia** (`v.periodo_id
        = m.periodo_id`). Es la diferencia con 360, donde la materia no tiene
        período propio y hereda el de la ventana. Sin ese JOIN, una ventana
        abierta para el cuatrimestre que viene dejaría matricularse en materias
        del anterior.
      · **Quitarse borra la fila en vez de marcarla `retirada`**: mientras la
        ventana está abierta nadie ha cursado nada, así que corregir una
        elección no es un abandono que registrar. Retirarse con el período ya
        empezado es otra cosa y no pasa por aquí.
      Probado contra la base en una transacción que se deshace, los ocho casos:
      sin ventana → 0 filas; ventana de otro período → 0; ventana anunciada
      pero no abierta → 0; ventana abierta → 1; repetida → 0 y detectada como
      repetida; quitarse con ventana abierta → 1; quitarse una ya aprobada → 0;
      quitarse con la ventana cerrada → 0.

- [x] **Portal del profesor** (`/portal/profesor`): cerrado, y con él el
      Sprint 1 entero.
      · Los **KPIs ya llevan cifras**. Iban vacíos a propósito mientras no eran
        de verdad —un banner con cuatro ceros informa menos que uno sin
        cifras—, y ahora salen de `cifrasDocente`: cursos activos, estudiantes,
        notas registradas y entregas por revisar.
      · **El portal no edita nada, a propósito.** Registrar una nota, publicar
        una tarea o revisar una entrega se hacen en `/academico/calificaciones`
        y `/academico/cursos`, donde vive cada formulario con sus
        comprobaciones. Duplicar el formulario de revisión aquí serían dos
        sitios que mantener y dos donde equivocarse al cambiar las reglas.
      · **Tres listas separadas** —cursos técnicos, materias universitarias y
        clases de Global Effect 360— y no una sola: son tres programas
        distintos, y juntarlos obligaría a leer una etiqueta en cada fila para
        saber de qué se habla.
      · El bloque de entregas por revisar solo se dibuja **cuando hay alguna**:
        es lo único de la pantalla con alguien esperando al otro lado, y con
        cero el KPI ya lo dice.
      Hizo falta una consulta nueva, `materiasDelDocente`, que filtra por
      `profesor_usuario_id` y nunca por el nombre: para eso añadió la 0019 la
      clave ajena. Comprobado contra la base con el docente real (Roberto
      Gómez: 1 curso técnico con 3 notas y promedio 80.33, 1 materia
      universitaria con 1 inscrito y 2 tareas, 0 clases de 360).
      También se corrigió una etiqueta: `teacherPortal.stats.students` decía
      "Inscritos" y la cifra cuenta a quien tiene **alguna nota** en el curso,
      no a los matriculados (`curso.inscritos` es un contador a mano que se
      queda viejo). Ahora dice "Estudiantes".

- [x] **Historial académico** (`/academico/historial`): una fila por estudiante
      con su índice acumulado sobre 4.00, cómo cerró (aprobadas, en prueba,
      reprobadas) y el detalle de sus materias cerradas.
      Tres cosas que decidieron el diseño:
      · **El índice no se recalcula nunca.** Se lee tal como está guardado en
        `historial_calificacion.gpa`, siguiendo el aviso de la 0006: la escala
        de conversión puede cambiar de un año a otro, y un 3.70 guardado que se
        recalcula desde la nota sale 4.00. Es el mismo `avg(gpa)` que ya usaba
        expedientes, no una fórmula nueva.
      · **Dos ámbitos en la misma fila, a propósito**: el índice es SIEMPRE de
        todo el historial aunque haya un cuatrimestre elegido —es acumulado y
        decide la beca; verlo cambiar al filtrar daría a entender que la
        Fundación lo calcula por período—, mientras que lo contable (materias,
        promedio, aprobadas) sí respeta el filtro. Se resuelve con `FILTER`
        sobre los agregados, no metiendo el cuatrimestre en el WHERE.
        **Fallo propio corregido sobre la marcha**: la primera versión del
        resumen de cabecera sí lo metía en el WHERE, así que al filtrar la
        cabecera decía 2.67 y cada fila 2.83 — dos números para lo mismo en la
        misma pantalla, y el de arriba era el que no significaba nada.
        Comprobado contra la base antes y después.
      · **Ni una línea de JavaScript de cliente.** La pantalla no escribe nada,
        así que buscar, filtrar y abrir el detalle de alguien son un
        `form method="get"` y dos enlaces: funciona sin JS, el enlace del
        detalle se puede compartir, y no viaja ningún componente al navegador.
        El detalle se consulta solo del estudiante que se abre.

- [x] **Calificaciones** (`/academico/calificaciones`): registro, corrección y
      borrado de las notas por evaluación de los cursos técnicos, con búsqueda
      por estudiante o curso y filtro de período, otra vez en la URL.
      Tres decisiones que valen la pena anotar:
      · **La puerta no es `academico.leer`**, que es lo primero que uno
        escribiría: ese permiso lo tiene también el rol `estudiante`, así que
        habría abierto a cada estudiante las notas de todos los demás. Entran
        tres permisos alternativos —`calificaciones.registrar` (quien califica),
        `academico.escribir` (coordinación) y `expedientes.leer` (psicología)—
        y **escribir lo decide solo el primero**.
      · **Las cifras de cabecera y la distribución salen de una consulta
        agregada aparte**, no de contar las filas que se pintan: la lista está
        topada en 500 y un promedio de las 500 notas más recientes disfrazado
        de promedio general es peor que no dar promedio.
      · **Las bandas no traen umbrales propios.** Los cuatro tramos
        (`gradeBand.*`) se derivan de `TRAMOS` en `src/lib/notas.ts`, y el
        `count(*) FILTER` del SQL recibe esos umbrales **como parámetros**
        (`UMBRAL_BANDA`) en vez de llevar 90/70/60 escritos dentro. Con los
        números en la consulta habría dos escalas esperando a divergir.
      La frontera del docente se probó contra la base de verdad, dentro de una
      transacción que se deshace: con el id de un curso ajeno, el INSERT y el
      UPDATE devuelven **0 filas** y no escriben nada. Y la suma de las cuatro
      bandas cuadra con el total.

- [x] **Períodos** (`/academico/periodos`): la pantalla existe. Era un
      `EnConstruccion` y es la raíz de todo el módulo —una materia, un curso y
      una matrícula cuelgan de un período—, así que sin ella no había forma de
      abrir un cuatrimestre sin entrar por SQL.
      Alta, edición y baja con sus cifras (materias, cursos e inscripciones que
      cuelgan de cada uno), y **avisos de incoherencia**, que es lo que esta
      pantalla hace y ninguna otra: un período marcado `activo` cuyas fechas ya
      pasaron sigue recibiendo notas como si fuera el cuatrimestre en curso, y
      uno `planificado` que ya empezó las manda al anterior. Los dos casos son
      invisibles leyendo una lista de fechas y los dos ensucian el historial de
      forma que cuesta deshacer. Se comparan contra `CURRENT_DATE` **en la
      base** y no con `new Date()` en el navegador: el reloj del dispositivo de
      quien mira no puede decidir qué cuatrimestre está en curso.
      Al probarlo contra la base real saltaron los dos avisos a la vez — ver el
      pendiente de arriba.
- [x] **Materias** (`/academico/materias`): catálogo completo de las materias
      universitarias, con búsqueda por nombre/código/profesor y filtro por
      período. Los dos van en la URL (`?q=` y `?periodo=`) y no en estado de
      cliente, como ya hacían las calificaciones del estudiante: el enlace se
      puede compartir y recargar, y la lista se recorta en SQL en vez de traer
      el catálogo entero para esconder la mayoría. El `periodo` de la URL se
      valida como UUID antes del SQL, porque `$1::uuid` con una cadena que no
      lo es revienta la consulta y un enlace viejo no debe tumbar la pantalla.
      El profesor se elige en **un solo campo** con tres formas —nadie, un
      usuario del sistema, o alguien externo con el nombre a mano—. Van juntas
      y no en dos campos porque son excluyentes: con dos, un formulario
      manipulado podría dejar la fila diciendo que la materia es de un usuario
      y de otra persona a la vez. El nombre del usuario elegido se copia **en
      el servidor** desde `usuario`, no del formulario, para que la columna de
      texto siga sirviendo de registro histórico (que es para lo que la 0019 la
      conservó).
- [x] Borrar en el catálogo no borra a ciegas. Las dos tablas cuelgan de claves
      ajenas en cascada —borrar un período se lleva sus inscripciones; borrar
      una materia, su matrícula y sus tareas con las entregas dentro—, así que
      la acción cuenta las dependencias primero y devuelve `tiene_datos` **con
      el detalle**. El diálogo cambia de cara y enumera qué cuelga y cuánto: no
      es un "no se puede", es la lista de lo que se perdería, que es con lo que
      se decide si lo que toca es archivar (`completado` / `inactiva`) en vez
      de borrar. El componente (`acciones-fila.tsx`) es uno solo para las dos
      pantallas a propósito: si en una se pregunta antes y en la otra no, la
      que no pregunta acaba borrando matrícula por un clic de más.
- [x] Los textos ya estaban escritos. `messages/es.json` y `en.json` traían
      completo y simétrico todo el espacio `academic` —`terms`, `subjects`,
      `rowActions`, `teacherPicker`, `editTerm`, `editSubject`— de una sesión
      anterior que redactó el copy sin construir las pantallas. Se usó tal cual
      y solo hizo falta añadir una clave, `rowActions.deps.tasks`, para poder
      decir cuántas tareas se perderían al borrar una materia.
- [x] Verificado: `tsc --noEmit` limpio, `eslint` 0 errores sobre lo nuevo,
      `npm run i18n:check` en verde (1466 claves, es/en simétricos), los greps
      de color a cero, y las rutas responden en el servidor de desarrollo.
      Como el login sigue sin poder probarse en local (falta el proyecto de
      Supabase — pendiente de arriba), **el SQL de las dos pantallas se ejecutó
      directamente contra la base**: los conteos, la búsqueda, el filtro por
      período, la lista de docentes asignables y las dos consultas de
      dependencias devuelven lo que la interfaz espera. Lo que no se ha podido
      ver es la pantalla renderizada con una sesión real.

## Hechos en sesiones anteriores

- [x] Repaso de responsive (móvil y tablet), **medido con navegador de verdad**
      a 360/390/768/1024px, no revisado a ojo. Lo encontrado y arreglado:
      - **La barra de la landing se salía 196px justo a 768px** (iPad en
        vertical, la tablet más común). A `md` aparecía el menú central pero el
        logo, los cinco enlaces y los dos botones no caben en `max-w-6xl` menos
        el padding. El menú de escritorio pasa a empezar en `lg`, donde sí cabe.
        A 360, 390 y 1024 nunca falló: se rompía solo en tablet.
      - **Zoom de iOS en todos los formularios**: `input`, `textarea` y `select`
        iban a 14px, y Safari amplía al enfocar cualquier campo de menos de
        16px y no deshace el zoom al salir. Ahora 16px en móvil y los 14px del
        diseño desde `sm`.
      - **Las seis pestañas del formulario de expediente se recortaban**:
        `TabsList` trae `h-9` fija y en móvil las seis caen en dos filas de
        tres, así que la segunda fila quedaba cortada dentro de 36px — la mitad
        de la navegación del formulario más largo del sistema no se veía.
      - El mismo diálogo usaba `max-h-[92vh]`, que pisaba el
        `max-h-[calc(100dvh-4rem)]` del primitivo. En iOS `vh` incluye la barra
        de direcciones, así que el pie de botones caía fuera de pantalla.
      - Dianas de dedo: los puntos del hero medían 8×8px (ahora 32 con la
        bolita dentro), la X de quitar filtro del calendario no tenía ninguna
        clase (12×12), y las flechas de paginación y los enlaces de pie estaban
        por debajo de 32px.
      - Correo del perfil sin `truncate` y rejilla del diálogo de vista previa
        a dos columnas fijas incluso a 360px (fallo mío de la sesión anterior).

      Queda como script reutilizable: mide desbordamiento y zonas pulsables en
      las rutas públicas. Las rutas con sesión siguen sin poder medirse (falta
      Supabase), así que el armazón y los portales están revisados por lectura,
      no medidos.

- [x] Ficha de expediente: el estado ahora se ve. Vivía solo como desplegable
      dentro de una de las seis pestañas, así que para saber si alguien estaba
      activo o suspendido había que ir a buscarlo — el dato que más condiciona
      cómo se lee la ficha era el más escondido. Va como insignia junto al
      nombre, con su color e icono, y al lado la de tipo (becado/regular).
- [x] Ficha de expediente: la navegación entre secciones sube arriba de los
      campos. Abajo obligaba a recorrer la sección entera para descubrir que
      había otra. Guardar y cancelar se quedan al pie —eso no es navegar, es
      cerrar el trabajo— y ahora ese pie solo aparece en modo edición: en modo
      vista era una barra vacía con un borde.

- [x] Estados de expediente: se ven distintos. Los ocho estados se distinguían
      solo por peso del azul y ya no daba de sí: `reclutado`, `postulado` e
      `inactivo` eran casi el mismo gris, y `academia_liderazgo` con
      `standby_tecnico` casi el mismo azul claro.
      Decisión del usuario entre tres opciones: **mixto**. Se añade `SEMAFORO`
      a `paleta.ts` con exactamente dos matices —verde #1E9E6A "dentro" y rojo
      #B4342B "requiere acción"— reservados a estados y nada más; los otros
      seis siguen en azul y gris, y los ocho ganan icono propio, que es lo que
      separa los grises y lo único que sobrevive en escala de grises.
      `COLOR_ESTADO` pasa a ser `ESTADO_VISUAL`: insignia, franja e icono en
      una sola entrada, porque estaban en dos sitios que había que acordarse de
      mover a la vez. La franja lleva su propio color sólido: con las clases de
      la insignia, un estado claro dejaba la franja casi invisible.
      Actualizados `docs/09-sistema-visual.md` y `.claude/rules/design-system.md` para que la
      excepción esté escrita y nadie la "corrija". Los dos matices van como hex
      arbitrario (`bg-[#1E9E6A]`), nunca como `green-*`/`red-*`, así que el
      grep de auditoría sigue dando cero.
      Corregido sobre la marcha un fallo propio: el icono se pasaba por props
      desde la pantalla (servidor) al diálogo (`"use client"`), y un componente
      de `lucide-react` no cruza esa frontera —React solo serializa objetos
      planos—. Reventaba en el navegador con "Only plain objects can be passed
      to Client Components". Ni `tsc` ni el 200 de la ruta lo ven: solo se nota
      con la página cargada de verdad. Ahora el cliente resuelve el icono desde
      `fila.estado`, que ya viajaba en la fila y es una cadena. Revisado que
      ningún otro componente `"use client"` reciba un icono por props (los
      cuatro que lo declaran son ayudantes internos de su propio módulo).

- [x] Expedientes: el acceso a editar en la tarjeta ahora lleva su palabra, no
      solo el lápiz. Un icono suelto obliga a pasar el ratón para saber si
      edita o abre, y en pantalla táctil no hay ese "encima". Es además la
      misma etiqueta que ya usaba la vista de lista.

- [x] Expedientes: espacio de las tarjetas y del diálogo de vista previa.
      La tarjeta cuadrada intentaba sostener cinco capas —retrato, nombre,
      línea de cédula·programa·universidad, dos insignias y el pie— todas al
      mismo `gap-1.5`, y a cinco columnas en pantalla ancha el lado bajaba de
      180px. Ahora son cuatro columnas, `p-4`, tres bloques agrupados con aire
      entre ellos, y la línea de metadatos muestra solo el programa: las tres
      cosas juntas no cabían enteras en ese ancho, así que no se leía ninguna
      (siguen completas en el diálogo). Las insignias vuelven a `text-[10px]`
      —a `[9px]` con `py-0` dejaban de leerse— y el icono del pie tiene ahora
      un cuadro de 32px en vez de ser un `size-4` suelto contra el borde.
      El diálogo pasa a `max-w-lg`: a 448px el correo y el programa salían
      partidos. Los datos van en un panel propio (antes flotaban sueltos entre
      cabecera y botones), los valores usan `break-words` en vez de `truncate`
      —un correo con puntos suspensivos no sirve—, y el pie baja de tres
      botones a dos: el diálogo ya trae su aspa de cerrar, así que el botón
      "Cerrar" repetía la salida y apretaba las dos acciones útiles.

- [x] Etapa 0 del plan cerrada. `docs/09-sistema-visual.md` se contradecía a sí mismo: la
      cabecera fija la regla dura de marca y luego 14 líneas más abajo seguían
      describiendo los banners de portal en esmeralda, naranja, rosa y violeta,
      con alertas ámbar y puntos rojos de prioridad — el diseño anterior al
      cambio de marca. Todo reescrito al azul. También se quitó un
      `text-cyan-200` en `formulario-perfil.tsx`, la única violación real que
      quedaba en código servido.
      `paleta.ts` ganó `MOVIMIENTO` (clases y signo de ingreso/egreso) y una
      sección MOVIMIENTO en `docs/09-sistema-visual.md` fija `tw-animate-css` como el único
      vocabulario de animación. Ni la rampa de notas ni los keyframes hicieron
      falta: la primera ya vivía en `src/lib/notas.ts` y los segundos los da la
      librería que ya estaba importada.

- [x] `docs/estado/plan-etapas.md`: plan por etapas (0–11) para terminar el sistema, con el
      orden, las dependencias entre etapas y los bloqueos transversales. La
      etapa 0 existe porque el plan que llegó de Antigravity está escrito contra
      APIs que no existen en este repo (`requirePermission`, `db.query`,
      `PRIORIDAD[x].clase`, componentes `portales/` que ya viven en
      `layout/banner-portal`): aplicarlo tal cual no compila.


- [x] Expedientes: la vista de tarjetas ahora es cuadrada (`aspect-square`,
      `rounded-2xl`), con foto/nombre/tipo/estado centrados y una franja de
      color arriba que repite el color del estado — dos señales del mismo
      dato para verlo de un vistazo. La vista de lista no cambió. El color
      por estado ya existía (`COLOR_ESTADO`); ahora se ve también en la
      franja, no solo en la etiqueta.

- [x] Expedientes: vistas de tarjetas y lista, con un interruptor arriba
      (`views.cards`/`views.list`). El contenido de cada fila (previsualizar,
      GPA, editar/ver) se comparte entre ambas — solo cambia el envoltorio.
- [x] Expedientes: paginación real, arriba de los resultados (antes era solo
      un tope fijo de 100 filas con un aviso al final, sin poder pasar de
      página). 20 por página; nueva `contarExpedientes()` para el total y
      `listaExpedientes()` ahora pagina con `OFFSET`/`LIMIT` en vez de un
      límite plano. Cambiar de filtro o de vista vuelve a la página 1.

- [x] Limpieza del proyecto: la lentitud real era `.next/dev` (caché de
      Turbopack) creciendo a 1.9 GB durante la sesión larga de `npm run dev`.
      Se detuvo el servidor, se borró `.next`, `tsconfig.tsbuildinfo` y
      `.DS_Store` (todo regenerable/gitignored), y se reinició: las peticiones
      ya compiladas pasaron de varios segundos a ~150ms.
      También se borraron (confirmado con el usuario) `.agents/`, `.codex/`,
      `AGENTS.md` y `GEMINI.md` (config. duplicada para Codex/Gemini CLI, sin
      usar) y `.env.local.bak` (credenciales de Supabase más viejas que las
      actuales, del proyecto que ya no existe).

- [x] Verificada la conexión a Postgres desde `.env.local` (Supavisor pooler) —
      responde correctamente (`current_database: postgres`).
- [x] Levantado `npm run dev` en local (`http://localhost:3000`), Turbopack listo
      en <1s, sin errores en consola.
- [x] Confirmado que `/` y `/login` responden 200 y traen datos reales de la
      base (noticias, eventos, comedor).
- [x] Expedientes: edición real (antes el formulario no guardaba nada).
      Migración `0029_foto_estudiante.sql` (columna `estudiante.foto_url`),
      Server Action `actualizarExpediente` (`server/expedientes/acciones.ts`,
      transacción sobre las seis tablas), consulta `obtenerExpediente` y
      pantalla nueva `/expedientes/[id]` con el formulario precargado. Solo
      escribe `psicologo` y solo sobre sus propios estudiantes asignados (o uno
      sin asignar, que queda asignado al guardar) — igual que el resto del
      módulo de psicología.
- [x] Expedientes: foto del estudiante. Se sube y se ve en la ficha de edición
      (mismo patrón que la foto de perfil, bucket `avatares`) y ahora también
      en la tarjeta de la lista — la "previsualización" pedida.
- [x] Expedientes: filtros. Ya existían (nombre/cédula, tipo, estado); se
      corrigió que la búsqueda no cubría `programa` pese a prometerlo el
      placeholder, y se añadió el enlace "Quitar filtros" (la clave de idioma
      ya existía sin usar).
- [x] Expedientes: salida más visible desde la ficha (botón real con icono, no
      un enlace de texto pequeño).
- [x] Expedientes: previsualización sin editar. La ficha abre siempre en modo
      vista (todo deshabilitado); entrar a editar es un botón aparte, y
      "Cancelar" descarta los cambios sin guardar.
- [x] Expedientes: borrado con doble confirmación. Antes de borrar se cuentan
      inscripciones/calificaciones/historial/citas/notas/servicio; si hay
      algo, no se borra y se explica qué (con la sugerencia de cambiar el
      estado en vez de borrar). `expedientes.eliminar` quedó asignado a
      `psicologo` en `rbac.ts` y en `db/seed.sql` (antes no lo tenía nadie).
- [x] Expedientes: el borrado deja rastro en `audit_log` (`registrar()`), con
      quién y cuándo. Ver el pendiente de arriba sobre la pantalla para leerlo.
- [x] Expedientes: vista rápida desde la lista (`previsualizar-expediente.tsx`).
      Clic en el nombre/foto de la tarjeta abre un diálogo con lo que la fila
      ya trae —sin otra consulta a la base—, y desde ahí "Ver ficha completa" o
      "Editar" (este último abre la ficha ya en modo edición vía
      `?editar=1`). Es distinto de la ficha completa: no tiene familia,
      vivienda, salud ni situación, solo lo que cabe en la tarjeta.
