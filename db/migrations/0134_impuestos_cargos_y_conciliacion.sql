-- ================================================================
-- PORTAL GLOBALEFFECT — 0134 · Impuestos y Cargos, Reglas legales y Conciliación
-- ================================================================
-- 1. Crea `contabilidad.impuesto_cargo` (Impuestos y Cargos en Parámetros
--    legales) y siembra las dos opciones iniciales:
--      · "Impuesto por transferencia 0.20%" (fijo, porcentaje, 0.20,
--        transferencia, cuenta 5.2.3.4.1)
--      · "Comisiones bancarias" (variable, transferencia, cuenta 5.2.3.4.2)
-- 2. Crea `contabilidad.regla_legal` (lista Reglas legales en Parámetros).
-- 3. Actualiza `lineas_recibo`, `contabilizar_recibo` y `lineas_pago_cxp`:
--    al pagar una factura (CxP) con forma de pago `transferencia`, incluye
--    automáticamente en el asiento y libro de banco cada impuesto/cargo
--    activo con `tipo_valor = 'fijo'` y `proposito = 'transferencia'`.
--
-- Idempotente. Aplicar como rol `postgres`.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario
                    WHERE email IN ('sistema@globaleffect.org', 'admin@globaleffect.org')
                    ORDER BY (email = 'sistema@globaleffect.org') DESC LIMIT 1),
                  true),
       set_config('app.agente', '0134_impuestos_cargos_y_conciliacion.sql', true);

