-- ================================================================
-- PORTAL GLOBALEFFECT — 0100 · Avance del estudiante en su pénsum
-- ================================================================
-- Lo que dice el «gradua» (validación de asignaturas) que sube el estudiante: por
-- cada materia del pénsum, el período en que la cursó y su resultado. Es la
-- fuente oficial del avance; el pénsum y el índice se recalculan a partir de aquí
-- (y de las notas que ya tiene el sistema) cada vez que se muestran.
-- ================================================================

CREATE TABLE avance_pensum (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
  -- Código de la materia del pénsum; en una electiva, el del cupo (ELE015).
  codigo        TEXT NOT NULL,
  detalle       TEXT,
  nombre        TEXT NOT NULL,
  creditos      SMALLINT NOT NULL CHECK (creditos >= 0),
  puntos        SMALLINT NOT NULL CHECK (puntos >= 0),
  periodo       TEXT,
  letra         TEXT,
  fuente        TEXT NOT NULL DEFAULT 'gradua' CHECK (fuente IN ('gradua', 'manual')),
  archivo_id    UUID REFERENCES archivo_academico(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (estudiante_id, codigo)
);
CREATE INDEX idx_avance_pensum_estudiante ON avance_pensum(estudiante_id);

-- Qué se leyó de cada gradua: matrícula, versión, filas, y el índice que declara
-- el propio reporte, para compararlo con el que calcula el sistema.
ALTER TABLE archivo_academico
  ADD COLUMN leido_en TIMESTAMPTZ,
  ADD COLUMN resumen  JSONB;

-- Con el gradua real de un estudiante de UCATECI, 746 puntos / 209 créditos
-- (206 + 3 de una retirada) truncado da 3,56, igual que el reporte oficial: las
-- reglas dejaron de ser una suposición.
UPDATE universidad SET reglas_confirmadas = true WHERE siglas = 'UCATECI';
