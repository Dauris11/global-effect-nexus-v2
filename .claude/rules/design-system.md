# Reglas de diseño — Portal GlobalEffect

Todo agente (Claude Code, Antigravity, Gemini…) cumple estas reglas sin
excepción. Son el resumen operativo de la norma completa,
[`docs/09-sistema-visual.md`](../../docs/09-sistema-visual.md). Si cambias una,
cambia también la otra y `CLAUDE.md`/`AGENTS.md` en el mismo commit.

---

## 1. Lenguaje: app web, estilo Airbnb, con la marca de siempre

Blanco dominante, tinta fuerte, **un** acento usado con moderación, mucho aire,
tarjetas con radio generoso, sombras suaves, navegación clara y comportamiento
de app en el móvil (pestañas abajo, hojas que suben desde abajo).

## 2. Color — regla dura

- Marca: `marca-500` `#2096BA` · `marca-600` `#187a99` · `marca-700` `#0a6a8a`
  · `marca-300` `#5FB8D4`. Tinta `#171A1D`. Neutros: `tinta-2`, `tinta-3`,
  `linea`, `linea-fuerte`, `muted`.
- El turquesa va **solo** en el CTA principal, en lo activo, en los enlaces y en
  el icono de lo seleccionado. El resto, tinta y grises.
- **Siempre tokens**, nunca hex sueltos en un `.tsx`: `bg-marca-500`,
  `text-tinta-2`, `border-linea`. Los patrones armados están en
  `src/lib/paleta.ts`.
- **Prohibido** cualquier matiz fuera de marca: `emerald`, `amber`, `orange`,
  `rose`, `violet`, `red`, `green`, `yellow`, `purple`, `teal`, `pink`,
  `indigo`, `lime`, `fuchsia`, `cyan`, `sky`.
- Un error no es rojo: `bg-tinta text-background` con `AlertCircle`. Un aviso:
  `bg-marca-50 text-marca-700` con `Info`.

### La única excepción: `SEMAFORO`

`#1E9E6A` (dentro / aprobado) y `#B4342B` (requiere acción / rechazado):

- Solo para el **estado de una entidad** (expediente, solicitud) y para el
  borde de un input inválido. Nunca botones, banners ni gráficas.
- **Siempre** con su icono por estado (`ESTADO_VISUAL` en
  `src/lib/expedientes.ts`, `ESTADO_SOLICITUD_VISUAL` en
  `src/lib/solicitudes.ts`), para que la diferencia sobreviva en grises.
- Escrito como `bg-[#1E9E6A]`, nunca `green-*` / `red-*`.

### Colores de estado `status-*` (26 nov 2026, `docs/ux-rules.md`)

`success`, `warning`, `danger`, `info`, `progress`, `done` y `neutral`, vía `<StatusBadge>` y
`src/lib/status-map.ts` (todo estado del sistema se traduce ahí). Siempre con icono; nunca en
botones, banners ni gráficas. Conviven con los `est-*`/`pri-*` de abajo, que quedan para el
estado y la prioridad de las tareas de trabajo.

### La segunda excepción: colores de estado, prioridad y módulo (nov 2026)

**Los colores de la marca no se ven afectados.** Turquesa, hover, oscuro, suave,
tinta y grises siguen mandando en identidad, botones, enlaces y navegación. Esto
es una EXCEPCIÓN acotada: estados, estatus, prioridades y módulos pueden llevar
color, pero todo sale de UN estándar: los tokens
`est-pendiente|progreso|revision|pausa|listo` y `pri-urgente|alta|media|baja`
de `globals.css`.

- Solo vía `src/lib/estados-trabajo.ts` (`visualEstado`, `visualPrioridad`) o
  `ESTADO` de `src/lib/paleta.ts`: clases como `bg-est-progreso/10`, nunca hex
  ni `amber-*`. Si hace falta un estado o un color de módulo nuevo, se agrega
  ahí, no en la pantalla.
