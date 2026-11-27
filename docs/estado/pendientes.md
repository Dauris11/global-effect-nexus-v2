# Pendientes

Lista de tareas abiertas que se van marcando conforme se resuelven. Se actualiza
en cada sesión de trabajo: lo que se cierra se tacha o se quita, lo nuevo que
aparece se agrega. No sustituye a [`docs/estado/progreso.md`](progreso.md) (estado por
módulo) — esto es solo la cola de pendientes concretos.

## Rediseño UX — base (26 nov 2026)

- [x] **Base creada:** `docs/ux-rules.md`, Plus Jakarta Sans + Plex Mono, escala `text-*`, botones 36/32/44, tokens `status-*`, `src/lib/status-map.ts` (105 estados) y `src/components/app/*`. Muestra en `/ui-kit` (solo desarrollo).
- [x] **Patrón Lista aplicado (26 nov 2026)** a `/expedientes`, `/patrocinadores`, `/patrocinadores/becas`, `/administrativo/solicitudes` (filtro «Por atender» por defecto, aprobar/rechazar inline con confirmación que nombra la solicitud), `/administrativo/rendiciones`, `/administrativo/inventario`, `/contabilidad/asientos`, `/contabilidad/recibos`, `/contabilidad/proveedores`, `/contabilidad/cuentas-por-pagar` y `/academico/universidades`: `PageHeader` con una primaria, `FilterBar` con conteos (sin «Aplicar»), tabla densa de 52 px, `StatusBadge`, acciones al hover y panel lateral al hacer clic. Comprobado en navegador a 1440×800: lista visible sin scroll y 0 botones «Aplicar» en las 11 rutas.
- [ ] **Reportes pendientes de crear:** al quitar KPIs y gráficas de esas listas se dejaron de renderizar (los componentes siguen en disco) y aún no existen `/reportes/<módulo>` que las reciban: solicitudes (donut por estado y barras por tipo), rendiciones (anillo y barras por estado), inventario (KPIs, donut por estado, barras por categoría), patrocinadores (4 KPIs, anillo por tipo, becados por patrocinador), becas (4 KPIs, anillo de cobertura), CxP (antigüedad de saldos, `TablaAntiguedad`), recibos (totales por tipo y moneda).
- [ ] **Falta migrar pantallas** al nuevo marco (sidebar por rol, `PageHeader`, `/inicio`, «Ver como» rápido): ver los encargos 2 y 3 del rediseño. Hasta entonces conviven los componentes viejos (`EncabezadoPagina`, `EstadoVacio`, `Badge`).
- [ ] Estados del código sin clasificar o dudosos: `repetido` (solo en TS, falta en el CHECK de la migración 0092), `reverso` (asiento), `prueba_academica` y estados de `periodos`/`cursos` sin CHECK. No hay «estado de beca» ni de comida.

## Récord de secundaria con foto y lectura por IA (26 nov 2026, migración `0133`)

- [x] **Foto o captura a mano → tabla para corroborar → confirmar → promedios.** En la pestaña «Académico» del expediente («Récord de secundaria»): se suben 1–4 fotos o PDF (se reducen a ≤ 2000 px en el navegador), la IA transcribe grado, año, centro y notas, el borrador queda guardado (`record_liceo.borrador`), una persona lo revisa y edita en una tabla (notas sin leer bloquean la confirmación; las de poca certeza se marcan) y al confirmar el servidor valida de nuevo, recalcula y guarda en una transacción. Código: `src/lib/record-liceo.ts` (cálculo puro), `src/server/record-liceo/`, `src/components/expedientes/record-liceo/`.
- [x] **Dos promedios, ambos visibles:** general (suma de todas las notas ÷ cantidad de notas; es el que manda) y por año (promedio de los promedios de cada grado). Redondeo mitad hacia arriba a 2 decimales. Quedan en `estudiante.promedio_secundaria` y `promedio_secundaria_anual` (escala 0–100).
- [x] **Varios liceos y años:** cada grado guarda su año escolar y su centro de procedencia; la clave es grado + año + centro. Se pueden agregar grados después (el 6.º) editando y volviendo a confirmar.
- [x] **Fotos originales** en `archivo_academico` (`tipo = record_notas`, con `mime`, `record_liceo_id` y `pendiente` hasta confirmar; descartar borra las pendientes). Se ven en la misma sección.
- [x] **Probado:** `node --test scripts/probar-record-liceo.mjs` (cálculo, validación, fusión) y `npx tsx scripts/probar-ocr-record-liceo.ts <fotos>` (lectura REAL de las dos fotos del récord de ejemplo: 51 notas, sumas 805/769/771/1101/1108, global 89,29, por año 88,93; transcripción sin datos personales en `scripts/fixtures/`).
- [x] **Probado en el navegador (26 nov 2026)** con un estudiante temporal (ya borrado): 2 fotos → lectura → tabla → confirmar (89,29 / 88,93, «Cumple el mínimo de 89») → promedio en la tarjeta de la lista → quitar récord (base limpia y bitácora con los valores). La prueba destapó un bug al confirmar (parámetro SQL repetido) que ya está corregido. La lectura de 2 fotos tardó ~59 s: conviene mostrar avance o leer en paralelo con otro proveedor.
- [ ] **Error de React al renderizar `/expedientes` (lista y ficha) en desarrollo:** «Slot failed to slot onto its children» (un `Button asChild` con más de un hijo). No sale en `/bandeja` y no viene de este cambio; hace que la ficha no se refresque sola tras una acción hasta recargar. Falta ubicarlo.
- [x] **Quitar récord** y promedio de secundaria en la lista de expedientes (con el mínimo `becas.promedio_liceo_minimo`). El candidato de Habitudes no tiene pantalla propia: es una solicitud de alta que luego es expediente.
- Es **aparte del índice universitario**: no escribe en `historial_calificacion` ni `resultado_materia`, no toca `indice_estudiante()` ni la beca. La parte universitaria de «explicar cómo se calcula el índice» sigue abierta.

## Resumen de lo abierto (cierre del 25 nov 2026)

Detalle de cada punto más abajo. Esto es lo que queda al terminar la sesión.

**Necesita información o una decisión de Dirección**
- [ ] **Explicar cómo se calcula el índice en cada universidad.** Hasta entonces el semáforo de beca usa el mínimo global y el «índice promedio» del tablero ejecutivo es solo orientativo.
- [ ] **Récord del liceo:** cuáles son las **cuatro materias principales** y qué otros factores pesan para recomendar carrera. El mínimo (89) ya es configurable. **Ya resuelto (26 nov 2026):** el promedio general (todas las notas) y el por año se calculan y se guardan en el expediente, con las fotos (ver el bloque de abajo). Falta el campo del promedio en el candidato y la validación contra el mínimo. Ver [`por-entregar.md`](por-entregar.md).
- [ ] **Embudo de talento de Habitudes** (candidato → evaluado → visto bueno del director → aprobación de beca → expediente activo): sin decidir.
- [ ] **Prorrateo del transporte** por estudiante (¿por días de asistencia o cuota fija por cuatrimestre?) solo entre quienes usan la guagua (Rincón, Jima, Ranchito, Saba Rey y Rancho Viejo).
- [ ] **Qué cuentas agregar al catálogo contable** para no perder: depreciación, donaciones en especie, sobrante de arqueo y pérdida cambiaria. (Con `0121` y `0123` ya quedaron cubiertos proveedores `2.1.1`, retenciones de nómina `2.3.1`–`2.3.5`, retenciones a terceros `2.3.6` ITBIS / `2.3.7` ISR e inventario `1.1.2.1`–`1.1.2.2`.)
- [ ] **Chofer:** ya no tiene Torre de control; si necesita ver tareas asignadas, decidir dónde (su panel o la campana). Combustible y odómetro: sin construir.

**Técnico, sin necesidad de decisión**
- [x] **Impuestos y Cargos / Reglas legales en Parámetros legales y Conciliación de comisiones bancarias (27 nov 2026, migración `0134`):** reemplazada la interfaz de «Parámetros legales» (`SeccionParametros`) por vista en lista con selector superior derecho entre «Impuestos y Cargos» (`contabilidad.impuesto_cargo`, columnas: Impuesto/Cargo, Tipo de valor, Formato de valor, Valor, Propósito y Cuenta contable) y «Reglas legales» (`contabilidad.regla_legal`), sembrando «Impuesto por transferencia 0.20%» (`fijo`, `porcentaje`, `0.20`, `transferencia`, `5.2.3.4.1`) y «Comisiones bancarias» (`variable`, `transferencia`, `5.2.3.4.2`). En pagos de factura por `Transferencia` (`lineas_recibo`, `contabilizar_recibo`, `lineas_pago_cxp`), se agregan automáticamente los cargos fijos de transferencia al asiento y al libro bancario. En Conciliar (`Conciliador`, `conciliarCargoBancario`), añadido desplegable «Comisiones» junto a «Transacciones del banco» que permite conciliar impuestos fijos o múltiples comisiones variables directamente contra su cuenta configurada sin asiento previo en libros.
- [x] **Integración API TasaReal y botón «Actualizar tasas» (26 nov 2026, migración `0133`):** agregado selector obligatorio `codigo_institucion` (25 códigos de `instituciones.txt`) en configuración de bancos USD (`DialogoConfigurarCuentaBanco`), acción `actualizarTasasDesdeApi` contra `GET https://tasareal.com/api/v1/rates?currency=USD` (`Authorization: Bearer $TASAREAL_API_KEY`) que actualiza BCRD (`bcrd`) y cuentas USD según su código, tabla `contabilidad.tasareal_actualizacion` y botón «Actualizar tasas» junto a «Transferir entre cuentas» con restricción diaria activa (`MODO_PRUEBAS_TASAREAL = false`: habilitado a partir de las 8:00 AM hora RD, una sola ejecución por día). Probado en vivo (`HTTP 200 OK`, 25 instituciones).
- [x] **Tarifa bancaria USD en transferencias DOP→USD y retiro de modo Guiado (26 nov 2026, migración `0132`):** campo obligatorio `Tarifa` (DOP) al configurar cuentas en USD (`contabilidad.cuenta_bancaria.tarifa` y solicitudes); código de transacción `BAN_TRANSFER_TARIFA` enlazado a `5.2.3.4.2 · Comisiones por Servicios`; en `DialogoTransferencia`, retirado `FormularioGuiado` y colocado el botón «Asiento» en su lugar; debajo del campo de diferencia cambiaria se añade el check «Tarifa» (marcado por defecto) que cambia el título a «Tarifa (DOP)», aplica la tarifa del banco y calcula el monto a transferir como `Monto a recibir × Tasa de compra del banco`, conservando el cálculo de diferencia cambiaria con BCRD cuando se desmarca.
- [x] **Tasas en cuentas USD, tabla de Bancos, tuerca BCRD y transferencia DOP→USD con diferencia cambiaria (26 nov 2026, migración `0131`):** `tasa_compra` y `tasa_venta` obligatorias para cuentas en USD en `DialogoConfigurarCuentaBanco` (con asterisco rojo `#B4342B` en todos los campos); listado de `/contabilidad/bancos` convertido a tabla con las 8 columnas (Banco, Auxiliar contable, No. de Cuenta, Tipo de Moneda, Saldo conciliado en verde `#1E9E6A`, Saldo sin conciliar en rojo `#B4342B`, Última actividad en `DD/MM/YYYY` y Balance); retirada la sección «Tasa del día» y sustituida por la tuerca BCRD (`DialogoTasaBcrd`) junto al título «Bancos»; `DialogoTransferencia` reorganizado (Cuenta origen/destino, Monto a transferir/recibir) con cálculo automático en `DOP → USD` usando tasa de compra BCRD y tasa de venta del banco, registrando la diferencia cambiaria en `5.2.3.11 · Gasto por Cambio de Divisas` (`BAN_TRANSFER_PERDIDA_CAMBIARIA`).
- [x] **Tuerca de configuración de cuenta bancaria y flujo de autorización (26 nov 2026, migración `0130`):** retirado el subtítulo bajo el título de `/contabilidad/bancos/[cuenta]` y reemplazado por un botón de tuerca junto al título (`DialogoConfigurarCuentaBanco`) para editar Título, No. de cuenta, Moneda, Auxiliar contable y Saldo actual; solo el rol `contabilidad` modifica directamente y aprueba/rechaza solicitudes; los demás roles envían una solicitud en `contabilidad.solicitud_cambio_cuenta_bancaria` con notificación a Contabilidad.
- [x] **Conciliación bancaria automática, Movimientos desde CSV y dos tablas en Conciliar (26 nov 2026, migración `0129`):** columnas completas en `contabilidad.extracto_linea` (`fecha_posteo`, `no_cheque`, `retiros`, `depositos`); diálogo «Subir estado (.csv)» en dos pasos («Cargar» → vista previa → «Subir») que persiste omitiendo duplicados y concilia automáticamente coincidencias exactas de referencia + monto; pestaña «Movimientos» sin tarjetas de saldo, mostrando los movimientos del extracto con filtros funcionales; pestaña «Conciliar» con tablas «Libro diario» (izq.) y «Transacciones del banco» (der.), resaltado naranja (`pri-alta`) cuando coincide referencia pero difiere monto, corrección de contraste en modo oscuro (`bg-marca-500/15`), tooltips en títulos y confirmación explícita para anular desde «Conciliadas».
- [x] **Formatos de estado de cuenta bancario y vista previa CSV (26 nov 2026, migración `0126_formatos_estado_banco`):** nueva tabla `contabilidad.formato_estado_banco` sembrada con `Santa Cruz` (omite filas 1–8 y última fila de totales, extrae las 8 columnas reales con decodificación UTF-8/Windows-1252 y desenvuelto de filas con comillas dobles); pestaña de mantenimiento «Formatos bancarios» en Configuración contable (`?tab=formatos-banco`); el diálogo «Subir estado (.csv)» muestra el formato a subir, visualiza las columnas y datos extraídos en la misma ventana e incluye botón `×` para salir.
- [x] **Guagua 3D rehecha y líneas simuladas fuera (26 nov 2026):** modelo con volumen (techo blanco, ventanas, franja, puerta, parachoques, faros, ruedas con rayos) en `guagua-3d-html.ts` + `.guagua3d*` de `mapa.css`, comprobado con captura de Chrome sin cabeza. El mapa ya no dibuja el circuito fijo, ni la insignia del corredor ni una guagua simulada: la guagua solo aparece con el GPS real del chofer y el rastro punteado es el recorrido real. Sin viaje en curso, las paradas muestran el minuto programado de la ruta. Falta: trazar el recorrido propuesto desde la posición del chofer, quitar de la cabecera del mapa los filtros UNPHU/UASD/UTESA y la línea de estado para el estudiante.
- [x] **Guagua 3D animada (26 nov 2026):** `marcador-guagua-3d.ts` + `.guagua3d*` en `components/mapa/mapa.css`: prisma real con CSS 3D (techo, frente, trasera, dos costados con ventanas, cuatro ruedas), gira con el rumbo, ruedas y balanceo animados según la velocidad, intermitentes si está averiada, y se desliza entre lecturas de GPS en vez de saltar. **No se vio en un navegador** (la herramienta del navegador falló): revisar en `/transporte` con un viaje en curso que las caras y las ruedas queden bien orientadas en los cuatro rumbos.
- [~] **Transporte tipo Pedidos Ya (26 nov 2026, migraciones `0126`–`0127`):** hecho: la guagua solo va a UCATECI y a la oficina de la Fundación (se quitaron UNPHU, UASD y UTESA; sus inscripciones pasaron a UCATECI y la ruta inversa quedó inactiva), ruta con el orden real (Controba → Rincón → Jima Abajo → La Ceivita → El Ranchito → Sabana Rey → camino por dentro → UCATECI → Fundación) y avisos a los pasajeros por la posición del chofer («ya arrancó», «llegó a tu parada», «está llegando», sin repetirse; `src/server/transporte/avisos.ts`). **Las coordenadas de las 7 paradas nuevas son aproximadas: ajustarlas con el chofer.** Falta: el mapa (`mapa-transporte-cliente.tsx`, `cinematica-timob.ts`) aún dibuja el circuito universitario fijo y los filtros UNPHU/UASD/UTESA; trazar el recorrido en vivo desde la posición del chofer; línea de estado para el estudiante («viene por Rincón»); revisar el modelo 3D; horario de la noche variable; push al teléfono; las inscripciones antiguas con abordaje en UCATECI/UTESA hay que reasignarlas a su comunidad.
- [x] **Enviar aviso desde el acceso rápido del móvil (26 nov 2026):** el cajón de acciones rápidas tiene «Enviar aviso» (`operaciones.escribir`): audiencia = todo el personal o un rol, asunto y mensaje; llega a la campana de cada persona (`enviarAviso` en `src/server/notificaciones/acciones.ts`, auditado). Pendiente: notificaciones push al teléfono (no hay service worker), aviso por correo (cola Resend) y a personas concretas.
- [ ] **Global Effect 360 como módulo único (decidido, sin construir):** una sola pantalla con pestañas Grupos · Prematrícula · Períodos; varios grupos por materia, cada uno con docente, portada, horarios, fecha de inicio, activar/desactivar, estudiantes (agregar o abrir) y prematrícula propia; el estudiante solo ve grupos con prematrícula abierta y entra al aula solo si lo eligió y pertenece al grupo. Requiere migración (grupo, horarios, portada, ventana por grupo) y rehacer clases-360, materias y prematrícula.
- [x] **Resumen administrativo, migas y un solo revisor de entregas (26 nov 2026):** `/administrativo` (cifras que enlazan + módulos por permiso), migas de pan solo en Administrativo y Global Effect 360, y `/portal/profesor/entregas` como único sitio donde el docente califica (lista de estudiantes, vista previa del PDF/imagen y del texto, «Guardar y siguiente»); se retiraron las tres interfaces duplicadas de calificación (cola, materias y clases 360). Guía de correo y acceso en [`correo-y-acceso-resend.md`](../referencia/correo-y-acceso-resend.md). Pendiente: «¿Olvidaste tu contraseña?», restringir Google al Workspace y a los roles administrativos, alta de usuarios con invitación real y `vercel.json` con el cron; `revisarEntrega` (academico) quedó sin uso; fusionar o retirar elementos repetidos del resto de pantallas administrativas y de 360.
- [x] **Formulario de proveedores, tooltips y limpieza contable (26 nov 2026):** proveedores informales (`fisica`) permiten ingresar cédula sin consulta DGII; textos informativos del formulario de proveedores y edición de cuentas movidos a `TooltipAyuda`; campos obligatorios (Nombre/razón social, RNC/cédula, Actividad económica, Dirección, Estado y Días de crédito) con asterisco rojo (`#B4342B`) y validación en cliente y servidor; limpieza transaccional de contabilidad y eliminación de proveedores de prueba conservando catálogo, códigos de transacción y bitácora.
- [x] **Interconexión de actividades y colores como excepción (26 nov 2026):** las actividades salen en el Gantt del proyecto (sección propia), su responsable recibe aviso y cuenta como participante del proyecto (acceso al detalle desde el aviso), y suman a los avances de proyecto y de actividad. Los colores de estado, prioridad y módulo quedan escritos como EXCEPCIÓN acotada, sin tocar la marca, en `CLAUDE.md`, `AGENTS.md`, `design-system.md`, `docs/09` y `docs/prompts/rediseno-app-web.md`. Pendiente: migrar al estándar los colores propios de expedientes, solicitudes y citas; definir el mapa de color por módulo si se quiere; reportes y asistente IA aún no desglosan por actividad.
- [x] **Administrativo tipo Asana (26 nov 2026, migración `0125`):** Proyectos es un Kanban por estado (arrastrar cambia el estado); nuevo nivel Proyecto → Actividad → Tarea (`actividad`, `tarea.actividad_id`) con Kanban de actividades en el detalle del proyecto; «Mis tareas» es mi Kanban (solo lo asignado, Hoy / Semana / Todas, proyecto › actividad en cada tarjeta, la persona asignada mueve lo suyo sin `operaciones.escribir`). Colores de estado y prioridad como excepción documentada (`est-*`, `pri-*`, `src/lib/estados-trabajo.ts`). Fuera los gráficos de proyectos, tareas, Mi día y Equipo (siguen en Reportes). Las actividades salen en el calendario del responsable (origen `actividad`, en su fecha de cierre). Pendiente: tabla de tareas del equipo completo para coordinación (antes `vista=tablero` con `puedeTodo`; ahora «Mis tareas» solo muestra lo propio), asignar tarea a actividad al editar, probar con sesión.
- [x] **Panel sin subtítulos ni descripciones (26 nov 2026):** `DialogDescription`, `CardDescription` y `EstadoVacio.texto` ya no pintan; se retiraron sus usos, las ayudas bajo campos, los placeholders explicativos y 237 claves huérfanas de es/en. Solo quedan títulos, etiquetas, datos y mensajes de estado o error. Perdidas a propósito: las tres cifras del docente en `clases-360` y el conteo de materiales en el diálogo «en uso» de programas. Sin revisar: `portal/contabilidad/page.tsx`; `vista-reportes` y `libros/page` conservan hex sueltos anteriores.
- [x] **Balanza de Comprobación de saldos y columna Balance de Auxiliares (26 nov 2026):** `balanza` y `totalesBalanza` (`src/server/contabilidad/libros/consultas.ts`, `src/components/contabilidad/libros/balanza.tsx`, `src/app/[locale]/(portal)/contabilidad/libros/page.tsx`, `src/server/contabilidad/excel/libros.ts`) calculan saldos netos por naturaleza (deudora `D - C`, acreedora `C - D`), agregan por árbol sin duplicar, liquidan cuentas cerradas en `0.00`, colocan valores siempre positivos en Débito/Crédito (sobregiros deudores en Crédito) y añaden la columna «Balance de Auxiliares» en pantalla y Excel.
- [x] **Tipo de gasto en facturas y "Agregar a Facturas" en catálogo (26 nov 2026, migración `0124`):** eliminada «Categoría contable» del registro/ficha de proveedores; añadida opción «Agregar a Facturas» (Sí/No) en las cuentas contables que reciben movimiento (`contabilidad.cuenta_contable.agregar_a_facturas`), vinculando el selector «Tipo de gasto» de `FormularioFactura` (`cuenta_gasto_id`) directamente a la cuenta contable mostrando solo el nombre del gasto; sustituidos los combobox de retenciones ISR/ITBIS por listas `<select>` simples; `categoria_id` opcional en `factura_proveedor`, `cuenta_por_pagar` y `recibo`.
- [x] **Cuentas por pagar: retenciones DGII y consulta RNC (26 nov 2026, migración `0123`):** agregadas las cuentas `2.3.6` (ITBIS Retenido a Terceros por Pagar) y `2.3.7` (ISR Retenido a Terceros por Pagar) y enlazadas a `PROV_*_RETENIDO_X_PAGAR` y `CALC_FACTURA_*_RETENIDO`. Formulario de proveedores con tipo Informal/Profesional independiente vs Formal/Jurídico, consulta en línea a DGII (`rnc.megaplus.com.do`, solo sin guiones) para autocompletar razón social, nombre comercial, actividad económica y administración local. Formulario de facturas sin ITBIS (ASFL) y con listas de retenciones ISR e ITBIS (`Retenciones-ISR-ITBIS.pdf`) con cálculo automático en cliente y servidor.
- [x] **Catálogo contable actualizado a 103 cuentas (25 nov 2026, migración `0121`):** reemplaza el catálogo de 88 cuentas (`0107`) con `Catalogo Contable.xlsx` (`1.1` Activos Corrientes, `1.2` Activos Fijos, dos cuentas de Banco Santa Cruz `1.1.1.2`/`1.1.1.3` listas para completar su número de cuenta, Inventario `1.1.2.x`, Proveedores `2.1.1` con movimiento, UAPA/UTESA `2.1.2.4`–`2.1.2.5`, retenciones de nómina desglosadas `2.3.1`–`2.3.5` y gastos `5.1`/`5.2`). Remapeadas categorías, bancos, presupuesto, artículos, activos y códigos de transacción; actualizados `reportes/consultas.ts` y selector de bancos en `contabilidad/nomina/page.tsx`.
- [x] **Código de transacciones (25 nov 2026, migraciones `0115`–`0120` aplicadas):** nueva pestaña en Configuración contable, asignación de códigos desde el Catálogo y motor `construirLineasPorCodigo`. Todos los módulos con asientos usan códigos de transacción y opción «Asiento». Ver [`codigos-de-transaccion.md`](../referencia/codigos-de-transaccion.md).
- [x] **ISR por pagar:** resuelto en la `0121` con `NOM_ISR_X_PAGAR` → `2.3.1` (`Impuesto Sobre la Renta Empleados por Pagar (ISR)`).
- [x] **Visibilidad fusionada con permisos (25 nov 2026, migración `0114` sin aplicar):** se eliminó `/configuracion/visibilidad` (queda una redirección a `/configuracion/permisos`), `src/server/visibilidad`, `src/components/visibilidad`, el parámetro `ocultos` de `menuDe`, `FUNCION_ASISTENTE` y el bloqueo por ruta del layout. Cada entrada de `nav.ts` declara `permiso`, `algunPermiso` o `universal: true`; el botón del asistente depende de `ia.usar`. En `/configuracion/permisos` cada interruptor dice qué módulos habilita y la vista previa «Verá estos módulos» (por rol y por persona) sale de `menuDe`. Verificación: `npx tsx scripts/probar-menu-por-permisos.ts`. **Falta aplicar `0114`** (ensayada con ROLLBACK; la tabla tenía 1 fila sin efecto).
- [ ] **Probar con sesión de cada rol** (nada de esto se vio con usuarios reales): calendario (arrastrar y crear), Gantt (tema, tooltip, móvil, acento negro), bandeja de entregas del docente, semáforo de beca, «Pendientes», tablero ejecutivo, rendición con solicitud, costos por estudiante, menús por rol.
- [ ] Semáforo de beca: usar el mínimo de **cada universidad** (`umbralesDeUniversidad`) y horas de servicio si algún día se registran.
- [x] ~~`admin` ve en su menú Habitudes y Clases 360 pero la base le quitó esos permisos~~: el menú ya sigue a los permisos (`habitudes.recursos.leer`, `academico.escribir`), así que si la base se los quita, desaparecen del menú. Sigue abierto sincronizar `rbac.ts` con `rol_permiso` para `admin` y `docente` (reparto de fábrica).
- [ ] **Guards por rol que no son permiso** (el menú los marca `universal`): `/sitemap`, `/configuracion`, `/ejecutivo` y todo `/portal/estudiante/*` usan `requerirRol`; `/configuracion/permisos` exige `requerirRol(["super_admin"])` aunque su entrada pida `usuarios.administrar`. `/calendario/gantt` y `/chat-ia` solo piden sesión (el menú es más estricto que la pantalla). `/habitudes` pasó de lista de roles a `requerirPermiso("habitudes.recursos.leer")`.
- [ ] La entrada «Habitudes» ya no se esconde al docente sin liceo asignado: esa regla del layout comparaba con una clave que ningún menú usaba y nunca tuvo efecto.
- [ ] Contadores de Bandeja que se contradicen y tarjeta «Entregas esperando nota» (informe 03 §1.4 y §1.6).
- [ ] Nombres de roles únicos (`ROLE_LABELS`), rutas sin convención y redirects (informe 01 §4 y §6); UX por rol (informe 02); tokens de movimiento (informe 03 §3).
- [ ] Bandeja de aprobaciones unificada para administración, expediente por pasos y 14 módulos de contabilidad retirados que siguen vivos en el código (informe QA P1/P2).
- [ ] Segregación de funciones contables y «Ver como persona» (informe 01 §3 y §5): política, aún sin decidir.
- [ ] Estados vacíos de varios gráficos muestran el título; faltan mensajes propios.
- [ ] `flujo de caja proyectado` trae 50000 fijo de donaciones esperadas.


