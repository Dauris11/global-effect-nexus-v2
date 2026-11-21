-- ================================================================
-- PORTAL GLOBALEFFECT — 0103 · Adjuntos temporales del chat de Elly AI
-- ================================================================
-- Un administrativo adjunta un PDF o una foto en el chat (listado de notas, cédula,
-- factura). Las herramientas de Elly no pueden recibir bytes —sus argumentos son JSON
-- y viajan por la tarjeta de aprobación—, así que el archivo se deja aquí y se cita por
-- id. Es TEMPORAL a propósito: son datos personales de terceros, no se conservan. Se
-- borran al usarse para una carga y, en todo caso, pasada una hora (cada vez que se
-- sube otro).
-- ================================================================

CREATE TABLE ia_adjunto (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  mime       TEXT NOT NULL CHECK (mime IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  nombre     TEXT NOT NULL,
  contenido  BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ia_adjunto_usuario ON ia_adjunto(usuario_id, created_at DESC);
