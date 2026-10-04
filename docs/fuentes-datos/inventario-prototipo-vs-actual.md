# Inventario del prototipo v1 frente al código actual

> **Qué es esto.** El inventario de módulos recibido el **2026-07-31** describe el
> **prototipo anterior** (Vite + React Router + `.jsx`). Este documento lo conserva
> con su misma estructura (A–F) y le añade el **estado real** medido contra el
> código de este repositorio.
>
> Fuente de verdad del avance: [05 · Plan de Trabajo](../05-plan-de-trabajo.md).
>
> **Solo compara módulos, rutas y roles.** La comparación visual que este
> documento traía se retiró junto con la documentación de estilos: el proyecto
> está sin estilos a propósito, así que no hay sistema vigente con el que
> contrastar.
>
> **Cambio de alcance (oct 2026).** La Fundación eliminó su departamento de
> Psicología. Las filas del prototipo que hablan de psicología se conservan
> porque el prototipo las tenía, pero quedan marcadas como descartadas: su lugar
> lo ocupa el módulo de **Solicitudes y aprobaciones** (migraciones `0030` y `0031`).

## 0. Divergencia de stack (leer primero)

El inventario asume un proyecto que **no es este**. Ninguna ruta de archivo que
cita existe:

| Aspecto | Prototipo v1 (documentos) | Este repositorio (medido) |
|---|---|---|
| Framework | Vite + React Router (`Outlet`, `ProtectedRoute`) | **Next.js 16.2.10** App Router |
| Lenguaje | `.jsx` — 0 en el repo | **`.tsx` — 108 archivos** |
| Páginas | `src/pages/Inicio.jsx` | `src/app/[locale]/**/page.tsx` |
| Rutas | `/dashboard` | **`/[locale]/dashboard`** (es · en) |
| Auth | `AuthContext` + `RoleContext` | **Supabase Auth + JWKS + RBAC en `src/server/auth`** |
| Markdown | `react-markdown` | **no instalado** |
| i18n | — | **next-intl, 905 claves es/en** |

Comprobado: `src/index.css` y `src/pages/` → no existen · `react-markdown`, `react-router-dom`, `vite` → no instalados.

---

## A. Página pública

| # | Módulo | Ruta del inventario | Estado real |
|---|---|---|---|
| A.1 | Landing / Inicio | `/` | ✅ `/[locale]` — navbar, hero slider, stats, portales, eventos, valor, footer. **Hero configurable por BD** (`/configuracion/landing`), no hardcodeado |
| A.2 | Inscripción de comida (pública) | `/comida` | ✅ `/[locale]/comida` — responde 200 sin sesión |

## B. Plataforma interna

