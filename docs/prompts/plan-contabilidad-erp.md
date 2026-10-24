# Departamento de Contabilidad — plan por fases (propuesta para aprobar)

> **Escrito:** 2026-10-24, sobre la rama `feat/portal-contabilidad`.
> **Responde a:** el prompt "Módulo de Contabilidad (Global Effect Nexus)" (ASFL,
> Ley 122-05, sin emisión de e-CF).
> **Estado:** propuesta. No se migra ni se construye ningún módulo nuevo hasta que
> se apruebe este plan y se resuelvan las dudas de la sección 4.
> **Relación con `portal-contabilidad.md`:** aquella especificación sigue siendo la
> norma de arquitectura (esquema `contabilidad`, partida doble por debajo,
> bitácora con cadena de hash, nada se borra). Este plan la amplía con lo que el
> prompt nuevo pide y aquella no cubría, y sustituye sus fases 5 a 9.

---

## (a) Lo que hay hoy

El stack real es Next.js 16 + Supabase (Postgres vía `pg`, sin ORM), con el
dinero en un esquema propio, `contabilidad`, que PostgREST no expone. Las fases
1 a 4 de `portal-contabilidad.md` están construidas:

| Prompt | Qué existe | Dónde |
|---|---|---|
| 5.1 Configuración | Períodos con cierre y reapertura con motivo; parámetros legales con vigencia (TSS, topes, escala ISR); secuencias sin huecos; permisos finos y excepciones por usuario (`usuario_permiso`) | `0032`–`0035`, `contabilidad.parametro`, `periodo_contable`, `secuencia` |
| 5.2 Contabilidad general | Catálogo jerárquico (`cuenta_contable`), asientos y líneas con cuadre validado en la base; los recibos y facturas generan su asiento y su contra-asiento al anular | `asiento`, `asiento_linea` |
| 5.3 Ingresos | Recibos de ingreso y egreso con fondo, proyecto y patrocinador; recibo imprimible | `/contabilidad/recibos` |
| 5.4 Gastos | Proveedores (RNC/cédula validados) con cuentas bancarias; facturas recibidas con NCF, ITBIS y retenciones ISR/ITBIS; cuentas por pagar con pago parcial, programación, antigüedad y Gantt; rendiciones de gastos con OCR | `/contabilidad/proveedores`, `/contabilidad/cuentas-por-pagar`, `/administrativo/rendiciones` |
| 5.5 Impuestos | Formatos 606 y 607 en **Excel** (no en TXT) | `/contabilidad/impuestos` |
| 5.6 Tesorería | Multibanco con adaptadores, libro de banco, transferencias con diferencia cambiaria, tasa del día, conciliación con importación de extracto; cajas chicas con arqueo por denominaciones y alerta de descuadre | `/contabilidad/bancos`, `/contabilidad/cajas` |
| 5.8 Activos | Inventario físico de activos con QR y escaneo móvil, **sin depreciación** | `/administrativo/inventario` (`0040`) |
| 5.13 Control interno | Bitácora inmutable con cadena de hash y verificación; alertas automáticas; "quien registra no aprueba"; `super_admin` solo audita | `contabilidad.bitacora`, `contabilidad.alerta` |

**Refactor del portal (esta rama).** Todos los módulos del departamento salen
ahora de un solo registro, `src/lib/contabilidad/modulos.ts`. De ahí se generan
el menú agrupado (tesorería, ingresos, gastos, impuestos, activos y
departamento), el área de Finanzas del menú de administración y el lanzador del
inicio. El inicio arranca con **Para hoy**: lo vencido, los borradores y las
rendiciones, arqueos y conciliaciones abiertos. Las herramientas que viven en
otras áreas (rendiciones, inventario, solicitudes, reportes) aparecen en el
departamento sin moverse de su sitio. Los formatos DGII, que eran botones
sueltos y siempre del mes en curso, se reúnen en `/contabilidad/impuestos` con
selector de mes. **Un módulo nuevo es una entrada en el registro y su ruta.**

**Lo que falta**, en resumen: asientos manuales y recurrentes con diario, mayor
y balanza; donantes con debida diligencia, donaciones en especie y promesas;
órdenes de compra y comprobantes de retención; los TXT de los formatos 606 a
609, el IT-1, el IR-3, el IR-17, el ISFL-01 y el calendario fiscal; nómina;
depreciación; inventario de consumibles; presupuesto con fondos restringidos;
calculadoras; estados financieros de ASFL; y el punto de extensión
`ComprobanteProvider`.

---

## (b) Plan por fases, ajustado al stack

