-- ================================================================
-- 0117 · Códigos de transacción de tesorería: bancos, cajas y recibos
--
-- 1. Siembra la asignación código → cuenta que PRESERVA el comportamiento
--    actual, buscando cada cuenta por su `codigo` en el catálogo vigente de
--    88 cuentas (solo si existe, admite movimiento y está activa):
--      BAN_TRANSFER_GANANCIA_CAMBIARIA  crédito  4.3.2  Ingresos por Cambio de Divisas
--      BAN_TRANSFER_PERDIDA_CAMBIARIA   débito   5.4.4  Diferencia de Cambios de Moneda
--      CAJ_CAJA_CHICA                   débito   1.1.1  Caja Chica
--      CAJ_ARQUEO_FALTANTE              débito   5.4.12 Otros Gastos
--    CAJ_ARQUEO_SOBRANTE queda SIN fila: el catálogo no tiene cuenta de
--    sobrante de caja (hoy aprobar un arqueo con sobrante ya se rechazaba por
--    eso). No se inventa una cuenta: «Asiento» muestra qué falta.
--
-- 2. Separa el armado del asiento en funciones puras, para que la vista
--    previa («Asiento») y el asiento real salgan del MISMO cálculo:
--      contabilidad._importes_transferencia   tasa y montos en pesos
--      contabilidad.lineas_transferencia      líneas de una transferencia
--      contabilidad.lineas_recibo             líneas de un recibo
--    `transferir` y `contabilizar_recibo` las usan y luego llaman a
--    `crear_asiento`. El asiento resultante es idéntico al anterior.
--    Las anulaciones siguen espejando el asiento original (`revertir_asiento`).
--
-- Un recibo no tiene códigos: el banco es la cuenta bancaria elegida y la
-- contrapartida sale de la categoría (o de `cuenta_contrapartida_id`).
--
-- Idempotente. Aplicar como rol `postgres`.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario
                    WHERE email IN ('sistema@globaleffect.org', 'admin@globaleffect.org')
                    ORDER BY (email = 'sistema@globaleffect.org') DESC LIMIT 1),
                  true),
       set_config('app.agente', '0117_codigos_tesoreria.sql', true);

INSERT INTO contabilidad.codigo_transaccion (codigo, naturaleza, cuenta_id)
SELECT s.codigo, s.naturaleza, c.id
  FROM (VALUES
    ('BAN_TRANSFER_GANANCIA_CAMBIARIA', 'credito', '4.3.2'),
    ('BAN_TRANSFER_PERDIDA_CAMBIARIA',  'debito',  '5.4.4'),
    ('CAJ_CAJA_CHICA',                  'debito',  '1.1.1'),
    ('CAJ_ARQUEO_FALTANTE',             'debito',  '5.4.12')
  ) AS s(codigo, naturaleza, cuenta)
  JOIN contabilidad.cuenta_contable c
    ON c.codigo = s.cuenta AND c.admite_movimiento AND c.activa
ON CONFLICT (codigo) DO NOTHING;

-- ---------------------------------------------------------------
-- Importes de una transferencia, en pesos y con la MISMA tasa de
-- referencia en los dos lados. Lo que no cuadra es lo que el banco cobró
-- (o regaló) en el cambio.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION contabilidad._importes_transferencia(
  p_moneda_origen  text,
  p_moneda_destino text,
  p_fecha          date,
  p_monto_origen   numeric,
  p_monto_destino  numeric
) RETURNS TABLE (tasa_referencia numeric, dop_origen numeric, dop_destino numeric, diferencia numeric)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_ref numeric(12,4);
BEGIN
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

-- ---------------------------------------------------------------
-- Líneas de la transferencia: débito a la cuenta contable del destino,
-- crédito a la del origen y, si el cambio no cuadra, la diferencia por el
-- código de ganancia o de pérdida. Sin diferencia no hay línea (y no se
-- exige cuenta para un código que no se usa).
-- ---------------------------------------------------------------
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
    FROM contabilidad._importes_transferencia(o.moneda, d.moneda, p_fecha, p_monto_origen, v_destino);

  v_lineas := jsonb_build_array(
    jsonb_build_object('cuenta_id', d.cuenta_contable_id, 'debe',  i.dop_destino),
    jsonb_build_object('cuenta_id', o.cuenta_contable_id, 'haber', i.dop_origen));

  IF i.diferencia > 0 THEN
    v_lineas := v_lineas || contabilidad.linea_por_codigo(
      'BAN_TRANSFER_GANANCIA_CAMBIARIA', i.diferencia, 'Diferencia cambiaria');
  ELSIF i.diferencia < 0 THEN
    v_lineas := v_lineas || contabilidad.linea_por_codigo(
      'BAN_TRANSFER_PERDIDA_CAMBIARIA', -i.diferencia, 'Diferencia cambiaria');
  END IF;

  RETURN v_lineas;
