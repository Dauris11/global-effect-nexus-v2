# Global Effect Nexus

**ERP institucional** de la **Fundación Global Effect** (La Vega, República Dominicana): sistema de gestión (académico, expedientes, patrocinio, operaciones, finanzas, solicitudes y aprobaciones) con **portal del estudiante integrado**. Proyecto final de grado — UCATECI.

> **Cambio de alcance (octubre 2026):** la Fundación eliminó el departamento de Psicología. Su portal, sus citas y sus notas se retiraron (migración `0030_fin_de_psicologia.sql`); el expediente del estudiante pasa a manos de administración, y el módulo **Solicitudes y aprobaciones** (migración `0031`) ocupa el lugar de la cita de psicología.

> **Estado (2026-08-06):** base de datos desplegada en Supabase (38 tablas, RBAC, pgvector) y app en **Next.js 16 + Tailwind 4** con **Supabase Auth + RBAC**, i18n `es/en` y capa `server/` por dominio.
>
> **Sistema visual definido.** Turquesa institucional `#2096BA` sobre base slate, una sola familia tipográfica (Inter) y los seis colores de rol. La norma está escrita en [`docs/09-sistema-visual.md`](docs/09-sistema-visual.md), que es la fuente de verdad: si una pantalla y el documento no coinciden, gana el documento.
>
> **Estado real de cada pantalla:** [`docs/estado/progreso.md`](docs/estado/progreso.md).
>
> **Pantallas terminadas:** landing pública (hero configurable, acceso a los seis portales, eventos y blog), login general y **un login por portal**, los **portales por rol** (estudiante, docente, administrativo y contabilidad), Académico, Expedientes con **OCR por IA**, Contabilidad, Administrativo (S9), **Solicitudes y aprobaciones** y Calendario.
>
> Build, tipos, lint e i18n en verde.

---

# Puesta en marcha

