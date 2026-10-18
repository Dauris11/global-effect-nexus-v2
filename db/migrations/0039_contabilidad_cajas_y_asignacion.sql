-- ================================================================
-- GLOBAL EFFECT NEXUS — 0039 · Contabilidad: Cajas, Arqueos, Reposición
-- y Asignación Dual de Facturas (Persona y Programa)
-- ================================================================
-- Fase 4 de docs/prompts/portal-contabilidad.md y requerimientos del
-- departamento contable de la Fundación Global Effect.
--
-- Decisiones:
--   · Múltiples cajas chicas por departamento o responsable con fondo fijo.
--   · Arqueo con conteo físico por denominación (billetes y monedas DOP/USD)
--     y cálculo de faltante/sobrante; diferencia genera alerta si excede umbral.
--   · Movimientos: vales provisionales, gastos con comprobante obligatorio
--     según umbral configurable de la caja, y reposición desde libro de banco.
--   · Asignación dual: cada factura y recibo puede enlazarse a un solicitante
--     (usuario/persona de la fundación) y a un programa institucional.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario WHERE email = 'sistema@globaleffect.org'),
                  true),
       set_config('app.agente', '0039_contabilidad_cajas_y_asignacion.sql', true);

-- ----------------------------------------------------------------
-- 1. Secuencia para movimientos de caja
-- ----------------------------------------------------------------

INSERT INTO contabilidad.secuencia (clave, prefijo, siguiente)
VALUES ('CJ', 'CJ-', 1)
ON CONFLICT (clave) DO NOTHING;

-- ----------------------------------------------------------------
-- 2. Cuentas contables para Cajas
-- ----------------------------------------------------------------

INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo) VALUES
  ('1.1.01.01', 'Caja general', 'activo'),
  ('1.1.01.02', 'Caja chica operaciones', 'activo'),
  ('1.1.01.03', 'Caja chica dirección', 'activo'),
  ('6.1.05.99', 'Diferencia negativa en arqueo de caja', 'gasto'),
  ('4.1.05.99', 'Sobrante en arqueo de caja', 'ingreso')
ON CONFLICT (codigo) DO NOTHING;

-- ----------------------------------------------------------------
-- 3. Cajas
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contabilidad.caja (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo              text NOT NULL UNIQUE,
  nombre              text NOT NULL,
  departamento        text NOT NULL,
  responsable_id      uuid NOT NULL REFERENCES public.usuario(id),
  moneda              text NOT NULL DEFAULT 'DOP' CHECK (moneda IN ('DOP', 'USD')),
  fondo_fijo          numeric(14,2) NOT NULL CHECK (fondo_fijo > 0),
  saldo_actual        numeric(14,2) NOT NULL DEFAULT 0 CHECK (saldo_actual >= 0),
  umbral_adjunto      numeric(14,2) NOT NULL DEFAULT 500.00 CHECK (umbral_adjunto >= 0),
  cuenta_contable_id  uuid REFERENCES contabilidad.cuenta_contable(id),
  estado              text NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'inactiva')),
  creado_por          uuid NOT NULL REFERENCES public.usuario(id),
  creado_en           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caja_responsable ON contabilidad.caja (responsable_id);
CREATE INDEX IF NOT EXISTS idx_caja_estado ON contabilidad.caja (estado);

-- ----------------------------------------------------------------
-- 4. Arqueos de Caja
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contabilidad.arqueo (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero         bigint NOT NULL UNIQUE,
  caja_id        uuid NOT NULL REFERENCES contabilidad.caja(id),
  fecha          date NOT NULL,
  periodo_id     uuid NOT NULL REFERENCES contabilidad.periodo_contable(id),
  saldo_sistema  numeric(14,2) NOT NULL,
  saldo_contado  numeric(14,2) NOT NULL,
  diferencia     numeric(14,2) GENERATED ALWAYS AS (saldo_contado - saldo_sistema) STORED,
  estado         text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado', 'aprobado')),
  justificacion  text,
  revisado_por   uuid REFERENCES public.usuario(id),
  revisado_en    timestamptz,
  creado_por     uuid NOT NULL REFERENCES public.usuario(id),
  creado_en      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT arqueo_justificacion_diferencia CHECK (
    diferencia = 0 OR length(trim(coalesce(justificacion, ''))) >= 5
  )
);

CREATE INDEX IF NOT EXISTS idx_arqueo_caja_fecha ON contabilidad.arqueo (caja_id, fecha DESC);

-- Conteo de billetes y monedas por denominación
CREATE TABLE IF NOT EXISTS contabilidad.arqueo_denominacion (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arqueo_id     uuid NOT NULL REFERENCES contabilidad.arqueo(id) ON DELETE CASCADE,
  denominacion  numeric(10,2) NOT NULL CHECK (denominacion > 0),
  tipo          text NOT NULL CHECK (tipo IN ('billete', 'moneda')),
  cantidad      int NOT NULL CHECK (cantidad >= 0),
  subtotal      numeric(14,2) GENERATED ALWAYS AS (denominacion * cantidad) STORED,
  UNIQUE (arqueo_id, denominacion)
);

