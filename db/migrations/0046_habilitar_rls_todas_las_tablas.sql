-- ============================================================================
-- 0046_habilitar_rls_todas_las_tablas.sql
--
-- Habilita Row Level Security (RLS) en todas las tablas de los esquemas
-- 'public' y 'contabilidad' para proteger la base de datos contra accesos
-- no autorizados vía la API REST pública de PostgREST y resolver las alertas
-- del Database Linter de Supabase (rls_disabled_in_public).
--
-- Nota de arquitectura: La aplicación Global Effect Nexus consulta y opera
-- mediante conexión directa PostgreSQL con 'pg' como rol postgres (superuser),
-- el cual cuenta con atributo BYPASSRLS por diseño, manteniendo íntegro el
-- funcionamiento del ERP a la vez que sella el acceso HTTP anónimo exterior.
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Habilitar RLS en todas las tablas del esquema public
    FOR r IN (
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND rowsecurity = false
    ) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    END LOOP;

    -- Habilitar RLS en todas las tablas del esquema contabilidad
    FOR r IN (
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'contabilidad'
          AND rowsecurity = false
    ) LOOP
        EXECUTE format('ALTER TABLE contabilidad.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    END LOOP;
END $$;
