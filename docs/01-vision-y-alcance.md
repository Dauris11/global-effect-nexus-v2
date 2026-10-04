# Visión y Alcance — Global Effect Nexus

> Documento de visión del proyecto: propósito, alcance funcional, roles y estado. Última actualización: 2026-10-03.

## 1. Visión general

**Global Effect Nexus** es el **ERP institucional** de la **Fundación Global Effect** (República Dominicana), con el **portal del estudiante integrado**. Centraliza en un solo sistema la gestión académica, los expedientes, el patrocinio, las operaciones, las finanzas y las solicitudes y aprobaciones, además de las tareas y la comunicación institucional.

> **Cambio de alcance (octubre 2026).** La Fundación eliminó su departamento de Psicología; lo que hacía pasa a la parte administrativa. El módulo de psicología, su rol y sus tablas salen del sistema (migración `0030`) y su lugar lo ocupa el módulo de **Solicitudes y aprobaciones** (migración `0031`). Psicología queda fuera del alcance.

El sistema se construye con arquitectura propia de extremo a extremo: frontend **Next.js 16 (App Router)** y backend sobre **PostgreSQL** (Supabase) con SQL parametrizado (sin ORM), autenticación con **Supabase Auth** y control de acceso por roles (RBAC) propio, almacenamiento de archivos, asistentes de IA, envío de correos e internacionalización (es/en).

## 2. Stack tecnológico

- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 + Radix UI + componentes propios
- **Estado/datos:** TanStack React Query + Server Actions
- **Base de datos:** PostgreSQL 17 (Supabase, PostGIS) con `pg` (node-postgres) y SQL parametrizado a mano
- **Autenticación:** Supabase Auth (`@supabase/ssr`) — email + contraseña, sesión en cookies + RBAC propio (6 roles)
- **Internacionalización:** next-intl (es / en / fr / it), ruta por locale `/[locale]/...`
- **Validación:** React Hook Form + Zod
- **UI/gráficos/fechas/mapas:** Lucide React · Recharts · date-fns · Leaflet + react-leaflet (OpenStreetMap) · motion
- **IA:** Anthropic (OCR, chat, traducción) + pgvector para búsqueda semántica/RAG
- **Archivos:** Supabase Storage + `sharp` + tabla `documento`
- **Integraciones:** n8n (webhooks/CRM) · Resend (emails) · GENIALiA (CRM)

> Detalle completo y versiones en [08 · Stack Tecnológico](08-stack-tecnologico.md).

### ¿Por qué SQL a mano y no un ORM?
- Se documenta y justifica cada tabla, índice y constraint (relevante para la defensa académica).
- Las consultas parametrizadas (`$1`, `$2`…) son la defensa directa contra inyección SQL.
- El costo (más código, sin tipado automático de filas) se compensa con Zod + interfaces TypeScript por entidad.

## 3. Roles y control de acceso (RBAC)

Cada usuario ve un menú lateral distinto según su rol. Los usuarios se **invitan**, no se registran.

| Rol | Alcance |
|---|---|
| `super_admin` | Acceso absoluto: configuración, auditoría y todos los datos |
| `admin` | Administración general operativa y todos los módulos |
| `docente` | Portal docente: cursos, materias, calificaciones |
| `estudiante` | Portal estudiantil: materias, notas, calendario y solicitudes (constancias, cartas, citas con administración, permisos) |
| `contabilidad` | Transacciones, balances, reportes financieros; aprueba solicitudes de gasto |
| `habitudes` | Postula candidatos del embudo de reclutamiento (`expedientes.postular`) |

**Expedientes:** son de administración. `admin` y `super_admin` leen, escriben y eliminan sobre todos los estudiantes; `habitudes` solo postula candidatos.

**Aprobaciones:** `solicitudes.gestionar` revisa solicitudes (admin y super_admin); `solicitudes.direccion` da el segundo nivel de dirección (super_admin).

## 4. Alcance funcional (27 módulos + portales)

**Públicos (sin login):** Landing pública · Inscripción de comida (`/comida`).

**Autenticados:**
- **Dashboard:** métricas en tiempo real, gráficos financieros, tareas y eventos.
- **Expedientes:** CRUD del perfil integral + **OCR con IA**; formulario de 6 pestañas; detalle con GPA y gráficos.
- **Académico:** Materias, Cursos técnicos, Calificaciones, Historial, Prematrícula, Períodos.
- **Academias:** Programas de liderazgo/habilidades y Materiales educativos.
- **Patrocinio:** Patrocinadores y Asignación de becas.
- **Contabilidad:** ingresos/egresos/becas, balance.
- **Solicitudes y aprobaciones:** trámites del estudiante y aprobaciones internas (alta de expediente, beca, gasto) en una bandeja con flujo por pasos, segundo nivel de dirección y línea de tiempo.
- **Administrativo:** Tareas (Kanban + email + evento automático), Proyectos, Gestión de personal.
- **Calendario:** eventos + tareas con vencimiento; agenda a 30 días.
- **IA:** Chat interno (contexto de toda la BD) y Chat estudiantil.
- **Reportes:** dashboards (Proyectos / Académico / Contabilidad).
- **Otros:** Servicios mensuales (export PDF), Configuración, Sitemap.

**Portales por rol:** Administración (`/portal/administrativo` + `/dashboard`), Estudiante, Profesor, Contabilidad, y la entrada de Habitudes en `/expedientes`. Cursos técnicos conserva su selector.

### Flujos automatizados clave
1. **OCR → Expediente:** subir documento → IA extrae datos → guarda/precarga formulario (con trazabilidad en `extraccion_ocr`).
2. **Tarea → Notificación:** crear tarea con asignados → correo a cada uno → evento en calendario.
3. **Inscripción comida:** validar hora (≤ 8:30 AM) + no duplicado → registro → confirmación.
4. **Servicios mensuales:** toggle → upsert de registro.
5. **Chat IA:** contexto desde entidades (+ recuperación semántica RAG) → respuesta markdown.
6. **Solicitud → Aprobación:** enviada → en revisión → [pendiente de dirección] → aprobada → completada; cada paso queda en `solicitud_paso` y notifica al solicitante y a los revisores.

## 5. Estado del proyecto (2026-07-01)

- ✅ **Base de datos:** diseñada, normalizada (1NF–3NF), desplegada y verificada en Supabase (36 tablas, soporte de IA con pgvector). Ver [modelo de datos](04-modelo-de-datos/).
- ✅ **Documentación de cimientos:** ERD, diccionario de datos, normalización/escalabilidad, guía de despliegue y [stack](08-stack-tecnologico.md).
- ▶️ **Aplicación Next.js (S4 en curso):** Supabase Auth + RBAC, i18n (es/en), capa `server/` por dominio, Storage y layout del portal. Build/lint en verde.
- ✅ **Cambio de alcance (2026-10):** fin de psicología (`0030`) y módulo de Solicitudes y aprobaciones (`0031`). El sistema se describe como ERP institucional con portal del estudiante integrado.

Ver el [plan de trabajo](05-plan-de-trabajo.md) para el detalle de sprints y próximos pasos.
