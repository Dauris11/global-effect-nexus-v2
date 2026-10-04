# Rediseño "app web" + optimización + reorganización — Global Effect Nexus

> **Para:** Claude Code (y cualquier agente que trabaje en el repo, incluida la IA de Antigravity).
> **De:** revisión hecha el 2026-10-03 sobre la rama `marca-panel-y-limpieza`, con el retiro de Psicología y el módulo de Solicitudes todavía sin commitear.
> **Cómo usar este archivo:** ejecuta las fases **en orden**, una por sesión o por PR. Cada fase cierra con su verificación. No empieces una fase con la anterior en rojo.
>
> **Nota de ejecución (2026-10-03):** el retiro de Psicología y las Solicitudes se commitearon (`5923f33`) y sus migraciones se aplicaron en Supabase antes de la Fase 1. El dato de "~47 archivos" del punto 0.2 era anterior a ese cierre: al empezar quedaban 7, todos menciones históricas deliberadas. Por decisión del usuario, las fases se ejecutan **sobre la rama actual**, sin crear `docs/reorganizacion` ni `feat/ui-app-web`.

---

## 0. Contexto que tienes que respetar (léelo antes de tocar nada)

1. **Qué es el sistema.** ERP institucional de la Fundación Global Effect (La Vega, RD) con portal del estudiante integrado. Proyecto final de grado UCATECI (Dauris Santana y Gabriela García). Next.js 16 (App Router, `src/app/[locale]`), React 19, Tailwind 4 CSS-first, shadcn/Radix, Supabase (Auth + Postgres vía `pg`), `next-intl` es/en, capa `src/server/<dominio>/{consultas,acciones}.ts`, RBAC en `src/lib/rbac.ts`, menú en `src/lib/nav.ts`.
2. **Cambio de alcance de octubre 2026.** Psicología se eliminó (`0030_fin_de_psicologia.sql`) y entra **Solicitudes y aprobaciones** (`0031`). Ese trabajo está en curso y sin commitear. **Termínalo y haz commit antes de empezar la Fase 1.** Quedan ~47 archivos en `src/` que mencionan psicología: son tuyos de cerrar dentro de ese trabajo, no de este rediseño.
3. **La marca no cambia.** Turquesa `#2096BA`, hover `#187a99`, oscuro `#0a6a8a`, suave `#5FB8D4`, tinta `#171A1D`, grises slate. Prohibido el arcoíris (regla de `.claude/rules/design-system.md`). Excepción `SEMAFORO` (`#1E9E6A` / `#B4342B`) solo para estados de entidad y siempre con icono.
4. **Lo que sí cambia es el lenguaje visual:** pasamos de "panel administrativo con barra negra y banners en degradado" a **"app web limpia, estilo Airbnb"**: blanco dominante, tinta fuerte, un solo acento usado con moderación, mucho aire, tarjetas grandes con radio generoso, sombras suaves, navegación clara y comportamiento de app en móvil.
5. **Reglas que siguen vigentes:** todo texto visible por `next-intl` en `es.json` **y** `en.json`; cero cadenas literales en JSX; SQL parametrizado con `consultar`/`consultarUna`/`enTransaccion`; `requerirUsuario`/`requerirRol` en cada pantalla; comentarios en español explicando el porqué.
6. **Dos IAs en el mismo repo.** Antigravity y Claude Code deben leer las mismas reglas. Por eso la Fase 1 crea `AGENTS.md` además de `CLAUDE.md`, y ambos apuntan al mismo documento de diseño.

### Diagnóstico de la revisión (por qué este plan)

