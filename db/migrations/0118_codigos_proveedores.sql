-- Facturas y pagos a proveedores por códigos de transacción.
--
-- Hasta la 0107 `aprobar_factura` y `pagar_cxp` buscaban las cuentas por su
-- código literal (2.1.01.01 proveedores, 2.1.02.03 ISR retenido, 2.1.02.02
-- ITBIS retenido). El catálogo vigente de 88 cuentas (Excel) no tiene ninguna
-- de las tres: 2.1.1 «Cuentas por Pagar Proveedores» es agrupadora y sin
-- hijas, y no hay cuentas de retenciones de ISR/ITBIS. Por eso aprobar una
-- factura y pagar a un proveedor fallaban siempre.
--
-- Ahora cada línea sale de un código de transacción (src/lib/contabilidad/
-- codigos/grupo-proveedores.ts) y la contadora decide su cuenta en el
-- Catálogo. NO se siembra ninguna asignación: el catálogo no tiene cuenta
-- equivalente y no se inventan cuentas. Mientras no se asignen, el proceso
-- falla con `codigo_sin_cuenta:CODIGO` y el botón «Asiento» dice cuál falta.
--
-- Cada proceso queda en una función pura `lineas_*` (vista previa y asiento
-- real salen del MISMO cálculo). La reversa (`anular_factura` →
-- `revertir_asiento`) espeja el asiento original y no cambia.
-- Idempotente: solo CREATE OR REPLACE.

