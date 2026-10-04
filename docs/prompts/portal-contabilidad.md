# Portal de Contabilidad — especificación y prompts por fases

> **Para:** Claude Code (y Antigravity, si toma alguna fase).
> **Escrito:** 2026-10-04, sobre `main` en el commit `cca04bf` ("Global Effect Nexus v2 — estado inicial limpio").
> **Cómo usar este archivo:** primero lee las secciones 0 a 4, que son la norma del módulo. Después ejecuta las fases de la sección 5 **en orden**, una rama y un PR por fase. No pases a la siguiente fase sin tener la anterior en verde (`lint`, `build`, `i18n:check`, `audit:ui` y las pruebas de la fase).
> **Diseño:** toda pantalla nueva sigue `docs/09-sistema-visual.md`. Aquí no se repite esa norma.

---

## 0. Qué hay hoy (punto de partida)

| Pieza | Estado | Qué hacemos con ella |
|---|---|---|
| Tabla `transaccion` (`0011_finanzas.sql`) | Ingresos y egresos con monto **solo en USD**, categoría en texto libre, sin banco, sin proveedor y sin adjuntos | Se **migra** a los libros de banco (Fase 2) y queda como vista de compatibilidad hasta retirarla |
| `/contabilidad` y `/portal/contabilidad` | CRUD básico de transacciones y el resumen del mes | Se reemplazan por el portal nuevo |
| Rol `contabilidad` | Tiene `finanzas.leer`, `finanzas.escribir` y `patrocinadores.leer` | Se queda y recibe permisos más finos |
| `super_admin` | Tiene `finanzas.escribir` | **Pierde la escritura** y gana la auditoría (sección 2) |
| `audit_log` (`0003`) | Hay que llamar `registrar()` a mano en cada acción; no es inmutable; no guarda el antes/después de forma sistemática | Se sustituye **para contabilidad** por una bitácora a nivel de base de datos (sección 3) |
| `proyecto` (`0009`) | Sin presupuesto | Se le cuelga el presupuesto desde contabilidad (Fase 6) |
| `server/calendario/gantt.ts` + `components/calendario/event-manager.tsx` | El Gantt ya existe para operaciones | Se **reutiliza** para cuentas por pagar |
| `solicitud` (`0031`) | Ya existe aprobación en dos niveles (los gastos grandes los aprueba dirección) | Cuando se aprueba una solicitud de gasto, se crea la **cuenta por pagar** (Fase 3) |

---

## 1. Decisiones de arquitectura (no se discuten en cada fase)

1. **El mismo login para todos.** No hay un login de contabilidad aparte. Tras entrar, el rol `contabilidad` cae en `/portal/contabilidad` y su barra lateral **solo** muestra el área Contabilidad y su Perfil. El resto de los roles no ve el área ni entra por URL (`requerirPermiso` en cada `page.tsx` y en cada server action).
2. **Un esquema propio de Postgres: `contabilidad`.** Todas las tablas del módulo viven en `contabilidad.*` y no en `public`. Hay tres razones:
   - Supabase no expone por PostgREST un esquema que no se haya publicado. El dinero queda fuera de la API pública aunque alguien filtre la llave `anon`.
   - Los disparadores de bitácora se aplican a todo el esquema de una sola vez.
   - Se evitan choques de nombres con tablas que ya existen (`proyecto`, `documento`, `tarea`).
3. **Moneda funcional: pesos dominicanos (DOP).** Los libros se llevan en la moneda de cada cuenta (DOP o USD). Cada movimiento en USD guarda la **tasa del día** y su equivalente en DOP. Los reportes oficiales salen en DOP y los reportes a donantes pueden salir en USD. Montos en `NUMERIC(14,2)` y tasas en `NUMERIC(12,4)`. **Nunca se usa `float`.**
4. **Partida doble por debajo, interfaz simple por encima.** El contable registra recibos, pagos, facturas y nómina. Cada una de esas operaciones **genera sola su asiento contable** (débito = crédito, validado en la base). Solo los asientos manuales los escribe una persona, con un permiso especial. Así salen el balance y el estado de resultados sin pedirle a nadie que piense en débitos y créditos, y además un descuadre se nota al instante.
5. **Contabilidad por fondos.** Cada movimiento lleva **proyecto/fondo** y, si aplica, el **patrocinador/donante**. Sin eso no se puede hacer el dashboard de presupuestos ni rendir cuentas a los donantes.
6. **En contabilidad nada se borra.** No hay `DELETE` en ningún registro contable. Lo que está mal se **anula**: el registro conserva su número, cambia a estado `anulado` y se le obliga a llevar un motivo. Si ya generó asiento, se genera el contra-asiento. Un período **cerrado** no admite cambios, solo ajustes con fecha del período abierto.
7. **Numeración secuencial sin huecos** para recibos de ingreso, comprobantes de egreso, pagos, cheques y arqueos. La genera la base (una tabla `secuencia` con `SELECT … FOR UPDATE`), nunca el cliente. Un hueco en la numeración es una alarma de auditoría.
8. **Bancos multibanco desde el día uno.** Banco Múltiple Santa Cruz es el primer registro de la tabla `banco`, no un valor cableado en el código. Lo específico de cada banco (formato del estado de cuenta y formato del archivo de pago de nómina) vive en un **adaptador** (`src/server/contabilidad/bancos/<banco>.ts`) que implementa una interfaz común.
9. **Los parámetros legales tienen fecha de vigencia.** Tasas de la TSS, topes, escala del ISR, salario mínimo cotizable y porcentajes de retención viven en `contabilidad.parametro` con `vigente_desde` y `vigente_hasta`. El cálculo usa el parámetro vigente **en la fecha del período**, nunca el de hoy. Ejemplo real: la escala del ISR cambia en 2027 por la Ley 30-26, y las nóminas de 2026 tienen que seguir calculándose con la de 2026.

