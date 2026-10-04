# Stack Tecnológico — Global Effect Nexus

> Stack **definitivo** del proyecto (fuente de verdad). Actualiza y consolida lo indicado en [01 · Visión](01-vision-y-alcance.md) y [02 · Arquitectura](02-arquitectura-tecnica.md). Última actualización: 2026-07-11.

## 1. Tabla del stack

| Área | Tecnología | Notas de implementación |
|---|---|---|
| **Framework** | Next.js 16 (App Router) + React 19 | Server Components, Server Actions, rutas por archivo. |
| **Lenguaje** | TypeScript (`strict`) | Sin `any` salvo casos justificados. |
| **Base de datos / Auth** | Supabase (PostgreSQL 17, PostGIS, Auth, Storage) | BD + autenticación + almacenamiento gestionados. |
| **Acceso directo a BD** | `pg` (pool con SSL, conexión directa) | SQL parametrizado a mano, sin ORM. Catálogos y toda la lógica de negocio. |
| **Autenticación** | Supabase Auth (`@supabase/ssr`) | Email + contraseña; sesión en cookies; verificación JWT vía JWKS. RBAC propio sobre tabla `usuario`. |
| **Estilos** | Tailwind CSS 4 + Radix UI + componentes propios | Patrón `cn()` de `lib/utils.ts`. Config CSS-first (sin `tailwind.config.ts`). |
| **i18n** | next-intl | Rutas `/[locale]`: `es` (default), `en`, `fr`, `it`. |
| **Animación** | motion (LazyMotion + domAnimation + `m`) + `@formkit/auto-animate` | Animaciones ligeras y listas auto-animadas. |
| **Mapas** | Leaflet + react-leaflet + OpenStreetMap | Sin Mapbox ni Google Maps. |
| **Gráficas** | Recharts + SVG propio para PDF | Dashboards y reportes. |
| **Validación** | Zod (servidor) | Validación en la frontera (Server Actions). |
| **Imágenes** | `sharp` (servidor) + Canvas API (compresión en cliente) | Redimensionado/optimización server-side. |
| **Iconos** | `lucide-react` | Emojis prohibidos como iconos. |
| **Fuente** | Montserrat (oficial de urbangroup.do) | Auto-hospedada vía `next/font`. |
| **Datos/estado (cliente)** | TanStack React Query | Caché, invalidación y mutaciones. |
| **Formularios** | React Hook Form + Zod | `@hookform/resolvers`. |
| **Fechas** | date-fns | Localización por idioma. |
| **Integraciones** | n8n · Resend · GENIALiA (CRM) · Anthropic | Webhooks, emails, CRM y traducción/IA. |

## 2. Integraciones externas

| Servicio | Uso | Variables de entorno |
|---|---|---|
| **Supabase** | BD (PostgreSQL 17 + PostGIS), Auth, Storage | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`, `SUPABASE_STORAGE_BUCKET`, `DATABASE_URL` / `PG*` |
| **Resend** | Envío de correos (notificaciones de tareas, patrocinadores) | `RESEND_API_KEY`, `RESEND_FROM` |
| **n8n** | Webhooks a CRM / orquestación de notificaciones | `N8N_WEBHOOK_URL` |
| **GENIALiA** | CRM institucional (sincronización de contactos/leads vía n8n) | (a través de n8n) |
| **Anthropic** | Traducción IA, OCR de expedientes, asistentes de chat | `ANTHROPIC_API_KEY` |

Plantilla completa en [`.env.example`](../.env.example).

## 3. Modelo de autenticación (Supabase Auth + RBAC propio)

```
Navegador ──login(email,pass)──▶ Supabase Auth (auth.users)
     │                                  │  (cookies de sesión, JWT firmado)
     ▼                                  ▼
Middleware Next  ── getUser() ──▶ verificación JWT (JWKS)
     │
     ▼
currentUser() ── SELECT usuario JOIN rol WHERE auth_user_id = sub
     │
     ▼
