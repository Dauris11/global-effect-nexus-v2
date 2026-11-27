# Portal GlobalEffect — reglas para agentes

ERP institucional de la Fundación Global Effect (La Vega, RD) con portal del
estudiante integrado. Proyecto final de grado (UCATECI). Next.js 16 (App Router,
`src/app/[locale]`), React 19, Tailwind 4 CSS-first, shadcn/Radix, Supabase
(Auth + Postgres vía `pg`, sin ORM), `next-intl` es/en.

`CLAUDE.md` y `AGENTS.md` dicen lo mismo: uno lo lee Claude Code y el otro
Antigravity/Gemini. Si cambias uno, cambia el otro en el mismo commit.

## Nombres (no cambiar sin avisar)

- **Proyecto / tesis:** «Sistema Web Inteligente para la Gestión Académica y
  Administrativa de la Fundación Global Effect».
- **Producto y portal:** «Portal GlobalEffect» (según el subdominio): la parte
  administrativa ERP y el portal del estudiante y del docente para las clases.
- **Asistente de IA:** «Elly AI». El nombre «Nexus» ya no existe: no lo
  reintroduzcas en textos, código, documentos ni datos.

## Comandos

```bash
npm run dev            # http://localhost:3000
npm run lint           # ESLint
npm run build          # build + tipos
npm run i18n:check     # claves de es.json y en.json simétricas y existentes
npm run audit:ui       # colores fuera de la marca y hex sueltos
npm run db:migrate     # migraciones de db/migrations (idempotente)
npm run db:seed        # y db:seed:usuarios · db:seed:operaciones · db:seed:portales
```

## Reglas duras

1. **Marca:** turquesa `#2096BA`, hover `#187a99`, oscuro `#0a6a8a`, suave
   `#5FB8D4`, tinta `#171A1D` y grises. Nada de arcoíris. `SEMAFORO`
   (`#1E9E6A`/`#B4342B`) solo para estados de entidad y siempre con icono.
   Usa los tokens y `src/lib/paleta.ts`, no hex sueltos.
   **EXCEPCIÓN — colores de estado (nov 2026):** los colores de la marca NO se
   tocan: turquesa, hover, oscuro, suave, tinta y grises siguen siendo la
   identidad, los botones, los enlaces y la navegación. Solo estados, estatus,
   prioridades y módulos pueden llevar color, y de UN estándar: los tokens
   `est-*` y `pri-*` de `globals.css` a través de `src/lib/estados-trabajo.ts`
   (`ESTADO` de `paleta.ts` ya los usa). Siempre con icono; nunca en botones,
   banners ni gráficas; no se inventan colores por pantalla.
2. **i18n:** todo texto visible va en `messages/es.json` **y** `messages/en.json`.
   Cero cadenas literales en JSX.
3. **SQL:** parametrizado con `consultar` / `consultarUna` / `enTransaccion`
   (`src/lib/db.ts`). Nada de interpolar valores.
4. **RBAC:** cada pantalla y cada acción con `requerirUsuario` / `requerirRol` /
   `requerirPermiso` (`src/lib/auth.ts`); los permisos en `src/lib/rbac.ts`
   copian `rol_permiso`. Esconder un botón no es control de acceso.
5. **Código en español:** nombres, archivos y comentarios. Los comentarios
   explican **por qué**, no qué.
6. **Capa servidor:** `src/server/<dominio>/{consultas,acciones}.ts`. Un
   componente cliente solo importa **tipos** de `consultas`; los valores
   compartidos van en `src/lib/`.
7. **Avance:** solo en `docs/estado/`. No crear más `.md` en la raíz.
8. Psicología ya no existe (migración `0030`, oct 2026): no reintroducirla.
9. Los cursos técnicos ya no existen (migración `0047`, oct 2026): no
   reintroducirlos. Solo hay becados y Global Effect 360.
10. Roles definitivos (migración `0065`): `super_admin`, `admin`, `docente`,
    `estudiante`, `contabilidad`, `habitudes`, `dir_habitudes`, `chofer`.
    `colaborador` ya no existe: no reintroducirlo. Para decidir qué puede una
    PERSONA usa `usuarioTienePermiso(usuario, …)` (rol en `rol_permiso` +
    excepciones de `usuario_permiso`), nunca `tienePermiso(rol, …)`, que es
    solo el reparto de fábrica. Las funciones fuera del rol (p. ej. dar clases
    de 360) se controlan por permiso (`docencia.impartir`), no por `rol ===`.