---

## 2. Acceso y permisos

### 2.1 Permisos nuevos (reemplazan a `finanzas.*` dentro del módulo)

| Permiso | Qué permite |
|---|---|
| `contabilidad.leer` | Ver todo el portal contable |
| `contabilidad.registrar` | Crear y editar borradores: recibos, facturas, movimientos, cajas |
| `contabilidad.aprobar` | Pasar de borrador a contabilizado, emitir pagos y anular con motivo |
| `contabilidad.conciliar` | Conciliar bancos y cerrar arqueos de caja |
| `contabilidad.nomina` | Ver salarios, calcular y pagar la nómina. **Es el dato más sensible**, por eso va aparte |
| `contabilidad.configurar` | Manejar bancos, cuentas, catálogo, parámetros legales y cajas |
| `contabilidad.cerrar_periodo` | Cerrar y reabrir períodos (reabrir exige motivo y queda en la bitácora) |
| `contabilidad.asiento_manual` | Escribir asientos manuales |
| `contabilidad.auditar` | Ver la bitácora completa, en **solo lectura**, y verificar su integridad |

### 2.2 Quién tiene qué

| Rol | Permisos |
|---|---|
| `contabilidad` | Todos menos `contabilidad.auditar` |
| `super_admin` | **Solo `contabilidad.leer` + `contabilidad.auditar`.** Puede ver qué pasó y quién lo hizo, pero **no puede editar**. Quien audita no opera: es separación de funciones, y es justo lo que protege a la Fundación ante un fraude. |
| Los demás | Nada |

Hay que dejarlo preparado por si mañana hay un auxiliar contable. Por eso los permisos se resuelven **por usuario**: primero los del rol y después las excepciones de `usuario_permiso` (concedido o revocado). Un auxiliar podría tener `registrar` sin `aprobar`, y así nadie aprueba lo que él mismo registró. La regla **"quien registra no aprueba"** queda escrita en las server actions: si `aprobado_por = creado_por`, la acción se rechaza, salvo que la cuenta sea la única con el permiso (en ese caso se deja constancia en la bitácora).

Esto se refleja en la base (`permiso`, `rol_permiso`, nueva `usuario_permiso`) y en `src/lib/rbac.ts`, **en el mismo commit**. Así lo pide el comentario de `rbac.ts`.

---

## 3. Bitácora antifraude (por persona, no por rol)

Es el corazón del módulo y se construye **antes** que cualquier pantalla.

1. **Se captura en la base, no en la app.** Hay un disparador `AFTER INSERT OR UPDATE OR DELETE` en **cada** tabla de `contabilidad.*` que escribe en `contabilidad.bitacora`. Aunque alguien entre por SQL directo, el cambio queda registrado.
2. **Quién lo hizo.** `enTransaccion` recibe el usuario y ejecuta `SELECT set_config('app.usuario_id', $1, true)`, junto con `app.ip`, `app.agente` y `app.sesion`, antes del trabajo. El disparador los lee con `current_setting(..., true)`. **Si `app.usuario_id` viene vacío, el disparador aborta la transacción**: en contabilidad no existe la escritura anónima. Las migraciones y los seeds usan un usuario de sistema explícito.
3. **Qué se guarda en cada fila de la bitácora:** id; fecha y hora con zona; usuario_id; nombre y correo **copiados en ese momento** (por si después se renombra o se desactiva la cuenta); rol en ese momento; acción (`crear`, `editar`, `aprobar`, `anular`, `pagar`, `conciliar`, `cerrar_periodo`, `reabrir_periodo`, `exportar`, `ver_nomina`, `login`); tabla; registro_id; `antes` (jsonb); `despues` (jsonb); `campos_cambiados` (text[]); motivo; IP; agente de usuario; sesión; `hash_anterior`; `hash`.
4. **Es inmutable.** `REVOKE UPDATE, DELETE, TRUNCATE` sobre `contabilidad.bitacora` para el rol de la app, y además un disparador `BEFORE UPDATE OR DELETE` que lanza una excepción.
5. **Se nota si alguien la manipula.** Las filas forman una cadena de hash: `hash = sha256(hash_anterior || fila_canónica)`. La cadena se calcula dentro del disparador, con un bloqueo consultivo para que no se intercale. Una función `contabilidad.verificar_bitacora(desde, hasta)` recorre la cadena y devuelve la primera fila rota. El auditor tiene un botón **"Verificar integridad"**.
6. **También se registran las lecturas sensibles,** no solo los cambios: abrir la nómina o el volante de un empleado, exportar cualquier reporte o archivo, y descargar adjuntos. Esto lo hace la app con `registrarLectura()`, porque la base no ve las lecturas.
7. **El visor del auditor** (`/configuracion/auditoria/contabilidad`, solo `contabilidad.auditar`) tiene:
   - Una línea de tiempo filtrable por **persona**, fecha, acción, módulo, registro y monto.
   - Una **vista por persona**: todo lo que hizo un usuario en un rango, con un resumen (cuántos registros creó, aprobó y anuló, cuánto dinero movió).
   - Una **vista por registro**: el historial completo de un recibo o un pago, con un *diff* campo por campo entre `antes` y `despues`.
   - **Alertas automáticas** (tabla `contabilidad.alerta`, calculada por una función y mostrada en el dashboard del auditor):
     - Huecos en la numeración.
     - Registros anulados después de haberse pagado.
     - Una misma persona registra y aprueba.
     - Cambios de cuenta bancaria de un proveedor seguidos de un pago en menos de 7 días.
     - Pagos fuera del horario habitual.
     - Reapertura de período.
     - Diferencias de caja por encima del umbral.
     - Proveedor y empleado con la misma cuenta o la misma cédula.
     - Facturas duplicadas (mismo NCF y RNC).
   - Exportar a Excel y PDF con la verificación de integridad incluida en el pie.

