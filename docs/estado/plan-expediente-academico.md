# Plan: expediente académico por fases

El expediente del estudiante es la columna vertebral: servicios, reuniones,
notas y correos cuelgan de él. Este plan sale de lo pedido el 19 nov 2026 y se
construye por fases; cada fase se entrega sola y se verifica antes de pasar a
la siguiente.

## Recorrido del estudiante

1. **Habitudes** — el profesor de Habitudes llena el expediente del postulante
   (`reclutado` → `postulado`) con `expedientes.postular`.
2. **Academia de liderazgo** (`academia_liderazgo`) — último filtro, otra
   etiqueta. Desde aquí el expediente lo lleva administración.
3. **Al terminar la academia** el estudiante entrega su récord de notas: se
   lee con OCR y de ahí sale su promedio. Entra a la universidad (`activo`) o se
   descarta (`inactivo`, con motivo).
4. **Universidad** — fase 1 de la universidad: elegir universidad y carrera; de
   ese par sale el pénsum del estudiante.

## Fases

| # | Fase | Necesita del usuario | Estado |
|---|---|---|---|
| 1 | Etapas del expediente: historial de cada cambio de estado (quién, cuándo, desde dónde) | — | **Hecha** (migración `0090`) |
| 2 | Catálogo: universidad (régimen cuatrimestre/trimestre/semestre) → carrera → pénsum → materias con créditos; matrícula, universidad, carrera y pénsum por estudiante | — | Pendiente |
| 3 | Notas por período a mano: promedio del período, índice acumulado ponderado por créditos, alertas (reprobadas, promedio bajo) | — | Pendiente |
| 4 | Importaciones con IA/OCR: récord de notas de la academia, pénsum en PDF, listado de notas del cuatrimestre (se empareja por matrícula y luego nombre; **siempre pasa por una pantalla de revisión**, nunca escribe notas directo) | Récord de notas, pénsum y listado de notas | Esperando documentos |
| 5 | Servicio mensual: foto del estudiante → aprobación de administración → cumplió / no cumplió por mes en el expediente (extiende `registro_servicio`) | — | Pendiente |
| 6 | Reunión mensual: lista de activos, asistencia, PDF exportable, conteo de inasistencias (extiende `reunion`) | — | Pendiente |
| 7a | Carta mensual al patrocinador: buzón → Elly AI (revisa y traduce) → patrocinador; cumplimiento derivado en la planilla | Elegir el buzón y conectarlo (ver `entregables-expediente.md`) | **Hecha** (migración `0092`) |
| 7b | Sanciones: umbrales configurables sobre las fases 3, 5 y 6 | Reglas de sanción | Pendiente |

## Decisiones tomadas

- **Universidades iniciales:** UCATECI, UNPHU, UTESA y UASD (las cuatro del
  circuito de transporte y de `reglas-academicas.ts`). «UCteci» se leyó como
  repetición de UCATECI y la «que no recuerdo» como UASD; el admin podrá añadir
  más desde la pantalla de la fase 2.
- **Descarte:** no se añade un valor al ENUM `estado_estudiante`; se usará
  `inactivo` con un motivo, porque `ALTER TYPE … ADD VALUE` choca con que
  `db:migrate` ejecuta cada archivo en una transacción.
- **Columnas planas:** `estudiante.asistio_reunion_mensual` y `amonestaciones`
  guardan un solo valor. Las fases 5-7 necesitan filas por mes, así que dejarán
  de escribirse en ellas.
- **Quién edita:** la regla por etapa se comprobará en el servidor con
  `usuarioTienePermiso`, no con el rol ni escondiendo botones.
