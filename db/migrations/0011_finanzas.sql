-- ================================================================
-- GLOBAL EFFECT NEXUS — 0011 · Finanzas
-- ================================================================
-- Registro de ingresos y egresos de la fundación.
-- ================================================================

CREATE TYPE tipo_transaccion AS ENUM ('ingreso', 'egreso');

CREATE TABLE transaccion (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concepto   TEXT NOT NULL,
  tipo       tipo_transaccion NOT NULL,
  monto      NUMERIC(12,2) NOT NULL CHECK (monto > 0.00),   -- USD
  categoria  TEXT NOT NULL DEFAULT 'otro',   -- beca, donacion, operativo, salario, material, evento, otro
  fecha      DATE NOT NULL DEFAULT CURRENT_DATE,
  referencia TEXT,
  notas      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_transaccion_fecha     ON transaccion(fecha);
CREATE INDEX idx_transaccion_tipo      ON transaccion(tipo);
CREATE INDEX idx_transaccion_categoria ON transaccion(categoria);

CREATE TRIGGER trg_transaccion_updated BEFORE UPDATE ON transaccion FOR EACH ROW EXECUTE FUNCTION set_updated_at();
