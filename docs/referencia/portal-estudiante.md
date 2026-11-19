# Documentación Técnica — Área de Estudiantes (Portal Estudiantil)

Referencia completa de las rutas, reglas de negocio, capa servidor y componentes
del **Portal del Estudiante** en **Global Effect Nexus**.

---

## 1. Arquitectura y Reglas de Negocio

1. **Aislamiento de expediente:** el estudiante no consulta su ficha administrativa interna (historia de vida, situación familiar/económica o amonestaciones). `estudianteDeUsuario(usuarioId)` resuelve su perfil desde `usuario` con `LEFT JOIN estudiante` para operar incluso si aún no tiene ficha enlazada.
2. **Control de acceso (RBAC):** todas las pantallas del portal exigen `requerirRol(["estudiante"])` y las Server Actions verifican identidad desde la sesión (`usuario.id` / `estudiante.id`), nunca desde campos del formulario.
3. **Mínimo obligatorio cuatrimestral (`src/lib/reglas-academicas.ts`):**
   - `esEstudianteUniversitario(universidad)` identifica a los estudiantes con institución universitaria registrada.
   - `evaluarMinimoCuatrimestral` exige **al menos 2 clases por cuatrimestre** (sumando Global Effect 360 y carrera universitaria) únicamente a estudiantes universitarios.
   - `quitarseDeMateria` y `retirarPrematricula` bloquean en servidor (`minimo_clases`) retiros que dejen al estudiante universitario por debajo de 2 clases una vez iniciado el período o alcanzado el mínimo.
4. **Tope de créditos por convenio universitario (`src/lib/reglas-academicas.ts`):**
   - `detectarUniversidadConvenio` y `topeCreditosDeUniversidad` aplican el límite por cuatrimestre según parámetros editables (`/configuracion/parametros`): `UCATECI` (24), `UNPHU` (22), `UASD` (20), `UTESA` (24) y general (24), validado atómicamente en `inscribirseEnMateria`.

---

## 2. Mapa de Rutas (`/portal/estudiante/*`)

| Ruta | Archivo (`src/app/[locale]/(portal)/...`) | Propósito principal |
|---|---|---|
| `/portal/estudiante` | `portal/estudiante/page.tsx` | **Inicio** del estudiante: KPIs animados, llamadas activas en vivo, aviso de mínimo cuatrimestral, gráfico semanal de tareas, calendario mensual interactivo, accesos rápidos, materias en curso, notas recientes, semáforo de condición y solicitudes filtrables. |
| `/portal/estudiante/aula-virtual` | `portal/estudiante/aula-virtual/page.tsx` | **Aula Virtual (Moodle):** gráfico de entregas, filtros combinados por materia y estado (`?materia=&estado=`), entrega de archivos/texto y retroalimentación docente. |
| `/portal/estudiante/calificaciones` | `portal/estudiante/calificaciones/page.tsx` | **Calificaciones:** evolución histórica por período (`AreaChart`), promedio, índice GPA, distribución de letras y tablas separadas de carrera universitaria y Global Effect 360. |
| `/portal/estudiante/global-360` | `portal/estudiante/global-360/page.tsx` | **Global Effect 360:** ventana de tandas (Tanda 1 y Tanda 2), matrícula/retiro en 360, gráfico de avance, barras de asistencia por clase y catálogo completo. |
| `/portal/estudiante/prematricula` | `portal/estudiante/prematricula/page.tsx` | **Prematrícula / Mis Materias:** gráfico de carga de créditos, aviso de tandas 360, oferta de materias del período abierto con tope de créditos, asistencia de materias asignadas y matrícula histórica. |
| `/portal/estudiante/calendario` | `portal/estudiante/calendario/page.tsx` | **Calendario mensual:** rejilla de 7 columnas (`Lun–Dom`) con navegación libre (`?mes=YYYY-MM`), botón «Hoy», filtros por origen (clases, tareas, reuniones, eventos y trámites) y panel de detalle diario. |
| `/portal/estudiante/transporte` | `portal/estudiante/transporte/page.tsx` | **Transporte:** mapa en vivo estilo TIMOB, paradas del circuito universitario, marcador de vivienda del estudiante y suscripción/registro de ruta. |
| `/portal/estudiante/solicitudes` | `portal/estudiante/solicitudes/page.tsx` | **Solicitudes:** creación y seguimiento de trámites institucionales (constancias, cartas, citas, permisos). |
| `/portal/estudiante/chat` | `portal/estudiante/chat/page.tsx` | **Tutor IA:** asistente estudiantil con contexto académico de sus materias y reglamento (requiere permiso `ia.usar`). |
| `/reuniones` | `reuniones/page.tsx` | **Reuniones y llamadas en vivo:** videollamada embebida dentro de la web (`?sala=<id>`) y agenda de tutorías/reuniones. |

---

## 3. Capa Servidor (`src/server/estudiantes/`)

