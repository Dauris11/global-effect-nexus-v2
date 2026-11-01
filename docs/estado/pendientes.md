# Pendientes

Lista de tareas abiertas que se van marcando conforme se resuelven. Se actualiza
en cada sesión de trabajo: lo que se cierra se tacha o se quita, lo nuevo que
aparece se agrega. No sustituye a [`docs/estado/progreso.md`](progreso.md) (estado por
módulo) — esto es solo la cola de pendientes concretos.

- [x] **Aislamiento Estricto de Agendas y Calendarios por Rol y Proyección de Clases Semanales (1 nov 2026):**
      - **Aislamiento Estricto y Privacidad por Rol:**
        - Garantizado que cada usuario (estudiante, docente, colaborador, personal) vea en su agenda y calendario ÚNICAMENTE lo que le compete a él: sus propias clases, sus trámites/citas solicitadas (`solicitante_id` o `estudiante_id`), y las reuniones institucionales donde es organizador o participante convocado (`reunion_participante`), sin fuga de eventos de otros usuarios.
        - En `/reuniones` (`src/server/reuniones/consultas.ts`), la consulta resuelve participantes cruzando `usuario_id` y `estudiante.usuario_id`, garantizando que convocatorias hechas a la ficha de estudiante aparezcan en su portal.
      - **Proyección de Clases Semanales (`src/lib/horarios.ts`):**
        - Motor de análisis e interpretación de cadenas de horarios en español (ej. "Viernes 08:00 - 10:00", "Lunes y Miércoles 14:00 - 16:00", etc.).
        - Proyección periódica `proyectarClasesEnRango`: genera las instancias exactas en los días de la semana correspondientes acotadas estrictamente a los límites del período académico activo (`fecha_inicio` y `fecha_fin`).
      - **Integración en Calendario Institucional (`src/server/calendario/consultas.ts`) y Portal del Estudiante (`src/server/estudiantes/agenda.ts`):**
        - Se integró el origen `clase` en `calendarioDelMes` para estudiantes y docentes con sus materias inscritas (regulares y 360).
        - En `agendaDelEstudiante`, se proyectan las clases de la semana en el mes seleccionado y se integran con vencimientos de asignaciones, citas y reuniones.
        - En `mesesConAgenda`, se expanden los meses cubiertos por los periodos con materias inscritas para permitir seleccionar los meses del ciclo lectivo.
      - **Interfaz de Usuario y Tokens de Marca (`src/components/calendario/event-manager.tsx`, `src/components/estudiante/dia-agenda.tsx`):**
        - Color y token institucional para `clase`: `bg-[#2096BA]/20 text-[#0a6a8a] border border-[#2096BA]/40` en EventManager y badge `t("agenda.classBadge")` con icono `BookOpen`.
        - Filtro por origen en el calendario con opción de "Clase" y "Reunión institucional".
      - **Calidad:** 4,737 claves i18n simétricas (`npm run i18n:check`), 0 colores fuera de marca (`npm run audit:ui`), `npm run lint` y `npm run build` en verde al 100% (187/187 páginas).

- [x] **Independencia del Portal del Estudiante del Expediente Administrativo (1 nov 2026):**
      - **Restricción de Acceso:** Confirmado y blindado que el rol `estudiante` NO tiene acceso a su propio expediente administrativo ni a la ruta `/expedientes` (solo manejado por personal administrativo; no posee el permiso `expedientes.leer`).
      - **Desacoplamiento Total del Portal:**
        - `estudianteDeUsuario(usuarioId)` (`src/server/estudiantes/portal.ts`): La sesión se fundamenta directamente en el usuario autenticado (`usuario`). Si existe una fila en `estudiante` enlazada por `usuario_id`, resuelve su `id` y `tieneExpediente: true`; si no está enlazada aún, retorna una sesión válida basada en `usuario` con `id: null` y `tieneExpediente: false`, impidiendo cualquier bloqueo del portal.
        - Retiro de `AvisoSinFicha` de todas las páginas del portal del estudiante (`/portal/estudiante`, `aula-virtual`, `calificaciones`, `global-360`, `prematricula`, `calendario`, `solicitudes`, `chat`): el estudiante siempre puede navegar su portal, consultar el catálogo, revisar eventos institucionales, enviar solicitudes y chatear con el asistente de IA.
        - Capa de consultas (`portal.ts`, `aula.ts`, `academico.ts`, `agenda.ts`, `global360/consultas.ts`, `moodle/consultas.ts`): aceptan `estudianteId: string | null` y devuelven estados vacíos ordenados y limpios sin errores de consulta ni fallas de renderizado.
        - Sincronización al final de cuatrimestre: las vistas, estadísticas y calificaciones reflejan los cierres oficiales de término hechos por coordinación académica (`termUpdateHint`).
      - **Calidad:** 4,732 claves i18n simétricas (`npm run i18n:check`), 0 colores fuera de marca (`npm run audit:ui`), `npm run lint` y `npm run build` en verde al 100% (187/187 rutas).

