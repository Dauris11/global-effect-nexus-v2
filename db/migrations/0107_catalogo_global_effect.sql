-- ================================================================
-- PORTAL GLOBALEFFECT — 0107 · Catálogo contable de la Fundación
-- ================================================================
-- Reemplaza el catálogo de 77 cuentas (0048–0053) por el de 88 cuentas
-- que entregó la Fundación (Catalogo Contable.xlsx), cargado tal cual:
-- mismos códigos y nombres, incluidos sus typos (p. ej. «Edifcios»).
-- El SQL del catálogo sale de scripts/generar-catalogo-sql.py.
--
-- Orden de operación en una base con datos:
--   1. `node scripts/reiniciar-contabilidad.mjs --confirmar` vacía lo
--      transaccional (asientos, recibos, bancos…), que apunta a cuentas
--      viejas y está respaldado en JSON.
--   2. Esta migración reemplaza el catálogo y remapea la configuración viva
--      (categorías, bancos, presupuesto, artículos, categorías de activos).
-- En una base nueva no hay movimientos: basta correr la migración.
--
-- Si quedan asientos o recibos sobre cuentas viejas, la migración se
-- detiene con un mensaje claro en vez de dejar historia huérfana.
--
-- Idempotente: si ya existe la cuenta 5.4.12 (exclusiva del catálogo
-- nuevo) no hace nada.
--
-- Aplicar como rol `postgres`.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario
                    WHERE email IN ('sistema@globaleffect.org', 'admin@globaleffect.org')
                    ORDER BY (email = 'sistema@globaleffect.org') DESC LIMIT 1),
                  true),
       set_config('app.agente', '0107_catalogo_global_effect.sql', true);