- [x] **Costo por estudiante becado, fases 1, 4 y 5 (25 nov 2026, migración `0112`):** plan en [`plan-costo-por-estudiante.md`](plan-costo-por-estudiante.md). `estudiante_id` + `pilar_costo` opcionales en factura de proveedor y línea de orden de compra (selector en `FormularioFactura` y en el diálogo de OC), tablas `estudiante_material_costo` y `estudiante_transporte_costo`, vistas `v_estudiante_costo_detalle` / `v_estudiante_costo_total` (sin doble conteo factura/OC/rendición), permiso `expedientes.costos.leer` (super_admin, contabilidad, admin), pestaña «Costos» en `/expedientes/[id]` y reporte `/contabilidad/reportes/costo-estudiantes` con Excel (`/api/costos/exportar`). El estudiante, docente, chofer y Habitudes no ven estas cifras.
  - [x] **`0111`, `0112` y `0113` aplicadas en la base** (25 nov 2026).
  - [x] **Fase 3 (registro manual, 25 nov 2026, migración `0113`):** pantalla `/contabilidad/reportes/costo-estudiantes/registro` (enlazada desde el reporte) y acciones en la pestaña «Costos» del expediente para cargar materiales entregados (concepto, cantidad, costo unitario, fecha, artículo de inventario opcional) y transporte por estudiante y cuatrimestre (días, costo, observaciones). Escribir exige `contabilidad.registrar` y `expedientes.costos.leer`. Nada se borra: se anula con motivo (columnas `anulado_*`, la vista de detalle ignora lo anulado) y cada alta o anulación deja su fila en `audit_log`. El selector marca a quien tiene inscripción de transporte y avisa si no la tiene. Código en `src/server/costos/acciones.ts` y `src/components/costos/`.
  - [ ] **Prorrateo automático del transporte sin definir:** hoy el cobro por cuatrimestre se carga a mano y solo a quien usa la guagua (Rincón, Jima, Ranchito, Saba Rey y Rancho Viejo); falta decidir la fórmula (combustible + mantenimiento + chofer entre quienes tengan `transporte_inscripcion_recurrente` activa). Tampoco hay corrección en sitio: se anula y se vuelve a registrar.
  - [ ] **Rendiciones:** el selector de estudiante en el formulario de Rendición de gastos (Fase 2) lo añade el frente de la `0111`; mientras tanto la vista ya suma las rendiciones `aprobada`/`contabilizada` con `estudiante_id`. La rendición no guarda tasa: se suma tal cual (se asume DOP).
  - [ ] **Aportes del patrocinador** = `asignacion_beca.monto` (mensual) × meses completos transcurridos, solo asignaciones activas/finalizadas: es estimación, no hay tabla de aportes recibidos.
  - [x] **Contabilidad no abre `/expedientes/[id]`** (no tiene `expedientes.leer`): ve el costo en el reporte y registra materiales y transporte en `/contabilidad/reportes/costo-estudiantes/registro`.
  - [ ] **Observado, no tocado:** tras el catálogo contable `0107`, aprobar una factura puede fallar por falta de cuenta de proveedores. `crearOrdenCompra` solo pedía sesión: ahora exige `contabilidad.registrar`.

- [x] **Tablero ejecutivo del `super_admin` (25 nov 2026):** `/ejecutivo` (`src/server/ejecutivo/consultas.ts`, `src/components/ejecutivo/panel-donantes.tsx`), aterrizaje y primera entrada del menú solo de `super_admin`; `admin` sigue en `/bandeja`. Becados activos y reparto por universidad y carrera, índice promedio, becados en riesgo, sin patrocinador, solicitudes `pendiente_direccion`, saldo en bancos (RD$ y US$), aporte mensual de patrocinadores, cuotas de promesas (comprometido, cobrado, por vencer, vencidas) y cumplimiento de servicio y reunión del último mes cerrado.
  - [ ] **PENDIENTE DEL USUARIO — fórmula del índice académico:** el usuario va a explicar cómo se calcula el índice en cada universidad y en el liceo. Hasta entonces la cifra «Índice académico promedio» del tablero promedia `indice_estudiante()` (reglas de cada universidad, escalas distintas) y es solo orientativa; hoy solo 1 de 6 becados activos tiene índice nativo. No se inventó ni cambió ninguna fórmula. Al definirla, revisar `consultas.ts` del tablero (comentario `PENDIENTE`).
  - Saldos en bancos y cuotas de donantes salen en 0 / vacío por el reinicio contable y porque no hay promesas registradas.

- [x] **Portales (Chofer, Docente, Estudiante) y Portada (24 nov 2026):**
  - **Portal del Chofer (`src/components/transporte/pasajeros-chofer.tsx`, `messages/{es,en}.json`):** lista de pasajeros con filtros, marcación de abordaje/ausencia y acciones de ruta.
  - **Panel Docente (`src/app/[locale]/(portal)/portal/profesor/page.tsx`, `src/lib/nav.ts`):** botones directos «Asignar tarea (360)» y «Materias asignadas» (`/portal/profesor/materias`) en cabecera y `MENU_DOCENTE`; `src/app/[locale]/(portal)/layout.tsx` oculta `habitudes` del menú si el docente no tiene asignación activa en `habitudes_liceo_profesor`.
  - **Portal Estudiante (`src/app/[locale]/(portal)/layout.tsx`, `topbar.tsx`, `aula-virtual/page.tsx`):** aviso de prematrícula visible para `usuario.rol === "estudiante"` (incluyendo «Ver como») enlazando a `/portal/estudiante/global-360` y visible desde `sm:` en barra superior; Aula Virtual reorganizada en 2 columnas con «Tareas y Exámenes» primero arriba/izquierda y tarjetas + gráfico de entregas en barra lateral derecha (`aside`).
  - **Estabilidad SSR React 19 / Next.js 16:** reemplazado `<Button asChild>` sobre `<Link>`/`<a>` por `variantesBoton` en `portal/profesor/page.tsx`, componentes de estudiante/reuniones y la portada pública (`hero.tsx`, `navbar.tsx`, `seccion-patrocinadores.tsx`, `seccion-mapa.tsx`, `seccion-cierre.tsx`, `seccion-eventos.tsx`), eliminando `Slot failed to slot onto its children`.
- [x] **Auditoría Integral de QA, Usabilidad y Coherencia Operativa (24-25 nov 2026):** documentos [`docs/estado/informe-qa-portal.md`](informe-qa-portal.md) y [`docs/estado/auditoria-coherencia-roles-modulos.md`](auditoria-coherencia-roles-modulos.md). Diagnóstico de sentido, lógica y cruce entre los 8 roles y los módulos.
      - [x] **P0 aplicado (24-25 nov 2026):** formulario de compra fuera del portal del estudiante (y `crearCompra` lo rechaza en el servidor), icono `GraduationCap` en su menú, «Materias» del docente apunta a `/portal/profesor/materias`, bandeja de entregas de profesor en una sola cola, semáforo de beca en el inicio del estudiante y acceso directo a Comida.
      - [ ] **P0 y P1 identificados en la revisión de coherencia de roles:**
        - **Chofer sin combustible:** conceder `rendicion.enviar` en RBAC y reemplazar «Torre de Control» por «Rendición de Gastos / Combustible» en su menú.
        - **Estudiante y reuniones:** restringir `reuniones.agendar` para estudiantes a solicitud de cita o tutoría, en vez de convocatoria libre a directivos.
        - **Director de Habitudes:** darle su propio menú directivo (`MENU_DIR_HABITUDES`) en vez de clonar el de facilitador.
        - **Seguridad en expedientes:** retirar `expedientes.eliminar` a `admin` (exclusivo de `super_admin`).
        - **Habitudes y Academia:** alinear permisos `academico.leer` para que los facilitadores puedan abrir la Academia de Liderazgo (`/academias/*`).

