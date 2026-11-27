-- ================================================================
-- PORTAL GLOBALEFFECT — 0132 · Tarifa bancaria USD y transferencia con tarifa
-- ================================================================
-- 1. Agrega `tarifa` (DOP) a `contabilidad.cuenta_bancaria` y
--    `contabilidad.solicitud_cambio_cuenta_bancaria` (obligatoria para USD).
-- 2. Siembra el código de transacción `BAN_TRANSFER_TARIFA` (débito) enlazado
--    a `5.2.3.4.2 · Comisiones por Servicios`.
-- 3. Actualiza `lineas_transferencia` y `transferir` aceptando
--    `p_usar_tarifa boolean DEFAULT false`:
--      · DOP → USD con tarifa = true:
--          - Débito destino USD: monto_recibir * tasa_compra_banco
--          - Débito BAN_TRANSFER_TARIFA (5.2.3.4.2): tarifa del banco (si > 0)
--          - Crédito origen DOP: (monto_recibir * tasa_compra_banco) + tarifa
--      · DOP → USD con tarifa = false:
--          - Mantiene la fórmula cambiaria con compra BCRD y venta del banco
--            (0131), cargando la diferencia a BAN_TRANSFER_PERDIDA_CAMBIARIA.
--
-- Idempotente. Aplicar como rol `postgres`.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario
                    WHERE email IN ('sistema@globaleffect.org', 'admin@globaleffect.org')
                    ORDER BY (email = 'sistema@globaleffect.org') DESC LIMIT 1),
                  true),
       set_config('app.agente', '0132_tarifa_banco_usd.sql', true);

-- 1) Tarifa por transferencia en cuentas bancarias (USD) y sus solicitudes
ALTER TABLE contabilidad.cuenta_bancaria
  ADD COLUMN IF NOT EXISTS tarifa numeric(14,2)
    CHECK (tarifa IS NULL OR tarifa >= 0);

ALTER TABLE contabilidad.solicitud_cambio_cuenta_bancaria
  ADD COLUMN IF NOT EXISTS tarifa numeric(14,2)
    CHECK (tarifa IS NULL OR tarifa >= 0);

COMMENT ON COLUMN contabilidad.cuenta_bancaria.tarifa IS
  'Tarifa fija en DOP que cobra el banco por transferencias hacia cuentas en USD.';

-- 2) Código de transacción para tarifa bancaria → 5.2.3.4.2 (Comisiones por Servicios)
INSERT INTO contabilidad.codigo_transaccion (codigo, naturaleza, cuenta_id)
SELECT 'BAN_TRANSFER_TARIFA', 'debito', c.id
  FROM contabilidad.cuenta_contable c
 WHERE c.codigo = '5.2.3.4.2' AND c.admite_movimiento AND c.activa
ON CONFLICT (codigo) DO UPDATE
   SET cuenta_id = COALESCE(contabilidad.codigo_transaccion.cuenta_id, EXCLUDED.cuenta_id),
       actualizado_en = now();

-- 3) Reemplazar firmas sin ambigüedad de sobrecarga
DROP FUNCTION IF EXISTS contabilidad.transferir(uuid, uuid, date, numeric, numeric, text, text);
DROP FUNCTION IF EXISTS contabilidad.transferir(uuid, uuid, date, numeric, numeric, text, text, boolean);
DROP FUNCTION IF EXISTS contabilidad.lineas_transferencia(uuid, uuid, date, numeric, numeric);
DROP FUNCTION IF EXISTS contabilidad.lineas_transferencia(uuid, uuid, date, numeric, numeric, boolean);
DROP FUNCTION IF EXISTS contabilidad._importes_transferencia_fx(text, text, date, numeric, numeric, numeric);
DROP FUNCTION IF EXISTS contabilidad._importes_transferencia_fx(text, text, date, numeric, numeric, numeric, numeric, numeric, boolean);

CREATE OR REPLACE FUNCTION contabilidad._importes_transferencia_fx(
  p_moneda_origen       text,
  p_moneda_destino      text,
  p_fecha               date,
  p_monto_origen        numeric,
  p_monto_destino       numeric,
  p_tasa_venta_destino  numeric DEFAULT NULL,
  p_tasa_compra_destino numeric DEFAULT NULL,
  p_tarifa_destino      numeric DEFAULT NULL,
  p_usar_tarifa         boolean DEFAULT false
) RETURNS TABLE (
  tasa_referencia numeric,
  dop_origen      numeric,
  dop_destino     numeric,
  diferencia      numeric,
  tarifa          numeric
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_compra_bcrd  numeric(12,4);
  v_venta_bcrd   numeric(12,4);
  v_venta_banco  numeric(12,4);
  v_compra_banco numeric(12,4);
  v_tarifa       numeric(14,2);
  v_ref          numeric(12,4);
BEGIN
  tarifa := 0;

  IF p_moneda_origen = 'DOP' AND p_moneda_destino = 'USD' THEN
    IF p_usar_tarifa THEN
      v_compra_banco := p_tasa_compra_destino;
      IF v_compra_banco IS NULL THEN
        SELECT tc.compra INTO v_compra_banco
          FROM contabilidad.tasa_cambio tc
         WHERE tc.fecha <= p_fecha
         ORDER BY tc.fecha DESC
         LIMIT 1;
      END IF;
      IF v_compra_banco IS NULL THEN
        RAISE EXCEPTION 'contabilidad: no hay tasa de compra configurada para la transferencia';
      END IF;

      v_tarifa := round(coalesce(p_tarifa_destino, 0), 2);
      tasa_referencia := v_compra_banco;
      dop_destino     := round(p_monto_destino * v_compra_banco, 2);
      tarifa          := v_tarifa;
      dop_origen      := dop_destino + v_tarifa;
      diferencia      := 0;
      RETURN NEXT;
      RETURN;
    END IF;

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
    dop_destino     := round(p_monto_destino * v_compra_bcrd, 2);
    dop_origen      := round(p_monto_destino * v_venta_banco, 2);
    diferencia      := dop_destino - dop_origen;
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
  p_monto_destino numeric DEFAULT NULL,
  p_usar_tarifa   boolean DEFAULT false
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
      o.moneda, d.moneda, p_fecha, p_monto_origen, v_destino,
      d.tasa_venta, d.tasa_compra, d.tarifa, p_usar_tarifa
    );

  v_lineas := jsonb_build_array(
    jsonb_build_object('cuenta_id', d.cuenta_contable_id, 'debe',  i.dop_destino),
    jsonb_build_object('cuenta_id', o.cuenta_contable_id, 'haber', i.dop_origen)
  );

  IF i.tarifa > 0 THEN
    v_lineas := v_lineas || contabilidad.linea_por_codigo(
      'BAN_TRANSFER_TARIFA', i.tarifa, 'Tarifa bancaria de transferencia'
    );
  END IF;

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
  p_concepto text, p_referencia text,
  p_usar_tarifa boolean DEFAULT false
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
      o.moneda, d.moneda, p_fecha, p_monto_origen, v_destino,
      d.tasa_venta, d.tasa_compra, d.tarifa, p_usar_tarifa
    );

  -- En DOP → USD la salida real del banco DOP incluye la tarifa o diferencia
  -- cambiaria para que el libro bancario y el asiento cuadren exactamente.
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
    contabilidad.lineas_transferencia(p_origen, p_destino, p_fecha, p_monto_origen, v_destino, p_usar_tarifa)
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