-- 1) Tabla Impuestos y Cargos
CREATE TABLE IF NOT EXISTS contabilidad.impuesto_cargo (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         text NOT NULL UNIQUE,
  tipo_valor     text NOT NULL CHECK (tipo_valor IN ('fijo', 'variable')),
  formato_valor  text CHECK (formato_valor IS NULL OR formato_valor IN ('numero', 'porcentaje')),
  valor          numeric(14,4) CHECK (valor IS NULL OR valor >= 0),
  proposito      text NOT NULL CHECK (proposito IN ('transferencia', 'nomina')),
  cuenta_id      uuid NOT NULL REFERENCES contabilidad.cuenta_contable(id),
  activo         boolean NOT NULL DEFAULT true,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_impuesto_cargo_fijo_requiere_valor CHECK (
    tipo_valor = 'variable'
    OR (formato_valor IS NOT NULL AND valor IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_impuesto_cargo_activo_proposito
  ON contabilidad.impuesto_cargo (activo, proposito, tipo_valor);

COMMENT ON TABLE contabilidad.impuesto_cargo IS
  'Impuestos y cargos configurables (Parámetros legales) usados en pagos por transferencia, nómina y conciliación bancaria.';

ALTER TABLE contabilidad.impuesto_cargo ENABLE ROW LEVEL SECURITY;
SELECT contabilidad.auditar_tabla('contabilidad.impuesto_cargo'::regclass);

-- Semilla inicial: Impuesto por transferencia 0.20% (5.2.3.4.1) y Comisiones bancarias (5.2.3.4.2)
INSERT INTO contabilidad.impuesto_cargo (nombre, tipo_valor, formato_valor, valor, proposito, cuenta_id, activo)
SELECT 'Impuesto por transferencia 0.20%', 'fijo', 'porcentaje', 0.20, 'transferencia', c.id, true
  FROM contabilidad.cuenta_contable c
 WHERE c.codigo = '5.2.3.4.1' AND c.admite_movimiento AND c.activa
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO contabilidad.impuesto_cargo (nombre, tipo_valor, formato_valor, valor, proposito, cuenta_id, activo)
SELECT 'Comisiones bancarias', 'variable', NULL, NULL, 'transferencia', c.id, true
  FROM contabilidad.cuenta_contable c
 WHERE c.codigo = '5.2.3.4.2' AND c.admite_movimiento AND c.activa
ON CONFLICT (nombre) DO NOTHING;

-- 2) Tabla Reglas legales
CREATE TABLE IF NOT EXISTS contabilidad.regla_legal (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         text NOT NULL UNIQUE,
  valor          text,
  descripcion    text,
  activo         boolean NOT NULL DEFAULT true,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE contabilidad.regla_legal IS
  'Reglas legales configurables en Parámetros legales de Contabilidad.';

ALTER TABLE contabilidad.regla_legal ENABLE ROW LEVEL SECURITY;
SELECT contabilidad.auditar_tabla('contabilidad.regla_legal'::regclass);

-- 3) Helper interno: calcula el monto en DOP de un impuesto/cargo fijo sobre un importe base DOP
CREATE OR REPLACE FUNCTION contabilidad._monto_impuesto_cargo(
  p_monto_base    numeric,
  p_formato_valor text,
  p_valor         numeric
) RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_formato_valor
    WHEN 'porcentaje' THEN round(p_monto_base * (p_valor / 100.0), 2)
    ELSE round(p_valor, 2)
  END;
$$;

-- 4) Actualizar lineas_recibo: cuando el recibo es pago de factura (CxP) por
--    transferencia, agrega al asiento los impuestos/cargos fijos de transferencia.
CREATE OR REPLACE FUNCTION contabilidad.lineas_recibo(p_recibo uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  r           contabilidad.recibo%ROWTYPE;
  v_cuenta    contabilidad.cuenta_bancaria%ROWTYPE;
  v_contra    uuid;
  v_monto_dop numeric(14,2);
  v_lineas    jsonb;
  ic          record;
  v_cargo_dop numeric(14,2);
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

  v_lineas := CASE r.tipo
    WHEN 'ingreso' THEN jsonb_build_array(
      jsonb_build_object('cuenta_id', v_cuenta.cuenta_contable_id, 'debe', v_monto_dop),
      jsonb_build_object('cuenta_id', v_contra, 'haber', v_monto_dop))
    ELSE jsonb_build_array(
      jsonb_build_object('cuenta_id', v_contra, 'debe', v_monto_dop),
      jsonb_build_object('cuenta_id', v_cuenta.cuenta_contable_id, 'haber', v_monto_dop))
  END;

  IF r.tipo = 'egreso' AND r.cuenta_por_pagar_id IS NOT NULL AND r.forma_pago = 'transferencia' THEN
    FOR ic IN
      SELECT c.nombre, c.formato_valor, c.valor, c.cuenta_id
        FROM contabilidad.impuesto_cargo c
        JOIN contabilidad.cuenta_contable cc ON cc.id = c.cuenta_id
       WHERE c.activo = true
         AND c.tipo_valor = 'fijo'
         AND c.proposito = 'transferencia'
         AND c.valor IS NOT NULL
         AND c.valor > 0
         AND cc.admite_movimiento = true
         AND cc.activa = true
       ORDER BY c.creado_en, c.nombre
    LOOP
      v_cargo_dop := contabilidad._monto_impuesto_cargo(v_monto_dop, ic.formato_valor, ic.valor);
      IF v_cargo_dop > 0 THEN
        v_lineas := v_lineas || jsonb_build_array(
          jsonb_build_object('cuenta_id', ic.cuenta_id, 'debe', v_cargo_dop, 'descripcion', ic.nombre),
          jsonb_build_object('cuenta_id', v_cuenta.cuenta_contable_id, 'haber', v_cargo_dop, 'descripcion', ic.nombre)
        );
      END IF;
    END LOOP;
  END IF;

  RETURN v_lineas;
END;
$$;

-- 5) Actualizar contabilizar_recibo: también registra el débito bancario de los
--    impuestos/cargos fijos por transferencia al pagar facturas para que el
--    balance del banco cuadre con el libro diario.
CREATE OR REPLACE FUNCTION contabilidad.contabilizar_recibo(p_recibo uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r              contabilidad.recibo%ROWTYPE;
  v_cuenta       contabilidad.cuenta_bancaria%ROWTYPE;
  v_contra       uuid;
  v_tipo_mov     text;
  v_monto_dop    numeric(14,2);
  v_mov          uuid;
  v_asiento      uuid;
  v_serie        text;
  ic             record;
  v_cargo_dop    numeric(14,2);
  v_cargo_moneda numeric(14,2);
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

  -- Si es pago de factura (CxP) por transferencia, registrar también el débito
  -- de los impuestos/cargos fijos configurados para transferencia.
  IF r.tipo = 'egreso' AND r.cuenta_por_pagar_id IS NOT NULL AND r.forma_pago = 'transferencia' THEN
    FOR ic IN
      SELECT c.nombre, c.formato_valor, c.valor, c.cuenta_id
        FROM contabilidad.impuesto_cargo c
        JOIN contabilidad.cuenta_contable cc ON cc.id = c.cuenta_id
       WHERE c.activo = true
         AND c.tipo_valor = 'fijo'
         AND c.proposito = 'transferencia'
         AND c.valor IS NOT NULL
         AND c.valor > 0
         AND cc.admite_movimiento = true
         AND cc.activa = true
       ORDER BY c.creado_en, c.nombre
    LOOP
      v_cargo_dop := contabilidad._monto_impuesto_cargo(v_monto_dop, ic.formato_valor, ic.valor);
      IF v_cargo_dop > 0 THEN
        v_cargo_moneda := CASE r.moneda
          WHEN 'DOP' THEN v_cargo_dop
          ELSE CASE ic.formato_valor
            WHEN 'porcentaje' THEN round(r.monto * (ic.valor / 100.0), 2)
            ELSE round(v_cargo_dop / r.tasa, 2)
          END
        END;
        INSERT INTO contabilidad.movimiento_bancario
               (numero, cuenta_id, periodo_id, fecha, tipo, monto, moneda, tasa, monto_dop,
                concepto, referencia, beneficiario, origen_tabla, origen_id, creado_por)
        VALUES (contabilidad.siguiente_numero('MB'), r.cuenta_bancaria_id, r.periodo_id, r.fecha,
                'debito', v_cargo_moneda, r.moneda, r.tasa, v_cargo_dop,
                ic.nombre || ' · ' || r.concepto, r.referencia, r.beneficiario,
                'recibo', r.id, contabilidad._usuario_actual());
      END IF;
    END LOOP;
  END IF;

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

-- 6) Actualizar lineas_pago_cxp para que la vista previa («Asiento») coincida
--    exactamente con el asiento real según la forma de pago elegida.
DROP FUNCTION IF EXISTS contabilidad.lineas_pago_cxp(uuid, uuid, numeric, numeric, boolean);
DROP FUNCTION IF EXISTS contabilidad.lineas_pago_cxp(uuid, uuid, numeric, numeric, boolean, text);

CREATE OR REPLACE FUNCTION contabilidad.lineas_pago_cxp(
  p_cxp     uuid,
  p_cuenta  uuid,
  p_monto   numeric,
  p_tasa    numeric,
  p_previa  boolean DEFAULT false,
  p_forma   text DEFAULT 'transferencia'
) RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  c           contabilidad.cuenta_por_pagar%ROWTYPE;
  v_banco     contabilidad.cuenta_bancaria%ROWTYPE;
  v_dop       numeric(14,2);
  v_contra    uuid;
  v_prob      text;
  v_lin       jsonb;
  ic          record;
  v_cargo_dop numeric(14,2);
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

  IF coalesce(p_forma, 'transferencia') = 'transferencia' THEN
    FOR ic IN
      SELECT x.nombre, x.formato_valor, x.valor, x.cuenta_id
        FROM contabilidad.impuesto_cargo x
        JOIN contabilidad.cuenta_contable cc ON cc.id = x.cuenta_id
       WHERE x.activo = true
         AND x.tipo_valor = 'fijo'
         AND x.proposito = 'transferencia'
         AND x.valor IS NOT NULL
         AND x.valor > 0
         AND cc.admite_movimiento = true
         AND cc.activa = true
       ORDER BY x.creado_en, x.nombre
    LOOP
      v_cargo_dop := contabilidad._monto_impuesto_cargo(v_dop, ic.formato_valor, ic.valor);
      IF v_cargo_dop > 0 THEN
        v_lin := v_lin || jsonb_build_array(
          jsonb_build_object('cuenta_id', ic.cuenta_id, 'debe', v_cargo_dop, 'descripcion', ic.nombre),
          jsonb_build_object('cuenta_id', v_banco.cuenta_contable_id, 'haber', v_cargo_dop, 'descripcion', ic.nombre)
        );
      END IF;
    END LOOP;
  END IF;

  RETURN v_lin;
END;
$$;
