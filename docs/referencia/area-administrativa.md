# Área Administrativa y Operaciones — Referencia Técnica y Funcional

Documento de referencia del área administrativa / ERP operativo de **Portal GlobalEffect** (Fundación Global Effect). Describe rutas, permisos, capa servidor y cómo se conectan las **tareas, asignaciones, proyectos, actividades diarias, torre de control y roles**.

---

## 1. Entrada y Visión General

El antiguo `/portal/administrativo` ahora redirige automáticamente a **`/bandeja`** (`src/app/[locale]/(portal)/portal/administrativo/page.tsx`).

- **Entrada principal (`admin` y `super_admin`):** `src/app/[locale]/(portal)/bandeja/page.tsx`
  - Protegida con `requerirRol(["admin", "super_admin"])`.
  - Carga datos mediante `cargarBandeja(usuario)` (`src/server/bandeja/consultas.ts`).
  - Cada bloque se consulta **solo si el usuario tiene el permiso correspondiente** (`usuarioTienePermiso`). Si no lo tiene, el bloque llega como `null` y no se renderiza:
    - `operaciones.leer` → pendientes de la fundación, tareas de usuario (`tareasDeUsuario`) y proyectos de usuario (`proyectosDeUsuario`).
    - `reuniones.leer` → próximas reuniones (`listarReuniones`).
    - `finanzas.leer` → flujo financiero de 6 meses (`flujoFinanciero`).
    - Siempre visible para el usuario → solicitudes por atender (`cuantasPorAtender`, excluyendo las propias por separación de funciones) y notificaciones (`misNotificaciones`).

---

## 2. Mapa de Permisos (RBAC)

Definidos en `src/lib/rbac.ts` y evaluados siempre con `usuarioTienePermiso(usuario, ...)`:

| Permiso | Qué habilita en el área administrativa |
|---|---|
| `operaciones.leer` | Ver tablero general de tareas, proyectos, Gantt, torre propia y pendientes en Bandeja. |
| `operaciones.escribir` | Crear/mover/reprogramar tareas, crear/editar proyectos, gestionar equipo de proyecto y ver la **Torre del Equipo** (`cargaPorPersona`). |
| `proyectos.asignar_rol` | Acceder a la matriz de **Proyectos por Rol** (`/administrativo/proyectos/roles`, reservado a `super_admin` por defecto). |
| `usuarios.administrar` | Gestionar cuentas de personal y asignación de roles en `/administrativo/personal`. |
| `rendicion.enviar` / `rendicion.revisar` | Enviar rendiciones de gastos con OCR/NCF o aprobarlas/revisarlas en `/administrativo/rendiciones`. |
| `inventario.leer` / `escribir` / `auditar` / `eliminar` | Ver, crear/editar, auditar o eliminar activos en `/administrativo/inventario`. |
| `transporte.gestionar` | Monitorear el mapa en vivo (TIMOB), consultar listas de pasajeros por turno, activar/pausar horarios oficiales y revisar incidencias en `/administrativo/transporte`. |

> **Nota de acceso a proyectos:** En `/administrativo/proyectos/[id]`, un usuario sin `operaciones.leer` igual puede entrar si `participaEnProyecto(sesion.id, id)` devuelve `true` (por ejemplo, personal de Habitudes, contabilidad o chofer asignado a un proyecto). La gestión del equipo del proyecto dentro de esa pantalla requiere `operaciones.escribir`.

---

## 3. Módulos Principales (Tareas, Proyectos, Actividades y Roles)

### 3.1 Tablero General de Tareas (`/administrativo/tareas`)
- **Página:** `src/app/[locale]/(portal)/administrativo/tareas/page.tsx`
- **Componente cliente:** `TableroTareas`
- **Capa servidor:**
  - `src/server/operaciones/consultas.ts`: `proyectosSimples()`, `tareasDelTablero()`, `usuariosAsignables()`.
  - `src/server/operaciones/acciones.ts`: `crearTarea()`, `moverTarea()`, `reprogramarTarea()`.
- **Funcionamiento:** Tablero Kanban del equipo. La visibilidad de cada tarea se resuelve en SQL dentro de `tareasDelTablero`. Quien tiene `operaciones.leer` consulta; quien tiene `operaciones.escribir` puede crear, mover entre columnas y reprogramar fechas.

### 3.2 Mi Día / Actividades Diarias (`/administrativo/tareas/hoy`)
- **Página:** `src/app/[locale]/(portal)/administrativo/tareas/hoy/page.tsx`
- **Componente cliente:** `VistaHoy`
- **Capa servidor:**
  - `src/server/colaborador/consultas.ts`: `tareasColaborador()`, `bitacoraDeHoy()`, `proyectosPorRol()`, `resumenColaborador()`.
  - `src/server/colaborador/acciones.ts`: `cambiarEstadoTareaColaboradorAction()`, `crearTareaRapidaColaboradorAction()`, `registrarBitacoraDiariaAction()`.
- **Funcionamiento:** Centro diario para todo el personal institucional (`requerirUsuario()`). Muestra las tareas asignadas a la persona, la bitácora de actividades del día y los proyectos asociados a su rol, con accesos contextuales al tablero general (si tiene `operaciones.leer`) y a rendiciones (si tiene `rendicion.enviar`).

### 3.3 Proyectos, Fases y Gantt (`/administrativo/proyectos` y `/administrativo/proyectos/[id]`)
- **Lista de proyectos:** `src/app/[locale]/(portal)/administrativo/proyectos/page.tsx`
  - **Componente:** `GestionProyectos`.
  - **Consultas / Acciones:** `proyectosConAvance()` (`src/server/operaciones/consultas.ts`), `guardarProyecto()` (`src/server/operaciones/acciones.ts`).
