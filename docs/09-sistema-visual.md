# 09 · Sistema visual — Global Effect Nexus

**Norma vigente desde el 3 de octubre de 2026.** Sustituye a `estilos.md`, que
describía el lenguaje de agosto (panel con barra negra y banners en degradado)
en forma de prompt para reconstruirlo. Esto ya no es un prompt: es la regla.

- Si una pantalla y esta norma no coinciden, **gana la norma**.
- Las reglas duras, resumidas para los agentes, están en
  [`.claude/rules/design-system.md`](../.claude/rules/design-system.md).
  `CLAUDE.md` y `AGENTS.md` apuntan a los dos.
- Los tokens viven en [`src/app/globals.css`](../src/app/globals.css) y los
  patrones armados en [`src/lib/paleta.ts`](../src/lib/paleta.ts). Una pantalla
  no escribe hex: usa tokens. `npm run audit:ui` lo comprueba.

---

## 1. Principios

1. **App web, no panel.** La referencia es Airbnb adaptada a la marca: blanco
   dominante, tinta fuerte, un solo acento usado con moderación, mucho aire,
   tarjetas grandes con radio generoso y sombras suaves.
2. **Un acento.** El turquesa `#2096BA` va **solo** en el CTA principal, en lo
   activo de la navegación, en los enlaces y en el icono de lo seleccionado. Todo
   lo demás es tinta y grises. Un módulo no tiene color propio; un rol tampoco.
3. **Se separa con espacio y con línea, no con cajas.** El fondo es blanco; las
   secciones se distinguen por aire y por una línea fina `linea`, no por
   rectángulos grises.
4. **El significado lo lleva el peso, no el matiz.** Cuanto más oscuro, más
   importa. Un error no es rojo: es tinta con su icono. La única excepción es
   `SEMAFORO` (§2.3).
5. **Se comporta como app en el teléfono:** pestañas abajo, hojas que suben
   desde abajo, objetivos táctiles de 44 px como mínimo.

## 2. Tokens

### 2.1 Color

| Token (utilidad Tailwind) | Valor claro | Uso |
|---|---|---|
| `marca-500` | `#2096BA` | CTA, activo, enlaces |
| `marca-600` | `#187a99` | Hover del CTA, texto turquesa sobre blanco |
| `marca-700` | `#0a6a8a` | Lo más pesado del azul (completado, prioridad alta) |
| `marca-300` | `#5FB8D4` | Serie suave de gráficas |
| `marca-50` / `marca-100` / `marca-200` | `#eef8fb` / `#d5eef6` / `#addded` | Fondos de insignia y fila destacada |
| `tinta` | `#171A1D` | Texto principal, títulos, foco, lo urgente |
| `tinta-2` | `#5B6470` | Texto secundario |
| `tinta-3` | `#8A929C` | Metadatos. Solo texto ≥ 13 px y no esencial (contraste AA) |
| `linea` | `#EBEEF1` | Bordes y separadores |
| `linea-fuerte` | `#D5DBE1` | Borde de inputs y botón secundario |
| `muted` | `#F6F7F9` | Fondo de icono, chip, skeleton, hover de fila |
| `background` / `card` | `#FFFFFF` | Lienzo y tarjetas |

`tinta`, `linea`, `muted` y compañía son **variables**: en modo oscuro se
invierten (superficies `#111416` / `#181B1E`, línea `#2A2F35`). La escala
`marca-*` es fija.

### 2.2 Prohibido

Ninguna clase de Tailwind con matiz fuera de marca: `emerald`, `amber`,
`orange`, `rose`, `violet`, `red`, `green`, `yellow`, `purple`, `teal`, `pink`,
`indigo`, `lime`, `fuchsia`, `cyan`, `sky`. Tampoco hex sueltos en `.tsx`: el
color sale de un token o de `paleta.ts`.

### 2.3 La excepción: `SEMAFORO`

`#1E9E6A` (dentro / aprobado) y `#B4342B` (requiere acción / rechazado), solo
para el **estado de una entidad** (expediente, solicitud), **siempre** con su
icono (`ESTADO_VISUAL` en `lib/expedientes.ts`, `ESTADO_SOLICITUD_VISUAL` en
`lib/solicitudes.ts`) y escrito como `bg-[#1E9E6A]`, nunca como `green-*`.
También el borde de un input con `aria-invalid`. Nunca en botones, banners ni
gráficas.

### 2.4 Tipografía

Inter, única familia. Cuerpo **15 px** en el portal y 16 px en la landing.

