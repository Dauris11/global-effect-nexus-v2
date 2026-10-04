# Guía de Desarrollo — Global Effect Nexus

Convenciones y flujos de trabajo del proyecto. Léela antes de escribir código. Los estándares aquí descritos ya están aplicados desde la fase de base de datos.

> **Regla de oro:** todo el código va **documentado** (comentario de cabecera por archivo y en funciones no triviales). Este es un proyecto de tesis; la documentación importa tanto como el código.

---

## 1. Convenciones

- **TypeScript estricto.** Nada de `any` salvo casos justificados.
- **Nomenclatura:** `camelCase` en código TS; `snake_case`, en español y en singular, en la base de datos (`estudiante`, no `students`).
- **Sin ORM.** El acceso a datos se escribe a mano con `pg` y **parámetros posicionales** (`$1, $2…`). **Nunca** concatenar entrada del usuario en el SQL (defensa contra inyección).
- **Validación con Zod** en la frontera (formularios / Server Actions). Tipos por entidad en `types.ts`.
- **i18n:** los textos de interfaz van en `messages/{es,en}.json`. Los valores de estado se guardan como **código** en la BD y se traducen solo en la UI.
- **Estilos:** Tailwind CSS 4 (config CSS-first en `globals.css`, sin `tailwind.config.ts`) + Radix UI + componentes propios, usando `cn()` de `src/lib/utils.ts`.
- **Secretos:** solo en `.env.local` (nunca en el repo).

---

## 2. Estructura de un módulo (patrón por dominio)

Cada módulo de negocio vive en `src/server/<dominio>/` con cuatro archivos:

```
src/server/estudiantes/
├─ types.ts       # interfaces TypeScript de la entidad
├─ schema.ts      # esquemas Zod (validación de entrada)
├─ queries.ts     # SELECTs parametrizados (lectura)
└─ actions.ts     # Server Actions (escritura) + control de permisos
```

La UI (páginas y componentes) consume estas funciones; no accede a la BD directamente.

### Ejemplo — query parametrizada (`queries.ts`)

```ts
import { query } from "@/lib/db";
import type { Estudiante } from "./types";

export async function getEstudiante(id: string): Promise<Estudiante | null> {
  const { rows } = await query(
    `SELECT e.*, p.nombre AS patrocinador_nombre
       FROM estudiante e
       LEFT JOIN patrocinador p ON p.id = e.patrocinador_id
      WHERE e.id = $1`,
    [id],
  );
  return (rows[0] as Estudiante) ?? null;
}
```

### Ejemplo — Server Action con validación y permiso (`actions.ts`)

```ts
"use server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";

const CrearEstudiante = z.object({ nombre: z.string().min(1), cedula: z.string().optional() });

export async function crearEstudiante(input: unknown) {
  // Exige el permiso y, de paso, devuelve el usuario autenticado.
  await requirePermission("expedientes.escribir");

  const data = CrearEstudiante.parse(input);
  const { rows } = await query(
    `INSERT INTO estudiante (nombre, cedula) VALUES ($1, $2) RETURNING id`,
    [data.nombre, data.cedula ?? null],
  );
  return rows[0].id as string;
}
```

> Referencia real del patrón: `src/server/estudiantes/` (types · schema · queries · actions) y `src/server/storage.ts`.

---

## 3. Autenticación y RBAC

- **Supabase Auth** gestiona las credenciales (`auth.users`); la tabla `usuario` guarda perfil + `rol_id`, enlazada por `usuario.auth_user_id` (migración `0014`).
- **Login (S4):** dos vías, ambas **solo para usuarios invitados** (existentes y activos en `usuario`) y con **redirección por rol** (`rutaPorRol` en `lib/nav.ts`):
  1. **Google (OAuth, para todos):** botón en `login-form.tsx` → `signInWithOAuth` (cliente) → `src/app/auth/callback/route.ts` (intercambia el code, valida invitación, redirige).
  2. **Correo + contraseña:** Server Action `login` (`(auth)/login/actions.ts`).
- **Invitación (no registro):** `resolverUsuario()` enlaza la identidad de Auth con un `usuario` existente por email y lo devuelve; si no existe/está inactivo, se **cierra la sesión y se rechaza**. El trigger de `0016` solo enlaza (no auto-crea). Habilita el proveedor **Google** en Supabase → Authentication (redirect `{SITIO}/auth/callback`).
- Clientes: `src/lib/supabase/{server,client}.ts` (`@supabase/ssr`). Sesión y rol: `src/lib/auth.ts` → `getAuthUser()`, `currentUser()`, `resolverUsuario()`, `signOut()`.
- Helpers de permisos: `src/lib/rbac.ts` → `can(rol, "codigo.permiso")`, `permisosDeRol(rol)` y `requirePermission("codigo.permiso")` (usar al inicio de cada Server Action).
- `super_admin` siempre pasa `can()`.
- La protección por rutas vive en `src/proxy.ts` (antes `middleware.ts`): i18n + refresco de sesión + guard del área `(portal)`. La autorización fina se aplica en las Server Actions.

Permisos disponibles (ver `db/seed.sql`): `expedientes.*`, `academico.*`, `calificaciones.registrar`, `patrocinadores.*`, `finanzas.*`, `operaciones.*`, `solicitudes.gestionar`, `solicitudes.direccion`, `expedientes.postular`, `usuarios.administrar`, `ia.usar`, `ia.administrar`.

Roles (6): `super_admin`, `admin`, `docente`, `estudiante`, `contabilidad`, `habitudes`. El expediente es de administración: `admin` y `super_admin` tienen `expedientes.leer/escribir/eliminar` sobre todos los estudiantes; `habitudes` solo `expedientes.postular`.