- **Detalle y Gantt del proyecto:** `src/app/[locale]/(portal)/administrativo/proyectos/[id]/page.tsx`
  - **Componentes:** `LineaTiempo` (Gantt por fases del proyecto o colgadas del proyecto raíz) y `EquipoProyecto` (cuando `operaciones.escribir` está activo).
  - **Consultas / Acciones:**
    - `proyectoParaGantt()` (`src/server/operaciones/gantt-consultas.ts`)
    - `actualizarFechasTareaGantt()`, `agregarDependenciaTarea()`, `eliminarDependenciaTarea()`, `crearFaseProyecto()` (`src/server/operaciones/gantt-acciones.ts`)
    - `moverBarra()` (`src/server/calendario/acciones-gantt.ts`)
    - `equipoDeProyecto()`, `participaEnProyecto()` (`src/server/operaciones/torre-consultas.ts`) y `guardarEquipoProyecto()` (`src/server/operaciones/torre-acciones.ts`).
- **Gantt global:** `/calendario/gantt` (`src/app/[locale]/(portal)/calendario/gantt/page.tsx`) agrupa líneas de tiempo transversales (académico, clases 360, operaciones y tareas).

### 3.4 Torre de Control (`/administrativo/torre-control` y `/equipo`)
- **Torre por persona:** `src/app/[locale]/(portal)/administrativo/torre-control/page.tsx`
  - **Componentes:** `TorreTareas`, `TorreProyectos`, `BotonAsignarTarea`, `SelectorPersona`.
  - **Consultas:** `personaTorre()`, `proyectosDeUsuario()`, `tareasDeUsuario()`, `tieneTareasAsignadas()` (`src/server/operaciones/torre-consultas.ts`).
  - **Acciones:** `avanzarTarea()`, `comentariosDeTarea()`, `comentarTarea()`, `editarTareaTorre()` (`src/server/operaciones/torre-acciones.ts`).
  - Permite filtrar con `?usuario=<id>` para supervisar la carga individual cuando el rol tiene permiso de coordinación.
- **Torre del equipo:** `src/app/[locale]/(portal)/administrativo/torre-control/equipo/page.tsx`
  - Requiere `operaciones.escribir`.
  - **Componente:** `TorreEquipo`.
  - **Consulta:** `cargaPorPersona()` y umbral `UMBRAL_CARGA_ALTA` (`src/lib/torre-control.ts`) para detectar cuellos de botella y redistribuir tareas.

### 3.5 Gobernanza de Proyectos por Rol (`/administrativo/proyectos/roles`)
- **Página:** `src/app/[locale]/(portal)/administrativo/proyectos/roles/page.tsx`
- **Permiso requerido:** `proyectos.asignar_rol`.
- **Componente:** `MatrizProyectosRoles`.
- **Capa servidor:** `matrizProyectosRoles()` (`src/server/colaborador/consultas.ts`) y `guardarAsignacionProyectosRolesAction()` (`src/server/colaborador/acciones.ts`).
- **Funcionamiento:** Define qué roles institucionales participan o tienen visibilidad sobre qué proyectos/programas (alimentando `proyectosPorRol` en "Lo que me toca hoy").

---

## 4. Otros Módulos ERP bajo `/administrativo/` y Gestión Académica/Patrocinio

- **Solicitudes (`/administrativo/solicitudes`):** Bandeja de solicitudes internas y de compras (`GraficasSolicitudes`, `FormularioCompra`, `FormularioSolicitud`, `TarjetaSolicitud`, `src/server/solicitudes/consultas.ts`).
- **Rendiciones de gastos (`/administrativo/rendiciones`):** Carga de facturas/comprobantes con escaneo OCR y validación NCF/RNC ante DGII imputados a programas, con gráficas de estado y montos DOP (`FormularioRendicionGasto`, `ListaRendiciones`, `src/server/colaborador/{consultas,acciones}.ts`).
- **Personal (`/administrativo/personal`):** Creación de cuentas de trabajo, asignación de roles y gráficas de estado de cuentas/reparto por rol (`usuarios.administrar`, `GraficasPersonal`, `GestionCuentas`, `src/server/personal/consultas.ts`).
- **Inventario (`/administrativo/inventario`):** Catálogo, métricas DOP, gráficas por estado/categoría, auditoría y escaneo QR de activos (`TablaActivos`, `src/server/inventario/consultas.ts`).
- **Transporte Institucional (`/administrativo/transporte`):** Monitoreo en vivo con mapa TIMOB del circuito universitario, turnos diarios (`transporte_horario`), pasajeros inscritos por turno, activación/pausa de horarios (`alternarHorarioTransporte`) y bitácora de incidencias (`obtenerResumenAdminTransporte`). Protegido por `transporte.gestionar`.
- **Asignación de materias (`/academico/materias`) y Clases 360 (`/academico/clases-360`):** Catálogo agrupado por período con asignación rápida de docente (`asignarDocenteMateria`), gráficos de cobertura docente y seguimiento de inscritos/entregas en 360 (`GestionMaterias`, `GestionClases360`).
- **Patrocinadores y Becas (`/patrocinadores`, `/patrocinadores/becas`):** Directorio y cobertura de becas con gráficas por tipo, becados por patrocinador y filtros de asignación (`GestionPatrocinadores`, `GestionBecas`).

