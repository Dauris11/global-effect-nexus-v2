-- ================================================================
-- GLOBAL EFFECT NEXUS — 0004 · Patrocinio
-- ================================================================
-- Patrocinadores de la fundación. Se crea antes que estudiante
-- porque estudiante.patrocinador_id referencia esta tabla.
-- ================================================================

CREATE TYPE tipo_patrocinador AS ENUM ('empresa', 'persona', 'iglesia', 'ong', 'otro');

CREATE TABLE patrocinador (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  tipo          tipo_patrocinador NOT NULL DEFAULT 'persona',
  email         CITEXT,
  telefono      TEXT,
  pais          TEXT,
  estado        TEXT NOT NULL DEFAULT 'activo',   -- activo, inactivo
  monto_mensual NUMERIC(10,2) DEFAULT 0.00 CHECK (monto_mensual >= 0.00),  -- USD
  notas         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_patrocinador_estado ON patrocinador(estado);

CREATE TRIGGER trg_patrocinador_updated BEFORE UPDATE ON patrocinador FOR EACH ROW EXECUTE FUNCTION set_updated_at();
