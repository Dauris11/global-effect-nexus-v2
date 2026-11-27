-- ================================================================
-- PORTAL GLOBALEFFECT — 0135 · Actualización del catálogo desde Catalogo Contable.xlsx
-- ================================================================
-- Aplica las nuevas cuentas y nombres del Excel actualizado (110 cuentas):
--   · 1.1.1.1 Caja General (nueva)
--   · 1.1.1.2 Caja Chica (antes 1.1.1.1; conserva UUID y enlace CAJ_CAJA_CHICA)
--   · 1.1.1.3 Banco Santa Cruz DOP (11332000011197) (antes 1.1.1.2; conserva enlace banco DOP)
--   · 1.1.1.4 Banco Santa Cruz USD (antes 1.1.1.3; conserva enlace banco USD)
--   · 1.1.2   Cuentas por Cobrar (nueva agrupadora)
--   · 1.1.2.1 Anticipos a Empleados y Fondos a Rendir (nueva)
--   · 1.1.3   Inventario (antes 1.1.2; resuelve código duplicado del Excel y conserva UUIDs)
--   · 1.1.3.1 Inventario de Almacen (antes 1.1.2.1; conserva enlaces INV_* y artículos)
--   · 1.1.3.2 Inventario de Suministro (antes 1.1.2.2)
--   · 5.1.1.6 Salario de Programa Juan Bosch (nueva)
--   · 5.2.3.1.1..3 nombres exactos del Excel (Oficina Principal, Instituto Tecnico,
--     Oficinas Administrativas)
--
-- Idempotente. Aplicar como rol `postgres`.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario
                    WHERE email IN ('sistema@globaleffect.org', 'admin@globaleffect.org')
                    ORDER BY (email = 'sistema@globaleffect.org') DESC LIMIT 1),
                  true),
       set_config('app.agente', '0135_actualizar_catalogo_excel.sql', true);

DO $migracion$
DECLARE
  v_padre_cajas_bancos uuid;
  v_padre_act_corr     uuid;
  v_padre_cxc          uuid;
  v_padre_sueldos      uuid;
BEGIN
  -- 1) Reubicar Cajas y Bancos (1.1.1.1..3 → 1.1.1.2..4) conservando UUIDs
  IF NOT EXISTS (SELECT 1 FROM contabilidad.cuenta_contable WHERE codigo = '1.1.1.4') THEN
    UPDATE contabilidad.cuenta_contable
       SET codigo = '1.1.1.4',
           nombre = 'Banco Santa Cruz USD'
     WHERE codigo = '1.1.1.3';

    UPDATE contabilidad.cuenta_contable
       SET codigo = '1.1.1.3',
           nombre = 'Banco Santa Cruz DOP (11332000011197)'
     WHERE codigo = '1.1.1.2';

    UPDATE contabilidad.cuenta_contable
       SET codigo = '1.1.1.2',
           nombre = 'Caja Chica'
     WHERE codigo = '1.1.1.1';

    SELECT id INTO v_padre_cajas_bancos
      FROM contabilidad.cuenta_contable
     WHERE codigo = '1.1.1';

    INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo, padre_id, admite_movimiento, activa)
    VALUES ('1.1.1.1', 'Caja General', 'activo', v_padre_cajas_bancos, true, true)
    ON CONFLICT (codigo) DO UPDATE
      SET nombre = EXCLUDED.nombre;
  END IF;

  -- 2) Reubicar Inventario (1.1.2* → 1.1.3*) conservando UUIDs y crear 1.1.2 Cuentas por Cobrar
  IF NOT EXISTS (SELECT 1 FROM contabilidad.cuenta_contable WHERE codigo = '1.1.3') THEN
    UPDATE contabilidad.cuenta_contable
       SET codigo = '1.1.3.2',
           nombre = 'Inventario de Suministro'
     WHERE codigo = '1.1.2.2';

    UPDATE contabilidad.cuenta_contable
       SET codigo = '1.1.3.1',
           nombre = 'Inventario de Almacen'
     WHERE codigo = '1.1.2.1';

    UPDATE contabilidad.cuenta_contable
       SET codigo = '1.1.3',
           nombre = 'Inventario'
     WHERE codigo = '1.1.2';

    SELECT id INTO v_padre_act_corr
      FROM contabilidad.cuenta_contable
     WHERE codigo = '1.1';

    INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo, padre_id, admite_movimiento, activa)
    VALUES ('1.1.2', 'Cuentas por Cobrar', 'activo', v_padre_act_corr, false, true)
    ON CONFLICT (codigo) DO UPDATE
      SET nombre = EXCLUDED.nombre;

    SELECT id INTO v_padre_cxc
      FROM contabilidad.cuenta_contable
     WHERE codigo = '1.1.2';

    INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo, padre_id, admite_movimiento, activa)
    VALUES ('1.1.2.1', 'Anticipos a Empleados y Fondos a Rendir', 'activo', v_padre_cxc, true, true)
    ON CONFLICT (codigo) DO UPDATE
      SET nombre = EXCLUDED.nombre;
  END IF;

  -- 3) Nueva cuenta de salario: 5.1.1.6 Salario de Programa Juan Bosch
  SELECT id INTO v_padre_sueldos
    FROM contabilidad.cuenta_contable
   WHERE codigo = '5.1.1';

  INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo, padre_id, admite_movimiento, activa)
  VALUES ('5.1.1.6', 'Salario de Programa Juan Bosch', 'gasto', v_padre_sueldos, true, true)
  ON CONFLICT (codigo) DO UPDATE
    SET nombre = EXCLUDED.nombre;

  -- 4) Sincronizar nombres exactos del Excel
  UPDATE contabilidad.cuenta_contable SET nombre = 'Banco Santa Cruz DOP (11332000011197)' WHERE codigo = '1.1.1.3';
  UPDATE contabilidad.cuenta_contable SET nombre = 'Oficina Principal'                     WHERE codigo = '5.2.3.1.1';
  UPDATE contabilidad.cuenta_contable SET nombre = 'Instituto Tecnico'                     WHERE codigo = '5.2.3.1.2';
  UPDATE contabilidad.cuenta_contable SET nombre = 'Oficinas Administrativas'              WHERE codigo = '5.2.3.1.3';
END
$migracion$;
