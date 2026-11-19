-- ================================================================
-- PORTAL GLOBALEFFECT — 0086 · Cuentas compensatorias y conciliación 1-a-N
-- ================================================================
-- 1. Cuentas de naturaleza contraria:
--    Añade `naturaleza` ('deudora', 'acreedora') y `es_compensatoria` (boolean)
--    a `contabilidad.cuenta_contable`.
--    Por defecto: activo/gasto = 'deudora', pasivo/patrimonio/ingreso = 'acreedora'.
--    Cuentas compensatorias (ej. 1.2.09 Depreciación acumulada, 1.2.01.02) se
--    marcan con naturaleza 'acreedora' y es_compensatoria = true.
--
-- 2. Conciliación uno-a-varios:
--    Permite conciliar un depósito bancario único que agrupa varias líneas
--    de asiento (múltiples recibos de donaciones/aportes).
--    Añade `grupo_id` a `contabilidad.conciliacion_partida`, retira el UNIQUE
--    estricto 1:1 en `extracto_linea_id` y valida que un extracto no pertenezca
--    a dos grupos activos distintos.
--
-- Idempotente: se puede correr dos veces.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario WHERE email = 'admin@globaleffect.org' LIMIT 1),
                  true),
       set_config('app.agente', '0086_cuentas_compensatorias_y_conciliacion.sql', true);

-- 1. Cuentas compensatorias
ALTER TABLE contabilidad.cuenta_contable
  ADD COLUMN IF NOT EXISTS naturaleza varchar(10) NOT NULL DEFAULT 'deudora'
    CHECK (naturaleza IN ('deudora', 'acreedora')),
  ADD COLUMN IF NOT EXISTS es_compensatoria boolean NOT NULL DEFAULT false;

-- Actualizar naturalezas de fábrica según el tipo
UPDATE contabilidad.cuenta_contable
   SET naturaleza = CASE
         WHEN tipo IN ('activo', 'gasto') THEN 'deudora'
         ELSE 'acreedora'
       END
 WHERE (naturaleza = 'deudora' AND tipo IN ('pasivo', 'patrimonio', 'ingreso'))
    OR (naturaleza = 'acreedora' AND tipo IN ('activo', 'gasto') AND NOT (codigo LIKE '1.2.09%' OR codigo = '1.2.01.02'));

-- Marcar cuentas reguladoras/compensatorias existentes
UPDATE contabilidad.cuenta_contable
   SET naturaleza = 'acreedora',
       es_compensatoria = true
 WHERE codigo LIKE '1.2.09%'
    OR codigo = '1.2.01.02'
    OR nombre ILIKE '%depreciaci_n acumulada%'
    OR nombre ILIKE '%provisi_n%incobrable%';

-- 2. Conciliación uno-a-varios
ALTER TABLE contabilidad.conciliacion_partida
  ADD COLUMN IF NOT EXISTS grupo_id uuid NOT NULL DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_partida_grupo
  ON contabilidad.conciliacion_partida (grupo_id);

-- Para filas existentes sin grupo propio único, aseguramos que grupo_id = id
UPDATE contabilidad.conciliacion_partida
   SET grupo_id = id
 WHERE grupo_id IS NULL;

-- Retirar índice 1:1 sobre extracto para permitir múltiples partidas en el mismo grupo
DROP INDEX IF EXISTS contabilidad.idx_partida_extracto_viva;

-- Trigger de integridad de grupo para extracto_linea
CREATE OR REPLACE FUNCTION contabilidad._fn_integridad_conciliacion_grupo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.anulado_en IS NULL THEN
    -- Si el asiento ya está conciliado, dejamos que el índice único idx_partida_asiento_viva lance su error
    IF EXISTS (
      SELECT 1 FROM contabilidad.conciliacion_partida
       WHERE asiento_linea_id = NEW.asiento_linea_id
         AND anulado_en IS NULL
    ) THEN
      RETURN NEW;
    END IF;

    IF EXISTS (
      SELECT 1 FROM contabilidad.conciliacion_partida
       WHERE extracto_linea_id = NEW.extracto_linea_id
         AND anulado_en IS NULL
         AND grupo_id <> NEW.grupo_id
    ) THEN
      RAISE EXCEPTION 'duplicate key: la línea de extracto ya está conciliada en otro grupo activo';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_conciliacion_grupo_integridad ON contabilidad.conciliacion_partida;
CREATE TRIGGER tg_conciliacion_grupo_integridad
  BEFORE INSERT OR UPDATE ON contabilidad.conciliacion_partida
  FOR EACH ROW EXECUTE FUNCTION contabilidad._fn_integridad_conciliacion_grupo();
