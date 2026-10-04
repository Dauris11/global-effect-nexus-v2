-- ================================================================
-- GLOBAL EFFECT NEXUS — 0007 · Academias (programas extracurriculares)
-- ================================================================
-- Programas de liderazgo/habilidades y sus materiales educativos.
-- ================================================================

CREATE TABLE academia (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  tipo          TEXT NOT NULL DEFAULT 'liderazgo',   -- liderazgo, habilidades, otro
  descripcion   TEXT,
  facilitador   TEXT,
  estado        TEXT NOT NULL DEFAULT 'activa',      -- activa, inactiva, planificada
  participantes INTEGER DEFAULT 0 CHECK (participantes >= 0),
  fecha_inicio  DATE,
  fecha_fin     DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE material (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo       TEXT NOT NULL,
  descripcion  TEXT,
  academia_id  UUID NOT NULL REFERENCES academia(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL DEFAULT 'documento',   -- documento, video, presentacion, enlace, otro
  documento_id UUID REFERENCES documento(id) ON DELETE SET NULL,
  enlace_url   TEXT,                                -- para materiales tipo 'enlace'
  autor        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_material_academia ON material(academia_id);

CREATE TRIGGER trg_academia_updated BEFORE UPDATE ON academia FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_material_updated BEFORE UPDATE ON material FOR EACH ROW EXECUTE FUNCTION set_updated_at();
