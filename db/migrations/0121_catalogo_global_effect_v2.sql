-- ================================================================
-- PORTAL GLOBALEFFECT — 0121 · Catálogo contable actualizado (103 cuentas)
-- ================================================================
-- Reemplaza el catálogo de 88 cuentas (0107) por la nueva versión de 103
-- cuentas de `Catalogo Contable.xlsx`:
--   · Separa Activos en 1.1 Activos Corrientes (Cajas y Bancos + Inventario)
--     y 1.2 Activos Fijos (Edificaciones, Mobiliario/Equipos, Otros Activos).
--   · Añade dos cuentas de Banco Santa Cruz (1.1.1.2 y 1.1.1.3) para asignar
--     el número de cuenta luego, cuentas de Inventario (1.1.2.1 y 1.1.2.2),
--     Cuentas por Pagar Proveedores con movimiento (2.1.1), UAPA (2.1.2.4),
--     UTESA (2.1.2.5) y retenciones de nómina desglosadas (2.3.1–2.3.5).
--   · Reorganiza los gastos bajo 5.1 Gastos de Personal y 5.2 Gastos
--     Administrativos.
--
-- Remapea toda la configuración viva (bancos, categorías, presupuesto,
-- artículos, categorías de activos, cajas y códigos de transacción) y detiene
-- la migración si existen asientos o recibos apuntando al catálogo anterior.
--
-- Idempotente: si ya existe la cuenta 5.2.3.10 (exclusiva del catálogo de
-- 103 cuentas) no hace nada. Aplicar como rol `postgres`.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario
                    WHERE email IN ('sistema@globaleffect.org', 'admin@globaleffect.org')
                    ORDER BY (email = 'sistema@globaleffect.org') DESC LIMIT 1),
                  true),
       set_config('app.agente', '0121_catalogo_global_effect_v2.sql', true);

DO $migracion$
DECLARE
  v_n integer;