| Hallazgo | Dato | Consecuencia |
|---|---|---|
| Color escrito a mano | `#2096BA` aparece **359 veces** en **89** `.tsx`; `#187a99` 152; `#171A1D` 70 | Cambiar el look exige tocar 89 archivos. Los tokens de `globals.css` existen pero casi no se usan |
| Radios sin escala | Se mezclan `rounded-md`, `-lg`, `-xl`, `-2xl`, `-3xl` para lo mismo | La UI se ve "armada a mano", no como producto |
| Shell de panel antiguo | Sidebar negra `#171A1D`, topbar con título `text-xs` en móvil, banners en degradado por rol | Es lo que más aleja la app del estilo Airbnb |
| Sin estados de carga | No hay ni un `loading.tsx`, `error.tsx` ni `not-found.tsx` en `src/app` | Navegación con saltos en blanco; no se siente app |
| Sin navegación móvil de app | Solo cajón lateral | En teléfono se siente web vieja, no app |
| No es instalable | No hay `manifest`, `theme-color` ni iconos de app | No se puede "añadir a inicio" |
| Código de referencia en producción | `components/ui/event-manager-referencia.tsx` (1 509 líneas) + ruta `/referencia/calendario` | Peso y ruido; único archivo que aún usa clases arcoíris |
| `components/ui` mezclado | `event-manager.tsx` (1 644 líneas) y `globe.tsx` viven junto a los primitivos | `ui/` deja de ser "el kit" |
| Páginas gigantes | `expedientes` 741, `dashboard` 558, `reportes` 570, `gantt` 577, `portal/estudiante` 534 líneas | Difíciles de rediseñar sin romper |
| Raíz saturada de docs | 13 `.md`/`.txt` en la raíz; varios describen el **prototipo Base44** (React+Vite) y no el sistema actual | Los agentes leen el documento equivocado |
| Documentación contradictoria | `README.md` línea ~177 dice "No hay norma visual vigente… sin estilos a propósito" y el mismo README dice que `estilos.md` es la fuente de verdad | Un agente puede negarse a estilizar o estilizar fuera de norma |
| `estilos.md` está en formato "prompt para reconstruir en React+shadcn" | Describe el estilo de agosto | Hay que reescribirlo como norma del nuevo look |

---

## 1. Fase 1 — Reorganizar carpetas y documentación

> Ejecutar **solo cuando el trabajo de documentación y de Psicología/Solicitudes esté commiteado.** Usa `git mv` siempre (conserva historial). Rama: `docs/reorganizacion`.

### 1.1 Estructura objetivo

```
/
├─ README.md                  ← puesta en marcha (se queda, se corrige)
├─ CLAUDE.md                  ← NUEVO: reglas cortas para Claude Code → apunta a docs/
├─ AGENTS.md                  ← NUEVO: lo mismo para Antigravity/Gemini/otros
├─ .claude/rules/design-system.md  ← se actualiza al nuevo look (Fase 2)
├─ db/  scripts/  messages/  public/  src/   ← sin cambios de ubicación
└─ docs/
   ├─ README.md               ← índice (se actualiza)
   ├─ 01 … 08                 ← se quedan
   ├─ 09-sistema-visual.md    ← antes estilos.md (reescrito en Fase 2)
   ├─ estado/                 ← documentos vivos de avance
   │  ├─ progreso.md               (PROGRESO.md)
   │  ├─ pendientes.md             (PENDIENTES.md)
   │  ├─ plan-etapas.md            (PLAN-ETAPAS.md)
   │  └─ inventario-vs-fases.md    (INVENTARIO-VS-FASES.md)
   ├─ referencia/             ← descripciones funcionales vigentes
   │  ├─ modulos-por-portal.md     (modulos_por_portal.md)
   │  └─ dependencias.md           (dependencias.txt, convertido a md)
   ├─ prototipo-base44/       ← histórico: describe el prototipo v1, NO el código actual
   │  ├─ README.md                 (NUEVO: 5 líneas avisando que es histórico)
   │  ├─ descripcion-del-proyecto.md  (descripcion_del_proyecto.md)
   │  ├─ inventario-sistema.md        (invetario_sistema.md)
   │  ├─ prompt-maestro.md            (otro.md)
   │  ├─ prompt-landing.md            (incio.md)
   │  └─ prompt-formulario-expediente.md (expedientes.md)
   ├─ prompts/                ← prompts operativos para agentes
   │  └─ rediseno-app-web.md       (ESTE archivo)
   ├─ entregables/            ← se queda; recibe:
   │  └─ contexto-general.md       ("contexto general.md" — texto de la primera entrega)
   ├─ fuentes-datos/          ← se queda
   └─ 04-modelo-de-datos/     ← se queda
```