- [x] **Catálogo de universidades y pénsum — fase 2 del expediente (19 nov 2026, migración `0095`):** universidad → carrera → pénsum → materias (`/academico/universidades`), selector en cascada y matrícula en la pestaña Universidad del expediente, avance de créditos en la pestaña Pénsum. Detalle en `bitacora-tesis.md`.
      - [x] **Pénsum de UCATECI · Ingeniería en Sistemas de Computación (plan ISC-R2-2019, 110 materias, 237 créditos)** cargado desde `db/datos/pensum-ucateci-isc-r2-2019.txt` con `scripts/cargar-pensum.mjs` (base del usuario: `PensumPdf.pdf`). Las opciones de electiva (ISC123-130) no se cargaron: ocupan los cupos ELE013-016, así que una electiva aprobada no suma al avance hasta definir cómo se empareja.
      - [x] **Pénsums de `docs/PENSUMS` cargados (20 nov 2026): 13 de UCATECI y 25 de UNPHU**, cada uno con su carrera en su universidad (`db/datos/pensum-<universidad>-<carrera>-<versión>.txt`, cargados con `scripts/cargar-pensum.mjs`). Salieron de los PDF con un lector propio y solo se cargó lo que cuadra: créditos de cada período = total impreso, créditos del plan = total del plan donde lo trae, todo período con nombre y créditos. UCATECI además coincide campo por campo con la transcripción manual de Sistemas. Notas que quedan en el encabezado de cada `.txt`:
        - Las listas de electivas (opciones) y los correquisitos no se cargaron (la tabla no tiene dónde).
        - Los prerrequisitos que el PDF cita y no existen como materia del pénsum (p. ej. laboratorios `-L` en Odontología) se omitieron. Requisitos que no son materia («todas las asignaturas», «1ro al 7mo período») no caben y están anotados.
        - Dos erratas del PDF corregidas: `AR5-405` → `ARQ-405` (Arquitectura UNPHU) y `FI-221` → `EFI-221` (Educación Física UNPHU).
        - **Nombres cortados por el PDF** (la celda recorta el texto): en Educación orientación Matemática y Física y en Física orientada a la Educación Secundaria se completaron con el mismo código de otro pénsum de UNPHU; los que no tuvieron equivalente quedan cortados. Hay prerrequisitos cortados igual (`ARQ-609`, `FAR-390`, `FAR-390-L`): revisar contra el original.
        - El tope de créditos por materia en `leerListaDePensum` subió de 20 a 40 (Medicina UNPHU tiene bloques clínicos de 28).
      - [x] **Subir calificaciones guiado y con IA (20 nov 2026, migración `0102`):** `/academico/universidades/calificaciones` (botón «Subir calificaciones» en el catálogo). Asistente universidad → período → medio (PDF/foto con lectura por IA, o lista pegada); el programa empareja cada fila con su estudiante SOLO dentro de esa universidad (matrícula sin guiones; si no, nombre con las mismas palabras y un único candidato; matrícula de otra persona o nombre repetido queda «sin emparejar» para elegir a mano), la valida contra el pénsum y las letras de la universidad y deja un borrador para revisar. Al confirmar se escribe por estudiante (todo o nada, `fuente='carga'`) y se muestran las alertas por índice del período y acumulado. El archivo no se conserva. Lógica en `src/lib/carga-calificaciones.ts` y `src/server/universidades/carga-*.ts`; pruebas `scripts/probar-carga-calificaciones.mjs` y `probar-carga-calificaciones-bd.ts` (esta crea un estudiante temporal y lo borra).
        - **Parámetros por universidad** (en su ficha): índice máximo (UCATECI 4,00), mínimo del período y mínimo acumulado; vacío = se usa `becas.indice_minimo`. El expediente avisa ahora también cuando el índice del último período queda bajo el mínimo (`indice_periodo_bajo`).
        - **Elly AI** (administrativos): `preparar_carga_calificaciones` (borrador desde una lista pegada) y `confirmar_carga_calificaciones` (con aprobación).
        - [x] **Adjuntos en el chat de Elly (migración `0103`, 20 nov 2026):** el equipo (no los estudiantes) adjunta un PDF o foto con el clip del widget; el servidor comprueba la firma real y lo guarda UNA hora en `ia_adjunto` (se borra al usarlo para una carga). El modelo ve el documento en ese turno, dice qué es (listado de notas, cédula, factura u otro), enumera lo que ve y marca lo dudoso (reglas en `REGLAS_ADJUNTOS`, `server/ia/contexto.ts`). Herramientas: `preparar_carga_calificaciones` (ahora con `adjunto_id`) y `leer_documento_adjunto` (cédula/comprobante por los OCR validados). Probado con el motor y el modelo reales (`scripts/probar-adjuntos-elly.ts`): Elly identificó el PDF y preparó el borrador sola.
        - [x] **El OCR estaba roto y se arregló:** con `IA_PROVEEDOR=groq,openai` y OpenAI SIN CRÉDITOS (429 `insufficient_quota`), y Groq sin leer PDF, ninguna lectura de documentos funcionaba aunque hay clave de Gemini. Ahora, al leer PDF o foto, se añaden al final de la cadena los demás proveedores con clave que sí lo leen (`candidatos` en `src/lib/modelo-ia.ts`). Verificado de verdad: listado de notas (PDF y PNG), cédula (PNG) y factura (PDF) se leen bien. **Recargar saldo de OpenAI o quitarlo de `IA_PROVEEDOR`** evita el rodeo y el aviso en el log.
        - [ ] **Falta:** probar la lectura con listados REALES de cada universidad (las pruebas usaron documentos de muestra hechos a mano; sin muestra real, las instrucciones al modelo son genéricas); el aviso de Elly al usar el OCR en las pantallas que ya lo tenían (alta de expediente, rendición de gastos) sigue siendo el de siempre: la ayuda de Elly para interpretar el documento vive en el chat; gradua/listados de UNPHU, UTESA y UASD; `resultado_materia.ronda` sigue limitada a 1-3; no se probó el widget ni las pantallas en navegador.
      - [x] **PDF oficiales de los pénsums en la base** (no en el repo, `docs/PENSUMS/` está en `.gitignore`): 37 subidos al bucket privado y a `archivo_academico` (tipo `pensum_pdf`) con `scripts/subir-pdf-pensums.ts`, visibles en cada carrera. **UNPHU · Ingeniería en Sistemas Computacionales (23 MB) no se subió** por pasar del tope de 10 MB: hay que comprimirlo o subir otro.
      - [x] **Poner las notas de un estudiante, sencillo (20 nov 2026):** en su expediente se elige el período y salen SOLO las materias que le faltan, con una nota por materia (menú con letra y puntos, número opcional); sin escribir códigos. Las mismas reglas por debajo (`calificaciones-nucleo.ts`: plan del estudiante y letras de su universidad, todo o nada) y ahora aceptan códigos de cualquier universidad (UNPHU: `BIO-101`), antes solo los de UCATECI. **Elly** trabaja sobre la pantalla abierta (el widget manda la ruta y ella toma el estudiante del expediente) con `buscar_estudiantes`, `materias_pendientes_estudiante` y `registrar_calificaciones_estudiante` (con aprobación; al aprobar la pantalla se refresca). Para un grupo: `preparar_carga_calificaciones` con filas, lista o adjunto. Textos revisados para personas no técnicas («No encontramos al estudiante», «Guardar las notas»). Prueba: `scripts/probar-notas-elly-bd.ts`.
      - [x] **Expedientes + universidades + estudiantes: primera tanda de facilidad (22 nov 2026):** el estudiante ve «Mi plan de estudios» en su inicio (créditos que lleva, materias aprobadas, en curso y por cursar, lo que sigue y avisos amables de materias por repetir); la lista de expedientes tiene «Atención rápida» (en riesgo, sin universidad/carrera/matrícula, sin cuenta) a un toque; la ficha de universidad pliega las reglas del índice y las explica con ejemplos.
      - [x] **Segunda tanda (22 nov 2026):** logo a color en el acceso rápido del celular (el manifiesto apuntaba a iconos que no existían y el `icon.png` era blanco sobre transparente); estado «retirado» (migración `0104`); cambio de situación guiado con motivo y fecha (avisa que se suelta la cuenta); solo los activos son parte de la Fundación, así que pasar a activo exige universidad, carrera, plan de estudios y matrícula (alta, edición y cambio de situación); aviso a cada administrativo en su campana cuando un estudiante queda bajo los mínimos de su universidad (sin repetir en 7 días); «Crear cuenta e invitar por correo» en el expediente con página `/establecer-clave` para elegir la contraseña. La pre-matrícula del estudiante es solo de clases de la Fundación (no aplica prerrequisitos de la universidad). **Lo que hay que conseguir o decidir está en `docs/estado/por-entregar.md`.**
      - [x] **Tercera tanda (22 nov 2026):** (a) **imprimir o guardar en PDF cualquier pantalla**: botón en la barra superior, el menú y los botones no salen en el papel y cada hoja lleva logo y fecha (`globals.css` `@media print`, `CabeceraImpresa` en el layout del portal); (b) hojas del expediente en `/expedientes/[id]/imprimir` (ficha completa, récord de notas por cuatrimestre, avance en el plan de estudios); (c) **Excel/CSV** de la lista de expedientes con sus filtros, de estudiantes en riesgo y de todas las calificaciones de una universidad (`/api/exportar/{expedientes,riesgo,notas}`, con bitácora `exportacion.descargada`); (d) vista **«Estudiantes en riesgo»** (`/expedientes/riesgo`, `src/server/academico/riesgo.ts`) con motivo en palabras y botones de WhatsApp y correo, probada contra la base; (e) ficha del expediente con **5 pestañas** (Información, Familia/vivienda/salud, Académica, Seguimiento y patrocinio, Editar; los enlaces viejos `?seccion=` siguen funcionando); (f) **alta en dos tiempos**: «Registro rápido» (identidad y universidad) o «Completo», y tarjeta «Ficha completa al X %» con lo que falta (`src/lib/ficha-completa.ts`).
      - [x] **Corrección a la auditoría (22 nov 2026):** NO hay correos semanales de alertas. El único correo recurrente es la carta MENSUAL del estudiante que tiene patrocinador: llega al sistema, Elly la clasifica, traduce y revisa, y el sistema la reenvía al patrocinador que le corresponde (ya construido, `src/server/correos/*`). Un estudiante sin patrocinador no envía nada. Las alertas académicas siguen yendo solo a la campana de administración.
      - [ ] **Falta de esta tanda:** no se ha visto en navegador (impresión, vista de riesgo, pestañas, alta rápida); la constancia con firma y sello espera el formato oficial (ver `por-entregar.md`); en el celular el botón de imprimir de la barra superior no sale (se usa el menú del navegador); imprimir una lista larga imprime solo la página abierta (el Excel trae todo).
      - [ ] **Lo que falta del conjunto expedientes/universidades/estudiantes** (auditoría 22 nov 2026), lo que sigue pendiente: (8) prerrequisitos y tope de créditos contra el plan de la universidad (la pre-matrícula sigue siendo solo de Fundación); (9) requisitos de graduación y calendario académico por universidad (necesita los reglamentos); (10) convalidaciones (materias de otra universidad o carrera que cuentan; falta decidir cómo se registran).
      - [x] **Exportar e imprimir, rehecho (22 nov 2026):** se quitó «imprimir la pantalla» (botón de la barra superior, encabezado y reglas de impresión) y se construyeron DOCUMENTOS reales: PDF, Word, Excel y CSV generados en el servidor (`src/server/exportar/`: pdf-lib, docx, exceljs), con logo, fecha y paginación; menú **Exportar** en cada pantalla; 11 documentos listados en `docs/estado/exportaciones.md` junto con los que faltan por hacer. Probados contra la base real (los 4 formatos de cada uno). Sin ver en navegador.
      - [x] **Materiales de Habitudes con portada y vistazo (migración `0106`):** al subir un material se saca su portada (imagen, primera página del PDF, miniatura del PowerPoint/Word) y un vistazo del contenido (páginas o diapositivas, títulos, primeras líneas); la tarjeta muestra la portada y el botón «Vistazo» abre el detalle. Los 5 materiales de demostración no tienen archivo real: se dibuja una portada con su categoría y descripción.
      - [x] **Menú lateral dividido por programa (22 nov 2026):** Académico (universidad: catálogo y subir calificaciones), Global Effect 360 (clases, asignación de materias, prematrícula, períodos) y Habitudes (hub y Academia de liderazgo), para administración y docentes.
      - [x] **Revisión de lógica del conjunto (22 nov 2026):** (1) una sola regla de riesgo (`estudiantesEnRiesgo`, mínimos de CADA universidad) para la vista, el aviso a administración, el filtro «en riesgo» de la lista y Elly (herramienta `estudiantes_en_riesgo`); (2) subir o releer un gradua también avisa de riesgo; (3) al salir de «activo» la cuenta del portal se DESACTIVA (antes solo se soltaba el vínculo y la persona seguía entrando) y al volver a activo recupera su misma cuenta por correo; (4) si sale del programa con beca vigente, administración recibe un aviso para revisarla. Probado contra la base (cuenta, riesgo, carga y notas).
      - [x] **Botones y cargas (22 nov 2026):** flechas `→`/`←` cambiadas por `>`/`<` (ChevronRight/Left) en todo el código; `Button` ahora es de cliente y se carga solo (formulario enviándose con `useFormStatus`, `onClick` que devuelve promesa, o `cargando` forzado), con un único spinner en lugar de los iconos; 124 botones pasaron de `disabled={pendiente}` a `cargando={…}` (los estilos pasaron a `button-variantes.ts` para los componentes de servidor); efecto **shimmer** nuevo sin degradado (franja plana difuminada, `animate-shimmer`) y `loading.tsx` en las 93 páginas que no tenían, con 4 formas (`CargaPagina`: lista, detalle, formulario, panel) más una red de seguridad en `(portal)/loading.tsx`. Pendiente: los ~100 `<button>` crudos (chips, menús) no tienen carga automática; no visto en navegador.
      - [x] **Historial de cambio de universidad, carrera o plan (migración `0105`):** al editar un expediente que ya tenía catálogo y cambiarlo, queda una fila con cómo estaba y cómo quedó (nombres, no ids) y quién lo hizo; se ve en la pestaña Académica. Probado contra la base; el guardado desde la pantalla no se ha probado en navegador.
      - [x] **Cerrados (22 nov 2026):** `/academico/historial` ya no existe: la dirección redirige a `/expedientes` y se quitó del menú (repetía el récord de cada expediente; sus consultas en `src/server/academico/consultas.ts` quedan sin uso y se pueden borrar). «Pénsum» pasó a «plan de estudios» en todos los textos visibles en español (se conserva solo entre comillas la frase oficial del gradua de UCATECI); el inglés ya decía «curriculum».
      - [ ] **Principio del proyecto:** lo usarán personas no técnicas; toda pantalla nueva debe ser guiada, con palabras de todos los días y un solo camino claro. Falta repasar con ese criterio las pantallas anteriores a esta tanda.
      - [ ] **Sin cargar de `docs/PENSUMS`:** UNPHU · Doctor en Medicina Veterinaria (folleto de dos columnas con celdas desalineadas y prerrequisitos escritos con «/» y «,» sin aclarar si son «y» u «o») y UNPHU · Ingeniería Agronómica (el PDF repite la etiqueta «Semestre 10» en dos tablas y los períodos no cuadran con los totales). Hace falta una persona que los transcriba o confirme la notación.
      - [ ] **Faltan:** pénsum de UTESA, UASD (y PUCMM), requisitos de graduación y fórmula del promedio/índice. Se cargan con la lista pegada o con `cargar-pensum.mjs`; el OCR de PDF es la fase 4.
      - [ ] **Versión de los pénsums de UNPHU:** los PDF sin sufijo (Industrial, Gestión Aeronáutica, Psicología Organizacional y las dos de Educación/Física) se cargaron como versión `2024`, el resto como `2024-1` (viene en el nombre del archivo). Confirmar con la universidad.
      - [ ] **Confirmar las reglas de UCATECI** (y definir las de las demás): ver arriba; la fase 3 las aplicará con `calcularIndice`.
      - [x] **Permisos propios (migración `0096`):** `catalogo.leer` y `catalogo.escribir` (admin y super_admin), en lugar de `academico.*`, que de fábrica también tienen docentes y estudiantes. La entrada «Universidades» del menú cuelga de `catalogo.leer`, así que aparece en `/configuracion/visibilidad` (se oculta o bloquea por rol, y el bloqueo alcanza a las rutas hijas) y en `/configuracion/permisos` (excepciones por persona).
      - [x] **Reglas de calificación por universidad** (`universidad.puntos_por_letra`, `letra_minima_aprobar`, `retirada_cuenta_en_divisor`, `redondeo_indice`, `reglas_confirmadas`) y `src/lib/indice-academico.ts` con 6 pruebas. La `R` es retirada. Para UCATECI el índice del reporte de validación (3,56) solo se reproduce contando los 3 créditos de la retirada en el divisor y truncando a 2 decimales (746/209 = 3,569): es una **deducción**, por eso `reglas_confirmadas` queda en falso hasta que el usuario las confirme con el reglamento.
      - [x] **Documentos de prueba de la base de conocimiento** (17, uno o más por agente, más casos de borde: vencido, inactivo, sin verificar, compartido): `db/datos/conocimiento-prueba.mjs`, `scripts/sembrar-conocimiento-prueba.mjs` y guía de preguntas en `docs/estado/pruebas-conocimiento.md`. Se borran con `--borrar`.
      - [x] **Logos de universidades (migración `0097`):** se suben al crear o editar una universidad (PNG, JPG o WebP, hasta 1 MB, validados por su firma real; SVG excluido) al bucket público `avatares`, carpeta `universidades/`. Sin logo se muestran las siglas. Aparecen en la lista, la universidad, la carrera y, vinculado a cada estudiante, en la portada y la pestaña Universidad de su expediente. **Logos cargados** de UCATECI, UNPHU, UTESA, UASD y PUCMM (esta última se creó porque ya figura en dos expedientes) con `scripts/cargar-logos-universidades.ts`; origen y licencias en `db/datos/logos/ORIGEN.md` (UNPHU y UASD vienen de Wikimedia Commons, CC BY-SA 4.0, porque sus sitios bloquean la descarga automática). Conviene reemplazarlos por los oficiales si se publican fuera del portal.
      - [x] **Carga del pénsum desde archivo** `.csv`/`.txt` (p. ej. Excel con «;») además de pegar la lista.
      - [x] **Corrección:** `/configuracion/conocimiento` no cargaba al haber documentos: la consulta devolvía `agentes` vacío (`array_agg(agentes)[1]` es NULL en Postgres) y la página recorría `null`. Corregido con subconsulta.
      - [x] **Universidad, carrera y pénsum del expediente como desplegables (alta y edición):** reemplazan los campos de texto libre «Universidad» y «Programa». El servidor valida la cadena (carrera de esa universidad, pénsum de esa carrera, universidad activa) y sigue escribiendo el texto espejo `universidad`/`programa` para listados y topes de créditos. Sin catálogo elegido se conserva el texto antiguo, que la pestaña Universidad marca como «sin vincular al catálogo». Flujo completo: universidad (catálogo) → expediente → cuenta (perfil) → pénsum.
      - [x] **PUCMM retirada del catálogo** (no forma parte del programa; la había creado yo por error). **Pendiente de decidir por el usuario:** Mariela Vargas y Yaritza Polanco conservan el texto «PUCMM» en su expediente y salen como sin vincular.
      - [x] **Archivos académicos (migración `0098`, bucket privado):** el «gradua» (validación de asignaturas) y el récord de notas se suben al expediente (pestaña Pénsum), y el PDF oficial de cada pénsum en su carrera. Solo PDF ≤ 10 MB (firma real), descarga con enlace firmado y bitácora por `/api/archivos-academicos/[id]`; se borran con el expediente. **Leerlos con OCR + pantalla de revisión (fase 4) sigue pendiente.**
      - [x] **Revisión del expediente completo (probada en navegador real con Playwright):**
        - **Guardado que vaciaba campos:** React 19 reinicia el formulario tras una acción y dejaba el pénsum en blanco; el envío de la edición ahora usa `onSubmit` + transición (no pierde lo escrito ni si falla).
        - **Datos que no llegaban al formulario:** las columnas de catálogo y la matrícula estaban en la consulta equivocada (la lista) y la edición los mostraba vacíos.
        - **Texto faltante `records.portada`** en el navegador: la página no entregaba los mensajes `records`/`catalog` a sus componentes cliente; ahora un solo proveedor para toda la ficha.
        - **Campos repetidos:** universidad/carrera/«dónde estudia» estaban en la portada, Información, dos veces en Universidad, Pénsum y Editar; ingreso/grupo/tiempo en Información y Graduación. Ahora Información = persona e ingreso; Universidad = catálogo (+ recinto); Pénsum = avance y archivos; Graduación = estado y fecha. «Dónde estudia» pasó a llamarse «Recinto o sede».
        - **Siglas con logo** en tarjetas, lista y portada; filtro y búsqueda por siglas del catálogo.
        - **Acciones rápidas** bajo la portada: editar, subir el gradua, pénsum de su carrera, patrocinador, cartas y servicios del mes (cada una solo si hay a dónde llevar y se tiene permiso).
      - [x] **Gradua leído y pénsum nativo (migraciones `0099`–`0101`, probado en navegador real):** subir el gradua (UCATECI) lo lee, lo valida (universidad, matrícula, versión, nombre) y reconstruye al estudiante en el formato nativo `resultado_materia`; el pénsum deja de decir «pendiente» donde corresponde (206 de 237 créditos, índice 3,56 igual al reporte, electiva en su cupo, retirada marcada). Récord por cuatrimestre con filtros y «solo con problemas»; registro de calificaciones por cuatrimestre (todo o nada, validado contra el pénsum y las letras de la universidad); alertas derivadas (índice bajo el mínimo, reprobadas, retiradas sin volver a cursar); quitar un resultado cargado a mano. UCATECI pasó a «reglas verificadas».
      - [x] **Un solo índice y un solo umbral:** lista, tarjetas, filtro «en riesgo», récord, portal del estudiante y Elly usan el índice nativo con respaldo al historial, y el umbral es `becas.indice_minimo` (antes 2,00 fijo en código y 3,00 en el reglamento). Hallazgos de la auditoría: la base impide ahora carrera de otra universidad o pénsum de otra carrera (trigger), seis textos de universidad normalizados, Elly conoce carrera/avance y las pantallas nuevas.
      - [ ] **Falta para «solo se suben las calificaciones»:** el listado de notas del cuatrimestre (PDF o Excel) para leerlo automáticamente: hace falta una muestra. Mientras tanto se pegan en el formulario del expediente.
      - [ ] **Falta:** gradua de UNPHU, UTESA y UASD (cada una imprime el suyo; hoy dicen «todavía no sabemos leer el gradua de X»), pénsum desde PDF con vista previa, y el tope de créditos por universidad aún vive en parámetros fijos y no en la universidad.
      - [ ] **Voz de Elly:** las cuatro voces de Piper en español están descargadas y con licencia revisada (Claude Apache-2.0, davefx CC0, sharvard CC BY 3.0, daniela CC BY-SA 4.0), pero Piper no sintetiza en este Mac (ruta de datos del fonemizador mal empaquetada en la versión instalada). Sin muestras todavía.
      - [ ] Confirmar el régimen real de cada universidad (se sembró «cuatrimestre» en las cuatro).
      - [ ] Ver en pantalla `/academico/universidades` y la pestaña Universidad/Pénsum (no probado en navegador).