- [x] **Ver como, configuración por iconos, torre de control, cuadre de caja, mapas, landing y movimiento (31 oct 2026, migración `0063`):**
      - **Ver como (super_admin):** cookie `ge_ver_como` honrada solo si el rol REAL es `super_admin` (`src/lib/auth.ts`, `rolReal`); acción `verComoRol` auditada; control en la barra superior y franja fija mientras se ve como otro rol (`components/layout/ver-como.tsx`). Se actúa con los permisos del rol mirado.
      - **Configuración:** barra de iconos en `configuracion/layout.tsx` (`lib/configuracion.ts`, `components/configuracion/barra-ajustes.tsx`); el índice de tarjetas se retiró.
      - **Roles:** menús cruzados contra la guarda de cada página; se quitó «Postulantes» de Habitudes (enlace muerto) y «Mi día» del colaborador (sin traducción, duplicaba la torre). Subtítulos y notas técnicas fuera de las portadas; accesos rápidos móviles traducidos y abiertos a `dir_habitudes`/`colaborador`.
      - **Torre de control:** `/administrativo/torre-control` (de cada usuario; `?usuario=` solo con `operaciones.escribir`) y `/torre-control/equipo`. Migración `0063` (`proyecto.responsable_id`, `proyecto_miembro`, `tarea_comentario`), aplicada.
      - **Contabilidad:** ~50 consultas rotas contra el esquema real corregidas (asientos de activos, calculadoras, donaciones, inventario, nómina; dashboard con 500 por `saldo_dop`). Tablero con periodo, KPIs clicables, gráfica y pendientes. Caja chica de fondo fijo: gasto con categoría, comprobante y asiento; vales con liquidación; arqueo por denominación DOP aprobado por otra persona, con asiento de faltante/sobrante; reposición como recibo de egreso.
      - **Mapas:** CARTO Positron/Dark Matter, marcadores de marca, agrupación, filtros, «Cómo llegar», ubicar liceo y comprobar presencia en la visita.
      - **Landing:** hero, cifras públicas reales, programas (sin formación técnica), noticias, FAQ y cierre rediseñados; revelado al scroll con `animation-timeline`.
      - **Movimiento:** tokens y keyframes en `globals.css`, primitivos y armazón animados, `template.tsx` de entrada; todo neutralizado con `prefers-reduced-motion`.
- [ ] **Probar con sesión en pantalla:** ver como (cada rol), torre de control, flujo completo de caja chica (gasto → arqueo → aprobación → reposición) contra la base.
- [ ] **Ubicar los liceos** en el mapa de Habitudes (el seed no trae coordenadas) y migración para guardar lat/lng de la visita.
- [ ] **Contabilidad:** `reponer_caja()` en la base sigue rota (ya nadie la llama; retirarla); la depreciación usa las cuentas de la categoría del primer activo para todos; `loading.tsx` en cajas.
- [ ] **Landing:** fotos reales de la Fundación en el hero; borrar claves sin uso (`work_*_tag`, `work_training_*`, `access_*_f1–f3`).
- [ ] **Documentar** los nuevos tokens de movimiento en `docs/09-sistema-visual.md` §2.8 y `.claude/rules/design-system.md`.
- [ ] `proyectos/[id]/page.tsx` conserva textos literales en JSX.

- [x] **Flujo de Fondos, Diagnóstico de Liquidez y Cuadre de Caja en Portal Contabilidad (31 oct 2026):**
      - **Visión Institucional de Fundación (`src/app/[locale]/(portal)/portal/contabilidad/page.tsx`):**
        - Integración del panel de Flujo de Fondos en tiempo real: Dinero que entra (ingresos/donaciones del mes en DOP), Dinero que sale (egresos/gastos y movimientos de caja), Liquidez total disponible consolidada (Bancos + Cajas chicas) y Compromisos pendientes de pago (CxP).
        - Diagnóstico de fondos ("¿Hay que solicitar más dinero?"): Alerta automática cuando los fondos operativos no cubren compromisos o cuando una caja chica está por debajo del 25% de su fondo fijo, con botón directo para "Solicitar fondos" (`/administrativo/solicitudes`).
      - **Cuadre de Caja y Arqueo Físico:**
        - Acceso directo y visible a "Cuadre de caja" en la cabecera del portal y tarjetas individuales por cada caja chica activa con barra de nivel del fondo fijo y botón "Hacer arqueo" (`/contabilidad/cajas/[id]/arqueo`).
        - En `/contabilidad/cajas/page.tsx` y `cajas/[id]/page.tsx`, estandarización de las acciones de "Cuadre / Arqueo" y retiro de cadenas literales por claves de internacionalización.
      - **Módulos del Departamento (`src/lib/contabilidad/modulos.ts` y `messages/{es,en}.json`):**
        - Añadidas las claves de traducción faltantes para `nomina`, `activos-fijos` y `consumibles`, definiendo explícitamente la función de cada módulo institucional para donaciones, fondos restringidos, compras y rendición.
      - **Calidad:** 4,381 claves i18n simétricas (`npm run i18n:check`), 0 colores fuera de marca (`npm run audit:ui`), `npm run lint` y `npm run build` en verde al 100%.

- [x] **Rediseño y simplificación de la Landing y botón de retorno en Login (31 oct 2026):**
      - **Login (`src/app/[locale]/(auth)/login/page.tsx` y `layout.tsx`):** se incorporó el botón "Volver al inicio" con icono de flecha tanto en el encabezado de la tarjeta principal (junto al logotipo institucional) como en la parte superior del marco de autenticación para facilitar el retorno inmediato a la página principal.
      - **Landing de inicio (`src/app/[locale]/page.tsx` y componentes en `src/components/landing/`):**
        - Eliminación de subtítulos redundantes en todas las cabeceras de sección (`CabeceraSeccion`) y en la franja de roles.
        - Supresión de listas de viñetas innecesarias en las puertas de acceso (`SeccionAcceso`), retirando textos redundantes y simplificando el contenido de las tarjetas de noticias.
        - Rediseño unificado del formato de tarjetas (`TarjetaAnuncio` en `piezas.tsx`, tarjetas de acceso en `seccion-acceso.tsx` y garantías en `seccion-patrocinadores.tsx`): contenedor cerrado con bordes definidos, elevación suave al interactuar (`hover:-translate-y-1 hover:shadow-elevada hover:border-marca-300`), cabecera visual integrada, espaciado proporcional (`p-5`/`p-6`) y botón de acción con icono alineado en el pie.
      - **Calidad:** `npm run lint`, `npm run build`, `npm run i18n:check` y `npm run audit:ui` pasando en verde al 100%.

