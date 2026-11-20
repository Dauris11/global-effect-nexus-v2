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
| 2 | Catálogo: universidad (régimen cuatrimestre/trimestre/semestre) → carrera → pénsum → materias con créditos; matrícula, universidad, carrera y pénsum por estudiante | — | **Hecha** (migración `0095`; pénsum de UCATECI ISC cargado; faltan los demás) |
| 3 | Resultados por materia nativos (un intento = materia + año + ronda): índice por período y acumulado según las reglas de cada universidad, alertas (reprobadas, retiradas, índice bajo el mínimo), récord filtrable por cuatrimestre, registro de calificaciones por cuatrimestre | — | **Hecha** (migraciones `0099`–`0101`) |
| 4 | Importaciones. **Gradua (UCATECI): hecha** — carga inicial que reconstruye al estudiante y alimenta el formato nativo. **Pénsum en PDF** y **listado de notas del cuatrimestre**: pendientes (necesitan una muestra del listado). Récord de la academia: pendiente | Listado de notas del cuatrimestre | Parcial |
| 5 | Servicio mensual: foto del estudiante → aprobación de administración → cumplió / no cumplió por mes en el expediente (extiende `registro_servicio`) | — | Pendiente |
| 6 | Reunión mensual: lista de activos, asistencia, PDF exportable, conteo de inasistencias (extiende `reunion`) | — | Pendiente |
| 7a | Carta mensual al patrocinador: buzón → Elly AI (revisa y traduce) → patrocinador; cumplimiento derivado en la planilla | Elegir el buzón y conectarlo (ver `entregables-expediente.md`) | **Hecha** (migración `0092`) |
| 7b | Sanciones: umbrales configurables sobre las fases 3, 5 y 6 | Reglas de sanción | Pendiente |

## Decisiones tomadas

- **Importación del gradua sin pantalla de revisión (decisión cambiada, 20 nov 2026).**
  Se había dicho que toda importación pasaría por una revisión. Para el gradua se
  escribe directo porque no hay interpretación que revisar: el texto del PDF se
  extrae de forma determinista (no es OCR ni IA), se rechaza si no es un gradua de
  la universidad del estudiante o si la matrícula es de otra persona, se avisa si
  el nombre o la versión del plan no cuadran, y el índice que calcula el sistema se
  compara con el que declara el propio reporte (con el gradua real de UCATECI
  coinciden: 3,56). Todo es reversible: quitar el archivo quita lo leído. La
  pantalla de revisión **sigue obligatoria** para lo que sí se interpreta (OCR o IA
  de récords, pénsums y listados).
- **Modelo nativo.** El gradua sirve para reconstruir al estudiante al entrar al
  sistema y para aprender el esquema de cada universidad; lo que queda es
  `resultado_materia` (un intento por materia, año y ronda). Después solo se suben
  calificaciones y el pénsum, el índice y las alertas se recalculan al mostrarse.
  El estado de una materia es el de su intento más reciente.
- **Un solo índice y un solo umbral.** El índice es el nativo (reglas de la
  universidad del estudiante) y, sin resultados nativos, el promedio del historial
  anterior. El umbral de «en riesgo» es el parámetro `becas.indice_minimo`; antes el
  código usaba 2,00 fijo y el reglamento 3,00.
- **Un lector de gradua por universidad** (`LECTORES_GRADUA`): hoy solo UCATECI.

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
