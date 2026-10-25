# Revisión del trabajo de portales y Contabilidad (24 oct 2026)

Revisión de solo lectura de lo que hace el otro agente (Contabilidad fases 2–6,
migraciones `0050`–`0056`, chat interno, comprobantes y rol `colaborador`).
La hizo un subagente sobre la rama `feat/portal-contabilidad`; lo que no pudo
verificar está marcado. **Nada de esto se ha corregido**: son archivos que el
otro agente está editando.

Verificado por ejecución: `npx tsc --noEmit` falla solo en los seis puntos de
«Errores de tipos»; `npm run lint`, `i18n:check` y `audit:ui` pasan (pero los
dos últimos **no detectan** cadenas literales en JSX, ver M1).

## Crítico

- **C1 · Chat sin control de acceso.** `src/server/chat/consultas.ts:94-116`
  (`mensajesDeCanal`) y `:124` (`detalleCanal`) no comprueban que quien pregunta
  sea participante: con cualquier `canalId` se leen mensajes ajenos, directos
  incluidos. `listarCanalesUsuario` (`:84-85`) incluye todos los canales de
  departamento para cualquier usuario. `enviarMensajeChat`
  (`acciones.ts:11-52`) deja escribir en cualquier canal y además **inscribe al
  usuario como miembro** (`:41-47`). `obtenerOCrearCanalDirecto` (`:162-203`) no
  valida que el otro usuario exista ni esté activo, no es transaccional y no hay
  índice único del par. Arreglo: un `requerirParticipante(canalId, usuarioId)` en
  todas las lecturas y escrituras; filtrar departamentos por membresía.
- **C2 · Comprobantes sin permiso.** `recibidos-acciones.ts:26`
  (`validarComprobanteRecibido`) usa solo `requerirUsuario()`: cualquier cuenta,
  estudiantes incluidos, puede validar, rechazar o editar monto, NCF, centro de
  costo y fondo, y publica mensajes de sistema en nombre de Contabilidad. No
  comprueba el estado (se puede revalidar uno `contabilizado`).
  `reportarGastoDesdeChat` (`acciones.ts:74`) no exige `rendicion.enviar` ni que
  el usuario pertenezca al canal. Arreglo: `requerirPermiso("contabilidad.registrar")`.

## Alto

- **A1 · Archivos sin validar.** `archivoUrl`, `archivoSha256` y `documentoId`
  llegan del cliente como texto libre (`acciones.ts:66-70`, insert `:109-133`):
  sin tipo, tamaño, ni comprobar que la URL sea de nuestro Storage. `datosExtra`
  acepta JSON arbitrario y se pueden falsificar tarjetas de gasto. No hay
  inmutabilidad ni retención de 10 años: nada impide `DELETE`/`UPDATE` del monto.
- **A2 · RLS.** Las migraciones `0055`/`0056` no la habilitaban (0046 solo cubrió
  lo que existía entonces). **Corregido en la `0059`**: se habilitó en
  `chat_*`, `departamento*`, `usuario_push_subscription`, `correo_cola` y
  `contabilidad.comprobante_recibido`.
- **A3 · Depreciación DGII.** `0053…sql:226-228`: categoría 3 al 20 %. El
  prompt de portales (§5.5) y la norma dan 15 %. No está marcado como «validar
  con el contador».
- **A4 · Depreciación mensual** (`activos-fijos/acciones.ts:85-175`): no se ve
  comprobación de periodo cerrado ni de doble depreciación del mismo mes; usa las
  cuentas de `activos[0]` para todos; usa flotantes en vez de `NUMERIC`.

## Medio

- **M1 · Cadenas literales en JSX** (regla 2): `comprobantes-recibidos/page.tsx`
  (`:25`, `:56`, `:60`…), `portal/colaborador/page.tsx` (`:25`, `:41-43`, `:53`),
  textos y emojis en `chat/acciones.ts` y `recibidos-acciones.ts:82-84`. Los
  mensajes de sistema se guardan en español; deberían ser código + parámetros.
- **M2 · Coherencia de `0056`:** sin `UNIQUE` en `(tipo, departamento_id)`, así
  que repetir la migración duplicaría los canales «General»; `sin_leer` hace
  subconsultas por canal (N+1); `0055` no inserta `reuniones.leer` aunque
  `rbac.ts` se lo da a `colaborador` (regla 4).
- **M3 · Pantallas con solo `requerirUsuario`:** `/administrativo/rendiciones`,
  `tareas/hoy`, `solicitudes`. Revisar que sus acciones exijan permiso.
- **M4 · Notificaciones:** `notificarUsuario` solo inserta la fila; no hay Web
  Push ni procesador de `correo_cola`. `registrarSuscripcionPush` acepta
  cualquier endpoint y lo reasigna a otro usuario.
- **Dato de la revisión de IA:** `crearOrdenCompra`
  (`contabilidad/compras/acciones.ts:16`) tampoco comprueba permiso.

## Errores de tipos (corregidos el 25 oct)

- `portal/colaborador/page.tsx:41` (prop `etiqueta`), `:122` y `:127` (Badge
  `critica`/`alerta`).
- `components/contabilidad/comprobantes/panel-revision-comprobante.tsx:122` y
  `:164` (Badge `alerta`/`exito`/`critica`) y `:270` (Button `primario`).

Se cambiaron a variantes que existen (`marca`, `solida`, `neutra`, `default`) y el
portal del colaborador pasó sus textos a `colaborador.portal.*`; `next build`
vuelve a pasar. Las variantes válidas de `Badge` son `default`, `neutra`, `marca`, `solida`,
`secondary`, `destructive` y `outline`; y la política de marca prohíbe un matiz
propio para error o éxito (ver `.claude/rules/design-system.md`).

## Estado de las piezas del prompt de portales

- **Hecho en código, sin funcionar de extremo a extremo:** rol `colaborador`,
  tablas de chat y comprobantes (`0056`), bandeja de comprobantes (con los
  errores de arriba).
- **A medias:** notificaciones (solo en la app), chat (capa servidor **sin
  ninguna pantalla**: no existe `(portal)/chat`, y `revalidatePath("/chat")`
  apunta a una ruta inexistente).
- **Sin empezar:** Google (OIDC, Calendar, Drive, Maps), correo de facturas, PWA
  con cola sin conexión, OCR y legibilidad del comprobante, archivo inmutable,
  mejoras por portal, paleta de comandos, y las pruebas de RLS y del flujo del
  comprobante.

## No verificado

Partida doble y tarifas de nómina, donaciones, compras, cierre y retenciones;
`proveedor.ts`/`externo.ts`; XSS; el resto de páginas de Contabilidad.