- [x] **Alineación de Navegación Contable y Vinculación de Programas a Comprobantes (25 oct 2026):**
      - **Navegación Contable (`src/lib/nav.ts`):** `MENU_CONTABILIDAD` reestructurado en 7 áreas funcionales por ciclo contable (Contabilidad General, Tesorería, Ingresos, Gastos, Impuestos, Activos, Gestión/Herramientas), dotándolo de acceso a Calendario, Reuniones y Chat IA. En `MENU_ADMINISTRACION`, el acceso directo a Contabilidad se nombró `Inicio` para eliminar redundancias.
      - **Vinculación de Programas a Comprobantes:** en `src/components/contabilidad/comprobantes/panel-revision-comprobante.tsx` y `comprobantes-recibidos/page.tsx`, se integró el catálogo de proyectos activos (`programasParaRendicion`) permitiendo ver y asociar cada comprobante/factura/foto escaneada a un programa misional de la Fundación (Beca Universitaria, Global Effect 360, Comedor, etc.).
      - **Acceso Universal a Apariencia y Modos (`topbar.tsx`):** se expuso en el dropdown del avatar el acceso a `Apariencia y tema` (`/perfil`) para todos los roles, y acceso directo a `Configuración contable` para el rol contable.
      - **Auditoría Documentada:** reporte exhaustivo en `recuento_modulos_roles_y_contabilidad.txt`.
      - **Calidad:** 4,359 claves simétricas (`npm run i18n:check`), 0 colores fuera de marca (`npm run audit:ui`), `npm run lint` y `npm run build` pasando al 100%.
- [x] **Proyectos Avanzados, Fases y Cronograma Gantt (25 oct 2026, migración `0062`):**
      - **Migración `0062_proyectos_avanzados_fases_gantt.sql`:**
        - Tabla `public.proyecto_fase` (fases ordenadas cronológicamente con color de marca).
        - Tabla `public.proyecto_hito` (hitos/milestones institucionales con indicador de alcanzado).
        - Extensión de `public.tarea` con `fase_id`, `tarea_padre_id` (subtareas jerárquicas), `fecha_inicio`, `progreso` (0-100%), `horas_estimadas`, `horas_reales` y bandera `es_hito`.
        - Tabla `public.tarea_dependencia` para dependencias lógicas (FS Fin-Inicio, SS Inicio-Inicio) y días de desfase sin autodependencias cíclicas.
      - **Capa Servidor:**
        - `src/server/operaciones/gantt-consultas.ts`: consulta optimizada `proyectoParaGantt` con cálculo de fechas, asignados y mapa de dependencias.
        - `src/server/operaciones/gantt-acciones.ts`: `actualizarFechasTareaGantt` (reprogramación interactiva), `agregarDependenciaTarea`, `eliminarDependenciaTarea` y `crearFaseProyecto`.
      - **Componentes y UI:**
        - `src/components/operaciones/visualizador-gantt.tsx`: visualizador SVG/HTML con selector de escala (Días / Semanas), timeline con barras proporcionales al avance, progreso visual interno y panel modal de detalle.
        - Nueva ruta: `/administrativo/proyectos/[id]` (`src/app/[locale]/(portal)/administrativo/proyectos/[id]/page.tsx`) con navegación directa desde la tarjeta de proyectos.
      - **Calidad:** 4,355 claves simétricas (`npm run i18n:check`), 0 colores fuera de marca (`npm run audit:ui`) y 95 pruebas pasando (`npm run test:contabilidad`).
- [x] **Nexus AI, fases 1–5 y parte de la 6–7 (24 oct 2026).** Migraciones
      `0057`–`0059` aplicadas. Agente por rol, medidor y cuotas, chat con
      streaming (`/api/ia/chat`), herramientas con aprobación y deshacer,
      conocimiento por agente, «Mi día» de Contabilidad y apariencia
      (tema claro/oscuro y barra lateral negra, en Mi perfil). Detalle y lo que
      falta en [`plan-nexus-ai.md`](plan-nexus-ai.md); revisión del trabajo
      del otro agente en [`revision-portales-y-contabilidad.md`](revision-portales-y-contabilidad.md).
- [x] **Actividad del equipo, visibilidad por rol y modo oscuro (25 oct 2026).**
      `/configuracion/actividad` (quién hizo qué y a qué hora, con 4 gráficas,
      «quién está activo», línea de tiempo unificada de las 4 fuentes de rastro y
      descarga en CSV), `/configuracion/visibilidad` (el administrador maestro
      oculta o bloquea módulos y el botón del asistente por rol; migración `0060`),
      inicio y cierre de sesión y otras acciones que no dejaban rastro ahora lo
      dejan, y ~700 colores fijos del portal pasaron a tokens para que el modo
      oscuro se lea. `next build` pasa por primera vez desde que se añadieron los
      portales (se corrigieron los 6 errores de tipos del portal del colaborador y
      del panel de comprobantes).
- [ ] **Rastro que sigue faltando** (revisión del 25 oct): el chat interno, la
      validación de comprobantes recibidos y la orden de compra no dejan rastro
      propio ni exigen permiso (ver `revision-portales-y-contabilidad.md`).
- [ ] **Probar en pantalla, con sesión:** visibilidad (ocultar y bloquear un
      módulo para un rol y entrar con esa cuenta), actividad, «Mi día» y el
      asistente.