requirePermission('modulo.accion')  ── can(rol, permiso) sobre rol_permiso
```

- **Credenciales:** las gestiona Supabase Auth (`auth.users`). La tabla `usuario` guarda el perfil de app y el `rol_id`, enlazada por `usuario.auth_user_id → auth.users.id` (migración [`0014`](../db/migrations/0014_supabase_auth.sql)).
- **Sincronización:** un trigger `handle_new_auth_user()` enlaza por email (usuarios se *invitan*, no se registran) o crea un perfil mínimo.
- **RBAC:** roles + permisos por módulo (`rol`, `permiso`, `rol_permiso`), evaluados con `can(rol, 'expedientes.escribir')`; `super_admin` siempre pasa.
- **Frontera de seguridad:** el acceso a datos de negocio va **siempre por el servidor** (`pg`, SQL parametrizado) autorizado con `requirePermission`. El cliente de Supabase se limita a Auth y Storage con la clave publicable; no se depende de RLS para las tablas de aplicación.

Implementación: `src/lib/supabase/{server,client}.ts`, `src/lib/auth.ts`, `src/lib/rbac.ts`, `src/middleware.ts`.

## 4. Estructura de carpetas (estado real)

```
src/
├─ app/[locale]/
│  ├─ (auth)/login/            # login (Supabase Auth) + Server Action
│  ├─ (portal)/                # área autenticada (Sidebar + TopBar por rol)
│  │  └─ dashboard/
│  ├─ layout.tsx · page.tsx    # layout raíz i18n + fuente Montserrat
│  └─ globals.css              # Tailwind 4 (CSS-first) + tokens de diseño
├─ components/
│  ├─ ui/                      # componentes base (button…)
│  └─ layout/                  # sidebar, topbar
├─ lib/
│  ├─ supabase/{server,client}.ts  # clientes SSR/browser
│  ├─ auth.ts · rbac.ts        # sesión + permisos
│  ├─ db.ts                    # pool pg + query()
│  ├─ anthropic.ts · email.ts · integrations.ts  # IA · Resend · n8n
│  ├─ nav.ts · utils.ts        # navegación por permisos · cn()
├─ server/                     # capa de dominio (patrón por módulo)
│  ├─ storage.ts               # Supabase Storage + tabla documento
│  ├─ auth/actions.ts          # cerrar sesión
│  ├─ estudiantes/ · academico/ · patrocinadores/ · finanzas/
│  ├─ solicitudes/ · operaciones/ · academias/ · comida/
│  ├─ usuarios/ · ia/ · reportes/ · dashboard/ · landing/   # types · schema · queries · actions
│  └─ (S5–S11: backend por dominio construido; UI pendiente)
├─ i18n/                       # routing · request · navigation (es/en)
└─ middleware.ts               # i18n + sesión + protección de rutas
messages/                      # es.json · en.json · fr.json · it.json
db/                            # migraciones .sql (0001–0031) + seed + README
docs/                          # esta documentación
```

## 5. Convenciones del stack

- **Sin ORM:** `pg` con parámetros posicionales (`$1,$2…`); nunca interpolar entrada del usuario.
- **Patrón por dominio:** cada módulo en `src/server/<dominio>/` con `types.ts` · `schema.ts` (Zod) · `queries.ts` (lectura) · `actions.ts` (escritura + `requirePermission`).
- **Tailwind 4 CSS-first:** los tokens viven en `globals.css` (`@theme inline`); no hay `tailwind.config.ts`.
- **i18n:** textos en `messages/{es,en}.json` (mismas claves); enums como código en BD, traducidos solo en la UI. Navegación con los helpers de `src/i18n/navigation.ts`.
- **Iconos:** solo `lucide-react`. **Emojis prohibidos** como iconos.
- **Documentación:** comentario de cabecera por archivo y en funciones no triviales (proyecto de tesis).

## 6. Versiones de referencia

| Paquete | Versión |
|---|---|
| next | 16.2.x |
| react / react-dom | 19.2.x |
| tailwindcss / @tailwindcss/postcss | 4.x |
| @supabase/supabase-js / @supabase/ssr | 2.x / 0.7.x |
| next-intl | 4.x |
| leaflet / react-leaflet | 1.9.x / 5.x |
| motion | 12.x |
| recharts | 3.x |
| zod | 4.x |
| resend | 6.x |
| sharp | 0.34.x |
| pg | 8.x |

> Node.js ≥ 20.9 (requisito de Next 16). Ver también la [Guía de Desarrollo](07-guia-desarrollo.md).
