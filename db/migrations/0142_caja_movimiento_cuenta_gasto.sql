-- 0142: Guardar la cuenta contable de gasto directamente en `contabilidad.caja_movimiento`
-- para mostrarla en la tabla de movimientos y contabilizarla al momento de la reposición
-- (las salidas individuales ya no generan asiento contable al registrarse).

BEGIN;

ALTER TABLE contabilidad.caja_movimiento
  ADD COLUMN IF NOT EXISTS cuenta_gasto_id uuid REFERENCES contabilidad.cuenta_contable(id);

COMMIT;
