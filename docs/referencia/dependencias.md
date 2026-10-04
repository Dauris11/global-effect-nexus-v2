# Dependencias y comandos de instalación — Global Effect Nexus

> Convertido de `docs/referencia/dependencias.md` (2026-10-03) sin cambiar su contenido. Es la
> fotografía del **Sprint 0** (julio 2026): las versiones y varias librerías
> (Next 15, Auth.js, Tailwind 3) quedaron superadas. La lista vigente es
> [`package.json`](../../../../package.json) y el stack definitivo está en
> [`docs/08-stack-tecnologico.md`](../08-stack-tecnologico.md).

Este archivo lista TODAS las dependencias del proyecto y los comandos
para instalarlas. Es el resultado del Sprint 0 (inicialización del
proyecto Next.js + toolchain).

## 0. REQUISITOS PREVIOS (instalar una sola vez en la máquina)

```text
- Node.js 20 LTS o superior   (probado con Node v20.20.2)
- npm 10 o superior            (probado con npm 10.8.2)
- PostgreSQL client "psql"     (opcional, solo si vas a correr SQL a mano)
- Git

Verificar:
  node -v
  npm -v
```

## 1. FORMA RÁPIDA (recomendada)

```text
El package.json ya tiene TODAS las dependencias. Basta con:

  git clone <repo>
  cd "Global Effect"
  npm install            # instala todo lo listado abajo (dependencies + devDependencies)

Luego crear el archivo de entorno:
  cp .env.example .env.local
  # y pedirle a un compañero los valores reales (DATABASE_URL, llaves de Supabase, AUTH_SECRET)

Arrancar en desarrollo:
  npm run dev            # http://localhost:3000  (redirige a /es)
```

## 2. FORMA MANUAL (si quieres instalar paquete por paquete)

```text
Ejecutar estos comandos dentro de la carpeta del proyecto.

# --- 2.1 Framework (Next.js + React) ---
npm install next@15 react@19 react-dom@19

# --- 2.2 Base de datos (PostgreSQL, sin ORM) ---
npm install pg

# --- 2.3 Autenticación (Auth.js v5 + hash de contraseñas) ---
npm install next-auth@beta bcryptjs

# --- 2.4 Validación y formularios ---
npm install zod react-hook-form @hookform/resolvers

# --- 2.5 Estado / datos en cliente ---
npm install @tanstack/react-query

# --- 2.6 Internacionalización (es / en) ---
npm install next-intl

# --- 2.7 UI base (shadcn/ui + Radix + utilidades + iconos) ---
npm install class-variance-authority clsx tailwind-merge tailwindcss-animate lucide-react
npm install @radix-ui/react-slot @radix-ui/react-label @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tabs @radix-ui/react-select @radix-ui/react-toast @radix-ui/react-avatar @radix-ui/react-checkbox @radix-ui/react-popover @radix-ui/react-separator

# --- 2.8 Gráficos y fechas ---
npm install recharts date-fns

# --- 2.9 Desarrollo: TypeScript, tipos, Tailwind, ESLint, scripts ---
npm install -D typescript @types/node @types/react @types/react-dom @types/pg
npm install -D tailwindcss@3 postcss autoprefixer
npm install -D eslint eslint-config-next@15
npm install -D dotenv tsx
```

## 3. Lista completa con versiones instaladas

```text
DEPENDENCIES (runtime):
  next                          ^15.5.19    Framework (App Router, SSR/SSG)
  react                         ^19.2.7     Librería de UI
  react-dom                     ^19.2.7     Render de React en el DOM
  pg                            ^8.22.0     Cliente PostgreSQL (node-postgres)
  next-auth                     ^5.0.0-beta.31  Autenticación (Auth.js v5)
  bcryptjs                      ^3.0.3      Hash/verificación de contraseñas
  zod                           ^4.4.3      Validación de esquemas
  react-hook-form               ^7.80.0     Manejo de formularios
  @hookform/resolvers           ^5.4.0      Puente react-hook-form + zod
  @tanstack/react-query         ^5.101.2    Caché/estado de datos del servidor
  next-intl                     ^4.13.1     Internacionalización (es/en)
  recharts                      ^3.9.1      Gráficos
  date-fns                      ^4.4.0      Utilidades de fechas
  class-variance-authority      ^0.7.1      Variantes de clases (shadcn/ui)
  clsx                          ^2.1.1      Composición de clases CSS
  tailwind-merge                ^3.6.0      Merge de clases Tailwind
  tailwindcss-animate           ^1.0.7      Animaciones para Tailwind
  lucide-react                  ^1.23.0     Iconos
  @radix-ui/react-slot          ^1.3.0      Primitiva Radix (shadcn)
  @radix-ui/react-label         ^2.1.11     Primitiva Radix
  @radix-ui/react-dialog        ^1.1.18     Primitiva Radix
  @radix-ui/react-dropdown-menu ^2.1.19     Primitiva Radix
  @radix-ui/react-tabs          ^1.1.16     Primitiva Radix
  @radix-ui/react-select        ^2.3.2      Primitiva Radix
  @radix-ui/react-toast         ^1.2.18     Primitiva Radix
  @radix-ui/react-avatar        ^1.2.1      Primitiva Radix
  @radix-ui/react-checkbox      ^1.3.6      Primitiva Radix
  @radix-ui/react-popover       ^1.1.18     Primitiva Radix
  @radix-ui/react-separator     ^1.1.11     Primitiva Radix

DEVDEPENDENCIES (desarrollo):
  typescript                    ^6.0.3      Compilador TypeScript
  @types/node                   ^26.1.0     Tipos de Node
  @types/react                  ^19.2.17    Tipos de React
  @types/react-dom              ^19.2.3     Tipos de React DOM
  @types/pg                     ^8.20.0     Tipos de pg
  tailwindcss                   ^3.4.19     Framework CSS
  postcss                       ^8.5.16     Procesador CSS
  autoprefixer                  ^10.5.2     Prefijos CSS automáticos
  eslint                        ^9.39.4     Linter
  eslint-config-next            ^15.5.19    Reglas ESLint de Next.js
  dotenv                        ^17.4.2     Carga .env.local en scripts
  tsx                           ^4.22.4     Ejecutar TypeScript en scripts

Total instalado: ~506 paquetes (incluyendo dependencias transitivas).
```

## 4. SCRIPTS DISPONIBLES (package.json)

```text
  npm run dev          Servidor de desarrollo (http://localhost:3000)
  npm run build        Build de producción
  npm run start        Servir el build de producción
  npm run lint         Linter
  npm run db:migrate   Aplica las migraciones SQL de db/migrations/ (idempotente)
  npm run db:seed      Aplica db/seed.sql (roles, permisos, admin, datos de prueba)
```

## 5. VARIABLES DE ENTORNO (.env.local)

```text
Copiar .env.example a .env.local y completar. Claves necesarias:
  DATABASE_URL, PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY
  AUTH_SECRET   (generar con:  openssl rand -base64 32)

NOTA: .env.local NO se sube a git (está en .gitignore). Pedir los valores
      reales a un compañero del equipo.
```

## 6. Notas

```text
- La base de datos ya está creada y desplegada en Supabase (36 tablas).
  Si conectas a la MISMA base, "npm run db:migrate" dirá "Base de datos al día".
  Para una base NUEVA/vacía: "npm run db:migrate" y luego "npm run db:seed".
- Componentes shadcn/ui: se agregan con  "npx shadcn@latest add <componente>"
  (ya está configurado components.json; incluido de ejemplo: button).
- Stack y arquitectura documentados en docs/02-arquitectura-tecnica.md.
```