- [x] **Gráficos en Servicios mensuales, Prematrícula 360 y Reuniones + fixes en Patrocinadores (24 nov 2026):**
      - **Servicios mensuales (`/servicios-mensuales`):** anillo de balance de cumplimiento y barras por requisito (`graficas-servicios.tsx`, `servicios-mensuales/page.tsx`).
      - **Prematrícula 360 (`/academico/prematricula`):** anillo del catálogo 360 por estado y barras de inscritos por clase (`administracion.tsx`).
      - **Reuniones (`/reuniones`):** anillo por modalidad y barras por tipo de reunión (`hub-reuniones.tsx`).
      - **Patrocinadores (`/patrocinadores`, `/patrocinadores/becas`, `/patrocinadores/[id]`):** clave faltante `sponsors.state.pausado` en `messages/{es,en}.json` y reemplazo de `<Button asChild><Link /></Button>` por `<Link className={variantesBoton(...)}>`.

- [x] **Gráficos interactivos en Períodos y Programas de Academia + fix `Slot` en Bandeja (24 nov 2026):**
      - **Períodos (`/academico/periodos`):** anillo por estado, barras de matrículas por período (top 6) y chips de filtro por estado (`gestion-periodos.tsx`).
      - **Programas de Academia (`/academias/programas`):** anillo por tipo y barras de participantes por programa (top 6) (`gestion-programas.tsx`).
      - **Bandeja (`/bandeja`):** sustitución de `<Button asChild><Link /></Button>` por `<Link className={variantesBoton(...)}>` en `bandeja/page.tsx` para evitar el error de `Slot` en React 19 RSC.

- [x] **Gráficos interactivos y filtros en Personal, Solicitudes, Rendiciones, Patrocinadores/Becas y Clases 360 (23 nov 2026):**
      - **Personal (`/administrativo/personal`):** anillo de estado de cuentas y barras de reparto por rol (`graficas-personal.tsx`, `personal/page.tsx`).
      - **Solicitudes (`/administrativo/solicitudes`):** anillo de resumen de bandeja y barras de solicitudes por tipo (`graficas-solicitudes.tsx`, `solicitudes/page.tsx`).
      - **Rendiciones (`/administrativo/rendiciones`):** anillo por estado y barras de monto total DOP por estado (`lista-rendiciones.tsx`).
      - **Patrocinadores y Becas (`/patrocinadores`, `/patrocinadores/becas`):** anillo por tipo y barras de becados por patrocinador (`gestion-patrocinadores.tsx`); anillo de cobertura y chips de filtro por patrocinio (`gestion-becas.tsx`).
      - **Clases de 360 (`/academico/clases-360`):** barras de inscritos por clase y anillo de entregas por revisar vs calificadas (`gestion-clases-360.tsx`).
      - **i18n simétrico:** claves nuevas en `messages/{es,en}.json` (`6012` claves verificadas).

- [x] **Área Administrativa y Operaciones — Fases 1–3, gráficos interactivos y referencia técnica (19 nov 2026):**
      - **Documentación (`docs/referencia/area-administrativa.md`):** referencia completa de `/bandeja`, `/administrativo/tareas`, `/administrativo/tareas/hoy`, `/administrativo/proyectos`, `/administrativo/proyectos/[id]`, `/administrativo/proyectos/roles`, `/administrativo/torre-control` (`/equipo`) y módulos ERP (`/personal`, `/solicitudes`, `/rendiciones`, `/inventario`).
      - **Fase 1 (operación diaria):** chips de filtro y completar rápido en `/bandeja` (`tareas-bandeja-interactiva.tsx`, `tareas-bandeja.tsx`); búsqueda, filtros por proyecto/prioridad/vencidas y resaltado drag-over en `/administrativo/tareas` (`tablero-tareas.tsx`); métricas vivas y filtro por programa asignado al rol en `/administrativo/tareas/hoy` (`vista-hoy.tsx`).
      - **Fase 2 (proyectos y torre de control):** KPIs globales, búsqueda y filtros por estado en `/administrativo/proyectos` (`gestion-proyectos.tsx`); búsqueda y filtro de prioridad en `/administrativo/torre-control` (`torre-tareas.tsx`); ordenamiento por abiertas/vencidas/horas/nombre en `/administrativo/torre-control/equipo` (`torre-equipo.tsx`).
      - **Fase 3 (roles, personal e inventario):** revalidación de `/administrativo/tareas/hoy` al actualizar `proyecto_rol` (`src/server/colaborador/acciones.ts`), buscador en `matriz-proyectos-roles.tsx`, buscador + filtro por rol en `gestion-cuentas.tsx` y selector de estado en `tabla-activos.tsx`.
      - **Gráficos interactivos (`GraficaAnillo` y `GraficaBarras`):** integrados en `/administrativo/proyectos`, `/administrativo/torre-control/equipo`, `/administrativo/tareas`, `/administrativo/tareas/hoy` y `/administrativo/inventario`.
      - **Gestión Administrativa de Transporte (`/administrativo/transporte`, 22 nov 2026):** nuevo módulo enlazado en `MENU_ADMINISTRACION` bajo permiso `transporte.gestionar` (`src/lib/nav.ts`, `src/app/[locale]/(portal)/administrativo/transporte/page.tsx`, `src/components/transporte/panel-admin-transporte.tsx`, `obtenerResumenAdminTransporte`, `alternarHorarioTransporte`) con mapa en vivo TIMOB, KPIs diarios, listado de pasajeros por turno, activación/pausa de horarios oficiales y bitácora de incidencias. Documentado en `docs/referencia/area-administrativa.md`.

- [x] **Dashboard gráfico e interactivo del Portal Docente (19 nov 2026):**
      - **KPIs animados y retiro de accesos rápidos redundantes (`src/components/profesor/dashboard-inicio-docente.tsx`, `portal/profesor/page.tsx`):** `KpisAnimadosDocente` añade conteo animado, barra de progreso y enlaces directos para Clases, Estudiantes, Notas finales y Por revisar; se eliminó la rejilla `<AccesosPortal />` del inicio docente.
      - **Gráficos y calendario interactivo (`src/server/profesor/consultas.ts`, `dashboard-inicio-docente.tsx`):** gráfico de barras comparando inscritos frente a notas finales cerradas por clase (`BarChart`), gráfico de anillo de entregas por revisar vs calificadas (`PieChart`) y calendario mensual interactivo (`agendaDocente` con reuniones, vencimientos de tareas y eventos).

- [x] **Videollamadas embebidas en Reuniones, banner de llamadas activas y buzón Moodle ampliado (19 nov 2026):**
      - **Salas de videollamada integradas en la web (`src/lib/reuniones-sala.ts`, `src/components/reuniones/sala-llamada-embebida.tsx`, `hub-reuniones.tsx`, `reuniones/page.tsx`):** al agendar reuniones `virtual` o `hibrida` sin enlace manual se genera automáticamente una sala de Jitsi Meet (`https://meet.jit.si/GlobalEffectNexus-...`); nueva acción `cambiarEstadoLlamadaAction` (`src/server/reuniones/acciones.ts`) para iniciar (`en_curso`, con notificación a convocados) o finalizar (`realizada`) la llamada, y visor embebido en `/reuniones` con deep-link `?sala=<id>`, pantalla expandible y respaldo en pestaña externa para enlaces de Google Meet/Zoom.
      - **Banner «Llamadas activas ahora» (`src/server/reuniones/consultas.ts`, `src/components/reuniones/banner-llamadas-activas.tsx`, `portal/estudiante/page.tsx`, `portal/profesor/page.tsx`):** `reunionesActivasParaUsuario` muestra en el inicio de estudiantes y docentes las reuniones en curso en las que participan, con entrada en 1 clic a la sala en vivo.
      - **Buzón de entregas Moodle ampliado (`src/components/estudiante/boton-buzon-moodle.tsx`, `buzon-tarea-moodle.tsx`):** ampliación del modal a `w-[95vw] sm:max-w-4xl max-h-[92vh]` y ajuste `flex-wrap`/`break-words` para evitar cortes en títulos, badges y nombres de archivo.
      - **Documentación del Portal del Estudiante (`docs/referencia/portal-estudiante.md`):** referencia completa de arquitectura, rutas, capa servidor, componentes y reglas académicas del área estudiantil.

- [x] **Dashboard gráfico e interactivo del Portal del Estudiante y semáforo de Condición (19 nov 2026):**
      - **Etiqueta «Inicio» (`messages/{es,en}.json`):** sustitución de «Mi portal» por «Inicio» / «Home» en `nav.studentPortal` y `studentPortal.eyebrow`.
      - **Inicio interactivo y KPIs animados (`src/components/estudiante/dashboard-inicio-estudiante.tsx`, `src/server/estudiantes/portal.ts`, `portal/estudiante/page.tsx`):**
        - `KpisAnimadosEstudiante`: conteo animado progresivo, barra de progreso y enlaces directos para *Promedio*, *Índice*, *Aprobadas* y *Créditos*.
        - `DashboardGraficoEstudiante`: gráfico semanal de tareas (`recharts` `BarChart` con pendientes, entregadas y vencidas) y calendario mensual interactivo (reuniones de `reunionesEstudiante`, tareas, anuncios/foros y eventos próximos integrados, eliminando el bloque duplicado de próximos eventos del final de la página).
      - **Secciones interactivas en el inicio (`src/components/estudiante/dashboard-secciones-estudiante.tsx`):** dona de distribución de créditos en *Materias en curso*, gráfico de barras con progreso en *Mis calificaciones*, y barra de distribución + filtros por estado en *Mis solicitudes*.
      - **Semáforo verde/naranja/rojo en Condición en la Fundación (`src/lib/paleta.ts`, `src/components/estudiante/condicion-fundacion.tsx`):** incorporación de `advertencia` (`#D97706`) en `SEMAFORO` / `INSIGNIA_SEMAFORO` con indicador global (`Al día`, `En observación`, `En riesgo`) y badges por mes.
      - **Gráficos dinámicos en todos los módulos académicos del estudiante (`src/components/estudiante/graficos-modulos-estudiante.tsx`, `calificaciones/page.tsx`, `aula-virtual/page.tsx`, `global-360/page.tsx`, `prematricula/page.tsx`):** evolución histórica de promedio (`AreaChart`), resumen de entregas en Aula Virtual (`PieChart`), avance y asistencia en Global Effect 360 (`PieChart` + `BarChart`), y carga de créditos en Prematrícula (`BarChart`).
      - **Calendario mensual completo del estudiante (`src/components/estudiante/calendario-mensual-estudiante.tsx`, `portal/estudiante/calendario/page.tsx`):** sustitución de la agenda en lista por una rejilla mensual interactiva de 7 columnas (Lu–Do) con navegación libre entre meses (`?mes=YYYY-MM`), botón «Hoy», filtros por origen (clases, tareas, reuniones, eventos y trámites) y panel animado de detalle diario.

