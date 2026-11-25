# Códigos de transacción

Un **código de transacción** nombra un proceso contable que genera líneas de
asiento (p. ej. «AFP empleados por pagar» al pagar la nómina). El módulo dice
«tantos pesos de este código» y el motor decide la **cuenta** y el **lado**
(débito o crédito) con lo que la contadora configuró. Así cambiar la
contabilidad no obliga a tocar el módulo.

## Dónde vive cada cosa

| Qué | Dónde |
|---|---|
| Definición de los códigos (solo en código) | `src/lib/contabilidad/codigos-transaccion.ts` |
| Lado (débito/crédito) por código | Pantalla «Código de transacciones» (`/contabilidad/configuracion?tab=codigos`) |
| Cuenta de cada código | Catálogo → editar una cuenta de movimiento → «Códigos de transacción» |
| Lo configurado | Tabla `contabilidad.codigo_transaccion` (migración `0115`) |
| Motor de asientos | `src/server/contabilidad/codigos-transaccion/asiento.ts` |

La base solo guarda lo configurado. Un código sin fila usa la naturaleza por
defecto de su definición y está «sin cuenta». Varios códigos pueden apuntar a
la misma cuenta; un código tiene a lo sumo una. Nada se borra: desasignar es
poner `cuenta_id = NULL`.

## Agregar un código nuevo

1. Si el módulo es nuevo, añádelo a `ModuloCodigo` y a `ETIQUETA_MODULO` (es/en).
2. Añade una entrada a `CODIGOS_TRANSACCION`: `codigo` en `MAYÚSCULAS_CON_GUION_BAJO`
   (nunca se renombra), `proceso`, `nombre` y `ayuda` en es/en, `naturaleza` por defecto.
3. Úsalo donde armas el asiento (ver abajo).
4. Corre `npx tsx scripts/probar-codigos-transaccion.ts`.

No hace falta migración ni tocar `messages/*.json`: el código aparece en la
pantalla sin cuenta hasta que se la asignen. Si quieres que arranque ya
asignado (como el de nómina), siémbralo en una migración buscando la cuenta por
su `codigo`, con `ON CONFLICT DO NOTHING`.

## Cablear un módulo

```ts
import { construirLineasPorCodigo } from "@/server/contabilidad/codigos-transaccion/asiento";

const lineas = await construirLineasPorCodigo(
  cliente,
  [{ codigo: "MI_CODIGO", monto: 1500, descripcion: "Texto de la línea" }],
  [/* líneas extra fuera de los códigos, p. ej. el banco elegido al pagar */],
);
// `lineas` se pasa a contabilidad.crear_asiento(...)
```

El motor fusiona las líneas de la misma cuenta y lado, ignora los montos en
cero y lanza `ErrorCodigosTransaccion` (con `clave` fija, traducible) si un
código no tiene cuenta, si su cuenta quedó inactiva o agrupadora, o si el
asiento no cuadra. `previsualizarLineasPorCodigo` hace lo mismo sin escribir
y sin lanzar por configuración incompleta: devuelve qué falta.

## Ejemplo: nómina

`src/server/contabilidad/nomina/asiento.ts` convierte los totales de la nómina
en partidas (sueldos por programa, aportes del empleador como gasto, TSS y ISR
por pagar). `pagarNomina` las pasa al motor y añade el desembolso neto por el
banco elegido como línea extra. `aprobarNomina` exige que cada código tenga
cuenta, y el diálogo de detalle de la nómina muestra «Asiento que se generará»
con la misma función. La migración `0115` siembra el reparto anterior
(5.3.3.x, 5.3.4.x y 2.3.1), por lo que el asiento resultante es el mismo de
antes. ISR por pagar queda sin cuenta (no existe en el catálogo): con ISR
retenido mayor que cero el pago se detiene con un mensaje claro.

## La opción Asiento en cada proceso

Todo proceso que genera un asiento (o lo contabiliza) lleva un botón
**«Asiento»** que muestra qué asiento sale, con cuenta, código de transacción,
debe y haber, y avisa de descuadres o cuentas faltantes. Es un contrato común:
no se hace una tabla propia por módulo.

| Pieza | Ubicación |
|---|---|
| Tipos y `armarVista(lineas, problemas, extras)` (centavos enteros) | `src/lib/contabilidad/vista-asiento.ts` |
| `vistaDeLineasPorCodigo(cliente, partidas, extras?)` (previa, no escribe) | `src/server/contabilidad/asientos/vista.ts` |
| `vistaDeAsientoContabilizado(asientoId, locale?)` | `src/server/contabilidad/asientos/vista.ts` |
| `<BotonAsiento cargar={() => Promise<VistaAsiento>} />` | `src/components/contabilidad/asiento/boton-asiento.tsx` |
| `<PanelAsiento vista={...} />` (solo presentación) | `src/components/contabilidad/asiento/panel-asiento.tsx` |
| Textos | `contab.asiento.*` (es y en) |