Una rama y un PR por fase. Ninguna fase empieza sin la anterior en verde (`lint`,
`build`, `i18n:check`, `audit:ui` y sus pruebas). Las pruebas de cálculo usan
`node:test`, que el repo ya usa en `npm run test:contabilidad`. No se añade otro
framework.

| Fase | Contenido | Prompt | Depende de |
|---|---|---|---|
| **1 · Fundamentos** | Entidad (RNC, ejercicio fiscal, moneda base, redondeo); tabla de impuestos y retenciones con vigencia; pantalla de Configuración contable (§4.13, pendiente); asientos manuales, recurrentes, de apertura, de ajuste y de reverso; diario, mayor, auxiliares y balanza de comprobación; perfiles de permisos (ver duda 2); `ComprobanteProvider` con `emision_comprobantes_habilitada = false` | 5.1, 5.2, 5.13, 2 | — |
| **2 · Ingresos y terceros** | Terceros con RNC o cédula y debida diligencia (Ley 155-17); donaciones en efectivo y en especie; promesas con calendario de cobro; clasificación exento o gravado en cada ingreso; estado de cuenta y antigüedad por donante; órdenes de compra y aprobación por monto; comprobantes de retención | 5.3, 5.4 | 1 |
| **3 · Impuestos DGII y calculadoras** | TXT de los formatos 606, 607, 608 y 609 con prevalidación y envío en cero; IT-1; IR-3; IR-17; ISFL-01; calendario fiscal parametrizado con alertas; recargos y mora; calculadoras de ITBIS, factura, retenciones, recargos, divisas y préstamos, cada una con "convertir en borrador" | 5.5, 5.11 | 2 |
| **4 · Fondos y presupuesto** | Centros de costo por programa; fondos restringidos y no restringidos con liberación al ejecutar el gasto; presupuesto anual por programa con ejecución contra presupuesto y alertas; trazabilidad donación → fondo → beca o gasto; rendición de cuentas por donante | 5.10 | 2 |
| **5 · Nómina, activos e inventario** | Empleados y contratos; devengos y deducciones; TSS (AFP, SFS, SRL), INFOTEP e ISR del asalariado con los parámetros que ya existen; vacaciones, regalía, preaviso y cesantía; archivo TSS; volantes. Depreciación mensual de los activos de `0040`, bajas, traspasos y donados. Kardex de consumibles del comedor y materiales con costo promedio | 5.7, 5.8, 5.9, 5.11 | 1, 4 |
| **6 · Reportes y cierre** | Situación financiera, actividades (ASFL), flujo de efectivo, cambios en el patrimonio y notas; mayor filtrable por cuenta, centro de costo, programa o donante; cierre mensual y anual; exportación PDF, Excel y CSV; flujo de caja proyectado | 5.6, 5.12 | 1–5 |
| **7 · Calidad y documentación** | Visor del auditor externo de solo lectura; bóveda de documentos con retención de 10 años; seed de un ejercicio completo; accesibilidad; manual del departamento | 5.13, 8 | 1–6 |

Al final de cada fase se entregan los archivos cambiados, las pruebas ejecutadas
y lo que queda pendiente, y se actualiza `docs/estado/`.

---

## (c) Esquema propuesto

Todo en el esquema `contabilidad`, con el disparador de bitácora que ya cubre el
esquema entero. Montos en `NUMERIC(14,2)`, tasas en `NUMERIC(12,4)`, nada en
`float`. Ninguna tabla admite `DELETE`: se anula con motivo. **RLS:** las tablas
nuevas nacen con RLS activo (`0046`) y sin políticas para `anon` ni
`authenticated`; la app entra por conexión directa y el control de acceso está
en `requerirPermiso` y en las server actions.

