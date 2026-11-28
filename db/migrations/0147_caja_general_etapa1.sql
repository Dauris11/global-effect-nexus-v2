-- ============================================================================
-- PORTAL GLOBALEFFECT — 0147 · Módulo de Caja (Caja General) — Etapa #1
-- ============================================================================
-- 1. Agrega marcas independientes en `contabilidad.cuenta_contable` para
--    cuentas auxiliares/de movimiento:
--      · `agregar_a_caja_ingreso` (Permitir en Tipo de Ingreso)
--      · `agregar_a_caja_egreso`  (Permitir en Tipo de Egreso)
-- 2. Adapta `contabilidad.caja` para Caja General:
--      · Permite `fondo_fijo >= 0` (una Caja General puede iniciar en 0.00).
--      · Agrega `abierta boolean NOT NULL DEFAULT true` (Abierta vs Cerrada).
--      · Agrega `eliminada_en` y `eliminada_por` (baja controlada por
--        supervisor únicamente cuando saldo y desglose son 0.00), con índice
--        único parcial sobre `codigo` para reutilizar códigos de cajas eliminadas.
-- 3. Amplía `contabilidad.caja_movimiento` para soportar movimientos de
--    Caja General (`tipo IN ('ingreso', 'egreso')`) y su cuenta contrapartida.
-- ============================================================================

-- 1. Marcas en catálogo de cuentas auxiliares
ALTER TABLE contabilidad.cuenta_contable
  ADD COLUMN IF NOT EXISTS agregar_a_caja_ingreso boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agregar_a_caja_egreso  boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN contabilidad.cuenta_contable.agregar_a_caja_ingreso IS
  'Si es true (en cuentas de movimiento), aparece en el selector Tipo de ingreso de Caja General.';
COMMENT ON COLUMN contabilidad.cuenta_contable.agregar_a_caja_egreso IS
  'Si es true (en cuentas de movimiento), aparece en el selector Tipo de egreso de Caja General.';

-- 2. Estado Abierta/Cerrada, saldo inicial 0.00 y eliminación lógica en contabilidad.caja
ALTER TABLE contabilidad.caja
  DROP CONSTRAINT IF EXISTS caja_fondo_fijo_check;

ALTER TABLE contabilidad.caja
  ADD CONSTRAINT caja_fondo_fijo_check CHECK (fondo_fijo >= 0);

ALTER TABLE contabilidad.caja
  ADD COLUMN IF NOT EXISTS abierta boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS eliminada_en timestamptz,
  ADD COLUMN IF NOT EXISTS eliminada_por uuid REFERENCES public.usuario(id) ON DELETE SET NULL;

-- Permitir reutilizar código si la caja anterior fue eliminada (saldo 0.00)
ALTER TABLE contabilidad.caja
  DROP CONSTRAINT IF EXISTS caja_codigo_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_caja_codigo_activo
  ON contabilidad.caja (codigo)
  WHERE eliminada_en IS NULL;

-- 3. Tipos 'ingreso' y 'egreso' + cuenta contrapartida en contabilidad.caja_movimiento
ALTER TABLE contabilidad.caja_movimiento
  DROP CONSTRAINT IF EXISTS caja_movimiento_tipo_check;

ALTER TABLE contabilidad.caja_movimiento
  ADD CONSTRAINT caja_movimiento_tipo_check CHECK (
    tipo IN ('vale', 'gasto', 'reposicion', 'ajuste', 'ingreso', 'egreso')
  );

ALTER TABLE contabilidad.caja_movimiento
  ADD COLUMN IF NOT EXISTS cuenta_contrapartida_id uuid
    REFERENCES contabilidad.cuenta_contable(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_caja_movimiento_caja_general
  ON contabilidad.caja_movimiento (caja_id, estado, tipo, fecha DESC)
  WHERE tipo IN ('ingreso', 'egreso');