Reglas: las funciones de `vista.ts` **no comprueban permisos**; la acción de
servidor que las llama hace `requerirPermiso("contabilidad.leer")` (o el
permiso propio del proceso). Lo que falta no lanza: va a `problemas`
(`codigo_sin_cuenta`, `cuenta_inactiva`, `cuenta_agrupadora`,
`asiento_descuadrado`, `monto_invalido`, `otro`) y la pantalla lo traduce con un
enlace a `/contabilidad/configuracion?tab=codigos`. Una línea que no sale de un
código (banco, caja) se pasa en `extras.lineasExtra`; con `cuenta_id: null`
se muestra «Sin cuenta asignada». Ejemplo canónico: la nómina
(`components/contabilidad/nomina/asiento-previo.tsx`).

Cómo añadirla a un módulo:

```ts
// src/server/contabilidad/<modulo>/acciones.ts  ("use server")
export async function asientoDeX(id: string): Promise<VistaAsiento> {
  await requerirPermiso("contabilidad.leer");
  return enTransaccion(async (cliente) => {
    const partidas = await partidasDeX(cliente, id); // mismas que usa el asiento real
    return vistaDeLineasPorCodigo(cliente, partidas, { descripcion: "X-123" });
  });
}
// En la pantalla (cliente):  <BotonAsiento cargar={() => asientoDeX(id)} />
// Si ya está contabilizado:  return vistaDeAsientoContabilizado(asientoId);
```

Prueba sin base: `npx tsx scripts/probar-vista-asiento.ts`.

## Módulos cableados (25 nov 2026, migraciones 0117–0120)

Todos los procesos que generan asientos usan códigos y tienen la opción «Asiento». Cada grupo tiene su archivo en `src/lib/contabilidad/codigos/`.

| Grupo | Códigos | Sembrados a cuenta | Sin cuenta (hay que asignarla) |
|---|---|---|---|
| Nómina | `NOM_*` (15) | sueldos 5.3.3.x, aportes 5.3.4.x, por pagar 2.3.1 | `NOM_ISR_X_PAGAR` |
| Tesorería (`grupo-tesoreria.ts`) | `BAN_TRANSFER_GANANCIA_CAMBIARIA`, `BAN_TRANSFER_PERDIDA_CAMBIARIA`, `CAJ_CAJA_CHICA`, `CAJ_ARQUEO_FALTANTE`, `CAJ_ARQUEO_SOBRANTE` | 4.3.2, 5.4.4, 1.1.1, 5.4.12 | `CAJ_ARQUEO_SOBRANTE` |
| Proveedores (`grupo-proveedores.ts`) | `PROV_CXP_FACTURA`, `PROV_PAGO_CXP`, `PROV_ISR_RETENIDO_X_PAGAR`, `PROV_ITBIS_RETENIDO_X_PAGAR` | ninguno | los cuatro |
| Patrimonio (`grupo-patrimonio.ts`) | `DON_NACIONAL_BANCO`, `DON_INTERNACIONAL_BANCO`, `DON_ESPECIE_*`, `FON_LIBERACION_*`, `CIE_RESULTADOS_ACUMULADOS_*` | 4.1.1, 4.1.3, 3.1.1, 3.1.2 | `DON_ESPECIE_INGRESO`, `DON_ESPECIE_BIEN_RECIBIDO` |
| Operaciones (`grupo-operaciones.ts`) | `INV_*` (6), `AF_*` (2), `CALC_FACTURA_*` (5) | `CALC_FACTURA_GASTO` → 5.4.12 | el resto |

Reglas que conviene recordar:

- **Un código tiene un solo lado.** Si una cuenta entra por un lado y sale por el otro (existencias, cuentas por pagar), son dos códigos que pueden apuntar a la misma cuenta.
- **Lo que elige la persona NO es un código:** el banco o la caja de un recibo, las dos cuentas de una transferencia, el banco de una donación, la contrapartida de la categoría de un recibo y las cuentas de resultado que cancela el cierre anual.
- **Excepción del lado:** `PROV_PAGO_CXP` siempre debita, porque lo fija el recibo de egreso (`contabilizar_recibo`); `lineas_pago_cxp` y `lineas_recibo` deben mantenerse alineadas.
- **Procesos en SQL** (facturas, pagos, recibos, transferencias): cada uno tiene una función pura `contabilidad.lineas_<proceso>(…)` que usa `linea_por_codigo`; la función que contabiliza la llama y luego `crear_asiento`, así «Asiento» y el asiento real salen del mismo cálculo. La vista previa de esas funciones es `vistaDeFuncionSql` (`src/server/contabilidad/asientos/vista-sql.ts`).
- **Procesos en TypeScript** (nómina, donaciones, fondos, cierre, inventario, activos, calculadoras): un `asiento.ts` por módulo con `construirLineasPorCodigo`.
- **Errores:** los procesos de operaciones devuelven `ResultadoOperacion` con el texto ya traducido (`src/server/contabilidad/operaciones/errores.ts`) porque en producción Next oculta el mensaje de un `throw`.
- **Los asientos manuales y los recurrentes no usan códigos**: la plantilla ya fija sus cuentas. Solo tienen la opción «Asiento» para ver si cuadran.
