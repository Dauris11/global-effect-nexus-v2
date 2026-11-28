-- 0138: Clave de extracto bancario con monto y fecha (evita que líneas con la misma
-- referencia, como la transferencia y el impuesto 0.20%, se sobrescriban al subir CSV)
-- y soporte de comisiones en `conciliacion_partida` para filtrar Movimientos y conciliar
-- el impuesto fijo 0.20% sin volver a contabilizarlo en la cuenta del impuesto.

BEGIN;

DO $$
DECLARE
  v_usuario uuid;
BEGIN
  SELECT id INTO v_usuario
    FROM public.usuario
   LIMIT 1;
  IF v_usuario IS NOT NULL THEN
    PERFORM set_config('app.usuario_id', v_usuario::text, true);
    PERFORM set_config('app.accion', 'editar', true);
    PERFORM set_config('app.motivo', 'Actualización de clave de extracto y columna impuesto_cargo_id', true);
  END IF;
END $$;

-- 1. Backfill de claves `ref:...` existentes para que coincidan con el nuevo formato
--    `ref:<REFERENCIA>|<MONTO>|<FECHA>` y no se dupliquen al volver a subir el mismo CSV.
UPDATE contabilidad.extracto_linea
   SET clave = clave || '|' || to_char(monto, 'FM999999999990.00') || '|' || fecha::text
 WHERE clave LIKE 'ref:%'
   AND position('|' IN clave) = 0;

-- 2. Registrar el impuesto/cargo con el que se concilió y permitir partidas conciliadas
--    de impuesto fijo sin asiento nuevo (`asiento_linea_id` opcional).
ALTER TABLE contabilidad.conciliacion_partida
  ADD COLUMN IF NOT EXISTS impuesto_cargo_id uuid REFERENCES contabilidad.impuesto_cargo(id);

ALTER TABLE contabilidad.conciliacion_partida
  ALTER COLUMN asiento_linea_id DROP NOT NULL;

ALTER TABLE contabilidad.conciliacion_partida
  DROP CONSTRAINT IF EXISTS conciliacion_partida_destino_check;

ALTER TABLE contabilidad.conciliacion_partida
  ADD CONSTRAINT conciliacion_partida_destino_check
  CHECK (asiento_linea_id IS NOT NULL OR impuesto_cargo_id IS NOT NULL);

DROP INDEX IF EXISTS contabilidad.idx_partida_asiento_viva;

CREATE UNIQUE INDEX idx_partida_asiento_viva
  ON contabilidad.conciliacion_partida (asiento_linea_id)
  WHERE anulado_en IS NULL AND asiento_linea_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_partida_impuesto_cargo
  ON contabilidad.conciliacion_partida (impuesto_cargo_id)
  WHERE anulado_en IS NULL AND impuesto_cargo_id IS NOT NULL;

-- 3. Backfill de `impuesto_cargo_id` en partidas existentes que coincidan por descripción.
UPDATE contabilidad.conciliacion_partida p
   SET impuesto_cargo_id = ic.id
  FROM contabilidad.asiento_linea l
  JOIN contabilidad.impuesto_cargo ic ON ic.nombre = l.descripcion
 WHERE p.asiento_linea_id = l.id
   AND p.impuesto_cargo_id IS NULL;

COMMIT;