| Utilidad | Tamaño | Uso |
|---|---|---|
| `texto-titulo-pagina` | 28 px → 32 px en `md` · semibold · tracking-tight | Un título por página |
| `texto-titulo-seccion` | 22 px · semibold | Bloques dentro de la página |
| `texto-titulo-tarjeta` | 16 px · semibold | Título de tarjeta |
| (cuerpo) | 15 px | Texto normal |
| `text-sm` | 14 px | Etiquetas de formulario, celdas de tabla |
| `texto-meta` | 13 px · `tinta-3` | Fechas, contadores, notas al pie |

Los títulos son `font-semibold`, no `bold` ni `extrabold`.

### 2.5 Radios

| Utilidad | Valor | Para |
|---|---|---|
| `rounded-control` | 12 px | Botón, input, select, fila destacada |
| `rounded-card` | 16 px | Tarjeta, foto de entidad, columna de Kanban |
| `rounded-hoja` | 24 px | Diálogo, hoja inferior, tarjeta de login, hero |
| `rounded-full` | — | Píldora, chip, avatar, insignia, icono en círculo |

No se usan `rounded-md/lg/xl/2xl/3xl` en pantallas nuevas.

### 2.6 Sombras

| Utilidad | Valor | Para |
|---|---|---|
| `shadow-card` | `0 1px 2px rgb(0 0 0/.04), 0 2px 8px rgb(0 0 0/.06)` | Tarjetas en reposo, buscador píldora |
| `shadow-elevada` | `0 6px 20px rgb(0 0 0/.12)` | Hover de tarjeta interactiva, popovers, login |

Sombras neutras: nada de sombras teñidas de azul.

### 2.7 Espaciado

Escala de 4: **4 · 8 · 12 · 16 · 24 · 32 · 48** (`1 · 2 · 3 · 4 · 6 · 8 · 12`).
Contenedor del portal `max-w-[1280px]`, con 16 / 24 / 32 px de margen lateral
en móvil / tableta / escritorio. Entre secciones de una página, 32 o 48.

### 2.8 Movimiento

Tres animaciones (`animate-fade-in-up`, `animate-shimmer`, `animate-soft-pulse`),
la transición de página de 180 ms y los skeletons. Nada rebota. Todo se apaga
con `prefers-reduced-motion`.

### 2.9 Un solo acento, elegido por la persona; sin degradados

Nada del sistema lleva degradado: ni botones, ni banners, ni avatares, ni
iconos flotantes. Las superficies de acento son un color plano.

El acento es **azul** (el de la marca) o **negro** (tinta), y lo elige cada
persona en Mi perfil → Apariencia (`data-acento` en `<html>`, guardado en el
navegador con el resto de la apariencia). El negro reasigna la escala
`marca-*` a tinta en `globals.css`, así que ningún componente decide el color:
todos pintan con `bg-marca-500`, `text-marca-600`… En modo oscuro manda siempre
el azul, porque un botón negro sobre fondo oscuro desaparecería.

### 2.10 Sin subtítulos en tarjetas, botones, tareas ni asignaciones

Una tarjeta es icono y título. Lo que antes iba debajo como texto gris pequeño
(fecha, materia, lugar, responsable) se pinta con `Dato`
(`components/ui/dato.tsx`): icono y valor, en `FilaDatos`. Cada dato es una
pieza que se reconoce sin leer. Una explicación que solo repite el título no se
escribe; si hace falta, es un aviso (§5), no un subtítulo.

## 3. Componentes base

| Primitivo | Regla |
|---|---|
| Botón | `default` = color plano `marca-500` (hover `marca-600`), sin degradado, texto blanco, semibold, `h-11`, `rounded-control`, `active:scale-[.97]`. `secondary` = blanco, borde `linea-fuerte`, texto tinta. `destructive` es **tinta**, no rojo. Prop `cargando`. |
| Input / select / textarea | `h-12`, `rounded-control`, borde `linea-fuerte`, foco = anillo de 2 px **tinta**, placeholder `tinta-3`, etiqueta arriba en `text-sm font-medium`. |
| Tarjeta | `rounded-card`, borde `linea`, `shadow-card`. Con `interactiva`: `hover:shadow-elevada hover:-translate-y-0.5`. |
| Diálogo | ≥ md: centrado, `rounded-hoja`, cerrar a la **izquierda**, título centrado, pie fijo. < md: hoja inferior con asa, `max-h-[90dvh]`. |
| Insignia | Píldora `rounded-full text-xs font-medium`: `neutra`, `marca`, `solida`. |
| Pestañas | Subrayadas: texto `tinta-2`, activa tinta semibold con barra de 2 px. |
| Barra lateral | Blanca, borde derecho `linea`. Ítem `h-11 rounded-control`; activo = fondo `sidebar-accent`, texto tinta semibold, icono `marca-500`. |
| Barra inferior (móvil) | Fija, `h-16` + área segura, 5 destinos con icono y etiqueta, activo en `marca-500`. |

