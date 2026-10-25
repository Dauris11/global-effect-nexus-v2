# Plan: Nexus AI (agentes por rol) y automatización de Contabilidad

Respuesta al «Primer paso» de `prompt-agente-ia-y-automatizacion-global-effect.md`.
Plan aprobado el 24 oct 2026; estado de la implementación justo debajo.

## Estado de implementación (24 oct 2026)

Aprobado con las recomendaciones del plan. **Desviación:** el bucle de
herramientas está escrito sobre `@anthropic-ai/sdk` (ya instalado) y no sobre el
AI SDK v6. Motivo: la aprobación humana queda persistida en `ai_accion` con su
cadena SHA-256 y se hace con una petición aparte del usuario; el `needsApproval`
del AI SDK no archiva eso por sí solo, y así no se añade una dependencia ni una
segunda capa de agente.

| Fase | Estado | Dónde |
|---|---|---|
| 1 · Datos y servicio | Hecha y aplicada (`0057`) | `src/server/ia/agente.ts`, `src/lib/ia-agentes.ts` |
| 2 · Botón, streaming y medidor | Hecha; **sin probar con el modelo real** | `src/app/api/ia/chat/route.ts`, `src/server/ia/motor.ts`, `components/ia/*` |
| 3 · Conocimiento por agente | Hecha **sin embeddings** (texto + trigramas) y **sin Drive** | `0058`, `src/server/ia/conocimiento.ts`, `/configuracion/conocimiento` |
| 4 · Herramientas, aprobación, deshacer | Hecha (8 generales + 3 contables, todas las contables de lectura) | `src/server/ia/herramientas/`, `aprobaciones.ts`, `cadena.ts` |
| 5 · Bandeja y «Mi día» | Hecha | `0059`, `src/server/contabilidad/automatizacion/`, `/contabilidad/mi-dia` |
| 6 · Cotizaciones, conciliación, recurrentes | **Parcial**: conciliación (`proponer_emparejamientos`) y recurrentes (`generar_recurrente`) ya existían en la base y salen en «Mi día»; **falta** cotización → solicitud → OC automática | — |
| 7 · Impuestos y anomalías | **Parcial**: 4 señales de anomalía en vivo; **faltan** borradores 606/607/608/609 automáticos, informe de discrepancias, lote de pagos, donaciones y rendición por donante | — |
| 8 · Pruebas | `scripts/probar-nexus-ai.ts` y `scripts/probar-mi-dia.ts`; **falta** precisión de clasificación con comprobantes reales y la prueba en pantalla | — |

Pendiente por decisión del usuario: proveedor de embeddings (y la dimensión),
presupuesto mensual de tokens, precios de los modelos, retención de
conversaciones, la app OAuth de Drive y los comprobantes reales anonimizados.

## (a) Qué existe hoy

| Pieza | Estado |
|---|---|
| `src/components/ia/widget-flotante-ia.tsx` (704 líneas) | Botón flotante ya montado en el armazón del portal (`(portal)/layout.tsx`). Dos modos, «consultas» y «acciones»; el modo acciones está restringido para el estudiante. |
| `src/server/ia/asistente-global.ts` (699 líneas) | Cerebro del widget. Acción `enviarMensajeWidget`. El «conocimiento» es **texto fijo en código** (`REGLAMENTO_FUNDACION`), no una base. La única «acción» es **sugerir navegación** a una ruta; no escribe datos. |
| `src/lib/ia.ts` | Cliente `@anthropic-ai/sdk`. Modelo único por `ANTHROPIC_MODEL` (por defecto `claude-sonnet-5`), sin prompt caching, sin herramientas, sin streaming. |
| `src/server/ia/{estudiante,interno,ocr,acciones*}.ts` | Chat estudiantil, chat interno del equipo y OCR de cédulas (con rastro en `extraccion_ocr`). |
| Migración `0012_ia.sql` | `conversacion_ia`, `mensaje_ia` (con columna `tokens`, sin usar para costo), `extraccion_ocr` y `fragmento_conocimiento` con `VECTOR(1536)` + HNSW. **pgvector ya está instalado** (`0001`). Nadie escribe en `fragmento_conocimiento`. |
| Migración `0056_chat_interno_y_comprobantes.sql` | Canales de chat y base para comprobantes fotográficos. Es la base del flujo «Reportar gasto». |
| Bitácora contable con cadena SHA-256 | Migraciones `0033`/`0035`; `enTransaccionComo` fija `app.usuario_id` y el disparador aborta sin identidad. |
| RLS | Activada en todas las tablas (`0046`, `0048`, `0050`–`0054`). |