- **Siempre** con icono, para que se lea en grises.
- Nunca en botones, banners ni gráficas.

## 2b. Un solo acento y cero degradados

- **Prohibido todo degradado** (`bg-gradient-*`, `bg-linear-*`, `linear-gradient`),
  también en botones, banners y avatares. Superficie de acento = color plano.
- El acento es **azul o negro**, a elección de cada persona (Mi perfil →
  Apariencia). Se logra reasignando `marca-*` en `globals.css`; por eso se
  pinta **siempre con tokens** (`bg-marca-500`), nunca con hex.
- **Sin subtítulos** en tarjetas, botones, tareas ni asignaciones. Los datos de
  una tarjeta van como `Dato`/`FilaDatos` (icono + valor), no como texto gris.

## 3. Forma

- Radios: `rounded-control` (12 px: botón, input), `rounded-card` (16 px:
  tarjeta), `rounded-hoja` (24 px: diálogo, hoja, login), `rounded-full`
  (píldora, chip, avatar). No `rounded-md/lg/xl/2xl/3xl` en código nuevo.
- Sombras: `shadow-card` en reposo y `shadow-elevada` en hover y popovers.
  Nunca sombras teñidas de azul.
- Las secciones se separan con espacio y con `border-linea`, no con cajas grises.

## 4. Tipografía

**Plus Jakarta Sans** (400–700; sustituyó a Inter el 26 nov 2026) y **IBM Plex Mono** solo para
códigos y folios. Cuerpo 14 px. Escala nueva: `text-page` (26), `text-section` (17), `text-body`
(14), `text-label` (13), `text-meta` (12,5), `text-kpi` (28), definidas en
[`docs/ux-rules.md`](../../docs/ux-rules.md); las `texto-titulo-*` siguen vigentes para lo que no
migró. Botones 14/600, altura 36 (sm 32, lg 44).

## 5. Componentes

- Usa los primitivos de `src/components/ui/` (`Button`, `Input`, `Card`,
  `Dialog`, `Badge`, `Tabs`, `Skeleton`, `StatCard`, `FilaChips`,
  `ChipFiltro`, `EstadoVacio`, `EncabezadoPagina`) antes de escribir clases.
- `ui/` solo tiene primitivos. Lo de un dominio va en `components/<dominio>/`.
- Iconos: solo `lucide-react`, nunca emoji. `size-4`, `size-5`, `size-6`.
- Botón de guardar con el icono `Save`.
- Formularios: por `docs/ux-rules.md` §6–7, en panel lateral (`SidePanelForm`) con lo
  obligatorio a la vista y lo demás en «Más detalles»; **sin** modo normal/guiado. El
  `FormularioGuiado` actual se retira pantalla por pantalla durante la migración.
- Componentes nuevos de página en `src/components/app/` (`PageHeader`, `StatusBadge`,
  `EmptyState`, `FilterBar`, `ActionTile`, `AttentionList`, `SidePanelForm`, `PageContainer`):
  reemplazan a `EncabezadoPagina`, `EstadoVacio`, `Badge`+`visualDeEstado` y a los filtros con «Aplicar».
- Objetivos táctiles ≥ 44 px, foco visible, `aria-current="page"` en la
  navegación.

## 6. Pantallas

Cada pantalla: `EncabezadoPagina` arriba; listados con `FilaChips` → buscador
→ tabla en ≥ md y tarjetas en < md; vacío con `EstadoVacio`; carga con
`loading.tsx` y skeletons de la misma forma; ninguna página de más de 300
líneas (lo que sobre va a `components/<dominio>/`).

## 7. Verificación

```bash
npm run audit:ui        # arcoíris en src/ y hex sueltos en .tsx (falla si hay)
npm run lint && npm run build && npm run i18n:check
```

`npm run audit:ui` es el árbitro. Sus excepciones del hex (gráficas que pintan
con `fill`, el globo y `paleta.ts`) están listadas, con su porqué, en
`scripts/auditar-ui.mjs`.