### 1.2 Prompt (copiar y pegar)

```text
Reorganiza la documentación del repo siguiendo la sección 1.1 de docs/prompts/rediseno-app-web.md.

1. Crea la rama docs/reorganizacion desde la rama actual (con todo commiteado).
2. Mueve cada archivo con `git mv` exactamente a la ruta indicada. Renombra a kebab-case sin tildes ni espacios.
3. Convierte dependencias.txt a markdown (mismo contenido, con bloques de código) en docs/referencia/dependencias.md.
4. Crea docs/prototipo-base44/README.md: avisa que esos documentos describen el prototipo v1 sobre Base44 (React+Vite), que NO son normativos para el código Next.js actual, y que se conservan como antecedente de la tesis.
5. Arregla TODOS los enlaces rotos: busca con
   grep -rnE '\]\((\.\./)?(PROGRESO|PENDIENTES|PLAN-ETAPAS|INVENTARIO-VS-FASES|estilos|modulos_por_portal|descripcion_del_proyecto|invetario_sistema|otro|incio|expedientes|dependencias|contexto general)[^)]*\)' --include=*.md .
   y también en comentarios de código: grep -rn "estilos.md\|PROGRESO.md\|PENDIENTES.md" src scripts db .claude
   Sustituye por las rutas nuevas. En comentarios de código, "estilos.md" pasa a "docs/09-sistema-visual.md".
6. Actualiza docs/README.md: añade 09 al índice y las carpetas estado/, referencia/, prototipo-base44/, prompts/.
7. README.md raíz: elimina la viñeta "No hay norma visual vigente…" (contradice el resto) y sustitúyela por: "La norma visual es docs/09-sistema-visual.md y .claude/rules/design-system.md; si una pantalla y la norma no coinciden, gana la norma". Corrige la sección "Estructura del proyecto" para que refleje src/ real (components por dominio, server/ por dominio, lib/, i18n/).
8. Crea CLAUDE.md y AGENTS.md (≤ 60 líneas cada uno, mismo contenido): qué es el proyecto, comandos (dev, lint, build, i18n:check, db:*), reglas duras (marca, i18n, SQL, RBAC, comentarios en español), y la lista de documentos a leer según la tarea (diseño → docs/09 + .claude/rules; datos → docs/04; módulos → docs/03 y docs/referencia; estado → docs/estado).
9. Verificación: `npm run lint`, `npm run build`, y un script rápido que recorra todos los .md y compruebe que cada enlace relativo apunta a un archivo existente. Cero enlaces rotos.
10. Commit en español: "Documentación ordenada: estado, referencia y prototipo separados".
```

---

## 2. Fase 2 — Sistema visual nuevo (tokens antes que pantallas)

> Rama: `feat/ui-app-web`. Esta fase **no toca pantallas**: solo define el sistema. Si se salta, el rediseño vuelve a llenar 89 archivos de hex.

### 2.1 Dirección de diseño (la referencia es Airbnb, adaptada a la marca)