**No existe:** medidor de tokens, cuotas, `ai_actions`, herramientas con aprobación, base de conocimiento por rol, ingesta, Realtime, «Mi día», ni ninguna automatización contable.

## Dónde el prompt choca con el repo (hay que decidirlo)

1. **«Cada herramienta con el JWT del usuario y RLS».** El servidor se conecta con `pg` y `DATABASE_URL` (rol `postgres`, que **salta RLS**). La identidad se pasa por `set_config('app.usuario_id')`. Hacerlo «como el usuario» tiene dos caminos:
   - **A (recomendado):** las herramientas llaman a las **mismas acciones de `src/server/<dominio>/acciones.ts`**, que ya aplican `requerirPermiso` y `enTransaccionComo`. Un solo camino de escritura, sin duplicar reglas. El agente es un cliente más de esas acciones.
   - B: crear un rol Postgres de aplicación sujeto a RLS y leer `app.usuario_id` en las políticas. Es más fuerte, pero reescribe cómo se conecta toda la app.
2. **Vercel AI SDK v6 frente a `@anthropic-ai/sdk`, que ya está.** El AI SDK aporta bucle de herramientas, `needsApproval`, `useChat` y `usage` por paso. Cambia el motor de `lib/ia.ts` y añade dependencias. Alternativa: seguir con el SDK de Anthropic y escribir el bucle (más código propio, cero dependencias nuevas). Recomiendo el AI SDK, pero **tras leer su documentación vigente**; no la he consultado todavía.
3. **Modelos.** El código usa `claude-sonnet-5`. Los identificadores vigentes que conozco son `claude-sonnet-5-5` y `claude-haiku-5-5`; hay que confirmarlos en la documentación de Anthropic antes de fijarlos en la tabla de agentes. Los modelos van en **configuración editable**, no en código.
4. **Embeddings.** Anthropic no ofrece modelo de embeddings. Hay que elegir proveedor (Voyage, OpenAI, etc.) y **la dimensión** (la columna hoy es 1536). Es una decisión de costo y de enviar texto a un tercero.
5. **Roles.** El prompt nombra 7 agentes; `rbac.ts` tiene más roles (`dir_habitudes`, personal operativo…). Hay que mapear cada rol a un agente (propongo que `dir_habitudes` use `agente_habitudes` con herramientas de supervisión, y los operativos usen `agente_colaborador`).
6. **Realtime.** Cambios en vivo con Supabase Realtime requieren políticas RLS de lectura para `authenticated`, y hoy la app no lee con el JWT del usuario. Propongo **empezar con refresco del servidor** (`revalidatePath` + sondeo corto) y dejar Realtime para la fase 4.

## (b) Plan por fases

Cada fase se entrega verificable (`lint`, `build`, `i18n:check`, `audit:ui`) y cierra con su actualización de `pendientes.md`.

**Fase 0 — Decisiones y lectura (sin código).** Leer documentación del AI SDK v6, modelos vigentes y proveedor de embeddings; resolver las dudas de abajo.

**Fase 1 — Cimientos de datos y servicio.** Migración `0057`: `ai_agente` (configuración editable), `ai_precio_modelo`, `ai_uso`, `ai_cuota`, `ai_accion`. Servicio de agente que **decide el agente por el rol de la sesión** (nunca por el cliente), con registro de uso y cuotas (80 % aviso, 100 % bloqueo, anulación de admin, límite de tasa). Reemplaza el cliente de `lib/ia.ts` conservando el chat actual funcionando. Sin herramientas de escritura.

**Fase 2 — Botón y medidor.** Evolucionar `widget-flotante-ia.tsx` (no rehacerlo): streaming, pasos de herramienta en vivo, selector de agente solo con roles propios, medidor de consumo propio. Respeta el sistema visual (tokens, sin hex).

**Fase 3 — Base de conocimiento.** Ampliar `fragmento_conocimiento` con `agente`, `fuente`, `version`, `vigente_hasta`, `verificado_el`; búsqueda híbrida (vectores + `pg_trgm`); filtro por rol **dentro de la consulta SQL** y política RLS como segunda barrera; citas obligatorias; aviso de norma con más de 90 días sin verificar. Ingesta por texto pegado y Storage primero; Drive después (OAuth Internal, alcance de solo lectura).

**Fase 4 — Herramientas y aprobaciones.** Catálogo por rol; cada herramienta envuelve una acción existente. Tres niveles: automática, `needsApproval`, aprobación jerárquica (el agente nunca salta umbrales). Lista de **prohibidos fija en código y en base** (periodos cerrados, evidencia, DGII, permisos, bitácora). `ai_accion` enlazada a la cadena SHA-256. Resaltado «Nexus AI» + **Deshacer** (solo si la acción declara su reverso; si no, no se ofrece). `consultar_metrica` con vistas parametrizadas, sin SQL libre.

