# Estándar del calendario

Un solo calendario para todo el sistema: FullCalendar v6 envuelto en `src/components/ui/calendario-base.tsx`.

- **Envoltorio**: `calendario-base.tsx` (carga perezosa, solo cliente) + `calendario-base-interno.tsx` (núcleo) + `calendario-base.css` (tema).
- **Tema**: solo variables de los tokens (`--color-marca-*`, `--tinta`, `--linea`, `--muted`). Sigue el acento azul/negro y el modo oscuro; cero hex y cero degradados.
- **Tipos y origen**: `src/lib/calendario.ts` (`OrigenCalendario`, `ORIGEN_VISUAL`, `EventoCalendario`, `Entrada`). El color de cada origen es `.fc-origen-*` en el CSS; el icono (lucide) es lo que lo distingue en grises.
- **Vistas**: mes, semana, día y lista (`listMonth`). En móvil, sin vista pedida, abre en lista. Locale es/en desde `useLocale()`.
- **API**: `eventos`, `hoy`, `fechaInicial`, `vistaInicial`, `compacto`, `etiquetaOrigen`, `onAbrir`, `onDiaClick`, `onMover`, `onCambioRango`, `acciones`. Fechas como `YYYY-MM-DD` y `HH:MM`; FullCalendar corre con `timeZone="UTC"` y `now={hoy}` para no cambiar de día según el navegador.
- **Mover**: solo entradas con `movible`; `onMover` llama a `moverEntrada` (que vuelve a validar permiso en servidor) y, si falla, el arrastre se deshace.
- **Usos**:
  - `/calendario`: `components/calendario/calendario.tsx` (filtros por origen y tipo, buscador, alta/edición de evento en `dialogo-entrada.tsx`). Mes y vista en la URL: `?mes=2026-08&vista=semana`.
  - Estudiante: `components/estudiante/calendario-mensual-estudiante.tsx` (filtros por origen, mes y vista en la URL).
  - Inicios del estudiante y del docente: `components/calendario/calendario-compacto.tsx` (modo `compacto`, solo mes; tocar una entrada lleva a su página).
- **Mensajes**: espacio `calendar` (hay que cargarlo con `mensajesCliente([... , "calendar"])`). Claves nuevas: `calendar.origin.request` y `calendar.origin.forum`.
- **Regla**: ninguna pantalla nueva dibuja su propia rejilla de calendario; usa `CalendarioBase`. La línea de tiempo (Gantt) es otra cosa y no pasa por aquí.
- **Pendiente**: probar con sesión iniciada (arrastrar, alta, móvil) y revisar contraste del acento negro con el modo oscuro.
