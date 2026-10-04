# Documentación — Global Effect Nexus

ERP institucional de la **Fundación Global Effect**: gestión académica, expedientes, patrocinio, operaciones, finanzas y solicitudes y aprobaciones, con el **portal del estudiante integrado**.
Toda la documentación del proyecto está centralizada en esta carpeta: **un archivo por tema**, sin duplicados.

## Índice

| # | Documento | Contenido |
|---|---|---|
| 01 | [Visión y Alcance](01-vision-y-alcance.md) | Propósito, stack, roles, alcance y estado del proyecto. |
| 02 | [Arquitectura Técnica](02-arquitectura-tecnica.md) | Capas, estructura de carpetas y decisiones de arquitectura. |
| 03 | [Módulos Funcionales](03-modulos-funcionales.md) | Catálogo de los 27 módulos, portales y flujos automatizados. |
| 04 | [Modelo de Datos](04-modelo-de-datos/) | ERD, DFD, diccionario de datos y normalización. |
| 05 | [Plan de Trabajo](05-plan-de-trabajo.md) | Cronograma, próximos pasos y backlog de los 14 sprints. |
| 06 | [Plan de Entregas](06-plan-de-entregas.md) | Guía para producir las entregas de la tesis (E2–E6). |
| 07 | [Guía de Desarrollo](07-guia-desarrollo.md) | Convenciones, patrón de módulos, RBAC, i18n, migraciones y flujo de Git (para desarrollar). |
| 08 | [Stack Tecnológico](08-stack-tecnologico.md) | Stack definitivo (fuente de verdad): framework, Supabase Auth, integraciones, versiones. |
| 09 | [Sistema visual](09-sistema-visual.md) | Norma visual: tokens, tipografía, radios, sombras y patrones de pantalla. Va con [`.claude/rules/design-system.md`](../.claude/rules/design-system.md). |

> **La norma de diseño manda sobre el código.** Si una pantalla y
> [`09-sistema-visual.md`](09-sistema-visual.md) no coinciden, gana el documento.
> Es **el único** documento de diseño junto con las reglas de
> `.claude/rules/design-system.md`, que lo resumen para los agentes.

### 04 · Modelo de datos
- [Diagrama Entidad-Relación](04-modelo-de-datos/diagrama-entidad-relacion.md) — ERD Mermaid (global + por dominio) y matriz de relaciones.
- [Diagrama de Flujo de Datos (DFD)](04-modelo-de-datos/diagrama-flujo-datos.md) — contexto y procesos (Cuarta Entrega).
- [Diccionario de Datos](04-modelo-de-datos/diccionario-de-datos.md) — generado desde la BD real.
  ⚠️ Refleja el esquema hasta la migración `0019`, más el retiro de psicología (`0030`) y las solicitudes (`0031`); falta regenerarlo desde la BD tras `0020`–`0029`.
- [Normalización y Escalabilidad](04-modelo-de-datos/normalizacion-y-escalabilidad.md) — SMART, 1NF–3NF, escalabilidad e IA.
- Formatos de diagrama: [`esquema.dbml`](04-modelo-de-datos/esquema.dbml) (dbdiagram.io) · [`diagrama-flujo-datos.drawio`](04-modelo-de-datos/diagrama-flujo-datos.drawio) (draw.io).

## Otras carpetas

| Carpeta | Contenido |
|---|---|
| [`estado/`](estado/) | Documentos vivos de avance: [progreso por pantalla](estado/progreso.md), [pendientes](estado/pendientes.md), [plan por etapas](estado/plan-etapas.md) e [inventario frente a fases](estado/inventario-vs-fases.md). |
| [`referencia/`](referencia/) | Descripciones funcionales vigentes: [módulos por portal](referencia/modulos-por-portal.md) y [dependencias](referencia/dependencias.md). |
| [`prompts/`](prompts/) | Prompts operativos para los agentes de IA, como el [rediseño de app web](prompts/rediseno-app-web.md). |
| [`prototipo-base44/`](prototipo-base44/) | **Histórico, no normativo:** los documentos del prototipo v1 sobre Base44 (React + Vite). Ver su [README](prototipo-base44/README.md). |
| [`entregables/`](entregables/) | Documentos formales de la tesis: guía de entregas, primera entrega, [contexto general](entregables/contexto-general.md), análisis académico, plan de entregas (PDF). |
| [`fuentes-datos/`](fuentes-datos/) | Datos crudos de origen: planificación de sprints (CSV) e [inventario del prototipo v1 frente al código actual](fuentes-datos/inventario-prototipo-vs-actual.md). No normativos. |