**Fase 5 — Contabilidad: bandeja y «Mi día».** Bandeja de comprobantes: OCR (reutiliza `ocr.ts`) → validación RNC/NCF → clasificación sugerida → asiento **borrador** → detección de duplicados (RNC+NCF+monto, índice único). Pantalla «Mi día» con aprobación en lote y métricas de ahorro (tiempo por comprobante, % sin corrección, clics).

**Fase 6 — Cotizaciones, conciliación, recurrentes.** Solicitud automática desde el chat con verificación de presupuesto y enrutado por umbral; conciliación bancaria por monto/fecha/referencia; asientos recurrentes y cierre asistido.

**Fase 7 — Impuestos y anomalías.** Borradores 606/607/608/609, IT-1, IR-3, IR-17 e informe de discrepancias (**la contadora envía; el sistema no presenta**); CxP; donaciones; alertas de anomalías; rendición por donante.

**Fase 8 — Evaluación.** Las pruebas obligatorias del prompt, con scripts como los `probar-faseN.mjs` existentes.

Autonomía contable (niveles 0/1/2): una tabla `contab_regla_automatica` con nivel por regla, **nivel 1 por defecto**, y el nivel 2 solo con umbral de confianza y de monto, siempre reversible.

## (c) Esquema de datos propuesto

```
ai_agente(id, clave UNIQUE, rol_origen[], instrucciones, modelo, herramientas[],
          max_tokens, limite_tasa_min, activo, updated_by, updated_at)
ai_precio_modelo(modelo PK, usd_entrada_mtok, usd_salida_mtok,
                 usd_cache_lectura_mtok, vigente_desde)
ai_hilo(id, usuario_id, agente_clave, titulo, created_at)   -- reutiliza conversacion_ia
ai_uso(id, usuario_id, rol, agente_clave, hilo_id, modelo, tokens_entrada,
       tokens_salida, tokens_cache, costo_usd, herramientas[], latencia_ms, created_at)
ai_cuota(id, alcance ('usuario'|'rol'), usuario_id?, rol?, tokens_mes,
         aviso_pct DEFAULT 80, anulado_hasta?, anulado_por?)
ai_accion(id, hilo_id, usuario_id, agente_clave, herramienta, argumentos_sanitizados JSONB,
          resultado JSONB, estado ('propuesta'|'aprobada'|'rechazada'|'ejecutada'|'fallida'),
          aprobador_id?, entidad_tipo, entidad_id, reversible BOOL, deshacer JSONB?,
          hash_previo, hash CHAR(64), created_at)           -- cadena SHA-256
fragmento_conocimiento + (agente_clave, fuente, version, vigente_hasta, verificado_el,
                          roles_permitidos[], contenido_tsv)
contab_comprobante_recibido(id, empleado_id, imagen_ref, ocr JSONB, rnc, ncf, monto,
                            estado, clasificacion_sugerida JSONB, asiento_borrador_id?,
                            duplicado_de?)  UNIQUE parcial (rnc, ncf, monto)
contab_regla_automatica(id, clave, nivel 0|1|2, umbral_confianza, umbral_monto, activa)
```

Todas con RLS activada y sin política abierta (acceso por servidor), como `0046`. Las que contienen conversaciones: solo su dueño; Dirección ve metadatos y el contenido solo con un acceso explícito que escribe en la bitácora.

## (d) Dudas que bloquean

1. **¿Camino A o B** para «actuar como el usuario»? (Recomiendo A.)
2. **¿AI SDK v6** o seguir con `@anthropic-ai/sdk`? (Recomiendo AI SDK, tras leer su documentación.)
3. **Proveedor de embeddings** y si se acepta enviar texto institucional a un tercero. ¿Se conserva 1536 dimensiones?
4. **Presupuesto mensual** de tokens: para fijar cuotas por defecto.
5. **Retención** de conversaciones (propongo 12 meses; metadatos de uso y `ai_accion` se conservan).
6. **Drive:** ¿quién crea la app OAuth Internal y el dominio de Workspace? Bloquea solo la ingesta de Drive (fase 3), no el resto.
7. **Coordinación con el otro agente:** el prompt de portales y el de contabilidad modifican `messages/*.json`, `pendientes.md` y migraciones. Reservo la numeración **0057 en adelante** para IA; ¿confirmas que el otro agente no la usa?
8. **Pruebas reales:** la precisión de clasificación necesita comprobantes reales anonimizados. ¿Los puede proveer la contadora?
