-- ================================================================
-- GLOBAL EFFECT NEXUS — 0002 · Identidad y control de acceso (RBAC)
-- ================================================================
-- Roles, permisos granulares, su relación N:M y los usuarios del
-- sistema. Base de la autenticación (Auth.js) y la autorización.
-- ================================================================

-- Roles institucionales del sistema
CREATE TABLE rol (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL UNIQUE,   -- super_admin, admin, docente, estudiante, psicologo, contabilidad
  descripcion TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Permisos granulares por módulo/acción
CREATE TABLE permiso (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      TEXT NOT NULL UNIQUE,   -- ej: 'expedientes.leer', 'calificaciones.registrar'
  descripcion TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Relación N:M entre roles y permisos
CREATE TABLE rol_permiso (
  rol_id     UUID NOT NULL REFERENCES rol(id) ON DELETE CASCADE,
  permiso_id UUID NOT NULL REFERENCES permiso(id) ON DELETE CASCADE,
  PRIMARY KEY (rol_id, permiso_id)
);
CREATE INDEX idx_rol_permiso_permiso ON rol_permiso(permiso_id);

-- Usuarios con credenciales de acceso
CREATE TABLE usuario (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         CITEXT NOT NULL UNIQUE,           -- único sin distinguir mayúsculas
  password_hash TEXT NOT NULL,                    -- bcrypt / argon2
  nombre        TEXT NOT NULL,
  idioma        TEXT NOT NULL DEFAULT 'es' CHECK (idioma IN ('es', 'en')),
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  rol_id        UUID NOT NULL REFERENCES rol(id),
  ultimo_acceso TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_usuario_rol ON usuario(rol_id);

-- Triggers de updated_at
CREATE TRIGGER trg_rol_updated     BEFORE UPDATE ON rol     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_permiso_updated BEFORE UPDATE ON permiso FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_usuario_updated BEFORE UPDATE ON usuario FOR EACH ROW EXECUTE FUNCTION set_updated_at();