| Aspecto | Hoy | Nuevo |
|---|---|---|
| Fondo | `slate-50` + tarjetas blancas con borde y `shadow` | **Blanco** como lienzo. Superficies se separan por espacio y por línea fina `#EBEEF1`, no por cajas grises |
| Acento | Turquesa en todo (banners, iconos, títulos, insignias) | Turquesa **solo** en CTA principal, estado activo, enlaces y foco. Todo lo demás en tinta y grises |
| Tinta | `#171A1D` | Igual. Textos secundarios `#5B6470`; terciarios `#8A929C` |
| Títulos | `font-bold/extrabold`, `text-xl` en banner | `font-semibold`, `tracking-tight`. Título de página 28/32 px, sección 22 px, tarjeta 16 px |
| Cuerpo | `text-sm` casi en todo | **15 px** base en portal, 16 px en landing. `text-sm` solo para metadatos |
| Radios | Mezcla libre | Escala fija: control **12 px**, tarjeta **16 px**, hoja/modal **24 px**, píldora `full` |
| Sombras | `shadow`, `shadow-lg` con tinte azul | Dos niveles neutros: `--shadow-card: 0 1px 2px rgb(0 0 0/.04), 0 2px 8px rgb(0 0 0/.06)` y `--shadow-elevada: 0 6px 20px rgb(0 0 0/.12)` (hover y popovers) |
| Banners por rol | Degradado turquesa→oscuro con KPIs en blanco | **Fuera.** Cabecera limpia: saludo grande ("Hola, María") + subtítulo gris + fila de tarjetas KPI blancas |
| Sidebar | Negra `#171A1D` | **Blanca**, borde derecho fino, ítem activo = píldora `slate-100` con texto tinta semibold e icono turquesa |
| Botón primario | `rounded-md h-9` | `rounded-xl h-11`, `font-semibold`, degradado sutil `#2096BA→#187a99` (como el CTA de Airbnb), `active:scale-[.97]` |
| Inputs | `h-9 rounded-md` | `h-12 rounded-xl`, borde `#D5DBE1`, foco = borde tinta 2 px (como Airbnb), etiqueta arriba en `text-sm font-medium` |
| Listados | Tablas densas | Tablas en escritorio **y** tarjetas en móvil; filtros como **fila de chips con icono** desplazable (la barra de categorías de Airbnb) |
| Modales | Dialog centrado | Centrado `rounded-3xl` en escritorio con X a la izquierda y pie fijo; **hoja inferior** (bottom sheet) en móvil |
| Movimiento | 3 animaciones | Las mismas 3 + transición de página (View Transitions) y skeletons; nada de rebotes |

### 2.2 Prompt (copiar y pegar)

```text
Define el sistema visual nuevo "app web estilo Airbnb" de Global Effect Nexus. Lee primero docs/prompts/rediseno-app-web.md sección 2.1 y respétala al pie de la letra. NO toques pantallas todavía.

1. src/app/globals.css
   - Añade una escala de marca como tokens Tailwind 4 en @theme: --color-marca-50 … --color-marca-900 derivada de #2096BA (500 = #2096BA, 600 = #187a99, 700 = #0a6a8a, 300 = #5FB8D4), y --color-tinta (#171A1D), --color-tinta-2 (#5B6470), --color-tinta-3 (#8A929C), --color-linea (#EBEEF1), --color-linea-fuerte (#D5DBE1).
   - Cambia :root: --background #FFFFFF; --muted #F6F7F9; --border = linea; --input = linea-fuerte; sidebar CLARA (--sidebar #FFFFFF, --sidebar-foreground tinta, --sidebar-accent #F2F4F6, --sidebar-border linea).
   - Escala de radios propia: --radius-control 12px, --radius-card 16px, --radius-hoja 24px, expuestas como utilidades (rounded-control, rounded-card, rounded-hoja).
   - Sombras: --shadow-card y --shadow-elevada (valores en la sección 2.1) como utilidades shadow-card y shadow-elevada.
   - Tipografía: body 15px/1.5; clases de texto semánticas con @utility: texto-titulo-pagina (28px→32px md, semibold, tracking-tight), texto-titulo-seccion (22px semibold), texto-titulo-tarjeta (16px semibold), texto-meta (13px tinta-3).
   - Añade la animación de transición de página con @view-transition { navigation: auto; } y un fade de 180 ms; respeta prefers-reduced-motion en TODAS las animaciones.
   - Mantén el bloque .dark coherente con los nuevos tokens (superficies #111416 / #181B1E, línea #2A2F35).
2. src/lib/paleta.ts: reescribe los objetos (CUADRO, ESTADO, PRIORIDAD, TARJETA, BOTON, STAT_CARD, VACIO, PILDORA_FILTRO, PORTAL_BANNER…) para que usen las clases de token (bg-marca-500, text-tinta-2, rounded-card, shadow-card…) y NO hex literales. Marca GRADIENTE, GRADIENTE_OSCURO y PORTAL_BANNER como @deprecated (se eliminan en la Fase 5). SEMAFORO se queda igual.
3. Reescribe docs/09-sistema-visual.md (antes estilos.md) como NORMA, no como prompt: principios, tokens, escala tipográfica, radios, sombras, espaciado (4/8/12/16/24/32/48), patrones (cabecera de página, tarjeta KPI, tarjeta de entidad, fila de chips, tabla↔tarjetas, hoja inferior, estado vacío, skeleton) con un fragmento de JSX de ejemplo por patrón.
4. Actualiza .claude/rules/design-system.md (en español, ya no en inglés) con las reglas duras nuevas, y amplía la auditoría:
   - la grep de colores arcoíris que ya existe, más
   - grep -rnE '#[0-9A-Fa-f]{6}' src --include=*.tsx  → debe devolver 0 fuera de src/lib/paleta.ts y de componentes de gráficas que necesiten el color crudo (documenta la lista de excepciones).
   Añade el script npm "audit:ui" que ejecute ambas y falle si hay coincidencias fuera de las excepciones.
5. Verificación: npm run lint && npm run build. La app debe compilar; es normal que aún se vea mezclada.
Commit: "Sistema visual app web: tokens, radios, sombras y escala tipográfica".
```

