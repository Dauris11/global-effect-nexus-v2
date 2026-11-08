-- ============================================================================
-- Migración 0072: Coordenadas en visitas Habitudes y soporte de compras en CxP
--
-- 1. Agrega latitud y longitud a habitudes_visita_evidencia para auditoría
--    georreferenciada de visitas de campo a liceos de La Vega.
-- 2. Actualiza contabilidad.crear_cxp_desde_solicitud para admitir tanto 'gasto'
--    como 'compra', vinculando cotizaciones aprobadas con Cuentas por Pagar.
-- ============================================================================

-- 1. Geolocalización de visitas de Habitudes
ALTER TABLE public.habitudes_visita_evidencia
    ADD COLUMN IF NOT EXISTS latitud NUMERIC(10, 7),
    ADD COLUMN IF NOT EXISTS longitud NUMERIC(10, 7);

-- 2. Función para generar Cuenta por Pagar desde solicitudes de gasto o compra
CREATE OR REPLACE FUNCTION contabilidad.crear_cxp_desde_solicitud(p_solicitud uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  s          public.solicitud%ROWTYPE;
  v_id       uuid;
  v_concepto text;
BEGIN
  SELECT id INTO v_id FROM contabilidad.cuenta_por_pagar WHERE solicitud_id = p_solicitud;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT * INTO s FROM public.solicitud WHERE id = p_solicitud;
  IF s.tipo NOT IN ('gasto', 'compra') OR s.monto IS NULL THEN
    RAISE EXCEPTION 'contabilidad: la solicitud % no es un gasto o compra con monto', s.folio;
  END IF;

  v_concepto := CASE
    WHEN s.tipo = 'compra' THEN 'Compra #' || s.folio || ': ' || s.titulo
    ELSE 'Solicitud #' || s.folio || ': ' || s.titulo
  END;

  INSERT INTO contabilidad.cuenta_por_pagar
         (origen, solicitud_id, beneficiario, concepto, moneda, monto, fecha_emision,
          fecha_vencimiento, categoria_id, fondo_id, creado_por)
  VALUES ('solicitud', s.id,
          (SELECT nombre FROM public.usuario WHERE id = s.solicitante_id),
          v_concepto, 'USD', s.monto, CURRENT_DATE,
          greatest(coalesce(s.fecha_requerida, CURRENT_DATE + 15), CURRENT_DATE),
          (SELECT id FROM contabilidad.categoria WHERE nombre = 'Otros egresos'),
          (SELECT id FROM contabilidad.fondo WHERE nombre = 'General'),
          contabilidad._usuario_actual())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