- [ ] **Probar Nexus AI en pantalla con una clave real** (`ANTHROPIC_API_KEY`):
      hasta ahora solo se probó el bucle con un proveedor falso y el flujo de
      streaming contra un servidor de Anthropic simulado. Verificar el
      identificador de modelo (`ANTHROPIC_MODEL`) y, si se quiere Haiku para
      estudiante y colaborador, fijarlo en `/configuracion/ia`.
- [ ] **Cargar precios y cuotas** en `/configuracion/ia`: sin precios el costo no
      se calcula y sin cuota no hay tope.
- [ ] **Cargar las normas fiscales** del agente de Contabilidad en
      `/configuracion/conocimiento` (Ley 122-05, 32-23, 30-26, 155-17, Código
      Tributario, DGII). No se sembraron: no se transcriben leyes de memoria.
- [ ] **Embeddings y Drive** para la base de conocimiento (decisión de
      proveedor y app OAuth Internal).
- [ ] **Modo oscuro**: revisar pantalla por pantalla; hay `bg-white`,
      `bg-slate-*` y colores fijos que no se adaptan.
- [ ] **Corregir lo crítico de la revisión del otro agente** (chat sin control de
      acceso, comprobantes sin permiso): ver `revision-portales-y-contabilidad.md`.
      `next build` hoy falla solo por sus errores de tipos en
      `portal/colaborador/page.tsx` y `panel-revision-comprobante.tsx`.
- [x] **Portales por Rol como Software Completo — Fases 1 y 2 (24 oct 2026):**
      - **Migración `0055_servicios_compartidos_base.sql`:**
        - Introducción formal del rol `colaborador` para personal operativo (choferes, mantenimiento, cocina, auxiliares) con permisos mínimos (`rendicion.enviar`, `solicitudes.gestionar`, `ia.usar`).
        - Tabla `public.departamento` con departamentos institucionales (`direccion`, `administracion`, `contabilidad`, `operaciones`, `academico`, `habitudes`) y relación `departamento_colaborador`.
        - Tabla `public.usuario_push_subscription` para notificaciones Web Push PWA (VAPID) y `public.correo_cola` para envíos transaccionales asíncronos.
      - **Migración `0056_chat_interno_y_comprobantes.sql`:**
        - Tablas de mensajería: `public.chat_canal` (directo, grupo, departamento, hilo_caso), `public.chat_participante` y `public.chat_mensaje` (soporte para tarjetas de comprobantes de gasto y adjuntos).
        - Tabla `contabilidad.comprobante_recibido` con folio correlativo, enlace a mensajes de chat, hash SHA-256 inmutable, clasificación presupuestaria (centro de costo, fondo, proyecto, caja) y flujo de validación en tiempo real.
      - **Servicios y UI del Servidor:**
        - `src/server/compartidos/notificaciones.ts`: registro de suscripciones push y encolado de correos.
        - `src/server/chat/{consultas,acciones}.ts`: envío de mensajes, apertura de canales directos y acción `reportarGastoDesdeChat` con notificación automática a contabilidad.
        - `src/server/contabilidad/comprobantes/{recibidos-consultas,recibidos-acciones}.ts`: bandeja contable y validación/rechazo de comprobantes de campo con feedback al hilo de chat.
        - Portal del Colaborador en `/portal/colaborador` (`src/app/[locale]/(portal)/portal/colaborador/page.tsx`).
        - Bandeja de Comprobantes Recibidos en `/contabilidad/comprobantes-recibidos` (`src/components/contabilidad/comprobantes/panel-revision-comprobante.tsx`).
      - **Calidad:** 3,916 claves simétricas validadas (`npm run i18n:check`), 0 colores fuera de marca (`npm run audit:ui`), 95 pruebas pasando (`npm run test:contabilidad`) y migraciones aplicadas limpiamente.

- [x] **Fin de los cursos técnicos (24 oct 2026, migración `0047`).** La
      Fundación dejó de impartirlos y Global Effect 360 ocupa su lugar: docente,
      tareas, entregas y nota final. Todo `regular` pasa a `becado` y el valor
      sale del ENUM, porque un solo tipo de estudiante no necesita distinguirse;
      `curso`, `calificacion` y `tipo_evaluacion` se borran sin copia, como la
      `0030` con Psicología, y las tareas de curso se van con
      `asignacion.curso_id` (una tarea cuelga ahora de una materia universitaria
      o de una de 360, exactamente de una). 360 se abre a todos —el trigger
      `solo_becado_en_360` ya no protegía nada—, todo su catálogo es obligatorio
      (`materia_360.obligatoria` se retira) y cada cuatrimestre tiene dos tandas
      de dos meses con **una materia por tanda**, sostenida por un índice único
      parcial sobre `inscripcion_360(estudiante_id, periodo_id, ronda)` que no
      cuenta las retiradas. `/academico/cursos` pasa a `/academico/clases-360`
      y `/academico/calificaciones` desaparece; `calificaciones.registrar` sirve
      ahora para la nota final de 360. Documentación puesta al día en `docs/`,
      `db/README.md`, `README.md` y la regla 9 de `CLAUDE.md`/`AGENTS.md`.
- [x] **Aplicar la `0047` en la base** (`npm run db:migrate`, 24 oct 2026).
- [x] **Portal de contabilidad preparado para módulos nuevos (24 oct 2026).**
      Los módulos salen de un registro único (`src/lib/contabilidad/modulos.ts`)
      que genera el menú agrupado, el área de Finanzas de administración y el
      lanzador del inicio. El inicio abre con "Para hoy" (lo vencido y lo que
      espera revisión). Rendiciones, inventario, solicitudes y reportes se
      encuentran desde el departamento sin moverse de su área. Los formatos DGII
      se reúnen en `/contabilidad/impuestos` con selector de mes (antes siempre
      el mes en curso). De paso se arreglaron las exportaciones de 607 y del
      libro de banco, que pedían columnas inexistentes, y la ruta de
      exportación pasó a exigir `contabilidad.leer` en vez de mirar el rol.