---

## 4. Módulos del portal

Las rutas van en `src/app/[locale]/(portal)/contabilidad/…`, las consultas y acciones en `src/server/contabilidad/<modulo>/{consultas,acciones}.ts` y los componentes en `src/components/contabilidad/<modulo>/`.

### 4.1 Inicio / Dashboard — `/portal/contabilidad`
- Saldo por cuenta bancaria, en su moneda y en su equivalente en DOP.
- Cuentas por pagar que vencen en 7 y en 30 días.
- Estado de cada caja (abierta o cuadrada, y su fondo disponible).
- Ejecución presupuestaria de los proyectos activos.
- Próximas obligaciones fiscales.
- Tareas pendientes del departamento.

### 4.2 Bancos y libros de banco — `/contabilidad/bancos`, `/contabilidad/bancos/[cuenta]`
- Tablas `banco` (Santa Cruz como primer registro) y `cuenta_bancaria` (banco, número enmascarado en pantalla, tipo, **moneda DOP/USD**, cuenta contable, saldo inicial y su fecha, estado).
- Arranque con **dos libros**: Santa Cruz **USD** y Santa Cruz **DOP**. Agregar otro banco u otra cuenta se hace en Configuración y no requiere código, salvo el adaptador si se quiere importar el estado de cuenta.
- El **libro de banco** de cada cuenta registra depósitos, cheques (número, beneficiario y estado: emitido, entregado, cobrado o anulado), transferencias enviadas y recibidas, débitos y créditos bancarios y comisiones. Se muestra con saldo corrido, filtros y totales del período.
- **Transferencia entre cuentas propias:** genera dos movimientos enlazados. Si las monedas son distintas, guarda la tasa aplicada y la diferencia cambiaria.
- **Conciliación bancaria:** se importa el estado de cuenta (CSV o Excel; el adaptador de Santa Cruz traduce sus columnas), el sistema propone emparejamientos por monto, fecha ±3 días y referencia, el contable confirma, y sale el reporte de conciliación (saldo según banco, partidas en tránsito y saldo según libros). Una conciliación cerrada bloquea los movimientos que incluye.
- **Tasa de cambio:** tabla `tasa_cambio` (fecha, compra, venta, fuente). Se captura a mano o se importa. **Fuente sugerida: la tasa del Banco Central (BCRD).**

### 4.3 Recibos — `/contabilidad/recibos`
- Hay un solo módulo con **dos tipos**: **recibo de ingreso** (donaciones, aportes y otros ingresos) y **comprobante de egreso**. Los egresos aparecen en la misma consulta que los recibos, que es lo que se pidió.
- Campos:
  - número secuencial por tipo;
  - fecha;
  - cuenta bancaria o caja;
  - moneda y tasa;
  - monto;
  - concepto;
  - categoría contable;
  - proyecto/fondo;
  - patrocinador (en los ingresos) o proveedor/beneficiario (en los egresos);
  - forma de pago (efectivo, cheque, transferencia o tarjeta);
  - referencia;
  - adjuntos;
  - estado: `borrador → contabilizado → anulado`.
- **PDF imprimible** con la marca de la Fundación, el monto en letras (en español, en DOP y en USD), las firmas de "Preparado por" y "Recibido por" y un código QR que apunta a la verificación interna.
- **Consulta con filtros:** rango de fechas, tipo, número, libro de banco o caja, proyecto, categoría, proveedor/patrocinador, rango de monto, moneda, estado y **creado/aprobado por**. Se puede exportar.
- Un egreso que paga una factura de proveedor se crea **desde** la cuenta por pagar (4.5) y queda enlazado a ella.

