# Estándar de líneas de tiempo y Gantt

Una sola pieza para todo diagrama de barras: `GanttBase`
(`src/components/ui/gantt-base.tsx`), envoltorio de `@svar-ui/react-gantt`
(MIT, edición gratuita). La usan `calendario/gantt`,
`administrativo/proyectos/[id]` y `contabilidad/cuentas-por-pagar/gantt`.

- **Contrato:** `secciones: SeccionTiempo[]`, `inicio`, `fin`, `hoy`, `alMover?`
  (modelo en `src/lib/linea-tiempo.ts`). Cada sección es una fila resumen y sus
  barras cuelgan de ella; las dependencias se dibujan como enlaces fin-a-inicio.
- **Solo lectura por defecto.** Sin `alMover` no hay arrastre. Con él, las barras
  `editable` se mueven y estiran; el cambio llama al server action
  (`moverBarra`), que vuelve a validar permiso y reglas. Si falla, se remonta el
  diagrama con los datos originales y se avisa.
- **Piezas:** `gantt-base.tsx` (controles, lista móvil, detalle),
  `gantt-base-lienzo.tsx` (único archivo que toca SVAR; carga solo en el navegador)
  y `gantt-base.css` (tema).
- **Tema:** solo variables CSS de tokens (`--wx-*` apuntan a `marca-*`, `tinta`,
  `linea`, `card`); sigue el acento azul/negro y el modo oscuro. Sin hex ni degradados.
- **Escalas:** día (hasta 75 días), semana (hasta 220) y mes; cambia con el selector.
  Fechas y nombres de mes con `Intl` según el idioma de `next-intl`.
- **Barras:** un acento (`marca`), `oscuro`, `tinta` y `apagado`. El estado se dice con
  icono (aviso, completado), no con color. Línea de hoy como marcador; fines de semana
  en gris.
- **Móvil (< md):** lista por fechas más ficha de detalle; el diagrama no se monta.
- **Filtros:** `FiltrosLineaTiempo` usa `FilaChips`/`ChipFiltro` y vive en la URL.
- **No hay** edición de progreso, creación/borrado de tareas, enlaces manuales ni
  editor de SVAR: se cancelan con `api.intercept`. Las funciones PRO (deadlines,
  ruta crítica, auto-scheduling) no se usan.
- Textos: `lineaTiempo.*` en `messages/{es,en}.json`.