| Fase | Tabla | Para qué | Claves y restricciones |
|---|---|---|---|
| 1 | `entidad` | RNC, razón social, inicio del ejercicio fiscal, moneda base, redondeo | Una fila; `CHECK` de RNC de 9 dígitos |
| 1 | `impuesto` | ITBIS general, reducidos, 0 % y exento, por tipo de bien o servicio | `codigo`, `tasa`, `vigente_desde/hasta`; exclusión de rangos solapados por código |
| 1 | `tipo_retencion` | ISR por honorarios, alquileres y comisiones; retención de ITBIS (NG 02-05) | Igual que `impuesto`; la tasa vigente sale por fecha del documento |
| 1 | `asiento_recurrente` | Plantilla y periodicidad de asientos que se repiten | FK a `cuenta_contable`; genera borradores, nunca asientos contabilizados |
| 1 | `perfil_permiso` | Paquetes de permisos (contador, tesorero, aprobador, auditor) que se asignan a un usuario | Se resuelve sobre `usuario_permiso`; no crea roles nuevos |
| 2 | `tercero` | Donante, proveedor o empleado con RNC o cédula, y debida diligencia | `UNIQUE (tipo_id, identificacion)`; `proveedor` y `patrocinador` lo referencian |
| 2 | `debida_diligencia` | Verificación de donantes grandes (umbral parametrizado) | FK `tercero`; fecha, resultado y adjunto en la bóveda |
| 2 | `donacion` | Efectivo o especie, exenta o gravada, con fondo de destino | `clase IN ('efectivo','especie')`, `tratamiento IN ('exento','gravado')`; genera recibo y asiento |
| 2 | `promesa_donacion` / `promesa_cuota` | Compromiso y calendario de cobro | Cuotas con estado; la cobrada enlaza al recibo |
| 2 | `orden_compra` / `orden_compra_linea` | Compra con aprobación por monto antes de la factura | Umbrales en `parametro`; la factura puede citar la orden |
| 2 | `comprobante_retencion` | Constancia de retención emitida al proveedor | Secuencia propia; FK a la factura |
| 3 | `obligacion_fiscal` | Calendario: IR-3, IR-17, 606 a 609, IT-1, ISFL-01, con día límite parametrizado | Día y regla de vigencia en datos, no en código |
| 3 | `declaracion` | Cada presentación: tipo, período, estado, archivo TXT y su hash | `UNIQUE (tipo, anio, mes)`; una rectificativa es otra fila que cita la anterior |
| 4 | `centro_costo` | Programa (becas, formación, comedor…) | Sustituye a `programa_cod` (texto) en facturas y recibos |
| 4 | `fondo` (ampliar) | Restringido o no, donante, fecha de liberación | Se añaden columnas a la tabla que ya existe |
| 4 | `presupuesto` / `presupuesto_linea` | Presupuesto anual por centro de costo y cuenta | `UNIQUE (ejercicio, centro_costo_id, cuenta_id)` |
| 5 | `empleado` / `contrato` | Personal en nómina (no es `usuario`: hay quien cobra y no entra al sistema) | FK `tercero`; salario solo visible con `contabilidad.nomina` |
| 5 | `concepto_nomina`, `nomina`, `nomina_linea` | Devengos, deducciones y cada corrida | La corrida cerrada genera su asiento y el archivo TSS |
| 5 | `activo_categoria`, `depreciacion` | Vida útil y método; depreciación mensual | Se cuelga del `public.activo` de `0040`, no se duplica |
| 5 | `articulo`, `inventario_movimiento`, `conteo_fisico` | Consumibles con kardex y costo promedio | El costo promedio se recalcula en la base al entrar mercancía |
| 7 | `documento` | Bóveda con retención | `conservar_hasta = fecha + 10 años`; no se borra antes |

---

## (d) Dudas que hay que resolver antes de la Fase 1

1. **Diseño.** El prompt pide Space Grotesk, IBM Plex Mono y "azul profundo", y
   la norma del sistema (`docs/09-sistema-visual.md`) es Inter y turquesa
   `#2096BA`. Propuesta: mantener la marca y usar solo IBM Plex Mono para las
   cifras de las tablas.
2. **Roles.** El prompt pide cinco roles (administrador, contador, tesorero,
   aprobador y auditor). Hoy hay un rol `contabilidad` y excepciones por usuario.
   Propuesta: perfiles de permisos sobre `usuario_permiso`, sin roles nuevos, para
   no tocar el menú ni el RBAC del resto del sistema.
3. **Donantes.** ¿Los donantes son los mismos patrocinadores de becas
   (`public.patrocinador`)? Propuesta: un `tercero` común al que apuntan
   patrocinador y proveedor, para que la debida diligencia y el estado de cuenta
   valgan para los dos.
4. **Formatos DGII.** Hoy salen en Excel. ¿Se genera también el TXT oficial
   para subir a la Oficina Virtual (propuesta: sí, con el Excel como vista
   previa)?
5. **Normas.** La retención del 15 % desde el 1 de julio de 2026 (Ley 30-26) y la
   NG 02-05 deben confirmarse con el contador antes de cargar sus parámetros. La
   especificación anterior decía que la escala del ISR cambia en 2027: hay que
   saber cuál de las dos vale.
6. **Nómina.** ¿Cuántos empleados hay y con qué banco se paga? El archivo de pago
   depende del adaptador del banco.
7. **Actividades gravadas.** ¿La Fundación tiene hoy alguna actividad gravada
   (por ejemplo, venta de comida a terceros) o todo ingreso es exento?