### Regla crítica — solicitudes y aprobaciones
- **Nadie aprueba su propia solicitud.** La acción lo comprueba en el servidor, no solo la UI.
- **`requiere_direccion` se fija al crear** y no se recalcula: un cambio de umbral no altera solicitudes en curso.
- **La solicitud no ejecuta efectos.** "Aprobada" es la decisión; el módulo dueño (contabilidad, expedientes, patrocinio) hace el cambio y entonces se marca `completada`.
- **Cada cambio de estado** escribe una fila en `solicitud_paso` y una notificación; aprobar, rechazar y completar van además a `audit_log`. Rechazar exige comentario.

### Regla crítica — contabilidad (esquema `contabilidad`, migraciones 0032-0035)
- **Toda tabla nueva de `contabilidad.*` llama `SELECT contabilidad.auditar_tabla('contabilidad.<tabla>')`** al final de su migración. Eso instala la bitácora, prohíbe `DELETE`/`TRUNCATE` y bloquea los registros de un período cerrado. Una tabla sin esa llamada queda fuera de la auditoría.
- **Toda escritura contable usa `enTransaccionComo(contexto, …)`** (`src/lib/db.ts`), nunca `enTransaccion`: el disparador aborta si falta `app.usuario_id`. Ese fallo es intencional.
- **Cuando un UPDATE es aprobar, anular, pagar, conciliar o cerrar/reabrir**, se llama `fijarAccion(cliente, accion, motivo)` antes (`src/server/contabilidad/bitacora.ts`); si no, el auditor ve un «editar».
- **Las lecturas sensibles** (nómina, volantes, exportaciones, adjuntos) pasan por `registrarLectura()`. La base no ve lecturas.
- **Nada se borra:** lo que está mal se anula con motivo. Una tabla con fecha contable lleva `periodo_id` para que el bloqueo de período cerrado la cubra.
- **Permisos por persona:** `requerirPermiso` resuelve el rol más las excepciones de `usuario_permiso` (`usuarioTienePermiso` en `src/lib/rbac.ts`). `super_admin` solo lee y audita.
- Pruebas: `npm run db:probar:contabilidad`.

---

## 4. Internacionalización (i18n)

- Componentes de servidor/cliente: `const t = useTranslations("home");  t("title")` (o `getTranslations` en el servidor).
- Agregar textos en **los dos** diccionarios `messages/{es,en}.json` (mismas claves). `es` es el idioma por defecto.
- Navegación con prefijo de idioma: usar `Link`, `redirect`, `useRouter` de `src/i18n/navigation.ts` (no los de `next/navigation`).

---

## 5. Base de datos y migraciones

- El esquema son archivos `.sql` numerados en `db/migrations/`. **No editar** una migración ya aplicada; crear una nueva.
- Crear un cambio de esquema:
  1. Nuevo archivo `db/migrations/0015_<descripcion>.sql` (la última aplicada es `0014_supabase_auth.sql`).
  2. `npm run db:migrate` (aplica solo lo pendiente; registra en la tabla `_migracion`).
- Convenciones del esquema: PK `id uuid` (`gen_random_uuid()`), `created_at`/`updated_at` con trigger `set_updated_at()`, FKs con `ON DELETE` explícito, `CHECK`/`UNIQUE` de negocio.
- Extensibilidad: las entidades principales tienen `metadata JSONB` para campos futuros sin alterar el esquema.
- Referencia completa: [modelo de datos](04-modelo-de-datos/) (ERD, DFD, diccionario) y [`db/README.md`](../db/README.md).

---

## 6. Componentes de interfaz (shadcn/ui)

Agregar un componente:

```bash
npx shadcn@latest add card input dialog table   # etc.
```

Se instala en `src/components/ui/`. Ya está configurado `components.json` (Tailwind 4, `config: ""`). Componente base incluido: `button`. Los tokens de color/tema viven en `src/app/globals.css` (`@theme inline`).

---

## 7. Flujo de Git

- **No** hacer push directo a `main`. Trabajar en ramas: `feat/<modulo>`, `fix/<algo>`, `docs/<tema>`.
- Commits descriptivos en español. Abrir Pull Request hacia `main` para revisión.
- `.env.local`, `node_modules/` y `.next/` están en `.gitignore` (no versionar).

---

## 8. Verificación antes de subir

```bash
npm run lint        # sin errores de lint
npm run build       # compila sin errores de tipos
```

Para cambios de BD, probar `npm run db:migrate` contra una base de prueba y verificar el borrado en cascada y las restricciones.

---

## 9. Mapa rápido de "dónde está qué"

| Necesito… | Está en… |
|---|---|
| Conexión a la BD | `src/lib/db.ts` (`query`, `pool`) |
| Clientes Supabase (Auth/Storage) | `src/lib/supabase/{server,client}.ts` |
| Login / sesión | `src/lib/auth.ts` · login: `src/app/[locale]/(auth)/login/` |
| Permisos | `src/lib/rbac.ts` (`requirePermission`, `can`) |
| Lógica por dominio | `src/server/<dominio>/` · subida de archivos: `src/server/storage.ts` |
| Traducciones | `messages/*.json` + `src/i18n/` |
| Esquema / tablas | `db/migrations/` · [diccionario](04-modelo-de-datos/diccionario-de-datos.md) |
| Qué hace cada módulo | [03-modulos-funcionales.md](03-modulos-funcionales.md) |
| Qué sigue (sprints) | [05-plan-de-trabajo.md](05-plan-de-trabajo.md) |
