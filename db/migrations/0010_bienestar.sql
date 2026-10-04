-- ================================================================
-- GLOBAL EFFECT NEXUS — 0010 · Bienestar (inscripción de almuerzo)
-- ================================================================
-- Inscripción diaria pública al almuerzo. Sin login. La validación
-- de horario (≤ 8:30 AM) y de no duplicado se aplica en la capa
-- de aplicación + la restricción UNIQUE (nombre, fecha).
-- ================================================================

CREATE TABLE inscripcion_comida (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           TEXT NOT NULL,
  fecha            DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_inscripcion TEXT NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP, 'HH24:MI:SS')),
  confirmado       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (nombre, fecha)
);
CREATE INDEX idx_comida_fecha ON inscripcion_comida(fecha);