11. **Git:** todo se commitea y se sube directo a `main`, sin ramas ni PR. Antes
    de empujar, `git pull --rebase origin main` (hay más de una persona
    empujando). La base de Supabase es compartida: una migración y el código
    que la usa se aplican y se suben juntos (`npm run db:migrate`).
12. **Fechas:** la Fundación está en `America/Santo_Domingo` y el servidor corre
    en UTC. «Hoy» sale de `claveDia()` / `diaEnRD()` (`src/lib/fechas.ts`) y, en
    SQL, de `(now() AT TIME ZONE 'America/Santo_Domingo')::date`. Nunca
    `CURRENT_DATE` ni `new Date().toISOString().slice(0, 10)`.
13. **Contabilidad:** el catálogo es el de 103 cuentas del Excel (migración
    `0121`; reemplazó el de 88 de la `0107`); no reintroduzcas los códigos
    viejos (`1.1.01.xx`…). En contabilidad nada se borra: se anula con motivo.
    El costo por estudiante (`/expedientes` pestaña «Costos» y su reporte)
    nunca lo ven estudiante, docente, chofer ni Habitudes.
14. **Gráficos, calendarios y Gantt:** solo a través de `ui/grafico/`,
    `ui/calendario-base.tsx` y `ui/gantt-base.tsx`. No importes `recharts`,
    `@fullcalendar/*` ni `@svar-ui/*` en otro sitio.
15. **«Pendientes»** (`/bandeja`) reemplazó a Bandeja, Tareas y Torre de control:
    no recrees la Torre de control ni vistas de tareas aparte.
16. **Transporte:** solo lo usan los estudiantes de Rincón, Jima, Ranchito, Saba
    Rey y Rancho Viejo. Comedor y transporte no se acoplan.
17. **Permisos reales** viven en `rol_permiso` (base de datos); `rbac.ts` es el
    reparto de fábrica y puede diferir. Un cambio de permisos va en migración.
    La visibilidad del menú se DERIVA del permiso que declara cada entrada de
    `src/lib/nav.ts` (`permiso`, `algunPermiso` o `universal: true` con su porqué)
    y debe ser el mismo que exige la pantalla; no hay pantalla de visibilidad ni
    tabla `visibilidad_menu` (migración `0114`). `npx tsx
    scripts/probar-menu-por-permisos.ts` falla si una entrada queda sin declarar.
18. **Asientos automáticos:** se arman con códigos de transacción
    (`src/lib/contabilidad/codigos-transaccion.ts`), no con códigos de cuenta
    literales. Ver `docs/referencia/codigos-de-transaccion.md`.

## UX (26 nov 2026)

`docs/ux-rules.md` es ley para el rediseño: encabezado `PageHeader`, estados con
`StatusBadge` (`src/lib/status-map.ts`, tokens `status-*`, siempre con icono), vacíos con
acción, filtros en vivo, formularios en panel lateral y sin modo guiado. Tipografía: Plus
Jakarta Sans + IBM Plex Mono (Inter ya no existe). Componentes en `src/components/app/`;
muestra en `/ui-kit` (solo desarrollo). Donde choque con las reglas 1 y de formularios de
`design-system.md`, manda `ux-rules.md`.

## Qué leer según la tarea

| Tarea | Documentos |
|---|---|
| Diseño / UI | `docs/09-sistema-visual.md` + `.claude/rules/design-system.md` |
| Datos / migraciones | `docs/04-modelo-de-datos/` + `db/README.md` |
| Módulos y portales | `docs/03-modulos-funcionales.md` + `docs/referencia/` |
| Convenciones | `docs/07-guia-desarrollo.md` |
| Estado y qué falta | `docs/estado/progreso.md` + `docs/estado/pendientes.md` (arriba, «Resumen de lo abierto») |
| Qué tiene que entregar o decidir el usuario | `docs/estado/por-entregar.md` |
| Roles y coherencia entre módulos | `docs/estado/auditoria-roles.md` + `docs/estado/auditoria-coherencia-roles-modulos.md` + `docs/referencia/diagrama-comunicacion.html` |
| Asientos automáticos / códigos de transacción | `docs/referencia/codigos-de-transaccion.md` |
| Gráficos, calendario, Gantt | `docs/estado/estandar-graficos.md`, `estandar-calendario.md`, `estandar-gantt.md` |
| Costo por estudiante | `docs/estado/plan-costo-por-estudiante.md` |
| Rediseño en curso | `docs/prompts/rediseno-app-web.md` |

`docs/prototipo-base44/` es histórico (prototipo v1): no es normativo.

## Antes de terminar

`npm run lint && npm run build && npm run i18n:check && npm run audit:ui`,
y actualiza `docs/estado/pendientes.md` con lo que se cierra o aparece.
