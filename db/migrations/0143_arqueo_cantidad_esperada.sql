-- Almacena la cantidad esperada del sistema por denominación al momento del arqueo
-- para la auditoría comparativa y la reimpresión fiel del Acta de Arqueo PDF.

ALTER TABLE contabilidad.arqueo_denominacion
  ADD COLUMN IF NOT EXISTS cantidad_esperada int NOT NULL DEFAULT 0 CHECK (cantidad_esperada >= 0);