## Artefactos de base de datos (código)

| Ubicación | Contenido |
|---|---|
| [`../db/migrations/`](../db/migrations/) | Migraciones SQL numeradas por dominio (`0001`–`0031`; `0014` = integración con Supabase Auth; `0030` retira psicología; `0031` = solicitudes y aprobaciones). |
| [`../db/seed.sql`](../db/seed.sql) | Datos semilla: roles, permisos, usuario maestro, datos de prueba. |
| [`../db/README.md`](../db/README.md) | Guía de despliegue y verificación de la base de datos. |
| `../.env.example` | Plantilla de variables de entorno. |

## Estado del proyecto (2026-08-06)

- ✅ **S0–S3 (Base de datos):** diseñada, normalizada (1NF–3NF), desplegada y verificada en Supabase — 36 tablas, RBAC, pgvector.
- ✅ **Documentación de cimientos** completa (visión, arquitectura, módulos, ERD, DFD, diccionario, normalización, plan) + [stack definitivo](08-stack-tecnologico.md).
- ✅ **Migración de stack:** Next.js 16, Tailwind CSS 4 (CSS-first), Supabase Auth, i18n `es/en`, y libs nuevas (Leaflet, motion, sharp, Resend).
- ▶️ **S4 — Backend núcleo (en curso):** Supabase Auth + RBAC (`proxy.ts` + `requirePermission`), login, capa `server/` por dominio, Storage y layout del portal. Build y lint en verde.
- ✅ **S5 — Expedientes y Panel:** CRUD de expedientes por pestañas, detalle con GPA y gráficos, OCR con IA y panel principal armado por permisos.
- ✅ **S9 — Administrativo y Calendario:** Kanban con automatizaciones (correo + evento espejo), proyectos con avance calculado, personal y calendario mensual.
- ✅ **S6 — Académico y portales por rol:** materias, cursos, calificaciones, historial, prematrícula y períodos; **Portal Estudiante** y **Portal Profesor**, con el vínculo docente ↔ usuario resuelto por FK en la migración `0019`.
- ✅ **Portales por rol:** se suman Administrativo, Contabilidad, Cursos Técnicos (selector) y Estudiante CT, sobre un patrón común (`components/portal/`). Cada uno con su **login propio** (`/login/<portal>`).
- ✅ **Contabilidad (módulo 14):** ingresos, egresos y balance.
- ✅ **Expediente completo en diálogo** de siete pestañas, con el **OCR por IA**. El expediente es de administración (`admin` y `super_admin`).
- ✅ **Cambio de alcance (oct 2026):** la Fundación eliminó el departamento de Psicología. El sistema pasa a ser un **ERP institucional** con portal del estudiante integrado; la migración `0030` retira el rol `psicologo`, sus permisos y sus tablas.
- ✅ **Solicitudes y aprobaciones (módulos 15 y 22, migración `0031`):** una bandeja con flujo por pasos para los trámites del estudiante (constancias, cartas, citas con administración, permisos) y las aprobaciones internas (alta de expediente, beca, gasto), con segundo nivel de dirección y línea de tiempo.
- ✅ **Sistema visual y su norma:** ver [`09-sistema-visual.md`](09-sistema-visual.md).
- ✅ **Blog público** (migración `0020`): noticias redactadas por administración + actividades ya celebradas, en una sola rejilla.

Ver los próximos pasos en [Plan de Trabajo](05-plan-de-trabajo.md).

## Resumen de la base de datos

- **Motor:** PostgreSQL 17 (Supabase). SQL a mano, sin ORM, consultas parametrizadas.
- **37 tablas · 351 columnas · 7 enums · 44 FKs · 20 triggers.** (Sin contar `_migracion`, tabla de control del runner. Cifras recalculadas tras `0030` y `0031`: salen tres tablas de psicología y entran `solicitud` y `solicitud_paso`.)
- **Extensiones:** `pgcrypto`, `citext`, `pg_trgm`, `vector` (pgvector 0.8, índice HNSW).
- **Extensibilidad:** columna `metadata JSONB` en las 14 entidades principales.
- **Credenciales semilla:** las seis cuentas de demostración comparten la contraseña
  `GlobalEffect2026!` (ver la tabla completa en el [README raíz](../README.md)).
  Se generan con `npm run db:seed:usuarios`; la contraseña se puede cambiar con
  `DEMO_PASSWORD` antes de correr el script.
