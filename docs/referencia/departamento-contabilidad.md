# Departamento de Contabilidad — Global Effect Nexus

Módulo ERP integral de contabilidad gubernamental, fiscal y financiera diseñado para la **Fundación Global Effect**, una Asociación Sin Fines de Lucro (ASFL) legalmente constituida en La Vega, República Dominicana, bajo la **Ley 122-05**.

---

## 1. Marco Legal y Normativo Dominicano

El sistema está configurado y gobernado por las siguientes normativas legales de la República Dominicana:

| Normativa | Ámbito de Aplicación en el ERP |
|---|---|
| **Ley 122-05** | Regulación de ASFL, exención general de ITBIS en donaciones y cuotas misionales, rendición de cuentas, contabilidad por fondos restringidos y no restringidos. |
| **DGII (Código Tributario)** | Generación oficial de archivos TXT para Formatos de Envío **606** (compras y retenciones), **607** (ingresos), **608** (comprobantes anulados), **609** (pagos al exterior). Declaraciones juradas **IT-1**, **IR-17** e **ISFL-01**. |
| **Ley 30-26 (Modif. Tributaria)** | Incremento de la tasa de retención del Impuesto Sobre la Renta (ISR) por servicios profesionales a personas físicas del 10 % al **15 %** a partir del **1 de julio de 2026**. Administrado con parámetros vigentes por fecha. |
| **Ley 155-17** | Prevención del Lavado de Activos y Financiamiento del Terrorismo. Debida diligencia obligatoria de donantes y proveedores, verificación de Personas Expuestas Políticamente (PEP) y matriz de riesgo. |
| **Código de Trabajo (Ley 16-92)** | Cálculo exacto de prestaciones laborales dominicanas (preaviso, cesantía, vacaciones, regalía pascual o salario de navidad) sobre el factor oficial `23.83`. |
| **Ley 87-01 y TSS (SUIR Plus)** | Deducciones y aportes a la Seguridad Social (AFP 2.87 % empleado / 7.10 % empleador; SFS 3.04 % empleado / 7.09 % empleador; SRL 1.10 % empleador) con topes salariales oficiales 2026 y generación de TXT de nómina para el SUIR. |

---

## 2. Arquitectura del Módulo

### 2.1 Principios de Diseño
- **Inmutabilidad y Auditoría Encadenada:** En el esquema `contabilidad.*` ningún asiento contable publicado se borra ni se modifica físicamente. Las correcciones se realizan exclusivamente mediante asientos de ajuste o reverso. Cada transacción registra un hash SHA-256 encadenado en `contabilidad.bitacora`.
- **Ecuación Patrimonial Estricta:** Todo asiento contable cumple la partida doble evaluada a nivel de transacción:
  $$\sum \text{Débitos} = \sum \text{Créditos}$$
- **Contabilidad por Fondos:** Clasificación estricta de los recursos institucionales en:
  - *Fondos No Restringidos:* Recursos de libre disposición operativa general.
  - *Fondos Temporalmente Restringidos:* Recursos etiquetados por donantes para fines específicos (ej. becas universitarias, compras de alimentos). Al cumplirse el objetivo misional, se ejecutan asientos de liberación/reclasificación patrimonial.
- **Punto de Extensión `ComprobanteProvider`:** La fundación no emite facturas con crédito fiscal ni comprobantes electrónicos (e-CF), pero el sistema cuenta con el adaptador desacoplado para incorporar emisión electrónica si una futura reforma legal lo requiriese.

---

## 3. Catálogo de Cuentas Jerárquico ASFL

El plan de cuentas sigue la codificación estándar de 4 niveles jerárquicos:

```text
1. ACTIVOS
  1.1 Activo Corriente
    1.1.01 Efectivo y Equivalentes (Caja General, Cajas Chicas)
    1.1.02 Bancos (Santa Cruz DOP, Santa Cruz USD)
    1.1.03 Cuentas por Cobrar (Promesas de donación, anticipos)
    1.1.04 Inventarios (Comedor, Material didáctico y suministros)
  1.2 Activo No Corriente
    1.2.01 Equipos y Tecnología (Cómputo, servidores)
    1.2.02 Mobiliario y Enseres
    1.2.03 Vehículos y Transporte
    1.2.04 Edificaciones y Mejoras
    1.2.09 (-) Depreciación Acumulada de Activos Fijos

2. PASIVOS
  2.1 Pasivo Corriente
    2.1.01 Cuentas por Pagar (Proveedores nacionales e internacionales)
    2.1.02 Retenciones Fiscales por Pagar (ISR empleados, ISR proveedores 15%, ITBIS)
    2.1.03 Nómina por Pagar (Sueldos netos, TSS empleado y empleador)

3. PATRIMONIO SOCIAL Y FONDOS
  3.1 Patrimonio Social
    3.1.01.01 Fondos No Restringidos (Operativo general)
    3.1.01.02 Resultados Acumulados (Histórico de ejercicios anteriores)
    3.1.01.03 Fondos Temporalmente Restringidos (Becas, Comedor)

4. INGRESOS
  4.1 Donaciones y Aportes
    4.1.01.01 Donaciones nacionales en efectivo
    4.1.01.02 Donaciones en especie (evaluadas a valor razonable)
    4.1.01.03 Aportes de patrocinadores
  4.2 Ingresos por Programas
    4.2.01.01 Cuotas de programas
  4.9 Otros Ingresos
    4.9.01.01 Intereses bancarios
    4.9.01.03 Diferencial cambiario favorable

5. GASTOS
  5.1 Gastos de Personal
    5.1.01.01 Sueldos y salarios
    5.1.01.02 TSS patronal
    5.1.01.03 Regalía pascual
    5.1.01.04 Vacaciones y prestaciones
  5.2 Gastos Operativos
    5.2.01.01 Alquiler
    5.2.01.02 Electricidad y agua
    5.2.01.03 Comunicaciones e Internet
    5.2.01.07 Consumo de alimentos y comedor
    5.2.01.08 Consumo de material didáctico y suministros
    5.2.01.09 Depreciación mensual de activos fijos
  5.3 Gastos Bancarios
    5.3.01.01 Comisiones bancarias
  5.4 Gastos Misionales de Programas
    5.4.01.01 Becas universitarias otorgadas
    5.4.01.02 Capacitación y formación integral 360
```

