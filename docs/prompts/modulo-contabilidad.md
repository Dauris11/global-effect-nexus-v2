# Prompt: Módulo de Contabilidad (Global Effect Nexus)

## 1. Rol y objetivo

Actúa como arquitecto y desarrollador senior de software contable dominicano. Construye dentro del repositorio existente de Global Effect Nexus el **Departamento de Contabilidad** como un módulo que se sienta como un software contable completo e independiente, pero integrado a la plataforma (becas, formación, comedor, donantes).

La entidad es una **fundación (ASFL) bajo la Ley 122-05**. Antes de escribir código, lee el repo, respeta su stack, estructura y convenciones, y entrégame un plan por fases. Si el repo no define stack, usa Next.js + Supabase (Postgres con RLS).

## 2. Decisión de alcance

- **Incluir** todos los módulos del punto 5, **excepto** la emisión de facturas electrónicas (e-CF).
- La fundación **no emite facturas**. No construyas generación de XML, firma digital, envío a la DGII ni manejo de TrackID.
- Deja un **punto de extensión** (interfaz `ComprobanteProvider` y una bandera de configuración `emision_comprobantes_habilitada = false`) para poder conectar un facturador homologado en el futuro sin refactorizar. Si una donación o venta gravada exige comprobante, el sistema solo registra el número de comprobante emitido externamente.
- La **calculadora de facturas** sí se incluye como herramienta de cálculo, no de emisión.

## 3. Reglas de dominio (República Dominicana, 2026)

Todas las tasas y fechas deben ser **parámetros editables con vigencia por fecha**, nunca constantes en el código.

- ITBIS: 18 % general; tasas reducidas, 0 % y exentos configurables por tipo de bien o servicio.
- Retención de ISR a personas físicas por honorarios, alquileres y comisiones: **15 % desde el 1 de julio de 2026** (Ley 30-26). Otras retenciones según tabla parametrizable.
- Retención de ITBIS (Norma General 02-05): parametrizable; está en revisión para emisores electrónicos, así que debe ser fácil de cambiar.
- ASFL: exención general (Ley 122-05, arts. 50 a 53). Las actividades ajenas a su objeto que generen rentas deben identificarse y tributar. El sistema debe permitir marcar cada ingreso como **exento (donación/aporte)** o **gravado (actividad comercial)**.
- Obligaciones: IR-3 e IR-17 (día 10), formatos 606, 607, 608 y 609 (día 15), IT-1 (día 20), ISFL-01 anual (120 días tras el cierre).
- Conservación de documentos: 10 años.
- Prevención de lavado de activos (Ley 155-17): debida diligencia de donantes.

## 4. Principios de diseño

- Partida doble estricta: ningún asiento descuadrado puede guardarse.
- Periodos contables con cierre y bloqueo. Nada se borra, solo se anula con asiento de reverso.
- Bitácora de auditoría inalterable (quién, qué, cuándo, valor anterior y nuevo).
- Roles: administrador, contador, tesorero, aprobador, auditor (solo lectura).
- Multimoneda (DOP base) con tasa de cambio del Banco Central.
- Cada transacción tiene **centro de costo / programa / fondo** (ver módulo 10).
- Los cálculos monetarios usan decimales exactos (nunca punto flotante) y redondeo configurable.
- UI estilo aplicación web moderna (referencia visual: Airbnb), paleta blanco dominante, gris frío y azul profundo; tipografías Space Grotesk, Inter e IBM Plex Mono para cifras. Tablas densas, filtros guardados, atajos de teclado y vista responsive.

## 5. Módulos a construir

### 5.1 Configuración y parametrización
Datos de la entidad (RNC, ejercicio fiscal, moneda), tasas y retenciones con vigencia, secuencias de comprobantes recibidos, usuarios y permisos, periodos contables.

### 5.2 Contabilidad general
Catálogo de cuentas jerárquico con plantilla para ASFL, asientos manuales, recurrentes, de ajuste, apertura, cierre y reverso; diario, mayor, auxiliares, balanza de comprobación; adjuntos por asiento; cierre mensual y anual.

### 5.3 Ingresos: donaciones, aportes y cuentas por cobrar
Registro de donantes (persona, empresa, institución estatal) con RNC o cédula; donaciones en efectivo y en especie; promesas de donación con calendario de cobro; recibos internos de ingreso; antigüedad de saldos y estado de cuenta por donante; clasificación exento o gravado.

### 5.4 Gastos: compras y cuentas por pagar
Proveedores con validación de RNC; registro de facturas recibidas (NCF o e-CF del proveedor) con ITBIS adelantado y retenciones automáticas; órdenes de compra y flujo de aprobación por monto; gastos menores y caja chica; programación y pago parcial; antigüedad de saldos; comprobantes de retención.