---

## 3. Fase 3 — Primitivos de UI (`src/components/ui`)

### 3.1 Prompt (copiar y pegar)

```text
Rediseña los primitivos de src/components/ui con los tokens de la Fase 2 (docs/09-sistema-visual.md). Mantén la API pública (props y exports) para no romper pantallas.

1. button.tsx: variantes default (degradado marca-500→marca-600, texto blanco, semibold), secondary (blanco, borde linea-fuerte, texto tinta), ghost, outline, link, destructive (tinta, NO rojo). Tamaños sm h-9, default h-11, lg h-12, icon size-11. rounded-control. active:scale-[.97], transición 150 ms. Añade prop `cargando` que muestre un spinner y deshabilite.
2. input.tsx, textarea.tsx, select.tsx: h-12, rounded-control, borde linea-fuerte, foco = ring de 2px tinta (no turquesa), placeholder tinta-3. Estado aria-invalid con borde #B4342B (SEMAFORO) + mensaje.
3. card.tsx: rounded-card, borde linea, shadow-card; prop `interactiva` que añada hover:shadow-elevada y hover:-translate-y-0.5. CardTitle pasa a texto-titulo-tarjeta en tinta (hoy es text-muted).
4. dialog.tsx: en ≥ md modal centrado rounded-hoja, cabecera con botón cerrar a la IZQUIERDA y título centrado, pie fijo con borde superior. En < md se renderiza como hoja inferior (desliza desde abajo, asa superior, max-h-[90dvh], scroll interno).
5. badge.tsx: píldora rounded-full, text-xs font-medium; variantes neutra (bg-muted text-tinta-2), marca (bg-marca-50 text-marca-700), solida (bg-tinta text-white).
6. tabs.tsx: estilo subrayado (como las pestañas de Airbnb): texto tinta-2, activo tinta semibold con barra inferior de 2px tinta.
7. Crea primitivos nuevos:
   - skeleton.tsx (usa animate-shimmer).
   - stat-card.tsx: unifica components/academico/cifra.tsx y components/estudiante/cifra.tsx en un solo componente con variant="con-icono" | "centrada"; deja los dos archivos viejos re-exportando el nuevo para no romper imports y márcalos @deprecated.
   - chip-filtro.tsx + fila-chips.tsx: chips con icono lucide arriba y etiqueta abajo, activo con subrayado tinta; contenedor con scroll horizontal, sin barra visible, con sombra de desvanecido en los bordes.
   - estado-vacio.tsx: icono grande en círculo bg-muted, título, texto y acción opcional.
   - encabezado-pagina.tsx: título (texto-titulo-pagina), subtítulo, acciones a la derecha; en móvil las acciones pasan debajo.
8. Mueve lo que NO es primitivo fuera de ui/:
   - components/ui/event-manager.tsx → components/calendario/event-manager.tsx (actualiza los 2 imports).
   - components/ui/globe.tsx → components/landing/globe.tsx (actualiza el import de globo-apoyo.tsx).
   - Borra components/ui/event-manager-referencia.tsx y la ruta src/app/[locale]/(portal)/referencia/ (y su entrada en nav.ts si la tiene). Era un componente de comparación, no producto.
9. Verificación: npm run lint && npm run build && npm run audit:ui.
Commit: "Primitivos de UI al estilo app web, y ui/ solo con primitivos".
```