-- ----------------------------------------------------------------
-- 5. Movimientos de Caja Chica
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contabilidad.caja_movimiento (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero        bigint NOT NULL UNIQUE,
  caja_id       uuid NOT NULL REFERENCES contabilidad.caja(id),
  fecha         date NOT NULL,
  periodo_id    uuid NOT NULL REFERENCES contabilidad.periodo_contable(id),
  tipo          text NOT NULL CHECK (tipo IN ('vale', 'gasto', 'reposicion', 'ajuste')),
  monto         numeric(14,2) NOT NULL CHECK (monto > 0),
  concepto      text NOT NULL,
  persona_id    uuid REFERENCES public.usuario(id),
  factura_id    uuid REFERENCES contabilidad.factura_proveedor(id),
  recibo_id     uuid REFERENCES contabilidad.recibo(id),
  adjunto_ruta  text,
  estado        text NOT NULL DEFAULT 'completado' CHECK (estado IN ('pendiente', 'completado', 'anulado')),
  arqueo_id     uuid REFERENCES contabilidad.arqueo(id),
  creado_por    uuid NOT NULL REFERENCES public.usuario(id),
  creado_en     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caja_mov_caja ON contabilidad.caja_movimiento (caja_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_caja_mov_arqueo ON contabilidad.caja_movimiento (arqueo_id);

-- ----------------------------------------------------------------
-- 6. Enlace de Caja y Asignación Dual en Recibos y Facturas
-- ----------------------------------------------------------------

ALTER TABLE contabilidad.recibo
  ADD COLUMN IF NOT EXISTS caja_id uuid REFERENCES contabilidad.caja(id),
  ADD COLUMN IF NOT EXISTS solicitante_id uuid REFERENCES public.usuario(id),
  ADD COLUMN IF NOT EXISTS programa_codigo text;

-- Permitir que el origen de fondos sea cuenta bancaria O caja
ALTER TABLE contabilidad.recibo
  DROP CONSTRAINT IF EXISTS recibo_origen_fondos;

ALTER TABLE contabilidad.recibo
  ADD CONSTRAINT recibo_origen_fondos CHECK (
    (cuenta_bancaria_id IS NOT NULL AND caja_id IS NULL) OR
    (cuenta_bancaria_id IS NULL AND caja_id IS NOT NULL)
  );

ALTER TABLE contabilidad.factura_proveedor
  ADD COLUMN IF NOT EXISTS solicitante_id uuid REFERENCES public.usuario(id),
  ADD COLUMN IF NOT EXISTS programa_codigo text;

CREATE INDEX IF NOT EXISTS idx_factura_solicitante ON contabilidad.factura_proveedor (solicitante_id);
CREATE INDEX IF NOT EXISTS idx_factura_programa ON contabilidad.factura_proveedor (programa_codigo);

-- ----------------------------------------------------------------
-- 7. Función de Reposición de Caja desde Banco
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION contabilidad.reponer_caja(
  p_caja_id          uuid,
  p_cuenta_banco_id  uuid,
  p_monto            numeric,
  p_fecha            date,
  p_concepto         text
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_caja             contabilidad.caja%ROWTYPE;
  v_cuenta           contabilidad.cuenta_bancaria%ROWTYPE;
  v_recibo_id        uuid;
  v_mov_caja_id      uuid;
  v_periodo_id       uuid;
  v_nuevo_saldo      numeric;
BEGIN
  SELECT * INTO v_caja FROM contabilidad.caja WHERE id = p_caja_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caja no encontrada.';
  END IF;

  IF v_caja.estado <> 'activa' THEN
    RAISE EXCEPTION 'La caja no está activa.';
  END IF;

  SELECT * INTO v_cuenta FROM contabilidad.cuenta_bancaria WHERE id = p_cuenta_banco_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta bancaria de salida no encontrada.';
  END IF;

  IF v_cuenta.moneda <> v_caja.moneda THEN
    RAISE EXCEPTION 'La moneda de la cuenta bancaria (%) no coincide con la de la caja (%).',
                    v_cuenta.moneda, v_caja.moneda;
  END IF;

  IF p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto de reposición debe ser mayor a cero.';
  END IF;

  v_periodo_id := contabilidad.periodo_para(p_fecha);

  -- 1. Generar comprobante de egreso bancario
  INSERT INTO contabilidad.recibo (
    tipo, numero, fecha, periodo_id, cuenta_bancaria_id,
    moneda, tasa, monto, concepto, forma_pago, estado,
    cuenta_contrapartida_id, creado_por
  ) VALUES (
    'egreso', contabilidad.siguiente_numero('CE'), p_fecha, v_periodo_id, p_cuenta_banco_id,
    v_caja.moneda, 1.0, p_monto, p_concepto, 'transferencia', 'borrador',
    v_caja.cuenta_contable_id, contabilidad._usuario_actual()
  ) RETURNING id INTO v_recibo_id;

  -- Contabilizar el egreso bancario (genera asiento y movimiento bancario)
  PERFORM contabilidad.contabilizar_recibo(v_recibo_id);

  -- 2. Registrar el movimiento de entrada en la caja chica
  INSERT INTO contabilidad.caja_movimiento (
    numero, caja_id, fecha, periodo_id, tipo, monto, concepto,
    recibo_id, estado, creado_por
  ) VALUES (
    contabilidad.siguiente_numero('CJ'), p_caja_id, p_fecha, v_periodo_id, 'reposicion',
    p_monto, p_concepto, v_recibo_id, 'completado', contabilidad._usuario_actual()
  ) RETURNING id INTO v_mov_caja_id;

  -- 3. Actualizar saldo actual de la caja
  v_nuevo_saldo := v_caja.saldo_actual + p_monto;
  UPDATE contabilidad.caja
     SET saldo_actual = v_nuevo_saldo
   WHERE id = p_caja_id;

  RETURN v_mov_caja_id;
END;
$$;

-- ----------------------------------------------------------------
-- 8. Auditoría inmutable de las tablas nuevas
-- ----------------------------------------------------------------

SELECT contabilidad.auditar_tabla(t)
  FROM unnest(ARRAY[
    'contabilidad.caja',
    'contabilidad.caja_movimiento',
    'contabilidad.arqueo',
    'contabilidad.arqueo_denominacion'
  ]::regclass[]) AS t;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA contabilidad FROM anon, authenticated;
  END IF;
END;
$$;
