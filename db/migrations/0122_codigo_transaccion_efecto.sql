-- ================================================================
-- PORTAL GLOBALEFFECT — 0122 · Efecto (aumenta/disminuye) en códigos de transacción
-- ================================================================
-- 1. Alinea `cuenta_contable.naturaleza` con `tipo` tras el catálogo 0121:
--    activo y gasto → 'deudora'; pasivo, patrimonio e ingreso → 'acreedora'
--    (salvo cuentas compensatorias).
-- 2. Añade `efecto` ('aumenta' | 'disminuye') a `contabilidad.codigo_transaccion`
--    para configurar explícitamente si el lado asignado (débito o crédito)
--    aumenta o disminuye el saldo de la cuenta.
-- 3. Siembra `efecto` en las filas existentes según el lado del código y la
--    naturaleza contable de su cuenta asignada (activos/gastos aumentan por
--    débito y disminuyen por crédito; pasivos/patrimonio/ingresos disminuyen
--    por débito y aumentan por crédito).
--
-- Idempotente. Aplicar como rol `postgres`.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario
                    WHERE email IN ('sistema@globaleffect.org', 'admin@globaleffect.org')
                    ORDER BY (email = 'sistema@globaleffect.org') DESC LIMIT 1),
                  true),
       set_config('app.agente', '0122_codigo_transaccion_efecto.sql', true);

-- 1) Naturaleza contable coherente con el tipo de cuenta (0121 dejó el default 'deudora')
UPDATE contabilidad.cuenta_contable
   SET naturaleza = CASE
         WHEN tipo IN ('activo', 'gasto') THEN 'deudora'
         ELSE 'acreedora'
       END
 WHERE NOT es_compensatoria
   AND naturaleza <> CASE
         WHEN tipo IN ('activo', 'gasto') THEN 'deudora'
         ELSE 'acreedora'
       END;

-- 2) Columna `efecto` en códigos de transacción
ALTER TABLE contabilidad.codigo_transaccion
  ADD COLUMN IF NOT EXISTS efecto text
    CHECK (efecto IN ('aumenta', 'disminuye'));

COMMENT ON COLUMN contabilidad.codigo_transaccion.efecto IS
  'Si el lado configurado (débito/crédito) aumenta o disminuye el saldo de la cuenta. NULL = se deduce de la naturaleza de la cuenta.';

-- 3) Inicializar `efecto` en filas existentes sin valor según la naturaleza de su cuenta
UPDATE contabilidad.codigo_transaccion t
   SET efecto = CASE
         WHEN c.id IS NULL THEN 'aumenta'
         WHEN (c.naturaleza = 'deudora' AND t.naturaleza = 'debito')
           OR (c.naturaleza = 'acreedora' AND t.naturaleza = 'credito')
           THEN 'aumenta'
         ELSE 'disminuye'
       END,
       actualizado_en = now()
  FROM contabilidad.codigo_transaccion t2
  LEFT JOIN contabilidad.cuenta_contable c ON c.id = t2.cuenta_id
 WHERE t.codigo = t2.codigo
   AND t.efecto IS NULL;