### 4.4 Proveedores — `/contabilidad/proveedores`
- Ficha del proveedor:
  - tipo (persona física o jurídica);
  - **RNC o cédula**, con validación del dígito verificador;
  - nombre o razón social;
  - contactos;
  - **cuentas bancarias** (banco, tipo, moneda y número, con historial de cambios: cada cambio de cuenta queda en la bitácora y dispara una alerta);
  - condiciones de pago en días;
  - categoría;
  - estado.
- Facturas del proveedor:
  - **NCF o e-CF** (se valida el formato: 11 caracteres `B…` o 13 caracteres `E…`, y que no se repita para el mismo RNC);
  - fecha de emisión;
  - **fecha de vencimiento**;
  - subtotal, ITBIS y retenciones (ISR e ITBIS);
  - total;
  - moneda;
  - proyecto;
  - adjunto con la factura escaneada.
- **Estado de cuenta del proveedor:** facturas, pagos y saldo.
- Si el proveedor es una persona física sin comprobante, el sistema avisa que hay que emitir un **comprobante de compras** y aplicar las retenciones que correspondan, según los parámetros de la sección 1.9.

### 4.5 Cuentas por pagar + Gantt — `/contabilidad/cuentas-por-pagar`, `…/gantt`
- Cada factura aprobada, o cada **solicitud de gasto aprobada** que venga del módulo de Solicitudes, crea una cuenta por pagar con estado `pendiente → programada → pagada parcial → pagada` (o `anulada`).
- **Programación de pagos:** fecha prevista y cuenta bancaria de salida.
- **Gantt:** se reutiliza el componente de `server/calendario/gantt.ts`. Cada barra va de la emisión al vencimiento, con un marcador en la fecha programada. Se agrupa por proveedor o por proyecto. Lo vencido se distingue con `SEMAFORO` + icono.
- Lista de **antigüedad de saldos**: 0-30, 31-60, 61-90 y más de 90 días.
- Al pagar se genera el comprobante de egreso (4.3) y el movimiento en el libro de banco (4.2), en **una sola transacción**.

### 4.6 Nómina — `/contabilidad/nomina` (permiso `contabilidad.nomina`)
- Ficha del empleado:
  - persona y cédula;
  - vínculo opcional con su `usuario`;
  - departamento;
  - cargo;
  - fecha de ingreso;
  - salario y su moneda;
  - frecuencia (quincenal o mensual);
  - cuenta bancaria para el pago;
  - AFP y ARS;
  - estado.
- **Período de nómina:** se crea el período, el sistema calcula y el contable revisa y ajusta las novedades (horas extra, bonos, descuentos y préstamos). Luego se aprueba (quien aprueba no puede ser quien la calculó, si hay dos personas), se genera el archivo de pago y se marca como pagada.
- **Cálculo:**
  - **Aportes del empleado a la TSS:** AFP 2.87 % y SFS 3.04 %, cada uno hasta su tope.
  - **Aportes del empleador:** AFP, SFS, SRL e INFOTEP.
  - **Retención del ISR** con la escala anual vigente en el período.
  - **Topes TSS desde el 1 de febrero de 2026:** SVDS/AFP RD$464,460.00, SFS RD$232,230.00, SRL RD$92,892.00; salario mínimo cotizable RD$23,223.00.
  - **Escala del ISR 2026:** exento hasta RD$416,220; 15 % hasta RD$624,329; 20 % hasta RD$867,123; 25 % por encima. **Desde 2027 (Ley 30-26):** exento hasta RD$480,000; 15 % hasta RD$685,000; 20 % hasta RD$910,000; 25 % hasta RD$4,800,000; 27 % por encima.
  - Todo esto se **siembra como parámetros con vigencia** y **el contador de la Fundación lo valida** antes de la primera nómina real.
  - **Las tasas del empleador** (AFP, SFS, SRL según la categoría de riesgo, e INFOTEP) se cargan con el valor que confirme el contador; **no se escriben en el código**.
- **Regalía pascual** (salario de Navidad), **vacaciones** y **liquidaciones** van como tipos de período distintos. Las liquidaciones se dejan para una segunda iteración, solo con la estructura preparada.
- **Salidas del módulo:**
  - volante de pago por empleado, en PDF;
  - resumen de la nómina;
  - **asiento automático**;
  - **archivo de pago al banco**, generado por el adaptador del banco;
  - datos de apoyo para la **autodeterminación de la TSS** y para el **IR-3**.
- **Archivo de pago de Santa Cruz:** el formato exacto **no es público**. Se pide al banco el layout del servicio de pago de nómina para empresas. Mientras no esté, el adaptador produce un CSV genérico (cédula, nombre, cuenta, monto, referencia) y un TODO visible en Configuración que diga "Formato oficial pendiente". **No se inventa un layout.**

