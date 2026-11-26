-- ================================================================
-- PORTAL GLOBALEFFECT — 0131 · Tasas por banco USD y transferencia DOP→USD
-- ================================================================
-- 1. Agrega `tasa_compra` y `tasa_venta` a `contabilidad.cuenta_bancaria` y
--    a `contabilidad.solicitud_cambio_cuenta_bancaria` (obligatorias en la
--    UI y acciones cuando la cuenta opera en USD).
-- 2. Siembra la cuenta de gasto `5.2.3.11 · Gasto por Cambio de Divisas` y
--    la asigna a `BAN_TRANSFER_PERDIDA_CAMBIARIA` si aún no tiene cuenta,
--    para registrar automáticamente el gasto cambiario en transferencias.
-- 3. Actualiza `lineas_transferencia` y `transferir` para el caso DOP → USD:
--      · Valor del ingreso en la cuenta USD (DOP): monto_recibir * compra_BCRD
--      · Diferencia de cambio (gasto):
--          (monto_recibir * tasa_venta_banco) - (monto_recibir * compra_BCRD)
--      · Salida real de la cuenta origen DOP: monto_recibir * tasa_venta_banco
--    Así el asiento cuadra exacto (Débito destino + Débito gasto cambiario =
--    Crédito origen) y `BotonAsiento` muestra exactamente lo que se registra.
--
-- Idempotente. Aplicar como rol `postgres`.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario
                    WHERE email IN ('sistema@globaleffect.org', 'admin@globaleffect.org')
                    ORDER BY (email = 'sistema@globaleffect.org') DESC LIMIT 1),
                  true),
       set_config('app.agente', '0131_tasas_banco_y_transferencia_fx.sql', true);

-- 1) Tasas de compra y venta en cuentas bancarias (USD) y en sus solicitudes
ALTER TABLE contabilidad.cuenta_bancaria
  ADD COLUMN IF NOT EXISTS tasa_compra numeric(12,4)
    CHECK (tasa_compra IS NULL OR tasa_compra > 0),
  ADD COLUMN IF NOT EXISTS tasa_venta numeric(12,4)
    CHECK (tasa_venta IS NULL OR tasa_venta > 0);

ALTER TABLE contabilidad.solicitud_cambio_cuenta_bancaria
  ADD COLUMN IF NOT EXISTS tasa_compra numeric(12,4)
    CHECK (tasa_compra IS NULL OR tasa_compra > 0),
  ADD COLUMN IF NOT EXISTS tasa_venta numeric(12,4)
    CHECK (tasa_venta IS NULL OR tasa_venta > 0);

COMMENT ON COLUMN contabilidad.cuenta_bancaria.tasa_compra IS
  'Tasa de compra de divisas del banco (obligatoria para cuentas en USD).';
COMMENT ON COLUMN contabilidad.cuenta_bancaria.tasa_venta IS
  'Tasa de venta de divisas del banco (obligatoria para cuentas en USD; usada para diferencia cambiaria en DOP → USD).';

-- 2) Cuenta contable para gasto por cambio de divisas y código BAN_TRANSFER_PERDIDA_CAMBIARIA
INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo, admite_movimiento, padre_id, activa)
SELECT '5.2.3.11', 'Gasto por Cambio de Divisas', 'gasto', true, p.id, true
  FROM contabilidad.cuenta_contable p
 WHERE p.codigo = '5.2.3'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO contabilidad.codigo_transaccion (codigo, naturaleza, cuenta_id)
SELECT 'BAN_TRANSFER_PERDIDA_CAMBIARIA', 'debito', c.id
  FROM contabilidad.cuenta_contable c
 WHERE c.codigo = '5.2.3.11' AND c.admite_movimiento AND c.activa
ON CONFLICT (codigo) DO UPDATE
   SET cuenta_id = COALESCE(contabilidad.codigo_transaccion.cuenta_id, EXCLUDED.cuenta_id),
       actualizado_en = now();