-- Agrega una línea por código a `p_lineas`. Un monto en cero no genera línea
-- (así una factura sin retenciones no exige las cuentas de retención, igual que
-- `crear_asiento` descarta las líneas en cero). Con `p_previa` un código sin
-- cuenta no lanza: devuelve la línea sin cuenta y marca el `problema`, para que
-- «Asiento» muestre TODO lo que falta de una vez y no solo lo primero.
CREATE OR REPLACE FUNCTION contabilidad._agregar_linea_codigo(
  p_lineas      jsonb,
  p_codigo      text,
  p_naturaleza  text,
  p_monto       numeric,
  p_descripcion text,
  p_previa      boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_linea    jsonb;
  v_natural  text;
  v_problema text;
BEGIN
  IF coalesce(p_monto, 0) = 0 THEN
    RETURN p_lineas;
  END IF;
  BEGIN
    v_linea := contabilidad.linea_por_codigo(p_codigo, p_monto, p_descripcion);
  EXCEPTION WHEN OTHERS THEN
    IF NOT p_previa THEN
      RAISE;
    END IF;
    v_problema := CASE WHEN SQLERRM LIKE 'cuenta_no_valida:%' THEN 'cuenta_no_valida'
                       WHEN SQLERRM LIKE 'monto_invalido:%'   THEN 'monto_invalido'
                       ELSE 'codigo_sin_cuenta' END;
    -- El lado configurado manda aunque aún no haya cuenta.
    SELECT t.naturaleza INTO v_natural FROM contabilidad.codigo_transaccion t WHERE t.codigo = p_codigo;
    v_natural := coalesce(v_natural, p_naturaleza);
    v_linea := jsonb_build_object(
      'cuenta_id', NULL,
      'debe',  CASE WHEN v_natural = 'debito'  THEN abs(p_monto) ELSE 0 END,
      'haber', CASE WHEN v_natural = 'credito' THEN abs(p_monto) ELSE 0 END,
      'descripcion', p_descripcion,
      'codigo', p_codigo,
      'problema', v_problema);
  END;
  RETURN p_lineas || jsonb_build_array(v_linea);
END;
$$;

-- Cuenta de un código cuando el lado lo decide otro proceso (el recibo de
-- egreso siempre carga la contrapartida al débito). Lanza lo mismo que
-- `linea_por_codigo`.
CREATE OR REPLACE FUNCTION contabilidad._cuenta_de_codigo(p_codigo text)
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT (contabilidad.linea_por_codigo(p_codigo, 1, NULL) ->> 'cuenta_id')::uuid;
$$;

-- Concepto del asiento de una factura aprobada (lo comparten el asiento real y
-- la vista previa).
CREATE OR REPLACE FUNCTION contabilidad.concepto_asiento_factura(p_factura uuid)
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT 'FP-' || f.numero || ' ' || p.nombre || coalesce(' ' || f.ncf, '')
    FROM contabilidad.factura_proveedor f
    JOIN contabilidad.proveedor p ON p.id = f.proveedor_id
   WHERE f.id = p_factura;
$$;

-- Líneas del asiento de aprobar una factura: el gasto (cuenta de la categoría,
-- elegida por quien registra) contra proveedores y retenciones, que salen de
-- códigos. Mismas líneas, orden y descripciones que antes de la 0118.
CREATE OR REPLACE FUNCTION contabilidad.lineas_aprobar_factura(
  p_factura uuid,
  p_previa  boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  f       contabilidad.factura_proveedor%ROWTYPE;
  v_prov  contabilidad.proveedor%ROWTYPE;
  v_gasto uuid;
  v_t     numeric := 1;
  v_total numeric(14,2);
  v_isr   numeric(14,2);
  v_itbis numeric(14,2);
  v_lin   jsonb;
BEGIN
  SELECT * INTO f FROM contabilidad.factura_proveedor WHERE id = p_factura;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contabilidad: la factura no existe';
  END IF;
  SELECT * INTO v_prov FROM contabilidad.proveedor WHERE id = f.proveedor_id;
  SELECT cuenta_id INTO v_gasto FROM contabilidad.categoria WHERE id = f.categoria_id;
  IF v_gasto IS NULL AND NOT p_previa THEN
    RAISE EXCEPTION 'contabilidad: la categoría de la factura no tiene cuenta contable asignada';
  END IF;

  IF f.moneda = 'USD' THEN v_t := f.tasa; END IF;
  v_total := round(f.total * v_t, 2);
  v_isr   := round(f.retencion_isr * v_t, 2);
  v_itbis := round(f.retencion_itbis * v_t, 2);

  v_lin := jsonb_build_array(
    jsonb_build_object('cuenta_id', v_gasto, 'debe', v_total,
                       'problema', CASE WHEN v_gasto IS NULL THEN 'categoria_sin_cuenta' END));
  v_lin := contabilidad._agregar_linea_codigo(v_lin, 'PROV_CXP_FACTURA', 'credito',
             v_total - v_isr - v_itbis, v_prov.nombre, p_previa);
  v_lin := contabilidad._agregar_linea_codigo(v_lin, 'PROV_ISR_RETENIDO_X_PAGAR', 'credito',
             v_isr, 'Retención ISR', p_previa);
  v_lin := contabilidad._agregar_linea_codigo(v_lin, 'PROV_ITBIS_RETENIDO_X_PAGAR', 'credito',
             v_itbis, 'Retención ITBIS', p_previa);
  RETURN v_lin;
END;
$$;

CREATE OR REPLACE FUNCTION contabilidad.aprobar_factura(p_factura uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  f         contabilidad.factura_proveedor%ROWTYPE;
  v_asiento uuid;
  v_cxp     uuid;
BEGIN
  SELECT * INTO f FROM contabilidad.factura_proveedor WHERE id = p_factura FOR UPDATE;
  IF NOT FOUND OR f.estado <> 'borrador' THEN
    RAISE EXCEPTION 'contabilidad: solo se aprueba una factura en borrador';
  END IF;

  v_asiento := contabilidad.crear_asiento(
    f.fecha_emision,
    contabilidad.concepto_asiento_factura(f.id),
    'automatico', 'factura_proveedor', f.id,
    contabilidad.lineas_aprobar_factura(f.id));

  INSERT INTO contabilidad.cuenta_por_pagar
         (origen, factura_id, proveedor_id, concepto, moneda, monto, fecha_emision,
          fecha_vencimiento, categoria_id, fondo_id, proyecto_id, creado_por)
  VALUES ('factura', f.id, f.proveedor_id, f.concepto, f.moneda, f.neto, f.fecha_emision,
          f.fecha_vencimiento, f.categoria_id, f.fondo_id, f.proyecto_id, contabilidad._usuario_actual())
  RETURNING id INTO v_cxp;

  PERFORM set_config('app.accion', 'aprobar', true);
  UPDATE contabilidad.factura_proveedor
     SET estado = 'aprobada', asiento_id = v_asiento, cuenta_por_pagar_id = v_cxp,
         aprobado_por = contabilidad._usuario_actual(), aprobado_en = now()
   WHERE id = f.id;
  PERFORM set_config('app.accion', '', true);

  RETURN v_cxp;
END;
$$;

-- Líneas del asiento de pagar una cuenta por pagar. El asiento real lo escribe
-- `contabilizar_recibo` (recibo de egreso): contrapartida al débito y banco al
-- crédito, en pesos. Esta función arma lo mismo para la vista previa, antes de
-- que exista el recibo. La contrapartida es el código PROV_PAGO_CXP cuando la
-- deuda nació de una factura (siempre al débito, igual que el recibo) y la
-- cuenta de la categoría cuando nació de una solicitud (compromiso → gasto).
CREATE OR REPLACE FUNCTION contabilidad.lineas_pago_cxp(
  p_cxp     uuid,
  p_cuenta  uuid,
  p_monto   numeric,
  p_tasa    numeric,
  p_previa  boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  c        contabilidad.cuenta_por_pagar%ROWTYPE;
  v_banco  contabilidad.cuenta_bancaria%ROWTYPE;
  v_dop    numeric(14,2);
  v_contra uuid;
  v_prob   text;
  v_lin    jsonb;
BEGIN
  SELECT * INTO c FROM contabilidad.cuenta_por_pagar WHERE id = p_cxp;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contabilidad: la cuenta por pagar no existe';
  END IF;
  SELECT * INTO v_banco FROM contabilidad.cuenta_bancaria WHERE id = p_cuenta;
  IF c.moneda = 'USD' AND p_tasa IS NULL THEN
    RAISE EXCEPTION 'contabilidad: falta la tasa de cambio del pago';
  END IF;
  v_dop := CASE c.moneda WHEN 'DOP' THEN p_monto ELSE round(p_monto * p_tasa, 2) END;

  IF c.origen = 'factura' THEN
    BEGIN
      v_contra := contabilidad._cuenta_de_codigo('PROV_PAGO_CXP');
    EXCEPTION WHEN OTHERS THEN
      IF NOT p_previa THEN RAISE; END IF;
      v_prob := CASE WHEN SQLERRM LIKE 'cuenta_no_valida:%' THEN 'cuenta_no_valida' ELSE 'codigo_sin_cuenta' END;
    END;
  ELSE
    SELECT cuenta_id INTO v_contra FROM contabilidad.categoria WHERE id = c.categoria_id;
    IF v_contra IS NULL THEN
      IF NOT p_previa THEN
        RAISE EXCEPTION 'contabilidad: la categoría del recibo no tiene cuenta contable asignada';
      END IF;
      v_prob := 'categoria_sin_cuenta';
    END IF;
  END IF;

  v_lin := jsonb_build_array(
    jsonb_build_object('cuenta_id', v_contra, 'debe', v_dop,
                       'codigo', CASE WHEN c.origen = 'factura' THEN 'PROV_PAGO_CXP' END,
                       'problema', v_prob),
    jsonb_build_object('cuenta_id', v_banco.cuenta_contable_id, 'haber', v_dop));
  RETURN v_lin;
END;
$$;

-- Igual que antes salvo que la contrapartida de una deuda de factura sale del
-- código PROV_PAGO_CXP y no de la cuenta literal 2.1.01.01.
CREATE OR REPLACE FUNCTION contabilidad.pagar_cxp(
  p_cxp uuid, p_cuenta uuid, p_fecha date, p_monto numeric,
  p_forma text, p_referencia text, p_tasa numeric
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  c        contabilidad.cuenta_por_pagar%ROWTYPE;
  v_banco  contabilidad.cuenta_bancaria%ROWTYPE;
  v_prov   contabilidad.proveedor%ROWTYPE;
  v_recibo uuid;
  v_pago   uuid;
  v_cambio timestamptz;
BEGIN
  SELECT * INTO c FROM contabilidad.cuenta_por_pagar WHERE id = p_cxp FOR UPDATE;
  IF NOT FOUND OR c.estado IN ('pagada', 'anulada') THEN
    RAISE EXCEPTION 'contabilidad: la cuenta por pagar no admite pagos (está %)', c.estado;
  END IF;
  IF p_monto <= 0 OR p_monto > c.saldo THEN
    RAISE EXCEPTION 'contabilidad: el pago supera el saldo pendiente (%)', c.saldo;
  END IF;

  SELECT * INTO v_banco FROM contabilidad.cuenta_bancaria WHERE id = p_cuenta;
  IF v_banco.moneda <> c.moneda THEN
    RAISE EXCEPTION 'contabilidad: la deuda es en % y la cuenta de salida en %', c.moneda, v_banco.moneda;
  END IF;
  IF c.moneda = 'USD' AND p_tasa IS NULL THEN
    RAISE EXCEPTION 'contabilidad: falta la tasa de cambio del pago';
  END IF;

  IF c.proveedor_id IS NOT NULL THEN
    SELECT * INTO v_prov FROM contabilidad.proveedor WHERE id = c.proveedor_id;
  END IF;

  INSERT INTO contabilidad.recibo
         (tipo, numero, fecha, periodo_id, cuenta_bancaria_id, moneda, tasa, monto, concepto,
          categoria_id, fondo_id, proyecto_id, beneficiario, forma_pago, referencia,
          cuenta_contrapartida_id, proveedor_id, cuenta_por_pagar_id, creado_por)
  VALUES ('egreso', contabilidad.siguiente_numero('CE'), p_fecha, contabilidad.periodo_para(p_fecha),
          p_cuenta, c.moneda, CASE c.moneda WHEN 'USD' THEN p_tasa END, p_monto,
          'Pago: ' || c.concepto, c.categoria_id, c.fondo_id, c.proyecto_id,
          coalesce(v_prov.nombre, c.beneficiario), p_forma, p_referencia,
          -- Deuda devengada (factura) → código de proveedores; compromiso
          -- (solicitud) → gasto de la categoría (la toma el recibo).
          CASE c.origen WHEN 'factura'
               THEN contabilidad._cuenta_de_codigo('PROV_PAGO_CXP') END,
          c.proveedor_id, c.id, contabilidad._usuario_actual())
  RETURNING id INTO v_recibo;

  PERFORM contabilidad.contabilizar_recibo(v_recibo);

  INSERT INTO contabilidad.pago
         (numero, cuenta_por_pagar_id, fecha, periodo_id, monto, cuenta_bancaria_id,
          recibo_id, movimiento_id, creado_por)
  VALUES (contabilidad.siguiente_numero('PG'), c.id, p_fecha, contabilidad.periodo_para(p_fecha),
          p_monto, p_cuenta, v_recibo,
          (SELECT movimiento_id FROM contabilidad.recibo WHERE id = v_recibo),
          contabilidad._usuario_actual())
  RETURNING id INTO v_pago;

  PERFORM set_config('app.accion', 'pagar', true);
  UPDATE contabilidad.cuenta_por_pagar
     SET pagado = pagado + p_monto,
         estado = CASE WHEN pagado + p_monto = monto THEN 'pagada' ELSE 'pagada_parcial' END
   WHERE id = c.id;
  PERFORM set_config('app.accion', '', true);

  -- §3.7: cuenta del proveedor cambiada hace menos de 7 días y ya se le
  -- paga. No bloquea (el cambio puede ser legítimo), pero lo ve el auditor.
  IF c.proveedor_id IS NOT NULL THEN
    SELECT max(creado_en) INTO v_cambio
      FROM contabilidad.proveedor_cuenta_bancaria
     WHERE proveedor_id = c.proveedor_id AND reemplazada_en IS NULL
       AND creado_en > now() - interval '7 days'
       AND EXISTS (SELECT 1 FROM contabilidad.proveedor_cuenta_bancaria a
                    WHERE a.proveedor_id = c.proveedor_id AND a.reemplazada_en IS NOT NULL);
    IF v_cambio IS NOT NULL THEN
      INSERT INTO contabilidad.alerta (tipo, severidad, tabla, registro_id, detalle)
      VALUES ('cambio_cuenta_y_pago', 'alta', 'pago', v_pago,
              jsonb_build_object('proveedor', v_prov.nombre, 'cuenta_cambiada_en', v_cambio,
                                 'monto', p_monto, 'moneda', c.moneda));
    END IF;
  END IF;

  RETURN v_pago;
END;
$$;