### 4.7 Cajas y cuadre de caja — `/contabilidad/cajas`
- **Varias cajas:** `caja` tiene nombre, **responsable (persona)**, **departamento**, moneda, fondo fijo, cuenta contable y estado. Puede haber una caja por persona o una por departamento.
- **Movimientos:** vales y gastos con soporte (adjunto obligatorio a partir de un monto), ingresos y **reposición** (desde un libro de banco, con el comprobante de egreso enlazado).
- **Arqueo (cuadre):** conteo por denominación (billetes y monedas de DOP; USD si la caja es en dólares), saldo según el sistema, saldo contado, **diferencia**, justificación obligatoria si hay diferencia, y firma del responsable y de quien revisa. Un arqueo cerrado bloquea los movimientos anteriores. Las diferencias por encima del umbral generan una alerta (sección 3).
- Historial de arqueos por caja y por responsable.

### 4.8 Proyectos con presupuesto — `/contabilidad/proyectos`
- Se enlaza con `public.proyecto`, sin duplicarlo: `contabilidad.presupuesto` (proyecto, fondo o donante, moneda, período) y `presupuesto_partida` (categoría, monto aprobado).
- **Dashboard:**
  - aprobado, **comprometido** (cuentas por pagar pendientes), **ejecutado** (pagado) y disponible, por proyecto y por partida;
  - porcentaje ejecutado frente a porcentaje de tiempo transcurrido;
  - ranking de desviaciones.
- Se puede ver por donante: qué se hizo con el dinero de cada patrocinador. Eso alimenta la rendición de cuentas.
- Al registrar un gasto que deja una partida sin saldo, el sistema **avisa**, no bloquea, y deja constancia.

### 4.9 Historial de gastos — `/contabilidad/gastos`
- Todos los egresos contabilizados (comprobantes, pagos, caja chica y nómina) en una sola vista, con filtros por fecha, categoría, proyecto, proveedor, persona, libro y moneda.
- Gráficas de tendencia mensual, gasto por categoría y por proyecto, y los proveedores más usados. Se usa la rampa de `SERIE`, sin arcoíris.

### 4.10 Reportes — `/contabilidad/reportes`
- **Por tipo y por libro de banco** (lo que se pidió explícitamente): ingresos y egresos por tipo de operación dentro de cada libro, y comparativo entre libros.
- Libro de banco del período, con saldo inicial y final.
- Estado de ingresos y gastos, balance general y flujo de efectivo, todos salidos de los asientos.
- Ejecución presupuestaria por proyecto y por donante (en DOP o USD).
- Cuentas por pagar y antigüedad de saldos.
- Nómina por período y acumulado anual por empleado.
- Cuadres de caja.
- **Apoyos fiscales:**
  - datos para el **IR-3** y el **IR-17**, los dos mensuales con vencimiento el día 10;
  - retenciones de ITBIS, si aplican (día 20);
  - **formato 606** de compras, para enviar o para control interno;
  - insumos de la declaración anual **ISFL-01** (120 días después del cierre).
  Estas salidas son **exportaciones de datos para que el contador las revise**. El sistema no presenta nada ante la DGII.
- Todo reporte exporta a Excel y PDF, y cada exportación queda en la bitácora.

### 4.11 Archivos — `/contabilidad/archivos`
- Repositorio del departamento sobre Supabase Storage, en un **bucket privado `contabilidad`** con URLs firmadas de corta duración.
- Carpetas automáticas por **año / mes / tipo** (facturas, recibos, estados de cuenta, nómina, declaraciones, contratos) y carpetas libres.
- Cada archivo puede enlazarse a uno o varios registros (factura, pago, conciliación). Se guarda el **hash del archivo** para detectar sustituciones, con versiones, sin borrado (solo archivar), y con un plazo de conservación configurable: **por defecto 10 años, a validar con el contador**.
- Búsqueda por nombre, tipo, fecha y registro enlazado. Vista previa de PDF e imágenes.

### 4.12 Tareas y calendario fiscal — `/contabilidad/tareas`, `/contabilidad/calendario`
- **Tareas del departamento:** se reutiliza `public.tarea` filtrada por el área Contabilidad, con su tablero.
- **Tareas recurrentes** generadas por el sistema:
  - cierre mensual (checklist: conciliar cada cuenta, arqueos, revisar cuentas por pagar, cerrar el período);
  - IR-3 e IR-17 (día 10);
  - ITBIS (día 20, si aplica);
  - pago de la TSS;
  - nómina quincenal o mensual;
  - regalía pascual (antes del 20 de diciembre);
  - ISFL-01 (120 días después del cierre del ejercicio).
- **Calendario fiscal:** esas fechas más los vencimientos de las cuentas por pagar, en el calendario del portal.

### 4.13 Configuración contable — `/contabilidad/configuracion` (permiso `contabilidad.configurar`)
- Bancos y cuentas, adaptadores y formatos, **catálogo de cuentas** (sembrado con un catálogo básico para asociaciones sin fines de lucro, que el contador ajusta), categorías, fondos, cajas, parámetros legales con vigencia, secuencias, umbrales de alerta y períodos contables.

---

## 5. Fases de construcción (prompts listos para pegar)

### Fase 1 — Cimientos: esquema, permisos y bitácora · rama `feat/contabilidad-cimientos`

