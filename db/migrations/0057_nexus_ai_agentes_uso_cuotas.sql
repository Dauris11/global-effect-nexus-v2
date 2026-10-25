-- ================================================================
-- GLOBAL EFFECT NEXUS — 0057 · Nexus AI: agentes, uso y cuotas
-- ================================================================
-- Fase 1 de docs/estado/plan-nexus-ai.md. Solo cimientos:
--   • ai_agente        configuración editable de cada agente por rol
--   • ai_precio_modelo precios por modelo, para estimar el costo
--   • ai_uso           una fila por llamada al modelo (medidor de tokens)
--   • ai_cuota         tope mensual de tokens por usuario o por rol
--   • ai_accion        registro de acciones del agente (vacío hasta la
--                      fase 4; se crea ahora para fijar el esquema)
--
-- Sin precios ni cuotas de ejemplo: no se inventan cifras. Con la tabla
-- de precios vacía, `costo_usd` queda NULL; sin cuota, no hay tope.
-- RLS activa sin políticas, igual que 0046: la app entra como postgres.
-- ================================================================

CREATE TABLE IF NOT EXISTS ai_agente (
  clave           TEXT PRIMARY KEY,
  roles           TEXT[] NOT NULL,                 -- roles que lo usan (ver src/lib/ia-agentes.ts)
  instrucciones   TEXT,                            -- se añade al prompt base; NULL = solo el base
  modelo          TEXT,                            -- NULL = ANTHROPIC_MODEL
  max_tokens      INTEGER CHECK (max_tokens > 0),
  limite_hora     INTEGER NOT NULL DEFAULT 30 CHECK (limite_hora > 0),
  herramientas    TEXT[] NOT NULL DEFAULT '{}',    -- vacío hasta la fase 4
  activo          BOOLEAN NOT NULL DEFAULT true,
  updated_by      UUID REFERENCES usuario(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_precio_modelo (
  modelo                  TEXT PRIMARY KEY,
  usd_entrada_mtok        NUMERIC(10,4) NOT NULL CHECK (usd_entrada_mtok >= 0),
  usd_salida_mtok         NUMERIC(10,4) NOT NULL CHECK (usd_salida_mtok >= 0),
  usd_cache_lectura_mtok  NUMERIC(10,4) NOT NULL DEFAULT 0 CHECK (usd_cache_lectura_mtok >= 0),
  vigente_desde           DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_uso (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id       UUID REFERENCES usuario(id) ON DELETE SET NULL,
  rol              TEXT NOT NULL,
  agente_clave     TEXT REFERENCES ai_agente(clave) ON DELETE SET NULL,
  conversacion_id  UUID REFERENCES conversacion_ia(id) ON DELETE SET NULL,
  modelo           TEXT NOT NULL,
  tokens_entrada   INTEGER NOT NULL DEFAULT 0 CHECK (tokens_entrada >= 0),
  tokens_salida    INTEGER NOT NULL DEFAULT 0 CHECK (tokens_salida >= 0),
  tokens_cache     INTEGER NOT NULL DEFAULT 0 CHECK (tokens_cache >= 0),
  costo_usd        NUMERIC(12,6),                  -- NULL si el modelo no tiene precio
  latencia_ms      INTEGER CHECK (latencia_ms >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_uso_usuario_fecha ON ai_uso(usuario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_uso_rol_fecha     ON ai_uso(rol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_uso_fecha_brin    ON ai_uso USING BRIN (created_at);

CREATE TABLE IF NOT EXISTS ai_cuota (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID REFERENCES usuario(id) ON DELETE CASCADE,
  rol            TEXT,
  tokens_mes     BIGINT NOT NULL CHECK (tokens_mes > 0),
  aviso_pct      INTEGER NOT NULL DEFAULT 80 CHECK (aviso_pct BETWEEN 1 AND 100),
  anulada_hasta  TIMESTAMPTZ,                      -- el administrador levanta el tope hasta esta fecha
  anulada_por    UUID REFERENCES usuario(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- O es de un usuario o es de un rol, nunca de los dos ni de ninguno.
  CONSTRAINT ai_cuota_alcance CHECK ((usuario_id IS NULL) <> (rol IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_cuota_usuario ON ai_cuota(usuario_id) WHERE usuario_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_cuota_rol     ON ai_cuota(rol)        WHERE rol IS NOT NULL;

CREATE TABLE IF NOT EXISTS ai_accion (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id   UUID REFERENCES conversacion_ia(id) ON DELETE SET NULL,
  usuario_id        UUID REFERENCES usuario(id) ON DELETE SET NULL,
  agente_clave      TEXT REFERENCES ai_agente(clave) ON DELETE SET NULL,
  herramienta       TEXT NOT NULL,
  argumentos        JSONB,                         -- ya sanitizados
  resultado         JSONB,
  estado            TEXT NOT NULL DEFAULT 'propuesta'
                    CHECK (estado IN ('propuesta','aprobada','rechazada','ejecutada','fallida')),
  aprobador_id      UUID REFERENCES usuario(id) ON DELETE SET NULL,
  entidad_tipo      TEXT,
  entidad_id        UUID,
  reversible        BOOLEAN NOT NULL DEFAULT false,
  deshacer          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_accion_usuario ON ai_accion(usuario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_accion_entidad ON ai_accion(entidad_tipo, entidad_id);

DROP TRIGGER IF EXISTS trg_ai_agente_updated ON ai_agente;
CREATE TRIGGER trg_ai_agente_updated BEFORE UPDATE ON ai_agente
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_ai_accion_updated ON ai_accion;
CREATE TRIGGER trg_ai_accion_updated BEFORE UPDATE ON ai_accion
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE ai_agente        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_precio_modelo ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_uso           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cuota         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_accion        ENABLE ROW LEVEL SECURITY;

-- Un agente por rol del sistema (8 roles, 7 agentes: dir_habitudes comparte
-- el de Habitudes). Sin instrucciones ni modelo propios todavía.
INSERT INTO ai_agente (clave, roles) VALUES
  ('agente_estudiante',   ARRAY['estudiante']),
  ('agente_docente',      ARRAY['docente']),
  ('agente_contabilidad', ARRAY['contabilidad']),
  ('agente_admin',        ARRAY['admin']),
  ('agente_habitudes',    ARRAY['habitudes','dir_habitudes']),
  ('agente_direccion',    ARRAY['super_admin']),
  ('agente_colaborador',  ARRAY['colaborador'])
ON CONFLICT (clave) DO NOTHING;
