# Base de datos — Global Effect Nexus

Base de datos relacional del sistema, en **PostgreSQL 17** (desplegada en **Supabase**). SQL escrito a mano (sin ORM), en migraciones `.sql` numeradas por dominio.

## Estructura

```
db/
├─ migrations/
│  ├─ 0001_extensiones_y_utilidades.sql   # pgcrypto, citext, pg_trgm, vector + función updated_at
│  ├─ 0002_identidad_rbac.sql             # rol, permiso, rol_permiso, usuario
│  ├─ 0003_transversal.sql                # documento, notificacion, audit_log
│  ├─ 0004_patrocinio.sql                 # patrocinador
│  ├─ 0005_estudiantes.sql                # estudiante + perfiles + familiar + asignacion_beca
│  ├─ 0006_academico.sql                  # periodo, materia, curso, inscripcion, calificacion, historial (curso y calificacion, anuladas por 0047)
│  ├─ 0007_academias.sql                  # academia, material
│  ├─ 0008_psicologia.sql                 # (histórica; anulada por 0030) tablas del antiguo módulo de psicología
│  ├─ 0009_operaciones.sql                # proyecto, tarea, tarea_asignado, evento, registro_servicio
│  ├─ 0010_bienestar.sql                  # inscripcion_comida
│  ├─ 0011_finanzas.sql                   # transaccion
│  ├─ 0012_ia.sql                         # conversacion_ia, mensaje_ia, extraccion_ocr, fragmento_conocimiento (pgvector)
│  ├─ 0013_extensibilidad_metadata.sql    # columna metadata JSONB en entidades principales
│  ├─ 0014_supabase_auth.sql              # enlace usuario.auth_user_id ↔ auth.users + trigger + idioma es/en/fr/it
│  ├─ 0015_landing.sql                    # landing_slide (hero configurable) + permiso landing.administrar
│  ├─ 0016_auth_invitacion.sql            # login solo por invitación (trigger solo-enlaza) + OAuth Google
│  ├─ 0017 … 0029                         # idiomas, noticia, aula virtual, perfil, Global Effect 360, etc.
│  │                                      #   (0021, 0022, 0024 y 0025 son históricas: anuladas por 0030)
│  ├─ 0030_fin_de_psicologia.sql          # cuentas psicologo → admin; borra rol, permisos, tablas de psicología y estudiante.psicologo_id
│  ├─ 0031_solicitudes_y_aprobaciones.sql # solicitud + solicitud_paso y permisos solicitudes.gestionar / solicitudes.direccion
│  ├─ 0032 … 0046                         # contabilidad, inventario, aula virtual Moodle, Habitudes, agenda, RLS, etc.
│  └─ 0047_fin_de_cursos_tecnicos.sql     # regular → becado; borra curso, calificacion y asignacion.curso_id; 360 para todos, todo obligatorio, una materia por tanda
├─ seed.sql                               # roles, permisos, admin maestro y datos de prueba
└─ README.md
```

## Estado actual

✅ **Desplegada y verificada** en Supabase. Tras `0031`: 37 tablas, 7 enums, 20 triggers, 44 claves foráneas. Extensiones activas: `pgcrypto`, `citext`, `pg_trgm`, `vector 0.8.0`.

## Despliegue

### Opción A — con `psql` (recomendada)

Requiere las variables de entorno de `.env.local` (ver `.env.example`). Las migraciones se aplican en orden y luego el seed:

```bash
set -a; source .env.local; set +a       # carga DATABASE_URL / PG*
for f in db/migrations/00*.sql; do
  echo ">>> $f"; psql -v ON_ERROR_STOP=1 -f "$f" || break
done
psql -v ON_ERROR_STOP=1 -f db/seed.sql
```

### Opción B — SQL Editor de Supabase

1. Abre **SQL Editor** en la consola de Supabase.
2. Ejecuta el contenido de cada archivo `db/migrations/0001…0047` **en orden**.
3. Ejecuta `db/seed.sql`.

Ambas opciones son idempotentes en lo posible (extensiones `IF NOT EXISTS`, seed con `ON CONFLICT`). Las migraciones crean objetos nuevos; para re-crear desde cero, elimina el esquema `public` antes.

## Autenticación (Supabase Auth)

Desde la migración `0014`, las credenciales las gestiona **Supabase Auth** (`auth.users`); la tabla `usuario` conserva el perfil + `rol_id`, enlazada por `usuario.auth_user_id`. Un trigger enlaza automáticamente por email al crear la identidad en Auth (los usuarios se **invitan**, no se registran).

- **Admin maestro:** `admin@globaleffect.org` — rol `super_admin` (ya sembrado en `usuario`).
- Para habilitar su login, crea su identidad en **Supabase → Authentication → Add user** (o Admin API); el trigger la enlazará por email.
- El `password_hash` bcrypt del seed queda obsoleto (Supabase almacena la contraseña).

### Login por invitación + Google (migración 0016)

- **Solo entran usuarios ya creados** en `usuario` (activos). El trigger `handle_new_auth_user` **solo enlaza** por email; **no** crea perfiles nuevos. Si un email de Google no está invitado, la app cierra la sesión y muestra "no registrado".
- **Google (para todos):** habilita **Authentication → Providers → Google** (Client ID/Secret) y añade la Redirect URL `{SITIO}/auth/callback` (p. ej. `http://localhost:3000/auth/callback`).
- **Redirección por rol** tras el login (`rutaPorRol`). Roles: `super_admin`, `admin`, `docente`, `estudiante`, `contabilidad`, `habitudes`.

## Notas técnicas

- **Auditoría de fecha:** la función `set_updated_at()` mantiene `updated_at` vía trigger; no hace falta setearla en los `UPDATE`.
- **Fin de psicología (0030):** la Fundación eliminó el departamento. La migración borra las tablas con `DROP` (sin vuelta atrás, por decisión de la Fundación) y las notificaciones de tipo `cita`; `audit_log` no se toca porque es append-only. Las migraciones históricas no se reescriben: se quedan en el repo y la 0030 las anula.
- **Solicitudes (0031):** `solicitud.requiere_direccion` se fija al crear; cada cambio de estado deja una fila en `solicitud_paso`. Las reglas de flujo (nadie aprueba lo suyo, rechazo con comentario) viven en la capa `server/solicitudes/`.
- **Fin de los cursos técnicos (0047):** la Fundación dejó de impartirlos y Global Effect 360 ocupa su lugar. Todo estudiante pasa a `becado` y el valor `regular` sale del ENUM; `curso`, `calificacion` y `tipo_evaluacion` se borran con `DROP` sin copia, igual que en la 0030, y las tareas de curso se van con `asignacion.curso_id`. El trigger «solo becados» de 360 desaparece porque ya no hay a quién dejar fuera, `materia_360.obligatoria` se retira porque todo el catálogo es obligatorio, y un índice único parcial sobre `inscripcion_360(estudiante_id, periodo_id, ronda)` deja una sola materia por tanda: dos por cuatrimestre. `historial_calificacion` no se toca.
- **IA / RAG:** `fragmento_conocimiento.embedding` es `vector(1536)` con índice HNSW (coseno). Ajusta la dimensión al modelo de embeddings del servicio de IA.
- **Verificación rápida:**
  ```sql
  SELECT count(*) FROM pg_tables WHERE schemaname='public';           -- 37 sin contar _migracion
  SELECT extname, extversion FROM pg_extension
   WHERE extname IN ('pgcrypto','citext','pg_trgm','vector');
  ```
