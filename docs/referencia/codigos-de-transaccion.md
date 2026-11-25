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