- [x] **Plan del ERP contable aprobado** (`docs/prompts/plan-contabilidad-erp.md`,
      sección d) y **Fase 1 construida** (migraciones `0048` y `0049`).
      Comprende:
      - La entidad, y los parámetros de ITBIS y retenciones con vigencia:
        retención de ISR del 10 % al 15 % desde el 1 de julio de 2026.
      - `/contabilidad/configuracion` con cuatro pestañas: entidad, nueva
        vigencia de parámetros, cerrar y reabrir períodos con motivo, y
        catálogo de cuentas.
      - `/contabilidad/asientos`: manuales, de ajuste, apertura y cierre,
        reverso con motivo y plantillas recurrentes.
      - `/contabilidad/libros`: diario, mayor con saldo corrido y balanza de
        comprobación, cada uno con su Excel.
      - El punto de extensión `ComprobanteProvider`, sin emisión.
      - 15 pruebas nuevas de cuadre en `test:contabilidad`.

      De paso se corrigieron tres problemas del catálogo y los parámetros:
      - Parámetros repetidos de 4 a 8 veces.
      - El 31 de diciembre sin parámetro vigente.
      - Cuatro cuentas sin padre en el catálogo.
- [ ] **Cuentas de naturaleza contraria:** el signo del saldo sale de `tipo`, así
      que "Depreciación acumulada" (un `activo`) se ve en negativo en el mayor.
      Añadir una `naturaleza` a `cuenta_contable` antes de la Fase 5
      (depreciación).
- [x] **Fase 2 del ERP contable (24 oct 2026, migración `0050`):**
      - Tabla unificada `contabilidad.tercero` con validación de RNC (módulo 11 DGII) y Cédula (Luhn) dominicanos.
      - Debida diligencia de prevención de lavado de activos (Ley 155-17) con origen de fondos, verificación PEP, listas y dictamen de cumplimiento.
      - Donaciones en efectivo y en especie con asiento automático de partida doble y tratamiento fiscal (exento Ley 122-05 vs gravado).
      - Promesas de donación con calendario de cuotas y seguimiento de avance de cobros.
      - Órdenes de compra con flujo de aprobación por perfil (`contabilidad.aprobar`).
      - Comprobantes de retención tributaria automáticos por factura de proveedor con anulación justificada.
- [x] `patrocinador` integrado a `contabilidad.tercero` con RNC, cédula y debida diligencia para formatos 607 y donaciones.
- [x] **Fase 3 del ERP contable (24 oct 2026, migración `0051`):**
      - Formatos oficiales DGII 606, 607, 608 y 609 en archivos TXT reglamentarios, con prevalidación de RNC/NCF y soporte para envíos en cero (`/api/contabilidad/exportar/[tipo]`).
      - Liquidaciones y anexos fiscales para IT-1 (ITBIS y retenciones con exención Ley 122-05), IR-17 (retenciones de servicios y honorarios al 15% bajo Ley 30-26) e ISFL-01 anual.
      - Calendario fiscal institucional con cálculo automático de días restantes, estado de vencimiento y registro de autorizaciones DGII con hash SHA-256.
      - Recargos y mora según Arts. 251 y 252 del Código Tributario Dominicano (10% primer mes o fracción + 4% mensual progresivo + 1.10% interés indemnizatorio mensual).
      - Suite de 6 calculadoras dominicanas en `/contabilidad/calculadoras` (Factura con retenciones, ITBIS directo/inverso, Retenciones físicas/jurídicas, Recargos y mora DGII, Amortización francesa de préstamos y Salarios TSS/ISR asalariados) con conversión a borrador de asiento contable en 1 clic.
      - 81 pruebas unitarias pasando al 100% (`npm run test:contabilidad`), cero arcoíris (`npm run audit:ui`), simetría bilingüe (`npm run i18n:check`) y compilación TypeScript limpia.
- [x] **Fase 4 del ERP contable (24 oct 2026, migración `0052`):**
      - Tabla `contabilidad.centro_costo` con centros de costo por programa misional (becas, formación 360, comedor, administrativo, institucional).
      - Ampliación de `contabilidad.fondo` con contabilidad por fondos ASFL (restringidos temporales y permanentes vs no restringidos) y trazabilidad de donantes.
      - Tabla `contabilidad.fondo_liberacion` para el circuito de liberación de fondos restringidos al ejecutar gastos convenidos, con asiento automático de reclasificación patrimonial.
      - Tablas `contabilidad.presupuesto` y `contabilidad.presupuesto_linea` con planificación anual por centro de costo y cuenta.
      - Matriz de ejecución presupuestaria con cálculo de desviaciones, porcentajes y alertas automáticas de sobregiro (> 100%) y preventivas (≥ 80%).
      - Módulo de Rendición de Cuentas por Donante con trazabilidad Donación → Fondo → Gastos/Becas ejecutadas.
      - Nuevas pantallas en `/contabilidad/centros-costo`, `/contabilidad/fondos`, `/contabilidad/presupuesto` y `/contabilidad/rendicion`.
      - 85 pruebas unitarias pasando al 100% (`npm run test:contabilidad`), sin arcoíris (`npm run audit:ui`), i18n simétrico (`npm run i18n:check`) y TypeScript limpio.
