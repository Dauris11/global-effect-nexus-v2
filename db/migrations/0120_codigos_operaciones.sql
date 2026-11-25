-- ================================================================
-- 0120 · Códigos de transacción de operaciones (inventario, activos fijos
--        y calculadoras)
--
-- Las DEFINICIONES de los códigos viven en código
-- (src/lib/contabilidad/codigos/grupo-operaciones.ts). Aquí solo se siembra
-- la asignación código → cuenta que conserva el comportamiento anterior.
--
-- Qué se siembra y qué NO:
--   · CALC_FACTURA_GASTO → 5.4.12 (Otros Gastos): era el literal que usaba la
--     calculadora y es la única cuenta de esa lista que existe en el catálogo
--     de 88 cuentas (0107).
--   · Inventario, depreciación, ITBIS adelantado, retenciones y cuentas por
--     pagar de la calculadora quedan SIN fila: el catálogo no tiene cuenta
--     equivalente (2.1.1 es agrupadora; no hay cuenta de existencias ni de
--     depreciación). Antes de esta migración esos procesos ya fallaban; ahora
--     fallan con «código sin cuenta» y la opción «Asiento» dice cuál falta.
--     Apuntar la depreciación a 5.4.12 reproduciría el engaño (misma cuenta a
--     los dos lados) que el código viejo rechazaba.
--
-- Idempotente (ON CONFLICT DO NOTHING). Aplicar como rol `postgres`.
-- ================================================================

-- La bitácora aborta escrituras sin usuario: se usa el mismo de la 0115.
SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario
                    WHERE email IN ('sistema@globaleffect.org', 'admin@globaleffect.org')
                    ORDER BY (email = 'sistema@globaleffect.org') DESC LIMIT 1),
                  true),
       set_config('app.agente', '0120_codigos_operaciones.sql', true);

INSERT INTO contabilidad.codigo_transaccion (codigo, naturaleza, cuenta_id)
SELECT s.codigo, s.naturaleza, c.id
  FROM (VALUES
    ('CALC_FACTURA_GASTO', 'debito', '5.4.12')
  ) AS s(codigo, naturaleza, cuenta)
  JOIN contabilidad.cuenta_contable c
    ON c.codigo = s.cuenta AND c.admite_movimiento AND c.activa
ON CONFLICT (codigo) DO NOTHING;
