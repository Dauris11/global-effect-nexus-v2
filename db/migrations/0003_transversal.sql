-- ================================================================
-- GLOBAL EFFECT NEXUS — 0003 · Dominio transversal
-- ================================================================
-- Documentos (metadatos de archivos), notificaciones internas y
-- bitácora de auditoría. Servicios usados por el resto de dominios.
-- ================================================================

-- Metadatos de archivos almacenados en el bucket (Supabase Storage / S3).
-- Centraliza la referencia a archivos: reemplaza URLs sueltas por una FK.
CREATE TABLE documento (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  storage_key   TEXT NOT NULL UNIQUE,   -- ruta/clave dentro del bucket
  tipo          TEXT,                   -- foto, expediente_escaneado, material_educativo, etc.
  mime          TEXT,
  tamano_bytes  BIGINT CHECK (tamano_bytes >= 0),
  subido_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_documento_tipo ON documento(tipo);

-- Notificaciones internas dirigidas a un usuario
CREATE TABLE notificacion (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  titulo     TEXT NOT NULL,
  mensaje    TEXT NOT NULL,
  tipo       TEXT NOT NULL DEFAULT 'info',   -- info, alerta, tarea
  leida      BOOLEAN NOT NULL DEFAULT FALSE,
  enlace     TEXT,                           -- ruta interna asociada (opcional)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notificacion_usuario_leida ON notificacion(usuario_id, leida);

-- Bitácora de auditoría de acciones sensibles (append-only)
CREATE TABLE audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
  accion     TEXT NOT NULL,   -- INSERT, UPDATE, DELETE, LOGIN, EXPORT, etc.
  entidad    TEXT NOT NULL,   -- nombre de la tabla/recurso afectado
  entidad_id UUID,
  datos      JSONB,           -- { "antes": {...}, "despues": {...} }
  ip         INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_entidad ON audit_log(entidad, entidad_id);
-- BRIN: índice muy ligero ideal para tablas append-only ordenadas por fecha (escalabilidad)
CREATE INDEX idx_audit_log_created_brin ON audit_log USING BRIN (created_at);