| # | Módulo | Inventario | Estado real |
|---|---|---|---|
| 1 | Dashboard general | `/dashboard` | ✅ `/[locale]/dashboard` |
| 2 | Expedientes | `/expedientes` | ✅ + `nuevo`, `[id]`, `[id]/editar` (S5) |
| 3.1 | Cursos técnicos | `/academico/cursos` | ✅ tarjetas con barra de ocupación |
| 3.2 | Materias | `/academico/materias` | ✅ tabla desktop / tarjetas mobile |
| 3.3 | Calificaciones | `/academico/calificaciones` | ✅ 4 bandas de color + color al teclear |
| 3.4 | Historial académico | `/academico/historial` | ✅ con GPA y filtros |
| 3.5 | Prematrícula | `/academico/prematricula` | ✅ inscripción por desplegables |
| 3.6 | Períodos | `/academico/periodos` | ✅ con edición de estado |
| 4 | **Academias** (programas, materiales) | `/academias/*` | ❌ **sin UI** — backend en `server/academias/` · S10 |
| 5.1 | Patrocinadores | `/patrocinadores` | ❌ **sin UI** — backend listo · `nav.ts` lo marca `disponible: false` · S7 |
| 5.2 | Asignación de becas | `/patrocinadores/becas` | ❌ **sin UI** — backend listo · S7 |
| 6 | Psicología | `/psicologia` | **Descartado**: el departamento de Psicología se eliminó (oct 2026). Lo sustituye **Solicitudes y aprobaciones** en `/administrativo/solicitudes` · S8 |
| 7.1 | Tareas (Kanban) | `/administrativo/tareas` | ✅ + email automático y evento de calendario |
| 7.2 | Proyectos | `/administrativo/proyectos` | ✅ |
| 7.3 | Gestión de personal | `/administrativo/personal` | ✅ |
| 8 | Contabilidad | `/contabilidad` | ❌ **sin UI** — backend listo · `disponible: false` · S7 |
| 9 | Calendario y agenda | `/calendario` | ✅ |
| 10 | **Chat IA** (admin + estudiantil) | `/chat-ia`, `/chat-ia-estudiantil` | ❌ **sin UI** — backend en `server/ia/` · S11. Requiere `ANTHROPIC_API_KEY` |
| 11 | Cita de psicología (estudiante) | `/cita-psicologia` | **Descartado**: el departamento de Psicología se eliminó (oct 2026). Lo sustituyen las solicitudes del estudiante en `/portal/estudiante/solicitudes` · S8 |
| 12 | Reportes visuales | `/reportes` | ❌ **sin UI** — backend en `server/reportes/` · `disponible: false` · S11 |
| 13 | Servicios mensuales | `/servicios-mensuales` | ✅ |
| 14 | Inscripción comida (interno) | `/inscripcion-comida` | ✅ requiere sesión (`operaciones.leer`) |
| 15 | Configuración | `/configuracion` | ✅ + `configuracion/landing` (**no está en el inventario**) |
| 16 | **Sitemap** | `/sitemap` | ❌ **no existe** y no está en ningún sprint |

**Resumen B:** de los 16 módulos del inventario, **2 quedan descartados** con la eliminación del departamento de Psicología (Psicología y Cita de psicología, sustituidos por Solicitudes y aprobaciones); **5 están sin UI** (Academias, Patrocinadores+Becas, Contabilidad, Chat IA, Reportes) y **1 no existe en el plan** (Sitemap).

## C. Portales por rol

