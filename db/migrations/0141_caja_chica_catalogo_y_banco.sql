-- 0141: Bandera «Agregar a caja chica» en el catálogo contable y banco de origen
-- en contabilidad.caja para asientos de apertura y ajuste de fondo.

BEGIN;

ALTER TABLE contabilidad.cuenta_contable
  ADD COLUMN IF NOT EXISTS agregar_a_caja_chica boolean NOT NULL DEFAULT false;

ALTER TABLE contabilidad.caja
  ADD COLUMN IF NOT EXISTS cuenta_bancaria_id uuid REFERENCES contabilidad.cuenta_bancaria(id);

COMMIT;
