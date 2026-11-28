# Reglas de UX — Portal GlobalEffect

Ley para todo el rediseño. Cada pantalla nueva o rehecha las cumple; si una regla
estorba, se cambia aquí primero. Complementa a [`docs/09-sistema-visual.md`](09-sistema-visual.md) y a
[`.claude/rules/design-system.md`](../.claude/rules/design-system.md) (color de marca, radios, sombras);
donde chocan con ellos, **manda este documento** y se actualizó el otro en el mismo commit.

## Reglas

1. **Una pantalla, un propósito.** Arriba de todo va lo que el usuario vino a hacer (lista, formulario o acción), nunca KPIs ni gráficos.
2. **Máximo 4 métricas por página**, y solo en la página de Inicio del rol. En módulos, los conteos van dentro de los chips de filtro ("Activos 6").
3. **Los gráficos viven solo en "Reportes"**, salvo en el tablero ejecutivo del super_admin.
4. **Filtros en vivo:** buscar o filtrar actualiza al instante (debounce 250 ms). Prohibido el botón "Aplicar".
5. **Acción principal única** por página: un solo botón primario, arriba a la derecha, con verbo + objeto ("Nuevo expediente", "Registrar recibo"). El resto son botones secundarios o van en un menú "⋯".
6. **Crear o editar en panel lateral (Sheet) de 480–560px**, no en modal centrado ni en página aparte, salvo formularios de más de 12 campos.
7. **Formularios mínimos:** solo los campos obligatorios a la vista. Los opcionales van en "Más detalles" (colapsable). Nada de toggles Normal/Guiado ni Rápido/Completo.
8. **Todo estado vacío tiene:** icono, una frase de qué pasa y **un botón con la acción siguiente** (o a quién pedirla, si el rol no puede).
9. **Los estados se comunican con color semántico** usando `<StatusBadge>`. Nunca con texto plano ni con el azul de marca.
10. **Encabezado único:** `<PageHeader>` con título + subtítulo opcional + acción. Sin eyebrow encima del título. El breadcrumb solo aparece a partir del 2.º nivel (detalle).
11. **Ancho único:** el contenido va en `max-w-[1200px] mx-auto px-6 lg:px-8` (`<PageContainer>`). Las tablas y tableros kanban pueden usar el ancho completo.
12. **Las etiquetas deben explicarse solas:** menú y título de página dicen lo mismo. Se prefieren verbos y sustantivos del usuario ("Mis clases", "Por calificar") a nombres internos ("Asignación de materias").
13. **Sidebar por rol: máximo 8 entradas principales.** Lo administrativo raro va en "Configuración" o en la búsqueda ⌘K.
14. **No cambiar la paleta de marca.** Solo se agregan los colores de estado de abajo.

## Tipografía

- **Plus Jakarta Sans** (400/500/600/700) es `--font-sans`; sustituyó a Inter. **IBM Plex Mono** solo para códigos y folios (AS-000063, CE-000023, cédulas).
- `font-variant-numeric: tabular-nums` en montos, tablas y KPIs (ya activo en `table` y `.tabular-nums`).
- Escala (utilidades en `globals.css`):

| Utilidad | Uso | Tamaño / peso / interlineado |
|---|---|---|
| `text-page` | Título de página | 26 px / 700 / 1,2 · tracking −0,02 em |
| `text-section` | Título de sección o tarjeta | 17 px / 600 / 1,3 |
| `text-body` | Texto general | 14 px / 400 / 1,55 |
| `text-label` | Etiquetas de formulario | 13 px / 500 |
| `text-meta` | Metadatos y fechas | 12,5 px / 400 · color apagado |
| `text-kpi` | Número de KPI | 28 px / 700 · tabular |

- Botones: 14 px / 600. Altura 36 px (`sm` 32, `lg` 44). En pantallas táctiles (`pointer: coarse`) suben a 44 / 40 px para no romper el objetivo táctil mínimo.
- Las utilidades `texto-titulo-*` y `texto-meta` anteriores siguen vigentes solo para las pantallas que aún no migraron.

## Colores de estado

Tokens `status-*` en `globals.css` (`--color-status-<token>`, `-fg`, `-bg`, `-border`). La base es el color de acento (icono); el `fg` es más oscuro para llegar a contraste AA sobre su tinte. **No se usan en botones, banners ni gráficas.**

| Token | Base | Estados típicos |
|---|---|---|
| `success` | #16A34A | Activo, Aprobada, Completado, Contabilizado, Entregada, Pagado |
| `warning` | #D97706 | Pendiente, Pausado, En revisión, Por vencer, Liquidez baja, En prueba académica |
| `danger` | #DC2626 | Rechazada, Vencida, Suspendido, En riesgo, Con error |
| `info` | azul de marca | Postulado, En proceso, Enviada, Planificación |
| `progress` | #7C3AED | En curso, Academia de liderazgo |
| `done` | #0F766E | Graduado, Cerrado |
| `neutral` | #64748B | Inactivo, Cancelada, Retirado, Borrador, Sin asignar |

