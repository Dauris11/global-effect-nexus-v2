-- ================================================================
-- GLOBAL EFFECT NEXUS — 0049 · Catálogo: cuentas sin padre
-- ================================================================
-- Tres cuentas se crearon sin `padre_id` (0037 y 0039) y quedaban
-- fuera del árbol: no sumaban en los subtotales de la balanza ni en
-- el mayor de su grupo. Ninguna tiene movimientos todavía.
--
--   · 2.1.02.03 ISR retenido proveedores → bajo 2.1.02 (Retenciones
--     por pagar). Conserva su código: `aprobar_factura` (0037) la
--     busca por él.
--   · 6.1.05.99 Diferencia negativa en arqueo → 5.9.01.99, bajo 5.9
--     (Otros Gastos). El 6 no es un grupo del catálogo: los gastos
--     son el 5. Nada la busca por código.
--   · 4.1.05.99 Sobrante en arqueo → 4.9.01.99, bajo 4.9 (Otros
--     Ingresos): un sobrante de caja no es una donación.
--
-- Aplicar como rol `postgres`.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario WHERE email = 'sistema@globaleffect.org'),
                  true),
       set_config('app.agente', '0049_contabilidad_catalogo_huerfanas.sql', true);

UPDATE contabilidad.cuenta_contable h
   SET padre_id = p.id
  FROM contabilidad.cuenta_contable p
 WHERE h.codigo = '2.1.02.03' AND p.codigo = '2.1.02' AND h.padre_id IS NULL;

UPDATE contabilidad.cuenta_contable h
   SET padre_id = p.id, codigo = '5.9.01.99'
  FROM contabilidad.cuenta_contable p
 WHERE h.codigo = '6.1.05.99' AND p.codigo = '5.9' AND h.padre_id IS NULL;

UPDATE contabilidad.cuenta_contable h
   SET padre_id = p.id, codigo = '4.9.01.99'
  FROM contabilidad.cuenta_contable p
 WHERE h.codigo = '4.1.05.99' AND p.codigo = '4.9' AND h.padre_id IS NULL;
