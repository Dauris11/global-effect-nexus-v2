# Global Effect Nexus — reglas para agentes

ERP institucional de la Fundación Global Effect (La Vega, RD) con portal del
estudiante integrado. Proyecto final de grado (UCATECI). Next.js 16 (App Router,
`src/app/[locale]`), React 19, Tailwind 4 CSS-first, shadcn/Radix, Supabase
(Auth + Postgres vía `pg`, sin ORM), `next-intl` es/en.

`CLAUDE.md` y `AGENTS.md` dicen lo mismo: uno lo lee Claude Code y el otro
Antigravity/Gemini. Si cambias uno, cambia el otro en el mismo commit.

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

## Qué leer según la tarea

| Tarea | Documentos |
|---|---|
| Diseño / UI | `docs/09-sistema-visual.md` + `.claude/rules/design-system.md` |
| Datos / migraciones | `docs/04-modelo-de-datos/` + `db/README.md` |
| Módulos y portales | `docs/03-modulos-funcionales.md` + `docs/referencia/` |
| Convenciones | `docs/07-guia-desarrollo.md` |
| Estado y qué falta | `docs/estado/progreso.md` + `docs/estado/pendientes.md` |
| Rediseño en curso | `docs/prompts/rediseno-app-web.md` |

`docs/prototipo-base44/` es histórico (prototipo v1): no es normativo.

## Antes de terminar

`npm run lint && npm run build && npm run i18n:check && npm run audit:ui`,
y actualiza `docs/estado/pendientes.md` con lo que se cierra o aparece.