Todo lo que hace falta para levantar el proyecto en una máquina nueva. Si algo falla, salta a [Si algo falla](#si-algo-falla) antes de darle vueltas.

## Paso 0 — Instalar las herramientas base

Se instalan **una sola vez** en la máquina:

| Herramienta | Versión | Cómo |
|---|---|---|
| **Node.js** | 20.9 o superior (**recomendado 22 LTS**) | [nodejs.org](https://nodejs.org) — el instalador trae npm |
| **npm** | 10 o superior | viene con Node |
| **Git** | cualquiera reciente | [git-scm.com](https://git-scm.com) |
| **GitHub CLI** | opcional pero cómodo | [cli.github.com](https://cli.github.com) — resuelve el acceso al repo privado |
| **VS Code** | opcional | extensiones útiles: ESLint, Tailwind CSS IntelliSense |

Comprobar:

```bash
node -v    # v20.9.0 o superior
npm -v     # 10.x o superior
git --version
```

> **Por qué se recomienda Node 22:** con Node 20 algunos scripts que hablan con Supabase avisan de que falta soporte nativo de WebSocket. Los scripts del repo ya lo evitan usando `fetch`, así que Node 20 funciona; con Node 22 no aparece nunca.

## Paso 1 — Clonar el repositorio

```bash
git clone https://github.com/Dauris11/Global-Effect-Nexus.git
cd Global-Effect-Nexus
```

El repositorio es **privado**. Si `git clone` pide credenciales, autenticarse antes:

```bash
gh auth login        # opción "HTTPS" + "Login with a web browser"
```

(Alternativa sin `gh`: crear un token personal en GitHub → Settings → Developer settings → Personal access tokens, y usarlo como contraseña.)

## Paso 2 — Instalar dependencias

```bash
npm install
```

Descarga todo lo que declara `package.json` en `node_modules/` (esa carpeta **no** se versiona). Tarda unos minutos la primera vez.

## Paso 3 — Variables de entorno

```bash
cp .env.example .env.local
```

`.env.local` guarda las llaves reales. **No está en git y nunca debe subirse.** Los valores hay que pedírselos a Dauris por un canal privado (no por el chat del grupo ni por correo sin cifrar).

| Variable | Para qué sirve | De dónde sale |
|---|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL: migraciones, scripts y toda la capa `server/` | Supabase → Project Settings → Database → Connection string |
| `PGHOST` · `PGPORT` · `PGDATABASE` · `PGUSER` · `PGPASSWORD` | Las mismas credenciales por separado, para `psql` y herramientas de BD | igual que arriba |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase (la usa el navegador) | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Llave pública (`anon`): login y Storage desde el cliente | Supabase → API |
| `SUPABASE_URL` | La misma URL, para el código de servidor | Supabase → API |
| `SUPABASE_SECRET_KEY` | Llave secreta (`service_role`): crear usuarios desde scripts. **Solo servidor, nunca en el cliente** | Supabase → API |
| `SUPABASE_JWKS_URL` | Llaves públicas con las que se verifica la firma del JWT de sesión | Supabase → API (`/auth/v1/.well-known/jwks.json`) |
| `SUPABASE_STORAGE_BUCKET` | Bucket de documentos y expedientes | `documentos` |
| `RESEND_API_KEY` · `RESEND_FROM` | Envío de correos (aviso de tarea asignada) | panel de Resend |
| `N8N_WEBHOOK_URL` | Webhook de automatizaciones (CRM/notificaciones) | instancia de n8n |
| `ANTHROPIC_API_KEY` · `ANTHROPIC_MODEL` | Asistentes de IA y OCR de documentos | consola de Anthropic |

**Lo mínimo para arrancar** son las de Supabase y `DATABASE_URL`. Sin `RESEND_API_KEY`, `N8N_WEBHOOK_URL` ni `ANTHROPIC_API_KEY` la app funciona igual: solo quedan inactivos el correo, el webhook y la IA.

## Paso 4 — Base de datos

La base de datos **compartida ya está desplegada en Supabase**, así que normalmente **no hay que hacer nada**. Para confirmar que la conexión funciona:

```bash
npm run db:migrate      # dirá "Base de datos al día" si no falta ninguna migración
```

Solo si se trabaja contra una base **nueva y vacía**:

```bash
npm run db:migrate            # crea el esquema (db/migrations/0001..0019)
npm run db:seed               # roles, permisos, períodos y catálogos
npm run db:seed:usuarios      # los seis usuarios de prueba de más abajo
npm run db:seed:operaciones   # 3 proyectos, 10 tareas y 9 eventos de demostración
npm run db:seed:portales      # expediente del estudiante de prueba y clase de 360 del docente
```

Los cuatro seeds son **idempotentes**: se pueden repetir sin duplicar nada.

> `db:seed:operaciones` es el que llena el tablero y el calendario, y `db:seed:portales` el que llena los portales de estudiante y docente. Sin ellos esas pantallas se ven vacías —correctamente, pero no se puede revisar nada—.

## Paso 5 — Arrancar

```bash
npm run dev
```

Abrir **http://localhost:3000**. Redirige a `/es`. La app está en **español** (por defecto) e **inglés**: para ver la versión en inglés, cambiar el prefijo a `/en` (p. ej. http://localhost:3000/en/dashboard).

---

## Usuarios para entrar

El sistema es **solo por invitación**: nadie se registra por su cuenta. Un usuario puede entrar únicamente si su correo ya existe en la tabla `usuario` **y** tiene identidad en Supabase Auth. `npm run db:seed:usuarios` crea los dos lados para estas cuentas, una por rol, para poder probar cada portal:

| Correo | Rol | Qué puede ver |
|---|---|---|
| `admin@globaleffect.org` | `super_admin` | Todo el sistema |
| `coordinacion@globaleffect.org` | `admin` | Operación general, expedientes de todos los estudiantes y bandeja de solicitudes |
| `docente@globaleffect.org` | `docente` | Sus clases de Global Effect 360: tareas, entregas y nota final |
| `estudiante@globaleffect.org` | `estudiante` | Portal estudiantil y sus trámites (solicitudes) |
| `contabilidad@globaleffect.org` | `contabilidad` | Transacciones, balances y patrocinadores |

**Contraseña de todas:** `GlobalEffect2026!` (se puede cambiar con la variable `DEMO_PASSWORD` antes de correr el seed).

Para probar los permisos en serio conviene entrar con **`coordinacion@`** y no con `admin@`: `super_admin` pasa todos los controles y esconde los errores de RBAC.

> Son cuentas **de demostración para desarrollo**. Antes de desplegar a producción hay que eliminarlas o cambiarles la contraseña (tarea de S12 — Seguridad).

Para invitar a alguien más: agregarlo a la lista `USUARIOS` de [`scripts/seed-usuarios.mjs`](scripts/seed-usuarios.mjs) y volver a ejecutar el script.

---

## Si algo falla

| Síntoma | Causa y solución |
|---|---|
| `Unexpected file in persistence directory: ".../Icon\r"` | macOS crea archivos de icono de carpeta que Turbopack no soporta. `npm run limpiar` los borra (y `npm run dev` ya lo hace solo antes de arrancar). Si insiste: `rm -rf .next` |
| `Node.js 20 detected without native WebSocket support` | Un script usa `supabase-js`, que en Node 20 pide WebSocket. Los scripts del repo lo evitan con `fetch`; si aparece en código nuevo, usar la API REST o actualizar a Node 22 |
| `invalidCredentials` al entrar | La contraseña no coincide o el usuario no existe en Supabase Auth. Correr `npm run db:seed:usuarios` |
| `notRegistered` al entrar | Las credenciales son correctas pero el correo no está invitado en la tabla `usuario`. Agregarlo al script de usuarios |
| `ECONNREFUSED` o timeout de la BD | Revisar `DATABASE_URL` en `.env.local` y que la IP tenga acceso en Supabase |
| Pantallas vacías con todo bien configurado | Faltan los datos de demostración: `npm run db:seed`, `npm run db:seed:operaciones` y `npm run db:seed:portales` |
| "Todavía no tienes expediente enlazado" en `/portal/estudiante` | El usuario no tiene fila en `estudiante` con su `usuario_id`. Es el estado correcto; para la demo, `npm run db:seed:portales` |
| El puerto 3000 está ocupado | `npm run dev -- -p 3001` |
| Cambié `messages/*.json` y sale el nombre de la clave | Falta esa clave en uno de los dos idiomas. `es.json` y `en.json` deben tener exactamente las mismas |

> Lista completa de dependencias y comandos de instalación en [`docs/referencia/dependencias.md`](docs/referencia/dependencias.md).

---

## Cómo trabajar en el repo

Dos personas sobre el mismo `main`, así que:

- **Nunca push directo a `main`.** Rama por trabajo: `feat/<modulo>`, `fix/<algo>`, `docs/<tema>`.
- Commits descriptivos **en español**. Pull Request hacia `main` para revisar.
- Antes de subir, las dos comprobaciones que tienen que pasar:

```bash
npm run lint     # sin errores de lint
npm run build    # compila y valida tipos
```

- **La norma visual es [`docs/09-sistema-visual.md`](docs/09-sistema-visual.md) y [`.claude/rules/design-system.md`](.claude/rules/design-system.md)**; si una pantalla y la norma no coinciden, gana la norma.
- Todo texto visible pasa por `next-intl` y va en **los dos** idiomas (`messages/es.json` y `messages/en.json`). Cero cadenas literales en JSX.
- Convenciones de código, patrón de módulo, RBAC y migraciones: [docs/07 · Guía de Desarrollo](docs/07-guia-desarrollo.md).

---

## Estructura del proyecto

```
Global Effect/
├─ src/
│  ├─ app/
│  │  ├─ [locale]/                     # rutas por idioma (App Router)
│  │  │  ├─ (auth)/                    # acceso: login general y callback de OAuth
│  │  │  ├─ (portal)/                  # área autenticada: un layout con el armazón
│  │  │  │  ├─ portal/<rol>/           # inicio de cada portal (estudiante, profesor, administrativo, contabilidad)
│  │  │  │  └─ <módulo>/               # académico, expedientes, solicitudes, calendario, contabilidad…
│  │  │  ├─ comida/                    # inscripción pública al almuerzo
│  │  │  └─ layout.tsx · page.tsx      # raíz por idioma y landing
│  │  └─ globals.css                   # tokens de Tailwind 4 (CSS-first)
│  ├─ components/
│  │  ├─ ui/                           # primitivos del kit (botón, tarjeta, diálogo…)
│  │  ├─ layout/                       # armazón: barra lateral, barra superior, campana
│  │  └─ <dominio>/                    # un directorio por módulo: academico, expedientes, solicitudes, landing…
│  ├─ server/<dominio>/                # consultas.ts (lectura) y acciones.ts ("use server") por módulo
│  ├─ lib/                             # db · auth · rbac · nav · paleta · fechas · vocabulario compartido (expedientes, solicitudes…)
│  ├─ i18n/                            # next-intl: routing, request, navigation, mensajes de cliente
│  └─ proxy.ts                         # i18n + sesión de Supabase
├─ messages/                           # es · en (mismas claves en los dos)
├─ scripts/                            # migrate · seed* · auditar-i18n · limpiar-iconos
├─ db/
│  ├─ migrations/                      # 0001..0031 (.sql por dominio)
│  ├─ seed.sql
│  └─ README.md                        # guía de despliegue de la BD
├─ docs/                               # TODA la documentación (ver docs/README.md)
├─ CLAUDE.md · AGENTS.md               # reglas cortas para los agentes de IA
├─ .env.example                        # plantilla de entorno
└─ package.json · tsconfig.json · next.config.mjs · eslint.config.mjs
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (limpia antes los `Icon` de macOS) |
| `npm run build` | Build de producción + validación de tipos |
| `npm run start` | Sirve el build de producción |
| `npm run lint` | Linter |
| `npm run limpiar` | Borra los archivos `Icon` que crea macOS y rompen Turbopack |
| `npm run db:migrate` | Aplica las migraciones SQL pendientes (idempotente) |
| `npm run db:seed` | Roles, permisos, períodos y catálogos (`db/seed.sql`) |
| `npm run db:seed:usuarios` | Crea/actualiza los usuarios de demostración |
| `npm run db:seed:operaciones` | Proyectos, tareas y eventos de demostración (tablero y calendario) |
| `npm run db:seed:portales` | Expediente del estudiante de prueba y clase de 360 del docente (portales por rol) |

---

## Documentación

Todo está en **[`docs/`](docs/)** — un archivo por tema. Empezar por [`docs/README.md`](docs/README.md).

| Tema | Documento |
|---|---|
| Visión y alcance | [docs/01-vision-y-alcance.md](docs/01-vision-y-alcance.md) |
| Arquitectura técnica | [docs/02-arquitectura-tecnica.md](docs/02-arquitectura-tecnica.md) |
| Módulos funcionales (27) | [docs/03-modulos-funcionales.md](docs/03-modulos-funcionales.md) |
| Modelo de datos (ERD, DFD, diccionario) | [docs/04-modelo-de-datos/](docs/04-modelo-de-datos/) |
| Plan de trabajo y sprints | [docs/05-plan-de-trabajo.md](docs/05-plan-de-trabajo.md) |
| Plan de entregas de la tesis | [docs/06-plan-de-entregas.md](docs/06-plan-de-entregas.md) |
| **Guía de desarrollo (convenciones)** | [docs/07-guia-desarrollo.md](docs/07-guia-desarrollo.md) |
| **Stack tecnológico (definitivo)** | [docs/08-stack-tecnologico.md](docs/08-stack-tecnologico.md) |
| **Sistema visual (norma)** | [docs/09-sistema-visual.md](docs/09-sistema-visual.md) |
| Estado: progreso, pendientes, plan | [docs/estado/](docs/estado/) |
| Rediseño en curso | [docs/prompts/rediseno-app-web.md](docs/prompts/rediseno-app-web.md) |

Diagramas editables: `docs/04-modelo-de-datos/*.drawio` (draw.io) y `esquema.dbml` (dbdiagram.io).

---

## Cómo continuar

El trabajo en curso es el **rediseño como app web** (estilo Airbnb, con la marca de siempre): [`docs/prompts/rediseno-app-web.md`](docs/prompts/rediseno-app-web.md), por fases y en orden. El estado de cada pantalla está en [`docs/estado/progreso.md`](docs/estado/progreso.md) y la cola de pendientes en [`docs/estado/pendientes.md`](docs/estado/pendientes.md). La fuente de verdad de las tareas sigue siendo `docs/fuentes-datos/sprints-clickup.csv`.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 + Radix UI · PostgreSQL 17 (Supabase, PostGIS, `pg` sin ORM) · **Supabase Auth** + RBAC propio · next-intl (es/en) · Zod · TanStack Query · Recharts · Leaflet · motion · Resend · Anthropic · pgvector (IA/RAG). Detalle completo en [docs/08-stack-tecnologico.md](docs/08-stack-tecnologico.md).

## Equipo

Gabriela García · Dauris Santana — Escuela de Ingeniería en Sistemas y Computación, UCATECI.
