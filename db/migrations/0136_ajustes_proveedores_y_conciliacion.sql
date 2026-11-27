-- ================================================================
-- PORTAL GLOBALEFFECT — 0136 · Ajustes en proveedores y cuentas bancarias
-- ================================================================
-- 1. Actualiza el CHECK `proveedor_identificacion_formato` para admitir tanto
--    RNC (9 dígitos) como cédula (11 dígitos) en proveedores formales e
--    informales (en RD un contribuyente formal ante la DGII puede operar con
--    su cédula de 11 dígitos, p. ej. 12200023039).
-- 2. Agrega la columna `identificacion` (RNC o Cédula) a
--    `contabilidad.proveedor_cuenta_bancaria` y actualiza
--    `contabilidad.cambiar_cuenta_proveedor` para guardarla.
--
-- Idempotente. Aplicar como rol `postgres`.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario
                    WHERE email IN ('sistema@globaleffect.org', 'admin@globaleffect.org')
                    ORDER BY (email = 'sistema@globaleffect.org') DESC LIMIT 1),
                  true),
       set_config('app.agente', '0136_ajustes_proveedores_y_conciliacion.sql', true);

-- 1) Permitir RNC (9 dígitos) o cédula (11 dígitos) en cualquier tipo de proveedor
ALTER TABLE contabilidad.proveedor
  DROP CONSTRAINT IF EXISTS proveedor_identificacion_formato;

ALTER TABLE contabilidad.proveedor
  ADD CONSTRAINT proveedor_identificacion_formato
  CHECK (identificacion ~ '^[0-9]{9}$' OR identificacion ~ '^[0-9]{11}$');

-- 2) RNC o Cédula en cuentas bancarias de proveedor
ALTER TABLE contabilidad.proveedor_cuenta_bancaria
  ADD COLUMN IF NOT EXISTS identificacion text;

COMMENT ON COLUMN contabilidad.proveedor_cuenta_bancaria.identificacion IS
  'RNC (9 dígitos) o cédula (11 dígitos) del titular de la cuenta bancaria del proveedor.';

DROP FUNCTION IF EXISTS contabilidad.cambiar_cuenta_proveedor(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS contabilidad.cambiar_cuenta_proveedor(uuid, text, text, text, text, text);

CREATE OR REPLACE FUNCTION contabilidad.cambiar_cuenta_proveedor(
  p_proveedor      uuid,
  p_banco          text,
  p_tipo           text,
  p_moneda         text,
  p_numero         text,
  p_identificacion text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_anterior contabilidad.proveedor_cuenta_bancaria%ROWTYPE;
  v_id       uuid;
BEGIN
  SELECT * INTO v_anterior FROM contabilidad.proveedor_cuenta_bancaria
   WHERE proveedor_id = p_proveedor AND moneda = p_moneda AND activa
   FOR UPDATE;

  IF FOUND THEN
    UPDATE contabilidad.proveedor_cuenta_bancaria
       SET activa = false, reemplazada_en = now()
     WHERE id = v_anterior.id;
  END IF;

  INSERT INTO contabilidad.proveedor_cuenta_bancaria
         (proveedor_id, banco, tipo, moneda, numero, identificacion, creado_por)
  VALUES (p_proveedor, p_banco, p_tipo, p_moneda, p_numero, p_identificacion, contabilidad._usuario_actual())
  RETURNING id INTO v_id;

  IF v_anterior.id IS NOT NULL THEN
    INSERT INTO contabilidad.alerta (tipo, severidad, tabla, registro_id, detalle)
    VALUES ('cambio_cuenta_proveedor', 'media', 'proveedor', p_proveedor,
            jsonb_build_object('cuenta_anterior', right(v_anterior.numero, 4),
                               'cuenta_nueva', right(p_numero, 4),
                               'moneda', p_moneda,
                               'por', contabilidad._usuario_actual()));
  END IF;

  RETURN v_id;
END;
$$;