BEGIN
  IF EXISTS (SELECT 1 FROM contabilidad.cuenta_contable WHERE codigo = '5.2.3.10') THEN
    RAISE NOTICE '0121: el catálogo de 103 cuentas ya está cargado; no se hace nada';
    RETURN;
  END IF;

  -- ------------------------------------------------------------
  -- 1) Catálogo anterior fuera del camino del UNIQUE(codigo)
  -- ------------------------------------------------------------
  CREATE TEMP TABLE _cuenta_vieja ON COMMIT DROP AS
    SELECT id, codigo FROM contabilidad.cuenta_contable;

  UPDATE contabilidad.cuenta_contable SET codigo = 'ANT-' || codigo;

  -- ------------------------------------------------------------
  -- 2) Catálogo nuevo (103 cuentas)
  -- ------------------------------------------------------------
  INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo, admite_movimiento)
  VALUES
  -- INICIO-CATALOGO
  ('1', 'Activos', 'activo', false),
  ('1.1', 'Activos Corrientes', 'activo', false),
  ('1.1.1', 'Cajas y Bancos', 'activo', false),
  ('1.1.1.1', 'Caja Chica', 'activo', true),
  ('1.1.1.2', 'Banco Santa Cruz (No. de Cuenta 1)', 'activo', true),
  ('1.1.1.3', 'Banco Santa Cruz (No. de Cuenta 2)', 'activo', true),
  ('1.1.2', 'Inventario', 'activo', false),
  ('1.1.2.1', 'Inventario de Almacen', 'activo', true),
  ('1.1.2.2', 'Inventario de Suministro', 'activo', true),
  ('1.2', 'Activos Fijos', 'activo', false),
  ('1.2.1', 'Edificaciones', 'activo', false),
  ('1.2.1.1', 'Edificaciones', 'activo', true),
  ('1.2.2', 'Mobiliario y Equipo de Oficina', 'activo', false),
  ('1.2.2.1', 'Mobiliario', 'activo', true),
  ('1.2.2.2', 'Computadoras', 'activo', true),
  ('1.2.2.3', 'Vehículos', 'activo', true),
  ('1.2.3', 'Otros Activos', 'activo', false),
  ('1.2.3.1', 'Otros Activos', 'activo', true),
  ('2', 'Pasivos', 'pasivo', false),
  ('2.1', 'Cuentas por Pagar', 'pasivo', false),
  ('2.1.1', 'Cuentas por Pagar Proveedores', 'pasivo', true),
  ('2.1.2', 'Cuentas por Pagar Universidades', 'pasivo', false),
  ('2.1.2.1', 'Cuentas por Pagar UCATECI', 'pasivo', true),
  ('2.1.2.2', 'Cuentas por Pagar UNPHU', 'pasivo', true),
  ('2.1.2.3', 'Cuentas por Pagar UASD', 'pasivo', true),
  ('2.1.2.4', 'Cuentas por Pagar UAPA', 'pasivo', true),
  ('2.1.2.5', 'Cuentas por Pagar UTESA', 'pasivo', true),
  ('2.1.3', 'Otras Cuentas por Pagar', 'pasivo', true),
  ('2.2', 'Prestamos', 'pasivo', false),
  ('2.2.1', 'Prestamos en Entidades Financieras', 'pasivo', true),
  ('2.3', 'Retenciones por Pagar', 'pasivo', false),
  ('2.3.1', 'Impuesto Sobre la Renta Empleados por Pagar (ISR)', 'pasivo', true),
  ('2.3.2', 'Administradoras de Fondos de Pensiones por Pagar (AFP)', 'pasivo', true),
  ('2.3.3', 'Seguro Familiar de Salud por Pagar (SFS)', 'pasivo', true),
  ('2.3.4', 'Riesgo Laboral por Pagar', 'pasivo', true),
  ('2.3.5', 'INFOTEP por Pagar', 'pasivo', true),
  ('3', 'Patrimonio', 'patrimonio', false),
  ('3.1', 'Resultados de Ejercicios', 'patrimonio', false),
  ('3.1.1', 'Beneficios (Perdidas) de Ejercicios Anteriores', 'patrimonio', true),
  ('3.1.2', 'Beneficio (Perdida) de Ejercicio Actual', 'patrimonio', true),
  ('4', 'Ingresos', 'ingreso', false),
  ('4.1', 'Donaciones Recibidas', 'ingreso', false),
  ('4.1.1', 'Donaciones Nacionales en Bancos', 'ingreso', true),
  ('4.1.2', 'Donaciones Nacionales en Efectivo', 'ingreso', true),
  ('4.1.3', 'Donaciones Internacionales en Bancos', 'ingreso', true),
  ('4.1.4', 'Donaciones Internacionales en Efectivo', 'ingreso', true),
  ('4.2', 'Ingresos por Actividades Propias', 'ingreso', false),
  ('4.2.1', 'Ingresos por Eventos', 'ingreso', true),
  ('4.3', 'Otros Ingresos', 'ingreso', false),
  ('4.3.1', 'Ingresos por Dividendos o Rendimiento Bancario', 'ingreso', true),
  ('4.3.2', 'Ingresos por Cambio de Divisas', 'ingreso', true),
  ('5', 'Gastos', 'gasto', false),
  ('5.1', 'Gastos de Personal', 'gasto', false),
  ('5.1.1', 'Sueldos y Salarios', 'gasto', false),
  ('5.1.1.1', 'Salario de Programa de Habitudes', 'gasto', true),
  ('5.1.1.2', 'Salario de Programa de Alojamiento', 'gasto', true),
  ('5.1.1.3', 'Salario de Programa 360', 'gasto', true),
  ('5.1.1.4', 'Salario de Programa de Becas', 'gasto', true),
  ('5.1.1.5', 'Salario de Personal Administrativo', 'gasto', true),
  ('5.1.2', 'Retribuciones Complementarias', 'gasto', false),
  ('5.1.2.1', 'Regalia Pascual', 'gasto', true),
  ('5.1.3', 'Seguros', 'gasto', false),
  ('5.1.3.1', 'Seguro Familiar de Salud Empleador (SFS)', 'gasto', true),
  ('5.1.3.2', 'Riesgo Laboral Empleador', 'gasto', true),
  ('5.1.4', 'Aportaciones Planes de Pensiones', 'gasto', false),
  ('5.1.4.1', 'Administradoras de Fondos de Pensiones Empleador (AFP)', 'gasto', true),
  ('5.1.5', 'Otros Gastos de Personal', 'gasto', false),
  ('5.1.5.1', 'INFOTEP Empleador', 'gasto', true),
  ('5.2', 'Gastos Administrativos', 'gasto', false),
  ('5.2.1', 'Gastos de Agua, Luz y Telefono', 'gasto', false),
  ('5.2.1.1', 'Electricidad de Oficina Principal', 'gasto', true),
  ('5.2.1.2', 'Electricidad de Instituto Técnico', 'gasto', true),
  ('5.2.1.3', 'Electricidad de Otras Oficinas', 'gasto', true),
  ('5.2.1.4', 'Electricidad Programa de Alojamiento', 'gasto', true),
  ('5.2.1.5', 'Comunicación e Internet Programa de Alojamiento', 'gasto', true),
  ('5.2.1.6', 'Comunicación e Internet Oficinas', 'gasto', true),
  ('5.2.2', 'Gastos de Materiales Gastables', 'gasto', false),
  ('5.2.2.1', 'Papelería y Suministros', 'gasto', true),
  ('5.2.3', 'Otros Gastos Administrativos', 'gasto', false),
  ('5.2.3.1', 'Alquiler de Locales', 'gasto', false),
  ('5.2.3.1.1', 'Oficina Principal', 'gasto', true),
  ('5.2.3.1.2', 'Instituto Tecnico', 'gasto', true),
  ('5.2.3.1.3', 'Oficinas Administrativas', 'gasto', true),
  ('5.2.3.2', 'Gastos de Programa de Becas', 'gasto', false),
  ('5.2.3.2.1', 'Inscripción de Estudiantes', 'gasto', true),
  ('5.2.3.2.2', 'Periodo Universitario', 'gasto', true),
  ('5.2.3.2.3', 'Libros y Materiales', 'gasto', true),
  ('5.2.3.2.4', 'Transporte de Estudiantes', 'gasto', true),
  ('5.2.3.3', 'Gastos de Programa de Alojamiento', 'gasto', false),
  ('5.2.3.3.1', 'Transporte de Programa de Alojamiento', 'gasto', true),
  ('5.2.3.3.2', 'Manutención de Programa de Alojamiento', 'gasto', true),
  ('5.2.3.4', 'Comisiones Bancarios', 'gasto', false),
  ('5.2.3.4.1', 'Impuesto Sobre Transferencia (0.20%)', 'gasto', true),
  ('5.2.3.4.2', 'Comisiones por Servicios', 'gasto', true),
  ('5.2.3.5', 'Eventos o Campañas', 'gasto', true),
  ('5.2.3.6', 'Gastos de Viajes y Agenda', 'gasto', true),
  ('5.2.3.7', 'Donaciones y Aportes a Iglesias', 'gasto', true),
  ('5.2.3.8', 'Almuerzo Estudiantil', 'gasto', true),
  ('5.2.3.9', 'Reunión Mensual', 'gasto', false),
  ('5.2.3.9.1', 'Merienda Reunión Mensual', 'gasto', true),
  ('5.2.3.9.2', 'Decoración Reunión Mensual', 'gasto', true),
  ('5.2.3.9.3', 'Alquileres Reunión Mensual', 'gasto', true),
  ('5.2.3.10', 'Otros Gastos', 'gasto', true)
  -- FIN-CATALOGO
  ;

  UPDATE contabilidad.cuenta_contable h
     SET padre_id = p.id
    FROM contabilidad.cuenta_contable p
   WHERE h.codigo NOT LIKE 'ANT-%'
     AND strpos(h.codigo, '.') > 0
     AND p.codigo = regexp_replace(h.codigo, '\.[0-9]+$', '');

  -- ------------------------------------------------------------
  -- 3) Remapeo de la configuración viva (0107 → 0121)
  -- ------------------------------------------------------------
  CREATE TEMP TABLE _mapa (viejo text, nuevo text) ON COMMIT DROP;
  INSERT INTO _mapa VALUES
    -- Efectivo y activos fijos
    ('1.1.1',    '1.1.1.1'),
    ('1.2.1',    '1.1.1.2'),
    ('1.3.1',    '1.2.1.1'),
    ('1.3.2',    '1.2.1.1'),
    ('1.4.1',    '1.2.2.1'),
    ('1.4.2',    '1.2.2.2'),
    ('1.4.3',    '1.2.2.3'),
    ('1.5.1',    '1.2.3.1'),
    -- Pasivos
    ('2.1.2.1',  '2.1.2.1'),
    ('2.1.2.2',  '2.1.2.2'),
    ('2.1.2.3',  '2.1.2.3'),
    ('2.2.1',    '2.2.1'),
    -- Patrimonio
    ('3.1.1',    '3.1.1'),
    ('3.1.2',    '3.1.2'),
    -- Ingresos
    ('4.1.1',    '4.1.1'),
    ('4.1.2',    '4.1.2'),
    ('4.1.3',    '4.1.3'),
    ('4.1.4',    '4.1.4'),
    ('4.2.1',    '4.2.1'),
    ('4.3.1',    '4.3.1'),
    ('4.3.2',    '4.3.2'),
    -- Gastos de programa de becas
    ('5.1.1',    '5.2.3.2.1'),
    ('5.1.2',    '5.2.3.2.2'),
    ('5.1.3',    '5.2.3.2.3'),
    ('5.1.4',    '5.2.3.2.4'),
    -- Gastos de alojamiento
    ('5.2.3',    '5.2.1.4'),
    ('5.2.4',    '5.2.1.5'),
    -- Gastos administrativos y personal
    ('5.3.1',    '5.2.3.1.1'),
    ('5.3.2.1',  '5.2.1.1'),
    ('5.3.2.2',  '5.2.1.2'),
    ('5.3.2.3',  '5.2.1.3'),
    ('5.3.3.1',  '5.1.1.1'),
    ('5.3.3.2',  '5.1.1.2'),
    ('5.3.3.3',  '5.1.1.3'),
    ('5.3.3.4',  '5.1.1.4'),
    ('5.3.3.5',  '5.1.1.5'),
    ('5.3.4.1',  '5.1.4.1'),
    ('5.3.4.2',  '5.1.3.1'),
    ('5.3.4.3',  '5.1.3.2'),
    ('5.3.4.4',  '5.1.5.1'),
    ('5.3.5',    '5.1.2.1'),
    -- Otros gastos
    ('5.4.3',    '5.2.3.4.2'),
    ('5.4.5',    '5.2.2.1'),
    ('5.4.6.1',  '5.2.1.6'),
    ('5.4.6.2',  '5.2.1.6'),
    ('5.4.7',    '5.2.3.5'),
    ('5.4.8',    '5.2.3.6'),
    ('5.4.9',    '5.2.3.7'),
    ('5.4.10',   '5.2.3.8'),
    ('5.4.11.1', '5.2.3.9.1'),
    ('5.4.11.2', '5.2.3.9.2'),
    ('5.4.11.3', '5.2.3.9.3'),
    ('5.4.12',   '5.2.3.10');

  CREATE TEMP TABLE _remap ON COMMIT DROP AS
    SELECT v.id AS id_viejo, n.id AS id_nuevo
      FROM _mapa m
      JOIN _cuenta_vieja v ON v.codigo = m.viejo
      JOIN contabilidad.cuenta_contable n
        ON n.codigo = m.nuevo AND n.codigo NOT LIKE 'ANT-%';

  -- Categorías
  UPDATE contabilidad.categoria c
     SET cuenta_id = r.id_nuevo
    FROM _remap r
   WHERE c.cuenta_id = r.id_viejo;
  UPDATE contabilidad.categoria
     SET cuenta_id = NULL
   WHERE cuenta_id IN (SELECT id FROM _cuenta_vieja);

  -- Cuentas bancarias: DOP → Cuenta 1 (1.1.1.2), USD → Cuenta 2 (1.1.1.3)
  UPDATE contabilidad.cuenta_bancaria
     SET cuenta_contable_id = (
       SELECT id FROM contabilidad.cuenta_contable
        WHERE codigo = CASE moneda WHEN 'USD' THEN '1.1.1.3' ELSE '1.1.1.2' END
     )
   WHERE cuenta_contable_id IN (SELECT id FROM _cuenta_vieja);

  -- Presupuesto (8 cuentas distintas → 8 cuentas distintas, sin colisión)
  UPDATE contabilidad.presupuesto_linea pl
     SET cuenta_id = r.id_nuevo
    FROM _remap r
   WHERE pl.cuenta_id = r.id_viejo;

  -- Artículos de inventario: remapea gasto y enlaza inventario de almacén
  UPDATE contabilidad.articulo a
     SET cuenta_gasto_id = r.id_nuevo
    FROM _remap r
   WHERE a.cuenta_gasto_id = r.id_viejo;
  UPDATE contabilidad.articulo
     SET cuenta_gasto_id = NULL
   WHERE cuenta_gasto_id IN (SELECT id FROM _cuenta_vieja);
  UPDATE contabilidad.articulo
     SET cuenta_inventario_id = (
       SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '1.1.2.1'
     )
   WHERE cuenta_inventario_id IS NULL
      OR cuenta_inventario_id IN (SELECT id FROM _cuenta_vieja);

  -- Categorías de activos fijos
  UPDATE contabilidad.activo_categoria ac
     SET cuenta_activo_id = r.id_nuevo
    FROM _remap r
   WHERE ac.cuenta_activo_id = r.id_viejo;
  UPDATE contabilidad.activo_categoria
     SET cuenta_gasto_depreciacion_id = (
           SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '5.2.3.10'
         ),
         cuenta_depreciacion_acumulada_id = (
           SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '5.2.3.10'
         )
   WHERE cuenta_gasto_depreciacion_id IN (SELECT id FROM _cuenta_vieja)
      OR cuenta_depreciacion_acumulada_id IN (SELECT id FROM _cuenta_vieja);
  UPDATE contabilidad.activo_categoria
     SET cuenta_activo_id = (
           SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '5.2.3.10'
         )
   WHERE cuenta_activo_id IN (SELECT id FROM _cuenta_vieja);

  -- Cajas
  UPDATE contabilidad.caja c
     SET cuenta_contable_id = r.id_nuevo
    FROM _remap r
   WHERE c.cuenta_contable_id = r.id_viejo;
  UPDATE contabilidad.caja
     SET cuenta_contable_id = NULL
   WHERE cuenta_contable_id IN (SELECT id FROM _cuenta_vieja);

  -- ------------------------------------------------------------
  -- 4) Códigos de transacción: remapeo y nuevas cuentas disponibles
  -- ------------------------------------------------------------
  -- Actualiza los existentes a las cuentas nuevas y siembra los códigos que
  -- antes no tenían cuenta en el catálogo de 88 (proveedores 2.1.1, ISR
  -- empleados 2.3.1, retenciones TSS separadas 2.3.2–2.3.5 e inventario 1.1.2.1).
  INSERT INTO contabilidad.codigo_transaccion (codigo, naturaleza, cuenta_id)
  SELECT s.codigo, s.naturaleza, c.id
    FROM (VALUES
      -- Nómina (gasto)
      ('NOM_SUELDO_HABITUDES',                'debito',  '5.1.1.1'),
      ('NOM_SUELDO_ALOJAMIENTO',              'debito',  '5.1.1.2'),
      ('NOM_SUELDO_FORMACION_360',            'debito',  '5.1.1.3'),
      ('NOM_SUELDO_BECAS',                    'debito',  '5.1.1.4'),
      ('NOM_SUELDO_ADMINISTRATIVO',           'debito',  '5.1.1.5'),
      ('NOM_AFP_EMPLEADOR_GASTO',             'debito',  '5.1.4.1'),
      ('NOM_SFS_EMPLEADOR_GASTO',             'debito',  '5.1.3.1'),
      ('NOM_SRL_EMPLEADOR_GASTO',             'debito',  '5.1.3.2'),
      ('NOM_INFOTEP_EMPLEADOR_GASTO',         'debito',  '5.1.5.1'),
      -- Nómina (retenciones y aportes por pagar, ahora separados)
      ('NOM_ISR_X_PAGAR',                     'credito', '2.3.1'),
      ('NOM_AFP_EMPLEADO_X_PAGAR',            'credito', '2.3.2'),
      ('NOM_AFP_EMPLEADOR_X_PAGAR',           'credito', '2.3.2'),
      ('NOM_SFS_EMPLEADO_X_PAGAR',            'credito', '2.3.3'),
      ('NOM_SFS_EMPLEADOR_X_PAGAR',           'credito', '2.3.3'),
      ('NOM_SRL_EMPLEADOR_X_PAGAR',           'credito', '2.3.4'),
      ('NOM_INFOTEP_EMPLEADOR_X_PAGAR',       'credito', '2.3.5'),
      -- Tesorería
      ('BAN_TRANSFER_GANANCIA_CAMBIARIA',     'credito', '4.3.2'),
      ('CAJ_CAJA_CHICA',                      'debito',  '1.1.1.1'),
      ('CAJ_ARQUEO_FALTANTE',                 'debito',  '5.2.3.10'),
      -- Proveedores (2.1.1 ahora admite movimiento)
      ('PROV_CXP_FACTURA',                    'credito', '2.1.1'),
      ('PROV_PAGO_CXP',                       'debito',  '2.1.1'),
      -- Patrimonio, donaciones, fondos y cierre
      ('DON_NACIONAL_BANCO',                  'credito', '4.1.1'),
      ('DON_INTERNACIONAL_BANCO',             'credito', '4.1.3'),
      ('FON_LIBERACION_RESTRINGIDO',          'debito',  '3.1.2'),
      ('FON_LIBERACION_OPERATIVO',            'credito', '3.1.1'),
      ('CIE_RESULTADOS_ACUMULADOS_SUPERAVIT', 'credito', '3.1.1'),
      ('CIE_RESULTADOS_ACUMULADOS_DEFICIT',   'debito',  '3.1.1'),
      -- Operaciones (inventario 1.1.2.1 y calculadora)
      ('INV_CONSUMO_EXISTENCIAS',             'credito', '1.1.2.1'),
      ('INV_SOBRANTE_EXISTENCIAS',            'debito',  '1.1.2.1'),
      ('INV_FALTANTE_EXISTENCIAS',            'credito', '1.1.2.1'),
      ('CALC_FACTURA_GASTO',                  'debito',  '5.2.3.10'),
      ('CALC_FACTURA_CXP_NETO',               'credito', '2.1.1')
    ) AS s(codigo, naturaleza, cuenta)
    JOIN contabilidad.cuenta_contable c
      ON c.codigo = s.cuenta AND c.admite_movimiento AND c.activa
  ON CONFLICT (codigo) DO UPDATE
     SET cuenta_id = EXCLUDED.cuenta_id,
         actualizado_en = now();

  -- Cualquier código que seguía apuntando a una cuenta vieja (p. ej.
  -- BAN_TRANSFER_PERDIDA_CAMBIARIA, sin cuenta propia en el Excel nuevo)
  -- queda sin asignar para que la contadora elija la cuenta en pantalla.
  UPDATE contabilidad.codigo_transaccion
     SET cuenta_id = NULL,
         actualizado_en = now()
   WHERE cuenta_id IN (SELECT id FROM _cuenta_vieja);

  -- ------------------------------------------------------------
  -- 5) Verificar que no quede historia apuntando a cuentas viejas
  -- ------------------------------------------------------------
  SELECT count(*) INTO v_n FROM contabilidad.asiento_linea
   WHERE cuenta_id IN (SELECT id FROM _cuenta_vieja);
  IF v_n > 0 THEN
    RAISE EXCEPTION
      '0121: % líneas de asiento usan cuentas del catálogo anterior. Vacía primero los movimientos de prueba o remapea.',
      v_n;
  END IF;

  SELECT count(*) INTO v_n FROM contabilidad.recibo
   WHERE cuenta_contrapartida_id IN (SELECT id FROM _cuenta_vieja);
  IF v_n > 0 THEN
    RAISE EXCEPTION '0121: % recibos usan cuentas del catálogo anterior.', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM contabilidad.presupuesto_linea
   WHERE cuenta_id IN (SELECT id FROM _cuenta_vieja);
  IF v_n > 0 THEN
    RAISE EXCEPTION '0121: % líneas de presupuesto sin equivalente en el catálogo nuevo.', v_n;
  END IF;

  -- ------------------------------------------------------------
  -- 6) Retirar las cuentas del catálogo anterior
  -- ------------------------------------------------------------
  ALTER TABLE contabilidad.cuenta_contable DISABLE TRIGGER tg_proteger_contabilidad_cuenta_contable;
  UPDATE contabilidad.cuenta_contable
     SET padre_id = NULL
   WHERE id IN (SELECT id FROM _cuenta_vieja);
  DELETE FROM contabilidad.cuenta_contable
   WHERE id IN (SELECT id FROM _cuenta_vieja);
  ALTER TABLE contabilidad.cuenta_contable ENABLE TRIGGER tg_proteger_contabilidad_cuenta_contable;
END
$migracion$;