```text
Lee docs/prompts/portal-contabilidad.md secciones 0 a 3 completas. Construye los cimientos del módulo de contabilidad. NO hagas pantallas de negocio todavía.

1. Migración 0032_contabilidad_esquema.sql:
   - CREATE SCHEMA contabilidad. No lo expongas en la API de Supabase.
   - Tablas base: secuencia (clave, prefijo, siguiente), parametro (clave, valor jsonb, vigente_desde, vigente_hasta, fuente, nota), moneda via CHECK ('DOP','USD'), tasa_cambio, periodo_contable (anio, mes, estado abierto/cerrado, cerrado_por, cerrado_en), cuenta_contable (catálogo jerárquico: codigo, nombre, tipo activo/pasivo/patrimonio/ingreso/gasto, padre, admite_movimiento), fondo, categoria, asiento y asiento_linea (CHECK de que débitos = créditos por asiento, con un CONSTRAINT TRIGGER diferido).
   - Función contabilidad.siguiente_numero(clave) con SELECT … FOR UPDATE, sin huecos.
   - Montos NUMERIC(14,2), tasas NUMERIC(12,4). Comentarios en español explicando cada decisión.
2. Migración 0033_contabilidad_bitacora.sql, implementando la sección 3 al pie de la letra:
   - Tabla contabilidad.bitacora con todos los campos de §3.3.
   - Función disparadora genérica: lee app.usuario_id, app.ip, app.agente y app.sesion con current_setting(…, true); ABORTA si falta app.usuario_id; copia nombre, correo y rol desde public.usuario; calcula campos_cambiados y la cadena de hash (pg_advisory_xact_lock + sha256 con pgcrypto).
   - Disparadores BEFORE UPDATE/DELETE que impiden modificar la bitácora, más REVOKE.
   - Función contabilidad.verificar_bitacora(desde, hasta).
   - Procedimiento contabilidad.auditar_tabla(regclass) que instala el disparador; llámalo para cada tabla del esquema. Documenta en docs/07 que toda tabla nueva de contabilidad DEBE llamarlo.
   - Disparador que impide DELETE en tablas contables y UPDATE de registros de períodos cerrados.
3. Migración 0034_contabilidad_permisos.sql: los permisos de §2.1 en public.permiso, el reparto de §2.2 en rol_permiso, la tabla public.usuario_permiso (usuario_id, permiso_id, concedido boolean) y la retirada de finanzas.escribir a super_admin. Actualiza src/lib/rbac.ts en el mismo commit y resuelve los permisos por usuario (rol + excepciones), leyendo usuario_permiso en requerirUsuario.
4. src/lib/db.ts: añade enTransaccionComo(usuario, contexto, trabajo), que hace set_config de app.usuario_id/ip/agente/sesion (is_local = true) antes del trabajo. Toda escritura de contabilidad usa SOLO esta función; si alguien llama enTransaccion contra contabilidad.*, que falle por el disparador (esa es la idea).
5. src/server/contabilidad/bitacora.ts: registrarLectura(usuario, accion, entidad, id), para ver nómina, exportar y descargar.
6. Seeds idempotentes (scripts/seed-contabilidad.mjs + npm script db:seed:contabilidad):
   - banco "Banco Múltiple Santa Cruz";
   - dos cuentas, "Santa Cruz USD" y "Santa Cruz DOP" (números ficticios marcados como DEMO);
   - catálogo de cuentas básico para una ASFL;
   - categorías;
   - fondo "General";
   - parámetros de nómina de §4.6 con vigencia y fuente, más tasas del empleador con valor NULL y nota "validar con el contador";
   - secuencias RI-, CE-, PG-, CH-, AR-;
   - período del mes actual abierto.
7. Pruebas en scripts/probar-contabilidad.mjs, contra la BD de desarrollo, que demuestren:
   (a) un INSERT sin app.usuario_id falla;
   (b) un UPDATE o DELETE sobre bitacora falla;
   (c) la cadena de hash verifica, y si se altera una fila con superusuario, verificar_bitacora la detecta;
   (d) un asiento descuadrado no se puede guardar;
   (e) siguiente_numero no deja huecos con 50 llamadas concurrentes.
8. npm run lint && npm run build && npm run db:migrate && npm run db:seed:contabilidad && node scripts/probar-contabilidad.mjs.
Commit: "Contabilidad: esquema propio, permisos por persona y bitácora inmutable".
```

### Fase 2 — Bancos, libros, recibos y migración de `transaccion` · rama `feat/contabilidad-bancos-recibos`