| # | Portal | Inventario | Estado real |
|---|---|---|---|
| 1 | Estudiante | `/portal/estudiante` | ✅ banner GPA, materias, calificaciones por cuatrimestre, condición, eventos (S6 #395–#399) |
| 2 | Profesor | `/portal/profesor` | ✅ banner, accesos rápidos por permiso, cursos con ocupación (S6 #400–#403) |
| 3 | Administrativo | `/portal/administrativo` | ❌ **no existe.** El rol `admin` aterriza en `/dashboard` |
| 4 | Psicología | `/portal/psicologia` | **Descartado**: el departamento de Psicología se eliminó (oct 2026) |
| 5 | Contabilidad | `/portal/contabilidad` | ❌ no existe · S7 |
| 6 | Cursos técnicos (selector) | `/portal/cursos-tecnicos` | ❌ no existe. Sustituido por `HOME_POR_ROL`: cada rol aterriza directo, sin pantalla de selección |
| 7 | Estudiante CT | `/portal/estudiante-ct` | ❌ no existe — **fusionado** en `/portal/estudiante` (un solo portal para becados y CT) |

**Nota de diseño:** el acceso a un portal **no lo da un permiso, lo da la propiedad de la fila** (`estudiante.usuario_id = <yo>`). Por eso `NavItem` tiene `roles?: string[]` y no basta con `permiso`.

## D. Componentes transversales

| Prototipo | Actual |
|---|---|
| `AppLayout.jsx`, `Sidebar.jsx`, `TopBar.jsx` | ✅ `src/components/layout/` — `sidebar.tsx`, `topbar.tsx`, `nav-list.tsx`, `mobile-nav.tsx` |
| `ExpedienteDetalle`, `FormFamiliar`, `FormSeguimiento` | ✅ equivalentes dentro de `expedientes/` |
| `BuscadorEstudiantes`, `PageHeader`, `EmptyState`, `StatCard` | ✅ `page-header.tsx`, `empty-state.tsx`, `stat-card.tsx` en `components/ui/` |
| `AuthContext`, `RoleContext`, `ProtectedRoute` | ⚠️ **no aplica** — sustituido por Supabase Auth + `proxy.ts` + `requirePermission` en servidor |

**Inventario de `components/ui/` (26, no en el documento del prototipo):**
`avatar` · `badge` · `barra-progreso` · `button` · `card` · `checkbox` · **`chip-estado`** · `dialog` · **`dock`** · `dropdown-menu` · `empty-state` · **`field`** · **`icono`** · `input` · `label` · **`lienzo-trazo`** · `page-header` · **`rail`** · `select` · `separator` · **`side-panel`** · `skeleton` · `stat-card` · `table` · `tabs` · `textarea` · `tooltip`

En negrita, los que **no existen en el prototipo** y son propios del estándar actual (riel de estado, chips, dock, lienzo).

## E. Entidades de base de datos

| Prototipo | Actual |
|---|---|
| **15 entidades** (Estudiante, Materia, Curso, Academia, Calificacion, HistorialCalificacion, Patrocinador, Transaccion, CitaPsicologia, Tarea, Proyecto, Evento, Material, RegistroServicio, InscripcionComida) | **37 tablas** en Supabase (`information_schema`, esquema `public`), tras retirar las de psicología (`0030`) y añadir `solicitud` y `solicitud_paso` (`0031`) |

El prototipo no contempla: RBAC (`rol`, `permiso`, `rol_permiso`), `usuario`, perfiles del expediente, familiares, seguimiento, períodos, inscripciones, hero de la landing, ni las tablas de IA con `pgvector`. `CitaPsicologia` ya no tiene equivalente (descartada: el departamento de Psicología se eliminó, oct 2026). Detalle en [Diccionario de Datos](../04-modelo-de-datos/diccionario-de-datos.md).

## F. Roles y rutas accesibles

Los **nombres de rol no coinciden**:

| Prototipo | Actual (`db/seed.sql`) |
|---|---|
| `admin` | `super_admin` **y** `admin` (son dos: el primero además da la aprobación de dirección, `solicitudes.direccion`) |
| `profesor` | **`docente`** |
| `administrativo` | no existe como rol — lo cubre `admin` |
| `estudiante` | ✅ `estudiante` |
| `psicologia` | no existe — descartado: el departamento de Psicología se eliminó (oct 2026); las cuentas `psicologo` pasaron a `admin` |
| — | **`habitudes`** (postula candidatos al expediente; no está en el prototipo) |
| `contabilidad` | ✅ `contabilidad` |

**Diferencia de modelo:** el prototipo lista rutas fijas por rol. El actual **no**: la navegación se filtra por **permiso** (`permiso`/`permisos` en `nav.ts`) y los portales por **rol exacto** (`roles`). Ejemplo de por qué importa: `/academico/calificaciones` no se gatea con `academico.leer` —el estudiante lo tiene, para el catálogo de materias— sino con `calificaciones.registrar` **o** `expedientes.leer`. Con el modelo del prototipo, un estudiante vería las notas de sus compañeros.

---

## Resumen

| Concepto | Prototipo v1 | Actual |
|---|---|---|
| Páginas públicas | 2 | **2** ✅ |
| Módulos internos | 16 | **8 con UI**, 5 sin UI, 2 descartados (psicología), 1 inexistente (Sitemap) |
| Portales por rol | 7 | **2** (Estudiante, Profesor); 2 fusionados/sustituidos, 2 pendientes, 1 descartado (Psicología) |
| Componentes transversales | 11 | **26** en `components/ui/` + 4 de layout |
| Entidades de BD | 15 | **37 tablas** |
| Roles | 6 | **6**, con otros nombres (sin psicología; con `habitudes`) |
| Idiomas | 1 | **2** (es · en, 897 claves) |

**Trabajo real que se desprende:** lo que falta es **UI, no backend** — `src/server/*` ya está construido para S7–S11. Los módulos sin pantalla del inventario coinciden con los sprints pendientes: **S7** (Patrocinadores, Becas, Contabilidad), **S8** (replanteado como Solicitudes y aprobaciones; Psicología y Cita estudiante descartadas), **S10** (Academias), **S11** (Chat IA, Reportes).