- [x] **Cierre de Portal del Estudiante/Académico, Dependencias Gantt, Modularización de Transporte y Limpieza UI — Gabriela (18 nov 2026):**
      - **Tope de créditos por pauta universitaria (`src/lib/reglas-academicas.ts`, `src/lib/parametros.ts`, `src/server/estudiantes/acciones-matricula.ts`, `elegir-materias.tsx`, `portal/estudiante/prematricula/page.tsx`):** nuevas funciones `detectarUniversidadConvenio` y `topeCreditosDeUniversidad` que aplican el tope de créditos por período según la universidad del estudiante (`UCATECI`: 24 cr., `UNPHU`: 22 cr., `UASD`: 20 cr., `UTESA`: 24 cr., general: 24 cr.), respaldadas por parámetros institucionales editables en `/configuracion/parametros` (`becas.creditos_maximos_ucateci`, `becas.creditos_maximos_unphu`, `becas.creditos_maximos_uasd`, `becas.creditos_maximos_utesa`, `becas.creditos_maximos_cuatrimestre`). Validación atómica en el `INSERT` de `inscribirseEnMateria` (estado `tope_creditos`) y visualización en barra resumen (`X / Y créditos · Pauta <Universidad>`).
      - **Nota mínima de aprobación parametrizada en Global Effect 360 (`src/lib/notas.ts`, `academico/clases-360/page.tsx`, `gestion-clases-360.tsx`, `fila-inscrito-360.tsx`, `src/server/ia/{estudiante,reglamento}.ts`):** conexión del parámetro institucional `becas.nota_minima_360` (por defecto `70`) en la sugerencia de aprobación/reprobación docente y en el contexto del asistente estudiantil.
      - **Protección en servidor del mínimo de 2 clases en retiros (`src/server/estudiantes/acciones-matricula.ts`, `src/server/global360/acciones.ts`, `elegir-materias.tsx`, `acciones-materia.tsx`):** `quitarseDeMateria` y `retirarPrematricula` bloquean en SQL con estado `minimo_clases` cualquier retiro que deje a un estudiante universitario por debajo de 2 clases activas una vez alcanzado el mínimo o iniciado el período académico.
      - **Filtros combinados por materia y estado en Aula Virtual (`portal/estudiante/aula-virtual/page.tsx`):** nuevo filtro por materia (`?materia=`) combinable en la URL con el filtro por estado (`?estado=pendiente|entregado|calificado|vencida`), actualizando KPIs, tareas evaluables y recursos/anuncios.
      - **Retiro de `standby_tecnico` del embudo activo (`db/migrations/0086_retirar_standby_tecnico.sql`, `src/lib/expedientes.ts`, `formulario-solicitud.tsx`, `src/server/{dashboard,expedientes,reuniones,solicitudes}/*`):** se retira `standby_tecnico` de `ESTADOS_ESTUDIANTE` y de las consultas del embudo activo (conservando compatibilidad visual en `ESTADO_VISUAL`), y la migración `0086` pasa cualquier registro histórico en `standby_tecnico` a `postulado`.
      - **Dependencias (`tarea_dependencia`) dibujadas en Línea de Tiempo Gantt (`src/lib/linea-tiempo.ts`, `src/server/calendario/gantt.ts`, `calendario/gantt/page.tsx`, `administrativo/proyectos/[id]/page.tsx`, `linea-tiempo.tsx`):** conectores curvos en SVG entre el fin de la tarea predecesora y el inicio de la dependiente, insignia de dependencias en la columna fija y lista interactiva «Depende de» en el panel de detalle.
      - **Modularización de la cabina del chofer (`src/components/transporte/{panel-chofer,cabecera-chofer,pasajeros-chofer,dialogo-incidencia-chofer}.tsx`):** separación de `panel-chofer.tsx` en 3 subcomponentes dedicados (cabecera de mando táctil, lista/alta asistida de pasajeros y diálogo de incidencia).
      - **Mapa en vivo de transporte estilo TIMOB con circuito universitario (`db/migrations/0087_transporte_circuito_universidades_timob.sql`, `src/components/transporte/cinematica-timob.ts`, `src/components/transporte/mapa-transporte-cliente.tsx`, `src/components/mapa/marcadores.ts`):** sustitución de las teselas CARTO (que mostraban marca de agua `API KEY REQUIRED`) por cartografía libre de OpenStreetMap; actualización de las paradas oficiales del circuito para conectar el **Edificio Fundación Global Effect** (`Av. Pedro A. Rivera #325`) con las 4 universidades del convenio (**UNPHU — Recinto La Vega**, **UASD — Centro La Vega**, **UCATECI — Campus Universitario** y **UTESA — Recinto / Conexión Universitaria**); trazado vial OSRM real de 162 vértices con doble polilínea e insignia `GE-360`; motor cinemático de telemetría en vivo cada 1 segundo con cálculo de rumbo geodésico y relojes de ETA por parada; píldoras de enfoque rápido por universidad/sede, botón «Seguir Guagua», botón «Mi Ubicación» y expansión de mapa.
      - **Isotipo/logo no cliqueable en barras de navegación (`src/components/layout/sidebar.tsx`, `src/components/layout/topbar.tsx`):** el logo en la barra lateral y el isotipo que aparece en la barra superior al colapsar el menú lateral pasaron a contenedores estáticos (`pointer-events-none select-none`) sin redirección ni acción en ningún portal.
      - **Persistencia de foto de perfil y sincronización con expediente estudiantil (`src/components/perfil/formulario-perfil.tsx`, `src/server/perfil/acciones.ts`, `src/lib/supabase/almacen.ts`, `src/server/estudiantes/portal.ts`):** normalización automática en cliente mediante `<canvas>` (`360×360` JPEG, ~30–50 KB) retenida en estado de React (`archivoFoto` + `foto_data_url`) para impedir que el reinicio automático de `<form>` en React 19 vacíe el `<input type="file">`; bust de caché (`?v=<timestamp>`) en el bucket `avatares` con respaldo en base de datos, sincronización de `estudiante.foto_url` y `router.refresh()` inmediato al guardar.
      - **Pulido integral del Portal Docente y simetría entre Clases 360 y Materias Asignadas (`db/migrations/0088_inscripcion_nota_final.sql`, `portal/profesor/page.tsx`, `academico/clases-360/page.tsx`, `src/components/profesor/gestion-materias-docente.tsx`, `src/server/profesor/{consultas,acciones}.ts`, `src/server/moodle/acciones.ts`, `src/server/estudiantes/portal.ts`):**
        - En `/portal/profesor`, los enlaces «Revisar» de la tarjeta de entregas pendientes ahora dirigen con deep-link exacto a `/portal/profesor/materias?materia=<id>&accion=publicaciones#materia-<id>` o `/academico/clases-360?clase=<id>&accion=publicaciones#clase-<id>` según el origen de la tarea; el KPI «Notas puestas» suma calificaciones finales tanto de Clases 360 como de Materias Asignadas; y cada materia asignada muestra botón «Publicaciones (N)», conteo de calificados y promedio.
        - En `/portal/profesor/materias` (`GestionMateriasDocente`), se añadió la tarjeta superior **«Por revisar»** exclusiva para entregas pendientes de materias asignadas (separándolas de las entregas de 360 en `/academico/clases-360`); el formulario de publicación de tareas incorpora enlace de recurso (`archivo_url`), rúbrica/instrucciones, formatos permitidos, límite en MB y entregas tardías; la lista de publicaciones muestra peso, puntaje máximo, enlace al recurso y auto-despliega entregas pendientes; y cada alumno inscrito (`inscritosDeMateria` / `FilaInscritoMateria`) calcula su **cumplimiento (`entregadas/tareas`)**, **nota propuesta (`calcularNotaFinal`)** con botón «Usar propuesta» y sugerencia automática de `Aprobada` / `Reprobada`.
        - En `notasDelEstudiante` (`src/server/estudiantes/portal.ts`), las materias cuya nota final cierra el docente en `inscripcion` (`estado IN ('aprobada', 'reprobada')`) se integran automáticamente con `historial_calificacion` sin duplicados para que el estudiante vea su calificación e índice al instante en `/portal/estudiante/calificaciones`.
      - **Limpieza de tokens, adopción de `Dato`/`FilaDatos` y retiro de componentes huérfanos:** sustitución de colores hexadecimales sueltos por tokens de marca en `event-manager.tsx`, `tarjeta-solicitud.tsx` y `formulario-perfil.tsx`; uso de `Dato`/`FilaDatos` en `matricula-cuatrimestral-360.tsx`, `elegir-materias.tsx`, `aula-tarjeta.tsx`, `tarjeta-solicitud.tsx` y `gestion-materias-docente.tsx`; eliminación de archivos sin uso (`en-construccion.tsx`, `evaluador-entregas-moodle.tsx`, `entregar-tarea.tsx`, `acciones-aula.ts`).
      - **Áreas reservadas para Dauris (NO tocadas en este bloque para evitar conflictos de merge):**
        - **Habitudes** (`/habitudes`, `src/server/habitudes/*`, `src/components/habitudes/*`).
        - **Contabilidad** (`/contabilidad/*`, `src/server/contabilidad/*`, `src/components/contabilidad/*`: conciliación bancaria uno a varios, validación tasa Cat. 3 DGII 15 %, semilla contable con asientos reales y recorrido en navegador de Observaciones #1).
        - **OCR e IA contable** (`src/server/ia/ocr.ts`, `/contabilidad/mi-dia`: flujo cotización → solicitud → OC, borradores 606/607/608/609 y clave `ANTHROPIC_API_KEY`).
        - **Expedientes** (`/expedientes/*`, `src/server/expedientes/*`, `src/components/expedientes/*`: unificación de `envio_correo_patrocinador`, filas dinámicas de hermanos en `familiar` y carga de fotos de demostración).

- [x] **Mínimo de 2 clases obligatorias para universitarios y gestión docente de todas las materias asignadas (17 nov 2026):**
      - **Regla cuatrimestral para universitarios (`src/lib/reglas-academicas.ts`, `src/server/estudiantes/portal.ts`, `aviso-minimo-cuatrimestral.tsx`):** `esEstudianteUniversitario` identifica a los estudiantes con institución universitaria registrada (`estudiante.universidad`) y `cumplimientoCuatrimestralEstudiante` evalúa el mínimo obligatorio de 2 clases por cuatrimestre (360 + carrera). Visible en `/portal/estudiante`, `/portal/estudiante/global-360` y `/portal/estudiante/prematricula`; para no universitarios se aclara que la obligatoriedad no aplica.
      - **Asistencia en materias asignadas (`db/migrations/0085_asistencia_materias.sql`, `src/server/profesor/asistencia.ts`, `src/server/profesor/acciones-asistencia.ts`):** nuevas tablas `sesion_materia` y `asistencia_materia` con trigger de integridad `tg_integridad_asistencia_materia` y acciones `guardarSesionMateria`, `borrarSesionMateria` y `marcarAsistenciaMateria` (validado por `profesor_usuario_id` o `academico.escribir`).
      - **Gestión de materias asignadas en el Portal Docente (`src/server/profesor/{consultas,acciones}.ts`, `src/components/profesor/gestion-materias-docente.tsx`, `portal/profesor/materias/page.tsx`, `portal/profesor/page.tsx`, `src/lib/nav.ts`):** el profesor puede ver todas las materias que administración le asigne (con enlace directo en la barra lateral `nav.assignedSubjects`), consultar inscritos con porcentaje de asistencia, avance de entregas y nota propuesta (`calcularNotaFinal` + botón «Usar propuesta»), pasar lista, asignar tareas/exámenes/materiales/anuncios (`publicarTareaMateria`, incluyendo enlace de recurso y rúbrica), eliminar publicaciones, calificar entregas (`calificarEntregaMoodleAction`) y cerrar la nota final (`calificarInscripcionMateria`). `cifrasDocente` unifica estudiantes de 360 y de materias asignadas, «Entregas por revisar» enlaza contextualmente a `clases-360` o `portal/profesor/materias`, y Clases 360 incluye botón directo «Asignar tarea» en `/portal/profesor`.
      - **Asistencia de materias visibles para el estudiante (`src/server/profesor/asistencia.ts`, `portal/estudiante/prematricula/page.tsx`):** `asistenciaMateriasDelEstudiante` muestra al estudiante su porcentaje de asistencia de `asistencia_materia` dentro de Prematrícula / Mis materias.
      - **Pruebas unitarias e i18n (`scripts/probar-academico-360.mjs`, `messages/{es,en}.json`):** 10/10 pruebas unitarias aprobadas y claves simétricas en español e inglés.

- [x] **Internacionalización de códigos de calificación Moodle y vistas contables de Activos Fijos e Inventario (16 nov 2026):**
      - **Códigos i18n en `calificarEntregaMoodleAction` (`src/server/moodle/acciones.ts`, `messages/{es,en}.json`):** sustitución de cadenas literales en español por códigos en `moodle.gradeResult.*`.
      - **Vistas de Activos Fijos e Inventario Contable (`vista-activos-fijos.tsx`, `vista-inventario.tsx`, `messages/{es,en}.json`):** localización de KPIs, cabeceras de tablas y etiquetas de estado bajo `contab.activosFijos` y `contab.inventarioContable`.
- [x] **Vivienda en mapa de transporte, trigger diferido de cotización en compra e i18n en acciones de Reuniones (16 nov 2026):**
      - **Marcador de vivienda del estudiante en el mapa (`src/server/transporte/consultas.ts`, `mapa-transporte-cliente.tsx`, `portal/estudiante/transporte/page.tsx`):** nueva consulta `viviendaEstudiante` que lee `latitud`/`longitud` de `perfil_vivienda` y dibuja el marcador «Mi vivienda» en el mapa de transporte en vivo.
      - **Trigger diferido que exige adjunto en `compra` (`db/migrations/0084_compra_con_adjunto.sql`):** `CONSTRAINT TRIGGER tg_solicitud_compra_con_adjunto` (`DEFERRABLE INITIALLY DEFERRED`) que verifica al hacer `COMMIT` que toda solicitud con `tipo = 'compra'` tenga su cotización en `solicitud_adjunto`.
      - **Internacionalización de mensajes en Reuniones (`src/server/reuniones/acciones.ts`, `hub-reuniones.tsx`, `messages/{es,en}.json`):** sustitución de literales en español por códigos (`reuniones.feedback.*`) traducidos simétricamente en `es.json` y `en.json`.
- [x] **Reemplazo de cotización en Compras, filtro por período en Gantt, permisos en Habitudes y enlace en Mi día (16 nov 2026):**
      - **Reemplazar cotización en `compra` (`src/server/solicitudes/acciones.ts`, `tarjeta-solicitud.tsx`, `messages/{es,en}.json`):** nueva acción `reemplazarCotizacionCompra` que permite al solicitante sustituir el archivo de cotización mientras la solicitud está en `enviada` o `en_revision`, borrando el archivo anterior del bucket privado y auditando el cambio.
      - **Filtro por período en tareas del Gantt (`src/server/calendario/gantt.ts`, `calendario/gantt/page.tsx`):** `familiaTareas` recibe `periodoId` en modo «Por período» y filtra `coalesce(a.periodo_id, mu.periodo_id) = $3`.
      - **Facilitadores de Habitudes por permiso efectivo (`src/server/habitudes/consultas.ts`):** `monitoreoProfesoresHabitudes` y `listarDocentesYEstudiantesParaAsignacion` consultan el permiso efectivo `habitudes.evidencias.subir` (`rol_permiso` + `usuario_permiso`) en lugar de nombres de rol fijos.
      - **Enlace de órdenes pendientes en «Mi día» (`contabilidad/mi-dia/page.tsx`):** apunta a `/administrativo/solicitudes` en lugar de la ruta retirada del menú `/contabilidad/ordenes-compra`.
- [x] **Blindaje final de base de datos, pruebas unitarias 360, control de frecuencia por IP y tokens de marca (16 nov 2026):**
      - **Trigger de integridad en `asistencia_360` (`db/migrations/0083_integridad_asistencia_360.sql`):** función `public._fn_integridad_asistencia_360` y trigger `tg_integridad_asistencia_360` (`BEFORE INSERT OR UPDATE`) que impide en PostgreSQL marcar asistencia de una inscripción de 360 ajena a la materia y período de la sesión.
      - **Pruebas unitarias de Académico / Global Effect 360 (`scripts/probar-academico-360.mjs`, `package.json`):** suite con `node:test` (`npm run test:academico`) que verifica `esDiaValido`, `aDia`, `validarPeriodo` (`src/lib/periodos.ts`) y `calcularNotaFinal` (`src/lib/nota-final.ts`: ponderación con escalas distintas, tareas vencidas no entregadas = 0, tareas vencidas entregadas sin revisar excluidas).
      - **Control de frecuencia por IP en Transporte (`src/lib/frecuencia.ts`, `api/transporte/posicion/route.ts`, `src/server/transporte/acciones.ts`):** limitador en memoria por ventana deslizante (`permitirFrecuencia`, `ipDeCabeceras`) aplicado a `/api/transporte/posicion` (60/min por IP → `429`) y a la inscripción pública `inscribirPuntualDiaria` (12 cada 10 min por IP).
      - **Unificación de tokens de marca (`marca-500`/`marca-600`/`marca-700`):** sustitución de `#2096BA`/`#187a99`/`#0a6a8a` escritos a mano en `comida/page.tsx`, `tablero-tareas.tsx` y los módulos contables de `nomina`, `activos-fijos` e `inventario`.
- [ ] **Observaciones #1 de Contabilidad (12 nov 2026)** — en la base y en `main`, falta prueba en navegador:
      - ~~Aplicar `0080` y `0081`~~ — aplicadas en la base real el 12 nov 2026; consultas de libros, asientos, inicio y bancos verificadas contra ella.
      - Probar en navegador: periodo del inicio con flechas; procesar un asiento (ficha y selección en lista); diario con mayores y auxiliares; mayor plegable con rango de cuentas; balanza solo débito y crédito; subir dos veces el mismo .csv (la segunda debe decir «ya estaban»); conciliar, ver en «Conciliadas» y anular.
      - ~~`scripts/probar-contabilidad.mjs` (§ conciliación) todavía prueba la conciliación por lotes de la `0036`: reescribirlo para `extracto_linea`/`conciliacion_partida`.~~ — actualizado el 16 nov 2026 (`l1`–`l3`: deduplicación por clave en `extracto_linea`, unicidad de pareja viva en `conciliacion_partida` y liberación al anular).
      - **Permiso `reuniones.leer` para `chofer` (`0082`, 16 nov 2026):** migración `0082_chofer_reuniones_leer.sql`, `PERMISOS_POR_ROL.chofer` en `src/lib/rbac.ts` y botón «Mis reuniones» en `panel-chofer.tsx`.
      - **Conciliación uno-a-varios y cuentas compensatorias (`0086`, 18 nov 2026):** migración `0086_cuentas_compensatorias_y_conciliacion.sql` aplicada; soporte en `conciliarPartida` para agrupar múltiples líneas contables contra una sola transacción del extracto bancario bajo un mismo `grupo_id` verificando igualdad de sumas; anulación atómica del grupo completo; soporte de checkboxes y barra de sumas en `conciliador.tsx`; columnas `naturaleza` y `es_compensatoria` en `cuenta_contable` para que cuentas como depreciación acumulada (`1.2.09`, `1.2.01.02`) calculen su saldo como acreedoras sin signo negativo espurio en libros y balances; prueba `(l4)` añadida a `probar-contabilidad.mjs`.
      - Módulos fuera del menú de contabilidad (rutas vivas): nómina, impuestos, retenciones, activos fijos, consumibles, calculadoras, centros de costo, órdenes de compra, comprobantes recibidos, terceros, fondos, donaciones, rendición por fondo y `/reportes`. «Mi día» todavía enlaza a órdenes de compra si hay alguna pendiente.
- [x] **Cruce Estudiante ↔ Docente (Pasos 4 y 5): historial/recalificación de entregas por tarea y conexión de Reuniones y Tutorías (12 nov 2026):**
      - **Inspección y recalificación de todas las entregas (`src/server/profesor/consultas.ts`, `academico/clases-360/page.tsx`, `gestion-clases-360.tsx`):** nueva consulta `entregasDeClases360` que trae tanto entregas pendientes como ya calificadas, con firma de enlaces del bucket privado (`enlaceDeDocumento`); `ListaAsignacionesClase360` permite desplegar las entregas de cualquier tarea o examen publicado para consultar archivos, textos y recalificar o ajustar retroalimentación; soporte de deep-link `?clase=<id>&accion=publicaciones`.
      - **Conexión de Reuniones y Tutorías en ambos portales y privacidad estudiantil (`portal/profesor/page.tsx`, `portal/estudiante/page.tsx`, `reuniones/consultas.ts`, `reuniones/page.tsx`, `messages/{es,en}.json`):** accesos rápidos a `/reuniones` en el portal docente y en el portal estudiantil cuando el usuario tiene `reuniones.leer`; botón directo a «Publicaciones» desde cada clase en `/portal/profesor`; `listarCandidatosParticipantes` filtra por `usuario_id` cuando el rol es `estudiante` para no exponer los nombres y correos de los demás becados.
- [x] **Cruce Estudiante ↔ Docente (Paso 3): publicación de materiales/anuncios y listado/eliminación de publicaciones por clase (12 nov 2026):**
      - **Publicación completa (`src/server/profesor/acciones.ts`, `gestion-clases-360.tsx`):** `publicarTarea` y `FormularioTarea` admiten los 4 tipos de `tipo_asignacion` (`tarea`, `examen`, `material`, `anuncio`) y enlace de recurso opcional (`archivo_url`), alimentando la sección de Recursos y Anuncios del Aula Virtual estudiantil.
      - **Gestión de publicaciones por clase (`src/server/profesor/consultas.ts`, `acciones.ts`, `academico/clases-360/page.tsx`, `gestion-clases-360.tsx`):** nueva consulta `asignacionesDeClases360`, acción `borrarAsignacion360` (validada en SQL por `docente_id` y auditada en `audit_log`) y vista desplegable `ListaAsignacionesClase360` en cada clase con conteo de entregas, metadatos y eliminación.
      - **i18n (`messages/es.json`, `messages/en.json`):** 7 nuevas claves simétricas en `academic.classes360`.
- [x] **Cruce Estudiante ↔ Docente (Paso 2): notificaciones bidireccionales en la campana (12 nov 2026):**
      - **Lado docente (`src/server/profesor/acciones.ts`, `src/server/moodle/acciones.ts`):** `publicarTarea` notifica en `notificacion` a todos los estudiantes con cuenta activa inscritos en esa clase y período (`/portal/estudiante/aula-virtual`); `revisarEntrega` y `calificarEntregaMoodleAction` avisan al estudiante cuando recibe calificación o retroalimentación de su entrega; `calificarInscripcion360` avisa al estudiante al cerrarse su nota final de Global Effect 360 (`/portal/estudiante/calificaciones`).
      - **Lado estudiante (`src/server/moodle/acciones.ts`):** `entregarTareaMoodleAction` inserta dentro de la misma transacción el aviso para el docente responsable (`docente_id` / `profesor_usuario_id` / `creada_por_id`) con enlace directo a `/academico/clases-360`.
- [x] **Cruce Estudiante ↔ Docente (Paso 1): asistencia autónoma en 360 y descarga/respuesta en Buzón Moodle (12 nov 2026):**
      - **Asistencia 360 (`src/server/profesor/acciones-asistencia.ts`, `academico/clases-360/page.tsx`):** `guardarSesion360` y `borrarSesion360` admiten ahora `docencia.impartir` además de `academico.escribir`, restringido en SQL a las clases donde `materia_360.docente_id = usuario.id`. El docente ya puede programar, editar y eliminar sesiones de asistencia de sus propias clases sin depender de que coordinación pre-cree la fecha.
      - **Buzón Moodle del estudiante (`src/lib/moodle.ts`, `src/server/estudiantes/aula.ts`, `aula-virtual/page.tsx`, `boton-buzon-moodle.tsx`, `buzon-tarea-moodle.tsx`):** `asignacionesDelEstudiante` expone `entrega_archivo_url`, `entrega_texto_respuesta`, `revisada_por_nombre` y `revisada_en`; `aula-virtual/page.tsx` entrega el namespace `moodle` al cliente y firma en servidor los enlaces del bucket privado (`enlaceDeDocumento`); el buzón muestra y precarga la respuesta escrita del estudiante y permite descargar el archivo entregado.
- [x] **Lista de expedientes: filtros y vistas con foto (9 nov 2026):** chips de estado; universidad, situación (en prueba académica, sin notas, activos sin cuenta, sin foto) y orden (nombre, índice, ingreso) en la URL (`lib/filtros-expedientes.ts`). Tarjetas con la foto a todo el ancho y lista en tabla (≥ md) o filas (< md), con foto en ambas. Regla: solo los estudiantes **activos** llevan cuenta del portal (`ESTADO_CON_CUENTA`); `vincularCuenta` rechaza otros estados y la portada solo deja soltar la que haya quedado.
      - Sin foto se ve una silueta con el aviso «Sin foto» (píldora en tarjetas, icono en la esquina en lista, portada y vista rápida). **Falta:** ningún expediente tiene foto todavía; subirlas desde la edición del expediente. No se desvincula sola la cuenta al pasar de activo a suspendido: hoy es manual desde la portada.
- [x] **Formularios Normal / Guiado (9 nov 2026):** pieza común `ui/formulario-guiado.tsx` (selector en cada formulario + preferencia en Mi perfil → Apariencia, guardada en el navegador). Aplicada a ~45 formularios de captura (contabilidad, académico, 360, academias, patrocinadores, operaciones, reuniones, calendario, IA, transporte, expediente, inventario, rendición, solicitudes, Habitudes). El expediente deja las pestañas: guiado = una sección por paso, normal = las seis apiladas, y ahora se envían siempre las seis.
      - **Probar a mano:** guardar un expediente nuevo y uno editado en los dos modos; que «Siguiente» se detenga en un `Select` obligatorio vacío (depende del `<select>` oculto de Radix); el mapa de Vivienda en modo guiado.
      - **Deuda vista y no tocada:** literales en JSX y `bg-[#2096BA]`/`accent-[#2096BA]` sueltos en nómina, activo fijo, inventario contable, tablero de tareas y `inventario/formulario-activo.tsx` (este sin i18n); claves sin uso `records.form.progress/next/previous`.
- [x] **Portada del expediente (9 nov 2026):** tarjeta con la foto del estudiante, estado, universidad, programa, cédula, ingreso y la cuenta del portal vinculada (vincular/cambiar/desvincular con `expedientes.escribir`, acción `vincularCuenta`). La ficha muestra además las materias de la universidad por período con su estado, las clases de Global Effect 360 y las tareas del aula virtual (origen 360/universidad, docente, vencimiento, nota). Estados de entrega movidos a `src/lib/estado-entrega.ts`.
- [x] **Datos de demostración en todos los estados (9 nov 2026):** `npm run db:seed:demo` (esquema público) y `npm run db:seed:demo:contabilidad`. Idempotentes (ids derivados de claves fijas, no borran nada). Una fila por cada valor de estado de: estudiante (los 8), solicitud (7), rendición (5), reunión (5), viaje (5), inscripción 360 (5), tarea (5, para cada uno de los 6 roles operativos), proyecto, inventario, entrega, visita Habitudes, acción de IA, correo, y en contabilidad factura, cuenta por pagar, orden de compra, donación, comprobante recibido, declaración, presupuesto. Más chat, notificaciones por rol, patrocinadores y becas.
      - **Límite:** los documentos contables «aprobados» no traen `asiento_id` (un asiento a mano puede descuadrar el libro o romper la cadena de hash; verificada: 0 eslabones rotos). El recibo «contabilizado» ya lo traía la siembra contable.
      - **Falta:** pagos, nómina y conciliación bancaria en estados intermedios (exigen movimientos y asientos reales: hay que crearlos por la capa servidor, no por SQL); `inscripcion_360` solo cubre el período activo y 2025-III; no hay contraseñas nuevas porque no se crearon cuentas de Auth (los 8 roles ya tenían usuario).
- [x] **Auditoría de flujos entre roles: Habitudes, Transporte, Comida e Inventario (9 nov 2026):**
      - Habitudes: la evidencia de una visita ya se sube al bucket privado (antes el cliente mandaba URLs inventadas) y se firma al leer; nueva acción `auditarVisitaHabitudesAction` (`habitudes.evidencias.auditar`) con botón en la galería y estado «Auditada» visible; galería y Hub leen de las props para reflejar lo recién subido; el recurso ya no se guarda con una URL falsa si falla la subida; fecha de visita en hora RD.
      - Transporte: `listarRutasConParadas` pone primero la ruta con turnos (antes salía la inversa, sin horarios, en el mapa y formularios del estudiante y de la puerta pública); la cabina del chofer muestra los errores de iniciar/finalizar/incidencia/parada y retoma el horario real del viaje abierto; el horario semanal del estudiante ya no descarta días en silencio; la alerta de incidencia llega también a los anotados del día.
      - Comida: apertura, cierre, «hoy» y hora de inscripción en hora de La Vega (`SQL_HORA_RD`); con `CURRENT_TIME` en UTC el comedor abría de 2:00 a 4:30 a. m.
      - Inventario: `buscarActivoPorCodigoAction` exige `inventario.leer`.
- [x] **Inventario: botón de eliminación (`inventario.eliminar`) e internacionalización completa (12 nov 2026):**
      - Botón para eliminar activos (`eliminarActivoAction`) con confirmación y estado de carga en `tabla-activos.tsx` (escritorio y móvil) y en `formulario-activo.tsx` al editar un activo cuando el usuario tiene `inventario.eliminar`.
      - Localización i18n completa (`admin.inventario` y `admin.activoFormulario` en `messages/es.json` y `messages/en.json`, y entrega de `mensajesCliente(["admin"])`) en `tabla-activos.tsx`, `formulario-activo.tsx`, `escanear-qr.tsx`, `etiqueta-qr-imprimible.tsx` y las 5 páginas de `/administrativo/inventario`.
- [x] **Auditoría de flujos entre roles: solicitudes, rendiciones y contabilidad (9 nov 2026):**
      - Solicitudes: `/administrativo/solicitudes` lee `?tipo=`; el alta de expediente admite un candidato nuevo (ficha mínima `postulado` + perfiles vacíos en la misma transacción), y quien no lee expedientes solo nombra candidatos del embudo; los avisos cuentan `usuario_permiso`; dirección no aprueba el segundo nivel de lo que ella misma pasó a dirección; las consultas exigen la persona con permisos de sesión.
      - Contabilidad: «Para hoy» contaba compras en estado `pendiente`, que no existe (siempre 0); `comprobantes-recibidos` entra por `contabilidad.leer` y solo enseña los botones con `contabilidad.registrar` (antes admin/super_admin entraban por rol y el clic los sacaba de la pantalla); el panel enseña el error y refresca.
      - Rendiciones: el comprobante se sube de verdad al bucket privado y se baja por `/api/rendiciones/[id]/comprobante` (antes se guardaba la URL `blob:` del navegador); aviso a quien revisa al enviar y a quien rindió al decidir; transiciones de estado protegidas; quien rinde no revisa lo suyo si hay otro revisor; «Contabilizar» no hacía nada (estado leído antes de fijarse); se pueden revisar las que están `en_revision`; errores visibles; el atajo a contabilidad apuntaba a `/portal/contabilidad/gastos` (no existe).
- [x] **Rendiciones y Expedientes: OCR real de comprobantes fiscales, códigos de error i18n y desvinculación automática de cuenta (16 nov 2026):**
      - **OCR real en Rendiciones (`src/server/ia/ocr.ts`, `src/server/colaborador/acciones.ts`, `formulario-rendicion-gasto.tsx`):** nueva función `leerComprobanteFiscal` (con validación campo por campo y registro en `extraccion_ocr`) y acción `extraerComprobanteOcrAction`; se eliminó el `setTimeout` que rellenaba datos fijos de «Ferretería & Suministros Cibao SRL». Si el entorno no tiene `ANTHROPIC_API_KEY` o el archivo no es legible, adjunta el comprobante sin pisar los campos con datos ficticios.
      - **Mensajes de `enviarRendicionGastoAction` con i18n (`src/server/colaborador/acciones.ts`, `formulario-rendicion-gasto.tsx`, `messages/{es,en}.json`):** sustitución de cadenas literales en español por códigos (`submitErrorCode.*`) traducidos en `es.json` y `en.json`.
      - **Desvinculación automática de cuenta en Expedientes (`src/server/expedientes/acciones.ts`):** `actualizarExpediente` limpia `usuario_id = NULL` cuando el nuevo estado del estudiante no pertenece a `ESTADO_CON_CUENTA` (`!llevaCuenta(estado)`), evitando que un estudiante suspendido o retirado conserve acceso al portal.
- [x] **Solicitudes: filtro por estado para revisores/contabilidad, activación automática en `alta_expediente` y destrabe de dirección única (16 nov 2026):**
      - **Filtro por estado (`/administrativo/solicitudes`, `src/server/solicitudes/consultas.ts`):** nueva consulta `solicitudesRevisionPorEstado` y barra de píldoras en `/administrativo/solicitudes?estado=...` para que contabilidad, administración y dirección puedan filtrar las solicitudes de su área por cualquiera de los 7 estados (`enviada`, `en_revision`, `pendiente_direccion`, `aprobada`, `rechazada`, `completada`, `cancelada`) además de la bandeja «Por atender».
      - **Activación automática en `alta_expediente` (`src/server/solicitudes/acciones.ts`, `consultas.ts`):** al aprobar una solicitud de `alta_expediente`, el estudiante vinculado pasa de su estado en el embudo (`reclutado`, `postulado`, `academia_liderazgo`, `standby_tecnico`) a `activo` dentro de la misma transacción.
      - **Segundo nivel cuando hay un solo director (`src/server/solicitudes/consultas.ts`):** `APROBO_PRIMER_NIVEL` solo bloquea al aprobador del primer nivel si existe al menos otro usuario activo con `solicitudes.direccion` (por rol o excepción personal) distinto del solicitante, evitando que las solicitudes queden atascadas en `pendiente_direccion` cuando hay un único director.

- [x] **Auditoría por rol y asistente con orbe animado (9 nov 2026, migraciones `0073`–`0075`, `0079`):**
      - **Cuentas y permisos:** `chofer` y `dir_habitudes` no tenían usuario en Supabase Auth (el seed no incluía al chofer); `rol_permiso` no daba `ia.usar`, `reuniones.agendar` ni `reuniones.gestionar` a `dir_habitudes`, ni `ia.usar` a `chofer` (`0073`). El asistente solo se muestra con `ia.usar`.
      - **Tareas:** vocabulario único `por_hacer`/`en_progreso`/`en_revision`/`completada`/`cancelada` con `CHECK` (`0074`); el tablero tenía 3 columnas y ocultaba la mitad de las tareas. `proyecto_rol` admite `dir_habitudes` y `chofer` (`0075`). `agente_colaborador` pasa a `chofer` (`0079`).
      - **Corregidos por flujo:** reuniones (avisos a convocados, errores visibles), solicitudes (`?tipo=`, postulación de candidato nuevo, dirección no aprueba sus dos niveles, avisos por `usuario_permiso`), rendiciones (comprobante real, avisos, botones), comprobantes recibidos por permiso, Habitudes (fotos reales, acción de auditar), transporte (ruta con turnos, errores de cabina), comida y landing en hora RD, 360 (nota final con `docencia.impartir`, vencimientos y ventanas en hora RD, cupo por período). Detalle por archivo en el historial de git.
      - **Asistente de IA:** `AiOrb` (`components/ui/ai-orb.tsx`, de 21st.dev sobre `thinking-orbs`, con tokens de marca) en el widget, el chat de página y la tarjeta de aprobación del agente; `StatCard` cuenta hasta su valor. El modo Acciones solo ofrece pantallas que el usuario puede abrir (misma regla que la guardia de cada página).
      - **Pendiente:** OCR de rendición simulado; mensajes literales en español en rendiciones, reuniones y chat de comprobantes; botón para borrar activos; textos sin traducir en inventario (`tabla-activos`, `formulario-activo`, `escanear-qr`); componentes de calificación Moodle sin usar (`evaluador-entregas-moodle`, `entregar-tarea`); segundo nivel de solicitudes atascado si hay un solo director; `chofer` sin `reuniones.leer`; recorrido manual en navegador con datos reales (casi no hay datos de 360).

- [x] **Optimización integral de roles y flujos de trabajo dedicados (8 nov 2026):**
      - **Rol `docente`:**
        - Enlace directo desde el portal `/portal/profesor` a la clase específica en `/academico/clases-360?clase=...&accion=...#clase-...` para pasar asistencia o ver alumnos sin fricción ni búsquedas manuales.
        - Auto-apertura de la sesión de asistencia del día de hoy (`sesionHoy`) al abrir la asistencia de una clase.
        - Enlace directo a cada materia universitaria en el catálogo desde el portal docente.
        - Enlace de calificación directa en cada entrega pendiente (`reviewSubmission`).
        - Sustitución de colores hexadecimales crudos en badges por `INSIGNIA_SEMAFORO.dentro` y `INSIGNIA_SEMAFORO.alerta`.
      - **Rol `estudiante`:**
        - Accesos directos a Global Effect 360 y Transporte en Vivo en el inicio del portal.
        - Insignias de estado de reunión traducidas y tokens de diseño unificados en formularios de solicitud.
      - **Roles `habitudes` y `dir_habitudes`:**
        - Geolocalización de evidencia en visitas a liceos con botón "Detectar más cercano" (`distanciaMetros`) en `registro-visita-liceo.tsx`.
        - Botón de acción directa "Postular candidato a beca" (`UserPlus`) en la cabecera del Hub para crear solicitudes de `alta_expediente` al instante.
        - Subida real de archivos pedagógicos (diapositivas, manuales, dinámicas) a Supabase Storage (`subirMaterial`) y generación de URLs privadas firmadas (`enlaceDeDocumento`).
        - Limpieza de tokens en tabs de supervisión (`text-marca-500`).
      - **Rol `chofer`:**
        - Bloqueo de suspensión de pantalla con Screen Wake Lock API (`navigator.wakeLock.request`) para dispositivos móviles en ruta activa.
        - Acceso directo "Reportar gasto / compra de repuesto" desde la cabina para imprevistos de ruta y mantenimiento (`/administrativo/solicitudes?tipo=compra`).
        - Asistencia de abordaje y reporte de incidencias en tiempo real.
      - **Rol `contabilidad`:**
        - Agrupación por par de cuentas en depreciación de activos fijos (`0071`).
        - Creación automática de Cuentas por Pagar (CxP) para solicitudes de tipo `compra` aprobadas (`0072`).
        - Integración de solicitudes de compra pendientes en la sección "Para hoy" (`/portal/contabilidad`) con acceso directo a `/administrativo/solicitudes`.
        - Localización i18n completa de `/contabilidad/comprobantes-recibidos` y su panel de revisión (36 nuevas claves simétricas en `messages/es.json` y `messages/en.json`).
        - Limpieza de colores fuera de paleta institucional en revisión de comprobantes fiscales.
      - **Roles `admin` y `super_admin`:**
        - Acciones de cabina en `EncabezadoPagina` de `/bandeja`: accesos directos de un clic a Torre de Control (`/administrativo/torre-control`), Línea de Tiempo Gantt (`/calendario/gantt`) y Agendar Reunión (`/reuniones?agendar=true`).
        - Interactividad directa en tarjetas de la bandeja: clic en tarea redirige a su tablero (`/administrativo/tareas`), clic en reunión realiza scroll automático a su tarjeta (#reunion-id) en la agenda institucional (`/reuniones`).
        - Normalización en consulta de pendientes institucionales (`pendientesDeLaFundacion`): conteo de tareas abiertas urgentes y vencidas incluyendo `'por_hacer'` y `'en_revision'`, sincronizando con el modelo real de tareas y la torre.
        - Entrada directa a Permisos (`/configuracion/permisos`) incorporada en el menú lateral bajo Configuración para administradores con `usuarios.administrar`.
      - **Mapas, contraste visual y blindaje de archivos:**
        - Carga de estilos de mapa (`mapa.css`) en transporte en tiempo real, con observador de mutaciones (`MutationObserver`) para alternar teselas claras y oscuras de CARTO al cambiar de tema.
        - Rediseño de popups y marcadores de paradas de guagua con alto contraste y legibilidad tanto en tema claro como oscuro.
        - Validación estricta en servidor de formatos admitidos (.pdf, .png, .jpg, .pptx, .docx, .xlsx, .zip) y límite de capacidad (20 MB) en recursos pedagógicos de Habitudes.
        - Unificación de tokens de diseño (`rounded-card`, `bg-card`, `shadow-card`) en etiquetas patrimoniales QR de inventario.
      - **Calidad institucional:**
        - 100% páginas estáticas/dinámicas compiladas (194/194 en `npm run build`).
        - Cero advertencias ni errores en `npm run lint`.
        - Cero colores fuera de norma en `npm run audit:ui`.
        - 5,072 claves simétricas y validadas en `npm run i18n:check`.
        - 95/95 pruebas de contabilidad aprobadas en `npm run test:contabilidad`.

- [x] **Etapa 4 (B): solicitudes de compra a contabilidad con cotización (1 nov 2026, migración `0070`):**
      - Tipo `compra` para todos los roles, cotización obligatoria (pdf/png/jpg/docx, 10 MB, validada en servidor), descarga protegida, contabilidad aprueba o rechaza (motivo obligatorio), estado y línea de tiempo visibles para ambos, menús de contabilidad y chofer con "Solicitudes".
      - **Migración `0070` aplicada** en la base real (1 nov 2026). Falta recorrido manual en navegador: enviar una compra con cotización, rechazarla con comentario y bajar el archivo.
      - **Pendiente:** reemplazar cotización, vista de contabilidad filtrada por estado, trigger que exija adjunto en `compra`.

- [x] **Etapa 3: Global Effect 360 como portal estudiantil completo (1 nov 2026, migraciones `0067`–`0069`):**
      - **Entrega real:** archivo subido en servidor, inscripción verificada, formatos cerrados (sin `zip`), respuesta escrita, la revisión se anula al re-entregar; calificación acotada a la clase del docente (detalle de la auditoría en `bitacora-tesis.md`).
      - **Asistencia (`0068`):** `sesion_360` programada por administración y `asistencia_360` marcada por el docente de la clase; vista del estudiante y del expediente.
      - **Cuatrimestres:** `validarPeriodo` (`lib/periodos.ts`) en `guardarPeriodo`, `guardarVentana` y `moverBarra`; `guardarMateria360` escribe docente, horario, aula y cupo.
      - **Notas (`0069`):** tareas por período con `peso`; nota final propuesta (`lib/nota-final.ts`) con anulación auditada; el profesor decide aprobó/reprobó (`decidida_por/en`); escala hasta 1000 puntos; `prematriculada → cursando` perezoso; cupo por período.
      - **Expediente e historial:** 360 por cuatrimestre aparte de la carrera; índice de la carrera separado del promedio de 360.
      - **Migraciones `0066` a `0069` aplicadas** en la base real (1 nov 2026), verificadas por esquema. Las consultas nuevas siguen sin recorrido manual en navegador.
      - **Pendiente:** pruebas unitarias de `validarPeriodo` y `calcularNotaFinal` (no hay marco de pruebas); trigger que impida marcar asistencia de una inscripción ajena a la sesión; `gantt.familiaTareas` sigue sin filtrar por período (vista global); clave `taskAverage` huérfana; mensajes de `moodle/acciones.ts` y de inventario con literales; aplicar `Dato` al resto de tarjetas (etapa 2).

- [x] **Etapa 2: un solo acento, sin degradados, datos con icono (1 nov 2026):**
      - **Acento a elección:** Mi perfil → Apariencia ofrece Azul o Negro (`data-acento`, en el navegador). El negro reasigna `marca-*` en `globals.css`; solo en claro (de noche manda el azul).
      - **Cero degradados:** botón, perfil, hero, avatares, barra inferior, widget de IA, anuncios y cáscara de carga (ahora "respira" en opacidad). Se borran `GRADIENTE`, `GRADIENTE_OSCURO`, `PORTAL_BANNER` y `ESTILO_POR_ROL` (sin usos). `audit:ui` falla si reaparecen.
      - **Sin subtítulos:** `AccesosPortal` y `BannerPortal` pintan solo icono y título; nuevo primitivo `Dato`/`FilaDatos` aplicado a "Lo próximo" y a las filas de tareas.
      - **Norma actualizada:** `docs/09-sistema-visual.md` §2.9–2.10 y `.claude/rules/design-system.md` §2b.
      - **Pendiente:** aplicar `Dato` al resto de tarjetas (tabla de notas, aula, solicitudes, matrícula, Habitudes…); probar en navegador el acento negro (contrastes de insignias y foco).

- [x] **Transporte, etapa 1: nombres cortos, invitados e inscripción asistida (1 nov 2026, migración `0066`):**
      - **Nombres de viaje:** los cuatro turnos pasan a `Mañana`, `Mediodía`, `Tarde` y `Noche`; el selector muestra `nombre · hora`.
      - **Invitados:** nueva pestaña "Invitados" en el portal del estudiante (`inscribirInvitado`, `quitarInvitado`, `invitadosDeUsuario`): anota a otra persona en un viaje de hoy o de otro día, ve a quién anotó y la quita. Tope de 8 por día.
      - **Inscripción asistida:** botón "Anotar pasajero" en la cabina del chofer (`inscribirPasajeroAsistido`, permiso `transporte.operar`, que también tiene administración) para quien no tiene internet y lo pidió por teléfono o en persona.
      - **Una sola validación** (`registrarInscripcionDiaria`) para las tres vías (`publica`, `estudiante`, `asistida`, columna `via` + `inscrito_por`); origen y destino deben ser distintos, en la acción y como `CHECK` en la base (`NOT VALID`, no toca filas viejas). `FormularioPuntual` recibe la acción por prop.
      - **Recomendación de mapa/API y Google Workspace:** `docs/referencia/mapas-y-google-workspace.md`.
      - **Pendiente:** aplicar `npm run db:migrate`; límite de frecuencia por IP en `/api/transporte/posicion`; inicio de sesión con Google para el personal; marcar la vivienda del estudiante en el mapa.

- [x] **Línea de tiempo rediseñada y unificada (1 nov 2026):**
      - **Un solo componente** (`components/linea-tiempo/linea-tiempo.tsx`, tipos y aritmética de días en `lib/linea-tiempo.ts`) para las tres líneas de tiempo: panorama (`/calendario/gantt`), detalle de proyecto y vencimientos de cuentas por pagar. Se borra `visualizador-gantt.tsx`.
      - **Función:** además de ver qué corre a la vez, se editan fechas arrastrando (mover el cuerpo, estirar los extremos); con teclado, flechas ±1 día y Mayús+flechas para el fin. Optimista con reversión si el servidor rechaza. `moverBarra` (`server/calendario/acciones-gantt.ts`) decide por clase: `proyecto` y `tarea` con `operaciones.escribir`, `periodo` con `academico.escribir`; la tarea mueve también su evento del calendario; audita. Materias, clases 360 y entregas no se mueven (heredan o se deducen).
      - **Diseño:** rejilla con nombres fijos y eje con meses y días, línea de hoy, escala semana/mes/período, barras redondeadas con progreso, hitos como rombo, detalle al tocar; en móvil, lista por fechas. Lo vencido va con icono de aviso y tinta, no en rojo. La tarea ahora empieza en su `fecha_inicio` (antes, siempre su creación).
      - **Filtros en la URL** (`filtros-linea-tiempo.tsx`): período, "todo" y familias.
      - **Corregido de paso:** los componentes cliente de transporte y los de `/configuracion/permisos` no recibían sus mensajes (`useTranslations` sin espacio entregado fallaría en ejecución aunque el build pase): las páginas ahora entregan `transport` y `permisosAdmin` con `mensajesCliente`; `lineaTiempo` pasó a espacios base.
      - **Pendiente:** no se probó el arrastre en navegador (solo tipos, lint y build); dependencias entre tareas (`tarea_dependencia`) sin dibujar.

- [x] **Roles definitivos, permisos granulares y portal limpio (1 nov 2026, migración `0065`):**
      - **Roles:** quedan `super_admin`, `admin` (administrativo), `docente`, `estudiante`, `contabilidad`, `habitudes`, `dir_habitudes` y `chofer`. Se retira `colaborador`: la `0065` pasa sus cuentas a `admin` (avisa cuántas con `RAISE NOTICE`) y borra el rol, su `rol_permiso` y su `visibilidad_menu`; se elimina `/portal/colaborador`. El módulo "colaborador" (torre de control, rendiciones, tareas) sigue: lo usan los demás roles.
      - **Permisos por rol editables:** la sesión carga `rol_permiso` del rol efectivo (`permisosRol`, `permisos` en `UsuarioSesion`); `PERMISOS_POR_ROL` pasa a ser reparto de fábrica. Los ~95 `tienePermiso(usuario.rol, …)` pasaron a `usuarioTienePermiso(usuario, …)`; `menuDe`, `ajustesDeUsuario`, solicitudes, IA y calendario reciben la persona, no el rol.
      - **Permisos por persona:** `/configuracion/permisos` (solo `super_admin`, auditado) con dos vistas: por rol (`guardarPermisoRol`; `super_admin` no se edita) y por persona (`guardarExcepcionPermiso`; un interruptor por permiso, igual al rol = sin excepción). Nuevo primitivo `Interruptor`.
      - **Permiso de capacidad `docencia.impartir`:** nativo de `docente`. Habilita a otro rol (p. ej. profesor de Habitudes que da una clase de 360) el portal de profesor, `clases-360`, publicar tareas, calificar y aparecer como docente asignable; el menú le suma el área de docencia. Guardia nueva `requerirDocencia`.
      - **Contables:** un solo rol `contabilidad`; jefe, contables locales y contable externa se diferencian con permisos por persona.
      - **Limpieza visual (6 frentes):** landing, portal del estudiante, dirección/agenda, administrativo/configuración, contabilidad y académico/Habitudes/transporte. Fuera subtítulos, antetítulos, introducciones y ayudas redundantes; cabeceras con `EncabezadoPagina` solo con título; `animate-entrada` en las pantallas.
      - **Migración `0065` aplicada** (1 nov 2026): `docente` ya tiene `docencia.impartir` y `colaborador` no existe. **Pendiente:** revisar las cuentas que eran `colaborador` (ahora `admin`) y bajarles permisos desde la pantalla nueva.
      - **Pendiente:** podar claves de i18n sin uso (`*Hint`, `subtitle`, `eyebrow`, `FichaRol`…); `BannerPortal` e `AccesosPortal` (`components/layout/`) aún aceptan `insignia`/`subtitulo`/`texto`; páginas sobre 300 líneas (`expedientes` ~690, `gantt` ~580, `reportes` ~555, `auditoria` 409, `actividad` 362, `sitemap` ~320, `portal/administrativo` ~305); literales sin i18n en inventario, `comprobantes-recibidos` y `vista-nomina`; `comida/page.tsx` con hex y `rounded-xl/lg`; renombrar el namespace i18n `colaborador` (ya no es un rol); los roles con `habitudes`/`docente` siguen compartiendo listas en `server/habitudes/consultas.ts` por nombre de rol.

- [x] **Revisión y corrección de los commits del 1 nov 2026 contra el plan (transporte, calendario, portal del estudiante):**
      - **Nombres:** las acciones de `src/server/transporte/acciones.ts` pierden el sufijo inglés `Action` y quedan como verbos en español (`iniciarViaje`, `finalizarViaje`, `reportarIncidencia`, `actualizarPosicionViaje`, `actualizarParadaViaje`, `guardarInscripcionRecurrente`, `inscribirPuntualDiaria`, `cargarPasajerosHorario`), como `solicitudes` y `comida`.
      - **Capa servidor:** el SELECT del viaje estaba copiado 5 veces; ahora hay una sola fuente (`SELECT_VIAJE`) y `obtenerViajePorId`. La ruta `/api/transporte/posicion` ya no lleva SQL ni expone `chofer_id`. `obtenerPasajerosHorario` dejó de interpolar SQL (regla 3): la fecha viaja como parámetro.
      - **Zona horaria:** la BD corre en UTC y `CURRENT_DATE` mandaba el turno de las 8 PM al día siguiente (sin pasajeros ni viaje de "hoy"). Ahora `SQL_HOY_RD`, `minutosActualesRD()` y `fechaHoyRD()` (`src/lib/transporte.ts`) usan `America/Santo_Domingo`; el turno sugerido tampoco depende de la zona del servidor.
      - **Control de acceso:** `reportarIncidencia`, `finalizarViaje`, `actualizarParadaViaje` y `actualizarPosicionViaje` solo operan sobre viajes del chofer que llama (antes cualquiera con `transporte.operar` podía marcar averiado el viaje de otro) y auditan solo si hubo cambio. `/portal/chofer` usa `requerirPermiso("transporte.operar")`.
      - **Puerta pública:** `inscribirPuntualDiaria` valida uuids, longitudes y fecha (nunca pasada) antes de insertar.
      - **Diseño:** un error ya no es rojo (`bg-tinta text-background` con `AlertCircle`); sin `rounded-lg/xl/md` ni `shadow-sm/md` (`rounded-control/card`, `shadow-card/elevada`); fuera los emoji (🚐, ⏱️); hex del marcador, la polilínea y los popups salen de `paleta.ts`; los popups de Leaflet escapan el HTML; `<label>` crudos pasan a `Label`; el éxito del formulario público va en marca, no en semáforo. `COLOR_ORIGEN` del calendario usa tokens.
      - **Pantallas:** `loading.tsx` para `/portal/chofer`, `/portal/estudiante/transporte` y `/transporte`.
      - **Limpieza:** se borra `AvisoSinFicha` (quedó sin usos al desacoplar el portal del expediente) y la entrada duplicada de transporte en este archivo.
      - **Pendiente:** `panel-chofer.tsx` (~500 líneas) conviene partirlo en `components/transporte/` (cabecera de mando, lista de pasajeros, diálogo de incidencia); la puerta pública `/transporte` no tiene límite de frecuencia por IP; `event-manager.tsx` aún trae hex de commits anteriores (días "hoy", chips) que `audit:ui` exceptúa.

- [x] **Sistema de Transporte Institucional en Tiempo Real y Cabina del Chofer (1 nov 2026, migración `0064`):**
      - **Migración `0064_sistema_transporte_institucional.sql`:**
        - Tablas creadas: `transporte_ruta`, `transporte_parada`, `transporte_horario`, `transporte_inscripcion_recurrente`, `transporte_inscripcion_diaria`, `transporte_viaje` y `transporte_incidencia`.
        - Carga de semillas con los 4 turnos fijos diarios (06:00 AM Matutino, 12:00 PM Mediodía, 06:00 PM Tarde y 08:00 PM Noche) y paradas geográficas reales en La Vega: UCATECI, Oficina Central, Cruce de Controba, Rincón, Jima Abajo (Cimabajo), La Ceivita, El Ranchito, Sabana Rey y conexión interior.
      - **Rol `chofer` y Permisos RBAC (`src/lib/rbac.ts`):**
        - Rol `chofer` incorporado al sistema con permiso `transporte.operar`. Portal directo `/portal/chofer`.
        - Permisos `transporte.operar` y `transporte.gestionar` integrados en la matriz RBAC.
      - **Portal Minimalista del Chofer (`/portal/chofer`):**
        - Operación táctil móvil con una sola mano: botón gigante "INICIAR VIAJE" y "FINALIZAR VIAJE".
        - Transmisión continua de geolocalización en segundo plano con `navigator.geolocation.watchPosition` (latitud, longitud, rumbo y velocidad).
        - Respaldo de paradas manuales (`actualizarParadaViaje`) y aviso visual si el GPS se corta o se deniega el permiso.
        - Botón de emergencia "Reportar avería / problema" con modal rápido (Avería mecánica, Tránsito, Desvío, Accidente) que despacha alertas inmediatas a los estudiantes inscritos en ese viaje.
      - **Portal del Estudiante (`/portal/estudiante/transporte`):**
        - Pestaña "Dónde viene la guagua": mapa interactivo en vivo con el autobús animado en 3D (`iconoGuagua3D`), orientación de rumbo (`heading`), pulso en ruta y parada aproximada con cálculo de tiempo estimado.
        - Pestaña "Mi horario semanal": matriz de Lunes a Sábado para configurar turnos y paradas fijas, eliminando la necesidad de anotarse a diario.
      - **Puerta Pública de Transporte (`/transporte`):**
        - Acceso público sin login previo (similar a `/comida`) con mapa en vivo, información de próximos turnos e inscripción puntual para viajes del día.
        - Enlace integrado en el pie de página institucional (`src/components/landing/footer.tsx`).
      - **API de Rastreo (`/api/transporte/posicion`):** Sondeo periódico liviano en vivo cada 4 segundos durante viajes en curso.
      - **Calidad:** 4,828 claves i18n simétricas (`npm run i18n:check`), 0 colores fuera de marca (`npm run audit:ui`), `npm run lint` y `npm run build` en verde al 100% (194/194 páginas).

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
        - Color de `clase` con tokens de marca (`bg-marca-500/20 text-marca-700 border-marca-500/40`) en EventManager y badge `t("agenda.classBadge")` con icono `BookOpen`.
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
- [x] **Geolocalización en Habitudes, Wake Lock en Transporte y CxP para Compras (8 nov 2026, migración `0072`):**
      - **Transporte y Cabina del Chofer:** Implementación de *Screen Wake Lock API* en [`panel-chofer.tsx`](src/components/transporte/panel-chofer.tsx) para mantener encendida la pantalla del smartphone del chofer durante los viajes en curso sin suspensión automática ni toques manuales en el soporte del vehículo.
      - **Habitudes y Liceos de La Vega:** Migración `0072` agrega columnas `latitud` y `longitud` a `habitudes_visita_evidencia`. Se incorporó el botón "Detectar más cercano" en [`registro-visita-liceo.tsx`](src/components/habitudes/registro-visita-liceo.tsx) con cálculo de distancia geodésica (`distanciaMetros`), auto-selección del liceo más próximo y almacenamiento de las coordenadas exactas de la visita.
      - **Contabilidad y Compras:** Actualización de `contabilidad.crear_cxp_desde_solicitud` en la base de datos y en [`src/server/solicitudes/acciones.ts`](src/server/solicitudes/acciones.ts) para generar automáticamente la Cuenta por Pagar (`CxP`) al aprobar una solicitud de compra con cotización.
      - **Calidad:** 5,028 claves i18n simétricas (`npm run i18n:check`), 0 colores fuera de marca (`npm run audit:ui`), `npm run lint` y `npm run build` en verde al 100% (194/194 rutas).
- [x] **Contabilidad, Torre de Control, Agendas y ERP — Cierres de Auditoría (8 nov 2026, migración `0071`):**
      - **Contabilidad:**
        - Cuentas de depreciación de activos fijos agrupadas por cada categoría (`cuenta_gasto_depreciacion_id` y `cuenta_depreciacion_acumulada_id`) en `src/server/contabilidad/activos-fijos/acciones.ts`, evitando imputar todas las categorías a las cuentas del primer activo.
        - Retiro formal de la función PL/pgSQL obsoleta `contabilidad.reponer_caja` en la base de datos (migración `0071`), ya que la reposición se ejecuta de forma integral y transaccional desde `reponerCajaDesdeBancoAction`.
        - Creación de `src/app/[locale]/(portal)/contabilidad/cajas/loading.tsx` con esqueletos visuales conformes a los tokens de diseño.
      - **Agendas y Reuniones:**
        - Aislamiento estricto de métricas en `metricasReuniones` (`src/server/reuniones/consultas.ts`): los usuarios sin rol de administración ven únicamente los conteos de reuniones en las que participan u organizan, blindando la privacidad institucional.
        - Blindaje RBAC en `src/app/[locale]/(portal)/reuniones/page.tsx` utilizando `await requerirPermiso("reuniones.leer")` y eliminación de mensajes literales de error en JSX.
      - **Torre de Control y Proyectos:**
        - Internacionalización completa de `/administrativo/proyectos/[id]` (claves `backToProjects`, `notFound`, `leader` en `messages/es.json` y `messages/en.json`), eliminando textos literales en JSX.
        - Verificación integral de flujos de asignación, avance de tareas, comentarios y vista de equipo en la Torre de Control (`torre-control` y `torre-control/equipo`).
      - **Calidad:** 5,026 claves i18n simétricas (`npm run i18n:check`), 0 alertas de colores/degradados (`npm run audit:ui`), `npm run lint` y `npm run build` en verde al 100% (194/194 rutas).
- [ ] **Landing:** fotos reales de la Fundación en el hero. (Claves sin uso `work_*_tag`, `work_training_*`, `access_*_f1–f3` ya depuradas y botón de transporte añadido junto a comida en navbar).
- [ ] **Costo Integral por Becado (TCO Educativo):** Plan diseñado en [`docs/estado/plan-costo-por-estudiante.md`](docs/estado/plan-costo-por-estudiante.md) para vincular en el expediente los 4 pilares de costo (pagos de universidad, materiales de inventario, transporte prorrateado y rendiciones/gastos directos) y calcular el costo promedio por carrera/egresado.
- [ ] **Documentar** los nuevos tokens de movimiento en `docs/09-sistema-visual.md` §2.8 y `.claude/rules/design-system.md`.

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
- [x] **Elly AI, fases 1–5 y parte de la 6–7 (24 oct 2026).** Migraciones
      `0057`–`0059` aplicadas. Agente por rol, medidor y cuotas, chat con
      streaming (`/api/ia/chat`), herramientas con aprobación y deshacer,
      conocimiento por agente, «Mi día» de Contabilidad y apariencia
      (tema claro/oscuro y barra lateral negra, en Mi perfil). Detalle y lo que
      falta en [`plan-elly-ai.md`](plan-elly-ai.md); revisión del trabajo
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
- [ ] **Probar Elly AI en pantalla con una clave real** (`GEMINI_API_KEY`):
      hasta ahora solo se probó el bucle con un proveedor falso y el flujo de
      streaming contra un servidor de Anthropic simulado. Verificar el
      identificador de modelo (`GEMINI_MODEL`) y, si se quiere Haiku para
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
      (`CajonAccionesRapidas`) con atajos a cámara QR, rendición de comprobantes, tareas del día, agenda y Elly AI por voz.
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

- [ ] (histórico: con Anthropic) `ANTHROPIC_API_KEY` en `.env.local` devolvía 401 — el chat IA y el OCR de
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

- [x] Bandeja (`/bandeja`) sustituye al "Portal administrativo" y al "Panel"
      como inicio de `admin`/`super_admin`: avisos que esperan decisión, tareas
      por vencimiento, proyectos con avance, reuniones próximas,
      notificaciones (leer/marcar) y gráficas con tokens de marca. Cada bloque
      se consulta solo con su permiso (`src/server/bandeja/consultas.ts`).
      `/dashboard` y `/portal/administrativo` quedan como redirecciones.
      Se borraron las cifras de la Fundación, el listado de módulos y la
      actividad de `audit_log` del portal viejo; si se quiere recuperar la
      lectura de `audit_log`, hay que construirle su propia pantalla.

- [x] Transporte: historial de posiciones GPS (migración `0089`,
      `transporte_posicion`). `actualizarPosicionViaje` guarda un punto por
      viaje cada ≥ 5 s (tope en el servidor) con la precisión del GPS;
      `recorridoDelViaje` lo lee.
- [x] Transporte: el mapa dibuja el recorrido real (línea punteada de tinta,
      últimos 1500 puntos) en vivo y en viajes terminados.
- [ ] Transporte: el GPS web se suspende
      con el teléfono bloqueado: para fiabilidad total haría falta app móvil.

- [x] Expediente académico, fase 1: `estudiante_etapa` (migración `0090`)
      registra cada alta y cada cambio de estado. Plan completo en
      `docs/estado/plan-expediente-academico.md`.
- [ ] Expediente académico, fases 2-7 (catálogo universidad/carrera/pénsum,
      notas por período, importaciones OCR, servicio mensual, reunión mensual,
      sanciones). La 4 espera el pénsum, el récord de notas y el listado de
      notas de la universidad.
- [ ] Documentación maestra: regenerar `04-modelo-de-datos/diccionario-de-datos.md`,
      el ERD y `esquema.dbml` desde la base (85 tablas; el diccionario llega a
      la `0019`). Lo que debe entregarse para cerrar el expediente está en
      `docs/estado/entregables-expediente.md`.

- [x] IA: base de conocimiento editable por `admin` (permiso nuevo
      `ia.conocimiento`, migración `0091`, solo agente de estudiantes) y capas
      de seguridad comunes a las cuatro rutas del modelo (`src/lib/ia-seguridad.ts`):
      rechazo de código/JSON/órdenes en preguntas y documentos, datos como no
      confiables con etiquetas desarmadas, y bloque fijo de alcance al final del
      prompt. Pruebas: `node --test scripts/probar-ia-seguridad.mjs`.
- [ ] IA: la salida del modelo no se filtra (se pinta como texto plano y el
      prompt prohíbe código); si se quiere bloquearla, añadir revisión de salida.
      Las instrucciones editables del agente (`ai_agente.instrucciones`) se
      neutralizan pero no se rechazan: decidir si también deben pasar el filtro.
- [ ] IA: probar con la API real (los filtros solo se probaron sin red) y con
      un documento cargado de verdad; no hay documentos en la base todavía.

- [x] Cartas mensuales a patrocinadores con Elly AI (migración `0092`, parámetros
      `correos.*`): webhook `/api/correo/entrante`, cola de salida real
      (`correo_cola` por fin se vacía, con Resend por `fetch`), bandeja
      `/patrocinadores/correos`, columnas «Carta» y «Cumplió» en la planilla.
      Prueba: `npx tsx scripts/probar-correos-entrada.ts` y
      `node --test scripts/probar-correos-patrocinador.mjs`.
- [ ] Cartas: conectar un buzón real al webhook y poner `RESEND_API_KEY`,
      `CORREO_ENTRANTE_SECRET` y `CRON_SECRET` (hoy ninguna carta puede entrar ni
      salir). Probar con la API real de IA y con cartas de verdad.
- [x] Cartas: el campo manual `envio_correo_patrocinador` se retiró del formulario (la columna queda en la base sin uso; borrarla en una migración cuando convenga). El «no aplica» de la carta del expediente ahora depende de si tenía patrocinador ese mes (fechas de la asignación), no de si alguna vez lo tuvo.
- [ ] Cartas: no se muestra todavía el estado de la carta en el portal del
      estudiante ni en el detalle del expediente.

- [x] Elly AI pasa de Anthropic a **Gemini** (capa gratuita por ahora): cliente
      REST propio (`src/lib/gemini.ts` puro y `gemini-cliente.ts`), sin SDK; se
      desinstaló `@anthropic-ai/sdk`. Chat con herramientas, OCR y revisión de
      cartas usan lo mismo. Pruebas: `node --test scripts/probar-gemini.mjs`.
- [x] `GEMINI_API_KEY` ya está en `.env.local` (pendiente: ponerla en Vercel).
- [ ] **Datos y capa gratuita:** en la capa gratuita de Gemini, Google marca lo
      enviado como «usado para mejorar sus productos». Antes de pasar por Elly
      cédulas (OCR), cartas de estudiantes o notas reales, activar facturación o
      decidir qué flujos esperan. El límite gratuito (pocas peticiones por
      minuto) dará 429 con varios usuarios a la vez: el chat avisa y las cartas
      quedan retenidas hasta «Volver a revisar».
- [x] Cliente de Gemini probado en vivo con la clave real (`scripts/probar-gemini-vivo.ts`,
      solo texto inventado): chat, llamada forzada (cartas) y flujo funcionan con
      `gemini-3.1-flash-lite`. Los Flash grandes daban 503 por demanda ese día.
- [ ] Falta probar en vivo el bucle de herramientas con aprobación y el OCR con
      un documento real; y confirmar en AI Studio que el proyecto de la clave
      está en el nivel de **pago** (entonces Google no usa lo enviado para mejorar
      sus productos; en el gratuito sí).
- [ ] Poner `GEMINI_API_KEY` y `GEMINI_MODEL` en las variables de entorno de
      Vercel (cuenta personal) y redesplegar.

- [x] Elly AI admite **OpenAI** además de Gemini (`src/lib/openai*.ts`,
      `modelo-ia.ts`, variable `IA_PROVEEDOR`). Probado con respuestas simuladas
      (`node --test scripts/probar-openai.mjs`). **En vivo no funcionó:** la cuenta
      de OpenAI respondió `credit_balance_exhausted` (la API de OpenAI no es
      gratis; hay que cargar saldo). Mientras tanto queda activo Gemini.
- [ ] Para usar OpenAI: cargar saldo en la cuenta, poner `IA_PROVEEDOR=openai` y
      correr `npx tsx scripts/probar-modelo-vivo.ts`. Para cambiar de proveedor
      en Vercel basta cambiar esa variable y redesplegar.

- [x] Elly AI admite **Groq** (plan gratuito) como tercera opción: reutiliza el
      adaptador de Chat Completions (`src/lib/openai-cliente.ts` ahora es una
      fábrica) con otra dirección, clave (`GROQ_API_KEY`) y modelo
      (`llama-3.3-70b-versatile`). Selección probada en los cinco casos de
      configuración.
- [x] Groq probado en vivo (19 nov): chat, llamada forzada y flujo funcionan con
      `openai/gpt-oss-120b` (`llama-3.3-70b-versatile` ya no existe en la cuenta:
      404). Falta comprobar los límites del plan gratuito y cómo trata Groq los
      datos enviados.
- [ ] Groq no lee PDF y para imágenes necesita `GROQ_MODEL_VISION`; sin eso el OCR
      responde «ilegible» y se captura a mano.

- [x] **Respaldo entre proveedores:** `IA_PROVEEDOR` es una lista ordenada
      (`groq,openai`); si el primero falla, se prueba el siguiente
      (`src/lib/respaldo.ts`, probado con proveedores falsos y en vivo). En un
      flujo, si ya salió texto no se cambia a mitad. El modelo que respondió se
      guarda en el medidor de uso.
- [ ] OpenAI sigue sin saldo: en la cadena `groq,openai` solo actúa como respaldo
      cuando Groq falla, y fallará con `sin_clave` hasta cargar crédito.
- [ ] Poner en Vercel las variables de `.env.vercel` (IA, secretos de cartas y las
      de Supabase), borrar ese archivo y redesplegar.

- [x] Mapa del sitio rehecho como buscador «¿Dónde está…?» con «cómo llegar»,
      ajustes de Configuración incluidos y menús por rol plegables; las cartas a
      patrocinadores entran al menú de Patrocinadores (`src/server/mapa-sitio/`,
      `src/components/sitemap/`). Probado con los menús reales; falta verlo en
      pantalla.
- [x] Voz de Elly AI: dictar (micrófono), conversación por voz y leer respuestas
      (`src/lib/voz.ts` probado con `node --test scripts/probar-voz.mjs`;
      `use-voz.ts` y `controles-voz.tsx` en el widget y en `ChatIA`).
- [ ] **Voz sin probar en un navegador real:** hay que probar el micrófono (permiso,
      es-DO), la lectura (voces del equipo, trozos largos) y el modo conversación
      en Chrome/Edge/Safari. Firefox no dicta. El audio dictado lo procesa el
      servicio de voz del navegador (en Chrome, Google): decidir si es aceptable
      con estudiantes. Alternativa para Firefox y privacidad: transcribir en el
      servidor con Whisper de Groq (la cuenta ya lo tiene).
- [ ] Contabilidad puede abrir `/configuracion/conocimiento` para su agente, pero no
      hay entrada en su menú que lo muestre.

- [x] Detalle del expediente reorganizado en pestañas por tipo de información, con
      **grupo** (migración `0094`), **tiempo en la Fundación** (`src/lib/antiguedad.ts`,
      probado con `node --test scripts/probar-antiguedad.mjs`), récord de notas por
      período, pénsum/graduación, seguimiento mensual, historial de etapas y
      patrocinio. Datos probados contra la base real.
- [x] Patrocinadores, becas y expedientes enlazados: ficha del patrocinador
      (`/patrocinadores/[id]`) con sus estudiantes, y enlaces lista → ficha, becas →
      expediente/patrocinador y expediente → patrocinador.
- [ ] **Pénsum y fecha de graduación siguen a medias** hasta construir la fase 2 (catálogo
      universidad → carrera → pénsum, no necesita documentos) y la 4 (OCR). La
      graduación se deduce del historial de etapas: los egresados anteriores al
      registro de etapas salen «sin fecha registrada».
- [ ] Confirmar qué es el **grupo** (cohorte de Habitudes o generación de la beca) y
      asignarlo a los expedientes existentes; mostrarlo y filtrarlo en la lista.
- [ ] El detalle del expediente no se ha visto en pantalla (solo `tsc`, `build` y las
      consultas contra la base): revisar pestañas, espaciados y móvil.

## Catálogo de cuentas editable (24 nov 2026)

- Cerrado: en Configuración contable → Catálogo, «Editar» cambia nombre, código (renumera la rama), tipo (solo cuentas principales; las hijas lo heredan) y si recibe asientos; «Nueva cuenta principal» crea rubros de primer nivel. Código/tipo/movimiento solo en cuentas sin asientos y sin nada que las use (`editarCuenta`, `crearCuentaRaiz`).
- Abierto: reportes, nómina y cierre buscan cuentas por código fijo (p. ej. `3.1.01.02`, `5.2.01.09`). Cambiar el código de una cuenta sin asientos que ellos esperan los rompería; falta una marca `de_sistema` que bloquee esas cuentas.
- Abierto: los botones solo salen con `contabilidad.configurar` (rol `contabilidad`); `super_admin` queda en lectura por separación de funciones.

## Gantt unificado con SVAR (24 nov 2026)

- Cerrado: `LineaTiempo` propia reemplazada por `GanttBase` (`src/components/ui/gantt-base.tsx`); estándar en `docs/estado/estandar-gantt.md`.
- Abierto: no se ha visto en pantalla (solo `tsc`/`eslint`/`audit:ui`/`i18n:check`): revisar tema claro/oscuro, acento negro, arrastre con permiso, tooltip y móvil. El tooltip de SVAR podría salir fuera del tema si la librería lo monta en un portal del `body`.

## Estándar de gráficos, calendarios y Gantt (24 nov 2026)

- Cerrado: capa común de gráficos, FullCalendar y SVAR Gantt en lugar de las tres implementaciones propias (`event-manager` y `linea-tiempo` eliminados). Pasan tsc, lint, build, i18n y audit:ui.
- Abierto, sin ver en navegador: arrastre y alta en calendario, tooltip y tema del Gantt, vista móvil, contraste del acento negro en modo oscuro, alturas de gráficos.
- Abierto: barra apilada de solicitudes del estudiante sigue a mano; estados vacíos de gráficos muestran el título (faltan claves propias).
- Abierto: auditoría por rol en `docs/estado/auditoria-roles.md` (recorte de menús y formularios, funciones faltantes). El diagrama de comunicación entre módulos y roles va después de ese recorte.

- Rediseño de gráficos (24 nov 2026): barras en píldora con pista y cifra, anillo redondeado, área suave; `Progress` más grueso, barra apilada de solicitudes con segmentos separados y contador de biografía sobre `Progress`. Sin ver en navegador con sesión.

## Informes 01–03 de coherencia, UX y funcionamiento (24 nov 2026)

Fuente: `01-coherencia-roles-permisos.md`, `02-ux-ui-por-rol.md`, `03-funcionamiento-animaciones-coherencia.md`. Auditaron el sitio desplegado; cada hallazgo se contrastó con el código antes de aplicarlo.

- [x] **Hoy en UTC (03 §1.1):** `claveDia()`/`claveMes()` sin argumento y todo `CURRENT_DATE` de `src/` usan la hora de la Fundación (`America/Santo_Domingo`). Helpers `diaEnRD`/`horaEnRD` en `src/lib/fechas.ts`. En la base `now()::date` ya era el 25 cuando en La Vega era el 24.
- [x] **Eventos internos al estudiante (03 §1.2):** migración `0108` agrega `evento.audiencia` (`todos`/`estudiantes`/`personal`); lo nacido de una tarea o administrativo pasa a `personal` y las consultas del estudiante y de la landing filtran. `0108` aplicada en la base (24 nov 2026).
- [x] **Rendir gastos sin enlace (01 §2.10):** Rendiciones en el menú de docente, facilitador y director de Habitudes, con `rendicion.enviar`.
- [x] **Asignación de materias en el menú del docente (01 §2.4):** ya apunta a sus clases (P0 del informe QA).
- [ ] Contrastado y NO aplicado, por decisión pendiente: Admin y Clases 360/Subir calificaciones (01 §2.1–2.2; hoy admin las coordina), super_admin sin Mi día/Cierre/Rendiciones (01 §2.11, es la separación de funciones), segregación contable (01 §3.1–3.3), rol `psicologia` (01 §3.4: **prohibido por CLAUDE.md regla 8**), «Ver como persona» (01 §5), chofer con `rendicion.enviar` (01 §2.8).
- [ ] Sin tocar: nombres de roles únicos y `ROLE_LABELS` (01 §4), rutas sin convención y redirects (01 §6), UX transversal y por rol (02 completo), mapas Leaflet sin teselas, contadores contradictorios de Bandeja, enlace de «Entregas esperando nota», datos de prueba «xvc bc», rendimiento y miniaturas, tokens de movimiento y microinteracciones, `PageHeader`/`ExportMenu` (03 §1.3–§4).

- [x] **Mapas Leaflet sin teselas (03 §1.3):** `ResizeObserver` que llama a `invalidateSize()` en `mapa-la-vega-cliente.tsx` (el de transporte ya lo tenía).
- [x] **Recursos de Habitudes (03 §1.5):** el título pide al menos 5 caracteres. El recurso «xvc bc» no era basura (PDF real del equipo, con categoría): solo falta renombrarlo desde la galería.
- [x] **Bandeja de entregas por calificar del docente (24 nov 2026):** `/portal/profesor/entregas` junta las entregas pendientes de todas sus clases (universitarias y 360), agrupadas por tarea, con nota y comentario en línea (reusa `calificarEntregaMoodleAction`); entrada «Entregas por calificar» en su menú. Falta probarla con sesión de docente. La tarjeta «Entregas esperando nota» de la Bandeja de `admin` sigue enlazando a Clases 360 y no aplica a quien no califica (01 §2.2).
- [ ] **Contadores de Bandeja (03 §1.4):** no se pudo confirmar sin datos reales; comparar la consulta de «Mis tareas por estado» con la de «Tareas por hacer».

- [x] **Semáforo de beca del estudiante (informe QA P1, 25 nov 2026):** tarjeta «Mi beca» en su inicio (`semaforo-beca.tsx`): índice contra el mínimo, servicio del mes y reunión del mes, con veredicto (al día / pendiente / en riesgo) y icono por nivel. El mes en curso sin servicio es «pendiente», no «en alerta». Usa el mínimo global `becas.indice_minimo`; falta usar el de la universidad (`umbralesDeUniversidad`) y mostrar horas de servicio si se llegan a registrar (hoy solo hay hizo/no hizo).

- [ ] **Explicar cómo se calcula el índice (pendiente del usuario, 25 nov 2026):** (1) el índice en cada universidad y (2) el índice del récord de notas del liceo para los candidatos reclutados. Hasta entonces, el semáforo de beca usa el mínimo global y no se toca `indice_estudiante()`.

## Auditoría de coherencia roles-módulos (25 nov 2026)

Fuente: `auditoria-coherencia-roles-modulos.md`. Contrastada con el código.

- [x] **Chofer:** `rendicion.enviar` (migración `0109`, aplicada), menú con Rendiciones y Reuniones, sin Torre de control ni Calendario corporativo.
- [x] **`admin` ya no elimina expedientes** (0109): solo `super_admin`.
- [x] **Torre de control fuera del menú** de docente, facilitador, director de Habitudes, contabilidad y chofer (la ruta sigue abierta por permiso). Riesgo conocido: el comentario viejo del chofer decía que era por donde le llegaban las tareas asignadas; si hace falta, mostrar las asignadas en la campana o en su panel.
- [x] **Director de Habitudes** con su propio menú (`MENU_DIR_HABITUDES`, «Supervisión de Habitudes»). Es solo el nombre: aún no hay pantallas propias de métricas por liceo.
- [x] Ya estaban: compra fuera del estudiante, icono, Materias del docente, bandeja de entregas, semáforo de beca, comida en el menú. «Marcar todos presentes» ya existía (`asistencia-clase-360.tsx`, también en materias): el hallazgo estaba desactualizado.
- [ ] Sin tocar, requiere decisión: `reuniones.agendar` del estudiante; invitados en el bus sin aprobación; facilitador sin `expedientes.leer` (no ve el estado de sus candidatos); `/academias/*` exige `academico.leer`, que Habitudes no tiene; embudo de talento con visto bueno del director; descuento del comedor por falta en la guagua; rendición ligada a solicitud aprobada; imputación de gasto por estudiante; tablero ejecutivo del `super_admin`; admin con área Finanzas en solo lectura (el `super_admin` y `admin` ven los mismos módulos contables).

## Pendientes: bandeja, tareas y torre de control fusionadas (25 nov 2026)

- Un solo módulo «Pendientes» en `/bandeja` con `?tab=decidir|tareas|equipo` (`&vista=tablero` en tareas, `&usuario=<id>` en equipo). Código en `src/components/bandeja/pestana-*.tsx`.
- `/administrativo/tareas`, `/tareas/hoy`, `/torre-control` y `/torre-control/equipo` redirigen a la pestaña correspondiente.
- Menú de administración: una entrada «Pendientes»; fuera Tareas, Mi torre de control y Torre del equipo.
- Cerrado: la torre propia (estadísticas y proyectos de uno mismo) ya no existe aparte; «Mi día» la cubre.
- Por limpiar: `tareas-bandeja*.tsx` ya no se usan en la bandeja (las tareas viven en «Mis tareas»).

## Decisiones de Dirección sobre la auditoría de coherencia (25 nov 2026)

- [x] Estudiante sin `reuniones.agendar` (0110, aplicada). Lo demás de esa lista quedó **como está por decisión**: invitados en el bus, candidatos del facilitador sin estado, páginas de Academia de Liderazgo.
- [x] Comedor y transporte NO se acoplan: solo Rincón, Jima, Ranchito, Saba Rey y Rancho Viejo usan la guagua a UCATECI.
- [x] Rendición ligada a solicitud aprobada y a estudiante opcional (0111, aplicada). Las anteriores quedan con solicitud NULL.
- [x] Costo por estudiante, fases 1, 4 y 5 (0112, aplicada): pestaña «Costos» y reporte con Excel. Falta la fase 3 (pantalla para materiales y transporte; prorrateo del transporte solo entre los inscritos de esas cinco zonas).
- [x] Tablero ejecutivo `/ejecutivo` (super_admin) y fusión de Bandeja, Tareas y Torre de control en «Pendientes» (`/bandeja`).
- [ ] Sin definir: embudo de talento de Habitudes con visto bueno del director.

- [x] **Mínimo del promedio del liceo configurable (25 nov 2026):** parámetro `becas.promedio_liceo_minimo` = 89 (escala 100) en `src/lib/parametros.ts`, editable en Parámetros y citado en el reglamento del asistente. Aún no hay campo del promedio del liceo en el expediente del candidato ni validación: se construye cuando se sepan las cuatro materias principales.
- [ ] **Por entregar (usuario):** las cuatro materias principales del récord del liceo y los años que cuentan; los «otros factores» para recomendar carrera; y cómo se calcula el índice en cada universidad (sin responder todavía). Ver `docs/estado/por-entregar.md`.

## Códigos de transacción en todos los módulos (25 nov 2026, migraciones 0115–0120)

- [x] Todos los procesos que generan asientos usan códigos y tienen la opción «Asiento»; el selector del catálogo es un buscador. Guía en [`docs/referencia/codigos-de-transaccion.md`](../referencia/codigos-de-transaccion.md).
- [ ] **La contadora debe crear cuentas de detalle en el catálogo y asignarles códigos** (sin esto los procesos se detienen con «código sin cuenta» y «Asiento» lo muestra): cuentas por pagar de proveedores (`PROV_CXP_FACTURA`, `PROV_PAGO_CXP`), ISR e ITBIS retenidos por pagar (`PROV_*_RETENIDO_X_PAGAR`, `NOM_ISR_X_PAGAR`, `CALC_FACTURA_*`), existencias y consumo de inventario (`INV_*`), depreciación gasto y acumulada (`AF_*`), sobrante de caja (`CAJ_ARQUEO_SOBRANTE`) y donaciones en especie (`DON_ESPECIE_*`). Hay que decidir si `CALC_FACTURA_*` y `PROV_*` van a las mismas cuentas.
- [ ] `registrarDonacion` solo exige sesión (la regla 4 pide permiso).
- [ ] `revertir_asiento` usa `CURRENT_DATE` (regla 12): corregir en una migración aparte.
- [ ] Decidir si compras, donaciones y ajustes de inventario y el alta y baja de activos fijos generan asiento (hoy no). Falta el botón para aplicar una toma física (`aplicarConteoFisico`).
- [ ] Decidir si el cierre anual debe pasar por «resultado del ejercicio» (3.1.1) antes de acumulados. Comisiones e intereses bancarios no generan asiento hoy.
- [ ] Columnas sin uso que se pueden retirar: `articulo.cuenta_inventario_id`/`cuenta_gasto_id` y `activo_categoria.cuenta_*_depreciacion_*`.
- [ ] Textos fijos en español sin i18n en los diálogos de inventario, activos, fondos, donaciones y cierre.
- [ ] Probar en el navegador con sesión de contabilidad los botones «Asiento» (incluida la vista móvil) y aprobar y pagar una nómina, factura o recibo reales.