- [x] **Fase 5 del ERP contable: Nómina, Activos Fijos e Inventario (24 oct 2026, migración `0053`):**
      - **Nómina y Seguridad Social Dominicana:**
        - Tabla `contabilidad.empleado` con vinculación a `tercero` (cédula/RNC), `centro_costo` (programa misional de imputación) y `usuario` opcional. Confidencialidad estricta con permiso `contabilidad.nomina` y auditoría en bitácora (`ver_nomina`).
        - Tablas `contabilidad.nomina` y `contabilidad.nomina_linea` para corridas mensuales, quincenales y regalía pascual. Cálculo automático de TSS (AFP 2.87%, SFS 3.04%, aportes patronales AFP 7.10%, SFS 7.09%, SRL 1.10%, INFOTEP 1.00%) con topes legales y retención de ISR de asalariados según escala de DGII.
        - Generación y descarga directa del archivo plano oficial en texto (TXT) de autodeterminación para TSS SUIR Plus.
        - Circuito de aprobación y pago con generación de asientos contables automáticos (Gasto sueldos / cargas patronales a Sueldos por pagar / TSS / ISR, y desembolso bancario).
        - Calculadora interactiva de prestaciones laborales dominicanas conforme al Código de Trabajo (Ley 16-92): Preaviso (Art. 76), Cesantía (Art. 80), Vacaciones (Art. 177) y Regalía Pascual (Art. 219) con factor diario 23.83.
      - **Activos Fijos y Depreciación:**
        - Cuentas contables creadas (`1.2.02` Mobiliario, `1.2.03` Vehículos, `1.2.04` Edificaciones, `1.2.09` Depreciación Acumulada, `5.2.01.09` Gasto Depreciación).
        - Tabla `contabilidad.activo_categoria` sembrada con categorías NIIF / DGII: Cat 1 (Edificaciones 5% / 20 años), Cat 2 (Equipos cómputo, vehículos 25% / 4 años), Cat 3 (Mobiliario, equipos oficina 20% / 5 años).
        - Tabla `contabilidad.activo_fijo` con costo de adquisición, valor residual, depreciación acumulada, valor neto en libros y enlace opcional a `public.inventario_activo` (QR físico).
        - Tablas `contabilidad.depreciacion_mensual` y `contabilidad.depreciacion_linea`: ejecución de corrida mensual de depreciación lineal con asiento contable automático.
      - **Inventario y Kardex (Comedor y Suministros):**
        - Cuentas creadas (`1.1.04.01` Alimentos y Comedor, `1.1.04.02` Suministros y Didáctico, `5.2.01.07` Consumo Comedor, `5.2.01.08` Consumo Suministros).
        - Tabla `contabilidad.articulo` para consumibles con stock actual, stock mínimo, costo promedio ponderado y valor total.
        - Tabla `contabilidad.inventario_movimiento` (kardex) para entradas por compra/donación y salidas de consumo con recálculo automático de costo promedio y asiento contable de gasto.
        - Tablas `contabilidad.conteo_fisico` y `contabilidad.conteo_fisico_linea` para tomas físicas periódicas con cálculo de faltante/sobrante y asiento contable de ajuste.
      - Nuevas páginas en `/contabilidad/nomina`, `/contabilidad/activos-fijos` y `/contabilidad/inventario`.
      - 89 pruebas unitarias pasando al 100% (`npm run test:contabilidad`), 0 errores de TypeScript (`tsc --noEmit`), 0 arcoíris y 0 hex sueltos (`audit:ui`), y 3,768 claves simétricas (`i18n:check`).
- [x] **Fase 6 del ERP contable — Reportes, Estados Financieros y Cierre (24 oct 2026, migración `0054`):**
      - **Migración `0054_contabilidad_fase6_estados_financieros_cierre.sql`:**
        - Tabla `contabilidad.cierre_anual`: ejercicio fiscal, fecha_cierre, asiento_cierre_id, total_ingresos, total_gastos, superavit_deficit, cerrado_por, cerrado_en, notas.
        - Tabla `contabilidad.snapshot_financiero`: congelación inmutable de estados financieros para auditoría externa y DGII (`balance_general`, `estado_actividades`, `flujo_efectivo`, `cambios_patrimonio`, `ejecucion_presupuestaria`).
        - Fortalecimiento de la función `contabilidad.cerrar_periodo(p_periodo)` con verificación estricta contra borradores de recibos, facturas de compras, nóminas y tomas físicas de inventario.
        - Auditoría encadenada automática y RLS activo.
      - **Estados Financieros Oficiales ASFL (Ley 122-05 / NIIF para PYMES):**
        1. **Balance General (Situación Financiera):** Activo Corriente y No Corriente, Pasivo Corriente, Patrimonio Social y Superávit/Déficit del período en curso, con verificación matemática de cuadre $\Delta = \text{Activo} - (\text{Pasivo} + \text{Patrimonio}) = 0$.
        2. **Estado de Actividades (Resultados ASFL):** Ingresos vs Gastos, clasificados por fondos con y sin restricciones de donantes, y determinación del cambio neto en los fondos.
        3. **Estado de Flujos de Efectivo (Método Indirecto):** Flujos operativos (superávit + ajustes no monetarios por depreciación + cambios en capital de trabajo), flujos de inversión (adquisición de activos fijos), flujos de financiamiento y conciliación exacta de saldo inicial a saldo final de efectivo.
        4. **Estado de Cambios en el Patrimonio / Fondos:** Variación de fondos no restringidos, temporalmente restringidos y resultados acumulados con liberaciones de restricciones.
        5. **Mayor General Analítico Filtrable:** Filtros por cuenta, centro de costo, fondo y rango de fechas con saldo anterior, movimientos cronológicos y saldo acumulado progresivo.
        6. **Flujo de Caja Proyectado (3 a 6 meses):** Análisis de liquidez futura mes a mes con entradas por donaciones recurrentes y promesas por cobrar, y salidas por nómina estimada, compras comprometidas aprobadas y gastos operativos fijos.
      - **Cierre Contable Mensual y Anual:**
        - Cuadrícula interactiva de los 12 meses con detección de borradores y botones de Cerrar Mes y Reabrir Mes (con justificación auditada de al menos 10 caracteres).
        - Asistente de Cierre Anual con verificación de meses cerrados, cálculo de cuentas de resultados y generación del asiento automático de ajuste saldando ingresos (debe) y gastos (haber) contra `3.1.01.02 Resultados Acumulados`.
      - **Rutas del Portal y UI:**
        - `/contabilidad/reportes` (`src/components/contabilidad/reportes/vista-reportes.tsx`).
        - `/contabilidad/cierre` (`src/components/contabilidad/cierre/vista-cierre.tsx`).
        - Registro en `src/lib/contabilidad/modulos.ts` (`financialStatements` y `accountingClosing`).
      - **Calidad y Verificación:**
        - 95 pruebas unitarias pasando al 100% (`npm run test:contabilidad`), 0 errores de TypeScript (`tsc --noEmit`), 0 colores fuera de marca y 0 hex sueltos (`audit:ui`), y 3,903 claves simétricas (`i18n:check`).