-- 3) Cálculo unificado de importes para transferencias entre cuentas propias
CREATE OR REPLACE FUNCTION contabilidad._importes_transferencia_fx(
  p_moneda_origen      text,
  p_moneda_destino     text,
  p_fecha              date,
  p_monto_origen       numeric,
  p_monto_destino      numeric,
  p_tasa_venta_destino numeric DEFAULT NULL
) RETURNS TABLE (
  tasa_referencia numeric,
  dop_origen      numeric,
  dop_destino     numeric,
  diferencia      numeric
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_compra_bcrd numeric(12,4);
  v_venta_bcrd  numeric(12,4);
  v_venta_banco numeric(12,4);
  v_ref         numeric(12,4);
BEGIN
  IF p_moneda_origen = 'DOP' AND p_moneda_destino = 'USD' THEN
    SELECT tc.compra, tc.venta
      INTO v_compra_bcrd, v_venta_bcrd
      FROM contabilidad.tasa_cambio tc
     WHERE tc.fecha <= p_fecha
     ORDER BY tc.fecha DESC
     LIMIT 1;

    IF v_compra_bcrd IS NULL THEN
      RAISE EXCEPTION 'contabilidad: no hay tasa de cambio registrada en o antes de %', p_fecha;
    END IF;

    v_venta_banco := coalesce(p_tasa_venta_destino, v_venta_bcrd);

    tasa_referencia := v_compra_bcrd;
    -- Monto a recibir valorado a la tasa de compra del BCRD.
    dop_destino := round(p_monto_destino * v_compra_bcrd, 2);
    -- Desembolso total desde la cuenta DOP a la tasa de venta del banco destino.
    dop_origen  := round(p_monto_destino * v_venta_banco, 2);
    -- Negativo cuando tasa_venta_banco > compra_BCRD → gasto cambiario = -diferencia.
    diferencia  := dop_destino - dop_origen;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_moneda_origen = 'USD' OR p_moneda_destino = 'USD' THEN
    v_ref := contabilidad.tasa_referencia(p_fecha);
    IF v_ref IS NULL THEN
      RAISE EXCEPTION 'contabilidad: no hay tasa de cambio registrada en o antes de %', p_fecha;
    END IF;
  END IF;

  tasa_referencia := v_ref;
  dop_origen  := CASE p_moneda_origen  WHEN 'DOP' THEN p_monto_origen  ELSE round(p_monto_origen  * v_ref, 2) END;
  dop_destino := CASE p_moneda_destino WHEN 'DOP' THEN p_monto_destino ELSE round(p_monto_destino * v_ref, 2) END;
  diferencia  := dop_destino - dop_origen;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION contabilidad.lineas_transferencia(
  p_origen        uuid,
  p_destino       uuid,
  p_fecha         date,
  p_monto_origen  numeric,
  p_monto_destino numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  o         contabilidad.cuenta_bancaria%ROWTYPE;
  d         contabilidad.cuenta_bancaria%ROWTYPE;
  v_destino numeric(14,2) := coalesce(p_monto_destino, p_monto_origen);
  i         record;
  v_lineas  jsonb;
BEGIN
  SELECT * INTO o FROM contabilidad.cuenta_bancaria WHERE id = p_origen;
  SELECT * INTO d FROM contabilidad.cuenta_bancaria WHERE id = p_destino;
  IF o.id IS NULL OR d.id IS NULL OR o.id = d.id THEN
    RAISE EXCEPTION 'contabilidad: cuentas de la transferencia no válidas';
  END IF;

  SELECT * INTO i
    FROM contabilidad._importes_transferencia_fx(
      o.moneda, d.moneda, p_fecha, p_monto_origen, v_destino, d.tasa_venta
    );

  v_lineas := jsonb_build_array(
    jsonb_build_object('cuenta_id', d.cuenta_contable_id, 'debe',  i.dop_destino),
    jsonb_build_object('cuenta_id', o.cuenta_contable_id, 'haber', i.dop_origen)
  );

  IF i.diferencia > 0 THEN
    v_lineas := v_lineas || contabilidad.linea_por_codigo(
      'BAN_TRANSFER_GANANCIA_CAMBIARIA', i.diferencia, 'Diferencia de cambio'
    );
  ELSIF i.diferencia < 0 THEN
    v_lineas := v_lineas || contabilidad.linea_por_codigo(
      'BAN_TRANSFER_PERDIDA_CAMBIARIA', -i.diferencia, 'Gasto por cambio de divisas'
    );
  END IF;

  RETURN v_lineas;
END;
$$;

CREATE OR REPLACE FUNCTION contabilidad.transferir(
  p_origen uuid, p_destino uuid, p_fecha date,
  p_monto_origen numeric, p_monto_destino numeric,
  p_concepto text, p_referencia text
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  o              contabilidad.cuenta_bancaria%ROWTYPE;
  d              contabilidad.cuenta_bancaria%ROWTYPE;
  v_destino      numeric(14,2) := coalesce(p_monto_destino, p_monto_origen);
  v_salida_monto numeric(14,2);
  i              record;
  v_aplicada     numeric(12,4);
  v_periodo      uuid := contabilidad.periodo_para(p_fecha);
  v_id           uuid := gen_random_uuid();
  v_numero       bigint := contabilidad.siguiente_numero('TR');
  v_salida       uuid;
  v_entrada      uuid;
  v_asiento      uuid;
BEGIN
  SELECT * INTO o FROM contabilidad.cuenta_bancaria WHERE id = p_origen;
  SELECT * INTO d FROM contabilidad.cuenta_bancaria WHERE id = p_destino;
  IF o.id IS NULL OR d.id IS NULL OR o.id = d.id THEN
    RAISE EXCEPTION 'contabilidad: cuentas de la transferencia no válidas';
  END IF;
  IF o.estado <> 'activa' OR d.estado <> 'activa' THEN
    RAISE EXCEPTION 'contabilidad: una de las cuentas está cerrada';
  END IF;
  IF o.moneda = d.moneda AND v_destino <> p_monto_origen THEN
    RAISE EXCEPTION 'contabilidad: entre cuentas de la misma moneda sale y entra lo mismo';
  END IF;

  SELECT * INTO i
    FROM contabilidad._importes_transferencia_fx(
      o.moneda, d.moneda, p_fecha, p_monto_origen, v_destino, d.tasa_venta
    );

  -- En DOP → USD la salida efectiva del banco DOP incluye la diferencia cambiaria
  -- (monto_recibir * tasa_venta_banco) para que libro y asiento cuadren al centavo.
  v_salida_monto := CASE
    WHEN o.moneda = 'DOP' AND d.moneda = 'USD' THEN i.dop_origen
    ELSE p_monto_origen
  END;

  IF o.moneda <> d.moneda THEN
    v_aplicada := CASE o.moneda
      WHEN 'DOP' THEN round(v_salida_monto / v_destino, 4)
      ELSE round(v_destino / v_salida_monto, 4)
    END;
  END IF;

  INSERT INTO contabilidad.movimiento_bancario
         (numero, cuenta_id, periodo_id, fecha, tipo, monto, moneda, tasa, monto_dop,
          concepto, referencia, origen_tabla, origen_id, creado_por)
  VALUES (contabilidad.siguiente_numero('MB'), o.id, v_periodo, p_fecha, 'transferencia_enviada',
          v_salida_monto, o.moneda, CASE o.moneda WHEN 'USD' THEN i.tasa_referencia END, i.dop_origen,
          p_concepto, p_referencia, 'transferencia_interna', v_id, contabilidad._usuario_actual())
  RETURNING id INTO v_salida;

  INSERT INTO contabilidad.movimiento_bancario
         (numero, cuenta_id, periodo_id, fecha, tipo, monto, moneda, tasa, monto_dop,
          concepto, referencia, origen_tabla, origen_id, creado_por)
  VALUES (contabilidad.siguiente_numero('MB'), d.id, v_periodo, p_fecha, 'transferencia_recibida',
          v_destino, d.moneda, CASE d.moneda WHEN 'USD' THEN i.tasa_referencia END, i.dop_destino,
          p_concepto, p_referencia, 'transferencia_interna', v_id, contabilidad._usuario_actual())
  RETURNING id INTO v_entrada;

  v_asiento := contabilidad.crear_asiento(
    p_fecha, 'TR-' || v_numero || ' ' || p_concepto, 'automatico', 'transferencia_interna', v_id,
    contabilidad.lineas_transferencia(p_origen, p_destino, p_fecha, p_monto_origen, v_destino)
  );

  INSERT INTO contabilidad.transferencia_interna
         (id, numero, fecha, periodo_id, cuenta_origen_id, cuenta_destino_id,
          monto_origen, monto_destino, tasa_aplicada, tasa_referencia, diferencia_cambiaria,
          concepto, referencia, movimiento_salida_id, movimiento_entrada_id, asiento_id, creado_por)
  VALUES (v_id, v_numero, p_fecha, v_periodo, o.id, d.id,
          v_salida_monto, v_destino, v_aplicada, i.tasa_referencia, i.diferencia,
          p_concepto, p_referencia, v_salida, v_entrada, v_asiento, contabilidad._usuario_actual());

  RETURN v_id;
END;
$$;
