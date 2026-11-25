-- Auxiliar SQL de los códigos de transacción.
--
-- Las funciones que contabilizan dentro de la base (facturas, pagos, recibos,
-- transferencias, reposición de caja) no pueden llamar al motor de TypeScript.
-- Esta función hace lo mismo para UNA partida: toma la cuenta y el lado
-- (débito/crédito) que la contadora configuró para el código y devuelve la
-- línea lista para `crear_asiento`. Si el código no tiene cuenta o la cuenta
-- no puede recibir asientos, lanza un error con clave fija
-- (`codigo_sin_cuenta:<CODIGO>` / `cuenta_no_valida:<CODIGO>`), que la capa
-- servidor traduce a un mensaje claro.
--
-- Una asignación de cuenta siempre crea la fila de `codigo_transaccion` (con la
-- naturaleza por defecto del código), así que si hay cuenta, hay lado.
CREATE OR REPLACE FUNCTION contabilidad.linea_por_codigo(
  p_codigo      text,
  p_monto       numeric,
  p_descripcion text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_naturaleza text;
  v_cuenta     uuid;
  v_activa     boolean;
  v_movimiento boolean;
BEGIN
  IF p_monto IS NULL OR p_monto < 0 THEN
    RAISE EXCEPTION 'monto_invalido:%', p_codigo;
  END IF;

  SELECT t.naturaleza, t.cuenta_id, c.activa, c.admite_movimiento
    INTO v_naturaleza, v_cuenta, v_activa, v_movimiento
    FROM contabilidad.codigo_transaccion t
    LEFT JOIN contabilidad.cuenta_contable c ON c.id = t.cuenta_id
   WHERE t.codigo = p_codigo;

  IF NOT FOUND OR v_cuenta IS NULL THEN
    RAISE EXCEPTION 'codigo_sin_cuenta:%', p_codigo;
  END IF;
  IF NOT v_activa OR NOT v_movimiento THEN
    RAISE EXCEPTION 'cuenta_no_valida:%', p_codigo;
  END IF;

  RETURN jsonb_build_object(
    'cuenta_id',   v_cuenta,
    'debe',        CASE WHEN v_naturaleza = 'debito'  THEN p_monto ELSE 0 END,
    'haber',       CASE WHEN v_naturaleza = 'credito' THEN p_monto ELSE 0 END,
    'descripcion', p_descripcion
  );
END;
$$;
