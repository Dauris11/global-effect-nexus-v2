-- ================================================================
-- GLOBAL EFFECT NEXUS — 0013 · Extensibilidad (puerta abierta)
-- ================================================================
-- Agrega una columna `metadata JSONB` a las entidades principales
-- para permitir modificaciones/campos futuros SIN alterar el esquema
-- ni romper el código existente. Los datos estructurados nuevos
-- pueden guardarse aquí y, si maduran, promoverse a columnas propias.
--
-- Ventaja: consultas flexibles con operadores JSONB e índices GIN
-- por demanda. Default '{}' evita NULLs.
-- ================================================================

ALTER TABLE estudiante      ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE usuario         ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE patrocinador    ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE periodo         ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE materia         ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE curso           ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE academia        ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE material        ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE proyecto        ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE tarea           ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE evento          ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE transaccion     ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE cita_psicologia ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Índice GIN de ejemplo (descomentar cuando se empiece a filtrar por metadata):
-- CREATE INDEX idx_estudiante_metadata ON estudiante USING GIN (metadata);