## 4. Patrones de pantalla

### 4.1 Cabecera de página

Un título por página, dentro de la página (no en la barra superior).

```tsx
<EncabezadoPagina
  titulo={t("title")}
  subtitulo={t("subtitle")}
  acciones={<Button>{t("new")}</Button>}
/>
```

### 4.2 Saludo de portal

Sustituye al banner en degradado: saludo grande, sin subtítulo, y una fila de
tarjetas KPI blancas.

```tsx
<EncabezadoPagina titulo={t("greeting", { name })} />
<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
  <StatCard icono={Users} valor={cifras.estudiantes} etiqueta={t("students")} />
</div>
```

### 4.3 Tarjeta KPI

```tsx
<StatCard icono={Inbox} valor={12} etiqueta={t("pending")} acento />
```

Cifra en tinta (28 px semibold); el acento lo lleva solo el icono.

### 4.4 Tarjeta de entidad (expediente, estudiante, patrocinador)

Como un anuncio: foto grande, nombre, una o dos líneas, estado sobre la foto.

```tsx
<Link href={`/expedientes/${id}`} className="group block">
  <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-muted">
    <Image src={foto} alt="" fill className="object-cover transition group-hover:scale-[1.02]" />
    <Badge variant="solida" className="absolute top-3 left-3">{estado}</Badge>
  </div>
  <p className="texto-titulo-tarjeta mt-3">{nombre}</p>
  <p className="text-sm text-tinta-2">{programa}</p>
</Link>
```

### 4.5 Fila de chips (filtros)

La barra de categorías de Airbnb: icono arriba, etiqueta abajo, activo con
subrayado tinta, scroll horizontal sin barra.

```tsx
<FilaChips>
  <ChipFiltro icono={Users} etiqueta={t("all")} activo href="?estado=" />
  <ChipFiltro icono={CheckCircle2} etiqueta={t("active")} href="?estado=activo" />
</FilaChips>
```

### 4.6 Tabla ↔ tarjetas

Mismo listado, dos formas: tabla limpia en ≥ md (cabecera `texto-meta`, filas
`h-14`, separador `linea`, hover `bg-muted/50`) y lista de tarjetas en < md.

```tsx
<table className="hidden w-full md:table">…</table>
<ul className="space-y-3 md:hidden">…</ul>
```

### 4.7 Formulario largo

Secciones con `texto-titulo-seccion`, campos en 1 columna en móvil y 2 en
escritorio, y barra de acciones fija abajo: "Cancelar" como enlace y "Guardar"
como primario.

```tsx
<div className="sticky bottom-0 flex justify-between border-t border-linea bg-background py-4">
  <Button variant="link">{t("cancel")}</Button>
  <Button cargando={enviando}><Save />{t("save")}</Button>
</div>
```

### 4.8 Hoja inferior

En móvil, todo diálogo es una hoja que sube desde abajo (lo hace `Dialog` solo).

### 4.9 Estado vacío

```tsx
<EstadoVacio icono={Inbox} titulo={t("empty")} texto={t("emptyHint")} accion={<Button>…</Button>} />
```

### 4.10 Skeleton

Mientras carga, la misma forma que el contenido, con `Skeleton`
(`animate-shimmer`). Cada pantalla trae su `loading.tsx`.

```tsx
<Skeleton className="h-8 w-64 rounded-control" />
```

## 5. Avisos y errores

- Aviso estándar: `bg-marca-50 text-marca-700` con `Info`.
- Aviso grave o error: `bg-tinta text-background` con `AlertCircle`.
- Éxito: `bg-marca-50 text-marca-700` con `CheckCircle2`.
- Nunca rojo ni naranja.

## 6. Iconos

Solo `lucide-react`, nunca emoji. Tamaños `size-4` (en texto), `size-5`
(navegación, acciones) y `size-6` (estado vacío, accesos). En navegación, el
icono activo es `marca-500` y el inactivo `tinta-2`.

## 7. Verificación

```bash
npm run audit:ui   # colores fuera de marca y hex sueltos en .tsx
npm run lint && npm run build && npm run i18n:check
```

Las excepciones del hex (componentes de gráficas que pintan con `fill`, y los
estados `SEMAFORO`) están listadas en `scripts/auditar-ui.mjs`.