---

## 4. Fase 4 — Armazón de app (shell, navegación, móvil)

### 4.1 Prompt (copiar y pegar)

```text
Rediseña el armazón del portal (src/components/layout) para que se sienta app web, siguiendo docs/09-sistema-visual.md.

1. sidebar.tsx: barra CLARA (bg-sidebar blanco, borde derecho linea). Logo real (public/) en vez del cuadro "GE" cuando está desplegada; isotipo cuando está replegada. Ítem: h-11, rounded-control, icono size-5 tinta-2; activo = bg-sidebar-accent, texto tinta semibold, icono marca-500. Encabezados de área en texto-meta sin mayúsculas forzadas. Buscador como píldora rounded-full bg-muted. Conserva TODA la lógica existente (repliegue, buscador, cerrar sesión siempre visible, min-h-0 para Safari) y sus comentarios.
2. topbar.tsx: h-16 blanco con borde inferior linea solo al hacer scroll (sombra suave aparece al desplazarse). En el centro, en ≥ md, una barra de búsqueda tipo Airbnb (píldora rounded-full, shadow-card, icono lupa en círculo marca-500 a la derecha) que abre un buscador de comandos (Cmd/Ctrl+K) sobre las rutas de nav.ts del rol. Derecha: aviso, campana, y un botón-píldora "menú + avatar" (como Airbnb) que abre un dropdown con Perfil, Configuración, Idioma es/en y Cerrar sesión. El título de la página sale de la topbar y pasa a EncabezadoPagina dentro de cada página (en móvil hoy queda en text-xs, que es ilegible).
3. NUEVO components/layout/barra-inferior.tsx: barra de pestañas fija abajo SOLO en < md, h-16 + safe-area-inset-bottom, fondo blanco con borde superior, 5 destinos con icono + etiqueta (text-[11px]), activo en marca-500.
   - Estudiante: Inicio, Aula, Calendario, Solicitudes, Perfil.
   - Personal (resto de roles): los 4 primeros ítems de mayor uso de su menú en nav.ts + "Más" que abre la hoja inferior con el menú completo.
   Define en nav.ts una función `pestanasMoviles(rol, tipoEstudiante)` en lugar de cablear rutas en el componente. Textos por next-intl en es y en.
   En móvil el cajón lateral deja de abrirse con hamburguesa: "Más" lo sustituye. Añade padding-bottom al <main> para que la barra no tape contenido.
4. app-shell.tsx: <main> con contenedor max-w-[1280px] mx-auto, padding 16/24/32 px por breakpoint, fondo blanco.
5. Elimina banner-portal.tsx como banner en degradado: BannerPortal pasa a renderizar EncabezadoPagina con saludo ("Hola, {nombre}") + fila de StatCard. AccesosPortal pasa a tarjetas grandes estilo Airbnb (icono en círculo bg-muted arriba, título semibold, texto tinta-2, Card interactiva). Mantén las props para que los portales no cambien de firma. Retira ESTILO_POR_ROL.gradiente de su uso (deja la insignia de rol solo en el dropdown del avatar).
6. Metadatos de app en src/app/[locale]/layout.tsx: export const viewport con themeColor #FFFFFF, viewportFit "cover"; appleWebApp { capable: true, statusBarStyle: "default", title }.
7. Verificación: npm run lint && npm run build && npm run i18n:check && npm run audit:ui; y node scripts/probar-webkit.mjs capturas/fase4 (390, 768 y 1440 px) — nada se sale de lado, barra inferior visible en 390, cerrar sesión alcanzable en los tres anchos.
Commit: "Armazón de app: barra lateral clara, búsqueda tipo píldora y pestañas en móvil".
```

