-- 0140: Secuencias de comprobantes fiscales de RD (Configuración contable > Comprobantes),
-- desglose de efectivo de cajas chicas y campos de salida (comprobante, entregado_a, desglose).

BEGIN;

-- 1. Tabla de secuencias de comprobantes fiscales (NCF / e-CF de RD).
CREATE TABLE IF NOT EXISTS contabilidad.comprobante_secuencia (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            text NOT NULL,
  cantidad        integer NOT NULL CHECK (cantidad > 0),
  desde           bigint NOT NULL CHECK (desde > 0),
  hasta           bigint NOT NULL CHECK (hasta >= desde),
  usados          integer NOT NULL DEFAULT 0 CHECK (usados >= 0 AND usados <= cantidad),
  -- NULL = aún sin responder ("Abrir"); TRUE = "Sí" (vigente); FALSE = "No" (no utilizable).
  vigente         boolean,
  creado_por      uuid NOT NULL REFERENCES public.usuario(id),
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES public.usuario(id),
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comprobante_secuencia_tipo
  ON contabilidad.comprobante_secuencia (tipo, desde DESC);

ALTER TABLE contabilidad.comprobante_secuencia ENABLE ROW LEVEL SECURITY;

-- 2. Desglose de efectivo por denominación de cada caja.
CREATE TABLE IF NOT EXISTS contabilidad.caja_desglose (
  caja_id        uuid NOT NULL REFERENCES contabilidad.caja(id) ON DELETE CASCADE,
  denominacion   numeric(12,2) NOT NULL CHECK (denominacion > 0),
  tipo           text NOT NULL CHECK (tipo IN ('billete', 'moneda')),
  cantidad       integer NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (caja_id, denominacion)
);

ALTER TABLE contabilidad.caja_desglose ENABLE ROW LEVEL SECURITY;

ALTER TABLE contabilidad.caja
  ADD COLUMN IF NOT EXISTS desglose_configurado boolean NOT NULL DEFAULT false;

-- 3. Campos de salida en contabilidad.caja_movimiento.
ALTER TABLE contabilidad.caja_movimiento
  ADD COLUMN IF NOT EXISTS factura_con_comprobante boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comprobante_numero text,
  ADD COLUMN IF NOT EXISTS comprobante_secuencia_id uuid REFERENCES contabilidad.comprobante_secuencia(id),
  ADD COLUMN IF NOT EXISTS entregado_a text,
  ADD COLUMN IF NOT EXISTS desglose jsonb;

COMMIT;
