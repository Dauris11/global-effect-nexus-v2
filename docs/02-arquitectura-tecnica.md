# Arquitectura Técnica — Global Effect Nexus

> Arquitectura de la aplicación: capas, estructura de carpetas y decisiones clave. La base de datos se detalla en [03 · Modelo de datos](04-modelo-de-datos/).

## 1. Capas del sistema

```
┌────────────────────────────────────────────────────────────┐
│  Cliente (navegador)                                         │
│  Next.js App Router · React · shadcn/ui · React Query        │
└───────────────┬────────────────────────────────────────────┘
                │  Server Actions / Route Handlers
┌───────────────▼────────────────────────────────────────────┐
│  Servidor (Next.js 16)                                       │
│  • Supabase Auth + proxy (RBAC por ruta) + i18n              │
│  • Capa de dominio: queries.ts (SQL parametrizado) +         │
│    actions.ts + schema.ts (Zod) + types.ts                   │
│  • Servicios de IA (chat, OCR, embeddings/RAG)               │
└───────────────┬────────────────────────────────────────────┘
                │  pg (node-postgres), consultas $1,$2…
┌───────────────▼────────────────────────────────────────────┐
│  PostgreSQL 17 (Supabase) — 37 tablas, RBAC, pgvector       │
│  + Storage (documentos)                                      │
└────────────────────────────────────────────────────────────┘
```

## 2. Estructura de carpetas objetivo (Next.js)

```
global-effect-nexus/
├─ db/                        # migraciones .sql, seed.sql, README (✅ implementado)
├─ docs/                      # documentación / entregas (✅ este directorio)
├─ messages/                  # i18n: es.json, en.json
├─ src/
│  ├─ app/[locale]/
│  │  ├─ (auth)/login/        # login (Supabase Auth, sin sidebar) ✅
│  │  ├─ (portal)/            # área autenticada: dashboard ✅, expedientes ✅, academico ✅,
│  │  │                       #   portal/estudiante ✅, portal/profesor ✅, administrativo ✅,
│  │  │                       #   calendario ✅, configuracion ✅, academias, patrocinadores,
│  │  │                       #   contabilidad, administrativo/solicitudes, reportes
│  │  └─ (public)/            # landing, inscripción comida (S10)
│  ├─ components/             # ui/ (Radix + propios) · layout/ (sidebar, topbar) ✅
│  ├─ lib/                    # db.ts (pool pg) · supabase/ · auth.ts · rbac.ts · nav.ts · utils.ts
│  ├─ server/                 # lógica por dominio: queries + actions + schema (zod) + types · storage.ts
│  │                          #   `portales/` es la excepción: solo lectura, recortada a quien mira
│  ├─ i18n/  ·  proxy.ts (i18n + sesión + protección por rol)  · types/
├─ .env.local  ·  .env.example
├─ next.config.mjs · globals.css (Tailwind 4 CSS-first) · package.json
```

## 3. Decisiones de arquitectura

- **Acceso a datos sin ORM:** SQL a mano con `pg` y consultas parametrizadas; control total del DDL/DML y defensa contra inyección. Tipado con interfaces TypeScript + validación Zod en el borde.
- **Autenticación:** **Supabase Auth** (email + contraseña, sesión en cookies). Las credenciales viven en `auth.users`; la tabla `usuario` guarda perfil + `rol_id`, enlazada por `usuario.auth_user_id` (migración `0014`). `src/proxy.ts` y `rbac.ts` deciden el acceso por ruta/acción.
- **RBAC granular:** roles + permisos por módulo (`rol`, `permiso`, `rol_permiso`), evaluados con `can(rol, 'expedientes.escribir')` y exigidos con `requirePermission(...)` en las Server Actions.
- **Internacionalización:** segmento de ruta `/[locale]`, diccionarios `messages/{es,en}.json`. Los enums se guardan como código y se traducen en la UI (no en la BD).
- **Almacenamiento:** archivos en Supabase Storage; sus metadatos en la tabla `documento` (una FK en vez de URLs sueltas). Helper: `src/server/storage.ts`.
- **Aprobaciones como capa transversal:** el módulo de Solicitudes y aprobaciones (`src/server/` + tablas `solicitud`, `solicitud_paso`) registra la decisión y su rastro, pero no ejecuta efectos: el módulo dueño (contabilidad, expedientes, patrocinio) hace el cambio y la solicitud pasa a `completada`. Así el flujo de aprobación no duplica la lógica de cada dominio.
- **IA:** servicio propio para chat y OCR; contexto recuperado por búsqueda semántica (pgvector/RAG). Historial y extracciones persistidos y auditables.

> La implementación concreta (pool `pg`, Supabase Auth, RBAC, i18n) está en `src/lib/` y `src/i18n/`; el detalle del esquema en [Modelo de datos](04-modelo-de-datos/) y el stack completo en [08 · Stack Tecnológico](08-stack-tecnologico.md).