---

## 5. Fase 5 — Pantallas (por oleadas, de mayor a menor uso)

### 5.1 Patrón que debe seguir CADA pantalla

1. `EncabezadoPagina` arriba (título, subtítulo, acciones).
2. Si es un listado: `FilaChips` de filtros → buscador → en ≥ md tabla limpia (cabecera `texto-meta`, filas h-14, separador `linea`, hover `bg-muted/50`) y en < md lista de tarjetas.
3. Entidades con foto (expedientes, estudiantes, personal, patrocinadores): **tarjeta de entidad** estilo anuncio de Airbnb — foto/avatar grande `aspect-[4/3] rounded-card`, nombre semibold, 1–2 líneas `tinta-2`, insignia de estado arriba a la izquierda sobre la foto.
4. Formularios largos (expediente, solicitud): secciones con título de sección, campos en 1 columna en móvil / 2 en escritorio, barra de acciones fija abajo con "Cancelar" (link) y "Guardar" (primario), igual que el flujo de reserva de Airbnb.
5. Vacío → `EstadoVacio`. Carga → skeleton con la misma forma que el contenido.
6. Ninguna página > 300 líneas: lo que exceda se parte en componentes en `components/<dominio>/`.

### 5.2 Prompt (copiar y pegar; repetir por oleada)

```text
Aplica el patrón de pantalla de docs/prompts/rediseno-app-web.md §5.1 a esta oleada. Para cada pantalla: (a) reemplaza hex y clases sueltas por tokens/primitivos, (b) aplica el patrón, (c) si pasa de 300 líneas, extrae componentes a components/<dominio>/, (d) añade loading.tsx con skeleton de la misma forma, (e) no cambies consultas ni permisos.

OLEADA 1 (lo que más se ve): landing (src/app/[locale]/page.tsx + components/landing/*), login ((auth)/login + components/auth/login-form.tsx), portal/estudiante (inicio, aula-virtual, calendario, calificaciones, global-360, prematricula, chat), dashboard.
  - Landing: navbar blanca con la búsqueda-píldora como acceso ("¿A qué portal entras?"), hero con foto a sangre y esquinas rounded-hoja dentro del contenedor (no degradado), programas y eventos como tarjetas tipo anuncio en carrusel horizontal con snap en móvil, footer en columnas sobre bg-muted.
  - Login: tarjeta centrada max-w-[440px] rounded-hoja shadow-elevada, título "Inicia sesión" semibold, inputs h-12, botón primario a ancho completo, separador "o" y Google como botón secondary.
  - Portal estudiante: saludo + próxima clase/tarea como tarjeta destacada, accesos en cuadrícula 2×N en móvil.
OLEADA 2: expedientes (lista + [id] + formularios), solicitudes y aprobaciones, academico/*, academias/*.
OLEADA 3: administrativo/* (Kanban con columnas bg-muted rounded-card y tarjetas blancas), calendario y gantt, contabilidad, patrocinadores, reportes, servicios-mensuales, inscripcion-comida, comida (pública), configuracion/*, perfil, chat-ia.

Al terminar cada oleada: npm run lint && npm run build && npm run i18n:check && npm run audit:ui, capturas con scripts/probar-webkit.mjs a 390 y 1440, y actualiza docs/estado/progreso.md con lo rediseñado.
Commit por oleada: "Oleada N del rediseño: <pantallas>".
Al terminar la oleada 3: borra de paleta.ts lo marcado @deprecated y los re-exports de cifra.tsx.
```

---

## 6. Fase 6 — Sensación de app y rendimiento

### 6.1 Prompt (copiar y pegar)