```text
Lee docs/prompts/portal-contabilidad.md §1, §4.1, §4.2 y §4.3. Construye:

1. Migración 0035: banco, cuenta_bancaria, movimiento_bancario (tipo, cheque, beneficiario, referencia, estado, conciliado), recibo (tipo ingreso/egreso, numero, campos de §4.3), recibo_adjunto, transferencia_interna. Cada contabilización genera su asiento con una función de servidor dentro de la misma transacción. Llama auditar_tabla() en todas.
2. Migra public.transaccion: cada fila pasa a ser un recibo contabilizado en la cuenta "Santa Cruz USD", con tasa histórica NULL marcada "migrado, sin tasa" y la categoría mapeada; deja public.transaccion como VIEW de solo lectura sobre los recibos, para no romper el dashboard viejo. Documenta el mapeo en el comentario de la migración.
3. Interfaz src/server/contabilidad/bancos/adaptador.ts (parsearEstadoCuenta, generarArchivoNomina, nombre, formatosSoportados) + adaptador santa-cruz.ts con parser CSV/Excel configurable por columnas (sin layout inventado) + adaptador generico.ts.
4. Pantallas, siguiendo docs/09:
   - /portal/contabilidad (dashboard de §4.1, por ahora con bancos y recibos);
   - /contabilidad/bancos;
   - /contabilidad/bancos/[cuenta] (libro con saldo corrido y filtros);
   - conciliación (importar, emparejar, confirmar, reporte, cerrar);
   - /contabilidad/recibos (consulta con TODOS los filtros de §4.3, alta, contabilizar, anular con motivo, PDF del recibo con monto en letras);
   - transferencia entre cuentas.
   - Menú: el rol contabilidad solo ve el área Contabilidad + Perfil. Retira las rutas viejas /contabilidad y /portal/contabilidad.
5. Monto en letras: función propia en src/lib/contabilidad/numeros-a-letras.ts (es y en, DOP y USD), con pruebas de casos borde (0, 1, 21, 100, 1 000 000, centavos).
6. Todo texto en es y en. Lint, build, i18n:check, audit:ui y capturas a 390 y 1440 px.
Commit: "Contabilidad: libros de banco USD/DOP, conciliación y recibos".
```

### Fase 3 — Proveedores, cuentas por pagar y Gantt · rama `feat/contabilidad-cxp`

```text
Lee §4.4 y §4.5. Construye:
1. Migración 0036: proveedor, proveedor_cuenta_bancaria (historial, sin sobrescribir), factura_proveedor (NCF/e-CF con validación de formato y UNIQUE(rnc, ncf)), cuenta_por_pagar, pago (enlaza la cuenta por pagar, el comprobante de egreso y el movimiento bancario). auditar_tabla() en todas.
2. Validación del RNC (9 dígitos) y de la cédula (11 dígitos, algoritmo de Luhn adaptado) en src/lib/contabilidad/identificacion.ts, con pruebas.
3. Integración con solicitudes: cuando una solicitud de tipo gasto queda aprobada en su último nivel, se crea la cuenta por pagar en estado pendiente y se enlaza a la solicitud. Hazlo en la misma acción de aprobación, no con un proceso aparte.
4. Pagar = UNA transacción que crea el pago, el comprobante de egreso, el movimiento bancario y el asiento, y cambia el estado de la cuenta por pagar.
5. Pantallas:
   - /contabilidad/proveedores (lista, ficha, estado de cuenta);
   - /contabilidad/cuentas-por-pagar (lista, antigüedad de saldos, programar, pagar);
   - /contabilidad/cuentas-por-pagar/gantt, reutilizando el Gantt existente (extráelo a un componente genérico si hace falta, sin romper el de operaciones).
6. Alertas de §3.7 que ya se pueden calcular: cambio de cuenta del proveedor + pago en menos de 7 días, y factura duplicada.
Verificación completa y commit: "Contabilidad: proveedores, cuentas por pagar y Gantt de vencimientos".
```

### Fase 4 — Cajas y cuadre · rama `feat/contabilidad-cajas`

```text
Lee §4.7. Migración 0037: caja, caja_movimiento, arqueo, arqueo_denominacion. Reposición desde un libro de banco (genera el comprobante de egreso y el movimiento). Pantallas en /contabilidad/cajas: lista de cajas por persona y departamento, detalle, vale o gasto con adjunto obligatorio por encima del umbral configurable, arqueo con conteo por denominación y firma, e historial. Alerta de diferencia sobre el umbral. Verificación y commit: "Contabilidad: cajas por persona o departamento y arqueos".
```

### Fase 5 — Nómina · rama `feat/contabilidad-nomina`

```text
Lee §1.9 y §4.6 completas.
1. Migración 0038: empleado, empleado_cuenta_bancaria, periodo_nomina, nomina_linea, nomina_concepto (devengos y deducciones), novedad.
2. Motor de cálculo PURO en src/lib/contabilidad/nomina.ts: recibe empleado, período y parámetros vigentes, y devuelve el desglose; sin I/O. Pruebas con casos a mano: salario bajo el exento, en cada tramo del ISR 2026, sobre los topes de la TSS, y un período de enero de 2027 que debe usar la escala de la Ley 30-26.
3. Flujo: crear → calcular → revisar novedades → aprobar (con la regla quien-calcula-no-aprueba) → generar el archivo del banco con el adaptador → marcar pagada (genera el asiento y los movimientos).
4. Regalía pascual como tipo de período. Las liquidaciones solo como estructura.
5. Volante en PDF, resumen y exportaciones de apoyo para la TSS y el IR-3.
6. Cada vez que se abre la nómina o un volante, registrarLectura().
7. Si algún parámetro del empleador está NULL, la nómina NO se puede aprobar y la pantalla dice cuál falta.
Verificación y commit: "Contabilidad: nómina con TSS e ISR por vigencia".
```

