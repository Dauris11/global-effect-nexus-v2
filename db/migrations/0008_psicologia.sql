-- ================================================================
-- GLOBAL EFFECT NEXUS — 0008 · Psicología (confidencial)
-- ================================================================
-- Citas y seguimientos, notas confidenciales aisladas y perfil
-- psicológico. El contenido sensible vive separado del expediente
-- general; sólo accesible por rol psicologo / super_admin (RBAC).
-- ================================================================

CREATE TABLE cita_psicologia (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id          UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
  psicologo_id           UUID REFERENCES usuario(id) ON DELETE SET NULL,
  tipo_registro          TEXT NOT NULL DEFAULT 'cita',      -- cita, seguimiento, evaluacion
  fecha                  DATE NOT NULL,
  hora                   TEXT,
  nivel_confidencialidad TEXT NOT NULL DEFAULT 'medio',     -- alto, medio, bajo
  estado                 TEXT NOT NULL DEFAULT 'programada',-- programada, completada, cancelada
  riesgos                TEXT,                              -- ansiedad, adaptación, etc.
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cita_psico_estudiante ON cita_psicologia(estudiante_id);
CREATE INDEX idx_cita_psico_fecha      ON cita_psicologia(fecha);

-- Notas confidenciales de sesión (aisladas por privacidad estricta)
CREATE TABLE nota_psicologica (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cita_id       UUID REFERENCES cita_psicologia(id) ON DELETE CASCADE,
  estudiante_id UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
  contenido     TEXT NOT NULL,
  creado_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nota_psico_estudiante ON nota_psicologica(estudiante_id);

-- Expediente psicológico detallado (1:1, becados universitarios)
CREATE TABLE perfil_psicologico (
  estudiante_id           UUID PRIMARY KEY REFERENCES estudiante(id) ON DELETE CASCADE,
  antecedentes_clinicos   TEXT,
  evaluacion_inicial      TEXT,
  recomendaciones_terap   TEXT,
  estado_emocional        TEXT,
  observaciones_generales TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_cita_psico_updated   BEFORE UPDATE ON cita_psicologia   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_perfil_psico_updated BEFORE UPDATE ON perfil_psicologico FOR EACH ROW EXECUTE FUNCTION set_updated_at();
