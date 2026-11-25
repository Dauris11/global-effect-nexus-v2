-- ================================================================
-- 0119 · Códigos de transacción de donaciones, fondos y cierre anual
--
-- Las donaciones por banco, la liberación de fondos restringidos y el cierre
-- anual armaban su asiento con cuentas buscadas por literal en TypeScript
-- (4.1.1, 4.1.3, 3.1.1, 3.1.2). Ahora usan códigos de transacción
-- (src/lib/contabilidad/codigos/grupo-patrimonio.ts) y aquí se siembra la
-- asignación que conserva el asiento de hoy.
--
-- Sin cuenta a propósito (el catálogo de 88 cuentas no tiene equivalente):
--   · DON_ESPECIE_INGRESO y DON_ESPECIE_BIEN_RECIBIDO: no hay cuenta de
--     ingreso por donaciones en especie ni de inventario/activo recibido sin
--     costo. Las donaciones en especie siguen sin poder registrarse hasta que
--     la contadora las asigne; «Asiento» muestra qué falta.
--
-- Sin cambio funcional en SQL: las tres operaciones se contabilizan desde
-- TypeScript, así que esta migración solo siembra datos. Idempotente.
-- Aplicar como rol `postgres`.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario
                    WHERE email IN ('sistema@globaleffect.org', 'admin@globaleffect.org')
                    ORDER BY (email = 'sistema@globaleffect.org') DESC LIMIT 1),
                  true),
       set_config('app.agente', '0119_codigos_patrimonio.sql', true);

-- Solo si la cuenta existe, es de movimiento y está activa; lo ya configurado
-- por la contadora no se pisa.
INSERT INTO contabilidad.codigo_transaccion (codigo, naturaleza, cuenta_id)
SELECT s.codigo, s.naturaleza, c.id
  FROM (VALUES
    ('DON_NACIONAL_BANCO',                  'credito', '4.1.1'),
    ('DON_INTERNACIONAL_BANCO',             'credito', '4.1.3'),
    ('FON_LIBERACION_RESTRINGIDO',          'debito',  '3.1.2'),
    ('FON_LIBERACION_OPERATIVO',            'credito', '3.1.1'),
    ('CIE_RESULTADOS_ACUMULADOS_SUPERAVIT', 'credito', '3.1.2'),
    ('CIE_RESULTADOS_ACUMULADOS_DEFICIT',   'debito',  '3.1.2')
  ) AS s(codigo, naturaleza, cuenta)
  JOIN contabilidad.cuenta_contable c
    ON c.codigo = s.cuenta AND c.admite_movimiento AND c.activa
ON CONFLICT (codigo) DO NOTHING;
