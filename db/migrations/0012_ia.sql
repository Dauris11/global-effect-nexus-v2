-- ================================================================
-- GLOBAL EFFECT NEXUS — 0012 · Inteligencia Artificial
-- ================================================================
-- Soporte para los asistentes de IA del sistema:
--   • Historial de conversaciones (Chat IA interno y estudiantil).
--   • Trazabilidad de extracciones OCR sobre documentos escaneados.
--   • Base de conocimiento vectorizada (embeddings pgvector) para
--     búsqueda semántica / RAG sobre datos institucionales.
--
-- Nota: la dimensión del vector (1536) corresponde a modelos de
-- embeddings comunes; ajústala al modelo que use el servicio de IA.
-- ================================================================

-- ---------------------------------------------------------------
-- Conversaciones del asistente de IA
-- ---------------------------------------------------------------
CREATE TABLE conversacion_ia (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
  ambito     TEXT NOT NULL DEFAULT 'interno' CHECK (ambito IN ('interno', 'estudiantil')),
  titulo     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_conversacion_ia_usuario ON conversacion_ia(usuario_id);

-- ---------------------------------------------------------------
-- Mensajes de cada conversación (append-heavy)
-- ---------------------------------------------------------------
CREATE TABLE mensaje_ia (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id UUID NOT NULL REFERENCES conversacion_ia(id) ON DELETE CASCADE,
  rol             TEXT NOT NULL CHECK (rol IN ('user', 'assistant', 'system')),
  contenido       TEXT NOT NULL,
  tokens          INTEGER CHECK (tokens >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mensaje_ia_conversacion ON mensaje_ia(conversacion_id, created_at);
CREATE INDEX idx_mensaje_ia_created_brin ON mensaje_ia USING BRIN (created_at);

-- ---------------------------------------------------------------
-- Extracciones OCR sobre documentos (flujo OCR → Expediente)
-- ---------------------------------------------------------------
CREATE TABLE extraccion_ocr (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id    UUID REFERENCES documento(id) ON DELETE SET NULL,
  estudiante_id   UUID REFERENCES estudiante(id) ON DELETE SET NULL,   -- destino (si aplica)
  estado          TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente', 'procesando', 'completado', 'error')),
  modelo          TEXT,                       -- modelo de IA usado
  confianza       NUMERIC(5,2) CHECK (confianza >= 0.00 AND confianza <= 100.00),
  datos_extraidos JSONB,                      -- campos detectados por la IA
  mensaje_error   TEXT,
  creado_por_id   UUID REFERENCES usuario(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_extraccion_ocr_estudiante ON extraccion_ocr(estudiante_id);
CREATE INDEX idx_extraccion_ocr_estado     ON extraccion_ocr(estado);

-- ---------------------------------------------------------------
-- Base de conocimiento vectorizada (RAG / búsqueda semántica)
-- Cada fila es un fragmento de texto de una entidad institucional
-- (estudiante, curso, evento, etc.) con su embedding.
-- ---------------------------------------------------------------
CREATE TABLE fragmento_conocimiento (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fuente_tipo TEXT NOT NULL,          -- entidad de origen: 'estudiante', 'curso', 'evento', ...
  fuente_id   UUID,                   -- id del registro de origen (si aplica)
  contenido   TEXT NOT NULL,          -- fragmento de texto indexado
  metadata    JSONB,                  -- datos auxiliares para filtrar/citar
  embedding   VECTOR(1536),           -- vector de embedding (ajustar dimensión al modelo)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fragmento_fuente ON fragmento_conocimiento(fuente_tipo, fuente_id);
-- Índice HNSW para búsqueda de similitud por coseno (escalable a millones de vectores)
CREATE INDEX idx_fragmento_embedding_hnsw
  ON fragmento_conocimiento USING hnsw (embedding vector_cosine_ops);

CREATE TRIGGER trg_conversacion_ia_updated BEFORE UPDATE ON conversacion_ia        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_extraccion_ocr_updated  BEFORE UPDATE ON extraccion_ocr         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_fragmento_updated       BEFORE UPDATE ON fragmento_conocimiento FOR EACH ROW EXECUTE FUNCTION set_updated_at();
