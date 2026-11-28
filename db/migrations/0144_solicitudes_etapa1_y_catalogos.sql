-- ============================================================================
-- PORTAL GLOBALEFFECT — 0144 · Módulo de Solicitudes (Etapa 1), catálogos y
-- propósito en proveedores
-- ============================================================================
-- 1. Agrega `proposito` ('gasto' | 'estudiantes') obligatorio en `contabilidad.proveedor`.
-- 2. Crea los catálogos administrables en Configuración > Parámetros:
--      · `public.tipo_material` (nombre, activo)
--      · `public.lugar_pasaje` (nombre, monto en DOP, activo) — inicia vacío.
-- 3. Amplía `public.solicitud` para soportar los tipos dinámicos:
--      `MATERIALES`, `PASAJE` y `OTRO`, con sus columnas específicas y moneda.
-- ============================================================================

-- 1. Propósito del proveedor
ALTER TABLE contabilidad.proveedor
  ADD COLUMN IF NOT EXISTS proposito TEXT NOT NULL DEFAULT 'gasto'
  CHECK (proposito IN ('gasto', 'estudiantes'));

-- 2. Catálogo: Tipos de Materiales
CREATE TABLE IF NOT EXISTS public.tipo_material (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL CHECK (length(trim(nombre)) BETWEEN 1 AND 120),
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tipo_material_nombre_unico
  ON public.tipo_material (lower(trim(nombre)));

ALTER TABLE public.tipo_material ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_tipo_material_updated ON public.tipo_material;
CREATE TRIGGER trg_tipo_material_updated
  BEFORE UPDATE ON public.tipo_material
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Catálogo: Lugares de Pasaje (inicia vacío; monto en DOP)
CREATE TABLE IF NOT EXISTS public.lugar_pasaje (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL CHECK (length(trim(nombre)) BETWEEN 1 AND 120),
  monto       NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lugar_pasaje_nombre_unico
  ON public.lugar_pasaje (lower(trim(nombre)));

ALTER TABLE public.lugar_pasaje ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_lugar_pasaje_updated ON public.lugar_pasaje;
CREATE TRIGGER trg_lugar_pasaje_updated
  BEFORE UPDATE ON public.lugar_pasaje
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Ampliar CHECK de `public.solicitud.tipo` conservando los tipos existentes
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT c.conname INTO v_constraint
    FROM pg_constraint c
   WHERE c.conrelid = 'public.solicitud'::regclass
     AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) LIKE '%constancia%';
  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.solicitud DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

ALTER TABLE public.solicitud
  ADD CONSTRAINT solicitud_tipo_check CHECK (
    tipo IN (
      'constancia', 'carta', 'cita_administracion', 'permiso', 'otro',
      'alta_expediente', 'beca', 'gasto', 'compra',
      'MATERIALES', 'PASAJE', 'OTRO'
    )
  );

-- 5. Columnas específicas de los tipos MATERIALES, PASAJE y OTRO
ALTER TABLE public.solicitud
  ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'USD'
    CHECK (moneda IN ('DOP', 'USD')),
  ADD COLUMN IF NOT EXISTS tipo_material_id UUID
    REFERENCES public.tipo_material(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS proveedor_id UUID
    REFERENCES contabilidad.proveedor(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lugar_pasaje_id UUID
    REFERENCES public.lugar_pasaje(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS lugar_pasaje_otro BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS motivo_pasaje TEXT
    CHECK (motivo_pasaje IS NULL OR length(motivo_pasaje) <= 300),
  ADD COLUMN IF NOT EXISTS periodo_pasaje TEXT
    CHECK (periodo_pasaje IS NULL OR periodo_pasaje IN ('hoy', 'semana', 'personalizado')),
  ADD COLUMN IF NOT EXISTS dias_pasaje JSONB,
  ADD COLUMN IF NOT EXISTS proposito_otro TEXT
    CHECK (proposito_otro IS NULL OR length(proposito_otro) <= 300),
  ADD COLUMN IF NOT EXISTS proveedor_nombre TEXT
    CHECK (proveedor_nombre IS NULL OR length(proveedor_nombre) <= 160),
  ADD COLUMN IF NOT EXISTS proveedor_rnc TEXT
    CHECK (proveedor_rnc IS NULL OR proveedor_rnc ~ '^[0-9]{9}$|^[0-9]{11}$');

CREATE INDEX IF NOT EXISTS idx_solicitud_tipo_material ON public.solicitud (tipo_material_id)
  WHERE tipo_material_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_solicitud_lugar_pasaje ON public.solicitud (lugar_pasaje_id)
  WHERE lugar_pasaje_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_solicitud_proveedor ON public.solicitud (proveedor_id)
  WHERE proveedor_id IS NOT NULL;
