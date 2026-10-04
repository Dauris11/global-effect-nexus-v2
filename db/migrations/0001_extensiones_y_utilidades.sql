-- ================================================================
-- GLOBAL EFFECT NEXUS — 0001 · Extensiones y utilidades base
-- Motor: PostgreSQL 17 (Supabase)
-- ================================================================
-- Este script habilita las extensiones necesarias y crea la
-- función reutilizable de auditoría de fecha (updated_at).
-- Es idempotente: puede ejecutarse varias veces sin error.
-- ================================================================

-- UUIDs auto-generados (gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Emails y textos únicos sin distinción de mayúsculas/minúsculas
CREATE EXTENSION IF NOT EXISTS "citext";

-- Búsqueda difusa por similitud (buscador inteligente de estudiantes, etc.)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Embeddings vectoriales para IA / búsqueda semántica (RAG)
CREATE EXTENSION IF NOT EXISTS "vector";

-- ----------------------------------------------------------------
-- Función genérica: actualiza automáticamente la columna updated_at
-- en cada UPDATE. Se enlaza por trigger en cada tabla auditable.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