```text
Haz que Global Effect Nexus se sienta y rinda como app web. Sigue docs/prompts/rediseno-app-web.md §6.

1. Estados de ruta: añade en src/app/[locale]/(portal)/ un loading.tsx genérico (skeleton de EncabezadoPagina + 3 StatCard + lista), un error.tsx (EstadoVacio con "Reintentar" que llama a reset(), sin exponer el error) y un not-found.tsx. Igual para (auth) y para la landing. Las pantallas de la Fase 5 ya traen su loading.tsx específico.
2. Instalable (PWA ligera): src/app/manifest.ts con name, short_name "GE Nexus", start_url "/es/dashboard", display "standalone", background_color y theme_color #FFFFFF, iconos 192/512 y maskable generados con sharp desde el logo (script scripts/generar-iconos-app.mjs, sin dependencias nuevas). apple-touch-icon. NO añadas service worker todavía (las páginas dependen de sesión y datos frescos); deja la nota en docs/estado/pendientes.md.
3. Imágenes: quedan 5 <img> (perfil/page.tsx, formulario-perfil.tsx, formulario-edicion-expediente.tsx, sidebar.tsx, seccion-noticias.tsx). Los que muestran la vista previa de un archivo recién elegido (blob:) se quedan como <img>, con un comentario que lo explique; los que pintan imágenes guardadas (avatar de la barra, noticias) pasan a next/image con sizes correctos (configura images.remotePatterns para el dominio de Supabase Storage). Hero de la landing con priority y placeholder blur.
4. Frontera cliente/servidor: hay 54 archivos "use client". Revisa cada uno y baja la directiva al componente hoja que de verdad necesita estado o eventos. Objetivo: que layouts y páginas sean de servidor.
5. Carga diferida: next/dynamic con ssr:false para el globo (cobe), recharts y el event-manager del calendario, cada uno con su skeleton.
6. Navegación: <Link prefetch> por defecto en barra lateral y barra inferior; View Transitions ya activadas en la Fase 2 — verifica que no rompen el cajón ni los modales.
7. Accesibilidad mínima: objetivos táctiles ≥ 44 px, foco visible en todo lo interactivo, contraste AA (tinta-3 solo para texto ≥ 13 px no esencial), aria-current="page" en la navegación.
8. Mide: npm run build e informa el tamaño de First Load JS de /es, /es/login, /es/dashboard y /es/portal/estudiante antes y después. Inclúyelo en el mensaje de commit.
Commit: "Sensación de app: estados de carga, instalable, imágenes y menos JS en cliente".
```

---

## 7. Fase 7 — Cierre y verificación final

```text
Cierra el rediseño:
1. npm run lint, npm run build, npm run i18n:check, npm run audit:ui → todo en verde.
2. Capturas con scripts/probar-webkit.mjs a 390/768/1440 de: landing, login, dashboard (admin y coordinacion@), portal estudiante, expedientes (lista y detalle), solicitudes, calendario, Kanban. Guárdalas en docs/estado/capturas-rediseno/ (añade la carpeta a .gitignore si pesan más de 5 MB en total y deja solo un README con cómo regenerarlas).
3. Revisa en modo oscuro que nada quede ilegible.
4. Actualiza docs/estado/progreso.md, README.md (estado) y docs/09-sistema-visual.md con cualquier decisión tomada durante las fases.
5. Abre PR de feat/ui-app-web hacia main con resumen por fase, las métricas de First Load JS y las capturas antes/después.
```

---

## 8. Reglas de convivencia entre agentes (Claude Code + Antigravity)

1. **Una rama por agente y por fase.** Nunca dos agentes en la misma rama a la vez.
2. Antes de empezar: `git pull` y `git status` limpio. Si hay cambios sin commitear que no son tuyos, **para y avisa**; no los mezcles.
3. Las reglas viven en `AGENTS.md` / `CLAUDE.md` → `docs/09-sistema-visual.md` → `.claude/rules/design-system.md`. Si una IA cambia la norma, actualiza los tres en el mismo commit.
4. Ningún agente introduce colores, radios o sombras fuera de los tokens. `npm run audit:ui` es el árbitro.
5. Documentación de avance solo en `docs/estado/`. No crear más `.md` en la raíz.