### Fase 6 — Presupuestos de proyectos e historial de gastos · rama `feat/contabilidad-presupuestos`

```text
Lee §4.8 y §4.9. Migración 0039: presupuesto y presupuesto_partida, enlazados a public.proyecto y a fondo/patrocinador. Vista materializada (o vista normal, si rinde) de ejecución: aprobado, comprometido, ejecutado y disponible. Pantallas /contabilidad/proyectos (dashboard y detalle por partida y por donante) y /contabilidad/gastos (historial unificado con gráficas usando SERIE de paleta.ts). Aviso, sin bloqueo, al exceder una partida. Verificación y commit.
```

### Fase 7 — Reportes · rama `feat/contabilidad-reportes`

```text
Lee §4.10. Construye /contabilidad/reportes con un catálogo de reportes; cada uno con filtros, vista en pantalla y exportación a Excel (xlsx en el servidor) y PDF. Prioridad de construcción:
1. por tipo y por libro de banco;
2. libro de banco;
3. ingresos y gastos;
4. ejecución presupuestaria;
5. cuentas por pagar y antigüedad;
6. cuadres de caja;
7. nómina;
8. balance general y flujo de efectivo;
9. apoyos fiscales (IR-3, IR-17, 606, insumos ISFL-01), con el aviso "Exportación de apoyo, revisar con el contador antes de presentar".
Cada exportación pasa por registrarLectura(). Verificación y commit.
```

### Fase 8 — Archivos, tareas y calendario fiscal · rama `feat/contabilidad-archivos-tareas`

```text
Lee §4.11 y §4.12. Bucket privado "contabilidad" en Supabase Storage con URLs firmadas de 5 minutos, tabla archivo (con hash sha256, versión, enlaces a registros, conservar_hasta), carpetas automáticas por año/mes/tipo y búsqueda. Tareas: reutiliza public.tarea con un área contabilidad, más un generador idempotente de tareas recurrentes (scripts/generar-tareas-contables.mjs, pensado para cron diario) y el calendario fiscal en /contabilidad/calendario. Verificación y commit.
```

### Fase 9 — Visor del auditor, alertas y endurecimiento · rama `feat/contabilidad-auditoria`

```text
Lee §3 completa.
1. /configuracion/auditoria/contabilidad (solo contabilidad.auditar):
   - línea de tiempo;
   - vista por persona con resumen;
   - vista por registro con diff;
   - botón "Verificar integridad";
   - alertas;
   - exportación con el resultado de la verificación en el pie.
2. Función contabilidad.calcular_alertas() con todas las reglas de §3.7, ejecutada en cada carga del dashboard del auditor y por cron diario.
3. Revisión de seguridad:
   - ninguna ruta de contabilidad responde a un rol sin permiso (prueba automática que recorre las rutas con cada usuario de prueba y espera 403/redirect);
   - super_admin no puede escribir (prueba de cada server action);
   - el esquema contabilidad no aparece en PostgREST.
4. Usuario de prueba contabilidad@globaleffect.org con datos demo de 3 meses (recibos, facturas, pagos, una caja con un arqueo con diferencia, una nómina) para que el visor tenga algo que mostrar. Marca todo como DEMO.
5. Actualiza docs/03-modulos-funcionales.md, docs/04-modelo-de-datos (ERD del esquema contabilidad y diccionario), docs/estado/progreso.md y docs/estado/pendientes.md (con lo que queda: layout oficial de Santa Cruz, tasas del empleador, liquidaciones, validación del catálogo con el contador).
Commit: "Contabilidad: visor del auditor, alertas antifraude y pruebas de acceso".
```

---

## 6. Pendientes que necesitan una persona (no los resuelve el código)

1. **El contador de la Fundación** valida el catálogo de cuentas, las tasas del empleador (AFP, SFS, SRL según la categoría de riesgo, e INFOTEP), las retenciones a proveedores personas físicas, el plazo de conservación de documentos y qué formatos de la DGII presenta la Fundación.
2. **Banco Santa Cruz:** pedir al ejecutivo de cuenta (a) el layout del archivo del servicio de pago de nómina para empresas y (b) el formato de exportación del estado de cuenta de la banca en línea empresarial. Mientras no lleguen, se usa el adaptador genérico.
3. **Facturación electrónica:** la Ley 32-23 cerró su última fase (micro, pequeños y no clasificados) el 15 de mayo de 2026. Hay que confirmar con el contador si la Fundación emite e-CF (por ejemplo, comprobantes de compras a informales) o solo los recibe. El módulo ya captura e-CF de proveedores; **emitirlos** sería otra integración, con un proveedor certificado ante la DGII.
4. **Cuentas reales:** los números de cuenta, los saldos iniciales y la fecha de arranque los carga el contable en Configuración. **Nunca van en seeds ni en git.**