-- ----------------------------------------------------------------
-- 0) Ayudante para funciones SQL que buscaban cuentas por código literal
-- ----------------------------------------------------------------
-- `aprobar_factura`, `pagar_cxp` y `transferir` resolvían cuentas con
-- `(SELECT id … WHERE codigo = '…')`. Si el código no existe devuelven NULL y
-- el fallo es «null value in column cuenta_id»: ilegible. Con este ayudante el
-- error dice qué cuenta falta. Se crea siempre (CREATE OR REPLACE).
CREATE OR REPLACE FUNCTION contabilidad._cuenta_requerida(p_codigo text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
    FROM contabilidad.cuenta_contable
   WHERE codigo = p_codigo AND admite_movimiento AND activa;
  IF v_id IS NULL THEN
    RAISE EXCEPTION
      'contabilidad: el catálogo vigente no tiene una cuenta con movimiento para el código % (Configuración > Catálogo)',
      p_codigo;
  END IF;
  RETURN v_id;
END;
$$;

-- Clave de orden de un código del catálogo: cada segmento con 6 dígitos y sin
-- separadores, así «5.4.2» < «5.4.10» y el orden no depende de la
-- intercalación del idioma (que ignora los puntos). Un padre queda antes que
-- sus hijas porque su clave es prefijo de la de ellas.
CREATE OR REPLACE FUNCTION contabilidad.clave_codigo(p_codigo text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(string_agg(lpad(s, 6, '0'), '' ORDER BY n), '')
    FROM unnest(string_to_array(p_codigo, '.')) WITH ORDINALITY AS t(s, n)
   WHERE s ~ '^[0-9]+$'
$$;

DO $migracion$
DECLARE
  v_def   text;
  v_nuevo text;
  v_fn    record;
  v_n     integer;
BEGIN
  IF EXISTS (SELECT 1 FROM contabilidad.cuenta_contable WHERE codigo = '5.4.12') THEN
    RAISE NOTICE '0107: el catálogo nuevo ya está cargado; no se hace nada';
    RETURN;
  END IF;

  -- ------------------------------------------------------------
  -- 1) Las funciones que buscaban cuentas por código viejo
  -- ------------------------------------------------------------
  -- Con equivalente real en el catálogo nuevo (diferencia cambiaria de una
  -- transferencia entre bancos): 4.9.01.03 → 4.3.2 y 5.3.01.02 → 5.4.4.
  -- Sin equivalente (proveedores por pagar, ISR/ITBIS retenidos a proveedores:
  -- 2.1.1 es agrupadora sin hijas): se deja el código viejo dentro del
  -- ayudante, que falla con mensaje claro al aprobar facturas o pagar a
  -- proveedores. No se inventan cuentas.
  FOR v_fn IN
    SELECT p.oid
      FROM pg_proc p
     WHERE p.pronamespace = 'contabilidad'::regnamespace
       AND p.proname IN ('aprobar_factura', 'pagar_cxp', 'transferir')
  LOOP
    v_def := pg_get_functiondef(v_fn.oid);
    v_nuevo := v_def;
    v_nuevo := replace(v_nuevo,
      $$(SELECT id FROM contabilidad.cuenta_contable
                       WHERE codigo = CASE WHEN v_dif > 0 THEN '4.9.01.03' ELSE '5.3.01.02' END)$$,
      $$contabilidad._cuenta_requerida(CASE WHEN v_dif > 0 THEN '4.3.2' ELSE '5.4.4' END)$$);
    v_nuevo := replace(v_nuevo,
      $$(SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '2.1.01.01')$$,
      $$contabilidad._cuenta_requerida('2.1.01.01')$$);
    v_nuevo := replace(v_nuevo,
      $$(SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '2.1.02.03')$$,
      $$contabilidad._cuenta_requerida('2.1.02.03')$$);
    v_nuevo := replace(v_nuevo,
      $$(SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '2.1.02.02')$$,
      $$contabilidad._cuenta_requerida('2.1.02.02')$$);
    IF v_nuevo <> v_def THEN
      EXECUTE v_nuevo;
    END IF;
  END LOOP;

  -- ------------------------------------------------------------
  -- 2) Catálogo viejo fuera del camino del UNIQUE(codigo)
  -- ------------------------------------------------------------
  -- Hoy '1.1' es «Activo Corriente» y mañana «Efectivo». El prefijo es
  -- temporal: estas filas se borran más abajo, en esta misma transacción.
  CREATE TEMP TABLE _cuenta_vieja ON COMMIT DROP AS
    SELECT id, codigo FROM contabilidad.cuenta_contable;
  UPDATE contabilidad.cuenta_contable SET codigo = 'ANT-' || codigo;

  -- ------------------------------------------------------------
  -- 3) Catálogo nuevo (88 cuentas)
  -- ------------------------------------------------------------
  -- Se inserta sin padre y luego se enlaza por código: el padre de un código
  -- es el código sin su último segmento. admite_movimiento = false en toda
  -- cuenta con hijas.
  INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo, admite_movimiento)
  VALUES
  -- INICIO-CATALOGO
  ('1', 'Activos', 'activo', false),
  ('1.1', 'Efectivo', 'activo', false),
  ('1.1.1', 'Caja Chica', 'activo', true),
  ('1.2', 'Bancos', 'activo', false),
  ('1.2.1', 'Banco Santa Cruz', 'activo', true),
  ('1.3', 'Edificios y Terrenos', 'activo', false),
  ('1.3.1', 'Edifcios', 'activo', true),
  ('1.3.2', 'Terrenos', 'activo', true),
  ('1.4', 'Mobiliario y Equipo de Oficina', 'activo', false),
  ('1.4.1', 'Mobiliario', 'activo', true),
  ('1.4.2', 'Computadoras', 'activo', true),
  ('1.4.3', 'Vehículos', 'activo', true),
  ('1.5', 'Otros Activos', 'activo', false),
  ('1.5.1', 'Otros Activos', 'activo', true),
  ('2', 'Pasivos', 'pasivo', false),
  ('2.1', 'Cuentas por Pagar', 'pasivo', false),
  ('2.1.1', 'Cuentas por Pagar Proveedores', 'pasivo', false),
  ('2.1.2', 'Cuentas por Pagar Universidades', 'pasivo', false),
  ('2.1.2.1', 'Cuentas por Pagar UCATECI', 'pasivo', true),
  ('2.1.2.2', 'Cuentas por Pagar UNPHU', 'pasivo', true),
  ('2.1.2.3', 'Cuentas por Pagar UASD', 'pasivo', true),
  ('2.1.3', 'Otras Cuentas por Pagar', 'pasivo', false),
  ('2.2', 'Prestamos', 'pasivo', false),
  ('2.2.1', 'Prestamos en Entidades Financieras', 'pasivo', true),
  ('2.3', 'Retenciones de Nómina por Pagar', 'pasivo', false),
  ('2.3.1', 'Retenciones TSS por Pagar', 'pasivo', true),
  ('3', 'Capital', 'patrimonio', false),
  ('3.1', 'Resultados de Operaciones', 'patrimonio', false),
  ('3.1.1', 'Balance Excedente', 'patrimonio', true),
  ('3.1.2', 'Balance Acumulado', 'patrimonio', true),
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
  ('5.1', 'Gastos de Programa de Becas', 'gasto', false),
  ('5.1.1', 'Inscripción de Estudiantes', 'gasto', true),
  ('5.1.2', 'Periodo Universitario', 'gasto', true),
  ('5.1.3', 'Libros y Materiales', 'gasto', true),
  ('5.1.4', 'Transporte de Estudiantes', 'gasto', true),
  ('5.2', 'Gastos de Programa de Alojamiento', 'gasto', false),
  ('5.2.1', 'Transporte de Programa de Alojamiento', 'gasto', false),
  ('5.2.1.1', 'Compra Semanal de Programa de Alojamiento', 'gasto', true),
  ('5.2.1.2', 'Recreación y Otros Beneficios', 'gasto', true),
  ('5.2.2', 'Manutención de Programa de Alojamiento', 'gasto', false),
  ('5.2.3', 'Electricidad Programa de Alojamiento', 'gasto', true),
  ('5.2.4', 'Comunicación e Internet Programa de Alojamiento', 'gasto', true),
  ('5.3', 'Gastos Administrativos', 'gasto', false),
  ('5.3.1', 'Alquiler de Locales', 'gasto', true),
  ('5.3.2', 'Electricidad de Locales', 'gasto', false),
  ('5.3.2.1', 'Electricidad de Oficina Principal', 'gasto', true),
  ('5.3.2.2', 'Electricidad de Instituto Técnico', 'gasto', true),
  ('5.3.2.3', 'Electricidad de Otras Oficinas', 'gasto', true),
  ('5.3.3', 'Sueldos y Salarios de Empleados', 'gasto', false),
  ('5.3.3.1', 'Salario de Programa de Habitudes', 'gasto', true),
  ('5.3.3.2', 'Salario de Programa de Alojamiento', 'gasto', true),
  ('5.3.3.3', 'Salario de Programa 360', 'gasto', true),
  ('5.3.3.4', 'Salario de Programa de Becas', 'gasto', true),
  ('5.3.3.5', 'Salario de Personal Administrativo', 'gasto', true),
  ('5.3.4', 'Aportes a la Seguridad Social e INFOTEP', 'gasto', false),
  ('5.3.4.1', 'AFP Empleador (7.10%)', 'gasto', true),
  ('5.3.4.2', 'SFS Empleador (7.09%)', 'gasto', true),
  ('5.3.4.3', 'Riesgo Laboral Empleador (1%)', 'gasto', true),
  ('5.3.4.4', 'INFOTEP (1%)', 'gasto', true),
  ('5.3.5', 'Regalía Pascual', 'gasto', true),
  ('5.4', 'Otros Gastos', 'gasto', false),
  ('5.4.3', 'Comisiones Bancarios', 'gasto', true),
  ('5.4.4', 'Diferencia de Cambios de Moneda', 'gasto', true),
  ('5.4.5', 'Papelería y Suministros', 'gasto', true),
  ('5.4.6', 'Servicios de Comunicación', 'gasto', false),
  ('5.4.6.1', 'Internet', 'gasto', true),
  ('5.4.6.2', 'Telefono', 'gasto', true),
  ('5.4.7', 'Eventos o Campañas', 'gasto', true),
  ('5.4.8', 'Gastos de Viajes y Agenda', 'gasto', true),
  ('5.4.9', 'Donaciones y Aportes a Iglesias', 'gasto', true),
  ('5.4.10', 'Almuerzo Estudiantil', 'gasto', true),
  ('5.4.11', 'Reunión Mensual', 'gasto', false),
  ('5.4.11.1', 'Merienda Reunión Mensual', 'gasto', true),
  ('5.4.11.2', 'Decoración Reunión Mensual', 'gasto', true),
  ('5.4.11.3', 'Alquileres Reunión Mensual', 'gasto', true),
  ('5.4.12', 'Otros Gastos', 'gasto', true)
  -- FIN-CATALOGO
  ;

  UPDATE contabilidad.cuenta_contable h
     SET padre_id = p.id
    FROM contabilidad.cuenta_contable p
   WHERE h.codigo NOT LIKE 'ANT-%'
     AND strpos(h.codigo, '.') > 0
     AND p.codigo = regexp_replace(h.codigo, '\.[0-9]+$', '');

  -- ------------------------------------------------------------
  -- 4) Remapeo de la configuración viva (viejo → nuevo)
  -- ------------------------------------------------------------
  CREATE TEMP TABLE _mapa (viejo text, nuevo text) ON COMMIT DROP;
  INSERT INTO _mapa VALUES
    -- categoria
    ('1.2.01.01', '1.4.2'),  ('4.1.01.01', '4.1.1'),  ('4.1.01.02', '4.1.3'),
    ('4.1.01.03', '4.1.1'),  ('4.2.01.01', '4.2.1'),  ('4.9.01.02', '4.3.1'),
    ('5.1.01.01', '5.3.3.5'),('5.2.01.01', '5.3.1'),  ('5.2.01.02', '5.3.2.1'),
    ('5.2.01.03', '5.4.6.1'),('5.2.01.04', '5.4.5'),  ('5.2.01.05', '5.1.4'),
    ('5.2.01.06', '5.4.12'), ('5.3.01.01', '5.4.3'),  ('5.4.01.01', '5.4.12'),
    ('5.4.01.03', '5.1.2'),  ('5.9.01.01', '5.4.12'),
    -- presupuesto_linea y artículos de consumo
    ('5.2.01.07', '5.4.10'),
    -- cuentas de bancos (DOP y USD comparten la única cuenta de banco del Excel)
    ('1.1.02.01', '1.2.1'),  ('1.1.02.02', '1.2.1'),
    -- categorías de activos fijos: la cuenta del activo sí tiene equivalente
    ('1.2.04', '1.3.1'),     ('1.2.02', '1.4.1'),     ('1.2.03', '1.4.3');

  -- Un artículo o categoría que apunta a un código viejo se resuelve por
  -- id: viejo(id) → codigo viejo → codigo nuevo → id nuevo.
  CREATE TEMP TABLE _remap ON COMMIT DROP AS
    SELECT v.id AS id_viejo, n.id AS id_nuevo
      FROM _mapa m
      JOIN _cuenta_vieja v ON v.codigo = m.viejo
      JOIN contabilidad.cuenta_contable n ON n.codigo = m.nuevo;

  UPDATE contabilidad.categoria c SET cuenta_id = r.id_nuevo
    FROM _remap r WHERE c.cuenta_id = r.id_viejo;
  -- Lo que no tiene equivalente queda sin cuenta (columna opcional): el
  -- recibo de esa categoría se niega a contabilizar con un mensaje claro.
  UPDATE contabilidad.categoria SET cuenta_id = NULL
   WHERE cuenta_id IN (SELECT id FROM _cuenta_vieja);

  UPDATE contabilidad.cuenta_bancaria cb SET cuenta_contable_id = r.id_nuevo
    FROM _remap r WHERE cb.cuenta_contable_id = r.id_viejo;

  -- Las 8 cuentas viejas del presupuesto van a 8 destinos distintos, así que
  -- no choca con uq_presupuesto_linea.
  UPDATE contabilidad.presupuesto_linea pl SET cuenta_id = r.id_nuevo
    FROM _remap r WHERE pl.cuenta_id = r.id_viejo;

  UPDATE contabilidad.articulo a SET cuenta_gasto_id = r.id_nuevo
    FROM _remap r WHERE a.cuenta_gasto_id = r.id_viejo;

  -- El catálogo nuevo no tiene cuenta de inventario: el artículo queda sin
  -- ella y consumir/comprar inventario falla con mensaje claro en el código.
  ALTER TABLE contabilidad.articulo ALTER COLUMN cuenta_inventario_id DROP NOT NULL;
  UPDATE contabilidad.articulo SET cuenta_inventario_id = NULL
   WHERE cuenta_inventario_id IN (SELECT id FROM _cuenta_vieja);
  -- Si el consumo apuntaba a una cuenta sin equivalente, también queda vacío.
  ALTER TABLE contabilidad.articulo ALTER COLUMN cuenta_gasto_id DROP NOT NULL;
  UPDATE contabilidad.articulo SET cuenta_gasto_id = NULL
   WHERE cuenta_gasto_id IN (SELECT id FROM _cuenta_vieja);

  UPDATE contabilidad.activo_categoria ac SET cuenta_activo_id = r.id_nuevo
    FROM _remap r WHERE ac.cuenta_activo_id = r.id_viejo;
  -- Depreciación (gasto y acumulada): no existe en el catálogo nuevo. Las
  -- columnas son NOT NULL, así que se apuntan a 5.4.12 «Otros Gastos» para
  -- no romper la FK; el código bloquea la depreciación mensual con un
  -- mensaje claro mientras el catálogo no tenga esas cuentas.
  UPDATE contabilidad.activo_categoria
     SET cuenta_gasto_depreciacion_id = (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '5.4.12'),
         cuenta_depreciacion_acumulada_id = (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '5.4.12')
   WHERE cuenta_gasto_depreciacion_id IN (SELECT id FROM _cuenta_vieja)
      OR cuenta_depreciacion_acumulada_id IN (SELECT id FROM _cuenta_vieja);
  -- Una categoría cuyo activo no tuvo equivalente (no debería ocurrir) igual
  -- cae a 5.4.12 para no dejar la FK colgando.
  UPDATE contabilidad.activo_categoria
     SET cuenta_activo_id = (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '5.4.12')
   WHERE cuenta_activo_id IN (SELECT id FROM _cuenta_vieja);

  -- Cajas: su cuenta se resuelve por código literal en el código (1.1.1).
  UPDATE contabilidad.caja SET cuenta_contable_id = NULL
   WHERE cuenta_contable_id IN (SELECT id FROM _cuenta_vieja);

  -- ------------------------------------------------------------
  -- 5) Que no quede historia colgando de cuentas viejas
  -- ------------------------------------------------------------
  SELECT count(*) INTO v_n FROM contabilidad.asiento_linea
   WHERE cuenta_id IN (SELECT id FROM _cuenta_vieja);
  IF v_n > 0 THEN
    RAISE EXCEPTION
      '0107: % líneas de asiento usan cuentas del catálogo viejo. Corre antes node scripts/reiniciar-contabilidad.mjs --confirmar',
      v_n;
  END IF;
  SELECT count(*) INTO v_n FROM contabilidad.recibo
   WHERE cuenta_contrapartida_id IN (SELECT id FROM _cuenta_vieja);
  IF v_n > 0 THEN
    RAISE EXCEPTION '0107: % recibos usan cuentas del catálogo viejo. Corre antes scripts/reiniciar-contabilidad.mjs', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM contabilidad.presupuesto_linea
   WHERE cuenta_id IN (SELECT id FROM _cuenta_vieja);
  IF v_n > 0 THEN
    RAISE EXCEPTION '0107: % líneas de presupuesto sin equivalente en el catálogo nuevo', v_n;
  END IF;

  -- ------------------------------------------------------------
  -- 6) Borrar el catálogo viejo
  -- ------------------------------------------------------------
  -- «En contabilidad nada se borra» (tg_proteger_…): aquí sí hay que borrar,
  -- porque el catálogo viejo fue de prueba, está respaldado y ya no tiene
  -- movimientos. Se suspende SOLO ese disparador de esta tabla y se reactiva
  -- en el mismo bloque. La bitácora (tg_bitacora_…) sigue activa y deja el
  -- registro de cada borrado, encadenado como siempre.
  ALTER TABLE contabilidad.cuenta_contable DISABLE TRIGGER tg_proteger_contabilidad_cuenta_contable;
  DELETE FROM contabilidad.cuenta_contable WHERE id IN (SELECT id FROM _cuenta_vieja);
  ALTER TABLE contabilidad.cuenta_contable ENABLE TRIGGER tg_proteger_contabilidad_cuenta_contable;
END
$migracion$;