### 5.5 Impuestos y cumplimiento DGII
Cálculo del IT-1 a partir de compras y ventas; IR-3 e IR-17; generación de archivos TXT de los formatos 606, 607, 608 y 609 con prevalidación (incluyendo envío en cero); ISFL-01 y sus anexos; control de exenciones y certificaciones; calendario fiscal con alertas; cálculo de recargos y mora.

### 5.6 Tesorería
Cuentas bancarias, cheques, transferencias, conciliación bancaria con importación de extractos, caja y arqueo, flujo de caja proyectado.

### 5.7 Nómina y seguridad social
Empleados y contratos, devengos y deducciones, TSS (AFP, SFS, SRL), INFOTEP, retención de ISR del empleado, vacaciones, regalía pascual, preaviso y cesantía, archivo de carga TSS, asientos automáticos, volantes de pago.

### 5.8 Activos fijos
Registro por categoría, depreciación mensual automática, bajas, traspasos, activos donados, inventario físico.

### 5.9 Inventario
Entradas, salidas, costo promedio, mermas, kardex y conteos físicos (comedor y materiales).

### 5.10 Presupuesto, proyectos y fondos
Centros de costo por programa (becas, formación, comedor). **Contabilidad por fondos:** fondos restringidos y no restringidos, con liberación al ejecutar el gasto. Presupuesto anual por programa con ejecución vs. presupuesto y alertas. Trazabilidad donación → fondo → beca/gasto. Informes de rendición de cuentas por donante.

### 5.11 Calculadoras integradas
- ITBIS: base desde total y total desde base.
- **Calculadora de factura:** líneas, descuentos, ITBIS, retenciones y neto a pagar o cobrar (solo cálculo).
- Retenciones de ISR e ITBIS con tasas vigentes.
- ISR de asalariados y TSS.
- Prestaciones laborales.
- Recargos y mora.
- Depreciación, préstamos y conversión de divisas.
- Cada resultado puede convertirse en asiento o borrador de registro con un clic.

### 5.12 Reportes y estados financieros
Situación financiera, estado de actividades (resultados de ASFL), flujo de efectivo, cambios en el patrimonio, notas; mayor y auxiliares filtrables por cuenta, centro de costo, programa o donante; antigüedad de CxC y CxP; tableros de indicadores; exportación a PDF, Excel y CSV.

### 5.13 Control interno y auditoría
Bitácora, segregación de funciones, doble aprobación, bloqueo de periodos, acceso de auditor externo de solo lectura, bóveda de documentos con retención de 10 años, debida diligencia de donantes grandes.

### 5.14 Integraciones
Conexión con los módulos de becas, formación, comedor y donantes de la plataforma; punto de extensión `ComprobanteProvider` (ver punto 2); exportaciones compatibles con la Oficina Virtual de la DGII.

## 6. Modelo de datos

Propón primero el esquema (tablas, relaciones, índices, políticas RLS) y espera mi aprobación antes de migrar. Entidades mínimas: entidad, periodo, cuenta, asiento, línea de asiento, tercero (donante/proveedor/empleado), documento, impuesto, retención, centro de costo, fondo, presupuesto, cuenta bancaria, movimiento bancario, empleado, nómina, activo, depreciación, parámetro fiscal con vigencia, bitácora.

## 7. Fases de entrega

1. Fundamentos: configuración, catálogo de cuentas, asientos, periodos, roles, bitácora.
2. Ingresos, gastos, terceros y tesorería.
3. Impuestos y formatos DGII, calculadoras.
4. Fondos, centros de costo y presupuesto.
5. Nómina, activos fijos e inventario.
6. Reportes, estados financieros y cierre.
7. Pruebas, accesibilidad y documentación.

Al final de cada fase: lista de archivos cambiados, pruebas ejecutadas y qué queda pendiente.

## 8. Calidad

- Pruebas unitarias obligatorias para todo cálculo fiscal y contable (ITBIS, retenciones, depreciación, nómina, cuadre de asientos).
- Datos de prueba (seed) realistas con un ejercicio completo.
- Validaciones en servidor, no solo en cliente.
- Nada de secretos en el cliente; variables de entorno documentadas.
- Lenguaje de la interfaz y mensajes de error en español dominicano claro.

## 9. Primer paso

Lee el repo y responde con: (a) resumen de lo que encontraste, (b) plan por fases ajustado al stack real, (c) esquema de datos propuesto, (d) dudas que necesites resolver. No escribas código de producción hasta que apruebe el plan.