- **`portal.ts`:** `estudianteDeUsuario`, `materiasInscritas`, `notasDelEstudiante` (une `historial_calificacion` + notas finales cerradas en `inscripcion`), `notas360DelEstudiante`, `condicionEnLaFundacion`, `eventosProximos`, `cumplimientoCuatrimestralEstudiante` y `reunionesEstudiante`.
- **`academico.ts`:** `inscripcionesDelEstudiante` y `materiasOfertadas` para la pantalla de prematrícula.
- **`acciones-matricula.ts`:** `inscribirseEnMateria` (valida ventana abierta, duplicados y tope de créditos universitario dentro de SQL) y `quitarseDeMateria` (protege mínimo de 2 clases).
- **`aula.ts`:** `asignacionesDelEstudiante` (une asignaciones de `materia` y `materia_360` junto a `entrega_estudiante` y calificación/comentario docente).
- **`agenda.ts`:** `agendaDelEstudiante` y `mesesConAgenda`, consolidando 5 orígenes por mes (`clase` proyectada según horario, `asignacion`, `reunion`, `evento`, `solicitud`).
- **`historial-360.ts`:** historial y avance específico de Global Effect 360.

---

## 4. Desglose de Componentes UI (`src/components/estudiante/`)

### Inicio y Dashboards
- **`dashboard-inicio-estudiante.tsx`:**
  - `KpisAnimadosEstudiante`: tarjetas con conteo animado (*count-up*), barra de progreso y enlaces rápidos para Promedio, Índice, Aprobadas y Créditos.
  - `DashboardGraficoEstudiante`: gráfico semanal de tareas (`recharts` `BarChart`) y calendario mensual interactivo con reuniones, tareas, foros/anuncios y próximos eventos integrados.
- **`dashboard-secciones-estudiante.tsx`:**
  - `MateriasEnCursoInteractivo`: dona de distribución de créditos (`PieChart`) y tarjetas enlazadas al Aula Virtual.
  - `NotasRecientesInteractivo`: gráfico de barras por materia (`BarChart`) con barra de progreso y letra.
  - `SolicitudesInteractivo`: barra de distribución y chips de filtrado rápido por estado.
- **`graficos-modulos-estudiante.tsx`:** gráficos dedicados para los módulos internos (`GraficoEvolucionCalificaciones`, `GraficoEstadoAulaVirtual`, `GraficoProgresoGlobal360`, `GraficoCargaPrematricula`).
- **`condicion-fundacion.tsx`:** semáforo verde (`Al día`), naranja (`En observación`) y rojo (`En riesgo`) basado en `registro_servicio` (servicio mensual y asistencia a reuniones).
- **`aviso-minimo-cuatrimestral.tsx`:** alerta/estado del cumplimiento mínimo obligatorio de 2 clases por cuatrimestre para estudiantes universitarios.
- **`tarjeta-proximo.tsx`:** tarjeta destacada con la próxima entrega pendiente o evento más cercano.

### Aula Virtual (Moodle)
- **`aula-tarjeta.tsx`:** tarjeta individual de tarea, examen, material o anuncio, con enlace firmado al recurso y estado de entrega.
- **`boton-buzon-moodle.tsx`:** botón contextual (*Entregar*, *Editar entrega*, *Ver calificación*) y modal ampliado (`w-[95vw] sm:max-w-4xl`).
- **`buzon-tarea-moodle.tsx`:** formulario de entrega de archivos (`pdf`, `docx`, `jpg`, `png` hasta 10 MB) + texto escrito + vista de calificación y retroalimentación docente.

### Calificaciones, Prematrícula, Global 360 y Calendario
- **`tabla-notas.tsx`**, **`distribucion-letras.tsx`**, **`letra-nota.tsx`**, **`periodos.ts`**: visualización tabular y agrupación por período académico.
- **`elegir-materias.tsx`**, **`prematricula-periodo.tsx`**, **`prematricula-estado.ts`**: selector interactivo de materias universitarias con barra de créditos y manejo de estados de matrícula.
- **`matricula-cuatrimestral-360.tsx`**, **`g360-tarjeta-materia.tsx`**: inscripción y retiro por tandas en Global Effect 360.
- **`calendario-mensual-estudiante.tsx`**, **`dia-agenda.tsx`**, **`cabecera.tsx`**, **`cifra.tsx`**, **`seccion.tsx`**, **`esqueletos.tsx`**: rejilla mensual completa, cabecera uniforme y esqueletos de carga.

### Componentes Integrados de Otros Módulos
- **Reuniones en vivo:** `BannerLlamadasActivas` y `SalaLlamadaEmbebida` (`src/components/reuniones/`).
- **Transporte:** `MapaTransporteCliente` (`src/components/transporte/`).
- **Solicitudes e IA:** `ResumenSolicitudes` (`src/components/solicitudes/`) y chat estudiantil (`src/components/ia/`).

