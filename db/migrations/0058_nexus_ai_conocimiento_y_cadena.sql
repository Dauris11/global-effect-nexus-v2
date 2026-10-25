-- ================================================================
-- GLOBAL EFFECT NEXUS — 0058 · Nexus AI: conocimiento por agente y cadena
-- ================================================================
-- Fases 3 y 4 de docs/estado/plan-nexus-ai.md.
--
--   • fragmento_conocimiento pasa de tabla vacía a base de conocimiento:
--     cada fragmento declara QUÉ AGENTES pueden recuperarlo. Por defecto
--     ninguno (`agentes = '{}'`): un documento sin asignar no lo ve nadie.
--   • Búsqueda por texto (tsvector en español) + trigramas. La columna
--     `embedding` se conserva para cuando se elija proveedor de embeddings;
--     hoy no se llena y la búsqueda no depende de ella.
--   • ai_accion gana la cadena SHA-256 de la bitácora: cada fila lleva el
--     hash de la anterior, así borrar o editar una acción rompe la cadena.
-- ================================================================

ALTER TABLE fragmento_conocimiento
  ADD COLUMN IF NOT EXISTS agentes        TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS titulo         TEXT,
  ADD COLUMN IF NOT EXISTS fuente         TEXT,           -- norma, manual o URL que se cita
  ADD COLUMN IF NOT EXISTS version        TEXT,
  ADD COLUMN IF NOT EXISTS vigente_hasta  DATE,
  ADD COLUMN IF NOT EXISTS verificado_el  DATE,           -- última revisión humana de la norma
  ADD COLUMN IF NOT EXISTS activo         BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS creado_por     UUID REFERENCES usuario(id) ON DELETE SET NULL;

ALTER TABLE fragmento_conocimiento
  ADD COLUMN IF NOT EXISTS contenido_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('spanish', coalesce(titulo, '') || ' ' || contenido)
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_fragmento_tsv     ON fragmento_conocimiento USING GIN (contenido_tsv);
CREATE INDEX IF NOT EXISTS idx_fragmento_trgm    ON fragmento_conocimiento USING GIN (contenido gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_fragmento_agentes ON fragmento_conocimiento USING GIN (agentes);

-- Cadena de hash de las acciones del agente.
ALTER TABLE ai_accion
  ADD COLUMN IF NOT EXISTS hash_previo CHAR(64),
  ADD COLUMN IF NOT EXISTS hash        CHAR(64),
  ADD COLUMN IF NOT EXISTS deshecha_el TIMESTAMPTZ;

-- Una sola fila puede ser la última de la cadena: dos acciones concurrentes no
-- pueden colgar de la misma anterior. El índice único lo hace cumplir.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_accion_hash_previo
  ON ai_accion(hash_previo) WHERE hash_previo IS NOT NULL;