- [x] **Fase 7 del ERP contable — Auditoría Integral, Semillero y Documentación Final (24 oct 2026):**
      - **Semillero Completo e Idempotente (`npm run db:seed:contabilidad`):**
        - Población automática de datos dominicanos íntegros: catálogo ASFL de 4 niveles, secuencias (`RI`, `CE`, `PG`, `CH`, `AR`, `AS`, `NM`, `FP`, `OC`, `CR`, `CF`, `AF`, `DP`, `PR`), terceros (Induveca S.A. donante, Claro Dominicana suplidor, Lic. Juan Pérez empleado), fondos restringidos misionales (`FND-BECAS`, `FND-COMEDOR`), plantilla de empleados (`EMP-001`, `EMP-002`, `EMP-003`) con salarios y centros de costo, activos fijos capitalizados (cómputo y mobiliario), inventario consumible con costo promedio ponderado y los 12 períodos del ejercicio 2026.
      - **Documentación de Referencia y Arquitectura:**
        - Creación de [`docs/referencia/departamento-contabilidad.md`](../referencia/departamento-contabilidad.md) con el marco legal dominicano (Ley 122-05, DGII, Ley 155-17, Ley 30-26, TSS, Código de Trabajo Ley 16-92), estructura jerárquica del catálogo, subsistemas integrados y guías operativas.
        - Actualización del catálogo de módulos en [`docs/03-modulos-funcionales.md`](../03-modulos-funcionales.md) (Módulo 14: Departamento de Contabilidad).
        - Actualización del cuadro maestro de avance en [`docs/estado/progreso.md`](progreso.md) (Portal 6).
      - **Auditoría de Calidad y Criterios de Aceptación:**
        - 95 pruebas unitarias pasando al 100 % (`npm run test:contabilidad`).
        - 0 errores de tipos en TypeScript (`tsc --noEmit`).
        - 0 incidencias en auditoría visual de marca (`npm run audit:ui`).
        - 3,903 claves simétricas validadas en español e inglés (`npm run i18n:check`).
- [ ] **Validar con la Fundación la nota mínima de aprobación de 360** (hoy
      70/100). Es la que decide si una inscripción queda aprobada o reprobada, y
      una reprobada obliga a repetir la materia en otro período: es una norma
      académica, no un detalle de pantalla.
- [ ] Los dos `.drawio` de `docs/04-modelo-de-datos/` ya no tienen `curso` ni
      `calificacion` (0047), pero **siguen dibujando Psicología**:
      `cita_psicologia`, `nota_psicologica`, `perfil_psicologico`, el actor
      Psicólogo y su proceso. Nadie los limpió tras la `0030`; hay que hacerlo a
      mano en draw.io, que es más seguro que editar el XML.
- [ ] Confirmar si el estado `standby_tecnico` de `estado_estudiante` sigue
      teniendo sentido sin cursos técnicos. La `0047` no lo toca y el nombre
      invita a pensar que era del programa técnico.
- [ ] Cuadrar los recuentos de tablas, enums y claves foráneas: cada documento
      de `docs/04-modelo-de-datos/`, `db/README.md` y
      `docs/estado/inventario-vs-fases.md` cuenta sobre una base distinta y
      ninguno llega a la `0047`. Se restó lo que quitó la `0047` sin recontar.
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
      obligatoria en 2 rondas por cuatrimestre (Ronda 1: Regular, Ronda 2: Ajustes y Bloque 2;
      **superado por la `0047`**: ahora son dos tandas de dos meses, una materia en cada una, todo obligatorio)
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
- [x] **Agenda de Reuniones Institucionales para Todo el Personal (Sustitución de Psicología):** Agendamiento
      de reuniones institucionales para todo el personal y estudiantes (coordinación operativa, tutorías académicas,
      seguimiento vocacional, consejos de dirección y reuniones departamentales), respaldado por la migración
      `0044_agenda_institucional_reuniones.sql` y `scripts/seed-reuniones.mjs`; hub interactivo (`/reuniones`),
      soporte para modalidades presencial, virtual e híbrida con sala o enlace de Google Meet/Zoom, registro de
      participantes con roles y confirmación de asistencia, diálogo de redacción de minutas de acuerdos y compromisos,
      integración en tiempo real con el calendario general del personal (`/calendario`) y la agenda del estudiante
      (`/portal/estudiante/calendario`), y atajo táctil nativo en el cajón de acciones rápidas móvil.
