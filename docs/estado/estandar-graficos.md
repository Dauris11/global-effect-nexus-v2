# Estándar de gráficos

Todo gráfico sale de `src/components/ui/grafico/` (Recharts 3 por dentro). Recibe datos y textos ya traducidos.

1. `ContenedorGrafico`: altura, `ResponsiveContainer`, `role="img"` + `aria-label`, tabla `sr-only` equivalente, leyenda y estado vacío (`EstadoVacio`) cuando `hayDatos` es falso.
2. `GraficoBarras`: columnas o filas (`orientacion="filas"` para nombres largos), varias series, `colorFila` para tono por barra, `dominio` y `formato`.
3. `GraficoLinea`: línea o área (`area`), solo para tendencias en periodos consecutivos; `referencia` dibuja un límite a rayas. Sin degradados.
4. `GraficoAnillo`: reparto con total o porcentaje en el centro (`centro`); `activo`/`alPasar` sincronizan el anillo con una lista vecina.
5. `LeyendaGrafico`: punto + nombre + cifra; `enLista` para el desglose junto a un anillo.
6. `Medidor` y `ui/progress` (`tono="tinta"` para lo que requiere atención): toda barra de avance. Prohibido `div` con `style={{ width }}`.
7. `tema.ts`: `TONO` (marca-300/500/700, tinta, tinta-3 como variables CSS, así siguen el acento azul/negro), `SERIE_GRAFICO`, `GLOBO` (estilo popover), `REJILLA`, `EJE`, `resolverColor` (traduce los hex de `paleta.ts` al tono equivalente).
8. Animación de entrada de 600 ms que se apaga con `prefers-reduced-motion` (`useMovimientoReducido`).
9. Máximo cinco tonos por serie; el error o lo urgente va en tinta, nunca en rojo. `SEMAFORO` no se usa en gráficas.
10. `components/dashboard/graficas.tsx` y `auditoria/graficas-actividad.tsx` son adaptadores finos (firma antigua) sobre el kit; en código nuevo usa el kit directo.
11. No importar `recharts` fuera de `ui/grafico/` (excepción: calendarios, Gantt y línea de tiempo, que no son gráficos de datos).