---

## 4. Subsistemas y Rutas del ERP Contable

| Módulo | Ruta | Funcionalidad |
|---|---|---|
| **Asientos Contables** | `/contabilidad/asientos` | Registro de asientos manuales, de ajuste, de apertura y cierre; reversos con justificación y plantillas recurrentes. |
| **Libros Contables** | `/contabilidad/libros` | Libro Diario, Libro Mayor analítico con saldo progresivo y Balanza de Comprobación con exportación a Excel. |
| **Centros de Costo** | `/contabilidad/centros-costo` | Centros de costo misionales (`CC-BECAS`, `CC-FORM360`, `CC-COMEDOR`, `CC-ADMIN`, `CC-INST`) con responsable y presupuesto. |
| **Presupuesto** | `/contabilidad/presupuesto` | Presupuesto anual y asignaciones mensuales con semáforo preventivo y alertas de sobregiro. |
| **Tesoreria y Bancos** | `/contabilidad/bancos` y `/cajas` | Cuentas bancarias en DOP y USD, conciliación bancaria y cajas chicas con arqueo y alertas antifraude. |
| **Donaciones y Promesas** | `/contabilidad/donaciones` | Registro de donaciones en efectivo y especie, promesas en calendario y emisión de recibos de ingreso. |
| **Fondos ASFL** | `/contabilidad/fondos` | Administración de fondos restringidos por donante y liberaciones con reclasificación patrimonial. |
| **Rendición de Cuentas** | `/contabilidad/rendicion` | Informes de ejecución de donaciones por patrocinador con exportación formal en PDF. |
| **Compras y Proveedores** | `/contabilidad/ordenes-compra` y `/proveedores` | Órdenes de compra aprobadas, cuentas por pagar y comprobantes de retención tributaria. |
| **Terceros (Ley 155-17)** | `/contabilidad/terceros` | Donantes, suplidores y empleados con validación RNC/cédula, debida diligencia y matriz de riesgo. |
| **Impuestos DGII** | `/contabilidad/impuestos` | Generación de archivos TXT 606, 607, 608, 609, liquidaciones IT-1, IR-17 (15 %) e ISFL-01. |
| **Calculadoras Financieras** | `/contabilidad/calculadoras` | 6 calculadoras (ITBIS, NCF, retenciones Ley 30-26, mora DGII, préstamos, prestaciones) con generación de asientos borrador. |
| **Nómina y Seguridad Social** | `/contabilidad/nomina` | Personal institucional, cálculo automático TSS (AFP, SFS, SRL), retención ISR asalariados y TXT SUIR Plus. |
| **Activos Fijos** | `/contabilidad/activos-fijos` | Capitalización de bienes en Cat 1 (5 %), Cat 2 (25 %) y Cat 3 (20 %), y corrida mensual de depreciación con asiento contable. |
| **Inventario y Kardex** | `/contabilidad/inventario` | Consumibles de oficina y cocina con Costo Promedio Ponderado, movimientos de kardex y tomas físicas. |
| **Estados Financieros** | `/contabilidad/reportes` | Balance General ($\Delta = 0$), Estado de Actividades Ley 122-05, Flujo de Efectivo método indirecto, Cambios en Patrimonio, Flujo Proyectado y Snapshots inmutables. |
| **Cierre Contable** | `/contabilidad/cierre` | Gestión mensual de 12 períodos, bloqueo contra borradores y Cierre Anual con asiento de liquidación a Resultados Acumulados. |
| **Configuración** | `/contabilidad/configuracion` | Parámetros tributarios con vigencia temporal, datos de entidad y catálogo de cuentas. |

---

## 5. Pruebas y Aseguramiento de Calidad

El módulo cuenta con una suite completa de pruebas automatizadas:

```bash
# Ejecutar todas las 95 pruebas unitarias del ERP de Contabilidad
npm run test:contabilidad

# Verificar tipos estrictos de TypeScript
npx tsc --noEmit

# Validar simetría total de claves i18n español / inglés
npm run i18n:check

# Auditar que no existan colores fuera de la marca ni hex sueltos
npm run audit:ui

# Ejecutar migraciones e idempotencia de base de datos
npm run db:migrate

# Poblar base de datos con datos dominicanos reales para demostración
npm run db:seed:contabilidad
```