END;
$$;

-- ---------------------------------------------------------------
-- transferir: igual que antes (0036/0107), pero las líneas del asiento
-- salen de lineas_transferencia.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION contabilidad.transferir(
  p_origen uuid, p_destino uuid, p_fecha date,
  p_monto_origen numeric, p_monto_destino numeric,
  p_concepto text, p_referencia text
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  o          contabilidad.cuenta_bancaria%ROWTYPE;
  d          contabilidad.cuenta_bancaria%ROWTYPE;
  v_destino  numeric(14,2) := coalesce(p_monto_destino, p_monto_origen);
  i          record;
  v_aplicada numeric(12,4);
  v_periodo  uuid := contabilidad.periodo_para(p_fecha);
  v_id       uuid := gen_random_uuid();
  v_numero   bigint := contabilidad.siguiente_numero('TR');
  v_salida   uuid;
  v_entrada  uuid;
  v_asiento  uuid;
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
    FROM contabilidad._importes_transferencia(o.moneda, d.moneda, p_fecha, p_monto_origen, v_destino);

  IF o.moneda <> d.moneda THEN
    v_aplicada := CASE o.moneda WHEN 'DOP' THEN round(p_monto_origen / v_destino, 4)
                                ELSE round(v_destino / p_monto_origen, 4) END;
  END IF;

  INSERT INTO contabilidad.movimiento_bancario
         (numero, cuenta_id, periodo_id, fecha, tipo, monto, moneda, tasa, monto_dop,
          concepto, referencia, origen_tabla, origen_id, creado_por)
  VALUES (contabilidad.siguiente_numero('MB'), o.id, v_periodo, p_fecha, 'transferencia_enviada',
          p_monto_origen, o.moneda, CASE o.moneda WHEN 'USD' THEN i.tasa_referencia END, i.dop_origen,
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
    contabilidad.lineas_transferencia(p_origen, p_destino, p_fecha, p_monto_origen, v_destino));

  INSERT INTO contabilidad.transferencia_interna
         (id, numero, fecha, periodo_id, cuenta_origen_id, cuenta_destino_id,
          monto_origen, monto_destino, tasa_aplicada, tasa_referencia, diferencia_cambiaria,
          concepto, referencia, movimiento_salida_id, movimiento_entrada_id, asiento_id, creado_por)
  VALUES (v_id, v_numero, p_fecha, v_periodo, o.id, d.id,
          p_monto_origen, v_destino, v_aplicada, i.tasa_referencia, i.diferencia,
          p_concepto, p_referencia, v_salida, v_entrada, v_asiento, contabilidad._usuario_actual());

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------
-- Líneas de un recibo: banco (cuenta contable de la cuenta bancaria elegida)
-- contra la contrapartida (la fijada en el recibo o, si no, la de su
-- categoría). Ingreso: débito al banco; egreso: crédito al banco. No hay
-- códigos: ambas cuentas las eligió la persona.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION contabilidad.lineas_recibo(p_recibo uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  r           contabilidad.recibo%ROWTYPE;
  v_cuenta    contabilidad.cuenta_bancaria%ROWTYPE;
  v_contra    uuid;
  v_monto_dop numeric(14,2);
BEGIN
  SELECT * INTO r FROM contabilidad.recibo WHERE id = p_recibo;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contabilidad: recibo % no existe', p_recibo;
  END IF;
  SELECT * INTO v_cuenta FROM contabilidad.cuenta_bancaria WHERE id = r.cuenta_bancaria_id;

  v_contra := coalesce(r.cuenta_contrapartida_id,
                       (SELECT cuenta_id FROM contabilidad.categoria WHERE id = r.categoria_id));
  IF v_contra IS NULL THEN
    RAISE EXCEPTION 'contabilidad: la categoría del recibo no tiene cuenta contable asignada';
  END IF;

  v_monto_dop := CASE r.moneda WHEN 'DOP' THEN r.monto ELSE round(r.monto * r.tasa, 2) END;

  RETURN CASE r.tipo
    WHEN 'ingreso' THEN jsonb_build_array(
      jsonb_build_object('cuenta_id', v_cuenta.cuenta_contable_id, 'debe', v_monto_dop),
      jsonb_build_object('cuenta_id', v_contra, 'haber', v_monto_dop))
    ELSE jsonb_build_array(
      jsonb_build_object('cuenta_id', v_contra, 'debe', v_monto_dop),
      jsonb_build_object('cuenta_id', v_cuenta.cuenta_contable_id, 'haber', v_monto_dop))
  END;
END;
$$;

-- ---------------------------------------------------------------
-- contabilizar_recibo: igual que antes (0036); el asiento sale de
-- lineas_recibo.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION contabilidad.contabilizar_recibo(p_recibo uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r          contabilidad.recibo%ROWTYPE;
  v_cuenta   contabilidad.cuenta_bancaria%ROWTYPE;
  v_contra   uuid;
  v_tipo_mov text;
  v_monto_dop numeric(14,2);
  v_mov      uuid;
  v_asiento  uuid;
  v_serie    text;
BEGIN
  SELECT * INTO r FROM contabilidad.recibo WHERE id = p_recibo FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contabilidad: recibo % no existe', p_recibo;
  END IF;
  IF r.estado <> 'borrador' THEN
    RAISE EXCEPTION 'contabilidad: solo se contabiliza un borrador (este está %)', r.estado;
  END IF;

  SELECT * INTO v_cuenta FROM contabilidad.cuenta_bancaria WHERE id = r.cuenta_bancaria_id;
  IF v_cuenta.estado <> 'activa' THEN
    RAISE EXCEPTION 'contabilidad: la cuenta % está cerrada', v_cuenta.nombre;
  END IF;
  IF v_cuenta.moneda <> r.moneda THEN
    RAISE EXCEPTION 'contabilidad: el recibo es en % y la cuenta % lleva %',
      r.moneda, v_cuenta.nombre, v_cuenta.moneda;
  END IF;

  v_contra := coalesce(r.cuenta_contrapartida_id,
                       (SELECT cuenta_id FROM contabilidad.categoria WHERE id = r.categoria_id));
  IF v_contra IS NULL THEN
    RAISE EXCEPTION 'contabilidad: la categoría del recibo no tiene cuenta contable asignada';
  END IF;

  v_monto_dop := CASE r.moneda WHEN 'DOP' THEN r.monto ELSE round(r.monto * r.tasa, 2) END;

  v_tipo_mov := CASE
    WHEN r.tipo = 'ingreso' AND r.forma_pago = 'transferencia' THEN 'transferencia_recibida'
    WHEN r.tipo = 'ingreso' THEN 'deposito'
    WHEN r.forma_pago = 'cheque' THEN 'cheque'
    WHEN r.forma_pago = 'transferencia' THEN 'transferencia_enviada'
    ELSE 'debito'
  END;
  v_serie := CASE r.tipo WHEN 'ingreso' THEN 'RI' ELSE 'CE' END;

  INSERT INTO contabilidad.movimiento_bancario
         (numero, cuenta_id, periodo_id, fecha, tipo, monto, moneda, tasa, monto_dop,
          concepto, referencia, beneficiario, cheque_numero, estado_cheque,
          origen_tabla, origen_id, creado_por)
  VALUES (contabilidad.siguiente_numero('MB'), r.cuenta_bancaria_id, r.periodo_id, r.fecha,
          v_tipo_mov, r.monto, r.moneda, r.tasa, v_monto_dop,
          r.concepto, r.referencia, r.beneficiario,
          CASE WHEN v_tipo_mov = 'cheque' THEN contabilidad.siguiente_numero('CH') END,
          CASE WHEN v_tipo_mov = 'cheque' THEN 'emitido' END,
          'recibo', r.id, contabilidad._usuario_actual())
  RETURNING id INTO v_mov;

  v_asiento := contabilidad.crear_asiento(
    r.fecha, v_serie || '-' || r.numero || ' ' || r.concepto, 'automatico', 'recibo', r.id,
    contabilidad.lineas_recibo(r.id));

  PERFORM set_config('app.accion', 'aprobar', true);
  UPDATE contabilidad.recibo
     SET estado = 'contabilizado', monto_dop = v_monto_dop,
         movimiento_id = v_mov, asiento_id = v_asiento,
         contabilizado_por = contabilidad._usuario_actual(), contabilizado_en = now()
   WHERE id = r.id;
  PERFORM set_config('app.accion', '', true);
END;
$$;
