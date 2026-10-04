# Reglas de diseño — Global Effect Nexus

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

## 3. Forma

- Radios: `rounded-control` (12 px: botón, input), `rounded-card` (16 px:
  tarjeta), `rounded-hoja` (24 px: diálogo, hoja, login), `rounded-full`
  (píldora, chip, avatar). No `rounded-md/lg/xl/2xl/3xl` en código nuevo.
- Sombras: `shadow-card` en reposo y `shadow-elevada` en hover y popovers.
  Nunca sombras teñidas de azul.
- Las secciones se separan con espacio y con `border-linea`, no con cajas grises.

## 4. Tipografía

Inter. Cuerpo 15 px (landing 16). `texto-titulo-pagina` (28→32 px),
`texto-titulo-seccion` (22), `texto-titulo-tarjeta` (16), `texto-meta` (13,
`tinta-3`). Títulos en `font-semibold`. Etiquetas de formulario
`text-sm font-medium`.

## 5. Componentes

- Usa los primitivos de `src/components/ui/` (`Button`, `Input`, `Card`,
  `Dialog`, `Badge`, `Tabs`, `Skeleton`, `StatCard`, `FilaChips`,
  `ChipFiltro`, `EstadoVacio`, `EncabezadoPagina`) antes de escribir clases.
- `ui/` solo tiene primitivos. Lo de un dominio va en `components/<dominio>/`.
- Iconos: solo `lucide-react`, nunca emoji. `size-4`, `size-5`, `size-6`.
- Botón de guardar con el icono `Save`.
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
