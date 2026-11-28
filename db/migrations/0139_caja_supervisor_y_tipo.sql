-- 0139: Agregar supervisor y tipo de caja (caja_chica / caja) en contabilidad.caja.

BEGIN;

ALTER TABLE contabilidad.caja
  ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES public.usuario(id);

ALTER TABLE contabilidad.caja
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'caja_chica';

ALTER TABLE contabilidad.caja
  DROP CONSTRAINT IF EXISTS caja_tipo_check;

ALTER TABLE contabilidad.caja
  ADD CONSTRAINT caja_tipo_check CHECK (tipo IN ('caja_chica', 'caja'));

COMMIT;