Cada estado del sistema está en `src/lib/status-map.ts` (valor → token) con su etiqueta en `messages/*.json` → `estados.<valor>`. **Agregar un estado = una línea ahí y su etiqueta en es y en.** La pastilla lleva icono (uno por token) además del color, para que se lea en escala de grises. Las prioridades (`urgente…baja`) no son estados y siguen en `src/lib/estados-trabajo.ts`.

## Componentes base (`src/components/app/`)

`PageContainer` · `PageHeader` · `MenuMasAcciones` (⋯) · `StatusBadge` · `EmptyState` · `FilterBar` · `ActionTile` · `AttentionList` · `SidePanelForm` (sobre `ui/sheet.tsx`). Muestra viva de todos y de todos los estados: `/ui-kit` (solo en desarrollo).

## Qué reemplazan (migración, pantalla por pantalla)

| Antes | Ahora |
|---|---|
| `EncabezadoPagina` (con `antetitulo`) | `PageHeader` |
| `EstadoVacio` | `EmptyState` (acción obligatoria) |
| `Badge` + `visualDeEstado` / `ESTADO_VISUAL` / `visualEstado` | `StatusBadge` |
| Filtros con botón «Aplicar», `FilaChips`/`ChipFiltro` | `FilterBar` |
| `Dialog` para crear/editar, `FormularioGuiado` | `SidePanelForm` con «Más detalles» |

## Botones (28 nov 2026)

Un solo componente: `src/components/ui/button.tsx` (estilos en `button-variantes.ts`, colores en los
tokens `--btn-*` de `globals.css`, con su valor claro y oscuro). Prohibido un `<button>` con caja propia.

| Variante | Uso |
|---|---|
| `primary` | La acción principal; una por pantalla. |
| `secondary` | Superficie blanca con borde: el resto de acciones. |
| `ghost` | Terciaria, sin caja («Ver todo»). |
| `danger` | Destructiva a la vista, en contorno («Rechazar»). |
| `danger-solid` | SOLO la confirmación final de algo irreversible. |

- Alturas: `sm` 32 (filas y chips), `md` 36 (por defecto), `lg` 44 (móvil y acción principal del chofer). Radio 8 px, texto 14/600 (sm 13/600), icono de 16 px y gap de 8.
- Solo icono: `icon`, `icon-sm`, `icon-lg`, cuadrados, **siempre** con `aria-label` y `title`.
- Estados: hover, active (baja 1 px), foco (halo de 3 px), deshabilitado (50 %, sin hover) y `loading` (spinner de 14 px, mismo ancho, `aria-busy`, sin doble clic). Toda server action usa `loading`.
- Barra superior: «Ver como», buscador, avisos y cuenta miden 36 px.
- Filas de tabla: columna de acciones fija a la derecha (`sticky right-0`), un botón `sm` secondary + menú ⋯; «Aprobar» secondary con ✓ y «Rechazar» ghost-peligro que pide el motivo en un popover.
- Chips de filtro: 30 px, 13/500, radio completo; el activo es tinta sobre fondo; el conteo va en 12/600 con opacidad .7.
- Muestra viva: `/ui-kit`. Pruebas: reglas `altura-botones`, `secundario-visible` y `acciones-dentro` de `e2e/ux-guard.spec.ts`.

## Modo oscuro (28 nov 2026)

Escala de grises de la Fundación (`--gray-50…950`, con el 925 entre 900 y 950) y un override COMPLETO de los
tokens semánticos en `.dark` (`globals.css`): ninguno se queda con el valor claro. Capas: fondo y sidebar 950 →
barra superior y tarjetas 925 → hover, cabeceras de tabla, popover y modal 900 → selección `brand-50`.

- Nada de blanco puro en fondos (solo el chip de filtro activo). Sin sombras: la elevación es un borde (`--sh-2`) y el hover marca el borde 700.
- Primario `#2096BA` con texto 950 (5,7:1); texto de marca y enlaces `#74C5DD`; estados con texto claro sobre fondo y borde translúcidos.
- Apariencia: Claro · Oscuro · **Sistema** (por defecto), en localStorage; un script `beforeInteractive` fija `.dark` antes de pintar (sin parpadeo) y la página pública (`/`) siempre es clara. «Barra lateral negra» desapareció; el acento «Negro» solo cambia la marca y solo en claro.
- Logo: `public/logo.webp` (claro) y `public/logo-dark.webp` (texto #F3F2F2, globo turquesa), con las clases `logo-claro` / `logo-oscuro`. Nada de `filter: invert`.
- Pruebas: `e2e/ux-guard.spec.ts` recorre cada rol en claro Y en oscuro, con las reglas `sin-blanco` y `contraste-oscuro` (axe-core, 4,5:1).