- [x] **Gobierno de Permisos de Super Admin por Usuario (`/configuracion/permisos`):** Gestor interactivo
      para que el `super_admin` (`requerirPermiso("usuarios.administrar")`) audite los permisos base de cada usuario
      según su rol y configure excepciones granulares (`usuario_permiso`: conceder o revocar individualmente) con
      motivo justificado y registro en bitácora de auditoría (`audit_log`), filtros por módulo y opción de restablecer
      los permisos por defecto del rol.
- [x] **Rol Director de Habitudes (DH) y Supervisión Pedagógica:** Incorporación del rol institucional `dir_habitudes`
      ("Director de Habitudes (DH)", sigla oficial DH) con permiso `habitudes.supervisar` (`0045_director_habitudes_y_mapa_la_vega.sql`).
      Panel directivo en `/habitudes` (pestaña Supervisión) para monitorear el progreso de los profesores a su cargo,
      auditar evidencias fotográficas y horas impartidas, y gestionar la asignación de profesores y estudiantes a liceos.
- [x] **Mapa Interactivo Acotado a la Provincia de La Vega (Leaflet):** Componente cartográfico institucional
      (`MapaLaVega`) bloqueado estrictamente a los límites geográficos de la provincia de La Vega (`18.7000 <= lat <= 19.4500`,
      `-70.9500 <= lng <= -70.3500`, `maxBoundsViscosity: 1.0`), integrando sus 4 municipios (Concepción de La Vega,
      Jarabacoa, Constanza, Jima Abajo), distritos municipales y sectores.
      - **Uso 1:** Mapa de liceos en La Vega con profesores asignados, tandas y conteo de alumnos de Habitudes.
      - **Uso 2:** Ubicación georreferenciada de la vivienda de cada estudiante activo en su expediente (`perfil_vivienda`).
- [x] **Seguridad y RLS en Supabase (Linter rls_disabled_in_public):** Activación de Row Level Security (RLS) en todas las tablas de los esquemas `public` y `contabilidad` (migración `0046_habilitar_rls_todas_las_tablas.sql`), bloqueando accesos anónimos indebidos vía PostgREST y resolviendo al 100% las alertas de seguridad del Linter de Supabase sin alterar el acceso del backend vía pool superuser `pg`.
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
- [x] **DGII Formato 607 (Ventas e Ingresos para ISFLs):** Exportación oficial a Excel (.xlsx)
      conforme a la Norma General 06-2018 de la DGII en `/contabilidad/recibos`,
      procesando donaciones, recibos de ingresos institucionales, RNC/cédula de aportantes,
      NCF formal (B02 Consumidor Final / Donación), tipo de ingreso institucional y exención
      tributaria de ITBIS para fundaciones sin fines de lucro (Ley 122-05).
- [x] **Portal Habitudes y Hub de Recursos (`/habitudes`):** Redirección oficial del rol
      `habitudes` a su hub institucional `/habitudes` en `src/lib/rbac.ts` (en lugar de
      la ruta restringida `/expedientes`), con acceso al repositorio colaborativo
      de diapositivas, guías y dinámicas, registro móvil de visitas a liceos con fotos,
      y solicitudes de alta de candidatos vía `/administrativo/solicitudes`.
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
- [x] **Parámetros institucionales (25 oct 2026, migración `0061`).**
      `/configuracion/parametros` para `admin` y `super_admin`. Lo que estaba
      escrito en el código pasa a ser editable: horario del comedor (la
      portada, la página de comida, la acción de inscripción y la lista de
      cocina leen el mismo valor), índice, asistencia, horas de servicio y nota
      de 360 (el asistente los repite a estudiantes y personal, y por eso el
      reglamento dejó de ser un texto fijo), plazo de revisión de normas y
      correo de contacto. Solo se guarda lo que se aparta del valor normal.
      Los parámetros fiscales siguen en `/contabilidad/configuracion`, con su
      vigencia y su fuente legal. La Configuración quedó agrupada por tema.

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
      `rbac.ts`, así que entra a `/academico/clases-360` y lee, pero no
      puede poner ni corregir la nota final de una inscripción (antes pasaba
      lo mismo en `/academico/calificaciones`, retirada en la `0047`). Se implementó respetando la base, que
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
- [x] ~~`inscripcion` **no tiene el trigger** que sí protege a `inscripcion_360`
      ("solo becados"). La regla vive únicamente en
      `src/server/estudiantes/acciones-matricula.ts`, así que un script que
      escriba directo en la tabla se la salta. Si importa que la base la
      sostenga, es una migración de tres líneas copiando `solo_becado_en_360`.~~
      **Superado por la `0047`:** todo estudiante es becado, así que la regla
      ya no deja fuera a nadie; la propia `0047` borró `solo_becado_en_360`.
      Si `acciones-matricula.ts` aún comprueba el tipo, sobra.
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
      columna. Desde la `0047` cada inscripción lleva su tanda (1 o 2, dos
      meses cada una), que ya sitúa la barra en la mitad del período que le
      toca; lo que sigue sin existir es la fecha exacta del corte entre tandas.
- [ ] `materia` no tiene fechas propias: hereda las del período, así que en
      el Gantt todas sus barras miden lo mismo (`curso` tenía el mismo
      problema y se fue con la `0047`). Está dicho en
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
        saber de qué se habla. (Desde la `0047` son dos: los cursos técnicos
        se retiraron y las clases de 360 se gestionan en `/academico/clases-360`.)
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

- [x] **Calificaciones** (`/academico/calificaciones`, retirada en la `0047`): registro, corrección y
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
